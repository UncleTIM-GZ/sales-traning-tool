"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/stores/authStore";
import ShareModal from "@/components/ui/ShareModal";

interface ReferralStats {
  invite_code: string;
  total_invites: number;
  completed_invites: number;
  points_earned: number;
}

interface ReferralItem {
  id: string;
  referee_nickname: string | null;
  status: string;
  registered_at: string | null;
  completed_at: string | null;
}

export default function InvitePage() {
  const { token } = useAuthStore();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [referrals, setReferrals] = useState<ReferralItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 等待 token 准备好
    const timer = setTimeout(() => {
      if (token) {
        fetchData();
      } else {
        setLoading(false);
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [token]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 获取统计（包含邀请码）
      const statsRes = await fetch("/api/v1/social/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      } else {
        const errorText = await statsRes.text();
        console.error("Failed to fetch stats:", statsRes.status, errorText);
        
        // 如果 stats 失败，尝试单独获取邀请码
        const codeRes = await fetch("/api/v1/social/invite-code", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (codeRes.ok) {
          const codeData = await codeRes.json();
          setStats({
            invite_code: codeData.code,
            total_invites: 0,
            completed_invites: 0,
            points_earned: 0,
          });
        } else {
          setError("获取邀请码失败");
        }
      }

      // 获取邀请列表
      const listRes = await fetch("/api/v1/social/referrals?size=50", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (listRes.ok) {
        const data = await listRes.json();
        setReferrals(data.items || []);
      } else {
        console.error("Failed to fetch referrals:", listRes.status);
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!stats?.invite_code) return;
    try {
      await navigator.clipboard.writeText(stats.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "registered":
        return (
          <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-400 text-xs rounded-full">
            已注册
          </span>
        );
      case "completed":
        return (
          <span className="px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded-full">
            已完成
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 bg-zinc-500/10 text-text-secondary text-xs rounded-full">
            待注册
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-8 animate-pulse">
        <div className="h-8 bg-surface-card rounded w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-surface-card rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-text-primary mb-2">邀请好友</h1>
        <p className="text-text-secondary">邀请好友一起练习，获取丰厚奖励</p>
      </div>

      {/* Invite Code Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-2xl p-6"
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <p className="text-text-secondary text-sm mb-2">我的邀请码</p>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold text-text-primary tracking-wider">
                {stats?.invite_code || "------"}
              </span>
              <button
                onClick={handleCopyCode}
                className="p-2 text-blue-400 hover:text-blue-300 transition-colors"
              >
                <span className="material-symbols-outlined">
                  {copied ? "check" : "content_copy"}
                </span>
              </button>
            </div>
          </div>
          <button
            onClick={() => setShowShareModal(true)}
            className="px-6 py-3 bg-blue-gradient text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined">share</span>
            立即邀请
          </button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-surface-card border border-border-dark rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-blue-400">group_add</span>
            </div>
            <span className="text-text-secondary">邀请人数</span>
          </div>
          <p className="text-3xl font-bold text-text-primary">{stats?.total_invites || 0}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-surface-card border border-border-dark rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-green-400">check_circle</span>
            </div>
            <span className="text-text-secondary">完成对练</span>
          </div>
          <p className="text-3xl font-bold text-text-primary">{stats?.completed_invites || 0}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-surface-card border border-border-dark rounded-xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-yellow-400">toll</span>
            </div>
            <span className="text-text-secondary">获得积分</span>
          </div>
          <p className="text-3xl font-bold text-text-primary">{stats?.points_earned || 0}</p>
        </motion.div>
      </div>

      {/* Reward Rules */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-surface-card border border-border-dark rounded-xl p-6"
      >
        <h2 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-yellow-400">card_giftcard</span>
          奖励规则
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-surface-dark rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🎁</span>
              <span className="font-medium text-text-primary">好友注册</span>
            </div>
            <p className="text-sm text-text-secondary">好友通过你的邀请码注册</p>
            <p className="text-lg font-bold text-blue-400 mt-2">+100 积分</p>
          </div>
          <div className="p-4 bg-surface-dark rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🎯</span>
              <span className="font-medium text-text-primary">完成对练</span>
            </div>
            <p className="text-sm text-text-secondary">好友完成首次场景对练</p>
            <p className="text-lg font-bold text-blue-400 mt-2">+50 积分</p>
          </div>
          <div className="p-4 bg-surface-dark rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🌟</span>
              <span className="font-medium text-text-primary">好友奖励</span>
            </div>
            <p className="text-sm text-text-secondary">被邀请好友也可获得</p>
            <p className="text-lg font-bold text-green-400 mt-2">+50 积分</p>
          </div>
        </div>
      </motion.div>

      {/* Referral List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-surface-card border border-border-dark rounded-xl p-6"
      >
        <h2 className="text-lg font-bold text-text-primary mb-4">邀请记录</h2>
        
        {referrals.length === 0 ? (
          <div className="text-center py-12">
            <span className="material-symbols-outlined text-6xl text-text-muted mb-4 block">
              group_off
            </span>
            <p className="text-text-muted">暂无邀请记录</p>
            <p className="text-sm text-text-muted mt-1">快去邀请好友一起练习吧</p>
          </div>
        ) : (
          <div className="space-y-3">
            {referrals.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between p-4 bg-surface-dark rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-text-primary font-bold">
                    {(item.referee_nickname || "用户").charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-text-primary">
                      {item.referee_nickname || "新用户"}
                    </p>
                    <p className="text-xs text-text-muted">
                      {item.registered_at
                        ? new Date(item.registered_at).toLocaleDateString("zh-CN")
                        : "-"}
                    </p>
                  </div>
                </div>
                {getStatusBadge(item.status)}
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        shareType="invite"
        title="邀请好友"
        description="分享你的专属邀请链接，好友注册后双方都能获得奖励"
      />
    </div>
  );
}
