/**
 * 教师出款列表 — spec/03-功能实现/20260421-2100-支付前端与VietQR验证-spike/plan.md
 */
import { useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router";
import { ArrowLeft, Loader2, Wallet } from "lucide-react";
import { getAccessToken } from "../lib/api";
import { apiFetchJson, ApiError } from "../lib/http";
import type { PaginatedResponse, PayoutOrderOut, UserOut } from "../types/api";
import { formatVndFull } from "../lib/format";

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
        const u = await apiFetchJson<UserOut>("/auth/me");
        if (!u.roles.includes("teacher")) {
          if (!cancelled) {
            setMe(u);
            setErr("需要教师身份才能查看出款单");
            setLoading(false);
          }
          return;
        }
        const p = await apiFetchJson<PaginatedResponse<PayoutOrderOut>>("/payouts/me?page=1&page_size=50");
        if (!cancelled) {
          setMe(u);
          setItems(p.items);
          setTotal(p.total);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof ApiError ? e.message : "加载失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link
        to="/dashboard/teacher"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        返回教师中心
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-2">
        <Wallet className="w-7 h-7 text-green-600" />
        我的出款单
      </h1>
      <p className="text-gray-600 text-sm mb-6">数据来源：<code className="text-xs bg-gray-100 px-1 rounded">GET /api/v1/payouts/me</code></p>

      {loading && (
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          加载中…
        </div>
      )}
      {!loading && err && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">{err}</div>}
      {!loading && me?.roles.includes("teacher") && items.length === 0 && (
        <p className="text-sm text-gray-500">暂无出款记录（total={total}）</p>
      )}
      {!loading && me?.roles.includes("teacher") && items.length > 0 && (
        <ul className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
          {items.map((row) => (
            <li key={row.id} className="p-4 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <div className="font-medium text-gray-900">
                  {formatVndFull(row.net_amount)} · <span className="text-gray-600">{row.status}</span>
                </div>
                <div className="text-xs text-gray-500 font-mono mt-1">payment_order: {row.payment_order_id}</div>
                <div className="text-xs text-gray-400">{new Date(row.created_at).toLocaleString("zh-CN")}</div>
              </div>
              <div className="text-xs text-gray-500">渠道 {row.channel}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
