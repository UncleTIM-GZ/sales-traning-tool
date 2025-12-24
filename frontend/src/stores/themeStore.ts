/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：主题状态管理
 * 作用：管理深色/浅色主题切换
 * 创建时间：2025-12-23
 * 最后修改：2025-12-23
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "dark" | "light";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

// 应用主题到 DOM
const applyTheme = (theme: Theme) => {
  if (typeof window === "undefined") return;
  
  const root = document.documentElement;
  
  if (theme === "light") {
    root.classList.add("light");
    root.setAttribute("data-theme", "light");
  } else {
    root.classList.remove("light");
    root.setAttribute("data-theme", "dark");
  }
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "dark" as Theme,
      
      setTheme: (theme: Theme) => {
        applyTheme(theme);
        set({ theme });
      },
      
      toggleTheme: () => {
        const currentTheme = get().theme;
        const newTheme: Theme = currentTheme === "dark" ? "light" : "dark";
        applyTheme(newTheme);
        set({ theme: newTheme });
      },
    }),
    {
      name: "theme-storage",
      onRehydrateStorage: () => (state) => {
        // 页面加载后应用保存的主题
        if (state) {
          applyTheme(state.theme);
        }
      },
    }
  )
);
