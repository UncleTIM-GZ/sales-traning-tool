/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：后台管理侧边栏组件
 * 作用：提供后台管理的导航菜单，包含会员管理、营销管理等分组
 * 创建时间：2025-12-24
 * 最后修改：2025-12-24
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

interface NavItem {
  name: string;
  href: string;
  icon: string;
  badge?: number;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  { name: "数据概览", href: "/admin", icon: "dashboard" },
  { name: "用户管理", href: "/admin/users", icon: "group" },
  { name: "场景管理", href: "/admin/scenarios", icon: "psychology" },
  { name: "广场审核", href: "/admin/plaza", icon: "explore" },
  { name: "课程管理", href: "/admin/courses", icon: "school" },
  { name: "社区管理", href: "/admin/community", icon: "forum" },
  { name: "训练报告", href: "/admin/reports", icon: "assessment" },
  { name: "训练计划", href: "/admin/plans", icon: "calendar_month" },
  { name: "成就勋章", href: "/admin/achievements", icon: "emoji_events" },
  { name: "通知管理", href: "/admin/notifications", icon: "notifications" },
  { 
    name: "会员管理", 
    href: "/admin/vip", 
    icon: "workspace_premium",
    children: [
      { name: "VIP套餐", href: "/admin/vip", icon: "diamond" },
      { name: "订单管理", href: "/admin/orders", icon: "receipt_long" },
    ]
  },
  { 
    name: "营销管理", 
    href: "/admin/marketing", 
    icon: "campaign",
    children: [
      { name: "优惠券", href: "/admin/coupons", icon: "confirmation_number" },
      { name: "兑换码", href: "/admin/redeem-codes", icon: "qr_code" },
      { name: "推广邀请", href: "/admin/invites", icon: "card_giftcard" },
    ]
  },
  { 
    name: "系统设置", 
    href: "/admin/settings", 
    icon: "settings",
    children: [
      { name: "基础设置", href: "/admin/settings", icon: "tune" },
      { name: "短信配置", href: "/admin/settings/sms", icon: "sms" },
      { name: "登录配置", href: "/admin/settings/login", icon: "login" },
      { name: "支付配置", href: "/admin/settings/payment", icon: "payments" },
      { name: "积分配置", href: "/admin/settings/points", icon: "toll" },
    ]
  },
];

export default function AdminSidebar({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>(["/admin/settings"]);

  const toggleExpand = (href: string) => {
    setExpandedItems(prev => 
      prev.includes(href) ? prev.filter(h => h !== href) : [...prev, href]
    );
  };

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  return (
    <aside className={`fixed left-0 top-0 h-screen bg-bg-surface border-r border-border-default transition-all duration-300 z-40 ${
      collapsed ? "w-16" : "w-64"
    }`}>
      {/* Logo */}
      <div className="h-16 flex items-center justify-center border-b border-border-default">
        <Link href="/admin" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <span className="material-symbols-outlined text-white text-xl">admin_panel_settings</span>
          </div>
          {!collapsed && (
            <span className="text-text-primary font-bold text-lg">管理后台</span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="p-3 space-y-1 overflow-y-auto h-[calc(100vh-8rem)]">
        {navItems.map((item) => (
          <div key={item.href}>
            {item.children ? (
              // 有子菜单
              <>
                <button
                  onClick={() => toggleExpand(item.href)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive(item.href)
                      ? "bg-violet-500/15 text-violet-400"
                      : "text-text-secondary hover:bg-bg-elevated/50 hover:text-text-primary"
                  }`}
                >
                  <span className="material-symbols-outlined text-xl">{item.icon}</span>
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">{item.name}</span>
                      <span className={`material-symbols-outlined text-lg transition-transform ${
                        expandedItems.includes(item.href) ? "rotate-180" : ""
                      }`}>
                        expand_more
                      </span>
                    </>
                  )}
                </button>
                {!collapsed && expandedItems.includes(item.href) && (
                  <div className="ml-4 mt-1 space-y-1 border-l border-border-default pl-3">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                          pathname === child.href
                            ? "bg-violet-500/15 text-violet-400"
                            : "text-text-secondary hover:bg-bg-elevated/50 hover:text-text-primary"
                        }`}
                      >
                        <span className="material-symbols-outlined text-lg">{child.icon}</span>
                        {child.name}
                      </Link>
                    ))}
                  </div>
                )}
              </>
            ) : (
              // 无子菜单
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive(item.href)
                    ? "bg-violet-500/15 text-violet-400"
                    : "text-text-secondary hover:bg-bg-elevated/50 hover:text-text-primary"
                }`}
              >
                <span className="material-symbols-outlined text-xl">{item.icon}</span>
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.name}</span>
                    {item.badge && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-red-500 text-text-primary">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </Link>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-border-default">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-text-muted hover:bg-bg-elevated/50 hover:text-text-primary transition-all"
        >
          <span className="material-symbols-outlined text-xl">arrow_back</span>
          {!collapsed && <span>返回前台</span>}
        </Link>
      </div>
    </aside>
  );
}
