"use client";

import { Check, ChevronDown, X } from "lucide-react";
import { t } from "@/i18n";
import { MAP_CHIP_CARET_INK, MAP_CHIP_GEOMETRY, MAP_CHIP_OPEN_BORDER, MAP_CHIP_PADDING } from "./mapUtils";
import { ChipMenuPanel, useChipMenu } from "./chipMenu";

interface Props<T extends string> {
  /** What the chip reads while nothing is set: "All types", "All years". */
  allLabel: string;
  options: readonly T[];
  value: T | null;
  label: (option: T) => string;
  onChange: (value: T | null) => void;
}

/**
 * Type and year (v4.8): neutral until set, then the area chip's accent
 * (v4.17) with an ✕ that clears it. The menu lists "All" first.
 */
export function FilterChip<T extends string>({ allLabel, options, value, label, onChange }: Props<T>) {
  const menu = useChipMenu("end");

  function select(next: T | null) {
    onChange(next);
    menu.close();
  }

  const text = value ? label(value) : allLabel;

  return (
    <div className="shrink-0">
      <div
        className={[MAP_CHIP_GEOMETRY, "overflow-hidden", value ? "map-chip-selected" : "map-chip"].join(" ")}
        style={menu.open && !value ? { border: MAP_CHIP_OPEN_BORDER, color: "var(--foreground)" } : undefined}
      >
        <button
          {...menu.chipProps}
          className="flex h-full items-center gap-1.5"
          style={{ padding: value ? "0 4px 0 14px" : MAP_CHIP_PADDING, color: "inherit" }}
        >
          <span className={value ? "font-semibold" : ""}>{text}</span>
          {!value && (
            <ChevronDown
              size={12}
              strokeWidth={2.5}
              style={{ color: MAP_CHIP_CARET_INK }}
              className={["transition-transform", menu.open ? "rotate-180" : ""].join(" ")}
            />
          )}
        </button>
        {value && (
          <button
            onClick={() => onChange(null)}
            aria-label={t.pages.map.clearFilter(text)}
            className="flex h-full items-center pl-1 pr-3.5"
            style={{ color: "inherit", opacity: 0.7 }}
          >
            <X size={13} strokeWidth={2.5} />
          </button>
        )}
      </div>

      <ChipMenuPanel menu={menu} className="glass-map-chip w-[200px] overflow-y-auto rounded-[14px] py-1">
        {[null, ...options].map((option, i) => (
          <button
            key={option ?? "__all__"}
            onClick={() => select(option)}
            className={[
              "flex min-h-[44px] w-full items-center justify-between px-3.5 text-left text-[15px] text-foreground transition-colors hover:bg-muted",
              i > 0 ? "border-t border-border" : "",
            ].join(" ")}
          >
            {option ? label(option) : allLabel}
            {value === option && <Check size={16} strokeWidth={2.5} className="text-accent-text" />}
          </button>
        ))}
      </ChipMenuPanel>
    </div>
  );
}
