import type { Metadata } from "next";
import { Manrope, Noto_Sans_SC, JetBrains_Mono } from "next/font/google";
import { ClientProviders } from "@/components/providers/ClientProviders";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800"],
});

const notoSansSC = Noto_Sans_SC({
  variable: "--font-noto-sans-sc",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI 智训 Pro - 销冠与社恐培养系统",
  description: "通过AI模拟实战场景，提升您的销售能力和社交自信",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 主题初始化脚本 - 防止闪烁
  const themeInitScript = `
    (function() {
      try {
        var stored = localStorage.getItem('theme-storage');
        if (stored) {
          var parsed = JSON.parse(stored);
          var theme = parsed.state && parsed.state.theme;
          if (theme === 'light') {
            document.documentElement.classList.add('light');
            document.documentElement.setAttribute('data-theme', 'light');
          } else if (theme === 'system') {
            var isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (!isDark) {
              document.documentElement.classList.add('light');
              document.documentElement.setAttribute('data-theme', 'light');
            }
          }
        }
      } catch (e) {}
    })();
  `;

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* 主题初始化脚本 - 防止闪烁 */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {/* Material Symbols Icons */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={`${manrope.variable} ${notoSansSC.variable} ${jetbrainsMono.variable} antialiased bg-bg-base text-text-primary overflow-x-hidden`}
      >
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
