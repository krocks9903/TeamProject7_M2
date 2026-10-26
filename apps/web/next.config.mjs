/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@fineprint/shared",
    "@fineprint/agent",
    "@fineprint/mcp-document",
    "@fineprint/mcp-mailbox",
  ],
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
