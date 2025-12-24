"use client";

/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：热门标签云组件
 * 作用：展示热门标签，支持点击筛选
 * 创建时间：2025-12-24
 * 最后修改：2025-12-24
 */

import { useState, useEffect } from "react";
import { Tag, TrendingUp, Loader2 } from "lucide-react";
import { plazaExtApi, TagItem } from "@/lib/api";

interface TagCloudProps {
  onTagClick?: (tag: string) => void;
  selectedTag?: string;
}

export default function TagCloud({ onTagClick, selectedTag }: TagCloudProps) {
  const [tags, setTags] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const result = await plazaExtApi.getHotTags(20);
        setTags(result.items);
      } catch (error) {
        console.error("Failed to fetch tags:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTags();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  if (tags.length === 0) {
    return null;
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      industry: "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20",
      skill: "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20",
      difficulty: "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20",
      other: "bg-purple-500/10 text-purple-400 hover:bg-purple-500/20",
    };
    return colors[category] || colors.other;
  };

  return (
    <div className="bg-surface-card border border-border-dark rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-text-primary">热门标签</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <button
            key={tag.id}
            onClick={() => onTagClick?.(tag.name)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedTag === tag.name
                ? "bg-primary text-white"
                : getCategoryColor(tag.category)
            }`}
          >
            <Tag className="w-3 h-3 inline mr-1" />
            {tag.name}
            {tag.is_hot && (
              <span className="ml-1 text-[10px] opacity-70">HOT</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
