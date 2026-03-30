import { BarChart3, Calendar, Clock, DollarSign, Settings, Users, Video } from "lucide-react";
import { Link } from "react-router";

export function TeacherDashboard() {
  const stats = [
    { label: "本月收入", value: "₫4,500k", icon: DollarSign, color: "text-green-600", bg: "bg-green-100" },
    { label: "本月完课数", value: "30 节", icon: Video, color: "text-blue-600", bg: "bg-blue-100" },
    { label: "学生人数", value: "12 人", icon: Users, color: "text-purple-600", bg: "bg-purple-100" },
    { label: "综合评分", value: "4.9", icon: BarChart3, color: "text-yellow-600", bg: "bg-yellow-100" },
  ];

  const upcomingClasses = [
    {
      id: 1,
      studentName: "An Nguyen",
      date: "今天",
      time: "20:00 - 21:00",
      topic: "HSK3 词汇强化",
      status: "待上课"
    },
    {
      id: 2,
      studentName: "Minh Tran",
      date: "明天",
      time: "19:00 - 20:00",
      topic: "实用口语练习",
      status: "待上课"
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">教师控制台</h1>
          <p className="text-gray-600 mt-2">管理您的课程、收入和学生。</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium">
            <Settings className="w-4 h-4" /> 档案设置
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm">
            <Calendar className="w-4 h-4" /> 排课日历
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
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
        
        {/* Left Column (Main Schedule) */}
        <div className="lg:col-span-2 space-y-8">
          
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" /> 接下来的课程
              </h2>
            </div>
            
            <div className="divide-y divide-gray-100">
              {upcomingClasses.map(cls => (
                <div key={cls.id} className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-700 text-lg">
                      {cls.studentName.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-gray-900 mb-1">{cls.topic}</div>
                      <div className="text-sm text-gray-500 flex items-center gap-3">
                        <span>学生: {cls.studentName}</span>
                        <span>{cls.date} {cls.time}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 w-full sm:w-auto mt-4 sm:mt-0">
                    <button className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-white hover:shadow-sm transition-all">
                      联系学生
                    </button>
                    {cls.id === 1 ? (
                      <Link 
                        to={`/classroom/${cls.id}`} 
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all shadow-sm shadow-blue-600/20 animate-pulse flex items-center gap-2 justify-center"
                      >
                        <Video className="w-4 h-4" /> 进入教室
                      </Link>
                    ) : (
                      <button className="px-6 py-2 bg-gray-100 text-gray-400 rounded-lg text-sm font-medium cursor-not-allowed">
                        未到时间
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>

        {/* Right Column (Widgets) */}
        <div className="space-y-8">
          
          {/* Notification / To Do */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">待办事项</h2>
            <div className="space-y-4">
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
                <div className="font-bold text-orange-800 mb-1">新的试课请求</div>
                <p className="text-sm text-orange-700 mb-3">学生 Hoa Le 预约了周四 19:00 的试课，请在 24 小时内确认。</p>
                <div className="flex gap-2">
                  <button className="bg-orange-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-orange-700">接受</button>
                  <button className="bg-white text-orange-600 border border-orange-200 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-orange-50">拒绝</button>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <div className="font-bold text-blue-800 mb-1">评价提醒</div>
                <p className="text-sm text-blue-700">您有 2 节已完成的课程需要对学生进行评价反馈。</p>
              </div>
            </div>
          </section>

          {/* Quick Stats */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">平台抽成说明</h2>
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                <span>当前月完课时长</span>
                <span className="font-bold text-gray-900">30 小时</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                <span>当前适用抽成比例</span>
                <span className="font-bold text-blue-600">15%</span>
              </div>
              <div className="text-xs text-gray-500 mt-2">
                提示：当月完课超过 50 小时，平台抽成将降至 10%。继续加油！
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
