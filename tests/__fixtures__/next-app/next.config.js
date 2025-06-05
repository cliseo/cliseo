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
        // Overwrite ignored options directly with RegExp objects for problematic paths
        ignored: [
          /\/tmp\/snap-private-tmp\//,
          /\/tmp\/systemd-private-/,
          // Retain other default ignored patterns if necessary, e.g., for node_modules
          // If config.watchOptions.ignored was previously set and is an array, spread it
          // otherwise, default to ignoring node_modules. This is a common default.
          ...(Array.isArray(config.watchOptions?.ignored) ? config.watchOptions.ignored.filter(p => {
            // Filter out our paths if they were somehow already there as strings, to avoid duplication
            if (typeof p === 'string') {
              return !p.includes('/tmp/snap-private-tmp/') && !p.includes('/tmp/systemd-private-');
            }
            return true; // Keep other regexes or non-string patterns
          }) : [ /node_modules/ ]),
        ],
        // Ensure other potentially useful watchOptions are preserved
        aggregateTimeout: config.watchOptions?.aggregateTimeout || 200,
        poll: config.watchOptions?.poll,
        followSymlinks: config.watchOptions?.followSymlinks,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
