import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack

# Set the Django settings module before any Django imports
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chat_api.settings')

# Initialize Django
django_asgi_app = get_asgi_application()

# Now import routing AFTER Django is ready
import chat.routing

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AuthMiddlewareStack(
        URLRouter(
            chat.routing.websocket_urlpatterns
        )
    ),
})
