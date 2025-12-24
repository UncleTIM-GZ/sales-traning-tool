/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：个人中心页面
 * 作用：整合用户个人信息、会员服务、积分、优惠券、订单等功能入口
 * 创建时间：2025-12-24
 * 最后修改：2025-12-24
 */

"use client";

import Link from "next/link";
import { useAuthStore } from "@/stores/authStore";

interface MenuCard {
  href: string;
  icon: string;
  title: string;
  description: string;
  color: string;
}

const memberMenus: MenuCard[] = [
  {
    href: "/vip",
    icon: "workspace_premium",
    title: "会员中心",
    description: "查看会员等级与权益",
    color: "from-amber-500 to-orange-500",
  },
  {
    href: "/points",
    icon: "toll",
    title: "积分中心",
    description: "查看积分余额与明细",
    color: "from-emerald-500 to-teal-500",
  },
  {
    href: "/coupons",
    icon: "confirmation_number",
    title: "我的优惠券",
    description: "查看可用优惠券",
    color: "from-pink-500 to-rose-500",
  },
  {
    href: "/orders",
    icon: "receipt_long",
    title: "我的订单",
    description: "查看订单记录",
    color: "from-blue-500 to-indigo-500",
  },
];

const otherMenus: MenuCard[] = [
  {
    href: "/achievements",
    icon: "emoji_events",
    title: "我的成就",
    description: "查看获得的成就徽章",
    color: "from-purple-500 to-violet-500",
  },
  {
    href: "/notifications",
    icon: "notifications",
    title: "消息通知",
    description: "查看系统消息",
    color: "from-cyan-500 to-sky-500",
  },
  {
    href: "/settings",
    icon: "settings",
    title: "系统设置",
    description: "账号安全与偏好设置",
    color: "from-slate-500 to-zinc-500",
  },
];

export default function MePage() {
  const { user } = useAuthStore();

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* 用户信息卡片 */}
      <div className="bg-bg-card border border-border-default rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
            {user?.nickname?.charAt(0) || user?.phone?.charAt(0) || "U"}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-text-primary mb-1">
              {user?.nickname || "用户"}
            </h1>
            <p className="text-text-secondary text-sm mb-3">
              {user?.phone?.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2")}
            </p>
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-medium">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                  workspace_premium
                </span>
                {user?.level || "普通用户"}
              </span>
              <Link
                href="/settings"
                className="text-text-muted hover:text-primary text-sm transition-colors"
              >
                编辑资料
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 会员服务 */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>
            card_membership
          </span>
          会员服务
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {memberMenus.map((menu) => (
            <Link
              key={menu.href}
              href={menu.href}
              className="group bg-bg-card border border-border-default rounded-xl p-5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all"
            >
              <div className="flex items-start gap-4">
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${menu.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}
                >
                  <span className="material-symbols-outlined text-white" style={{ fontSize: 24 }}>
                    {menu.icon}
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-text-primary group-hover:text-primary transition-colors">
                    {menu.title}
                  </h3>
                  <p className="text-text-muted text-sm mt-1">{menu.description}</p>
                </div>
                <span className="material-symbols-outlined text-text-muted group-hover:text-primary group-hover:translate-x-1 transition-all">
                  chevron_right
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* 其他功能 */}
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>
            apps
          </span>
          更多功能
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {otherMenus.map((menu) => (
            <Link
              key={menu.href}
              href={menu.href}
              className="group bg-bg-card border border-border-default rounded-xl p-5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all"
            >
              <div className="flex items-start gap-4">
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${menu.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}
                >
                  <span className="material-symbols-outlined text-white" style={{ fontSize: 24 }}>
                    {menu.icon}
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-text-primary group-hover:text-primary transition-colors">
                    {menu.title}
                  </h3>
                  <p className="text-text-muted text-sm mt-1">{menu.description}</p>
                </div>
                <span className="material-symbols-outlined text-text-muted group-hover:text-primary group-hover:translate-x-1 transition-all">
                  chevron_right
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
