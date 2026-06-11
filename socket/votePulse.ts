import { Server } from "socket.io";
import { getVoteCounts } from "../libs/votes";
import { acquireLock, releaseLock } from "./redisLock";
import redis from "../libs/redis";

const pulseIntervals = new Map<string, NodeJS.Timeout>();

export async function startVotePulse(io: Server, roomId: string){
  if(pulseIntervals.has(roomId)) return;

  const locked = await acquireLock(`lock:pulse:${roomId}`, 10);
  if (!locked) return;
  
  const getPulseInterval = setInterval(async () => {
    const votesCnt = await getVoteCounts(roomId);
    io.to(`room:${roomId}`).emit("vote:update", {
      for: votesCnt.for,
      against: votesCnt.against,
      total: votesCnt.for + votesCnt.against
    })
  }, 200);

  const lock = setInterval(async () => {
    await redis.set(`lock:pulse:${roomId}`, "1", { ex: 10 });
  }, 5000);
  
  pulseIntervals.set(roomId, getPulseInterval);
}


export async function stopVotePulse(roomId: string){
  const pulseInterval = pulseIntervals.get(roomId);
  if(pulseInterval){
    clearInterval(pulseInterval);
    pulseIntervals.delete(roomId);
    await releaseLock(`lock:pulse:${roomId}`);
  }
}