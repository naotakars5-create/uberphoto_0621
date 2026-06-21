"""Payment handling via Stripe Checkout.

If STRIPE_SECRET_KEY is set, real Stripe Checkout Sessions are created.
Otherwise the app runs in stub mode (payment auto-succeeds) so it still works.
"""
import os
import uuid


def stripe_enabled() -> bool:
    return bool(os.environ.get("STRIPE_SECRET_KEY"))


def _client():
    import stripe
    stripe.api_key = os.environ["STRIPE_SECRET_KEY"]
    return stripe


def create_checkout(amount: int, plan_label: str, base_url: str, request_id: int):
    """Create a Checkout Session. Returns dict with mode/checkout_url/stripe_id."""
    if not stripe_enabled():
        return {"mode": "stub", "stripe_id": f"stub_{uuid.uuid4().hex[:12]}"}
    try:
        stripe = _client()
        session = stripe.checkout.Session.create(
            mode="payment",
            line_items=[
                {
                    "price_data": {
                        "currency": "jpy",
                        "product_data": {"name": f"UberPHOTO {plan_label}"},
                        "unit_amount": amount,
                    },
                    "quantity": 1,
                }
            ],
            success_url=f"{base_url}/customer?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{base_url}/customer?canceled=1",
            metadata={"request_id": str(request_id)},
        )
        return {"mode": "stripe", "checkout_url": session.url, "stripe_id": session.id}
    except Exception as e:
        # fall back to stub so the MVP keeps working if Stripe is misconfigured
        return {"mode": "stub", "stripe_id": f"stub_{uuid.uuid4().hex[:12]}", "error": str(e)}


def retrieve_session(session_id: str):
    return _client().checkout.Session.retrieve(session_id)
