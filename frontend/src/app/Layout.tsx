import { Outlet, Link, useLocation } from "react-router";
import { Menu, Globe, Bell, LogOut, ChevronDown, X, GraduationCap, BookOpen, UserCircle, CreditCard } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { getAccessToken } from "./lib/api";
import { apiFetchJson, ApiError } from "./lib/http";
import { clearAuthTokens } from "./lib/authStorage";
import type { UserOut } from "./types/api";

export function Layout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const [me, setMe] = useState<UserOut | null>(null);

  // 用户下拉菜单
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 开通教师弹窗
  const [showTeacherModal, setShowTeacherModal] = useState(false);

  useEffect(() => {
    const t = getAccessToken();
    if (!t) {
      setMe(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const u = await apiFetchJson<UserOut>("/auth/me");
        if (!cancelled) setMe(u);
      } catch {
        if (!cancelled) setMe(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [dropdownOpen]);

  function logout() {
    clearAuthTokens();
    setMe(null);
    setDropdownOpen(false);
  }

  const isTeacher = me?.roles?.includes("teacher") ?? false;

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center gap-2">
                <div className="bg-blue-600 p-2 rounded-lg">
                  <Globe className="h-5 w-5 text-white" />
                </div>
                <span className="font-bold text-xl text-gray-900 tracking-tight">
                  CNVN <span className="text-blue-600">中越通</span>
                </span>
              </Link>
            </div>

            {/* 桌面端导航 */}
            <nav className="hidden md:flex space-x-8">
              <Link
                to="/teachers"
                className="text-gray-600 hover:text-blue-600 font-medium transition-colors"
              >
                找老师 (Tìm giáo viên)
              </Link>
              {me && (
                <Link
                  to="/dashboard/student"
                  className="text-gray-600 hover:text-blue-600 font-medium transition-colors"
                >
                  我的学习 (Học tập)
                </Link>
              )}
              {me && (
                <Link
                  to="/wallet"
                  className="text-gray-600 hover:text-blue-600 font-medium transition-colors"
                >
                  钱包 (Ví)
                </Link>
              )}
              {me && isTeacher && (
                <Link
                  to="/dashboard/teacher"
                  className="text-gray-600 hover:text-blue-600 font-medium transition-colors"
                >
                  教师中心 (Trung tâm GV)
                </Link>
              )}
            </nav>

            {/* 桌面端用户区域 */}
            <div className="hidden md:flex items-center gap-4">
              <button type="button" className="text-gray-500 hover:text-blue-600 p-2">
                <Bell className="h-5 w-5" />
              </button>
              {me ? (
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-full transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                      {me.full_name.slice(0, 1).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-gray-700 max-w-[8rem] truncate">
                      {me.full_name}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
                  </button>

                  {dropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                      <Link
                        to="/dashboard/student"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <BookOpen className="w-4 h-4 text-gray-400" />
                        我的学习
                      </Link>
                      {isTeacher ? (
                        <>
                          <Link
                            to="/dashboard/teacher"
                            onClick={() => setDropdownOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <GraduationCap className="w-4 h-4 text-gray-400" />
                            教师中心
                          </Link>
                          <Link
                            to="/payouts"
                            onClick={() => setDropdownOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <CreditCard className="w-4 h-4 text-gray-400" />
                            出款单
                          </Link>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setDropdownOpen(false); setShowTeacherModal(true); }}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors w-full"
                        >
                          <GraduationCap className="w-4 h-4 text-blue-500" />
                          成为教师
                        </button>
                      )}
                      <div className="border-t border-gray-100 my-1" />
                      <button
                        type="button"
                        onClick={logout}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors w-full"
                      >
                        <LogOut className="w-4 h-4 text-gray-400" />
                        退出登录
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    to="/login"
                    className="text-sm font-medium text-gray-700 hover:text-blue-600 px-3 py-2"
                  >
                    登录
                  </Link>
                  <Link
                    to="/register"
                    className="text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-full hover:bg-blue-700"
                  >
                    注册
                  </Link>
                </div>
              )}
            </div>

            {/* 移动端汉堡按钮 */}
            <div className="md:hidden flex items-center">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="text-gray-500 hover:text-blue-600 p-2"
              >
                <Menu className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>

        {/* 移动端导航 */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-gray-100 px-4 pt-2 pb-4 space-y-1 shadow-lg absolute w-full z-40">
            <Link
              to="/teachers"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"
            >
              找老师
            </Link>
            {me && (
              <Link
                to="/dashboard/student"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"
              >
                我的学习
              </Link>
            )}
            {me && (
              <Link
                to="/wallet"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"
              >
                钱包
              </Link>
            )}
            {me && isTeacher && (
              <Link
                to="/dashboard/teacher"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"
              >
                教师中心
              </Link>
            )}
            {me && isTeacher && (
              <Link
                to="/payouts"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"
              >
                出款单
              </Link>
            )}
            {!me ? (
              <>
                <Link to="/login" onClick={() => setIsMobileMenuOpen(false)} className="block px-3 py-2 text-blue-600 font-medium">
                  登录
                </Link>
                <Link to="/register" onClick={() => setIsMobileMenuOpen(false)} className="block px-3 py-2 text-blue-600 font-medium">
                  注册
                </Link>
              </>
            ) : (
              <>
                {!isTeacher && (
                  <button
                    type="button"
                    onClick={() => { setIsMobileMenuOpen(false); setShowTeacherModal(true); }}
                    className="block w-full text-left px-3 py-2 text-blue-600 font-medium"
                  >
                    成为教师
                  </button>
                )}
                <button type="button" onClick={() => { logout(); setIsMobileMenuOpen(false); }} className="block px-3 py-2 text-gray-700 w-full text-left">
                  退出登录
                </button>
              </>
            )}
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="bg-blue-600 p-1.5 rounded-lg">
                <Globe className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-xl tracking-tight">
                CNVN <span className="text-blue-400">中越通</span>
              </span>
            </div>
            <p className="text-gray-400 text-sm">
              专为越南市场打造的中文学习双边撮合平台。轻松找好老师，快乐学中文。
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-lg mb-4">关于我们</h3>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li>
                <Link to="#" className="hover:text-white transition-colors">
                  了解 CNVN
                </Link>
              </li>
              <li>
                <Link to="#" className="hover:text-white transition-colors">
                  服务条款
                </Link>
              </li>
              <li>
                <Link to="#" className="hover:text-white transition-colors">
                  隐私政策
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-lg mb-4">学生指南</h3>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li>
                <Link to="/teachers" className="hover:text-white transition-colors">
                  找老师
                </Link>
              </li>
              <li>
                <Link to="#" className="hover:text-white transition-colors">
                  如何预约
                </Link>
              </li>
              <li>
                <Link to="#" className="hover:text-white transition-colors">
                  常见问题
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-lg mb-4">成为老师</h3>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li>
                <Link to="/register" className="hover:text-white transition-colors">
                  注册教师
                </Link>
              </li>
              <li>
                <Link to="#" className="hover:text-white transition-colors">
                  教学指南
                </Link>
              </li>
              <li>
                <Link to="#" className="hover:text-white transition-colors">
                  收费说明
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pt-8 border-t border-gray-800 text-center text-gray-500 text-sm">
          &copy; 2026 CNVN 中越通. All rights reserved.
        </div>
      </footer>

      {/* 开通教师弹窗 */}
      {showTeacherModal && (
        <BecomeTeacherModal
          onClose={() => setShowTeacherModal(false)}
          onSuccess={async () => {
            // 刷新 me 状态
            try {
              const u = await apiFetchJson<UserOut>("/auth/me");
              setMe(u);
            } catch { /* ignore */ }
            setShowTeacherModal(false);
          }}
        />
      )}
    </div>
  );
}

/** 开通教师身份弹窗 */
function BecomeTeacherModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
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
      onSuccess();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "开通失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">开通教师身份</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="p-6 space-y-4">
          {err && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{err}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">教学标题 *</label>
            <input
              type="text"
              required
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
                required
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
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-700 font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "提交中…" : "申请成为教师"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
