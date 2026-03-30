import { useState } from "react";
import { Link } from "react-router";
import { Search, Filter, Star, Clock, Video, Globe2 } from "lucide-react";

export function Teachers() {
  const [activeTab, setActiveTab] = useState("all");

  const mockTeachers = [
    {
      id: 1,
      name: "Trang Nguyen",
      avatar: "https://images.unsplash.com/photo-1746105625407-5d49d69a2a47?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2aWV0bmFtZXNlJTIwdGVhY2hlciUyMHBvcnRyYWl0fGVufDF8fHx8MTc3NDg2MTI3Mnww&ixlib=rb-4.1.0&q=80&w=1080",
      rating: 4.9,
      reviews: 128,
      lessons: 450,
      price: 150000,
      title: "武汉大学留学生 · HSK专业户",
      tags: ["HSK备考", "越南语授课", "大学生"],
      description: "大家好，我是小庄，目前在武汉大学读研究生。我曾经以高分通过HSK5和HSK6，非常了解越南学生考HSK的难点。我的课程注重实战和考试技巧，同时我可以用流利的越南语为你解答所有疑惑。",
      available: "今晚有空"
    },
    {
      id: 2,
      name: "Tuan Le",
      avatar: "https://images.unsplash.com/photo-1722099588943-33adb4d37bc6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2aWV0bmFtZXNlJTIwbWFsZSUyMHRlYWNoZXIlMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzQ4NjEyNzh8MA&ixlib=rb-4.1.0&q=80&w=1080",
      rating: 5.0,
      reviews: 89,
      lessons: 320,
      price: 200000,
      title: "资深中文导游 · 实用口语专家",
      tags: ["商务沟通", "旅游中文", "口语提升"],
      description: "在越南从事中文导游工作超过5年，每天都在跟中国人打交道。如果你想学会在实际工作和生活中怎么和中国人顺畅交流，找我准没错。我不教枯燥的语法，只教最有用的实战口语！",
      available: "明天有空"
    },
    {
      id: 3,
      name: "Mai Phung",
      avatar: "https://images.unsplash.com/photo-1698556954522-ae28ac7f61d6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2aWV0bmFtZXNlJTIwdGVhY2hlciUyMHBvcnRyYWl0JTIwaGFwcHl8ZW58MXx8fHwxNzc0ODYxMjkyfDA&ixlib=rb-4.1.0&q=80&w=1080",
      rating: 4.8,
      reviews: 45,
      lessons: 120,
      price: 250000,
      title: "对外汉语专业 · 零基础入门",
      tags: ["零基础入门", "发音纠正", "专业教师"],
      description: "对外汉语专业本科毕业，有系统的教学方法。擅长从拼音开始，纠正越南学生常见的发音错误。我的课堂氛围轻松愉快，非常有耐心，适合完全没有接触过中文的新手。",
      available: "本周有空"
    },
    {
      id: 4,
      name: "Li Ming (李明)",
      avatar: "https://images.unsplash.com/photo-1583147987529-b2e1515f2b51?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2aWV0bmFtZXNlJTIwdGVhY2hlciUyMHBvcnRyYWl0JTIwZnJpZW5kbHl8ZW58MXx8fHwxNzc0ODYxMzE0fDA&ixlib=rb-4.1.0&q=80&w=1080",
      rating: 4.9,
      reviews: 210,
      lessons: 800,
      price: 300000,
      title: "在越中企管理人员 · 沉浸式口语",
      tags: ["母语者", "高级商务", "全中文授课"],
      description: "我是中国人，目前在平阳省的中资企业工作。想进中企拿高薪？我可以教你最地道的职场中文、写中文邮件、做中文汇报。注意：我的课程为全中文沉浸式授课，适合有一定基础的学生。",
      available: "周末有空"
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row gap-8">
        
        {/* Sidebar Filters */}
        <div className="w-full md:w-64 flex-shrink-0">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 sticky top-24">
            <div className="flex items-center gap-2 mb-6 text-lg font-bold text-gray-900 border-b border-gray-100 pb-3">
              <Filter className="h-5 w-5" /> 筛选条件
            </div>
            
            <div className="space-y-6">
              {/* Category */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">老师类型</h3>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-gray-700">在华越南留学生</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-gray-700">越南本地中文导游</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-gray-700">中文母语者</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-gray-700">专业中文老师</span>
                  </label>
                </div>
              </div>

              {/* Price */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">价格区间 (VND/时)</h3>
                <div className="flex items-center gap-2">
                  <input type="number" placeholder="最低" className="w-full text-sm border border-gray-300 rounded px-2 py-1" />
                  <span className="text-gray-400">-</span>
                  <input type="number" placeholder="最高" className="w-full text-sm border border-gray-300 rounded px-2 py-1" />
                </div>
              </div>

              {/* Skills */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">擅长方向</h3>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs border border-blue-200 bg-blue-50 text-blue-700 px-3 py-1 rounded-full cursor-pointer hover:bg-blue-100">HSK备考</span>
                  <span className="text-xs border border-gray-200 bg-gray-50 text-gray-700 px-3 py-1 rounded-full cursor-pointer hover:bg-gray-100">零基础</span>
                  <span className="text-xs border border-gray-200 bg-gray-50 text-gray-700 px-3 py-1 rounded-full cursor-pointer hover:bg-gray-100">实用口语</span>
                  <span className="text-xs border border-gray-200 bg-gray-50 text-gray-700 px-3 py-1 rounded-full cursor-pointer hover:bg-gray-100">商务沟通</span>
                  <span className="text-xs border border-gray-200 bg-gray-50 text-gray-700 px-3 py-1 rounded-full cursor-pointer hover:bg-gray-100">少儿中文</span>
                </div>
              </div>
              
              <button className="w-full bg-blue-600 text-white font-medium py-2 rounded-lg hover:bg-blue-700 transition-colors">
                应用筛选
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {/* Search Bar */}
          <div className="bg-white p-2 rounded-xl flex items-center shadow-sm border border-gray-200 mb-6">
            <div className="flex-1 flex items-center px-4">
              <Search className="h-5 w-5 text-gray-400" />
              <input 
                type="text" 
                placeholder="搜索老师名字、专业或标签..." 
                className="w-full pl-3 pr-4 py-2 outline-none text-gray-700 placeholder-gray-400 focus:ring-0"
              />
            </div>
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg transition-colors">
              搜索
            </button>
          </div>

          {/* Sort Tabs */}
          <div className="flex gap-6 mb-6 border-b border-gray-200">
            <button 
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'all' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('all')}
            >
              综合推荐
            </button>
            <button 
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'rating' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('rating')}
            >
              评分最高
            </button>
            <button 
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'price' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('price')}
            >
              价格最低
            </button>
          </div>

          <p className="text-gray-500 text-sm mb-4">找到 142 位符合条件的老师</p>

          {/* Teacher List */}
          <div className="space-y-4">
            {mockTeachers.map(teacher => (
              <div key={teacher.id} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-lg transition-shadow flex flex-col sm:flex-row gap-6">
                
                {/* Avatar Column */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className="w-28 h-28 rounded-full overflow-hidden mb-3 border-2 border-gray-100">
                    <img src={teacher.avatar} alt={teacher.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="bg-green-50 text-green-700 text-xs px-2 py-1 rounded-full flex items-center gap-1 font-medium">
                    <Video className="w-3 h-3" /> 可在线上课
                  </div>
                </div>

                {/* Info Column */}
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
                        ₫{(teacher.price / 1000).toFixed(0)}k <span className="text-sm font-normal text-gray-500">/ 时</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mb-3 text-sm">
                    <div className="flex items-center gap-1 text-yellow-500 font-bold">
                      <Star className="w-4 h-4 fill-current" /> {teacher.rating.toFixed(1)}
                    </div>
                    <span className="text-gray-300">|</span>
                    <span className="text-gray-600">{teacher.reviews} 条评价</span>
                    <span className="text-gray-300">|</span>
                    <span className="text-gray-600">已上 {teacher.lessons} 节课</span>
                  </div>

                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {teacher.description}
                  </p>

                  <div className="mt-auto flex justify-between items-center">
                    <div className="flex gap-2">
                      {teacher.tags.map(tag => (
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
                        查看日历
                      </Link>
                      <Link 
                        to={`/teachers/${teacher.id}`} 
                        className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
                      >
                        预约试课
                      </Link>
                    </div>
                  </div>
                </div>

              </div>
            ))}
          </div>
          
          {/* Pagination */}
          <div className="mt-8 flex justify-center gap-2">
            <button className="w-10 h-10 flex items-center justify-center rounded border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-50" disabled>&lt;</button>
            <button className="w-10 h-10 flex items-center justify-center rounded bg-blue-600 text-white font-medium">1</button>
            <button className="w-10 h-10 flex items-center justify-center rounded border border-gray-200 text-gray-700 hover:bg-gray-50">2</button>
            <button className="w-10 h-10 flex items-center justify-center rounded border border-gray-200 text-gray-700 hover:bg-gray-50">3</button>
            <span className="w-10 h-10 flex items-center justify-center text-gray-500">...</span>
            <button className="w-10 h-10 flex items-center justify-center rounded border border-gray-200 text-gray-700 hover:bg-gray-50">14</button>
            <button className="w-10 h-10 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50">&gt;</button>
          </div>

        </div>
      </div>
    </div>
  );
}
