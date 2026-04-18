"""
支付渠道适配器注册表（plan.md §3.3.3）。

通过 `get_channel(name)` 获取 ChannelAdapter 实例。新增真实渠道（VNPay/MoMo）
时只需新增 `channels/<name>.py` 并在此处注册，业务层无需改动。
"""
from __future__ import annotations

from app.services.payment.channels.base import PaymentChannelAdapter
from app.services.payment.channels.mock import MockChannel

_MOCK = MockChannel()

_REGISTRY: dict[str, PaymentChannelAdapter] = {
    "mock": _MOCK,
}


def get_channel(name: str) -> PaymentChannelAdapter:
    try:
        return _REGISTRY[name]
    except KeyError as e:
        raise ValueError(f"未知支付渠道：{name}") from e


__all__ = ["PaymentChannelAdapter", "MockChannel", "get_channel"]
