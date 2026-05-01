/**
 * 教师工作台 — spec/03-能力交付/20260501-1122-教师入驻排课授课收款闭环/writer/plan.md §3.6
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  UserRound,
  Video,
} from "lucide-react";
import { getAccessToken } from "../lib/api";
import { apiFetchJson, ApiError } from "../lib/http";
import type {
  AvailabilityCreate,
  AvailabilityOut,
  AvailabilityUpdate,
  LessonListItem,
  LessonOut,
  PaginatedResponse,
  PayoutOrderOut,
  TeacherProfileOut,
  TeacherProfileUpdate,
  TeacherTaxProfileOut,
  TeacherTaxProfileUpdate,
  UserOut,
  WalletOut,
} from "../types/api";
import {
  formatAvailabilitySlot,
  formatDateTimeVN,
  formatLessonScheduled,
  formatPercentDecimal,
  formatPayoutStatus,
  formatVndFull,
} from "../lib/format";

type ProfileForm = {
  title: string;
  about: string;
  video_url: string;
  hourly_rate: string;
  currency: string;
  teacher_type: string;
  specialties: string;
};

type TaxForm = {
  tax_scenario: "cn_resident" | "vn_passport_in_cn" | "vn_resident";
  id_doc_type: string;
  id_doc_no: string;
  vn_tax_code: string;
  vn_residency_days_ytd: string;
};

type AvailabilityMode = "weekly" | "date";

type AvailabilityForm = {
  id: string | null;
  mode: AvailabilityMode;
  day_of_week: string;
  specific_date: string;
  start_time: string;
  end_time: string;
};

const emptyProfileForm: ProfileForm = {
  title: "",
  about: "",
  video_url: "",
  hourly_rate: "",
  currency: "VND",
  teacher_type: "professional",
  specialties: "",
};

const emptyTaxForm: TaxForm = {
  tax_scenario: "vn_resident",
  id_doc_type: "",
  id_doc_no: "",
  vn_tax_code: "",
  vn_residency_days_ytd: "0",
};

const emptyAvailabilityForm: AvailabilityForm = {
  id: null,
  mode: "weekly",
  day_of_week: "0",
  specific_date: "",
  start_time: "09:00",
  end_time: "10:00",
};

const lessonGroups = [
  { key: "pending", title: "待确认", statuses: ["pending_confirmation"] },
  { key: "ready", title: "待上课", statuses: ["confirmed"] },
  { key: "live", title: "进行中", statuses: ["in_progress"] },
  { key: "done", title: "已完成", statuses: ["completed", "reviewed"] },
  { key: "closed", title: "已取消/已过期", statuses: ["cancelled", "expired"] },
] as const;

const weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "请求失败";
}

function clipTime(value: string): string {
  return value ? value.slice(0, 5) : "";
}

function specialtiesToText(values: string[] | null | undefined): string {
  return values?.join(", ") ?? "";
}

function parseSpecialties(value: string): string[] | null {
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : null;
}

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

export function TeacherDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = getAccessToken();

  const [me, setMe] = useState<UserOut | null>(null);
  const [profile, setProfile] = useState<TeacherProfileOut | null>(null);
  const [taxProfile, setTaxProfile] = useState<TeacherTaxProfileOut | null>(null);
  const [availability, setAvailability] = useState<AvailabilityOut[]>([]);
  const [lessons, setLessons] = useState<LessonListItem[]>([]);
  const [wallet, setWallet] = useState<WalletOut | null>(null);
  const [payouts, setPayouts] = useState<PayoutOrderOut[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingTax, setSavingTax] = useState(false);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [lessonActionId, setLessonActionId] = useState<string | null>(null);

  const [profileForm, setProfileForm] = useState<ProfileForm>(emptyProfileForm);
  const [taxForm, setTaxForm] = useState<TaxForm>(emptyTaxForm);
  const [availabilityForm, setAvailabilityForm] =
    useState<AvailabilityForm>(emptyAvailabilityForm);

  const loadTeacherWorkspace = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadErr(null);
    setActionErr(null);
    try {
      const user = await apiFetchJson<UserOut>("/auth/me");
      setMe(user);
      if (!user.roles.includes("teacher") || user.active_role !== "teacher") {
        setProfile(null);
        setTaxProfile(null);
        setAvailability([]);
        setLessons([]);
        setWallet(null);
        setPayouts([]);
        return;
      }

      const [profileData, taxData, availabilityData, lessonData, walletData, payoutData] =
        await Promise.all([
          apiFetchJson<TeacherProfileOut>("/teachers/me/profile"),
          apiFetchJson<TeacherTaxProfileOut>("/teachers/me/tax-profile"),
          apiFetchJson<AvailabilityOut[]>("/availability"),
          apiFetchJson<PaginatedResponse<LessonListItem>>(
            "/lessons?role=teacher&page_size=100"
          ),
          apiFetchJson<WalletOut>("/wallet"),
          apiFetchJson<PaginatedResponse<PayoutOrderOut>>(
            "/payouts/me?page=1&page_size=10"
          ),
        ]);

      setProfile(profileData);
      setTaxProfile(taxData);
      setAvailability(availabilityData);
      setLessons(lessonData.items);
      setWallet(walletData);
      setPayouts(payoutData.items);
    } catch (e) {
      setLoadErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadTeacherWorkspace();
  }, [loadTeacherWorkspace]);

  useEffect(() => {
    if (!profile) return;
    setProfileForm({
      title: profile.title ?? "",
      about: profile.about ?? "",
      video_url: profile.video_url ?? "",
      hourly_rate: String(profile.hourly_rate ?? ""),
      currency: profile.currency ?? "VND",
      teacher_type: profile.teacher_type ?? "professional",
      specialties: specialtiesToText(profile.specialties),
    });
  }, [profile]);

  useEffect(() => {
    if (!taxProfile) return;
    setTaxForm({
      tax_scenario: (taxProfile.tax_scenario as TaxForm["tax_scenario"]) || "vn_resident",
      id_doc_type: taxProfile.id_doc_type ?? "",
      id_doc_no: taxProfile.id_doc_no ?? "",
      vn_tax_code: taxProfile.vn_tax_code ?? "",
      vn_residency_days_ytd: String(taxProfile.vn_residency_days_ytd ?? 0),
    });
  }, [taxProfile]);

  const groupedLessons = useMemo(() => {
    return lessonGroups.map((group) => ({
      ...group,
      items: lessons.filter((lesson) =>
        (group.statuses as readonly string[]).includes(lesson.status)
      ),
    }));
  }, [lessons]);

  const completedCount = groupedLessons.find((g) => g.key === "done")?.items.length ?? 0;
  const recentPayout = payouts[0] ?? null;
  const recentNetTotal = payouts.reduce((sum, item) => sum + item.net_amount, 0);
  const profileComplete = Boolean(
    profile?.title &&
      profile.about &&
      profile.hourly_rate &&
      profile.teacher_type &&
      profile.specialties?.length
  );
  const taxComplete = Boolean(
    taxProfile && (taxProfile.vn_tax_code || taxProfile.id_doc_no)
  );

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  async function switchToTeacher() {
    setActionErr(null);
    try {
      await apiFetchJson<UserOut>("/auth/switch-role", {
        method: "POST",
        body: JSON.stringify({ role: "teacher" }),
      });
      await loadTeacherWorkspace();
    } catch (e) {
      setActionErr(errorMessage(e));
    }
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setSavingProfile(true);
    setActionErr(null);
    try {
      const payload: TeacherProfileUpdate = {
        title: profileForm.title.trim(),
        about: nullable(profileForm.about),
        video_url: nullable(profileForm.video_url),
        hourly_rate: Number(profileForm.hourly_rate),
        currency: profileForm.currency.trim() || "VND",
        teacher_type: profileForm.teacher_type,
        specialties: parseSpecialties(profileForm.specialties),
      };
      const saved = await apiFetchJson<TeacherProfileOut>("/teachers/profile", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setProfile(saved);
      await loadTeacherWorkspace();
    } catch (e) {
      setActionErr(errorMessage(e));
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveTaxProfile(event: FormEvent) {
    event.preventDefault();
    setSavingTax(true);
    setActionErr(null);
    try {
      const payload: TeacherTaxProfileUpdate = {
        tax_scenario: taxForm.tax_scenario,
        id_doc_type: nullable(taxForm.id_doc_type),
        id_doc_no: nullable(taxForm.id_doc_no),
        vn_tax_code: nullable(taxForm.vn_tax_code),
        vn_residency_days_ytd: Number(taxForm.vn_residency_days_ytd || 0),
      };
      const saved = await apiFetchJson<TeacherTaxProfileOut>(
        "/teachers/me/tax-profile",
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        }
      );
      setTaxProfile(saved);
    } catch (e) {
      setActionErr(errorMessage(e));
    } finally {
      setSavingTax(false);
    }
  }

  function buildAvailabilityPayload(): AvailabilityCreate {
    const mode = availabilityForm.mode;
    return {
      day_of_week: mode === "weekly" ? Number(availabilityForm.day_of_week) : null,
      specific_date: mode === "date" ? availabilityForm.specific_date : null,
      start_time: availabilityForm.start_time,
      end_time: availabilityForm.end_time,
      is_recurring: mode === "weekly",
    };
  }

  async function saveAvailability(event: FormEvent) {
    event.preventDefault();
    setSavingAvailability(true);
    setActionErr(null);
    try {
      const payload = buildAvailabilityPayload();
      if (availabilityForm.id) {
        const updatePayload: AvailabilityUpdate = payload;
        await apiFetchJson<AvailabilityOut>(`/availability/${availabilityForm.id}`, {
          method: "PUT",
          body: JSON.stringify(updatePayload),
        });
      } else {
        await apiFetchJson<AvailabilityOut>("/availability", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setAvailabilityForm(emptyAvailabilityForm);
      await loadTeacherWorkspace();
    } catch (e) {
      setActionErr(errorMessage(e));
    } finally {
      setSavingAvailability(false);
    }
  }

  function editAvailability(row: AvailabilityOut) {
    setAvailabilityForm({
      id: row.id,
      mode: row.specific_date ? "date" : "weekly",
      day_of_week: String(row.day_of_week ?? 0),
      specific_date: row.specific_date ?? "",
      start_time: clipTime(row.start_time),
      end_time: clipTime(row.end_time),
    });
  }

  async function deleteAvailability(row: AvailabilityOut) {
    if (!window.confirm(`删除 ${formatAvailabilitySlot(row)}？`)) return;
    setActionErr(null);
    try {
      await apiFetchJson<void>(`/availability/${row.id}`, { method: "DELETE" });
      await loadTeacherWorkspace();
    } catch (e) {
      setActionErr(errorMessage(e));
    }
  }

  async function runLessonAction(
    lesson: LessonListItem,
    action: "confirm" | "start" | "end"
  ) {
    setLessonActionId(lesson.id);
    setActionErr(null);
    try {
      await apiFetchJson<LessonOut>(`/lessons/${lesson.id}/${action}`, {
        method: "PATCH",
      });
      if (action === "start") {
        navigate(`/classroom/${lesson.id}`);
        return;
      }
      await loadTeacherWorkspace();
    } catch (e) {
      setActionErr(errorMessage(e));
    } finally {
      setLessonActionId(null);
    }
  }

  if (!loading && me && !me.roles.includes("teacher")) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">教师中心</h1>
        <div className="bg-white border border-gray-100 rounded-lg p-6 shadow-sm">
          <p className="text-gray-700 mb-5">
            当前账号还没有教师身份，请先完成教师入驻后再管理档案、排课和收入。
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <UserRound className="w-4 h-4" />
            开通教师身份
          </Link>
        </div>
      </div>
    );
  }

  if (!loading && me?.roles.includes("teacher") && me.active_role !== "teacher") {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">教师中心</h1>
        <div className="bg-white border border-gray-100 rounded-lg p-6 shadow-sm">
          <p className="text-gray-700 mb-5">
            当前活跃身份是学生。切换到教师身份后可以加载教师档案、税务资料、排课和收入。
          </p>
          {actionErr && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">
              {actionErr}
            </div>
          )}
          <button
            type="button"
            onClick={switchToTeacher}
            className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <UserRound className="w-4 h-4" />
            切换到教师身份
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">教师工作台</h1>
          <p className="text-gray-600 mt-2">
            管理入驻档案、可授课时段、课程履约和近期收入。
          </p>
        </div>
        <Link
          to="/payouts"
          className="inline-flex items-center gap-2 px-4 py-2 border border-green-200 bg-green-50 text-green-800 rounded-lg hover:bg-green-100 transition-colors font-medium"
        >
          <DollarSign className="w-4 h-4" />
          查看出款明细
        </Link>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-gray-500 mb-6">
          <Loader2 className="w-5 h-5 animate-spin" />
          正在加载教师工作台...
        </div>
      )}
      {(loadErr || actionErr) && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3 mb-6">
          {actionErr || loadErr}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="钱包余额"
          value={wallet ? formatVndFull(wallet.balance) : "-"}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <StatCard
          label="待确认课程"
          value={`${lessons.filter((l) => l.status === "pending_confirmation").length} 节`}
          icon={<Clock className="w-5 h-5" />}
        />
        <StatCard
          label="有效完课"
          value={`${profile?.total_lessons ?? completedCount} 节`}
          icon={<CheckCircle2 className="w-5 h-5" />}
        />
        <StatCard
          label="响应率"
          value={profile ? formatPercentDecimal(profile.response_rate) : "-"}
          icon={<BarChart3 className="w-5 h-5" />}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">入驻状态</h2>
                <p className="text-sm text-gray-500 mt-1">
                  档案、税务资料和排课会影响学生是否能顺利预约。
                </p>
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <StatusItem
                title="教师身份"
                done={Boolean(me?.roles.includes("teacher"))}
                detail={me?.active_role === "teacher" ? "已切换为教师" : "待切换身份"}
              />
              <StatusItem
                title="教学档案"
                done={profileComplete}
                detail={profileComplete ? "关键字段已填写" : "请补齐标题、简介、时薪和专长"}
              />
              <StatusItem
                title="税务资料"
                done={taxComplete}
                detail={taxComplete ? "已补充识别信息" : "默认税务档案已创建，可继续补充"}
              />
            </div>
          </section>

          <section className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-5">课程待办</h2>
            <div className="space-y-5">
              {groupedLessons.map((group) => (
                <div key={group.key}>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-gray-800">{group.title}</h3>
                    <span className="text-xs text-gray-500">{group.items.length}</span>
                  </div>
                  {group.items.length === 0 ? (
                    <div className="text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg px-4 py-3">
                      暂无{group.title}课程
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
                      {group.items.map((lesson) => (
                        <LessonRow
                          key={lesson.id}
                          lesson={lesson}
                          busy={lessonActionId === lesson.id}
                          onConfirm={() => runLessonAction(lesson, "confirm")}
                          onStart={() => runLessonAction(lesson, "start")}
                          onEnd={() => runLessonAction(lesson, "end")}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-5">可授课时段</h2>
            <form onSubmit={saveAvailability} className="grid md:grid-cols-6 gap-3 mb-5">
              <select
                value={availabilityForm.mode}
                onChange={(e) =>
                  setAvailabilityForm((prev) => ({
                    ...prev,
                    mode: e.target.value as AvailabilityMode,
                  }))
                }
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="weekly">每周重复</option>
                <option value="date">指定日期</option>
              </select>
              {availabilityForm.mode === "weekly" ? (
                <select
                  value={availabilityForm.day_of_week}
                  onChange={(e) =>
                    setAvailabilityForm((prev) => ({
                      ...prev,
                      day_of_week: e.target.value,
                    }))
                  }
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  {weekdays.map((label, index) => (
                    <option key={label} value={index}>
                      {label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="date"
                  required
                  value={availabilityForm.specific_date}
                  onChange={(e) =>
                    setAvailabilityForm((prev) => ({
                      ...prev,
                      specific_date: e.target.value,
                    }))
                  }
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              )}
              <input
                type="time"
                required
                value={availabilityForm.start_time}
                onChange={(e) =>
                  setAvailabilityForm((prev) => ({ ...prev, start_time: e.target.value }))
                }
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="time"
                required
                value={availabilityForm.end_time}
                onChange={(e) =>
                  setAvailabilityForm((prev) => ({ ...prev, end_time: e.target.value }))
                }
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={savingAvailability}
                className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {availabilityForm.id ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {availabilityForm.id ? "保存" : "添加"}
              </button>
              {availabilityForm.id && (
                <button
                  type="button"
                  onClick={() => setAvailabilityForm(emptyAvailabilityForm)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  取消编辑
                </button>
              )}
            </form>
            <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
              {availability.length === 0 ? (
                <div className="text-sm text-gray-500 px-4 py-4">暂无可授课时段</div>
              ) : (
                availability.map((row) => (
                  <div
                    key={row.id}
                    className="px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {formatAvailabilitySlot(row)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {row.is_recurring ? "周期时段" : "指定日期时段"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => editAvailability(row)}
                        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
                        title="编辑"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteAvailability(row)}
                        className="p-2 rounded-lg text-red-500 hover:bg-red-50"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-5">教学档案</h2>
            <form onSubmit={saveProfile} className="space-y-3">
              <TextField label="教学标题" required value={profileForm.title} onChange={(value) => setProfileForm((prev) => ({ ...prev, title: value }))} />
              <TextArea label="简介" value={profileForm.about} onChange={(value) => setProfileForm((prev) => ({ ...prev, about: value }))} />
              <TextField label="视频 URL" value={profileForm.video_url} onChange={(value) => setProfileForm((prev) => ({ ...prev, video_url: value }))} />
              <div className="grid grid-cols-2 gap-3">
                <TextField label="时薪" type="number" required value={profileForm.hourly_rate} onChange={(value) => setProfileForm((prev) => ({ ...prev, hourly_rate: value }))} />
                <TextField label="币种" required maxLength={3} value={profileForm.currency} onChange={(value) => setProfileForm((prev) => ({ ...prev, currency: value.toUpperCase() }))} />
              </div>
              <label className="block text-sm">
                <span className="block text-gray-700 mb-1">教师类型</span>
                <select
                  value={profileForm.teacher_type}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, teacher_type: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                >
                  <option value="professional">专业教师</option>
                  <option value="community">社区辅导员</option>
                </select>
              </label>
              <TextField label="专长（逗号分隔）" value={profileForm.specialties} onChange={(value) => setProfileForm((prev) => ({ ...prev, specialties: value }))} />
              <button
                type="submit"
                disabled={savingProfile}
                className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                保存档案
              </button>
            </form>
          </section>

          <section className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-5">税务资料</h2>
            <form onSubmit={saveTaxProfile} className="space-y-3">
              <label className="block text-sm">
                <span className="block text-gray-700 mb-1">税务场景</span>
                <select
                  value={taxForm.tax_scenario}
                  onChange={(e) => setTaxForm((prev) => ({ ...prev, tax_scenario: e.target.value as TaxForm["tax_scenario"] }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                >
                  <option value="vn_resident">越南税务居民</option>
                  <option value="vn_passport_in_cn">越南护照在中国</option>
                  <option value="cn_resident">中国税务居民</option>
                </select>
              </label>
              <TextField label="证件类型" value={taxForm.id_doc_type} onChange={(value) => setTaxForm((prev) => ({ ...prev, id_doc_type: value }))} />
              <TextField label="证件号/后四位" value={taxForm.id_doc_no} onChange={(value) => setTaxForm((prev) => ({ ...prev, id_doc_no: value }))} />
              <TextField label="越南税号" value={taxForm.vn_tax_code} onChange={(value) => setTaxForm((prev) => ({ ...prev, vn_tax_code: value }))} />
              <TextField label="本年越南居住天数" type="number" value={taxForm.vn_residency_days_ytd} onChange={(value) => setTaxForm((prev) => ({ ...prev, vn_residency_days_ytd: value }))} />
              <button
                type="submit"
                disabled={savingTax}
                className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                保存税务资料
              </button>
            </form>
          </section>

          <section className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">收入摘要</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">最近 10 笔实际到账</span>
                <span className="font-semibold text-gray-900">{formatVndFull(recentNetTotal)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">最近出款状态</span>
                <span className="font-semibold text-gray-900">
                  {recentPayout ? formatPayoutStatus(recentPayout.status) : "-"}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">最近到账时间</span>
                <span className="font-semibold text-gray-900">
                  {recentPayout ? formatDateTimeVN(recentPayout.paid_at) : "-"}
                </span>
              </div>
              <p className="text-xs text-gray-500 pt-2 border-t border-gray-100">
                课程完成后进入争议期，争议期结束才会生成出款；平台费和税费可在出款明细查看。
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-5 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <div className="text-sm text-gray-500">{label}</div>
        <div className="text-xl font-bold text-gray-900">{value}</div>
      </div>
    </div>
  );
}

function StatusItem({
  title,
  detail,
  done,
}: {
  title: string;
  detail: string;
  done: boolean;
}) {
  return (
    <div className="border border-gray-100 rounded-lg p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
        <span className={`w-2.5 h-2.5 rounded-full ${done ? "bg-green-500" : "bg-amber-400"}`} />
        {title}
      </div>
      <p className="text-xs text-gray-500 mt-2">{detail}</p>
    </div>
  );
}

function LessonRow({
  lesson,
  busy,
  onConfirm,
  onStart,
  onEnd,
}: {
  lesson: LessonListItem;
  busy: boolean;
  onConfirm: () => void;
  onStart: () => void;
  onEnd: () => void;
}) {
  const { date, time } = formatLessonScheduled(lesson.scheduled_at);
  return (
    <div className="px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white">
      <div>
        <div className="font-medium text-gray-900">{lesson.topic || "中文课程"}</div>
        <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
          <span>学生：{lesson.student_name || "学生"}</span>
          <span>
            {date} {time}
          </span>
          <span>{lesson.duration_minutes} 分钟</span>
          <span>{formatVndFull(lesson.price)}</span>
        </div>
        {lesson.classroom_unavailable_reason && lesson.status === "confirmed" && (
          <div className="text-xs text-amber-600 mt-1">
            {lesson.classroom_unavailable_reason}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {lesson.status === "pending_confirmation" && (
          <ActionButton busy={busy} onClick={onConfirm}>
            确认
          </ActionButton>
        )}
        {lesson.status === "confirmed" && (
          <>
            <ActionButton busy={busy} disabled={!lesson.can_enter_classroom} onClick={onStart}>
              开始
            </ActionButton>
            {lesson.can_enter_classroom && (
              <Link
                to={`/classroom/${lesson.id}`}
                className="inline-flex items-center gap-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <Video className="w-3.5 h-3.5" />
                进入教室
              </Link>
            )}
          </>
        )}
        {lesson.status === "in_progress" && (
          <>
            <Link
              to={`/classroom/${lesson.id}`}
              className="inline-flex items-center gap-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <Video className="w-3.5 h-3.5" />
              进入教室
            </Link>
            <ActionButton busy={busy} tone="danger" onClick={onEnd}>
              结束课程
            </ActionButton>
          </>
        )}
        {(lesson.status === "completed" || lesson.status === "reviewed") && (
          <Link
            to="/payouts"
            className="inline-flex items-center gap-1 border border-green-200 bg-green-50 rounded-lg px-3 py-1.5 text-xs font-medium text-green-800 hover:bg-green-100"
          >
            查看收入
          </Link>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  children,
  busy,
  disabled,
  tone = "primary",
  onClick,
}: {
  children: ReactNode;
  busy?: boolean;
  disabled?: boolean;
  tone?: "primary" | "danger";
  onClick: () => void;
}) {
  const toneClass =
    tone === "danger"
      ? "bg-red-600 hover:bg-red-700"
      : "bg-blue-600 hover:bg-blue-700";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className={`inline-flex items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 ${toneClass}`}
    >
      {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {children}
    </button>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <label className="block text-sm">
      <span className="block text-gray-700 mb-1">{label}</span>
      <input
        type={type}
        required={required}
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="block text-gray-700 mb-1">{label}</span>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 resize-y"
      />
    </label>
  );
}
