from django.urls import re_path
from .consumers.chat import ChatConsumer
from .consumers.signaling import SignalingConsumer

websocket_urlpatterns = [
    re_path(r"ws/chat/(?P<room_name>\w+)/$", ChatConsumer.as_asgi()),
    re_path(r"ws/signal/(?P<room_name>\w+)/$", SignalingConsumer.as_asgi()),
]