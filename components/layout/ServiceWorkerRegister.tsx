"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { withBase } from "@/lib/basePath";
import { useApp } from "./AppProvider";

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/**
 * Registers the service worker (production builds only) and shows two small banners:
 *  - offline mode (the app keeps working on local data),
 *  - a new version is ready (applied only when the user taps, so a dictation is never interrupted).
 */
export function ServiceWorkerRegister() {
  const { t } = useApp();
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register(withBase("/sw.js"), { scope: withBase("/") })
      .then((registration) => {
        // A version may already be waiting from an earlier visit.
        if (registration.waiting && navigator.serviceWorker.controller) setWaiting(registration.waiting);
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            // First install has no controller: nothing to update, it just starts working.
            if (worker.state === "installed" && navigator.serviceWorker.controller) setWaiting(worker);
          });
        });
      })
      .catch(() => {
        // Non-fatal: the app works without a service worker (just not offline).
      });
  }, []);

  function applyUpdate() {
    if (!waiting) return;
    navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
    waiting.postMessage("SKIP_WAITING");
  }

  if (online && !waiting) return null;

  return (
    <div
      className="fixed inset-x-0 z-30 flex justify-center px-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-4"
      role="status"
      aria-live="polite"
    >
      <div className="flex max-w-md items-center gap-3 rounded-control border border-border bg-surface px-4 py-2 text-sm text-foreground shadow-card">
        {!online ? (
          <span>📴 {t("pwa.offlineBanner")}</span>
        ) : (
          <>
            <span>✨ {t("pwa.updateAvailable")}</span>
            <button
              type="button"
              onClick={applyUpdate}
              className="min-h-9 rounded-control bg-primary px-3 text-sm font-medium text-on-primary hover:bg-primary-hover"
            >
              {t("pwa.updateNow")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
