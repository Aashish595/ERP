from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    AI_SERVICE_TOKEN: str
    OPENROUTER_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    AI_BASE_URL: str = "https://openrouter.ai/api/v1"
    AI_MODEL: str = "openai/gpt-4.1-mini"
    AI_TIMEOUT_SECONDS: float = 60
    CORS_ORIGINS: str = "http://localhost:8000"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def api_key(self) -> str:
        return self.OPENROUTER_API_KEY or self.OPENAI_API_KEY


@lru_cache
def get_settings() -> Settings:
    return Settings()
