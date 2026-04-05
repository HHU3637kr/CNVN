from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.teacher import TeacherProfileCreate
from app.schemas.user import (
    SwitchRoleRequest,
    TokenRefresh,
    TokenResponse,
    UserLogin,
    UserOut,
    UserRegister,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(data: UserRegister, db: AsyncSession = Depends(get_db)):
    """用户注册（默认学生角色）"""
    try:
        return await auth_service.register(db, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    """统一登录，返回 JWT（含 roles + active_role）"""
    try:
        return await auth_service.login(db, data.email, data.password)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(data: TokenRefresh, db: AsyncSession = Depends(get_db)):
    """刷新 Token"""
    try:
        return await auth_service.refresh_access_token(db, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    """获取当前用户信息"""
    return UserOut.model_validate(current_user)


@router.post("/switch-role", response_model=UserOut)
async def switch_role(
    data: SwitchRoleRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """切换当前活跃角色（student↔teacher）"""
    try:
        return await auth_service.switch_role(db, current_user.id, data.role)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/become-teacher", response_model=UserOut)
async def become_teacher(
    data: TeacherProfileCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """开通教师身份（提交教学档案初始信息）"""
    try:
        return await auth_service.become_teacher(db, current_user.id, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
