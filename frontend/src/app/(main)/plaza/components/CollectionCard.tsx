"use client";

/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：专题/合集卡片组件
 * 作用：展示官方专题和用户合集
 * 创建时间：2025-12-24
 * 最后修改：2025-12-24
 */

import { useState, useEffect } from "react";
import { Folder, Crown, ChevronRight, Loader2, BookOpen } from "lucide-react";
import { plazaExtApi, CollectionItem } from "@/lib/api";

interface CollectionCardProps {
  onCollectionClick?: (collectionId: string) => void;
}

export default function CollectionCard({ onCollectionClick }: CollectionCardProps) {
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCollections = async () => {
      try {
        const result = await plazaExtApi.getOfficialCollections(4);
        setCollections(result.items);
      } catch (error) {
        console.error("Failed to fetch collections:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCollections();
  }, []);

  if (loading) {
    return (
      <div className="bg-surface-card border border-border-dark rounded-xl p-4">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (collections.length === 0) {
    return null;
  }

  return (
    <div className="bg-surface-card border border-border-dark rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-text-primary">精选专题</span>
        </div>
      </div>

      <div className="space-y-2">
        {collections.map((collection) => (
          <button
            key={collection.id}
            onClick={() => onCollectionClick?.(collection.id)}
            className="w-full flex items-center gap-3 p-3 bg-surface-lighter hover:bg-surface-hover rounded-xl transition-colors text-left group"
          >
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
              {collection.is_official ? (
                <Crown className="w-5 h-5 text-amber-400" />
              ) : (
                <Folder className="w-5 h-5 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate group-hover:text-primary transition-colors">
                {collection.title}
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                {collection.scenario_count} 个场景
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-primary transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
}
