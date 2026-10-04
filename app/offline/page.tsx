import { OfflineFallback } from "@/components/layout/OfflineFallback";

/** Served by the service worker when a page isn't cached and the network is unavailable. */
export default function OfflinePage() {
  return <OfflineFallback />;
}
