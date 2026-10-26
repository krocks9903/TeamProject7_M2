"use client";

import { motion } from "motion/react";
import { useRef, useState } from "react";
import { MAX_UPLOAD_MB } from "@/lib/errors";
import { DocIcon, UploadIcon } from "./Icons";

interface Props {
  onFile: (file: File) => void;
  onSample: () => void;
  disabled?: boolean;
}

export function UploadZone({ onFile, onSample, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function pick(files: FileList | null) {
    const file = files?.[0];
    if (file) onFile(file);
    // Allow re-selecting the same file after an error.
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <section className="upload" aria-labelledby="upload-title">
      <motion.div
        className={`dropzone${dragging ? " dropzone--active" : ""}`}
        animate={{ scale: dragging ? 1.02 : 1 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        onPointerMove={(e) => {
          // Spotlight follows the cursor without re-rendering React.
          const el = e.currentTarget;
          const r = el.getBoundingClientRect();
          el.style.setProperty("--mx", `${e.clientX - r.left}px`);
          el.style.setProperty("--my", `${e.clientY - r.top}px`);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) pick(e.dataTransfer.files);
        }}
      >
        <svg className="dropzone__border" aria-hidden="true" focusable="false">
          <rect x="0" y="0" width="100%" height="100%" rx="20" ry="20" />
        </svg>
        <motion.span
          className="dropzone__icon"
          aria-hidden="true"
          animate={dragging ? { y: [0, -10, 0] } : { y: 0 }}
          transition={
            dragging
              ? { duration: 0.6, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.2 }
          }
        >
          <UploadIcon size={32} />
        </motion.span>
        <h2 id="upload-title" className="dropzone__title">
          Drop your lease or contract PDF
        </h2>
        <p className="dropzone__hint">
          PDF only, up to {MAX_UPLOAD_MB} MB. Text-based PDFs work best (words you
          can select).
        </p>
        <div className="dropzone__actions">
          {/* The input is the real, labelled control; the label is the visible button. */}
          <input
            ref={inputRef}
            id="pdf-input"
            className="dropzone__input"
            type="file"
            accept="application/pdf,.pdf"
            disabled={disabled}
            onChange={(e) => pick(e.target.files)}
          />
          <label htmlFor="pdf-input" className="btn btn--primary">
            Choose a PDF
          </label>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={onSample}
            disabled={disabled}
          >
            <DocIcon size={16} /> Try a sample lease
          </button>
        </div>
      </motion.div>
      <p className="upload__note">
        Not sure what to upload? Try the sample lease to see how results look.
      </p>
    </section>
  );
}
