"use client";

/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：推广邀请管理页面
 * 作用：管理邀请码、推广渠道和奖励规则（真实数据）
 * 创建时间：2025-12-23
 * 最后修改：2025-12-23
 */

import { useState, useEffect, useCallback } from "react";
import {
  Gift,
  Search,
  Plus,
  Copy,
  Users,
  TrendingUp,
  CheckCircle,
  XCircle,
  Edit2,
  Trash2,
  QrCode,
  X,
  Loader2,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

interface InviteCode {
  id: string;
  name: string | null;
  code: string;
  channel: string;
  reward_type: string;
  reward_value: number;
  use_count: number;
  max_uses: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

interface Stats {
  total_codes: number;
  total_uses: number;
  month_uses: number;
  channels: Array<{ channel: string; count: number; uses: number }>;
}

export default function AdminInvitesPage() {
  const { token } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"codes" | "channels">("codes");
  const [invites, setInvites] = useState<InviteCode[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 表单状态
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formChannel, setFormChannel] = useState("official");
  const [formRewardType, setFormRewardType] = useState("points");
  const [formRewardValue, setFormRewardValue] = useState(100);
  const [formMaxUses, setFormMaxUses] = useState(0);
  const [formExpiresDays, setFormExpiresDays] = useState<number | undefined>(undefined);

  const fetchInvites = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/invites?page=1&page_size=50", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setInvites(data.items || []);
      }
    } catch (error) {
      console.error("Failed to fetch invites:", error);
    }
  }, [token]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/invites/stats", {
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
      await Promise.all([fetchInvites(), fetchStats()]);
    } finally {
      setLoading(false);
    }
  }, [fetchInvites, fetchStats]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async () => {
    if (!formName) return;

    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/invites", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formName,
          code: formCode || undefined,
          channel: formChannel,
          reward_type: formRewardType,
          reward_value: formRewardValue,
          max_uses: formMaxUses,
          expires_days: formExpiresDays,
        }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        resetForm();
        fetchData();
      }
    } catch (error) {
      console.error("Failed to create invite:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个邀请码吗？")) return;

    try {
      const res = await fetch(`/api/v1/admin/invites/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Failed to delete invite:", error);
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/v1/admin/invites/${id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_active: !isActive }),
      });

      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Failed to update invite:", error);
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormCode("");
    setFormChannel("official");
    setFormRewardType("points");
    setFormRewardValue(100);
    setFormMaxUses(0);
    setFormExpiresDays(undefined);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getRewardText = (type: string, value: number) => {
    if (type === "points") return `${value}积分`;
    if (type === "vip_days") return `${value}天VIP`;
    return "-";
  };

  const channelNames: Record<string, string> = {
    official: "官方",
    wechat: "微信",
    douyin: "抖音",
    xiaohongshu: "小红书",
    weibo: "微博",
    custom: "自定义",
  };

  const statsCards = [
    { label: "总邀请码", value: stats?.total_codes.toString() || "0", icon: QrCode, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "累计使用", value: stats?.total_uses.toString() || "0", icon: Users, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "本月使用", value: stats?.month_uses.toString() || "0", icon: TrendingUp, color: "text-amber-400", bg: "bg-amber-500/10" },
    { label: "渠道数", value: stats?.channels.length.toString() || "0", icon: Gift, color: "text-purple-400", bg: "bg-purple-500/10" },
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
          <h1 className="text-2xl font-bold text-text-primary">推广邀请管理</h1>
          <p className="text-text-secondary text-sm mt-1">管理邀请码和推广渠道</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          创建邀请码
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

      {/* Tab切换 */}
      <div className="flex items-center gap-4 border-b border-border-default">
        <button
          onClick={() => setActiveTab("codes")}
          className={`pb-3 px-1 text-sm font-medium transition-colors cursor-pointer ${
            activeTab === "codes"
              ? "text-violet-400 border-b-2 border-violet-400"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          邀请码管理
        </button>
        <button
          onClick={() => setActiveTab("channels")}
          className={`pb-3 px-1 text-sm font-medium transition-colors cursor-pointer ${
            activeTab === "channels"
              ? "text-violet-400 border-b-2 border-violet-400"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          渠道统计
        </button>
      </div>

      {activeTab === "codes" ? (
        <>
          {/* 筛选栏 */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索邀请码..."
                className="w-full pl-10 pr-4 py-2.5 bg-bg-card border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>

          {/* 邀请码列表 */}
          <div className="bg-bg-card border border-border-default rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-default">
                  <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">邀请码</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">渠道</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">使用情况</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">奖励</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">状态</th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-text-secondary">操作</th>
                </tr>
              </thead>
              <tbody>
                {invites.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-text-muted">
                      暂无邀请码
                    </td>
                  </tr>
                ) : (
                  invites.map((invite) => (
                    <tr key={invite.id} className="border-b border-border-default/50 hover:bg-bg-elevated/30">
                      <td className="px-6 py-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-text-primary font-medium">{invite.code}</span>
                            <button
                              onClick={() => copyToClipboard(invite.code)}
                              className="p-1 hover:bg-bg-elevated rounded cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5 text-text-muted" />
                            </button>
                          </div>
                          <p className="text-sm text-text-muted">{invite.name}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 text-xs rounded-lg bg-bg-elevated text-text-secondary">
                          {channelNames[invite.channel] || invite.channel}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-text-primary">{invite.use_count}</span>
                          <span className="text-text-muted">/</span>
                          <span className="text-text-secondary">{invite.max_uses || "无限"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-text-primary">
                        {getRewardText(invite.reward_type, invite.reward_value)}
                      </td>
                      <td className="px-6 py-4">
                        {invite.is_active ? (
                          <span className="flex items-center gap-1.5 text-emerald-400 text-sm">
                            <CheckCircle className="w-4 h-4" />
                            启用
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-text-muted text-sm">
                            <XCircle className="w-4 h-4" />
                            停用
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleToggleActive(invite.id, invite.is_active)}
                            className="p-2 hover:bg-bg-elevated rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4 text-text-secondary" />
                          </button>
                          <button
                            onClick={() => handleDelete(invite.id)}
                            className="p-2 hover:bg-bg-elevated rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4 text-text-secondary hover:text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* 渠道统计 */
        <div className="bg-bg-card border border-border-default rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-default">
                <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">渠道</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">邀请码数</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">使用次数</th>
              </tr>
            </thead>
            <tbody>
              {stats?.channels.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-text-muted">
                    暂无渠道数据
                  </td>
                </tr>
              ) : (
                stats?.channels.map((channel, idx) => (
                  <tr key={idx} className="border-b border-border-default/50 hover:bg-bg-elevated/30">
                    <td className="px-6 py-4">
                      <span className="text-text-primary font-medium">
                        {channelNames[channel.channel] || channel.channel}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-text-secondary">{channel.count}</td>
                    <td className="px-6 py-4 text-text-primary font-medium">{channel.uses}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 创建邀请码弹窗 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-card border border-border-default rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-text-primary">创建邀请码</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-bg-elevated rounded-lg cursor-pointer">
                <X className="w-5 h-5 text-text-secondary" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">名称</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="邀请码用途说明"
                  className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">邀请码（可选）</label>
                <input
                  type="text"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  placeholder="留空将自动生成"
                  className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">渠道</label>
                  <select
                    value={formChannel}
                    onChange={(e) => setFormChannel(e.target.value)}
                    className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500 cursor-pointer"
                  >
                    <option value="official">官方</option>
                    <option value="wechat">微信</option>
                    <option value="douyin">抖音</option>
                    <option value="xiaohongshu">小红书</option>
                    <option value="weibo">微博</option>
                    <option value="custom">自定义</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">奖励类型</label>
                  <select
                    value={formRewardType}
                    onChange={(e) => setFormRewardType(e.target.value)}
                    className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500 cursor-pointer"
                  >
                    <option value="points">积分</option>
                    <option value="vip_days">VIP天数</option>
                    <option value="none">无奖励</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">奖励值</label>
                  <input
                    type="number"
                    value={formRewardValue}
                    onChange={(e) => setFormRewardValue(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">最大使用次数</label>
                  <input
                    type="number"
                    value={formMaxUses}
                    onChange={(e) => setFormMaxUses(parseInt(e.target.value) || 0)}
                    placeholder="0表示无限"
                    className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500"
                  />
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
                onClick={handleCreate}
                disabled={saving || !formName}
                className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 cursor-pointer"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
