"use client";

/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：积分消耗配置管理页面
 * 作用：管理对话训练的积分消耗规则
 * 创建时间：2025-12-24
 * 最后修改：2025-12-24
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  Coins, 
  Save, 
  CheckCircle,
  Loader2,
  AlertCircle,
  Calculator,
  Crown,
  MessageSquare,
  Mic
} from "lucide-react";
import { getAdminToken } from "@/lib/api/admin";

interface PointsConsumptionConfig {
  points_per_text_session: number;
  points_per_voice_session: number;
  free_sessions_by_level: Record<string, number>;
  vip_discount_rates: Record<string, number>;
  scenario_multipliers: Record<string, number>;
}

interface PreviewResult {
  session_type: string;
  scenario_type: string;
  membership_level: string;
  points_cost: number;
  daily_free_sessions: number;
  is_unlimited: boolean;
}

const MEMBERSHIP_LEVELS = [
  { key: "free", label: "免费版", color: "text-text-secondary" },
  { key: "pro", label: "专业版", color: "text-violet-400" },
  { key: "enterprise", label: "企业版", color: "text-amber-400" },
];

const SCENARIO_TYPES = [
  { key: "basic", label: "基础场景" },
  { key: "advanced", label: "高级场景" },
  { key: "custom", label: "自定义场景" },
];

