from rest_framework import serializers
from django.contrib.auth.models import User

from .models import (
    Chat,
    Room,
    CallSession,
    CallCandidate
)


class RoomSerializer(serializers.ModelSerializer):

    class Meta:
        model = Room
        fields = '__all__'


class ChatSerializer(serializers.ModelSerializer):
    user = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = Chat
        fields = '__all__'


class UserSerializer(serializers.ModelSerializer):

    class Meta:
        model = User
        fields = ['id', 'username']


class CallSessionSerializer(serializers.ModelSerializer):

    class Meta:
        model = CallSession
        fields = '__all__'


class CallCandidateSerializer(serializers.ModelSerializer):

    class Meta:
        model = CallCandidate
        fields = '__all__'