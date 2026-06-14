import { Server } from "socket.io";
import { getVoteCounts } from "../libs/votes";
import { acquireLock, releaseLock, refreshLock } from "./redisLock";

interface PulseHandles {
  pulse: NodeJS.Timeout;
  lockRefresh: NodeJS.Timeout;
}

const pulseIntervals = new Map<string, PulseHandles>();

export async function startVotePulse(io: Server, roomId: string) {
  if (pulseIntervals.has(roomId)) return;

  const locked = await acquireLock(`lock:pulse:${roomId}`, 10);
  if (!locked) return;

  const pulse = setInterval(async () => {
    const votesCnt = await getVoteCounts(roomId);
    io.to(`room:${roomId}`).emit("vote:update", {
      for: votesCnt.for,
      against: votesCnt.against,
      total: votesCnt.for + votesCnt.against,
    });
  }, 200);

  const lockRefresh = setInterval(async () => {
    await refreshLock(`lock:pulse:${roomId}`, 10);
  }, 5000);

  pulseIntervals.set(roomId, { pulse, lockRefresh });
}

export async function stopVotePulse(roomId: string) {
  const handles = pulseIntervals.get(roomId);
  if (handles) {
    clearInterval(handles.pulse);
    clearInterval(handles.lockRefresh);
    pulseIntervals.delete(roomId);
    await releaseLock(`lock:pulse:${roomId}`);
  }
}
