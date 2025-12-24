"use client";

/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：支付配置管理页面
 * 作用：管理微信支付、支付宝、微信登录配置
 * 创建时间：2025-12-24
 * 最后修改：2025-12-24
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  CreditCard, 
  Smartphone, 
  Save, 
  Eye, 
  EyeOff,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle
} from "lucide-react";
import { getAdminToken } from "@/lib/api/admin";

interface WechatPayConfig {
  enabled: boolean;
  mch_id: string;
  api_key_set: boolean;
  api_v3_key_set: boolean;
  serial_no: string;
  private_key_set: boolean;
  notify_url: string;
}

interface AlipayConfig {
  enabled: boolean;
  app_id: string;
  private_key_set: boolean;
  alipay_public_key_set: boolean;
  notify_url: string;
  return_url: string;
}

interface WechatLoginConfig {
  enabled: boolean;
  app_id: string;
  app_secret_set: boolean;
  redirect_uri: string;
  mp_enabled: boolean;
  mp_app_id: string;
  mp_app_secret_set: boolean;
}

type TabType = "wechat_pay" | "alipay" | "wechat_login";

export default function PaymentSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("wechat_pay");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 配置状态
  const [wechatPayConfig, setWechatPayConfig] = useState<WechatPayConfig | null>(null);
  const [alipayConfig, setAlipayConfig] = useState<AlipayConfig | null>(null);
  const [wechatLoginConfig, setWechatLoginConfig] = useState<WechatLoginConfig | null>(null);

  // 表单状态
  const [wechatPayForm, setWechatPayForm] = useState({
    enabled: false,
    mch_id: "",
    api_key: "",
    api_v3_key: "",
    serial_no: "",
    private_key: "",
    notify_url: "",
  });

  const [alipayForm, setAlipayForm] = useState({
    enabled: false,
    app_id: "",
    private_key: "",
    alipay_public_key: "",
    notify_url: "",
    return_url: "",
  });

  const [wechatLoginForm, setWechatLoginForm] = useState({
    enabled: false,
    app_id: "",
    app_secret: "",
    redirect_uri: "",
    mp_enabled: false,
    mp_app_id: "",
    mp_app_secret: "",
  });

  // 密码可见性
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchAllConfigs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getHeaders = () => {
    const token = getAdminToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  };

  const fetchAllConfigs = async () => {
    setLoading(true);
    try {
      const headers = getHeaders();
      const [wechatPayRes, alipayRes, wechatLoginRes] = await Promise.all([
        fetch("/api/v1/admin/settings/wechat-pay", { headers }),
        fetch("/api/v1/admin/settings/alipay", { headers }),
        fetch("/api/v1/admin/settings/wechat-login", { headers }),
      ]);

      if (wechatPayRes.ok) {
        const data = await wechatPayRes.json();
        setWechatPayConfig(data);
        setWechatPayForm({
          enabled: data.enabled,
          mch_id: data.mch_id || "",
          api_key: "",
          api_v3_key: "",
          serial_no: data.serial_no || "",
          private_key: "",
          notify_url: data.notify_url || "",
        });
      }

      if (alipayRes.ok) {
        const data = await alipayRes.json();
        setAlipayConfig(data);
        setAlipayForm({
          enabled: data.enabled,
          app_id: data.app_id || "",
          private_key: "",
          alipay_public_key: "",
          notify_url: data.notify_url || "",
          return_url: data.return_url || "",
        });
      }

      if (wechatLoginRes.ok) {
        const data = await wechatLoginRes.json();
        setWechatLoginConfig(data);
        setWechatLoginForm({
          enabled: data.enabled,
          app_id: data.app_id || "",
          app_secret: "",
          redirect_uri: data.redirect_uri || "",
          mp_enabled: data.mp_enabled,
          mp_app_id: data.mp_app_id || "",
          mp_app_secret: "",
        });
      }
    } catch {
      setMessage({ type: "error", text: "加载配置失败" });
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (type: TabType) => {
    setSaving(true);
    setMessage(null);
    try {
      const headers = getHeaders();
      let url = "";
      let body = {};

      switch (type) {
        case "wechat_pay":
          url = "/api/v1/admin/settings/wechat-pay";
          body = wechatPayForm;
          break;
        case "alipay":
          url = "/api/v1/admin/settings/alipay";
          body = alipayForm;
          break;
        case "wechat_login":
          url = "/api/v1/admin/settings/wechat-login";
          body = wechatLoginForm;
          break;
      }

      const res = await fetch(url, {
        method: "PUT",
        headers,
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "配置保存成功" });
        fetchAllConfigs();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.detail || "保存失败" });
      }
    } catch {
      setMessage({ type: "error", text: "保存失败，请重试" });
    } finally {
      setSaving(false);
    }
  };

  const toggleSecret = (key: string) => {
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const tabs = [
    { id: "wechat_pay" as TabType, label: "微信支付", icon: CreditCard },
    { id: "alipay" as TabType, label: "支付宝", icon: Smartphone },
    { id: "wechat_login" as TabType, label: "微信登录", icon: Smartphone },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/settings"
          className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          返回设置
        </Link>
        <h1 className="text-2xl font-bold text-text-primary">支付与登录配置</h1>
        <p className="text-text-secondary mt-1">
          配置微信支付、支付宝、微信登录等第三方服务
        </p>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`mb-4 p-4 rounded-xl flex items-center gap-2 ${
            message.type === "success"
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
              : "bg-red-500/15 text-red-400 border border-red-500/30"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-border-default pb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
              activeTab === tab.id
                ? "bg-violet-500/20 text-violet-400 border border-violet-500/30"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-subtle"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-bg-card border border-border-default rounded-2xl p-6">
        {activeTab === "wechat_pay" && (
          <WechatPayForm
            config={wechatPayConfig}
            form={wechatPayForm}
            setForm={setWechatPayForm}
            showSecrets={showSecrets}
            toggleSecret={toggleSecret}
            onSave={() => saveConfig("wechat_pay")}
            saving={saving}
          />
        )}
        {activeTab === "alipay" && (
          <AlipayForm
            config={alipayConfig}
            form={alipayForm}
            setForm={setAlipayForm}
            onSave={() => saveConfig("alipay")}
            saving={saving}
          />
        )}
        {activeTab === "wechat_login" && (
          <WechatLoginForm
            config={wechatLoginConfig}
            form={wechatLoginForm}
            setForm={setWechatLoginForm}
            showSecrets={showSecrets}
            toggleSecret={toggleSecret}
            onSave={() => saveConfig("wechat_login")}
            saving={saving}
          />
        )}
      </div>
    </div>
  );
}


// 微信支付表单组件
function WechatPayForm({
  config,
  form,
  setForm,
  showSecrets,
  toggleSecret,
  onSave,
  saving,
}: {
  config: WechatPayConfig | null;
  form: typeof WechatPayForm.arguments.form;
  setForm: (form: typeof WechatPayForm.arguments.form) => void;
  showSecrets: Record<string, boolean>;
  toggleSecret: (key: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-text-primary">微信支付配置</h3>
          <p className="text-sm text-text-muted">配置微信支付商户信息</p>
        </div>
        <div className="flex items-center gap-2">
          {config?.enabled ? (
            <span className="flex items-center gap-1 text-emerald-400 text-sm">
              <CheckCircle className="w-4 h-4" /> 已启用
            </span>
          ) : (
            <span className="flex items-center gap-1 text-text-muted text-sm">
              <XCircle className="w-4 h-4" /> 未启用
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-4">
        {/* 启用开关 */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            className="w-5 h-5 rounded border-border-default bg-bg-subtle text-violet-500 focus:ring-violet-500"
          />
          <span className="text-text-primary">启用微信支付</span>
        </label>

        {/* 商户号 */}
        <div>
          <label className="block text-sm text-text-secondary mb-2">商户号 (mch_id)</label>
          <input
            type="text"
            value={form.mch_id}
            onChange={(e) => setForm({ ...form, mch_id: e.target.value })}
            placeholder="请输入微信支付商户号"
            className="w-full px-4 py-3 bg-bg-subtle border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500"
          />
        </div>

        {/* API密钥 */}
        <div>
          <label className="block text-sm text-text-secondary mb-2">
            API密钥 {config?.api_key_set && <span className="text-emerald-400">(已设置)</span>}
          </label>
          <div className="relative">
            <input
              type={showSecrets["api_key"] ? "text" : "password"}
              value={form.api_key}
              onChange={(e) => setForm({ ...form, api_key: e.target.value })}
              placeholder={config?.api_key_set ? "留空保持原值" : "请输入API密钥"}
              className="w-full px-4 py-3 pr-12 bg-bg-subtle border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500"
            />
            <button
              type="button"
              onClick={() => toggleSecret("api_key")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              {showSecrets["api_key"] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* APIv3密钥 */}
        <div>
          <label className="block text-sm text-text-secondary mb-2">
            APIv3密钥 {config?.api_v3_key_set && <span className="text-emerald-400">(已设置)</span>}
          </label>
          <div className="relative">
            <input
              type={showSecrets["api_v3_key"] ? "text" : "password"}
              value={form.api_v3_key}
              onChange={(e) => setForm({ ...form, api_v3_key: e.target.value })}
              placeholder={config?.api_v3_key_set ? "留空保持原值" : "请输入APIv3密钥"}
              className="w-full px-4 py-3 pr-12 bg-bg-subtle border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500"
            />
            <button
              type="button"
              onClick={() => toggleSecret("api_v3_key")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              {showSecrets["api_v3_key"] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* 证书序列号 */}
        <div>
          <label className="block text-sm text-text-secondary mb-2">证书序列号</label>
          <input
            type="text"
            value={form.serial_no}
            onChange={(e) => setForm({ ...form, serial_no: e.target.value })}
            placeholder="请输入证书序列号"
            className="w-full px-4 py-3 bg-bg-subtle border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500"
          />
        </div>

        {/* 商户私钥 */}
        <div>
          <label className="block text-sm text-text-secondary mb-2">
            商户私钥 (PEM格式) {config?.private_key_set && <span className="text-emerald-400">(已设置)</span>}
          </label>
          <textarea
            value={form.private_key}
            onChange={(e) => setForm({ ...form, private_key: e.target.value })}
            placeholder={config?.private_key_set ? "留空保持原值" : "请输入商户私钥"}
            rows={4}
            className="w-full px-4 py-3 bg-bg-subtle border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500 font-mono text-sm"
          />
        </div>

        {/* 回调地址 */}
        <div>
          <label className="block text-sm text-text-secondary mb-2">支付回调地址</label>
          <input
            type="text"
            value={form.notify_url}
            onChange={(e) => setForm({ ...form, notify_url: e.target.value })}
            placeholder="https://your-domain.com/api/v1/payment/wechat/notify"
            className="w-full px-4 py-3 bg-bg-subtle border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500"
          />
        </div>
      </div>

      {/* 保存按钮 */}
      <div className="flex justify-end pt-4 border-t border-border-default">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-violet-500 hover:bg-violet-600 text-white rounded-xl transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          保存配置
        </button>
      </div>
    </div>
  );
}

// 支付宝表单组件
function AlipayForm({
  config,
  form,
  setForm,
  onSave,
  saving,
}: {
  config: AlipayConfig | null;
  form: {
    enabled: boolean;
    app_id: string;
    private_key: string;
    alipay_public_key: string;
    notify_url: string;
    return_url: string;
  };
  setForm: (form: {
    enabled: boolean;
    app_id: string;
    private_key: string;
    alipay_public_key: string;
    notify_url: string;
    return_url: string;
  }) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-text-primary">支付宝配置</h3>
          <p className="text-sm text-text-muted">配置支付宝应用信息</p>
        </div>
        <div className="flex items-center gap-2">
          {config?.enabled ? (
            <span className="flex items-center gap-1 text-emerald-400 text-sm">
              <CheckCircle className="w-4 h-4" /> 已启用
            </span>
          ) : (
            <span className="flex items-center gap-1 text-text-muted text-sm">
              <XCircle className="w-4 h-4" /> 未启用
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-4">
        {/* 启用开关 */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            className="w-5 h-5 rounded border-border-default bg-bg-subtle text-violet-500 focus:ring-violet-500"
          />
          <span className="text-text-primary">启用支付宝支付</span>
        </label>

        {/* 应用ID */}
        <div>
          <label className="block text-sm text-text-secondary mb-2">应用ID (app_id)</label>
          <input
            type="text"
            value={form.app_id}
            onChange={(e) => setForm({ ...form, app_id: e.target.value })}
            placeholder="请输入支付宝应用ID"
            className="w-full px-4 py-3 bg-bg-subtle border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500"
          />
        </div>

        {/* 应用私钥 */}
        <div>
          <label className="block text-sm text-text-secondary mb-2">
            应用私钥 (PEM格式) {config?.private_key_set && <span className="text-emerald-400">(已设置)</span>}
          </label>
          <textarea
            value={form.private_key}
            onChange={(e) => setForm({ ...form, private_key: e.target.value })}
            placeholder={config?.private_key_set ? "留空保持原值" : "请输入应用私钥"}
            rows={4}
            className="w-full px-4 py-3 bg-bg-subtle border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500 font-mono text-sm"
          />
        </div>

        {/* 支付宝公钥 */}
        <div>
          <label className="block text-sm text-text-secondary mb-2">
            支付宝公钥 (PEM格式) {config?.alipay_public_key_set && <span className="text-emerald-400">(已设置)</span>}
          </label>
          <textarea
            value={form.alipay_public_key}
            onChange={(e) => setForm({ ...form, alipay_public_key: e.target.value })}
            placeholder={config?.alipay_public_key_set ? "留空保持原值" : "请输入支付宝公钥"}
            rows={4}
            className="w-full px-4 py-3 bg-bg-subtle border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500 font-mono text-sm"
          />
        </div>

        {/* 回调地址 */}
        <div>
          <label className="block text-sm text-text-secondary mb-2">支付回调地址</label>
          <input
            type="text"
            value={form.notify_url}
            onChange={(e) => setForm({ ...form, notify_url: e.target.value })}
            placeholder="https://your-domain.com/api/v1/payment/alipay/notify"
            className="w-full px-4 py-3 bg-bg-subtle border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500"
          />
        </div>

        {/* 跳转地址 */}
        <div>
          <label className="block text-sm text-text-secondary mb-2">支付成功跳转地址</label>
          <input
            type="text"
            value={form.return_url}
            onChange={(e) => setForm({ ...form, return_url: e.target.value })}
            placeholder="https://your-domain.com/payment/success"
            className="w-full px-4 py-3 bg-bg-subtle border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500"
          />
        </div>
      </div>

      {/* 保存按钮 */}
      <div className="flex justify-end pt-4 border-t border-border-default">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-violet-500 hover:bg-violet-600 text-white rounded-xl transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          保存配置
        </button>
      </div>
    </div>
  );
}

// 微信登录表单组件
function WechatLoginForm({
  config,
  form,
  setForm,
  showSecrets,
  toggleSecret,
  onSave,
  saving,
}: {
  config: WechatLoginConfig | null;
  form: typeof WechatLoginForm.arguments.form;
  setForm: (form: typeof WechatLoginForm.arguments.form) => void;
  showSecrets: Record<string, boolean>;
  toggleSecret: (key: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-text-primary">微信登录配置</h3>
          <p className="text-sm text-text-muted">配置微信开放平台和公众号登录</p>
        </div>
        <div className="flex items-center gap-2">
          {config?.enabled ? (
            <span className="flex items-center gap-1 text-emerald-400 text-sm">
              <CheckCircle className="w-4 h-4" /> 已启用
            </span>
          ) : (
            <span className="flex items-center gap-1 text-text-muted text-sm">
              <XCircle className="w-4 h-4" /> 未启用
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-4">
        {/* 启用开关 */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            className="w-5 h-5 rounded border-border-default bg-bg-subtle text-violet-500 focus:ring-violet-500"
          />
          <span className="text-text-primary">启用微信登录</span>
        </label>

        <div className="p-4 bg-bg-subtle rounded-xl border border-border-default">
          <h4 className="text-text-primary font-medium mb-4">微信开放平台 (PC扫码登录)</h4>
          
          {/* AppID */}
          <div className="mb-4">
            <label className="block text-sm text-text-secondary mb-2">AppID</label>
            <input
              type="text"
              value={form.app_id}
              onChange={(e) => setForm({ ...form, app_id: e.target.value })}
              placeholder="请输入微信开放平台AppID"
              className="w-full px-4 py-3 bg-bg-card border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500"
            />
          </div>

          {/* AppSecret */}
          <div className="mb-4">
            <label className="block text-sm text-text-secondary mb-2">
              AppSecret {config?.app_secret_set && <span className="text-emerald-400">(已设置)</span>}
            </label>
            <div className="relative">
              <input
                type={showSecrets["app_secret"] ? "text" : "password"}
                value={form.app_secret}
                onChange={(e) => setForm({ ...form, app_secret: e.target.value })}
                placeholder={config?.app_secret_set ? "留空保持原值" : "请输入AppSecret"}
                className="w-full px-4 py-3 pr-12 bg-bg-card border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500"
              />
              <button
                type="button"
                onClick={() => toggleSecret("app_secret")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                {showSecrets["app_secret"] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* 回调地址 */}
          <div>
            <label className="block text-sm text-text-secondary mb-2">授权回调地址</label>
            <input
              type="text"
              value={form.redirect_uri}
              onChange={(e) => setForm({ ...form, redirect_uri: e.target.value })}
              placeholder="https://your-domain.com/api/v1/auth/wechat/callback"
              className="w-full px-4 py-3 bg-bg-card border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500"
            />
          </div>
        </div>

        {/* 公众号配置 */}
        <div className="p-4 bg-bg-subtle rounded-xl border border-border-default">
          <label className="flex items-center gap-3 cursor-pointer mb-4">
            <input
              type="checkbox"
              checked={form.mp_enabled}
              onChange={(e) => setForm({ ...form, mp_enabled: e.target.checked })}
              className="w-5 h-5 rounded border-border-default bg-bg-card text-violet-500 focus:ring-violet-500"
            />
            <span className="text-text-primary font-medium">启用公众号登录 (微信内网页)</span>
          </label>

          {form.mp_enabled && (
            <>
              {/* 公众号AppID */}
              <div className="mb-4">
                <label className="block text-sm text-text-secondary mb-2">公众号AppID</label>
                <input
                  type="text"
                  value={form.mp_app_id}
                  onChange={(e) => setForm({ ...form, mp_app_id: e.target.value })}
                  placeholder="请输入公众号AppID"
                  className="w-full px-4 py-3 bg-bg-card border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500"
                />
              </div>

              {/* 公众号AppSecret */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  公众号AppSecret {config?.mp_app_secret_set && <span className="text-emerald-400">(已设置)</span>}
                </label>
                <div className="relative">
                  <input
                    type={showSecrets["mp_app_secret"] ? "text" : "password"}
                    value={form.mp_app_secret}
                    onChange={(e) => setForm({ ...form, mp_app_secret: e.target.value })}
                    placeholder={config?.mp_app_secret_set ? "留空保持原值" : "请输入公众号AppSecret"}
                    className="w-full px-4 py-3 pr-12 bg-bg-card border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500"
                  />
                  <button
                    type="button"
                    onClick={() => toggleSecret("mp_app_secret")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                  >
                    {showSecrets["mp_app_secret"] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 保存按钮 */}
      <div className="flex justify-end pt-4 border-t border-border-default">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-violet-500 hover:bg-violet-600 text-white rounded-xl transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          保存配置
        </button>
      </div>
    </div>
  );
}
