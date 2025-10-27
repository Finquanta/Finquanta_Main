/** @type {import('next').NextConfig} */
const nextConfig = {
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
};

export default nextConfig;
