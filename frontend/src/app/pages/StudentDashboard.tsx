/**
 * 学生仪表盘 — spec/03-能力交付/20260501-1121-学员找老师到预约上课闭环/writer/plan.md §3.5
 */
import { useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router";
import {
  Video,
  Calendar,
  Clock,
  CreditCard,
  ChevronRight,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { getAccessToken } from "../lib/api";
import { apiFetchJson, ApiError } from "../lib/http";
import type {
  LessonListItem,
  LessonStatus,
  PaginatedResponse,
  UserOut,
  WalletOut,
} from "../types/api";
import { formatLessonScheduled, formatVndFull } from "../lib/format";
import { TeacherAvatar } from "../components/TeacherAvatar";

type LessonGroup = {
  title: string;
  statuses: LessonStatus[];
  empty: string;
};

const LESSON_GROUPS: LessonGroup[] = [
  {
    title: "待老师确认",
    statuses: ["pending_confirmation"],
    empty: "暂无等待老师确认的课程",
  },
  {
    title: "待上课",
    statuses: ["confirmed"],
    empty: "暂无已确认待上课的课程",
  },
  {
    title: "进行中",
    statuses: ["in_progress"],
    empty: "暂无进行中的课程",
  },
  {
    title: "已完成",
    statuses: ["completed", "reviewed"],
    empty: "暂无已完成课程",
  },
  {
    title: "已取消/已过期",
    statuses: ["cancelled", "expired"],
    empty: "暂无已取消或已过期课程",
  },
];

const STATUS_LABEL: Record<LessonStatus, string> = {
  pending_confirmation: "待老师确认",
  confirmed: "待上课",
  in_progress: "进行中",
  completed: "待评价",
  reviewed: "已评价",
  cancelled: "已取消",
  expired: "已过期",
};

function statusPillClass(status: LessonStatus): string {
  if (status === "in_progress") return "text-blue-700 bg-blue-50";
  if (status === "confirmed") return "text-green-700 bg-green-50";
  if (status === "pending_confirmation") return "text-amber-700 bg-amber-50";
  if (status === "completed" || status === "reviewed") return "text-gray-700 bg-gray-100";
  return "text-red-700 bg-red-50";
}

function LessonCard({ lesson }: { lesson: LessonListItem }) {
  const { date, time } = formatLessonScheduled(lesson.scheduled_at);
  const teacherName = lesson.teacher_name || "教师";
  const canEnter = lesson.can_enter_classroom === true;
  const reason = lesson.classroom_unavailable_reason || "当前不可进入课堂";

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
      <div className="flex gap-4 items-center min-w-0">
        <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white shadow-sm shrink-0">
          <TeacherAvatar src={null} label={teacherName} />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-gray-900 text-lg mb-1 truncate">
            {lesson.topic || "课程"}
          </div>
          <div className="text-sm text-gray-600 flex items-center gap-2 flex-wrap">
            <span>{teacherName}老师</span>
            <span className="text-gray-300">|</span>
            <span className="flex items-center gap-1 font-medium text-blue-700">
              <Clock className="w-4 h-4" /> {date} {time}
            </span>
            <span className="text-gray-300">|</span>
            <span>{lesson.duration_minutes} 分钟</span>
            <span className="text-gray-300">|</span>
            <span>{formatVndFull(lesson.price)}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusPillClass(lesson.status)}`}>
              {STATUS_LABEL[lesson.status]}
            </span>
            {!canEnter && (
              <span className="text-xs text-gray-500">
                课堂入口：{reason}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="w-full sm:w-auto">
        {canEnter ? (
          <Link
            to={`/classroom/${lesson.id}`}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-600/20"
          >
            <Video className="w-5 h-5" /> 进入教室
          </Link>
        ) : lesson.status === "completed" ? (
          <button
            type="button"
            className="w-full sm:w-auto px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 bg-gray-50"
          >
            待评价
          </button>
        ) : lesson.status === "reviewed" ? (
          <span className="block text-center text-sm font-medium text-green-700 bg-green-50 px-4 py-2 rounded-lg">
            已评价
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function StudentDashboard() {
  const location = useLocation();
  const token = getAccessToken();

  const [me, setMe] = useState<UserOut | null>(null);
  const [lessons, setLessons] = useState<LessonListItem[]>([]);
  const [wallet, setWallet] = useState<WalletOut | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadErr(null);
      try {
        const [u, lessonPage, w] = await Promise.all([
          apiFetchJson<UserOut>("/auth/me"),
          apiFetchJson<PaginatedResponse<LessonListItem>>(
            "/lessons?role=student&page=1&page_size=100"
          ),
          apiFetchJson<WalletOut>("/wallet"),
        ]);
        if (!cancelled) {
          setMe(u);
          setLessons(lessonPage.items);
          setWallet(w);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadErr(e instanceof ApiError ? e.message : "加载失败");
        }
      } finally {
        if (!cancelled) setLoading(false);
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
  const groupedLessons = LESSON_GROUPS.map((group) => ({
    ...group,
    items: lessons.filter((lesson) => group.statuses.includes(lesson.status)),
  }));

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
                <Calendar className="w-5 h-5 text-blue-600" /> 我的课程
              </h2>
            </div>

            {loading ? (
              <div className="p-8 text-center text-gray-500 text-sm">加载课程中…</div>
            ) : (
              <div className="p-6 space-y-8 bg-gray-50">
                {groupedLessons.map((group) => (
                  <div key={group.title} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-gray-900">{group.title}</h3>
                      <span className="text-xs text-gray-500">{group.items.length} 节</span>
                    </div>
                    {group.items.length > 0 ? (
                      <div className="space-y-3">
                        {group.items.map((lesson) => (
                          <LessonCard key={lesson.id} lesson={lesson} />
                        ))}
                      </div>
                    ) : (
                      <div className="bg-white border border-dashed border-gray-200 rounded-xl px-4 py-5 text-sm text-gray-500">
                        {group.empty}
                      </div>
                    )}
                  </div>
                ))}

                {lessons.length === 0 && (
                  <div className="text-center py-6">
                    <Link to="/teachers" className="text-blue-600 font-medium hover:underline">
                      去寻找合适的老师 →
                    </Link>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-600" /> 学习记录
              </h2>
            </div>

            <div className="divide-y divide-gray-100">
              {lessons.filter((lesson) => lesson.status === "completed" || lesson.status === "reviewed").length > 0 ? (
                lessons
                  .filter((lesson) => lesson.status === "completed" || lesson.status === "reviewed")
                  .map((lesson) => {
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
                              <CheckCircle2 className="w-3 h-3" /> {STATUS_LABEL[lesson.status]}
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-3 w-full sm:w-auto">
                          <button
                            type="button"
                            className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 bg-gray-50 flex-1 sm:flex-none"
                          >
                            {lesson.status === "reviewed" ? "已评价" : "待评价"}
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
