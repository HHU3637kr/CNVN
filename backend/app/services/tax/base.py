"""税务策略基类与工厂（plan.md §3.3.2）。"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Protocol

from app.config import settings
from app.models.teacher_tax_profile import (
    TAX_SCENARIO_CN_RESIDENT,
    TAX_SCENARIO_VN_PASSPORT_IN_CN,
    TAX_SCENARIO_VN_RESIDENT,
    TeacherTaxProfile,
)


@dataclass(frozen=True)
class TaxCalculation:
    """
    不可变结算计算结果（plan.md §3.2.3 的 SettlementSnapshot 构造入参）。

    守恒约束（B2 决议）：
        commission_amount + vat_amount + pit_amount + net_amount == gross_amount
    """

    tax_scenario: str
    gross_amount: int
    commission_rate: Decimal
    commission_amount: int
    tax_rate: Decimal
    vat_amount: int
    pit_amount: int
    net_amount: int


class TaxStrategy(Protocol):
    scenario: str
    tax_rate: Decimal

    def calculate(
        self,
        gross: int,
        commission_rate: Decimal,
        profile: TeacherTaxProfile,
    ) -> TaxCalculation:
        ...


def _compute_flat(
    scenario: str,
    gross: int,
    commission_rate: Decimal,
    tax_rate: Decimal,
    vat_rate: Decimal,
) -> TaxCalculation:
    """
    "倒推保守恒"取整策略（plan.md §2.1 FR-005 B2 决议）：

        tutor_gross       = int(Decimal(gross) * (1 - commission_rate))
        commission_amount = gross - tutor_gross
        vat_amount        = int(Decimal(tutor_gross) * vat_rate)
        pit_amount        = int(Decimal(tutor_gross - vat_amount) * tax_rate)
        net_amount        = tutor_gross - vat_amount - pit_amount

    守恒：commission + vat + pit + net == gross
    """
    if gross <= 0:
        raise ValueError(f"gross 必须为正整数：{gross}")
    if not (Decimal("0") <= commission_rate < Decimal("1")):
        raise ValueError(f"commission_rate 超出范围：{commission_rate}")

    tutor_gross = int(Decimal(gross) * (Decimal("1") - commission_rate))
    commission_amount = gross - tutor_gross

    vat_amount = int(Decimal(tutor_gross) * vat_rate)
    pit_amount = int(Decimal(tutor_gross - vat_amount) * tax_rate)
    net_amount = tutor_gross - vat_amount - pit_amount

    # 守恒自检（避免未来修改破坏）
    assert commission_amount + vat_amount + pit_amount + net_amount == gross, (
        f"守恒破坏：{commission_amount=} {vat_amount=} {pit_amount=} "
        f"{net_amount=} {gross=}"
    )

    return TaxCalculation(
        tax_scenario=scenario,
        gross_amount=gross,
        commission_rate=commission_rate,
        commission_amount=commission_amount,
        tax_rate=tax_rate,
        vat_amount=vat_amount,
        pit_amount=pit_amount,
        net_amount=net_amount,
    )


class _FlatRateStrategy:
    """三个场景本次共享的"固定税率 + 零 VAT"策略骨架。"""

    def __init__(self, scenario: str, tax_rate: Decimal) -> None:
        self.scenario = scenario
        self.tax_rate = tax_rate

    def calculate(
        self,
        gross: int,
        commission_rate: Decimal,
        profile: TeacherTaxProfile,
    ) -> TaxCalculation:
        return _compute_flat(
            scenario=self.scenario,
            gross=gross,
            commission_rate=commission_rate,
            tax_rate=self.tax_rate,
            vat_rate=settings.VAT_RATE,
        )


# ---- 三个场景实例（模块级单例） ----

CN_RESIDENT_STRATEGY = _FlatRateStrategy(
    TAX_SCENARIO_CN_RESIDENT, settings.TAX_RATE_CN_RESIDENT
)
VN_PASSPORT_IN_CN_STRATEGY = _FlatRateStrategy(
    TAX_SCENARIO_VN_PASSPORT_IN_CN, settings.TAX_RATE_VN_PASSPORT_IN_CN
)
VN_RESIDENT_STRATEGY = _FlatRateStrategy(
    TAX_SCENARIO_VN_RESIDENT, settings.TAX_RATE_VN_RESIDENT
)


_STRATEGY_REGISTRY: dict[str, TaxStrategy] = {
    TAX_SCENARIO_CN_RESIDENT: CN_RESIDENT_STRATEGY,
    TAX_SCENARIO_VN_PASSPORT_IN_CN: VN_PASSPORT_IN_CN_STRATEGY,
    TAX_SCENARIO_VN_RESIDENT: VN_RESIDENT_STRATEGY,
}


def get_strategy(scenario: str) -> TaxStrategy:
    try:
        return _STRATEGY_REGISTRY[scenario]
    except KeyError as e:
        raise ValueError(f"未知 tax_scenario: {scenario}") from e
