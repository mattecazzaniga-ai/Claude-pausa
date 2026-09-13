/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse bundles pdfjs-dist, which breaks when webpack tries to bundle
  // it into the server/RSC layer (top-level Object.defineProperty on a
  // non-object during module init) — keep it a real CJS require at runtime
  // instead. mammoth has the same class of native/dynamic-require issues.
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "mammoth"],
  },
};

export default nextConfig;
