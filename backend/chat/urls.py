from django.urls import path

from .views import (
    MyTokenObtainPairView,
    createRoom,
    room,
    createUser,
    deleteMessage,
    call_offer,
    call_answer,
    call_candidate,
    hangup_call,
    face_enroll,
    face_login,
)

from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('room/', createRoom, name='createRoom'),
    path('room/<str:name>/<str:password>/', room, name='room'),
    path('message/delete/<int:message_id>/', deleteMessage, name='deleteMessage'),
    path('user/create', createUser, name='createUser'),
    path('room/<str:name>/<str:password>/call/offer/', call_offer, name='call_offer'),
    path('room/<str:name>/<str:password>/call/answer/', call_answer, name='call_answer'),
    path('room/<str:name>/<str:password>/call/candidate/', call_candidate, name='call_candidate'),
    path('room/<str:name>/<str:password>/call/hangup/', hangup_call, name='hangup_call'),
    path('face/enroll/', face_enroll, name='face_enroll'),
    path('face/login/', face_login, name='face_login'),
    path(
        'api/token/',
        MyTokenObtainPairView.as_view(),
        name='token_obtain_pair'
    ),
    path(
        'api/token/refresh/',
        TokenRefreshView.as_view(),
        name='token_refresh'
    ),
]