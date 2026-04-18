from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.teachers import router as teachers_router
from app.api.v1.lessons import router as lessons_router
from app.api.v1.reviews import router as reviews_router
from app.api.v1.availability import router as availability_router
from app.api.v1.payments import router as wallet_router
from app.api.v1.payments import payments_router
from app.api.v1.payouts import router as payouts_router
from app.api.v1.users import router as users_router

api_v1_router = APIRouter()

api_v1_router.include_router(auth_router)
api_v1_router.include_router(teachers_router)
api_v1_router.include_router(lessons_router)
api_v1_router.include_router(reviews_router)
api_v1_router.include_router(availability_router)
api_v1_router.include_router(wallet_router)
api_v1_router.include_router(payments_router)
api_v1_router.include_router(payouts_router)
api_v1_router.include_router(users_router)
