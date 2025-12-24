/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：主应用侧边栏导航组件
 * 作用：提供主应用的导航菜单
 * 创建时间：2025-12-24
 * 最后修改：2025-12-24
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  iconFilled?: boolean;
  // 子路由列表，用于判断选中状态
  childRoutes?: string[];
}

const mainNavItems: NavItem[] = [
  { href: "/dashboard", label: "总览概况", icon: "dashboard", iconFilled: true },
  { href: "/plaza", label: "训练广场", icon: "explore" },
  { href: "/plan", label: "训练计划", icon: "calendar_month" },
  { href: "/courses", label: "专属课程", icon: "school" },
  { href: "/community", label: "精英圈层", icon: "groups" },
  { href: "/friends", label: "我的好友", icon: "group" },
  { href: "/invite", label: "邀请好友", icon: "card_giftcard" },
  { 
    href: "/me", 
    label: "个人中心", 
    icon: "account_circle",
    // 个人中心的子页面
    childRoutes: ["/vip", "/points", "/coupons", "/orders", "/achievements", "/notifications", "/settings"]
  },
];

export function Sidebar() {
  const pathname = usePathname();

  const renderNavItem = (item: NavItem) => {
    // 检查是否激活：当前路径匹配，或者匹配子路由
    const isActive = pathname === item.href || 
      pathname.startsWith(item.href + "/") ||
      (item.childRoutes?.some(route => pathname === route || pathname.startsWith(route + "/")) ?? false);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-lg transition-all group",
          isActive
            ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_-3px_rgba(59,130,246,0.1)]"
            : "text-text-secondary hover:bg-bg-hover hover:text-text-primary border border-transparent"
        )}
      >
        <span
          className={cn(
            "material-symbols-outlined",
            !isActive && "group-hover:text-primary transition-colors"
          )}
          style={{
            fontVariationSettings: isActive && item.iconFilled ? "'FILL' 1" : "'FILL' 0",
          }}
        >
          {item.icon}
        </span>
        <span className={cn("text-sm", isActive ? "font-bold" : "font-medium")}>
          {item.label}
        </span>
      </Link>
    );
  };

  return (
    <aside className="w-64 h-full flex flex-col border-r border-border-default bg-bg-surface flex-shrink-0 z-20">
      {/* Logo */}
      <div className="p-6 pb-2">
        <div className="flex items-center gap-3 mb-10">
          <div className="bg-[var(--brand-gradient)] p-0.5 rounded-lg shadow-lg shadow-[var(--shadow-glow)]">
            <div className="bg-bg-surface p-1.5 rounded-[6px] flex items-center justify-center">
              <span className="material-symbols-outlined text-text-primary" style={{ fontSize: 24 }}>
                psychology
              </span>
            </div>
          </div>
          <div>
            <h1 className="text-base font-bold text-text-primary leading-none tracking-wide">
              AI 智训 <span className="text-primary italic">Pro</span>
            </h1>
            <p className="text-text-muted text-[10px] mt-1.5 uppercase tracking-wider">
              高端能力定制
            </p>
          </div>
        </div>

        {/* Main Navigation */}
        <div className="flex flex-col gap-2">
          {mainNavItems.map(renderNavItem)}
        </div>
      </div>
    </aside>
  );
}
