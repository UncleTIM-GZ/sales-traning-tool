"use client";

/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：每日签到按钮组件
 * 作用：提供每日签到功能，展示签到状态，签到成功显示通知
 * 创建时间：2025-12-24
 * 最后修改：2025-12-24
 */

import { useState, useEffect } from "react";
import { CalendarCheck, Loader2, Gift, Flame, X, Sparkles } from "lucide-react";
import { plazaExtApi } from "@/lib/api";

interface CheckinButtonProps {
  onCheckinSuccess?: (points: number, streakDays: number) => void;
}

interface CheckinResult {
  points: number;
  bonus?: number;
  bonus_message?: string;
  total_points_earned?: number;
  streak_days: number;
  total_points?: number;
}

export default function CheckinButton({ onCheckinSuccess }: CheckinButtonProps) {
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [checkedIn, setCheckedIn] = useState(false);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [showNotification, setShowNotification] = useState(false);

  // 检查今天是否已签到
  useEffect(() => {
    const checkTodayStatus = async () => {
      try {
        const status = await plazaExtApi.getCheckinStatus();
        if (status.checked_in_today) {
          setCheckedIn(true);
          setResult({
            points: status.today_points || 5,
            streak_days: status.streak_days || 1,
          });
        }
      } catch (error) {
        console.error("Failed to check status:", error);
      } finally {
        setInitialLoading(false);
      }
    };
    checkTodayStatus();
  }, []);

  // 自动关闭通知
  useEffect(() => {
    if (showNotification) {
      const timer = setTimeout(() => {
        setShowNotification(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [showNotification]);

  const handleCheckin = async () => {
    if (loading || checkedIn) return;

    setLoading(true);
    try {
      const response = await plazaExtApi.dailyCheckin();
      if (response.success) {
        const checkinResult: CheckinResult = {
          points: response.points,
          bonus: response.bonus,
          bonus_message: response.bonus_message,
          total_points_earned: response.total_points_earned,
          streak_days: response.streak_days,
          total_points: response.total_points,
        };
        setCheckedIn(true);
        setResult(checkinResult);
        setShowNotification(true);
        onCheckinSuccess?.(response.total_points_earned || response.points, response.streak_days);
      } else {
        setCheckedIn(true);
      }
    } catch (error) {
      console.error("Checkin failed:", error);
    } finally {
      setLoading(false);
    }
  };

  // 签到成功通知弹窗
  const renderNotification = () => {
    if (!showNotification || !result) return null;

    const totalEarned = result.total_points_earned || result.points;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-200">
        <div className="bg-surface-card border border-border-dark rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-300">
          {/* 关闭按钮 */}
          <button
            onClick={() => setShowNotification(false)}
            className="absolute top-4 right-4 text-text-muted hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* 成功图标 */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center animate-bounce">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
          </div>

          {/* 标题 */}
          <h3 className="text-xl font-bold text-center text-white mb-2">
            签到成功
          </h3>

          {/* 积分信息 */}
          <div className="bg-surface-darker rounded-xl p-4 mb-4">
            <div className="flex items-center justify-center gap-2 text-2xl font-bold text-amber-400">
              <Gift className="w-6 h-6" />
              <span>+{totalEarned}</span>
              <span className="text-base font-normal text-text-muted">积分</span>
            </div>
            
            {result.bonus && result.bonus > 0 && (
              <div className="mt-2 text-center text-sm text-emerald-400">
                {result.bonus_message || `包含连续签到奖励 +${result.bonus} 积分`}
              </div>
            )}
          </div>

          {/* 连续签到天数 */}
          <div className="flex items-center justify-center gap-2 text-text-secondary">
            <Flame className="w-5 h-5 text-orange-400" />
            <span>已连续签到 <span className="text-orange-400 font-bold">{result.streak_days}</span> 天</span>
          </div>

          {/* 当前总积分 */}
          {result.total_points !== undefined && (
            <div className="mt-3 text-center text-sm text-text-muted">
              当前总积分: <span className="text-white font-medium">{result.total_points}</span>
            </div>
          )}

          {/* 确认按钮 */}
          <button
            onClick={() => setShowNotification(false)}
            className="w-full mt-4 py-3 bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 text-white font-medium rounded-xl transition-all"
          >
            太棒了
          </button>
        </div>
      </div>
    );
  };

  // 初始加载中
  if (initialLoading) {
    return (
      <div className="w-full bg-surface-card border border-border-dark rounded-xl p-4">
        <div className="flex items-center justify-center gap-2 text-text-muted">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">加载中...</span>
        </div>
      </div>
    );
  }

  if (checkedIn && result && !showNotification) {
    return (
      <div className="bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-500/20 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <CalendarCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-emerald-400">今日已签到</p>
            <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
              <span className="flex items-center gap-1">
                <Gift className="w-3 h-3 text-amber-400" />
                +{result.total_points_earned || result.points} 积分
              </span>
              <span className="flex items-center gap-1">
                <Flame className="w-3 h-3 text-orange-400" />
                连续 {result.streak_days} 天
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {renderNotification()}
      <button
        onClick={handleCheckin}
        disabled={loading}
        className="w-full bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 text-white rounded-xl p-4 transition-all disabled:opacity-50"
      >
        <div className="flex items-center justify-center gap-2">
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <CalendarCheck className="w-5 h-5" />
          )}
          <span className="font-medium">每日签到</span>
        </div>
        <p className="text-xs text-white/70 mt-1">签到可获得积分奖励</p>
      </button>
    </>
  );
}
