from rest_framework import permissions


class IsStaffOrReadOnly(permissions.BasePermission):
    """Anyone may read; only staff may write.

    Reading is open to anonymous callers on purpose: the menu and the builder
    are public pages and have to render before anyone signs in. Menu edits
    happen in the admin, so the write half only ever matters for the browsable
    API.
    """

    message = "Only staff can change the menu."

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_staff)
