import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


class UserRegister(BaseModel):
    email: str = Field(..., max_length=255)
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., max_length=100)
    phone: str | None = Field(None, max_length=20)


class UserLogin(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    roles: list[str]
    active_role: str


class TokenRefresh(BaseModel):
    refresh_token: str


class SwitchRoleRequest(BaseModel):
    role: str = Field(..., pattern="^(student|teacher)$")


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    phone: str | None
    full_name: str
    avatar_url: str | None
    roles: list[str]
    active_role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    full_name: str | None = Field(None, max_length=100)
    phone: str | None = Field(None, max_length=20)
    avatar_url: str | None = None
