"use client";

/**
 * 后台管理布局
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";

// 创建QueryClient实例
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);

  // 检查权限
  useEffect(() => {
    const stored = localStorage.getItem('auth-storage');

    if (!stored) {
      router.replace('/login?redirect=/admin');
      return;
    }

    try {
      const data = JSON.parse(stored);
      const user = data.state?.user;
      const isAuth = data.state?.isAuthenticated;

      if (!isAuth) {
        router.replace('/login?redirect=/admin');
        return;
      }

      if (user?.role !== 'admin') {
        router.replace('/dashboard');
        return;
      }

      setLoading(false);
    } catch (e) {
      router.replace('/login?redirect=/admin');
    }
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
          <p className="text-text-secondary">验证权限中...</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-bg-base">
        {/* 侧边栏 */}
        <AdminSidebar collapsed={collapsed} />

        {/* 主内容区 */}
        <div className={`transition-all duration-300 ${collapsed ? "ml-16" : "ml-64"}`}>
          {/* 头部 */}
          <AdminHeader onToggleSidebar={() => setCollapsed(!collapsed)} />

          {/* 内容 */}
          <main className="p-6">
            {children}
          </main>
        </div>
      </div>
    </QueryClientProvider>
  );
}
