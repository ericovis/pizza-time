"""Create the demo catalog, users and order history.

Idempotent and keyed on pizza slug and username, so it is safe to run on
every boot (docker-compose runs it right after `migrate`). It never rewrites
rows that already exist, which means staff edits made in the admin survive a
restart.
"""

from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from delivery.models import Order, OrderItem, Pizza
from delivery.pricing import item_name, unit_price

# Copied from the design prototype's PIZZAS list. Order matters: it is the
# order the menu grid shows, and the ids it produces on a fresh database.
PIZZAS = [
    {
        "slug": "cheese",
        "name": "Cheese",
        "price": "11.23",
        "toppings": "three cheeses · oregano",
        "description": "Three cheeses, one very good decision.",
    },
    {
        "slug": "mexican",
        "name": "Mexican",
        "price": "13.23",
        "toppings": "jalapeño · corn · beef · red pepper",
        "description": "Jalapeño, corn, beef and a little bit of trouble.",
    },
    {
        "slug": "marinara",
        "name": "Marinara",
        "price": "11.00",
        "toppings": "tomato · garlic · basil — no cheese",
        "description": "No cheese. Just tomato, garlic and basil doing their thing.",
    },
    {
        "slug": "prosciutto",
        "name": "Prosciutto",
        "price": "13.23",
        "toppings": "prosciutto · arugula · parmesan",
        "description": "Silky prosciutto, arugula and a snowfall of parmesan.",
    },
    {
        "slug": "funghi",
        "name": "Funghi",
        "price": "11.23",
        "toppings": "roasted mushrooms · thyme",
        "description": "Roasted mushrooms, thyme, and a lot of umami.",
    },
    {
        "slug": "napoletana",
        "name": "Napoletana",
        "price": "13.23",
        "toppings": "anchovies · capers · olives",
        "description": "Anchovies, capers and olives. Bold, briny, brilliant.",
    },
    {
        "slug": "broccoli",
        "name": "Broccoli",
        "price": "11.00",
        "toppings": "charred broccoli · garlic",
        "description": "Charred broccoli and garlic. Your mom would be proud.",
    },
    {
        "slug": "portuguesa",
        "name": "Portuguesa",
        "price": "13.23",
        "toppings": "egg · ham · onion · olives · peas",
        "description": "Egg, ham, onion, olives and peas. The Brazilian classic.",
    },
    {
        "slug": "capricciosa",
        "name": "Capricciosa",
        "price": "11.00",
        "toppings": "artichoke · ham · mushrooms · olives",
        "description": "Artichokes, ham, mushrooms and olives, finally in agreement.",
    },
    {
        "slug": "vegetarian",
        "name": "Vegetarian",
        "price": "13.23",
        "toppings": "peppers · zucchini · onion · tomato · olives",
        "description": "Peppers, zucchini, onion, tomato and olives, all at once.",
    },
    {
        "slug": "pepperoni",
        "name": "Pepperoni",
        "price": "12.23",
        "toppings": "crisp pepperoni cups · oregano",
        "description": "Crisp-edged pepperoni cups and a lot of oregano.",
    },
]


def whole(slug):
    """Eight slices of one flavor."""
    return [slug] * 8


def halves(first, second):
    return [first] * 4 + [second] * 4


def quarters(a, b, c, d):
    return [a] * 2 + [b] * 2 + [c] * 2 + [d] * 2


