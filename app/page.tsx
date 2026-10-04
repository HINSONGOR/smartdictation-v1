"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** "/" just forwards to the dashboard (client-side, so it works on static hosting and offline). */
export default function RootPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);
  return null;
}
