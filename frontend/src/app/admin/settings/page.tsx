"use client";

/**
 * 后台系统设置首页
 */

import Link from "next/link";
import { useState, useEffect } from "react";
import { getAdminToken } from "@/lib/api/admin";

interface SettingCard {
  title: string;
  description: string;
  href: string;
  icon: string;
  status?: "enabled" | "disabled" | "configured" | "not_configured";
  statusText?: string;
}

export default function AdminSettingsPage() {
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [loginConfig, setLoginConfig] = useState<{
    password_login_enabled: boolean;
    sms_login_enabled: boolean;
  } | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<{
    wechat_pay_enabled: boolean;
    alipay_enabled: boolean;
    wechat_login_enabled: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const token = getAdminToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      
      // 并行获取短信、登录和支付配置
      const [smsRes, loginRes, paymentRes] = await Promise.all([
        fetch("/api/v1/admin/settings/sms", { headers }),
        fetch("/api/v1/admin/settings/login", { headers }),
        fetch("/api/v1/admin/settings/payment", { headers }),
      ]);
      
      if (smsRes.ok) {
        const data = await smsRes.json();
        setSmsEnabled(data.enabled);
      }
      if (loginRes.ok) {
        const data = await loginRes.json();
        setLoginConfig(data);
      }
      if (paymentRes.ok) {
        const data = await paymentRes.json();
        setPaymentConfig({
          wechat_pay_enabled: data.wechat_pay?.enabled || false,
          alipay_enabled: data.alipay?.enabled || false,
          wechat_login_enabled: data.wechat_login?.enabled || false,
        });
      }
    } catch (err) {
      console.error("加载状态失败", err);
    } finally {
      setLoading(false);
    }
  };

  const getLoginStatusText = () => {
    if (!loginConfig) return "加载中...";
    const methods = [];
    if (loginConfig.password_login_enabled) methods.push("密码");
    if (loginConfig.sms_login_enabled) methods.push("短信");
    return methods.length > 0 ? `已启用: ${methods.join("+")}` : "未配置";
  };

  const getPaymentStatusText = () => {
    if (!paymentConfig) return "加载中...";
    const methods = [];
    if (paymentConfig.wechat_pay_enabled) methods.push("微信");
    if (paymentConfig.alipay_enabled) methods.push("支付宝");
    if (paymentConfig.wechat_login_enabled) methods.push("微信登录");
    return methods.length > 0 ? `已启用: ${methods.join("+")}` : "未配置";
  };

  const settings: SettingCard[] = [
    {
      title: "短信服务",
      description: "配置阿里云短信服务，启用验证码登录功能",
      href: "/admin/settings/sms",
      icon: "sms",
      status: smsEnabled ? "enabled" : "disabled",
      statusText: smsEnabled ? "已启用" : "未启用",
    },
    {
      title: "登录配置",
      description: "配置登录方式：短信登录、密码登录",
      href: "/admin/settings/login",
      icon: "login",
      status: "configured",
      statusText: getLoginStatusText(),
    },
    {
      title: "支付与登录",
      description: "配置微信支付、支付宝、微信登录等第三方服务",
      href: "/admin/settings/payment",
      icon: "payments",
      status: paymentConfig?.wechat_pay_enabled || paymentConfig?.alipay_enabled ? "enabled" : "disabled",
      statusText: getPaymentStatusText(),
    },
    {
      title: "积分消耗",
      description: "配置对话训练的积分消耗规则、免费次数和VIP折扣",
      href: "/admin/settings/points",
      icon: "toll",
      status: "configured",
      statusText: "已配置",
    },
    {
      title: "签到配置",
      description: "配置每日签到的积分奖励规则和连续签到奖励",
      href: "/admin/settings/checkin",
      icon: "event_available",
      status: "configured",
      statusText: "已配置",
    },
  ];

  const getStatusStyle = (status?: string) => {
    switch (status) {
      case "enabled":
        return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
      case "disabled":
        return "bg-zinc-500/15 text-text-secondary border-zinc-500/30";
      case "configured":
        return "bg-blue-500/15 text-blue-400 border-blue-500/30";
      default:
        return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">系统设置</h1>
        <p className="text-text-secondary mt-1">
          管理系统配置、短信服务、登录方式等
        </p>
      </div>

      {/* Settings Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {settings.map((setting) => (
          <Link
            key={setting.href}
            href={setting.href}
            className="group relative bg-bg-card border border-border-default rounded-2xl p-6 hover:border-violet-500/50 transition-all"
          >
            {/* Icon */}
            <div className="w-12 h-12 rounded-xl bg-violet-500/15 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-2xl text-violet-400">
                {setting.icon}
              </span>
            </div>

            {/* Content */}
            <h3 className="text-text-primary font-medium mb-1">{setting.title}</h3>
            <p className="text-text-muted text-sm">{setting.description}</p>

            {/* Status Badge */}
            {setting.status && (
              <div
                className={`absolute top-4 right-4 px-2 py-1 rounded-lg text-xs border ${getStatusStyle(
                  setting.status
                )}`}
              >
                {loading ? "..." : setting.statusText}
              </div>
            )}

            {/* Arrow */}
            <span className="absolute bottom-4 right-4 text-text-muted group-hover:text-violet-400 transition-colors">
              <span className="material-symbols-outlined">arrow_forward</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
