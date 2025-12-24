"use client";

/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：VIP套餐管理页面
 * 作用：管理VIP套餐配置、价格和权益
 * 创建时间：2025-12-24
 * 最后修改：2025-12-24
 */

import { useState, useEffect, useCallback } from "react";
import {
  Crown,
  Edit2,
  CheckCircle,
  XCircle,
  X,
  Loader2,
  Users,
  TrendingUp,
  Clock,
  Settings,
  Mic,
  Target,
  FileText,
  Headphones,
  Bot,
  Infinity,
  Plus,
  Trash2,
} from "lucide-react";
import { adminVipApi, AdminVipLevel, AdminVipStats } from "@/lib/api";

interface Privileges {
  daily_training_limit: number;
  voice_training_enabled: boolean;
  advanced_scenarios_enabled: boolean;
  custom_scenarios_limit: number;
  report_export_enabled: boolean;
  priority_support: boolean;
  ai_coach_enabled: boolean;
  half_yearly_price?: number;
  [key: string]: number | boolean | undefined;
}

// Helper to safely get privilege value
function getPrivilege<T>(privileges: Record<string, unknown> | undefined, key: string, defaultValue: T): T {
  if (!privileges || privileges[key] === undefined) return defaultValue;
  return privileges[key] as T;
}

export default function AdminVipPage() {
  const [levels, setLevels] = useState<AdminVipLevel[]>([]);
  const [stats, setStats] = useState<AdminVipStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingLevel, setEditingLevel] = useState<AdminVipLevel | null>(null);
  const [activeTab, setActiveTab] = useState<"basic" | "privileges">("basic");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // 创建套餐表单状态
  const [formName, setFormName] = useState("");
  // 基本信息表单状态
  const [formDisplayName, setFormDisplayName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formMonthlyPrice, setFormMonthlyPrice] = useState(0);
  const [formQuarterlyPrice, setFormQuarterlyPrice] = useState(0);
  const [formHalfYearlyPrice, setFormHalfYearlyPrice] = useState(0);
  const [formYearlyPrice, setFormYearlyPrice] = useState(0);
  const [formSortOrder, setFormSortOrder] = useState(0);

  // 权益配置表单状态
  const [formPrivileges, setFormPrivileges] = useState<Privileges>({
    daily_training_limit: 3,
    voice_training_enabled: false,
    advanced_scenarios_enabled: false,
    custom_scenarios_limit: 0,
    report_export_enabled: false,
    priority_support: false,
    ai_coach_enabled: false,
  });

  const fetchLevels = useCallback(async () => {
    try {
      const data = await adminVipApi.getLevels(true);
      setLevels(data.items);
    } catch (error) {
      console.error("Failed to fetch levels:", error);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const data = await adminVipApi.getStatistics();
      setStats(data);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchLevels(), fetchStats()]);
    } finally {
      setLoading(false);
    }
  }, [fetchLevels, fetchStats]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpdate = async () => {
    if (!editingLevel) return;

    setSaving(true);
    try {
      await adminVipApi.updateLevel(editingLevel.id, {
        display_name: formDisplayName,
        description: formDescription,
        monthly_price: formMonthlyPrice,
        quarterly_price: formQuarterlyPrice,
        half_yearly_price: formHalfYearlyPrice,
        yearly_price: formYearlyPrice,
        privileges: formPrivileges,
        sort_order: formSortOrder,
      });
      setEditingLevel(null);
      fetchData();
    } catch (error) {
      console.error("Failed to update level:", error);
      alert(error instanceof Error ? error.message : "更新失败");
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!formName || !formDisplayName) {
      alert("请填写套餐标识和显示名称");
      return;
    }

    setSaving(true);
    try {
      await adminVipApi.createLevel({
        name: formName,
        display_name: formDisplayName,
        description: formDescription,
        monthly_price: formMonthlyPrice,
        quarterly_price: formQuarterlyPrice,
        half_yearly_price: formHalfYearlyPrice,
        yearly_price: formYearlyPrice,
        privileges: formPrivileges,
        sort_order: formSortOrder,
      });
      setShowCreateModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Failed to create level:", error);
      alert(error instanceof Error ? error.message : "创建失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (level: AdminVipLevel) => {
    if (level.name === "free") {
      alert("不能删除免费套餐");
      return;
    }
    if (level.active_subscriptions > 0) {
      alert(`该套餐还有 ${level.active_subscriptions} 个活跃订阅，无法删除`);
      return;
    }
    if (!confirm(`确定要删除套餐「${level.display_name}」吗？此操作不可恢复。`)) {
      return;
    }

    try {
      await adminVipApi.deleteLevel(level.id);
      fetchData();
    } catch (error) {
      console.error("Failed to delete level:", error);
      alert(error instanceof Error ? error.message : "删除失败");
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormDisplayName("");
    setFormDescription("");
    setFormMonthlyPrice(0);
    setFormQuarterlyPrice(0);
    setFormHalfYearlyPrice(0);
    setFormYearlyPrice(0);
    setFormSortOrder(0);
    setFormPrivileges({
      daily_training_limit: 3,
      voice_training_enabled: false,
      advanced_scenarios_enabled: false,
      custom_scenarios_limit: 0,
      report_export_enabled: false,
      priority_support: false,
      ai_coach_enabled: false,
    });
  };

  const openCreateModal = () => {
    resetForm();
    setActiveTab("basic");
    setShowCreateModal(true);
  };

  const handleToggleActive = async (level: AdminVipLevel) => {
    try {
      if (level.is_active) {
        await adminVipApi.disableLevel(level.id);
      } else {
        await adminVipApi.enableLevel(level.id);
      }
      fetchData();
    } catch (error) {
      console.error("Failed to toggle level:", error);
      alert(error instanceof Error ? error.message : "操作失败");
    }
  };

  const openEditModal = (level: AdminVipLevel) => {
    setEditingLevel(level);
    setActiveTab("basic");
    setFormName(level.name);
    setFormDisplayName(level.display_name);
    setFormDescription(level.description || "");
    setFormMonthlyPrice(level.monthly_price);
    setFormQuarterlyPrice(level.quarterly_price);
    setFormHalfYearlyPrice(level.half_yearly_price || level.quarterly_price * 2);
    setFormYearlyPrice(level.yearly_price);
    setFormSortOrder(level.sort_order || 0);
    setFormPrivileges({
      daily_training_limit: getPrivilege(level.privileges, "daily_training_limit", 3),
      voice_training_enabled: getPrivilege(level.privileges, "voice_training_enabled", false),
      advanced_scenarios_enabled: getPrivilege(level.privileges, "advanced_scenarios_enabled", false),
      custom_scenarios_limit: getPrivilege(level.privileges, "custom_scenarios_limit", 0),
      report_export_enabled: getPrivilege(level.privileges, "report_export_enabled", false),
      priority_support: getPrivilege(level.privileges, "priority_support", false),
      ai_coach_enabled: getPrivilege(level.privileges, "ai_coach_enabled", false),
    });
  };

  const formatPrice = (price: number) => `${(price / 100).toFixed(2)}元`;

  const statsCards = [
    { label: "VIP用户", value: stats?.total_vip.toString() || "0", icon: Crown, color: "text-amber-400", bg: "bg-amber-500/10" },
    { label: "本月新增", value: stats?.month_new_vip.toString() || "0", icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "即将到期", value: stats?.expiring_soon.toString() || "0", icon: Clock, color: "text-red-400", bg: "bg-red-500/10" },
    { label: "续费率", value: `${stats?.renewal_rate || 0}%`, icon: Users, color: "text-blue-400", bg: "bg-blue-500/10" },
  ];

  // 权益配置项
  const privilegeItems = [
    {
      key: "daily_training_limit",
      label: "每日训练次数",
      description: "每天可进行的训练次数限制，-1表示无限",
      type: "number" as const,
      icon: Target,
    },
    {
      key: "voice_training_enabled",
      label: "语音训练",
      description: "是否启用语音对话训练功能",
      type: "boolean" as const,
      icon: Mic,
    },
    {
      key: "advanced_scenarios_enabled",
      label: "高级场景",
      description: "是否可以访问高级训练场景",
      type: "boolean" as const,
      icon: Target,
    },
    {
      key: "custom_scenarios_limit",
      label: "自定义场景数量",
      description: "可创建的自定义场景数量限制，-1表示无限",
      type: "number" as const,
      icon: Settings,
    },
    {
      key: "report_export_enabled",
      label: "报告导出",
      description: "是否可以导出训练报告",
      type: "boolean" as const,
      icon: FileText,
    },
    {
      key: "priority_support",
      label: "优先客服",
      description: "是否享有优先客服支持",
      type: "boolean" as const,
      icon: Headphones,
    },
    {
      key: "ai_coach_enabled",
      label: "AI教练",
      description: "是否启用AI教练功能",
      type: "boolean" as const,
      icon: Bot,
    },
  ];

  const renderPrivilegeValue = (key: string, value: number | boolean) => {
    if (typeof value === "boolean") {
      return value ? (
        <span className="text-emerald-400">已启用</span>
      ) : (
        <span className="text-text-muted">未启用</span>
      );
    }
    if (value === -1) {
      return <span className="text-amber-400 flex items-center gap-1"><Infinity className="w-4 h-4" /> 无限</span>;
    }
    return <span className="text-text-primary">{value}</span>;
  };

  // Helper to render privilege from level
  const renderLevelPrivilege = (privileges: Record<string, unknown> | undefined, key: string, defaultValue: number | boolean) => {
    const value = getPrivilege(privileges, key, defaultValue);
    return renderPrivilegeValue(key, value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">VIP套餐管理</h1>
          <p className="text-text-secondary text-sm mt-1">管理VIP套餐配置、价格和权益</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-colors cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          创建套餐
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

      {/* 套餐列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {levels.map((level) => (
          <div key={level.id} className={`bg-bg-card border rounded-xl p-6 ${level.is_active ? "border-border-default" : "border-red-500/30 opacity-60"}`}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-text-primary">{level.display_name}</h3>
                <p className="text-sm text-text-muted">{level.name}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => openEditModal(level)} className="p-2 hover:bg-bg-elevated rounded-lg cursor-pointer">
                  <Edit2 className="w-4 h-4 text-text-secondary" />
                </button>
                {level.name !== "free" && (
                  <>
                    <button onClick={() => handleToggleActive(level)} className="p-2 hover:bg-bg-elevated rounded-lg cursor-pointer">
                      {level.is_active ? (
                        <XCircle className="w-4 h-4 text-text-secondary hover:text-red-400" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-text-secondary hover:text-emerald-400" />
                      )}
                    </button>
                    <button onClick={() => handleDelete(level)} className="p-2 hover:bg-bg-elevated rounded-lg cursor-pointer">
                      <Trash2 className="w-4 h-4 text-text-secondary hover:text-red-400" />
                    </button>
                  </>
                )}
              </div>
            </div>

            <p className="text-sm text-text-secondary mb-4">{level.description || "暂无描述"}</p>

            {/* 价格信息 */}
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">月付</span>
                <span className="text-text-primary font-medium">{formatPrice(level.monthly_price)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">季付</span>
                <span className="text-text-primary font-medium">{formatPrice(level.quarterly_price)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">半年付</span>
                <span className="text-text-primary font-medium">{formatPrice(level.half_yearly_price || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">年付</span>
                <span className="text-text-primary font-medium">{formatPrice(level.yearly_price)}</span>
              </div>
            </div>

            {/* 权益概览 */}
            <div className="pt-4 border-t border-border-default space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">每日训练</span>
                {renderLevelPrivilege(level.privileges, "daily_training_limit", 3)}
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">语音训练</span>
                {renderLevelPrivilege(level.privileges, "voice_training_enabled", false)}
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">AI教练</span>
                {renderLevelPrivilege(level.privileges, "ai_coach_enabled", false)}
              </div>
            </div>

            {/* 订阅统计 */}
            <div className="pt-4 mt-4 border-t border-border-default">
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">当前订阅</span>
                <span className="text-emerald-400 font-medium">{level.active_subscriptions}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 编辑弹窗 */}
      {editingLevel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-card border border-border-default rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* 弹窗头部 */}
            <div className="flex items-center justify-between p-6 border-b border-border-default">
              <h2 className="text-xl font-bold text-text-primary">编辑套餐 - {editingLevel.display_name}</h2>
              <button onClick={() => setEditingLevel(null)} className="p-2 hover:bg-bg-elevated rounded-lg cursor-pointer">
                <X className="w-5 h-5 text-text-secondary" />
              </button>
            </div>

            {/* Tab 切换 */}
            <div className="flex border-b border-border-default px-6">
              <button
                onClick={() => setActiveTab("basic")}
                className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
                  activeTab === "basic"
                    ? "border-violet-500 text-violet-500"
                    : "border-transparent text-text-secondary hover:text-text-primary"
                }`}
              >
                基本信息
              </button>
              <button
                onClick={() => setActiveTab("privileges")}
                className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
                  activeTab === "privileges"
                    ? "border-violet-500 text-violet-500"
                    : "border-transparent text-text-secondary hover:text-text-primary"
                }`}
              >
                权益配置
              </button>
            </div>

            {/* 弹窗内容 */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === "basic" ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">显示名称</label>
                    <input
                      type="text"
                      value={formDisplayName}
                      onChange={(e) => setFormDisplayName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">描述</label>
                    <textarea
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">月付价格（分）</label>
                      <input
                        type="number"
                        value={formMonthlyPrice}
                        onChange={(e) => setFormMonthlyPrice(parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                      />
                      <p className="text-xs text-text-muted mt-1">约 {formatPrice(formMonthlyPrice)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">季付价格（分）</label>
                      <input
                        type="number"
                        value={formQuarterlyPrice}
                        onChange={(e) => setFormQuarterlyPrice(parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                      />
                      <p className="text-xs text-text-muted mt-1">约 {formatPrice(formQuarterlyPrice)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">半年付价格（分）</label>
                      <input
                        type="number"
                        value={formHalfYearlyPrice}
                        onChange={(e) => setFormHalfYearlyPrice(parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                      />
                      <p className="text-xs text-text-muted mt-1">约 {formatPrice(formHalfYearlyPrice)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">年付价格（分）</label>
                      <input
                        type="number"
                        value={formYearlyPrice}
                        onChange={(e) => setFormYearlyPrice(parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                      />
                      <p className="text-xs text-text-muted mt-1">约 {formatPrice(formYearlyPrice)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {privilegeItems.map((item) => (
                    <div key={item.key} className="flex items-center justify-between p-4 bg-bg-elevated rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                          <item.icon className="w-5 h-5 text-violet-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-text-primary">{item.label}</p>
                          <p className="text-xs text-text-muted">{item.description}</p>
                        </div>
                      </div>
                      <div>
                        {item.type === "boolean" ? (
                          <button
                            onClick={() =>
                              setFormPrivileges((prev) => ({
                                ...prev,
                                [item.key]: !prev[item.key],
                              }))
                            }
                            className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${
                              formPrivileges[item.key] ? "bg-violet-500" : "bg-bg-active"
                            }`}
                          >
                            <span
                              className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                                formPrivileges[item.key] ? "left-7" : "left-1"
                              }`}
                            />
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={formPrivileges[item.key] as number}
                              onChange={(e) =>
                                setFormPrivileges((prev) => ({
                                  ...prev,
                                  [item.key]: parseInt(e.target.value) || 0,
                                }))
                              }
                              className="w-20 px-3 py-1.5 bg-bg-card border border-border-default rounded-lg text-text-primary text-center focus:outline-none focus:border-violet-500"
                            />
                            <button
                              onClick={() =>
                                setFormPrivileges((prev) => ({
                                  ...prev,
                                  [item.key]: -1,
                                }))
                              }
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                                formPrivileges[item.key] === -1
                                  ? "bg-violet-500 text-white"
                                  : "bg-bg-card border border-border-default text-text-secondary hover:text-text-primary"
                              }`}
                            >
                              无限
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 弹窗底部 */}
            <div className="flex justify-end gap-3 p-6 border-t border-border-default">
              <button
                onClick={() => setEditingLevel(null)}
                className="px-4 py-2.5 bg-bg-elevated hover:bg-bg-active text-text-primary rounded-xl font-medium transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleUpdate}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 cursor-pointer"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 创建套餐弹窗 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-card border border-border-default rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* 弹窗头部 */}
            <div className="flex items-center justify-between p-6 border-b border-border-default">
              <h2 className="text-xl font-bold text-text-primary">创建VIP套餐</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-bg-elevated rounded-lg cursor-pointer">
                <X className="w-5 h-5 text-text-secondary" />
              </button>
            </div>

            {/* Tab 切换 */}
            <div className="flex border-b border-border-default px-6">
              <button
                onClick={() => setActiveTab("basic")}
                className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
                  activeTab === "basic"
                    ? "border-violet-500 text-violet-500"
                    : "border-transparent text-text-secondary hover:text-text-primary"
                }`}
              >
                基本信息
              </button>
              <button
                onClick={() => setActiveTab("privileges")}
                className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
                  activeTab === "privileges"
                    ? "border-violet-500 text-violet-500"
                    : "border-transparent text-text-secondary hover:text-text-primary"
                }`}
              >
                权益配置
              </button>
            </div>

            {/* 弹窗内容 */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === "basic" ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">套餐标识 *</label>
                      <input
                        type="text"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                        placeholder="如: basic, pro, premium"
                        className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                      />
                      <p className="text-xs text-text-muted mt-1">唯一标识，只能包含小写字母、数字和下划线</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">显示名称 *</label>
                      <input
                        type="text"
                        value={formDisplayName}
                        onChange={(e) => setFormDisplayName(e.target.value)}
                        placeholder="如: 基础版、专业版"
                        className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">描述</label>
                    <textarea
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      rows={3}
                      placeholder="套餐描述信息"
                      className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">月付价格（分）</label>
                      <input
                        type="number"
                        value={formMonthlyPrice}
                        onChange={(e) => setFormMonthlyPrice(parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                      />
                      <p className="text-xs text-text-muted mt-1">约 {formatPrice(formMonthlyPrice)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">季付价格（分）</label>
                      <input
                        type="number"
                        value={formQuarterlyPrice}
                        onChange={(e) => setFormQuarterlyPrice(parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                      />
                      <p className="text-xs text-text-muted mt-1">约 {formatPrice(formQuarterlyPrice)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">半年付价格（分）</label>
                      <input
                        type="number"
                        value={formHalfYearlyPrice}
                        onChange={(e) => setFormHalfYearlyPrice(parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                      />
                      <p className="text-xs text-text-muted mt-1">约 {formatPrice(formHalfYearlyPrice)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">年付价格（分）</label>
                      <input
                        type="number"
                        value={formYearlyPrice}
                        onChange={(e) => setFormYearlyPrice(parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                      />
                      <p className="text-xs text-text-muted mt-1">约 {formatPrice(formYearlyPrice)}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">排序</label>
                    <input
                      type="number"
                      value={formSortOrder}
                      onChange={(e) => setFormSortOrder(parseInt(e.target.value) || 0)}
                      className="w-32 px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                    />
                    <p className="text-xs text-text-muted mt-1">数字越小越靠前</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {privilegeItems.map((item) => (
                    <div key={item.key} className="flex items-center justify-between p-4 bg-bg-elevated rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                          <item.icon className="w-5 h-5 text-violet-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-text-primary">{item.label}</p>
                          <p className="text-xs text-text-muted">{item.description}</p>
                        </div>
                      </div>
                      <div>
                        {item.type === "boolean" ? (
                          <button
                            onClick={() =>
                              setFormPrivileges((prev) => ({
                                ...prev,
                                [item.key]: !prev[item.key],
                              }))
                            }
                            className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${
                              formPrivileges[item.key] ? "bg-violet-500" : "bg-bg-active"
                            }`}
                          >
                            <span
                              className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                                formPrivileges[item.key] ? "left-7" : "left-1"
                              }`}
                            />
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={formPrivileges[item.key] as number}
                              onChange={(e) =>
                                setFormPrivileges((prev) => ({
                                  ...prev,
                                  [item.key]: parseInt(e.target.value) || 0,
                                }))
                              }
                              className="w-20 px-3 py-1.5 bg-bg-card border border-border-default rounded-lg text-text-primary text-center focus:outline-none focus:border-violet-500"
                            />
                            <button
                              onClick={() =>
                                setFormPrivileges((prev) => ({
                                  ...prev,
                                  [item.key]: -1,
                                }))
                              }
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                                formPrivileges[item.key] === -1
                                  ? "bg-violet-500 text-white"
                                  : "bg-bg-card border border-border-default text-text-secondary hover:text-text-primary"
                              }`}
                            >
                              无限
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 弹窗底部 */}
            <div className="flex justify-end gap-3 p-6 border-t border-border-default">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2.5 bg-bg-elevated hover:bg-bg-active text-text-primary rounded-xl font-medium transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !formName || !formDisplayName}
                className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 cursor-pointer"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
