"""认证模块 API 测试"""

import uuid

import pytest

TEACHER_PROFILE_DATA = {
    "title": "专业中文教师",
    "about": "5年中文教学经验",
    "hourly_rate": 50000,
    "currency": "VND",
    "teacher_type": "professional",
    "specialties": ["口语", "HSK备考"],
}


def make_register_data(email: str = None):
    """生成唯一邮箱和手机号的注册数据"""
    suffix = uuid.uuid4().hex[:8]
    if email is None:
        email = f"test_{suffix}@example.com"
    return {
        "email": email,
        "password": "testpassword123",
        "full_name": "测试用户",
        "phone": f"090{suffix}",
    }


@pytest.mark.asyncio
async def test_register_success(client):
    """注册成功"""
    data = make_register_data()
    resp = await client.post("/api/v1/auth/register", json=data)
    assert resp.status_code == 201
    result = resp.json()
    assert result["email"] == data["email"]
    assert result["full_name"] == data["full_name"]
    assert result["roles"] == ["student"]
    assert result["active_role"] == "student"
    assert result["is_active"] is True
    assert "id" in result


@pytest.mark.asyncio
async def test_register_duplicate_email(client):
    """重复邮箱注册失败"""
    email = f"dup_{uuid.uuid4().hex[:8]}@example.com"
    data = make_register_data(email)

    resp1 = await client.post("/api/v1/auth/register", json=data)
    assert resp1.status_code == 201

    resp2 = await client.post("/api/v1/auth/register", json=data)
    assert resp2.status_code == 400
    assert "已被注册" in resp2.json()["detail"]


@pytest.mark.asyncio
async def test_login_success(client):
    """登录成功"""
    data = make_register_data()
    await client.post("/api/v1/auth/register", json=data)

    resp = await client.post("/api/v1/auth/login", json={
        "email": data["email"],
        "password": data["password"],
    })
    assert resp.status_code == 200
    result = resp.json()
    assert "access_token" in result
    assert "refresh_token" in result
    assert result["token_type"] == "bearer"
    assert result["roles"] == ["student"]
    assert result["active_role"] == "student"


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    """密码错误"""
    data = make_register_data()
    await client.post("/api/v1/auth/register", json=data)

    resp = await client.post("/api/v1/auth/login", json={
        "email": data["email"],
        "password": "wrongpassword",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_nonexistent_user(client):
    """用户不存在"""
    resp = await client.post("/api/v1/auth/login", json={
        "email": "nobody@example.com",
        "password": "somepassword",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token(client):
    """刷新 Token 成功"""
    data = make_register_data()
    await client.post("/api/v1/auth/register", json=data)
    login_resp = await client.post("/api/v1/auth/login", json={
        "email": data["email"],
        "password": data["password"],
    })
    refresh_token = login_resp.json()["refresh_token"]

    resp = await client.post("/api/v1/auth/refresh", json={
        "refresh_token": refresh_token,
    })
    assert resp.status_code == 200
    result = resp.json()
    assert "access_token" in result
    assert "refresh_token" in result


@pytest.mark.asyncio
async def test_refresh_invalid_token(client):
    """无效 refresh token"""
    resp = await client.post("/api/v1/auth/refresh", json={
        "refresh_token": "invalid.token.here",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_me(client):
    """获取当前用户信息"""
    data = make_register_data()
    await client.post("/api/v1/auth/register", json=data)
    login_resp = await client.post("/api/v1/auth/login", json={
        "email": data["email"],
        "password": data["password"],
    })
    token = login_resp.json()["access_token"]

    resp = await client.get("/api/v1/auth/me", headers={
        "Authorization": f"Bearer {token}",
    })
    assert resp.status_code == 200
    result = resp.json()
    assert result["email"] == data["email"]


@pytest.mark.asyncio
async def test_switch_role_success(client):
    """角色切换成功（先开通教师，再切回学生）"""
    data = make_register_data()
    await client.post("/api/v1/auth/register", json=data)
    login_resp = await client.post("/api/v1/auth/login", json={
        "email": data["email"],
        "password": data["password"],
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 开通教师
    await client.post("/api/v1/auth/become-teacher", json=TEACHER_PROFILE_DATA, headers=headers)

    # 切回学生
    resp = await client.post("/api/v1/auth/switch-role", json={"role": "student"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["active_role"] == "student"


@pytest.mark.asyncio
async def test_switch_role_not_owned(client):
    """切换到未拥有的角色"""
    data = make_register_data()
    await client.post("/api/v1/auth/register", json=data)
    login_resp = await client.post("/api/v1/auth/login", json={
        "email": data["email"],
        "password": data["password"],
    })
    token = login_resp.json()["access_token"]

    resp = await client.post("/api/v1/auth/switch-role", json={"role": "teacher"}, headers={
        "Authorization": f"Bearer {token}",
    })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_become_teacher_success(client):
    """开通教师身份成功"""
    data = make_register_data()
    await client.post("/api/v1/auth/register", json=data)
    login_resp = await client.post("/api/v1/auth/login", json={
        "email": data["email"],
        "password": data["password"],
    })
    token = login_resp.json()["access_token"]

    resp = await client.post("/api/v1/auth/become-teacher", json=TEACHER_PROFILE_DATA, headers={
        "Authorization": f"Bearer {token}",
    })
    assert resp.status_code == 200
    result = resp.json()
    assert "teacher" in result["roles"]
    assert result["active_role"] == "teacher"


@pytest.mark.asyncio
async def test_become_teacher_duplicate(client):
    """重复开通教师身份"""
    data = make_register_data()
    await client.post("/api/v1/auth/register", json=data)
    login_resp = await client.post("/api/v1/auth/login", json={
        "email": data["email"],
        "password": data["password"],
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    await client.post("/api/v1/auth/become-teacher", json=TEACHER_PROFILE_DATA, headers=headers)

    resp = await client.post("/api/v1/auth/become-teacher", json=TEACHER_PROFILE_DATA, headers=headers)
    assert resp.status_code == 400
    assert "已开通" in resp.json()["detail"]
