"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuthStore } from "@/stores/authStore";

interface Achievement {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  unlocked: boolean;
  unlocked_at?: string;
  progress?: number;
  max_progress?: number;
}

interface AchievementStats {
  total_points: number;
  achievements_unlocked: number;
  achievements_total: number;
  current_level: number;
  level_name: string;
  points_to_next_level: number;
}

export default function AchievementsPage() {
  const token = useAuthStore((state) => state.token);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AchievementStats | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");

  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;
      
      try {
        // 获取成就统计
        const statsRes = await fetch("/api/v1/incentive/stats", {
          headers: { "Authorization": `Bearer ${token}` },
        });
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }

        // 获取成就列表
        const achieveRes = await fetch("/api/v1/incentive/achievements", {
          headers: { "Authorization": `Bearer ${token}` },
        });
        if (achieveRes.ok) {
          const achieveData = await achieveRes.json();
          setAchievements(achieveData.achievements || []);
        }
      } catch (err) {
        console.error("加载成就数据失败", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  // 分类
  const categories = [
    { key: "all", name: "全部", icon: "grid_view" },
    { key: "training", name: "训练成就", icon: "fitness_center" },
    { key: "streak", name: "坚持成就", icon: "local_fire_department" },
    { key: "social", name: "社交成就", icon: "group" },
    { key: "milestone", name: "里程碑", icon: "emoji_events" },
  ];

  const filteredAchievements = activeCategory === "all"
    ? achievements
    : achievements.filter(a => a.category === activeCategory);

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="mb-8">
        <Link href="/dashboard" className="text-sm text-text-muted hover:text-blue-500 flex items-center gap-1 mb-4">
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          返回首页
        </Link>
        <h1 className="text-2xl font-bold text-text-primary">成就殿堂</h1>
        <p className="text-text-secondary mt-1">展示你的荣耀时刻</p>
      </div>

      {/* Stats Card */}
      {stats && (
        <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                <span className="text-3xl font-bold text-text-primary">{stats.current_level}</span>
              </div>
              <div>
                <p className="text-amber-400 text-sm font-medium">当前等级</p>
                <h3 className="text-text-primary text-xl font-bold">{stats.level_name}</h3>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-amber-400">{stats.total_points}</p>
              <p className="text-sm text-text-secondary">总积分</p>
            </div>
          </div>
          
          {/* Progress to next level */}
          {stats.points_to_next_level > 0 && (
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-text-secondary">距离下一等级</span>
                <span className="text-amber-400">{stats.points_to_next_level} 积分</span>
              </div>
              <div className="h-2 bg-bg-elevated rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
                  style={{ width: `${Math.min(100, (1 - stats.points_to_next_level / 500) * 100)}%` }}
                />
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-border-dark">
            <div className="text-center">
              <p className="text-2xl font-bold text-text-primary">{unlockedCount}</p>
              <p className="text-sm text-text-secondary">已解锁成就</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-text-primary">{achievements.length}</p>
              <p className="text-sm text-text-secondary">总成就数</p>
            </div>
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex overflow-x-auto gap-2 pb-2 mb-6 scrollbar-hide">
        {categories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              activeCategory === cat.key
                ? "bg-blue-500 text-white"
                : "bg-surface-card text-text-secondary hover:bg-surface-lighter"
            }`}
          >
            <span className="material-symbols-outlined text-lg">{cat.icon}</span>
            {cat.name}
          </button>
        ))}
      </div>

      {/* Achievements Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredAchievements.length > 0 ? (
          filteredAchievements.map((achievement) => (
            <div
              key={achievement.id}
              className={`relative p-4 rounded-xl border transition-all ${
                achievement.unlocked
                  ? "bg-surface-card border-amber-500/30 hover:border-amber-500/50"
                  : "bg-surface-dark border-border-dark opacity-60"
              }`}
            >
              {/* Icon */}
              <div className={`w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-3 ${
                achievement.unlocked
                  ? "bg-gradient-to-br from-amber-400/20 to-orange-500/20"
                  : "bg-bg-elevated"
              }`}>
                <span className={`material-symbols-outlined text-3xl ${
                  achievement.unlocked ? "text-amber-400" : "text-text-muted"
                }`}>
                  {achievement.icon || "emoji_events"}
                </span>
              </div>

              {/* Content */}
              <h4 className={`text-center font-bold mb-1 ${
                achievement.unlocked ? "text-text-primary" : "text-text-muted"
              }`}>
                {achievement.name}
              </h4>
              <p className="text-xs text-text-muted text-center line-clamp-2">
                {achievement.description}
              </p>

              {/* Progress */}
              {!achievement.unlocked && achievement.progress !== undefined && achievement.max_progress && (
                <div className="mt-3">
                  <div className="h-1.5 bg-bg-active rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-500/50 rounded-full"
                      style={{ width: `${(achievement.progress / achievement.max_progress) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-text-muted text-center mt-1">
                    {achievement.progress} / {achievement.max_progress}
                  </p>
                </div>
              )}

              {/* Unlocked Badge */}
              {achievement.unlocked && (
                <div className="absolute top-2 right-2">
                  <span className="material-symbols-outlined text-amber-400 text-sm">verified</span>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <span className="material-symbols-outlined text-4xl text-text-muted mb-2">emoji_events</span>
            <p className="text-text-muted">暂无成就，继续努力！</p>
          </div>
        )}
      </div>
    </div>
  );
}
