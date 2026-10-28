/**
 * MCP server exposing `document_parse`.
 * Run: `npm run mcp:document` (stdio). The web/orchestrator also imports parsePdfBuffer directly.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import {
  MCP_TOOL_DOCUMENT_PARSE,
  MCP_TOOL_DOCUMENT_SEARCH,
} from "@fineprint/shared";
import { parsePdfBuffer } from "./parse.js";
import { searchDocumentChunks } from "./retrieve.js";

export function createDocumentMcpServer(): McpServer {
  const server = new McpServer({
    name: "fineprint-document",
    version: "0.3.0",
  });

  server.tool(
    MCP_TOOL_DOCUMENT_PARSE,
    "Parse a PDF file on disk into page-mapped plain text for FinePrint citation grounding.",
    {
      file_path: z
        .string()
        .describe("Absolute path to a PDF file the server can read"),
    },
    async ({ file_path }) => {
      const buffer = await readFile(file_path);
      const result = await parsePdfBuffer(buffer);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result),
          },
        ],
      };
    }
  );

  server.tool(
    MCP_TOOL_DOCUMENT_SEARCH,
    "Search chunked document text (knowledge layer) for stipulation / payment language. Requires a prior FinePrint scan that wrote chunks for document_id.",
    {
      document_id: z.string().describe("Document id from a FinePrint scan"),
      query: z
        .string()
        .describe("Search query, e.g. early termination OR monthly rent"),
      top_k: z.number().int().positive().optional(),
    },
    async ({ document_id, query, top_k }) => {
      const hits = await searchDocumentChunks(document_id, query, top_k ?? 6);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ document_id, query, hits }),
          },
        ],
      };
    }
  );

  return server;
}

async function main() {
  const server = createDocumentMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const isDirect =
  process.argv[1] &&
  (process.argv[1].endsWith("server.js") ||
    process.argv[1].endsWith("server.ts"));

if (isDirect) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
