"use client";

/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：VIP订阅历史页面
 * 作用：显示用户的VIP订阅记录
 * 创建时间：2025-12-24
 * 最后修改：2025-12-24
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Crown, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

interface SubscriptionHistory {
  id: string;
  level_id: string;
  level: {
    id: string;
    name: string;
    display_name: string;
  } | null;
  status: string;
  started_at: string;
  expires_at: string;
  days_remaining: number;
  is_active: boolean;
  amount?: number | null;
  cancelled_at?: string | null;
}

export default function VipHistoryPage() {
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<SubscriptionHistory[]>([]);

  useEffect(() => {
    if (token) {
      fetchHistory();
    }
  }, [token]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/vip/subscriptions", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.subscriptions || []);
      }
    } catch (error) {
      console.error("Failed to fetch history:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/15 text-emerald-400 text-xs rounded-full">
            <CheckCircle className="w-3 h-3" />
            生效中
          </span>
        );
      case "expired":
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-zinc-500/15 text-text-muted text-xs rounded-full">
            <Clock className="w-3 h-3" />
            已过期
          </span>
        );
      case "cancelled":
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-red-500/15 text-red-400 text-xs rounded-full">
            <XCircle className="w-3 h-3" />
            已取消
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 bg-zinc-500/15 text-text-muted text-xs rounded-full">
            {status}
          </span>
        );
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* 返回链接 */}
      <Link
        href="/vip"
        className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        返回会员中心
      </Link>

      {/* 标题 */}
      <h1 className="text-2xl font-bold text-text-primary mb-6">订阅历史</h1>

      {/* 历史列表 */}
      {history.length === 0 ? (
        <div className="bg-bg-card border border-border-default rounded-2xl p-12 text-center">
          <Crown className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <p className="text-text-muted mb-4">暂无订阅记录</p>
          <Link
            href="/vip"
            className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-colors"
          >
            <Crown className="w-4 h-4" />
            开通会员
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((item) => (
            <div
              key={item.id}
              className="bg-bg-card border border-border-default rounded-xl p-5"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center">
                    <Crown className="w-5 h-5 text-violet-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-text-primary">
                      {item.level?.display_name || item.level?.name || "VIP会员"}
                    </h3>
                    {item.amount != null && (
                      <p className="text-sm text-text-muted">
                        ¥{(item.amount / 100).toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
                {getStatusBadge(item.status)}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-text-muted">开始时间</span>
                  <p className="text-text-primary">{formatDate(item.started_at)}</p>
                </div>
                <div>
                  <span className="text-text-muted">到期时间</span>
                  <p className="text-text-primary">{formatDate(item.expires_at)}</p>
                </div>
              </div>

              {item.cancelled_at && (
                <div className="mt-3 pt-3 border-t border-border-default text-sm">
                  <span className="text-text-muted">取消时间：</span>
                  <span className="text-text-secondary">
                    {formatDate(item.cancelled_at)}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
