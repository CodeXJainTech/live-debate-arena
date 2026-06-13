import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";

export interface Verdict {
  winnerId: "A" | "B" | null;
  reasoning: string;
  strongestForA: string;
  strongestForB: string;
  turningPoint: string;
}

export function useVerdict(socket: Socket | null) {
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [verdictError, setVerdictError] = useState<string | null>(null);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [isVeryLate, setIsVeryLate] = useState(false);

  useEffect(() => {
    if (!socket) return;

    // first soft warning after 15s, escalates after 35s
    const softTimeout = setTimeout(() => setIsTimedOut(true), 15_000);
    const hardTimeout = setTimeout(() => setIsVeryLate(true), 35_000);

    socket.on("verdict:ready", (data: Verdict) => {
      clearTimeout(softTimeout);
      clearTimeout(hardTimeout);
      setVerdict(data);
    });

    socket.on("verdict:error", (data: { message: string }) => {
      clearTimeout(softTimeout);
      clearTimeout(hardTimeout);
      setVerdictError(data.message);
    });

    return () => {
      clearTimeout(softTimeout);
      clearTimeout(hardTimeout);
      socket.off("verdict:ready");
      socket.off("verdict:error");
    };
  }, [socket]);

  return { verdict, verdictError, isTimedOut, isVeryLate };
}
