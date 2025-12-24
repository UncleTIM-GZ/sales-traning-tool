/**
 * API 客户端配置
 */

const API_BASE_URL = "/api/v1";

// 获取存储的 token
function getToken(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const authStorage = localStorage.getItem("auth-storage");
    if (authStorage) {
      const parsed = JSON.parse(authStorage);
      return parsed.state?.token || null;
    }
  } catch {
    return null;
  }
  return null;
}

// 判断是否应该强制登出
function shouldForceLogout(endpoint: string): boolean {
  // 只有核心认证端点失败才强制登出
  const authEndpoints = [
    '/auth/login',
    '/auth/register',
    '/auth/me',
    '/auth/refresh',
    '/users/me'  // 获取当前用户信息失败
  ];
  return authEndpoints.some(ep => endpoint.includes(ep));
}

// 全局 401 处理:仅在核心认证端点失败时清除 token
function handleUnauthorized(endpoint: string) {
  if (typeof window === "undefined") return;

  // 只有核心认证端点失败才清除并跳转
  if (shouldForceLogout(endpoint)) {
    console.warn(`[Auth] Logout triggered by 401 on ${endpoint}`);

    // 清除存储的认证信息
    localStorage.removeItem("auth-storage");

    // 避免重复跳转
    if (!window.location.pathname.includes("/login")) {
      window.location.href = "/login?expired=1";
    }
  } else {
    // 其他端点401只记录日志,不强制登出
    console.warn(`[Auth] 401 on ${endpoint}, but not forcing logout`);
  }
}

