/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
    // Prevent bundling of native modules in server components
    serverComponentsExternalPackages: ['bcrypt', '@mapbox/node-pre-gyp'],
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },

  // Webpack configuration
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    // Exclude bcrypt and other native modules from webpack bundling
    config.externals = [
      ...(config.externals || []),
      {
        bcrypt: 'commonjs bcrypt',
        '@mapbox/node-pre-gyp': 'commonjs @mapbox/node-pre-gyp',
      },
    ];

    // Ignore specific node-pre-gyp files that cause issues
    config.module = {
      ...config.module,
      exprContextCritical: false,
    };

    return config;
  },
};

module.exports = nextConfig;
