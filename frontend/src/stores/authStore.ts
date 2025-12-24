/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：认证状态管理
 * 作用：管理用户登录状态、VIP状态、积分余额
 * 创建时间：2025-12-24
 * 最后修改：2025-12-24
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  id: string;
  phone: string;
  nickname: string;
  avatar?: string;
  track: "sales" | "social";
  role: "user" | "admin";
  level?: string;
}

interface VipStatus {
  is_vip: boolean;
  vip_level: string;
  vip_level_display: string;
  expires_at: string | null;
  days_remaining: number;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  
  // VIP 状态
  vipStatus: VipStatus | null;
  pointsBalance: number;
  
  // Actions
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  
  // VIP Actions
  updateVipStatus: (status: VipStatus) => void;
  updatePointsBalance: (balance: number) => void;
  clearVipStatus: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      vipStatus: null,
      pointsBalance: 0,

      setAuth: (user, token) =>
        set({
          user,
          token,
          isAuthenticated: true,
        }),

      clearAuth: () =>
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          vipStatus: null,
          pointsBalance: 0,
        }),

      logout: () =>
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          vipStatus: null,
          pointsBalance: 0,
        }),

      updateUser: (userData) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        })),

      updateVipStatus: (status) =>
        set({ vipStatus: status }),

      updatePointsBalance: (balance) =>
        set({ pointsBalance: balance }),

      clearVipStatus: () =>
        set({ vipStatus: null, pointsBalance: 0 }),
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        vipStatus: state.vipStatus,
        pointsBalance: state.pointsBalance,
      }),
    }
  )
);
