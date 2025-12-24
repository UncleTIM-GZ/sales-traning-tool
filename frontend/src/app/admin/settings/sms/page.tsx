"use client";

/**
 * 后台短信配置页面
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { getAdminToken } from "@/lib/api/admin";

interface SmsConfig {
  enabled: boolean;
  access_key_id: string;
  access_key_secret_masked?: string;
  sign_name: string;
  template_code: string;
}

export default function SmsSettingsPage() {
  const [config, setConfig] = useState<SmsConfig>({
    enabled: false,
    access_key_id: "",
    sign_name: "",
    template_code: "",
  });
  const [accessKeySecret, setAccessKeySecret] = useState("");
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
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch(`${API_BASE}/admin/settings/sms`, { headers });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
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
      const res = await fetch(`${API_BASE}/admin/settings/sms`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          enabled: config.enabled,
          access_key_id: config.access_key_id,
          access_key_secret: accessKeySecret,
          sign_name: config.sign_name,
          template_code: config.template_code,
        }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "配置保存成功" });
        setAccessKeySecret("");
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
          <span className="text-text-primary">短信配置</span>
        </div>
        <h1 className="text-2xl font-bold text-text-primary">短信配置</h1>
        <p className="text-text-secondary mt-1">
          配置阿里云短信服务，用于验证码登录功能
        </p>
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

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Enable Toggle */}
        <div className="bg-bg-card border border-border-default rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-text-primary font-medium">启用短信服务</h3>
              <p className="text-text-muted text-sm mt-1">
                启用后，用户可使用短信验证码登录
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConfig({ ...config, enabled: !config.enabled })}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                config.enabled ? "bg-violet-500" : "bg-bg-active"
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  config.enabled ? "left-7" : "left-1"
                }`}
              />
            </button>
          </div>
        </div>

        {/* API Credentials */}
        <div className="bg-bg-card border border-border-default rounded-2xl p-6 space-y-4">
          <h3 className="text-text-primary font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-violet-400">key</span>
            API 凭证
          </h3>

          <div>
            <label className="block text-sm text-text-secondary mb-2">
              AccessKey ID
            </label>
            <input
              type="text"
              value={config.access_key_id}
              onChange={(e) =>
                setConfig({ ...config, access_key_id: e.target.value })
              }
              className="w-full px-4 py-3 bg-bg-elevated border border-border-strong rounded-xl text-text-primary placeholder-zinc-500 focus:outline-none focus:border-violet-500"
              placeholder="LTAI5t..."
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-2">
              AccessKey Secret
              {config.access_key_secret_masked && (
                <span className="ml-2 text-text-muted">
                  (当前: {config.access_key_secret_masked})
                </span>
              )}
            </label>
            <input
              type="password"
              value={accessKeySecret}
              onChange={(e) => setAccessKeySecret(e.target.value)}
              className="w-full px-4 py-3 bg-bg-elevated border border-border-strong rounded-xl text-text-primary placeholder-zinc-500 focus:outline-none focus:border-violet-500"
              placeholder={
                config.access_key_secret_masked
                  ? "留空保持不变，或输入新密钥"
                  : "输入 AccessKey Secret"
              }
            />
          </div>
        </div>

        {/* SMS Template */}
        <div className="bg-bg-card border border-border-default rounded-2xl p-6 space-y-4">
          <h3 className="text-text-primary font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-violet-400">sms</span>
            短信模板
          </h3>

          <div>
            <label className="block text-sm text-text-secondary mb-2">
              签名名称
            </label>
            <input
              type="text"
              value={config.sign_name}
              onChange={(e) =>
                setConfig({ ...config, sign_name: e.target.value })
              }
              className="w-full px-4 py-3 bg-bg-elevated border border-border-strong rounded-xl text-text-primary placeholder-zinc-500 focus:outline-none focus:border-violet-500"
              placeholder="如：阿里云"
            />
            <p className="text-text-muted text-xs mt-1">
              在阿里云短信控制台创建的签名名称
            </p>
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-2">
              模板CODE
            </label>
            <input
              type="text"
              value={config.template_code}
              onChange={(e) =>
                setConfig({ ...config, template_code: e.target.value })
              }
              className="w-full px-4 py-3 bg-bg-elevated border border-border-strong rounded-xl text-text-primary placeholder-zinc-500 focus:outline-none focus:border-violet-500"
              placeholder="SMS_12345678"
            />
            <p className="text-text-muted text-xs mt-1">
              验证码模板，需包含 {"${code}"} 变量
            </p>
          </div>
        </div>

        {/* Help */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4">
          <div className="flex gap-3">
            <span className="material-symbols-outlined text-blue-400">info</span>
            <div className="text-sm text-text-primary">
              <p className="font-medium text-blue-400 mb-1">配置说明</p>
              <ol className="list-decimal list-inside space-y-1 text-text-secondary">
                <li>登录阿里云控制台，开通短信服务</li>
                <li>创建签名（需审核通过）</li>
                <li>创建验证码模板（需审核通过）</li>
                <li>获取 AccessKey 并填入上方</li>
              </ol>
              <a
                href="https://dysms.console.aliyun.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 mt-2"
              >
                前往阿里云短信控制台
                <span className="material-symbols-outlined text-sm">open_in_new</span>
              </a>
            </div>
          </div>
        </div>

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
            disabled={saving}
            className="px-6 py-3 bg-violet-500 hover:bg-violet-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存配置"}
          </button>
        </div>
      </form>
    </div>
  );
}
