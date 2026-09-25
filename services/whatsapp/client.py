"""WhatsApp Cloud API transport (Graph v19.0).

Consolidates notifications.py sends + transcription.py media download.
No business copy here — message text lives in domain services.
No Flask imports — usable from webhook, services, and dashboard API.
"""
import json
import urllib.request

GRAPH_VERSION = "v19.0"


def _post(phone_id: str, payload: dict, token: str, timeout: int = 15):
    url = f"https://graph.facebook.com/{GRAPH_VERSION}/{phone_id}/messages"
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return json.loads(res.read())
    except Exception as e:
        print(f"[WA] send failed: {e}", flush=True)
        return None


def send_text(to: str, body: str, token: str, phone_id: str):
    """Send a plain-text message. Returns Meta response dict or None."""
    if not token or not phone_id:
        print("[WA] missing credentials — skipping send_text", flush=True)
        return None
    return _post(
        phone_id,
        {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "text",
            "text": {"body": body},
        },
        token,
    )


def send_image(to: str, image_url: str, caption: str, token: str, phone_id: str):
    """Send an image by URL with optional caption."""
    if not token or not phone_id:
        print("[WA] missing credentials — skipping send_image", flush=True)
        return None
    return _post(
        phone_id,
        {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "image",
            "image": {"link": image_url, "caption": caption or ""},
        },
        token,
    )


def send_interactive(to: str, body: str, buttons: list[dict], token: str, phone_id: str,
                     image_url: str = ""):
    """Send button message; falls back to text on failure.

    buttons: [{"id": "check_status", "title": "Check Status"}]
    Moved from notifications.py:send_order_status_to_customer interactive block.
    """
    if not token or not phone_id:
        print("[WA] missing credentials — skipping send_interactive", flush=True)
        return None
    action = {
        "buttons": [
            {"type": "reply", "reply": {"id": b["id"], "title": b["title"][:20]}}
            for b in buttons[:3]
        ]
    }
    if image_url:
        interactive = {
            "type": "button",
            "header": {"type": "image", "image": {"link": image_url}},
            "body": {"text": body},
            "action": action,
        }
    else:
        interactive = {"type": "button", "body": {"text": body}, "action": action}
    result = _post(
        phone_id,
        {"messaging_product": "whatsapp", "to": to, "type": "interactive",
         "interactive": interactive},
        token,
    )
    if result is None:
        print("[WA] interactive failed, falling back to text", flush=True)
        return send_text(to, body, token, phone_id)
    return result


def download_media(media_id: str, token: str) -> tuple[bytes, str]:
    """Fetch media bytes + mime type. Raises on failure (caller decides fallback).

    Moved from transcription.py:download_whatsapp_media.
    """
    meta_url = f"https://graph.facebook.com/{GRAPH_VERSION}/{media_id}"
    req = urllib.request.Request(meta_url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=10) as res:
        info = json.loads(res.read())
    media_url = info["url"]
    mime_type = info.get("mime_type", "audio/ogg")
    req2 = urllib.request.Request(media_url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req2, timeout=20) as res:
        return res.read(), mime_type


def transcribe_voice_note(media_id: str, token: str) -> str | None:
    """Download + transcribe via Groq Whisper. Returns text or None.

    Moved from transcription.py:transcribe_voice_note. Needs GROQ_API_KEY.
    """
    from core.config import settings

    if not settings.GROQ_API_KEY:
        print("[WA] No GROQ_API_KEY — skipping transcription", flush=True)
        return None
    try:
        import requests

        audio_bytes, mime_type = download_media(media_id, token)
        ext = "ogg"
        if "mp4" in mime_type:
            ext = "mp4"
        elif "mpeg" in mime_type:
            ext = "mp3"
        elif "webm" in mime_type:
            ext = "webm"
        elif "wav" in mime_type:
            ext = "wav"
        resp = requests.post(
            "https://api.groq.com/openai/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
            files={"file": (f"voice.{ext}", audio_bytes, mime_type)},
            data={"model": "whisper-large-v3-turbo",
                  "response_format": "text", "language": "en"},
            timeout=30,
        )
        if resp.status_code == 200:
            text = resp.text.strip()
            print(f'[WA] voice -> "{text[:120]}"', flush=True)
            return text or None
        print(f"[WA] Groq error {resp.status_code}: {resp.text[:200]}", flush=True)
        return None
    except Exception as e:
        print(f"[WA] transcribe failed: {e}", flush=True)
        return None


class WhatsappClient:
    """Bound client for one business number (convenience wrapper)."""

    def __init__(self, token: str, phone_id: str):
        self.token = token
        self.phone_id = phone_id

    def send_text(self, to: str, body: str):
        return send_text(to, body, self.token, self.phone_id)

    def send_image(self, to: str, image_url: str, caption: str = ""):
        return send_image(to, image_url, caption, self.token, self.phone_id)

    def send_interactive(self, to: str, body: str, buttons: list[dict], image_url: str = ""):
        return send_interactive(to, body, buttons, self.token, self.phone_id, image_url)
