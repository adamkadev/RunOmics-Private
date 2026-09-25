"use client";

import { useEffect, useId, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type MenuAlign = "start" | "end";

const GAP_PX = 4;
const EDGE_PX = 8;

/**
 * Where a chip's menu goes: just under the chip, lined up with its start or
 * end edge, at least 8px inside the viewport, and no taller than the room
 * left below it.
 */
export function menuPlacement(
  chip: Pick<DOMRect, "left" | "right" | "bottom">,
  align: MenuAlign,
  viewport: { width: number; height: number }
): CSSProperties {
  const top = chip.bottom + GAP_PX;
  const maxHeight = Math.max(0, viewport.height - top - EDGE_PX);
  if (align === "end") {
    const right = Math.max(EDGE_PX, viewport.width - chip.right);
    return { position: "fixed", top, right, maxHeight, maxWidth: viewport.width - right - EDGE_PX };
  }
  const left = Math.max(EDGE_PX, chip.left);
  return { position: "fixed", top, left, maxHeight, maxWidth: viewport.width - left - EDGE_PX };
}

function placeUnder(chip: Element, align: MenuAlign): CSSProperties {
  return menuPlacement(chip.getBoundingClientRect(), align, { width: window.innerWidth, height: window.innerHeight });
}

export interface ChipMenu {
  open: boolean;
  close: () => void;
  /** Spread on the chip's button. */
  chipProps: {
    id: string;
    onClick: (e: MouseEvent<HTMLElement>) => void;
    "aria-expanded": boolean;
    "aria-controls": string | undefined;
  };
  menuId: string;
  placement: CSSProperties | null;
}

/**
 * Open state for one of the map's filter chips. The chips sit in a rail that
 * scrolls sideways, and a box that scrolls on one axis clips on both, so a
 * menu drawn inside the rail opened invisibly. ChipMenuPanel draws it on
 * document.body instead, and it stays placed under the chip while open.
 */
export function useChipMenu(align: MenuAlign): ChipMenu {
  const id = useId();
  const chipId = `${id}chip`;
  const menuId = `${id}menu`;
  const [placement, setPlacement] = useState<CSSProperties | null>(null);
  const open = placement !== null;

  function close() {
    setPlacement(null);
  }

  function onClick(e: MouseEvent<HTMLElement>) {
    if (open) return close();
    setPlacement(placeUnder(e.currentTarget, align));
  }

  useEffect(() => {
    if (!open) return;
    const inside = (target: EventTarget | null) =>
      target instanceof Node && [chipId, menuId].some((elementId) => document.getElementById(elementId)?.contains(target));

    function onPointerDown(e: PointerEvent) {
      if (!inside(e.target)) setPlacement(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setPlacement(null);
      document.getElementById(chipId)?.focus();
    }
    // The menu follows its chip: the rail scrolling sideways, the page
    // scrolling or a rotation moves the chip, and a chip partly outside the
    // rail is scrolled into view by the very tap that opens it - that scroll
    // lands after the menu has opened, so closing on it lost the menu.
    function follow() {
      const chip = document.getElementById(chipId);
      if (chip) setPlacement(placeUnder(chip, align));
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
  }, [open, chipId, menuId, align]);

  return {
    open,
    close,
    chipProps: { id: chipId, onClick, "aria-expanded": open, "aria-controls": open ? menuId : undefined },
    menuId,
    placement,
  };
}

/** Above the fullscreen map (z-50) and the app chrome. */
const MENU_Z = 60;

export function ChipMenuPanel({ menu, className, children }: { menu: ChipMenu; className: string; children: ReactNode }) {
  if (!menu.placement) return null;
  return createPortal(
    <div id={menu.menuId} className={className} style={{ ...menu.placement, zIndex: MENU_Z }}>
      {children}
    </div>,
    document.body
  );
}
