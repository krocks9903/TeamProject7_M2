"use client";

import { MotionConfig, motion } from "motion/react";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Disclaimer } from "@/components/Disclaimer";
import { ErrorNotice } from "@/components/ErrorNotice";
import { Hero } from "@/components/Hero";
import { MiniPreview } from "@/components/MiniPreview";
import { ResultsApp } from "@/components/ResultsApp";
import { ScanScreen } from "@/components/ScanScreen";
import { TopBar } from "@/components/TopBar";
import { UploadZone } from "@/components/UploadZone";
import { useScan } from "@/hooks/useScan";
import { makeError } from "@/lib/errors";

const SAMPLE_URL = "/sample-lease.pdf";

const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.25 },
};

export default function HomePage() {
  const scan = useScan();
  const [sampleError, setSampleError] = useState(false);

  async function loadSample() {
    setSampleError(false);
    try {
      const res = await fetch(SAMPLE_URL);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      scan.start(new File([blob], "sample-lease.pdf", { type: "application/pdf" }));
    } catch {
      setSampleError(true);
    }
  }

  let screen: React.ReactNode;

  if (scan.phase === "done" && scan.detail) {
    screen = (
      <motion.div key="results" {...fade}>
        <ResultsApp
          detail={scan.detail}
          cacheHit={scan.cacheHit}
          fileUrl={scan.fileUrl}
          onReset={scan.reset}
        />
      </motion.div>
    );
  } else if (scan.phase === "running") {
    screen = (
      <motion.div key="running" {...fade}>
        <AppShell theme="ice" backdrop="ice">
          <TopBar
            title="Scanning your document"
            file={scan.fileName ? { name: scan.fileName, sub: "Scanning…" } : null}
            ring={{ percent: Math.round(((Math.min(scan.step, 3) + 0.5) / 4) * 100), caption: "Scanning…", spinning: true }}
          />
          <Disclaimer />
          <main id="main" className="view" tabIndex={-1}>
            <ScanScreen step={scan.step} fileName={scan.fileName} cacheHit={scan.cacheHit} />
          </main>
        </AppShell>
      </motion.div>
    );
  } else {
    screen = (
      <motion.div key="landing" {...fade}>
        <AppShell theme="dark" backdrop="dusk">
          <TopBar title="Lease and contract scanner" />
          <Disclaimer />
          <main id="main" className="view view--landing" tabIndex={-1}>
            <Hero />
            {scan.error ? (
              <ErrorNotice error={scan.error} onResume={scan.canResume ? scan.resume : undefined} />
            ) : null}
            {sampleError ? (
              <ErrorNotice error={makeError("network", "We couldn't load the sample lease.")} />
            ) : null}
            <UploadZone onFile={scan.start} onSample={loadSample} />
            <MiniPreview />
          </main>
        </AppShell>
      </motion.div>
    );
  }

  return (
    // reducedMotion="user": transforms and layout animations are skipped for
    // people who prefer reduced motion; opacity fades still run.
    <MotionConfig reducedMotion="user">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {screen}
    </MotionConfig>
  );
}
