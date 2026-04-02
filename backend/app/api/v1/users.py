from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_current_user
from app.schemas.user import UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserOut)
async def get_my_profile(current_user: dict = Depends(get_current_user)):
    """获取个人资料"""
    raise HTTPException(status_code=501, detail="Not implemented")


@router.put("/me", response_model=UserOut)
async def update_my_profile(
    data: UserUpdate,
    current_user: dict = Depends(get_current_user),
):
    """更新个人资料"""
    raise HTTPException(status_code=501, detail="Not implemented")
