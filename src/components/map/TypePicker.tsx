"use client";

import { ChevronDown } from "lucide-react";
import type { ActivityType } from "@/domain/activity/types";
import { ACTIVITY_TYPE_CONFIG } from "@/domain/activity/types";
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
  const menu = useChipMenu("end");

  function select(type: ActivityType | null) {
    onChange(type);
    menu.close();
  }

  return (
    <div className="shrink-0">
      <button
        {...menu.chipProps}
        className={[MAP_CHIP_GEOMETRY, "gap-2"].join(" ")}
        style={{ ...MAP_CHIP_STYLE, ...(value ? MAP_CHIP_ACTIVE : MAP_CHIP_NEUTRAL) }}
      >
        {value && <Dot type={value} />}
        <span className="font-semibold">{value ? t.activityTypes[value] : t.pages.map.allTypes}</span>
        <ChevronDown
          size={10}
          style={{ color: MAP_CHIP_CARET_INK }}
          className={["transition-transform", menu.open ? "rotate-180" : ""].join(" ")}
        />
      </button>

      <ChipMenuPanel menu={menu} className="glass-map-chip w-40 overflow-y-auto py-1">
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
      </ChipMenuPanel>
    </div>
  );
}
