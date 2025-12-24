"use client";

/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：用户管理页面
 * 作用：管理员用户列表、详情、封禁、授予VIP
 * 创建时间：2024-12-24
 * 最后修改：2024-12-24
 */

import { useState, useEffect, useCallback } from "react";
import { getAdminToken } from "@/lib/api/admin";
import {
  Users,
  Search,
  Shield,
  ShieldOff,
  Crown,
  Eye,
  UserX,
  UserCheck,
  X,
  Loader2,
  TrendingUp,
  Calendar,
  Target,
  CreditCard,
  Clock,
} from "lucide-react";

interface User {
  id: string;
  phone: string;
  nickname: string;
  avatar: string | null;
  role: "user" | "admin";
  track: "sales" | "social";
  level: string;
  bio?: string;
  is_active: boolean;
  created_at: string;
  last_login_at?: string;
}

interface UserDetail extends User {
  membership: {
    level_id: string;
    level_name: string | null;
    expires_at: string | null;
    is_active: boolean;
  } | null;
  stats: {
    session_count: number;
    avg_score: number;
    order_count: number;
    total_spent: number;
  };
  recent_sessions: {
    id: string;
    scenario_id: string;
    status: string;
    created_at: string;
  }[];
}

interface UserStats {
  total_users: number;
  active_users: number;
  banned_users: number;
  admin_users: number;
  vip_users: number;
  new_today: number;
  new_week: number;
  new_month: number;
  track_stats: { sales: number; social: number };
}

interface VipLevel {
  id: string;
  name: string;
  price: number;
  duration_days: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [vipLevels, setVipLevels] = useState<VipLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const pageSize = 20;

  // Modal states
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showVipModal, setShowVipModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [loadingDetail, setLoadingDetail] = useState(false);

