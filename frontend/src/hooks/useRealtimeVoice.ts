/**
 * 实时语音对话 Hook - 重构版本
 * 
 * 基于阿里云百炼 Qwen-Omni-Realtime API 官方最佳实践
 * 
 * 特性:
 * - AudioWorklet 低延迟音频采集 (~10-20ms)
 * - PCM16 16kHz 音频输入
 * - PCM24 24kHz 音频输出
 * - 服务端 VAD 自动检测语音起止
 * - 支持随时打断 AI
 */

import { useState, useRef, useCallback, useEffect } from "react";

// 获取 WebSocket URL
// CDN（如 EdgeOne）通常不支持 WebSocket，需要使用专用域名绕过
function getWsUrl(): string {
  if (typeof window === "undefined") {
    return "ws://localhost:8111/api/v1";
  }
  
  // 方案1: 如果配置了专用的 WebSocket 完整地址，直接使用
  const wsEndpoint = process.env.NEXT_PUBLIC_WS_URL;
  if (wsEndpoint) {
    return wsEndpoint;
  }
  
  // 方案2: 如果配置了 WebSocket 专用主机（用于绕过 CDN）
  const wsHost = process.env.NEXT_PUBLIC_WS_HOST;
  if (wsHost) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${wsHost}/api/v1`;
  }
  
  // 方案3: 生产环境使用专用 WebSocket 域名（绕过 EdgeOne CDN）
  const hostname = window.location.hostname;
  if (hostname === 'xiaoguan.syhub.net') {
    // EdgeOne CDN 不支持 WebSocket，使用专用域名直连后端
    return 'wss://ws.zx.syhub.net/api/v1';
  }
  
  // 方案4: 开发环境或其他情况，使用当前主机名
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/v1`;
}

// 获取 token
function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const authStorage = localStorage.getItem("auth-storage");
    if (authStorage) {
      const parsed = JSON.parse(authStorage);
      return parsed.state?.token || null;
    }
  } catch {
    return null;
  }
  return null;
}

export interface RealtimeMessage {
  type: "user" | "ai" | "system" | "coach";
  content: string;
  timestamp: Date;
  isFinal?: boolean;
}

export interface UseRealtimeVoiceOptions {
  scenarioId: string;
  mode?: "train" | "exam";  // 训练模式，默认 train
  onMessage?: (message: RealtimeMessage) => void;
  onError?: (error: string) => void;
  onStateChange?: (state: RealtimeState) => void;
  onCoachHint?: (hint: string) => void;  // Coach 提示回调
}

export type RealtimeState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "listening"
  | "processing"
  | "speaking";

export interface UseRealtimeVoiceReturn {
  state: RealtimeState;
  isConnected: boolean;
  isSpeaking: boolean;
  isAiSpeaking: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  startListening: () => Promise<void>;
  stopListening: () => void;
  interrupt: () => void;
  currentTranscript: string;
  aiText: string;
  coachHint: string | null;  // 当前教练提示
  error: string | null;
}

/**
 * 音频播放器 - 低延迟连续播放
 */
