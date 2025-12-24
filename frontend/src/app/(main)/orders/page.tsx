"use client";

/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：订单列表页面
 * 作用：显示订单列表、状态筛选
 * 创建时间：2025-12-24
 * 最后修改：2025-12-24
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronRight,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { orderApi, Order } from "@/lib/api";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  pending: {
    label: "待支付",
    color: "text-amber-400 bg-amber-500/15",
    icon: <Clock className="w-4 h-4" />,
  },
  paying: {
    label: "支付中",
    color: "text-blue-400 bg-blue-500/15",
    icon: <RefreshCw className="w-4 h-4 animate-spin" />,
  },
  paid: {
    label: "已支付",
    color: "text-emerald-400 bg-emerald-500/15",
    icon: <CheckCircle className="w-4 h-4" />,
  },
  cancelled: {
    label: "已取消",
    color: "text-text-muted bg-surface-hover",
    icon: <XCircle className="w-4 h-4" />,
  },
  refunding: {
    label: "退款中",
    color: "text-orange-400 bg-orange-500/15",
    icon: <RefreshCw className="w-4 h-4" />,
  },
  refunded: {
    label: "已退款",
    color: "text-text-muted bg-surface-hover",
    icon: <CheckCircle className="w-4 h-4" />,
  },
  failed: {
    label: "支付失败",
    color: "text-red-400 bg-red-500/15",
    icon: <AlertCircle className="w-4 h-4" />,
  },
};

const STATUS_TABS = [
  { value: "", label: "全部" },
  { value: "pending", label: "待支付" },
  { value: "paid", label: "已支付" },
  { value: "cancelled", label: "已取消" },
];

export default function OrdersPage() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await orderApi.list({
        status: status || undefined,
        page,
        page_size: 20,
      });
      setOrders(res.orders);
      setTotal(res.total);
    } catch (error) {
      console.error("加载订单失败", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (orderId: string) => {
    if (!confirm("确定要取消此订单吗？")) return;

    try {
      await orderApi.cancel(orderId);
      fetchOrders();
    } catch (error) {
      alert(error instanceof Error ? error.message : "取消失败");
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <ShoppingBag className="w-6 h-6 text-violet-400" />
          我的订单
        </h1>
      </div>

      {/* 状态筛选 */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setStatus(tab.value);
              setPage(1);
            }}
            className={`px-4 py-2 rounded-xl text-sm whitespace-nowrap transition-colors ${
              status === tab.value
                ? "bg-violet-500 text-white"
                : "bg-bg-card border border-border-default text-text-secondary hover:border-violet-500/50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 订单列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20">
          <ShoppingBag className="w-16 h-16 text-text-muted mx-auto mb-4" />
          <p className="text-text-muted">暂无订单</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const statusConfig = STATUS_CONFIG[order.status] || {
              label: order.status,
              color: "text-text-muted bg-bg-subtle",
              icon: null,
            };

            return (
              <div
                key={order.id}
                className="bg-bg-card border border-border-default rounded-2xl overflow-hidden"
              >
                {/* 订单头部 */}
                <div className="px-6 py-4 border-b border-border-default flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-text-muted text-sm">
                      订单号: {order.order_no}
                    </span>
                    <span className="text-text-muted text-sm">
                      {new Date(order.created_at).toLocaleString("zh-CN")}
                    </span>
                  </div>
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm ${statusConfig.color}`}
                  >
                    {statusConfig.icon}
                    {statusConfig.label}
                  </div>
                </div>

                {/* 订单内容 */}
                <div className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-text-primary font-medium mb-1">
                        {order.product_name}
                      </h3>
                      {order.product_desc && (
                        <p className="text-text-muted text-sm">
                          {order.product_desc}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-text-primary">
                        ¥{(order.final_amount / 100).toFixed(2)}
                      </div>
                      {order.discount_amount > 0 && (
                        <div className="text-sm text-text-muted line-through">
                          ¥{(order.original_amount / 100).toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 优惠信息 */}
                  {(order.discount_amount > 0 || order.points_discount > 0) && (
                    <div className="mt-3 flex gap-4 text-sm">
                      {order.discount_amount > 0 && (
                        <span className="text-emerald-400">
                          优惠券 -¥{(order.discount_amount / 100).toFixed(2)}
                        </span>
                      )}
                      {order.points_discount > 0 && (
                        <span className="text-amber-400">
                          积分抵扣 -¥{(order.points_discount / 100).toFixed(2)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* 订单操作 */}
                <div className="px-6 py-4 bg-bg-subtle flex items-center justify-between">
                  <Link
                    href={`/orders/${order.id}`}
                    className="text-violet-400 hover:text-violet-300 text-sm flex items-center gap-1"
                  >
                    查看详情
                    <ChevronRight className="w-4 h-4" />
                  </Link>

                  <div className="flex gap-3">
                    {order.status === "pending" && (
                      <>
                        <button
                          onClick={() => handleCancel(order.id)}
                          className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
                        >
                          取消订单
                        </button>
                        <Link
                          href={`/orders/${order.id}/pay`}
                          className="px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white text-sm rounded-lg transition-colors"
                        >
                          立即支付
                        </Link>
                      </>
                    )}
                    {order.status === "paid" && (
                      <Link
                        href={`/orders/${order.id}/refund`}
                        className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
                      >
                        申请退款
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 分页 */}
      {total > 20 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-bg-subtle text-text-secondary rounded-lg disabled:opacity-50"
          >
            上一页
          </button>
          <span className="px-4 py-2 text-text-muted">
            {page} / {Math.ceil(total / 20)}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(total / 20)}
            className="px-4 py-2 bg-bg-subtle text-text-secondary rounded-lg disabled:opacity-50"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}
