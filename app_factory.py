"""Single Flask factory. Reuses the dashboard app so all /api/* routes keep
working, then mounts the webhook blueprint and /healthz.

Used by main.py (gunicorn main:app) and api/index.py (Vercel).
"""
import os

ALLOWED_ORIGINS = {
    "http://localhost:3001",
    "http://localhost:3000",
    "https://smart-sales-assistant-gules.vercel.app",
    "https://smart-sales-assistant-lyart.vercel.app",
    "https://smart-assistant-blond.vercel.app",
}


def create_app():
    from flask import jsonify

    from core.config import settings

    try:
        os.makedirs(settings.UPLOAD_FOLDER, exist_ok=True)
    except Exception:
        pass

    # Reuse the dashboard Flask instance (all /api/* + CORS live there).
    from dashboard_api import app

    try:
        from core.db import init_db
        from core.config import settings as _settings
        init_db()
        print(f"Admin login: {_settings.ADMIN_EMAIL} / admin123", flush=True)
    except Exception as e:
        print(f"[STARTUP] init_db failed: {e}", flush=True)

    if "webhook" not in [bp.name for bp in app.blueprints.values()]:
        from services.whatsapp.routes import webhook_bp
        app.register_blueprint(webhook_bp)

    if "healthz" not in app.view_functions:
        @app.route("/healthz", methods=["GET"])
        def healthz():
            return jsonify({"status": "ok"})

    return app
