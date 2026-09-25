"""Auth + JWT. Extracted from dashboard_api.py:61-112,115-190,541-579.

Uses core.config.JWT_SECRET and core.db (%s). Responses unchanged.
"""
from datetime import datetime, timedelta, timezone
from functools import wraps

import bcrypt
import jwt as pyjwt
from flask import jsonify, request

from core.config import settings
from core.db import fetch_one, execute as db_execute, session

ACCESS_EXP = 15
REFRESH_EXP = 7 * 24 * 60


def _encode(payload: dict) -> str:
    token = pyjwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")
    return token.decode("utf-8") if isinstance(token, bytes) else token


def make_access_token(user_id, role: str) -> str:
    return _encode({"sub": str(user_id), "role": role,
                    "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_EXP)})


def make_refresh_token(user_id, role: str) -> str:
    return _encode({"sub": str(user_id), "role": role, "refresh": True,
                    "exp": datetime.now(timezone.utc) + timedelta(minutes=REFRESH_EXP)})


def decode_token(token: str) -> dict:
    if isinstance(token, bytes):
        token = token.decode("utf-8")
    return pyjwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])


def require_auth(role: str | None = None):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            auth = request.headers.get("Authorization", "")
            if not auth.startswith("Bearer "):
                return jsonify({"error": "Unauthorized"}), 401
            try:
                payload = decode_token(auth.split(" ")[1])
            except pyjwt.ExpiredSignatureError:
                return jsonify({"error": "Token expired"}), 401
            except Exception:
                return jsonify({"error": "Invalid token"}), 401
            if role and payload.get("role") != role:
                return jsonify({"error": "Forbidden"}), 403
            request.user_id = payload["sub"]
            request.user_role = payload["role"]
            return f(*args, **kwargs)
        return wrapper
    return decorator


def authenticate(email: str, password: str) -> dict | None:
    user = fetch_one("SELECT * FROM users WHERE email=%s", (email.strip().lower(),))
    if not user:
        return None
    try:
        ok = bcrypt.checkpw(password.encode(), user["password_hash"].encode())
    except Exception:
        ok = False
    return user if ok else None


def register_business_account(email: str, password: str, name: str) -> None:
    email = email.strip().lower()
    if fetch_one("SELECT id FROM users WHERE email=%s", (email,)):
        raise ValueError("exists")
    pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    with session() as conn:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO users (email, password_hash, role) VALUES (%s,%s,'business') "
                        "RETURNING id", (email, pw_hash))
            user_id = cur.fetchone()["id"]
            cur.execute("INSERT INTO businesses (user_id, name) VALUES (%s,%s)", (user_id, name))


def update_credentials(user_id: int, current_pw: str, new_email: str = "",
                       new_pw: str = "") -> None:
    user = fetch_one("SELECT * FROM users WHERE id=%s", (user_id,))
    if not user:
        raise LookupError("not found")
    if not bcrypt.checkpw(current_pw.encode(), user["password_hash"].encode()):
        raise PermissionError("bad password")
    if new_email and new_email != user["email"]:
        if fetch_one("SELECT id FROM users WHERE email=%s AND id!=%s", (new_email, user["id"])):
            raise ValueError("email in use")
        db_execute("UPDATE users SET email=%s WHERE id=%s", (new_email, user["id"]))
    if new_pw:
        if len(new_pw) < 6:
            raise ValueError("password too short")
        db_execute("UPDATE users SET password_hash=%s WHERE id=%s",
                   (bcrypt.hashpw(new_pw.encode(), bcrypt.gensalt()).decode(), user["id"]))
