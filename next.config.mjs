import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const isProduction = process.env.NODE_ENV === 'production';

// Phase 11: canonical URLs, sitemap, robots, Open Graph and structured data all
// use NEXT_PUBLIC_SITE_URL (src/lib/config.ts). Without it they fall back to an
// unconfirmed placeholder host, so say so loudly on every production build
// (same validation as config.ts; no domain is guessed here).
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '');
if (isProduction && !(siteUrl && /^https:\/\/[a-z0-9.-]+$/i.test(siteUrl))) {
  console.warn(
    '\n[config] WARNING: NEXT_PUBLIC_SITE_URL is not set to a valid https:// address. ' +
      'Canonical URLs, sitemap, robots.txt, Open Graph and structured data will use the PLACEHOLDER domain. ' +
      'Set the confirmed production domain before launch.\n'
  );
}

// HTML pages get a strict, nonce-based Content-Security-Policy per request
// from src/proxy.ts (src/lib/security/csp.ts). Responses the proxy does not
// handle (API JSON, PDFs, static files) keep this narrow policy: no framing by
// other sites, no plugins (<object>/<embed>), no <base> hijacking, no form
// posts to other origins.
const fallbackContentSecurityPolicy = [
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

// Paths the proxy skips (keep in step with the matcher in src/proxy.ts).
const NON_PAGE_SOURCES = [
  '/api/:path*',
  '/_next/:path*',
  '/images/:path*',
  '/videos/:path*',
  '/menu/:path*',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
];

const nextConfig = {
  reactStrictMode: true,
  // Do not advertise the framework in every response.
  poweredByHeader: false,
  // Pin the project root (a stray lockfile in the user's home folder otherwise
  // makes Turbopack guess the workspace root).
  turbopack: { root: path.dirname(fileURLToPath(import.meta.url)) },
  images: {
    // WebP only. AVIF was originally disabled to avoid GHSA-2xp9-vwfh-vxw4
    // on Next 14.2.x; that advisory is fixed in Next 16. AVIF stays off for
    // now so image output is unchanged; re-enabling it is a separate decision.
    formats: ['image/webp'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // Google sign-in opens a popup that must report back to this window,
          // so "same-origin-allow-popups" rather than "same-origin".
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          // Other sites cannot embed this site's files (images, videos, PDFs).
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          // Production builds only. Browsers honour HSTS only on HTTPS
          // responses, so it has no effect on local http:// testing. No
          // includeSubDomains / preload: the final domain is not confirmed yet.
          ...(isProduction ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }] : []),
        ],
      },
      ...NON_PAGE_SOURCES.map((source) => ({
        source,
        headers: [{ key: 'Content-Security-Policy', value: fallbackContentSecurityPolicy }],
      })),
    ];
  },
};

export default nextConfig;
