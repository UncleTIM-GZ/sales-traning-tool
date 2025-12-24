"use client";

/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：创作者卡片组件
 * 作用：展示创作者信息，支持关注/取消关注
 * 创建时间：2025-12-24
 * 最后修改：2025-12-24
 */

import { useState } from "react";
import { Award, Users, Play, Heart, Loader2, UserPlus, UserMinus } from "lucide-react";
import { plazaExtApi, CreatorProfileDetail } from "@/lib/api";

interface CreatorCardProps {
  creator: CreatorProfileDetail;
  onFollowChange?: (isFollowing: boolean) => void;
  onViewProfile?: () => void;
}

export default function CreatorCard({
  creator,
  onFollowChange,
  onViewProfile,
}: CreatorCardProps) {
  const [isFollowing, setIsFollowing] = useState(creator.is_following);
  const [followersCount, setFollowersCount] = useState(creator.followers_count);
  const [loading, setLoading] = useState(false);

  const handleFollowToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;

    setLoading(true);
    try {
      if (isFollowing) {
        await plazaExtApi.unfollowCreator(creator.id);
        setIsFollowing(false);
        setFollowersCount((prev) => Math.max(0, prev - 1));
      } else {
        await plazaExtApi.followCreator(creator.id);
        setIsFollowing(true);
        setFollowersCount((prev) => prev + 1);
      }
      onFollowChange?.(!isFollowing);
    } catch (error) {
      console.error("Failed to toggle follow:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onViewProfile}
      className="bg-surface-card border border-border-dark rounded-xl p-4 hover:border-primary/50 transition-all cursor-pointer group"
    >
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center flex-shrink-0 ring-2 ring-surface-card">
          {creator.avatar ? (
            <img
              src={creator.avatar}
              alt={creator.nickname}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <span className="text-lg font-bold text-primary">
              {creator.nickname.slice(0, 1)}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-text-primary truncate group-hover:text-primary transition-colors">
              {creator.nickname}
            </h3>
            {creator.is_verified && (
              <Award className="w-4 h-4 text-amber-400 flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-text-muted mt-0.5">{creator.level}</p>
          {creator.bio && (
            <p className="text-sm text-text-secondary mt-2 line-clamp-2">
              {creator.bio}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border-dark">
        <div className="flex items-center gap-4 text-xs text-text-muted">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {followersCount} 粉丝
          </span>
          <span className="flex items-center gap-1">
            <Play className="w-3.5 h-3.5" />
            {creator.total_trains} 训练
          </span>
          <span className="flex items-center gap-1">
            <Heart className="w-3.5 h-3.5" />
            {creator.total_likes} 赞
          </span>
        </div>

        <button
          onClick={handleFollowToggle}
          disabled={loading}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            isFollowing
              ? "bg-surface-lighter text-text-secondary hover:bg-rose-500/10 hover:text-rose-400"
              : "bg-primary text-white hover:bg-primary/90"
          }`}
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : isFollowing ? (
            <>
              <UserMinus className="w-3.5 h-3.5" />
              已关注
            </>
          ) : (
            <>
              <UserPlus className="w-3.5 h-3.5" />
              关注
            </>
          )}
        </button>
      </div>
    </div>
  );
}