  // VIP form
  const [vipForm, setVipForm] = useState({
    level_id: "",
    days: 30,
    reason: "",
  });
  const [grantingVip, setGrantingVip] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const token = getAdminToken();
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
      });
      if (search) params.set("search", search);
      if (roleFilter) params.set("role", roleFilter);

      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/admin/users?${params}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.items);
        setTotal(data.total);
      }
    } catch (err) {
      console.error("加载用户列表失败", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const token = getAdminToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/admin/users/statistics`, { headers });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("加载统计数据失败", err);
    }
  }, []);

  const fetchVipLevels = useCallback(async () => {
    try {
      const token = getAdminToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/admin/vip/levels`, { headers });
      if (res.ok) {
        const data = await res.json();
        setVipLevels(data.items || []);
      }
    } catch (err) {
      console.error("加载VIP等级失败", err);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchStats();
    fetchVipLevels();
  }, [fetchUsers, fetchStats, fetchVipLevels]);

  const fetchUserDetail = async (userId: string) => {
    setLoadingDetail(true);
    try {
      const token = getAdminToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/admin/users/${userId}/detail`, { headers });
      if (res.ok) {
        const data = await res.json();
        setSelectedUser(data);
        setShowDetailModal(true);
      }
    } catch (err) {
      console.error("加载用户详情失败", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const token = getAdminToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/admin/users/${userId}/role?role=${newRole}`, {
        method: "PUT",
        headers,
      });
      if (res.ok) {
        fetchUsers();
        fetchStats();
      }
    } catch (err) {
      console.error("更新角色失败", err);
    }
  };

  const handleBan = async (userId: string, isBanned: boolean) => {
    const action = isBanned ? "unban" : "ban";
    const confirmMsg = isBanned ? "确定要解封该用户吗？" : "确定要封禁该用户吗？";
    if (!confirm(confirmMsg)) return;

    try {
      const token = getAdminToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/admin/users/${userId}/${action}`, {
        method: "PUT",
        headers,
      });
      if (res.ok) {
        fetchUsers();
        fetchStats();
      }
    } catch (err) {
      console.error("操作失败", err);
    }
  };

  const openVipModal = (userId: string) => {
    setSelectedUserId(userId);
    setVipForm({ level_id: vipLevels[0]?.id || "", days: 30, reason: "" });
    setShowVipModal(true);
  };

  const handleGrantVip = async () => {
    if (!vipForm.level_id) {
      alert("请选择VIP等级");
      return;
    }
    setGrantingVip(true);
    try {
      const token = getAdminToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/admin/users/${selectedUserId}/grant-vip`, {
        method: "POST",
        headers,
        body: JSON.stringify(vipForm),
      });

      if (res.ok) {
        const data = await res.json();
        alert(data.message);
        setShowVipModal(false);
        fetchUsers();
        fetchStats();
      } else {
        const err = await res.json();
        alert(err.detail || "授予VIP失败");
      }
    } catch (err) {
      console.error("授予VIP失败", err);
      alert("授予VIP失败");
    } finally {
      setGrantingVip(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">用户管理</h1>
          <p className="text-text-secondary text-sm mt-1">共 {total} 位用户</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {[
          { label: "总用户", value: stats?.total_users || 0, icon: Users, color: "violet" },
          { label: "活跃用户", value: stats?.active_users || 0, icon: UserCheck, color: "emerald" },
          { label: "VIP用户", value: stats?.vip_users || 0, icon: Crown, color: "amber" },
          { label: "今日新增", value: stats?.new_today || 0, icon: TrendingUp, color: "blue" },
          { label: "本周新增", value: stats?.new_week || 0, icon: Calendar, color: "cyan" },
          { label: "已封禁", value: stats?.banned_users || 0, icon: UserX, color: "red" },
        ].map((stat) => (
          <div key={stat.label} className="bg-bg-card rounded-xl p-4 border border-border-default">
            <div className="flex items-center justify-between mb-2">
              <span className="text-text-secondary text-xs">{stat.label}</span>
              <stat.icon className={`w-4 h-4 text-${stat.color}-400`} />
            </div>
            <p className="text-xl font-bold text-text-primary">{stat.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-bg-card border border-border-default rounded-2xl p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索手机号或昵称..."
                className="w-full pl-10 pr-4 py-2.5 bg-bg-elevated border border-border-strong rounded-xl text-text-primary placeholder-zinc-500 focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2.5 bg-bg-elevated border border-border-strong rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
          >
            <option value="">全部角色</option>
            <option value="user">普通用户</option>
            <option value="admin">管理员</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2.5 bg-bg-elevated border border-border-strong rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
          >
            <option value="">全部状态</option>
            <option value="active">正常</option>
            <option value="banned">已封禁</option>
          </select>
          <button
            onClick={() => {
              setPage(1);
              fetchUsers();
            }}
            className="px-6 py-2.5 bg-violet-500 hover:bg-violet-600 text-white rounded-xl font-medium transition-colors"
          >
            搜索
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-bg-card border border-border-default rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-default text-left">
                <th className="px-6 py-4 text-sm font-medium text-text-secondary">用户</th>
                <th className="px-6 py-4 text-sm font-medium text-text-secondary">手机号</th>
                <th className="px-6 py-4 text-sm font-medium text-text-secondary">角色</th>
                <th className="px-6 py-4 text-sm font-medium text-text-secondary">赛道</th>
                <th className="px-6 py-4 text-sm font-medium text-text-secondary">等级</th>
                <th className="px-6 py-4 text-sm font-medium text-text-secondary">状态</th>
                <th className="px-6 py-4 text-sm font-medium text-text-secondary">注册时间</th>
                <th className="px-6 py-4 text-sm font-medium text-text-secondary">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-text-muted">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      加载中...
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-text-muted">
                    暂无用户数据
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="border-b border-border-default/50 hover:bg-bg-elevated/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-violet-500/15 flex items-center justify-center overflow-hidden">
                          {user.avatar ? (
                            <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-violet-400 font-medium">{user.nickname[0]}</span>
                          )}
                        </div>
                        <span className="text-text-primary font-medium">{user.nickname}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-text-secondary">{user.phone}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg text-xs ${user.role === "admin" ? "bg-violet-500/15 text-violet-400" : "bg-zinc-500/15 text-text-secondary"}`}>
                        {user.role === "admin" ? "管理员" : "用户"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg text-xs ${user.track === "sales" ? "bg-blue-500/15 text-blue-400" : "bg-emerald-500/15 text-emerald-400"}`}>
                        {user.track === "sales" ? "销售" : "社交"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-text-secondary">{user.level}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg text-xs ${user.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                        {user.is_active ? "正常" : "禁用"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-text-muted text-sm">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : "-"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => fetchUserDetail(user.id)}
                          className="p-2 hover:bg-bg-active rounded-lg transition-colors"
                          title="查看详情"
                        >
                          <Eye className="w-4 h-4 text-text-secondary hover:text-blue-400" />
                        </button>
                        <button
                          onClick={() => openVipModal(user.id)}
                          className="p-2 hover:bg-bg-active rounded-lg transition-colors"
                          title="授予VIP"
                        >
                          <Crown className="w-4 h-4 text-text-secondary hover:text-amber-400" />
                        </button>
                        <button
                          onClick={() => handleRoleChange(user.id, user.role === "admin" ? "user" : "admin")}
                          className="p-2 hover:bg-bg-active rounded-lg transition-colors"
                          title={user.role === "admin" ? "取消管理员" : "设为管理员"}
                        >
                          {user.role === "admin" ? (
                            <ShieldOff className="w-4 h-4 text-violet-400 hover:text-text-secondary" />
                          ) : (
                            <Shield className="w-4 h-4 text-text-secondary hover:text-violet-400" />
                          )}
                        </button>
                        <button
                          onClick={() => handleBan(user.id, !user.is_active)}
                          className="p-2 hover:bg-bg-active rounded-lg transition-colors"
                          title={user.is_active ? "封禁用户" : "解封用户"}
                        >
                          {user.is_active ? (
                            <UserX className="w-4 h-4 text-text-secondary hover:text-red-400" />
                          ) : (
                            <UserCheck className="w-4 h-4 text-red-400 hover:text-emerald-400" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border-default">
            <div className="text-sm text-text-muted">
              第 {page} / {totalPages} 页，共 {total} 条
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 bg-bg-elevated hover:bg-bg-active text-text-secondary rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 bg-bg-elevated hover:bg-bg-active text-text-secondary rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User Detail Modal */}
      {showDetailModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-bg-card border-b border-border-default px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">用户详情</h2>
              <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-bg-active rounded-lg">
                <X className="w-5 h-5 text-text-muted" />
              </button>
            </div>
            <div className="p-6">
              {/* User Info */}
              <div className="flex gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-violet-500/15 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {selectedUser.avatar ? (
                    <img src={selectedUser.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-violet-400 text-2xl font-medium">{selectedUser.nickname[0]}</span>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-text-primary flex items-center gap-2">
                    {selectedUser.nickname}
                    {selectedUser.role === "admin" && (
                      <span className="px-2 py-0.5 rounded text-xs bg-violet-500/15 text-violet-400">管理员</span>
                    )}
                    {!selectedUser.is_active && (
                      <span className="px-2 py-0.5 rounded text-xs bg-red-500/15 text-red-400">已封禁</span>
                    )}
                  </h3>
                  <p className="text-text-secondary">{selectedUser.phone}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-text-muted">
                    <span className={`px-2 py-0.5 rounded text-xs ${selectedUser.track === "sales" ? "bg-blue-500/15 text-blue-400" : "bg-emerald-500/15 text-emerald-400"}`}>
                      {selectedUser.track === "sales" ? "销售赛道" : "社交赛道"}
                    </span>
                    <span>等级: {selectedUser.level}</span>
                  </div>
                </div>
              </div>

              {/* Membership */}
              {selectedUser.membership && (
                <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-xl p-4 mb-6 border border-amber-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Crown className="w-5 h-5 text-amber-400" />
                    <span className="font-medium text-amber-400">{selectedUser.membership.level_name || "VIP会员"}</span>
                  </div>
                  <div className="text-sm text-text-secondary">
                    到期时间: {selectedUser.membership.expires_at ? new Date(selectedUser.membership.expires_at).toLocaleString() : "永久"}
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-bg-elevated rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-text-muted mb-1">
                    <Target className="w-4 h-4" />
                  </div>
                  <div className="text-lg font-semibold text-text-primary">{selectedUser.stats.session_count}</div>
                  <div className="text-xs text-text-muted">训练次数</div>
                </div>
                <div className="bg-bg-elevated rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-text-muted mb-1">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div className="text-lg font-semibold text-text-primary">{selectedUser.stats.avg_score}</div>
                  <div className="text-xs text-text-muted">平均分</div>
                </div>
                <div className="bg-bg-elevated rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-text-muted mb-1">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div className="text-lg font-semibold text-text-primary">{selectedUser.stats.order_count}</div>
                  <div className="text-xs text-text-muted">订单数</div>
                </div>
                <div className="bg-bg-elevated rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-text-muted mb-1">
                    <Crown className="w-4 h-4" />
                  </div>
                  <div className="text-lg font-semibold text-text-primary">{selectedUser.stats.total_spent.toFixed(0)}</div>
                  <div className="text-xs text-text-muted">消费(元)</div>
                </div>
              </div>

              {/* Recent Sessions */}
              {selectedUser.recent_sessions.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-text-secondary mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    最近训练
                  </h4>
                  <div className="space-y-2">
                    {selectedUser.recent_sessions.map((session) => (
                      <div key={session.id} className="bg-bg-elevated rounded-lg px-4 py-2 flex items-center justify-between">
                        <span className="text-text-primary text-sm">{session.scenario_id.slice(0, 8)}...</span>
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-0.5 rounded text-xs ${session.status === "completed" ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-500/15 text-text-muted"}`}>
                            {session.status === "completed" ? "已完成" : session.status}
                          </span>
                          <span className="text-text-muted text-xs">
                            {session.created_at ? new Date(session.created_at).toLocaleDateString() : "-"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Timestamps */}
              <div className="border-t border-border-default pt-4 mt-4 text-sm text-text-muted flex justify-between">
                <span>注册时间: {selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleString() : "-"}</span>
                <span>最后登录: {selectedUser.last_login_at ? new Date(selectedUser.last_login_at).toLocaleString() : "-"}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grant VIP Modal */}
      {showVipModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-card rounded-2xl w-full max-w-md">
            <div className="border-b border-border-default px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400" />
                授予VIP会员
              </h2>
              <button onClick={() => setShowVipModal(false)} className="p-2 hover:bg-bg-active rounded-lg">
                <X className="w-5 h-5 text-text-muted" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">VIP等级</label>
                <select
                  value={vipForm.level_id}
                  onChange={(e) => setVipForm({ ...vipForm, level_id: e.target.value })}
                  className="w-full px-4 py-2.5 bg-bg-elevated border border-border-strong rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                >
                  {vipLevels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.name} - {level.price}元/{level.duration_days}天
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">授予天数</label>
                <input
                  type="number"
                  value={vipForm.days}
                  onChange={(e) => setVipForm({ ...vipForm, days: parseInt(e.target.value) || 0 })}
                  min={1}
                  className="w-full px-4 py-2.5 bg-bg-elevated border border-border-strong rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">备注原因（可选）</label>
                <input
                  type="text"
                  value={vipForm.reason}
                  onChange={(e) => setVipForm({ ...vipForm, reason: e.target.value })}
                  placeholder="如：活动赠送、补偿等"
                  className="w-full px-4 py-2.5 bg-bg-elevated border border-border-strong rounded-xl text-text-primary placeholder-zinc-500 focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>
            <div className="border-t border-border-default px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowVipModal(false)}
                className="px-4 py-2 bg-bg-elevated border border-border-strong rounded-xl text-text-secondary hover:bg-bg-active"
              >
                取消
              </button>
              <button
                onClick={handleGrantVip}
                disabled={grantingVip || !vipForm.level_id}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {grantingVip ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
                授予VIP
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
