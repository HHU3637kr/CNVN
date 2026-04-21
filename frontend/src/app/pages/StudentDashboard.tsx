/**
 * 学生仪表盘 — spec/03-功能实现/20260404-1400-前端对接真实API/plan.md §5 步骤 5
 */
import { useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router";
import { Video, Calendar, Clock, CreditCard, ChevronRight, CheckCircle2, FileText } from "lucide-react";
import { getAccessToken } from "../lib/api";
import { apiFetchJson, ApiError } from "../lib/http";
import type { LessonListItem, PaginatedResponse, UserOut, WalletOut } from "../types/api";
import { formatLessonScheduled, formatVndFull } from "../lib/format";
import { TeacherAvatar } from "../components/TeacherAvatar";

export function StudentDashboard() {
  const location = useLocation();
  const token = getAccessToken();

  const [me, setMe] = useState<UserOut | null>(null);
  const [upcoming, setUpcoming] = useState<LessonListItem[]>([]);
  const [past, setPast] = useState<LessonListItem[]>([]);
  const [wallet, setWallet] = useState<WalletOut | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setLoadErr(null);
      try {
        const [u, up, pa, w] = await Promise.all([
          apiFetchJson<UserOut>("/auth/me"),
          apiFetchJson<PaginatedResponse<LessonListItem>>(
            "/lessons?role=student&upcoming=true&page_size=20"
          ),
          apiFetchJson<PaginatedResponse<LessonListItem>>(
            "/lessons?role=student&status=completed&page_size=20"
          ),
          apiFetchJson<WalletOut>("/wallet"),
        ]);
        if (!cancelled) {
          setMe(u);
          setUpcoming(up.items);
          setPast(pa.items);
          setWallet(w);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadErr(e instanceof ApiError ? e.message : "加载失败");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const name = me?.full_name ?? "同学";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">欢迎回来，{name}！</h1>
        <p className="text-gray-600 mt-2">这里是您的学习中心。</p>
        {loadErr && (
          <p className="text-sm text-red-600 mt-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2 inline-block">
            {loadErr}
          </p>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" /> 即将开始的课程
              </h2>
            </div>

            <div className="p-6">
              {upcoming.length > 0 ? (
                upcoming.map((lesson) => {
                  const { date, time } = formatLessonScheduled(lesson.scheduled_at);
                  const teacherName = lesson.teacher_name || "教师";
                  return (
                    <div
                      key={lesson.id}
                      className="bg-blue-50 border border-blue-100 rounded-xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 last:mb-0"
                    >
                      <div className="flex gap-4 items-center">
                        <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white shadow-sm shrink-0">
                          <TeacherAvatar src={null} label={teacherName} />
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 text-lg mb-1">
                            {lesson.topic || "课程"}
                          </div>
                          <div className="text-sm text-gray-600 flex items-center gap-2 flex-wrap">
                            <span>{teacherName}老师</span>
                            <span className="text-gray-300">|</span>
                            <span className="flex items-center gap-1 font-medium text-blue-700">
                              <Clock className="w-4 h-4" /> {date} {time}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="w-full sm:w-auto mt-4 sm:mt-0">
                        <Link
                          to={`/classroom/${lesson.id}`}
                          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-600/20 animate-pulse"
                        >
                          <Video className="w-5 h-5" /> 进入教室
                        </Link>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-10">
                  <p className="text-gray-500 mb-4">暂无即将开始的课程</p>
                  <Link to="/teachers" className="text-blue-600 font-medium hover:underline">
                    去寻找合适的老师 →
                  </Link>
                </div>
              )}
            </div>
          </section>

          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-600" /> 学习记录
              </h2>
              <button type="button" className="text-sm text-blue-600 hover:underline">
                查看全部
              </button>
            </div>

            <div className="divide-y divide-gray-100">
              {past.length > 0 ? (
                past.map((lesson) => {
                  const { date, time } = formatLessonScheduled(lesson.scheduled_at);
                  return (
                    <div
                      key={lesson.id}
                      className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-gray-50 transition-colors"
                    >
                      <div>
                        <div className="font-bold text-gray-900 mb-1">{lesson.topic || "课程"}</div>
                        <div className="text-sm text-gray-500 flex items-center gap-3 flex-wrap">
                          <span>{lesson.teacher_name || "教师"}</span>
                          <span>
                            {date} {time}
                          </span>
                          <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-0.5 rounded text-xs font-medium">
                            <CheckCircle2 className="w-3 h-3" /> 已完成
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-3 w-full sm:w-auto">
                        <button
                          type="button"
                          className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-white hover:shadow-sm transition-all flex-1 sm:flex-none"
                        >
                          去评价
                        </button>
                        <Link
                          to="/teachers"
                          className="px-4 py-2 border border-blue-200 bg-blue-50 rounded-lg text-sm font-medium text-blue-700 hover:bg-blue-100 transition-all flex-1 sm:flex-none text-center"
                        >
                          再次预约
                        </Link>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-gray-500 text-sm">暂无已完成课程</div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section className="bg-gradient-to-br from-blue-900 to-blue-800 rounded-2xl shadow-lg p-6 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-20">
              <CreditCard className="w-24 h-24" />
            </div>
            <h2 className="text-lg font-medium text-blue-100 mb-1 relative z-10">账户余额</h2>
            <div className="text-3xl font-bold mb-6 relative z-10">
              {wallet ? formatVndFull(wallet.balance) : "—"}
            </div>

            <div className="flex gap-3 relative z-10">
              <Link
                to="/wallet"
                className="flex-1 text-center bg-white text-blue-900 font-bold py-2.5 rounded-xl hover:bg-blue-50 transition-colors"
              >
                充值
              </Link>
              <Link
                to="/wallet"
                className="flex-1 text-center bg-blue-700 text-white font-bold py-2.5 rounded-xl hover:bg-blue-600 transition-colors border border-blue-600"
              >
                明细
              </Link>
            </div>
          </section>

          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">快捷操作</h2>
            <div className="space-y-2">
              <Link
                to="/teachers"
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                <span className="font-medium text-gray-700">寻找新老师</span>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600" />
              </Link>
              <button
                type="button"
                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                <span className="font-medium text-gray-700">我的收藏夹</span>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600" />
              </button>
              <button
                type="button"
                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                <span className="font-medium text-gray-700">联系平台客服</span>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600" />
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
