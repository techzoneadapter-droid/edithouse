/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  agentRules: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb"
    }
  }
};

export default nextConfig;
