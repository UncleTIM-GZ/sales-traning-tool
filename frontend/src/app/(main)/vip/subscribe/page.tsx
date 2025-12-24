"use client";

/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：VIP会员购买页面
 * 作用：显示套餐选择、支付方式选择
 * 创建时间：2025-12-24
 * 最后修改：2025-12-24
 */

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Crown,
  Star,
  Sparkles,
  Check,
  Loader2,
  CreditCard,
  Ticket,
  Coins,
  AlertCircle,
  Diamond,
  Gem,
  Award,
} from "lucide-react";
import {
  vipApi,
  paymentApi,
  pointsApi,
  MembershipLevel,
  PriceCalculateResult,
  PaymentMethod,
} from "@/lib/api";

// 动态获取等级图标
function getLevelIcon(levelName: string, index: number) {
  const icons = [Star, Crown, Sparkles, Diamond, Gem, Award];
  if (levelName === "free") return <Star className="w-5 h-5" />;
  if (levelName === "pro") return <Crown className="w-5 h-5" />;
  if (levelName === "enterprise") return <Sparkles className="w-5 h-5" />;
  const IconComponent = icons[index % icons.length];
  return <IconComponent className="w-5 h-5" />;
}

const DURATION_OPTIONS = [
  { months: 1, label: "1个月", discount: 0 },
  { months: 3, label: "3个月", discount: 10 },
  { months: 6, label: "6个月", discount: 15 },
  { months: 12, label: "12个月", discount: 20 },
];

function VIPSubscribeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialLevel = searchParams.get("level") || "pro";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [levels, setLevels] = useState<MembershipLevel[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [pointsBalance, setPointsBalance] = useState(0);

  const [selectedLevel, setSelectedLevel] = useState(initialLevel);
  const [selectedDuration, setSelectedDuration] = useState(1);
  const [selectedPayment, setSelectedPayment] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [usePoints, setUsePoints] = useState(0);
  const [priceResult, setPriceResult] = useState<PriceCalculateResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedLevel && selectedDuration) {
      calculatePrice();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLevel, selectedDuration, couponCode, usePoints]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [levelsRes, methodsRes, balanceRes] = await Promise.all([
        vipApi.getLevels(),
        paymentApi.getMethods(),
        pointsApi.getBalance(),
      ]);
      setLevels(levelsRes.levels.filter((l) => l.price_monthly > 0));
      setPaymentMethods(methodsRes.methods.filter((m) => m.enabled));
      setPointsBalance(balanceRes.balance);

      // 设置默认支付方式
      const firstMethod = methodsRes.methods.find((m) => m.enabled);
      if (firstMethod) {
        setSelectedPayment(firstMethod.method);
        const firstChannel = firstMethod.channels.find((c) => c.enabled);
        if (firstChannel) {
          setSelectedChannel(firstChannel.channel);
        }
      }
    } catch (err) {
      console.error("加载数据失败", err);
    } finally {
      setLoading(false);
    }
  };

  const calculatePrice = async () => {
    try {
      const result = await vipApi.calculatePrice({
        level_name: selectedLevel,
        duration_months: selectedDuration,
        coupon_code: couponCode || undefined,
        points_to_use: usePoints,
      });
      setPriceResult(result);
      setError("");
    } catch (err) {
      console.error("计算价格失败", err);
    }
  };

  const handleSubmit = async () => {
    if (!selectedPayment || !selectedChannel) {
      setError("请选择支付方式");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      // TODO: 创建订单并跳转支付
      // 1. 调用后端创建订单API
      // 2. 调用支付API获取支付参数
      // 3. 跳转到支付页面或显示支付二维码
      router.push("/vip/result?status=pending");
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建订单失败");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
      </div>
    );
  }

  const currentLevel = levels.find((l) => l.name === selectedLevel);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/vip"
          className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          返回会员中心
        </Link>
        <h1 className="text-2xl font-bold text-text-primary">开通会员</h1>
      </div>

      {/* 等级选择 */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-text-secondary mb-3">
          选择会员等级
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {levels.map((level, index) => (
            <button
              key={level.id}
              onClick={() => setSelectedLevel(level.name)}
              className={`p-4 rounded-xl border text-left transition-all ${
                selectedLevel === level.name
                  ? "border-violet-500 bg-violet-500/10"
                  : "border-border-default bg-bg-card hover:border-violet-500/50"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={
                    selectedLevel === level.name
                      ? "text-violet-400"
                      : "text-text-muted"
                  }
                >
                  {getLevelIcon(level.name, index)}
                </span>
                <span className="font-medium text-text-primary">
                  {level.display_name}
                </span>
              </div>
              <p className="text-sm text-text-muted line-clamp-1">
                {level.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* 时长选择 */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-text-secondary mb-3">
          选择订阅时长
        </h2>
        <div className="grid grid-cols-4 gap-3">
          {DURATION_OPTIONS.map((option) => (
            <button
              key={option.months}
              onClick={() => setSelectedDuration(option.months)}
              className={`p-3 rounded-xl border text-center transition-all ${
                selectedDuration === option.months
                  ? "border-violet-500 bg-violet-500/10"
                  : "border-border-default bg-bg-card hover:border-violet-500/50"
              }`}
            >
              <div className="font-medium text-text-primary">{option.label}</div>
              {option.discount > 0 && (
                <div className="text-xs text-emerald-400 mt-1">
                  省{option.discount}%
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 优惠券 */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-text-secondary mb-3 flex items-center gap-2">
          <Ticket className="w-4 h-4" />
          优惠券
        </h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            placeholder="输入优惠券码"
            className="flex-1 px-4 py-3 bg-bg-subtle border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500"
          />
        </div>
        {priceResult?.coupon_name && (
          <p className="text-sm text-emerald-400 mt-2 flex items-center gap-1">
            <Check className="w-4 h-4" />
            已使用: {priceResult.coupon_name}，优惠 ¥
            {(priceResult.coupon_discount / 100).toFixed(2)}
          </p>
        )}
      </div>

      {/* 积分抵扣 */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-text-secondary mb-3 flex items-center gap-2">
          <Coins className="w-4 h-4" />
          积分抵扣
          <span className="text-text-muted">
            (可用 {pointsBalance} 积分)
          </span>
        </h2>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min="0"
            max={pointsBalance}
            value={usePoints}
            onChange={(e) =>
              setUsePoints(Math.min(Number(e.target.value), pointsBalance))
            }
            className="w-32 px-4 py-3 bg-bg-subtle border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
          />
          <button
            onClick={() => setUsePoints(pointsBalance)}
            className="px-4 py-3 text-sm text-violet-400 hover:text-violet-300"
          >
            全部使用
          </button>
        </div>
        {priceResult && priceResult.points_discount > 0 && (
          <p className="text-sm text-emerald-400 mt-2">
            积分抵扣 ¥{(priceResult.points_discount / 100).toFixed(2)}
          </p>
        )}
      </div>

      {/* 支付方式 */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-text-secondary mb-3 flex items-center gap-2">
          <CreditCard className="w-4 h-4" />
          支付方式
        </h2>
        <div className="space-y-3">
          {paymentMethods.map((method) => (
            <div key={method.method}>
              <div className="grid grid-cols-2 gap-3">
                {method.channels
                  .filter((c) => c.enabled)
                  .map((channel) => (
                    <button
                      key={channel.channel}
                      onClick={() => {
                        setSelectedPayment(method.method);
                        setSelectedChannel(channel.channel);
                      }}
                      className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${
                        selectedPayment === method.method &&
                        selectedChannel === channel.channel
                          ? "border-violet-500 bg-violet-500/10"
                          : "border-border-default bg-bg-card hover:border-violet-500/50"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          selectedPayment === method.method &&
                          selectedChannel === channel.channel
                            ? "border-violet-500"
                            : "border-text-muted"
                        }`}
                      >
                        {selectedPayment === method.method &&
                          selectedChannel === channel.channel && (
                            <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />
                          )}
                      </div>
                      <span className="text-text-primary">{channel.name}</span>
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 价格汇总 */}
      {priceResult && (
        <div className="bg-bg-card border border-border-default rounded-2xl p-6 mb-6">
          <div className="space-y-3">
            <div className="flex justify-between text-text-secondary">
              <span>
                {currentLevel?.display_name} x {selectedDuration}个月
              </span>
              <span>¥{(priceResult.original_price / 100).toFixed(2)}</span>
            </div>
            {priceResult.coupon_discount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>优惠券</span>
                <span>-¥{(priceResult.coupon_discount / 100).toFixed(2)}</span>
              </div>
            )}
            {priceResult.points_discount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>积分抵扣</span>
                <span>-¥{(priceResult.points_discount / 100).toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-border-default pt-3 flex justify-between">
              <span className="text-text-primary font-medium">应付金额</span>
              <span className="text-2xl font-bold text-violet-400">
                ¥{(priceResult.final_price / 100).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-4 bg-red-500/15 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-400">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* 提交按钮 */}
      <button
        onClick={handleSubmit}
        disabled={submitting || !selectedPayment}
        className="w-full py-4 bg-violet-500 hover:bg-violet-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            处理中...
          </>
        ) : (
          <>
            立即支付 ¥
            {priceResult
              ? (priceResult.final_price / 100).toFixed(2)
              : "0.00"}
          </>
        )}
      </button>

      {/* 协议 */}
      <p className="text-center text-text-muted text-sm mt-4">
        点击支付即表示同意
        <Link href="/terms" className="text-violet-400 hover:underline">
          《服务协议》
        </Link>
        和
        <Link href="/privacy" className="text-violet-400 hover:underline">
          《隐私政策》
        </Link>
      </p>
    </div>
  );
}

export default function VIPSubscribePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
        </div>
      }
    >
      <VIPSubscribeContent />
    </Suspense>
  );
}
