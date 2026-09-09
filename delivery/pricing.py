"""The two rules that turn a set of slices into a priced, named pie.

They live here rather than in the serializer because `seed_demo` needs the
same answers when it writes the demo order history: a pie always costs its
most expensive flavor, and it is called after that flavor unless it mixes
several.
"""


def unit_price(flavors):
    """A pie costs as much as its priciest flavor.

    `flavors` is an iterable of Pizza objects; duplicates are harmless.
    """
    return max(pizza.price for pizza in flavors)


def item_name(flavors):
    """"Broccoli" for a single flavor, "Your 4-flavor pizza" for a mix."""
    distinct = {pizza.pk for pizza in flavors}
    if len(distinct) == 1:
        return next(iter(flavors)).name
    return "Your %s-flavor pizza" % len(distinct)
