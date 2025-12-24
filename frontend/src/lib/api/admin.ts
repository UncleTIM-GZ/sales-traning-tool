/**
 * 管理后台 API
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;

  const stored = localStorage.getItem("auth-storage");
  if (stored) {
    try {
      const data = JSON.parse(stored);
      const token = data.state?.token || null;
      if (token) return token;
    } catch {
      // ignore
    }
  }

  return localStorage.getItem("access_token") || localStorage.getItem("token");
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = getAdminToken();

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "请求失败" }));
    throw new Error(error.detail || "请求失败");
  }

  return response.json();
}

// ============ 仪表盘统计 ============

export interface DashboardStats {
  total_users: number;
  new_users_today: number;
  active_users: number;
  total_sessions: number;
  sessions_today: number;
  avg_score: number;
  total_scenarios: number;
  total_courses: number;
  total_posts: number;
  total_reports: number;
}

export interface UserGrowthData {
  date: string;
  new: number;
  total: number;
}

export interface SessionTrendData {
  date: string;
  sessions: number;
  avgScore: number;
}

export interface ScenarioDistribution {
  name: string;
  value: number;
  color: string;
}

export const adminApi = {
  // 获取仪表盘统计
  getDashboardStats: (): Promise<DashboardStats> => 
    request<DashboardStats>("/admin/dashboard/stats"),

  // 获取用户增长趋势
  getUserGrowth: (days: number = 7): Promise<UserGrowthData[]> =>
    request<UserGrowthData[]>(`/admin/statistics/user-growth?days=${days}`),

  // 获取训练完成趋势
  getSessionTrend: (days: number = 7): Promise<SessionTrendData[]> =>
    request<SessionTrendData[]>(`/admin/statistics/session-trend?days=${days}`),

  // 获取场景分布
  getScenarioDistribution: (): Promise<ScenarioDistribution[]> =>
    request<ScenarioDistribution[]>("/admin/statistics/scenario-distribution"),

  // ============ 用户管理 ============

  // 获取用户列表
  getUsers: (params: {
    page?: number;
    page_size?: number;
    search?: string;
    role?: string;
  }) =>
    request(`/admin/users?${new URLSearchParams(params as any).toString()}`),

  // 更新用户角色
  updateUserRole: (userId: string, role: string) =>
    request(`/admin/users/${userId}/role?role=${role}`, { method: "PUT" }),

  // 更新用户状态
  updateUserStatus: (userId: string, isActive: boolean) =>
    request(`/admin/users/${userId}/status?is_active=${isActive}`, {
      method: "PUT",
    }),

  // ============ 系统配置 ============

  // 获取短信配置
  getSmsConfig: () => request("/admin/settings/sms"),

  // 更新短信配置
  updateSmsConfig: (data: any) =>
    request("/admin/settings/sms", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // 获取登录配置
  getLoginConfig: () => request("/admin/settings/login"),

  // 更新登录配置
  updateLoginConfig: (data: any) =>
    request("/admin/settings/login", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
