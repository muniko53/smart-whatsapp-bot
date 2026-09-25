"""Unified LLM provider. Extracted from ai_engine.py:22-46.

New code imports OpenRouterProvider; legacy ai_engine.call_ai keeps working.
"""
import json
import urllib.request
from abc import ABC, abstractmethod


class AIProvider(ABC):
    @abstractmethod
    def complete(self, messages: list[dict], max_tokens: int = 400) -> str | None:
        raise NotImplementedError


class OpenRouterProvider(AIProvider):
    def __init__(self, api_key: str = "", models: list[str] | None = None):
        from core.config import settings

        self.api_key = api_key or settings.OPENROUTER_API_KEY
        self.referer = settings.APP_URL
        self.models = models or [
            "meta-llama/llama-3.3-70b-instruct:free",
            "mistralai/mistral-7b-instruct:free",
            "google/gemma-3-12b-it:free",
            "google/gemma-3-4b-it:free",
        ]

    def complete(self, messages: list[dict], max_tokens: int = 400) -> str | None:
        for model in self.models:
            try:
                req = urllib.request.Request(
                    "https://openrouter.ai/api/v1/chat/completions",
                    data=json.dumps({
                        "model": model,
                        "messages": messages,
                        "max_tokens": max_tokens,
                        "temperature": 0.6,
                    }).encode(),
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": self.referer,
                        "X-Title": "Smart WhatsApp Sales Assistant",
                    },
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=25) as res:
                    data = json.loads(res.read())
                return data["choices"][0]["message"]["content"].strip()
            except Exception as e:
                print(f"[AI] model {model} failed: {e}", flush=True)
        return None


_default_provider: OpenRouterProvider | None = None


def get_default_provider() -> OpenRouterProvider:
    global _default_provider
    if _default_provider is None:
        _default_provider = OpenRouterProvider()
    return _default_provider


def call_ai(messages: list[dict], max_tokens: int = 400) -> str | None:
    """Drop-in replacement for ai_engine.call_ai."""
    return get_default_provider().complete(messages, max_tokens)
