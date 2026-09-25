"""Single entry point. App (dashboard API + webhook) is built in app_factory.

Run: gunicorn main:app  |  python main.py (dev, port 5001)
"""
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from app_factory import create_app

app = create_app()

if __name__ == "__main__":
    from core.config import settings

    print(f"Starting combined server on port {settings.PORT}")
    app.run(host="0.0.0.0", port=settings.PORT, debug=True, use_reloader=False)
