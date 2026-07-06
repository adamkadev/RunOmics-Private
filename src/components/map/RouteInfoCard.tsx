"use client";

import { X } from "lucide-react";
import type { RouteMeta } from "@/application/usecases/GetAllRoutes";
import { ACTIVITY_TYPE_CONFIG, ACTIVITY_TYPE_ICONS } from "@/domain/activity/types";
import {
  formatDateWithYear,
  formatDistance,
  formatDurationShort,
  formatPace,
} from "@/lib/formatters";
import { t } from "@/i18n";

interface Props {
  meta: RouteMeta;
  onClose: () => void;
  isFullscreen?: boolean;
}

// Bottom card shown when a run is tapped on the heatmap - turns the map from a static
// poster into something explorable (which run is this, when, how far, how fast).
export function RouteInfoCard({ meta, onClose, isFullscreen }: Props) {
  const Icon = ACTIVITY_TYPE_ICONS[meta.type];
  const dotColor = ACTIVITY_TYPE_CONFIG[meta.type].dotColor;

  return (
    <div
      className={[
        "glass-map-chip absolute left-3 right-16 z-20 flex items-center gap-3 px-3 py-2.5",
        isFullscreen ? "bottom-[max(env(safe-area-inset-bottom),12px)]" : "bottom-3",
      ].join(" ")}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `${dotColor}22`, color: dotColor }}
        aria-hidden
      >
        <Icon size={16} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-xs font-semibold text-foreground">
            {t.activityTypes[meta.type]}
          </span>
          <span className="shrink-0 text-caption text-subtle">
            {formatDateWithYear(meta.date)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-caption text-subtle">
          <span className="font-medium text-foreground/80">
            {formatDistance(meta.distanceKm)} {t.units.km}
          </span>
          <span aria-hidden>·</span>
          <span>{formatDurationShort(meta.durationSeconds)}</span>
          {meta.paceSecPerKm != null && (
            <>
              <span aria-hidden>·</span>
              <span>{formatPace(meta.paceSecPerKm)}</span>
            </>
          )}
        </div>
      </div>

      <button
        onClick={onClose}
        aria-label={t.pages.map.closeCard}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X size={16} />
      </button>
    </div>
  );
}
