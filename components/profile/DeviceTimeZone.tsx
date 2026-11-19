"use client";

import { useEffect, useState } from "react";
import { timeZoneLabel } from "@/lib/profile/model";

/**
 * The device's own time zone. The server's value (from the `tg_tz` cookie) is
 * shown first; on a first visit that can still be its fallback, so the
 * browser's answer replaces it once the page is running.
 */
export function DeviceTimeZone({ serverTimeZone }: { serverTimeZone: string }) {
  const [zone, setZone] = useState(serverTimeZone);
  useEffect(() => {
    try {
      const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (device) setZone(device);
    } catch {
      // Keep the server's value.
    }
  }, []);
  return (
    <p className="text-sm text-stone-700" data-testid="profile-time-zone">
      {timeZoneLabel(zone)}
    </p>
  );
}
