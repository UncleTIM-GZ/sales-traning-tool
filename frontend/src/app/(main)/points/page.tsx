"use client";

/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：积分中心页面
 * 作用：显示积分余额、获取途径、明细列表
 * 创建时间：2025-12-24
 * 最后修改：2025-12-24
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Coins,
  TrendingUp,
  TrendingDown,
  Gift,
  Calendar,
  ChevronRight,
  Loader2,
  Clock,
  Target,
  Share2,
  UserPlus,
  BookOpen,
  QrCode,
} from "lucide-react";
import {
  pointsApi,
  PointsAccount,
  PointsTransaction,
  PointsRules,
  DailyPointsStats,
  redeemCodeApi,
} from "@/lib/api";

const EARN_METHODS = [
  {
    icon: <Calendar className="w-5 h-5" />,
    title: "每日登录",
    key: "daily_login",
    color: "text-violet-400",
    bgColor: "bg-violet-500/15",
  },
  {
    icon: <Target className="w-5 h-5" />,
    title: "完成训练",
    key: "training_complete_max",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/15",
  },
  {
    icon: <BookOpen className="w-5 h-5" />,
    title: "完成课程",
    key: "course_complete",
    color: "text-blue-400",
    bgColor: "bg-blue-500/15",
  },
  {
    icon: <Share2 className="w-5 h-5" />,
    title: "分享场景",
    key: "scenario_share",
    color: "text-amber-400",
    bgColor: "bg-amber-500/15",
  },
  {
    icon: <UserPlus className="w-5 h-5" />,
    title: "邀请好友",
    key: "invite_register",
    color: "text-pink-400",
    bgColor: "bg-pink-500/15",
  },
];

