"use client";

import { useState, useEffect, useRef, useCallback, use } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { sessionApi, scenarioApi, SSEEvent, Scenario, Session, SessionTurn } from "@/lib/api";

type TrainingMode = "train" | "exam";

interface Message {
  id: string;
  role: "npc" | "user" | "coach";
  content: string;
  isTyping?: boolean;
  timestamp?: string;
}

export default function TrainingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: scenarioId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  // 获取模式参数
  const modeParam = searchParams.get("mode") as TrainingMode || "train";
  const [mode] = useState<TrainingMode>(modeParam === "exam" ? "exam" : "train");
  const isExamMode = mode === "exam";

  // 状态
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [activeTab, setActiveTab] = useState<"dialog" | "details">("dialog");
  const [coachTip, setCoachTip] = useState<string | null>(null);
  const [isRequestingHint, setIsRequestingHint] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showInput, setShowInput] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // 格式化时间
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // 初始化 - 加载场景并创建/恢复会话
  useEffect(() => {
    async function init() {
      try {
        setIsLoading(true);
        setError(null);

        // 1. 获取场景信息
        const scenarioData = await scenarioApi.get(scenarioId);
        setScenario(scenarioData);

        // 2. 检查是否有进行中的会话（恢复会话）
        const { items: activeSessions } = await sessionApi.list({ status: "active", size: 50 });
        const existingSession = activeSessions.find(s => s.scenario_id === scenarioId && s.mode === mode);

        let currentSession: Session;

        if (existingSession) {
          // 恢复已有会话
          currentSession = existingSession;
          setSession(currentSession);

          // 加载消息历史
          const history = await sessionApi.getHistory(currentSession.id);
          const historyMessages: Message[] = history.turns.map(turn => ({
            id: `turn-${turn.turn_number}`,
            role: turn.role as "npc" | "user" | "coach",
            content: turn.content,
            timestamp: new Date(turn.created_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
          }));

          if (historyMessages.length > 0) {
            setMessages(historyMessages);
          } else {
            if (historyMessages.length === 0) {
              await startSession(currentSession.id);
            }
          }
        } else {
          // 创建新会话
          currentSession = await sessionApi.create({
            scenario_id: scenarioId,
            mode: mode,
            seed: isExamMode ? Math.floor(Date.now() / 1000) : undefined,
          });
          setSession(currentSession);
          await startSession(currentSession.id);
        }

        // 4. 启动计时器
        if (currentSession.started_at) {
          const startTime = new Date(currentSession.started_at).getTime();
          const now = Date.now();
          setElapsedTime(Math.floor((now - startTime) / 1000));
        } else {
          setElapsedTime(0);
        }

        timerRef.current = setInterval(() => {
          setElapsedTime((prev) => prev + 1);
        }, 1000);

        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "初始化失败");
        setIsLoading(false);
      }
    }

    // 抽取启动逻辑
    async function startSession(sessionId: string) {
      let openingText = "";
      const openingMessage: Message = {
        id: `npc-opening-${Date.now()}`,
        role: "npc",
        content: "",
        isTyping: true,
        timestamp: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages([openingMessage]);

      await sessionApi.start(sessionId, (event: SSEEvent) => {
        if (event.type === "npc_response" && event.content) {
          openingText += event.content;
          setMessages((prev) => {
            // Update the very last message if it matches our ID, or find it
            const exists = prev.find(m => m.id === openingMessage.id);
            if (exists) {
              return prev.map(m => m.id === openingMessage.id ? { ...m, content: openingText, isTyping: true } : m);
            } else {
              return [...prev]; // Should not happen usually
            }
          });
        } else if (event.type === "done") {
          setMessages((prev) => prev.map(m => m.id === openingMessage.id ? { ...m, content: openingText, isTyping: false } : m));
        } else if (event.type === "error") {
          setError(event.content || "获取开场白失败");
        }
      });
    }

    init();

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [scenarioId, mode]);

  // 消息更新时滚动
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // 发送完成后自动聚焦输入框
  useEffect(() => {
    if (!isSending && showInput) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
    }
  }, [isSending, showInput]);

  // 发送消息
  const sendMessage = async () => {
    if (!inputText.trim() || !session || isSending) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: inputText.trim(),
      timestamp: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsSending(true);
    setCoachTip(null);

    // 添加AI正在输入的占位消息
    const npcMessageId = `npc-${Date.now()}`;
    let npcContent = "";
    const npcMessage: Message = {
      id: npcMessageId,
      role: "npc",
      content: "",
      isTyping: true,
    };
    setMessages((prev) => [...prev, npcMessage]);

    try {
      await sessionApi.sendMessage(session.id, userMessage.content, (event: SSEEvent) => {
        if (event.type === "npc_response" && event.content) {
          npcContent += event.content;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === npcMessageId
                ? { ...m, content: npcContent, isTyping: true }
                : m
            )
          );
        } else if (event.type === "coach_tip" && event.content) {
          setCoachTip(event.content);
        } else if (event.type === "done") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === npcMessageId
                ? { ...m, isTyping: false }
                : m
            )
          );
        } else if (event.type === "error") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === npcMessageId
                ? { ...m, content: `错误: ${event.content}`, isTyping: false }
                : m
            )
          );
        }
      });
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === npcMessageId
            ? { ...m, content: `发送失败: ${err instanceof Error ? err.message : "未知错误"}`, isTyping: false }
            : m
        )
      );
    } finally {
      setIsSending(false);
    }
  };

  // 结束训练
  const handleEndTraining = async () => {
    if (!session) return;

    try {
      await sessionApi.end(session.id);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      router.push("/dashboard");
    } catch (err) {
      console.error("结束训练失败:", err);
      router.push("/dashboard");
    }
  };

  // 键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 加载状态
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-bg-base flex items-center justify-center">
        <div className="text-center">
          <div className="size-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4"></div>
          <p className="text-text-secondary">正在初始化训练场景...</p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error && !session) {
    return (
      <div className="fixed inset-0 bg-bg-base flex items-center justify-center">
        <div className="text-center max-w-md">
          <span className="material-symbols-outlined text-red-400 text-5xl mb-4">error</span>
          <h2 className="text-xl font-bold text-text-primary mb-2">初始化失败</h2>
          <p className="text-text-secondary mb-6">{error}</p>
          <Link
            href="/scenarios"
            className="px-6 py-2 bg-blue-500 text-text-primary font-medium rounded-lg hover:bg-blue-400 transition-colors"
          >
            返回场景列表
          </Link>
        </div>
      </div>
    );
  }

  const persona = scenario?.config?.persona || "客户";
  const channel = scenario?.config?.channel || "对话";

  const renderDetails = () => (
    <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-bg-card">
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-400">info</span>
          场景背景
        </h3>
        <div className="p-4 bg-bg-elevated rounded-xl border border-border-default text-text-secondary text-sm leading-relaxed">
          {scenario?.config?.background || "暂无背景描述"}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-emerald-400">flag</span>
          训练目标
        </h3>
        <div className="p-4 bg-bg-elevated rounded-xl border border-border-default text-text-secondary text-sm leading-relaxed">
          {scenario?.config?.objective || "暂无训练目标"}
        </div>
      </div>

      {scenario?.config?.success_criteria && scenario.config.success_criteria.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-400">check_circle</span>
            成功标准
          </h3>
          <div className="bg-bg-elevated rounded-xl border border-border-default overflow-hidden">
            {scenario.config.success_criteria.map((criteria, idx) => (
              <div key={idx} className="flex items-start gap-3 p-4 border-b border-border-strong last:border-0">
                <span className="size-5 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <span className="text-sm text-text-secondary">{criteria}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-purple-400">person</span>
          AI 角色设定
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-bg-elevated rounded-xl border border-border-default">
            <span className="text-xs text-text-muted block mb-1">姓名</span>
            <span className="text-sm text-text-primary font-medium">{scenario?.config?.ai_name || "未知"}</span>
          </div>
          <div className="p-4 bg-bg-elevated rounded-xl border border-border-default">
            <span className="text-xs text-text-muted block mb-1">性格</span>
            <span className="text-sm text-text-primary font-medium">{scenario?.config?.ai_personality || "通用"}</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-bg-base text-text-secondary overflow-hidden flex flex-col">
      {/* Header */}
      <header className="h-16 shrink-0 border-b border-border-default bg-bg-card/95 backdrop-blur px-6 flex items-center justify-between z-20">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="relative flex items-center justify-center size-9 rounded-lg bg-gradient-to-br from-blue-900/50 to-transparent border border-blue-500/20 text-blue-400 shadow-[0_0_15px_-3px_rgba(59,130,246,0.15)]">
              <span className="material-symbols-outlined text-[22px]">graphic_eq</span>
            </div>
            <div>
              <h1 className="text-text-primary text-base font-bold leading-tight tracking-wide">
                {scenario?.name || "训练场景"} <span className="text-blue-400 text-xs font-normal ml-1">PRO</span>
              </h1>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs text-text-secondary">{channel} · {persona}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-900/30 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                  <span className="size-1 rounded-full bg-emerald-500 animate-pulse"></span>
                  {isExamMode ? "考试模式" : "训练模式"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Timer */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="flex items-center gap-3 bg-bg-elevated px-5 py-2 rounded-full border border-border-strong shadow-lg">
            <span className="material-symbols-outlined text-blue-400 text-[18px]">timer</span>
            <span className="text-xl font-mono font-medium tracking-widest text-white tabular-nums">
              {formatTime(elapsedTime)}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-5">
          <button className="text-text-secondary hover:text-blue-400 transition-colors" title="设置">
            <span className="material-symbols-outlined">settings</span>
          </button>
          <div className="h-5 w-px bg-bg-active"></div>
          <button
            onClick={handleEndTraining}
            className="group flex items-center gap-2 rounded-lg bg-bg-elevated border border-border-strong px-4 py-1.5 hover:bg-red-900/20 hover:border-red-500/30 hover:text-red-400 transition-all text-sm font-medium text-text-primary"
          >
            <span className="material-symbols-outlined text-[18px] group-hover:scale-110 transition-transform">logout</span>
            结束训练
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 grid grid-cols-12 gap-0 overflow-hidden relative">
        {/* Left Panel - AI Avatar */}
        <div className="col-span-8 relative bg-bg-card flex flex-col justify-between group">
          {/* Background */}
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-zinc-950/50"></div>
          </div>

          {/* AI Info Badge */}
          <div className="relative z-10 p-8 flex justify-between items-start">
            <div className="bg-bg-elevated/80 backdrop-blur-sm pl-2 pr-5 py-2 rounded-full flex items-center gap-3 border-l-4 border-l-blue-500">
              <div className="size-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-text-primary font-bold text-sm">
                {persona.charAt(0)}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-text-primary tracking-wide">
                  {persona} <span className="text-[10px] font-normal text-text-secondary opacity-80">(AI)</span>
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="size-1.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                  <span className="text-[10px] text-green-400 font-medium">对话中</span>
                </div>
              </div>
            </div>
          </div>

          {/* Input Area */}
          <div className="relative z-10 w-full p-10 flex flex-col items-center gap-8">
            {/* Toggle Input Mode */}
            {!showInput ? (
              <>
                {/* Audio Waveform (placeholder) */}
                <div className="flex items-end justify-center gap-1.5 h-16 w-80 opacity-50">
                  {[40, 70, 100, 50, 80, 30, 60].map((height, i) => (
                    <div
                      key={i}
                      className="w-1.5 bg-gradient-to-t from-zinc-600 to-zinc-500 rounded-full"
                      style={{ height: `${height * 0.5}%` }}
                    />
                  ))}
                </div>

                <button
                  onClick={() => setShowInput(true)}
                  className="px-8 py-3 bg-blue-500 text-text-primary font-bold rounded-full hover:bg-blue-400 transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/25"
                >
                  <span className="material-symbols-outlined">keyboard</span>
                  文字输入
                </button>
                <p className="text-text-muted text-xs">点击开始文字对话</p>
              </>
            ) : (
              <div className="w-full max-w-2xl">
                <div className="flex gap-3">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="输入你的回复..."
                    disabled={isSending}
                    className="flex-1 px-4 py-3 bg-bg-elevated border border-border-strong rounded-xl text-text-primary placeholder-zinc-500 focus:outline-none focus:border-blue-500/50 disabled:opacity-50"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!inputText.trim() || isSending}
                    className="px-6 py-3 bg-blue-500 text-text-primary font-bold rounded-xl hover:bg-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-blue-500/25"
                  >
                    {isSending ? (
                      <span className="size-5 border-2 border-text-muted border-t-text-primary rounded-full animate-spin"></span>
                    ) : (
                      <>
                        <span className="material-symbols-outlined">send</span>
                        发送
                      </>
                    )}
                  </button>
                </div>
                <p className="text-text-muted text-xs mt-3 text-center">按 Enter 发送</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Dialog & Coach */}
        <div className="col-span-4 bg-bg-card border-l border-border-default flex flex-col h-full relative z-20 shadow-2xl">
          {/* Tabs */}
          <div className="flex items-center border-b border-border-default bg-bg-elevated/50">
            <button
              onClick={() => setActiveTab("dialog")}
              className={`flex-1 py-4 text-sm font-bold transition-colors ${activeTab === "dialog"
                ? "text-blue-400 border-b-2 border-blue-500 bg-blue-500/5"
                : "text-text-muted hover:text-text-primary hover:bg-bg-active"
                }`}
            >
              实时对话
            </button>
            <button
              onClick={() => setActiveTab("details")}
              className={`flex-1 py-4 text-sm font-medium transition-colors ${activeTab === "details"
                ? "text-blue-400 border-b-2 border-blue-500 bg-blue-500/5"
                : "text-text-muted hover:text-text-primary hover:bg-bg-active"
                }`}
            >
              场景详情
            </button>
          </div>

          {activeTab === "dialog" ? (
            <div className="flex-1 overflow-y-auto p-5 space-y-6 scroll-smooth bg-bg-card">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-text-muted">等待对话开始...</p>
                </div>
              ) : (
                messages.map((message) =>
                  message.role === "npc" ? (
                    <div key={message.id} className="flex gap-3">
                      <div className="size-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        AI
                      </div>
                      <div className="flex flex-col gap-1 max-w-[85%]">
                        <span className="text-xs text-text-muted">{persona}</span>
                        <div className="bg-bg-elevated border border-border-strong p-3 rounded-2xl rounded-tl-none text-text-primary text-sm leading-relaxed">
                          {message.content || (message.isTyping && "...")}
                          {message.isTyping && message.content && (
                            <span className="inline-flex gap-0.5 ml-1">
                              <span className="w-1 h-1 bg-blue-500 rounded-full animate-pulse"></span>
                              <span className="w-1 h-1 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: "0.15s" }}></span>
                              <span className="w-1 h-1 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: "0.3s" }}></span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : message.role === "user" ? (
                    <div key={message.id} className="flex gap-3 flex-row-reverse">
                      <div className="size-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        我
                      </div>
                      <div className="flex flex-col gap-1 items-end max-w-[85%]">
                        <span className="text-xs text-text-muted">我</span>
                        <div className="bg-blue-500 p-3 rounded-2xl rounded-tr-none text-text-primary font-medium text-sm leading-relaxed shadow-lg shadow-blue-500/20">
                          {message.content}
                        </div>
                      </div>
                    </div>
                  ) : null
                )
              )}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            renderDetails()
          )}

          {/* AI Coach Panel - 仅 Train 模式显示 */}
          {!isExamMode ? (
            <div className="shrink-0 p-4 border-t border-border-default bg-bg-elevated/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-emerald-400">
                  <span className="material-symbols-outlined text-[18px]">psychology</span>
                  <span className="text-sm font-bold">AI 教练</span>
                </div>
                <button
                  onClick={async () => {
                    if (!session || isRequestingHint) return;
                    setIsRequestingHint(true);
                    try {
                      const res = await fetch(`/api/v1/sessions/${session.id}/request-hint`, {
                        method: "POST",
                        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` },
                      });
                      if (res.ok) {
                        const data = await res.json();
                        if (data.hint) setCoachTip(data.hint);
                      }
                    } catch (err) {
                      console.error("请求提示失败", err);
                    } finally {
                      setIsRequestingHint(false);
                    }
                  }}
                  disabled={isRequestingHint}
                  className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                >
                  {isRequestingHint ? "加载中..." : "请求提示"}
                </button>
              </div>

              {coachTip ? (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                  <p className="text-sm text-text-secondary leading-relaxed">{coachTip}</p>
                </div>
              ) : (
                <div className="text-sm text-text-muted">
                  继续对话，AI教练会在关键时刻给你建议...
                </div>
              )}
            </div>
          ) : (
            <div className="shrink-0 p-4 border-t border-border-default bg-bg-elevated/50">
              <div className="flex items-center justify-center gap-2 py-3">
                <span className="material-symbols-outlined text-amber-500">quiz</span>
                <span className="text-sm text-text-secondary">考试模式 - 无教练提示</span>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
