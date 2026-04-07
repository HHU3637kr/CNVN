/**
 * 教师仪表盘 — spec/03-功能实现/20260404-1400-前端对接真实API/plan.md §5 步骤 5
 */
import { useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router";
import {
  BarChart3,
  Calendar,
  Clock,
  DollarSign,
  Settings,
  Users,
  Video,
} from "lucide-react";
import { getAccessToken } from "../lib/api";
import { apiFetchJson, ApiError } from "../lib/http";
import type { LessonListItem, PaginatedResponse, UserOut, WalletOut } from "../types/api";
import { formatLessonScheduled, formatVndFull } from "../lib/format";
import { TeacherAvatar } from "../components/TeacherAvatar";

export function TeacherDashboard() {
  const location = useLocation();
  const token = getAccessToken();

  const [me, setMe] = useState<UserOut | null>(null);
  const [upcoming, setUpcoming] = useState<LessonListItem[]>([]);
  const [wallet, setWallet] = useState<WalletOut | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setLoadErr(null);
      try {
        const [u, up, w] = await Promise.all([
          apiFetchJson<UserOut>("/auth/me"),
          apiFetchJson<PaginatedResponse<LessonListItem>>(
            "/lessons?role=teacher&upcoming=true&page_size=20"
          ),
          apiFetchJson<WalletOut>("/wallet"),
        ]);
        if (!cancelled) {
          setMe(u);
          setUpcoming(up.items);
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

  // 非教师用户重定向到学生中心
  if (me && !me.roles.includes("teacher")) {
    return <Navigate to="/dashboard/student" replace />;
  }

  const stats = [
    {
      label: "钱包余额",
      value: wallet ? formatVndFull(wallet.balance) : "—",
      icon: DollarSign,
      color: "text-green-600",
      bg: "bg-green-100",
    },
    {
      label: "待上课程",
      value: `${upcoming.length} 节`,
      icon: Video,
      color: "text-blue-600",
      bg: "bg-blue-100",
    },
    {
      label: "综合评分",
      value: "—",
      icon: BarChart3,
      color: "text-yellow-600",
      bg: "bg-yellow-100",
    },
    {
      label: "当前用户",
      value: me?.full_name?.slice(0, 8) ?? "—",
      icon: Users,
      color: "text-purple-600",
      bg: "bg-purple-100",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">教师控制台</h1>
          <p className="text-gray-600 mt-2">管理您的课程、收入和学生。</p>
          {loadErr && (
            <p className="text-sm text-red-600 mt-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2 inline-block">
              {loadErr}
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
          >
            <Settings className="w-4 h-4" /> 档案设置
          </button>
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
          >
            <Calendar className="w-4 h-4" /> 排课日历
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, idx) => (
          <div
            key={idx}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-4"
          >
            <div className={`w-14 h-14 rounded-xl ${stat.bg} flex items-center justify-center flex-shrink-0`}>
              <stat.icon className={`w-7 h-7 ${stat.color}`} />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">{stat.label}</div>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" /> 接下来的课程
              </h2>
            </div>

            <div className="divide-y divide-gray-100">
              {upcoming.length > 0 ? (
                upcoming.map((cls) => {
                  const studentName = cls.student_name || "学生";
                  const { date, time } = formatLessonScheduled(cls.scheduled_at);
                  return (
                    <div
                      key={cls.id}
                      className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full overflow-hidden shrink-0">
                          <TeacherAvatar src={null} label={studentName} />
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 mb-1">{cls.topic || "课程"}</div>
                          <div className="text-sm text-gray-500 flex items-center gap-3 flex-wrap">
                            <span>学生: {studentName}</span>
                            <span>
                              {date} {time}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3 w-full sm:w-auto mt-4 sm:mt-0">
                        <button
                          type="button"
                          className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-white hover:shadow-sm transition-all"
                        >
                          联系学生
                        </button>
                        <Link
                          to={`/classroom/${cls.id}`}
                          className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all shadow-sm shadow-blue-600/20 flex items-center gap-2 justify-center"
                        >
                          <Video className="w-4 h-4" /> 进入教室
                        </Link>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-gray-500 text-sm">暂无待上课程</div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">待办事项</h2>
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <div className="font-bold text-blue-800 mb-1">提示</div>
                <p className="text-sm text-blue-700">
                  课程确认与评价提醒等功能将在后续版本接入。
                </p>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">平台抽成说明</h2>
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 space-y-3">
              <div className="text-xs text-gray-500">
                具体抽成比例以运营规则为准；此处为占位说明。
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
