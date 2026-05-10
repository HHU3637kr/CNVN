/**
 * 付款单详情 — spec/03-能力交付/20260421-2100-支付前端与VietQR验证-spike/plan.md
 */
import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router";
import { AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import { getAccessToken } from "../lib/api";
import { apiFetchJson, ApiError } from "../lib/http";
import type {
  DisputeCreate,
  DisputeOut,
  DisputeReasonCode,
  PaymentOrderDetail as PaymentOrderDetailT,
} from "../types/api";
import { formatVndFull } from "../lib/format";

const DISPUTE_REASON_OPTIONS: { value: DisputeReasonCode; label: string }[] = [
  { value: "teacher_no_show", label: "老师未出席" },
  { value: "quality_issue", label: "教学质量问题" },
  { value: "technical_issue", label: "技术问题" },
  { value: "payment_issue", label: "付款或结算问题" },
  { value: "other", label: "其他" },
];

export function PaymentOrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const location = useLocation();
  const token = getAccessToken();
  const [data, setData] = useState<PaymentOrderDetailT | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [reasonCode, setReasonCode] = useState<DisputeReasonCode>("quality_issue");
  const [description, setDescription] = useState("");
  const [disputeMessage, setDisputeMessage] = useState<string | null>(null);
  const [disputeTone, setDisputeTone] = useState<"success" | "error">("success");
  const [submittingDispute, setSubmittingDispute] = useState(false);

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

  const canCreateDispute = data?.status === "held" || data?.status === "disputed";

  const submitDispute = async () => {
    if (!orderId || !data) return;
    const trimmed = description.trim();
    if (!trimmed) {
      setDisputeTone("error");
      setDisputeMessage("请填写争议说明");
      return;
    }

    const payload: DisputeCreate = {
      payment_order_id: orderId,
      reason_code: reasonCode,
      description: trimmed,
    };

    setSubmittingDispute(true);
    setDisputeMessage(null);
    try {
      await apiFetchJson<DisputeOut>("/disputes", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setDisputeTone("success");
      setDisputeMessage("争议已提交，付款单将进入争议处理。");
      const refreshed = await apiFetchJson<PaymentOrderDetailT>(`/payments/orders/${orderId}`);
      setData(refreshed);
    } catch (e) {
      setDisputeTone("error");
      if (e instanceof ApiError && e.status === 409) {
        setDisputeMessage("该付款单已有处理中争议。");
      } else if (e instanceof ApiError && e.status === 403) {
        setDisputeMessage("无权对该付款单发起争议。");
      } else {
        setDisputeMessage(e instanceof ApiError ? e.message : "争议提交失败，请稍后重试。");
      }
    } finally {
      setSubmittingDispute(false);
    }
  };

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

          {canCreateDispute && (
            <div className="pt-4 mt-4 border-t border-gray-100 space-y-4">
              {data.status === "disputed" && (
                <div className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>该付款单已进入争议处理，自动释放会暂停。</span>
                </div>
              )}
              {!showDisputeForm ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowDisputeForm(true);
                    setDisputeMessage(null);
                  }}
                  className="w-full sm:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-bold inline-flex items-center justify-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4" />
                  发起争议
                </button>
              ) : (
                <div className="space-y-3">
                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">争议原因</span>
                    <select
                      value={reasonCode}
                      onChange={(e) => setReasonCode(e.target.value as DisputeReasonCode)}
                      className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                    >
                      {DISPUTE_REASON_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">情况说明</span>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      maxLength={1000}
                      className="mt-2 w-full h-28 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 resize-none"
                      placeholder="请说明争议原因，平台客服会据此处理。"
                    />
                    <span className="block text-right text-xs text-gray-400 mt-1">
                      {description.length}/1000
                    </span>
                  </label>
                  {disputeMessage && (
                    <div
                      className={`text-sm rounded-lg px-3 py-2 border ${
                        disputeTone === "success"
                          ? "text-green-700 bg-green-50 border-green-100"
                          : "text-red-700 bg-red-50 border-red-100"
                      }`}
                    >
                      {disputeMessage}
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={() => setShowDisputeForm(false)}
                      disabled={submittingDispute}
                      className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={submitDispute}
                      disabled={submittingDispute}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2"
                    >
                      {submittingDispute && <Loader2 className="w-4 h-4 animate-spin" />}
                      提交争议
                    </button>
                  </div>
                </div>
              )}
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
