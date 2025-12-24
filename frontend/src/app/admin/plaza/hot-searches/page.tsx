"use client";

/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：热门搜索管理页面
 * 作用：管理热门搜索关键词
 * 创建时间：2025-12-24
 * 最后修改：2025-12-24
 */

import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp,
  Plus,
  Trash2,
  Pin,
  X,
  Loader2,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

interface HotSearch {
  id: string;
  keyword: string;
  search_count: number;
  is_pinned: boolean;
  sort_order: number;
  created_at: string;
}

export default function AdminHotSearchesPage() {
  const { token } = useAuthStore();
  const [searches, setSearches] = useState<HotSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [formKeyword, setFormKeyword] = useState("");
  const [formIsPinned, setFormIsPinned] = useState(false);
  const [formSortOrder, setFormSortOrder] = useState(0);

  const fetchSearches = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/plaza-manage/hot-searches?page=1&size=100", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSearches(data.items || []);
      }
    } catch (error) {
      console.error("Failed to fetch hot searches:", error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSearches();
  }, [fetchSearches]);

  const resetForm = () => {
    setFormKeyword("");
    setFormIsPinned(false);
    setFormSortOrder(0);
  };

  const handleCreate = async () => {
    if (!formKeyword) return;

    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/plaza-manage/hot-searches", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          keyword: formKeyword,
          is_pinned: formIsPinned,
          sort_order: formSortOrder,
        }),
      });

      if (res.ok) {
        setShowModal(false);
        resetForm();
        fetchSearches();
      } else {
        const error = await res.json();
        alert(error.detail || "创建失败");
      }
    } catch (error) {
      console.error("Failed to create hot search:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePin = async (search: HotSearch) => {
    try {
      const res = await fetch(`/api/v1/admin/plaza-manage/hot-searches/${search.id}?is_pinned=${!search.is_pinned}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        fetchSearches();
      }
    } catch (error) {
      console.error("Failed to toggle pin:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个热门搜索吗？")) return;

    try {
      const res = await fetch(`/api/v1/admin/plaza-manage/hot-searches/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        fetchSearches();
      }
    } catch (error) {
      console.error("Failed to delete hot search:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">热门搜索管理</h1>
          <p className="text-text-secondary text-sm mt-1">管理热门搜索关键词</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          添加关键词
        </button>
      </div>

      <div className="bg-bg-card border border-border-default rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-default">
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">关键词</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">搜索次数</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">置顶</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">创建时间</th>
              <th className="text-right px-6 py-4 text-sm font-medium text-text-secondary">操作</th>
            </tr>
          </thead>
          <tbody>
            {searches.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-text-muted">
                  暂无热门搜索
                </td>
              </tr>
            ) : (
              searches.map((search) => (
                <tr key={search.id} className="border-b border-border-default/50 hover:bg-bg-elevated/30">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      <span className="text-text-primary font-medium">{search.keyword}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-text-secondary">{search.search_count}</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleTogglePin(search)}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        search.is_pinned
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-bg-elevated text-text-muted hover:text-amber-400"
                      }`}
                    >
                      <Pin className="w-4 h-4" />
                    </button>
                  </td>
                  <td className="px-6 py-4 text-text-secondary">
                    {search.created_at
                      ? new Date(search.created_at).toLocaleDateString("zh-CN")
                      : "-"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDelete(search.id)}
                      className="p-2 hover:bg-bg-elevated rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4 text-text-secondary hover:text-red-400" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-card border border-border-default rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-text-primary">添加热门搜索</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-bg-elevated rounded-lg cursor-pointer">
                <X className="w-5 h-5 text-text-secondary" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">关键词</label>
                <input
                  type="text"
                  value={formKeyword}
                  onChange={(e) => setFormKeyword(e.target.value)}
                  placeholder="如：电话销售"
                  className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isPinned"
                  checked={formIsPinned}
                  onChange={(e) => setFormIsPinned(e.target.checked)}
                  className="w-4 h-4 rounded border-border-default text-violet-600 focus:ring-violet-500"
                />
                <label htmlFor="isPinned" className="text-sm text-text-secondary cursor-pointer">
                  置顶显示
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">排序权重</label>
                <input
                  type="number"
                  value={formSortOrder}
                  onChange={(e) => setFormSortOrder(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 bg-bg-elevated hover:bg-bg-active text-text-primary rounded-xl font-medium transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !formKeyword}
                className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 cursor-pointer"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
