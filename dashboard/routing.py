# dashboard/routing.py
from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    # This regex matches a WebSocket URL like ws://yourdomain/ws/dashboard/
    re_path(r'ws/dashboard/$', consumers.DashboardConsumer.as_asgi()),

    re_path(r'ws/client_activity/$', consumers.ClientActivityConsumer.as_asgi()),
]