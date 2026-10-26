"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CloudIcon } from "@/components/ui/icons";
import type { CloudStatus } from "@/lib/cloud/CloudSyncService";
import type { MessageKey } from "@/lib/i18n";
import { useApp } from "./AppProvider";

type Look = { key: MessageKey; badge: string; tone: string };

/** Header cloud icon on every page: synced / syncing / offline / failed / this device only. */
export function CloudStatusButton() {
  const { t, services } = useApp();
  const [status, setStatus] = useState<CloudStatus>(() => services.cloud.getStatus());
  const [online, setOnline] = useState(true);

  useEffect(() => services.cloud.subscribe(setStatus), [services]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (status.state === "loading") return null;

  const look: Look =
    status.state === "signedOut"
      ? { key: "cloudStatus.local", badge: "–", tone: "text-muted" }
      : !online
        ? { key: "cloudStatus.offline", badge: "×", tone: "text-muted" }
        : status.syncing
          ? { key: "cloudStatus.syncing", badge: "↻", tone: "text-primary motion-safe:animate-pulse" }
          : status.error
            ? { key: "cloudStatus.error", badge: "!", tone: "text-danger" }
            : { key: "cloudStatus.synced", badge: "✓", tone: "text-success" };
  const label = t(look.key);

  return (
    <Link
      href="/settings"
      title={label}
      aria-label={label}
      className={`relative flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-surface-muted ${look.tone}`}
    >
      <CloudIcon className="size-6" />
      <span aria-hidden="true" className="absolute top-[15px] text-[10px] leading-none font-bold">
        {look.badge}
      </span>
    </Link>
  );
}
