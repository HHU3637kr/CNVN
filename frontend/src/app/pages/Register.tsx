/**
 * 最小注册 — spec/03-功能实现/20260404-1400-前端对接真实API/plan.md §5 步骤 6
 */
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { apiFetchJson, ApiError } from "../lib/http";
import type { UserOut } from "../types/api";

export function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await apiFetchJson<UserOut>(
        "/auth/register",
        {
          method: "POST",
          body: JSON.stringify({ email, password, full_name: fullName }),
          auth: false,
        }
      );
      navigate("/login", { replace: true, state: { registered: true } });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "注册失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">注册</h1>
      <p className="text-gray-600 text-sm mb-8">
        已有账号？{" "}
        <Link to="/login" className="text-blue-600 hover:underline">
          登录
        </Link>
      </p>

      <form onSubmit={onSubmit} className="space-y-4 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        {err && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{err}</div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
          <input
            type="text"
            required
            maxLength={100}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">密码（至少 8 位）</label>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "提交中…" : "注册"}
        </button>
      </form>
    </div>
  );
}
