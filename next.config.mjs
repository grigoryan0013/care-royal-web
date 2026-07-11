// basePath is set for GitHub Pages (served under /<repo>/). Empty for local
// dev and for Cloudflare Pages (served at the domain root).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
