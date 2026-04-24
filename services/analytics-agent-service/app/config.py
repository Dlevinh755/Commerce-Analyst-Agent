from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


def _find_env_file() -> Path | None:
    current = Path(__file__).resolve()
    for parent in current.parents:
        candidate = parent / ".env"
        if candidate.exists():
            return candidate
    return None


ENV_FILE = _find_env_file()


class Settings(BaseSettings):
    ANALYTICS_AGENT_ROOT_PATH: str = ""

    GOOGLE_API_KEY: str
    GOOGLE_LARGE_MODEL: str
    GOOGLE_SMALL_MODEL: str

    
    DATABRICKS_HOST: str
    DATABRICKS_HTTP_PATH: str
    DATABRICKS_TOKEN: str
    DATABRICKS_CATALOG_NAME: str
    DATABRICKS_SCHEMA_NAME: str

    APP_ENV: str = "dev"
    LOG_LEVEL: str = "INFO"

    model_config = SettingsConfigDict(env_file=ENV_FILE, extra="ignore")


settings = Settings()
