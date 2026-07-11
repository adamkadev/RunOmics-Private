"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ActivityType } from "@/domain/activity/types";
import { ACTIVITY_TYPE_CONFIG } from "@/domain/activity/types";
import { t } from "@/i18n";

interface Props {
  types: ActivityType[];
  value: ActivityType | null;
  onChange: (type: ActivityType | null) => void;
}

function Dot({ type }: { type: ActivityType }) {
  return (
    <span
      className="h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: ACTIVITY_TYPE_CONFIG[type].chartColor }}
      aria-hidden
    />
  );
}

export function TypePicker({ types, value, onChange }: Props) {
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

  function select(type: ActivityType | null) {
    onChange(type);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative z-10">
      <button
        onClick={() => setOpen((o) => !o)}
        className="glass-map-chip flex items-center gap-2 px-3 py-2.5 transition-colors hover:bg-muted"
      >
        {value && <Dot type={value} />}
        <span className="text-xs font-semibold text-foreground/80">
          {value ? t.activityTypes[value] : t.pages.map.types}
        </span>
        <ChevronDown
          size={16}
          className={["text-muted-foreground transition-transform", open ? "rotate-180" : ""].join(" ")}
        />
      </button>

      {open && (
        <div className="glass-map-chip absolute right-0 top-full z-10 mt-1 w-40 max-h-[calc(100vh-8rem)] overflow-y-auto py-1">
          {[null, ...types].map((ty) => (
            <button
              key={ty ?? "__all__"}
              onClick={() => select(ty)}
              className={[
                "flex min-h-[44px] w-full items-center gap-2 px-3 text-left text-xs font-medium transition-colors hover:bg-muted",
                value === ty ? "text-accent-text" : "text-foreground",
              ].join(" ")}
            >
              {ty && <Dot type={ty} />}
              {ty ? t.activityTypes[ty] : t.pages.map.allTypes}
              {value === ty && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
