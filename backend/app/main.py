from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.v1.router import api_v1_router
from app.services import dispute_watcher

app = FastAPI(
    title="CNVN 中越通 API",
    description="面向越南市场的中文学习双边撮合平台 — 后端 API",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_v1_router, prefix="/api/v1")


@app.on_event("startup")
async def _startup() -> None:
    # 争议期看门狗（plan.md §3.3.5）
    dispute_watcher.start_background_task()


@app.on_event("shutdown")
async def _shutdown() -> None:
    await dispute_watcher.stop_background_task()


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "cnvn-backend"}
