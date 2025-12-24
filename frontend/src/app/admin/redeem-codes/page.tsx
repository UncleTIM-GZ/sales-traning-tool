"use client";

/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：兑换码管理页面
 * 作用：管理兑换码创建、批量生成、导出
 * 创建时间：2025-12-24
 * 最后修改：2025-12-24
 */

import { useState, useEffect, useCallback } from "react";
import {
  QrCode,
  Search,
  Plus,
  CheckCircle,
  XCircle,
  Edit2,
  Trash2,
  X,
  Loader2,
  Download,
  Copy,
  Gift,
  Crown,
  Coins,
} from "lucide-react";
import { adminRedeemCodeApi, AdminRedeemCode, AdminRedeemCodeStats } from "@/lib/api";

export default function AdminRedeemCodesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [rewardTypeFilter, setRewardTypeFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [codes, setCodes] = useState<AdminRedeemCode[]>([]);
  const [stats, setStats] = useState<AdminRedeemCodeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // 单个创建表单
  const [formCode, setFormCode] = useState("");
  const [formRewardType, setFormRewardType] = useState("points");
  const [formRewardValue, setFormRewardValue] = useState(100);
  const [formVipLevel, setFormVipLevel] = useState("");
  const [formUsageLimit, setFormUsageLimit] = useState(1);
  const [formPerUserLimit, setFormPerUserLimit] = useState(1);
  const [formValidUntil, setFormValidUntil] = useState("");
  const [formDescription, setFormDescription] = useState("");

  // 批量创建表单
  const [batchCount, setBatchCount] = useState(10);
  const [batchPrefix, setBatchPrefix] = useState("");
  const [batchCodes, setBatchCodes] = useState<string[]>([]);

  const fetchCodes = useCallback(async () => {
    try {
      const data = await adminRedeemCodeApi.list({
        page,
        page_size: 20,
        reward_type: rewardTypeFilter || undefined,
        is_active: activeFilter,
        search: searchQuery || undefined,
      });
      setCodes(data.items);
      setTotalPages(data.total_pages);
    } catch (error) {
      console.error("Failed to fetch codes:", error);
    }
  }, [page, rewardTypeFilter, activeFilter, searchQuery]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await adminRedeemCodeApi.getStatistics();
      setStats(data);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchCodes(), fetchStats()]);
    } finally {
      setLoading(false);
    }
  }, [fetchCodes, fetchStats]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async () => {
    if (!formValidUntil) return;

    setSaving(true);
    try {
      await adminRedeemCodeApi.create({
        code: formCode || undefined,
        reward_type: formRewardType,
        reward_value: formRewardValue,
        vip_level: formRewardType === "vip_days" ? formVipLevel : undefined,
        usage_limit: formUsageLimit,
        per_user_limit: formPerUserLimit,
        valid_until: new Date(formValidUntil).toISOString(),
        description: formDescription || undefined,
      });
      setShowCreateModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Failed to create code:", error);
      alert(error instanceof Error ? error.message : "创建失败");
    } finally {
      setSaving(false);
    }
  };

  const handleBatchCreate = async () => {
    if (!formValidUntil || batchCount < 1) return;

    setSaving(true);
    try {
      const result = await adminRedeemCodeApi.batchCreate({
        count: batchCount,
        prefix: batchPrefix || undefined,
        reward_type: formRewardType,
        reward_value: formRewardValue,
        vip_level: formRewardType === "vip_days" ? formVipLevel : undefined,
        usage_limit: formUsageLimit,
        per_user_limit: formPerUserLimit,
        valid_until: new Date(formValidUntil).toISOString(),
        description: formDescription || undefined,
      });
      setBatchCodes(result.codes);
      fetchData();
    } catch (error) {
      console.error("Failed to batch create:", error);
      alert(error instanceof Error ? error.message : "批量创建失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个兑换码吗？")) return;

    try {
      await adminRedeemCodeApi.delete(id);
      fetchData();
    } catch (error) {
      console.error("Failed to delete code:", error);
    }
  };

  const handleToggleActive = async (code: AdminRedeemCode) => {
    try {
      if (code.is_active) {
        await adminRedeemCodeApi.disable(code.id);
      } else {
        await adminRedeemCodeApi.enable(code.id);
      }
      fetchData();
    } catch (error) {
      console.error("Failed to toggle code:", error);
    }
  };

  const handleExport = async () => {
    try {
      const result = await adminRedeemCodeApi.export({
        reward_type: rewardTypeFilter || undefined,
        is_active: activeFilter,
      });
      const text = result.codes.join("\n");
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `redeem_codes_${new Date().toISOString().slice(0, 10)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export:", error);
    }
  };

  const resetForm = () => {
    setFormCode("");
    setFormRewardType("points");
    setFormRewardValue(100);
    setFormVipLevel("");
    setFormUsageLimit(1);
    setFormPerUserLimit(1);
    setFormValidUntil("");
    setFormDescription("");
    setBatchCount(10);
    setBatchPrefix("");
    setBatchCodes([]);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getRewardIcon = (type: string) => {
    if (type === "points") return <Coins className="w-4 h-4 text-amber-400" />;
    if (type === "vip_days") return <Crown className="w-4 h-4 text-purple-400" />;
    return <Gift className="w-4 h-4 text-blue-400" />;
  };

  const getRewardText = (type: string, value: number) => {
    if (type === "points") return `${value}积分`;
    if (type === "vip_days") return `${value}天VIP`;
    return `${value}`;
  };

  const statsCards = [
    { label: "总兑换码", value: stats?.total_codes.toString() || "0", icon: QrCode, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "有效兑换码", value: stats?.active_codes.toString() || "0", icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "总兑换次数", value: stats?.total_redeems.toString() || "0", icon: Gift, color: "text-amber-400", bg: "bg-amber-500/10" },
    { label: "今日兑换", value: stats?.today_redeems.toString() || "0", icon: Coins, color: "text-purple-400", bg: "bg-purple-500/10" },
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
          <h1 className="text-2xl font-bold text-text-primary">兑换码管理</h1>
          <p className="text-text-secondary text-sm mt-1">管理兑换码创建和发放</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 bg-bg-card border border-border-default hover:bg-bg-elevated text-text-primary rounded-xl font-medium transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            导出
          </button>
          <button
            onClick={() => setShowBatchModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-bg-card border border-border-default hover:bg-bg-elevated text-text-primary rounded-xl font-medium transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            批量生成
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            创建兑换码
          </button>
        </div>
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
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索兑换码..."
            className="w-full pl-10 pr-4 py-2.5 bg-bg-card border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500"
          />
        </div>
        <select
          value={rewardTypeFilter}
          onChange={(e) => setRewardTypeFilter(e.target.value)}
          className="px-4 py-2.5 bg-bg-card border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500 cursor-pointer"
        >
          <option value="">全部类型</option>
          <option value="points">积分</option>
          <option value="vip_days">VIP天数</option>
        </select>
        <select
          value={activeFilter === undefined ? "" : activeFilter.toString()}
          onChange={(e) => setActiveFilter(e.target.value === "" ? undefined : e.target.value === "true")}
          className="px-4 py-2.5 bg-bg-card border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500 cursor-pointer"
        >
          <option value="">全部状态</option>
          <option value="true">有效</option>
          <option value="false">已禁用</option>
        </select>
      </div>

      {/* 兑换码列表 */}
      <div className="bg-bg-card border border-border-default rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-default">
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">兑换码</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">奖励</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">使用情况</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">有效期</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">状态</th>
              <th className="text-right px-6 py-4 text-sm font-medium text-text-secondary">操作</th>
            </tr>
          </thead>
          <tbody>
            {codes.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-text-muted">
                  暂无兑换码
                </td>
              </tr>
            ) : (
              codes.map((code) => (
                <tr key={code.id} className="border-b border-border-default/50 hover:bg-bg-elevated/30">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-text-primary font-medium">{code.code}</span>
                      <button
                        onClick={() => copyToClipboard(code.code)}
                        className="p-1 hover:bg-bg-elevated rounded cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5 text-text-muted" />
                      </button>
                    </div>
                    {code.description && (
                      <p className="text-sm text-text-muted mt-1">{code.description}</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {getRewardIcon(code.reward_type)}
                      <span className="text-text-primary">
                        {getRewardText(code.reward_type, code.reward_value)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-text-primary">
                      {code.used_count} / {code.usage_limit === -1 ? "无限" : code.usage_limit}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-text-secondary">
                      {new Date(code.valid_until).toLocaleDateString()}
                    </div>
                    {code.is_expired && (
                      <span className="text-xs text-red-400">已过期</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {code.is_active && !code.is_expired && !code.is_exhausted ? (
                      <span className="flex items-center gap-1.5 text-emerald-400 text-sm">
                        <CheckCircle className="w-4 h-4" />
                        有效
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-text-muted text-sm">
                        <XCircle className="w-4 h-4" />
                        {code.is_exhausted ? "已用完" : code.is_expired ? "已过期" : "已禁用"}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleToggleActive(code)}
                        className="p-2 hover:bg-bg-elevated rounded-lg transition-colors cursor-pointer"
                      >
                        {code.is_active ? (
                          <XCircle className="w-4 h-4 text-text-secondary hover:text-red-400" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-text-secondary hover:text-emerald-400" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(code.id)}
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

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-bg-card border border-border-default rounded-lg text-text-secondary disabled:opacity-50 cursor-pointer"
          >
            上一页
          </button>
          <span className="px-4 py-2 text-text-secondary">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-bg-card border border-border-default rounded-lg text-text-secondary disabled:opacity-50 cursor-pointer"
          >
            下一页
          </button>
        </div>
      )}

      {/* 创建兑换码弹窗 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-card border border-border-default rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-text-primary">创建兑换码</h2>
              <button onClick={() => { setShowCreateModal(false); resetForm(); }} className="p-2 hover:bg-bg-elevated rounded-lg cursor-pointer">
                <X className="w-5 h-5 text-text-secondary" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">兑换码（可选）</label>
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
                  <label className="block text-sm font-medium text-text-secondary mb-2">奖励类型</label>
                  <select
                    value={formRewardType}
                    onChange={(e) => setFormRewardType(e.target.value)}
                    className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500 cursor-pointer"
                  >
                    <option value="points">积分</option>
                    <option value="vip_days">VIP天数</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">奖励值</label>
                  <input
                    type="number"
                    value={formRewardValue}
                    onChange={(e) => setFormRewardValue(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">使用次数限制</label>
                  <input
                    type="number"
                    value={formUsageLimit}
                    onChange={(e) => setFormUsageLimit(parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">每人限用</label>
                  <input
                    type="number"
                    value={formPerUserLimit}
                    onChange={(e) => setFormPerUserLimit(parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">有效期至 *</label>
                <input
                  type="datetime-local"
                  value={formValidUntil}
                  onChange={(e) => setFormValidUntil(e.target.value)}
                  className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">描述</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="兑换码用途说明"
                  className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => { setShowCreateModal(false); resetForm(); }} className="px-4 py-2.5 bg-bg-elevated hover:bg-bg-active text-text-primary rounded-xl font-medium transition-colors cursor-pointer">
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !formValidUntil}
                className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 cursor-pointer"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 批量生成弹窗 */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-card border border-border-default rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-text-primary">批量生成兑换码</h2>
              <button onClick={() => { setShowBatchModal(false); resetForm(); }} className="p-2 hover:bg-bg-elevated rounded-lg cursor-pointer">
                <X className="w-5 h-5 text-text-secondary" />
              </button>
            </div>

            {batchCodes.length > 0 ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <p className="text-emerald-400 font-medium mb-2">成功生成 {batchCodes.length} 个兑换码</p>
                  <div className="max-h-60 overflow-y-auto space-y-1">
                    {batchCodes.map((code, idx) => (
                      <div key={idx} className="flex items-center justify-between py-1">
                        <span className="font-mono text-text-primary text-sm">{code}</span>
                        <button onClick={() => copyToClipboard(code)} className="p-1 hover:bg-bg-elevated rounded cursor-pointer">
                          <Copy className="w-3.5 h-3.5 text-text-muted" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => copyToClipboard(batchCodes.join("\n"))}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-bg-elevated hover:bg-bg-active text-text-primary rounded-xl font-medium transition-colors cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                  复制全部
                </button>
                <button
                  onClick={() => { setShowBatchModal(false); resetForm(); }}
                  className="w-full px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-colors cursor-pointer"
                >
                  完成
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">生成数量</label>
                    <input
                      type="number"
                      value={batchCount}
                      onChange={(e) => setBatchCount(Math.min(1000, Math.max(1, parseInt(e.target.value) || 1)))}
                      min={1}
                      max={1000}
                      className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">前缀（可选）</label>
                    <input
                      type="text"
                      value={batchPrefix}
                      onChange={(e) => setBatchPrefix(e.target.value.toUpperCase())}
                      placeholder="如: VIP"
                      className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">奖励类型</label>
                    <select
                      value={formRewardType}
                      onChange={(e) => setFormRewardType(e.target.value)}
                      className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500 cursor-pointer"
                    >
                      <option value="points">积分</option>
                      <option value="vip_days">VIP天数</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">奖励值</label>
                    <input
                      type="number"
                      value={formRewardValue}
                      onChange={(e) => setFormRewardValue(parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">有效期至 *</label>
                  <input
                    type="datetime-local"
                    value={formValidUntil}
                    onChange={(e) => setFormValidUntil(e.target.value)}
                    className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">描述</label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="批次用途说明"
                    className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={() => { setShowBatchModal(false); resetForm(); }} className="px-4 py-2.5 bg-bg-elevated hover:bg-bg-active text-text-primary rounded-xl font-medium transition-colors cursor-pointer">
                    取消
                  </button>
                  <button
                    onClick={handleBatchCreate}
                    disabled={saving || !formValidUntil || batchCount < 1}
                    className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    生成 {batchCount} 个
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
