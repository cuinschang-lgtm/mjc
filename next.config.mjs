/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'is1-ssl.mzstatic.com',
      },
      {
        protocol: 'https',
        hostname: 'is2-ssl.mzstatic.com',
      },
      {
        protocol: 'https',
        hostname: 'is3-ssl.mzstatic.com',
      },
      {
        protocol: 'https',
        hostname: 'is4-ssl.mzstatic.com',
      },
      {
        protocol: 'https',
        hostname: 'is5-ssl.mzstatic.com',
      },
      {
        protocol: 'http',
        hostname: 'p1.music.126.net',
      },
      {
        protocol: 'https',
        hostname: 'p1.music.126.net',
      },
      {
        protocol: 'http',
        hostname: 'p2.music.126.net',
      },
      {
        protocol: 'https',
        hostname: 'p2.music.126.net',
      },
      {
        protocol: 'http',
        hostname: 'p3.music.126.net',
      },
      {
        protocol: 'https',
        hostname: 'p3.music.126.net',
      },
      {
        protocol: 'http',
        hostname: 'p4.music.126.net',
      },
      {
        protocol: 'https',
        hostname: 'p4.music.126.net',
      },
    ],
  },
};

export default nextConfig;
