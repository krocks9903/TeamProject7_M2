"use client";

import { motion } from "motion/react";

const TITLE = "What in this contract can cost you money?";

export function Hero() {
  const words = TITLE.split(" ");
  return (
    <div className="hero">
      <h1 className="hero__title" aria-label={TITLE}>
        {words.map((w, i) => (
          <span key={i}>
            <motion.span
              className="hero__word"
              aria-hidden="true"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.04, ease: "easeOut" }}
            >
              {w}
            </motion.span>{" "}
          </span>
        ))}
      </h1>
      <motion.p
        className="hero__lede"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, delay: words.length * 0.04 }}
      >
        Upload a lease or contract. In about a minute you&rsquo;ll see what can
        cost you, how much, and by when, with the exact sentence and page for
        every claim.
      </motion.p>
    </div>
  );
}
