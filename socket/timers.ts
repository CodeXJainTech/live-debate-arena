import { Server } from "socket.io";
import { getRoomState } from "./roomState";
import { acquireLock, releaseLock } from "./redisLock";

const activeTimers = new Map<string, NodeJS.Timeout>();

export function clearRoomTimer(roomId:string){
  const timer = activeTimers.get(roomId);
  if(timer){
    clearInterval(timer);
    activeTimers.delete(roomId);
  }
  releaseLock(`lock:timer:${roomId}`);
}

export async function scheduleTransition(io: Server, roomId: string, delayMs: number, onExpire: () => Promise<void>){
  const locked = await acquireLock(`lock:timer:${roomId}`, Math.ceil(delayMs / 1000) + 10);
  if (!locked) return;
  clearRoomTimer(roomId);
  const timer = setTimeout(async ()=>{
    activeTimers.delete(roomId);
    await releaseLock(`lock:timer:${roomId}`);
    await onExpire();
  },delayMs);
  activeTimers.set(roomId,timer);
}

// Track which rooms already have a verdict generation running so we dont start duplicates when multiple clients reconnect same time.
const verdictInProgress = new Set<string>();

export async function rehydrateTimers(io: Server, roomId: string) {
  // If a timer is already active for this room, dont schedule another
  if (activeTimers.has(roomId)) return;
  
  const rehydrateLock = await acquireLock(`lock:rehydrate:${roomId}`, 5);
  if (!rehydrateLock) return;
  try{
    const state = await getRoomState(roomId);
    if (!state) return;
    const now = Date.now();

    if (state.state === "TOPIC_REVEAL" && state.topicRevealEndsAt) {
      const remaining = state.topicRevealEndsAt - now;
      const { transitionToRound } = await import("./handlers/stateHandlers");
      if (remaining > 0) await scheduleTransition(io, roomId, remaining, () => transitionToRound(io, roomId));
      else await transitionToRound(io, roomId);
    }

    if (state.state === "ROUND" && state.roundEndsAt) {
      const remaining = state.roundEndsAt - now;
      const { advanceTurn } = await import("./handlers/stateHandlers");
      if (remaining > 0) {
        await scheduleTransition(io, roomId, remaining, async () => {
          io.to(`room:${roomId}`).emit("debate:turn_timeout", { slot: state.activeSlot });
          await advanceTurn(io, roomId);
        });
      } else {
        io.to(`room:${roomId}`).emit("debate:turn_timeout", { slot: state.activeSlot });
        await advanceTurn(io, roomId);
      }
    }

    if (state.state === "VOTING" && state.votingEndsAt) {
      const remaining = state.votingEndsAt - now;
      const { transitionToVerdict } = await import("./handlers/stateHandlers");
      if (remaining > 0) await scheduleTransition(io, roomId, remaining, () => transitionToVerdict(io, roomId));
      else await transitionToVerdict(io, roomId);
    }

    // If state is VERDICT and no verdict generation is running, re-trigger it. This handles server restarts or cases where the previous attempt failed but state was not yet transitioned.
    if (state.state === "VERDICT" && !verdictInProgress.has(roomId)) {
      verdictInProgress.add(roomId);
      const { runVerdictEngine } = await import("./handlers/verdictHandler");
      runVerdictEngine(io, roomId).finally(() => verdictInProgress.delete(roomId));
    }
  }
  finally {
    await releaseLock(`lock:rehydrate:${roomId}`);
  }
}