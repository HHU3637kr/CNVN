import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router";
import { Loader2, RefreshCw } from "lucide-react";
import { getAccessToken } from "../lib/api";
import { ApiError, apiFetchJson } from "../lib/http";
import { formatLessonScheduled, formatVndFull } from "../lib/format";
import type {
  DisputeAction,
  DisputeActionRequest,
  DisputeDetailOut,
  DisputeOut,
  PaginatedResponse,
} from "../types/api";

const STATUS_OPTIONS = [
  { value: "", label: "全部" },
  { value: "open", label: "待处理" },
  { value: "processing", label: "处理中" },
  { value: "resolved_refunded", label: "已退款" },
  { value: "resolved_released", label: "已释放" },
  { value: "closed_no_action", label: "已关闭" },
];

const ACTION_OPTIONS: { value: DisputeAction; label: string }[] = [
  { value: "assign", label: "接单/处理中" },
  { value: "add_note", label: "添加备注" },
  { value: "refund", label: "人工退款" },
  { value: "release", label: "人工释放" },
  { value: "close_no_action", label: "关闭不处理资金" },
];

const STATUS_LABEL: Record<string, string> = {
  open: "待处理",
  processing: "处理中",
  resolved_refunded: "已退款",
  resolved_released: "已释放",
  closed_no_action: "已关闭",
};

const REASON_LABEL: Record<string, string> = {
  teacher_no_show: "老师未出席",
  student_no_show: "学员未出席",
  quality_issue: "教学质量问题",
  technical_issue: "技术问题",
  payment_issue: "付款或结算问题",
  other: "其他",
};

type DisputeListResponse = PaginatedResponse<DisputeOut> | DisputeOut[];

function normalizeDisputeList(data: DisputeListResponse): DisputeOut[] {
  return Array.isArray(data) ? data : data.items;
}

