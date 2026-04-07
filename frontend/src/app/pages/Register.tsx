/**
 * 注册页面 — 支持学生/教师身份选择
 * spec/03-功能实现/20260406-0030-教师中心访问控制/plan.md §3
 */
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { apiFetchJson, ApiError } from "../lib/http";
import { setAuthTokens } from "../lib/authStorage";
import type { UserOut, TokenResponse } from "../types/api";

type Role = "student" | "teacher";

export function Register() {
  const navigate = useNavigate();

  // 基础字段
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("student");

  // 教师档案字段
  const [title, setTitle] = useState("");
  const [about, setAbout] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [teacherType, setTeacherType] = useState("professional");
  const [specialties, setSpecialties] = useState("");

  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      // 步骤 1：注册基础账号
      await apiFetchJson<UserOut>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, full_name: fullName }),
        auth: false,
      });

      // 步骤 2：如果选择了教师身份，登录后自动开通
      if (role === "teacher") {
        try {
          const loginData = await apiFetchJson<TokenResponse>("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
            auth: false,
          });
          setAuthTokens(loginData.access_token, loginData.refresh_token);

          await apiFetchJson<UserOut>("/auth/become-teacher", {
            method: "POST",
            body: JSON.stringify({
              title,
              about: about || undefined,
              hourly_rate: Number(hourlyRate),
              teacher_type: teacherType,
              specialties: specialties ? specialties.split(",").map((s) => s.trim()) : undefined,
            }),
          });

          // 教师注册成功，直接进入教师中心
          navigate("/dashboard/teacher", { replace: true });
          return;
        } catch {
          // 开通教师失败，提示用户登录后重试
          navigate("/login", {
            replace: true,
            state: { registered: true, teacherApplyFailed: true },
          });
          return;
        }
      }

      // 学生注册成功，跳转登录页
      navigate("/login", { replace: true, state: { registered: true } });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "注册失败");
    } finally {
      setLoading(false);
    }
  }

  const isTeacherMode = role === "teacher";

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">注册</h1>
      <p className="text-gray-600 text-sm mb-8">
        已有账号？{" "}
        <Link to="/login" className="text-blue-600 hover:underline">
          登录
        </Link>
      </p>

      <form onSubmit={onSubmit} className="space-y-6 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        {err && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{err}</div>
        )}

        {/* 身份选择 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">我是</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setRole("student")}
              className={`px-4 py-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                role === "student"
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              学生
            </button>
            <button
              type="button"
              onClick={() => setRole("teacher")}
              className={`px-4 py-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                role === "teacher"
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              教师
            </button>
          </div>
        </div>

        {/* 基础字段 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
          <input
            type="text"
            required
            maxLength={100}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
            className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
            className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        {/* 教师档案字段 */}
        {isTeacherMode && (
          <div className="space-y-4 pt-2 border-t border-gray-100">
            <p className="text-sm font-medium text-gray-700">教师档案信息</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">教学标题 *</label>
              <input
                type="text"
                required={isTeacherMode}
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：专业汉语教师"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">个人简介</label>
              <textarea
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                rows={3}
                placeholder="介绍一下您的教学经验和方法..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">时薪 (VND) *</label>
                <input
                  type="number"
                  required={isTeacherMode}
                  min={1}
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder="150000"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">教师类型 *</label>
                <select
                  value={teacherType}
                  onChange={(e) => setTeacherType(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="professional">专业教师</option>
                  <option value="community">社区辅导员</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">专长（逗号分隔）</label>
              <input
                type="text"
                value={specialties}
                onChange={(e) => setSpecialties(e.target.value)}
                placeholder="HSK, 口语, 商务汉语"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "提交中…" : isTeacherMode ? "注册教师" : "注册"}
        </button>
      </form>
    </div>
  );
}
