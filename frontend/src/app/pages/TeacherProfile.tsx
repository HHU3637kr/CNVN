/**
 * 教师详情 — spec/03-功能实现/20260404-1400-前端对接真实API/plan.md §5 步骤 3
 * GET /teachers/{id} 无 name/avatar，标题作展示名、首字母头像 — plan §3.4
 */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import {
  Star,
  Video,
  CheckCircle2,
  Globe2,
  Calendar,
  Clock,
  MessageSquare,
  Play,
  ShieldCheck,
} from "lucide-react";
import { apiFetchJson, ApiError } from "../lib/http";
import type {
  AvailabilityOut,
  PaginatedResponse,
  ReviewOut,
  TeacherProfileOut,
} from "../types/api";
import { formatAvailabilitySlot, formatVndK } from "../lib/format";
import { TeacherAvatar } from "../components/TeacherAvatar";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ratingNum(v: string | number): number {
  return typeof v === "number" ? v : Number(v);
}

export function TeacherProfile() {
  const { id } = useParams();
  const valid = id && UUID_RE.test(id);

  const [teacher, setTeacher] = useState<TeacherProfileOut | null>(null);
  const [reviews, setReviews] = useState<ReviewOut[]>([]);
  const [availability, setAvailability] = useState<AvailabilityOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!valid || !id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [t, rev, av] = await Promise.all([
          apiFetchJson<TeacherProfileOut>(`/teachers/${id}`, { auth: false }),
          apiFetchJson<PaginatedResponse<ReviewOut>>(`/teachers/${id}/reviews?page_size=10`, {
            auth: false,
          }),
          apiFetchJson<AvailabilityOut[]>(`/teachers/${id}/availability`, { auth: false }),
        ]);
        if (!cancelled) {
          setTeacher(t);
          setReviews(rev.items);
          setAvailability(av);
        }
      } catch (e) {
        if (!cancelled) {
          setTeacher(null);
          setError(e instanceof ApiError ? e.message : "加载失败");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, valid]);

  if (!valid) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-gray-600">
        无效的教师链接。
        <Link to="/teachers" className="text-blue-600 ml-2">
          返回列表
        </Link>
      </div>
    );
  }

  if (loading && !teacher) {
    return (
      <div className="bg-gray-50 min-h-screen pb-20 flex items-center justify-center">
        <p className="text-gray-500">加载中…</p>
      </div>
    );
  }

  if (error || !teacher) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <p className="text-red-600 mb-4">{error ?? "未找到教师"}</p>
        <Link to="/teachers" className="text-blue-600">
          返回列表
        </Link>
      </div>
    );
  }

  const displayName = teacher.title.split(/[·•|]/)[0]?.trim() || teacher.title;
  const avg = ratingNum(teacher.avg_rating);
  const videoThumb =
    teacher.video_url && /\.(jpg|jpeg|png|gif|webp)$/i.test(teacher.video_url)
      ? teacher.video_url
      : null;

  return (
    <div className="bg-gray-50 min-h-screen pb-20">
      <div className="bg-blue-900 h-48 w-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-24">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 relative">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-white shadow-lg overflow-hidden flex-shrink-0 relative -mt-16 bg-white">
                  <TeacherAvatar src={null} label={displayName} />
                </div>

                <div className="flex-1 pt-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2 flex-wrap">
                        {displayName}
                        {teacher.is_verified && (
                          <ShieldCheck className="w-6 h-6 text-green-500 shrink-0" title="身份已认证" />
                        )}
                      </h1>
                      <p className="text-lg text-gray-600 mt-1 flex items-center gap-2">
                        <Globe2 className="w-5 h-5 text-gray-400 shrink-0" /> {teacher.title}
                      </p>
                    </div>
                    <div className="hidden md:flex gap-3">
                      <button
                        type="button"
                        className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <MessageSquare className="w-4 h-4" /> 发私信
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-6 mt-6">
                    <div className="flex items-center gap-2">
                      <div className="flex text-yellow-400">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star
                            key={i}
                            className={`w-5 h-5 ${
                              i <= Math.round(avg) ? "fill-current text-yellow-400" : "text-gray-200"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="font-bold text-gray-900 text-lg">{avg.toFixed(1)}</span>
                      <span className="text-gray-500 text-sm">({teacher.total_reviews} 条评价)</span>
                    </div>

                    <div className="h-6 w-px bg-gray-200" />

                    <div className="flex items-center gap-2 text-gray-700">
                      <Video className="w-5 h-5 text-blue-500" />
                      <span className="font-bold">{teacher.total_lessons}</span> 节完课
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-2">
                {(teacher.specialties ?? []).map((tag) => (
                  <span
                    key={tag}
                    className="bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1.5 rounded-full text-sm font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6">自我介绍视频</h2>
              {teacher.video_url ? (
                <div className="relative rounded-xl overflow-hidden aspect-video bg-gray-900 group cursor-pointer">
                  {videoThumb ? (
                    <img
                      src={videoThumb}
                      alt=""
                      className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-blue-200 text-sm p-4 break-all">
                      {teacher.video_url}
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center pl-1 group-hover:scale-110 transition-transform shadow-lg">
                      <Play className="w-8 h-8 text-white fill-current" />
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">暂无视频</p>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6">关于我</h2>
              <div className="prose prose-blue max-w-none text-gray-600 whitespace-pre-line leading-relaxed">
                {teacher.about || "暂无介绍"}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">学生评价 ({teacher.total_reviews})</h2>
                <div className="flex items-center gap-2 text-yellow-500 font-bold text-lg">
                  <Star className="w-6 h-6 fill-current" /> {avg.toFixed(1)}
                </div>
              </div>

              {reviews.length === 0 ? (
                <p className="text-gray-500 text-sm">暂无评价</p>
              ) : (
                <div className="space-y-6">
                  {reviews.map((r) => {
                    const name = r.reviewer_name || "学生";
                    const letter = name.slice(0, 1).toUpperCase();
                    return (
                      <div key={r.id} className="border-b border-gray-100 pb-6 last:border-0">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-500">
                              {letter}
                            </div>
                            <div>
                              <div className="font-bold text-gray-900">{name}</div>
                              <div className="text-xs text-gray-500">
                                {new Date(r.created_at).toLocaleDateString("zh-CN")}
                              </div>
                            </div>
                          </div>
                          <div className="flex text-yellow-400">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`w-4 h-4 ${i < r.rating_overall ? "fill-current" : "text-gray-200"}`}
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-gray-600">{r.content || "（无文字）"}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="w-full lg:w-96 flex-shrink-0">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sticky top-24">
              <div className="flex justify-between items-center mb-6 pb-6 border-b border-gray-100">
                <div>
                  <div className="text-sm text-gray-500 mb-1">单节课时费 (60分钟)</div>
                  <div className="text-3xl font-bold text-gray-900">{formatVndK(teacher.hourly_rate)}</div>
                </div>
              </div>

              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" /> 开放时段
              </h3>
              {availability.length === 0 ? (
                <p className="text-sm text-gray-500 mb-6">暂无公开时段，请私信老师。</p>
              ) : (
                <ul className="space-y-2 mb-6 text-sm text-gray-700">
                  {availability.map((a) => (
                    <li key={a.id} className="flex items-start gap-2">
                      <Clock className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                      {formatAvailabilitySlot(a)}
                    </li>
                  ))}
                </ul>
              )}

              <div className="space-y-3">
                <button
                  type="button"
                  className="w-full bg-blue-600 text-white font-bold text-lg py-4 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
                >
                  预约试课
                </button>
                <button
                  type="button"
                  className="w-full bg-white border-2 border-blue-600 text-blue-600 font-bold text-lg py-3.5 rounded-xl hover:bg-blue-50 transition-colors"
                >
                  发送私信咨询
                </button>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-100 space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle2 className="w-4 h-4 text-green-500" /> 课前24小时可免费取消
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle2 className="w-4 h-4 text-green-500" /> 资金由平台担保，满意后打款
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
