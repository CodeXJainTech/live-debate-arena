import { Server } from "socket.io";
import { jwtVerify } from "jose";
import { prisma } from "../libs/prisma";
import {
  getRoomState,
  initRoomState,
  addConnectedSlot,
  removeConnectedSlot,
  getCachedHistory,
  setCachedHistory,
  appendCachedArgument,
  HistoryArgument,
} from "./roomState";
import { canStartDebate, canSubmitArgument, canVote } from "./stateMachine";
import { transitionToTopicReveal, advanceTurn } from "./handlers/stateHandlers";
import { rehydrateTimers } from "./timers";
import { castVote } from "../libs/votes";
import { scoreArgument } from "./handlers/scoringHandler";

const secret = new TextEncoder().encode(process.env.DEBATER_JWT_SECRET || "dummy-secret");

//giving grace time for reconnecting.
const RECONNECT_GRACE_MS = 30_000;

// track pending disconnect timers per slot.
const disconnectTimers = new Map<string, NodeJS.Timeout>();

function disconnectKey(roomId: string, slot: string) {
  return `${roomId}:${slot}`;
}

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
    debateId: string;
    topic: string;
  }
}

async function loadAndCacheHistory(debateId: string, roomId: string): Promise<HistoryArgument[]> {
  const args = await prisma.argument.findMany({
    where: { debateId },
    include: { participant: true, scores: true },
    orderBy: { submittedAt: "asc" },
  });

  const history: HistoryArgument[] = args.map((arg) => ({
    argumentId: arg.id,
    slot: arg.participant.slot,
    displayName: arg.participant.displayName,
    roundNumber: arg.roundNumber,
    text: arg.text,
    submittedAt: arg.submittedAt.toISOString(),
    scores: arg.scores.map((s) => ({
      dimension: s.dimension,
      score: s.score,
      critique: s.critique,
    })),
  }));

  await setCachedHistory(roomId, history);
  return history;
}

export async function registerSocketHandlers(io: Server) {
  io.use(async (socket, next) => {
    try {
      const { token, roomId, displayName, age, sessionId } =
        socket.handshake.auth;
      if (!roomId || !displayName || !age || !sessionId)
        return next(new Error("Missing required fields"));

      // redis is the primary source for whether a room is active
      // only fall back to postgres when redis has no record of this room
      let liveState = await getRoomState(roomId);
      let debateId: string;
      let topic: string;
      let totalRounds: number;

      if (liveState) {
        debateId = liveState.debateId;
        topic = liveState.topic;
        totalRounds = liveState.totalRounds;
      } else {
        // cache miss:this is either a brand new room or redis was empty
        const debate = await prisma.debate.findUnique({ where: { roomId } });
        if (!debate) return next(new Error("Room not found"));

        debateId = debate.id;
        topic = debate.topic;
        totalRounds = debate.totalRounds;

        await initRoomState(roomId, debate.id, debate.topic, debate.totalRounds);
      }

      socket.data.debateId = debateId;
      socket.data.topic = topic;

      if (token) {
        try {
          const { payload } = await jwtVerify(token, secret);
          if (payload.roomId !== roomId)
            return next(new Error("Token does not match room"));
          const slot = payload.slot as "A" | "B";
          await prisma.participant.upsert({
            where: { debateId_slot: { debateId, slot } },
            update: { displayName, age: Number(age) },
            create: {
              debateId,
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

  io.on("connection", (socket) => {
    const { user } = socket.data;
    const { debateId, topic } = socket.data;
    
    //correct ordering to remove race conditions on vote testing.
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

      // participant lookup - one row, cheap, still needed since slot to participant
      const participant = await prisma.participant.findUnique({
        where: { debateId_slot: { debateId, slot: user.slot } },
      });
      if (!participant) return;

      const argument = await prisma.argument.create({
        data: {
          debateId,
          participantId: participant.id,
          roundNumber: state.currentRound,
          text,
        },
      });

      const payload = {
        argumentId: argument.id,
        slot: user.slot,
        displayName: user.displayName,
        roundNumber: state.currentRound,
        text,
        submittedAt: argument.submittedAt.toISOString(),
      };

      io.to(`room:${user.roomId}`).emit("debate:argument_submitted", payload);

      // keep redis history cache in sync so next joiners get this
      // argument without hitting postgres
      await appendCachedArgument(user.roomId, { ...payload, scores: [] });

      scoreArgument(
        io,
        user.roomId,
        argument.id,
        topic,
        text,
        user.slot,
      );
      await advanceTurn(io, user.roomId);
    });

    socket.on("vote:cast", async (data: { value: "FOR" | "AGAINST" }) => {
      const state = await getRoomState(user.roomId);
      if (!state) {
        return;
      }
      if (!canVote(state.state)) {
        return socket.emit("error", { message: "Voting is not open" });
      }

      if (data.value !== "FOR" && data.value !== "AGAINST") {
        return socket.emit("error", { message: "Invalid vote value" });
      }

      await castVote(user.roomId, user.sessionId, data.value);
      socket.emit("vote:confirmed", { value: data.value });
    });

    socket.on("disconnect", async () => {
      if (user.role === "debater" && user.slot) {
        const key = disconnectKey(user.roomId, user.slot);
        
        // notify room immediately that debater disconnected
        socket.to(`room:${user.roomId}`).emit("room:peer_disconnected", {
          slot: user.slot,
          displayName: user.displayName,
        });

        // wait before actually removing the slot - give them time to reconnect
        const timer = setTimeout(async () => {
          disconnectTimers.delete(key);
          await removeConnectedSlot(user.roomId, user.slot!);
          socket.to(`room:${user.roomId}`).emit("room:peer_left", {
            role: user.role,
            slot: user.slot,
            displayName: user.displayName,
          });
        }, RECONNECT_GRACE_MS);

        disconnectTimers.set(key, timer);
      } else {
        socket.to(`room:${user.roomId}`).emit("room:peer_left", {
          role: user.role,
          slot: user.slot ?? null,
          displayName: user.displayName,
        });
      }
    });

    //moved async logic here to avoid race condition on voting load.
    (async () => {
      await socket.join(`room:${user.roomId}`);

      if (user.role === "debater" && user.slot) {
        // cancel any pending disconnect timer for this slot
        const key = disconnectKey(user.roomId, user.slot);
        const pending = disconnectTimers.get(key);
        if (pending) {
          clearTimeout(pending);
          disconnectTimers.delete(key);
          socket.to(`room:${user.roomId}`).emit("room:peer_reconnected", {
            slot: user.slot,
            displayName: user.displayName,
          });
        }

        await addConnectedSlot(user.roomId, user.slot);
      }

      await rehydrateTimers(io, user.roomId);

      const roomState = await getRoomState(user.roomId);
      socket.emit("room:state", {
        ...roomState,
        yourRole: user.role,
        yourSlot: user.slot ?? null,
        yourName: user.displayName,
      });

      // history: redis cache first, postgres fallback on miss(hit miss principle as ram-rom)
      // every audience member joining a live debate hits this path,
      // so a cache hit avoids a join query against argument+participant+score per connection
      let history = await getCachedHistory(user.roomId);
      if (history === null) {
        history = await loadAndCacheHistory(debateId, user.roomId);
      }

      if (history.length > 0) {
        socket.emit("room:history", { arguments: history });
      }

      socket.to(`room:${user.roomId}`).emit("room:peer_joined", {
        role: user.role,
        slot: user.slot ?? null,
        displayName: user.displayName,
      });
    })();
  });
}

