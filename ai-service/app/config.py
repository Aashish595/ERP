from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    AI_SERVICE_TOKEN: str
    OPENROUTER_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    AI_BASE_URL: str = ""
    AI_MODEL: str = "openai/gpt-4.1-mini"
    AI_TIMEOUT_SECONDS: float = 60
    CORS_ORIGINS: str = "http://localhost:8000"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def api_key(self) -> str:
        return self.OPENROUTER_API_KEY or self.OPENAI_API_KEY

    @property
    def provider_base_url(self) -> str:
        if self.AI_BASE_URL.strip():
            return self.AI_BASE_URL.strip()
        if self.OPENROUTER_API_KEY:
            return "https://openrouter.ai/api/v1"
        return "https://api.openai.com/v1"

    @property
    def provider_model(self) -> str:
        if not self.OPENROUTER_API_KEY and self.OPENAI_API_KEY and self.AI_MODEL.startswith("openai/"):
            return self.AI_MODEL.removeprefix("openai/")
        return self.AI_MODEL


@lru_cache
def get_settings() -> Settings:
    return Settings()
