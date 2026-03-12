from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "analyst-service"
    APP_ENV: str = "dev"
    APP_PORT: int = 8080

    DATABASE_URL: str

    DEFAULT_LLM_PROVIDER: str = "gemini"  # gemini | self_host
    ENABLE_FALLBACK: bool = True

    GEMINI_API_KEY: str | None = None
    GEMINI_MODEL: str = "gemini-2.5-flash"

    SELF_HOST_API_KEY: str | None = None
    SELF_HOST_BASE_URL: str | None = None
    SELF_HOST_MODEL: str = "qwen2.5-coder-32b-instruct"

    SQL_MAX_LIMIT: int = 200
    SQL_TIMEOUT_SECONDS: int = 15

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


settings = Settings()