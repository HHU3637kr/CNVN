/**
 * 教师出款明细 — spec/03-能力交付/20260501-1122-教师入驻排课授课收款闭环/writer/plan.md §3.7
 */
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation } from "react-router";
import { ArrowLeft, Clock, Loader2, Wallet } from "lucide-react";
import { getAccessToken } from "../lib/api";
import { apiFetchJson, ApiError } from "../lib/http";
import type { PaginatedResponse, PayoutOrderOut, UserOut } from "../types/api";
import {
  formatDateTimeVN,
  formatPayoutStatus,
  formatPercentDecimal,
  formatVndFull,
} from "../lib/format";

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "加载失败";
}

function money(value: number | undefined): string {
  return typeof value === "number" ? formatVndFull(value) : "-";
}

function shortId(id: string | null | undefined): string {
  return id ? id.slice(0, 8) : "-";
}

export function Payouts() {
  const location = useLocation();
  const token = getAccessToken();
  const [me, setMe] = useState<UserOut | null>(null);
  const [items, setItems] = useState<PayoutOrderOut[]>([]);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setErr(null);
      setLoading(true);
      try {
        const user = await apiFetchJson<UserOut>("/auth/me");
        setMe(user);
        if (!user.roles.includes("teacher")) {
          setErr("需要教师身份才能查看出款明细");
          return;
        }
        const data = await apiFetchJson<PaginatedResponse<PayoutOrderOut>>(
          "/payouts/me?page=1&page_size=50"
        );
        if (!cancelled) {
          setItems(data.items);
          setTotal(data.total);
        }
      } catch (e) {
        if (!cancelled) setErr(errorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const totals = useMemo(
    () =>
      items.reduce(
        (sum, item) => ({
          gross: sum.gross + (item.gross_amount ?? 0),
          commission: sum.commission + (item.commission_amount ?? 0),
          tax: sum.tax + (item.tax_amount ?? (item.vat_amount ?? 0) + (item.pit_amount ?? 0)),
          net: sum.net + item.net_amount,
        }),
        { gross: 0, commission: 0, tax: 0, net: 0 }
      ),
    [items]
  );

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Link
        to="/dashboard/teacher"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        返回教师中心
      </Link>

      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-2">
            <Wallet className="w-7 h-7 text-green-600" />
            出款明细
          </h1>
          <p className="text-gray-600 text-sm">
            课程收入扣除平台费和税费后，实际到账金额会在结算释放后生成出款记录。
          </p>
        </div>
        <div className="text-sm text-gray-500">
          共 {total} 笔
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          加载中...
        </div>
      )}

      {!loading && err && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
          {err}
        </div>
      )}

      {!loading && me?.roles.includes("teacher") && !err && items.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-100 p-8 text-center shadow-sm">
          <Clock className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-700 font-medium">暂无出款记录</p>
          <p className="text-sm text-gray-500 mt-2">
            课程完成并过争议期后，平台会生成出款记录并展示收入、平台费、税费和实际到账。
          </p>
        </div>
      )}

      {!loading && me?.roles.includes("teacher") && items.length > 0 && (
        <div className="space-y-5">
          <div className="grid md:grid-cols-4 gap-4">
            <SummaryCard label="课程收入" value={formatVndFull(totals.gross)} />
            <SummaryCard label="平台费" value={formatVndFull(totals.commission)} />
            <SummaryCard label="税费" value={formatVndFull(totals.tax)} />
            <SummaryCard label="实际到账" value={formatVndFull(totals.net)} emphasis />
          </div>

          <div className="bg-white rounded-lg border border-gray-100 shadow-sm divide-y divide-gray-100">
            {items.map((row) => {
              const taxAmount = row.tax_amount ?? (row.vat_amount ?? 0) + (row.pit_amount ?? 0);
              return (
                <div key={row.id} className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="text-lg font-bold text-gray-900">
                          {formatVndFull(row.net_amount)}
                        </span>
                        <span className="text-xs font-medium rounded-full bg-green-50 text-green-700 px-2 py-1">
                          {formatPayoutStatus(row.status)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
                        <span>课程 {shortId(row.lesson_id)}</span>
                        <span>付款单 {shortId(row.payment_order_id)}</span>
                        <span>渠道 {row.channel || "mock"}</span>
                        <span>创建 {formatDateTimeVN(row.created_at)}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm min-w-0 lg:min-w-[520px]">
                      <Amount label="课程收入" value={money(row.gross_amount)} />
                      <Amount
                        label={`平台费${row.commission_rate ? ` ${formatPercentDecimal(row.commission_rate)}` : ""}`}
                        value={money(row.commission_amount)}
                      />
                      <Amount label="税费" value={formatVndFull(taxAmount)} />
                      <Amount label="实际到账" value={formatVndFull(row.net_amount)} strong />
                    </div>
                  </div>
                  <div className="mt-4 grid md:grid-cols-3 gap-3 text-xs text-gray-600 bg-gray-50 rounded-lg p-3">
                    <div>争议期截止：{formatDateTimeVN(row.held_until ?? null)}</div>
                    <div>释放时间：{formatDateTimeVN(row.released_at ?? null)}</div>
                    <div>到账时间：{formatDateTimeVN(row.paid_at)}</div>
                    <div>VAT：{money(row.vat_amount)}</div>
                    <div>PIT：{money(row.pit_amount)}</div>
                    <div>税务场景：{row.tax_scenario || "-"}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-100 p-4 shadow-sm">
      <div className="text-sm text-gray-500 mb-1">{label}</div>
      <div className={`text-xl font-bold ${emphasis ? "text-green-700" : "text-gray-900"}`}>
        {value}
      </div>
    </div>
  );
}

function Amount({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-100 px-3 py-2">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`font-semibold ${strong ? "text-green-700" : "text-gray-900"}`}>
        {value}
      </div>
    </div>
  );
}
