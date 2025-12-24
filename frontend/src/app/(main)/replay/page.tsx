"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useAuthStore } from "@/stores/authStore";

interface Turn {
  turn_number: number;
  role: "user" | "npc" | "coach";
  content: string;
  created_at: string;
}

interface SessionInfo {
  id: string;
  scenario_id: string;
  mode: string;
  status: string;
  started_at: string | null;
  ended_at: string | null;
}

interface ReplayData {
  session: SessionInfo;
  turns: Turn[];
  scenario_name?: string;
  persona?: string;
}

function ReplayContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");
  const { token } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replayData, setReplayData] = useState<ReplayData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [speed, setSpeed] = useState<1 | 2 | 3>(1);

  const messagesRef = useRef<HTMLDivElement>(null);
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (sessionId && token) {
      fetchReplayData();
    }
  }, [sessionId, token]);

  const fetchReplayData = async () => {
    if (!sessionId || !token) return;

    setLoading(true);
    setError(null);

    try {
      // 获取会话历史
      const historyRes = await fetch(`/api/v1/sessions/${sessionId}/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!historyRes.ok) {
        throw new Error("获取会话历史失败");
      }

      const historyData = await historyRes.json();

      // 获取会话信息
      const sessionRes = await fetch(`/api/v1/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      let sessionInfo: SessionInfo | null = null;
      if (sessionRes.ok) {
        sessionInfo = await sessionRes.json();
      }

      setReplayData({
        session: sessionInfo || {
          id: sessionId,
          scenario_id: "",
          mode: "train",
          status: "completed",
          started_at: null,
          ended_at: null,
        },
        turns: historyData.turns || [],
        scenario_name: historyData.scenario_name,
        persona: historyData.persona,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  // 自动播放逻辑
  useEffect(() => {
    if (isPlaying && replayData) {
      const interval = 2000 / speed; // 根据速度调整间隔

      playIntervalRef.current = setInterval(() => {
        setCurrentTurnIndex((prev) => {
          if (prev >= replayData.turns.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, interval);
    }

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [isPlaying, speed, replayData]);

  // 滚动到当前消息
  useEffect(() => {
    if (messagesRef.current) {
      const currentMessage = messagesRef.current.querySelector(
        `[data-turn="${currentTurnIndex}"]`
      );
      currentMessage?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentTurnIndex]);

  const handlePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentTurnIndex(0);
  };

  const handleSkipTo = (index: number) => {
    setCurrentTurnIndex(index);
    setIsPlaying(false);
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "user":
        return "你";
      case "npc":
        return "客户";
      case "coach":
        return "教练";
      default:
        return role;
    }
  };

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center p-4">
        <span className="material-symbols-outlined text-6xl text-text-muted mb-4">
          replay
        </span>
        <h1 className="text-xl font-bold text-text-primary mb-2">对话回放</h1>
        <p className="text-text-muted mb-6">请从报告页面进入回放功能</p>
        <button
          onClick={() => router.push("/dashboard")}
          className="px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-colors"
        >
          返回成长档案
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center p-4">
        <span className="material-symbols-outlined text-6xl text-red-400 mb-4">
          error
        </span>
        <p className="text-red-400 mb-6">{error}</p>
        <button
          onClick={fetchReplayData}
          className="px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-colors"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-base flex flex-col">
      {/* Header */}
      <div className="h-14 border-b border-border-default flex items-center justify-between px-4 bg-bg-card/80 backdrop-blur-lg shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 text-text-secondary hover:text-text-primary hover:bg-bg-elevated rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h1 className="text-text-primary font-bold">对话回放</h1>
            <p className="text-xs text-text-muted">
              {replayData?.scenario_name || "训练对话"} ·{" "}
              {replayData?.turns.length || 0} 轮对话
            </p>
          </div>
        </div>

        {/* Speed Control */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">速度:</span>
          {[1, 2, 3].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s as 1 | 2 | 3)}
              className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                speed === s
                  ? "bg-violet-600 text-white"
                  : "bg-bg-elevated text-text-secondary hover:text-text-primary"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Messages Area */}
      <div ref={messagesRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {replayData?.turns.map((turn, index) => (
          <motion.div
            key={turn.turn_number}
            data-turn={index}
            initial={{ opacity: 0.3 }}
            animate={{
              opacity: index <= currentTurnIndex ? 1 : 0.3,
              scale: index === currentTurnIndex ? 1.02 : 1,
            }}
            transition={{ duration: 0.3 }}
            onClick={() => handleSkipTo(index)}
            className={`cursor-pointer ${
              turn.role === "user" ? "flex justify-end" : "flex justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] ${
                turn.role === "user"
                  ? "bg-violet-600 rounded-2xl rounded-br-md"
                  : turn.role === "coach"
                  ? "bg-amber-500/20 border border-amber-500/30 rounded-2xl"
                  : "bg-bg-elevated rounded-2xl rounded-bl-md"
              } p-4`}
            >
              {/* Role Label */}
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`text-xs font-medium ${
                    turn.role === "user"
                      ? "text-violet-200"
                      : turn.role === "coach"
                      ? "text-amber-400"
                      : "text-text-secondary"
                  }`}
                >
                  {getRoleLabel(turn.role)}
                </span>
                {turn.created_at && (
                  <span className="text-xs text-text-muted">
                    {formatTime(turn.created_at)}
                  </span>
                )}
              </div>

              {/* Content */}
              <p
                className={`text-sm leading-relaxed ${
                  turn.role === "user"
                    ? "text-white"
                    : turn.role === "coach"
                    ? "text-amber-200"
                    : "text-text-secondary"
                }`}
              >
                {turn.content}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Progress Bar */}
      <div className="px-4 py-2 bg-bg-card border-t border-border-default">
        <div className="relative h-2 bg-bg-elevated rounded-full overflow-hidden">
          <motion.div
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-violet-600 to-blue-500 rounded-full"
            animate={{
              width: `${
                replayData?.turns.length
                  ? ((currentTurnIndex + 1) / replayData.turns.length) * 100
                  : 0
              }%`,
            }}
          />
        </div>
        <div className="flex justify-between text-xs text-text-muted mt-1">
          <span>
            第 {currentTurnIndex + 1} / {replayData?.turns.length || 0} 轮
          </span>
          <span>
            {replayData?.session.ended_at
              ? new Date(replayData.session.ended_at).toLocaleString("zh-CN")
              : ""}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="p-4 bg-bg-card border-t border-border-default flex items-center justify-center gap-4">
        <button
          onClick={handleReset}
          disabled={currentTurnIndex === 0}
          className="p-3 text-text-secondary hover:text-text-primary hover:bg-bg-elevated rounded-xl transition-colors disabled:opacity-50"
        >
          <span className="material-symbols-outlined">skip_previous</span>
        </button>

        <button
          onClick={handlePlay}
          className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 transition-all"
        >
          <span className="material-symbols-outlined text-2xl">
            {isPlaying ? "pause" : "play_arrow"}
          </span>
        </button>

        <button
          onClick={() =>
            handleSkipTo(Math.min(currentTurnIndex + 1, (replayData?.turns.length || 1) - 1))
          }
          disabled={currentTurnIndex >= (replayData?.turns.length || 1) - 1}
          className="p-3 text-text-secondary hover:text-text-primary hover:bg-bg-elevated rounded-xl transition-colors disabled:opacity-50"
        >
          <span className="material-symbols-outlined">skip_next</span>
        </button>
      </div>
    </div>
  );
}

export default function ReplayPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-bg-base flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
        </div>
      }
    >
      <ReplayContent />
    </Suspense>
  );
}
