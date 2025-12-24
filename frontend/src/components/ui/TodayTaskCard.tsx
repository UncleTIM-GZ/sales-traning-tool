"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
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
}

interface TodayTasks {
  plan_id: string;
  plan_name: string;
  day: number;
  total_days: number;
  tasks: Task[];
  completed_count: number;
  total_count: number;
}

interface TodayTaskCardProps {
  className?: string;
}

export default function TodayTaskCard({ className = "" }: TodayTaskCardProps) {
  const router = useRouter();
  const { token } = useAuthStore();
  const [todayData, setTodayData] = useState<TodayTasks | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);

  useEffect(() => {
    const fetchTodayTasks = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/v1/training/today", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setTodayData(data);
        }
      } catch (err) {
        console.error("Failed to fetch today tasks:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTodayTasks();
  }, [token]);

  const completeTask = async (taskId: string) => {
    if (!token || !todayData) return;
    
    setCompleting(taskId);
    try {
      const res = await fetch(`/api/v1/training/plans/${todayData.plan_id}/tasks/${taskId}/complete`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      
      if (res.ok) {
        // 更新本地状态
        setTodayData(prev => {
          if (!prev) return null;
          return {
            ...prev,
            tasks: prev.tasks.map(t => 
              t.id === taskId ? { ...t, status: "completed" as const } : t
            ),
            completed_count: prev.completed_count + 1,
          };
        });
      }
    } catch (err) {
      console.error("Failed to complete task:", err);
    } finally {
      setCompleting(null);
    }
  };

  const getTaskIcon = (type: string) => {
    switch (type) {
      case "learn":
        return "menu_book";
      case "practice":
        return "sports_esports";
      case "review":
        return "edit_note";
      default:
        return "task_alt";
    }
  };

  const getTaskColor = (type: string) => {
    switch (type) {
      case "learn":
        return "blue";
      case "practice":
        return "orange";
      case "review":
        return "emerald";
      default:
        return "zinc";
    }
  };

  if (loading) {
    return (
      <div className={`bg-surface-card border border-border-dark rounded-xl p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-bg-elevated rounded w-1/3"></div>
          <div className="h-16 bg-bg-elevated rounded"></div>
          <div className="h-16 bg-bg-elevated rounded"></div>
        </div>
      </div>
    );
  }

  if (!todayData) {
    return (
      <div className={`bg-surface-card border border-border-dark rounded-xl p-6 ${className}`}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-text-primary">今日训练任务</h3>
        </div>
        
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl text-orange-400">event_available</span>
          </div>
          <p className="text-text-secondary text-sm mb-2">还没有训练计划</p>
          <p className="text-text-muted text-xs mb-4">创建个性化计划，开启高效学习之旅</p>
          <Link 
            href="/plan" 
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm rounded-lg hover:from-orange-600 hover:to-red-600 transition-all"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            生成训练计划
          </Link>
        </div>
      </div>
    );
  }

  const progress = todayData.total_count > 0 
    ? (todayData.completed_count / todayData.total_count) * 100 
    : 0;

  return (
    <div className={`bg-surface-card border border-border-dark rounded-xl p-6 ${className}`}>
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-text-primary">今日训练任务</h3>
          <p className="text-xs text-text-muted mt-0.5">
            {todayData.plan_name} · 第 {todayData.day}/{todayData.total_days} 天
          </p>
        </div>
        <Link 
          href="/plan" 
          className="text-text-secondary hover:text-text-primary transition-colors"
        >
          <span className="material-symbols-outlined">open_in_new</span>
        </Link>
      </div>

      {/* 进度条 */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-text-secondary">今日进度</span>
          <span className="text-orange-400 font-medium">
            {todayData.completed_count}/{todayData.total_count} 已完成
          </span>
        </div>
        <div className="w-full bg-surface-dark h-2 rounded-full overflow-hidden">
          <motion.div 
            className="bg-gradient-to-r from-orange-500 to-red-500 h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* 任务列表 */}
      <div className="space-y-3">
        {todayData.tasks.map((task, index) => {
          const color = getTaskColor(task.type);
          const isCompleted = task.status === "completed";
          
          return (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative p-4 rounded-lg border transition-all ${
                isCompleted 
                  ? "bg-surface-dark border-border-dark" 
                  : `bg-${color}-500/5 border-${color}-500/20 hover:border-${color}-500/40`
              }`}
            >
              <div className="flex items-start gap-3">
                {/* 图标 */}
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isCompleted 
                    ? "bg-bg-elevated text-text-muted" 
                    : color === "blue" 
                      ? "bg-blue-500/10 text-blue-400"
                      : color === "orange"
                        ? "bg-orange-500/10 text-orange-400"
                        : "bg-emerald-500/10 text-emerald-400"
                }`}>
                  <span className="material-symbols-outlined">
                    {isCompleted ? "check_circle" : getTaskIcon(task.type)}
                  </span>
                </div>

                {/* 内容 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className={`font-medium truncate ${
                      isCompleted ? "text-text-muted line-through" : "text-text-primary"
                    }`}>
                      {task.title}
                    </h4>
                    {!isCompleted && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        color === "blue" 
                          ? "bg-blue-500/10 text-blue-400"
                          : color === "orange"
                            ? "bg-orange-500/10 text-orange-400"
                            : "bg-emerald-500/10 text-emerald-400"
                      }`}>
                        {task.type === "learn" ? "学习" : task.type === "practice" ? "练习" : "复盘"}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted mt-1">
                    约 {task.duration_min} 分钟
                    {task.description && ` · ${task.description.slice(0, 30)}...`}
                  </p>
                </div>

                {/* 操作按钮 */}
                <div className="flex-shrink-0">
                  {isCompleted ? (
                    <span className="text-xs text-text-muted">已完成</span>
                  ) : task.type === "practice" && task.content_id ? (
                    <button
                      onClick={() => router.push(`/training/${task.content_id}?mode=train`)}
                      className="px-3 py-1.5 bg-orange-500 text-white text-xs rounded-lg hover:bg-orange-600 transition-colors"
                    >
                      开始
                    </button>
                  ) : (
                    <button
                      onClick={() => completeTask(task.id)}
                      disabled={completing === task.id}
                      className="px-3 py-1.5 bg-surface-dark text-text-primary text-xs rounded-lg hover:bg-surface-lighter transition-colors disabled:opacity-50"
                    >
                      {completing === task.id ? "..." : "完成"}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* 全部完成提示 */}
      {progress >= 100 && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-4 p-4 rounded-lg bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-500/20 text-center"
        >
          <span className="material-symbols-outlined text-3xl text-emerald-400">celebration</span>
          <p className="text-emerald-400 font-medium mt-1">今日任务已全部完成！</p>
          <p className="text-xs text-text-muted mt-1">明天继续保持，加油！</p>
        </motion.div>
      )}
    </div>
  );
}
