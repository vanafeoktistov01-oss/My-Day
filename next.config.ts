import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Enable standalone output for Docker/Railway deployment
  output: 'standalone',
};

export default nextConfig;
