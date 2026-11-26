import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 화면 왼쪽 아래의 Next.js 개발 표시(N)를 숨긴다. 탭 아이콘과는 별도다.
  devIndicators: false,

  // 아래 항목은 기존 프로젝트 설정을 유지한다.
  experimental: {
    agentFeedback: true,
    proxyClientMaxBodySize: "22mb",
    proxyTimeout: 45_000,
  },
  async rewrites() {
    const origin = new URL(process.env.SIPYEONG_API_ORIGIN ?? "http://127.0.0.1:3003").origin;
    return [{ source: "/api/:path*", destination: `${origin}/api/:path*` }];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
