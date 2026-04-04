from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, extra="ignore")

    database_host: str = "localhost"
    database_port: int = 5432
    database_name: str = "odoo_pos_cafe"
    database_user: str = "postgres"
    database_password: str = "postgres"
    secret_key: str = "change-me"
    access_token_expire_minutes: int = 720
    cors_origins: str = "http://localhost:5173"


settings = Settings()
