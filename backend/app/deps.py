from fastapi import Header


def user_id(x_user_id: str = Header(default="demo")) -> str:
    """Hackathon-simple identity: the frontend sends X-User-Id. Swap for JWT/Supabase auth later."""
    return x_user_id or "demo"
