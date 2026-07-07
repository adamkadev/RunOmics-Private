"use client";

import Link from "next/link";
import { X, TrendingDown, TrendingUp } from "lucide-react";
import type { RouteMeta } from "@/application/usecases/GetAllRoutes";
import type { PersonalSegment } from "./personalSegment";
import { ACTIVITY_TYPE_CONFIG, ACTIVITY_TYPE_ICONS } from "@/domain/activity/types";
import {
  formatDateWithYear,
  formatDistance,
  formatDurationShort,
  formatPace,
} from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

interface Props {
  meta: RouteMeta;
  segment?: PersonalSegment | null;
  onClose: () => void;
  isFullscreen?: boolean;
}

function SegmentStat({ value, label, tone }: { value: React.ReactNode; label: string; tone?: string }) {
  return (
    <div className="flex-1 rounded-control bg-muted/60 px-2.5 py-2">
      <div className={cn("text-base font-bold leading-none tabular-nums", tone ?? "text-foreground")}>
        {value}
      </div>
      <div className="mt-1 text-micro text-muted-foreground">{label}</div>
    </div>
  );
}

function SegmentTrend({ delta }: { delta: number | null }) {
  const s = t.pages.map.segment;
  if (delta === null) return <SegmentStat value="—" label={s.trendLabel} />;
  const improving = delta < 0;
  const Icon = improving ? TrendingDown : TrendingUp;
  return (
    <SegmentStat
      value={
        <span className="inline-flex items-center gap-1">
          <Icon size={14} aria-hidden />
          {improving ? "−" : "+"}
          {Math.abs(delta)}s
        </span>
      }
      label={s.trendLabel}
      tone={improving ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}
    />
  );
}

function SegmentPanel({ segment }: { segment: PersonalSegment }) {
  const s = t.pages.map.segment;

  return (
    <div className="mt-2.5 border-t border-border pt-2.5">
      <div className="flex gap-2">
        <SegmentStat value={segment.passes} label={s.passesLabel} />
        <SegmentStat
          value={`${formatPace(segment.bestPaceSecPerKm)}`}
          label={s.recordLabel}
          tone="text-accent-text"
        />
        <SegmentTrend delta={segment.trendDeltaSecPerKm} />
      </div>

      <div className="mt-2.5 text-micro font-bold uppercase tracking-wide text-accent-text">
        {s.leaderboard}
      </div>
      <ul className="mt-1 space-y-0.5">
        {segment.entries.map((entry) => (
          <li key={entry.activityId}>
            <Link
              href={`/activities/${entry.activityId}`}
              aria-label={s.openRun(formatDateWithYear(entry.date))}
              className={cn(
                "flex items-center gap-2 rounded-control px-1.5 py-1 hover:bg-muted",
                entry.isSelected && "bg-accent-subtle",
              )}
            >
              <span className="w-5 shrink-0 text-center text-caption font-bold tabular-nums text-muted-foreground">
                {entry.rank === 1 ? "🥇" : `#${entry.rank}`}
              </span>
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-caption",
                  entry.isSelected ? "font-semibold text-foreground" : "text-foreground/80",
                )}
              >
                {formatDateWithYear(entry.date)}
              </span>
              <span className="text-caption font-semibold tabular-nums text-foreground">
                {formatPace(entry.paceSecPerKm)}
                <span className="text-micro font-normal text-subtle">/km</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Bottom card shown when a run is tapped on the heatmap. When the tapped trace
// is a loop run 3+ times, it grows into a personal segment: pass count, record
// pace, 90-day trend, and a podium of your own times.
export function RouteInfoCard({ meta, segment, onClose, isFullscreen }: Props) {
  const Icon = ACTIVITY_TYPE_ICONS[meta.type];
  const dotColor = ACTIVITY_TYPE_CONFIG[meta.type].dotColor;

  return (
    <div
      className={[
        "glass-map-chip absolute left-3 right-16 z-20 px-3 py-2.5",
        isFullscreen ? "bottom-[max(env(safe-area-inset-bottom),12px)]" : "bottom-3",
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
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
            {segment && (
              <span className="shrink-0 rounded-full bg-accent-subtle px-2 py-0.5 text-micro font-bold uppercase tracking-wide text-accent-text">
                {t.pages.map.segment.badge}
              </span>
            )}
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

      {segment && <SegmentPanel segment={segment} />}
    </div>
  );
}
