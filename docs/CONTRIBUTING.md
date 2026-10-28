# Contributing (Team DNK)

Read [docs/TEAM_OWNERSHIP.md](docs/TEAM_OWNERSHIP.md) first — it defines package lanes so Krish, Nolan, and Diego can work in parallel without merge pain.

## Setup

```bash
npm install
cp .env.example .env
npm test
npm run dev
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Build packages + start Next.js on :3000 |
| `npm test` | M2 pipeline tests (mock provider, no API keys) |
| `npm run build` | Build all workspaces |
| `npm run mcp:document` | Run MCP `document_parse` server over stdio |
| `npm run mcp:rebuild` | Rebuild `@fineprint/shared` + MCP after editing `packages/mcp-document/src` |

## Claude / Cursor MCP (`fineprint-document`)

Use the **built** server with absolute paths (not `tsx` / relative args):

```json
{
  "mcpServers": {
    "fineprint-document": {
      "type": "stdio",
      "command": "/opt/homebrew/bin/node",
      "args": [
        "/Users/n-dawg/FInePrint-Agent/packages/mcp-document/dist/server.js"
      ]
    }
  }
}
```

Repo copies: [`.cursor/mcp.json`](../.cursor/mcp.json) and [`docs/claude-mcp.example.json`](claude-mcp.example.json).

**After any change under `packages/mcp-document/src` or `packages/shared/src`, rebuild before restarting Claude/Cursor:**

```bash
npm run mcp:rebuild
```

Then fully quit and reopen Claude Desktop (or reload MCP in Cursor) so it picks up `dist/server.js`.

## PR checklist

- [ ] Touches only your lane (or lane owner approved)
- [ ] `npm test` passes
- [ ] No secrets in the diff
- [ ] README / architecture updated if behavior changed
- [ ] Another teammate reviewed
