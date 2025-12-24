"use client";

/**
 * 实时语音训练页面 - 商业级设计
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useRealtimeVoice, RealtimeMessage, RealtimeState } from "@/hooks/useRealtimeVoice";
import { scenarioApi } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

export default function VoiceTrainingPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const scenarioId = params.id as string;
  const mode = (searchParams.get("mode") || "train") as "train" | "exam";
  const isExamMode = mode === "exam";

  const [scenario, setScenario] = useState<{ name: string; description: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<RealtimeMessage[]>([]);
  const [sessionStart, setSessionStart] = useState<Date | null>(null);
  const [duration, setDuration] = useState("00:00");
  const [latestCoachHint, setLatestCoachHint] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    state,
    isConnected,
    isSpeaking,
    isAiSpeaking,
    connect,
    disconnect,
    startListening,
    stopListening,
    interrupt,
    currentTranscript,
    aiText,
    coachHint,
    error,
  } = useRealtimeVoice({
    scenarioId,
    mode,
    onMessage: useCallback((msg: RealtimeMessage) => {
      setMessages((prev) => [...prev, msg]);
    }, []),
    onError: useCallback((err: string) => {
      console.error("Realtime error:", err);
    }, []),
    onStateChange: useCallback((newState: RealtimeState) => {
      if (newState === "connected" && !sessionStart) {
        setSessionStart(new Date());
      }
    }, [sessionStart]),
    onCoachHint: useCallback((hint: string) => {
      setLatestCoachHint(hint);
      // 5秒后自动清除提示
      setTimeout(() => setLatestCoachHint(null), 8000);
    }, []),
  });

  // 加载场景
  useEffect(() => {
    async function loadScenario() {
      try {
        const data = await scenarioApi.get(scenarioId);
        setScenario({ name: data.name, description: data.description || "" });
      } catch (e) {
        setScenario({ name: "销售场景", description: "实时语音训练" });
      } finally {
        setLoading(false);
      }
    }
    loadScenario();
  }, [scenarioId]);

  // 更新时长
  useEffect(() => {
    if (!sessionStart) return;
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - sessionStart.getTime()) / 1000);
      const mins = Math.floor(elapsed / 60).toString().padStart(2, "0");
      const secs = (elapsed % 60).toString().padStart(2, "0");
      setDuration(`${mins}:${secs}`);
    }, 1000);
    return () => clearInterval(timer);
  }, [sessionStart]);

  // 滚动
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentTranscript, aiText]);

  const handleStart = async () => {
    await connect();
    setTimeout(async () => {
      await startListening();
    }, 500);
  };

  const handleEnd = () => {
    stopListening();
    disconnect();
    setMessages((prev) => [...prev, {
      type: "system",
      content: "训练已结束",
      timestamp: new Date(),
    }]);
  };

  const handleBack = () => {
    disconnect();
    router.push("/scenarios");
  };

  const getStateInfo = () => {
    const states: Record<RealtimeState, { label: string; color: string; icon: string }> = {
      disconnected: { label: "未连接", color: "zinc", icon: "cloud_off" },
      connecting: { label: "连接中", color: "amber", icon: "sync" },
      connected: { label: "待命", color: "emerald", icon: "check_circle" },
      listening: { label: "倾听中", color: "blue", icon: "hearing" },
      processing: { label: "思考中", color: "purple", icon: "psychology" },
      speaking: { label: "AI回复", color: "orange", icon: "record_voice_over" },
    };
    return states[state];
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-bg-base flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-text-secondary">加载中...</p>
        </div>
      </div>
    );
  }

  const stateInfo = getStateInfo();

  return (
    <div className="fixed inset-0 bg-bg-base flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-16 shrink-0 bg-bg-card/80 backdrop-blur-xl border-b border-border-default px-6 flex items-center justify-between">
        <Link
          href="/scenarios"
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back</span>
          <span className="text-sm font-medium hidden sm:block">返回</span>
        </Link>

        <div className="flex flex-col items-center">
          <h1 className="text-text-primary font-bold text-sm">{scenario?.name}</h1>
          <div className="flex items-center gap-3 mt-0.5">
            {/* 模式标识 */}
            <div className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              isExamMode 
                ? "bg-amber-500/20 text-amber-400" 
                : "bg-emerald-500/20 text-emerald-400"
            }`}>
              {isExamMode ? "考试" : "训练"}
            </div>
            <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
              state === "listening" ? "bg-blue-500/20 text-blue-400" :
              state === "speaking" ? "bg-orange-500/20 text-orange-400" :
              state === "connected" ? "bg-emerald-500/20 text-emerald-400" :
              "bg-bg-elevated text-text-secondary"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                state === "listening" ? "bg-blue-400 animate-pulse" :
                state === "speaking" ? "bg-orange-400 animate-pulse" :
                state === "connected" ? "bg-emerald-400" :
                "bg-text-muted"
              }`} />
              {stateInfo.label}
            </div>
            {sessionStart && (
              <span className="text-text-muted text-xs font-mono">{duration}</span>
            )}
          </div>
        </div>

        {isConnected ? (
          <button
            onClick={handleEnd}
            className="flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg border border-red-500/30 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">stop_circle</span>
            <span className="hidden sm:block">结束</span>
          </button>
        ) : (
          <div className="w-20" />
        )}
      </header>

      {/* Main */}
      <main className="flex-1 flex overflow-hidden">
        {/* 左侧 - 主控制区 */}
        <div className="flex-1 flex flex-col items-center justify-center relative">
          {/* 背景 */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-blue-500/5 to-purple-500/5 blur-3xl" />
          </div>

          <div className="relative z-10 flex flex-col items-center gap-8 p-8">
            {!isConnected ? (
              /* 未开始状态 */
              <>
                <div className="relative">
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-blue-500/30">
                    <span className="material-symbols-outlined text-6xl text-blue-400">mic</span>
                  </div>
                  <div className="absolute inset-0 rounded-full border-2 border-blue-500/20 animate-ping" />
                </div>
                
                <div className="text-center max-w-md">
                  <h2 className="text-2xl font-bold text-text-primary mb-3">实时语音训练</h2>
                  <p className="text-text-secondary text-sm leading-relaxed">
                    与 AI 进行实时语音对话，模拟真实销售场景。
                    <br />
                    AI 会自动检测您的语音，并即时回复。
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  {[
                    { icon: "hearing", text: "服务端智能语音检测" },
                    { icon: "flash_on", text: "端到端低延迟响应" },
                    { icon: "pan_tool", text: "支持随时打断 AI" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-text-muted text-xs">
                      <span className="material-symbols-outlined text-emerald-500 text-sm">{item.icon}</span>
                      {item.text}
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleStart}
                  disabled={state === "connecting"}
                  className="group relative px-10 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl font-bold text-lg transition-all disabled:opacity-50 hover:shadow-[0_0_40px_rgba(59,130,246,0.4)] active:scale-95"
                >
                  <span className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-2xl">
                      {state === "connecting" ? "sync" : "play_arrow"}
                    </span>
                    {state === "connecting" ? "连接中..." : "开始训练"}
                  </span>
                </button>

                {/* 错误提示 */}
                {error && (
                  <div className="mt-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm max-w-md text-center">
                    {error}
                  </div>
                )}
              </>
            ) : (
              /* 进行中状态 */
              <>
                {/* 中心语音可视化 */}
                <div className={`relative w-40 h-40 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isSpeaking 
                    ? "bg-blue-500 shadow-[0_0_60px_rgba(59,130,246,0.5)]" 
                    : isAiSpeaking
                      ? "bg-gradient-to-br from-purple-500 to-pink-500 shadow-[0_0_60px_rgba(168,85,247,0.5)]"
                      : "bg-bg-elevated"
                }`}>
                  {/* 脉冲圈 */}
                  {(isSpeaking || isAiSpeaking) && (
                    <>
                      <div className="absolute inset-0 rounded-full border-2 border-current opacity-30 animate-ping" />
                      <div className="absolute inset-[-8px] rounded-full border border-current opacity-20 animate-pulse" />
                    </>
                  )}
                  
                  <span className="material-symbols-outlined text-5xl text-text-primary">
                    {isSpeaking ? "mic" : isAiSpeaking ? "volume_up" : "mic_none"}
                  </span>
                </div>

                {/* 波形可视化 */}
                <div className="h-16 flex items-center justify-center gap-1">
                  {(isSpeaking || isAiSpeaking) ? (
                    [...Array(9)].map((_, i) => (
                      <div
                        key={i}
                        className={`w-1.5 rounded-full transition-all ${
                          isSpeaking 
                            ? "bg-gradient-to-t from-blue-500 to-cyan-400" 
                            : "bg-gradient-to-t from-purple-500 to-pink-400"
                        }`}
                        style={{
                          height: `${20 + Math.sin((Date.now() / 150) + i * 0.5) * 20}px`,
                          animation: "pulse 0.5s ease-in-out infinite",
                          animationDelay: `${i * 50}ms`,
                        }}
                      />
                    ))
                  ) : (
                    <p className="text-text-muted text-sm">等待您说话...</p>
                  )}
                </div>

                {/* 状态文字 */}
                <p className="text-text-secondary text-sm text-center max-w-xs">
                  {isSpeaking
                    ? "正在识别您的语音..."
                    : isAiSpeaking
                      ? "AI 正在回复，可点击打断"
                      : "直接说话，AI 会自动检测并回复"}
                </p>

                {/* 打断按钮 */}
                {isAiSpeaking && (
                  <button
                    onClick={interrupt}
                    className="flex items-center gap-2 px-6 py-3 bg-red-500/20 text-red-400 rounded-xl border border-red-500/30 hover:bg-red-500/30 transition-all active:scale-95"
                  >
                    <span className="material-symbols-outlined">pan_tool</span>
                    打断 AI
                  </button>
                )}

                {/* AI 教练提示 - 仅 Train 模式显示 */}
                {!isExamMode && latestCoachHint && (
                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 max-w-md animate-in slide-in-from-bottom-4 duration-300">
                    <div className="px-5 py-3 bg-emerald-500/20 backdrop-blur-xl border border-emerald-500/30 rounded-xl shadow-lg">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/30 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-emerald-400 text-lg">psychology</span>
                        </div>
                        <div>
                          <p className="text-emerald-400 text-xs font-bold mb-1">AI 教练提示</p>
                          <p className="text-text-primary text-sm">{latestCoachHint}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* 右侧 - 对话记录 */}
        <div className="w-[400px] bg-bg-card border-l border-border-default flex flex-col">
          <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-border-default">
            <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-400 text-lg">chat</span>
              对话记录
            </h3>
            <span className="text-xs text-text-muted">{messages.filter(m => m.type !== "system").length} 条</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && !currentTranscript && !aiText && (
              <div className="h-full flex flex-col items-center justify-center text-text-muted">
                <span className="material-symbols-outlined text-4xl mb-2">forum</span>
                <p className="text-sm">对话记录将显示在这里</p>
              </div>
            )}

            {messages.map((msg, idx) => (
              msg.type === "system" ? (
                <div key={idx} className="flex justify-center">
                  <span className="text-[10px] text-text-muted bg-bg-elevated px-3 py-1 rounded-full">
                    {msg.content}
                  </span>
                </div>
              ) : msg.type === "coach" ? (
                /* 教练提示消息 */
                <div key={idx} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center bg-emerald-500/30">
                    <span className="material-symbols-outlined text-emerald-400 text-sm">psychology</span>
                  </div>
                  <div className="max-w-[80%]">
                    <div className="inline-block px-4 py-2.5 rounded-2xl rounded-bl-md text-sm bg-emerald-500/20 text-text-primary border border-emerald-500/30">
                      {msg.content}
                    </div>
                    <p className="text-[10px] text-text-muted mt-1 px-1">
                      {formatDistanceToNow(msg.timestamp, { addSuffix: true, locale: zhCN })}
                    </p>
                  </div>
                </div>
              ) : (
                <div key={idx} className={`flex gap-3 ${msg.type === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ${
                    msg.type === "user" 
                      ? "bg-blue-500" 
                      : "bg-gradient-to-br from-purple-500 to-pink-500"
                  }`}>
                    <span className="material-symbols-outlined text-white text-sm">
                      {msg.type === "user" ? "person" : "smart_toy"}
                    </span>
                  </div>
                  <div className={`max-w-[80%] ${msg.type === "user" ? "text-right" : ""}`}>
                    <div className={`inline-block px-4 py-2.5 rounded-2xl text-sm ${
                      msg.type === "user"
                        ? "bg-blue-500 text-white rounded-br-md"
                        : "bg-bg-elevated text-text-primary rounded-bl-md border border-border-strong"
                    }`}>
                      {msg.content}
                    </div>
                    <p className="text-[10px] text-text-muted mt-1 px-1">
                      {formatDistanceToNow(msg.timestamp, { addSuffix: true, locale: zhCN })}
                    </p>
                  </div>
                </div>
              )
            ))}

            {/* 实时转录 */}
            {currentTranscript && (
              <div className="flex gap-3 flex-row-reverse">
                <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center bg-blue-500/50">
                  <span className="material-symbols-outlined text-white text-sm">person</span>
                </div>
                <div className="max-w-[80%] text-right">
                  <div className="inline-block px-4 py-2.5 rounded-2xl rounded-br-md text-sm bg-blue-500/30 text-text-primary border border-blue-500/50">
                    {currentTranscript}
                    <span className="inline-flex gap-0.5 ml-2">
                      {[0,1,2].map(i => (
                        <span key={i} className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 100}ms` }} />
                      ))}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* AI 实时回复 */}
            {aiText && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500">
                  <span className="material-symbols-outlined text-white text-sm">smart_toy</span>
                </div>
                <div className="max-w-[80%]">
                  <div className="inline-block px-4 py-2.5 rounded-2xl rounded-bl-md text-sm bg-bg-elevated text-text-primary border border-border-strong">
                    {aiText}
                    <span className="inline-flex items-center gap-1 ml-2">
                      <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" />
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      </main>

      {/* 错误提示 */}
      {error && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-6 py-3 bg-red-500/20 text-red-400 rounded-xl border border-red-500/30 text-sm flex items-center gap-3">
          <span className="material-symbols-outlined text-lg">error</span>
          <span>{error}</span>
          {error.includes("登录") && (
            <button
              onClick={() => router.push("/login")}
              className="px-3 py-1 bg-red-500/30 hover:bg-red-500/50 rounded-lg text-white text-xs font-medium transition-colors"
            >
              重新登录
            </button>
          )}
        </div>
      )}
    </div>
  );
}
