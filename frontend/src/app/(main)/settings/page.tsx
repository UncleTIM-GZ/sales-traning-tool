"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { userApi, settingsApi, notificationApi, securityApi, NotificationSettings, PrivacySettings, NotificationPreference, LoginHistoryItem, TwoFactorStatus, AccountBinding } from "@/lib/api";
import { AvatarUpload } from "@/components/ui";

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout: storeLogout, updateUser, token } = useAuthStore();
  const [activeTab, setActiveTab] = useState("profile");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Profile form
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [selectedTrack, setSelectedTrack] = useState<"sales" | "social">("sales");

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  // Notification settings - 基础设置（老API）
  const [notifications, setNotifications] = useState<NotificationSettings>({
    training: true,
    report: true,
    community: false,
    marketing: false,
  });

  // Notification preferences - 新的通知偏好 API
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreference>({
    achievement_enabled: true,
    task_reminder_enabled: true,
    session_complete_enabled: true,
    community_enabled: true,
    system_enabled: true,
    daily_reminder_enabled: false,
    daily_reminder_time: null,
  });

  // Privacy settings
  const [privacy, setPrivacy] = useState<PrivacySettings>({
    show_profile: true,
    show_rank: true,
    show_activity: false,
  });

  // Security states
  const [loginHistory, setLoginHistory] = useState<LoginHistoryItem[]>([]);
  const [showLoginHistory, setShowLoginHistory] = useState(false);
  const [twoFactorStatus, setTwoFactorStatus] = useState<TwoFactorStatus | null>(null);
  const [showTwoFactorSetup, setShowTwoFactorSetup] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [accountBindings, setAccountBindings] = useState<AccountBinding[]>([]);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [showEmailBind, setShowEmailBind] = useState(false);
  const [bindEmail, setBindEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [unbindPassword, setUnbindPassword] = useState("");

  // 加载用户数据和设置
  useEffect(() => {
    if (user) {
      setNickname(user.nickname || "");
      setPhone(user.phone || "");
      setSelectedTrack(user.track || "sales");
    }
    
    // 加载设置
    loadSettings();
    loadSecurityData();
  }, [user]);

  const loadSecurityData = async () => {
    try {
      const [tfaStatus, bindingsResult] = await Promise.all([
        securityApi.getTwoFactorStatus(),
        securityApi.getBindings(),
      ]);
      setTwoFactorStatus(tfaStatus);
      setAccountBindings(bindingsResult.bindings);
    } catch (error) {
      console.error("Failed to load security data:", error);
    }
  };

  const loadSettings = async () => {
    try {
      // 加载基础设置
      const settings = await settingsApi.get();
      setBio(settings.bio || "");
      setNotifications(settings.notifications);
      setPrivacy(settings.privacy);
      
      // 加载通知偏好
      try {
        const prefs = await notificationApi.getPreferences();
        setNotifPrefs(prefs);
      } catch (err) {
        console.error("Failed to load notification preferences:", err);
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      // 保存昵称和头像
      const updatedUser = await userApi.updateMe({ nickname });
      // 保存bio
      await settingsApi.update({ bio });
      
      if (updateUser) {
        updateUser({ nickname: updatedUser.nickname });
      }
      setMessage({ type: "success", text: "保存成功" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "保存失败" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangeTrack = async (track: "sales" | "social") => {
    if (track === selectedTrack) return;
    
    setIsLoading(true);
    setMessage(null);
    try {
      await settingsApi.changeTrack(track);
      setSelectedTrack(track);
      if (updateUser) {
        updateUser({ track });
      }
      setMessage({ type: "success", text: `已切换到${track === "sales" ? "销冠培养" : "社恐脱敏"}赛道` });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "切换失败" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "两次密码输入不一致" });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ type: "error", text: "新密码至少6位" });
      return;
    }
    
    setIsLoading(true);
    setMessage(null);
    try {
      await settingsApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setMessage({ type: "success", text: "密码修改成功" });
      setShowPasswordForm(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "密码修改失败，请检查当前密码是否正确" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveNotifications = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      // 保存新的通知偏好设置
      await notificationApi.updatePreferences(notifPrefs);
      setMessage({ type: "success", text: "通知设置已保存" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "保存失败" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePrivacy = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      await settingsApi.update({ privacy });
      setMessage({ type: "success", text: "隐私设置已保存" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "保存失败" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    storeLogout();
    router.push("/login");
  };

  // ===== 安全功能 =====
  
  const handleViewLoginHistory = async () => {
    setIsLoading(true);
    try {
      const result = await securityApi.getLoginHistory(20);
      setLoginHistory(result.items);
      setShowLoginHistory(true);
    } catch (error) {
      setMessage({ type: "error", text: "加载登录记录失败" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnableTwoFactor = async () => {
    if (twoFactorCode.length !== 6) {
      setMessage({ type: "error", text: "请输入6位验证码" });
      return;
    }
    setIsLoading(true);
    setMessage(null);
    try {
      const result = await securityApi.enableTwoFactor("sms", twoFactorCode);
      setBackupCodes(result.backup_codes);
      setTwoFactorStatus({ ...twoFactorStatus!, is_enabled: true, method: "sms" });
      setMessage({ type: "success", text: "两步验证已开启，请保存备用码" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "开启失败" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisableTwoFactor = async () => {
    if (!currentPassword) {
      setMessage({ type: "error", text: "请输入密码" });
      return;
    }
    setIsLoading(true);
    setMessage(null);
    try {
      await securityApi.disableTwoFactor(currentPassword);
      setTwoFactorStatus({ ...twoFactorStatus!, is_enabled: false });
      setShowTwoFactorSetup(false);
      setCurrentPassword("");
      setMessage({ type: "success", text: "两步验证已关闭" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "关闭失败" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBindEmail = async () => {
    if (!bindEmail || emailCode.length !== 6) {
      setMessage({ type: "error", text: "请输入邮箱和6位验证码" });
      return;
    }
    setIsLoading(true);
    setMessage(null);
    try {
      await securityApi.bindEmail(bindEmail, emailCode);
      await loadSecurityData();
      setShowEmailBind(false);
      setBindEmail("");
      setEmailCode("");
      setMessage({ type: "success", text: "邮箱绑定成功" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "绑定失败" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnbind = async (bindingType: "wechat" | "enterprise_wechat" | "email") => {
    if (!unbindPassword) {
      setMessage({ type: "error", text: "请输入密码确认" });
      return;
    }
    setIsLoading(true);
    setMessage(null);
    try {
      await securityApi.unbind(bindingType, unbindPassword);
      await loadSecurityData();
      setUnbindPassword("");
      setMessage({ type: "success", text: "解绑成功" });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "解绑失败" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword || deleteConfirmation !== "确认注销") {
      setMessage({ type: "error", text: "请输入密码并输入'确认注销'确认操作" });
      return;
    }
    setIsLoading(true);
    setMessage(null);
    try {
      await securityApi.deleteAccount(deletePassword, deleteConfirmation);
      storeLogout();
      router.push("/login?deleted=1");
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "注销失败" });
      setIsLoading(false);
    }
  };

  // 切换tab时清除消息
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setMessage(null);
  };

  const tabs = [
    { key: "profile", label: "个人资料", icon: "person" },
    { key: "security", label: "账号安全", icon: "security" },
    { key: "notifications", label: "通知设置", icon: "notifications" },
    { key: "privacy", label: "隐私设置", icon: "shield" },
    { key: "bindAccount", label: "账号绑定", icon: "link" },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-text-primary mb-2">系统设置</h1>
        <p className="text-text-secondary">管理您的账户信息和偏好设置</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Tabs */}
        <div className="lg:col-span-1">
          <div className="bg-surface-card border border-border-dark rounded-xl p-2 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-lighter"
                }`}
              >
                <span className="material-symbols-outlined text-lg">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
            
            <div className="pt-2 mt-2 border-t border-border-dark">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all"
              >
                <span className="material-symbols-outlined text-lg">logout</span>
                退出登录
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          {activeTab === "profile" && (
            <div className="bg-surface-card border border-border-dark rounded-xl p-6">
              <h2 className="text-lg font-bold text-text-primary mb-6">个人资料</h2>
              
              {/* Avatar */}
              <div className="mb-8 pb-6 border-b border-border-dark">
                <AvatarUpload
                  currentAvatar={user?.avatar}
                  nickname={nickname || user?.nickname}
                  token={token || ""}
                  onUpload={async (url) => {
                    try {
                      await userApi.updateMe({ avatar: url });
                      if (updateUser) {
                        updateUser({ avatar: url });
                      }
                      setMessage({ type: "success", text: "头像更新成功" });
                    } catch (error) {
                      setMessage({ type: "error", text: "头像更新失败" });
                    }
                  }}
                />
              </div>

              {/* Form */}
              <div className="space-y-6">
                {message && (
                  <div className={`p-3 rounded-lg text-sm ${message.type === "success" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                    {message.text}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">昵称</label>
                    <input
                      type="text"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      className="w-full bg-surface-dark border border-border-dark rounded-lg py-2.5 px-4 text-white placeholder-gray-600 focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">手机号</label>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2")}
                        disabled
                        className="flex-1 bg-surface-dark border border-border-dark rounded-lg py-2.5 px-4 text-text-muted cursor-not-allowed"
                      />
                      <button className="px-4 text-sm font-medium text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/10 transition-colors">
                        更换
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">赛道</label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleChangeTrack("sales")}
                      disabled={isLoading}
                      className={`flex-1 p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedTrack === "sales" 
                          ? "bg-blue-500/10 border-blue-500/30 text-blue-400" 
                          : "bg-surface-dark border-border-dark text-text-secondary hover:border-zinc-500"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined">emoji_events</span>
                        <span className="font-medium">销冠培养</span>
                      </div>
                    </button>
                    <button
                      onClick={() => handleChangeTrack("social")}
                      disabled={isLoading}
                      className={`flex-1 p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedTrack === "social" 
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                          : "bg-surface-dark border-border-dark text-text-secondary hover:border-zinc-500"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined">psychology_alt</span>
                        <span className="font-medium">社恐脱敏</span>
                      </div>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">个人简介</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    placeholder="介绍一下自己吧..."
                    className="w-full bg-surface-dark border border-border-dark rounded-lg py-2.5 px-4 text-white placeholder-gray-600 focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all resize-none"
                  />
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="px-6 py-2.5 bg-blue-gradient text-white rounded-lg font-bold text-sm shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSaving && <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>}
                    保存修改
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="bg-surface-card border border-border-dark rounded-xl p-6">
              <h2 className="text-lg font-bold text-text-primary mb-6">账号安全</h2>
              
              {message && (
                <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === "success" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                  {message.text}
                </div>
              )}
              
              <div className="space-y-4">
                {/* Password */}
                <div className="p-4 bg-surface-dark rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-blue-500">lock</span>
                      </div>
                      <div>
                        <h4 className="font-medium text-text-primary">登录密码</h4>
                        <p className="text-xs text-text-muted mt-0.5">定期更改密码可以保护账号安全</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setShowPasswordForm(!showPasswordForm);
                        setMessage(null);
                      }}
                      className="px-4 py-2 text-sm font-medium text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/10 transition-colors"
                    >
                      {showPasswordForm ? "取消" : "修改密码"}
                    </button>
                  </div>
                  
                  {showPasswordForm && (
                    <div className="mt-4 pt-4 border-t border-border-dark space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-text-primary mb-2">当前密码</label>
                        <input
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full bg-background-dark border border-border-dark rounded-lg py-2.5 px-4 text-white placeholder-gray-600 focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                          placeholder="请输入当前密码"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-primary mb-2">新密码</label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full bg-background-dark border border-border-dark rounded-lg py-2.5 px-4 text-white placeholder-gray-600 focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                          placeholder="请输入新密码 (6-20位)"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-primary mb-2">确认新密码</label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full bg-background-dark border border-border-dark rounded-lg py-2.5 px-4 text-white placeholder-gray-600 focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                          placeholder="请再次输入新密码"
                        />
                      </div>
                      <button
                        onClick={handleChangePassword}
                        disabled={isLoading || !currentPassword || !newPassword || !confirmPassword}
                        className="px-6 py-2.5 bg-blue-gradient text-white rounded-lg font-bold text-sm shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all disabled:opacity-50 flex items-center gap-2"
                      >
                        {isLoading && <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>}
                        确认修改
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between p-4 bg-surface-dark rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-green-500">smartphone</span>
                    </div>
                    <div>
                      <h4 className="font-medium text-text-primary">手机绑定</h4>
                      <p className="text-xs text-text-muted mt-0.5">已绑定 {phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2")}</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 text-xs text-green-400">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    已验证
                  </span>
                </div>

                {/* Two-Factor */}
                <div className="p-4 bg-surface-dark rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${twoFactorStatus?.is_enabled ? 'bg-green-500/10' : 'bg-zinc-500/10'}`}>
                        <span className={`material-symbols-outlined ${twoFactorStatus?.is_enabled ? 'text-green-500' : 'text-text-secondary'}`}>verified_user</span>
                      </div>
                      <div>
                        <h4 className="font-medium text-text-primary">两步验证</h4>
                        <p className="text-xs text-text-muted mt-0.5">
                          {twoFactorStatus?.is_enabled 
                            ? `已开启 (${twoFactorStatus.method === 'sms' ? '短信验证' : twoFactorStatus.method})` 
                            : '开启后登录需要额外验证'}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowTwoFactorSetup(!showTwoFactorSetup)}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        twoFactorStatus?.is_enabled 
                          ? 'text-red-400 border border-red-500/20 hover:bg-red-500/10'
                          : 'text-blue-400 border border-blue-500/20 hover:bg-blue-500/10'
                      }`}
                    >
                      {twoFactorStatus?.is_enabled ? '关闭' : '开启'}
                    </button>
                  </div>
                  
                  {showTwoFactorSetup && (
                    <div className="mt-4 pt-4 border-t border-border-dark space-y-4">
                      {twoFactorStatus?.is_enabled ? (
                        <>
                          <p className="text-sm text-text-secondary">关闭两步验证需要验证您的密码</p>
                          <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full bg-surface-card border border-border-dark rounded-lg py-2.5 px-4 text-white placeholder-gray-600 focus:ring-1 focus:ring-blue-500/50"
                            placeholder="请输入登录密码"
                          />
                          <button
                            onClick={handleDisableTwoFactor}
                            disabled={isLoading}
                            className="px-4 py-2 bg-red-500/10 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
                          >
                            {isLoading ? '处理中...' : '确认关闭'}
                          </button>
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-text-secondary">我们将发送验证码到您的手机 {twoFactorStatus?.phone}</p>
                          <input
                            type="text"
                            value={twoFactorCode}
                            onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            className="w-full bg-surface-card border border-border-dark rounded-lg py-2.5 px-4 text-white placeholder-gray-600 focus:ring-1 focus:ring-blue-500/50"
                            placeholder="请输入6位验证码"
                            maxLength={6}
                          />
                          <button
                            onClick={handleEnableTwoFactor}
                            disabled={isLoading || twoFactorCode.length !== 6}
                            className="px-4 py-2 bg-blue-gradient text-white rounded-lg text-sm font-bold hover:shadow-blue-500/40 transition-all disabled:opacity-50"
                          >
                            {isLoading ? '处理中...' : '确认开启'}
                          </button>
                        </>
                      )}
                      
                      {backupCodes.length > 0 && (
                        <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                          <h5 className="font-medium text-yellow-400 mb-2">备用码（请妙善保存）</h5>
                          <div className="grid grid-cols-4 gap-2">
                            {backupCodes.map((code, i) => (
                              <code key={i} className="text-xs text-text-primary bg-surface-dark px-2 py-1 rounded">{code}</code>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Login History */}
                <div className="p-4 bg-surface-dark rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-blue-500">history</span>
                      </div>
                      <div>
                        <h4 className="font-medium text-text-primary">登录记录</h4>
                        <p className="text-xs text-text-muted mt-0.5">查看您的登录历史</p>
                      </div>
                    </div>
                    <button 
                      onClick={handleViewLoginHistory}
                      disabled={isLoading}
                      className="px-4 py-2 text-sm font-medium text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/10 transition-colors disabled:opacity-50"
                    >
                      {isLoading ? '加载中...' : '查看'}
                    </button>
                  </div>
                  
                  {showLoginHistory && loginHistory.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border-dark">
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {loginHistory.map((item) => (
                          <div key={item.id} className="flex items-center justify-between p-3 bg-surface-card rounded-lg">
                            <div className="flex items-center gap-3">
                              <span className={`material-symbols-outlined text-lg ${
                                item.device_type === 'mobile' ? 'text-blue-400' : 'text-text-secondary'
                              }`}>
                                {item.device_type === 'mobile' ? 'smartphone' : 'computer'}
                              </span>
                              <div>
                                <p className="text-sm text-text-primary">{item.device_name || '未知设备'}</p>
                                <p className="text-xs text-text-muted">{item.ip_address} - {item.location || '未知位置'}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`text-xs ${item.is_success ? 'text-green-400' : 'text-red-400'}`}>
                                {item.is_success ? '成功' : '失败'}
                              </p>
                              <p className="text-xs text-text-muted">
                                {new Date(item.created_at).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="bg-surface-card border border-border-dark rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-text-primary">通知设置</h2>
                <button
                  onClick={handleSaveNotifications}
                  disabled={isSaving}
                  className="px-4 py-2 bg-blue-gradient text-white rounded-lg font-bold text-sm shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isSaving && <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>}
                  保存
                </button>
              </div>
              
              {message && (
                <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === "success" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                  {message.text}
                </div>
              )}
              
              <div className="space-y-4">
                {/* 通知类型开关 */}
                {[
                  { key: "task_reminder_enabled", label: "训练提醒", desc: "接收每日训练任务提醒" },
                  { key: "session_complete_enabled", label: "训练完成", desc: "训练完成后接收分析报告通知" },
                  { key: "achievement_enabled", label: "成就解锁", desc: "获得新成就时接收通知" },
                  { key: "community_enabled", label: "社区互动", desc: "接收点赞、评论等社区通知" },
                  { key: "system_enabled", label: "系统公告", desc: "接收系统更新和新功能通知" },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between p-4 bg-surface-dark rounded-lg">
                    <div>
                      <h4 className="font-medium text-text-primary">{item.label}</h4>
                      <p className="text-xs text-text-muted mt-0.5">{item.desc}</p>
                    </div>
                    <label className="relative inline-flex cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifPrefs[item.key as keyof NotificationPreference] as boolean}
                        onChange={(e) => setNotifPrefs({ ...notifPrefs, [item.key]: e.target.checked })}
                        className="sr-only"
                      />
                      <div className={`w-11 h-6 rounded-full transition-colors ${
                        notifPrefs[item.key as keyof NotificationPreference] ? "bg-blue-500" : "bg-zinc-600"
                      }`}>
                        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                          notifPrefs[item.key as keyof NotificationPreference] ? "translate-x-5" : "translate-x-0.5"
                        }`} />
                      </div>
                    </label>
                  </div>
                ))}

                {/* 每日提醒设置 */}
                <div className="mt-6 pt-6 border-t border-border-dark">
                  <h3 className="font-medium text-text-primary mb-4">每日提醒</h3>
                  
                  <div className="flex items-center justify-between p-4 bg-surface-dark rounded-lg mb-4">
                    <div>
                      <h4 className="font-medium text-text-primary">开启每日提醒</h4>
                      <p className="text-xs text-text-muted mt-0.5">在指定时间提醒你进行训练</p>
                    </div>
                    <label className="relative inline-flex cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifPrefs.daily_reminder_enabled}
                        onChange={(e) => setNotifPrefs({ ...notifPrefs, daily_reminder_enabled: e.target.checked })}
                        className="sr-only"
                      />
                      <div className={`w-11 h-6 rounded-full transition-colors ${
                        notifPrefs.daily_reminder_enabled ? "bg-blue-500" : "bg-zinc-600"
                      }`}>
                        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                          notifPrefs.daily_reminder_enabled ? "translate-x-5" : "translate-x-0.5"
                        }`} />
                      </div>
                    </label>
                  </div>

                  {notifPrefs.daily_reminder_enabled && (
                    <div className="p-4 bg-surface-dark rounded-lg">
                      <label className="block text-sm font-medium text-text-primary mb-2">提醒时间</label>
                      <input
                        type="time"
                        value={notifPrefs.daily_reminder_time || "09:00"}
                        onChange={(e) => setNotifPrefs({ ...notifPrefs, daily_reminder_time: e.target.value })}
                        className="w-full sm:w-auto bg-background-dark border border-border-dark rounded-lg py-2.5 px-4 text-white focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "privacy" && (
            <div className="bg-surface-card border border-border-dark rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-text-primary">隐私设置</h2>
                <button
                  onClick={handleSavePrivacy}
                  disabled={isSaving}
                  className="px-4 py-2 bg-blue-gradient text-white rounded-lg font-bold text-sm shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isSaving && <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>}
                  保存
                </button>
              </div>
              
              {message && (
                <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === "success" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                  {message.text}
                </div>
              )}
              
              <div className="space-y-4">
                {[
                  { key: "show_profile", label: "公开个人资料", desc: "其他用户可以查看您的个人主页" },
                  { key: "show_rank", label: "显示排行榜排名", desc: "在排行榜中显示您的排名" },
                  { key: "show_activity", label: "公开训练动态", desc: "其他用户可以看到您的训练记录" },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between p-4 bg-surface-dark rounded-lg">
                    <div>
                      <h4 className="font-medium text-text-primary">{item.label}</h4>
                      <p className="text-xs text-text-muted mt-0.5">{item.desc}</p>
                    </div>
                    <label className="relative inline-flex cursor-pointer">
                      <input
                        type="checkbox"
                        checked={privacy[item.key as keyof PrivacySettings]}
                        onChange={(e) => setPrivacy({ ...privacy, [item.key]: e.target.checked })}
                        className="sr-only"
                      />
                      <div className={`w-11 h-6 rounded-full transition-colors ${
                        privacy[item.key as keyof PrivacySettings] ? "bg-blue-500" : "bg-zinc-600"
                      }`}>
                        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                          privacy[item.key as keyof PrivacySettings] ? "translate-x-5" : "translate-x-0.5"
                        }`} />
                      </div>
                    </label>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-border-dark">
                <h3 className="font-medium text-text-primary mb-4">危险操作</h3>
                <button 
                  onClick={() => setShowDeleteAccount(!showDeleteAccount)}
                  className="px-4 py-2 text-sm font-medium text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/10 transition-colors"
                >
                  注销账号
                </button>
                
                {showDeleteAccount && (
                  <div className="mt-4 p-4 bg-red-500/5 border border-red-500/20 rounded-lg space-y-4">
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-red-500 text-xl">warning</span>
                      <div>
                        <h4 className="font-medium text-red-400">警告：此操作不可恢复</h4>
                        <p className="text-sm text-text-secondary mt-1">
                          注销账号后，您的所有数据将被永久删除，包括训练记录、报告、成就等。
                        </p>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">请输入密码确认</label>
                      <input
                        type="password"
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        className="w-full bg-surface-card border border-border-dark rounded-lg py-2.5 px-4 text-white placeholder-gray-600 focus:ring-1 focus:ring-red-500/50"
                        placeholder="请输入登录密码"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">请输入 &quot;确认注销&quot; 确认操作</label>
                      <input
                        type="text"
                        value={deleteConfirmation}
                        onChange={(e) => setDeleteConfirmation(e.target.value)}
                        className="w-full bg-surface-card border border-border-dark rounded-lg py-2.5 px-4 text-white placeholder-gray-600 focus:ring-1 focus:ring-red-500/50"
                        placeholder="确认注销"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleDeleteAccount}
                        disabled={isLoading || !deletePassword || deleteConfirmation !== '确认注销'}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-bold hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isLoading ? '处理中...' : '确认注销'}
                      </button>
                      <button
                        onClick={() => {
                          setShowDeleteAccount(false);
                          setDeletePassword('');
                          setDeleteConfirmation('');
                        }}
                        className="px-4 py-2 text-sm font-medium text-text-secondary border border-border-dark rounded-lg hover:bg-surface-lighter transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "bindAccount" && (
            <div className="bg-surface-card border border-border-dark rounded-xl p-6">
              <h2 className="text-lg font-bold text-text-primary mb-6">账号绑定</h2>
              
              {message && (
                <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === "success" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                  {message.text}
                </div>
              )}
              
              <div className="space-y-4">
                {/* WeChat */}
                <div className="p-4 bg-surface-dark rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348z"/>
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-medium text-text-primary">微信</h4>
                        <p className={`text-xs mt-0.5 ${accountBindings.find(b => b.binding_type === 'wechat') ? 'text-green-400' : 'text-text-muted'}`}>
                          {accountBindings.find(b => b.binding_type === 'wechat') ? '已绑定' : '绑定后可使用微信登录'}
                        </p>
                      </div>
                    </div>
                    {accountBindings.find(b => b.binding_type === 'wechat') ? (
                      <button 
                        onClick={() => handleUnbind('wechat')}
                        className="px-4 py-2 text-sm font-medium text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/10 transition-colors"
                      >
                        解绑
                      </button>
                    ) : (
                      <button 
                        onClick={() => setMessage({ type: 'error', text: '微信绑定功能开发中，敬请期待' })}
                        className="px-4 py-2 text-sm font-medium text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/10 transition-colors"
                      >
                        绑定
                      </button>
                    )}
                  </div>
                </div>

                {/* Enterprise WeChat */}
                <div className="p-4 bg-surface-dark rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69z"/>
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-medium text-text-primary">企业微信</h4>
                        <p className={`text-xs mt-0.5 ${accountBindings.find(b => b.binding_type === 'enterprise_wechat') ? 'text-green-400' : 'text-text-muted'}`}>
                          {accountBindings.find(b => b.binding_type === 'enterprise_wechat') ? '已绑定' : '绑定后可使用企业微信登录'}
                        </p>
                      </div>
                    </div>
                    {accountBindings.find(b => b.binding_type === 'enterprise_wechat') ? (
                      <button 
                        onClick={() => handleUnbind('enterprise_wechat')}
                        className="px-4 py-2 text-sm font-medium text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/10 transition-colors"
                      >
                        解绑
                      </button>
                    ) : (
                      <button 
                        onClick={() => setMessage({ type: 'error', text: '企业微信绑定功能开发中，敬请期待' })}
                        className="px-4 py-2 text-sm font-medium text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/10 transition-colors"
                      >
                        绑定
                      </button>
                    )}
                  </div>
                </div>

                {/* Email */}
                <div className="p-4 bg-surface-dark rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-purple-500">mail</span>
                      </div>
                      <div>
                        <h4 className="font-medium text-text-primary">邮箱</h4>
                        <p className={`text-xs mt-0.5 ${accountBindings.find(b => b.binding_type === 'email') ? 'text-green-400' : 'text-text-muted'}`}>
                          {accountBindings.find(b => b.binding_type === 'email') 
                            ? `已绑定 ${accountBindings.find(b => b.binding_type === 'email')?.external_name}` 
                            : '绑定邮箱接收通知'}
                        </p>
                      </div>
                    </div>
                    {accountBindings.find(b => b.binding_type === 'email') ? (
                      <button 
                        onClick={() => handleUnbind('email')}
                        className="px-4 py-2 text-sm font-medium text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/10 transition-colors"
                      >
                        解绑
                      </button>
                    ) : (
                      <button 
                        onClick={() => setShowEmailBind(!showEmailBind)}
                        className="px-4 py-2 text-sm font-medium text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/10 transition-colors"
                      >
                        绑定
                      </button>
                    )}
                  </div>
                  
                  {showEmailBind && (
                    <div className="mt-4 pt-4 border-t border-border-dark space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-text-primary mb-2">邮箱地址</label>
                        <input
                          type="email"
                          value={bindEmail}
                          onChange={(e) => setBindEmail(e.target.value)}
                          className="w-full bg-surface-card border border-border-dark rounded-lg py-2.5 px-4 text-white placeholder-gray-600 focus:ring-1 focus:ring-blue-500/50"
                          placeholder="请输入邮箱地址"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-primary mb-2">验证码</label>
                        <input
                          type="text"
                          value={emailCode}
                          onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="w-full bg-surface-card border border-border-dark rounded-lg py-2.5 px-4 text-white placeholder-gray-600 focus:ring-1 focus:ring-blue-500/50"
                          placeholder="请输入6位验证码"
                          maxLength={6}
                        />
                      </div>
                      <button
                        onClick={handleBindEmail}
                        disabled={isLoading || !bindEmail || emailCode.length !== 6}
                        className="px-4 py-2 bg-blue-gradient text-white rounded-lg text-sm font-bold hover:shadow-blue-500/40 transition-all disabled:opacity-50"
                      >
                        {isLoading ? '处理中...' : '确认绑定'}
                      </button>
                    </div>
                  )}
                </div>
                
                {/* 解绑密码确认 */}
                {(accountBindings.length > 0) && (
                  <div className="mt-4 p-4 bg-surface-dark rounded-lg">
                    <label className="block text-sm font-medium text-text-primary mb-2">解绑需要验证密码</label>
                    <input
                      type="password"
                      value={unbindPassword}
                      onChange={(e) => setUnbindPassword(e.target.value)}
                      className="w-full bg-surface-card border border-border-dark rounded-lg py-2.5 px-4 text-white placeholder-gray-600 focus:ring-1 focus:ring-blue-500/50"
                      placeholder="请输入登录密码"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
