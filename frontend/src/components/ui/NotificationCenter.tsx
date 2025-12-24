"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/stores/authStore";

const API_BASE = "/api/v1";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  content: string;
  icon: string | null;
  action_type: string | null;
  action_url: string | null;
  is_read: boolean;
  priority: string;
  created_at: string;
}

export default function NotificationCenter() {
  const { token } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 获取未读数
  useEffect(() => {
    const fetchUnreadCount = async () => {
      if (!token) return;

      try {
        const res = await fetch(`${API_BASE}/notifications/unread-count`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.count);
        }
      } catch (err) {
        console.error("Failed to fetch unread count:", err);
      }
    };

    fetchUnreadCount();
    // 每分钟刷新一次
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [token]);

  // 打开时获取通知列表
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!isOpen || !token) return;

      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/notifications?size=10`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.items);
          setUnreadCount(data.unread_count);
        }
      } catch (err) {
        console.error("Failed to fetch notifications:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [isOpen, token]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAsRead = async (notificationId: string) => {
    if (!token) return;

    try {
      await fetch(`${API_BASE}/notifications/${notificationId}/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  const markAllAsRead = async () => {
    if (!token) return;

    try {
      await fetch(`${API_BASE}/notifications/read-all`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return "刚刚";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
    return date.toLocaleDateString("zh-CN");
  };

  const getTypeIcon = (type: string, icon: string | null) => {
    if (icon) return icon;

    const icons: Record<string, string> = {
      achievement_unlock: "🎉",
      task_reminder: "📋",
      session_complete: "✅",
      community_like: "❤️",
      community_comment: "💬",
      system_announcement: "📢",
    };
    return icons[type] || "📌";
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 触发按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-text-secondary hover:text-text-primary transition-colors"
      >
        <span className="material-symbols-outlined">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* 下拉面板 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-surface-card border border-border-dark rounded-xl shadow-xl overflow-hidden z-50"
          >
            {/* 头部 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-dark bg-surface-dark">
              <h3 className="font-bold text-text-primary">通知</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  全部已读
                </button>
              )}
            </div>

            {/* 通知列表 */}
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-text-muted">
                  <span className="material-symbols-outlined text-4xl mb-2 block">notifications_off</span>
                  <p>暂无通知</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => {
                      if (!notification.is_read) {
                        markAsRead(notification.id);
                      }
                    }}
                    className={`p-4 border-b border-border-dark hover:bg-surface-dark/50 transition-colors cursor-pointer ${!notification.is_read ? "bg-blue-500/5" : ""
                      }`}
                  >
                    <div className="flex gap-3">
                      <div className="text-2xl flex-shrink-0">
                        {getTypeIcon(notification.type, notification.icon)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`font-medium text-sm truncate ${notification.is_read ? "text-text-secondary" : "text-text-primary"
                            }`}>
                            {notification.title}
                          </p>
                          {!notification.is_read && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5"></span>
                          )}
                        </div>
                        <p className="text-xs text-text-muted mt-1 line-clamp-2">
                          {notification.content}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-text-muted">
                            {formatTime(notification.created_at)}
                          </span>
                          {notification.action_url && (
                            <Link
                              href={notification.action_url}
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-blue-400 hover:underline"
                            >
                              查看
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 底部 */}
            {notifications.length > 0 && (
              <div className="px-4 py-3 border-t border-border-dark bg-surface-dark">
                <Link
                  href="/settings"
                  className="text-xs text-text-secondary hover:text-text-primary flex items-center gap-1"
                  onClick={() => setIsOpen(false)}
                >
                  <span className="material-symbols-outlined text-sm">settings</span>
                  通知设置
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
