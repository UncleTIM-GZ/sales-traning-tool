"use client";

/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：优惠券管理页面
 * 作用：管理优惠券创建、编辑、启用/禁用
 * 创建时间：2025-12-24
 * 最后修改：2025-12-24
 */

import { useState, useEffect, useCallback } from "react";
import {
  Ticket,
  Search,
  Plus,
  CheckCircle,
  XCircle,
  Edit2,
  Trash2,
  X,
  Loader2,
  Percent,
  DollarSign,
  Calendar,
  Users,
} from "lucide-react";
import { adminCouponApi, AdminCoupon, AdminCouponStats } from "@/lib/api";

export default function AdminCouponsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<AdminCoupon | null>(null);
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [stats, setStats] = useState<AdminCouponStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // 表单状态
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formType, setFormType] = useState("fixed");
  const [formValue, setFormValue] = useState(1000);
  const [formMaxDiscount, setFormMaxDiscount] = useState<number | undefined>();
  const [formMinOrderAmount, setFormMinOrderAmount] = useState(0);
  const [formValidFrom, setFormValidFrom] = useState("");
  const [formValidUntil, setFormValidUntil] = useState("");
  const [formUsageLimit, setFormUsageLimit] = useState(-1);
  const [formPerUserLimit, setFormPerUserLimit] = useState(1);

  const fetchCoupons = useCallback(async () => {
    try {
      const data = await adminCouponApi.list({
        page,
        page_size: 20,
        status: statusFilter || undefined,
        type: typeFilter || undefined,
        search: searchQuery || undefined,
      });
      setCoupons(data.items);
      setTotalPages(data.total_pages);
    } catch (error) {
      console.error("Failed to fetch coupons:", error);
    }
  }, [page, statusFilter, typeFilter, searchQuery]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await adminCouponApi.getStatistics();
      setStats(data);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchCoupons(), fetchStats()]);
    } finally {
      setLoading(false);
    }
  }, [fetchCoupons, fetchStats]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async () => {
    if (!formName || !formValidUntil) return;

    setSaving(true);
    try {
      await adminCouponApi.create({
        code: formCode || undefined,
        name: formName,
        description: formDescription || undefined,
        type: formType,
        value: formValue,
        max_discount: formType === "percentage" ? formMaxDiscount : undefined,
        min_order_amount: formMinOrderAmount,
        valid_from: formValidFrom || new Date().toISOString(),
        valid_until: formValidUntil,
        usage_limit: formUsageLimit,
        per_user_limit: formPerUserLimit,
      });
      setShowCreateModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Failed to create coupon:", error);
      alert(error instanceof Error ? error.message : "创建失败");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingCoupon) return;

    setSaving(true);
    try {
      await adminCouponApi.update(editingCoupon.id, {
        name: formName,
        description: formDescription,
        type: formType,
        value: formValue,
        max_discount: formType === "percentage" ? formMaxDiscount : undefined,
        min_order_amount: formMinOrderAmount,
        valid_from: formValidFrom,
        valid_until: formValidUntil,
        usage_limit: formUsageLimit,
        per_user_limit: formPerUserLimit,
      });
      setEditingCoupon(null);
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Failed to update coupon:", error);
      alert(error instanceof Error ? error.message : "更新失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个优惠券吗？")) return;

    try {
      await adminCouponApi.delete(id);
      fetchData();
    } catch (error) {
      console.error("Failed to delete coupon:", error);
      alert(error instanceof Error ? error.message : "删除失败");
    }
  };

  const handleToggleActive = async (coupon: AdminCoupon) => {
    try {
      if (coupon.is_active) {
        await adminCouponApi.disable(coupon.id);
      } else {
        await adminCouponApi.enable(coupon.id);
      }
      fetchData();
    } catch (error) {
      console.error("Failed to toggle coupon:", error);
    }
  };

  const resetForm = () => {
    setFormCode("");
    setFormName("");
    setFormDescription("");
    setFormType("fixed");
    setFormValue(1000);
    setFormMaxDiscount(undefined);
    setFormMinOrderAmount(0);
    setFormValidFrom("");
    setFormValidUntil("");
    setFormUsageLimit(-1);
    setFormPerUserLimit(1);
  };

  const openEditModal = (coupon: AdminCoupon) => {
    setEditingCoupon(coupon);
    setFormCode(coupon.code);
    setFormName(coupon.name);
    setFormDescription(coupon.description || "");
    setFormType(coupon.type);
    setFormValue(coupon.value);
    setFormMaxDiscount(coupon.max_discount || undefined);
    setFormMinOrderAmount(coupon.min_order_amount);
    setFormValidFrom(coupon.valid_from.slice(0, 16));
    setFormValidUntil(coupon.valid_until.slice(0, 16));
    setFormUsageLimit(coupon.usage_limit);
    setFormPerUserLimit(coupon.per_user_limit);
  };

  const formatValue = (type: string, value: number) => {
    if (type === "fixed") return `${(value / 100).toFixed(2)}元`;
    return `${value}%`;
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-emerald-500/10 text-emerald-400",
      expired: "bg-red-500/10 text-red-400",
      disabled: "bg-surface-hover text-text-muted",
      pending: "bg-amber-500/10 text-amber-400",
    };
    const labels: Record<string, string> = {
      active: "有效",
      expired: "已过期",
      disabled: "已禁用",
      pending: "未开始",
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-lg ${styles[status] || styles.disabled}`}>
        {labels[status] || status}
      </span>
    );
  };

  const statsCards = [
    { label: "总优惠券", value: stats?.total.toString() || "0", icon: Ticket, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "有效优惠券", value: stats?.active.toString() || "0", icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "已领取", value: stats?.total_claimed.toString() || "0", icon: Users, color: "text-amber-400", bg: "bg-amber-500/10" },
    { label: "使用率", value: `${stats?.usage_rate || 0}%`, icon: Percent, color: "text-purple-400", bg: "bg-purple-500/10" },
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
          <h1 className="text-2xl font-bold text-text-primary">优惠券管理</h1>
          <p className="text-text-secondary text-sm mt-1">管理优惠券创建和发放</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          创建优惠券
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
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索优惠券..."
            className="w-full pl-10 pr-4 py-2.5 bg-bg-card border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 bg-bg-card border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500 cursor-pointer"
        >
          <option value="">全部状态</option>
          <option value="active">有效</option>
          <option value="expired">已过期</option>
          <option value="disabled">已禁用</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2.5 bg-bg-card border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500 cursor-pointer"
        >
          <option value="">全部类型</option>
          <option value="fixed">固定金额</option>
          <option value="percentage">百分比</option>
        </select>
      </div>

      {/* 优惠券列表 */}
      <div className="bg-bg-card border border-border-default rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-default">
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">优惠券</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">类型/面值</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">使用情况</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">有效期</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">状态</th>
              <th className="text-right px-6 py-4 text-sm font-medium text-text-secondary">操作</th>
            </tr>
          </thead>
          <tbody>
            {coupons.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-text-muted">
                  暂无优惠券
                </td>
              </tr>
            ) : (
              coupons.map((coupon) => (
                <tr key={coupon.id} className="border-b border-border-default/50 hover:bg-bg-elevated/30">
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-text-primary">{coupon.name}</div>
                      <div className="text-sm text-text-muted font-mono">{coupon.code}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {coupon.type === "fixed" ? (
                        <DollarSign className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Percent className="w-4 h-4 text-amber-400" />
                      )}
                      <span className="text-text-primary font-medium">
                        {formatValue(coupon.type, coupon.value)}
                      </span>
                    </div>
                    {coupon.min_order_amount > 0 && (
                      <div className="text-xs text-text-muted mt-1">
                        满{(coupon.min_order_amount / 100).toFixed(0)}元可用
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-text-primary">
                      {coupon.used_count} / {coupon.usage_limit === -1 ? "无限" : coupon.usage_limit}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-text-secondary">
                      {new Date(coupon.valid_until).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(coupon.status)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleToggleActive(coupon)}
                        className="p-2 hover:bg-bg-elevated rounded-lg transition-colors cursor-pointer"
                        title={coupon.is_active ? "禁用" : "启用"}
                      >
                        {coupon.is_active ? (
                          <XCircle className="w-4 h-4 text-text-secondary hover:text-red-400" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-text-secondary hover:text-emerald-400" />
                        )}
                      </button>
                      <button
                        onClick={() => openEditModal(coupon)}
                        className="p-2 hover:bg-bg-elevated rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4 text-text-secondary" />
                      </button>
                      <button
                        onClick={() => handleDelete(coupon.id)}
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

      {/* 创建/编辑弹窗 */}
      {(showCreateModal || editingCoupon) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-card border border-border-default rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-text-primary">
                {editingCoupon ? "编辑优惠券" : "创建优惠券"}
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingCoupon(null);
                  resetForm();
                }}
                className="p-2 hover:bg-bg-elevated rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5 text-text-secondary" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">名称 *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="优惠券名称"
                  className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500"
                />
              </div>

              {!editingCoupon && (
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">优惠券码（可选）</label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="留空将自动生成"
                    className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500 font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">描述</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="优惠券描述"
                  className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">类型</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500 cursor-pointer"
                  >
                    <option value="fixed">固定金额</option>
                    <option value="percentage">百分比折扣</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    {formType === "fixed" ? "金额（分）" : "折扣百分比"}
                  </label>
                  <input
                    type="number"
                    value={formValue}
                    onChange={(e) => setFormValue(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              {formType === "percentage" && (
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">最大折扣金额（分）</label>
                  <input
                    type="number"
                    value={formMaxDiscount || ""}
                    onChange={(e) => setFormMaxDiscount(parseInt(e.target.value) || undefined)}
                    placeholder="不限制"
                    className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">最低订单金额（分）</label>
                <input
                  type="number"
                  value={formMinOrderAmount}
                  onChange={(e) => setFormMinOrderAmount(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">开始时间</label>
                  <input
                    type="datetime-local"
                    value={formValidFrom}
                    onChange={(e) => setFormValidFrom(e.target.value)}
                    className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">结束时间 *</label>
                  <input
                    type="datetime-local"
                    value={formValidUntil}
                    onChange={(e) => setFormValidUntil(e.target.value)}
                    className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">总发放量</label>
                  <input
                    type="number"
                    value={formUsageLimit}
                    onChange={(e) => setFormUsageLimit(parseInt(e.target.value) || -1)}
                    placeholder="-1表示无限"
                    className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">每人限领</label>
                  <input
                    type="number"
                    value={formPerUserLimit}
                    onChange={(e) => setFormPerUserLimit(parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingCoupon(null);
                  resetForm();
                }}
                className="px-4 py-2.5 bg-bg-elevated hover:bg-bg-active text-text-primary rounded-xl font-medium transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={editingCoupon ? handleUpdate : handleCreate}
                disabled={saving || !formName || !formValidUntil}
                className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 cursor-pointer"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {editingCoupon ? "保存" : "创建"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
