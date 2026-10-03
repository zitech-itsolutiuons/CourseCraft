"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";
import { refreshUserActivityAction } from "@/app/session-actions";
import { SESSION_ACTIVITY_REFRESH_MS, USER_IDLE_TIMEOUT_MS } from "@/lib/sessionPolicy";

export default function SessionActivityTracker({ isAdmin }: { isAdmin: boolean }) {
  useEffect(() => {
    if (isAdmin) return;

    let lastRefreshAt = 0;
    let lastPointerMoveAt = 0;
    let idleTimer = 0;
    const expireSession = () => void signOut({ redirectTo: "/signin?reason=inactive" });
    const resetIdleTimer = () => {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(expireSession, USER_IDLE_TIMEOUT_MS);
    };
    const recordActivity = () => {
      resetIdleTimer();
      const now = Date.now();
      if (now - lastRefreshAt < SESSION_ACTIVITY_REFRESH_MS) return;
      lastRefreshAt = now;
      void refreshUserActivityAction().then((active) => {
        if (!active) expireSession();
      }).catch(() => {});
    };
    const recordPointerMove = () => {
      const now = Date.now();
      if (now - lastPointerMoveAt < 1000) return;
      lastPointerMoveAt = now;
      recordActivity();
    };
    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    recordActivity();
    events.forEach((event) => window.addEventListener(event, recordActivity, { passive: true }));
    window.addEventListener("pointermove", recordPointerMove, { passive: true });

    return () => {
      window.clearTimeout(idleTimer);
      events.forEach((event) => window.removeEventListener(event, recordActivity));
      window.removeEventListener("pointermove", recordPointerMove);
    };
  }, [isAdmin]);

  return null;
}