class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private audioQueue: Float32Array[] = [];
  private isPlaying = false;
  private nextPlayTime = 0;

  async init() {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: 24000 });
    }
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
  }

  private pcm24ToFloat32(buffer: ArrayBuffer): Float32Array {
    const int16Array = new Int16Array(buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }
    return float32Array;
  }

  enqueue(base64Audio: string) {
    try {
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const floatData = this.pcm24ToFloat32(bytes.buffer);
      this.audioQueue.push(floatData);
      this.playNext();
    } catch (e) {
      console.error("Audio decode error:", e);
    }
  }

  private async playNext() {
    if (this.isPlaying || this.audioQueue.length === 0 || !this.audioContext) {
      return;
    }

    this.isPlaying = true;

    while (this.audioQueue.length > 0) {
      const floatData = this.audioQueue.shift();
      if (!floatData) continue;

      const audioBuffer = this.audioContext.createBuffer(1, floatData.length, 24000);
      // 创建新的 Float32Array 以解决类型问题
      audioBuffer.copyToChannel(new Float32Array(floatData), 0);

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);

      const currentTime = this.audioContext.currentTime;
      const startTime = Math.max(currentTime, this.nextPlayTime);
      this.nextPlayTime = startTime + audioBuffer.duration;

      source.start(startTime);

      await new Promise<void>((resolve) => {
        source.onended = () => resolve();
      });
    }

    this.isPlaying = false;
  }

  stop() {
    this.audioQueue = [];
    this.isPlaying = false;
    this.nextPlayTime = 0;
  }

  close() {
    this.stop();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

export function useRealtimeVoice(options: UseRealtimeVoiceOptions): UseRealtimeVoiceReturn {
  const { scenarioId, mode = "train", onMessage, onError, onStateChange, onCoachHint } = options;

  // 状态
  const [state, setState] = useState<RealtimeState>("disconnected");
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [aiText, setAiText] = useState("");
  const [coachHint, setCoachHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 使用 ref 存储回调函数，避免依赖项变化
  const callbacksRef = useRef({ onMessage, onError, onStateChange, onCoachHint });
  callbacksRef.current = { onMessage, onError, onStateChange, onCoachHint };

  // 核心 Refs - 使用 ref 避免闭包问题
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);
  const isListeningRef = useRef(false);
  const isConnectingRef = useRef(false);
  const isMountedRef = useRef(true);

  // 更新状态的稳定函数
  const updateState = useCallback((newState: RealtimeState) => {
    if (!isMountedRef.current) return;
    setState(newState);
    callbacksRef.current.onStateChange?.(newState);
  }, []);

  // 停止录音的内部函数
  const stopRecording = useCallback(() => {
    isListeningRef.current = false;

    if (workletNodeRef.current) {
      try {
        workletNodeRef.current.disconnect();
      } catch { }
      workletNodeRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch { }
      audioContextRef.current = null;
    }
  }, []);

  // 完全清理的函数
  const cleanup = useCallback(() => {
    stopRecording();

    if (wsRef.current) {
      try {
        wsRef.current.close(1000, "Client disconnect");
      } catch { }
      wsRef.current = null;
    }

    if (audioPlayerRef.current) {
      audioPlayerRef.current.close();
      audioPlayerRef.current = null;
    }
  }, [stopRecording]);

  // 处理 WebSocket 消息
  const handleMessage = useCallback((event: MessageEvent) => {
    if (!isMountedRef.current) return;

    try {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "connected":
        case "session_created":
          updateState("connected");
          break;

        case "speech_started":
          audioPlayerRef.current?.stop();
          updateState("listening");
          setCurrentTranscript("");
          break;

        case "speech_stopped":
          updateState("processing");
          break;

        case "user_transcript":
          setCurrentTranscript(data.transcript || "");
          if (data.is_final && data.transcript) {
            callbacksRef.current.onMessage?.({
              type: "user",
              content: data.transcript,
              timestamp: new Date(),
              isFinal: true,
            });
          }
          break;

        case "response_started":
          updateState("speaking");
          setAiText("");
          break;

        case "text_delta":
          setAiText((prev) => prev + (data.delta || ""));
          break;

        case "text_done":
          if (data.text) {
            callbacksRef.current.onMessage?.({
              type: "ai",
              content: data.text,
              timestamp: new Date(),
              isFinal: true,
            });
          }
          break;

        case "audio_delta":
          if (data.audio) {
            audioPlayerRef.current?.enqueue(data.audio);
          }
          break;

        case "audio_done":
          // 音频播放完成
          break;

        case "response_done":
          if (isListeningRef.current) {
            updateState("connected");
          }
          break;

        case "coach_hint":
          // 处理教练提示
          if (data.hint) {
            setCoachHint(data.hint);
            callbacksRef.current.onCoachHint?.(data.hint);
            // 添加到消息列表
            callbacksRef.current.onMessage?.({
              type: "coach",
              content: data.hint,
              timestamp: new Date(),
            });
          }
          break;

        case "response_cancelled":
          audioPlayerRef.current?.stop();
          updateState("connected");
          break;

        case "error":
          setError(data.message);
          callbacksRef.current.onError?.(data.message);
          break;

        case "disconnected":
          updateState("disconnected");
          break;
      }
    } catch (e) {
      console.error("Message parse error:", e);
    }
  }, [updateState]);

  // 连接 WebSocket
  const connect = useCallback(async () => {
    // 防止重复连接
    if (isConnectingRef.current || wsRef.current) {
      console.log("Already connected or connecting");
      return;
    }

    const token = getToken();
    if (!token) {
      setError("请先登录");
      return;
    }

    isConnectingRef.current = true;
    updateState("connecting");
    setError(null);

    // 初始化音频播放器
    audioPlayerRef.current = new AudioPlayer();
    await audioPlayerRef.current.init();

    const wsUrl = `${getWsUrl()}/ws/realtime?token=${encodeURIComponent(token)}&scenario_id=${scenarioId}&mode=${mode}`;
    console.log("Connecting to:", wsUrl);

    return new Promise<void>((resolve, reject) => {
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        const connectionTimeout = setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            ws.close();
            isConnectingRef.current = false;
            setError("连接超时");
            updateState("disconnected");
            reject(new Error("Connection timeout"));
          }
        }, 10000);

        ws.onopen = () => {
          console.log("[Realtime] WebSocket connected successfully");
          clearTimeout(connectionTimeout);
          isConnectingRef.current = false;
          // 不在这里更新状态，等待服务端发送 session_created
          resolve();
        };

        ws.onmessage = handleMessage;

        ws.onerror = (e) => {
          console.error("WebSocket error:", e);
          clearTimeout(connectionTimeout);
          isConnectingRef.current = false;
          setError("连接错误");
          updateState("disconnected");
          reject(e);
        };

        ws.onclose = (e) => {
          console.log("WebSocket closed:", e.code, e.reason);
          clearTimeout(connectionTimeout);
          isConnectingRef.current = false;
          wsRef.current = null;

          if (isMountedRef.current) {
            // 检查是否是认证失败 - 只有明确的 4001 才是 token 无效
            if (e.code === 4001) {
              setError("登录已过期，请重新登录");
              callbacksRef.current.onError?.("登录已过期，请重新登录");
              // 自动跳转登录页
              localStorage.removeItem("auth-storage");
              window.location.href = "/login?expired=1";
              return;
            }
            // 其他关闭原因，只更新状态，不清除登录
            if (e.code === 1006) {
              setError("连接异常断开，请重试");
            } else if (e.reason) {
              setError(e.reason);
            }
            updateState("disconnected");
          }
        };
      } catch (e) {
        console.error("Connect error:", e);
        isConnectingRef.current = false;
        setError("连接失败");
        updateState("disconnected");
        reject(e);
      }
    });
  }, [scenarioId, handleMessage, updateState]);

  // 断开连接
  const disconnect = useCallback(() => {
    cleanup();
    updateState("disconnected");
  }, [cleanup, updateState]);

  // 开始监听
  const startListening = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError("未连接到服务器");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        },
      });
      mediaStreamRef.current = stream;

      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      const ctx = audioContextRef.current;

      // 尝试加载 AudioWorklet
      try {
        await ctx.audioWorklet.addModule("/audio-worklet-processor.js");

        const workletNode = new AudioWorkletNode(ctx, "audio-recorder-processor");
        workletNodeRef.current = workletNode;

        workletNode.port.onmessage = (event) => {
          if (
            event.data.type === "audio" &&
            wsRef.current?.readyState === WebSocket.OPEN
          ) {
            const pcmData = new Uint8Array(event.data.data);
            const base64 = btoa(String.fromCharCode(...pcmData));
            wsRef.current.send(JSON.stringify({ type: "audio", audio: base64 }));
            // 调试日志：每10帧打印一次
            if (Math.random() < 0.1) {
              console.log("[Audio] Sent", pcmData.length, "bytes");
            }
          }
        };

        const source = ctx.createMediaStreamSource(stream);
        source.connect(workletNode);
      } catch (workletError) {
        console.warn("AudioWorklet not supported, using fallback:", workletError);
        // Fallback 到 ScriptProcessor
        const source = ctx.createMediaStreamSource(stream);
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        let frameCount = 0;

        processor.onaudioprocess = (e) => {
          if (wsRef.current?.readyState !== WebSocket.OPEN) return;

          const inputData = e.inputBuffer.getChannelData(0);
          const ratio = ctx.sampleRate / 16000;
          const outputLength = Math.floor(inputData.length / ratio);
          const resampled = new Float32Array(outputLength);

          for (let i = 0; i < outputLength; i++) {
            resampled[i] = inputData[Math.floor(i * ratio)];
          }

          const pcmData = new Int16Array(resampled.length);
          for (let i = 0; i < resampled.length; i++) {
            pcmData[i] = Math.max(-32768, Math.min(32767, resampled[i] * 32768));
          }

          const base64 = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
          wsRef.current?.send(JSON.stringify({ type: "audio", audio: base64 }));

          // 调试日志
          frameCount++;
          if (frameCount % 10 === 0) {
            console.log("[Audio Fallback] Sent", pcmData.buffer.byteLength, "bytes, frame:", frameCount);
          }
        };

        source.connect(processor);
        processor.connect(ctx.destination);
      }

      isListeningRef.current = true;
      updateState("connected");

      console.log("[Realtime] Microphone started, listening...");

      callbacksRef.current.onMessage?.({
        type: "system",
        content: "开始实时对话，AI将自动检测您的语音",
        timestamp: new Date(),
      });
    } catch (e) {
      console.error("Recording error:", e);
      setError("无法访问麦克风");
    }
  }, [updateState]);

  // 停止监听
  const stopListening = useCallback(() => {
    stopRecording();
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      updateState("connected");
    }
  }, [stopRecording, updateState]);

  // 打断 AI
  const interrupt = useCallback(() => {
    audioPlayerRef.current?.stop();
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "interrupt" }));
    }
    updateState("connected");
  }, [updateState]);

  // 组件挂载/卸载生命周期
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      // 清理所有资源
      stopRecording();
      if (wsRef.current) {
        try {
          wsRef.current.close(1000, "Component unmounted");
        } catch { }
        wsRef.current = null;
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.close();
        audioPlayerRef.current = null;
      }
    };
  }, [stopRecording]);

  return {
    state,
    isConnected: state !== "disconnected" && state !== "connecting",
    isSpeaking: state === "listening",
    isAiSpeaking: state === "speaking",
    connect,
    disconnect,
    startListening,
    stopListening,
    interrupt,
    currentTranscript,
    aiText,
    coachHint,
    error,
  };
}
