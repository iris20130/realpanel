import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['bcryptjs'],
  // 交付成品包：.next/standalone 内含运行所需的最小依赖
  output: 'standalone',
  // 全站图片已走原图/代理，禁用需要 sharp 原生模块的图片优化器
  images: { unoptimized: true },
  // 离线文件按「端口号/文件名」直接访问，命中不到页面/静态资源时转给文件接口
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [{ source: '/:name', destination: '/api/files/:name' }],
      fallback: [],
    };
  },
};

export default nextConfig;
