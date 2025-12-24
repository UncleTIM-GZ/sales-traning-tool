/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：主题切换器组件
 * 作用：在 Header 中显示主题切换按钮
 * 创建时间：2025-12-23
 * 最后修改：2025-12-23
 */

"use client";

import { useSyncExternalStore } from "react";
import { useThemeStore, Theme } from "@/stores/themeStore";
import { Sun, Moon } from "lucide-react";

export function ThemeSwitcher() {
  const { theme, setTheme } = useThemeStore();

  // 使用 useSyncExternalStore 避免 hydration mismatch
  const mounted = useSyncExternalStore(
    () => () => { },
    () => true,
    () => false
  );

  if (!mounted) {
    return (
      <div className="w-9 h-9 rounded-lg bg-bg-elevated animate-pulse" />
    );
  }

  const themes: { value: Theme; icon: typeof Sun; label: string }[] = [
    { value: "light", icon: Sun, label: "浅色" },
    { value: "dark", icon: Moon, label: "深色" },
  ];

  const currentTheme = themes.find((t) => t.value === theme) || themes[1];
  const CurrentIcon = currentTheme.icon;

  return (
    <div className="relative group">
      <button
        onClick={() => {
          const newTheme: Theme = theme === "dark" ? "light" : "dark";
          setTheme(newTheme);
        }}
        className="flex items-center justify-center w-9 h-9 rounded-lg bg-bg-elevated hover:bg-bg-hover border border-border-default transition-all"
        title={`当前: ${currentTheme.label}`}
      >
        <CurrentIcon className="w-4 h-4 text-text-secondary" />
      </button>

      {/* 下拉菜单 */}
      <div className="absolute right-0 top-full mt-2 py-1 bg-bg-card border border-border-default rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[120px]">
        {themes.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.value}
              onClick={() => setTheme(t.value)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${theme === t.value
                  ? "text-primary bg-primary/10"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
                }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
              {theme === t.value && (
                <span className="ml-auto text-primary">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// 简化版切换按钮（双态）
export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();

  // 使用 useSyncExternalStore 避免 hydration mismatch
  const mounted = useSyncExternalStore(
    () => () => { },
    () => true,
    () => false
  );

  if (!mounted) {
    return <div className="w-9 h-9 rounded-lg bg-bg-elevated animate-pulse" />;
  }

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center justify-center w-9 h-9 rounded-lg bg-bg-elevated hover:bg-bg-hover border border-border-default transition-all"
      title={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
    >
      {theme === "dark" ? (
        <Sun className="w-4 h-4 text-text-secondary" />
      ) : (
        <Moon className="w-4 h-4 text-text-secondary" />
      )}
    </button>
  );
}
