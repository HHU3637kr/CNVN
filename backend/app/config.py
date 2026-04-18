from decimal import Decimal
from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    # Render 提供 postgresql://... 格式，需自动转为 asyncpg 驱动格式
    DATABASE_URL: str = "postgresql+asyncpg://cnvn:cnvn_secret@db:5432/cnvn"

    @property
    def async_database_url(self) -> str:
        url = self.DATABASE_URL
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    # JWT
    JWT_SECRET_KEY: str = "your-super-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ]

    # App
    APP_ENV: str = "development"
    APP_DEBUG: bool = True

    # Business（预约 / 分账展示）
    DEFAULT_TIMEZONE: str = "Asia/Ho_Chi_Minh"

    # 阶梯费率配置（plan.md §3.6 保留）
    COMMISSION_TIER_1_RATE: Decimal = Decimal("0.20")  # ≤20h
    COMMISSION_TIER_1_HOURS: int = 20
    COMMISSION_TIER_2_RATE: Decimal = Decimal("0.15")  # 21-50h
    COMMISSION_TIER_2_HOURS: int = 50
    COMMISSION_TIER_3_RATE: Decimal = Decimal("0.10")  # >50h

    # 争议期（plan.md §3.6 / FR-005）
    DISPUTE_WINDOW_HOURS: int = 24
    DISPUTE_WATCHER_INTERVAL_SECONDS: int = 60
    DISPUTE_WATCHER_BATCH_SIZE: int = 100

    # 税率（路线A简化；场景三后续替换为累进引擎）
    TAX_RATE_CN_RESIDENT: Decimal = Decimal("0.10")
    TAX_RATE_VN_PASSPORT_IN_CN: Decimal = Decimal("0.10")
    TAX_RATE_VN_RESIDENT: Decimal = Decimal("0.10")
    VAT_RATE: Decimal = Decimal("0.00")

    # 支付渠道
    DEFAULT_PAYMENT_CHANNEL: str = "mock"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }


settings = Settings()
