"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";

// 问卷题目 - 销售赛道
const SALES_QUESTIONS = [
  {
    id: 1,
    text: "当客户说「太贵了」时，您通常会：",
    dimension: "objection_handling",
    options: [
      { value: 1, text: "直接给折扣" },
      { value: 2, text: "解释产品价值" },
      { value: 3, text: "询问预算和需求" },
      { value: 4, text: "对比竞品优势" },
    ],
  },
  {
    id: 2,
    text: "面对犹豫不决的客户，您会：",
    dimension: "closing",
    options: [
      { value: 1, text: "给客户更多时间考虑" },
      { value: 2, text: "强调限时优惠" },
      { value: 3, text: "找出犹豫原因并针对性解答" },
      { value: 4, text: "提供更多案例和数据支持" },
    ],
  },
  {
    id: 3,
    text: "在开场白阶段，您最看重：",
    dimension: "opening",
    options: [
      { value: 1, text: "直接介绍产品" },
      { value: 2, text: "建立信任关系" },
      { value: 3, text: "了解客户需求" },
      { value: 4, text: "展示专业形象" },
    ],
  },
  {
    id: 4,
    text: "挖掘需求时，您主要采用：",
    dimension: "needs_discovery",
    options: [
      { value: 1, text: "直接询问需要什么" },
      { value: 2, text: "根据经验推测需求" },
      { value: 3, text: "开放式问题引导" },
      { value: 4, text: "SPIN提问法" },
    ],
  },
  {
    id: 5,
    text: "当销售遇到挫折时，您会：",
    dimension: "resilience",
    options: [
      { value: 1, text: "感到沮丧，需要调整心态" },
      { value: 2, text: "分析原因，寻找改进方法" },
      { value: 3, text: "向同事或导师请教" },
      { value: 4, text: "总结经验，立即投入下一次" },
    ],
  },
];

// 问卷题目 - 社交赛道
const SOCIAL_QUESTIONS = [
  {
    id: 1,
    text: "参加陌生人聚会时，您通常：",
    dimension: "social_anxiety",
    options: [
      { value: 1, text: "尽量待在角落，避免交流" },
      { value: 2, text: "等别人来找自己聊天" },
      { value: 3, text: "尝试和身边的人搭话" },
      { value: 4, text: "主动结识新朋友" },
    ],
  },
  {
    id: 2,
    text: "需要在公开场合发言时，您会：",
    dimension: "public_speaking",
    options: [
      { value: 1, text: "非常紧张，尽量推脱" },
      { value: 2, text: "紧张但会硬着头皮上" },
      { value: 3, text: "做好准备，控制紧张" },
      { value: 4, text: "期待这样的机会" },
    ],
  },
  {
    id: 3,
    text: "与人交流时，眼神接触：",
    dimension: "eye_contact",
    options: [
      { value: 1, text: "很难做到，经常躲避" },
      { value: 2, text: "有时能做到" },
      { value: 3, text: "大部分时间能保持" },
      { value: 4, text: "自然保持眼神交流" },
    ],
  },
  {
    id: 4,
    text: "当话题冷场时，您会：",
    dimension: "conversation",
    options: [
      { value: 1, text: "感到尴尬，不知道说什么" },
      { value: 2, text: "等对方先打破沉默" },
      { value: 3, text: "尝试找新话题" },
      { value: 4, text: "自然地引入新话题或结束对话" },
    ],
  },
  {
    id: 5,
    text: "收到批评或负面反馈时，您会：",
    dimension: "feedback_handling",
    options: [
      { value: 1, text: "感到受伤，难以接受" },
      { value: 2, text: "虽然不舒服但会思考" },
      { value: 3, text: "感谢对方并认真考虑" },
      { value: 4, text: "主动寻求更多反馈" },
    ],
  },
];

