from urllib.parse import parse_qs
from channels.auth import AuthMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from django.db import close_old_connections

class JWTAuthMiddleware(AuthMiddleware):
    async def resolve_scope(self, scope):
        query_string = scope["query_string"].decode()
        params = parse_qs(query_string)

        token = None

        if "token" in params:
            token = params["token"][0]

        if "access_token" in scope.get("subprotocols", []):
            idx = scope["subprotocols"].index("access_token")
            token = scope["subprotocols"][idx+1]

        if token:
            try:
                access_token = AccessToken(token)
                scope["user"] = access_token.user
                close_old_connections()
            except Exception as e:
                scope["user"] = AnonymousUser()
        else:
            scope["user"] = AnonymousUser()

        return scope
def JWTAuthMiddlewareStack(inner):
    return JWTAuthMiddleware(inner)