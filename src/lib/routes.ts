// Routes reachable without a confirmed session. `next.config.mjs` sets
// `trailingSlash: true`, so usePathname() returns '/login/' rather than
// '/login'; normalize before comparing.
export const PUBLIC_PATHS = ['/login', '/register'];

export function isPublicPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return PUBLIC_PATHS.includes(normalized);
}
