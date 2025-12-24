"use client";

/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：签到配置管理页面
 * 作用：管理每日签到的积分奖励规则和连续签到奖励
 * 创建时间：2025-12-24
 * 最后修改：2025-12-24
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  CalendarCheck, 
  Save, 
  CheckCircle,
  Loader2,
  AlertCircle,
  Flame,
  Gift,
  Plus,
  Trash2
} from "lucide-react";
import { getAdminToken } from "@/lib/api/admin";

interface CheckinConfig {
  base_points: number;
  streak_bonus: Record<string, number>;
  max_streak_bonus: number;
  enabled: boolean;
}

export default function CheckinSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [config, setConfig] = useState<CheckinConfig | null>(null);
  const [newStreakDay, setNewStreakDay] = useState("");
  const [newStreakBonus, setNewStreakBonus] = useState("");

  useEffect(() => {
    const loadConfig = async () => {
      setLoading(true);
      try {
        const headers = getHeaders();
        const res = await fetch("/api/v1/admin/settings/checkin", { headers });
        if (res.ok) {
          const data = await res.json();
          setConfig(data);
        } else {
          // 使用默认配置
          setConfig({
            base_points: 5,
            streak_bonus: { "3": 5, "7": 10, "14": 20, "30": 50, "60": 100, "90": 200 },
            max_streak_bonus: 200,
            enabled: true,
          });
        }
      } catch {
        setMessage({ type: "error", text: "加载配置失败" });
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getHeaders = () => {
    const token = getAdminToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  };

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const headers = getHeaders();
      const res = await fetch("/api/v1/admin/settings/checkin", { headers });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      } else {
        // 使用默认配置
        setConfig({
          base_points: 5,
          streak_bonus: { "3": 5, "7": 10, "14": 20, "30": 50, "60": 100, "90": 200 },
          max_streak_bonus: 200,
          enabled: true,
        });
      }
    } catch {
      setMessage({ type: "error", text: "加载配置失败" });
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!config) return;
    setSaving(true);
    setMessage(null);
    try {
      const headers = getHeaders();
      const res = await fetch("/api/v1/admin/settings/checkin", {
        method: "PUT",
        headers,
        body: JSON.stringify(config),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "签到配置保存成功" });
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.detail || "保存失败" });
      }
    } catch {
      setMessage({ type: "error", text: "保存失败，请重试" });
    } finally {
      setSaving(false);
    }
  };

  const addStreakBonus = () => {
    if (!config || !newStreakDay || !newStreakBonus) return;
    const day = parseInt(newStreakDay);
    const bonus = parseInt(newStreakBonus);
    if (isNaN(day) || isNaN(bonus) || day <= 0 || bonus <= 0) return;

    setConfig({
      ...config,
      streak_bonus: {
        ...config.streak_bonus,
        [day.toString()]: bonus,
      },
    });
    setNewStreakDay("");
    setNewStreakBonus("");
  };

  const removeStreakBonus = (day: string) => {
    if (!config) return;
    const newBonus = { ...config.streak_bonus };
    delete newBonus[day];
    setConfig({ ...config, streak_bonus: newBonus });
  };

  // 按天数排序的连续签到奖励列表
  const sortedStreakBonuses = config
    ? Object.entries(config.streak_bonus).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-text-secondary">加载配置失败</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/settings"
          className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          返回设置
        </Link>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <CalendarCheck className="w-6 h-6 text-emerald-400" />
          签到配置
        </h1>
        <p className="text-text-secondary mt-1">
          配置每日签到的积分奖励规则和连续签到奖励
        </p>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`mb-4 p-4 rounded-xl flex items-center gap-2 ${
            message.type === "success"
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
              : "bg-red-500/15 text-red-400 border border-red-500/30"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 主配置区域 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 启用状态 */}
          <div className="bg-bg-card border border-border-default rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-text-primary">签到功能</h3>
                <p className="text-sm text-text-muted mt-1">
                  启用或禁用每日签到功能
                </p>
              </div>
              <button
                onClick={() => setConfig({ ...config, enabled: !config.enabled })}
                className={`relative w-14 h-7 rounded-full transition-colors ${
                  config.enabled ? "bg-emerald-500" : "bg-zinc-600"
                }`}
              >
                <span
                  className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                    config.enabled ? "left-8" : "left-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 基础积分配置 */}
          <div className="bg-bg-card border border-border-default rounded-2xl p-6">
            <h3 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
              <Gift className="w-5 h-5 text-amber-400" />
              基础签到奖励
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  每日签到基础积分
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    value={config.base_points}
                    onChange={(e) => setConfig({
                      ...config,
                      base_points: parseInt(e.target.value) || 0
                    })}
                    className="w-full px-4 py-3 bg-bg-subtle border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted">积分</span>
                </div>
                <p className="text-xs text-text-muted mt-1">
                  用户每日签到可获得的基础积分
                </p>
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  最大连续签到奖励
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    value={config.max_streak_bonus}
                    onChange={(e) => setConfig({
                      ...config,
                      max_streak_bonus: parseInt(e.target.value) || 0
                    })}
                    className="w-full px-4 py-3 bg-bg-subtle border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted">积分</span>
                </div>
                <p className="text-xs text-text-muted mt-1">
                  连续签到奖励的上限值
                </p>
              </div>
            </div>
          </div>

          {/* 连续签到奖励配置 */}
          <div className="bg-bg-card border border-border-default rounded-2xl p-6">
            <h3 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-400" />
              连续签到奖励
            </h3>
            <p className="text-sm text-text-muted mb-4">
              设置连续签到达到指定天数时的额外奖励积分
            </p>

            {/* 现有奖励列表 */}
            <div className="space-y-3 mb-4">
              {sortedStreakBonuses.map(([day, bonus]) => (
                <div
                  key={day}
                  className="flex items-center justify-between p-3 bg-bg-subtle rounded-xl border border-border-default"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-500/15 flex items-center justify-center">
                      <Flame className="w-5 h-5 text-orange-400" />
                    </div>
                    <div>
                      <p className="text-text-primary font-medium">
                        连续签到 {day} 天
                      </p>
                      <p className="text-sm text-text-muted">
                        额外奖励 <span className="text-amber-400">{bonus}</span> 积分
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeStreakBonus(day)}
                    className="p-2 text-text-muted hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* 添加新奖励 */}
            <div className="flex items-end gap-3 p-4 bg-bg-subtle rounded-xl border border-dashed border-border-default">
              <div className="flex-1">
                <label className="block text-sm text-text-secondary mb-2">
                  连续天数
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="例如: 7"
                  value={newStreakDay}
                  onChange={(e) => setNewStreakDay(e.target.value)}
                  className="w-full px-4 py-2 bg-bg-card border border-border-default rounded-lg text-text-primary focus:outline-none focus:border-violet-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm text-text-secondary mb-2">
                  奖励积分
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="例如: 10"
                  value={newStreakBonus}
                  onChange={(e) => setNewStreakBonus(e.target.value)}
                  className="w-full px-4 py-2 bg-bg-card border border-border-default rounded-lg text-text-primary focus:outline-none focus:border-violet-500"
                />
              </div>
              <button
                onClick={addStreakBonus}
                disabled={!newStreakDay || !newStreakBonus}
                className="flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                添加
              </button>
            </div>
          </div>

          {/* 保存按钮 */}
          <div className="flex justify-end">
            <button
              onClick={saveConfig}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-violet-500 hover:bg-violet-600 text-white rounded-xl transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              保存配置
            </button>
          </div>
        </div>

        {/* 预览区域 */}
        <div className="lg:col-span-1">
          <div className="bg-bg-card border border-border-default rounded-2xl p-6 sticky top-6">
            <h3 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-emerald-400" />
              签到奖励预览
            </h3>
            
            <div className="space-y-4">
              {/* 基础奖励 */}
              <div className="p-4 bg-bg-subtle rounded-xl border border-border-default">
                <div className="text-center mb-2">
                  <div className="text-3xl font-bold text-amber-400">
                    +{config.base_points}
                  </div>
                  <div className="text-sm text-text-muted">基础签到积分</div>
                </div>
              </div>

              {/* 连续签到奖励预览 */}
              <div className="space-y-2">
                <p className="text-sm text-text-secondary">连续签到奖励:</p>
                {sortedStreakBonuses.slice(0, 5).map(([day, bonus]) => (
                  <div
                    key={day}
                    className="flex items-center justify-between p-2 bg-bg-subtle rounded-lg"
                  >
                    <span className="text-sm text-text-muted flex items-center gap-1">
                      <Flame className="w-3 h-3 text-orange-400" />
                      {day}天
                    </span>
                    <span className="text-sm text-amber-400 font-medium">
                      +{bonus}
                    </span>
                  </div>
                ))}
                {sortedStreakBonuses.length > 5 && (
                  <p className="text-xs text-text-muted text-center">
                    还有 {sortedStreakBonuses.length - 5} 个奖励...
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
              <p className="text-xs text-emerald-300">
                用户签到时获得: 基础积分 + 连续签到奖励(如有)
              </p>
            </div>

            {!config.enabled && (
              <div className="mt-4 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                <p className="text-xs text-amber-300 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  签到功能当前已禁用
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