export default function PointsPage() {
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<PointsAccount | null>(null);
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [rules, setRules] = useState<PointsRules | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyPointsStats | null>(null);
  const [transactionType, setTransactionType] = useState<string>("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionType, page]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [accountRes, rulesRes, statsRes] = await Promise.all([
        pointsApi.getAccount(),
        pointsApi.getRules(),
        pointsApi.getDailyStats(),
      ]);
      setAccount(accountRes);
      setRules(rulesRes);
      setDailyStats(statsRes);
    } catch (error) {
      console.error("加载积分信息失败", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      const res = await pointsApi.getTransactions({
        type: transactionType || undefined,
        page,
        page_size: 20,
      });
      setTransactions(res.transactions);
      setTotal(res.total);
    } catch (error) {
      console.error("加载交易记录失败", error);
    }
  };

  const handleRedeem = async () => {
    if (!redeemCode.trim()) {
      alert("请输入兑换码");
      return;
    }

    setRedeeming(true);
    try {
      const res = await redeemCodeApi.redeem(redeemCode.trim());
      if (res.success) {
        let message = res.message;
        if (res.points_added) {
          message += `\n获得 ${res.points_added} 积分`;
        }
        if (res.vip_extended_to) {
          message += `\nVIP延长至 ${new Date(res.vip_extended_to).toLocaleDateString()}`;
        }
        alert(message);
        setRedeemCode("");
        fetchData();
        fetchTransactions();
      } else {
        alert(res.message || "兑换失败");
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "兑换失败");
    } finally {
      setRedeeming(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* 积分概览 */}
      <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl p-8 mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="relative z-10">
          <div className="flex items-center gap-2 text-white/80 mb-2">
            <Coins className="w-5 h-5" />
            <span>可用积分</span>
          </div>
          <div className="text-5xl font-bold text-white mb-4">
            {account?.available_balance || 0}
          </div>

          <div className="flex gap-6 text-white/80 text-sm">
            <div>
              <span className="block text-white/60">累计获取</span>
              <span className="text-lg font-medium text-white">
                {account?.total_earned || 0}
              </span>
            </div>
            <div>
              <span className="block text-white/60">累计消费</span>
              <span className="text-lg font-medium text-white">
                {account?.total_spent || 0}
              </span>
            </div>
            {account && account.locked > 0 && (
              <div>
                <span className="block text-white/60">锁定中</span>
                <span className="text-lg font-medium text-white">
                  {account.locked}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 今日统计 & 每日签到 & 兑换码 */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <div className="bg-bg-card border border-border-default rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-text-primary flex items-center gap-2">
              <Clock className="w-5 h-5 text-violet-400" />
              今日获取
            </h3>
            <span className="text-sm text-text-muted">
              上限 {dailyStats?.daily_limit || 0}
            </span>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-text-primary">
              {dailyStats?.earned_today || 0}
            </span>
            <span className="text-text-muted mb-1">
              / {dailyStats?.daily_limit || 0}
            </span>
          </div>
          <div className="mt-3 h-2 bg-bg-subtle rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-500 rounded-full transition-all"
              style={{
                width: `${Math.min(
                  100,
                  ((dailyStats?.earned_today || 0) /
                    (dailyStats?.daily_limit || 1)) *
                    100
                )}%`,
              }}
            />
          </div>
        </div>

        <Link
          href="/plaza"
          className="bg-bg-card border border-border-default rounded-2xl p-6 hover:border-violet-500/50 transition-colors block"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-text-primary flex items-center gap-2">
              <Gift className="w-5 h-5 text-amber-400" />
              每日签到
            </h3>
            <ChevronRight className="w-5 h-5 text-text-muted" />
          </div>
          <p className="text-text-muted text-sm mb-2">
            每日签到可获得 {rules?.earn_rules?.daily_login || 0} 积分
          </p>
          <p className="text-amber-400 text-sm">
            前往训练广场签到
          </p>
        </Link>

        <div className="bg-bg-card border border-border-default rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-text-primary flex items-center gap-2">
              <QrCode className="w-5 h-5 text-emerald-400" />
              兑换码
            </h3>
          </div>
          <p className="text-text-muted text-sm mb-3">
            输入兑换码获取积分或VIP
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={redeemCode}
              onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
              placeholder="输入兑换码"
              className="flex-1 px-3 py-2.5 bg-bg-subtle border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500 font-mono text-sm"
            />
            <button
              onClick={handleRedeem}
              disabled={redeeming || !redeemCode.trim()}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center"
            >
              {redeeming ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "兑换"
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 获取途径 */}
      <div className="mb-8">
        <h2 className="text-lg font-medium text-text-primary mb-4">
          积分获取途径
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {EARN_METHODS.map((method) => (
            <div
              key={method.key}
              className="bg-bg-card border border-border-default rounded-xl p-4 text-center"
            >
              <div
                className={`w-10 h-10 rounded-xl ${method.bgColor} flex items-center justify-center mx-auto mb-2 ${method.color}`}
              >
                {method.icon}
              </div>
              <div className="text-sm text-text-primary mb-1">
                {method.title}
              </div>
              <div className="text-xs text-text-muted">
                +{rules?.earn_rules?.[method.key] || 0}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 积分明细 */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-text-primary">积分明细</h2>
          <div className="flex gap-2">
            {["", "earn", "spend"].map((type) => (
              <button
                key={type}
                onClick={() => {
                  setTransactionType(type);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  transactionType === type
                    ? "bg-violet-500 text-white"
                    : "bg-bg-subtle text-text-secondary hover:bg-bg-card"
                }`}
              >
                {type === "" ? "全部" : type === "earn" ? "获取" : "消费"}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-bg-card border border-border-default rounded-2xl divide-y divide-border-default">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-text-muted">暂无记录</div>
          ) : (
            transactions.map((tx) => (
              <div
                key={tx.id}
                className="p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      tx.amount > 0
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-red-500/15 text-red-400"
                    }`}
                  >
                    {tx.amount > 0 ? (
                      <TrendingUp className="w-5 h-5" />
                    ) : (
                      <TrendingDown className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="text-text-primary">
                      {tx.description || getSourceName(tx.source)}
                    </div>
                    <div className="text-sm text-text-muted">
                      {new Date(tx.created_at).toLocaleString("zh-CN")}
                    </div>
                  </div>
                </div>
                <div
                  className={`text-lg font-medium ${
                    tx.amount > 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {tx.amount > 0 ? "+" : ""}
                  {tx.amount}
                </div>
              </div>
            ))
          )}
        </div>

        {/* 分页 */}
        {total > 20 && (
          <div className="flex justify-center gap-2 mt-4">
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

      {/* 积分商城入口 */}
      <div className="mt-8">
        <Link
          href="/points/mall"
          className="flex items-center justify-between p-4 bg-bg-card border border-border-default rounded-xl hover:border-violet-500/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Gift className="w-5 h-5 text-amber-400" />
            <span className="text-text-primary">积分商城</span>
          </div>
          <ChevronRight className="w-5 h-5 text-text-muted" />
        </Link>
      </div>
    </div>
  );
}

function getSourceName(source: string): string {
  const names: Record<string, string> = {
    daily_login: "每日登录",
    training_complete: "完成训练",
    course_complete: "完成课程",
    scenario_share: "分享场景",
    scenario_like: "场景点赞",
    invite_register: "邀请注册",
    vip_purchase: "VIP购买奖励",
    admin_adjust: "管理员调整",
    order_discount: "订单抵扣",
    session_consumption: "训练消耗",
  };
  return names[source] || source;
}
