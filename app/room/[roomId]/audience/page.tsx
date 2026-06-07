"use client";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import JoinModal from "@/components/JoinModal";
import DebateRoom from "@/components/DebateRoom";
import { getSocket, disconnectSocket } from "@/libs/socket";
import { Socket } from "socket.io-client";

export default function AudienceRoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;

  const [socket, setSocket] = useState<Socket | null>(null);
  const [error, setError] = useState("");

  useEffect(
    () => () => {
      disconnectSocket();
    },
    [],
  );

  function handleJoin(displayName: string, age: number) {
    const s = getSocket({ roomId, displayName, age, sessionId: uuidv4() });
    s.on("connect_error", (err) => {
      setError(err.message);
      disconnectSocket();
    });
    setSocket(s);
  }

  if (error)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    );

  if (!socket)
    return <JoinModal roomId={roomId} role="audience" onJoin={handleJoin} />;

  return <DebateRoom socket={socket} roomId={roomId} />;
}