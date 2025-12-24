"use client";

/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：专题管理页面
 * 作用：管理官方专题和用户合集
 * 创建时间：2025-12-24
 * 最后修改：2025-12-24
 */

import { useState, useEffect, useCallback } from "react";
import {
  BookOpen,
  Search,
  Plus,
  Edit2,
  Trash2,
  Crown,
  Folder,
  X,
  Loader2,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

interface Collection {
  id: string;
  title: string;
  description: string | null;
  cover_image: string | null;
  is_official: boolean;
  is_public: boolean;
  scenario_count: number;
  sort_order: number;
  created_at: string;
}

export default function AdminCollectionsPage() {
  const { token } = useAuthStore();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCoverImage, setFormCoverImage] = useState("");
  const [formSortOrder, setFormSortOrder] = useState(0);

  const fetchCollections = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/plaza-manage/collections?is_official=true&page=1&size=50", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCollections(data.items || []);
      }
    } catch (error) {
      console.error("Failed to fetch collections:", error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  const resetForm = () => {
    setFormTitle("");
    setFormDescription("");
    setFormCoverImage("");
    setFormSortOrder(0);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!formTitle) return;

    setSaving(true);
    try {
      const url = editingId
        ? `/api/v1/admin/plaza-manage/collections/${editingId}`
        : "/api/v1/admin/plaza-manage/collections";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: formTitle,
          description: formDescription || null,
          cover_image: formCoverImage || null,
          sort_order: formSortOrder,
          is_official: true,
        }),
      });

      if (res.ok) {
        setShowModal(false);
        resetForm();
        fetchCollections();
      }
    } catch (error) {
      console.error("Failed to save collection:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (collection: Collection) => {
    setEditingId(collection.id);
    setFormTitle(collection.title);
    setFormDescription(collection.description || "");
    setFormCoverImage(collection.cover_image || "");
    setFormSortOrder(collection.sort_order);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个专题吗？")) return;

    try {
      const res = await fetch(`/api/v1/admin/plaza-manage/collections/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        fetchCollections();
      }
    } catch (error) {
      console.error("Failed to delete collection:", error);
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
          <h1 className="text-2xl font-bold text-text-primary">专题管理</h1>
          <p className="text-text-secondary text-sm mt-1">管理官方精选专题</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          创建专题
        </button>
      </div>

      <div className="bg-bg-card border border-border-default rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-default">
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">专题</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">场景数</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">排序</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">创建时间</th>
              <th className="text-right px-6 py-4 text-sm font-medium text-text-secondary">操作</th>
            </tr>
          </thead>
          <tbody>
            {collections.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-text-muted">
                  暂无专题
                </td>
              </tr>
            ) : (
              collections.map((collection) => (
                <tr key={collection.id} className="border-b border-border-default/50 hover:bg-bg-elevated/30">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 flex items-center justify-center">
                        {collection.is_official ? (
                          <Crown className="w-5 h-5 text-amber-400" />
                        ) : (
                          <Folder className="w-5 h-5 text-primary" />
                        )}
                      </div>
                      <div>
                        <p className="text-text-primary font-medium">{collection.title}</p>
                        <p className="text-sm text-text-muted line-clamp-1">
                          {collection.description || "暂无描述"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-text-secondary">{collection.scenario_count}</td>
                  <td className="px-6 py-4 text-text-secondary">{collection.sort_order}</td>
                  <td className="px-6 py-4 text-text-secondary">
                    {collection.created_at
                      ? new Date(collection.created_at).toLocaleDateString("zh-CN")
                      : "-"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleEdit(collection)}
                        className="p-2 hover:bg-bg-elevated rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4 text-text-secondary" />
                      </button>
                      <button
                        onClick={() => handleDelete(collection.id)}
                        className="p-2 hover:bg-bg-elevated rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4 text-text-secondary hover:text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-card border border-border-default rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-text-primary">
                {editingId ? "编辑专题" : "创建专题"}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-bg-elevated rounded-lg cursor-pointer">
                <X className="w-5 h-5 text-text-secondary" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">专题标题</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="如：新手入门必练"
                  className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">专题描述</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="专题简介..."
                  rows={3}
                  className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">封面图片URL</label>
                <input
                  type="text"
                  value={formCoverImage}
                  onChange={(e) => setFormCoverImage(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500"
                />
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
                onClick={handleSave}
                disabled={saving || !formTitle}
                className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 cursor-pointer"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {editingId ? "保存" : "创建"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
