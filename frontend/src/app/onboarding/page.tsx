"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";

type Track = "sales" | "social";
type Goal = string;
type ExperienceLevel = "beginner" | "intermediate" | "advanced";
type TimeCommitment = 15 | 30 | 60;

interface OnboardingData {
  track: Track;
  goal: Goal;
  experience_level: ExperienceLevel;
  daily_commitment_min: TimeCommitment;
}

const SALES_GOALS = [
  { value: "telesales", label: "电销能手", icon: "phone_in_talk", desc: "电话销售技巧提升" },
  { value: "field_sales", label: "面销达人", icon: "handshake", desc: "面对面销售技能强化" },
  { value: "negotiation", label: "商务谈判", icon: "gavel", desc: "高级商务谈判技巧" },
];

const SOCIAL_GOALS = [
  { value: "daily_social", label: "日常社交", icon: "groups", desc: "日常社交能力提升" },
  { value: "workplace", label: "职场沟通", icon: "business_center", desc: "职场沟通技巧强化" },
  { value: "public_speaking", label: "公开演讲", icon: "campaign", desc: "公开演讲能力训练" },
];

const EXPERIENCE_LEVELS = [
  { value: "beginner" as const, label: "新手入门", icon: "eco", desc: "刚接触，想系统学习" },
  { value: "intermediate" as const, label: "有一定经验", icon: "trending_up", desc: "有基础，想突破瓶颈" },
  { value: "advanced" as const, label: "资深从业", icon: "star", desc: "经验丰富，想精益求精" },
];

