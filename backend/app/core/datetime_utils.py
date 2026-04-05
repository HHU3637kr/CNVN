"""时区与课程时间区间工具（与 DEFAULT_TIMEZONE 配合使用）"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo


def ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def local_lesson_window(
    scheduled_at_utc: datetime, duration_minutes: int, tz_name: str
) -> tuple[datetime, datetime]:
    """返回本地时区下的 [start, end)；若跨自然日则抛错。"""
    start = ensure_utc(scheduled_at_utc).astimezone(ZoneInfo(tz_name))
    end = start + timedelta(minutes=duration_minutes)
    if end.date() != start.date():
        raise ValueError("课程不可跨自然日")
    return start, end


def intervals_overlap(
    a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime
) -> bool:
    return a_start < b_end and b_start < a_end
