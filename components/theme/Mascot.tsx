"use client";

import Image from "next/image";
import { useApp } from "@/components/layout/AppProvider";
import { THEME_PRESETS, mascotSrc, type MascotId } from "@/lib/theme";

/** Decorative mascot illustration (static SVG asset). */
export function Mascot({ id, size, className = "" }: { id: MascotId; size: number; className?: string }) {
  return (
    <Image src={mascotSrc(id)} alt="" width={size} height={size} unoptimized draggable={false} className={className} />
  );
}

/** Mascot of the active theme, or nothing for basic colour themes. */
export function ThemeMascot({ size, className }: { size: number; className?: string }) {
  const { settings } = useApp();
  const mascot = THEME_PRESETS[settings.theme].mascot;
  return mascot ? <Mascot id={mascot} size={size} className={className} /> : null;
}
