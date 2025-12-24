"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";

interface Task {
  id: string;
  type: "learn" | "practice" | "review";
  title: string;
  description?: string;
  duration_min: number;
  content_type?: string;
  content_id?: string;
  status: "pending" | "in_progress" | "completed" | "skipped";
  result_score?: number;
}

interface DayTasks {
  day: number;
  tasks: Task[];
  is_today: boolean;
  is_completed: boolean;
}

interface TrainingPlan {
  id: string;
  name: string;
  description?: string;
  duration_days: number;
  target_dimensions: string[];
  daily_time_min: number;
  daily_tasks: DayTasks[];
  current_day: number;
  completed_tasks: string[];
  status: "active" | "paused" | "completed";
  progress: number;
  started_at?: string;
}

export default function PlanPage() {
  const router = useRouter();
  const { token } = useAuthStore();
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  const fetchActivePlan = useCallback(async () => {
    if (!token) return;

    try {
      const res = await fetch("/api/v1/training/plans/active", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        if (data) {
          setPlan(data);
          setExpandedDay(data.current_day);
        }
      }
    } catch (err) {
      console.error("Failed to fetch plan:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchActivePlan();
  }, [fetchActivePlan]);

  const generatePlan = async (days: number = 7) => {
    if (!token) return;

    setGenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/training/plans/generate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ duration_days: days }),
      });

      if (res.ok) {
        const data = await res.json();
        setPlan(data);
        setExpandedDay(data.current_day);
      } else {
        const err = await res.json();
        setError(err.detail || "生成计划失败");
      }
    } catch (err) {
      setError("网络错误，请重试");
    } finally {
      setGenerating(false);
    }
  };

  const completeTask = async (taskId: string) => {
    if (!token || !plan) return;

    try {
      const res = await fetch(`/api/v1/training/plans/${plan.id}/tasks/${taskId}/complete`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        // 刷新计划数据
        await fetchActivePlan();
      }
    } catch (err) {
      console.error("Failed to complete task:", err);
    }
  };

  const startPractice = (scenarioId: string) => {
    router.push(`/training/${scenarioId}?mode=train`);
  };

  const getTaskIcon = (type: string) => {
    switch (type) {
      case "learn":
        return "book";
      case "practice":
        return "target";
      case "review":
        return "file-text";
      default:
        return "bookmark";
    }
  };

  const getTaskTypeName = (type: string) => {
    switch (type) {
      case "learn":
        return "学习";
      case "practice":
        return "练习";
      case "review":
        return "复盘";
      default:
        return "任务";
    }
  };

  const getDimensionName = (dim: string) => {
    const names: Record<string, string> = {
      objection_handling: "异议处理",
      closing: "成交技巧",
      rapport_building: "关系建立",
      need_discovery: "需求挖掘",
      product_presentation: "产品展示",
      confidence: "自信表达",
      empathy: "共情能力",
      logic: "逻辑表达",
    };
    return names[dim] || dim;
  };

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-surface-lighter rounded w-1/3"></div>
          <div className="h-32 bg-surface-lighter rounded"></div>
          <div className="h-64 bg-surface-lighter rounded"></div>
        </div>
      </div>
    );
  }

  // 没有计划时显示生成界面
  if (!plan) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-text-primary mb-6">我的训练计划</h1>

        <div className="bg-surface-card rounded-xl border border-border-dark p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-text-primary mb-2">
            还没有训练计划
          </h2>
          <p className="text-text-muted mb-6">
            基于您的能力画像，我们将为您生成个性化的训练计划
          </p>

          {error && (
            <div className="text-red-400 text-sm mb-4">{error}</div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => generatePlan(7)}
              disabled={generating}
              className="cursor-pointer px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-all"
            >
              {generating ? "生成中..." : "生成7天计划"}
            </button>
            <button
              onClick={() => generatePlan(14)}
              disabled={generating}
              className="cursor-pointer px-6 py-3 bg-surface-lighter text-text-secondary border border-border-dark rounded-lg font-medium hover:bg-surface-card hover:text-text-primary disabled:opacity-50 transition-all"
            >
              生成14天计划
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 显示计划详情
  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{plan.name}</h1>
          <p className="text-text-muted text-sm mt-1">{plan.description}</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-text-muted">
            第 {plan.current_day} / {plan.duration_days} 天
          </div>
          <div className="text-2xl font-bold text-primary">
            {Math.round(plan.progress * 100)}%
          </div>
        </div>
      </div>

      {/* 进度条 */}
      <div className="bg-surface-card rounded-xl border border-border-dark p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-text-primary">整体进度</span>
          <span className="text-sm text-text-muted">
            已完成 {plan.completed_tasks.length} 个任务
          </span>
        </div>
        <div className="w-full bg-surface-lighter rounded-full h-3">
          <div
            className="bg-gradient-to-r from-primary to-blue-400 h-3 rounded-full transition-all duration-500"
            style={{ width: `${plan.progress * 100}%` }}
          />
        </div>

        {/* 目标维度标签 */}
        {plan.target_dimensions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {plan.target_dimensions.map((dim) => (
              <span
                key={dim}
                className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full"
              >
                {getDimensionName(dim)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 每日任务列表 */}
      <div className="space-y-3">
        {plan.daily_tasks.map((dayData) => (
          <div
            key={dayData.day}
            className={`bg-surface-card rounded-xl border transition-all ${dayData.is_today
                ? "border-primary ring-2 ring-primary/20"
                : dayData.is_completed
                  ? "border-emerald-500/30"
                  : "border-border-dark"
              }`}
          >
            {/* 日期头部 */}
            <button
              onClick={() => setExpandedDay(expandedDay === dayData.day ? null : dayData.day)}
              className="cursor-pointer w-full px-4 py-3 flex items-center justify-between hover:bg-surface-lighter transition-colors rounded-xl"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${dayData.is_today
                      ? "bg-primary text-white"
                      : dayData.is_completed
                        ? "bg-emerald-500 text-white"
                        : dayData.day < plan.current_day
                          ? "bg-surface-lighter text-text-muted"
                          : "bg-surface-lighter text-text-secondary"
                    }`}
                >
                  {dayData.is_completed ? "✓" : dayData.day}
                </div>
                <div className="text-left">
                  <div className="font-medium text-text-primary">
                    第 {dayData.day} 天
                    {dayData.is_today && (
                      <span className="ml-2 px-2 py-0.5 bg-primary/20 text-primary text-xs rounded-full">
                        今天
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-text-muted">
                    {dayData.tasks.filter((t) => t.status === "completed").length} / {dayData.tasks.length} 任务完成
                  </div>
                </div>
              </div>
              <svg
                className={`w-5 h-5 text-text-muted transition-transform ${expandedDay === dayData.day ? "rotate-180" : ""
                  }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* 任务列表 */}
            {expandedDay === dayData.day && (
              <div className="px-4 pb-4 space-y-2">
                {dayData.tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`p-4 rounded-lg border ${task.status === "completed"
                        ? "bg-emerald-500/10 border-emerald-500/30"
                        : "bg-surface-lighter border-border-dark"
                      }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${task.status === "completed" ? "bg-emerald-500/20" : "bg-surface-card"
                          }`}>
                          <TaskIcon type={getTaskIcon(task.type)} completed={task.status === "completed"} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-text-primary">{task.title}</span>
                            <span className="px-2 py-0.5 bg-surface-card text-text-muted text-xs rounded">
                              {getTaskTypeName(task.type)}
                            </span>
                          </div>
                          {task.description && (
                            <p className="text-sm text-text-muted mt-1">{task.description}</p>
                          )}
                          <div className="text-xs text-text-muted mt-2">
                            预计 {task.duration_min} 分钟
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {task.status === "completed" ? (
                          <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-sm rounded-full">
                            已完成
                          </span>
                        ) : (
                          <>
                            {task.type === "practice" && task.content_id && (
                              <button
                                onClick={() => startPractice(task.content_id!)}
                                className="cursor-pointer px-3 py-1 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 transition-colors"
                              >
                                开始练习
                              </button>
                            )}
                            <button
                              onClick={() => completeTask(task.id)}
                              className="cursor-pointer px-3 py-1 bg-surface-card text-text-secondary text-sm rounded-lg hover:bg-surface-lighter hover:text-text-primary border border-border-dark transition-colors"
                            >
                              标记完成
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 底部操作 */}
      {plan.status === "completed" && (
        <div className="mt-6 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-text-primary">恭喜完成训练计划!</h3>
          <p className="text-text-muted mt-1">您已完成所有任务，继续生成新计划保持进步</p>
          <button
            onClick={() => generatePlan(7)}
            disabled={generating}
            className="cursor-pointer mt-4 px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-all"
          >
            生成新计划
          </button>
        </div>
      )}
    </div>
  );
}

// 任务图标组件
function TaskIcon({ type, completed }: { type: string; completed: boolean }) {
  const color = completed ? "text-emerald-400" : "text-text-muted";
  switch (type) {
    case "book":
      return (
        <svg className={`w-5 h-5 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      );
    case "target":
      return (
        <svg className={`w-5 h-5 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      );
    case "file-text":
      return (
        <svg className={`w-5 h-5 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    default:
      return (
        <svg className={`w-5 h-5 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      );
  }
}
