/**
 * 付款单详情 — spec/03-功能实现/20260421-2100-支付前端与VietQR验证-spike/plan.md
 */
import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { getAccessToken } from "../lib/api";
import { apiFetchJson, ApiError } from "../lib/http";
import type { PaymentOrderDetail as PaymentOrderDetailT } from "../types/api";
import { formatVndFull } from "../lib/format";

export function PaymentOrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const location = useLocation();
  const token = getAccessToken();
  const [data, setData] = useState<PaymentOrderDetailT | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !orderId) return;
    let cancelled = false;
    (async () => {
      setErr(null);
      setLoading(true);
      try {
        const d = await apiFetchJson<PaymentOrderDetailT>(`/payments/orders/${orderId}`);
        if (!cancelled) setData(d);
      } catch (e) {
        if (!cancelled) setErr(e instanceof ApiError ? e.message : "加载失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, orderId]);

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link to="/wallet" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 mb-6">
        <ArrowLeft className="w-4 h-4" />
        返回钱包
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">付款单详情</h1>
      <p className="text-xs font-mono text-gray-500 mb-6 break-all">{orderId}</p>

      {loading && (
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          加载中…
        </div>
      )}
      {!loading && err && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">{err}</div>}
      {!loading && data && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3 text-sm">
          <Row label="状态" value={data.status} />
          <Row label="课程 ID" value={data.lesson_id} mono />
          <Row label="渠道" value={data.channel} />
          <Row label="总额" value={formatVndFull(data.gross_amount)} />
          <Row label="渠道流水号" value={data.channel_txn_id ?? "—"} />
          <Row label="held_until" value={data.held_until ?? "—"} mono />
          <Row label="paid_at" value={data.paid_at ?? "—"} mono />
          <Row label="released_at" value={data.released_at ?? "—"} mono />
          <Row label="refunded_at" value={data.refunded_at ?? "—"} mono />
          {data.settlement_snapshot && (
            <div className="pt-4 mt-4 border-t border-gray-100">
              <h2 className="font-semibold text-gray-900 mb-2">结算快照</h2>
              <Row label="gross" value={formatVndFull(data.settlement_snapshot.gross_amount)} />
              <Row label="commission" value={formatVndFull(data.settlement_snapshot.commission_amount)} />
              <Row label="commission_rate" value={String(data.settlement_snapshot.commission_rate)} />
              <Row label="vat" value={formatVndFull(data.settlement_snapshot.vat_amount)} />
              <Row label="pit" value={formatVndFull(data.settlement_snapshot.pit_amount)} />
              <Row label="net" value={formatVndFull(data.settlement_snapshot.net_amount)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-gray-50 py-2 last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className={`text-gray-900 text-right ${mono ? "font-mono text-xs break-all" : ""}`}>{value}</span>
    </div>
  );
}
