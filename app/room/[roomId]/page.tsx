"use client";
import { useSearchParams, useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import JoinModal from "@/components/JoinModal";
import DebateRoom from "@/components/DebateRoom";
import { getSocket, disconnectSocket } from "@/libs/socket";
import { jwtDecode } from "jwt-decode";
import { Socket } from "socket.io-client";

interface TokenPayload {
  roomId: string;
  slot: "A" | "B";
}

export default function DebaterRoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomId = params.roomId as string;
  const token = searchParams.get("token");

  const [socket, setSocket] = useState<Socket | null>(null);
  const [error, setError] = useState("");

  let slot: "A" | "B" | null = null;
  if (token) {
    try {
      slot = jwtDecode<TokenPayload>(token).slot;
    } catch {}
  }

  useEffect(
    () => () => {
      disconnectSocket();
    },[],
  );

  if (!token)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 text-sm">Invalid debater link.</p>
      </div>
    );

  function handleJoin(displayName: string, age: number) {
    const s = getSocket({
      roomId,
      displayName,
      age,
      sessionId: uuidv4(),
      token: token!,
    });
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
    return (
      <JoinModal
        roomId={roomId}
        role="debater"
        slot={slot ?? undefined}
        onJoin={handleJoin}
      />
    );

  return <DebateRoom socket={socket} roomId={roomId} />;
}