const TIME_OPTIONS = [
  { value: 15 as const, label: "15分钟", desc: "碎片时间学习" },
  { value: 30 as const, label: "30分钟", desc: "推荐，效果最佳" },
  { value: 60 as const, label: "1小时", desc: "深度学习模式" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [data, setData] = useState<OnboardingData>({
    track: "sales",
    goal: "",
    experience_level: "beginner",
    daily_commitment_min: 30,
  });

  // 检查登录状态
  useEffect(() => {
    if (!token) {
      router.push("/login");
    }
  }, [token, router]);

  const totalSteps = 4;

  const canProceed = () => {
    switch (step) {
      case 1: return !!data.track;
      case 2: return !!data.goal;
      case 3: return !!data.experience_level;
      case 4: return !!data.daily_commitment_min;
      default: return false;
    }
  };

  const handleNext = () => {
    if (step < totalSteps) {
      // 切换赛道时清空目标
      if (step === 1) {
        setData(prev => ({ ...prev, goal: "" }));
      }
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/v1/users/me/onboarding", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "保存失败");
      }

      // 跳转到基线测评或仪表盘
      router.push("/baseline");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    router.push("/dashboard");
  };

  const goals = data.track === "sales" ? SALES_GOALS : SOCIAL_GOALS;

  return (
    <div className="min-h-screen bg-background-dark flex flex-col">
      {/* Header */}
      <header className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-[var(--brand-gradient)] p-0.5 rounded-lg">
            <div className="bg-surface-dark p-1.5 rounded-[6px]">
              <span className="material-symbols-outlined text-text-primary text-xl">psychology</span>
            </div>
          </div>
          <h1 className="text-lg font-bold text-text-primary">AI 智训 <span className="text-blue-400 italic">Pro</span></h1>
        </div>
        <button
          onClick={handleSkip}
          className="text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          跳过引导
        </button>
      </header>

      {/* Progress */}
      <div className="px-6 mb-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-2">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-1.5 rounded-full transition-colors ${i < step ? "bg-blue-500" : "bg-surface-card"
                  }`}
              />
            ))}
          </div>
          <p className="text-xs text-text-muted">步骤 {step} / {totalSteps}</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 pb-32">
        <div className="max-w-2xl mx-auto">
          {/* Step 1: 选择赛道 */}
          {step === 1 && (
            <div className="animate-fadeIn">
              <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mb-3">
                欢迎，{user?.nickname || "新用户"}！
              </h2>
              <p className="text-text-secondary mb-8">首先，请选择您的培训方向</p>

              <div className="grid sm:grid-cols-2 gap-4">
                {/* 销售培养 */}
                <button
                  onClick={() => setData(prev => ({ ...prev, track: "sales" }))}
                  className={`p-6 rounded-2xl border-2 transition-all text-left ${data.track === "sales"
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-border-dark bg-surface-card hover:border-zinc-600"
                    }`}
                >
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 ${data.track === "sales" ? "bg-blue-500" : "bg-surface-lighter"
                    }`}>
                    <span className="material-symbols-outlined text-2xl text-text-primary">trending_up</span>
                  </div>
                  <h3 className="text-lg font-bold text-text-primary mb-2">销售培养</h3>
                  <p className="text-sm text-text-secondary">
                    提升销售技能，成为销冠达人。适合销售从业者、创业者、BD人员。
                  </p>
                </button>

                {/* 社交脱敏 */}
                <button
                  onClick={() => setData(prev => ({ ...prev, track: "social" }))}
                  className={`p-6 rounded-2xl border-2 transition-all text-left ${data.track === "social"
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-border-dark bg-surface-card hover:border-zinc-600"
                    }`}
                >
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 ${data.track === "social" ? "bg-emerald-500" : "bg-surface-lighter"
                    }`}>
                    <span className="material-symbols-outlined text-2xl text-text-primary">groups</span>
                  </div>
                  <h3 className="text-lg font-bold text-text-primary mb-2">社交脱敏</h3>
                  <p className="text-sm text-text-secondary">
                    克服社交恐惧，提升沟通自信。适合内向者、社恐患者、职场新人。
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: 选择目标 */}
          {step === 2 && (
            <div className="animate-fadeIn">
              <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mb-3">
                选择您的训练目标
              </h2>
              <p className="text-text-secondary mb-8">
                {data.track === "sales"
                  ? "您想重点提升哪方面的销售技能？"
                  : "您想在哪个场景提升社交能力？"}
              </p>

              <div className="grid gap-3">
                {goals.map((goal) => (
                  <button
                    key={goal.value}
                    onClick={() => setData(prev => ({ ...prev, goal: goal.value }))}
                    className={`p-5 rounded-xl border-2 transition-all flex items-center gap-4 ${data.goal === goal.value
                        ? data.track === "sales"
                          ? "border-blue-500 bg-blue-500/10"
                          : "border-emerald-500 bg-emerald-500/10"
                        : "border-border-dark bg-surface-card hover:border-zinc-600"
                      }`}
                  >
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${data.goal === goal.value
                        ? data.track === "sales" ? "bg-blue-500" : "bg-emerald-500"
                        : "bg-surface-lighter"
                      }`}>
                      <span className="material-symbols-outlined text-xl text-text-primary">{goal.icon}</span>
                    </div>
                    <div className="text-left">
                      <h3 className="font-bold text-text-primary">{goal.label}</h3>
                      <p className="text-sm text-text-secondary">{goal.desc}</p>
                    </div>
                    {data.goal === goal.value && (
                      <span className={`ml-auto material-symbols-outlined ${data.track === "sales" ? "text-blue-500" : "text-emerald-500"
                        }`}>check_circle</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: 评估水平 */}
          {step === 3 && (
            <div className="animate-fadeIn">
              <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mb-3">
                评估您的当前水平
              </h2>
              <p className="text-text-secondary mb-8">这将帮助我们为您定制合适的训练计划</p>

              <div className="grid gap-3">
                {EXPERIENCE_LEVELS.map((level) => (
                  <button
                    key={level.value}
                    onClick={() => setData(prev => ({ ...prev, experience_level: level.value }))}
                    className={`p-5 rounded-xl border-2 transition-all flex items-center gap-4 ${data.experience_level === level.value
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-border-dark bg-surface-card hover:border-zinc-600"
                      }`}
                  >
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${data.experience_level === level.value ? "bg-blue-500" : "bg-surface-lighter"
                      }`}>
                      <span className="material-symbols-outlined text-xl text-text-primary">{level.icon}</span>
                    </div>
                    <div className="text-left">
                      <h3 className="font-bold text-text-primary">{level.label}</h3>
                      <p className="text-sm text-text-secondary">{level.desc}</p>
                    </div>
                    {data.experience_level === level.value && (
                      <span className="ml-auto material-symbols-outlined text-blue-500">check_circle</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: 时间投入 */}
          {step === 4 && (
            <div className="animate-fadeIn">
              <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mb-3">
                设定每日练习时间
              </h2>
              <p className="text-text-secondary mb-8">坚持是成功的关键，请选择您每天能投入的时间</p>

              <div className="grid gap-3 mb-8">
                {TIME_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setData(prev => ({ ...prev, daily_commitment_min: option.value }))}
                    className={`p-5 rounded-xl border-2 transition-all flex items-center justify-between ${data.daily_commitment_min === option.value
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-border-dark bg-surface-card hover:border-zinc-600"
                      }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${data.daily_commitment_min === option.value ? "bg-blue-500" : "bg-surface-lighter"
                        }`}>
                        <span className="material-symbols-outlined text-xl text-text-primary">schedule</span>
                      </div>
                      <div className="text-left">
                        <h3 className="font-bold text-text-primary">{option.label}</h3>
                        <p className="text-sm text-text-secondary">{option.desc}</p>
                      </div>
                    </div>
                    {data.daily_commitment_min === option.value && (
                      <span className="material-symbols-outlined text-blue-500">check_circle</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Summary */}
              <div className="p-5 rounded-xl bg-surface-card border border-border-dark">
                <h4 className="text-sm font-medium text-text-secondary mb-3">您的专属计划</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-muted">培训方向</span>
                    <span className="text-text-primary">{data.track === "sales" ? "销售培养" : "社交脱敏"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">训练目标</span>
                    <span className="text-text-primary">
                      {goals.find(g => g.value === data.goal)?.label || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">当前水平</span>
                    <span className="text-text-primary">
                      {EXPERIENCE_LEVELS.find(l => l.value === data.experience_level)?.label || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">每日时间</span>
                    <span className="text-text-primary">{data.daily_commitment_min} 分钟</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background-dark via-background-dark to-transparent">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          {step > 1 && (
            <button
              onClick={handleBack}
              className="px-6 py-3 rounded-lg border border-border-dark text-text-primary hover:bg-surface-card transition-colors"
            >
              上一步
            </button>
          )}

          {error && (
            <p className="text-red-400 text-sm flex-1">{error}</p>
          )}

          {step < totalSteps ? (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className="flex-1 py-3 rounded-lg bg-blue-gradient text-text-primary font-bold shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              继续
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !canProceed()}
              className="flex-1 py-3 rounded-lg bg-blue-gradient text-text-primary font-bold shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                  保存中...
                </>
              ) : (
                <>
                  开始基线测评
                  <span className="material-symbols-outlined">arrow_forward</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
