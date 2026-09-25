"""Centralized env-only config. Single source of truth going forward.

Replaces scattered os.environ.get() calls and the unused config.py template.
Old modules keep working — new code should import from here.
"""
import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


def _get(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


class Settings:
    # Database — Neon Postgres (same default as legacy db.py)
    DATABASE_URL: str = _get("DATABASE_URL", "postgresql://postgres:postgres@localhost/wa_bot")

    # WhatsApp Cloud API (global fallback; per-business creds live in businesses table)
    WHATSAPP_TOKEN: str = _get("WHATSAPP_TOKEN", "")
    PHONE_NUMBER_ID: str = _get("PHONE_NUMBER_ID", _get("WHATSAPP_PHONE_ID", ""))
    VERIFY_TOKEN: str = _get("VERIFY_TOKEN", "linklet_verify_2026")

    # AI providers (no default keys — set OPENROUTER_API_KEY in env)
    OPENROUTER_API_KEY: str = _get("OPENROUTER_API_KEY", "")
    GROQ_API_KEY: str = _get("GROQ_API_KEY", "")

    # Dashboard auth
    JWT_SECRET: str = _get("JWT_SECRET", "wa-bot-dashboard-secret-2026-standalone")

    # Standalone product identity (no vendor coupling)
    APP_URL: str = _get("APP_URL", "https://smart-assistant-blond.vercel.app")
    ADMIN_EMAIL: str = _get("ADMIN_EMAIL", "admin@example.com")
    # Public support contact shown by the bot and dashboard banners.
    # Empty = contact line omitted (never invent one).
    SUPPORT_WHATSAPP: str = _get("SUPPORT_WHATSAPP", "")

    # Server
    PORT: int = int(_get("PORT", "5001") or "5001")
    UPLOAD_FOLDER: str = _get("UPLOAD_FOLDER", "/tmp/uploads")


settings = Settings()
