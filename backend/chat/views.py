from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser
from django.http import JsonResponse
from django.contrib.auth.models import User

import json

from .models import Chat, Room, CallSession, CallCandidate, FaceProfile
from .serializers import ChatSerializer
from .face_utils import (
    compute_embedding_from_base64,
    cosine_similarity,
    is_live_sequence,
)
from rest_framework_simplejwt.tokens import RefreshToken

# Create your views here.
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        return token

class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer


def get_active_call_session(room):
    return CallSession.objects.filter(room=room, active=True).order_by('-updated_at').first()


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def createRoom(request):
    if request.method == "POST":
        data = json.loads(request.body)
        try:
            Room.objects.get(name = data['name'], password = data['password'])
            return JsonResponse({"status": 404})
        except:
            Room.objects.create(name = data['name'], password = data['password'])
            return JsonResponse({"status": 200})

@api_view(['GET', 'POST', 'DELETE'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def room(request, name, password):
    room = Room.objects.get(name=name, password=password)

    if request.method == "GET":
        messages = room.room.order_by('id')
        serializer = ChatSerializer(messages, many=True, context={'request': request})
        return Response(serializer.data)

    if request.method == "DELETE":
        room.delete()
        return Response(status=204)

    if request.method == "POST":
        message = request.data.get('message', '')
        image = request.data.get('image')
        if image == "undefined":
            image = None

        Chat.objects.create(user=request.user, room=room, message=message, image=image)
        return JsonResponse({"status": "201"}, status=201)
    
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def deleteMessage(request, message_id):
    try:
        chat = Chat.objects.get(id=message_id)

        if chat.user != request.user and not request.user.is_staff:
            return JsonResponse({"status": "403", "message": "You don't have permission to delete this message."}, status=403)

        chat.delete()
        return JsonResponse({"status": "200", "message": "Message deleted successfully."}, status=200)

    except Chat.DoesNotExist:
        return JsonResponse({"status": "404", "message": "Message not found."}, status=404)


@api_view(['POST'])
def createUser(request):
    data = json.loads(request.body)
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return JsonResponse({"status": "400", "ok": False, "message": "Username and password are required."}, status=400)

    if User.objects.filter(username=username).exists():
        return JsonResponse({"status": "405", "ok": False}, status=400)

    User.objects.create_user(username=username, password=password)
    return JsonResponse({"status": "200", "ok": True}, status=201)


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token)
    }


@api_view(['POST'])
@permission_classes([AllowAny])
def face_enroll(request):
    data = json.loads(request.body)
    username = data.get('username')
    password = data.get('password')
    frames = data.get('frames', [])

    if not username or not password:
        return JsonResponse(
            {'status': 400, 'ok': False, 'message': 'Username and password are required.'},
            status=400
        )

    if len(frames) < 2:
        return JsonResponse(
            {'status': 400, 'ok': False, 'message': 'Please provide at least two face captures for liveness.'},
            status=400
        )

    user = User.objects.filter(username=username).first()
    if user is None:
        user = User.objects.create_user(username=username, password=password)
    elif not user.check_password(password):
        return JsonResponse(
            {'status': 401, 'ok': False, 'message': 'Incorrect password.'},
            status=401
        )

    if not is_live_sequence(frames):
        return JsonResponse(
            {'status': 400, 'ok': False, 'message': 'Liveness detection failed. Please try again with natural motion.'},
            status=400
        )

    embedding = compute_embedding_from_base64(frames[0])
    if embedding is None:
        return JsonResponse(
            {'status': 400, 'ok': False, 'message': 'Face not detected in the provided frames.'},
            status=400
        )

    profile, _ = FaceProfile.objects.get_or_create(user=user)
    profile.embedding = embedding
    profile.liveness_enabled = True
    profile.save()

    return JsonResponse(
        {'status': 200, 'ok': True, 'message': 'Face enrollment complete.'},
        status=201
    )


@api_view(['POST'])
@permission_classes([AllowAny])
def face_login(request):
    data = json.loads(request.body)
    username = data.get('username')
    frames = data.get('frames', [])

    if not username or len(frames) < 2:
        return JsonResponse(
            {'status': 400, 'ok': False, 'message': 'Username and face frames are required.'},
            status=400
        )

    user = User.objects.filter(username=username).first()
    if user is None:
        return JsonResponse(
            {'status': 404, 'ok': False, 'message': 'User not found.'},
            status=404
        )

    profile = getattr(user, 'face_profile', None)
    if profile is None or not profile.embedding:
        return JsonResponse(
            {'status': 404, 'ok': False, 'message': 'No face profile found for this user.'},
            status=404
        )

    if not is_live_sequence(frames):
        return JsonResponse(
            {'status': 400, 'ok': False, 'message': 'Liveness detection failed.'},
            status=400
        )

    embedding = compute_embedding_from_base64(frames[0])
    if embedding is None:
        return JsonResponse(
            {'status': 400, 'ok': False, 'message': 'Face not detected.'},
            status=400
        )

    similarity = cosine_similarity(profile.embedding, embedding)
    if similarity < 0.65:
        return JsonResponse(
            {'status': 401, 'ok': False, 'message': 'Face does not match.'},
            status=401
        )

    tokens = get_tokens_for_user(user)
    return JsonResponse({**tokens, 'ok': True}, status=200)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def call_offer(request, name, password):
    room = Room.objects.get(name=name, password=password)
    session = get_active_call_session(room)

    if request.method == 'GET':
        if not session or not session.offer:
            return JsonResponse({'offer': None}, status=404)
        return JsonResponse({'offer': session.offer, 'caller': session.caller})

    offer = request.data.get('offer')
    if not offer:
        return JsonResponse({'error': 'Offer payload is required.'}, status=400)

    if session:
        session.active = False
        session.save()

    CallSession.objects.create(room=room, caller=request.user.username, offer=offer)
    return JsonResponse({'status': 'offer_received'}, status=201)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def call_answer(request, name, password):
    room = Room.objects.get(name=name, password=password)
    session = get_active_call_session(room)

    if not session:
        return JsonResponse({'error': 'No active call session.'}, status=404)

    if request.method == 'GET':
        return JsonResponse({'answer': session.answer}, status=200 if session.answer else 404)

    answer = request.data.get('answer')
    if not answer:
        return JsonResponse({'error': 'Answer payload is required.'}, status=400)

    session.answer = answer
    session.save()
    return JsonResponse({'status': 'answer_received'}, status=201)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def call_candidate(request, name, password):
    room = Room.objects.get(name=name, password=password)
    session = get_active_call_session(room)
    if not session:
        return JsonResponse({'error': 'No active call session.'}, status=404)

    if request.method == 'GET':
        candidates = session.candidates.exclude(sender=request.user.username)
        data = [
            {'id': candidate.id, 'sender': candidate.sender, 'candidate': candidate.candidate}
            for candidate in candidates
        ]
        return JsonResponse({'candidates': data}, status=200)

    candidate_data = request.data.get('candidate')
    if not candidate_data:
        return JsonResponse({'error': 'Candidate payload is required.'}, status=400)

    CallCandidate.objects.create(session=session, sender=request.user.username, candidate=candidate_data)
    return JsonResponse({'status': 'candidate_received'}, status=201)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def hangup_call(request, name, password):
    room = Room.objects.get(name=name, password=password)
    session = get_active_call_session(room)
    if not session:
        return JsonResponse({'error': 'No active call session.'}, status=404)

    session.active = False
    session.save()
    return JsonResponse({'status': 'call_ended'}, status=200)