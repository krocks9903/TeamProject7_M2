import type { Metadata } from "next";
import { Press_Start_2P } from "next/font/google";

const pixel = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FinePrint Mission Control",
  description: "Watch the FinePrint agent pipeline work on a real scan.",
  // private screen: not linked from the site, and kept out of search results
  robots: { index: false, follow: false },
};

export default function MissionControlLayout({ children }: { children: React.ReactNode }) {
  return <div className={pixel.variable}>{children}</div>;
}
