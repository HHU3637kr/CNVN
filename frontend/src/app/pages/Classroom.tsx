import { useState, useEffect } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, MessageSquare, FileText, Send, Share, Clock, AlertCircle } from "lucide-react";
import { Link, useNavigate } from "react-router";

export function Classroom() {
  const navigate = useNavigate();
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [activeTab, setActiveTab] = useState("chat");
  const [timeLeft, setTimeLeft] = useState(3600); // 60 mins in seconds

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleEndClass = () => {
    if (window.confirm("确定要结束课程吗？")) {
      navigate("/dashboard/student");
    }
  };

  return (
    <div className="h-screen bg-gray-900 flex flex-col font-sans text-white overflow-hidden">
      
      {/* Top Bar */}
      <div className="h-14 bg-gray-900 border-b border-gray-800 flex justify-between items-center px-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-xs font-bold px-2 py-1 rounded text-white flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            录制中
          </div>
          <h1 className="font-medium text-gray-200 hidden sm:block">HSK3 词汇强化 - Trang Nguyen</h1>
        </div>
        
        <div className={`font-mono text-xl font-bold flex items-center gap-2 ${timeLeft < 300 ? 'text-red-400' : 'text-gray-200'}`}>
          <Clock className="w-5 h-5" />
          {formatTime(timeLeft)}
        </div>

        <div>
          <button 
            onClick={handleEndClass}
            className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-1.5 rounded transition-colors"
          >
            结束课程
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Video Area */}
        <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto min-h-0 relative">
          
          {/* Main Video (Teacher) */}
          <div className="flex-1 bg-gray-800 rounded-2xl overflow-hidden relative border border-gray-700">
            {isVideoOn ? (
              <img 
                src="https://images.unsplash.com/photo-1746105625407-5d49d69a2a47?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2aWV0bmFtZXNlJTIwdGVhY2hlciUyMHBvcnRyYWl0fGVufDF8fHx8MTc3NDg2MTI3Mnww&ixlib=rb-4.1.0&q=80&w=1080" 
                alt="Teacher Video" 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-800">
                <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center">
                  <VideoOff className="w-10 h-10 text-gray-500" />
                </div>
              </div>
            )}
            <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-lg text-sm flex items-center gap-2">
              <Mic className="w-3 h-3 text-white" /> Trang Nguyen (老师)
            </div>
          </div>

          {/* Self Video (PIP) */}
          <div className="absolute top-8 right-8 w-48 aspect-video bg-gray-800 rounded-xl overflow-hidden shadow-2xl border border-gray-700 z-10 hidden sm:block">
             <img 
                src="https://images.unsplash.com/photo-1586388750948-16833a41ee95?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc2lhbiUyMHN0dWRlbnQlMjBsZWFybmluZyUyMGxhcHRvcHxlbnwxfHx8fDE3NzQ4NjEyNzh8MA&ixlib=rb-4.1.0&q=80&w=1080" 
                alt="My Video" 
                className="w-full h-full object-cover"
              />
            <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded text-xs">
              我
            </div>
          </div>

          {/* Controls */}
          <div className="h-20 bg-gray-800 rounded-2xl flex items-center justify-center gap-4 border border-gray-700">
            <button 
              onClick={() => setIsMicOn(!isMicOn)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isMicOn ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}
            >
              {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
            <button 
              onClick={() => setIsVideoOn(!isVideoOn)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isVideoOn ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}
            >
              {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>
            <button className="w-12 h-12 rounded-full bg-gray-700 hover:bg-gray-600 text-white flex items-center justify-center transition-colors">
              <Share className="w-5 h-5" />
            </button>
            <button 
              onClick={handleEndClass}
              className="w-16 h-12 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-colors shadow-lg shadow-red-900/50"
            >
              <PhoneOff className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Side Panel */}
        <div className="w-full lg:w-80 bg-gray-900 border-l border-gray-800 flex flex-col flex-shrink-0 h-64 lg:h-auto">
          
          {/* Tabs */}
          <div className="flex border-b border-gray-800">
            <button 
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'chat' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-200'}`}
            >
              <MessageSquare className="w-4 h-4" /> 聊天
            </button>
            <button 
              onClick={() => setActiveTab('materials')}
              className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'materials' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-200'}`}
            >
              <FileText className="w-4 h-4" /> 课件与笔记
            </button>
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-900">
            {activeTab === 'chat' ? (
              <div className="space-y-4">
                <div className="bg-gray-800 p-3 rounded-lg text-sm text-gray-300">
                  <div className="font-bold text-blue-400 mb-1 text-xs">系统消息</div>
                  课程已开始。请注意保护个人隐私，不要私下交易。
                </div>
                
                <div className="space-y-1">
                  <div className="text-xs text-gray-500">Trang Nguyen 20:05</div>
                  <div className="bg-gray-800 p-3 rounded-lg rounded-tl-none text-sm text-gray-200 inline-block">
                    你好！我们今天复习第三课的词汇，准备好了吗？
                  </div>
                </div>

                <div className="space-y-1 text-right">
                  <div className="text-xs text-gray-500">我 20:06</div>
                  <div className="bg-blue-600 p-3 rounded-lg rounded-tr-none text-sm text-white inline-block text-left">
                    准备好了老师！
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-gray-800 border border-gray-700 p-3 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-gray-700 transition-colors">
                  <div className="bg-red-500/20 text-red-400 p-2 rounded">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-200 truncate">HSK3_Lesson3_Vocab.pdf</div>
                    <div className="text-xs text-gray-500">老师分享 · 2.4 MB</div>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">课堂笔记</div>
                  <textarea 
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-gray-200 outline-none focus:border-blue-500 resize-none h-32"
                    placeholder="在此记录您的私人笔记（课后可查看）..."
                  ></textarea>
                </div>
              </div>
            )}
          </div>

          {/* Chat Input */}
          {activeTab === 'chat' && (
            <div className="p-3 border-t border-gray-800 bg-gray-900">
              <div className="bg-gray-800 rounded-lg flex items-center pr-1 border border-gray-700 focus-within:border-blue-500 transition-colors">
                <input 
                  type="text" 
                  placeholder="发送消息..." 
                  className="flex-1 bg-transparent text-sm text-white px-3 py-2 outline-none"
                />
                <button className="p-1.5 text-blue-400 hover:bg-gray-700 rounded transition-colors">
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
