"""
端到端支付流程测试（plan.md §5 + test-plan.md I-001~I-004 验证）。

覆盖场景：
  1. 注册学员 + 教师
  2. 教师建档 + 添加可用时段
  3. 学员充值
  4. 学员下单（→ PaymentOrder paid+held，escrow += gross）
  5. 教师确认 + 开始 + 结束课程（→ held_until 写入）
  6. 手动将 held_until 拨到过去
  7. 触发 dispute_watcher.run_once（→ 跑税务策略、落快照、生成 PayoutOrder、教师钱包到账）
  8. 校验资金守恒：Σ(ledger) + Σ(wallet) == Σ(topup)

用法：docker exec cnvn-api uv run python -m scripts.e2e_payment_test
"""
from __future__ import annotations

import asyncio
import sys
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import httpx
from sqlalchemy import func, select, update

API = "http://localhost:8000/api/v1"

OK = "\033[32m✓\033[0m"
FAIL = "\033[31m✗\033[0m"
WARN = "\033[33m!\033[0m"


def _ts() -> str:
    return datetime.now(timezone.utc).strftime("%H:%M:%S")


def log(msg: str) -> None:
    print(f"[{_ts()}] {msg}")


def ok(msg: str) -> None:
    print(f"[{_ts()}] {OK} {msg}")


def fail(msg: str) -> None:
    print(f"[{_ts()}] {FAIL} {msg}")
    sys.exit(1)


async def assert_fund_conservation(note: str) -> None:
    from app.database import async_session
    from app.models.ledger import LedgerAccount
    from app.models.payment import Transaction, Wallet

    async with async_session() as db:
        ledger_total = (
            await db.execute(
                select(func.coalesce(func.sum(LedgerAccount.balance), 0))
            )
        ).scalar_one()
        wallet_total = (
            await db.execute(select(func.coalesce(func.sum(Wallet.balance), 0)))
        ).scalar_one()
        topup_total = (
            await db.execute(
                select(func.coalesce(func.sum(Transaction.amount), 0))
                .where(Transaction.type == "topup")
            )
        ).scalar_one()
    lhs = int(ledger_total) + int(wallet_total)
    rhs = int(topup_total)
    if lhs != rhs:
        fail(
            f"资金守恒失败 @ {note}: ledger={ledger_total} + wallet={wallet_total} "
            f"({lhs}) != topup={topup_total}"
        )
    ok(f"资金守恒 @ {note}: Σ(ledger) + Σ(wallet) = {lhs} = Σ(topup)")


