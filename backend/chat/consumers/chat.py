from channels.generic.websocket import AsyncWebsocketConsumer
from channels.layers import get_channel_layer
import json

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_group_name = "chat_room"
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        data = json.loads(text_data)
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "chat.message",
                "message": data["message"]
            }
        )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            "message": event["message"]
        }))
