"""The API and the frontend are separate origins, so CORS is always live.

Allow-all is the demo default. What must never come with it is
`Access-Control-Allow-Credentials`: the browsable API and the admin use session
cookies, and offering credentials to every origin would let any website read a
signed-in admin's responses. The frontend authenticates with a Bearer token, so
it does not need them.
"""

from django.test import override_settings
from rest_framework.test import APITestCase


class CorsTests(APITestCase):
    def test_open_cors_does_not_offer_credentials(self):
        response = self.client.get(
            "/api/pizzas/get/", HTTP_ORIGIN="https://evil.example"
        )

        self.assertEqual(response["Access-Control-Allow-Origin"], "*")
        self.assertNotIn("Access-Control-Allow-Credentials", response)

    @override_settings(
        CORS_ALLOW_ALL_ORIGINS=False,
        CORS_ALLOWED_ORIGINS=["http://localhost:8080"],
        CORS_ALLOW_CREDENTIALS=True,
    )
    def test_a_listed_origin_may_still_use_credentials(self):
        response = self.client.get(
            "/api/pizzas/get/", HTTP_ORIGIN="http://localhost:8080"
        )

        self.assertEqual(
            response["Access-Control-Allow-Origin"], "http://localhost:8080"
        )
        self.assertEqual(response["Access-Control-Allow-Credentials"], "true")

    @override_settings(
        CORS_ALLOW_ALL_ORIGINS=False,
        CORS_ALLOWED_ORIGINS=["http://localhost:8080"],
        CORS_ALLOW_CREDENTIALS=True,
    )
    def test_an_unlisted_origin_gets_no_cors_headers(self):
        response = self.client.get(
            "/api/pizzas/get/", HTTP_ORIGIN="https://evil.example"
        )

        self.assertNotIn("Access-Control-Allow-Origin", response)
