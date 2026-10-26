"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { AnimatedCheck } from "./AnimatedCheck";
import { CopyIcon } from "./NavIcons";

/** Copies plain text; morphs into a check + "Copied" for 1.5s. */
export function CopyButton({ getText }: { getText: () => string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(getText());
      setFailed(false);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setFailed(true);
      setTimeout(() => setFailed(false), 4000);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`btn btn--secondary btn--sm btn--copy${copied ? " btn--copied" : ""}`}
        onClick={copy}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={copied ? "copied" : "copy"}
            className="btn__inner"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {copied ? <AnimatedCheck size={16} /> : <CopyIcon size={16} />}
            {copied ? "Copied" : "Copy summary"}
          </motion.span>
        </AnimatePresence>
      </button>
      <span className="visually-hidden" role="status" aria-live="polite">
        {copied ? "Summary copied. Paste it into an email." : ""}
        {failed ? "Couldn't copy automatically. Use Download as PDF instead." : ""}
      </span>
      {failed ? (
        <span className="copyfail" aria-hidden="true">
          Couldn&rsquo;t copy. Use Download as PDF.
        </span>
      ) : null}
    </>
  );
}
