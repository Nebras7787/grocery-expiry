/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export required for Capacitor
  output: 'export',
  // Capacitor loads from file:// — trailing slash helps relative assets
  trailingSlash: true,
  // NOTE on file:// support: Next 14 refuses relative asset paths
  // (assetPrefix '.' is rejected by next/font; basePath './' is rejected by
  // config validation), so /_next/... refs stay absolute. This is fine because
  // Capacitor serves the app over https://localhost (androidScheme: 'https'),
  // not file:// — absolute paths resolve correctly there.
  // Do NOT point webDir at out/ and open it via file:// — it renders a blank
  // spinner because the JS chunks 404.
  // No Next.js Image Optimization on static export
  images: { unoptimized: true },
  // Ensure env vars are available at build
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  // Silence strict handling for capacitor file protocol
  // experimental: { appDir: true } // not needed in Next 14
};

export default nextConfig;
