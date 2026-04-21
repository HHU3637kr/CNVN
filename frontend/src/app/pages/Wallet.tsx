/**
 * 钱包 / 充值 / VietQR / 线下转账占位 — spec/03-功能实现/20260421-2100-支付前端与VietQR验证-spike/plan.md
 */
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { ArrowLeft, CreditCard, Loader2, QrCode, Upload } from "lucide-react";
import { getAccessToken } from "../lib/api";
import { apiFetchJson, ApiError } from "../lib/http";
import type { PaginatedResponse, TransactionOut, WalletOut } from "../types/api";
import { formatVndFull } from "../lib/format";

const PENDING_LS_KEY = "cnvn_spike_pending_offline_transfers_v1";

type PendingOffline = {
  id: string;
  created_at: string;
  note: string;
  file_name?: string;
};

function loadPending(): PendingOffline[] {
  try {
    const raw = localStorage.getItem(PENDING_LS_KEY);
    if (!raw) return [];
    const j = JSON.parse(raw) as unknown;
    return Array.isArray(j) ? (j as PendingOffline[]) : [];
  } catch {
    return [];
  }
}

function savePending(items: PendingOffline[]) {
  localStorage.setItem(PENDING_LS_KEY, JSON.stringify(items));
}

export function Wallet() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = getAccessToken();

  const [wallet, setWallet] = useState<WalletOut | null>(null);
  const [txs, setTxs] = useState<TransactionOut[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [topupAmount, setTopupAmount] = useState("500000");
  const [topupBusy, setTopupBusy] = useState(false);
  const [topupErr, setTopupErr] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingOffline[]>([]);
  const [offlineNote, setOfflineNote] = useState("");
  const [offlineFileName, setOfflineFileName] = useState("");
  const [orderIdInput, setOrderIdInput] = useState("");

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoadErr(null);
    try {
      const [w, t] = await Promise.all([
        apiFetchJson<WalletOut>("/wallet"),
        apiFetchJson<PaginatedResponse<TransactionOut>>("/wallet/transactions?page=1&page_size=30"),
      ]);
      setWallet(w);
      setTxs(t.items);
    } catch (e) {
      setLoadErr(e instanceof ApiError ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setPending(loadPending());
    void refresh();
  }, [token, refresh]);

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  async function onTopup(e: FormEvent) {
    e.preventDefault();
    const n = Number(topupAmount.replace(/\s/g, ""));
    if (!Number.isFinite(n) || n <= 0) {
      setTopupErr("请输入正整数金额（VND）");
      return;
    }
    setTopupBusy(true);
    setTopupErr(null);
    try {
      const w = await apiFetchJson<WalletOut>("/wallet/topup", {
        method: "POST",
        body: JSON.stringify({ amount: Math.floor(n) }),
      });
      setWallet(w);
      await refresh();
    } catch (err) {
      setTopupErr(err instanceof ApiError ? err.message : "充值失败");
    } finally {
      setTopupBusy(false);
    }
  }

  function addPendingOffline(e: FormEvent) {
    e.preventDefault();
    const note = offlineNote.trim();
    if (!note) return;
    const row: PendingOffline = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      note,
      file_name: offlineFileName.trim() || undefined,
    };
    const next = [row, ...pending];
    setPending(next);
    savePending(next);
    setOfflineNote("");
    setOfflineFileName("");
  }

  function mockOpsConfirm(id: string) {
    const next = pending.filter((p) => p.id !== id);
    setPending(next);
    savePending(next);
  }

  function goPaymentOrder(e: FormEvent) {
    e.preventDefault();
    const id = orderIdInput.trim();
    if (!id) return;
    navigate(`/payments/orders/${id}`);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        to="/dashboard/student"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        返回学习中心
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-2">
        <CreditCard className="w-7 h-7 text-blue-600" />
        钱包
      </h1>
      <p className="text-gray-600 text-sm mb-8">
        Mock 充值走平台接口；越南本地转账请扫 VietQR 或网银转账至下方账户（到账由运营人工核对）。
      </p>

      {loadErr && (
        <div className="mb-6 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">{loadErr}</div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          加载中…
        </div>
      ) : (
        <div className="space-y-8">
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">当前余额</h2>
            <p className="text-3xl font-bold text-blue-900">{wallet ? formatVndFull(wallet.balance) : "—"}</p>
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-blue-600" />
              越南本地转账（VietQR）
            </h2>
            <p className="text-sm text-gray-600">
              银行：VietinBank（越南工商银行） · 代码 970415 · napas247 / VietQR
            </p>
            <div className="flex justify-center bg-gray-50 rounded-xl p-4 border border-gray-100">
              <img
                src="/payment/vietqr.png"
                alt="VietQR 收款码"
                className="max-w-[280px] w-full h-auto rounded-lg shadow"
              />
            </div>
            <dl className="text-sm space-y-1 text-gray-800">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">账户号码</dt>
                <dd className="font-mono">108881067645</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">银行卡号</dt>
                <dd className="font-mono">9704150267273129</dd>
              </div>
            </dl>
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              转账后请在下方登记凭证（截图文件名或备注）；运营核对后会在系统内处理。MVP 阶段为人工对账。
            </p>
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Upload className="w-5 h-5 text-gray-700" />
              线下转账登记（占位）
            </h2>
            <form onSubmit={addPendingOffline} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">说明（必填）</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={offlineNote}
                  onChange={(e) => setOfflineNote(e.target.value)}
                  placeholder="例如：已转 500000，备注订单号 xxx"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">凭证文件名（可选）</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={offlineFileName}
                  onChange={(e) => setOfflineFileName(e.target.value)}
                  placeholder="例如：IMG_20260421.jpg"
                />
              </div>
              <button
                type="submit"
                className="bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800"
              >
                加入待核对列表
              </button>
            </form>
            {pending.length > 0 ? (
              <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
                {pending.map((p) => (
                  <li key={p.id} className="px-4 py-3 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <div className="text-gray-900">{p.note}</div>
                      {p.file_name && <div className="text-gray-500 text-xs">文件：{p.file_name}</div>}
                      <div className="text-gray-400 text-xs">{new Date(p.created_at).toLocaleString("zh-CN")}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded">待核对</span>
                      {import.meta.env.DEV && (
                        <button
                          type="button"
                          onClick={() => mockOpsConfirm(p.id)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          [dev] 模拟已核对
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">暂无待核对登记</p>
            )}
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Mock 充值（开发）</h2>
            <form onSubmit={onTopup} className="flex flex-wrap gap-2 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">金额（VND）</label>
                <input
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-40"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={topupBusy}
                className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {topupBusy ? "提交中…" : "充值"}
              </button>
            </form>
            {topupErr && <p className="text-sm text-red-600">{topupErr}</p>}
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">付款单查询</h2>
            <form onSubmit={goPaymentOrder} className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-medium text-gray-500 mb-1">付款单 UUID</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
                  value={orderIdInput}
                  onChange={(e) => setOrderIdInput(e.target.value)}
                  placeholder="从后端或预约流程获取"
                />
              </div>
              <button type="submit" className="bg-gray-100 text-gray-900 text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50">
                打开详情
              </button>
            </form>
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">钱包流水</h2>
            {txs.length === 0 ? (
              <p className="text-sm text-gray-500">暂无流水</p>
            ) : (
              <ul className="divide-y divide-gray-100 text-sm">
                {txs.map((t) => (
                  <li key={t.id} className="py-3 flex justify-between gap-4">
                    <div>
                      <div className="font-medium text-gray-900">{t.type}</div>
                      {t.description && <div className="text-gray-500 text-xs">{t.description}</div>}
                      <div className="text-gray-400 text-xs">{new Date(t.created_at).toLocaleString("zh-CN")}</div>
                    </div>
                    <div className={`font-mono ${t.amount >= 0 ? "text-green-700" : "text-red-600"}`}>
                      {t.amount >= 0 ? "+" : ""}
                      {formatVndFull(t.amount)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
