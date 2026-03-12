from app.core.config import settings
from app.llm.factory import LLMFactory


class LLMRouter:
    def get_model(self, provider: str):
        if provider == "auto":
            provider = settings.DEFAULT_LLM_PROVIDER
        return provider, LLMFactory.create(provider)

    def get_with_fallback(self, provider: str):
        if provider in ("gemini", "self_host"):
            return [(provider, LLMFactory.create(provider))]

        default_provider = settings.DEFAULT_LLM_PROVIDER
        fallback_provider = "self_host" if default_provider == "gemini" else "gemini"

        if settings.ENABLE_FALLBACK:
            return [
                (default_provider, LLMFactory.create(default_provider)),
                (fallback_provider, LLMFactory.create(fallback_provider)),
            ]

        return [(default_provider, LLMFactory.create(default_provider))]