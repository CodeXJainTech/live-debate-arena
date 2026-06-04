"use client";

import { useSearchParams, useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import JoinModal from "@/components/JoinModal";
import { getSocket, disconnectSocket } from "@/libs/socket";
import { jwtDecode } from "jwt-decode";

interface TokenPayload {
  roomId: string;
  slot: "A" | "B";
}

export default function DebaterRoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomId = params.roomId as string;
  const token = searchParams.get("token");

  const [joined, setJoined] = useState(false);
  const [roomState, setRoomState] = useState<any>(null);
  const [error, setError] = useState("");

  let slot: "A" | "B" | null = null;
  if (token) {
    try {
      const decoded = jwtDecode<TokenPayload>(token);
      slot = decoded.slot;
    } catch {
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Invalid debater link. No token found.</p>
      </div>
    );
  }

  function handleJoin(displayName: string, age: number) {
    const sessionId = uuidv4();
    const socket = getSocket({ roomId, displayName, age, sessionId, token: token! });

    socket.on("room:state", (state) => {
      setRoomState(state);
      setJoined(true);
    });

    socket.on("connect_error", (err) => {
      setError(err.message);
      disconnectSocket();
    });
  }

  useEffect(() => {
    return () => { disconnectSocket(); };
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 font-medium">Could not join room</p>
          <p className="text-gray-500 text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!joined) {
    return (
      <JoinModal
        roomId={roomId}
        role="debater"
        slot={slot ?? undefined}
        onJoin={handleJoin}
      />
    );
  }

  return (
    <div className="min-h-screen p-8">
      <pre className="text-xs text-gray-400">
        {JSON.stringify(roomState, null, 2)}
      </pre>

    </div>
  );
}