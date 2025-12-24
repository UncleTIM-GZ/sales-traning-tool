"use client";

/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：VIP会员中心页面
 * 作用：显示会员等级、当前订阅、权益列表
 * 创建时间：2025-12-24
 * 最后修改：2025-12-24
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Crown,
  Star,
  Zap,
  Shield,
  Clock,
  ChevronRight,
  Loader2,
  Check,
  Gift,
  Sparkles,
  Diamond,
  Gem,
  Award,
} from "lucide-react";
import { vipApi, MembershipLevel, UserVIPStatus, Subscription } from "@/lib/api";

// 动态获取等级图标
function getLevelIcon(levelName: string, index: number) {
  const icons = [Star, Crown, Sparkles, Diamond, Gem, Award];
  // 根据名称或索引选择图标
  if (levelName === "free") return <Star className="w-6 h-6" />;
  if (levelName === "pro") return <Crown className="w-6 h-6" />;
  if (levelName === "enterprise") return <Sparkles className="w-6 h-6" />;
  const IconComponent = icons[index % icons.length];
  return <IconComponent className="w-6 h-6" />;
}

// 动态获取等级颜色
function getLevelColor(levelName: string, index: number): string {
  const colors = [
    "from-zinc-500 to-zinc-600",
    "from-violet-500 to-purple-600",
    "from-amber-500 to-orange-600",
    "from-emerald-500 to-green-600",
    "from-blue-500 to-indigo-600",
    "from-rose-500 to-pink-600",
  ];
  if (levelName === "free") return colors[0];
  if (levelName === "pro") return colors[1];
  if (levelName === "enterprise") return colors[2];
  return colors[(index + 1) % colors.length];
}

// 动态获取边框颜色
function getLevelBorderColor(levelName: string, index: number): string {
  const colors = [
    "border-zinc-500/30",
    "border-violet-500/30",
    "border-amber-500/30",
    "border-emerald-500/30",
    "border-blue-500/30",
    "border-rose-500/30",
  ];
  if (levelName === "free") return colors[0];
  if (levelName === "pro") return colors[1];
  if (levelName === "enterprise") return colors[2];
  return colors[(index + 1) % colors.length];
}

export default function VIPPage() {
  const [loading, setLoading] = useState(true);
  const [levels, setLevels] = useState<MembershipLevel[]>([]);
  const [vipStatus, setVipStatus] = useState<UserVIPStatus | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [levelsRes, statusRes, subRes] = await Promise.all([
        vipApi.getLevels(),
        vipApi.getStatus(),
        vipApi.getSubscription(),
      ]);
      setLevels(levelsRes.levels);
      setVipStatus(statusRes);
      setSubscription(subRes);
    } catch (error) {
      console.error("加载VIP信息失败", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
      </div>
    );
  }

  const currentLevel = levels.find(
    (l) => l.name === vipStatus?.level_name
  );
  const currentLevelIndex = levels.findIndex(
    (l) => l.name === vipStatus?.level_name
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* 当前会员状态 */}
      <div
        className={`relative overflow-hidden rounded-3xl p-8 mb-8 bg-gradient-to-br ${
          getLevelColor(vipStatus?.level_name || "free", currentLevelIndex)
        }`}
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-white">
              {getLevelIcon(vipStatus?.level_name || "free", currentLevelIndex)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                {vipStatus?.level_display_name || "免费版"}
              </h1>
              {vipStatus?.is_vip && vipStatus.expires_at && (
                <p className="text-white/80 text-sm flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {vipStatus.days_remaining}天后到期
                </p>
              )}
            </div>
          </div>

          {!vipStatus?.is_vip && (
            <p className="text-white/80 mb-6">
              升级会员，解锁更多训练次数和专属权益
            </p>
          )}

          <div className="flex gap-3">
            <Link
              href="/vip/subscribe"
              className="px-6 py-3 bg-white text-zinc-900 rounded-xl font-medium hover:bg-white/90 transition-colors"
            >
              {vipStatus?.is_vip ? "续费/升级" : "立即开通"}
            </Link>
            {subscription && (
              <Link
                href="/orders"
                className="px-6 py-3 bg-white/20 text-white rounded-xl font-medium hover:bg-white/30 transition-colors"
              >
                订单记录
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* 当前权益 */}
      {currentLevel && (
        <div className="mb-8">
          <h2 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
            <Gift className="w-5 h-5 text-violet-400" />
            当前权益
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(currentLevel.privileges || {}).map(
              ([key, value]) => (
                <div
                  key={key}
                  className="bg-bg-card border border-border-default rounded-xl p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-text-secondary text-sm">
                      {getPrivilegeName(key)}
                    </span>
                  </div>
                  <p className="text-text-primary font-medium">
                    {formatPrivilegeValue(key, value)}
                  </p>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* 会员等级对比 */}
      <div>
        <h2 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" />
          会员等级
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          {levels.map((level, index) => (
            <div
              key={level.id}
              className={`bg-bg-card border rounded-2xl p-6 ${
                level.name === vipStatus?.level_name
                  ? getLevelBorderColor(level.name, index) + " border-2"
                  : "border-border-default"
              }`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getLevelColor(level.name, index)} flex items-center justify-center text-white`}
                >
                  {getLevelIcon(level.name, index)}
                </div>
                <div>
                  <h3 className="font-medium text-text-primary">
                    {level.display_name}
                  </h3>
                  {level.name === vipStatus?.level_name && (
                    <span className="text-xs text-violet-400">当前等级</span>
                  )}
                </div>
              </div>

              <p className="text-text-muted text-sm mb-4 line-clamp-2">
                {level.description}
              </p>

              <div className="mb-4">
                <div className="text-2xl font-bold text-text-primary">
                  {level.price_monthly === 0 ? (
                    "免费"
                  ) : (
                    <>
                      <span className="text-sm font-normal text-text-muted">
                        ¥
                      </span>
                      {(level.price_monthly / 100).toFixed(0)}
                      <span className="text-sm font-normal text-text-muted">
                        /月
                      </span>
                    </>
                  )}
                </div>
              </div>

              {level.name !== vipStatus?.level_name && level.price_monthly > 0 && (
                <Link
                  href={`/vip/subscribe?level=${level.name}`}
                  className="block w-full text-center py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-xl transition-colors"
                >
                  {level.name === "enterprise" ? "联系我们" : "立即开通"}
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 订阅历史入口 */}
      <div className="mt-8">
        <Link
          href="/vip/history"
          className="flex items-center justify-between p-4 bg-bg-card border border-border-default rounded-xl hover:border-violet-500/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-text-muted" />
            <span className="text-text-primary">订阅历史</span>
          </div>
          <ChevronRight className="w-5 h-5 text-text-muted" />
        </Link>
      </div>
    </div>
  );
}

function getPrivilegeName(key: string): string {
  const names: Record<string, string> = {
    daily_free_sessions: "每日免费训练",
    points_discount: "积分折扣",
    priority_support: "优先客服",
    advanced_scenarios: "高级场景",
    custom_scenarios: "自定义场景",
    voice_training: "语音训练",
    report_export: "报告导出",
    team_management: "团队管理",
  };
  return names[key] || key;
}

function formatPrivilegeValue(key: string, value: unknown): string {
  if (typeof value === "boolean") {
    return value ? "已开通" : "未开通";
  }
  if (typeof value === "number") {
    if (key === "daily_free_sessions") {
      return value === -1 ? "无限次" : `${value}次/天`;
    }
    if (key === "points_discount") {
      return value === 0 ? "无折扣" : `${100 - value}折`;
    }
    return String(value);
  }
  return String(value);
}
