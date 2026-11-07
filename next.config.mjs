/** @type {import('next').NextConfig} */
const dev = process.env.NODE_ENV !== "production";

// Content Security Policy. 'wasm-unsafe-eval' lets the on-device OCR engine compile WebAssembly; nothing
// is loaded from third-party script hosts. Product photos come from Open Food Facts' image servers.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://images.openfoodfacts.org https://static.openfoodfacts.org",
  "font-src 'self'",
  "connect-src 'self'" + (dev ? " ws:" : ""),
  "worker-src 'self' blob:",
  "media-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(dev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]),
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["sharp"],
  outputFileTracingExcludes: { "*": ["bench/**", "services/**", ".data/**"] },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Service-Worker-Allowed", value: "/" }] },
      { source: "/ocr/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=2592000, immutable" }] },
    ];
  },
};
export default nextConfig;
