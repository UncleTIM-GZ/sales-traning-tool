"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/stores/authStore";
import SharePosterModal from "./SharePosterModal";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareType: "report" | "achievement" | "leaderboard" | "invite";
  contentId?: string;
  title?: string;
  description?: string;
  posterData?: {
    score?: number;
    dimensions?: Array<{ name: string; score: number }>;
    achievementName?: string;
    achievementIcon?: string;
  };
}

export default function ShareModal({
  isOpen,
  onClose,
  shareType,
  contentId,
  title = "分享给好友",
  description,
  posterData,
}: ShareModalProps) {
  const { token } = useAuthStore();
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [showPosterModal, setShowPosterModal] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 生成分享链接
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    if (shareType === "report" && contentId) {
      setShareUrl(`${baseUrl}/report/${contentId}`);
    } else if (shareType === "invite") {
      // 从后端获取邀请码
      fetchInviteCode();
    } else if (shareType === "achievement" && contentId) {
      setShareUrl(`${baseUrl}/achievements?highlight=${contentId}`);
    } else {
      setShareUrl(`${baseUrl}/community/leaderboard`);
    }
  }, [shareType, contentId]);

  const fetchInviteCode = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/v1/social/invite-code", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
        setShareUrl(`${baseUrl}${data.share_url}`);
        setInviteCode(data.code);
      }
    } catch (err) {
      console.error("Failed to fetch invite code:", err);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      
      // 记录分享
      recordShare("copy_link");
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const recordShare = async (channel: string) => {
    if (!token) return;
    try {
      await fetch("/api/v1/social/share", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          share_type: shareType,
          channel,
          content_id: contentId,
        }),
      });
    } catch (err) {
      console.error("Failed to record share:", err);
    }
  };

  const handleWechatShare = () => {
    // 微信分享需要调用微信 JS-SDK
    // 这里先显示二维码或提示
    alert("请在微信中打开链接进行分享");
    recordShare("wechat");
  };

  const shareChannels = [
    {
      key: "wechat",
      name: "微信好友",
      icon: "chat",
      color: "bg-green-500",
      onClick: handleWechatShare,
    },
    {
      key: "wechat_moments",
      name: "朋友圈",
      icon: "share",
      color: "bg-green-600",
      onClick: () => {
        alert("请在微信中打开链接分享到朋友圈");
        recordShare("wechat_moments");
      },
    },
    {
      key: "copy_link",
      name: copied ? "已复制" : "复制链接",
      icon: copied ? "check" : "content_copy",
      color: "bg-blue-500",
      onClick: handleCopyLink,
    },
    {
      key: "poster",
      name: "生成海报",
      icon: "image",
      color: "bg-purple-500",
      onClick: () => {
        setShowPosterModal(true);
        recordShare("poster");
      },
    },
  ];

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Poster Modal */}
      <SharePosterModal
        isOpen={showPosterModal}
        onClose={() => setShowPosterModal(false)}
        type={shareType === "leaderboard" ? "invite" : shareType}
        data={{
          score: posterData?.score,
          title: title,
          description: description,
          dimensions: posterData?.dimensions,
          achievementName: posterData?.achievementName,
          achievementIcon: posterData?.achievementIcon,
          inviteCode: inviteCode,
        }}
      />

      <AnimatePresence>
        {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            ref={modalRef}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-surface-card border border-border-dark rounded-2xl w-full max-w-md overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border-dark">
              <h3 className="text-lg font-bold text-text-primary">{title}</h3>
              <button
                onClick={onClose}
                className="p-1 text-text-secondary hover:text-text-primary transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {description && (
                <p className="text-text-secondary text-sm mb-6 text-center">{description}</p>
              )}

              {/* Share URL Preview */}
              <div className="bg-surface-dark rounded-lg p-3 mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-text-muted">link</span>
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 bg-transparent text-sm text-text-primary outline-none truncate"
                />
              </div>

              {/* Share Channels */}
              <div className="grid grid-cols-4 gap-4">
                {shareChannels.map((channel) => (
                  <button
                    key={channel.key}
                    onClick={channel.onClick}
                    className="flex flex-col items-center gap-2 group"
                  >
                    <div
                      className={`w-12 h-12 rounded-full ${channel.color} flex items-center justify-center text-white group-hover:scale-110 transition-transform`}
                    >
                      <span className="material-symbols-outlined">{channel.icon}</span>
                    </div>
                    <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">
                      {channel.name}
                    </span>
                  </button>
                ))}
              </div>

              {/* Invite Bonus Info */}
              {shareType === "invite" && (
                <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-400 mb-2">
                    <span className="material-symbols-outlined text-lg">card_giftcard</span>
                    <span className="font-medium">邀请奖励</span>
                  </div>
                  <ul className="text-sm text-text-secondary space-y-1">
                    <li>• 好友注册成功，你获得 100 积分</li>
                    <li>• 好友完成首次对练，再获 50 积分</li>
                    <li>• 被邀请好友可获得 50 积分</li>
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </>
  );
}
