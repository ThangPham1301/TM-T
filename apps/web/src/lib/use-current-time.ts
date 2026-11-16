"use client";
import { useEffect, useState } from "react";

/** Clock is populated after mount and refreshed while the page is open. */
export function useCurrentTime() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const initial = setTimeout(() => setNow(Date.now()), 0);
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, []);
  return now;
}
