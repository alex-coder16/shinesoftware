# dashboard/middleware.py
import uuid
from django.utils import timezone
from .models import ClientConnection
from django.conf import settings
from django.urls import resolve, Resolver404

# Import Channels specific modules
from channels.layers import get_channel_layer  # To get the channel layer instance
from asgiref.sync import async_to_sync        # To call async channel layer methods from sync middleware
from .consumers import DashboardConsumer       # To access the group name



class VisitorTrackingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        # Get the channel layer once during initialization
        self.channel_layer = get_channel_layer()

    def __call__(self, request):
        if not request.session.session_key:
            request.session.create()
        session_id_for_storage = request.session.session_key

        path = request.path_info
        static_url_path = getattr(settings, 'STATIC_URL', '/static/')
        media_url_path = getattr(settings, 'MEDIA_URL', '/media/')

        if static_url_path and not static_url_path.endswith('/'):
            static_url_path += '/'
        if media_url_path and not media_url_path.endswith('/'):
             media_url_path += '/'

        is_static_or_media = path.startswith(static_url_path) or \
                             (media_url_path and path.startswith(media_url_path))
        is_admin_path = path.startswith('/admin/dashboard/') or path.startswith('/admin/')
        
        common_asset_extensions = (
            '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.map',
            '.woff', '.woff2', '.ttf', '.eot', '.ico', '.json', '.txt', '.webmanifest',
            '.xml', '.otf'
        )
        is_common_asset = False
        if not (is_static_or_media or is_admin_path) and '.' in path.split('/')[-1]:
            if any(path.lower().endswith(ext) for ext in common_asset_extensions):
                is_common_asset = True

        if is_static_or_media or is_admin_path or is_common_asset:
            return self.get_response(request)

        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        ip_address = x_forwarded_for.split(',')[0] if x_forwarded_for else request.META.get('REMOTE_ADDR')

        user_agent_string = request.META.get('HTTP_USER_AGENT', '')
        user_agent_parsed = getattr(request, 'user_agent', None)
        browser_name = 'Unknown'; browser_version = ''; os_name = 'Unknown'; os_version = ''; device_type = 'Unknown'
        if user_agent_parsed:
            browser_name = user_agent_parsed.browser.family; browser_version = user_agent_parsed.browser.version_string
            os_name = user_agent_parsed.os.family; os_version = user_agent_parsed.os.version_string
            if user_agent_parsed.is_mobile: device_type = 'Mobile'
            elif user_agent_parsed.is_tablet: device_type = 'Tablet'
            elif user_agent_parsed.is_pc: device_type = 'Desktop'
            elif user_agent_parsed.is_bot: device_type = 'Bot'

        current_page_name_display = 'Unknown Page'
        current_page_icon_class_default = 'fas fa-file-alt'
        try:
            resolver_match = resolve(request.path_info)
            url_name = resolver_match.url_name # This is what we use as key
            
            # Use the mapping from settings
            page_meta = settings.PAGE_NAME_MAPPING.get(url_name)
            if page_meta:
                current_page_name_display = page_meta['name']
                # We store the friendly name. The icon can be derived later by to_dict or JS.
            elif resolver_match.view_name:
                current_page_name_display = resolver_match.view_name.split(':')[-1].replace('_', ' ').title()
        except Resolver404:
            current_page_name_display = request.path_info

        client_timezone = request.META.get('HTTP_X_CLIENT_TIMEZONE', None) or 'UTC'
        client_language = (request.META.get('HTTP_ACCEPT_LANGUAGE', '').split(',')[0].strip() or 'en')


        # --- Logic for broadcasting ---
        broadcast_stats_update = False
        broadcast_client_page_update = False
        client_data_for_page_update = None
        # is_new_ip_record = False

        try:
            # **** THIS IS THE CORRECTED SECTION ****
            client_conn, created = ClientConnection.objects.get_or_create(ip_address=ip_address)
            # 'created' is True if a new record for this IP was made, False if it already existed.

            # Always update these fields based on the current request for this IP
            client_conn.client_id = session_id_for_storage # Store/update the most recent session_id
            client_conn.current_page_name = current_page_name_display
            client_conn.last_seen = timezone.now()
            client_conn.current_page_url = request.build_absolute_uri()
            client_conn.user_agent = user_agent_string
            client_conn.browser_name = browser_name
            client_conn.browser_version = browser_version
            client_conn.os_name = os_name
            client_conn.os_version = os_version
            client_conn.device_type = device_type
            client_conn.timezone = client_timezone
            client_conn.language = client_language
            # IMPORTANT: is_connected and connection_data are NOT set here.
            # They are only set by the submit_code_view when a user explicitly "connects".
            # This preserves their state if the IP was already connected.
            client_conn.save()
            # **** END OF CORRECTED SECTION ****

            if created: # This means it's the first time we're seeing this IP
                print(f"New IP tracked (middleware): {ip_address} on {current_page_name_display}")
                broadcast_stats_update = True # "Total Visits" (unique IPs) count will change
            
            # Now check if this IP is connected to decide if we should send page updates for its row
            if client_conn.is_connected:
               print(f"Connected IP activity (middleware): {ip_address} on {current_page_name_display}")
               broadcast_client_page_update = True
               client_data_for_page_update = client_conn.to_dict() # Get fresh data for the row
            elif not created: # Existing IP, but not connected
                print(f"IP activity (not connected): {ip_address} on {current_page_name_display}")


        except Exception as e:
            print(f"Error in VisitorTrackingMiddleware (DB ops): {e}")
            # In case of error, client_conn might not be defined.
            # Ensure downstream logic handles this if necessary, though broadcasting flags will be False.
            client_conn = None # Explicitly set to None on error to avoid UnboundLocalError

        response = self.get_response(request)

        if broadcast_stats_update:
            try:
                total_visits_now = ClientConnection.objects.count() # Count of unique IPs
                total_connects_now = ClientConnection.objects.filter(is_connected=True).count()
                print(f"Broadcasting dashboard stats update. Visits (IPs): {total_visits_now}, Connects (IPs): {total_connects_now}")
                async_to_sync(self.channel_layer.group_send)(
                    DashboardConsumer.dashboard_group_name,
                    {'type': 'send_dashboard_update', 'data': {'total_visits': total_visits_now, 'total_connects': total_connects_now}}
                )
            except Exception as e:
                print(f"Error broadcasting stats from middleware: {e}")

        if broadcast_client_page_update and client_data_for_page_update:
            try:
                # client_data_for_page_update['id'] will be the IP address due to to_dict()
                print(f"Broadcasting client page update for IP {ip_address} to page {client_data_for_page_update.get('page', {}).get('name')}")
                async_to_sync(self.channel_layer.group_send)(
                    DashboardConsumer.dashboard_group_name,
                    {'type': 'send_client_row_update', 'data': client_data_for_page_update }
                )
            except Exception as e:
                print(f"Error broadcasting client page update from middleware: {e}")

        return response