// 通用请求函数
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    // 401 未授权:智能判断是否跳转登录页
    if (response.status === 401) {
      handleUnauthorized(endpoint);  // 只在核心认证端点失败时才强制登出

      const error = await response.json().catch(() => ({ detail: "认证失败" }));
      throw new Error(error.detail || "认证失败,请检查登录状态");
    }
    const error = await response.json().catch(() => ({ detail: "请求失败" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  // 204 No Content
  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}

// ===== SSE 流式请求 =====
export interface SSEEvent {
  type: "npc_response" | "coach_tip" | "finish" | "error" | "done";
  content?: string;
  finish_reason?: string;
}

/**
 * SSE 流式请求函数
 */
async function streamRequest(
  endpoint: string,
  body: Record<string, unknown>,
  onMessage: (event: SSEEvent) => void,
): Promise<void> {
  const token = getToken();

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    // 401 未授权:智能判断是否跳转登录页  
    if (response.status === 401) {
      handleUnauthorized(endpoint);  // 只在核心认证端点失败时才强制登出
      throw new Error("认证失败,请检查登录状态");
    }
    const error = await response.json().catch(() => ({ detail: "请求失败" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("无法读取响应流");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // 解析 SSE 事件
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          onMessage(data as SSEEvent);

          // 如果是 done 事件，结束
          if (data.type === "done") {
            return;
          }
        } catch {
          // 忽略解析错误
        }
      }
    }
  }
}

// ===== 用户类型 =====
export interface User {
  id: string;
  phone: string;
  nickname: string;
  avatar?: string;
  track: "sales" | "social";
  role: "user" | "admin";
  level: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface RegisterRequest {
  phone: string;
  password: string;
  nickname: string;
  track?: "sales" | "social";
}

export interface LoginRequest {
  phone: string;
  password: string;
}

export interface SendCodeRequest {
  phone: string;
  purpose: "register" | "reset_password" | "login";
}

export interface SendCodeResponse {
  message: string;
  code?: string; // 开发环境返回
}

export interface VerifyCodeRequest {
  phone: string;
  code: string;
}

export interface ResetPasswordRequest {
  phone: string;
  code: string;
  new_password: string;
}

// ===== 认证 API =====
export const authApi = {
  /**
   * 用户注册
   */
  register: (data: RegisterRequest): Promise<AuthResponse> => {
    return request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * 用户登录 - 不使用通用 request，避免 401 被误判为 token 过期
   */
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await fetch(`/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "登录失败" }));
      throw new Error(error.detail || "用户名或密码错误");
    }

    return response.json();
  },

  /**
   * 获取当前用户信息
   */
  getCurrentUser: (): Promise<User> => {
    return request<User>("/auth/me");
  },

  /**
   * 发送验证码
   */
  sendCode: (data: SendCodeRequest): Promise<SendCodeResponse> => {
    return request<SendCodeResponse>("/auth/send-code", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * 验证验证码
   */
  verifyCode: (data: VerifyCodeRequest): Promise<{ message: string; verified: boolean }> => {
    return request<{ message: string; verified: boolean }>("/auth/verify-code", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * 重置密码
   */
  resetPassword: (data: ResetPasswordRequest): Promise<{ message: string }> => {
    return request<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * 刷新 Token
   */
  refreshToken: (): Promise<{ access_token: string; token_type: string }> => {
    return request<{ access_token: string; token_type: string }>("/auth/refresh", {
      method: "POST",
    });
  },

  /**
   * 登出
   */
  logout: (): Promise<void> => {
    return request<void>("/auth/logout", {
      method: "POST",
    });
  },
};

// ===== 微信登录 API =====
export interface WechatLoginUrlResponse {
  authorize_url: string;
  state: string;
}

export interface WechatConfigResponse {
  wechat_enabled: boolean;
  wechat_mp_enabled: boolean;
}

export const wechatAuthApi = {
  /**
   * 获取微信登录配置状态
   */
  getConfig: (): Promise<WechatConfigResponse> => {
    return request<WechatConfigResponse>("/auth/wechat/config");
  },

  /**
   * 获取微信登录授权 URL
   * @param redirectUrl 登录成功后的跳转地址
   * @param useMp 是否使用公众号授权（微信内使用）
   */
  getLoginUrl: (redirectUrl?: string, useMp: boolean = false): Promise<WechatLoginUrlResponse> => {
    const params = new URLSearchParams();
    if (redirectUrl) params.append("redirect_url", redirectUrl);
    if (useMp) params.append("use_mp", "true");
    return request<WechatLoginUrlResponse>(`/auth/wechat/login-url?${params.toString()}`);
  },

  /**
   * 通过微信授权码登录
   */
  loginByCode: (code: string, state: string): Promise<AuthResponse> => {
    return request<AuthResponse>("/auth/wechat/login", {
      method: "POST",
      body: JSON.stringify({ code, state }),
    });
  },

  /**
   * 获取微信绑定授权 URL
   * @param userId 当前用户ID
   * @param redirectUrl 绑定成功后的跳转地址
   * @param useMp 是否使用公众号授权
   */
  getBindUrl: (userId: string, redirectUrl?: string, useMp: boolean = false): Promise<WechatLoginUrlResponse> => {
    const params = new URLSearchParams({ user_id: userId });
    if (redirectUrl) params.append("redirect_url", redirectUrl);
    if (useMp) params.append("use_mp", "true");
    return request<WechatLoginUrlResponse>(`/auth/wechat/bind-url?${params.toString()}`);
  },
};

export default authApi;

// ===== 场景类型 =====
export interface Scenario {
  id: string;
  name: string;
  track: "sales" | "social";
  mode: string;
  difficulty: number;
  description: string;
  config: {
    channel?: string;
    persona?: string;
    time_limit_sec?: number;
    tags?: string[];
    image?: string;
    rating?: number;
    practice_count?: number;
    ai_name?: string;
    ai_personality?: string;
    ai_attitude?: string;
    ai_pain_points?: string[];
    ai_objectives?: string[];
    background?: string;
    user_role?: string;
    objective?: string;
    success_criteria?: string[];
  };
  status: string;
  is_custom?: boolean;
  created_by?: string;
  created_at?: string;
}

export interface ScenarioListResponse {
  items: Scenario[];
  total: number;
  page: number;
  size: number;
}

// 用户创建自定义场景请求
export interface CreateCustomScenarioRequest {
  name: string;
  track: "sales" | "social";
  difficulty?: number;
  description?: string;
  channel?: string;
  tags?: string[];
  visibility?: "private" | "public";
  ai_name: string;
  ai_identity: string;
  ai_personality?: string;
  ai_attitude?: "friendly" | "neutral" | "skeptical" | "tough";
  ai_pain_points?: string[];
  ai_objectives?: string[];
  background: string;
  user_role?: string;
  objective: string;
  success_criteria?: string[];
}

// ===== 报告类型 =====
export interface ReportListItem {
  id: string;
  session_id: string;
  scenario_name: string;
  total_score: number;
  mode: string;
  created_at: string;
}

export interface ReportListResponse {
  items: ReportListItem[];
  total: number;
  page: number;
  size: number;
}

export interface ReportDetail {
  id: string;
  session_id: string;
  user_id: string;
  rubric_version: string;
  total_score: number;
  dimensions: Array<{
    name: string;
    key?: string;
    weight?: number;
    score: number;
    max_score: number;
    description?: string;
    evidence?: Array<{ turn: number; text: string }>;
  }>;
  highlights: Array<{ title?: string; content?: string; why?: string; example?: string; turn_id?: number; dimension?: string }>;
  issues: Array<{ title?: string; content?: string; why?: string; fix?: string; turn_id?: number; dimension?: string; severity?: string; original_text?: string; better_version?: string }>;
  replacements: Array<{ original: string; better: string; suggestion?: string; turn_id?: number }>;
  next_actions?: {
    recommended_scenarios?: Array<{ name: string; reason: string; priority?: number } | string>;
    real_world_task?: string;
  };
  // 商业化新增字段
  evidence_sentences?: Array<{
    turn_id: number;
    speaker: 'user' | 'npc';
    original_text: string;
    is_highlight?: boolean;
    issue?: string;
    dimension?: string;
    impact?: number;
    better_version?: string;
  }>;
  rewrite_suggestions?: Array<{
    turn_id: number;
    original: string;
    improved: string;
    reason: string;
    dimension?: string;
  }>;
  training_prescription?: {
    weak_dimensions?: string[];
    recommended_scenarios?: Array<{ scenario_type: string; reason: string; priority?: number }>;
    practice_tips?: string[];
    real_world_task?: string;
  };
  conversation_scores?: Array<{
    turn_id: number;
    speaker: 'user' | 'npc';
    content: string;
    score?: number | null;
    feedback?: string;
  }>;
  comparison_data?: {
    previous_report_id?: string;
    score_change?: number;
    dimension_changes?: Record<string, number>;
  };
  metadata?: Record<string, unknown>;
  created_at: string;
}

// ===== 仪表盘类型 =====
export interface DashboardStats {
  user_id: string;
  current_score: number;
  total_sessions: number;
  week_duration_hours: number;
  streak_days: number;
  score_trend: Array<{ date: string; score: number }>;
  ability_dimensions: Array<{ ability: string; value: number; fullMark: number }>;
  rank_percentile: number;
}

export interface TrainingPlanItem {
  id: number;
  title: string;
  time: string;
  type: string;
  status: string;
}

// ===== 用户画像类型 =====
export interface UserProfile {
  id: string;
  user_id: string;
  baseline_score: number | null;
  weak_dimensions: string[];
  preferences: Record<string, unknown>;
  onboarding_completed: boolean;
}

// ===== 用户 API =====
export const userApi = {
  /**
   * 获取当前用户信息
   */
  getMe: (): Promise<User> => {
    return request<User>("/users/me");
  },

  /**
   * 更新用户信息
   */
  updateMe: (data: Partial<{ nickname: string; avatar: string; track: string }>): Promise<User> => {
    return request<User>("/users/me", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  /**
   * 获取用户画像
   */
  getProfile: (): Promise<UserProfile> => {
    return request<UserProfile>("/users/me/profile");
  },

  /**
   * 更新用户画像
   */
  updateProfile: (preferences: Record<string, unknown>): Promise<UserProfile> => {
    return request<UserProfile>("/users/me/profile", {
      method: "PUT",
      body: JSON.stringify({ preferences }),
    });
  },
};

// ===== 场景 API =====
export const scenarioApi = {
  /**
   * 获取场景列表
   */
  list: (params?: {
    track?: string;
    difficulty?: number;
    channel?: string;
    scope?: "all" | "mine" | "official" | "public";
    include_custom?: boolean;
    page?: number;
    size?: number;
  }): Promise<ScenarioListResponse> => {
    const query = new URLSearchParams();
    if (params?.track) query.set("track", params.track);
    if (params?.difficulty) query.set("difficulty", String(params.difficulty));
    if (params?.channel) query.set("channel", params.channel);
    if (params?.scope) query.set("scope", params.scope);
    if (params?.include_custom !== undefined) query.set("include_custom", String(params.include_custom));
    if (params?.page) query.set("page", String(params.page));
    if (params?.size) query.set("size", String(params.size));

    const queryString = query.toString();
    return request<ScenarioListResponse>(`/scenarios${queryString ? `?${queryString}` : ""}`);
  },

  /**
   * 获取场景详情
   */
  get: (id: string): Promise<Scenario> => {
    return request<Scenario>(`/scenarios/${id}`);
  },

  /**
   * 创建自定义场景
   */
  createCustom: (data: CreateCustomScenarioRequest): Promise<Scenario> => {
    return request<Scenario>("/scenarios/custom", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};

// ===== 报告 API =====
export const reportApi = {
  /**
   * 获取报告列表
   */
  list: (params?: { page?: number; size?: number }): Promise<ReportListResponse> => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.size) query.set("size", String(params.size));

    const queryString = query.toString();
    return request<ReportListResponse>(`/reports${queryString ? `?${queryString}` : ""}`);
  },

  /**
   * 获取报告详情
   */
  get: (id: string): Promise<ReportDetail> => {
    return request<ReportDetail>(`/reports/${id}`);
  },
};

// ===== 会话类型 =====
export interface Session {
  id: string;
  user_id: string;
  scenario_id: string;
  mode: "train" | "exam" | "replay";
  seed?: number;
  status: "pending" | "active" | "completed" | "aborted";
  started_at?: string;
  ended_at?: string;
}

export interface SessionListResponse {
  items: Session[];
  total: number;
  page: number;
  size: number;
}

export interface SessionTurn {
  turn_number: number;
  role: "user" | "npc" | "coach";
  content: string;
  created_at: string;
}

export interface SessionHistoryResponse {
  session_id: string;
  turns: SessionTurn[];
}

export interface CreateSessionRequest {
  scenario_id: string;
  mode: "train" | "exam" | "replay";
  seed?: number;
}

// ===== 会话API =====
export const sessionApi = {
  /**
   * 创建会话
   */
  create: (data: CreateSessionRequest): Promise<Session> => {
    return request<Session>("/sessions", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * 获取会话列表
   */
  list: (params?: {
    status?: string;
    page?: number;
    size?: number;
  }): Promise<SessionListResponse> => {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.page) query.set("page", String(params.page));
    if (params?.size) query.set("size", String(params.size));

    const queryString = query.toString();
    return request<SessionListResponse>(`/sessions${queryString ? `?${queryString}` : ""}`);
  },

  /**
   * 获取会话详情
   */
  get: (id: string): Promise<Session> => {
    return request<Session>(`/sessions/${id}`);
  },

  /**
   * 开始会话 (获取NPC开场白) - SSE流式
   */
  start: (id: string, onMessage: (event: SSEEvent) => void): Promise<void> => {
    return streamRequest(`/sessions/${id}/start`, {}, onMessage);
  },

  /**
   * 发送消息 - SSE流式响应
   */
  sendMessage: (
    sessionId: string,
    content: string,
    onMessage: (event: SSEEvent) => void,
  ): Promise<void> => {
    return streamRequest(
      `/sessions/${sessionId}/message`,
      { content },
      onMessage,
    );
  },

  /**
   * 结束会话
   */
  end: (id: string): Promise<Session> => {
    return request<Session>(`/sessions/${id}/end`, {
      method: "POST",
    });
  },

  /**
   * 获取对话历史
   */
  getHistory: (id: string): Promise<SessionHistoryResponse> => {
    return request<SessionHistoryResponse>(`/sessions/${id}/history`);
  },
};

// ===== 仪表盘 API =====
export const dashboardApi = {
  /**
   * 获取统计数据
   */
  getStats: (): Promise<DashboardStats> => {
    return request<DashboardStats>("/dashboard/stats");
  },

  /**
   * 获取今日训练计划
   */
  getTrainingPlan: (): Promise<{ items: TrainingPlanItem[] }> => {
    return request<{ items: TrainingPlanItem[] }>("/dashboard/training-plan");
  },
};

// ===== 课程类型 =====
export interface Instructor {
  id: string;
  name: string;
  title?: string;
  avatar?: string;
}

export interface LessonItem {
  id: string;
  title: string;
  type: "video" | "article" | "quiz" | "practice";
  duration_minutes: number;
  order: number;
  is_free: boolean;
  is_completed: boolean;
}

export interface ChapterItem {
  id: string;
  title: string;
  description?: string;
  order: number;
  lessons: LessonItem[];
}

export interface CourseListItem {
  id: string;
  title: string;
  description: string;
  category: "sales" | "social" | "advanced";
  level: "beginner" | "intermediate" | "advanced";
  duration_minutes: number;
  cover_image?: string;
  is_pro: boolean;
  is_new: boolean;
  rating: number;
  enrolled_count: number;
  instructor?: Instructor;
  progress: number;
}

export interface CourseDetail extends CourseListItem {
  full_description?: string;
  objectives: string[];
  requirements: string[];
  chapters: ChapterItem[];
  is_enrolled: boolean;
}

export interface CourseListResponse {
  items: CourseListItem[];
  total: number;
  page: number;
  size: number;
}

export interface LessonContent {
  id: string;
  title: string;
  type: string;
  duration_minutes: number;
  content_url?: string;
  content_text?: string;
  quiz_data?: Record<string, unknown>;
  is_completed: boolean;
  next_lesson_id?: string;
  prev_lesson_id?: string;
}

// ===== 课程 API =====
export const courseApi = {
  /**
   * 获取课程列表
   */
  list: (params?: {
    category?: string;
    level?: string;
    page?: number;
    size?: number;
  }): Promise<CourseListResponse> => {
    const query = new URLSearchParams();
    if (params?.category) query.set("category", params.category);
    if (params?.level) query.set("level", params.level);
    if (params?.page) query.set("page", String(params.page));
    if (params?.size) query.set("size", String(params.size));

    const queryString = query.toString();
    return request<CourseListResponse>(`/courses${queryString ? `?${queryString}` : ""}`);
  },

  /**
   * 获取课程详情
   */
  get: (id: string): Promise<CourseDetail> => {
    return request<CourseDetail>(`/courses/${id}`);
  },

  /**
   * 报名课程
   */
  enroll: (id: string): Promise<{ message: string; enrollment_id: string }> => {
    return request<{ message: string; enrollment_id: string }>(`/courses/${id}/enroll`, {
      method: "POST",
    });
  },

  /**
   * 获取学习进度
   */
  getProgress: (id: string): Promise<{
    is_enrolled: boolean;
    progress: number;
    last_lesson_id?: string;
    completed_lessons: string[];
    completed_at?: string;
  }> => {
    return request(`/courses/${id}/progress`);
  },

  /**
   * 获取课时内容
   */
  getLesson: (lessonId: string): Promise<LessonContent> => {
    return request<LessonContent>(`/courses/lessons/${lessonId}`);
  },

  /**
   * 标记课时完成
   */
  completeLesson: (lessonId: string): Promise<{ message: string; progress: number }> => {
    return request<{ message: string; progress: number }>(`/courses/lessons/${lessonId}/complete`, {
      method: "POST",
    });
  },
};

// ===== 社区类型 =====
export interface PostAuthor {
  id: string;
  nickname: string;
  avatar?: string;
  level: string;
}

export interface PostItem {
  id: string;
  content: string;
  images: string[];
  likes_count: number;
  comments_count: number;
  is_pinned: boolean;
  created_at: string;
  author: PostAuthor;
  is_liked: boolean;
}

export interface PostListResponse {
  items: PostItem[];
  total: number;
  page: number;
  size: number;
}

export interface CommentItem {
  id: string;
  content: string;
  created_at: string;
  author: PostAuthor;
  parent_id?: string;
}

export interface LeaderboardUser {
  rank: number;
  user_id: string;
  nickname: string;
  avatar?: string;
  level: string;
  score: number;
  rank_change: number;
}

export interface LeaderboardResponse {
  items: LeaderboardUser[];
  my_rank?: LeaderboardUser;
  period: string;
}

export interface ChallengeItem {
  id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  reward: string;
  participant_count: number;
  is_joined: boolean;
  progress?: Record<string, unknown>;
}

export interface ChallengeListResponse {
  items: ChallengeItem[];
}

// ===== 社区 API =====
export const communityApi = {
  /**
   * 获取动态列表
   */
  listPosts: (params?: { page?: number; size?: number }): Promise<PostListResponse> => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.size) query.set("size", String(params.size));

    const queryString = query.toString();
    return request<PostListResponse>(`/community/posts${queryString ? `?${queryString}` : ""}`);
  },

  /**
   * 发布动态
   */
  createPost: (data: { content: string; images?: string[] }): Promise<PostItem> => {
    return request<PostItem>("/community/posts", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * 删除动态
   */
  deletePost: (id: string): Promise<{ message: string }> => {
    return request<{ message: string }>(`/community/posts/${id}`, {
      method: "DELETE",
    });
  },

  /**
   * 点赞动态
   */
  likePost: (id: string): Promise<{ message: string; likes_count: number }> => {
    return request<{ message: string; likes_count: number }>(`/community/posts/${id}/like`, {
      method: "POST",
    });
  },

  /**
   * 取消点赞
   */
  unlikePost: (id: string): Promise<{ message: string; likes_count: number }> => {
    return request<{ message: string; likes_count: number }>(`/community/posts/${id}/like`, {
      method: "DELETE",
    });
  },

  /**
   * 获取评论
   */
  getComments: (postId: string): Promise<CommentItem[]> => {
    return request<CommentItem[]>(`/community/posts/${postId}/comments`);
  },

  /**
   * 发表评论
   */
  createComment: (postId: string, data: { content: string; parent_id?: string }): Promise<CommentItem> => {
    return request<CommentItem>(`/community/posts/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * 获取排行榜
   */
  getLeaderboard: (period?: "weekly" | "monthly" | "all_time"): Promise<LeaderboardResponse> => {
    const query = period ? `?period=${period}` : "";
    return request<LeaderboardResponse>(`/community/leaderboard${query}`);
  },

  /**获取挑战赛列表
   */
  listChallenges: (): Promise<ChallengeListResponse> => {
    return request<ChallengeListResponse>("/community/challenges");
  },

  /**
   * 参加挑战
   */
  joinChallenge: (id: string): Promise<{ message: string }> => {
    return request<{ message: string }>(`/community/challenges/${id}/join`, {
      method: "POST",
    });
  },

  /**
   * 获取挑战进度
   */
  getChallengeProgress: (id: string): Promise<{
    challenge_id: string;
    progress: Record<string, unknown>;
    score: number;
    completed_at?: string;
  }> => {
    return request(`/community/challenges/${id}/progress`);
  },
};

// ===== 设置类型 =====
export interface NotificationSettings {
  training: boolean;
  report: boolean;
  community: boolean;
  marketing: boolean;
}

export interface PrivacySettings {
  show_profile: boolean;
  show_rank: boolean;
  show_activity: boolean;
}

export interface UserSettingsResponse {
  bio?: string;
  notifications: NotificationSettings;
  privacy: PrivacySettings;
}

// ===== 设置 API =====
export const settingsApi = {
  /**
   * 获取设置
   */
  get: (): Promise<UserSettingsResponse> => {
    return request<UserSettingsResponse>("/settings");
  },

  /**
   * 更新设置
   */
  update: (data: {
    bio?: string;
    notifications?: NotificationSettings;
    privacy?: PrivacySettings;
  }): Promise<UserSettingsResponse> => {
    return request<UserSettingsResponse>("/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  /**
   * 修改密码
   */
  changePassword: (data: {
    current_password: string;
    new_password: string;
  }): Promise<{ message: string }> => {
    return request<{ message: string }>("/settings/password", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  /**
   * 切换赛道
   */
  changeTrack: (track: "sales" | "social"): Promise<{ message: string; track: string }> => {
    return request<{ message: string; track: string }>("/settings/track", {
      method: "PUT",
      body: JSON.stringify({ track }),
    });
  },

  /**
   * 更新个人资料
   */
  updateProfile: (data: {
    nickname?: string;
    avatar?: string;
    bio?: string;
  }): Promise<{ message: string; nickname: string; avatar?: string }> => {
    return request<{ message: string; nickname: string; avatar?: string }>("/settings/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
};

// ===== 通知偏好 API =====
export interface NotificationPreference {
  achievement_enabled: boolean;
  task_reminder_enabled: boolean;
  session_complete_enabled: boolean;
  community_enabled: boolean;
  system_enabled: boolean;
  daily_reminder_enabled: boolean;
  daily_reminder_time: string | null;
}

export const notificationApi = {
  /**
   * 获取未读数
   */
  getUnreadCount: (): Promise<{ count: number }> => {
    return request<{ count: number }>("/notifications/unread-count");
  },

  /**
   * 获取通知偏好设置
   */
  getPreferences: (): Promise<NotificationPreference> => {
    return request<NotificationPreference>("/notifications/preferences");
  },

  /**
   * 更新通知偏好设置
   */
  updatePreferences: (data: Partial<NotificationPreference>): Promise<NotificationPreference> => {
    return request<NotificationPreference>("/notifications/preferences", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
};

// ===== 广场 API =====
export interface CreatorBrief {
  id: string;
  user_id: string;
  nickname: string;
  avatar: string | null;
  level: string;
  is_verified: boolean;
  scenario_count: number;
  followers_count: number;
}

export interface PublicScenario {
  id: string;
  name: string;
  description: string | null;
  cover_image: string | null;
  track: string;
  difficulty: number;
  tags: string[];
  creator: CreatorBrief | null;
  train_count: number;
  likes_count: number;
  comments_count: number;
  fork_count: number;
  avg_score: number;
  is_liked: boolean;
  is_collected: boolean;
  is_forked: boolean;
  is_official: boolean;
  is_featured: boolean;
  created_at: string;
  published_at: string | null;
}

export interface PlazaScenarioListResponse {
  items: PublicScenario[];
  total: number;
  page: number;
  size: number;
}

export interface ScenarioComment {
  id: string;
  user_id: string;
  nickname: string;
  avatar: string | null;
  content: string;
  likes_count: number;
  created_at: string;
  replies: ScenarioComment[];
}

export const plazaApi = {
  /**
   * 获取热门场景
   */
  getHotScenarios: (params?: {
    track?: string;
    difficulty?: number;
    page?: number;
    size?: number;
  }): Promise<PlazaScenarioListResponse> => {
    const query = new URLSearchParams();
    if (params?.track) query.set("track", params.track);
    if (params?.difficulty) query.set("difficulty", String(params.difficulty));
    if (params?.page) query.set("page", String(params.page));
    if (params?.size) query.set("size", String(params.size));
    return request<PlazaScenarioListResponse>(`/plaza/hot?${query}`);
  },

  /**
   * 获取推荐场景
   */
  getRecommendedScenarios: (params?: {
    page?: number;
    size?: number;
  }): Promise<PlazaScenarioListResponse> => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.size) query.set("size", String(params.size));
    return request<PlazaScenarioListResponse>(`/plaza/recommended?${query}`);
  },

  /**
   * 搜索场景
   */
  searchScenarios: (params: {
    q: string;
    track?: string;
    difficulty?: number;
    sort?: "hot" | "new" | "score";
    page?: number;
    size?: number;
  }): Promise<PlazaScenarioListResponse> => {
    const query = new URLSearchParams();
    query.set("q", params.q);
    if (params.track) query.set("track", params.track);
    if (params.difficulty) query.set("difficulty", String(params.difficulty));
    if (params.sort) query.set("sort", params.sort);
    if (params.page) query.set("page", String(params.page));
    if (params.size) query.set("size", String(params.size));
    return request<PlazaScenarioListResponse>(`/plaza/search?${query}`);
  },

  /**
   * 点赞场景
   */
  likeScenario: (scenarioId: string): Promise<{ success: boolean; likes_count: number }> => {
    return request<{ success: boolean; likes_count: number }>(`/plaza/scenarios/${scenarioId}/like`, {
      method: "POST",
    });
  },

  /**
   * 取消点赞
   */
  unlikeScenario: (scenarioId: string): Promise<{ success: boolean }> => {
    return request<{ success: boolean }>(`/plaza/scenarios/${scenarioId}/like`, {
      method: "DELETE",
    });
  },

  /**
   * 收藏场景
   */
  collectScenario: (scenarioId: string, folder?: string): Promise<{ success: boolean }> => {
    const query = folder ? `?folder=${encodeURIComponent(folder)}` : "";
    return request<{ success: boolean }>(`/plaza/scenarios/${scenarioId}/collect${query}`, {
      method: "POST",
    });
  },

  /**
   * 取消收藏
   */
  uncollectScenario: (scenarioId: string): Promise<{ success: boolean }> => {
    return request<{ success: boolean }>(`/plaza/scenarios/${scenarioId}/collect`, {
      method: "DELETE",
    });
  },

  /**
   * Fork场景
   */
  forkScenario: (scenarioId: string): Promise<{ success: boolean; scenario_id: string }> => {
    return request<{ success: boolean; scenario_id: string }>(`/plaza/scenarios/${scenarioId}/fork`, {
      method: "POST",
    });
  },

  /**
   * 获取场景评论
   */
  getComments: (scenarioId: string, params?: {
    page?: number;
    size?: number;
  }): Promise<{ items: ScenarioComment[]; total: number }> => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.size) query.set("size", String(params.size));
    return request<{ items: ScenarioComment[]; total: number }>(`/plaza/scenarios/${scenarioId}/comments?${query}`);
  },

  /**
   * 发表评论
   */
  createComment: (scenarioId: string, content: string, parentId?: string): Promise<{
    success: boolean;
    comment_id: string;
    comments_count: number;
  }> => {
    return request<{ success: boolean; comment_id: string; comments_count: number }>(
      `/plaza/scenarios/${scenarioId}/comments`,
      {
        method: "POST",
        body: JSON.stringify({ content, parent_id: parentId }),
      }
    );
  },

  /**
   * 发布场景到广场
   */
  publishScenario: (scenarioId: string, visibility: "public" | "circle" = "public", shareToFeed: boolean = true): Promise<{
    success: boolean;
    message: string;
  }> => {
    return request<{ success: boolean; message: string }>(`/plaza/scenarios/${scenarioId}/publish`, {
      method: "POST",
      body: JSON.stringify({ visibility, share_to_feed: shareToFeed }),
    });
  },

  /**
   * 快速创建场景
   */
  quickCreate: (data: {
    name: string;
    description: string;
    track?: "sales" | "social";
    difficulty?: number;
  }): Promise<{ success: boolean; scenario_id: string }> => {
    return request<{ success: boolean; scenario_id: string }>("/plaza/scenarios/quick-create", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};

// ===== 安全设置类型 =====
export interface LoginHistoryItem {
  id: string;
  ip_address: string | null;
  device_type: string | null;
  device_name: string | null;
  browser: string | null;
  os: string | null;
  location: string | null;
  login_type: string;
  is_success: boolean;
  created_at: string;
}

export interface LoginHistoryResponse {
  items: LoginHistoryItem[];
  total: number;
}

export interface TwoFactorStatus {
  is_enabled: boolean;
  method: string | null;
  phone: string | null;
}

export interface AccountBinding {
  id: string;
  binding_type: "wechat" | "enterprise_wechat" | "email";
  external_name: string | null;
  is_verified: boolean;
  created_at: string;
}

// ===== 安全设置 API =====
export const securityApi = {
  /**
   * 获取登录历史记录
   */
  getLoginHistory: (limit: number = 20): Promise<LoginHistoryResponse> => {
    return request<LoginHistoryResponse>(`/security/login-history?limit=${limit}`);
  },

  /**
   * 获取两步验证状态
   */
  getTwoFactorStatus: (): Promise<TwoFactorStatus> => {
    return request<TwoFactorStatus>("/security/two-factor");
  },

  /**
   * 开启两步验证
   */
  enableTwoFactor: (method: "sms" | "email" | "totp", verificationCode: string): Promise<{
    message: string;
    backup_codes: string[];
  }> => {
    return request<{ message: string; backup_codes: string[] }>("/security/two-factor/enable", {
      method: "POST",
      body: JSON.stringify({ method, verification_code: verificationCode }),
    });
  },

  /**
   * 关闭两步验证
   */
  disableTwoFactor: (password: string): Promise<{ message: string }> => {
    return request<{ message: string }>("/security/two-factor/disable", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
  },

  /**
   * 获取账号绑定列表
   */
  getBindings: (): Promise<{ bindings: AccountBinding[] }> => {
    return request<{ bindings: AccountBinding[] }>("/security/bindings");
  },

  /**
   * 绑定邮箱
   */
  bindEmail: (email: string, verificationCode: string): Promise<{ message: string }> => {
    return request<{ message: string }>("/security/bindings/email", {
      method: "POST",
      body: JSON.stringify({ email, verification_code: verificationCode }),
    });
  },

  /**
   * 绑定微信 - 获取授权URL
   */
  bindWechat: (): Promise<{ message: string; auth_url: string; qrcode_url: string | null }> => {
    return request<{ message: string; auth_url: string; qrcode_url: string | null }>("/security/bindings/wechat", {
      method: "POST",
    });
  },

  /**
   * 解绑账号
   */
  unbind: (bindingType: "wechat" | "enterprise_wechat" | "email", password: string): Promise<{ message: string }> => {
    return request<{ message: string }>(`/security/bindings/${bindingType}`, {
      method: "DELETE",
      body: JSON.stringify({ binding_type: bindingType, password }),
    });
  },

  /**
   * 注销账号
   */
  deleteAccount: (password: string, confirmation: string): Promise<{ message: string }> => {
    return request<{ message: string }>("/security/delete-account", {
      method: "POST",
      body: JSON.stringify({ password, confirmation }),
    });
  },
};

// ===== 广场扩展类型 =====

export interface TagItem {
  id: string;
  name: string;
  category: string;
  usage_count: number;
  is_hot: boolean;
}

export interface PointsBalance {
  total_points: number;
  available_points: number;
  level: number;
  exp: number;
  streak_days: number;
  checked_in_today: boolean;
  today_points: number;
}

export interface PointRecordItem {
  id: string;
  points: number;
  type: string;
  source: string;
  description: string | null;
  created_at: string;
}

export interface AchievementItem {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: string;
  rarity: string;
  reward_points: number;
  progress: number;
  is_unlocked: boolean;
  unlocked_at: string | null;
}

export interface CollectionItem {
  id: string;
  title: string;
  description: string | null;
  cover_image: string | null;
  is_official: boolean;
  scenario_count: number;
  created_at: string;
}

export interface CreatorProfileDetail {
  id: string;
  user_id: string;
  nickname: string;
  avatar: string | null;
  bio: string | null;
  level: string;
  is_verified: boolean;
  scenario_count: number;
  total_trains: number;
  total_likes: number;
  followers_count: number;
  following_count: number;
  is_following: boolean;
}

export interface ScenarioDetailResponse {
  id: string;
  name: string;
  description: string | null;
  cover_image: string | null;
  track: string;
  difficulty: number;
  tags: string[];
  creator: CreatorBrief | null;
  train_count: number;
  likes_count: number;
  comments_count: number;
  fork_count: number;
  avg_score: number;
  pass_rate: number;
  is_liked: boolean;
  is_collected: boolean;
  is_forked: boolean;
  is_official: boolean;
  is_featured: boolean;
  channel: string | null;
  background: string | null;
  objective: string | null;
  created_at: string;
  published_at: string | null;
}

export interface LeaderboardScenarioItem {
  rank: number;
  scenario_id: string;
  name: string;
  track: string;
  difficulty: number;
  hot_score: number;
  train_count: number;
  likes_count: number;
  avg_score: number;
  creator: { id: string; nickname: string } | null;
}

export interface LeaderboardCreatorItem {
  rank: number;
  creator_id: string;
  user_id: string;
  nickname: string;
  avatar: string | null;
  level: string;
  is_verified: boolean;
  followers_count: number;
  scenario_count: number;
  total_trains: number;
  total_likes: number;
}

export interface LeaderboardUserItem {
  rank: number;
  user_id: string;
  nickname: string;
  avatar: string | null;
  level: string;
  total_points: number;
  streak_days: number;
}


// ===== 广场扩展 API =====
export const plazaExtApi = {
  // ===== 标签 =====
  getHotTags: (limit: number = 20): Promise<{ items: TagItem[] }> => {
    return request<{ items: TagItem[] }>(`/plaza/tags/hot?limit=${limit}`);
  },

  getTags: (category?: string): Promise<{ items: TagItem[] }> => {
    const query = category ? `?category=${category}` : "";
    return request<{ items: TagItem[] }>(`/plaza/tags${query}`);
  },

  searchTags: (q: string, limit: number = 10): Promise<{ items: TagItem[] }> => {
    return request<{ items: TagItem[] }>(`/plaza/tags/search?q=${encodeURIComponent(q)}&limit=${limit}`);
  },

  // ===== 搜索 =====
  getHotSearches: (limit: number = 10): Promise<{ items: { keyword: string; count: number }[] }> => {
    return request<{ items: { keyword: string; count: number }[] }>(`/plaza/search/hot?limit=${limit}`);
  },

  getSearchSuggestions: (q: string, limit: number = 10): Promise<{ items: string[] }> => {
    return request<{ items: string[] }>(`/plaza/search/suggestions?q=${encodeURIComponent(q)}&limit=${limit}`);
  },

  getSearchHistory: (limit: number = 10): Promise<{ items: string[] }> => {
    return request<{ items: string[] }>(`/plaza/search/history?limit=${limit}`);
  },

  clearSearchHistory: (): Promise<{ success: boolean; message: string }> => {
    return request<{ success: boolean; message: string }>("/plaza/search/history", {
      method: "DELETE",
    });
  },

  // ===== 积分 =====
  getPointsBalance: (): Promise<PointsBalance> => {
    return request<PointsBalance>("/plaza/points/balance");
  },

  getPointRecords: (page: number = 1, size: number = 20): Promise<{
    items: PointRecordItem[];
    total: number;
    page: number;
    size: number;
  }> => {
    return request(`/plaza/points/records?page=${page}&size=${size}`);
  },

  dailyCheckin: (): Promise<{
    success: boolean;
    message: string;
    points: number;
    bonus?: number;
    bonus_message?: string;
    total_points_earned?: number;
    streak_days: number;
    total_points: number;
    already_checked_in?: boolean;
  }> => {
    return request("/plaza/points/checkin", { method: "POST" });
  },

  // 获取签到状态（复用 getPointsBalance）
  getCheckinStatus: (): Promise<{
    checked_in_today: boolean;
    today_points: number;
    streak_days: number;
  }> => {
    return request<PointsBalance>("/plaza/points/balance").then(data => ({
      checked_in_today: data.checked_in_today,
      today_points: data.today_points,
      streak_days: data.streak_days,
    }));
  },

  // ===== 成就 =====
  getAchievements: (category?: string): Promise<{ items: AchievementItem[] }> => {
    const query = category ? `?category=${category}` : "";
    return request<{ items: AchievementItem[] }>(`/plaza/achievements${query}`);
  },

  getMyAchievements: (): Promise<{
    items: AchievementItem[];
    total_unlocked: number;
    total_achievements: number;
  }> => {
    return request("/plaza/achievements/my");
  },

  // ===== 排行榜 =====
  getScenarioLeaderboard: (
    type: "hot" | "new" | "rating" | "trains" = "hot",
    track?: string,
    limit: number = 50
  ): Promise<{ items: LeaderboardScenarioItem[]; type: string }> => {
    const params = new URLSearchParams();
    params.set("type", type);
    if (track) params.set("track", track);
    params.set("limit", String(limit));
    return request(`/plaza/leaderboards/scenarios?${params}`);
  },

  getCreatorLeaderboard: (
    type: "popular" | "contribution" | "influence" = "popular",
    limit: number = 50
  ): Promise<{ items: LeaderboardCreatorItem[]; type: string }> => {
    return request(`/plaza/leaderboards/creators?type=${type}&limit=${limit}`);
  },

  getUserLeaderboard: (
    type: "training" | "points" | "improvement" = "points",
    limit: number = 50
  ): Promise<{ items: LeaderboardUserItem[]; type: string }> => {
    return request(`/plaza/leaderboards/users?type=${type}&limit=${limit}`);
  },

  // ===== 专题/合集 =====
  getOfficialCollections: (limit: number = 10): Promise<{ items: CollectionItem[] }> => {
    return request<{ items: CollectionItem[] }>(`/plaza/collections/official?limit=${limit}`);
  },

  getMyCollections: (): Promise<{ items: CollectionItem[] }> => {
    return request<{ items: CollectionItem[] }>("/plaza/collections/my");
  },

  createCollection: (data: {
    title: string;
    description?: string;
    cover_image?: string;
    is_public?: boolean;
  }): Promise<{ success: boolean; collection_id: string; message: string }> => {
    return request("/plaza/collections", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  getCollectionDetail: (collectionId: string, page: number = 1, size: number = 20): Promise<{
    collection: CollectionItem;
    scenarios: Array<{
      id: string;
      name: string;
      description: string;
      track: string;
      difficulty: number;
    }>;
    total: number;
    page: number;
    size: number;
  }> => {
    return request(`/plaza/collections/${collectionId}?page=${page}&size=${size}`);
  },

  addToCollection: (collectionId: string, scenarioId: string): Promise<{ success: boolean; message: string }> => {
    return request(`/plaza/collections/${collectionId}/scenarios/${scenarioId}`, {
      method: "POST",
    });
  },

  removeFromCollection: (collectionId: string, scenarioId: string): Promise<{ success: boolean; message: string }> => {
    return request(`/plaza/collections/${collectionId}/scenarios/${scenarioId}`, {
      method: "DELETE",
    });
  },

  // ===== 创作者 =====
  getCreatorProfile: (creatorId: string): Promise<CreatorProfileDetail> => {
    return request<CreatorProfileDetail>(`/plaza/creators/${creatorId}`);
  },

  getCreatorScenarios: (creatorId: string, page: number = 1, size: number = 20): Promise<{
    items: Array<{
      id: string;
      name: string;
      description: string;
      track: string;
      difficulty: number;
      train_count: number;
      likes_count: number;
      avg_score: number;
      published_at: string | null;
    }>;
    total: number;
    page: number;
    size: number;
  }> => {
    return request(`/plaza/creators/${creatorId}/scenarios?page=${page}&size=${size}`);
  },

  getCreatorFollowers: (creatorId: string, page: number = 1, size: number = 20): Promise<{
    items: Array<{
      user_id: string;
      nickname: string;
      avatar: string | null;
      level: string;
      followed_at: string;
    }>;
    total: number;
    page: number;
    size: number;
  }> => {
    return request(`/plaza/creators/${creatorId}/followers?page=${page}&size=${size}`);
  },

  followCreator: (creatorId: string): Promise<{ success: boolean; message: string }> => {
    return request(`/plaza/creators/${creatorId}/follow`, { method: "POST" });
  },

  unfollowCreator: (creatorId: string): Promise<{ success: boolean; message: string }> => {
    return request(`/plaza/creators/${creatorId}/follow`, { method: "DELETE" });
  },

  // ===== 评论点赞 =====
  likeComment: (commentId: string): Promise<{ success: boolean; likes_count: number }> => {
    return request(`/plaza/comments/${commentId}/like`, { method: "POST" });
  },

  unlikeComment: (commentId: string): Promise<{ success: boolean; likes_count: number }> => {
    return request(`/plaza/comments/${commentId}/like`, { method: "DELETE" });
  },

  getHotComments: (scenarioId: string, limit: number = 5): Promise<{
    items: Array<{
      id: string;
      user_id: string;
      nickname: string;
      avatar: string | null;
      content: string;
      likes_count: number;
      created_at: string;
    }>;
  }> => {
    return request(`/plaza/scenarios/${scenarioId}/comments/hot?limit=${limit}`);
  },

  // ===== 场景详情 =====
  getScenarioDetail: (scenarioId: string): Promise<ScenarioDetailResponse> => {
    return request<ScenarioDetailResponse>(`/plaza/scenarios/${scenarioId}/detail`);
  },

  getRelatedScenarios: (scenarioId: string, limit: number = 6): Promise<{
    items: Array<{
      id: string;
      name: string;
      track: string;
      difficulty: number;
      train_count: number;
      avg_score: number;
    }>;
  }> => {
    return request(`/plaza/scenarios/${scenarioId}/related?limit=${limit}`);
  },
};


// ===== VIP会员类型 =====
export interface MembershipLevel {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  price_monthly: number;
  price_quarterly: number;
  price_yearly: number;
  privileges: Record<string, unknown>;
  sort_order: number;
  is_active: boolean;
}

export interface Subscription {
  id: string;
  user_id: string;
  level_id: string;
  level_name: string;
  status: string;
  started_at: string;
  expires_at: string;
  auto_renew: boolean;
  created_at: string;
}

export interface UserVIPStatus {
  is_vip: boolean;
  level_name: string;
  level_display_name: string;
  expires_at: string | null;
  days_remaining: number | null;
  privileges: Record<string, unknown>;
}

export interface PriceCalculateResult {
  original_price: number;
  coupon_discount: number;
  points_discount: number;
  final_price: number;
  points_to_use: number;
  coupon_code: string | null;
  coupon_name: string | null;
}

// ===== VIP会员 API =====
export const vipApi = {
  /**
   * 获取会员等级列表
   */
  getLevels: (): Promise<{ levels: MembershipLevel[] }> => {
    return request<{ levels: MembershipLevel[] }>("/vip/levels");
  },

  /**
   * 获取当前VIP状态
   */
  getStatus: (): Promise<UserVIPStatus> => {
    return request<UserVIPStatus>("/vip/status");
  },

  /**
   * 获取当前订阅
   */
  getSubscription: (): Promise<Subscription | null> => {
    return request<Subscription | null>("/vip/subscription");
  },

  /**
   * 获取订阅历史
   */
  getSubscriptionHistory: (limit: number = 10): Promise<{ subscriptions: Subscription[] }> => {
    return request<{ subscriptions: Subscription[] }>(`/vip/subscriptions?limit=${limit}`);
  },

  /**
   * 检查权益
   */
  checkPrivilege: (privilegeName: string): Promise<{
    has_privilege: boolean;
    privilege_name: string;
    privilege_value: unknown;
  }> => {
    return request(`/vip/privilege/${privilegeName}`);
  },

  /**
   * 计算价格
   */
  calculatePrice: (data: {
    level_name: string;
    duration_months: number;
    coupon_code?: string;
    points_to_use?: number;
  }): Promise<PriceCalculateResult> => {
    return request<PriceCalculateResult>("/vip/calculate-price", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};

// ===== 订单类型 =====
export interface Order {
  id: string;
  order_no: string;
  user_id: string;
  product_type: string;
  product_id: string;
  product_name: string;
  product_desc: string | null;
  original_amount: number;
  discount_amount: number;
  points_discount: number;
  final_amount: number;
  coupon_id: string | null;
  coupon_code: string | null;
  points_used: number;
  status: string;
  payment_method: string | null;
  payment_channel: string | null;
  transaction_id: string | null;
  paid_at: string | null;
  expires_at: string | null;
  cancelled_at: string | null;
  created_at: string;
}

export interface OrderRefund {
  id: string;
  refund_no: string;
  order_id: string;
  user_id: string;
  amount: number;
  reason: string;
  status: string;
  refund_id: string | null;
  error_msg: string | null;
  processed_at: string | null;
  created_at: string;
}

// ===== 订单 API =====
export const orderApi = {
  /**
   * 获取订单列表
   */
  list: (params?: {
    status?: string;
    page?: number;
    page_size?: number;
  }): Promise<{
    orders: Order[];
    total: number;
    page: number;
    page_size: number;
  }> => {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.page) query.set("page", String(params.page));
    if (params?.page_size) query.set("page_size", String(params.page_size));
    const queryString = query.toString();
    return request(`/orders${queryString ? `?${queryString}` : ""}`);
  },

  /**
   * 获取订单详情
   */
  get: (orderId: string): Promise<Order> => {
    return request<Order>(`/orders/${orderId}`);
  },

  /**
   * 取消订单
   */
  cancel: (orderId: string, reason?: string): Promise<{ message: string }> => {
    return request<{ message: string }>(`/orders/${orderId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },

  /**
   * 申请退款
   */
  refund: (orderId: string, reason: string): Promise<OrderRefund> => {
    return request<OrderRefund>(`/orders/${orderId}/refund`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },

  /**
   * 获取退款记录
   */
  getRefunds: (orderId: string): Promise<{ refunds: OrderRefund[] }> => {
    return request<{ refunds: OrderRefund[] }>(`/orders/${orderId}/refunds`);
  },
};

// ===== 支付类型 =====
export interface PaymentMethod {
  method: string;
  name: string;
  channels: Array<{
    channel: string;
    name: string;
    enabled: boolean;
  }>;
  enabled: boolean;
}

export interface PaymentCreateResult {
  success: boolean;
  order_id: string;
  payment_method: string;
  payment_channel: string;
  qr_code?: string;
  pay_url?: string;
  prepay_id?: string;
}

export interface PaymentQueryResult {
  order_id: string;
  status: string;
  paid: boolean;
  paid_at: string | null;
  transaction_id: string | null;
}

// ===== 支付 API =====
export const paymentApi = {
  /**
   * 获取可用支付方式
   */
  getMethods: (): Promise<{ methods: PaymentMethod[] }> => {
    return request<{ methods: PaymentMethod[] }>("/payment/methods");
  },

  /**
   * 创建支付
   */
  create: (data: {
    order_id: string;
    payment_method: string;
    payment_channel: string;
  }): Promise<PaymentCreateResult> => {
    return request<PaymentCreateResult>("/payment/create", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * 查询支付状态
   */
  query: (orderId: string): Promise<PaymentQueryResult> => {
    return request<PaymentQueryResult>(`/payment/query/${orderId}`);
  },

  /**
   * 申请退款
   */
  refund: (orderId: string, reason: string): Promise<{
    success: boolean;
    refund_id: string;
    message: string;
  }> => {
    return request("/payment/refund", {
      method: "POST",
      body: JSON.stringify({ order_id: orderId, reason }),
    });
  },
};

// ===== 积分类型 =====
export interface PointsAccount {
  id: string;
  user_id: string;
  balance: number;
  locked: number;
  available_balance: number;
  total_earned: number;
  total_spent: number;
  created_at: string;
  updated_at: string;
}

export interface PointsTransaction {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  balance_after: number;
  source: string;
  purpose: string | null;
  reference_id: string | null;
  description: string | null;
  created_at: string;
}

export interface PointsRules {
  earn_rules: Record<string, number>;
  spend_rules: Record<string, number>;
  daily_limit: number;
  points_to_yuan: number;
  max_discount_rate: number;
}

export interface DailyPointsStats {
  date: string;
  earned_today: number;
  daily_limit: number;
  remaining: number;
}

// ===== 积分 API =====
export const pointsApi = {
  /**
   * 获取积分账户
   */
  getAccount: (): Promise<PointsAccount> => {
    return request<PointsAccount>("/points/account");
  },

  /**
   * 获取可用余额
   */
  getBalance: (): Promise<{ balance: number }> => {
    return request<{ balance: number }>("/points/balance");
  },

  /**
   * 获取交易记录
   */
  getTransactions: (params?: {
    type?: string;
    page?: number;
    page_size?: number;
  }): Promise<{
    transactions: PointsTransaction[];
    total: number;
    page: number;
    page_size: number;
  }> => {
    const query = new URLSearchParams();
    if (params?.type) query.set("type", params.type);
    if (params?.page) query.set("page", String(params.page));
    if (params?.page_size) query.set("page_size", String(params.page_size));
    const queryString = query.toString();
    return request(`/points/transactions${queryString ? `?${queryString}` : ""}`);
  },

  /**
   * 获取今日统计
   */
  getDailyStats: (): Promise<DailyPointsStats> => {
    return request<DailyPointsStats>("/points/daily-stats");
  },

  /**
   * 获取积分规则
   */
  getRules: (): Promise<PointsRules> => {
    return request<PointsRules>("/points/rules");
  },

  /**
   * 领取每日登录积分
   */
  claimDailyLogin: (): Promise<{
    message: string;
    points: number;
    balance: number;
  }> => {
    return request("/points/daily-login", { method: "POST" });
  },
};

// ===== 优惠券类型 =====
export interface Coupon {
  id: string;
  code: string;
  name: string;
  type: string;
  value: number;
  min_amount: number;
  max_discount: number | null;
  applicable_products: string[];
  starts_at: string;
  expires_at: string;
  total_count: number;
  used_count: number;
  per_user_limit: number;
  is_active: boolean;
}

export interface UserCoupon {
  id: string;
  user_id: string;
  coupon_id: string;
  coupon: Coupon;
  status: string;
  used_at: string | null;
  order_id: string | null;
  created_at: string;
}

// ===== 优惠券 API =====
export const couponApi = {
  /**
   * 获取可领取的优惠券列表
   */
  list: (params?: { page?: number; page_size?: number }): Promise<{
    coupons: Coupon[];
    total: number;
  }> => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.page_size) query.set("page_size", String(params.page_size));
    const queryString = query.toString();
    return request(`/coupons${queryString ? `?${queryString}` : ""}`);
  },

  /**
   * 获取我的优惠券
   */
  getMyCoupons: (params?: {
    status?: string;
    page?: number;
    page_size?: number;
  }): Promise<{ coupons: UserCoupon[]; total: number }> => {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.page) query.set("page", String(params.page));
    if (params?.page_size) query.set("page_size", String(params.page_size));
    const queryString = query.toString();
    return request(`/coupons/my${queryString ? `?${queryString}` : ""}`);
  },

  /**
   * 领取优惠券
   */
  claim: (couponCode: string): Promise<{
    success: boolean;
    message?: string;
    user_coupon?: UserCoupon;
  }> => {
    return request("/coupons/claim", {
      method: "POST",
      body: JSON.stringify({ coupon_code: couponCode }),
    });
  },

  /**
   * 验证优惠券
   */
  validate: (couponCode: string, orderAmount: number, productType: string): Promise<{
    is_valid: boolean;
    coupon?: Coupon;
    discount_amount?: number;
    message?: string;
  }> => {
    return request("/coupons/validate", {
      method: "POST",
      body: JSON.stringify({
        coupon_code: couponCode,
        order_amount: orderAmount,
        product_type: productType,
      }),
    });
  },

  /**
   * 获取订单可用的优惠券
   */
  getAvailable: (productType: string, orderAmount: number): Promise<{
    coupons: Array<{
      user_coupon_id: string;
      coupon: Coupon;
      discount: number;
    }>;
  }> => {
    return request(`/coupons/available?product_type=${productType}&order_amount=${orderAmount}`);
  },
};


// ===== 兑换码类型 =====
export interface RedeemCode {
  id: string;
  code: string;
  reward_type: string;
  reward_value: number;
  vip_level: string | null;
  usage_limit: number;
  used_count: number;
  per_user_limit: number;
  valid_from: string | null;
  valid_until: string;
  is_active: boolean;
  description: string | null;
  batch_id: string | null;
  created_by: string | null;
  created_at: string;
  remaining_uses: number;
  is_valid: boolean;
  is_expired: boolean;
  is_exhausted: boolean;
}

export interface RedeemResult {
  success: boolean;
  message: string;
  reward_type?: string;
  reward_value?: number;
  vip_extended_to?: string;
  points_added?: number;
}

// ===== 兑换码 API =====
export const redeemCodeApi = {
  /**
   * 兑换码兑换
   */
  redeem: (code: string): Promise<RedeemResult> => {
    return request<RedeemResult>("/redeem-codes/redeem", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
  },
};

// ===== 管理端优惠券 API =====
export interface AdminCoupon {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: string;
  value: number;
  max_discount: number | null;
  min_order_amount: number;
  applicable_products: string[] | null;
  valid_from: string;
  valid_until: string;
  usage_limit: number;
  used_count: number;
  per_user_limit: number;
  user_ids: string[] | null;
  is_active: boolean;
  status: string;
  created_at: string;
}

export interface AdminCouponListResponse {
  items: AdminCoupon[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AdminCouponStats {
  total: number;
  active: number;
  expired: number;
  disabled: number;
  total_claimed: number;
  total_used: number;
  month_created: number;
  usage_rate: number;
}

export const adminCouponApi = {
  /**
   * 获取优惠券列表
   */
  list: (params?: {
    page?: number;
    page_size?: number;
    status?: string;
    type?: string;
    search?: string;
  }): Promise<AdminCouponListResponse> => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.page_size) query.set("page_size", String(params.page_size));
    if (params?.status) query.set("status", params.status);
    if (params?.type) query.set("type", params.type);
    if (params?.search) query.set("search", params.search);
    const queryString = query.toString();
    return request(`/admin/coupons${queryString ? `?${queryString}` : ""}`);
  },

  /**
   * 获取优惠券详情
   */
  get: (id: string): Promise<AdminCoupon> => {
    return request<AdminCoupon>(`/admin/coupons/${id}`);
  },

  /**
   * 创建优惠券
   */
  create: (data: {
    code?: string;
    name: string;
    description?: string;
    type: string;
    value: number;
    max_discount?: number;
    min_order_amount?: number;
    applicable_products?: string[];
    valid_from: string;
    valid_until: string;
    usage_limit?: number;
    per_user_limit?: number;
    user_ids?: string[];
  }): Promise<{ id: string; code: string; message: string }> => {
    return request("/admin/coupons", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * 更新优惠券
   */
  update: (id: string, data: Partial<{
    name: string;
    description: string;
    type: string;
    value: number;
    max_discount: number;
    min_order_amount: number;
    applicable_products: string[];
    valid_from: string;
    valid_until: string;
    usage_limit: number;
    per_user_limit: number;
    user_ids: string[];
    is_active: boolean;
  }>): Promise<{ success: boolean; message: string }> => {
    return request(`/admin/coupons/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  /**
   * 删除优惠券
   */
  delete: (id: string): Promise<{ success: boolean; message: string }> => {
    return request(`/admin/coupons/${id}`, { method: "DELETE" });
  },

  /**
   * 禁用优惠券
   */
  disable: (id: string): Promise<{ success: boolean; message: string }> => {
    return request(`/admin/coupons/${id}/disable`, { method: "PUT" });
  },

  /**
   * 启用优惠券
   */
  enable: (id: string): Promise<{ success: boolean; message: string }> => {
    return request(`/admin/coupons/${id}/enable`, { method: "PUT" });
  },

  /**
   * 获取统计
   */
  getStatistics: (): Promise<AdminCouponStats> => {
    return request<AdminCouponStats>("/admin/coupons/statistics");
  },
};

// ===== 管理端 VIP API =====
export interface AdminVipLevel {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  monthly_price: number;
  quarterly_price: number;
  half_yearly_price: number;
  yearly_price: number;
  privileges: Record<string, unknown>;
  is_active: boolean;
  sort_order: number;
  active_subscriptions: number;
  total_subscriptions: number;
  created_at: string;
}

export interface AdminVipStats {
  total_vip: number;
  month_new_vip: number;
  expiring_soon: number;
  renewal_rate: number;
  level_distribution: Array<{ level: string; count: number }>;
}

export const adminVipApi = {
  /**
   * 获取VIP套餐列表
   */
  getLevels: (includeInactive?: boolean): Promise<{
    items: AdminVipLevel[];
    total: number;
  }> => {
    const query = includeInactive ? "?include_inactive=true" : "";
    return request(`/admin/vip/levels${query}`);
  },

  /**
   * 获取VIP套餐详情
   */
  getLevel: (id: string): Promise<AdminVipLevel> => {
    return request<AdminVipLevel>(`/admin/vip/levels/${id}`);
  },

  /**
   * 创建VIP套餐
   */
  createLevel: (data: {
    name: string;
    display_name: string;
    description?: string;
    monthly_price?: number;
    quarterly_price?: number;
    half_yearly_price?: number;
    yearly_price?: number;
    privileges?: Record<string, unknown>;
    sort_order?: number;
  }): Promise<{ success: boolean; message: string; id: string }> => {
    return request("/admin/vip/levels", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * 更新VIP套餐
   */
  updateLevel: (id: string, data: Partial<{
    display_name: string;
    description: string;
    monthly_price: number;
    quarterly_price: number;
    half_yearly_price: number;
    yearly_price: number;
    privileges: Record<string, unknown>;
    is_active: boolean;
    sort_order: number;
  }>): Promise<{ success: boolean; message: string }> => {
    return request(`/admin/vip/levels/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  /**
   * 删除VIP套餐
   */
  deleteLevel: (id: string): Promise<{ success: boolean; message: string }> => {
    return request(`/admin/vip/levels/${id}`, { method: "DELETE" });
  },

  /**
   * 禁用VIP套餐
   */
  disableLevel: (id: string): Promise<{ success: boolean; message: string }> => {
    return request(`/admin/vip/levels/${id}/disable`, { method: "PUT" });
  },

  /**
   * 启用VIP套餐
   */
  enableLevel: (id: string): Promise<{ success: boolean; message: string }> => {
    return request(`/admin/vip/levels/${id}/enable`, { method: "PUT" });
  },

  /**
   * 获取VIP统计
   */
  getStatistics: (): Promise<AdminVipStats> => {
    return request<AdminVipStats>("/admin/vip/statistics");
  },

  /**
   * 延长用户VIP
   */
  extendUserVip: (userId: string, days: number, reason?: string): Promise<{
    success: boolean;
    message: string;
    new_expires_at: string;
  }> => {
    return request(`/admin/vip/users/${userId}/extend`, {
      method: "POST",
      body: JSON.stringify({ days, reason }),
    });
  },

  /**
   * 取消用户VIP
   */
  cancelUserVip: (userId: string): Promise<{ success: boolean; message: string }> => {
    return request(`/admin/vip/users/${userId}/cancel`, { method: "POST" });
  },
};

// ===== 管理端订单 API =====
export interface AdminOrder {
  id: string;
  order_no: string;
  user_id: string;
  user_nickname: string | null;
  user_phone: string | null;
  product_type: string;
  product_id: string;
  product_name: string;
  product_desc: string | null;
  original_amount: number;
  discount_amount: number;
  points_discount: number;
  final_amount: number;
  coupon_id: string | null;
  coupon_code: string | null;
  points_used: number;
  status: string;
  payment_method: string | null;
  payment_channel: string | null;
  transaction_id: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface AdminOrderDetail extends AdminOrder {
  user: {
    id: string;
    nickname: string | null;
    phone: string | null;
    avatar: string | null;
  };
  refunds: Array<{
    id: string;
    refund_no: string;
    amount: number;
    reason: string;
    status: string;
    processed_at: string | null;
    created_at: string;
  }>;
}

export interface AdminOrderListResponse {
  items: AdminOrder[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AdminOrderStats {
  total: number;
  pending: number;
  paid: number;
  cancelled: number;
  refunded: number;
  total_amount: number;
  total_discount: number;
  total_points_discount: number;
  today_orders: number;
  today_paid: number;
  today_amount: number;
  success_rate: number;
}

export const adminOrderApi = {
  /**
   * 获取订单列表
   */
  list: (params?: {
    page?: number;
    page_size?: number;
    status?: string;
    payment_method?: string;
    product_type?: string;
    user_id?: string;
    search?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<AdminOrderListResponse> => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.page_size) query.set("page_size", String(params.page_size));
    if (params?.status) query.set("status", params.status);
    if (params?.payment_method) query.set("payment_method", params.payment_method);
    if (params?.product_type) query.set("product_type", params.product_type);
    if (params?.user_id) query.set("user_id", params.user_id);
    if (params?.search) query.set("search", params.search);
    if (params?.start_date) query.set("start_date", params.start_date);
    if (params?.end_date) query.set("end_date", params.end_date);
    const queryString = query.toString();
    return request(`/admin/orders${queryString ? `?${queryString}` : ""}`);
  },

  /**
   * 获取订单详情
   */
  get: (id: string): Promise<AdminOrderDetail> => {
    return request<AdminOrderDetail>(`/admin/orders/${id}`);
  },

  /**
   * 手动标记已支付
   */
  markPaid: (id: string, transactionId?: string): Promise<{
    success: boolean;
    message: string;
  }> => {
    const query = transactionId ? `?transaction_id=${transactionId}` : "";
    return request(`/admin/orders/${id}/mark-paid${query}`, { method: "PUT" });
  },

  /**
   * 退款
   */
  refund: (id: string, reason?: string): Promise<{
    success: boolean;
    message: string;
  }> => {
    return request(`/admin/orders/${id}/refund`, {
      method: "POST",
      body: JSON.stringify({ reason: reason || "admin_refund" }),
    });
  },

  /**
   * 取消订单
   */
  cancel: (id: string): Promise<{ success: boolean; message: string }> => {
    return request(`/admin/orders/${id}/cancel`, { method: "PUT" });
  },

  /**
   * 获取统计
   */
  getStatistics: (params?: {
    start_date?: string;
    end_date?: string;
  }): Promise<AdminOrderStats> => {
    const query = new URLSearchParams();
    if (params?.start_date) query.set("start_date", params.start_date);
    if (params?.end_date) query.set("end_date", params.end_date);
    const queryString = query.toString();
    return request(`/admin/orders/statistics${queryString ? `?${queryString}` : ""}`);
  },
};

// ===== 管理端兑换码 API =====
export interface AdminRedeemCode {
  id: string;
  code: string;
  reward_type: string;
  reward_value: number;
  vip_level: string | null;
  usage_limit: number;
  used_count: number;
  per_user_limit: number;
  valid_from: string | null;
  valid_until: string;
  is_active: boolean;
  description: string | null;
  batch_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
  remaining_uses: number;
  is_valid: boolean;
  is_expired: boolean;
  is_exhausted: boolean;
}

export interface AdminRedeemCodeListResponse {
  items: AdminRedeemCode[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AdminRedeemCodeStats {
  total_codes: number;
  active_codes: number;
  total_redeems: number;
  today_redeems: number;
  by_reward_type: Array<{ reward_type: string; count: number; total_value: number }>;
}

export interface AdminRedeemLog {
  id: string;
  code_id: string;
  code: string | null;
  user_id: string;
  user_nickname: string | null;
  reward_type: string;
  reward_value: number;
  vip_extended_to: string | null;
  points_added: number | null;
  redeemed_at: string;
  ip_address: string | null;
}

export const adminRedeemCodeApi = {
  /**
   * 获取兑换码列表
   */
  list: (params?: {
    page?: number;
    page_size?: number;
    reward_type?: string;
    is_active?: boolean;
    batch_id?: string;
    search?: string;
  }): Promise<AdminRedeemCodeListResponse> => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.page_size) query.set("page_size", String(params.page_size));
    if (params?.reward_type) query.set("reward_type", params.reward_type);
    if (params?.is_active !== undefined) query.set("is_active", String(params.is_active));
    if (params?.batch_id) query.set("batch_id", params.batch_id);
    if (params?.search) query.set("search", params.search);
    const queryString = query.toString();
    return request(`/admin/redeem-codes${queryString ? `?${queryString}` : ""}`);
  },

  /**
   * 创建兑换码
   */
  create: (data: {
    code?: string;
    reward_type: string;
    reward_value: number;
    vip_level?: string;
    usage_limit?: number;
    per_user_limit?: number;
    valid_from?: string;
    valid_until: string;
    description?: string;
  }): Promise<{ id: string; code: string; message: string }> => {
    return request("/admin/redeem-codes", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * 批量创建兑换码
   */
  batchCreate: (data: {
    count: number;
    prefix?: string;
    reward_type: string;
    reward_value: number;
    vip_level?: string;
    usage_limit?: number;
    per_user_limit?: number;
    valid_from?: string;
    valid_until: string;
    description?: string;
  }): Promise<{
    batch_id: string;
    count: number;
    codes: string[];
    message: string;
  }> => {
    return request("/admin/redeem-codes/batch", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * 更新兑换码
   */
  update: (id: string, data: Partial<{
    reward_type: string;
    reward_value: number;
    vip_level: string;
    usage_limit: number;
    per_user_limit: number;
    valid_from: string;
    valid_until: string;
    is_active: boolean;
    description: string;
  }>): Promise<{ success: boolean; message: string }> => {
    return request(`/admin/redeem-codes/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  /**
   * 删除兑换码
   */
  delete: (id: string): Promise<{ success: boolean; message: string }> => {
    return request(`/admin/redeem-codes/${id}`, { method: "DELETE" });
  },

  /**
   * 禁用兑换码
   */
  disable: (id: string): Promise<{ success: boolean; message: string }> => {
    return request(`/admin/redeem-codes/${id}/disable`, { method: "PUT" });
  },

  /**
   * 启用兑换码
   */
  enable: (id: string): Promise<{ success: boolean; message: string }> => {
    return request(`/admin/redeem-codes/${id}/enable`, { method: "PUT" });
  },

  /**
   * 获取统计
   */
  getStatistics: (): Promise<AdminRedeemCodeStats> => {
    return request<AdminRedeemCodeStats>("/admin/redeem-codes/statistics");
  },

  /**
   * 导出兑换码
   */
  export: (params?: {
    batch_id?: string;
    reward_type?: string;
    is_active?: boolean;
    include_used?: boolean;
  }): Promise<{ codes: string[]; count: number }> => {
    const query = new URLSearchParams();
    if (params?.batch_id) query.set("batch_id", params.batch_id);
    if (params?.reward_type) query.set("reward_type", params.reward_type);
    if (params?.is_active !== undefined) query.set("is_active", String(params.is_active));
    if (params?.include_used !== undefined) query.set("include_used", String(params.include_used));
    const queryString = query.toString();
    return request(`/admin/redeem-codes/export${queryString ? `?${queryString}` : ""}`);
  },

  /**
   * 获取兑换记录
   */
  getLogs: (params?: {
    page?: number;
    page_size?: number;
    code_id?: string;
    user_id?: string;
  }): Promise<{
    items: AdminRedeemLog[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
  }> => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.page_size) query.set("page_size", String(params.page_size));
    if (params?.code_id) query.set("code_id", params.code_id);
    if (params?.user_id) query.set("user_id", params.user_id);
    const queryString = query.toString();
    return request(`/admin/redeem-codes/logs${queryString ? `?${queryString}` : ""}`);
  },
};
