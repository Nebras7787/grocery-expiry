/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export required for Capacitor
  output: 'export',
  // Capacitor loads from file:// — trailing slash helps relative assets
  trailingSlash: true,
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
