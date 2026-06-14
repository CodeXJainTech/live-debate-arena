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
  connectedSlots?: ("A" | "B")[];
}

export interface ArgumentEvent {
  argumentId: string;
  slot: "A" | "B";
  displayName: string;
  roundNumber: number;
  text: string;
  submittedAt: string;
}

interface HistoryArgument extends ArgumentEvent {
  scores: { dimension: string; score: number; critique: string }[];
}

export function useDebateState(socket: Socket | null) {
  const [roomState, setRoomState] = useState<DebateRoomState | null>(null);
  const [arguments_, setArguments] = useState<ArgumentEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return;

    socket.on("room:state", (data: DebateRoomState) => setRoomState(data));

    socket.on("debate:state_changed", (data: Partial<DebateRoomState>) =>
      setRoomState((prev) => (prev ? { ...prev, ...data } : null))
    );

    // full history on join/rejoin — replaces local list entirely to avoid duplicates
    socket.on("room:history", (data: { arguments: HistoryArgument[] }) => {
      setArguments(data.arguments);
    });

    socket.on("debate:argument_submitted", (arg: ArgumentEvent) => {
      setArguments((prev) => {
        // avoid duplicates if history and live event overlap
        if (prev.find((a) => a.argumentId === arg.argumentId)) return prev;
        return [...prev, arg];
      });
    });

    socket.on("room:peer_joined", (data: { role: string; slot: string | null }) => {
      if (data.slot) {
        setRoomState((prev) => {
          if (!prev) return null;
          const connectedSlots = (prev as any).connectedSlots ?? [];
          if (connectedSlots.includes(data.slot)) return prev;
          return { ...prev, connectedSlots: [...connectedSlots, data.slot] };
        });
      }
    });

    socket.on("room:peer_left", (data: { slot: string | null }) => {
      if (data.slot) {
        setRoomState((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            connectedSlots: (prev as any).connectedSlots?.filter(
              (s: string) => s !== data.slot
            ) ?? [],
          };
        });
      }
    });
    
    socket.on("room:peer_disconnected", (data: { slot: string; displayName: string }) => {
      setReconnecting(`Debater ${data.slot} disconnected. Waiting for reconnection...`);
    });

    socket.on("room:peer_reconnected", (data: { slot: string; displayName: string }) => {
      setReconnecting(null);
    });

    socket.on("error", (data: { message: string }) => {
      setError(data.message);
      setTimeout(() => setError(null), 4000);
    });

    return () => {
      socket.off("room:state");
      socket.off("debate:state_changed");
      socket.off("room:history");
      socket.off("debate:argument_submitted");
      socket.off("room:peer_joined");
      socket.off("room:peer_left");
      socket.off("room:peer_disconnected");
      socket.off("room:peer_reconnected");
      socket.off("error");
    };
  }, [socket]);

  return { roomState, arguments: arguments_, error, reconnecting };
}