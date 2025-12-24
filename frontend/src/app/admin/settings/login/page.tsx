"use client";

/**
 * 登录配置页面 - 对接真实 API
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { getAdminToken } from "@/lib/api/admin";

interface LoginConfig {
  password_login_enabled: boolean;
  sms_login_enabled: boolean;
}

export default function LoginSettingsPage() {
  const [config, setConfig] = useState<LoginConfig>({
    password_login_enabled: true,
    sms_login_enabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const token = getAdminToken();
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/admin/settings/login`, { headers });
      if (res.ok) {
        const data = await res.json();
        setConfig({
          password_login_enabled: data.password_login_enabled ?? true,
          sms_login_enabled: data.sms_login_enabled ?? false,
        });
      }
    } catch (err) {
      console.error("加载配置失败", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const token = getAdminToken();
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
      const res = await fetch(`${API_BASE}/admin/settings/login`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(config),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "配置保存成功" });
        await fetchConfig();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.detail || "保存失败" });
      }
    } catch (err) {
      setMessage({ type: "error", text: "网络错误" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-text-muted mb-2">
          <Link href="/admin/settings" className="hover:text-text-primary">
            系统设置
          </Link>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span className="text-text-primary">登录配置</span>
        </div>
        <h1 className="text-2xl font-bold text-text-primary">登录配置</h1>
        <p className="text-text-secondary mt-1">管理登录方式和安全设置</p>
      </div>

      {/* Alert */}
      {message && (
        <div
          className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
            message.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
              : "bg-red-500/10 border border-red-500/30 text-red-400"
          }`}
        >
          <span className="material-symbols-outlined">
            {message.type === "success" ? "check_circle" : "error"}
          </span>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Login Methods */}
        <div className="bg-bg-card rounded-xl border border-border-default p-6 mb-6">
          <h2 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-violet-400">login</span>
            登录方式
          </h2>
          <div className="space-y-4">
            {[
              {
                key: "password_login_enabled",
                label: "密码登录",
                desc: "允许使用手机号+密码登录",
                icon: "password",
              },
              {
                key: "sms_login_enabled",
                label: "短信登录",
                desc: "允许使用短信验证码登录（需先配置短信服务）",
                icon: "sms",
              },
            ].map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between p-4 bg-bg-elevated rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-text-secondary">{item.icon}</span>
                  <div>
                    <p className="font-medium text-text-primary">{item.label}</p>
                    <p className="text-sm text-text-muted mt-0.5">{item.desc}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setConfig({
                      ...config,
                      [item.key]: !config[item.key as keyof LoginConfig],
                    })
                  }
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    config[item.key as keyof LoginConfig] ? "bg-violet-500" : "bg-bg-active"
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      config[item.key as keyof LoginConfig] ? "left-7" : "left-1"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Warning */}
        {!config.password_login_enabled && !config.sms_login_enabled && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-3">
            <span className="material-symbols-outlined">warning</span>
            至少需要启用一种登录方式
          </div>
        )}

        {/* SMS Notice */}
        {config.sms_login_enabled && (
          <div className="mb-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center gap-3">
            <span className="material-symbols-outlined">info</span>
            <div>
              短信登录需要先
              <Link href="/admin/settings/sms" className="underline ml-1">
                配置并启用短信服务
              </Link>
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Link
            href="/admin/settings"
            className="px-6 py-3 rounded-xl text-text-secondary hover:text-text-primary transition-colors"
          >
            取消
          </Link>
          <button
            type="submit"
            disabled={saving || (!config.password_login_enabled && !config.sms_login_enabled)}
            className="px-6 py-3 bg-violet-500 hover:bg-violet-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存配置"}
          </button>
        </div>
      </form>
    </div>
  );
}
