"""
税务策略（plan.md §3.3.2）。

按 TeacherTaxProfile.tax_scenario 分流到三类策略。本次落地简化为固定 10%，
`vat_amount=0`，全部税负计入 `pit_amount`。场景三（越南居民）的累进 PIT
留待 v0.3 替换。
"""
from app.services.tax.base import TaxCalculation, TaxStrategy, get_strategy

__all__ = ["TaxCalculation", "TaxStrategy", "get_strategy"]
