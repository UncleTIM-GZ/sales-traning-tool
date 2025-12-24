"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/stores/authStore";

interface SharePosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "report" | "achievement" | "invite";
  data?: {
    score?: number;
    title?: string;
    description?: string;
    dimensions?: Array<{ name: string; score: number }>;
    achievementName?: string;
    achievementIcon?: string;
    inviteCode?: string;
  };
}

export default function SharePosterModal({
  isOpen,
  onClose,
  type,
  data,
}: SharePosterModalProps) {
  const { user } = useAuthStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [posterUrl, setPosterUrl] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 生成海报
  const generatePoster = useCallback(async () => {
    if (!canvasRef.current) return;
    
    setGenerating(true);
    setError(null);
    
    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d")!;
      
      // 设置画布尺寸（适合手机屏幕）
      const width = 375;
      const height = 667;
      const dpr = 2; // 高清
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
      
      // 绘制背景渐变
      const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
      bgGradient.addColorStop(0, "#1a1a2e");
      bgGradient.addColorStop(0.5, "#16213e");
      bgGradient.addColorStop(1, "#0f0f23");
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);
      
      // 绘制装饰元素
      ctx.fillStyle = "rgba(139, 92, 246, 0.1)";
      ctx.beginPath();
      ctx.arc(width - 50, 100, 150, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = "rgba(59, 130, 246, 0.1)";
      ctx.beginPath();
      ctx.arc(50, height - 150, 120, 0, Math.PI * 2);
      ctx.fill();
      
      // 绘制顶部 Logo
      ctx.fillStyle = "#8B5CF6";
      ctx.font = "bold 24px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("销冠 AI", width / 2, 50);
      
      ctx.fillStyle = "#71717A";
      ctx.font = "14px system-ui, -apple-system, sans-serif";
      ctx.fillText("AI销售训练系统", width / 2, 75);
      
      // 根据类型绘制不同内容
      if (type === "report" && data?.score !== undefined) {
        await drawReportPoster(ctx, width, height, data);
      } else if (type === "achievement" && data?.achievementName) {
        await drawAchievementPoster(ctx, width, height, data);
      } else if (type === "invite") {
        await drawInvitePoster(ctx, width, height, data?.inviteCode || "");
      }
      
      // 绘制底部用户信息
      const nickname = user?.nickname || "用户";
      ctx.fillStyle = "#A1A1AA";
      ctx.font = "14px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`来自 ${nickname} 的分享`, width / 2, height - 80);
      
      // 绘制二维码区域提示
      ctx.strokeStyle = "#3F3F46";
      ctx.lineWidth = 1;
      const qrSize = 60;
      const qrX = (width - qrSize) / 2;
      const qrY = height - 70;
      roundRect(ctx, qrX, qrY, qrSize, qrSize, 8);
      ctx.stroke();
      
      ctx.fillStyle = "#71717A";
      ctx.font = "10px system-ui, -apple-system, sans-serif";
      ctx.fillText("扫码加入", width / 2, height - 15);
      
      // 生成图片URL
      const url = canvas.toDataURL("image/png");
      setPosterUrl(url);
    } catch (err) {
      console.error("生成海报失败:", err);
      setError("生成海报失败，请重试");
    } finally {
      setGenerating(false);
    }
  }, [type, data, user]);
  
  // 绘制报告海报
  async function drawReportPoster(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    data: NonNullable<SharePosterModalProps["data"]>
  ) {
    const centerX = width / 2;
    
    // 标题
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 20px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("训练报告", centerX, 120);
    
    // 分数圆环
    const score = data.score || 0;
    const scoreY = 230;
    const radius = 70;
    
    // 背景圆
    ctx.beginPath();
    ctx.arc(centerX, scoreY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "#3F3F46";
    ctx.lineWidth = 8;
    ctx.stroke();
    
    // 分数圆弧
    const scoreGradient = ctx.createLinearGradient(
      centerX - radius, scoreY - radius,
      centerX + radius, scoreY + radius
    );
    scoreGradient.addColorStop(0, "#8B5CF6");
    scoreGradient.addColorStop(1, "#3B82F6");
    ctx.beginPath();
    ctx.arc(centerX, scoreY, radius, -Math.PI / 2, -Math.PI / 2 + (score / 100) * Math.PI * 2);
    ctx.strokeStyle = scoreGradient;
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.stroke();
    
    // 分数文字
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 48px system-ui, -apple-system, sans-serif";
    ctx.fillText(score.toString(), centerX, scoreY + 10);
    
    ctx.fillStyle = "#A1A1AA";
    ctx.font = "14px system-ui, -apple-system, sans-serif";
    ctx.fillText("综合评分", centerX, scoreY + 35);
    
    // 维度分数
    if (data.dimensions && data.dimensions.length > 0) {
      const startY = 350;
      const barWidth = width - 80;
      const barHeight = 8;
      
      data.dimensions.slice(0, 4).forEach((dim, index) => {
        const y = startY + index * 50;
        
        // 维度名称
        ctx.fillStyle = "#D4D4D8";
        ctx.font = "14px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(dim.name, 40, y);
        
        // 分数
        ctx.textAlign = "right";
        ctx.fillText(`${dim.score}分`, width - 40, y);
        
        // 进度条背景
        ctx.fillStyle = "#3F3F46";
        roundRect(ctx, 40, y + 10, barWidth, barHeight, 4);
        ctx.fill();
        
        // 进度条
        const progressGradient = ctx.createLinearGradient(40, 0, 40 + barWidth, 0);
        progressGradient.addColorStop(0, "#8B5CF6");
        progressGradient.addColorStop(1, "#3B82F6");
        ctx.fillStyle = progressGradient;
        roundRect(ctx, 40, y + 10, barWidth * (dim.score / 100), barHeight, 4);
        ctx.fill();
      });
    }
    
    // 描述文字
    ctx.fillStyle = "#A1A1AA";
    ctx.font = "14px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(data.description || "完成一次训练对话", centerX, height - 130);
  }
  
  // 绘制成就海报
  async function drawAchievementPoster(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    data: NonNullable<SharePosterModalProps["data"]>
  ) {
    const centerX = width / 2;
    
    // 标题
    ctx.fillStyle = "#FBBF24";
    ctx.font = "bold 20px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("🏆 成就解锁", centerX, 120);
    
    // 成就圆形背景
    const badgeY = 250;
    const badgeRadius = 80;
    
    const badgeGradient = ctx.createRadialGradient(
      centerX, badgeY, 0,
      centerX, badgeY, badgeRadius
    );
    badgeGradient.addColorStop(0, "rgba(251, 191, 36, 0.3)");
    badgeGradient.addColorStop(1, "rgba(251, 191, 36, 0.1)");
    ctx.fillStyle = badgeGradient;
    ctx.beginPath();
    ctx.arc(centerX, badgeY, badgeRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // 成就图标
    ctx.font = "48px system-ui, -apple-system, sans-serif";
    ctx.fillText(data.achievementIcon || "🎯", centerX, badgeY + 15);
    
    // 成就名称
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 24px system-ui, -apple-system, sans-serif";
    ctx.fillText(data.achievementName || "神秘成就", centerX, 380);
    
    // 成就描述
    ctx.fillStyle = "#A1A1AA";
    ctx.font = "14px system-ui, -apple-system, sans-serif";
    ctx.fillText(data.description || "恭喜解锁新成就！", centerX, 420);
    
    // 邀请文字
    ctx.fillStyle = "#D4D4D8";
    ctx.font = "16px system-ui, -apple-system, sans-serif";
    ctx.fillText("快来挑战，一起成为销冠！", centerX, 500);
  }
  
  // 绘制邀请海报
  async function drawInvitePoster(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    inviteCode: string
  ) {
    const centerX = width / 2;
    
    // 标题
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 28px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("邀请你一起", centerX, 150);
    ctx.fillText("成为销冠", centerX, 190);
    
    // 特色介绍
    const features = [
      { icon: "🎯", text: "AI模拟真实客户" },
      { icon: "💬", text: "语音实时对话" },
      { icon: "📊", text: "专业评估报告" },
      { icon: "🏆", text: "个性化训练" },
    ];
    
    features.forEach((feature, index) => {
      const y = 270 + index * 50;
      const x = 60;
      
      // 背景
      ctx.fillStyle = "rgba(139, 92, 246, 0.1)";
      roundRect(ctx, x, y - 20, width - 120, 40, 10);
      ctx.fill();
      
      // 图标和文字
      ctx.font = "20px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(feature.icon, x + 15, y + 5);
      
      ctx.fillStyle = "#E4E4E7";
      ctx.font = "16px system-ui, -apple-system, sans-serif";
      ctx.fillText(feature.text, x + 50, y + 5);
    });
    
    // 邀请码
    if (inviteCode) {
      ctx.fillStyle = "#A1A1AA";
      ctx.font = "14px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("专属邀请码", centerX, 510);
      
      // 邀请码框
      ctx.strokeStyle = "#8B5CF6";
      ctx.lineWidth = 2;
      roundRect(ctx, centerX - 70, 520, 140, 40, 10);
      ctx.stroke();
      
      ctx.fillStyle = "#8B5CF6";
      ctx.font = "bold 20px system-ui, -apple-system, sans-serif";
      ctx.fillText(inviteCode, centerX, 548);
    }
  }
  
  // 圆角矩形辅助函数
  function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  
  // 生成海报
  useEffect(() => {
    if (isOpen) {
      generatePoster();
    }
  }, [isOpen, generatePoster]);
  
  // 下载海报
  const handleDownload = () => {
    if (!posterUrl) return;
    
    const link = document.createElement("a");
    link.download = `销冠AI-${type}-${Date.now()}.png`;
    link.href = posterUrl;
    link.click();
  };
  
  // 复制海报
  const handleCopy = async () => {
    if (!canvasRef.current) return;
    
    try {
      const blob = await new Promise<Blob>((resolve) => {
        canvasRef.current!.toBlob((blob) => resolve(blob!), "image/png");
      });
      
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      
      alert("海报已复制到剪贴板");
    } catch (err) {
      console.error("复制失败:", err);
      alert("复制失败，请直接保存图片");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-bg-card border border-border-default rounded-2xl w-full max-w-md overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border-default">
              <h3 className="text-lg font-bold text-text-primary">分享海报</h3>
              <button
                onClick={onClose}
                className="p-1 text-text-secondary hover:text-text-primary transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Poster Preview */}
            <div className="p-4 flex justify-center">
              <div className="relative">
                <canvas
                  ref={canvasRef}
                  className="rounded-xl shadow-2xl max-w-full"
                  style={{ maxHeight: "60vh" }}
                />
                
                {generating && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
                    <div className="w-10 h-10 border-3 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                  </div>
                )}
                
                {error && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
                    <div className="text-center">
                      <span className="material-symbols-outlined text-red-400 text-4xl block mb-2">error</span>
                      <p className="text-red-400">{error}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-border-default flex gap-3">
              <button
                onClick={handleDownload}
                disabled={!posterUrl || generating}
                className="flex-1 py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-bg-active text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">download</span>
                保存图片
              </button>
              <button
                onClick={handleCopy}
                disabled={!posterUrl || generating}
                className="flex-1 py-3 bg-bg-active hover:bg-bg-hover disabled:bg-bg-elevated text-text-primary rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">content_copy</span>
                复制图片
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
