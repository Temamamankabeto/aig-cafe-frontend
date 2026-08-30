"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { clearSession, expireServerSession } from "@/lib/api";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const LAST_ACTIVITY_KEY = "auth_last_activity_at";
const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
];

export default function SessionInactivityGuard() {
  const router = useRouter();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWriteRef = useRef(0);

  useEffect(() => {
    const expireSession = () => {
      void expireServerSession().catch(() => undefined);
      clearSession();
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      router.replace("/login?reason=idle-timeout");
      router.refresh();
    };

    const scheduleExpiration = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      const stored = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || Date.now());
      const remaining = IDLE_TIMEOUT_MS - (Date.now() - stored);

      if (remaining <= 0) {
        expireSession();
        return;
      }

      timeoutRef.current = setTimeout(expireSession, remaining);
    };

    const recordActivity = () => {
      const now = Date.now();
      // Avoid excessive localStorage writes for high-frequency events.
      if (now - lastWriteRef.current < 1000) return;
      lastWriteRef.current = now;
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
      scheduleExpiration();
    };

    if (!localStorage.getItem(LAST_ACTIVITY_KEY)) {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    }

    scheduleExpiration();
    ACTIVITY_EVENTS.forEach((eventName) => window.addEventListener(eventName, recordActivity, { passive: true }));

    const onStorage = (event: StorageEvent) => {
      if (event.key === LAST_ACTIVITY_KEY) {
        scheduleExpiration();
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") scheduleExpiration();
    };

    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      ACTIVITY_EVENTS.forEach((eventName) => window.removeEventListener(eventName, recordActivity));
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [router]);

  return null;
}
