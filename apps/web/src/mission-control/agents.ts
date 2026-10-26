import type { ScanAgentId } from "@fineprint/shared";
import type { Point } from "./pathfinding";

export type Accessory = "cap" | "glasses" | "hat" | "stack" | "magnifier";

export interface Palette {
  hair: string;
  skin: string;
  shirt: string;
  accent: string;
  pants: string;
  shoes: string;
}

export interface AgentDef {
  id: ScanAgentId;
  name: string;
  role: string;
  /** Room name, matching a room in officeMap.ts. */
  room: string;
  /** Tile the character stands on while working. */
  desk: Point;
  /** Tile the character waits on in the lounge. */
  home: Point;
  accessory: Accessory;
  palette: Palette;
}

/**
 * The agent registry. To add a pipeline agent (for example the M3 multi-agent split):
 * add its id to SCAN_AGENTS in @fineprint/shared, add one entry here, and give its desk
 * furniture in officeMap.ts.
 */
export const AGENTS: AgentDef[] = [
  {
    id: "intake",
    name: "Inbox",
    role: "Intake clerk: receives and checks the upload",
    room: "Mailroom",
    desk: { x: 5, y: 3 },
    home: { x: 4, y: 17 },
    accessory: "cap",
    palette: { hair: "#5a3b2a", skin: "#f1c6a0", shirt: "#3d7fd1", accent: "#f2d14b", pants: "#2b3350", shoes: "#14161f" },
  },
  {
    id: "parser",
    name: "Page",
    role: "Parser: reads every page of the PDF",
    room: "Reading Room",
    desk: { x: 15, y: 3 },
    home: { x: 8, y: 17 },
    accessory: "glasses",
    palette: { hair: "#2b2b3a", skin: "#e5b58d", shirt: "#4fa66b", accent: "#8a5a34", pants: "#3a3f55", shoes: "#14161f" },
  },
  {
    id: "extractor",
    name: "Quill",
    role: "Analyst: asks the model for risky clauses",
    room: "Analyst Desk",
    desk: { x: 26, y: 3 },
    home: { x: 12, y: 17 },
    accessory: "hat",
    palette: { hair: "#c9893a", skin: "#f1c6a0", shirt: "#8b5fd0", accent: "#e9e1c8", pants: "#2e2a47", shoes: "#14161f" },
  },
  {
    id: "ranker",
    name: "Stack",
    role: "Ranker: sorts the findings by severity",
    room: "Ranking Board",
    desk: { x: 6, y: 13 },
    home: { x: 16, y: 17 },
    accessory: "stack",
    palette: { hair: "#7a3030", skin: "#d9a57e", shirt: "#d2793a", accent: "#f4f1e6", pants: "#3b3b4c", shoes: "#14161f" },
  },
  {
    id: "validator",
    name: "Proof",
    role: "Fact-checker: every quote must be in the document",
    room: "Fact-Check Desk",
    desk: { x: 20, y: 13 },
    home: { x: 20, y: 17 },
    accessory: "magnifier",
    palette: { hair: "#e9e9ef", skin: "#f1c6a0", shirt: "#d94f4f", accent: "#9fe3ff", pants: "#23263a", shoes: "#14161f" },
  },
];

export const AGENT_BY_ID: Record<string, AgentDef> = Object.fromEntries(
  AGENTS.map((a) => [a.id, a])
);
