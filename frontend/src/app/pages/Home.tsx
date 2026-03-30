import { Link } from "react-router";
import { Search, Globe, Users, Clock, ShieldCheck, CheckCircle2 } from "lucide-react";

export function Home() {
  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="relative bg-blue-600 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 lg:pt-32 lg:pb-40 relative z-10">
          <div className="lg:w-1/2">
            <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight mb-6">
              用越南语学中文<br />
              <span className="text-yellow-400">找靠谱老师，随时随地</span>
            </h1>
            <p className="text-lg text-blue-100 mb-8 max-w-xl leading-relaxed">
              CNVN（中越通）专为越南学习者打造。无论你是准备HSK、做跨境电商，还是想了解中国文化，这里都有适合你的老师。
            </p>
            
            <div className="bg-white p-2 rounded-xl flex items-center shadow-xl max-w-lg">
              <div className="flex-1 flex items-center px-4">
                <Search className="h-5 w-5 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="你想学什么？(如: 口语, HSK)" 
                  className="w-full pl-3 pr-4 py-3 outline-none text-gray-700 placeholder-gray-400 focus:ring-0"
                />
              </div>
              <Link to="/teachers" className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg transition-colors shadow-md">
                寻找老师
              </Link>
            </div>
            
            <div className="mt-8 flex items-center gap-4 text-sm text-blue-200">
              <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-green-400" /> 真实评价</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-green-400" /> 随时预约</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-green-400" /> 平台保障</span>
            </div>
          </div>
        </div>

        {/* Hero Image / Illustration area */}
        <div className="hidden lg:block absolute right-0 top-0 w-1/2 h-full z-0">
          <div className="absolute inset-0 bg-gradient-to-l from-transparent to-blue-600 z-10"></div>
          <img 
            src="https://images.unsplash.com/photo-1586388750948-16833a41ee95?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc2lhbiUyMHN0dWRlbnQlMjBsZWFybmluZyUyMGxhcHRvcHxlbnwxfHx8fDE3NzQ4NjEyNzh8MA&ixlib=rb-4.1.0&q=80&w=1080" 
            alt="Student learning online" 
            className="w-full h-full object-cover opacity-90"
          />
        </div>
      </section>

      {/* Why choose us */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">为什么选择 CNVN？</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              专为越南市场设计的中文学习平台，解决线下找老师难、价格贵的问题。
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-10">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
                <Globe className="h-7 w-7 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">越南语辅助教学</h3>
              <p className="text-gray-600 leading-relaxed">
                我们的许多老师是在华越南留学生或中文流利的越南导游，能用流利的越南语为您讲解中文难点，入门更轻松。
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center mb-6">
                <Clock className="h-7 w-7 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">时间灵活，在线上课</h3>
              <p className="text-gray-600 leading-relaxed">
                无需通勤，下班或课后随时可用手机或电脑上课。平台内置高清视频系统，随时随地开启学习。
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center mb-6">
                <ShieldCheck className="h-7 w-7 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">自主定价，高性价比</h3>
              <p className="text-gray-600 leading-relaxed">
                海量兼职教师资源，价格公开透明。无论你的预算是多少，都能找到满足你学习需求的靠谱老师。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Teachers */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">推荐教师</h2>
              <p className="text-gray-600">从数百名优质老师中挑选</p>
            </div>
            <Link to="/teachers" className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              查看全部 <span className="text-xl">→</span>
            </Link>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Teacher Card 1 */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-xl transition-all group">
              <div className="h-48 overflow-hidden relative">
                <img 
                  src="https://images.unsplash.com/photo-1746105625407-5d49d69a2a47?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2aWV0bmFtZXNlJTIwdGVhY2hlciUyMHBvcnRyYWl0fGVufDF8fHx8MTc3NDg2MTI3Mnww&ixlib=rb-4.1.0&q=80&w=1080" 
                  alt="Teacher Trang" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-bold text-gray-900 flex items-center gap-1">
                  ⭐ 4.9
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-lg text-gray-900 mb-1">Trang Nguyen</h3>
                <p className="text-sm text-gray-500 mb-3">武汉大学留学生 · HSK专业户</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded">HSK备考</span>
                  <span className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded">越南语授课</span>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                  <div className="font-bold text-lg text-gray-900">
                    ₫150k <span className="text-xs text-gray-500 font-normal">/ 小时</span>
                  </div>
                  <Link to="/teachers/1" className="text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-md">
                    查看详情
                  </Link>
                </div>
              </div>
            </div>

            {/* Teacher Card 2 */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-xl transition-all group">
              <div className="h-48 overflow-hidden relative">
                <img 
                  src="https://images.unsplash.com/photo-1722099588943-33adb4d37bc6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2aWV0bmFtZXNlJTIwbWFsZSUyMHRlYWNoZXIlMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzQ4NjEyNzh8MA&ixlib=rb-4.1.0&q=80&w=1080" 
                  alt="Teacher Tuan" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-bold text-gray-900 flex items-center gap-1">
                  ⭐ 5.0
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-lg text-gray-900 mb-1">Tuan Le</h3>
                <p className="text-sm text-gray-500 mb-3">资深中文导游 · 实用口语专家</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="text-xs bg-orange-50 text-orange-600 px-2 py-1 rounded">商务沟通</span>
                  <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded">旅游中文</span>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                  <div className="font-bold text-lg text-gray-900">
                    ₫200k <span className="text-xs text-gray-500 font-normal">/ 小时</span>
                  </div>
                  <Link to="/teachers/2" className="text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-md">
                    查看详情
                  </Link>
                </div>
              </div>
            </div>

            {/* Teacher Card 3 */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-xl transition-all group">
              <div className="h-48 overflow-hidden relative">
                <img 
                  src="https://images.unsplash.com/photo-1698556954522-ae28ac7f61d6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2aWV0bmFtZXNlJTIwdGVhY2hlciUyMHBvcnRyYWl0JTIwaGFwcHl8ZW58MXx8fHwxNzc0ODYxMjkyfDA&ixlib=rb-4.1.0&q=80&w=1080" 
                  alt="Teacher Mai" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-bold text-gray-900 flex items-center gap-1">
                  ⭐ 4.8
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-lg text-gray-900 mb-1">Mai Phung</h3>
                <p className="text-sm text-gray-500 mb-3">对外汉语专业 · 零基础入门</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="text-xs bg-purple-50 text-purple-600 px-2 py-1 rounded">零基础入门</span>
                  <span className="text-xs bg-pink-50 text-pink-600 px-2 py-1 rounded">儿童中文</span>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                  <div className="font-bold text-lg text-gray-900">
                    ₫250k <span className="text-xs text-gray-500 font-normal">/ 小时</span>
                  </div>
                  <Link to="/teachers/3" className="text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-md">
                    查看详情
                  </Link>
                </div>
              </div>
            </div>
            
            {/* Teacher Card 4 */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-xl transition-all group">
              <div className="h-48 overflow-hidden relative">
                <img 
                  src="https://images.unsplash.com/photo-1583147987529-b2e1515f2b51?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2aWV0bmFtZXNlJTIwdGVhY2hlciUyMHBvcnRyYWl0JTIwZnJpZW5kbHl8ZW58MXx8fHwxNzc0ODYxMzE0fDA&ixlib=rb-4.1.0&q=80&w=1080" 
                  alt="Teacher Li" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-bold text-gray-900 flex items-center gap-1">
                  ⭐ 4.9
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-lg text-gray-900 mb-1">Li Ming</h3>
                <p className="text-sm text-gray-500 mb-3">在越中企高管 · 沉浸式口语</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded">母语者</span>
                  <span className="text-xs bg-orange-50 text-orange-600 px-2 py-1 rounded">高级商务</span>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                  <div className="font-bold text-lg text-gray-900">
                    ₫300k <span className="text-xs text-gray-500 font-normal">/ 小时</span>
                  </div>
                  <Link to="/teachers/4" className="text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-md">
                    查看详情
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-900 py-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pattern-dots"></div>
        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <h2 className="text-3xl font-bold text-white mb-6">想成为中文老师赚取额外收入？</h2>
          <p className="text-xl text-blue-200 mb-10">
            如果您是在华越南留学生、中文导游或中文母语者，现在就加入我们，<br/>
            利用业余时间教越南人学中文，自己定价，时间灵活！
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link to="/dashboard/teacher" className="bg-white text-blue-900 font-bold px-8 py-4 rounded-lg hover:bg-gray-100 transition-colors shadow-lg text-lg">
              注册成为教师
            </Link>
            <Link to="/teachers" className="bg-transparent border-2 border-white text-white font-bold px-8 py-4 rounded-lg hover:bg-white/10 transition-colors text-lg">
              我是学生，找老师
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
