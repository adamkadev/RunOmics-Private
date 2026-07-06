"use client";

import { Flag } from "lucide-react";
import { t } from "@/i18n";

export function RaceRoutesToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      aria-pressed={value}
      className={[
        "glass-map-chip flex items-center gap-1.5 px-3 py-2.5 transition-colors hover:bg-muted",
        value ? "text-accent-text" : "text-foreground/80",
      ].join(" ")}
    >
      <Flag size={14} className={value ? "fill-current" : undefined} />
      <span className="text-xs font-semibold">{t.pages.map.raceRoutesOnly}</span>
    </button>
  );
}
