from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.payment import Wallet
from app.models.teacher_profile import TeacherProfile
from app.models.user import User
from app.schemas.teacher import TeacherProfileCreate
from app.schemas.user import (
    TokenRefresh,
    TokenResponse,
    UserOut,
    UserRegister,
)


async def register(db: AsyncSession, data: UserRegister) -> UserOut:
    """用户注册：检查邮箱唯一 → 哈希密码 → 创建 User + Wallet"""
    # 检查邮箱是否已存在
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalars().first():
        raise ValueError("该邮箱已被注册")

    # 创建用户
    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        phone=data.phone,
    )
    db.add(user)
    await db.flush()  # 获取 user.id

    # 注册时自动创建钱包
    wallet = Wallet(user_id=user.id, balance=0)
    db.add(wallet)
    await db.flush()

    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user)


async def login(db: AsyncSession, email: str, password: str) -> TokenResponse:
    """用户登录：查用户 → 验密码 → 签发 JWT"""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    if not user or not verify_password(password, user.hashed_password):
        raise ValueError("邮箱或密码错误")

    if not user.is_active:
        raise ValueError("账号已被禁用")

    access_token = create_access_token(user.id, user.roles, user.active_role)
    refresh_token = create_refresh_token(user.id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        roles=user.roles,
        active_role=user.active_role,
    )


async def refresh_access_token(
    db: AsyncSession, data: TokenRefresh
) -> TokenResponse:
    """刷新 Token：解码 refresh_token → 查用户 → 签新 token 对"""
    payload = decode_token(data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise ValueError("无效的 refresh token")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise ValueError("用户不存在")

    if not user.is_active:
        raise ValueError("账号已被禁用")

    access_token = create_access_token(user.id, user.roles, user.active_role)
    new_refresh_token = create_refresh_token(user.id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        roles=user.roles,
        active_role=user.active_role,
    )


async def get_me(db: AsyncSession, user_id: UUID) -> UserOut:
    """获取当前用户信息"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise ValueError("用户不存在")
    return UserOut.model_validate(user)


async def switch_role(db: AsyncSession, user_id: UUID, target_role: str) -> UserOut:
    """切换角色：校验目标角色在 roles 内 → 更新 active_role"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise ValueError("用户不存在")

    if target_role not in user.roles:
        raise ValueError(f"您尚未拥有 {target_role} 角色，请先开通")

    user.active_role = target_role
    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user)


async def become_teacher(
    db: AsyncSession, user_id: UUID, data: TeacherProfileCreate
) -> UserOut:
    """开通教师身份：创建 TeacherProfile + 追加 teacher 到 roles"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise ValueError("用户不存在")

    # 检查是否已经是教师
    if "teacher" in user.roles:
        raise ValueError("您已开通教师身份")

    # 创建教师档案
    profile = TeacherProfile(
        user_id=user.id,
        title=data.title,
        about=data.about,
        video_url=data.video_url,
        hourly_rate=data.hourly_rate,
        currency=data.currency,
        teacher_type=data.teacher_type,
        specialties=data.specialties,
    )
    db.add(profile)

    # 更新用户角色
    roles = list(user.roles)
    roles.append("teacher")
    user.roles = roles
    user.active_role = "teacher"

    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user)
