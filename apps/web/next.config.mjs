/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@fineprint/shared",
    "@fineprint/agent",
    "@fineprint/mcp-document",
  ],
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;
