from unittest.util import _MAX_LENGTH
from django.db import models
from django_resized import ResizedImageField
from django.contrib.auth.models import User


class Room(models.Model):
    name = models.CharField(max_length=255, blank=False)
    password = models.CharField(max_length=255, blank=False)
    def __str__(self):
        return str(self.name)

class Chat(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, blank=False, related_name="room")
    user = models.ForeignKey(User, on_delete=models.CASCADE, blank=False, related_name="chatUser")
    message = models.TextField(blank=True)
    image = ResizedImageField(force_format='WEBP', size=None,scale=0.5, quality=75, upload_to='images', blank=True, null=True)

class FaceProfile(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='face_profile'
    )
    embedding = models.JSONField(blank=True, null=True)
    liveness_enabled = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'FaceProfile(user={self.user.username})'

class CallSession(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='call_sessions')
    caller = models.CharField(max_length=150)
    offer = models.JSONField()
    answer = models.JSONField(blank=True, null=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"CallSession(room={self.room.name}, caller={self.caller})"

class CallCandidate(models.Model):
    session = models.ForeignKey(CallSession, on_delete=models.CASCADE, related_name='candidates')
    sender = models.CharField(max_length=150)
    candidate = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Candidate(sender={self.sender}, session={self.session.id})"

   