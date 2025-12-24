"use client";

/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：成就徽章组件
 * 作用：展示用户成就进度和已解锁成就
 * 创建时间：2025-12-24
 * 最后修改：2025-12-24
 */

import { useState, useEffect } from "react";
import { Award, Trophy, Lock, ChevronRight, Loader2 } from "lucide-react";
import { plazaExtApi, AchievementItem } from "@/lib/api";

interface AchievementBadgeProps {
  onViewAll?: () => void;
}

export default function AchievementBadge({ onViewAll }: AchievementBadgeProps) {
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);
  const [stats, setStats] = useState({ unlocked: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAchievements = async () => {
      try {
        const result = await plazaExtApi.getMyAchievements();
        setAchievements(result.items.slice(0, 4));
        setStats({
          unlocked: result.total_unlocked,
          total: result.total_achievements,
        });
      } catch (error) {
        console.error("Failed to fetch achievements:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAchievements();
  }, []);

  const getRarityColor = (rarity: string) => {
    const colors: Record<string, string> = {
      common: "from-zinc-500/20 to-zinc-600/20 border-zinc-500/30",
      rare: "from-blue-500/20 to-blue-600/20 border-blue-500/30",
      epic: "from-purple-500/20 to-purple-600/20 border-purple-500/30",
      legendary: "from-amber-500/20 to-amber-600/20 border-amber-500/30",
    };
    return colors[rarity] || colors.common;
  };

  const getRarityIconColor = (rarity: string) => {
    const colors: Record<string, string> = {
      common: "text-text-muted",
      rare: "text-blue-400",
      epic: "text-purple-400",
      legendary: "text-amber-400",
    };
    return colors[rarity] || colors.common;
  };

  if (loading) {
    return (
      <div className="bg-surface-card border border-border-dark rounded-xl p-4">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-card border border-border-dark rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium text-text-primary">我的成就</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">
            {stats.unlocked}/{stats.total}
          </span>
          {onViewAll && (
            <button
              onClick={onViewAll}
              className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
            >
              全部
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {achievements.map((achievement) => (
          <div
            key={achievement.id}
            className={`relative aspect-square rounded-xl bg-gradient-to-br border flex items-center justify-center ${getRarityColor(
              achievement.rarity
            )} ${!achievement.is_unlocked ? "opacity-50" : ""}`}
            title={`${achievement.name}: ${achievement.description}`}
          >
            {achievement.is_unlocked ? (
              <Award className={`w-6 h-6 ${getRarityIconColor(achievement.rarity)}`} />
            ) : (
              <Lock className="w-5 h-5 text-text-muted" />
            )}
            {!achievement.is_unlocked && achievement.progress > 0 && (
              <div className="absolute bottom-1 left-1 right-1 h-1 bg-surface-lighter rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${achievement.progress}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {achievements.length === 0 && (
        <div className="text-center py-4 text-text-muted text-sm">
          暂无成就，继续努力吧
        </div>
      )}
    </div>
  );
}
