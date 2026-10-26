import { CHECKED_FOR } from "@/lib/findings";
import { InfoIcon } from "./Icons";

/** Always visible: sets honest expectations about what the scan covers. */
export function Disclaimer() {
  return (
    <aside className="disclaimer" aria-label="Limits of this tool">
      <InfoIcon size={16} />
      <div>
        <p>
          FinePrint only flags clauses it can quote. It may miss things, and
          it&rsquo;s not legal advice.
        </p>
        <p className="disclaimer__scope">
          <strong>Checked for:</strong> {CHECKED_FOR}
        </p>
      </div>
    </aside>
  );
}
