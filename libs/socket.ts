import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export interface JoinPayload {
  roomId: string;
  displayName: string;
  age: number;
  sessionId: string;
  token?: string;
}

export function getSocket(payload?: JoinPayload): Socket {
  if (!socket && payload) {
    socket = io(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000", {
      auth: {
        roomId: payload.roomId,
        displayName: payload.displayName,
        age: payload.age,
        sessionId: payload.sessionId,
        token: payload.token,
      },
      autoConnect: true,
    });
  }

  if (!socket) {
    throw new Error("Socket not initialized — call getSocket with payload first");
  }

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}