from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import decode_token
from app.database import get_db
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def fetch_user_by_access_token(db: AsyncSession, token: str) -> User | None:
    """解码 access JWT 并查询 User；无效或禁用时返回 None。"""
    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        return None

    user_id = payload.get("sub")
    if user_id is None:
        return None

    result = await db.execute(
        select(User)
        .where(User.id == UUID(user_id))
        .options(selectinload(User.teacher_profile))
    )
    user = result.scalars().first()
    if not user:
        return None
    return user


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """解码 JWT 并从数据库查询 User ORM 对象"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无法验证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )

    user = await fetch_user_by_access_token(db, token)
    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="账号已被禁用",
        )

    return user


async def require_role(required_role: str):
    """角色校验依赖：检查用户是否拥有指定角色且为当前活跃角色"""
    async def role_checker(current_user: User = Depends(get_current_user)):
        if required_role not in current_user.roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"需要 {required_role} 角色权限",
            )
        if current_user.active_role != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"请先切换到 {required_role} 角色",
            )
        return current_user
    return role_checker


async def get_current_student(current_user: User = Depends(get_current_user)) -> User:
    """要求当前活跃角色为学生"""
    if current_user.active_role != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要学生角色权限，请切换到学生身份",
        )
    return current_user


async def get_current_teacher(current_user: User = Depends(get_current_user)) -> User:
    """要求当前活跃角色为教师"""
    if current_user.active_role != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要教师角色权限，请切换到教师身份",
        )
    return current_user
