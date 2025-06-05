/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  experimental: {
    serverActions: true,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          ...(config.watchOptions?.ignored || []),
          // Ignore specific /tmp subdirectories that cause EACCES errors
          // Use string glob patterns instead of RegExp literals
          '/tmp/snap-private-tmp/**',
          '/tmp/systemd-private-*/**',
        ],
      };
    }
    return config;
  },
};

module.exports = nextConfig;
