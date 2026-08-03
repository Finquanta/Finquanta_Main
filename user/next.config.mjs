/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Baseline security headers on every response. (No strict CSP yet — it needs
  // careful allowlisting for inline scripts, Turnstile and Sentry.)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          { key: 'Permissions-Policy', value: 'geolocation=(), camera=(), microphone=(), browsing-topics=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/core/:path*',
        destination: 'http://localhost:8000/api/v1/core/:path*',
      },
      {
        source: '/api/v1/auth/:path*',
        destination: 'http://localhost:8000/api/v1/auth/:path*',
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '1337',
        pathname: '/uploads/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      }
    ],
  },
};

export default nextConfig;
