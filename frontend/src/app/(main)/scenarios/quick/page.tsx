"use client";

/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：快速创建场景页面
 * 作用：一步完成场景创建，AI自动补充配置
 * 创建时间：2025-12-23
 * 最后修改：2025-12-23
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Zap,
  ArrowLeft,
  Sparkles,
  Target,
  MessageSquare,
  Phone,
  Users,
  Loader2,
  Check,
  ChevronRight,
  Lightbulb,
} from "lucide-react";
import { plazaApi } from "@/lib/api";

const scenarioTemplates = [
  {
    id: "cold-call",
    name: "电话陌拜",
    description: "首次电话联系潜在客户",
    track: "sales" as const,
    difficulty: 3,
    icon: Phone,
  },
  {
    id: "objection",
    name: "异议处理",
    description: "应对客户价格、竞品等异议",
    track: "sales" as const,
    difficulty: 4,
    icon: MessageSquare,
  },
  {
    id: "social-intro",
    name: "社交自我介绍",
    description: "在社交场合介绍自己",
    track: "social" as const,
    difficulty: 2,
    icon: Users,
  },
  {
    id: "small-talk",
    name: "日常闲聊",
    description: "与同事朋友轻松交谈",
    track: "social" as const,
    difficulty: 2,
    icon: MessageSquare,
  },
];

export default function QuickCreatePage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    track: "sales" as "sales" | "social",
    difficulty: 3,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleTemplateClick = (template: (typeof scenarioTemplates)[0]) => {
    setFormData({
      name: template.name,
      description: template.description,
      track: template.track,
      difficulty: template.difficulty,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError("请输入场景名称");
      return;
    }
    if (!formData.description.trim()) {
      setError("请输入场景描述");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await plazaApi.quickCreate({
        name: formData.name.trim(),
        description: formData.description.trim(),
        track: formData.track,
        difficulty: formData.difficulty,
      });

      if (result.success) {
        router.push(`/scenarios/${result.scenario_id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* 返回按钮 */}
      <Link
        href="/scenarios"
        className="inline-flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>返回场景库</span>
      </Link>

      {/* 页面标题 */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 mb-4">
          <Zap className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl lg:text-3xl font-bold text-text-primary">
          快速创建场景
        </h1>
        <p className="text-text-muted mt-2">
          只需填写基本信息，AI会自动生成完整的场景配置
        </p>
      </div>

      {/* 快速模板 */}
      <div className="bg-surface-card border border-border-dark rounded-xl p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-yellow-400" />
          快速选择模板
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {scenarioTemplates.map((template) => {
            const Icon = template.icon;
            const isSelected = formData.name === template.name;
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => handleTemplateClick(template)}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  isSelected
                    ? "bg-primary/20 border-primary shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                    : "bg-surface-lighter border-border-dark hover:border-primary/50 hover:bg-surface-card"
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
                  isSelected ? "bg-primary/30" : "bg-surface-card"
                }`}>
                  <Icon className={`w-5 h-5 ${isSelected ? "text-primary" : "text-text-muted"}`} />
                </div>
                <p className={`font-medium ${isSelected ? "text-primary" : "text-text-primary"}`}>
                  {template.name}
                </p>
                <p className="text-xs text-text-muted mt-1 line-clamp-1">
                  {template.description}
                </p>
                {isSelected && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-primary">
                    <Check className="w-3 h-3" />
                    <span>已选择</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 创建表单 */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-surface-card border border-border-dark rounded-xl p-6 space-y-5">
          {/* 场景名称 */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              场景名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="例如：电话销售产品介绍"
              className="w-full px-4 py-3 bg-surface-lighter border border-border-dark rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
              maxLength={50}
            />
          </div>

          {/* 场景描述 */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              场景描述 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="描述这个场景的情境和目标，AI会据此生成对话配置..."
              className="w-full px-4 py-3 bg-surface-lighter border border-border-dark rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors resize-none"
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-text-muted mt-1 text-right">
              {formData.description.length}/500
            </p>
          </div>

          {/* 赛道选择 */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              场景赛道
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, track: "sales" })}
                className={`p-4 rounded-xl border transition-all flex items-center gap-3 ${
                  formData.track === "sales"
                    ? "bg-blue-500/10 border-blue-500"
                    : "bg-surface-lighter border-border-dark hover:border-blue-500/50"
                }`}
              >
                <Target className={`w-5 h-5 ${formData.track === "sales" ? "text-blue-500" : "text-text-muted"}`} />
                <div className="text-left">
                  <p className={`font-medium ${formData.track === "sales" ? "text-blue-500" : "text-text-primary"}`}>
                    销售培养
                  </p>
                  <p className="text-xs text-text-muted">提升销售沟通能力</p>
                </div>
                {formData.track === "sales" && (
                  <Check className="w-5 h-5 text-blue-500 ml-auto" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, track: "social" })}
                className={`p-4 rounded-xl border transition-all flex items-center gap-3 ${
                  formData.track === "social"
                    ? "bg-emerald-500/10 border-emerald-500"
                    : "bg-surface-lighter border-border-dark hover:border-emerald-500/50"
                }`}
              >
                <Users className={`w-5 h-5 ${formData.track === "social" ? "text-emerald-500" : "text-text-muted"}`} />
                <div className="text-left">
                  <p className={`font-medium ${formData.track === "social" ? "text-emerald-500" : "text-text-primary"}`}>
                    社交训练
                  </p>
                  <p className="text-xs text-text-muted">克服社交焦虑</p>
                </div>
                {formData.track === "social" && (
                  <Check className="w-5 h-5 text-emerald-500 ml-auto" />
                )}
              </button>
            </div>
          </div>

          {/* 难度选择 */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              场景难度
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setFormData({ ...formData, difficulty: level })}
                  className={`flex-1 py-3 rounded-lg text-sm font-medium transition-all ${
                    formData.difficulty === level
                      ? "bg-primary text-white"
                      : "bg-surface-lighter text-text-secondary hover:text-primary border border-border-dark"
                  }`}
                >
                  {level === 1 && "入门"}
                  {level === 2 && "初级"}
                  {level === 3 && "中级"}
                  {level === 4 && "高级"}
                  {level === 5 && "专家"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* 提交按钮 */}
        <div className="flex gap-4">
          <Link
            href="/scenarios"
            className="flex-1 py-3 px-6 bg-surface-card border border-border-dark rounded-xl text-text-secondary font-medium text-center hover:bg-surface-lighter transition-colors"
          >
            取消
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-3 px-6 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                创建中...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                一键创建场景
              </>
            )}
          </button>
        </div>

        {/* 提示信息 */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-text-primary font-medium">AI智能配置</p>
              <p className="text-xs text-text-muted mt-1">
                系统会根据您的描述自动生成对话角色、背景设定、评分标准等完整配置，创建后您可以进一步编辑调整。
              </p>
            </div>
          </div>
        </div>
      </form>

      {/* 高级创建入口 */}
      <div className="text-center">
        <Link
          href="/scenarios/create"
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-primary transition-colors"
        >
          需要更多自定义选项？使用高级创建
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
