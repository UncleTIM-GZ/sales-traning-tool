"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { authApi } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [apiError, setApiError] = useState("");

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    // 手机号验证
    if (!phone) {
      newErrors.phone = "请输入手机号";
    } else if (!/^1[3-9]\d{9}$/.test(phone)) {
      newErrors.phone = "请输入正确的手机号";
    }

    // 密码验证
    if (!password) {
      newErrors.password = "请设置密码";
    } else if (password.length < 8) {
      newErrors.password = "密码长度至少8位";
    } else if (!/[a-zA-Z]/.test(password)) {
      newErrors.password = "密码必须包含英文字母";
    } else if (!/\d/.test(password)) {
      newErrors.password = "密码必须包含数字";
    }

    // 确认密码
    if (!confirmPassword) {
      newErrors.confirmPassword = "请确认密码";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "两次密码输入不一致";
    }

    // 昵称验证
    if (!nickname) {
      newErrors.nickname = "请输入昵称";
    } else if (nickname.length < 2 || nickname.length > 16) {
      newErrors.nickname = "昵称长度需要2-16个字符";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError("");

    if (!validateForm() || !agreed) return;

    setIsLoading(true);

    try {
      // 调用真实注册 API
      const response = await authApi.register({
        phone,
        password,
        nickname,
        track: "sales",
      });

      // 保存用户信息和 token
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

      router.push("/dashboard");
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "注册失败，请稍后重试");
    } finally {
      setIsLoading(false);
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

          <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mb-2">创建账户</h2>
          <p className="text-text-secondary mb-8">注册免费账户，开启您的 AI 培训之旅</p>

          {apiError && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">error</span>
              {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
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
                  className={`w-full bg-surface-card border rounded-lg py-3 pl-14 pr-4 text-white placeholder-zinc-600 focus:ring-1 transition-all ${errors.phone
                    ? "border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50"
                    : "border-border-dark focus:ring-blue-500/50 focus:border-blue-500/50"
                    }`}
                />
              </div>
              {errors.phone && <p className="mt-1.5 text-xs text-red-400">{errors.phone}</p>}
            </div>

            {/* Nickname Input */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">昵称</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value.slice(0, 16))}
                placeholder="请输入昵称"
                className={`w-full bg-surface-card border rounded-lg py-3 px-4 text-white placeholder-zinc-600 focus:ring-1 transition-all ${errors.nickname
                  ? "border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50"
                  : "border-border-dark focus:ring-blue-500/50 focus:border-blue-500/50"
                  }`}
              />
              {errors.nickname && <p className="mt-1.5 text-xs text-red-400">{errors.nickname}</p>}
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">设置密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请设置8位以上密码（含字母和数字）"
                className={`w-full bg-surface-card border rounded-lg py-3 px-4 text-white placeholder-zinc-600 focus:ring-1 transition-all ${errors.password
                  ? "border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50"
                  : "border-border-dark focus:ring-blue-500/50 focus:border-blue-500/50"
                  }`}
              />
              {errors.password && <p className="mt-1.5 text-xs text-red-400">{errors.password}</p>}
            </div>

            {/* Confirm Password Input */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">确认密码</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="请再次输入密码"
                className={`w-full bg-surface-card border rounded-lg py-3 px-4 text-white placeholder-zinc-600 focus:ring-1 transition-all ${errors.confirmPassword
                  ? "border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50"
                  : "border-border-dark focus:ring-blue-500/50 focus:border-blue-500/50"
                  }`}
              />
              {errors.confirmPassword && <p className="mt-1.5 text-xs text-red-400">{errors.confirmPassword}</p>}
            </div>

            {/* Agreement */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${agreed
                  ? "bg-blue-500 border-blue-500"
                  : "bg-surface-card border-border-dark group-hover:border-zinc-500"
                  }`}>
                  {agreed && <span className="material-symbols-outlined text-text-primary text-sm">check</span>}
                </div>
              </div>
              <span className="text-sm text-text-secondary">
                我已阅读并同意{" "}
                <a href="#" className="text-blue-500 hover:text-blue-400">《用户协议》</a>
                {" "}和{" "}
                <a href="#" className="text-blue-500 hover:text-blue-400">《隐私政策》</a>
              </span>
            </label>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !agreed}
              className="w-full bg-blue-gradient text-white py-3 rounded-lg font-bold text-sm shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                  注册中...
                </>
              ) : (
                "立即注册"
              )}
            </button>
          </form>

          {/* Login Link */}
          <p className="text-center text-sm text-text-secondary mt-8">
            已有账号？{" "}
            <Link href="/login" className="text-blue-500 hover:text-blue-400 font-medium transition-colors">
              立即登录
            </Link>
          </p>
        </div>
      </div>

      {/* Right - Image (Hidden on mobile) */}
      <div className="hidden lg:flex flex-1 bg-surface-dark items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-surface-dark to-surface-dark"></div>
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/3 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 text-center max-w-lg">
          <div className="w-32 h-32 mx-auto mb-8 rounded-full bg-[var(--brand-gradient)] flex items-center justify-center shadow-[var(--shadow-glow)]">
            <span className="material-symbols-outlined text-6xl text-text-primary">rocket_launch</span>
          </div>
          <h3 className="text-2xl font-bold text-text-primary mb-4">开启您的蜕变之旅</h3>
          <p className="text-text-secondary leading-relaxed mb-8">
            加入 50,000+ 学员，通过 AI 智能培训，快速提升您的销售能力和社交自信。
          </p>

          <div className="bg-surface-card/50 border border-border-dark rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[var(--brand-gradient)] flex items-center justify-center text-text-primary font-bold">
                张
              </div>
              <div className="text-left">
                <div className="text-sm font-medium text-text-primary">张明</div>
                <div className="text-xs text-text-muted">房地产销售经理</div>
              </div>
            </div>
            <p className="text-sm text-text-secondary italic">
              "使用 AI 智训 Pro 3个月，成交率提升 40%，从团队末位到销冠！"
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
