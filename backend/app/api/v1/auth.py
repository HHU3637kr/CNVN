from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_current_user
from app.schemas.user import (
    UserRegister,
    UserLogin,
    TokenResponse,
    TokenRefresh,
    SwitchRoleRequest,
    UserOut,
)
from app.schemas.teacher import TeacherProfileCreate

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(data: UserRegister):
    """用户注册（默认学生角色）"""
    raise HTTPException(status_code=501, detail="Not implemented")


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin):
    """统一登录，返回 JWT（含 roles + active_role）"""
    raise HTTPException(status_code=501, detail="Not implemented")


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(data: TokenRefresh):
    """刷新 Token"""
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("/me", response_model=UserOut)
async def get_me(current_user: dict = Depends(get_current_user)):
    """获取当前用户信息（根据 active_role 返回不同数据）"""
    raise HTTPException(status_code=501, detail="Not implemented")


@router.post("/switch-role", response_model=UserOut)
async def switch_role(
    data: SwitchRoleRequest,
    current_user: dict = Depends(get_current_user),
):
    """切换当前活跃角色（student↔teacher）"""
    raise HTTPException(status_code=501, detail="Not implemented")


@router.post("/become-teacher", response_model=UserOut)
async def become_teacher(
    data: TeacherProfileCreate,
    current_user: dict = Depends(get_current_user),
):
    """开通教师身份（提交教学档案初始信息）"""
    raise HTTPException(status_code=501, detail="Not implemented")
