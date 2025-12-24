/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：主应用顶部导航栏组件
 * 作用：提供搜索、通知、用户菜单、VIP状态显示等功能
 * 创建时间：2025-12-24
 * 最后修改：2025-12-24
 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/stores/authStore";
import NotificationCenter from "./NotificationCenter";
import { ThemeSwitcher } from "./ThemeSwitcher";

interface HeaderProps {
  showSearch?: boolean;
}

export function Header({ showSearch = true }: HeaderProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const { user, logout, vipStatus, pointsBalance } = useAuthStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 避免 SSR 和客户端渲染不一致
  const mounted = useSyncExternalStore(
    () => () => { },
    () => true,
    () => false
  );

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const defaultUser = {
    nickname: "访客",
    level: "未登录",
    avatar: "",
    role: "user" as const,
  };

  const displayUser = mounted && user ? {
    nickname: user.nickname,
    level: user.level || "学员",
    avatar: user.avatar || "",
    role: user.role || "user",
  } : defaultUser;

  const isAdmin = displayUser.role === "admin";

  // 生成头像显示内容（取昵称第一个字）
  const avatarText = displayUser.nickname.charAt(0).toUpperCase();

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
    router.push("/login");
  };

  const menuItems = [
    { label: "个人中心", icon: "person", href: "/me" },
    ...(isAdmin ? [{ label: "后台管理", icon: "admin_panel_settings", href: "/admin" }] : []),
    { label: "系统设置", icon: "settings", href: "/settings" },
  ];

  return (
    <header className="h-16 flex items-center justify-between px-8 glass-effect z-10 sticky top-0">
      {/* Search */}
      {showSearch && (
        <div className="flex items-center w-full max-w-md">
          <div className="relative w-full group">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-primary transition-colors material-symbols-outlined text-[20px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-bg-card border border-border-default rounded-lg py-2 pl-10 pr-4 text-sm text-text-primary placeholder-text-muted focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all outline-none"
              placeholder="搜索高级场景、谈判技巧..."
            />
          </div>
        </div>
      )}

      {/* Right Side */}
      <div className="flex items-center gap-6 ml-auto">
        {/* VIP Badge */}
        {mounted && vipStatus?.is_vip && (
          <Link
            href="/vip"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 hover:border-amber-500/50 transition-colors group"
          >
            <span className="material-symbols-outlined text-amber-400 text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
              workspace_premium
            </span>
            <span className="text-xs font-bold text-amber-400 group-hover:text-amber-300 transition-colors">
              {vipStatus.vip_level_display || "VIP"}
            </span>
          </Link>
        )}

        {/* Points Balance */}
        {mounted && (
          <Link
            href="/points"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 transition-colors group"
          >
            <span className="material-symbols-outlined text-blue-400 text-base">
              toll
            </span>
            <span className="text-xs font-medium text-blue-400 group-hover:text-blue-300 transition-colors">
              {pointsBalance.toLocaleString()}
            </span>
          </Link>
        )}

        {/* Theme Switcher */}
        <ThemeSwitcher />

        {/* Notifications */}
        <NotificationCenter />

        {/* Divider */}
        <div className="h-6 w-[1px] bg-border-default"></div>

        {/* User Profile with Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-3 cursor-pointer group"
          >
            {displayUser.avatar ? (
              <div
                className="bg-center bg-cover rounded-full h-9 w-9 border border-blue-500/30 group-hover:border-blue-500 transition-colors"
                style={{
                  backgroundImage: `url("${displayUser.avatar}")`,
                }}
              />
            ) : (
              <div className="h-9 w-9 rounded-full bg-[var(--brand-gradient)] flex items-center justify-center text-white font-bold text-sm border border-primary-500/30 group-hover:border-primary-500 transition-colors">
                {avatarText}
              </div>
            )}
            <div className="hidden md:flex flex-col">
              <span className="text-sm font-bold text-text-primary leading-tight">
                {displayUser.nickname}
              </span>
              <span className="text-[10px] text-text-secondary">
                {isAdmin ? "管理员" : displayUser.level}
              </span>
            </div>
            <span className="material-symbols-outlined text-text-muted text-lg hidden md:block">
              {showUserMenu ? "expand_less" : "expand_more"}
            </span>
          </button>

          {/* Dropdown Menu */}
          <AnimatePresence>
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-48 bg-bg-card border border-border-default rounded-xl shadow-xl overflow-hidden z-50"
              >
                {/* User Info */}
                <div className="px-4 py-3 border-b border-border-default bg-bg-surface">
                  <p className="font-medium text-text-primary text-sm truncate">{displayUser.nickname}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {isAdmin && (
                      <span className="inline-flex items-center gap-1 text-amber-400 text-xs">
                        <span className="material-symbols-outlined text-xs">verified</span>
                        管理员
                      </span>
                    )}
                    {mounted && vipStatus?.is_vip && (
                      <span className="inline-flex items-center gap-1 text-amber-400 text-xs">
                        <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
                        {vipStatus.vip_level_display}
                      </span>
                    )}
                  </div>
                  {mounted && (
                    <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs text-blue-400">toll</span>
                        {pointsBalance.toLocaleString()} 积分
                      </span>
                    </div>
                  )}
                </div>

                {/* Menu Items */}
                <div className="py-1">
                  {menuItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setShowUserMenu(false)}
                      className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${item.href === "/admin"
                          ? "text-amber-400 hover:bg-amber-500/10"
                          : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                        }`}
                    >
                      <span className="material-symbols-outlined text-lg">{item.icon}</span>
                      {item.label}
                    </Link>
                  ))}
                </div>

                {/* Logout */}
                <div className="py-1 border-t border-border-default">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">logout</span>
                    退出登录
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
