from django.contrib import admin

from delivery.models import Order, OrderItem, Pizza


@admin.register(Pizza)
class PizzaAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "price", "is_active")
    list_editable = ("price", "is_active")
    prepopulated_fields = {"slug": ("name",)}
    search_fields = ("name", "slug")


class OrderItemInline(admin.TabularInline):
    """What was ordered. Snapshots, so nothing here is editable."""

    model = OrderItem
    extra = 0
    can_delete = False
    fields = ("name", "slices", "quantity", "unit_price")
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    # `status` is editable from the list so a demo can walk an order through
    # the pipeline while the tracking screen polls it.
    list_display = ("id", "user", "status", "total", "created_at")
    list_editable = ("status",)
    list_filter = ("status",)
    date_hierarchy = "created_at"
    inlines = (OrderItemInline,)
    readonly_fields = ("created_at", "total")
