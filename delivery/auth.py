"""Token issuing for customers only.

Staff sign in at /admin/ with a session. Refusing them here rather than in
the frontend is the point: the API is the real surface, and a frontend-only
check would be decoration.
"""

from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

STAFF_REFUSED = "Staff accounts sign in at /admin/."


class CustomerTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Wired in through SIMPLE_JWT["TOKEN_OBTAIN_SERIALIZER"], so the URL conf
    keeps using the stock TokenObtainPairView."""

    def validate(self, attrs):
        # The parent authenticates and sets self.user; only then do we know
        # whether this is a staff account.
        data = super().validate(attrs)
        if self.user.is_staff:
            raise AuthenticationFailed(STAFF_REFUSED, code="staff_account")
        # Hand the username back so the frontend stores what the server
        # believes rather than what was typed. is_staff is always false on a
        # successful login; it is here for clarity and for the refresh path.
        data["username"] = self.user.username
        data["is_staff"] = self.user.is_staff
        return data
