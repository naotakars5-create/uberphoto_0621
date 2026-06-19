"""Payment handling. Uses Stripe if STRIPE_SECRET_KEY is set, otherwise a stub."""
import os
import uuid

STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY")


def create_payment(amount: int, plan: str, success_url: str, cancel_url: str):
    """Return dict: {mode, checkout_url|None, stripe_id, status}.

    In stub mode (no Stripe key) the payment is considered immediately paid and
    the client proceeds straight to the request flow.
    """
    if not STRIPE_SECRET_KEY:
        return {
            "mode": "stub",
            "checkout_url": None,
            "stripe_id": f"stub_{uuid.uuid4().hex[:12]}",
            "status": "paid",
        }

    try:
        import stripe

        stripe.api_key = STRIPE_SECRET_KEY
        session = stripe.checkout.Session.create(
            mode="payment",
            line_items=[
                {
                    "price_data": {
                        "currency": "jpy",
                        "product_data": {"name": f"UberPHOTO {plan}"},
                        "unit_amount": amount,
                    },
                    "quantity": 1,
                }
            ],
            success_url=success_url,
            cancel_url=cancel_url,
        )
        return {
            "mode": "stripe",
            "checkout_url": session.url,
            "stripe_id": session.id,
            "status": "pending",
        }
    except Exception as e:
        # Fall back to stub so the MVP keeps working if Stripe misconfigured.
        return {
            "mode": "stub",
            "checkout_url": None,
            "stripe_id": f"stub_{uuid.uuid4().hex[:12]}",
            "status": "paid",
            "error": str(e),
        }
