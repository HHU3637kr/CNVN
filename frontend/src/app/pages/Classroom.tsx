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
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { API_BASE_URL, getAccessToken, wsUrlForLesson } from "@/app/lib/api";

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
  const [historyLoading, setHistoryLoading] = useState(true);

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
    if (!lessonId || !token) {
      setHistoryLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setFetchError(null);
      try {
        const meRes = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!meRes.ok) {
          throw new Error(meRes.status === 401 ? "登录已过期，请重新登录" : "无法获取用户信息");
        }
        const me = await meRes.json();
        if (!cancelled) setMyUserId(me.id);

        const msgRes = await fetch(
          `${API_BASE_URL}/api/v1/lessons/${lessonId}/messages?page=1&page_size=100`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!msgRes.ok) {
          const d = await msgRes.json().catch(() => ({}));
          throw new Error(
            typeof d.detail === "string" ? d.detail : `加载消息失败 (${msgRes.status})`
          );
        }
        const data = await msgRes.json();
        if (!cancelled) {
          setMessages(
            (data.items as ChatMsg[]).map((m) => ({
              ...m,
              id: String(m.id),
              lesson_id: String(m.lesson_id),
              sender_id: String(m.sender_id),
            }))
          );
        }
      } catch (e) {
        if (!cancelled) {
          setFetchError(e instanceof Error ? e.message : "加载失败");
        }
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
    if (!lessonId || !token) return;

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
  }, [lessonId, token]);

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

  const handleEndClass = () => {
    if (window.confirm("确定要结束课程吗？")) {
      navigate("/dashboard/student");
    }
  };

  if (!lessonId) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6">
        <p className="text-gray-400">无效的课堂链接</p>
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
            在线课堂 · {lessonId.slice(0, 8)}…
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
            className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-1.5 rounded transition-colors"
          >
            离开
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto min-h-0 relative">
          <div className="rounded-xl border border-gray-700 bg-gray-800/80 p-4 text-sm text-gray-300">
            <p className="text-gray-400 mb-2">
              音视频为界面占位（本阶段未接入 Agora）；课堂文字消息通过 WebSocket 与后端实时同步。
            </p>
            {!token && (
              <div className="flex items-start gap-2 text-amber-300">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>
                  未检测到登录令牌。请先{" "}
                  <Link to="/" className="text-blue-400 underline">
                    登录
                  </Link>{" "}
                  并将 <code className="text-gray-200">access_token</code> 写入{" "}
                  <code className="text-gray-200">localStorage</code>（键名{" "}
                  <code className="text-gray-200">cnvn_access_token</code> 或{" "}
                  <code className="text-gray-200">access_token</code>）。
                </span>
              </div>
            )}
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
              onClick={handleEndClass}
              className="w-16 h-12 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-colors shadow-lg shadow-red-900/50"
            >
              <PhoneOff className="w-5 h-5" />
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
                  placeholder={token ? "发送消息…" : "请先登录"}
                  disabled={!token}
                  className="flex-1 bg-transparent text-sm text-white px-3 py-2 outline-none disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={sendChat}
                  disabled={!token || !draft.trim()}
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
