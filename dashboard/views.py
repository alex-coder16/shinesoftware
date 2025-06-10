# dashboard/views.py

from django.shortcuts import render, redirect, get_object_or_404
from django.urls import reverse
from django.contrib.auth.decorators import login_required
from django.contrib.auth import authenticate, login as auth_login, logout as auth_logout
from django.contrib.auth.forms import AuthenticationForm
from django.contrib import messages
from django.contrib.auth.models import User
from django.http import JsonResponse
from .models import SiteSetting, ClientConnection
from django.views.decorators.http import require_POST
import json
from .consumers import DashboardConsumer
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync


@login_required
def dashboard(request):
    # Calculate total visits: count of all unique client sessions tracked
    # Each record in ClientConnection represents a unique visitor session
    total_visits = ClientConnection.objects.count()

    # Calculate total connects: count of clients marked as 'is_connected'
    total_connects = ClientConnection.objects.filter(is_connected=True).count()
    
    # Get all connected clients to display in the table (initially)
    # We will refine this later for pagination and real-time updates
    # For now, let's get the most recent ones that are marked as connected
    # or simply all for demonstration. The JS part adds rows dynamically for now.
    # The `addNewRow` in JS is adding dummy data currently.
    # We'll eventually want this view to pass the initial client list.
    
    # For now, let's stick to the original request of just fixing counts.
    # The client list will be populated by JS on 'initial_clients' socket event (later).

    context = {
        'user': request.user, # Already there
        'total_visits': total_visits,
        'total_connects': total_connects,
        # 'connected_clients_initial': [client.to_dict() for client in connected_clients] # We'll use this later
    }
    return render(request, 'dashboard/dashboard.html', context)
@login_required
def panel_settings(request):
    site_settings = SiteSetting.load() # Load the singleton settings object
    context = {
        'user': request.user,
        'cloudflare_settings': {
            'site_key': site_settings.cloudflare_site_key or '', 
            'secret_key': site_settings.cloudflare_secret_key or '', 
        },
        'control_settings': {
            'enable_captcha': site_settings.enable_captcha, 
            'panel_status_online': True, # Placeholder, or move to SiteSetting model
            'log_visitor': False,      # Placeholder, or move to SiteSetting model
            'log_deletion': False,     # Placeholder, or move to SiteSetting model
            'log_creation': False,     # Placeholder, or move to SiteSetting model
            'log_elevation': False,    # Placeholder, or move to SiteSetting model
        }
    }
    return render(request, 'dashboard/panel_settings.html', context)


@login_required
def user_settings(request):
    context = {
        'user': request.user
    }
    return render(request, 'dashboard/user_settings.html', context)

@login_required
def routes(request):
    context = {
        'user': request.user
    }
    return render(request, 'dashboard/routes.html', context)

# --- Authentication Views ---
def login_view(request):
    if request.user.is_authenticated:
        return redirect(reverse('dashboard'))

    if request.method == 'POST':
        form = AuthenticationForm(request, data=request.POST)
        if form.is_valid():
            username = form.cleaned_data.get('username')
            password = form.cleaned_data.get('password')
            user = authenticate(request, username=username, password=password)
            if user is not None:
                auth_login(request, user)
                messages.success(request, f"Welcome back, {username}!")
                next_url = request.POST.get('next')
                if next_url:
                    return redirect(next_url)
                return redirect(reverse('dashboard'))
            else:
                messages.error(request, "Invalid username or password.")
        else:
            messages.error(request, "Invalid username or password.") # Or iterate form.errors
    else:
        form = AuthenticationForm()
    
    context = {
        'form': form,
        # 'user': request.user # request.user will be AnonymousUser here, which is fine for the template
    }
    return render(request, 'dashboard/login.html', context)

def logout_view(request):
    auth_logout(request)
    messages.info(request, "You have been successfully logged out.")
    return redirect(reverse('login'))


# --- Password Reset Views (Placeholders - to be fully implemented later) ---
def password_reset_request_view(request):
    if request.method == 'POST':
        username_to_reset = request.POST.get('username_reset')
        try:
            user_to_reset = User.objects.get(username=username_to_reset)
            if hasattr(user_to_reset, 'profile') and user_to_reset.profile.security_question:
                # For now, we don't have a secure token system, so this is a simplified flow
                # In a real app, generate a temporary signed token.
                messages.success(request, f"Security question found for {username_to_reset}.")
                return redirect(reverse('password_reset_security_question', kwargs={'user_id': user_to_reset.pk}))
            else:
                messages.error(request, "Security question not set up for this account, or account not found.")
                return redirect(reverse('password_reset_request'))
        except User.DoesNotExist:
            messages.error(request, "Username not found.")
            return redirect(reverse('password_reset_request'))
        
    return render(request, 'dashboard/password_reset_request.html')

