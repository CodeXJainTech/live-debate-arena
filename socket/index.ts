import { Server, Socket } from "socket.io";
import { jwtVerify } from "jose";
import { prisma } from "../libs/prisma";

const secret = new TextEncoder().encode(process.env.DEBATER_JWT_SECRET!);

type Role = "debater" | "audience";

interface SocketUser {
  roomId: string;
  role: Role;
  slot?: "A" | "B";
  displayName: string;
  age: number;
  sessionId: string;
}

declare module "socket.io" {
  interface SocketData {
    user: SocketUser;
  }
}

export async function registerSocketHandlers(io: Server) {
  io.use(async (socket, next) => {
    try {
      const { token, roomId, displayName, age, sessionId } =
        socket.handshake.auth;

      if (!roomId || !displayName || !age || !sessionId) {
        return next(new Error("Missing required fields"));
      }

      const debate = await prisma.debate.findUnique({ where: { roomId } });
      if (!debate) {
        return next(new Error("Room not found"));
      }

      if (token) {
        try {
          const { payload } = await jwtVerify(token, secret);

          if (payload.roomId !== roomId) {
            return next(new Error("Token does not match room"));
          }

          const slot = payload.slot as "A" | "B";

          const existingParticipant = await prisma.participant.findUnique({
            where: { debateId_slot: { debateId: debate.id, slot } },
          });

          if (
            existingParticipant &&
            existingParticipant.displayName !== displayName
          ) {
            return next(new Error(`Slot ${slot} is already taken`));
          }

          await prisma.participant.upsert({
            where: { debateId_slot: { debateId: debate.id, slot } },
            update: { displayName, age: Number(age) },
            create: {
              debateId: debate.id,
              slot,
              displayName,
              age: Number(age),
            },
          });

          socket.data.user = {
            roomId,
            role: "debater",
            slot,
            displayName,
            age: Number(age),
            sessionId,
          };
        } catch {
          return next(new Error("Invalid or expired token"));
        }
      } else {
        socket.data.user = {
          roomId,
          role: "audience",
          displayName,
          age: Number(age),
          sessionId,
        };
      }

      next();
    } catch (err) {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", async (socket) => {
    const { user } = socket.data;

    await socket.join(`room:${user.roomId}`);

    console.log(
      `[${user.roomId}] ${user.displayName} joined as ${user.role}${
        user.slot ? ` (slot ${user.slot})` : ""
      }`
    );

    const debate = await prisma.debate.findUnique({
      where: { roomId: user.roomId },
      include: { participants: true },
    });

    socket.emit("room:state", {
      state: debate?.state,
      topic: debate?.topic,
      totalRounds: debate?.totalRounds,
      participants: debate?.participants.map((p) => ({
        slot: p.slot,
        displayName: p.displayName,
      })),
      yourRole: user.role,
      yourSlot: user.slot ?? null,
    });

    socket.to(`room:${user.roomId}`).emit("room:peer_joined", {
      role: user.role,
      slot: user.slot ?? null,
      displayName: user.displayName,
    });

    socket.on("disconnect", () => {
      console.log(
        `[${user.roomId}] ${user.displayName} (${user.role}) disconnected`
      );
      socket.to(`room:${user.roomId}`).emit("room:peer_left", {
        role: user.role,
        slot: user.slot ?? null,
        displayName: user.displayName,
      });
    });
  });
}