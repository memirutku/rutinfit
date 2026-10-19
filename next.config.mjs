/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1", "127.0.0.1:3005", "localhost", "localhost:3005"],
  webpack: (config, { dev }) => {
    if (dev) {
      config.output = config.output || {};
      config.output.chunkLoadTimeout = 60000;
    }
    return config;
  },
};

export default nextConfig;
