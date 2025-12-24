"use client";

/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：订单管理页面
 * 作用：管理订单查询、标记支付、退款
 * 创建时间：2025-12-24
 * 最后修改：2025-12-24
 */

import { useState, useEffect, useCallback } from "react";
import {
  ShoppingCart,
  Search,
  Eye,
  CheckCircle,
  XCircle,
  RotateCcw,
  X,
  Loader2,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { adminOrderApi, AdminOrder, AdminOrderDetail, AdminOrderStats } from "@/lib/api";

export default function AdminOrdersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [stats, setStats] = useState<AdminOrderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const data = await adminOrderApi.list({
        page,
        page_size: 20,
        status: statusFilter || undefined,
        search: searchQuery || undefined,
      });
      setOrders(data.items);
      setTotalPages(data.total_pages);
    } catch (error) {
      console.error("Failed to fetch orders:", error);
    }
  }, [page, statusFilter, searchQuery]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await adminOrderApi.getStatistics();
      setStats(data);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchOrders(), fetchStats()]);
    } finally {
      setLoading(false);
    }
  }, [fetchOrders, fetchStats]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleViewDetail = async (orderId: string) => {
    setLoadingDetail(true);
    try {
      const data = await adminOrderApi.get(orderId);
      setSelectedOrder(data);
    } catch (error) {
      console.error("Failed to fetch order detail:", error);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleMarkPaid = async (orderId: string) => {
    if (!confirm("确定要标记此订单为已支付吗？")) return;

    try {
      await adminOrderApi.markPaid(orderId);
      fetchData();
      if (selectedOrder?.id === orderId) {
        handleViewDetail(orderId);
      }
    } catch (error) {
      console.error("Failed to mark paid:", error);
      alert(error instanceof Error ? error.message : "操作失败");
    }
  };

  const handleRefund = async (orderId: string) => {
    if (!confirm("确定要退款此订单吗？此操作不可撤销。")) return;

    try {
      await adminOrderApi.refund(orderId);
      fetchData();
      if (selectedOrder?.id === orderId) {
        handleViewDetail(orderId);
      }
    } catch (error) {
      console.error("Failed to refund:", error);
      alert(error instanceof Error ? error.message : "退款失败");
    }
  };

  const handleCancel = async (orderId: string) => {
    if (!confirm("确定要取消此订单吗？")) return;

    try {
      await adminOrderApi.cancel(orderId);
      fetchData();
    } catch (error) {
      console.error("Failed to cancel:", error);
      alert(error instanceof Error ? error.message : "取消失败");
    }
  };

  const formatAmount = (amount: number) => `${(amount / 100).toFixed(2)}元`;

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-amber-500/10 text-amber-400",
      paying: "bg-blue-500/10 text-blue-400",
      paid: "bg-emerald-500/10 text-emerald-400",
      cancelled: "bg-surface-hover text-text-muted",
      refunding: "bg-purple-500/10 text-purple-400",
      refunded: "bg-red-500/10 text-red-400",
      failed: "bg-red-500/10 text-red-400",
    };
    const labels: Record<string, string> = {
      pending: "待支付",
      paying: "支付中",
      paid: "已支付",
      cancelled: "已取消",
      refunding: "退款中",
      refunded: "已退款",
      failed: "支付失败",
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-lg ${styles[status] || styles.pending}`}>
        {labels[status] || status}
      </span>
    );
  };

  const statsCards = [
    { label: "总订单", value: stats?.total.toString() || "0", icon: ShoppingCart, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "已支付", value: stats?.paid.toString() || "0", icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "今日收入", value: formatAmount(stats?.today_amount || 0), icon: DollarSign, color: "text-amber-400", bg: "bg-amber-500/10" },
    { label: "成功率", value: `${stats?.success_rate || 0}%`, icon: TrendingUp, color: "text-purple-400", bg: "bg-purple-500/10" },
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
      <div>
        <h1 className="text-2xl font-bold text-text-primary">订单管理</h1>
        <p className="text-text-secondary text-sm mt-1">管理订单查询和处理</p>
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
            placeholder="搜索订单号..."
            className="w-full pl-10 pr-4 py-2.5 bg-bg-card border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 bg-bg-card border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500 cursor-pointer"
        >
          <option value="">全部状态</option>
          <option value="pending">待支付</option>
          <option value="paid">已支付</option>
          <option value="cancelled">已取消</option>
          <option value="refunded">已退款</option>
        </select>
      </div>

      {/* 订单列表 */}
      <div className="bg-bg-card border border-border-default rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-default">
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">订单号</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">用户</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">商品</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">金额</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">状态</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">时间</th>
              <th className="text-right px-6 py-4 text-sm font-medium text-text-secondary">操作</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-text-muted">
                  暂无订单
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="border-b border-border-default/50 hover:bg-bg-elevated/30">
                  <td className="px-6 py-4">
                    <span className="font-mono text-text-primary text-sm">{order.order_no}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-text-primary">{order.user_nickname || "未知"}</div>
                    <div className="text-xs text-text-muted">{order.user_phone}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-text-primary">{order.product_name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-text-primary font-medium">{formatAmount(order.final_amount)}</div>
                    {order.discount_amount > 0 && (
                      <div className="text-xs text-emerald-400">-{formatAmount(order.discount_amount)}</div>
                    )}
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(order.status)}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-text-secondary">
                      {new Date(order.created_at).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleViewDetail(order.id)} className="p-2 hover:bg-bg-elevated rounded-lg cursor-pointer">
                        <Eye className="w-4 h-4 text-text-secondary" />
                      </button>
                      {order.status === "pending" && (
                        <>
                          <button onClick={() => handleMarkPaid(order.id)} className="p-2 hover:bg-bg-elevated rounded-lg cursor-pointer" title="标记已支付">
                            <CheckCircle className="w-4 h-4 text-text-secondary hover:text-emerald-400" />
                          </button>
                          <button onClick={() => handleCancel(order.id)} className="p-2 hover:bg-bg-elevated rounded-lg cursor-pointer" title="取消订单">
                            <XCircle className="w-4 h-4 text-text-secondary hover:text-red-400" />
                          </button>
                        </>
                      )}
                      {order.status === "paid" && (
                        <button onClick={() => handleRefund(order.id)} className="p-2 hover:bg-bg-elevated rounded-lg cursor-pointer" title="退款">
                          <RotateCcw className="w-4 h-4 text-text-secondary hover:text-amber-400" />
                        </button>
                      )}
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
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 bg-bg-card border border-border-default rounded-lg text-text-secondary disabled:opacity-50 cursor-pointer">
            上一页
          </button>
          <span className="px-4 py-2 text-text-secondary">{page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-4 py-2 bg-bg-card border border-border-default rounded-lg text-text-secondary disabled:opacity-50 cursor-pointer">
            下一页
          </button>
        </div>
      )}

      {/* 订单详情弹窗 */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-card border border-border-default rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-text-primary">订单详情</h2>
              <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-bg-elevated rounded-lg cursor-pointer">
                <X className="w-5 h-5 text-text-secondary" />
              </button>
            </div>

            {loadingDetail ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-text-muted">订单号</p>
                    <p className="font-mono text-text-primary">{selectedOrder.order_no}</p>
                  </div>
                  <div>
                    <p className="text-sm text-text-muted">状态</p>
                    <div className="mt-1">{getStatusBadge(selectedOrder.status)}</div>
                  </div>
                  <div>
                    <p className="text-sm text-text-muted">用户</p>
                    <p className="text-text-primary">{selectedOrder.user.nickname || "未知"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-text-muted">手机号</p>
                    <p className="text-text-primary">{selectedOrder.user.phone || "-"}</p>
                  </div>
                </div>

                <div className="border-t border-border-default pt-4">
                  <p className="text-sm text-text-muted mb-2">商品信息</p>
                  <p className="text-text-primary font-medium">{selectedOrder.product_name}</p>
                  <p className="text-sm text-text-secondary">{selectedOrder.product_desc}</p>
                </div>

                <div className="border-t border-border-default pt-4">
                  <p className="text-sm text-text-muted mb-2">金额明细</p>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-text-secondary">原价</span>
                      <span className="text-text-primary">{formatAmount(selectedOrder.original_amount)}</span>
                    </div>
                    {selectedOrder.discount_amount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-text-secondary">优惠券抵扣</span>
                        <span className="text-emerald-400">-{formatAmount(selectedOrder.discount_amount)}</span>
                      </div>
                    )}
                    {selectedOrder.points_discount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-text-secondary">积分抵扣</span>
                        <span className="text-emerald-400">-{formatAmount(selectedOrder.points_discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-medium pt-2 border-t border-border-default">
                      <span className="text-text-primary">实付金额</span>
                      <span className="text-amber-400">{formatAmount(selectedOrder.final_amount)}</span>
                    </div>
                  </div>
                </div>

                {selectedOrder.refunds.length > 0 && (
                  <div className="border-t border-border-default pt-4">
                    <p className="text-sm text-text-muted mb-2">退款记录</p>
                    {selectedOrder.refunds.map((refund) => (
                      <div key={refund.id} className="p-3 bg-bg-elevated rounded-lg">
                        <div className="flex justify-between">
                          <span className="text-text-secondary">退款金额</span>
                          <span className="text-red-400">{formatAmount(refund.amount)}</span>
                        </div>
                        <p className="text-sm text-text-muted mt-1">{refund.reason}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-border-default">
                  {selectedOrder.status === "pending" && (
                    <>
                      <button onClick={() => handleMarkPaid(selectedOrder.id)} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors cursor-pointer">
                        标记已支付
                      </button>
                      <button onClick={() => handleCancel(selectedOrder.id)} className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors cursor-pointer">
                        取消订单
                      </button>
                    </>
                  )}
                  {selectedOrder.status === "paid" && (
                    <button onClick={() => handleRefund(selectedOrder.id)} className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-medium transition-colors cursor-pointer">
                      退款
                    </button>
                  )}
                  <button onClick={() => setSelectedOrder(null)} className="px-4 py-2.5 bg-bg-elevated hover:bg-bg-active text-text-primary rounded-xl font-medium transition-colors cursor-pointer">
                    关闭
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
