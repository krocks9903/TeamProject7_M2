import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

// Load the repo-root .env too. Next only reads .env files from apps/web, so without
// this MODEL_PROVIDER stays unset and the app silently falls back to the mock extractor.
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
nextEnv.loadEnvConfig(rootDir);

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
