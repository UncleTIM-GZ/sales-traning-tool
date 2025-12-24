"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  iconFilled?: boolean;
  childRoutes?: string[];
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "首页", icon: "dashboard", iconFilled: true },
  { href: "/plaza", label: "广场", icon: "explore" },
  { href: "/scenarios", label: "场景", icon: "theater_comedy" },
  { href: "/community", label: "社区", icon: "groups" },
  { 
    href: "/me", 
    label: "我的", 
    icon: "person",
    childRoutes: ["/vip", "/points", "/coupons", "/orders", "/achievements", "/notifications", "/settings"]
  },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-surface-dark/95 backdrop-blur-md border-t border-border-dark safe-area-pb">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            pathname.startsWith(item.href + "/") ||
            (item.childRoutes?.some(route => pathname === route || pathname.startsWith(route + "/")) ?? false);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${
                isActive ? "text-blue-500" : "text-text-muted"
              }`}
            >
              <span
                className="material-symbols-outlined text-xl"
                style={{
                  fontVariationSettings: isActive && item.iconFilled ? "'FILL' 1" : "'FILL' 0",
                }}
              >
                {item.icon}
              </span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
