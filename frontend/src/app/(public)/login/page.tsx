"use client";

import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { authApi, wechatAuthApi } from "@/lib/api";
import { toast } from "@/hooks/useToast";

type LoginMode = "password" | "sms";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);

  // 登录配置
  const [loginConfig, setLoginConfig] = useState<{
    sms_login_enabled: boolean;
    password_login_enabled: boolean;
  }>({ sms_login_enabled: false, password_login_enabled: true });
  const [configLoading, setConfigLoading] = useState(true);

  // 登录模式
  const [mode, setMode] = useState<LoginMode>("password");

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [expiredNotice, setExpiredNotice] = useState(false);
  
  // 微信登录配置
  const [wechatEnabled, setWechatEnabled] = useState(false);
  const [wechatLoading, setWechatLoading] = useState(false);

  // 检查是否是 token 过期跳转
  useEffect(() => {
    if (searchParams.get("expired") === "1") {
      setExpiredNotice(true);
      // 3秒后自动消失
      setTimeout(() => setExpiredNotice(false), 5000);
    }
    
    // 处理微信登录回调
    const token = searchParams.get("token");
    const wechatLogin = searchParams.get("wechat_login");
    const newUser = searchParams.get("new_user");
    const wechatError = searchParams.get("error");
    
    if (wechatError) {
      setError(`微信登录失败: ${wechatError}`);
    } else if (token && wechatLogin) {
      // 微信登录成功，获取用户信息
      handleWechatLoginSuccess(token, newUser === "1");
    }
  }, [searchParams]);

  // 获取登录配置
  useEffect(() => {
    const fetchLoginConfig = async () => {
      try {
        const res = await fetch(`/api/v1/admin/public/login-config`);
        if (res.ok) {
          const config = await res.json();
          setLoginConfig(config);
          // 如果只启用了短信登录，默认切换到短信模式
          if (config.sms_login_enabled && !config.password_login_enabled) {
            setMode("sms");
          }
        }
        
        // 获取微信登录配置
        const wechatConfig = await wechatAuthApi.getConfig();
        setWechatEnabled(wechatConfig.wechat_enabled || wechatConfig.wechat_mp_enabled);
      } catch (err) {
        // 忽略配置加载失败，使用默认配置
        console.debug("使用默认登录配置");
      } finally {
        setConfigLoading(false);
      }
    };
    fetchLoginConfig();
  }, []);
  
  // 处理微信登录成功
  const handleWechatLoginSuccess = async (token: string, isNewUser: boolean) => {
    try {
      // 获取用户信息
      const res = await fetch("/api/v1/auth/me", {
        headers: { "Authorization": `Bearer ${token}` },
      });
      
      if (res.ok) {
        const user = await res.json();
        setAuth(
          {
            id: user.id,
            phone: user.phone,
            nickname: user.nickname,
            avatar: user.avatar,
            track: user.track,
            role: user.role,
            level: user.level,
          },
          token
        );
        
        // 新用户跳转到引导页
        if (isNewUser) {
          router.push("/onboarding");
        } else {
          const redirect = searchParams.get("redirect") || "/dashboard";
          router.push(redirect);
        }
      }
    } catch (err) {
      setError("获取用户信息失败");
    }
  };
  
  // 微信登录
  const handleWechatLogin = async () => {
    setWechatLoading(true);
    setError("");
    
    try {
      // 检测是否在微信浏览器内
      const isWechat = /MicroMessenger/i.test(navigator.userAgent);
      const redirect = searchParams.get("redirect") || "/dashboard";
      
      const result = await wechatAuthApi.getLoginUrl(
        `${window.location.origin}/login?redirect=${encodeURIComponent(redirect)}`,
        isWechat
      );
      
      // 跳转到微信授权页
      window.location.href = result.authorize_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取微信登录链接失败");
      setWechatLoading(false);
    }
  };

  // 倒计时
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // 发送验证码
  const handleSendCode = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      toast.warning("请输入正确的手机号");
      return;
    }

    setIsSending(true);
    setError("");

    try {
      const res = await fetch("/api/v1/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, purpose: "login" }),
      });

      if (res.ok) {
        setCountdown(60);
        toast.success("验证码已发送");
        const data = await res.json();
        // 开发模式显示验证码
        if (data.code) {
          toast.info(`开发模式，验证码: ${data.code}`, { duration: 10000 });
        }
      } else {
        const data = await res.json();
        toast.error(data.detail || "发送失败");
      }
    } catch (err) {
      toast.error("网络错误，请检查网络连接");
    } finally {
      setIsSending(false);
    }
  };

  // 检查 onboarding 状态并重定向
  const checkOnboardingAndRedirect = async (accessToken: string, defaultRedirect: string) => {
    try {
      const res = await fetch("/api/v1/users/me/onboarding-status", {
        headers: { "Authorization": `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const status = await res.json();
        if (!status.onboarding_completed) {
          router.push("/onboarding");
          return;
        }
        if (!status.baseline_completed) {
          router.push("/baseline");
          return;
        }
      }
    } catch (err) {
      console.error("检查引导状态失败", err);
    }
    router.push(defaultRedirect);
  };

  // 密码登录
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      setError("请输入正确的手机号");
      return;
    }
    if (!password) {
      setError("请输入密码");
      return;
    }

    setIsLoading(true);

    try {
      const response = await authApi.login({ phone, password });

      // 先设置状态
      setAuth(
        {
          id: response.user.id,
          phone: response.user.phone,
          nickname: response.user.nickname,
          avatar: response.user.avatar,
          track: response.user.track,
          role: response.user.role,
          level: response.user.level,
        },
        response.access_token
      );

      // 确保新 token 写入 localStorage，增加超时保护
      const newToken = response.access_token;
      const waitForStorage = () => {
        return new Promise<void>((resolve) => {
          const startTime = Date.now();
          const maxWait = 2000; // 最多等待 2 秒
          
          const check = () => {
            // 超时保护
            if (Date.now() - startTime > maxWait) {
              console.warn('Storage sync timeout, proceeding anyway');
              resolve();
              return;
            }
            
            const stored = localStorage.getItem('auth-storage');
            if (stored) {
              try {
                const data = JSON.parse(stored);
                if (data.state?.token === newToken) {
                  resolve();
                  return;
                }
              } catch (e) {
                // 解析失败，继续等待
              }
            }
            setTimeout(check, 50); // 增加检查间隔，减少 CPU 占用
          };
          check();
        });
      };
      await waitForStorage();
      
      // 强制刷新一次 localStorage 确保同步
      const currentState = useAuthStore.getState();
      localStorage.setItem('auth-storage', JSON.stringify({
        state: {
          user: currentState.user,
          token: currentState.token,
          isAuthenticated: currentState.isAuthenticated,
          vipStatus: currentState.vipStatus,
          pointsBalance: currentState.pointsBalance,
        },
        version: 0,
      }));

      const redirect = searchParams.get("redirect") || "/dashboard";

      // 管理员登录跳转后台
      if (response.user.role === 'admin' && redirect === '/admin') {
        router.push(redirect);
        return;
      }

      await checkOnboardingAndRedirect(response.access_token, redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  };

  // 短信登录
  const handleSmsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      setError("请输入正确的手机号");
      return;
    }
    if (!code || code.length !== 6) {
      setError("请输入 6 位验证码");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/v1/auth/login/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "登录失败");
      }

      const response = await res.json();

      setAuth(
        {
          id: response.user.id,
          phone: response.user.phone,
          nickname: response.user.nickname,
          avatar: response.user.avatar,
          track: response.user.track,
          role: response.user.role,
          level: response.user.level,
        },
        response.access_token
      );

      const redirect = searchParams.get("redirect") || "/dashboard";
      await checkOnboardingAndRedirect(response.access_token, redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  };

  const showTabs = loginConfig.sms_login_enabled && loginConfig.password_login_enabled;

  return (
    <div className="min-h-screen bg-background-dark flex">
      {/* Left - Form */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-20 py-12">
        <div className="w-full max-w-md mx-auto">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 mb-12">
            <div className="bg-[var(--brand-gradient)] p-0.5 rounded-lg shadow-lg shadow-[var(--shadow-glow)]">
              <div className="bg-surface-dark p-1.5 rounded-[6px] flex items-center justify-center">
                <span className="material-symbols-outlined text-text-primary text-xl">psychology</span>
              </div>
            </div>
            <h1 className="text-lg font-bold text-text-primary">AI 智训 <span className="text-blue-400 italic">Pro</span></h1>
          </Link>

          <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mb-2">欢迎回来</h2>
          <p className="text-text-secondary mb-8">登录您的账户，继续您的学习之旅</p>

          {/* Login Mode Tabs */}
          {showTabs && (
            <div className="flex mb-6 p-1 bg-surface-card rounded-lg border border-border-dark">
              <button
                type="button"
                onClick={() => setMode("password")}
                className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-all ${mode === "password"
                  ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                  : "text-text-secondary hover:text-text-primary"
                  }`}
              >
                密码登录
              </button>
              <button
                type="button"
                onClick={() => setMode("sms")}
                className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-all ${mode === "sms"
                  ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                  : "text-text-secondary hover:text-text-primary"
                  }`}
              >
                短信登录
              </button>
            </div>
          )}

          {/* 登录过期提示 */}
          {expiredNotice && (
            <div className="mb-6 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">schedule</span>
              登录已过期，请重新登录
            </div>
          )}

          {error && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">error</span>
              {error}
            </div>
          )}

          {/* Password Login Form */}
          {mode === "password" && (
            <form onSubmit={handlePasswordLogin} className="space-y-6">
              {/* Phone Input */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">手机号</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">+86</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                    placeholder="请输入手机号"
                    className="w-full bg-surface-card border border-border-dark rounded-lg py-3 pl-14 pr-4 text-white placeholder-zinc-600 focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-text-primary">密码</label>
                  <Link href="/forgot-password" className="text-xs text-blue-500 hover:text-blue-400 transition-colors">
                    忘记密码？
                  </Link>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="w-full bg-surface-card border border-border-dark rounded-lg py-3 px-4 text-white placeholder-zinc-600 focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-gradient text-white py-3 rounded-lg font-bold text-sm shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                    登录中...
                  </>
                ) : (
                  "登录"
                )}
              </button>
            </form>
          )}

          {/* SMS Login Form */}
          {mode === "sms" && (
            <form onSubmit={handleSmsLogin} className="space-y-6">
              {/* Phone Input */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">手机号</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">+86</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                    placeholder="请输入手机号"
                    className="w-full bg-surface-card border border-border-dark rounded-lg py-3 pl-14 pr-4 text-white placeholder-zinc-600 focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  />
                </div>
              </div>

              {/* Verification Code */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">验证码</label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="请输入6位验证码"
                    className="flex-1 bg-surface-card border border-border-dark rounded-lg py-3 px-4 text-white placeholder-zinc-600 focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={countdown > 0 || isSending}
                    className="px-5 bg-surface-card border border-border-dark rounded-lg text-sm font-medium text-blue-400 hover:text-blue-300 hover:border-blue-500/50 transition-all disabled:text-text-muted disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {isSending ? "发送中..." : countdown > 0 ? `${countdown}s` : "获取验证码"}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-gradient text-white py-3 rounded-lg font-bold text-sm shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                    登录中...
                  </>
                ) : (
                  "登录"
                )}
              </button>
            </form>
          )}

          {/* Divider */}
          <div className="flex items-center my-8">
            <div className="flex-1 h-px bg-border-dark"></div>
            <span className="px-4 text-xs text-text-muted">或使用以下方式登录</span>
            <div className="flex-1 h-px bg-border-dark"></div>
          </div>

          {/* Social Login */}
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={handleWechatLogin}
              disabled={!wechatEnabled || wechatLoading}
              className="flex items-center justify-center gap-2 py-3 px-4 bg-surface-card border border-border-dark rounded-lg hover:bg-surface-lighter transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {wechatLoading ? (
                <span className="material-symbols-outlined animate-spin text-lg text-green-500">progress_activity</span>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#07C160">
                  <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178A1.17 1.17 0 014.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178 1.17 1.17 0 01-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 01.598.082l1.584.926a.272.272 0 00.139.045c.133 0 .241-.108.241-.245 0-.06-.023-.118-.04-.177l-.325-1.233a.49.49 0 01.177-.554c1.529-1.132 2.501-2.792 2.501-4.627 0-3.364-3.237-6.116-7.06-6.116zm-3.451 4.823c.535 0 .969.44.969.983a.976.976 0 01-.969.983.976.976 0 01-.969-.983c0-.543.434-.983.97-.983zm4.844 0c.535 0 .969.44.969.983a.976.976 0 01-.969.983.976.976 0 01-.969-.983c0-.543.434-.983.97-.983z" />
                </svg>
              )}
              <span className="text-sm text-text-primary">
                {wechatLoading ? "跳转中..." : wechatEnabled ? "微信登录" : "微信登录(未配置)"}
              </span>
            </button>
            <button className="flex items-center justify-center gap-2 py-3 px-4 bg-surface-card border border-border-dark rounded-lg hover:bg-surface-lighter transition-colors opacity-50 cursor-not-allowed">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#3370FF">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.2-.04-.28-.02-.12.03-1.99 1.27-5.63 3.72-.53.36-1.02.54-1.45.53-.48-.01-1.4-.27-2.08-.49-.84-.28-1.51-.42-1.45-.89.03-.25.38-.5 1.05-.76 4.1-1.79 6.83-2.97 8.21-3.54 3.91-1.63 4.72-1.91 5.25-1.92.12 0 .37.03.54.17.14.12.18.29.2.45-.01.07.01.23 0 .36z" />
              </svg>
              <span className="text-sm text-text-primary">企业微信(敬请期待)</span>
            </button>
          </div>

          {/* Register Link */}
          <p className="text-center text-sm text-text-secondary mt-8">
            还没有账号？{" "}
            <Link href="/register" className="text-blue-500 hover:text-blue-400 font-medium transition-colors">
              立即注册
            </Link>
          </p>
        </div>
      </div>

      {/* Right - Image (Hidden on mobile) */}
      <div className="hidden lg:flex flex-1 bg-surface-dark items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-surface-dark to-surface-dark"></div>
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 text-center max-w-lg">
          <div className="w-32 h-32 mx-auto mb-8 rounded-full bg-[var(--brand-gradient)] flex items-center justify-center shadow-[var(--shadow-glow)]">
            <span className="material-symbols-outlined text-6xl text-text-primary">psychology</span>
          </div>
          <h3 className="text-2xl font-bold text-text-primary mb-4">AI 驱动的智能培训</h3>
          <p className="text-text-secondary leading-relaxed">
            通过实时语音对话，模拟真实商业场景，让您在安全的环境中不断提升销售技巧和社交能力。
          </p>

          <div className="grid grid-cols-3 gap-6 mt-12">
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-500">92%</div>
              <div className="text-xs text-text-muted mt-1">能力提升率</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-text-primary">50K+</div>
              <div className="text-xs text-text-muted mt-1">活跃用户</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-text-primary">4.9</div>
              <div className="text-xs text-text-muted mt-1">用户评分</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background-dark flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
