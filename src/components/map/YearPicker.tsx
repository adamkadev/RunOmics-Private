"use client";

import { ChevronDown } from "lucide-react";
import { t } from "@/i18n";
import {
  MAP_CHIP_ACTIVE,
  MAP_CHIP_CARET_INK,
  MAP_CHIP_GEOMETRY,
  MAP_CHIP_NEUTRAL,
  MAP_CHIP_STYLE,
} from "./mapUtils";
import { ChipMenuPanel, useChipMenu } from "./chipMenu";

interface Props {
  years: string[];
  value: string | null;
  onChange: (year: string | null) => void;
}

export function YearPicker({ years, value, onChange }: Props) {
  const menu = useChipMenu("end");

  function select(year: string | null) {
    onChange(year);
    menu.close();
  }

  return (
    <div className="shrink-0">
      <button
        {...menu.chipProps}
        className={[MAP_CHIP_GEOMETRY, "gap-2"].join(" ")}
        style={{ ...MAP_CHIP_STYLE, ...(value ? MAP_CHIP_ACTIVE : MAP_CHIP_NEUTRAL) }}
      >
        <span className="font-semibold">{value ?? t.pages.map.allYears}</span>
        <ChevronDown
          size={10}
          style={{ color: MAP_CHIP_CARET_INK }}
          className={["transition-transform", menu.open ? "rotate-180" : ""].join(" ")}
        />
      </button>

      <ChipMenuPanel menu={menu} className="glass-map-chip w-36 overflow-y-auto py-1">
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
      </ChipMenuPanel>
    </div>
  );
}