class Command(BaseCommand):
    help = "Create or top up the demo catalog, users and order history."

    def handle(self, *args, **options):
        self.created = {"pizzas": 0, "users": 0, "orders": 0}
        self.skipped = {"pizzas": 0, "users": 0, "orders": 0}

        with transaction.atomic():
            pizzas = self.seed_pizzas()
            users = self.seed_users()
            self.seed_orders(pizzas, users)

        self.stdout.write(
            self.style.SUCCESS(
                "seed_demo: created %(pc)s pizzas, %(uc)s users, %(oc)s orders; "
                "skipped %(ps)s pizzas, %(us)s users, %(os)s users' order history."
                % {
                    "pc": self.created["pizzas"],
                    "uc": self.created["users"],
                    "oc": self.created["orders"],
                    "ps": self.skipped["pizzas"],
                    "us": self.skipped["users"],
                    "os": self.skipped["orders"],
                }
            )
        )

    # -- catalog ------------------------------------------------------------

    def seed_pizzas(self):
        by_slug = {}
        for spec in PIZZAS:
            pizza, created = Pizza.objects.get_or_create(
                slug=spec["slug"],
                defaults={
                    "name": spec["name"],
                    "price": Decimal(spec["price"]),
                    "toppings": spec["toppings"],
                    "description": spec["description"],
                },
            )
            if created:
                self.created["pizzas"] += 1
            else:
                self.skipped["pizzas"] += 1
                # Databases migrated from the old fixture have the pizza but
                # not its copy: fill in only what is still empty.
                missing = {}
                if not pizza.toppings:
                    missing["toppings"] = spec["toppings"]
                if not pizza.description:
                    missing["description"] = spec["description"]
                if missing:
                    for field, value in missing.items():
                        setattr(pizza, field, value)
                    pizza.save(update_fields=list(missing))
            by_slug[spec["slug"]] = pizza
        return by_slug

    # -- users --------------------------------------------------------------

    def seed_users(self):
        users = {}
        customers = [
            (settings.DEMO_USERNAME, "Jane", "Klimber"),
            ("kimberly", "Kimberly", "Oaks"),
            ("carlos", "Carlos", "Reis"),
        ]
        for username, first_name, last_name in customers:
            users[username] = self.get_or_create_user(
                username,
                settings.DEMO_PASSWORD,
                first_name=first_name,
                last_name=last_name,
            )
        users["admin"] = self.get_or_create_user(
            settings.ADMIN_USERNAME,
            settings.ADMIN_PASSWORD,
            is_staff=True,
            is_superuser=True,
        )
        # An old volume can already hold an account under ADMIN_USERNAME that is
        # not staff (the retired fixture called its superuser "root"). Leaving it
        # alone would give the demo an "admin" who cannot open /admin/ and who
        # *can* obtain a token, which is exactly what the staff rule forbids.
        self.ensure_staff(users["admin"])
        return users

    def get_or_create_user(self, username, password, **defaults):
        user, created = User.objects.get_or_create(username=username, defaults=defaults)
        if created:
            user.set_password(password)
            user.save(update_fields=["password"])
            self.created["users"] += 1
        else:
            self.skipped["users"] += 1
        return user

    def ensure_staff(self, user):
        missing = [
            field
            for field in ("is_staff", "is_superuser")
            if not getattr(user, field)
        ]
        if not missing:
            return
        for field in missing:
            setattr(user, field, True)
        user.save(update_fields=missing)
        self.stdout.write(
            self.style.WARNING(
                "seed_demo: promoted the existing %s account to staff." % user.username
            )
        )

    # -- order history ------------------------------------------------------

    def seed_orders(self, pizzas, users):
        """Give each demo customer a history, unless they already have one."""
        now = timezone.now()
        demo = users[settings.DEMO_USERNAME]

        history = [
            (
                demo,
                [
                    (
                        now - timedelta(days=9),
                        Order.Status.DELIVERED,
                        [(whole("capricciosa"), 1), (whole("vegetarian"), 1)],
                    ),
                    (
                        now - timedelta(days=4),
                        Order.Status.DELIVERED,
                        [(halves("pepperoni", "funghi"), 1), (whole("cheese"), 2)],
                    ),
                    (
                        now - timedelta(days=1, hours=2),
                        Order.Status.DELIVERED,
                        [(whole("broccoli"), 1)],
                    ),
                    (
                        now - timedelta(hours=3),
                        Order.Status.OUT_FOR_DELIVERY,
                        [
                            (
                                quarters(
                                    "pepperoni", "prosciutto", "broccoli", "mexican"
                                ),
                                1,
                            )
                        ],
                    ),
                ],
            ),
            (
                users["kimberly"],
                [
                    (
                        now - timedelta(days=1, hours=5),
                        Order.Status.DELIVERED,
                        [(whole("broccoli"), 2)],
                    )
                ],
            ),
            (
                users["carlos"],
                [
                    (
                        now - timedelta(minutes=40),
                        Order.Status.ORDERED,
                        [(whole("portuguesa"), 1)],
                    )
                ],
            ),
        ]

        for user, orders in history:
            if Order.objects.filter(user=user).exists():
                self.skipped["orders"] += 1
                continue
            for created_at, status, items in orders:
                self.create_order(pizzas, user, created_at, status, items)

    def create_order(self, pizzas, user, created_at, status, items):
        order = Order.objects.create(user=user, status=status)
        for slugs, quantity in items:
            flavors = [pizzas[slug] for slug in slugs]
            OrderItem.objects.create(
                order=order,
                slices=[pizza.pk for pizza in flavors],
                quantity=quantity,
                unit_price=unit_price(flavors),
                name=item_name(flavors),
            )
        order.recompute_total()
        # created_at is auto_now_add, so it can only be set after the fact.
        Order.objects.filter(pk=order.pk).update(created_at=created_at)
        self.created["orders"] += 1
        return order

