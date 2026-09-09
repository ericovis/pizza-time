from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from delivery.auth import STAFF_REFUSED


class AuthTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("pizza", password="pizza")

    def test_api_requires_authentication(self):
        # The catalog is public; orders are not.
        response = self.client.get("/api/orders/get/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_obtain_token(self):
        response = self.client.post(
            "/api/auth/", {"username": "pizza", "password": "pizza"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_bad_credentials_rejected(self):
        response = self.client.post(
            "/api/auth/", {"username": "pizza", "password": "wrong"}
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def _access_token(self):
        return self.client.post(
            "/api/auth/", {"username": "pizza", "password": "pizza"}
        ).data["access"]

    def test_jwt_and_bearer_header_prefixes_both_work(self):
        token = self._access_token()
        for prefix in ("JWT", "Bearer"):
            with self.subTest(prefix=prefix):
                self.client.credentials(HTTP_AUTHORIZATION="%s %s" % (prefix, token))
                response = self.client.get("/api/orders/get/")
                self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_refresh_token(self):
        refresh = self.client.post(
            "/api/auth/", {"username": "pizza", "password": "pizza"}
        ).data["refresh"]
        response = self.client.post("/api/auth/refresh/", {"refresh": refresh})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)

    def test_staff_cannot_obtain_token(self):
        User.objects.create_user("pizza-admin", password="pizza-admin", is_staff=True)

        response = self.client.post(
            "/api/auth/", {"username": "pizza-admin", "password": "pizza-admin"}
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(str(response.data["detail"]), STAFF_REFUSED)
        self.assertNotIn("access", response.data)

    def test_token_response_includes_username(self):
        response = self.client.post(
            "/api/auth/", {"username": "pizza", "password": "pizza"}
        )
        self.assertEqual(response.data["username"], "pizza")
        self.assertFalse(response.data["is_staff"])
