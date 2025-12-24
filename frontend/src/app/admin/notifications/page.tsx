"use client";

/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：通知管理页面
 * 作用：发布系统公告和管理通知（真实数据）
 * 创建时间：2025-12-23
 * 最后修改：2025-12-23
 */

import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  Search,
  Plus,
  Edit2,
  Trash2,
  Send,
  Clock,
  CheckCircle,
  Users,
  Eye,
  X,
  Loader2,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

interface Notification {
  id: string;
  title: string;
  content: string;
  type: string;
  priority: string;
  is_read: boolean;
  read_count: number;
  total_sent: number;
  created_at: string;
}

interface Stats {
  total: number;
  unread: number;
  today_count: number;
  read_rate: number;
}

export default function AdminNotificationsPage() {
  const { token } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // 表单状态
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formType, setFormType] = useState("system_announcement");
  const [formPriority, setFormPriority] = useState("normal");

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/notifications?page=1&page_size=50", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.items || []);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  }, [token]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/notifications/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  }, [token]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchNotifications(), fetchStats()]);
    } finally {
      setLoading(false);
    }
  }, [fetchNotifications, fetchStats]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateNotification = async () => {
    if (!formTitle || !formContent) return;

    setSending(true);
    try {
      const res = await fetch("/api/v1/admin/notifications", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: formTitle,
          content: formContent,
          type: formType,
          priority: formPriority,
          target: "all",
        }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setFormTitle("");
        setFormContent("");
        fetchData();
      }
    } catch (error) {
      console.error("Failed to create notification:", error);
    } finally {
      setSending(false);
    }
  };

  const statsCards = [
    { label: "总通知数", value: stats?.total.toString() || "0", icon: Bell, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "今日发送", value: stats?.today_count.toString() || "0", icon: Send, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "未读数", value: stats?.unread.toString() || "0", icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10" },
    { label: "阅读率", value: `${stats?.read_rate || 0}%`, icon: CheckCircle, color: "text-purple-400", bg: "bg-purple-500/10" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">通知管理</h1>
          <p className="text-text-secondary text-sm mt-1">发布系统公告和推送通知</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          发布通知
        </button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat, idx) => (
          <div key={idx} className="bg-bg-card border border-border-default rounded-xl p-5">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-text-primary">{stat.value}</p>
                <p className="text-sm text-text-secondary">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 筛选栏 */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索通知标题..."
            className="w-full pl-10 pr-4 py-2.5 bg-bg-card border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500"
          />
        </div>
      </div>

      {/* 通知列表 */}
      <div className="bg-bg-card border border-border-default rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-default">
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">标题</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">优先级</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">阅读率</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">时间</th>
            </tr>
          </thead>
          <tbody>
            {notifications.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-text-muted">
                  暂无系统通知
                </td>
              </tr>
            ) : (
              notifications.map((notification) => (
                <tr key={notification.id} className="border-b border-border-default/50 hover:bg-bg-elevated/30">
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-text-primary font-medium">{notification.title}</p>
                      <p className="text-sm text-text-muted truncate max-w-xs">{notification.content}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-lg ${
                      notification.priority === "high" ? "bg-red-500/20 text-red-400" :
                      notification.priority === "urgent" ? "bg-amber-500/20 text-amber-400" :
                      "bg-blue-500/20 text-blue-400"
                    }`}>
                      {notification.priority === "high" ? "高" :
                       notification.priority === "urgent" ? "紧急" : "普通"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {notification.total_sent > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${(notification.read_count / notification.total_sent) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-text-secondary">
                          {Math.round((notification.read_count / notification.total_sent) * 100)}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-text-muted">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-text-secondary">
                    {notification.created_at ? new Date(notification.created_at).toLocaleString("zh-CN") : "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 创建通知弹窗 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-card border border-border-default rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-text-primary">发布通知</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-bg-elevated rounded-lg cursor-pointer">
                <X className="w-5 h-5 text-text-secondary" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">通知标题</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="输入通知标题"
                  className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">通知内容</label>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="输入通知内容"
                  rows={4}
                  className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">优先级</label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value)}
                    className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500 cursor-pointer"
                  >
                    <option value="low">低</option>
                    <option value="normal">普通</option>
                    <option value="high">高</option>
                    <option value="urgent">紧急</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">发送目标</label>
                  <select
                    className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500 cursor-pointer"
                  >
                    <option value="all">全部用户</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2.5 bg-bg-elevated hover:bg-bg-active text-text-primary rounded-xl font-medium transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleCreateNotification}
                disabled={sending || !formTitle || !formContent}
                className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 cursor-pointer"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                发布通知
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
