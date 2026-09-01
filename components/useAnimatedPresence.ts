"use client";

import { useEffect, useState } from "react";

export function useAnimatedPresence(open: boolean, duration = 190) {
  const [rendered, setRendered] = useState(open);
  const [state, setState] = useState<"open" | "closed">(open ? "open" : "closed");

  useEffect(() => {
    let exitTimeout: number | undefined;
    const transitionTimeout = window.setTimeout(() => {
      if (open) {
        setRendered(true);
        setState("open");
        return;
      }
      setState("closed");
      exitTimeout = window.setTimeout(() => setRendered(false), duration);
    }, 0);
    return () => {
      window.clearTimeout(transitionTimeout);
      if (exitTimeout !== undefined) window.clearTimeout(exitTimeout);
    };
  }, [duration, open]);

  return { rendered, state };
}