function statusClass(status: string): string {
  if (status === "open") return "bg-amber-50 text-amber-800 border-amber-100";
  if (status === "processing") return "bg-blue-50 text-blue-700 border-blue-100";
  if (status === "resolved_refunded") return "bg-purple-50 text-purple-700 border-purple-100";
  if (status === "resolved_released") return "bg-green-50 text-green-700 border-green-100";
  return "bg-gray-50 text-gray-700 border-gray-100";
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function OpsDisputes() {
  const location = useLocation();
  const token = getAccessToken();
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<DisputeOut[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DisputeDetailOut | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<DisputeAction>("assign");
  const [reason, setReason] = useState("");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionTone, setActionTone] = useState<"success" | "error">("success");
  const [submitting, setSubmitting] = useState(false);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    setForbidden(false);
    try {
      const query = new URLSearchParams({ page: "1", page_size: "20" });
      if (status) query.set("status", status);
      const data = await apiFetchJson<DisputeListResponse>(`/ops/disputes?${query.toString()}`);
      const list = normalizeDisputeList(data);
      setItems(list);
      setSelectedId((current) => current ?? list[0]?.id ?? null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setForbidden(true);
      } else {
        setError(e instanceof ApiError ? e.message : "加载争议列表失败");
      }
    } finally {
      setLoadingList(false);
    }
  }, [status]);

  const loadDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    setError(null);
    setForbidden(false);
    try {
      const data = await apiFetchJson<DisputeDetailOut>(`/ops/disputes/${id}`);
      setDetail(data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setForbidden(true);
      } else {
        setError(e instanceof ApiError ? e.message : "加载争议详情失败");
      }
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (token) void loadList();
  }, [loadList, token]);

  useEffect(() => {
    if (token && selectedId) void loadDetail(selectedId);
    if (!selectedId) setDetail(null);
  }, [loadDetail, selectedId, token]);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  );

  const submitAction = async () => {
    if (!detail) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      setActionTone("error");
      setActionMessage("请填写处理原因");
      return;
    }

    const payload: DisputeActionRequest = { action, reason: trimmed };
    setSubmitting(true);
    setActionMessage(null);
    try {
      const updated = await apiFetchJson<DisputeDetailOut>(
        `/ops/disputes/${detail.id}/actions`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );
      setDetail(updated);
      setReason("");
      setActionTone("success");
      setActionMessage("处理已提交，详情已刷新。");
      await loadList();
    } catch (e) {
      setActionTone("error");
      if (e instanceof ApiError && e.status === 403) {
        setActionMessage("无运营权限，无法处理争议。");
      } else if (e instanceof ApiError && e.status === 409) {
        setActionMessage("争议或付款单状态已变化，请刷新后重试。");
      } else {
        setActionMessage(e instanceof ApiError ? e.message : "处理提交失败");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (forbidden) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">运营争议处理</h1>
        <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-3 text-sm">
          无权限访问运营争议处理。
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">运营争议处理</h1>
          <p className="text-sm text-gray-500 mt-1">列表、详情和最小处理动作。</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setSelectedId(null);
            }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void loadList()}
            disabled={loadingList}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 inline-flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loadingList ? "animate-spin" : ""}`} />
            刷新
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-[360px_1fr] gap-6">
        <section className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">争议列表</h2>
            {loadingList && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          </div>
          <div className="divide-y divide-gray-100">
            {items.length > 0 ? (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(item.id);
                    setActionMessage(null);
                  }}
                  className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                    selectedId === item.id ? "bg-blue-50/60" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs text-gray-500 truncate">{item.id}</span>
                    <span
                      className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${statusClass(item.status)}`}
                    >
                      {STATUS_LABEL[item.status] ?? item.status}
                    </span>
                  </div>
                  <div className="mt-2 text-sm font-medium text-gray-900">
                    {REASON_LABEL[item.reason_code] ?? item.reason_code}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">{fmtDate(item.created_at)}</div>
                </button>
              ))
            ) : (
              <div className="p-6 text-sm text-gray-500">暂无争议</div>
            )}
          </div>
        </section>

        <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 min-h-[520px]">
          {loadingDetail && (
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              加载详情中...
            </div>
          )}

          {!loadingDetail && !detail && (
            <div className="text-sm text-gray-500">
              {selectedItem ? "请选择一条争议查看详情" : "暂无可查看的争议"}
            </div>
          )}

          {!loadingDetail && detail && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">争议详情</h2>
                  <p className="font-mono text-xs text-gray-500 mt-1 break-all">{detail.id}</p>
                </div>
                <span
                  className={`w-fit text-xs px-2.5 py-1 rounded-full border ${statusClass(detail.status)}`}
                >
                  {STATUS_LABEL[detail.status] ?? detail.status}
                </span>
              </div>

              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <Info label="原因" value={REASON_LABEL[detail.reason_code] ?? detail.reason_code} />
                <Info label="处理人" value={detail.operator_id ?? "-"} mono />
                <Info label="学生" value={detail.student_name ?? detail.student_id} />
                <Info label="老师" value={detail.teacher_name ?? detail.teacher_id} />
                <Info label="付款单状态" value={detail.payment_order.status} />
                <Info label="付款总额" value={formatVndFull(detail.payment_order.gross_amount)} />
                <Info label="held_until" value={fmtDate(detail.payment_order.held_until)} />
                <Info label="创建时间" value={fmtDate(detail.created_at)} />
              </div>

              <div className="text-sm">
                <div className="font-semibold text-gray-900 mb-2">课程上下文</div>
                <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 space-y-2">
                  <Info label="课程 ID" value={detail.lesson.id} mono />
                  <Info label="课程状态" value={detail.lesson.status} />
                  <Info
                    label="时间"
                    value={`${formatLessonScheduled(detail.lesson.scheduled_at).date} ${formatLessonScheduled(detail.lesson.scheduled_at).time}`}
                  />
                  <Info label="主题" value={detail.lesson.topic ?? "课程"} />
                </div>
              </div>

              <div className="text-sm">
                <div className="font-semibold text-gray-900 mb-2">争议说明</div>
                <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 whitespace-pre-wrap text-gray-700">
                  {detail.description || "-"}
                </div>
              </div>

              <div className="text-sm">
                <div className="font-semibold text-gray-900 mb-2">事件历史</div>
                <div className="border border-gray-100 rounded-xl divide-y divide-gray-100">
                  {detail.events.length > 0 ? (
                    detail.events.map((event) => (
                      <div key={event.id} className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="font-medium text-gray-900">{event.type}</span>
                          <span className="text-xs text-gray-500">{fmtDate(event.created_at)}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {event.from_status ?? "-"} {"->"} {event.to_status ?? "-"}
                        </div>
                        {event.note && <div className="text-gray-700 mt-2">{event.note}</div>}
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-gray-500">暂无事件</div>
                  )}
                </div>
              </div>

              <div className="border border-gray-100 rounded-xl p-4 space-y-3">
                <div className="font-semibold text-gray-900">处理动作</div>
                <div className="grid sm:grid-cols-[220px_1fr] gap-3">
                  <select
                    value={action}
                    onChange={(e) => setAction(e.target.value as DisputeAction)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                  >
                    {ACTION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={1000}
                    placeholder="处理原因"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
                {actionMessage && (
                  <div
                    className={`text-sm rounded-lg px-3 py-2 border ${
                      actionTone === "success"
                        ? "text-green-700 bg-green-50 border-green-100"
                        : "text-red-700 bg-red-50 border-red-100"
                    }`}
                  >
                    {actionMessage}
                  </div>
                )}
                <button
                  type="button"
                  onClick={submitAction}
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-sm font-bold inline-flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  提交处理
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-b border-gray-100 py-2 last:border-0">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className={`text-gray-900 text-right break-all ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </span>
    </div>
  );
}
