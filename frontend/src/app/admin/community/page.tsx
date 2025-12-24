"use client";

/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：社区管理页面
 * 作用：管理社区帖子、评论，支持置顶、隐藏、删除等操作
 * 创建时间：2025-12-24
 * 最后修改：2025-12-24
 */

import { useState, useEffect, useCallback } from "react";
import {
  MessageSquare,
  Pin,
  PinOff,
  Eye,
  EyeOff,
  Trash2,
  Heart,
  MessageCircle,
  Loader2,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
} from "lucide-react";
import { getAdminToken } from "@/lib/api/admin";

interface PostUser {
  id: string;
  nickname: string;
  avatar: string | null;
}

interface Post {
  id: string;
  content: string;
  images: string[];
  likes_count: number;
  comments_count: number;
  is_pinned: boolean;
  is_deleted: boolean;
  created_at: string;
  user: PostUser;
}

interface PostStats {
  total: number;
  today_count: number;
  pinned_count: number;
  total_comments: number;
  total_likes: number;
}

interface Comment {
  id: string;
  content: string;
  post_id: string;
  post_content: string;
  user: PostUser;
  created_at: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export default function CommunityManagementPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState<PostStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [activeTab, setActiveTab] = useState<"posts" | "comments">("posts");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // 评论相关状态
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsPage, setCommentsPage] = useState(1);
  const [commentsTotal, setCommentsTotal] = useState(0);
  const [commentsTotalPages, setCommentsTotalPages] = useState(0);

  const pageSize = 20;

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const token = getAdminToken();
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
      });
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);

      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/admin/posts?${params}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setPosts(data.items || []);
        setTotal(data.total || 0);
        setTotalPages(data.total_pages || 0);
      }
    } catch (err) {
      console.error("加载帖子列表失败", err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  const fetchStats = useCallback(async () => {
    try {
      const token = getAdminToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/admin/posts/statistics`, { headers });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("加载统计失败", err);
    }
  }, []);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const token = getAdminToken();
      const params = new URLSearchParams({
        page: commentsPage.toString(),
        page_size: pageSize.toString(),
      });

      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/admin/comments?${params}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setComments(data.items || []);
        setCommentsTotal(data.total || 0);
        setCommentsTotalPages(data.total_pages || 0);
      }
    } catch (err) {
      console.error("加载评论列表失败", err);
    } finally {
      setLoading(false);
    }
  }, [commentsPage]);

  useEffect(() => {
    if (activeTab === "posts") {
      fetchPosts();
      fetchStats();
    } else {
      fetchComments();
    }
  }, [activeTab, fetchPosts, fetchStats, fetchComments]);

  const handleAction = async (postId: string, action: "pin" | "unpin" | "hide" | "show" | "delete") => {
    if (action === "delete" && !confirm("确定要永久删除这条帖子吗？此操作不可恢复。")) return;

    setActionLoading(postId);
    try {
      const token = getAdminToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const method = action === "delete" ? "DELETE" : "PUT";
      const res = await fetch(`${API_BASE}/admin/posts/${postId}/${action === "delete" ? "" : action}`, {
        method,
        headers,
      });

      if (res.ok) {
        fetchPosts();
        fetchStats();
        if (selectedPost?.id === postId) setSelectedPost(null);
      } else {
        const error = await res.json();
        alert(error.detail || "操作失败");
      }
    } catch (err) {
      console.error("操作失败", err);
      alert("操作失败");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("确定要删除这条评论吗？")) return;

    setActionLoading(commentId);
    try {
      const token = getAdminToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/admin/comments/${commentId}`, {
        method: "DELETE",
        headers,
      });

      if (res.ok) {
        fetchComments();
        fetchStats();
      } else {
        const error = await res.json();
        alert(error.detail || "删除失败");
      }
    } catch (err) {
      console.error("删除失败", err);
      alert("删除失败");
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statsCards = [
    { label: "总帖子数", value: stats?.total || 0, icon: MessageSquare, color: "text-violet-400", bg: "bg-violet-500/10" },
    { label: "今日新增", value: stats?.today_count || 0, icon: MessageSquare, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "置顶帖子", value: stats?.pinned_count || 0, icon: Pin, color: "text-amber-400", bg: "bg-amber-500/10" },
    { label: "总评论数", value: stats?.total_comments || 0, icon: MessageCircle, color: "text-blue-400", bg: "bg-blue-500/10" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">社区管理</h1>
        <p className="text-text-secondary text-sm mt-1">管理社区帖子和评论</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat, idx) => (
          <div key={idx} className="bg-bg-card border border-border-default rounded-xl p-5">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-text-primary">{stat.value.toLocaleString()}</p>
                <p className="text-sm text-text-secondary">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs & Filters */}
      <div className="bg-bg-card border border-border-default rounded-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-border-default px-4">
          <div className="flex">
            <button
              onClick={() => setActiveTab("posts")}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
                activeTab === "posts"
                  ? "text-violet-400 border-violet-400"
                  : "text-text-muted border-transparent hover:text-text-primary"
              }`}
            >
              帖子管理
            </button>
            <button
              onClick={() => setActiveTab("comments")}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
                activeTab === "comments"
                  ? "text-violet-400 border-violet-400"
                  : "text-text-muted border-transparent hover:text-text-primary"
              }`}
            >
              评论管理
            </button>
          </div>

          {activeTab === "posts" && (
            <div className="flex items-center gap-3 py-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="搜索内容..."
                  className="pl-9 pr-4 py-2 bg-bg-elevated border border-border-default rounded-lg text-text-primary text-sm focus:outline-none focus:border-violet-500 w-48"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 bg-bg-elevated border border-border-default rounded-lg text-text-primary text-sm focus:outline-none focus:border-violet-500"
              >
                <option value="">全部状态</option>
                <option value="pinned">已置顶</option>
                <option value="hidden">已隐藏</option>
              </select>
            </div>
          )}
        </div>

        {/* Content */}
        {activeTab === "posts" ? (
          <div className="divide-y divide-border-default">
            {loading ? (
              <div className="p-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-violet-500 mx-auto" />
              </div>
            ) : posts.length === 0 ? (
              <div className="p-12 text-center text-text-muted">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>暂无帖子数据</p>
              </div>
            ) : (
              posts.map((post) => (
                <div key={post.id} className={`p-4 hover:bg-bg-elevated/30 transition-colors ${post.is_deleted ? "opacity-50" : ""}`}>
                  <div className="flex gap-4">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-violet-500/15 flex items-center justify-center flex-shrink-0">
                      {post.user?.avatar ? (
                        <img src={post.user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <span className="text-violet-400 font-medium">{post.user?.nickname?.[0] || "?"}</span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-text-primary font-medium">{post.user?.nickname || "未知用户"}</span>
                        {post.is_pinned && (
                          <span className="px-1.5 py-0.5 rounded text-xs bg-amber-500/15 text-amber-400 flex items-center gap-1">
                            <Pin className="w-3 h-3" /> 置顶
                          </span>
                        )}
                        {post.is_deleted && (
                          <span className="px-1.5 py-0.5 rounded text-xs bg-red-500/15 text-red-400 flex items-center gap-1">
                            <EyeOff className="w-3 h-3" /> 已隐藏
                          </span>
                        )}
                        <span className="text-text-muted text-sm">{formatDate(post.created_at)}</span>
                      </div>
                      <p className="text-text-primary line-clamp-2 mb-2">{post.content}</p>
                      {post.images && post.images.length > 0 && (
                        <div className="flex gap-2 mb-2">
                          {post.images.slice(0, 3).map((url, i) => (
                            <img key={i} src={url} alt="" className="w-16 h-16 rounded-lg object-cover" />
                          ))}
                          {post.images.length > 3 && (
                            <div className="w-16 h-16 rounded-lg bg-bg-elevated flex items-center justify-center text-text-secondary">
                              <ImageIcon className="w-5 h-5 mr-1" />+{post.images.length - 3}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-sm text-text-muted">
                        <span className="flex items-center gap-1">
                          <Heart className="w-4 h-4" /> {post.likes_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-4 h-4" /> {post.comments_count}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-start gap-1">
                      {post.is_pinned ? (
                        <button
                          onClick={() => handleAction(post.id, "unpin")}
                          disabled={actionLoading === post.id}
                          className="p-2 hover:bg-bg-active rounded-lg transition-colors cursor-pointer"
                          title="取消置顶"
                        >
                          {actionLoading === post.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-text-muted" />
                          ) : (
                            <PinOff className="w-4 h-4 text-amber-400" />
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAction(post.id, "pin")}
                          disabled={actionLoading === post.id}
                          className="p-2 hover:bg-bg-active rounded-lg transition-colors cursor-pointer"
                          title="置顶"
                        >
                          {actionLoading === post.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-text-muted" />
                          ) : (
                            <Pin className="w-4 h-4 text-text-secondary hover:text-amber-400" />
                          )}
                        </button>
                      )}
                      {post.is_deleted ? (
                        <button
                          onClick={() => handleAction(post.id, "show")}
                          disabled={actionLoading === post.id}
                          className="p-2 hover:bg-bg-active rounded-lg transition-colors cursor-pointer"
                          title="恢复显示"
                        >
                          <Eye className="w-4 h-4 text-text-secondary hover:text-emerald-400" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAction(post.id, "hide")}
                          disabled={actionLoading === post.id}
                          className="p-2 hover:bg-bg-active rounded-lg transition-colors cursor-pointer"
                          title="隐藏"
                        >
                          <EyeOff className="w-4 h-4 text-text-secondary hover:text-amber-400" />
                        </button>
                      )}
                      <button
                        onClick={() => handleAction(post.id, "delete")}
                        disabled={actionLoading === post.id}
                        className="p-2 hover:bg-bg-active rounded-lg transition-colors cursor-pointer"
                        title="永久删除"
                      >
                        <Trash2 className="w-4 h-4 text-text-secondary hover:text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="divide-y divide-border-default">
            {loading ? (
              <div className="p-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-violet-500 mx-auto" />
              </div>
            ) : comments.length === 0 ? (
              <div className="p-12 text-center text-text-muted">
                <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>暂无评论数据</p>
              </div>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="p-4 hover:bg-bg-elevated/30 transition-colors">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-violet-500/15 flex items-center justify-center flex-shrink-0">
                      {comment.user?.avatar ? (
                        <img src={comment.user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <span className="text-violet-400 font-medium">{comment.user?.nickname?.[0] || "?"}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-text-primary font-medium">{comment.user?.nickname || "未知用户"}</span>
                        <span className="text-text-muted text-sm">{formatDate(comment.created_at)}</span>
                      </div>
                      <p className="text-text-primary mb-2">{comment.content}</p>
                      <p className="text-text-muted text-sm">
                        回复帖子: {comment.post_content}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteComment(comment.id)}
                      disabled={actionLoading === comment.id}
                      className="p-2 hover:bg-bg-active rounded-lg transition-colors cursor-pointer h-fit"
                      title="删除评论"
                    >
                      {actionLoading === comment.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-text-muted" />
                      ) : (
                        <Trash2 className="w-4 h-4 text-text-secondary hover:text-red-400" />
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Pagination */}
        {((activeTab === "posts" && totalPages > 1) || (activeTab === "comments" && commentsTotalPages > 1)) && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border-default">
            <div className="text-sm text-text-muted">
              第 {activeTab === "posts" ? page : commentsPage} / {activeTab === "posts" ? totalPages : commentsTotalPages} 页，
              共 {activeTab === "posts" ? total : commentsTotal} 条
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => activeTab === "posts" ? setPage(Math.max(1, page - 1)) : setCommentsPage(Math.max(1, commentsPage - 1))}
                disabled={(activeTab === "posts" ? page : commentsPage) === 1}
                className="flex items-center gap-1 px-3 py-1.5 bg-bg-elevated hover:bg-bg-active text-text-primary rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" /> 上一页
              </button>
              <button
                onClick={() => activeTab === "posts" ? setPage(Math.min(totalPages, page + 1)) : setCommentsPage(Math.min(commentsTotalPages, commentsPage + 1))}
                disabled={(activeTab === "posts" ? page : commentsPage) === (activeTab === "posts" ? totalPages : commentsTotalPages)}
                className="flex items-center gap-1 px-3 py-1.5 bg-bg-elevated hover:bg-bg-active text-text-primary rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                下一页 <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
