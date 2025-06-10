"""
WSGI config for shinesoftware project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/wsgi/
"""

import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack # For authentication in WebSockets
# We will import dashboard.routing later when we create it
# import dashboard.routing

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'shinesoftware.settings')

# Get the default Django ASGI application (for HTTP requests)
django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter({
    "http": django_asgi_app,  # Handles traditional HTTP requests
    "websocket": AuthMiddlewareStack( # Handles WebSocket connections
        URLRouter(
            # We will add WebSocket URL patterns from dashboard.routing.websocket_urlpatterns here
            # dashboard.routing.websocket_urlpatterns 
            # For now, leave it empty or comment out the import
        )
    ),
})