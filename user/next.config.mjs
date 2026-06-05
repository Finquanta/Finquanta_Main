/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
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
