"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuthStore } from "@/stores/authStore";

interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  is_read: boolean;
  created_at: string;
  action_url?: string;
  metadata?: Record<string, unknown>;
}

interface NotificationStats {
  total: number;
  unread: number;
}

export default function NotificationsPage() {
  const token = useAuthStore((state) => state.token);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats>({ total: 0, unread: 0 });
  const [activeFilter, setActiveFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;
      
      try {
        const res = await fetch("/api/v1/notifications", {
          headers: { "Authorization": `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.items || []);
          setStats({
            total: data.total || 0,
            unread: data.unread_count || 0,
          });
        }
      } catch (err) {
        console.error("加载通知失败", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch(`/api/v1/notifications/${notificationId}/read`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
      });
      
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setStats(prev => ({ ...prev, unread: Math.max(0, prev.unread - 1) }));
    } catch (err) {
      console.error("标记已读失败", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch("/api/v1/notifications/read-all", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
      });
      
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setStats(prev => ({ ...prev, unread: 0 }));
    } catch (err) {
      console.error("全部已读失败", err);
    }
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, { icon: string; color: string }> = {
      achievement: { icon: "emoji_events", color: "text-amber-400" },
      training: { icon: "fitness_center", color: "text-blue-400" },
      streak: { icon: "local_fire_department", color: "text-orange-400" },
      points: { icon: "stars", color: "text-emerald-400" },
      system: { icon: "info", color: "text-text-secondary" },
      reminder: { icon: "alarm", color: "text-purple-400" },
    };
    return icons[type] || { icon: "notifications", color: "text-text-secondary" };
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return "刚刚";
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString("zh-CN");
  };

  const filteredNotifications = activeFilter === "unread"
    ? notifications.filter(n => !n.is_read)
    : notifications;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href="/dashboard" className="text-sm text-text-muted hover:text-blue-500 flex items-center gap-1 mb-4">
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            返回首页
          </Link>
          <h1 className="text-2xl font-bold text-text-primary">消息中心</h1>
          <p className="text-text-secondary mt-1">
            {stats.unread > 0 ? `${stats.unread} 条未读消息` : "所有消息已读"}
          </p>
        </div>
        
        {stats.unread > 0 && (
          <button
            onClick={markAllAsRead}
            className="px-4 py-2 rounded-lg bg-surface-card border border-border-dark text-sm text-text-primary hover:bg-surface-lighter transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">done_all</span>
            全部已读
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveFilter("all")}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            activeFilter === "all"
              ? "bg-blue-500 text-white"
              : "bg-surface-card text-text-secondary hover:bg-surface-lighter"
          }`}
        >
          全部 ({stats.total})
        </button>
        <button
          onClick={() => setActiveFilter("unread")}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            activeFilter === "unread"
              ? "bg-blue-500 text-white"
              : "bg-surface-card text-text-secondary hover:bg-surface-lighter"
          }`}
        >
          未读 ({stats.unread})
        </button>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifications.length > 0 ? (
          filteredNotifications.map((notification) => {
            const typeInfo = getTypeIcon(notification.type);
            
            return (
              <div
                key={notification.id}
                onClick={() => !notification.is_read && markAsRead(notification.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  notification.is_read
                    ? "bg-surface-dark border-border-dark opacity-70"
                    : "bg-surface-card border-border-dark hover:border-blue-500/30"
                }`}
              >
                <div className="flex gap-4">
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    notification.is_read ? "bg-bg-elevated" : "bg-blue-500/10"
                  }`}>
                    <span className={`material-symbols-outlined ${notification.is_read ? "text-text-muted" : typeInfo.color}`}>
                      {typeInfo.icon}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className={`font-medium ${notification.is_read ? "text-text-secondary" : "text-text-primary"}`}>
                        {notification.title}
                      </h4>
                      <span className="text-xs text-text-muted whitespace-nowrap">
                        {formatTime(notification.created_at)}
                      </span>
                    </div>
                    <p className={`text-sm mt-1 ${notification.is_read ? "text-text-muted" : "text-text-secondary"}`}>
                      {notification.content}
                    </p>
                    
                    {/* Action Button */}
                    {notification.action_url && (
                      <Link
                        href={notification.action_url}
                        className="inline-flex items-center gap-1 mt-2 text-sm text-blue-400 hover:text-blue-300"
                        onClick={(e) => e.stopPropagation()}
                      >
                        查看详情
                        <span className="material-symbols-outlined text-sm">arrow_forward</span>
                      </Link>
                    )}
                  </div>

                  {/* Unread Dot */}
                  {!notification.is_read && (
                    <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-2" />
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-surface-card flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-4xl text-text-muted">notifications_off</span>
            </div>
            <p className="text-text-muted">
              {activeFilter === "unread" ? "没有未读消息" : "暂无消息"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