def password_reset_security_question_view(request, user_id):
    user_to_reset = get_object_or_404(User, pk=user_id)
    
    if not (hasattr(user_to_reset, 'profile') and user_to_reset.profile.security_question):
        messages.error(request, "Security question not available for this user.")
        return redirect(reverse('login'))

    if request.method == 'POST':
        submitted_answer = request.POST.get('security_answer')
        # !! IMPORTANT: This is a placeholder for actual security answer checking.
        # You MUST hash and compare security answers securely. Never store them in plain text.
        # For this example, we'll assume a very insecure direct comparison (DO NOT USE IN PRODUCTION)
        # A real implementation would involve comparing `submitted_answer` against a hashed `user_to_reset.profile.security_answer_hash`
        
        # Placeholder: In a real app, you would have a hashed answer in the profile
        # and compare `check_password(submitted_answer, user_to_reset.profile.security_answer_hash)`
        
        # For now, let's assume we store the answer plain text (VERY INSECURE - FOR DEMO ONLY)
        # and you have a field `security_answer_plain` on the profile for this demo.
        # Replace this with actual secure logic.
        # stored_answer_plain = getattr(user_to_reset.profile, 'security_answer_plain', None)

        # if stored_answer_plain and submitted_answer == stored_answer_plain:

        # SIMPLIFIED: Let's just pretend any answer is correct for now to proceed in flow
        # REMOVE THIS IN PRODUCTION
        print(f"Submitted answer for user {user_to_reset.username}: {submitted_answer} (DEMO: Assuming correct)")
        if submitted_answer: # Just check if an answer was submitted for demo
            messages.success(request, "Security answer accepted (DEMO). Please set your new password.")
            # In a real app, generate a temporary token here to secure the next step
            return redirect(reverse('password_reset_set_new', kwargs={'user_id': user_to_reset.pk, 'token': 'demo_token'})) # Pass token
        else:
            messages.error(request, "Incorrect security answer (DEMO).")
            return redirect(reverse('password_reset_security_question', kwargs={'user_id': user_to_reset.pk}))

    context = {
        'security_question': user_to_reset.profile.security_question,
        'user_id_for_form': user_to_reset.pk # To construct the form action URL correctly
    }
    return render(request, 'dashboard/password_reset_security_question.html', context)


def password_reset_set_new_view(request, user_id, token): # Added token
    user_to_reset = get_object_or_404(User, pk=user_id)
    
    # !! IMPORTANT: Validate the token here to ensure this step is authorized
    # For this demo, we are using a placeholder 'demo_token'
    if token != 'demo_token': # Replace with real token validation
        messages.error(request, "Invalid or expired password reset link.")
        return redirect(reverse('login'))

    if request.method == 'POST':
        new_password = request.POST.get('new_password')
        confirm_password = request.POST.get('confirm_password')
        if new_password and new_password == confirm_password:
            user_to_reset.set_password(new_password)
            user_to_reset.save()
            messages.success(request, "Your password has been successfully reset. Please log in.")
            return redirect(reverse('login'))
        else:
            messages.error(request, "Passwords do not match or are empty.")
            # Stay on the same page to allow re-entry, pass context again
            context = {
                'user_id_for_form': user_to_reset.pk,
                'token_for_form': token
            }
            return render(request, 'dashboard/password_reset_set_new.html', context)
            
    context = {
        'user_id_for_form': user_to_reset.pk,
        'token_for_form': token
    }
    return render(request, 'dashboard/password_reset_set_new.html', context)


# --- Panel Settings Form Handlers ---
@login_required
def save_captcha_settings_view(request):
    if request.method == 'POST':
        site_key = request.POST.get('cloudflare_site_key')
        secret_key = request.POST.get('cloudflare_secret_key')
        
        site_settings = SiteSetting.load()
        site_settings.cloudflare_site_key = site_key
        site_settings.cloudflare_secret_key = secret_key
        site_settings.save()
        
        messages.success(request, "Cloudflare CAPTCHA settings saved.")
        return redirect(reverse('settings')) # 'settings' is the name for panel_settings
    return redirect(reverse('settings'))

