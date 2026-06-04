"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import JoinModal from "@/components/JoinModal";
import { getSocket, disconnectSocket } from "@/libs/socket";

export default function AudienceRoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;

  const [joined, setJoined] = useState(false);
  const [roomState, setRoomState] = useState<any>(null);
  const [error, setError] = useState("");

  function handleJoin(displayName: string, age: number) {
    const sessionId = uuidv4();
    const socket = getSocket({ roomId, displayName, age, sessionId });

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
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!joined) {
    return (
      <JoinModal roomId={roomId} role="audience" onJoin={handleJoin} />
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