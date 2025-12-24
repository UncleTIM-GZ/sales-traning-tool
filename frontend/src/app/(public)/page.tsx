"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, useScroll, useTransform } from "framer-motion";
import { useAuthStore } from "@/stores/authStore";
import { ThemeToggle } from "@/components/ui/ThemeSwitcher";

export default function LandingPage() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const { scrollY } = useScroll();

  // 背景动画随滚动淡出
  const linesOpacity = useTransform(scrollY, [0, 600], [1, 0]);
  const linesScale = useTransform(scrollY, [0, 600], [1, 0.8]);

  // 检查登录状态，已登录用户直接跳转到 dashboard
  useEffect(() => {
    const stored = localStorage.getItem('auth-storage');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        if (data.state?.isAuthenticated && data.state?.token) {
          router.replace('/dashboard');
          return;
        }
      } catch (e) {
        // 解析失败，继续显示首页
      }
    }
    setIsCheckingAuth(false);
  }, [router]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY < lastScrollY || currentScrollY < 10) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      }
      setLastScrollY(currentScrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  // 正在检查登录状态时显示加载
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-bg-base text-text-primary font-sans selection:bg-primary/20 overflow-x-hidden">

      {/* Animated SVG Background Lines */}
      <motion.div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ opacity: linesOpacity, scale: linesScale }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="100%"
          height="100%"
          viewBox="0 0 2269 2108"
          fill="none"
          className="w-full h-full"
          preserveAspectRatio="xMidYMid slice"
        >
          {/* Animated Blue Lines */}
          <path
            d="M510.086 0.543457L507.556 840.047C506.058 1337.18 318.091 1803.4 1.875 2094.29"
            stroke="#2563eb"
            strokeWidth="2"
            strokeMiterlimit="10"
            strokeDasharray="100px 99999px"
            className="animate-line-1"
          />
          <path
            d="M929.828 0.543457L927.328 829.877C925.809 1334 737.028 1807.4 418.435 2106"
            stroke="#10b981"
            strokeWidth="2"
            strokeMiterlimit="10"
            strokeDasharray="100px 99999px"
            className="animate-line-2"
          />
          <path
            d="M1341.9 0.543457L1344.4 829.876C1345.92 1334 1534.7 1807.4 1853.29 2106"
            stroke="#10b981"
            strokeWidth="2"
            strokeMiterlimit="10"
            strokeDasharray="100px 99999px"
            className="animate-line-3"
          />
          <path
            d="M1758.96 0.543457L1761.49 840.047C1762.99 1337.18 1950.96 1803.4 2267.17 2094.29"
            stroke="#2563eb"
            strokeWidth="2"
            strokeMiterlimit="10"
            strokeDasharray="100px 99999px"
            className="animate-line-4"
          />
          {/* Static White Background Lines */}
          <path opacity="0.15" d="M929.828 0.543457L927.328 829.877C925.809 1334 737.028 1807.4 418.435 2106" stroke="white" strokeWidth="1" strokeMiterlimit="10" />
          <path opacity="0.15" d="M510.086 0.543457L507.556 840.047C506.058 1337.18 318.091 1803.4 1.875 2094.29" stroke="white" strokeWidth="1" strokeMiterlimit="10" />
          <path opacity="0.15" d="M1758.96 0.543457L1761.49 840.047C1762.99 1337.18 1950.96 1803.4 2267.17 2094.29" stroke="white" strokeWidth="1" strokeMiterlimit="10" />
          <path opacity="0.15" d="M1341.9 0.543457L1344.4 829.876C1345.92 1334 1534.7 1807.4 1853.29 2106" stroke="white" strokeWidth="1" strokeMiterlimit="10" />
        </svg>
      </motion.div>

      {/* Floating Capsule Navigation */}
      <nav className={`fixed left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-5xl transition-all duration-700 ease-in-out ${isVisible ? "top-6 opacity-100" : "-top-24 opacity-0"
        }`}>
        <div className="relative bg-bg-card/80 dark:bg-black/40 backdrop-blur-[80px] rounded-full px-6 py-3 flex items-center justify-between shadow-2xl border border-border-default dark:border-white/10">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--brand-gradient)] flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-lg">psychology</span>
            </div>
            <span className="text-lg font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-text-primary to-text-secondary">
              AI 智训
            </span>
          </Link>

          {/* Center Nav Links */}
          <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-8">
            {[
              { label: "功能", id: "features" },
              { label: "系统", id: "systems" },
              { label: "案例", id: "cases" },
              { label: "价格", id: "pricing" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Right Auth */}
          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />
            <Link href="/login" className="px-4 py-2 text-sm font-medium text-text-primary hover:text-primary transition-colors">
              登录
            </Link>
            <Link
              href="/register"
              className="px-5 py-2.5 rounded-full bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-all hover:scale-105 shadow-[var(--shadow-glow)]"
            >
              免费试用
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-text-secondary hover:text-text-primary"
          >
            <span className="material-symbols-outlined">{mobileMenuOpen ? "close" : "menu"}</span>
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 bg-bg-card/95 dark:bg-black/80 backdrop-blur-xl rounded-2xl border border-border-default dark:border-white/10 p-4"
          >
            <div className="space-y-2">
              {["功能", "系统", "案例", "价格"].map((item) => (
                <button
                  key={item}
                  onClick={() => {
                    scrollToSection(item === "功能" ? "features" : item === "系统" ? "systems" : item === "案例" ? "cases" : "pricing");
                    setMobileMenuOpen(false);
                  }}
                  className="block w-full text-left px-4 py-3 text-text-primary hover:bg-bg-hover rounded-lg transition-colors"
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border-default flex gap-2">
              <Link href="/login" className="flex-1 py-3 text-center text-sm font-medium text-text-primary border border-border-strong rounded-full hover:bg-bg-hover">
                登录
              </Link>
              <Link href="/register" className="flex-1 py-3 text-center text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-full transition-all">
                免费试用
              </Link>
            </div>
          </motion.div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-12 pt-24 pb-20">
        <div className="max-w-4xl mx-auto text-center">
          {/* Status Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-600/20 to-emerald-500/20 border border-blue-500/30 mb-10"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-sm font-medium text-blue-600 dark:text-blue-300">新一代 AI 实时语音培训系统</span>
          </motion.div>

          {/* Main Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-light leading-[1.1] mb-8 tracking-tight"
          >
            <span className="block text-text-primary mb-2">用 AI 模拟真实场景</span>
            <span className="block bg-gradient-to-r from-blue-400 via-emerald-400 to-blue-400 bg-clip-text text-transparent">
              让沟通能力持续进化
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-lg sm:text-xl text-text-secondary mb-12 max-w-2xl mx-auto leading-relaxed"
          >
            通过 <span className="text-text-primary font-medium">实时语音对话</span> 模拟销售谈判、客户沟通等场景
            <br />
            <span className="text-emerald-400">智能评分反馈</span>，助您快速突破能力瓶颈
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20"
          >
            <Link
              href="/register"
              className="group w-full sm:w-auto bg-primary-600 hover:bg-primary-700 text-white px-10 py-4 rounded-full text-base font-medium transition-all duration-300 hover:scale-[1.02] hover:shadow-[var(--shadow-glow)] flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-xl">rocket_launch</span>
              开始免费试用
              <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </Link>
            <button
              onClick={() => scrollToSection("features")}
              className="w-full sm:w-auto border border-border-strong hover:border-zinc-500 bg-bg-elevated/50 backdrop-blur-sm text-text-primary px-10 py-4 rounded-full text-base font-medium transition-all duration-300 hover:bg-bg-hover flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-xl">play_circle</span>
              了解更多
            </button>
          </motion.div>

          {/* Key Metrics */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="grid grid-cols-3 gap-6 sm:gap-12 max-w-2xl mx-auto"
          >
            {[
              { value: "92%", label: "能力提升率", color: "text-emerald-400" },
              { value: "50K+", label: "活跃学员", color: "text-blue-400" },
              { value: "100+", label: "实战场景", color: "text-emerald-400" },
            ].map((stat, i) => (
              <div key={stat.label} className="text-center">
                <div className={`text-3xl sm:text-4xl font-light ${stat.color} mb-1`}>{stat.value}</div>
                <div className="text-xs sm:text-sm text-text-muted">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex flex-col items-center text-text-muted"
          >
            <span className="material-symbols-outlined">keyboard_arrow_down</span>
          </motion.div>
        </motion.div>
      </section>

      {/* Trusted Section */}
      <section className="relative z-10 py-12 border-t border-border-default">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
          <p className="text-center text-sm text-text-muted mb-8">众多企业信赖之选</p>
          <div className="flex flex-wrap justify-center items-center gap-8 sm:gap-16 opacity-40">
            {["阿里巴巴", "腾讯", "字节跳动", "华为", "小米", "京东"].map((company) => (
              <div key={company} className="text-xl sm:text-2xl font-light text-text-secondary">{company}</div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative z-10 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
          <div className="bg-bg-card/80 dark:bg-zinc-950/80 backdrop-blur-sm border border-border-default rounded-3xl p-8 sm:p-12">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mb-12"
            >
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-light mb-4 bg-clip-text text-transparent bg-gradient-to-b from-text-primary to-text-secondary">
                核心能力
              </h2>
              <p className="text-lg text-text-secondary">革命性的 AI 培训技术，让学习更高效</p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { icon: "mic", title: "实时语音对话", desc: "基于大模型的自然语音对话，就像与真人交流一样流畅自然。", color: "blue" },
                { icon: "analytics", title: "智能评分反馈", desc: "AI 实时分析表达技巧、情绪控制、逻辑思维，给出精准改进建议。", color: "emerald" },
                { icon: "route", title: "个性化路径", desc: "根据能力评估结果，智能推荐最适合您的学习内容和训练场景。", color: "blue" },
                { icon: "theater_comedy", title: "100+ 真实场景", desc: "覆盖销售谈判、客户服务、商务社交等多种场景，专业剧本设计。", color: "emerald" },
                { icon: "trending_up", title: "成长可视化", desc: "完整记录学习轨迹，用数据见证每一次进步，量化能力提升。", color: "blue" },
                { icon: "shield", title: "企业级安全", desc: "数据加密存储，隐私保护，满足企业级安全合规要求。", color: "emerald" },
              ].map((feature, i) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className={`group relative rounded-2xl border border-border-default p-3 hover:border-${feature.color}-500/50 transition-all duration-500`}
                >
                  <div className="relative bg-bg-card/50 rounded-xl p-6 h-full">
                    <div className={`w-12 h-12 rounded-lg bg-${feature.color}-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-500`}>
                      <span className={`material-symbols-outlined text-${feature.color}-400 text-2xl`}>{feature.icon}</span>
                    </div>
                    <h3 className="text-xl font-light text-text-primary mb-2">{feature.title}</h3>
                    <p className="text-text-secondary text-sm leading-relaxed">{feature.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Systems Section */}
      <section id="systems" className="relative z-10 py-24 border-t border-border-default">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-light mb-4 bg-clip-text text-transparent bg-gradient-to-b from-text-primary to-text-secondary">
              双轨培训系统
            </h2>
            <p className="text-lg text-text-secondary">针对不同需求，提供专业培训方案</p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* SCS */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="group relative rounded-2xl border border-border-default p-3 hover:border-blue-500/50 transition-all duration-500"
            >
              <div className="relative bg-bg-card/50 rounded-xl p-8 lg:p-10 h-full overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl" />

                <div className="relative z-10">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 mb-6">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">SCS 销冠培养系统</span>
                  </div>

                  <h3 className="text-3xl font-light text-text-primary mb-4">成为顶尖销售精英</h3>
                  <p className="text-text-secondary mb-8 leading-relaxed">
                    深度解析顶级销售话术，基于真实案例的 AI 对抗演练。从客户开发到成交签单，全流程实战训练。
                  </p>

                  <div className="grid grid-cols-2 gap-3 mb-8">
                    {["高压谈判模拟", "异议处理技巧", "客户心理分析", "成交话术演练"].map((item) => (
                      <div key={item} className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-blue-400 text-base">check_circle</span>
                        <span className="text-sm text-text-primary">{item}</span>
                      </div>
                    ))}
                  </div>

                  <Link href="/scenarios?type=scs" className="inline-flex items-center gap-2 text-blue-400 font-medium hover:text-blue-300 transition-colors group/link">
                    <span>探索销冠课程</span>
                    <span className="material-symbols-outlined text-sm group-hover/link:translate-x-1 transition-transform">arrow_forward</span>
                  </Link>
                </div>
              </div>
            </motion.div>

            {/* SCC */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="group relative rounded-2xl border border-border-default p-3 hover:border-emerald-500/50 transition-all duration-500"
            >
              <div className="relative bg-bg-card/50 rounded-xl p-8 lg:p-10 h-full overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl" />

                <div className="relative z-10">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">SCC 社恐脱敏训练</span>
                  </div>

                  <h3 className="text-3xl font-light text-text-primary mb-4">重塑社交自信</h3>
                  <p className="text-text-secondary mb-8 leading-relaxed">
                    循序渐进的社交场景模拟，从破冰寒暄到公开演讲。AI 引导式脱敏训练，在安全环境中突破障碍。
                  </p>

                  <div className="grid grid-cols-2 gap-3 mb-8">
                    {["破冰对话练习", "日常社交场景", "职场沟通技巧", "公开演讲训练"].map((item) => (
                      <div key={item} className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-emerald-400 text-base">check_circle</span>
                        <span className="text-sm text-text-primary">{item}</span>
                      </div>
                    ))}
                  </div>

                  <Link href="/scenarios?type=scc" className="inline-flex items-center gap-2 text-emerald-400 font-medium hover:text-emerald-300 transition-colors group/link">
                    <span>开始疗愈之旅</span>
                    <span className="material-symbols-outlined text-sm group-hover/link:translate-x-1 transition-transform">arrow_forward</span>
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Product Showcase */}
      <section className="relative z-10 py-24 border-t border-border-default">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-light mb-4 bg-clip-text text-transparent bg-gradient-to-b from-text-primary to-text-secondary">
              产品界面预览
            </h2>
            <p className="text-lg text-text-secondary">简洁优雅的设计，专注于您的成长</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-5xl mx-auto relative"
          >
            {/* Glow Effect */}
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-600/20 to-emerald-500/20 blur-3xl rounded-3xl opacity-50" />

            {/* Window Frame */}
            <div className="relative rounded-2xl border border-border-default dark:border-white/10 bg-bg-card/50 dark:bg-black/50 backdrop-blur-xl shadow-2xl overflow-hidden">
              {/* Window Controls */}
              <div className="h-10 bg-bg-elevated/80 dark:bg-bg-card/80 flex items-center gap-2 px-4 border-b border-border-default dark:border-white/5">
                <div className="w-3 h-3 rounded-full bg-[#FF5F56]" />
                <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                <div className="w-3 h-3 rounded-full bg-[#27C93F]" />
                <span className="ml-4 text-xs text-text-muted">AI 智训 Pro - 训练中心</span>
              </div>

              {/* Product Screenshot Placeholder */}
              <div className="bg-bg-surface dark:bg-zinc-950 p-8 min-h-[400px] flex items-center justify-center">
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[var(--brand-gradient)] flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-4xl">psychology</span>
                  </div>
                  <p className="text-text-secondary text-lg mb-2">沉浸式 AI 对话训练界面</p>
                  <p className="text-text-muted text-sm">实时语音交互 · 即时反馈评分 · 个性化建议</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Cases Section */}
      <section id="cases" className="relative z-10 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-light mb-4 bg-clip-text text-transparent bg-gradient-to-b from-text-primary to-text-secondary">
              学员成功案例
            </h2>
            <p className="text-lg text-text-secondary">看看他们是如何实现蜕变的</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: "张明", role: "房地产销售经理", quote: "使用 AI 智训 3个月后，我的成交率提升了 40%。特别是异议处理模块，让我学会了如何应对各种刁钻客户。", result: "+40%", resultLabel: "成交率", color: "blue" },
              { name: "李小雨", role: "产品经理", quote: "作为一个重度社恐，我一直害怕在会议上发言。通过社恐脱敏训练，现在我已经能自信地做产品演示了。", result: "突破", resultLabel: "社恐障碍", color: "emerald" },
              { name: "王建国", role: "保险代理人", quote: "每天利用碎片时间练习，2个月就从团队倒数变成了销冠。AI 教练的实时指导真的太有用了！", result: "TOP1", resultLabel: "团队排名", color: "blue" },
            ].map((item, i) => (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`group relative rounded-2xl border border-border-default p-3 hover:border-${item.color}-500/50 transition-all duration-500`}
              >
                <div className="relative bg-bg-card/50 rounded-xl p-6 h-full flex flex-col">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br from-${item.color}-400 to-${item.color}-600 flex items-center justify-center text-white text-lg font-medium`}>
                      {item.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-medium text-text-primary">{item.name}</div>
                      <div className="text-xs text-text-muted">{item.role}</div>
                    </div>
                  </div>
                  <p className="text-text-secondary text-sm leading-relaxed mb-4 flex-1">&ldquo;{item.quote}&rdquo;</p>
                  <div className="flex items-center gap-2 pt-4 border-t border-border-default">
                    <span className={`text-${item.color}-400 font-bold text-lg`}>{item.result}</span>
                    <span className="text-text-muted text-sm">{item.resultLabel}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="relative z-10 py-24 border-t border-border-default">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-light mb-4 bg-clip-text text-transparent bg-gradient-to-b from-text-primary to-text-secondary">
              价格方案
            </h2>
            <p className="text-lg text-text-secondary">选择适合您的方案，开始成长之旅</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Free */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="relative rounded-2xl border border-border-default bg-bg-card/30 p-6"
            >
              <h3 className="text-lg font-medium text-text-primary mb-1">免费体验</h3>
              <p className="text-text-muted text-sm mb-4">适合初次了解</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-light text-text-primary">¥0</span>
                <span className="text-text-muted">/月</span>
              </div>
              <ul className="space-y-3 mb-6">
                {["每日 3 次训练", "基础场景库", "简易报告"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-text-secondary">
                    <span className="material-symbols-outlined text-emerald-500 text-base">check</span>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/register" className="block w-full py-3 text-center border border-border-strong rounded-full text-sm font-medium text-text-primary hover:bg-white/5 transition-all">
                免费开始
              </Link>
            </motion.div>

            {/* Pro */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="relative rounded-2xl border-2 border-blue-500/50 bg-bg-card/50 p-6 shadow-[0_0_50px_-15px_rgba(37,99,235,0.3)]"
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-600 rounded-full text-xs font-medium text-white">
                最受欢迎
              </div>
              <h3 className="text-lg font-medium text-text-primary mb-1">专业版</h3>
              <p className="text-text-muted text-sm mb-4">适合深度学习</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-light text-blue-400">¥99</span>
                <span className="text-text-muted">/月</span>
              </div>
              <ul className="space-y-3 mb-6">
                {["无限次训练", "全部场景库", "详细 AI 分析", "个性化路径", "精英社区"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-text-primary">
                    <span className="material-symbols-outlined text-blue-400 text-base">check</span>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/register?plan=pro" className="block w-full py-3 text-center bg-primary-600 hover:bg-primary-700 rounded-full text-sm font-medium text-white transition-all shadow-lg">
                立即订阅
              </Link>
            </motion.div>

            {/* Enterprise */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="relative rounded-2xl border border-border-default bg-bg-card/30 p-6"
            >
              <h3 className="text-lg font-medium text-text-primary mb-1">企业版</h3>
              <p className="text-text-muted text-sm mb-4">团队批量培训</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-light text-text-primary">定制</span>
              </div>
              <ul className="space-y-3 mb-6">
                {["专业版全部功能", "团队管理后台", "定制场景", "专属客户经理"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-text-secondary">
                    <span className="material-symbols-outlined text-emerald-500 text-base">check</span>
                    {item}
                  </li>
                ))}
              </ul>
              <a href="mailto:contact@aizhixun.pro" className="block w-full py-3 text-center border border-border-strong rounded-full text-sm font-medium text-text-primary hover:bg-white/5 transition-all">
                联系销售
              </a>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-32 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-12 text-center"
        >
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-light mb-6 bg-clip-text text-transparent bg-gradient-to-b from-text-primary to-text-secondary">
            准备好开始您的蜕变之旅了吗？
          </h2>
          <p className="text-lg text-text-secondary mb-10 max-w-2xl mx-auto">
            立即免费注册，开启 AI 智能培训新体验
          </p>
          <Link
            href="/register"
            className="group inline-flex items-center gap-3 bg-primary-600 hover:bg-primary-700 text-white px-12 py-5 rounded-full text-lg font-medium transition-all duration-300 hover:scale-[1.02] hover:shadow-[var(--shadow-glow)]"
          >
            立即开始
            <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
          </Link>
          <p className="mt-6 text-sm text-text-muted">无需信用卡，免费开始使用</p>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border-default bg-bg-surface/50 dark:bg-zinc-950/50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-[var(--brand-gradient)] flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-lg">psychology</span>
                </div>
                <span className="text-lg font-bold text-text-primary">AI 智训</span>
              </div>
              <p className="text-text-muted text-sm leading-relaxed max-w-xs">
                用 AI 模拟真实场景，让每个人都能突破沟通障碍，实现能力跃迁。
              </p>
            </div>

            {[
              { title: "产品", links: ["功能介绍", "使用演示", "更新日志"] },
              { title: "资源", links: ["帮助中心", "API 文档", "社区"] },
              { title: "公司", links: ["关于我们", "加入我们", "联系我们"] },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="text-sm font-medium text-text-primary mb-4">{col.title}</h4>
                <ul className="space-y-3">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a href="#" className="text-sm text-text-muted hover:text-blue-400 transition-colors">{link}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-border-default">
            <p className="text-xs text-text-muted mb-4 md:mb-0">© 2024 AI 智训. All rights reserved.</p>
            <div className="flex gap-6 text-xs text-text-muted">
              <a href="#" className="hover:text-text-secondary transition-colors">隐私政策</a>
              <a href="#" className="hover:text-text-secondary transition-colors">服务条款</a>
              <a href="#" className="hover:text-text-secondary transition-colors">安全</a>
            </div>
          </div>
        </div>
      </footer>

      {/* CSS for line animations */}
      <style jsx>{`
        @keyframes line-race {
          0% { stroke-dashoffset: 3000; }
          100% { stroke-dashoffset: 0; }
        }
        .animate-line-1 { animation: line-race 8s linear infinite; }
        .animate-line-2 { animation: line-race 8s linear infinite; animation-delay: 2s; }
        .animate-line-3 { animation: line-race 8s linear infinite; animation-delay: 4s; }
        .animate-line-4 { animation: line-race 8s linear infinite; animation-delay: 6s; }
      `}</style>
    </div>
  );
}
