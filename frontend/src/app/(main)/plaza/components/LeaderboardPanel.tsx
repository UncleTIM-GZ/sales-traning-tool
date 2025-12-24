"use client";

/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：排行榜面板组件
 * 作用：展示场景、创作者、用户排行榜
 * 创建时间：2025-12-24
 * 最后修改：2025-12-24
 */

import { useState, useEffect } from "react";
import { Trophy, Crown, Medal, Users, Flame, Star, Loader2 } from "lucide-react";
import {
  plazaExtApi,
  LeaderboardScenarioItem,
  LeaderboardCreatorItem,
  LeaderboardUserItem,
} from "@/lib/api";

type TabType = "scenarios" | "creators" | "users";

interface LeaderboardPanelProps {
  onScenarioClick?: (scenarioId: string) => void;
  onCreatorClick?: (creatorId: string) => void;
}

export default function LeaderboardPanel({
  onScenarioClick,
  onCreatorClick,
}: LeaderboardPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>("scenarios");
  const [loading, setLoading] = useState(true);
  const [scenarios, setScenarios] = useState<LeaderboardScenarioItem[]>([]);
  const [creators, setCreators] = useState<LeaderboardCreatorItem[]>([]);
  const [users, setUsers] = useState<LeaderboardUserItem[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (activeTab === "scenarios") {
          const result = await plazaExtApi.getScenarioLeaderboard("hot", undefined, 10);
          setScenarios(result.items);
        } else if (activeTab === "creators") {
          const result = await plazaExtApi.getCreatorLeaderboard("popular", 10);
          setCreators(result.items);
        } else {
          const result = await plazaExtApi.getUserLeaderboard("points", 10);
          setUsers(result.items);
        }
      } catch (error) {
        console.error("Failed to fetch leaderboard:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [activeTab]);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-4 h-4 text-amber-400" />;
    if (rank === 2) return <Medal className="w-4 h-4 text-text-muted" />;
    if (rank === 3) return <Medal className="w-4 h-4 text-amber-600" />;
    return <span className="text-xs text-text-muted w-4 text-center">{rank}</span>;
  };

  return (
    <div className="bg-surface-card border border-border-dark rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 p-4 border-b border-border-dark">
        <Trophy className="w-5 h-5 text-amber-400" />
        <span className="font-medium text-text-primary">排行榜</span>
      </div>

      <div className="flex border-b border-border-dark">
        {[
          { id: "scenarios", label: "热门场景", icon: Flame },
          { id: "creators", label: "创作者", icon: Star },
          { id: "users", label: "积分榜", icon: Users },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? "text-primary border-b-2 border-primary bg-primary/5"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-2">
            {activeTab === "scenarios" &&
              scenarios.map((item) => (
                <button
                  key={item.scenario_id}
                  onClick={() => onScenarioClick?.(item.scenario_id)}
                  className="w-full flex items-center gap-3 p-2 hover:bg-surface-lighter rounded-lg transition-colors text-left"
                >
                  <div className="w-6 flex justify-center">{getRankIcon(item.rank)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary truncate">{item.name}</p>
                    <p className="text-xs text-text-muted">
                      {item.train_count} 次训练
                    </p>
                  </div>
                  <div className="text-xs text-amber-400 flex items-center gap-1">
                    <Flame className="w-3 h-3" />
                    {Math.round(item.hot_score)}
                  </div>
                </button>
              ))}

            {activeTab === "creators" &&
              creators.map((item) => (
                <button
                  key={item.creator_id}
                  onClick={() => onCreatorClick?.(item.creator_id)}
                  className="w-full flex items-center gap-3 p-2 hover:bg-surface-lighter rounded-lg transition-colors text-left"
                >
                  <div className="w-6 flex justify-center">{getRankIcon(item.rank)}</div>
                  <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
                    <span className="text-xs font-medium text-primary">
                      {item.nickname.slice(0, 1)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary truncate">{item.nickname}</p>
                    <p className="text-xs text-text-muted">{item.level}</p>
                  </div>
                  <div className="text-xs text-text-muted">
                    {item.followers_count} 粉丝
                  </div>
                </button>
              ))}

            {activeTab === "users" &&
              users.map((item) => (
                <div
                  key={item.user_id}
                  className="flex items-center gap-3 p-2 hover:bg-surface-lighter rounded-lg transition-colors"
                >
                  <div className="w-6 flex justify-center">{getRankIcon(item.rank)}</div>
                  <div className="w-8 h-8 rounded-full bg-purple-500/15 flex items-center justify-center">
                    <span className="text-xs font-medium text-purple-400">
                      {item.nickname.slice(0, 1)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary truncate">{item.nickname}</p>
                    <p className="text-xs text-text-muted">{item.level}</p>
                  </div>
                  <div className="text-xs text-primary font-medium">
                    {item.total_points} 分
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
