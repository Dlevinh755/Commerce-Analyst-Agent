from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI

from app.core.config import settings


class LLMFactory:
    @staticmethod
    def create(provider: str):
        if provider == "gemini":
            return ChatGoogleGenerativeAI(
                model=settings.GEMINI_MODEL,
                google_api_key=settings.GEMINI_API_KEY,
                temperature=0.1,
            )

        if provider == "self_host":
            return ChatOpenAI(
                model=settings.SELF_HOST_MODEL,
                api_key=settings.SELF_HOST_API_KEY or "dummy",
                base_url=settings.SELF_HOST_BASE_URL,
                temperature=0.1,
            )

        raise ValueError(f"Unsupported provider: {provider}")