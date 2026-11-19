/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  async rewrites() {
    const upstream = process.env.API_WEBSOCKET_UPSTREAM ?? "http://127.0.0.1:8088";
    return {
      beforeFiles: [{ source: "/api/store/live", destination: `${upstream}/api/store/live` }],
    };
  },
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    cpus: 1,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "cdn.omama.vn" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "img.vietqr.io" },
      { protocol: "https", hostname: "vietqr.app" },
    ],
  },
};

export default nextConfig;
