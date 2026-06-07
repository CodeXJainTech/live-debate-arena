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

  useEffect(() => {
    if (!socket) return;

    // if no verdict after 30 seconds, tell the user
    const timeout = setTimeout(() => {
      setIsTimedOut(true);
    }, 30_000);

    socket.on("verdict:ready", (data: Verdict) => {
      clearTimeout(timeout);
      setVerdict(data);
    });

    socket.on("verdict:error", (data: { message: string }) => {
      clearTimeout(timeout);
      setVerdictError(data.message);
    });

    return () => {
      clearTimeout(timeout);
      socket.off("verdict:ready");
      socket.off("verdict:error");
    };
  }, [socket]);

  return { verdict, verdictError, isTimedOut };
}