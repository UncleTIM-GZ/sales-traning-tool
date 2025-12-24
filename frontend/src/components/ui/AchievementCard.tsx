"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/stores/authStore";

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  rarity: string;
  points_reward: number;
  is_unlocked: boolean;
  earned_at?: string;
}

interface IncentiveSummary {
  points: number;
  level: number;
  level_name: string;
  streak_days: number;
  recent_achievements: Achievement[];
  next_achievement?: Achievement;
}

interface PointsData {
  points: number;
  level: number;
  experience: number;
  next_level_experience: number | null;
  level_progress: number;
}

interface AchievementCardProps {
  className?: string;
  compact?: boolean;
}

export default function AchievementCard({ className = "", compact = false }: AchievementCardProps) {
  const { token } = useAuthStore();
  const [summary, setSummary] = useState<IncentiveSummary | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const [summaryRes, achievementsRes] = await Promise.all([
          fetch("/api/v1/incentive/summary", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/v1/incentive/achievements", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (summaryRes.ok) {
          setSummary(await summaryRes.json());
        }
        if (achievementsRes.ok) {
          const data = await achievementsRes.json();
          setAchievements(data.items);
        }
      } catch (err) {
        console.error("Failed to fetch incentive data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "legendary":
        return "from-yellow-500 to-orange-500";
      case "epic":
        return "from-purple-500 to-pink-500";
      case "rare":
        return "from-blue-500 to-cyan-500";
      default:
        return "from-gray-500 to-gray-600";
    }
  };

  const getRarityBorder = (rarity: string) => {
    switch (rarity) {
      case "legendary":
        return "border-yellow-500/30";
      case "epic":
        return "border-purple-500/30";
      case "rare":
        return "border-blue-500/30";
      default:
        return "border-gray-500/30";
    }
  };

  if (loading) {
    return (
      <div className={`bg-surface-card border border-border-dark rounded-xl p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-bg-elevated rounded w-1/3"></div>
          <div className="h-20 bg-bg-elevated rounded"></div>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-16 bg-bg-elevated rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  const unlockedAchievements = achievements.filter(a => a.is_unlocked);
  const lockedAchievements = achievements.filter(a => !a.is_unlocked);

  if (compact) {
    // 紧凑模式：只显示积分和等级
    return (
      <div className={`bg-surface-card border border-border-dark rounded-xl p-4 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <span className="text-text-primary font-bold text-lg">Lv{summary.level}</span>
            </div>
            <div>
              <p className="text-text-primary font-medium">{summary.level_name}</p>
              <p className="text-xs text-text-muted">{summary.points} 积分</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {unlockedAchievements.slice(0, 3).map(a => (
              <span key={a.id} className="text-2xl">{a.icon}</span>
            ))}
            {unlockedAchievements.length > 3 && (
              <span className="text-xs text-text-muted">+{unlockedAchievements.length - 3}</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-surface-card border border-border-dark rounded-xl p-6 ${className}`}>
      {/* 头部：积分和等级 */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-text-primary">成就与荣誉</h3>
        <div className="flex items-center gap-2">
          <span className="text-orange-400 font-bold">{summary.points}</span>
          <span className="text-xs text-text-muted">积分</span>
        </div>
      </div>

      {/* 等级卡片 */}
      <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-4">
          <motion.div 
            className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/20"
            animate={{ 
              boxShadow: [
                "0 10px 25px -5px rgba(249, 115, 22, 0.2)",
                "0 10px 35px -5px rgba(249, 115, 22, 0.4)",
                "0 10px 25px -5px rgba(249, 115, 22, 0.2)",
              ]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span className="text-text-primary font-bold text-2xl">Lv{summary.level}</span>
          </motion.div>
          <div className="flex-1">
            <p className="text-text-primary font-bold text-lg">{summary.level_name}</p>
            <p className="text-xs text-text-secondary mt-1">
              连续训练 {summary.streak_days} 天
              {summary.streak_days >= 7 && " 🔥"}
            </p>
          </div>
        </div>
      </div>

      {/* 即将解锁的成就 */}
      {summary.next_achievement && (
        <div className="mb-6">
          <p className="text-xs text-text-muted mb-2">即将解锁</p>
          <div className={`p-3 rounded-lg border ${getRarityBorder(summary.next_achievement.rarity)} bg-surface-dark flex items-center gap-3`}>
            <div className="w-10 h-10 rounded-lg bg-bg-elevated flex items-center justify-center opacity-50">
              <span className="text-2xl grayscale">{summary.next_achievement.icon}</span>
            </div>
            <div className="flex-1">
              <p className="text-text-secondary font-medium text-sm">{summary.next_achievement.name}</p>
              <p className="text-xs text-text-muted">{summary.next_achievement.description}</p>
            </div>
            <span className="text-xs text-orange-400">+{summary.next_achievement.points_reward}</span>
          </div>
        </div>
      )}

      {/* 成就列表 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-text-muted">
            已解锁 {unlockedAchievements.length}/{achievements.length}
          </p>
          {achievements.length > 8 && (
            <button 
              onClick={() => setShowAll(!showAll)}
              className="text-xs text-orange-400 hover:underline"
            >
              {showAll ? "收起" : "查看全部"}
            </button>
          )}
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
          {(showAll ? achievements : achievements.slice(0, 10)).map((achievement, index) => (
            <motion.div
              key={achievement.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className={`relative group cursor-pointer ${
                achievement.is_unlocked ? "" : "opacity-40 grayscale"
              }`}
            >
              <div className={`aspect-square rounded-lg border ${
                achievement.is_unlocked 
                  ? getRarityBorder(achievement.rarity) 
                  : "border-border-default"
              } bg-surface-dark flex items-center justify-center transition-all group-hover:scale-105`}>
                <span className="text-2xl">{achievement.icon}</span>
              </div>
              
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-bg-card rounded-lg text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 border border-border-strong">
                <p className="font-medium text-text-primary">{achievement.name}</p>
                <p className="text-text-secondary mt-0.5">{achievement.description}</p>
                {!achievement.is_unlocked && (
                  <p className="text-orange-400 mt-1">+{achievement.points_reward} 积分</p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
