"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { t } from "@/i18n";

interface Props {
  years: string[];
  value: string | null;
  onChange: (year: string | null) => void;
}

export function YearPicker({ years, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function select(year: string | null) {
    onChange(year);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative z-10">
      <button
        onClick={() => setOpen((o) => !o)}
        className="glass-map-chip flex items-center gap-2 px-3 py-2.5 transition-colors hover:bg-muted"
      >
        <span className="text-xs font-semibold text-foreground/80">
          {value ?? t.pages.map.allYears}
        </span>
        <ChevronDown
          size={16}
          className={["text-muted-foreground transition-transform", open ? "rotate-180" : ""].join(" ")}
        />
      </button>

      {open && (
        <div className="glass-map-chip absolute right-0 top-full z-10 mt-1 w-36 max-h-[calc(100vh-8rem)] overflow-y-auto py-1">
          {[null, ...years].map((y) => (
            <button
              key={y ?? "__all__"}
              onClick={() => select(y)}
              className={[
                "flex min-h-[44px] w-full items-center gap-2 px-3 text-left text-xs font-medium transition-colors hover:bg-muted",
                value === y ? "text-accent-text" : "text-foreground",
              ].join(" ")}
            >
              {y ?? t.pages.map.allYears}
              {value === y && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
