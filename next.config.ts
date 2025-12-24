import type { NextConfig } from "next";
import packageJson from './package.json';

// 检测是否在 Docker 环境中（生产构建使用 standalone）
const isDocker = process.env.DOCKER_BUILD === 'true';

const nextConfig: NextConfig = {
  // 在 Docker 环境中使用 standalone 模式
  // Windows 本地构建 standalone 会有符号链接权限问题
  ...(isDocker ? { output: 'standalone' } : {}),
  
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  generateBuildId: () => packageJson.version,
};

export default nextConfig;
