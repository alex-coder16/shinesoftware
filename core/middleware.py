# dashboard/middleware.py
import requests
from django.conf import settings as django_settings
from django.shortcuts import render, redirect
from django.urls import reverse, NoReverseMatch
from dashboard.models import SiteSetting
import uuid

class CloudflareCaptchaMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.captcha_bypass_prefixes = ['/admin/']
        if hasattr(django_settings, 'STATIC_URL') and django_settings.STATIC_URL:
            self.captcha_bypass_prefixes.append(django_settings.STATIC_URL)
        if hasattr(django_settings, 'MEDIA_URL') and django_settings.MEDIA_URL:
            self.captcha_bypass_prefixes.append(django_settings.MEDIA_URL)

    def _generate_ray_id(self):
        return uuid.uuid4().hex[:16] # 16-character hex string

    def __call__(self, request):
        current_path = request.path_info
        for prefix in self.captcha_bypass_prefixes:
            if current_path.startswith(prefix):
                return self.get_response(request)

        try:
            site_settings = SiteSetting.load()
        except Exception:
            return self.get_response(request)

        if not site_settings.enable_captcha or \
           not site_settings.cloudflare_site_key or \
           not site_settings.cloudflare_secret_key:
            return self.get_response(request)

        captcha_verified_session_key = 'captcha_verified_for_public_access'
        current_ray_id = self._generate_ray_id() # Generate Ray ID for this check
        site_domain = request.get_host() # Get current domain

        context_for_captcha_page = {
            'cloudflare_site_key': site_settings.cloudflare_site_key,
            'submit_url': request.get_full_path(), # Form on captcha_page posts to current URL
            'ray_id': current_ray_id,
            'site_domain': site_domain,
        }

        if request.method == 'POST':
            captcha_token = request.POST.get('cf-turnstile-response')
            
            if not captcha_token:
                context_for_captcha_page['error'] = 'CAPTCHA token missing. Please complete the CAPTCHA.'
                # Ensure the turnstile challenge is visible immediately if there's an error on POST
                context_for_captcha_page['show_challenge_immediately'] = True 
                return render(request, 'core/captcha_page.html', context_for_captcha_page)

            payload = {'secret': site_settings.cloudflare_secret_key, 'response': captcha_token}
            if request.META.get('REMOTE_ADDR'):
                payload['remoteip'] = request.META.get('REMOTE_ADDR')
            
            try:
                api_response = requests.post('https://challenges.cloudflare.com/turnstile/v0/siteverify', data=payload, timeout=5)
                api_response.raise_for_status()
                result = api_response.json()
            except requests.RequestException as e:
                context_for_captcha_page['error'] = 'Could not verify CAPTCHA with the provider. Please try again later.'
                context_for_captcha_page['show_challenge_immediately'] = True
                return render(request, 'core/captcha_page.html', context_for_captcha_page)

            if result.get('success'):
                request.session[captcha_verified_session_key] = True
                return self.get_response(request)
            else:
                context_for_captcha_page['error'] = 'CAPTCHA verification failed. Please try again.'
                context_for_captcha_page['error_codes'] = result.get('error-codes', [])
                context_for_captcha_page['show_challenge_immediately'] = True
                return render(request, 'core/captcha_page.html', context_for_captcha_page)

        if not request.session.get(captcha_verified_session_key):
            return render(request, 'core/captcha_page.html', context_for_captcha_page)
        
        return self.get_response(request)