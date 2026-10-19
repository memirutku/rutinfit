/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { dev }) => {
    if (dev) {
      config.output = config.output || {};
      config.output.chunkLoadTimeout = 60000;
    }
    return config;
  },
};

export default nextConfig;
