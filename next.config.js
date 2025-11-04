/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '5gb',
    },
  },
  // Configure allowed image domains for Next.js Image component
  images: {
    domains: [],
  },
  // Environment variables to expose to the browser
  env: {
    NEXT_PUBLIC_APP_NAME: 'Backup System',
  },
};

module.exports = nextConfig;
