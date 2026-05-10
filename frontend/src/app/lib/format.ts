/** 金额与时间与后端约定一致（VND 整数、ISO 时间） */

import type { AvailabilityOut } from "../types/api";

export function formatVndK(amount: number): string {
  return `₫${(amount / 1000).toFixed(0)}k`;
}

export function formatVndFull(amount: number): string {
  return `₫${amount.toLocaleString("vi-VN")}`;
}

export function formatPercentDecimal(rate: string | number): string {
  const n = typeof rate === "string" ? Number(rate) : rate;
  if (!Number.isFinite(n)) return "—";
  const percent = Math.abs(n) <= 1 ? n * 100 : n;
  return `${percent.toFixed(percent % 1 === 0 ? 0 : 2)}%`;
}

export function formatDateTimeVN(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("zh-CN", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatPayoutStatus(status: string): string {
  const map: Record<string, string> = {
    pending: "待出款",
    processing: "处理中",
    paid: "已到账",
    failed: "出款失败",
    cancelled: "已取消",
  };
  return map[status] ?? status;
}

const VN_DAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

export function formatLessonScheduled(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const dateStr = d.toLocaleDateString("zh-CN", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timeStr = d.toLocaleTimeString("zh-CN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return { date: dateStr, time: timeStr };
}

export function weekdayLabel(dayOfWeek: number | null | undefined): string {
  if (dayOfWeek == null || dayOfWeek < 0 || dayOfWeek > 6) return "";
  return VN_DAYS[dayOfWeek] ?? "";
}

/** 后端 time 字段序列化可能为 "09:00:00" */
function clipTime(t: string): string {
  const s = String(t);
  return s.length >= 5 ? s.slice(0, 5) : s;
}

export function formatAvailabilitySlot(a: AvailabilityOut): string {
  const start = clipTime(a.start_time as unknown as string);
  const end = clipTime(a.end_time as unknown as string);
  if (a.specific_date) {
    return `${a.specific_date} ${start}–${end}`;
  }
  if (a.day_of_week != null) {
    const w = weekdayLabel(a.day_of_week);
    return `${w} ${start}–${end}${a.is_recurring ? "（每周）" : ""}`;
  }
  return `${start}–${end}`;
}
