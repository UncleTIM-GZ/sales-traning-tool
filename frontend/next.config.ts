import type { NextConfig } from "next";

// 后端地址配置：
// - BACKEND_URL 环境变量优先（可在构建时或运行时设置）
// - standalone 模式（Docker生产环境）默认使用 Docker 内部网络地址
// - 开发环境（npm run dev）使用 localhost
const getBackendUrl = () => {
  // 优先使用环境变量
  if (process.env.BACKEND_URL) {
    return process.env.BACKEND_URL;
  }
  // standalone 输出模式 = Docker 生产环境
  // 开发时 output 不是 standalone，所以用 localhost
  return 'http://localhost:8111';
};

const nextConfig: NextConfig = {
  // 生产环境使用 standalone 模式，减小 Docker 镜像大小
  output: "standalone",

  // 配置响应头，防止 CDN 缓存动态页面
  async headers() {
    return [
      {
        // API 路由不缓存
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
      {
        // 需要认证的页面不缓存
        source: '/(dashboard|admin|training|me|vip|points|plaza|community|courses)/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
        ],
      },
      {
        // 登录/注册页面不缓存
        source: '/(login|register|forgot-password)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
        ],
      },
    ];
  },

  async rewrites() {
    const backendUrl = getBackendUrl();
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/ws/:path*',
        destination: `${backendUrl}/api/v1/ws/:path*`,
      },
    ];
  },
};

export default nextConfig;
