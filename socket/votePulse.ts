import { Server } from "socket.io";
import { getVoteCounts } from "../libs/votes";

const pulseIntervals = new Map<string, NodeJS.Timeout>();

export function startVotePulse(io: Server, roomId: string){
  if(pulseIntervals.has(roomId)) return;

  const getPulseInterval = setInterval(async () => {
    const votesCnt = await getVoteCounts(roomId);
    io.to(`room:${roomId}`).emit("vote:update", {
      for: votesCnt.for,
      against: votesCnt.against,
      total: votesCnt.for + votesCnt.against
    })
  }, 200);

  pulseIntervals.set(roomId, getPulseInterval);
}


export function stopVotePulse(roomId: string){
  const pulseInterval = pulseIntervals.get(roomId);
  if(pulseInterval){
    clearInterval(pulseInterval);
    pulseIntervals.delete(roomId);
  }
}