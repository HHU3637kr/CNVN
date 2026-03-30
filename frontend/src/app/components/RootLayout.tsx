import { Outlet, Link, useLocation } from "react-router";
import { BookOpen, User, Menu, X, LogOut, ChevronDown } from "lucide-react";
import { useState } from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export function RootLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { name: "首页", path: "/" },
    { name: "找老师", path: "/teachers" },
    { name: "我的学习", path: "/dashboard" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex flex-shrink-0 items-center gap-2">
                <div className="w-8 h-8 rounded bg-red-600 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-yellow-400" />
                </div>
                <span className="font-bold text-xl tracking-tight text-gray-900">
                  中越通<span className="text-red-600">CNVN</span>
                </span>
              </Link>
              <div className="hidden sm:ml-10 sm:flex sm:space-x-8">
                {navLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={cn(
                      "inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors",
                      location.pathname === link.path
                        ? "border-red-600 text-gray-900"
                        : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                    )}
                  >
                    {link.name}
                  </Link>
                ))}
              </div>
            </div>
            
            <div className="hidden sm:ml-6 sm:flex sm:items-center space-x-4">
              <Link to="/teachers" className="text-sm font-medium text-gray-500 hover:text-gray-900">
                成为老师
              </Link>
              <div className="h-4 w-px bg-gray-300"></div>
              <div className="flex items-center gap-2 cursor-pointer group relative">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border border-gray-300">
                  <User className="w-5 h-5 text-gray-500" />
                </div>
                <span className="text-sm font-medium text-gray-700">阮明秋</span>
                <ChevronDown className="w-4 h-4 text-gray-500" />
                
                {/* Dropdown menu */}
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-md shadow-lg py-1 border border-gray-100 hidden group-hover:block">
                  <Link to="/dashboard" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    个人中心
                  </Link>
                  <Link to="/dashboard" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    我的课程
                  </Link>
                  <div className="h-px bg-gray-100 my-1"></div>
                  <button className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 flex items-center gap-2">
                    <LogOut className="w-4 h-4" />
                    退出登录
                  </button>
                </div>
              </div>
            </div>

            <div className="-mr-2 flex items-center sm:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-red-500"
              >
                <span className="sr-only">打开主菜单</span>
                {isMobileMenuOpen ? (
                  <X className="block h-6 w-6" aria-hidden="true" />
                ) : (
                  <Menu className="block h-6 w-6" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="sm:hidden border-t border-gray-100">
            <div className="pt-2 pb-3 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "block pl-3 pr-4 py-2 border-l-4 text-base font-medium",
                    location.pathname === link.path
                      ? "bg-red-50 border-red-600 text-red-700"
                      : "border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700"
                  )}
                >
                  {link.name}
                </Link>
              ))}
              <div className="border-t border-gray-200 pt-4 pb-3">
                <div className="flex items-center px-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <User className="w-6 h-6 text-gray-500" />
                    </div>
                  </div>
                  <div className="ml-3">
                    <div className="text-base font-medium text-gray-800">阮明秋</div>
                    <div className="text-sm font-medium text-gray-500">Học sinh (学生)</div>
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  <Link
                    to="/dashboard"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                  >
                    个人中心
                  </Link>
                  <Link
                    to="/teachers"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                  >
                    成为老师
                  </Link>
                  <button className="w-full text-left px-4 py-2 text-base font-medium text-red-600 hover:bg-gray-100">
                    退出登录
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </nav>

      <main className="flex-grow">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 pt-12 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-1 md:col-span-1">
              <Link to="/" className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded bg-red-600 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-yellow-400" />
                </div>
                <span className="font-bold text-xl text-gray-900">中越通CNVN</span>
              </Link>
              <p className="text-gray-500 text-sm leading-relaxed">
                为越南学习者打造的专属中文双边撮合平台，连接想学中文的你与优质的中文老师。
              </p>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase mb-4">学生</h3>
              <ul className="space-y-3">
                <li><Link to="/teachers" className="text-sm text-gray-500 hover:text-red-600">找老师</Link></li>
                <li><a href="#" className="text-sm text-gray-500 hover:text-red-600">预约课程</a></li>
                <li><a href="#" className="text-sm text-gray-500 hover:text-red-600">学习指南</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase mb-4">老师</h3>
              <ul className="space-y-3">
                <li><a href="#" className="text-sm text-gray-500 hover:text-red-600">成为老师</a></li>
                <li><a href="#" className="text-sm text-gray-500 hover:text-red-600">教学帮助</a></li>
                <li><a href="#" className="text-sm text-gray-500 hover:text-red-600">平台规则</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase mb-4">关于</h3>
              <ul className="space-y-3">
                <li><a href="#" className="text-sm text-gray-500 hover:text-red-600">关于我们</a></li>
                <li><a href="#" className="text-sm text-gray-500 hover:text-red-600">联系客服</a></li>
                <li><a href="#" className="text-sm text-gray-500 hover:text-red-600">隐私政策</a></li>
                <li><a href="#" className="text-sm text-gray-500 hover:text-red-600">服务条款</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-200 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-gray-400">
              &copy; 2026 中越通 CNVN. 保留所有权利. (Bản quyền thuộc về CNVN)
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a href="#" className="text-gray-400 hover:text-gray-500">
                <span className="sr-only">Facebook</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                </svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-gray-500">
                <span className="sr-only">Zalo</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v4h-2zm0 6h2v2h-2z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
