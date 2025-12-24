"use client";

/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：标签管理页面
 * 作用：管理场景标签
 * 创建时间：2025-12-24
 * 最后修改：2025-12-24
 */

import { useState, useEffect, useCallback } from "react";
import {
  Tag,
  Search,
  Plus,
  Edit2,
  Trash2,
  Flame,
  X,
  Loader2,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

interface TagItem {
  id: string;
  name: string;
  category: string;
  usage_count: number;
  is_hot: boolean;
  created_at: string;
}

const categoryLabels: Record<string, string> = {
  industry: "行业",
  skill: "技能",
  difficulty: "难度",
  other: "其他",
};

const categoryColors: Record<string, string> = {
  industry: "bg-blue-500/20 text-blue-400",
  skill: "bg-emerald-500/20 text-emerald-400",
  difficulty: "bg-amber-500/20 text-amber-400",
  other: "bg-purple-500/20 text-purple-400",
};

export default function AdminTagsPage() {
  const { token } = useAuthStore();
  const [tags, setTags] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");

  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("other");
  const [formIsHot, setFormIsHot] = useState(false);

  const fetchTags = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: "1", size: "100" });
      if (categoryFilter) params.append("category", categoryFilter);

      const res = await fetch(`/api/v1/admin/plaza-manage/tags?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTags(data.items || []);
      }
    } catch (error) {
      console.error("Failed to fetch tags:", error);
    } finally {
      setLoading(false);
    }
  }, [token, categoryFilter]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const resetForm = () => {
    setFormName("");
    setFormCategory("other");
    setFormIsHot(false);
  };

  const handleCreate = async () => {
    if (!formName) return;

    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/plaza-manage/tags", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formName,
          category: formCategory,
          is_hot: formIsHot,
        }),
      });

      if (res.ok) {
        setShowModal(false);
        resetForm();
        fetchTags();
      } else {
        const error = await res.json();
        alert(error.detail || "创建失败");
      }
    } catch (error) {
      console.error("Failed to create tag:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleHot = async (tag: TagItem) => {
    try {
      const res = await fetch(`/api/v1/admin/plaza-manage/tags/${tag.id}?is_hot=${!tag.is_hot}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        fetchTags();
      }
    } catch (error) {
      console.error("Failed to toggle hot:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个标签吗？")) return;

    try {
      const res = await fetch(`/api/v1/admin/plaza-manage/tags/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        fetchTags();
      }
    } catch (error) {
      console.error("Failed to delete tag:", error);
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
          <h1 className="text-2xl font-bold text-text-primary">标签管理</h1>
          <p className="text-text-secondary text-sm mt-1">管理场景标签分类</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          添加标签
        </button>
      </div>

      <div className="flex items-center gap-4">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2.5 bg-bg-card border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500 cursor-pointer"
        >
          <option value="">全部分类</option>
          <option value="industry">行业</option>
          <option value="skill">技能</option>
          <option value="difficulty">难度</option>
          <option value="other">其他</option>
        </select>
      </div>

      <div className="bg-bg-card border border-border-default rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-default">
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">标签</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">分类</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">使用次数</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">热门</th>
              <th className="text-right px-6 py-4 text-sm font-medium text-text-secondary">操作</th>
            </tr>
          </thead>
          <tbody>
            {tags.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-text-muted">
                  暂无标签
                </td>
              </tr>
            ) : (
              tags.map((tag) => (
                <tr key={tag.id} className="border-b border-border-default/50 hover:bg-bg-elevated/30">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-text-muted" />
                      <span className="text-text-primary font-medium">{tag.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-lg ${categoryColors[tag.category] || categoryColors.other}`}>
                      {categoryLabels[tag.category] || tag.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-text-secondary">{tag.usage_count}</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleHot(tag)}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        tag.is_hot
                          ? "bg-orange-500/20 text-orange-400"
                          : "bg-bg-elevated text-text-muted hover:text-orange-400"
                      }`}
                    >
                      <Flame className="w-4 h-4" />
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDelete(tag.id)}
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
              <h2 className="text-xl font-bold text-text-primary">添加标签</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-bg-elevated rounded-lg cursor-pointer">
                <X className="w-5 h-5 text-text-secondary" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">标签名称</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="如：房产销售"
                  className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">分类</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500 cursor-pointer"
                >
                  <option value="industry">行业</option>
                  <option value="skill">技能</option>
                  <option value="difficulty">难度</option>
                  <option value="other">其他</option>
                </select>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isHot"
                  checked={formIsHot}
                  onChange={(e) => setFormIsHot(e.target.checked)}
                  className="w-4 h-4 rounded border-border-default text-violet-600 focus:ring-violet-500"
                />
                <label htmlFor="isHot" className="text-sm text-text-secondary cursor-pointer">
                  设为热门标签
                </label>
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
                disabled={saving || !formName}
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
