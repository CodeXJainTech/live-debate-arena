"use client";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import JoinModal from "@/components/JoinModal";
import DebateRoom from "@/components/DebateRoom";
import { getSocket, disconnectSocket } from "@/libs/socket";
import { Socket } from "socket.io-client";
import ErrorBoundary from "@/components/ErrorBoundry";

export default function AudienceRoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;

  const [socket, setSocket] = useState<Socket | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const savedSession = sessionStorage.getItem(`debate-session-audience-${roomId}`);
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        const s = getSocket({
          roomId,
          displayName: parsed.displayName,
          age: parsed.age,
          sessionId: parsed.sessionId,
        });
        s.on("connect_error", (err) => {
          setError(err.message);
          disconnectSocket();
          sessionStorage.removeItem(`debate-session-audience-${roomId}`);
        });
        setSocket(s);
      } catch {}
    }

    return () => {
      disconnectSocket();
    };
  }, [roomId]);

  function handleJoin(displayName: string, age: number) {
    const sessionId = uuidv4();
    sessionStorage.setItem(`debate-session-audience-${roomId}`, JSON.stringify({ displayName, age, sessionId }));
    
    const s = getSocket({ roomId, displayName, age, sessionId });
    s.on("connect_error", (err) => {
      setError(err.message);
      disconnectSocket();
      sessionStorage.removeItem(`debate-session-audience-${roomId}`);
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

  return (
    <ErrorBoundary>
      <DebateRoom socket={socket} roomId={roomId} />
    </ErrorBoundary>
  );
}