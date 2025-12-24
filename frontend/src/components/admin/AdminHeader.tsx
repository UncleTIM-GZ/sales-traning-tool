/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：后台管理头部组件
 * 作用：提供后台管理的顶部导航栏，包含搜索、主题切换、通知和用户信息
 * 创建时间：2025-12-24
 * 最后修改：2025-12-24
 */

"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { ThemeToggle } from "@/components/ui/ThemeSwitcher";

interface AdminHeaderProps {
  onToggleSidebar?: () => void;
}

export default function AdminHeader({ onToggleSidebar }: AdminHeaderProps) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const stored = localStorage.getItem('auth-storage');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        setUser(data.state?.user);
      } catch (e) {
        console.error('Parse error:', e);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('auth-storage');
    router.push('/login');
  };

  return (
    <header className="h-16 bg-bg-card/80 backdrop-blur-xl border-b border-border-default flex items-center justify-between px-6 sticky top-0 z-30">
      {/* 左侧 */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="w-9 h-9 rounded-lg bg-bg-elevated/50 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-active/50 transition-all"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>

        <div className="hidden md:flex items-center gap-2 text-sm text-text-muted">
          <span className="material-symbols-outlined text-lg">home</span>
          <span>/</span>
          <span className="text-text-primary">管理后台</span>
        </div>
      </div>

      {/* 右侧 */}
      <div className="flex items-center gap-4">
        {/* 搜索 */}
        <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-bg-elevated/50 rounded-lg border border-border-strong/50">
          <span className="material-symbols-outlined text-text-muted text-lg">search</span>
          <input
            type="text"
            placeholder="搜索..."
            className="bg-transparent text-sm text-white placeholder:text-text-muted outline-none w-40"
          />
          <kbd className="px-1.5 py-0.5 rounded text-[10px] bg-bg-active text-text-secondary">⌘K</kbd>
        </div>

        {/* 主题切换 */}
        <ThemeToggle />

        {/* 通知 */}
        <button className="relative w-9 h-9 rounded-lg bg-bg-elevated/50 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-active/50 transition-all">
          <span className="material-symbols-outlined">notifications</span>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
        </button>

        {/* 用户 */}
        <div className="flex items-center gap-3 pl-4 border-l border-border-default">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
            {user?.nickname?.[0] || "A"}
          </div>
          <div className="hidden md:block">
            <div className="text-sm text-text-primary font-medium">{user?.nickname || "管理员"}</div>
            <div className="text-xs text-text-muted">超级管理员</div>
          </div>
          <button
            onClick={handleLogout}
            className="text-text-secondary hover:text-red-400 transition-colors"
            title="退出登录"
          >
            <span className="material-symbols-outlined text-xl">logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