async def register(c: httpx.AsyncClient, email: str, password: str, name: str, role: str) -> str:
    r = await c.post(
        f"{API}/auth/register",
        json={
            "email": email,
            "password": password,
            "full_name": name,
            "role": role,
        },
    )
    if r.status_code not in (200, 201):
        fail(f"register {email}: {r.status_code} {r.text}")
    ok(f"注册 {email} ({role})")
    # login
    r = await c.post(
        f"{API}/auth/login",
        json={"email": email, "password": password},
    )
    if r.status_code != 200:
        fail(f"login {email}: {r.status_code} {r.text}")
    token = r.json()["access_token"]
    ok(f"登录 {email}，拿到 token")
    return token


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def main() -> None:
    suffix = uuid.uuid4().hex[:6]
    stu_email = f"student-{suffix}@test.local"
    tea_email = f"teacher-{suffix}@test.local"
    password = "Passw0rd!"

    async with httpx.AsyncClient(timeout=15.0) as c:
        # 1. 注册两个用户
        stu_token = await register(c, stu_email, password, "学员测试", "student")
        tea_token = await register(c, tea_email, password, "教师测试", "teacher")

        # 2. 教师开通（become-teacher：创建档案 + 追加 teacher 角色）
        r = await c.post(
            f"{API}/auth/become-teacher",
            json={
                "title": "中文老师测试",
                "about": "E2E",
                "hourly_rate": 500000,
                "teacher_type": "cn_native",
                "specialties": ["HSK"],
            },
            headers=auth(tea_token),
        )
        if r.status_code not in (200, 201):
            fail(f"become-teacher: {r.status_code} {r.text}")
        ok("教师开通身份")

        # 角色升级后 JWT 需要重新签发（active_role 变为 teacher）
        r = await c.post(
            f"{API}/auth/login",
            json={"email": tea_email, "password": password},
        )
        tea_token = r.json()["access_token"]
        ok(f"教师重新登录，active_role={r.json()['active_role']}")

        # 查询教师自己的 profile_id
        r = await c.get(f"{API}/auth/me", headers=auth(tea_token))
        tea_user = r.json()
        # get profile id via teacher endpoint /teachers?q=
        from app.database import async_session
        from app.models.teacher_profile import TeacherProfile
        from sqlalchemy import select as _select
        async with async_session() as db:
            r2 = await db.execute(
                _select(TeacherProfile).where(
                    TeacherProfile.user_id == uuid.UUID(tea_user["id"])
                )
            )
            teacher_profile_id = str(r2.scalars().first().id)
        ok(f"教师档案 teacher_profile_id={teacher_profile_id}")

        # 3. 教师添加可用时段（明天 +25h，覆盖测试课程时间）
        # 注意：availability 的 start_time / end_time / specific_date 是按 Asia/Ho_Chi_Minh
        # 本地时区存储；lesson 的 scheduled_at 是 UTC，服务端再换算回本地比较。
        from zoneinfo import ZoneInfo

        tz = ZoneInfo("Asia/Ho_Chi_Minh")
        start_utc = datetime.now(timezone.utc).replace(
            microsecond=0, second=0, minute=0
        ) + timedelta(hours=25)
        start_local = start_utc.astimezone(tz)
        end_local = start_local + timedelta(hours=3)
        r = await c.post(
            f"{API}/availability",
            json={
                "specific_date": start_local.date().isoformat(),
                "start_time": start_local.time().isoformat(),
                "end_time": end_local.time().isoformat(),
                "is_recurring": False,
            },
            headers=auth(tea_token),
        )
        if r.status_code not in (200, 201):
            fail(f"availability: {r.status_code} {r.text}")
        ok(
            f"教师可用时段 (本地) {start_local.date()} "
            f"{start_local.time()}~{end_local.time()}"
        )

        # 课程 scheduled_at 用 UTC 表示，对应本地 start_local + 30min
        lesson_scheduled_at = start_utc + timedelta(minutes=30)

        # 4. 学员充值
        TOPUP = 1_000_000
        r = await c.post(
            f"{API}/wallet/topup",
            json={"amount": TOPUP},
            headers=auth(stu_token),
        )
        if r.status_code != 200:
            fail(f"topup: {r.status_code} {r.text}")
        ok(f"学员充值 {TOPUP} VND，余额={r.json()['balance']}")

        await assert_fund_conservation("topup 后")

        # 5. 学员下单
        r = await c.post(
            f"{API}/lessons",
            json={
                "teacher_id": teacher_profile_id,
                "scheduled_at": lesson_scheduled_at.isoformat(),
                "duration_minutes": 60,
                "topic": "E2E 测试课",
            },
            headers=auth(stu_token),
        )
        if r.status_code not in (200, 201):
            fail(f"create lesson: {r.status_code} {r.text}")
        lesson = r.json()
        lesson_id = lesson["id"]
        gross = lesson["price"]
        ok(f"下单 lesson_id={lesson_id}，price={gross} VND")

        await assert_fund_conservation("下单后")

        # 验证 PaymentOrder 状态
        from app.database import async_session
        from app.models.payment_order import PaymentOrder

        async with async_session() as db:
            r2 = await db.execute(
                select(PaymentOrder).where(
                    PaymentOrder.lesson_id == uuid.UUID(lesson_id)
                )
            )
            order = r2.scalars().first()
            if order is None:
                fail("下单后未生成 PaymentOrder")
            if order.status != "held":
                fail(f"PaymentOrder.status 应为 held，实为 {order.status}")
            if order.held_until is not None:
                fail("课程尚未完成，held_until 应为 None")
            ok(
                f"PaymentOrder.status={order.status}, gross={order.gross_amount}, "
                f"held_until={order.held_until}"
            )

        # 6. 教师确认 + 开始 + 结束课程
        r = await c.patch(
            f"{API}/lessons/{lesson_id}/confirm", headers=auth(tea_token)
        )
        if r.status_code != 200:
            fail(f"confirm: {r.status_code} {r.text}")
        ok("教师确认课程")

        r = await c.patch(
            f"{API}/lessons/{lesson_id}/start", headers=auth(tea_token)
        )
        if r.status_code != 200:
            fail(f"start: {r.status_code} {r.text}")
        ok("教师开始课程")

        r = await c.patch(
            f"{API}/lessons/{lesson_id}/end", headers=auth(tea_token)
        )
        if r.status_code != 200:
            fail(f"end: {r.status_code} {r.text}")
        ok("教师结束课程")

        # 验证 held_until 已写入
        async with async_session() as db:
            r2 = await db.execute(
                select(PaymentOrder).where(PaymentOrder.id == order.id)
            )
            order = r2.scalars().first()
            if order.held_until is None:
                fail("end_lesson 后 held_until 仍为 None")
            ok(f"PaymentOrder.held_until={order.held_until}（预计 +24h）")

        # 7. 把 held_until 拨到过去，然后跑 dispute_watcher
        async with async_session() as db:
            await db.execute(
                update(PaymentOrder)
                .where(PaymentOrder.id == order.id)
                .values(held_until=datetime.now(timezone.utc) - timedelta(minutes=1))
            )
            await db.commit()
            ok("将 held_until 拨到过去（模拟争议期结束）")

        # 触发 release
        from app.services import dispute_watcher

        async with async_session() as db:
            processed = await dispute_watcher.run_once(db, batch_size=10)
            await db.commit()
        ok(f"dispute_watcher.run_once 处理 {processed} 条")

        if processed != 1:
            fail(f"期望处理 1 条，实际 {processed}")

        # 8. 验证最终状态
        from app.models.ledger import LedgerAccount
        from app.models.payment import Wallet
        from app.models.payment_order import PayoutOrder, SettlementSnapshot
        from app.models.user import User

        async with async_session() as db:
            o = (
                await db.execute(
                    select(PaymentOrder).where(PaymentOrder.id == order.id)
                )
            ).scalars().first()
            if o.status != "released":
                fail(f"PaymentOrder.status 应为 released，实为 {o.status}")
            ok("PaymentOrder → released")

            snapshot = (
                await db.execute(
                    select(SettlementSnapshot).where(
                        SettlementSnapshot.payment_order_id == o.id
                    )
                )
            ).scalars().first()
            if snapshot is None:
                fail("SettlementSnapshot 未生成")
            ok(
                f"SettlementSnapshot: gross={snapshot.gross_amount}, "
                f"commission={snapshot.commission_amount} "
                f"(rate={snapshot.commission_rate}), pit={snapshot.pit_amount}, "
                f"net={snapshot.net_amount}"
            )
            # 守恒校验
            total = (
                snapshot.commission_amount
                + snapshot.vat_amount
                + snapshot.pit_amount
                + snapshot.net_amount
            )
            if total != snapshot.gross_amount:
                fail(
                    f"B2 守恒失败: commission+vat+pit+net = {total} "
                    f"!= gross = {snapshot.gross_amount}"
                )
            ok(f"B2 守恒成立：commission+vat+pit+net = gross = {total}")

            payout = (
                await db.execute(
                    select(PayoutOrder).where(PayoutOrder.payment_order_id == o.id)
                )
            ).scalars().first()
            if payout is None:
                fail("PayoutOrder 未生成")
            if payout.status != "paid":
                fail(f"PayoutOrder.status 应为 paid，实为 {payout.status}")
            ok(f"PayoutOrder → paid, net_amount={payout.net_amount}")

            # 教师钱包
            teacher_user = (
                await db.execute(
                    select(User).where(User.email == tea_email)
                )
            ).scalars().first()
            teacher_wallet = (
                await db.execute(
                    select(Wallet).where(Wallet.user_id == teacher_user.id)
                )
            ).scalars().first()
            if teacher_wallet is None or teacher_wallet.balance != snapshot.net_amount:
                fail(
                    f"教师钱包余额应为 {snapshot.net_amount}，"
                    f"实为 {teacher_wallet.balance if teacher_wallet else None}"
                )
            ok(f"教师钱包到账 {teacher_wallet.balance} VND")

            # 账本余额
            accounts = {
                a.code: a.balance
                for a in (
                    (await db.execute(select(LedgerAccount))).scalars().all()
                )
            }
            ok(f"账本: {accounts}")

            # escrow 应回到 0（学员钱本笔已全部释放）
            if accounts["escrow"] != 0:
                fail(f"escrow 应为 0，实为 {accounts['escrow']}")
            # platform_revenue = commission
            if accounts["platform_revenue"] != snapshot.commission_amount:
                fail(
                    f"platform_revenue={accounts['platform_revenue']} "
                    f"!= commission={snapshot.commission_amount}"
                )
            # tax_payable = vat + pit
            if accounts["tax_payable"] != (snapshot.vat_amount + snapshot.pit_amount):
                fail(
                    f"tax_payable={accounts['tax_payable']} != "
                    f"vat+pit={snapshot.vat_amount + snapshot.pit_amount}"
                )
            # teacher_payable = 0（已立即出款到教师钱包）
            if accounts["teacher_payable"] != 0:
                fail(f"teacher_payable 应为 0，实为 {accounts['teacher_payable']}")
            ok("账本余额全部符合预期")

        await assert_fund_conservation("release 后")

        print()
        print(f"{OK} {OK} {OK}  全部 E2E 用例通过  {OK} {OK} {OK}")


if __name__ == "__main__":
    asyncio.run(main())