export default function PointsSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [config, setConfig] = useState<PointsConsumptionConfig | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewParams, setPreviewParams] = useState({
    session_type: "text",
    scenario_type: "basic",
    membership_level: "free",
  });

  useEffect(() => {
    fetchConfig();
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
      const res = await fetch("/api/v1/admin/settings/points-consumption", { headers });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
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
      const res = await fetch("/api/v1/admin/settings/points-consumption", {
        method: "PUT",
        headers,
        body: JSON.stringify(config),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "配置保存成功" });
        fetchConfig();
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

  const fetchPreview = async () => {
    try {
      const headers = getHeaders();
      const params = new URLSearchParams(previewParams);
      const res = await fetch(`/api/v1/admin/settings/points-consumption/preview?${params}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setPreview(data);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!loading) {
      fetchPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewParams, loading]);

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
          <Coins className="w-6 h-6 text-amber-400" />
          积分消耗配置
        </h1>
        <p className="text-text-secondary mt-1">
          配置对话训练的积分消耗规则、免费次数和VIP折扣
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
          {/* 基础消耗配置 */}
          <div className="bg-bg-card border border-border-default rounded-2xl p-6">
            <h3 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-violet-400" />
              基础积分消耗
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  文字对话 (每次)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    value={config.points_per_text_session}
                    onChange={(e) => setConfig({
                      ...config,
                      points_per_text_session: parseInt(e.target.value) || 0
                    })}
                    className="w-full px-4 py-3 bg-bg-subtle border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted">积分</span>
                </div>
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-2 flex items-center gap-1">
                  <Mic className="w-4 h-4" />
                  语音对话 (每次)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    value={config.points_per_voice_session}
                    onChange={(e) => setConfig({
                      ...config,
                      points_per_voice_session: parseInt(e.target.value) || 0
                    })}
                    className="w-full px-4 py-3 bg-bg-subtle border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted">积分</span>
                </div>
              </div>
            </div>
          </div>

          {/* 每日免费次数 */}
          <div className="bg-bg-card border border-border-default rounded-2xl p-6">
            <h3 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-400" />
              每日免费次数 (按会员等级)
            </h3>
            <p className="text-sm text-text-muted mb-4">
              设置为 -1 表示无限次数
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {MEMBERSHIP_LEVELS.map((level) => (
                <div key={level.key}>
                  <label className={`block text-sm mb-2 ${level.color}`}>
                    {level.label}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="-1"
                      value={config.free_sessions_by_level[level.key] ?? 0}
                      onChange={(e) => setConfig({
                        ...config,
                        free_sessions_by_level: {
                          ...config.free_sessions_by_level,
                          [level.key]: parseInt(e.target.value) || 0
                        }
                      })}
                      className="w-full px-4 py-3 bg-bg-subtle border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted text-sm">
                      {config.free_sessions_by_level[level.key] === -1 ? "无限" : "次/天"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* VIP折扣率 */}
          <div className="bg-bg-card border border-border-default rounded-2xl p-6">
            <h3 className="text-lg font-medium text-text-primary mb-4">
              VIP积分消耗折扣
            </h3>
            <p className="text-sm text-text-muted mb-4">
              设置各等级的积分消耗折扣百分比（20 = 8折，50 = 5折）
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {MEMBERSHIP_LEVELS.map((level) => (
                <div key={level.key}>
                  <label className={`block text-sm mb-2 ${level.color}`}>
                    {level.label}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={config.vip_discount_rates[level.key] ?? 0}
                      onChange={(e) => setConfig({
                        ...config,
                        vip_discount_rates: {
                          ...config.vip_discount_rates,
                          [level.key]: parseInt(e.target.value) || 0
                        }
                      })}
                      className="w-full px-4 py-3 bg-bg-subtle border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted">%</span>
                  </div>
                  <p className="text-xs text-text-muted mt-1">
                    {config.vip_discount_rates[level.key] > 0 
                      ? `${100 - config.vip_discount_rates[level.key]}% 价格`
                      : "无折扣"}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* 场景类型倍率 */}
          <div className="bg-bg-card border border-border-default rounded-2xl p-6">
            <h3 className="text-lg font-medium text-text-primary mb-4">
              场景类型积分倍率
            </h3>
            <p className="text-sm text-text-muted mb-4">
              不同类型场景的积分消耗倍率（1.0 = 原价，1.5 = 1.5倍）
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {SCENARIO_TYPES.map((type) => (
                <div key={type.key}>
                  <label className="block text-sm text-text-secondary mb-2">
                    {type.label}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={config.scenario_multipliers[type.key] ?? 1}
                      onChange={(e) => setConfig({
                        ...config,
                        scenario_multipliers: {
                          ...config.scenario_multipliers,
                          [type.key]: parseFloat(e.target.value) || 1
                        }
                      })}
                      className="w-full px-4 py-3 bg-bg-subtle border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted">x</span>
                  </div>
                </div>
              ))}
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
              <Calculator className="w-5 h-5 text-emerald-400" />
              积分消耗预览
            </h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm text-text-secondary mb-2">会话类型</label>
                <select
                  value={previewParams.session_type}
                  onChange={(e) => setPreviewParams({ ...previewParams, session_type: e.target.value })}
                  className="w-full px-4 py-3 bg-bg-subtle border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                >
                  <option value="text">文字对话</option>
                  <option value="voice">语音对话</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-text-secondary mb-2">场景类型</label>
                <select
                  value={previewParams.scenario_type}
                  onChange={(e) => setPreviewParams({ ...previewParams, scenario_type: e.target.value })}
                  className="w-full px-4 py-3 bg-bg-subtle border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                >
                  {SCENARIO_TYPES.map((type) => (
                    <option key={type.key} value={type.key}>{type.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-text-secondary mb-2">会员等级</label>
                <select
                  value={previewParams.membership_level}
                  onChange={(e) => setPreviewParams({ ...previewParams, membership_level: e.target.value })}
                  className="w-full px-4 py-3 bg-bg-subtle border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                >
                  {MEMBERSHIP_LEVELS.map((level) => (
                    <option key={level.key} value={level.key}>{level.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {preview && (
              <div className="p-4 bg-bg-subtle rounded-xl border border-border-default">
                <div className="text-center mb-4">
                  <div className="text-3xl font-bold text-amber-400">
                    {preview.points_cost}
                  </div>
                  <div className="text-sm text-text-muted">积分/次</div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-muted">每日免费次数</span>
                    <span className="text-text-primary">
                      {preview.is_unlimited ? "无限" : `${preview.daily_free_sessions} 次`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">会话类型</span>
                    <span className="text-text-primary">
                      {preview.session_type === "text" ? "文字" : "语音"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">场景类型</span>
                    <span className="text-text-primary">
                      {SCENARIO_TYPES.find(t => t.key === preview.scenario_type)?.label}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 p-3 bg-violet-500/10 rounded-xl border border-violet-500/20">
              <p className="text-xs text-violet-300">
                计算公式：基础消耗 x 场景倍率 x (1 - VIP折扣率)
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
