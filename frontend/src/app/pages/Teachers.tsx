/**
 * 教师列表 — spec/03-功能实现/20260404-1400-前端对接真实API/plan.md §5 步骤 2
 */
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Search, Filter, Star, Video, Globe2 } from "lucide-react";
import { apiFetchJson, ApiError } from "../lib/http";
import type { PaginatedResponse, TeacherListItem } from "../types/api";
import { formatVndK } from "../lib/format";
import { TeacherAvatar } from "../components/TeacherAvatar";

const PAGE_SIZE = 20;

function sortParam(tab: string): string {
  if (tab === "rating") return "rating";
  if (tab === "price") return "price_asc";
  return "recommended";
}

export function Teachers() {
  const [activeTab, setActiveTab] = useState("all");
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedResponse<TeacherListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(PAGE_SIZE),
      sort_by: sortParam(activeTab),
    });
    if (q.trim()) params.set("q", q.trim());
    try {
      const res = await apiFetchJson<PaginatedResponse<TeacherListItem>>(
        `/teachers?${params.toString()}`,
        { auth: false }
      );
      setData(res);
    } catch (e) {
      setData(null);
      setError(e instanceof ApiError ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [page, q, activeTab]);

  useEffect(() => {
    void load();
  }, [load]);

  function onSearchSubmit(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    setQ(qInput);
  }

  function onTab(tab: string) {
    setActiveTab(tab);
    setPage(1);
  }

  const total = data?.total ?? 0;
  const items = data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row gap-8">
        <div className="w-full md:w-64 flex-shrink-0">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 sticky top-24">
            <div className="flex items-center gap-2 mb-6 text-lg font-bold text-gray-900 border-b border-gray-100 pb-3">
              <Filter className="h-5 w-5" /> 筛选条件
            </div>
            <p className="text-sm text-gray-500">MVP 筛选请使用上方搜索与排序；更多维度后续迭代。</p>
          </div>
        </div>

        <div className="flex-1">
          <form
            onSubmit={onSearchSubmit}
            className="bg-white p-2 rounded-xl flex items-center shadow-sm border border-gray-200 mb-6"
          >
            <div className="flex-1 flex items-center px-4">
              <Search className="h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="搜索老师名字、专业或标签..."
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                className="w-full pl-3 pr-4 py-2 outline-none text-gray-700 placeholder-gray-400 focus:ring-0"
              />
            </div>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg transition-colors"
            >
              搜索
            </button>
          </form>

          <div className="flex gap-6 mb-6 border-b border-gray-200">
            <button
              type="button"
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "all"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => onTab("all")}
            >
              综合推荐
            </button>
            <button
              type="button"
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "rating"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => onTab("rating")}
            >
              评分最高
            </button>
            <button
              type="button"
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "price"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => onTab("price")}
            >
              价格最低
            </button>
          </div>

          <p className="text-gray-500 text-sm mb-4">
            {loading ? "加载中…" : `找到 ${total} 位符合条件的老师`}
          </p>
          {error && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {!loading &&
              items.map((teacher) => {
                const rating = Number(teacher.avg_rating);
                const desc =
                  teacher.specialties?.slice(0, 3).join(" · ") || teacher.teacher_type || "";
                return (
                  <div
                    key={teacher.id}
                    className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-lg transition-shadow flex flex-col sm:flex-row gap-6"
                  >
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="w-28 h-28 rounded-full overflow-hidden mb-3 border-2 border-gray-100">
                        <TeacherAvatar src={teacher.avatar_url} label={teacher.name} />
                      </div>
                      <div className="bg-green-50 text-green-700 text-xs px-2 py-1 rounded-full flex items-center gap-1 font-medium">
                        <Video className="w-3 h-3" /> 可在线上课
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h2 className="text-xl font-bold text-gray-900 mb-1">{teacher.name}</h2>
                          <p className="text-sm text-gray-600 flex items-center gap-1">
                            <Globe2 className="w-4 h-4 text-gray-400" /> {teacher.title}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-gray-900">
                            {formatVndK(teacher.hourly_rate)}{" "}
                            <span className="text-sm font-normal text-gray-500">/ 时</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mb-3 text-sm">
                        <div className="flex items-center gap-1 text-yellow-500 font-bold">
                          <Star className="w-4 h-4 fill-current" /> {rating.toFixed(1)}
                        </div>
                        <span className="text-gray-300">|</span>
                        <span className="text-gray-600">{teacher.total_reviews} 条评价</span>
                        <span className="text-gray-300">|</span>
                        <span className="text-gray-600">已上 {teacher.total_lessons} 节课</span>
                      </div>

                      <p className="text-gray-600 text-sm mb-4 line-clamp-2">{desc}</p>

                      <div className="mt-auto flex justify-between items-center">
                        <div className="flex gap-2 flex-wrap">
                          {(teacher.specialties ?? []).slice(0, 4).map((tag) => (
                            <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-3">
                          <Link
                            to={`/teachers/${teacher.id}`}
                            className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                          >
                            查看详情
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          {totalPages > 1 && (
            <div className="mt-8 flex justify-center gap-2 flex-wrap">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="w-10 h-10 flex items-center justify-center rounded border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                &lt;
              </button>
              <span className="flex items-center px-2 text-sm text-gray-600">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="w-10 h-10 flex items-center justify-center rounded border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                &gt;
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
