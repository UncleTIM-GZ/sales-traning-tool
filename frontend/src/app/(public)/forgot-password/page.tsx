"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: 输入手机号, 2: 验证码, 3: 重置密码
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [devCode, setDevCode] = useState(""); // 开发环境显示验证码

  const handleSendCode = async () => {
    if (!phone || countdown > 0) return;

    // 验证手机号
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError("请输入正确的手机号");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      // 调用真实发送验证码 API
      const response = await authApi.sendCode({
        phone,
        purpose: "reset_password",
      });

      // 开发环境显示验证码
      if (response.code) {
        setDevCode(response.code);
      }

      setStep(2);
      setCountdown(60);

      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送验证码失败");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code || code.length !== 6) {
      setError("请输入6位验证码");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      // 调用验证验证码 API
      await authApi.verifyCode({ phone, code });
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "验证码错误");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!password) {
      setError("请设置新密码");
      return;
    }
    if (password.length < 6 || password.length > 20) {
      setError("密码长度需要6-20位");
      return;
    }
    if (password !== confirmPassword) {
      setError("两次密码输入不一致");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      // 调用重置密码 API
      await authApi.resetPassword({
        phone,
        code,
        new_password: password,
      });

      // 成功后跳转登录
      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "重置密码失败");
    } finally {
      setIsLoading(false);
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 1: return "找回密码";
      case 2: return "验证手机号";
      case 3: return "设置新密码";
    }
  };

  const getStepDesc = () => {
    switch (step) {
      case 1: return "请输入您注册时使用的手机号";
      case 2: return `验证码已发送至 +86 ${phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2")}`;
      case 3: return "请设置您的新密码";
    }
  };

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

          {/* Progress Steps */}
          <div className="flex items-center gap-2 mb-8">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${step >= s
                    ? "bg-blue-500/10 border border-blue-500/50 text-blue-400"
                    : "bg-surface-card border border-border-dark text-text-muted"
                  }`}>
                  {step > s ? <span className="material-symbols-outlined text-lg">check</span> : s}
                </div>
                {s < 3 && (
                  <div className={`w-8 h-px ${step > s ? "bg-blue-500/50" : "bg-border-dark"}`}></div>
                )}
              </div>
            ))}
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mb-2">{getStepTitle()}</h2>
          <p className="text-text-secondary mb-8">{getStepDesc()}</p>

          {error && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">error</span>
              {error}
            </div>
          )}

          {/* 开发环境显示验证码 */}
          {devCode && step === 2 && (
            <div className="mb-6 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">info</span>
              开发模式验证码: <strong>{devCode}</strong>
            </div>
          )}

          {/* Step 1: Phone Input */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">手机号</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">+86</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                    placeholder="请输入注册时的手机号"
                    className="w-full bg-surface-card border border-border-dark rounded-lg py-3 pl-14 pr-4 text-white placeholder-zinc-600 focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  />
                </div>
              </div>

              <button
                onClick={handleSendCode}
                disabled={!phone || isLoading}
                className="w-full bg-blue-gradient text-white py-3 rounded-lg font-bold text-sm shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                    发送中...
                  </>
                ) : (
                  "获取验证码"
                )}
              </button>
            </div>
          )}

          {/* Step 2: Verify Code */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">验证码</label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="请输入6位验证码"
                    maxLength={6}
                    className="flex-1 bg-surface-card border border-border-dark rounded-lg py-3 px-4 text-white placeholder-zinc-600 focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-center tracking-widest text-lg"
                  />
                  <button
                    onClick={handleSendCode}
                    disabled={countdown > 0 || isLoading}
                    className={`px-5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${countdown > 0 || isLoading
                        ? "bg-surface-dark text-text-muted border border-border-dark cursor-not-allowed"
                        : "bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20"
                      }`}
                  >
                    {countdown > 0 ? `${countdown}s` : "重新发送"}
                  </button>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 border border-border-dark rounded-lg font-medium text-sm text-text-primary hover:bg-surface-lighter transition-colors"
                >
                  上一步
                </button>
                <button
                  onClick={handleVerifyCode}
                  disabled={code.length !== 6 || isLoading}
                  className="flex-1 bg-blue-gradient text-white py-3 rounded-lg font-bold text-sm shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                      验证中...
                    </>
                  ) : (
                    "验证"
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Reset Password */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">新密码</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请设置6-20位新密码"
                  className="w-full bg-surface-card border border-border-dark rounded-lg py-3 px-4 text-white placeholder-zinc-600 focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">确认新密码</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="请再次输入新密码"
                  className={`w-full bg-surface-card border rounded-lg py-3 px-4 text-white placeholder-zinc-600 focus:ring-1 transition-all ${confirmPassword && password !== confirmPassword
                      ? "border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50"
                      : "border-border-dark focus:ring-blue-500/50 focus:border-blue-500/50"
                    }`}
                />
                {confirmPassword && password !== confirmPassword && (
                  <p className="mt-1.5 text-xs text-red-400">两次密码输入不一致</p>
                )}
              </div>

              <button
                onClick={handleResetPassword}
                disabled={isLoading || !password || password !== confirmPassword}
                className="w-full bg-blue-gradient text-white py-3 rounded-lg font-bold text-sm shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                    重置中...
                  </>
                ) : (
                  "重置密码"
                )}
              </button>
            </div>
          )}

          {/* Back to Login */}
          <p className="text-center text-sm text-text-secondary mt-8">
            想起密码了？{" "}
            <Link href="/login" className="text-blue-500 hover:text-blue-400 font-medium transition-colors">
              返回登录
            </Link>
          </p>
        </div>
      </div>

      {/* Right - Image (Hidden on mobile) */}
      <div className="hidden lg:flex flex-1 bg-surface-dark items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-surface-dark to-surface-dark"></div>
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-1/4 left-1/3 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 text-center max-w-lg">
          <div className="w-32 h-32 mx-auto mb-8 rounded-full bg-[var(--brand-gradient)] flex items-center justify-center shadow-[var(--shadow-glow)]">
            <span className="material-symbols-outlined text-6xl text-text-primary">lock_reset</span>
          </div>
          <h3 className="text-2xl font-bold text-text-primary mb-4">安全重置密码</h3>
          <p className="text-text-secondary leading-relaxed">
            通过手机验证码验证身份后，您可以设置新的登录密码。请妥善保管您的账户信息。
          </p>

          <div className="mt-12 p-6 bg-surface-card/50 border border-border-dark rounded-xl text-left">
            <h4 className="text-sm font-medium text-text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-400">tips_and_updates</span>
              密码设置建议
            </h4>
            <ul className="space-y-2 text-sm text-text-secondary">
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400 text-lg">check_circle</span>
                长度 6-20 位字符
              </li>
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400 text-lg">check_circle</span>
                包含字母和数字更安全
              </li>
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400 text-lg">check_circle</span>
                避免使用生日、手机号等
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
