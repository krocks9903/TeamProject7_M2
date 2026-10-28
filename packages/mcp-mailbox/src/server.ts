/**
 * MCP server: email_list, email_get, calendar_list, calendar_propose.
 * Demo backend = fixture inbox (no OAuth). Run: npm run mcp:mailbox
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  MCP_TOOL_CALENDAR_LIST,
  MCP_TOOL_CALENDAR_PROPOSE,
  MCP_TOOL_EMAIL_GET,
  MCP_TOOL_EMAIL_LIST,
} from "@fineprint/shared";
import { getMailboxStore } from "./store.js";

export function createMailboxMcpServer(): McpServer {
  const server = new McpServer({
    name: "fineprint-mailbox",
    version: "0.3.0",
  });
  const store = getMailboxStore();

  server.tool(
    MCP_TOOL_EMAIL_LIST,
    "List FinePrint demo inbox messages that look like leases, invoices, renewals, or contracts. Excludes pizza spam by default when query is empty.",
    {
      query: z
        .string()
        .optional()
        .describe("Optional search string, e.g. renewal OR invoice OR lease"),
    },
    async ({ query }) => {
      const messages = await store.listEmails(query ?? "");
      const compact = messages.map((m) => ({
        id: m.id,
        thread_id: m.thread_id,
        from: m.from,
        subject: m.subject,
        received_at: m.received_at,
        snippet: m.snippet,
        labels: m.labels,
        attachment_count: m.attachments.length,
      }));
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ query: query ?? "", messages: compact }) }],
      };
    }
  );

  server.tool(
    MCP_TOOL_EMAIL_GET,
    "Fetch one email by id, including full body text and attachment metadata (paths for PDF scan).",
    {
      id: z.string().describe("Email message id from email_list"),
    },
    async ({ id }) => {
      const message = await store.getEmail(id);
      if (!message) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "not_found", id }) }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify(message) }],
      };
    }
  );

  server.tool(
    MCP_TOOL_CALENDAR_LIST,
    "List FinePrint deadline / reminder events (demo calendar + proposed events).",
    {},
    async () => {
      const events = await store.listCalendar();
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ events }) }],
      };
    }
  );

  server.tool(
    MCP_TOOL_CALENDAR_PROPOSE,
    "Propose a calendar reminder (does not push to Google yet — stores locally for the FinePrint UI).",
    {
      title: z.string(),
      starts_at: z.string().describe("ISO date or datetime"),
      all_day: z.boolean().optional(),
      quote: z.string().optional(),
      notes: z.string().optional(),
      related_email_id: z.string().optional(),
      related_scan_id: z.string().optional(),
      source: z.enum(["document_scan", "email", "manual"]).optional(),
    },
    async (args) => {
      const event = await store.proposeCalendarEvent({
        title: args.title,
        starts_at: args.starts_at,
        all_day: args.all_day ?? true,
        quote: args.quote,
        notes: args.notes,
        related_email_id: args.related_email_id,
        related_scan_id: args.related_scan_id,
        source: args.source ?? "manual",
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(event) }],
      };
    }
  );

  return server;
}

async function main() {
  const server = createMailboxMcpServer();
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
