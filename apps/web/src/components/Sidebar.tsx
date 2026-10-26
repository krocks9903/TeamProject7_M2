"use client";

import { Logo } from "./Logo";
import { ViewIcon, type ViewId } from "./NavIcons";

export const NAV_ITEMS: Array<{ id: ViewId; label: string }> = [
  { id: "results", label: "Results" },
  { id: "summary", label: "Summary" },
  { id: "terms", label: "Key Terms" },
  { id: "costs", label: "Costs" },
  { id: "clauses", label: "Clauses" },
  { id: "map", label: "Document Map" },
  { id: "sources", label: "Sources" },
];

interface Props {
  view: ViewId;
  onView: (view: ViewId) => void;
}

/** Left nav on desktop; becomes a horizontal tab bar under 900px (CSS only). */
export function Sidebar({ view, onView }: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <Logo size={30} />
        <span>FinePrint</span>
      </div>
      <nav aria-label="Analysis sections">
        <ul className="sidebar__list">
          {NAV_ITEMS.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="sidebar__item"
                aria-current={view === item.id ? "page" : undefined}
                onClick={() => onView(item.id)}
              >
                <ViewIcon id={item.id} />
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <p className="sidebar__tag">Find what matters. Faster.</p>
    </aside>
  );
}
