"use client";

/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：搜索建议下拉组件
 * 作用：展示搜索建议、热门搜索、搜索历史
 * 创建时间：2025-12-24
 * 最后修改：2025-12-24
 */

import { useState, useEffect, useRef } from "react";
import { Search, Clock, TrendingUp, Loader2 } from "lucide-react";
import { plazaExtApi } from "@/lib/api";

interface SearchSuggestionsProps {
  query: string;
  isOpen: boolean;
  onSelect: (keyword: string) => void;
  onClose: () => void;
}

export default function SearchSuggestions({
  query,
  isOpen,
  onSelect,
  onClose,
}: SearchSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [hotSearches, setHotSearches] = useState<{ keyword: string; count: number }[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [hotResult, historyResult] = await Promise.all([
          plazaExtApi.getHotSearches(8),
          plazaExtApi.getSearchHistory(5),
        ]);
        setHotSearches(hotResult.items);
        setHistory(historyResult.items);
      } catch (error) {
        console.error("Failed to fetch search data:", error);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (query.length > 0) {
      setLoading(true);
      const timer = setTimeout(async () => {
        try {
          const result = await plazaExtApi.getSearchSuggestions(query, 8);
          setSuggestions(result.items);
        } catch (error) {
          console.error("Failed to fetch suggestions:", error);
        } finally {
          setLoading(false);
        }
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setSuggestions([]);
    }
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const handleClearHistory = async () => {
    try {
      await plazaExtApi.clearSearchHistory();
      setHistory([]);
    } catch (error) {
      console.error("Failed to clear history:", error);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="absolute top-full left-0 right-0 mt-2 bg-surface-card border border-border-dark rounded-xl shadow-xl z-50 overflow-hidden"
    >
      {query.length > 0 ? (
        <div className="p-2">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : suggestions.length > 0 ? (
            <div className="space-y-1">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => onSelect(suggestion)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-surface-lighter rounded-lg transition-colors text-left"
                >
                  <Search className="w-4 h-4 text-text-muted" />
                  <span className="text-text-primary">{suggestion}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="py-4 text-center text-text-muted text-sm">
              未找到相关建议
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {history.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm text-text-muted">
                  <Clock className="w-4 h-4" />
                  <span>搜索历史</span>
                </div>
                <button
                  onClick={handleClearHistory}
                  className="text-xs text-text-muted hover:text-primary transition-colors"
                >
                  清空
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {history.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => onSelect(item)}
                    className="px-3 py-1.5 bg-surface-lighter hover:bg-surface-hover rounded-lg text-sm text-text-secondary transition-colors"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}

          {hotSearches.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-sm text-text-muted mb-2">
                <TrendingUp className="w-4 h-4" />
                <span>热门搜索</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {hotSearches.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => onSelect(item.keyword)}
                    className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 rounded-lg text-sm text-primary transition-colors"
                  >
                    {item.keyword}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
