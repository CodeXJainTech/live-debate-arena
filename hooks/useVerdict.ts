import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Socket } from "socket.io-client";

export interface Verdict {
  winnerId: "A" | "B" | null;
  reasoning: string;
  strongestForA: string;
  strongestForB: string;
  turningPoint: string;
}

export function useVerdict(socket: Socket | null, roomId: string) {
  const router = useRouter();
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [verdictError, setVerdictError] = useState<string | null>(null);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const redirected = useRef(false);

  useEffect(() => {
    if (!socket) return;

    // if no verdict after 30 seconds, tell the user
    const timeout = setTimeout(() => {
      setIsTimedOut(true);
    }, 30_000);

    socket.on("verdict:ready", (data: Verdict) => {
      clearTimeout(timeout);
      setVerdict(data);
      // autodirecting to history page from here.
      if (!redirected.current) {
        redirected.current = true;
        setTimeout(() => {
          router.push(`/history/${roomId}`);
        }, 3000);
      }
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
  }, [socket, roomId, router]);

  return { verdict, verdictError, isTimedOut };
}