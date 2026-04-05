import { Outlet, Link, useLocation } from "react-router";
import { Menu, Globe, Bell, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { getAccessToken } from "./lib/api";
import { apiFetchJson } from "./lib/http";
import { clearAuthTokens } from "./lib/authStorage";
import type { UserOut } from "./types/api";

export function Layout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const [me, setMe] = useState<UserOut | null>(null);

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

  function logout() {
    clearAuthTokens();
    setMe(null);
  }

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

            <nav className="hidden md:flex space-x-8">
              <Link
                to="/teachers"
                className="text-gray-600 hover:text-blue-600 font-medium transition-colors"
              >
                找老师 (Tìm giáo viên)
              </Link>
              <Link
                to="/dashboard/student"
                className="text-gray-600 hover:text-blue-600 font-medium transition-colors"
              >
                我的学习 (Học tập)
              </Link>
              <Link
                to="/dashboard/teacher"
                className="text-gray-600 hover:text-blue-600 font-medium transition-colors"
              >
                教师中心 (Trung tâm GV)
              </Link>
            </nav>

            <div className="hidden md:flex items-center gap-4">
              <button type="button" className="text-gray-500 hover:text-blue-600 p-2">
                <Bell className="h-5 w-5" />
              </button>
              {me ? (
                <div className="flex items-center gap-3">
                  <Link
                    to="/dashboard/student"
                    className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-full transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                      {me.full_name.slice(0, 1).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-gray-700 max-w-[8rem] truncate">
                      {me.full_name}
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={logout}
                    className="text-gray-500 hover:text-red-600 p-2"
                    title="退出"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
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

        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-gray-100 px-4 pt-2 pb-4 space-y-1 shadow-lg absolute w-full">
            <Link
              to="/teachers"
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"
            >
              找老师
            </Link>
            <Link
              to="/dashboard/student"
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"
            >
              我的学习
            </Link>
            <Link
              to="/dashboard/teacher"
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"
            >
              教师中心
            </Link>
            {!me ? (
              <>
                <Link to="/login" className="block px-3 py-2 text-blue-600 font-medium">
                  登录
                </Link>
                <Link to="/register" className="block px-3 py-2 text-blue-600 font-medium">
                  注册
                </Link>
              </>
            ) : (
              <button type="button" onClick={logout} className="block px-3 py-2 text-gray-700 w-full text-left">
                退出登录
              </button>
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
                <Link to="/dashboard/teacher" className="hover:text-white transition-colors">
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
    </div>
  );
}
