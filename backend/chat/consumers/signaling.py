import json
from channels.generic.websocket import AsyncWebsocketConsumer
from uuid import uuid4

class SignalingConsumer(AsyncWebsocketConsumer):
    # Store active connections: {room_name: {user_id: channel_name}}
    active_connections = {}

    async def connect(self):
        self.room_name = self.scope["url_route"]["kwargs"]["room_name"]
        self.room_group_name = f"signal_{self.room_name}"
        self.user_id = str(uuid4())  # Generate unique user ID per connection
        
        # Initialize room if not exists
        if self.room_name not in self.active_connections:
            self.active_connections[self.room_name] = {}
        
        # Register this connection
        self.active_connections[self.room_name][self.user_id] = self.channel_name

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()
        
        # Send user ID to client
        await self.send(text_data=json.dumps({
            "type": "connection",
            "userId": self.user_id
        }))
        
        # Notify other users in the room about new user
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "user_joined",
                "userId": self.user_id
            }
        )

    async def disconnect(self, close_code):
        # Remove from active connections
        if self.room_name in self.active_connections:
            if self.user_id in self.active_connections[self.room_name]:
                del self.active_connections[self.room_name][self.user_id]
            
            # Remove room if empty
            if not self.active_connections[self.room_name]:
                del self.active_connections[self.room_name]
        
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
        
        # Notify other users
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "user_left",
                "userId": self.user_id
            }
        )

    async def receive(self, text_data):
        data = json.loads(text_data)
        message_type = data.get("type")
        to_user = data.get("to")

        if message_type == "offer":
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "signal_message",
                    "message_type": "offer",
                    "offer": data.get("offer"),
                    "from": self.user_id,
                    "to": to_user
                }
            )
        elif message_type == "answer":
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "signal_message",
                    "message_type": "answer",
                    "answer": data.get("answer"),
                    "from": self.user_id,
                    "to": to_user
                }
            )
        elif message_type == "ice":
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "signal_message",
                    "message_type": "ice",
                    "candidate": data.get("candidate"),
                    "from": self.user_id,
                    "to": to_user
                }
            )
        elif message_type == "end-call":
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "signal_message",
                    "message_type": "end-call",
                    "from": self.user_id,
                    "to": to_user
                }
            )

    async def signal_message(self, event):
        """Receive signal message from group"""
        # Only send to intended recipient if specified
        if event.get("to") and event.get("to") != self.user_id:
            return
        
        message = {
            "type": event.get("message_type"),
            "from": event.get("from"),
        }

        if event.get("message_type") == "offer":
            message["offer"] = event.get("offer")
        elif event.get("message_type") == "answer":
            message["answer"] = event.get("answer")
        elif event.get("message_type") == "ice":
            message["candidate"] = event.get("candidate")

        await self.send(text_data=json.dumps(message))

    async def user_joined(self, event):
        """Handle user joined notification"""
        await self.send(text_data=json.dumps({
            "type": "user_joined",
            "userId": event["userId"]
        }))

    async def user_left(self, event):
        """Handle user left notification"""
        await self.send(text_data=json.dumps({
            "type": "user_left",
            "userId": event["userId"]
        }))
