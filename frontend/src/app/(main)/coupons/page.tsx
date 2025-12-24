/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：用户优惠券中心页面
 * 作用：展示用户优惠券列表，支持领取和兑换优惠券
 * 创建时间：2025-12-24
 * 最后修改：2025-12-24
 */

"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/animations";
import { couponApi, type UserCoupon, type Coupon } from "@/lib/api";

type TabType = "available" | "used" | "expired" | "claim";

interface TabConfig {
  key: TabType;
  label: string;
  icon: string;
}

const tabs: TabConfig[] = [
  { key: "available", label: "可使用", icon: "confirmation_number" },
  { key: "used", label: "已使用", icon: "check_circle" },
  { key: "expired", label: "已过期", icon: "schedule" },
  { key: "claim", label: "领券中心", icon: "card_giftcard" },
];

export default function CouponsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("available");
  const [myCoupons, setMyCoupons] = useState<UserCoupon[]>([]);
  const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimCode, setClaimCode] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 加载我的优惠券
  const loadMyCoupons = async (status?: string) => {
    try {
      setLoading(true);
      const response = await couponApi.getMyCoupons({ status, page_size: 50 });
      setMyCoupons(response.coupons || []);
    } catch (error) {
      console.error("Failed to load coupons:", error);
    } finally {
      setLoading(false);
    }
  };

  // 加载可领取的优惠券
  const loadAvailableCoupons = async () => {
    try {
      setLoading(true);
      const response = await couponApi.list({ page_size: 50 });
      setAvailableCoupons(response.coupons || []);
    } catch (error) {
      console.error("Failed to load available coupons:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "claim") {
      loadAvailableCoupons();
    } else {
      const statusMap: Record<string, string | undefined> = {
        available: "unused",
        used: "used",
        expired: "expired",
      };
      loadMyCoupons(statusMap[activeTab]);
    }
  }, [activeTab]);

  // 领取优惠券
  const handleClaim = async (couponCode: string) => {
    try {
      setClaiming(true);
      setMessage(null);
      const response = await couponApi.claim(couponCode);
      if (response.success) {
        setMessage({ type: "success", text: "优惠券领取成功！" });
        setClaimCode("");
        // 刷新列表
        loadAvailableCoupons();
      } else {
        setMessage({ type: "error", text: response.message || "领取失败" });
      }
    } catch {
      setMessage({ type: "error", text: "领取失败，请稍后重试" });
    } finally {
      setClaiming(false);
    }
  };

  // 格式化折扣显示
  const formatDiscount = (coupon: Coupon) => {
    if (coupon.type === "percentage") {
      return `${coupon.value}折`;
    }
    return `¥${coupon.value}`;
  };

  // 格式化日期
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  // 渲染优惠券卡片
  const renderCouponCard = (userCoupon: UserCoupon) => {
    const coupon = userCoupon.coupon;
    const isExpired = userCoupon.status === "expired";
    const isUsed = userCoupon.status === "used";

    return (
      <StaggerItem key={userCoupon.id}>
        <motion.div
          className={`relative overflow-hidden rounded-xl border ${
            isExpired || isUsed
              ? "bg-surface-dark border-border-dark opacity-60"
              : "bg-gradient-to-br from-orange-500/10 to-amber-500/5 border-orange-500/20"
          }`}
          whileHover={!isExpired && !isUsed ? { scale: 1.02 } : {}}
        >
          {/* 锯齿边缘装饰 */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-8 bg-bg-surface rounded-r-full" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-8 bg-bg-surface rounded-l-full" />

          <div className="flex">
            {/* 左侧金额区域 */}
            <div className={`flex-shrink-0 w-28 p-4 flex flex-col items-center justify-center border-r border-dashed ${
              isExpired || isUsed ? "border-border-dark" : "border-orange-500/20"
            }`}>
              <span className={`text-3xl font-bold ${
                isExpired || isUsed ? "text-text-muted" : "text-orange-400"
              }`}>
                {formatDiscount(coupon)}
              </span>
              {coupon.min_amount > 0 && (
                <span className="text-xs text-text-muted mt-1">
                  满{coupon.min_amount}可用
                </span>
              )}
            </div>

            {/* 右侧信息区域 */}
            <div className="flex-1 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className={`font-bold ${isExpired || isUsed ? "text-text-muted" : "text-text-primary"}`}>
                    {coupon.name}
                  </h3>
                  <p className="text-xs text-text-muted mt-1">
                    适用于{coupon.applicable_products.length === 0 || coupon.applicable_products.includes("all") ? "全部商品" : coupon.applicable_products.join("、")}
                  </p>
                </div>
                {(isExpired || isUsed) && (
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    isUsed ? "bg-green-500/10 text-green-400" : "bg-surface-hover text-text-muted"
                  }`}>
                    {isUsed ? "已使用" : "已过期"}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-text-muted">
                  有效期至 {formatDate(coupon.expires_at)}
                </span>
                {!isExpired && !isUsed && (
                  <button
                    onClick={() => {/* 跳转到订单页使用 */}}
                    className="px-3 py-1 text-xs font-medium text-orange-400 border border-orange-500/30 rounded-lg hover:bg-orange-500/10 transition-colors"
                  >
                    去使用
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </StaggerItem>
    );
  };

  // 渲染可领取的优惠券卡片
  const renderClaimableCoupon = (coupon: Coupon) => {
    return (
      <StaggerItem key={coupon.id}>
        <motion.div
          className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border border-blue-500/20"
          whileHover={{ scale: 1.02 }}
        >
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-8 bg-bg-surface rounded-r-full" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-8 bg-bg-surface rounded-l-full" />

          <div className="flex">
            <div className="flex-shrink-0 w-28 p-4 flex flex-col items-center justify-center border-r border-dashed border-blue-500/20">
              <span className="text-3xl font-bold text-blue-400">
                {formatDiscount(coupon)}
              </span>
              {coupon.min_amount > 0 && (
                <span className="text-xs text-text-muted mt-1">
                  满{coupon.min_amount}可用
                </span>
              )}
            </div>

            <div className="flex-1 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-text-primary">{coupon.name}</h3>
                  <p className="text-xs text-text-muted mt-1">
                    适用于{coupon.applicable_products.length === 0 || coupon.applicable_products.includes("all") ? "全部商品" : coupon.applicable_products.join("、")}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-text-muted">
                  有效期至 {formatDate(coupon.expires_at)}
                </span>
                <button
                  onClick={() => handleClaim(coupon.code)}
                  disabled={claiming}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg hover:from-blue-400 hover:to-cyan-400 transition-all disabled:opacity-50"
                >
                  {claiming ? "领取中..." : "立即领取"}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </StaggerItem>
    );
  };

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      {/* Header */}
      <FadeIn>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-text-primary mb-2">
              <span className="blue-gradient-text">我的优惠券</span>
            </h1>
            <p className="text-text-secondary">管理您的优惠券，享受更多优惠</p>
          </div>
        </div>
      </FadeIn>

      {/* Tabs */}
      <FadeIn delay={0.1}>
        <div className="flex gap-2 p-1 bg-surface-card border border-border-dark rounded-xl overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-lighter"
              }`}
            >
              <span className="material-symbols-outlined text-lg">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </FadeIn>

      {/* Message */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-xl flex items-center gap-3 ${
              message.type === "success"
                ? "bg-green-500/10 border border-green-500/20 text-green-400"
                : "bg-red-500/10 border border-red-500/20 text-red-400"
            }`}
          >
            <span className="material-symbols-outlined">
              {message.type === "success" ? "check_circle" : "error"}
            </span>
            {message.text}
            <button
              onClick={() => setMessage(null)}
              className="ml-auto text-text-muted hover:text-text-primary"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Claim Code Input (for claim tab) */}
      {activeTab === "claim" && (
        <FadeIn delay={0.15}>
          <div className="bg-surface-card border border-border-dark rounded-xl p-6">
            <h3 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-400">redeem</span>
              优惠券码兑换
            </h3>
            <div className="flex gap-3">
              <input
                type="text"
                value={claimCode}
                onChange={(e) => setClaimCode(e.target.value.toUpperCase())}
                placeholder="请输入优惠券码"
                className="flex-1 px-4 py-3 bg-surface-dark border border-border-dark rounded-lg text-text-primary placeholder-text-muted focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all"
              />
              <button
                onClick={() => handleClaim(claimCode)}
                disabled={!claimCode.trim() || claiming}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold rounded-lg hover:from-blue-400 hover:to-cyan-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {claiming ? "兑换中..." : "立即兑换"}
              </button>
            </div>
          </div>
        </FadeIn>
      )}

      {/* Content */}
      <FadeIn delay={0.2}>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-surface-card rounded-xl animate-pulse" />
            ))}
          </div>
        ) : activeTab === "claim" ? (
          availableCoupons.length > 0 ? (
            <StaggerContainer staggerDelay={0.05} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availableCoupons.map((coupon) => renderClaimableCoupon(coupon))}
            </StaggerContainer>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-text-muted">
              <span className="material-symbols-outlined text-6xl mb-4">card_giftcard</span>
              <p className="text-lg">暂无可领取的优惠券</p>
              <p className="text-sm mt-2">请关注活动，获取更多优惠</p>
            </div>
          )
        ) : myCoupons.length > 0 ? (
          <StaggerContainer staggerDelay={0.05} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myCoupons.map((coupon) => renderCouponCard(coupon))}
          </StaggerContainer>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-text-muted">
            <span className="material-symbols-outlined text-6xl mb-4">
              {activeTab === "available" ? "confirmation_number" : activeTab === "used" ? "check_circle" : "schedule"}
            </span>
            <p className="text-lg">
              {activeTab === "available" ? "暂无可用优惠券" : activeTab === "used" ? "暂无已使用优惠券" : "暂无已过期优惠券"}
            </p>
            {activeTab === "available" && (
              <button
                onClick={() => setActiveTab("claim")}
                className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                去领券中心
              </button>
            )}
          </div>
        )}
      </FadeIn>
    </div>
  );
}