@login_required
def save_control_settings_view(request):
    if request.method == 'POST':
        site_settings = SiteSetting.load()
        site_settings.enable_captcha = request.POST.get('enable_captcha') == 'on'
        # Example for other settings if moved to model:
        # site_settings.panel_status_online = request.POST.get('panel_status_online') == 'on'
        # site_settings.log_visitor = request.POST.get('log_visitor') == 'on'
        # ... etc.
        site_settings.save()
        
        messages.success(request, "Control settings saved.")
        return redirect(reverse('settings'))
    return redirect(reverse('settings'))

# --- User Settings Form Handlers ---
@login_required
def update_profile_settings_view(request):
    if request.method == 'POST':
        username = request.POST.get('username')
        profile_picture = request.FILES.get('profile_picture')
        
        current_user = request.user
        response_data = {'success': False, 'message': 'An unknown error occurred.'}
        
        username_updated = False
        avatar_url = None # Initialize avatar_url

        # Username update logic
        if username and username != current_user.username:
            if User.objects.filter(username=username).exclude(pk=current_user.pk).exists():
                response_data = {'success': False, 'message': f"Username '{username}' is already taken."}
                return JsonResponse(response_data)
            else:
                current_user.username = username
                # current_user.save() # Save only once at the end if other changes might occur
                username_updated = True
                # response_data = {'success': True, 'message': "Username updated successfully."} # Consolidate messages later

        # Profile picture update logic
        if profile_picture:
            if hasattr(current_user, 'profile'):
                try:
                    # It's good practice to handle potential errors during file save
                    current_user.profile.avatar = profile_picture
                    current_user.profile.save()
                    avatar_url = current_user.profile.avatar.url
                    # response_data = {'success': True, 'message': "Profile picture updated successfully."} # Consolidate messages
                except Exception as e:
                    # Log the exception e
                    response_data = {'success': False, 'message': "Error saving profile picture."}
                    # Potentially save user if username was changed before this error
                    if username_updated: current_user.save()
                    return JsonResponse(response_data)
            else:
                response_data = {'success': False, 'message': "Profile not found for picture update."}
                if username_updated: current_user.save() # Save username if it was changed
                return JsonResponse(response_data)
        
        # Save user if username changed and no errors occurred before or if only username changed
        if username_updated:
            current_user.save()

        # Construct success response
        if username_updated or avatar_url:
            response_data['success'] = True
            response_data['username'] = current_user.username # Send back the possibly updated username
            if avatar_url:
                response_data['avatar_url'] = avatar_url
            
            if username_updated and avatar_url:
                response_data['message'] = "Username and profile picture updated successfully."
            elif username_updated:
                response_data['message'] = "Username updated successfully."
            elif avatar_url:
                response_data['message'] = "Profile picture updated successfully."
        elif not username and not profile_picture: # No actual data sent for update
             response_data = {'success': False, 'message': "No data provided for update."}
        # If only profile_picture was sent but failed for a reason other than 'profile not found' or 'save error'
        # (though current logic covers these), this else might be hit.
        # Default error message is already set if neither username_updated nor avatar_url is true.

        print(f"Profile update for {current_user.username}: New Username='{username if username else '(not changed)'}', Picture='{profile_picture.name if profile_picture else 'No Picture'}' -> Success: {response_data.get('success')}")
        return JsonResponse(response_data)
    
    return JsonResponse({'success': False, 'message': 'Invalid request method.'}, status=405)

@login_required
def update_password_settings_view(request):
    # ... (your existing code) ...
    if request.method == 'POST':
        current_password = request.POST.get('current_password')
        new_password = request.POST.get('new_password')
        confirm_new_password = request.POST.get('confirm_new_password')
        
        user = request.user
        if not user.check_password(current_password):
            messages.error(request, "Incorrect current password.")
        elif not new_password or not confirm_new_password:
            messages.error(request, "New password fields cannot be empty.")
        elif new_password != confirm_new_password:
            messages.error(request, "New passwords do not match.")
        else:
            user.set_password(new_password)
            user.save()
            from django.contrib.auth import update_session_auth_hash # Important!
            update_session_auth_hash(request, user) # Keeps user logged in
            messages.success(request, "Password updated successfully.")
            return redirect(reverse('user')) # Or to login page if preferred after password change
        
        # If any error, redirect back to user settings to show messages
        return redirect(reverse('user'))
    return redirect(reverse('user'))

