import { useParams, Link } from "react-router";
import { Star, Video, CheckCircle2, Globe2, Calendar, Clock, MessageSquare, Play, ShieldCheck } from "lucide-react";
import { useState } from "react";

export function TeacherProfile() {
  const { id } = useParams();
  const [selectedDate, setSelectedDate] = useState(0);

  // Mock data for teacher
  const teacher = {
    id: 1,
    name: "Trang Nguyen",
    avatar: "https://images.unsplash.com/photo-1746105625407-5d49d69a2a47?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2aWV0bmFtZXNlJTIwdGVhY2hlciUyMHBvcnRyYWl0fGVufDF8fHx8MTc3NDg2MTI3Mnww&ixlib=rb-4.1.0&q=80&w=1080",
    rating: 4.9,
    reviews: 128,
    lessons: 450,
    price: 150000,
    title: "武汉大学留学生 · HSK专业户",
    tags: ["HSK备考", "越南语授课", "大学生"],
    about: `大家好，我是小庄，目前在武汉大学读研究生。我曾经以高分通过HSK5和HSK6，非常了解越南学生考HSK的难点。
    
我的课程特色：
1. 专注 HSK 1-6 级考试辅导，提供独家复习资料
2. 纠正发音，练习日常实用口语
3. 可以用流利的越南语为你解答所有疑惑，入门无障碍
4. 每节课后会有详细的作业和反馈

无论你是刚开始学中文的小白，还是准备冲刺HSK高分，我都能帮你！期待在课堂上见到你。`,
    videoUrl: "https://images.unsplash.com/photo-1698556954522-ae28ac7f61d6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2aWV0bmFtZXNlJTIwdGVhY2hlciUyMHBvcnRyYWl0JTIwaGFwcHl8ZW58MXx8fHwxNzc0ODYxMjkyfDA&ixlib=rb-4.1.0&q=80&w=1080"
  };

  const dates = ["今天", "明天", "周三", "周四", "周五"];
  const times = ["19:00", "20:00", "21:00", "22:00"];

  return (
    <div className="bg-gray-50 min-h-screen pb-20">
      {/* Profile Header Background */}
      <div className="bg-blue-900 h-48 w-full"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-24">
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Left Column (Main Info) */}
          <div className="flex-1 space-y-6">
            
            {/* Main Profile Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 relative">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-white shadow-lg overflow-hidden flex-shrink-0 relative -mt-16 bg-white">
                  <img src={teacher.avatar} alt={teacher.name} className="w-full h-full object-cover" />
                </div>
                
                <div className="flex-1 pt-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                        {teacher.name}
                        <ShieldCheck className="w-6 h-6 text-green-500" title="身份已认证" />
                      </h1>
                      <p className="text-lg text-gray-600 mt-1 flex items-center gap-2">
                        <Globe2 className="w-5 h-5 text-gray-400" /> {teacher.title}
                      </p>
                    </div>
                    <div className="hidden md:flex gap-3">
                      <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
                        <MessageSquare className="w-4 h-4" /> 发私信
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-6 mt-6">
                    <div className="flex items-center gap-2">
                      <div className="flex text-yellow-400">
                        <Star className="w-5 h-5 fill-current" />
                        <Star className="w-5 h-5 fill-current" />
                        <Star className="w-5 h-5 fill-current" />
                        <Star className="w-5 h-5 fill-current" />
                        <Star className="w-5 h-5 fill-current" />
                      </div>
                      <span className="font-bold text-gray-900 text-lg">{teacher.rating.toFixed(1)}</span>
                      <span className="text-gray-500 text-sm">({teacher.reviews} 条评价)</span>
                    </div>
                    
                    <div className="h-6 w-px bg-gray-200"></div>
                    
                    <div className="flex items-center gap-2 text-gray-700">
                      <Video className="w-5 h-5 text-blue-500" />
                      <span className="font-bold">{teacher.lessons}</span> 节完课
                    </div>
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div className="mt-8 flex flex-wrap gap-2">
                {teacher.tags.map((tag, idx) => (
                  <span key={idx} className="bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1.5 rounded-full text-sm font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Video Intro */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6">自我介绍视频</h2>
              <div className="relative rounded-xl overflow-hidden aspect-video bg-gray-900 group cursor-pointer">
                <img src={teacher.videoUrl} alt="Video thumbnail" className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center pl-1 group-hover:scale-110 transition-transform shadow-lg">
                    <Play className="w-8 h-8 text-white fill-current" />
                  </div>
                </div>
              </div>
            </div>

            {/* About Me */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6">关于我</h2>
              <div className="prose prose-blue max-w-none text-gray-600 whitespace-pre-line leading-relaxed">
                {teacher.about}
              </div>
            </div>

            {/* Reviews */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">学生评价 ({teacher.reviews})</h2>
                <div className="flex items-center gap-2 text-yellow-500 font-bold text-lg">
                  <Star className="w-6 h-6 fill-current" /> {teacher.rating.toFixed(1)}
                </div>
              </div>

              <div className="space-y-6">
                {/* Review 1 */}
                <div className="border-b border-gray-100 pb-6">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-500">
                        H
                      </div>
                      <div>
                        <div className="font-bold text-gray-900">Hoa Le</div>
                        <div className="text-xs text-gray-500">2026-03-15 · 已上 12 节课</div>
                      </div>
                    </div>
                    <div className="flex text-yellow-400">
                      <Star className="w-4 h-4 fill-current" />
                      <Star className="w-4 h-4 fill-current" />
                      <Star className="w-4 h-4 fill-current" />
                      <Star className="w-4 h-4 fill-current" />
                      <Star className="w-4 h-4 fill-current" />
                    </div>
                  </div>
                  <p className="text-gray-600">老师非常有耐心，发音很标准。最重要的是能用越南语解释很多中文的语法点，让我这个零基础学起来一点都不吃力。非常推荐！</p>
                </div>
                
                {/* Review 2 */}
                <div className="border-b border-gray-100 pb-6">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-500">
                        M
                      </div>
                      <div>
                        <div className="font-bold text-gray-900">Minh Tran</div>
                        <div className="text-xs text-gray-500">2026-03-02 · 已上 5 节课</div>
                      </div>
                    </div>
                    <div className="flex text-yellow-400">
                      <Star className="w-4 h-4 fill-current" />
                      <Star className="w-4 h-4 fill-current" />
                      <Star className="w-4 h-4 fill-current" />
                      <Star className="w-4 h-4 fill-current" />
                      <Star className="w-4 h-4 fill-current" />
                    </div>
                  </div>
                  <p className="text-gray-600">正在准备HSK4，老师给了很多真题练习，讲解答题技巧非常实用。课后还有针对性的作业，感觉进步很大。</p>
                </div>
              </div>
              
              <button className="w-full mt-6 py-3 border border-gray-200 rounded-lg text-gray-600 font-medium hover:bg-gray-50 transition-colors">
                查看更多评价
              </button>
            </div>
            
          </div>

          {/* Right Column (Booking Widget) */}
          <div className="w-full lg:w-96 flex-shrink-0">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sticky top-24">
              
              <div className="flex justify-between items-center mb-6 pb-6 border-b border-gray-100">
                <div>
                  <div className="text-sm text-gray-500 mb-1">单节课时费 (60分钟)</div>
                  <div className="text-3xl font-bold text-gray-900">
                    ₫{(teacher.price / 1000).toFixed(0)}k
                  </div>
                </div>
              </div>

              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" /> 选择试课时间
              </h3>
              
              {/* Dates */}
              <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                {dates.map((date, idx) => (
                  <button 
                    key={idx}
                    onClick={() => setSelectedDate(idx)}
                    className={`flex-shrink-0 px-4 py-3 rounded-xl border ${
                      selectedDate === idx 
                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold shadow-sm' 
                        : 'border-gray-200 text-gray-600 hover:border-blue-300'
                    } transition-all`}
                  >
                    <div className="text-xs mb-1">{idx === 0 ? '3月30日' : `4月${idx}日`}</div>
                    <div className="text-sm">{date}</div>
                  </button>
                ))}
              </div>

              {/* Times */}
              <div className="grid grid-cols-2 gap-3 mb-8">
                {times.map((time, idx) => (
                  <button key={idx} className="py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50 transition-colors font-medium flex items-center justify-center gap-2">
                    <Clock className="w-4 h-4" /> {time}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <button className="w-full bg-blue-600 text-white font-bold text-lg py-4 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">
                  预约试课
                </button>
                <button className="w-full bg-white border-2 border-blue-600 text-blue-600 font-bold text-lg py-3.5 rounded-xl hover:bg-blue-50 transition-colors">
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
