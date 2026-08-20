import type { NextConfig } from "next";

const securityHeaders = [
  // Prevents MIME-sniffing a response away from its declared Content-Type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // No legitimate need to embed this app in a third-party iframe.
  { key: "X-Frame-Options", value: "DENY" },
  // Don't leak full URLs (which can carry tokens in query strings, e.g.
  // password-reset links) to cross-origin destinations.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Locks down browser features this app never uses.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  // Belt-and-braces on top of Vercel's own HTTPS enforcement.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
