from django.urls import path

from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

from .views import MyTokenObtainPairView, createRoom, room, createUser, deleteMessage


urlpatterns = [
    path('api/token/', MyTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('room/', createRoom, name="createRoom"),
    path('room/<str:name>/<str:password>/', room, name="room"),
    path('user/create', createUser, name="createUser"),
    path('message/delete/<int:message_id>/',deleteMessage, name='deleteMessage'),
]
