import { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  MessageSquare,
  FileText,
  Send,
  Share,
  Clock,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { getAccessToken, wsUrlForLesson } from "@/app/lib/api";
import { apiFetchJson, ApiError } from "../lib/http";
import type { LessonOut, PaginatedResponse, TeacherProfileOut, UserOut } from "../types/api";

type ChatMsg = {
  id: string;
  lesson_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

function formatClock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatMsgTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "加载失败";
}

export function Classroom() {
  const { id: lessonId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [activeTab, setActiveTab] = useState("chat");
  const [timeLeft, setTimeLeft] = useState(3600);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [wsError, setWsError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [preflightLoading, setPreflightLoading] = useState(true);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [classroomAllowed, setClassroomAllowed] = useState(false);
  const [lesson, setLesson] = useState<LessonOut | null>(null);
  const [me, setMe] = useState<UserOut | null>(null);
  const [teacherCanEnd, setTeacherCanEnd] = useState(false);
  const [endingLesson, setEndingLesson] = useState(false);

  const token = getAccessToken();

  const scrollChat = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!lessonId) {
      setPreflightLoading(false);
      setBlockedReason("无效的课堂链接");
      return;
    }
    if (!token) {
      setPreflightLoading(false);
      setHistoryLoading(false);
      setClassroomAllowed(false);
      setBlockedReason("请先登录后再进入课堂。");
      return;
    }

    let cancelled = false;
    (async () => {
      setPreflightLoading(true);
      setHistoryLoading(false);
      setClassroomAllowed(false);
      setBlockedReason(null);
      setFetchError(null);
      setWsError(null);
      setMessages([]);

      let lessonData: LessonOut;
      let userData: UserOut;
      try {
        [lessonData, userData] = await Promise.all([
          apiFetchJson<LessonOut>(`/lessons/${lessonId}`),
          apiFetchJson<UserOut>("/auth/me"),
        ]);
      } catch (e) {
        if (!cancelled) {
          setBlockedReason(errorMessage(e));
          setPreflightLoading(false);
        }
        return;
      }

      if (cancelled) return;
      setLesson(lessonData);
      setMe(userData);
      setTimeLeft(Math.max(0, lessonData.duration_minutes * 60));

      if (userData.active_role === "teacher") {
        try {
          const profile = await apiFetchJson<TeacherProfileOut>("/teachers/me/profile");
          if (!cancelled) setTeacherCanEnd(profile.id === lessonData.teacher_id);
        } catch {
          if (!cancelled) setTeacherCanEnd(false);
        }
      } else {
        setTeacherCanEnd(false);
      }

      if (lessonData.can_enter_classroom !== true) {
        setBlockedReason(lessonData.classroom_unavailable_reason || "当前不可进入课堂。");
        setHistoryLoading(false);
        setPreflightLoading(false);
        return;
      }

      setClassroomAllowed(true);
      setPreflightLoading(false);
      setHistoryLoading(true);

      try {
        const data = await apiFetchJson<PaginatedResponse<ChatMsg>>(
          `/lessons/${lessonId}/messages?page=1&page_size=100`
        );
        if (!cancelled) {
          setMyUserId(userData.id);
          setMessages(
            data.items.map((m) => ({
              ...m,
              id: String(m.id),
              lesson_id: String(m.lesson_id),
              sender_id: String(m.sender_id),
            }))
          );
        }
      } catch (e) {
        if (!cancelled) setFetchError(errorMessage(e));
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lessonId, token]);

  useEffect(() => {
    scrollChat();
  }, [messages, scrollChat]);

  useEffect(() => {
    if (!lessonId || !token || !classroomAllowed) return;

    const url = wsUrlForLesson(lessonId, token);
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => setWsError(null);
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data as string) as Record<string, unknown>;
        if (data.type === "error") {
          setWsError(String(data.message ?? "实时通道错误"));
          return;
        }
        if (data.type === "chat" && data.id && data.sender_id) {
          const row: ChatMsg = {
            id: String(data.id),
            lesson_id: String(data.lesson_id),
            sender_id: String(data.sender_id),
            content: String(data.content),
            created_at: String(data.created_at),
          };
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row];
          });
        }
      } catch {
        setWsError("收到无法解析的消息");
      }
    };
    ws.onerror = () => setWsError("WebSocket 连接异常");
    ws.onclose = () => {
      wsRef.current = null;
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [lessonId, token, classroomAllowed]);

  const sendChat = () => {
    const text = draft.trim();
    if (!text) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setWsError("实时通道未就绪，请稍后重试");
      return;
    }
    ws.send(JSON.stringify({ type: "chat", content: text }));
    setDraft("");
  };

  const handleLeaveClass = () => {
    navigate(me?.active_role === "teacher" ? "/dashboard/teacher" : "/dashboard/student");
  };

  const handleEndClass = async () => {
    if (!lessonId) return;
    if (!teacherCanEnd) {
      handleLeaveClass();
      return;
    }
    if (window.confirm("确定要结束课程吗？结束后课程将进入完课结算流程。")) {
      setEndingLesson(true);
      setFetchError(null);
      try {
        await apiFetchJson<LessonOut>(`/lessons/${lessonId}/end`, {
          method: "PATCH",
        });
        navigate("/dashboard/teacher");
      } catch (e) {
        setFetchError(errorMessage(e));
      } finally {
        setEndingLesson(false);
      }
    }
  };

  if (preflightLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6">
        <div className="flex items-center gap-2 text-gray-300">
          <Loader2 className="w-5 h-5 animate-spin" />
          正在检查课堂入口…
        </div>
      </div>
    );
  }

  if (blockedReason || !lessonId) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-gray-800 border border-gray-700 rounded-2xl p-6 text-center">
          <AlertCircle className="w-10 h-10 text-amber-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">暂时不能进入课堂</h1>
          <p className="text-gray-300 text-sm mb-6">{blockedReason || "无效的课堂链接"}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {!token && (
              <Link
                to="/login"
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
              >
                去登录
              </Link>
            )}
            <Link
              to={me?.active_role === "teacher" ? "/dashboard/teacher" : "/dashboard/student"}
              className="bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              返回{me?.active_role === "teacher" ? "教师中心" : "学习中心"}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 flex flex-col font-sans text-white overflow-hidden">
      <div className="h-14 bg-gray-900 border-b border-gray-800 flex justify-between items-center px-4 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-amber-900/50 text-amber-200 text-xs font-bold px-2 py-1 rounded flex items-center gap-1 shrink-0">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            文字实时
          </div>
          <h1 className="font-medium text-gray-200 hidden sm:block truncate">
            在线课堂 · {(lesson?.topic || lessonId).slice(0, 24)}
          </h1>
        </div>

        <div
          className={`font-mono text-xl font-bold flex items-center gap-2 shrink-0 ${timeLeft < 300 ? "text-red-400" : "text-gray-200"}`}
        >
          <Clock className="w-5 h-5" />
          {formatClock(timeLeft)}
        </div>

        <div>
          <button
            type="button"
            onClick={handleEndClass}
            disabled={endingLesson}
            className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-1.5 rounded transition-colors"
          >
            {teacherCanEnd ? (endingLesson ? "结束中..." : "结束课程") : "离开"}
          </button>
          {teacherCanEnd && (
            <button
              type="button"
              onClick={handleLeaveClass}
              className="ml-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium px-4 py-1.5 rounded transition-colors"
            >
              普通离开
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto min-h-0 relative">
          <div className="rounded-xl border border-gray-700 bg-gray-800/80 p-4 text-sm text-gray-300">
            <p className="text-gray-400 mb-2">
              音视频为界面占位（本阶段未接入 Agora）；课堂文字消息通过 WebSocket 与后端实时同步。
            </p>
          </div>

          <div className="flex-1 bg-gray-800 rounded-2xl overflow-hidden relative border border-gray-700 min-h-[200px]">
            {isVideoOn ? (
              <img
                src="https://images.unsplash.com/photo-1746105625407-5d49d69a2a47?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
                alt="Teacher placeholder"
                className="w-full h-full object-cover min-h-[200px]"
              />
            ) : (
              <div className="w-full h-full min-h-[200px] flex items-center justify-center bg-gray-800">
                <VideoOff className="w-10 h-10 text-gray-500" />
              </div>
            )}
            <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-lg text-sm flex items-center gap-2">
              <Mic className="w-3 h-3 text-white" /> 老师画面（占位）
            </div>
          </div>

          <div className="absolute top-8 right-8 w-48 aspect-video bg-gray-800 rounded-xl overflow-hidden shadow-2xl border border-gray-700 z-10 hidden sm:block">
            <img
              src="https://images.unsplash.com/photo-1586388750948-16833a41ee95?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
              alt="Self placeholder"
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded text-xs">
              我的画面（占位）
            </div>
          </div>

          <div className="h-20 bg-gray-800 rounded-2xl flex items-center justify-center gap-4 border border-gray-700">
            <button
              type="button"
              onClick={() => setIsMicOn(!isMicOn)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isMicOn ? "bg-gray-700 hover:bg-gray-600 text-white" : "bg-red-500 hover:bg-red-600 text-white"}`}
            >
              {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
            <button
              type="button"
              onClick={() => setIsVideoOn(!isVideoOn)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isVideoOn ? "bg-gray-700 hover:bg-gray-600 text-white" : "bg-red-500 hover:bg-red-600 text-white"}`}
            >
              {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>
            <button
              type="button"
              className="w-12 h-12 rounded-full bg-gray-700 hover:bg-gray-600 text-white flex items-center justify-center transition-colors"
            >
              <Share className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={teacherCanEnd ? handleEndClass : handleLeaveClass}
              disabled={endingLesson}
              className="w-16 h-12 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-colors shadow-lg shadow-red-900/50"
            >
              {endingLesson ? <Loader2 className="w-5 h-5 animate-spin" /> : <PhoneOff className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className="w-full lg:w-80 bg-gray-900 border-l border-gray-800 flex flex-col flex-shrink-0 h-64 lg:h-auto min-h-0">
          <div className="flex border-b border-gray-800">
            <button
              type="button"
              onClick={() => setActiveTab("chat")}
              className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === "chat" ? "text-blue-400 border-b-2 border-blue-400" : "text-gray-400 hover:text-gray-200"}`}
            >
              <MessageSquare className="w-4 h-4" /> 聊天
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("materials")}
              className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === "materials" ? "text-blue-400 border-b-2 border-blue-400" : "text-gray-400 hover:text-gray-200"}`}
            >
              <FileText className="w-4 h-4" /> 课件与笔记
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-gray-900 min-h-0">
            {activeTab === "chat" ? (
              <div className="space-y-4">
                {historyLoading && (
                  <p className="text-xs text-gray-500">加载历史消息…</p>
                )}
                {fetchError && (
                  <div className="flex items-start gap-2 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{fetchError}</span>
                  </div>
                )}
                {wsError && (
                  <div className="flex items-start gap-2 text-amber-400 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{wsError}</span>
                  </div>
                )}
                <div className="bg-gray-800 p-3 rounded-lg text-sm text-gray-300">
                  <div className="font-bold text-blue-400 mb-1 text-xs">系统消息</div>
                  课程聊天已连接后端；请勿在聊天中透露支付密码或私下交易。
                </div>

                {messages.map((m) => {
                  const mine = myUserId && m.sender_id === myUserId;
                  return (
                    <div
                      key={m.id}
                      className={`space-y-1 ${mine ? "text-right" : ""}`}
                    >
                      <div className="text-xs text-gray-500">
                        {mine ? "我" : "对方"} · {formatMsgTime(m.created_at)}
                      </div>
                      <div
                        className={`inline-block max-w-[95%] p-3 rounded-lg text-sm text-left ${
                          mine
                            ? "bg-blue-600 text-white rounded-tr-none"
                            : "bg-gray-800 text-gray-200 rounded-tl-none"
                        }`}
                      >
                        {m.content}
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-gray-800 border border-gray-700 p-3 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-gray-700 transition-colors">
                  <div className="bg-red-500/20 text-red-400 p-2 rounded">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-200 truncate">
                      示例课件.pdf
                    </div>
                    <div className="text-xs text-gray-500">占位 · MVP</div>
                  </div>
                </div>
                <div className="mt-6">
                  <div className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">
                    课堂笔记
                  </div>
                  <textarea
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-gray-200 outline-none focus:border-blue-500 resize-none h-32"
                    placeholder="私人笔记（本地草稿，未接后端）"
                  />
                </div>
              </div>
            )}
          </div>

          {activeTab === "chat" && (
            <div className="p-3 border-t border-gray-800 bg-gray-900 shrink-0">
              <div className="bg-gray-800 rounded-lg flex items-center pr-1 border border-gray-700 focus-within:border-blue-500 transition-colors">
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendChat();
                    }
                  }}
                  placeholder="发送消息…"
                  className="flex-1 bg-transparent text-sm text-white px-3 py-2 outline-none"
                />
                <button
                  type="button"
                  onClick={sendChat}
                  disabled={!draft.trim()}
                  className="p-1.5 text-blue-400 hover:bg-gray-700 rounded transition-colors disabled:opacity-40"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
