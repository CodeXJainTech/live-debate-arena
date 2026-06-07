import { Server } from "socket.io";
import { jwtVerify } from "jose";
import { prisma } from "../libs/prisma";
import {
  getRoomState,
  initRoomState,
  addConnectedSlot,
  removeConnectedSlot,
} from "./roomState";
import { canStartDebate, canSubmitArgument, canVote } from "./stateMachine";
import { transitionToTopicReveal, advanceTurn } from "./handlers/stateHandlers";
import { rehydrateTimers } from "./timers";
import { castVote } from "@/libs/votes";
import { scoreArgument } from "./handlers/scoringHandler";

const secret = new TextEncoder().encode(process.env.DEBATER_JWT_SECRET!);

declare module "socket.io" {
  interface SocketData {
    user: {
      roomId: string;
      role: "debater" | "audience";
      slot?: "A" | "B";
      displayName: string;
      age: number;
      sessionId: string;
    };
  }
}

export async function registerSocketHandlers(io: Server) {
  io.use(async (socket, next) => {
    try {
      const { token, roomId, displayName, age, sessionId } =
        socket.handshake.auth;
      if (!roomId || !displayName || !age || !sessionId)
        return next(new Error("Missing required fields"));

      const debate = await prisma.debate.findUnique({ where: { roomId } });
      if (!debate) return next(new Error("Room not found"));

      const existing = await getRoomState(roomId);
      if (!existing)
        await initRoomState(
          roomId,
          debate.id,
          debate.topic,
          debate.totalRounds,
        );

      if (token) {
        try {
          const { payload } = await jwtVerify(token, secret);
          if (payload.roomId !== roomId)
            return next(new Error("Token does not match room"));
          const slot = payload.slot as "A" | "B";
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
    } catch {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", async (socket) => {
    const { user } = socket.data;
    await socket.join(`room:${user.roomId}`);

    if (user.role === "debater" && user.slot)
      await addConnectedSlot(user.roomId, user.slot);

    await rehydrateTimers(io, user.roomId);

    const roomState = await getRoomState(user.roomId);
    socket.emit("room:state", {
      ...roomState,
      yourRole: user.role,
      yourSlot: user.slot ?? null,
      yourName: user.displayName,
    });

    socket.to(`room:${user.roomId}`).emit("room:peer_joined", {
      role: user.role,
      slot: user.slot ?? null,
      displayName: user.displayName,
    });

    socket.on("debate:start", async () => {
      if (user.role !== "debater" || user.slot !== "A")
        return socket.emit("error", { message: "Only debater A can start" });
      const state = await getRoomState(user.roomId);
      if (!state) return;
      if (!canStartDebate(state.state, state.connectedSlots))
        return socket.emit("error", {
          message: "Both debaters must be connected to start",
        });
      await transitionToTopicReveal(io, user.roomId);
    });

    socket.on("debate:submit_argument", async (data: { text: string }) => {
      if (user.role !== "debater" || !user.slot)
        return socket.emit("error", { message: "Not a debater" });
      const state = await getRoomState(user.roomId);
      if (!state) return;
      if (!canSubmitArgument(state.state, state.activeSlot!, user.slot))
        return socket.emit("error", { message: "Not your turn" });

      const text = data.text?.trim();
      if (!text || text.length < 10)
        return socket.emit("error", {
          message: "Argument must be at least 10 characters",
        });

      const debate = await prisma.debate.findUnique({
        where: { roomId: user.roomId },
        include: { participants: true },
      });
      const participant = debate?.participants.find(
        (p) => p.slot === user.slot,
      );
      if (!participant) return;

      const argument = await prisma.argument.create({
        data: {
          debateId: debate!.id,
          participantId: participant.id,
          roundNumber: state.currentRound,
          text,
        },
      });

      io.to(`room:${user.roomId}`).emit("debate:argument_submitted", {
        argumentId: argument.id,
        slot: user.slot,
        displayName: user.displayName,
        roundNumber: state.currentRound,
        text,
        submittedAt: argument.submittedAt,
      });
      scoreArgument(io, user.roomId, argument.id, debate!.topic, text, user.slot);
      await advanceTurn(io, user.roomId);
    });
    
    socket.on("vote:cast", async (data: {value: "FOR" | "AGAINST"}) => {
      const state = await getRoomState(user.roomId);
      if(!state) {
        return;
      }
      if(!canVote(state.state)){
        return socket.emit("error", { message: "Voting is not open" });
      }

      if (data.value !== "FOR" && data.value !== "AGAINST"){
        return socket.emit("error", { message: "Invalid vote value" });
      }

      await castVote(user.roomId, user.sessionId, data.value);
      socket.emit("vote:confirmed", { value: data.value });
    });


    socket.on("disconnect", async () => {
      if (user.role === "debater" && user.slot)
        await removeConnectedSlot(user.roomId, user.slot);
      socket.to(`room:${user.roomId}`).emit("room:peer_left", {
        role: user.role,
        slot: user.slot ?? null,
        displayName: user.displayName,
      });
    });
  });
}