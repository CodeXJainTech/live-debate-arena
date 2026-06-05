import { Server } from "socket.io";
import { getRoomState } from "./roomState";
import { clear } from "console";

const activeTimers = new Map<string, NodeJS.Timeout>();

export function clearRoomTimer(roomId:string){
    const timer = activeTimers.get(roomId);
    if(timer){
        clearInterval(timer);
        activeTimers.delete(roomId);
    }
}

export function scheduleTransition(io: Server, roomId: string, delayMs: number, onExpire: () => Promise<void>){
  clearRoomTimer(roomId);
  const timer = setTimeout(async ()=>{
    activeTimers.delete(roomId);
    await onExpire();
  },delayMs);
  activeTimers.set(roomId,timer);
}

export async function rehydrateTimers(io: Server, roomId: string) {
  const state = await getRoomState(roomId);
  if (!state) return;
  const now = Date.now();

  if (state.state === "TOPIC_REVEAL" && state.topicRevealEndsAt) {
    const remaining = state.topicRevealEndsAt - now;
    const { transitionToRound } = await import("./handlers/stateHandlers");
    if (remaining > 0) scheduleTransition(io, roomId, remaining, () => transitionToRound(io, roomId));
    else await transitionToRound(io, roomId);
  }

  if (state.state === "VOTING" && state.votingEndsAt) {
    const remaining = state.votingEndsAt - now;
    const { transitionToVerdict } = await import("./handlers/stateHandlers");
    if (remaining > 0) scheduleTransition(io, roomId, remaining, () => transitionToVerdict(io, roomId));
    else await transitionToVerdict(io, roomId);
  }
}