import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";

export type DebateState = "WAITING" | "TOPIC_REVEAL" | "ROUND" | "VOTING" | "VERDICT" | "FINISHED";

export interface DebateRoomState {
  state: DebateState;
  topic: string;
  totalRounds: number;
  currentRound: number;
  activeSlot: "A" | "B" | null;
  topicRevealEndsAt: number | null;
  roundEndsAt: number | null;
  votingEndsAt: number | null;
  yourRole: "debater" | "audience";
  yourSlot: "A" | "B" | null;
  yourName: string;
}

export interface ArgumentEvent {
  argumentId: string;
  slot: "A" | "B";
  displayName: string;
  roundNumber: number;
  text: string;
  submittedAt: string;
}

export function useDebateState(socket: Socket | null){
  const [roomState, setRoomState] = useState<DebateRoomState | null>(null);
  const [argumentts, setArgumentts] = useState<ArgumentEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if(!socket) return;
    socket.on("room:state", (data: DebateRoomState) => setRoomState(data));
    socket.on("debate:state_changed", (data: Partial<DebateRoomState>) =>
      setRoomState((prev) => (prev ? { ...prev, ...data } : null))
    );
    socket.on("debate:argument_submitted", (arg: ArgumentEvent) =>
      setArgumentts((prev) => [...prev, arg])
    );
    socket.on("error", (data: { message: string }) => {
      setError(data.message);
      setTimeout(() => setError(null), 4000);
    });
    return () => {
      socket.off("room:state");
      socket.off("debate:state_changed");
      socket.off("debate:argument_submitted");
      socket.off("error");
    };
  }, [socket]);

  return { roomState, arguments: argumentts, error };
}