export default function BaselinePage() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  const [step, setStep] = useState<"intro" | "questionnaire" | "exam_intro" | "result">("intro");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [examScenarios, setExamScenarios] = useState<Array<{
    id: string;
    name: string;
    description: string;
    difficulty: number;
    seed: number;
    order: number;
  }>>([]);
  const [result, setResult] = useState<{
    score: number;
    weakDimensions: string[];
    level: string;
  } | null>(null);

  // 根据赛道选择问卷
  const questions = user?.track === "social" ? SOCIAL_QUESTIONS : SALES_QUESTIONS;

  useEffect(() => {
    if (!token) {
      router.push("/login");
    }
  }, [token, router]);

  // 加载 Exam 场景
  useEffect(() => {
    const loadExamScenarios = async () => {
      if (!token) return;
      try {
        const res = await fetch("/api/v1/users/me/baseline/scenarios", {
          headers: { "Authorization": `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setExamScenarios(data.scenarios || []);
        }
      } catch (err) {
        console.error("加载测评场景失败", err);
      }
    };
    loadExamScenarios();
  }, [token]);

  const handleAnswer = (questionId: number, value: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));

    // 自动进入下一题
    if (currentQuestion < questions.length - 1) {
      setTimeout(() => setCurrentQuestion(currentQuestion + 1), 300);
    }
  };

  const handleQuestionnaireComplete = async () => {
    setIsSubmitting(true);

    try {
      // 计算分数
      const totalScore = Object.values(answers).reduce((sum, v) => sum + v, 0);
      const maxScore = questions.length * 4;
      const percentage = Math.round((totalScore / maxScore) * 100);

      // 找出弱项维度
      const weakDimensions: string[] = [];
      questions.forEach(q => {
        if (answers[q.id] && answers[q.id] <= 2) {
          weakDimensions.push(q.dimension);
        }
      });

      // 评估等级
      let level = "新手起步";
      if (percentage >= 80) level = "进阶达人";
      else if (percentage >= 60) level = "稳步成长";
      else if (percentage >= 40) level = "潜力新秀";

      setResult({
        score: percentage,
        weakDimensions,
        level,
      });

      // 进入 Exam 场景介绍（如果有场景）
      if (examScenarios.length > 0) {
        setStep("exam_intro");
      } else {
        // 没有场景，直接提交并显示结果
        await submitBaseline(percentage, weakDimensions);
        setStep("result");
      }
    } catch (err) {
      console.error("提交失败", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitBaseline = async (score: number, weakDimensions: string[]) => {
    await fetch("/api/v1/users/me/baseline", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        questionnaire: answers,
        score: score,
        weak_dimensions: weakDimensions,
      }),
    });
  };

  const handleStartExam = (scenario: typeof examScenarios[0]) => {
    // 跳转到 Exam 模式训练
    router.push(`/training/${scenario.id}/voice?mode=exam&seed=${scenario.seed}&baseline=1`);
  };

  const handleSkipExam = async () => {
    // 跳过 Exam 测评，直接保存问卷结果
    if (result) {
      await submitBaseline(result.score, result.weakDimensions);
    }
    setStep("result");
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      // 计算分数
      const totalScore = Object.values(answers).reduce((sum, v) => sum + v, 0);
      const maxScore = questions.length * 4;
      const percentage = Math.round((totalScore / maxScore) * 100);

      // 找出弱项维度
      const weakDimensions: string[] = [];
      questions.forEach(q => {
        if (answers[q.id] && answers[q.id] <= 2) {
          weakDimensions.push(q.dimension);
        }
      });

      // 评估等级
      let level = "新手起步";
      if (percentage >= 80) level = "进阶达人";
      else if (percentage >= 60) level = "稳步成长";
      else if (percentage >= 40) level = "潜力新秀";

      // 调用新 API 完成基线测评
      const res = await fetch("/api/v1/users/me/baseline", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          questionnaire: answers,
          score: percentage,
          weak_dimensions: weakDimensions,
        }),
      });

      if (!res.ok) {
        throw new Error("保存失败");
      }

      setResult({
        score: percentage,
        weakDimensions,
        level,
      });
      setStep("result");
    } catch (err) {
      console.error("提交失败", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = () => {
    router.push("/dashboard");
  };

  const handleSkip = async () => {
    // 跳过时也标记为完成，避免重复跳转
    try {
      await fetch("/api/v1/users/me/baseline", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          questionnaire: {},
          score: 0,
          weak_dimensions: [],
        }),
      });
    } catch (err) {
      console.error("跳过失败", err);
    }
    router.push("/dashboard");
  };

  const progress = ((currentQuestion + 1) / questions.length) * 100;
  const allAnswered = Object.keys(answers).length === questions.length;

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
          <h1 className="text-lg font-bold text-text-primary">基线测评</h1>
        </div>
        {step !== "result" && (
          <button
            onClick={handleSkip}
            className="text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            跳过测评
          </button>
        )}
      </header>

      {/* Intro */}
      {step === "intro" && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-24 h-24 rounded-full bg-[var(--brand-gradient)] flex items-center justify-center mb-8 shadow-lg shadow-[var(--shadow-glow)]">
            <span className="material-symbols-outlined text-5xl text-text-primary">analytics</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mb-4">
            开始能力测评
          </h2>
          <p className="text-text-secondary mb-8 max-w-md">
            通过 5 道快速问卷，我们将评估您当前的{user?.track === "social" ? "社交" : "销售"}能力水平，
            并为您生成个性化的训练计划。
          </p>
          <div className="flex items-center gap-4 text-sm text-text-muted mb-12">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">timer</span>
              约 2 分钟
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">quiz</span>
              5 道题目
            </div>
          </div>
          <button
            onClick={() => setStep("questionnaire")}
            className="px-8 py-3 rounded-lg bg-blue-gradient text-text-primary font-bold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all flex items-center gap-2"
          >
            开始测评
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
        </div>
      )}

      {/* Questionnaire */}
      {step === "questionnaire" && (
        <div className="flex-1 flex flex-col px-6 pb-32">
          {/* Progress */}
          <div className="max-w-2xl mx-auto w-full mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-text-secondary">问题 {currentQuestion + 1} / {questions.length}</span>
              <span className="text-sm text-text-secondary">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 bg-surface-card rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-gradient transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Question */}
          <div className="max-w-2xl mx-auto w-full flex-1">
            <div className="animate-fadeIn">
              <h3 className="text-xl sm:text-2xl font-bold text-text-primary mb-8">
                {questions[currentQuestion].text}
              </h3>

              <div className="grid gap-3">
                {questions[currentQuestion].options.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleAnswer(questions[currentQuestion].id, option.value)}
                    className={`p-5 rounded-xl border-2 transition-all text-left ${answers[questions[currentQuestion].id] === option.value
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-border-dark bg-surface-card hover:border-zinc-600"
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-text-primary">{option.text}</span>
                      {answers[questions[currentQuestion].id] === option.value && (
                        <span className="material-symbols-outlined text-blue-500">check_circle</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background-dark via-background-dark to-transparent">
            <div className="max-w-2xl mx-auto flex items-center gap-4">
              {currentQuestion > 0 && (
                <button
                  onClick={() => setCurrentQuestion(currentQuestion - 1)}
                  className="px-6 py-3 rounded-lg border border-border-dark text-text-primary hover:bg-surface-card transition-colors"
                >
                  上一题
                </button>
              )}

              {currentQuestion < questions.length - 1 ? (
                <button
                  onClick={() => setCurrentQuestion(currentQuestion + 1)}
                  disabled={!answers[questions[currentQuestion].id]}
                  className="flex-1 py-3 rounded-lg bg-surface-card border border-border-dark text-text-primary hover:bg-surface-lighter disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  下一题
                </button>
              ) : (
                <button
                  onClick={handleQuestionnaireComplete}
                  disabled={!allAnswered || isSubmitting}
                  className="flex-1 py-3 rounded-lg bg-blue-gradient text-text-primary font-bold shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                      分析中...
                    </>
                  ) : (
                    "继续场景测评"
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Exam 场景介绍 */}
      {step === "exam_intro" && result && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mb-8 shadow-lg shadow-amber-500/30">
            <span className="material-symbols-outlined text-5xl text-text-primary">quiz</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mb-4">
            场景测评
          </h2>
          <p className="text-text-secondary mb-4 max-w-md">
            完成 {examScenarios.length} 个标准化场景测评，更准确地评估您的实战能力。
          </p>
          <p className="text-text-muted text-sm mb-8">
            每个场景约 3-5 分钟，过程中无法暂停或获取提示。
          </p>

          {/* 场景列表 */}
          <div className="w-full max-w-md space-y-4 mb-8">
            {examScenarios.map((scenario, i) => (
              <button
                key={scenario.id}
                onClick={() => handleStartExam(scenario)}
                className="w-full p-5 rounded-xl border-2 border-border-dark bg-surface-card hover:border-amber-500/50 hover:bg-amber-500/5 transition-all text-left group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <span className="text-2xl font-bold text-amber-500">{i + 1}</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-text-primary font-bold">{scenario.name}</h4>
                    <p className="text-text-muted text-sm line-clamp-1">{scenario.description || `难度: ${"★".repeat(scenario.difficulty)}`}</p>
                  </div>
                  <span className="material-symbols-outlined text-text-muted group-hover:text-amber-500 transition-colors">play_arrow</span>
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={handleSkipExam}
            className="text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            跳过场景测评，稍后进行
          </button>
        </div>
      )}

      {/* Result */}
      {step === "result" && result && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          {/* Score Circle */}
          <div className="relative w-40 h-40 mb-8">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="12"
              />
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="none"
                stroke="url(#gradient)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${result.score * 4.4} 440`}
                className="transition-all duration-1000"
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold text-text-primary">{result.score}</span>
              <span className="text-sm text-text-secondary">分</span>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-text-primary mb-2">{result.level}</h2>
          <p className="text-text-secondary mb-8 max-w-md">
            基于您的答案，我们识别出了 {result.weakDimensions.length} 个需要重点提升的维度，
            已为您生成个性化训练计划。
          </p>

          {/* Weak Dimensions */}
          {result.weakDimensions.length > 0 && (
            <div className="w-full max-w-md mb-8">
              <h4 className="text-sm font-medium text-text-secondary mb-3 text-left">重点提升维度</h4>
              <div className="flex flex-wrap gap-2">
                {result.weakDimensions.map((dim) => (
                  <span
                    key={dim}
                    className="px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-400 text-sm border border-amber-500/20"
                  >
                    {dim.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleComplete}
            className="px-8 py-3 rounded-lg bg-blue-gradient text-text-primary font-bold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all flex items-center gap-2"
          >
            开始我的训练
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
        </div>
      )}

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