@login_required
def update_security_question_view(request):
    # ... (your existing code) ...
    if request.method == 'POST':
        security_question_text = request.POST.get('security_question')
        security_answer_plain = request.POST.get('security_answer') # Store this hashed!

        if hasattr(request.user, 'profile'):
            profile = request.user.profile
            profile.security_question = security_question_text
            # !! IMPORTANT: Hash the security_answer_plain before saving it to the database
            # from django.contrib.auth.hashers import make_password
            # profile.security_answer_hash = make_password(security_answer_plain)
            # For demo, we'll just print. DO NOT SAVE PLAIN TEXT ANSWERS.
            print(f"DEMO: Security question for {request.user.username}: Q='{security_question_text}', A='{security_answer_plain}' (Answer NOT saved securely in this demo)")
            profile.save() # This would save the question and the (hopefully) hashed answer
            messages.success(request, "Security question updated (DEMO: answer not securely stored).")
        else:
            messages.error(request, "Profile not found.")
        return redirect(reverse('user'))
    return redirect(reverse('user'))

@login_required
def lockdown_account_view(request):
    # ... (your existing code) ...
    if request.method == 'POST':
        user_to_lockdown = request.user
        print(f"Account lockdown initiated for user: {user_to_lockdown.username}")
        
        # Example of actual lockdown:
        # user_to_lockdown.is_active = False # This prevents login via standard Django auth
        # user_to_lockdown.save()
        # # You might also want to invalidate sessions here if using a package like django-user-sessions

        auth_logout(request) # Logout the current session
        messages.info(request, "Your account has been locked down (DEMO: user.is_active not changed). You have been logged out.")
        return redirect(reverse('login')) # Redirect to login page
        
    return redirect(reverse('user'))


@login_required # Ensure only logged-in admins can access this
@require_POST   # Ensure this view only accepts POST requests
def delete_client_view(request):
    if not request.user.is_staff and not request.user.is_superuser: # Additional check for admin/staff
        return JsonResponse({'success': False, 'message': 'Unauthorized.'}, status=403)

    try:
        data = json.loads(request.body)
        ip_address_to_delete = data.get('ip')

        if not ip_address_to_delete:
            return JsonResponse({'success': False, 'message': 'IP address not provided.'}, status=400)

        try:
            client_conn = ClientConnection.objects.get(ip_address=ip_address_to_delete)
            
            was_connected = client_conn.is_connected # Check if it was a "connected" client before deleting
            client_id_for_log = client_conn.client_id # For logging

            client_conn.delete()
            print(f"Admin {request.user.username} deleted client record for IP: {ip_address_to_delete} (session: {client_id_for_log})")

            # After deletion, get the new counts
            channel_layer = get_channel_layer()
            total_visits_now = ClientConnection.objects.count() # Unique IPs remaining
            total_connects_now = ClientConnection.objects.filter(is_connected=True).count()

            # Broadcast updated stats and a specific client_deleted event
            # The 'dashboard_update' will refresh counts and the client list if it's re-fetched
            # by the 'initial_data' logic on the frontend (though immediate row removal is better UX).
            async_to_sync(channel_layer.group_send)(
                DashboardConsumer.dashboard_group_name,
                {
                    'type': 'send_dashboard_update', # This will trigger JS to update counts
                    'data': {
                        'total_visits': total_visits_now,
                        'total_connects': total_connects_now,
                        # Optionally, send a specific "deleted_client_id" if JS needs it
                        # beyond just removing the row by IP.
                        # 'deleted_client_ip': ip_address_to_delete
                    }
                }
            )
            print(f"Broadcasted stats update after deleting {ip_address_to_delete}. Visits: {total_visits_now}, Connects: {total_connects_now}")

            return JsonResponse({'success': True, 'message': f'Client {ip_address_to_delete} deleted successfully.'})

        except ClientConnection.DoesNotExist:
            return JsonResponse({'success': False, 'message': f'Client with IP {ip_address_to_delete} not found.'}, status=404)
        except Exception as e:
            print(f"Error deleting client {ip_address_to_delete}: {e}")
            return JsonResponse({'success': False, 'message': 'An error occurred while deleting the client.'}, status=500)

    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Invalid JSON data.'}, status=400)
    except Exception as e:
        print(f"Outer error in delete_client_view: {e}")
        return JsonResponse({'success': False, 'message': 'An unexpected server error occurred.'}, status=500)
