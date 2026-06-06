import { Server } from "socket.io";
import { prisma } from "../../libs/prisma";
import { getRoomState, setRoomState, LiveRoomState } from "../roomState";
import { canTransition, advanceRound } from "../stateMachine";
import { scheduleTransition, clearRoomTimer } from "../timers";
import { startVotePulse, stopVotePulse } from "../votepulse";

const TOPIC_REVEAL_MS = 10_000;
const ROUND_MS = 120_000;
const VOTING_MS = 30_000;

function broadcastState(io: Server, roomId: string, state: LiveRoomState){
  io.to(`room:${roomId}`).emit("debate:state_changed", {
    state: state.state,
    currentRound: state.currentRound,
    activeSlot: state.activeSlot,
    totalRounds: state.totalRounds,
    topicRevealEndsAt: state.topicRevealEndsAt,
    roundEndsAt: state.roundEndsAt,
    votingEndsAt: state.votingEndsAt,
  });
}

export async function transitionToTopicReveal(io: Server, roomId: string){
  const state = await getRoomState(roomId);
  if(!state || !canTransition(state.state, 'TOPIC_REVEAL')) return;
  state.state = 'TOPIC_REVEAL';
  state.topicRevealEndsAt = Date.now() + TOPIC_REVEAL_MS;
  await setRoomState(roomId, state);
  await prisma.debate.update({ where: { roomId }, data: { state: "TOPIC_REVEAL" } });
  await broadcastState(io, roomId, state);
  scheduleTransition(io, roomId, TOPIC_REVEAL_MS, () => transitionToRound(io, roomId));
}

export async function transitionToRound(io: Server, roomId: string){
  const state = await getRoomState(roomId);
  if(!state) return;
  if (state.state === "TOPIC_REVEAL") {
    if (!canTransition(state.state, "ROUND")) return;
    state.state = "ROUND";
    state.activeSlot = "A";
    state.currentRound = 1;
  }
  state.roundEndsAt = Date.now() + ROUND_MS;
  await setRoomState(roomId, state);
  await prisma.debate.update({ where: { roomId }, data: { state: "ROUND" } });
  await broadcastState(io, roomId, state);
  startVotePulse(io, roomId);
  scheduleTransition(io, roomId, ROUND_MS, () => handleTurnTimeout(io, roomId));
}

async function handleTurnTimeout(io: Server, roomId: string){
  const state = await getRoomState(roomId);
  if(!state || state.state !== 'ROUND') return;

  io.to(`room:${roomId}`).emit("debate:turn_timeout", {
    slot: state.activeSlot
  });
  
  advanceTurn(io, roomId);
}

export async function advanceTurn(io: Server, roomId: string){
  const state = await getRoomState(roomId);
  if(!state || state.state !== 'ROUND') return;
  clearRoomTimer(roomId);

  const res = advanceRound({
    currentRound: state.currentRound,
    activeSlot: state.activeSlot!,
    totalRounds: state.totalRounds
  });

  if(res == null){
    await transitionToVoting(io, roomId);
    return;
  }
  else{
    state.currentRound = res.currentRound;
    state.activeSlot = res.activeSlot;
    state.roundEndsAt = Date.now() + ROUND_MS;
    await setRoomState(roomId, state);
    await broadcastState(io, roomId, state);
    scheduleTransition(io, roomId, ROUND_MS, () => handleTurnTimeout(io, roomId));
  }

}


export async function transitionToVoting(io:Server, roomId: string){
  const state = await getRoomState(roomId);
  if(!state || !canTransition(state.state, 'VOTING')) return;
  state.state = 'VOTING';
  state.activeSlot = null;
  state.roundEndsAt = null;
  state.votingEndsAt = Date.now() + VOTING_MS;
  await setRoomState(roomId, state);
  await prisma.debate.update({ where: { roomId }, data: { state: "VOTING" } });
  await broadcastState(io, roomId, state);
  scheduleTransition(io, roomId, VOTING_MS, () => transitionToVerdict(io, roomId));
}

export async function transitionToVerdict(io: Server, roomId: string){
  const state = await getRoomState(roomId);
  if(!state || !canTransition(state.state, 'VERDICT')) return;
  state.state = 'VERDICT';
  state.votingEndsAt = null;
  await setRoomState(roomId, state);
  await prisma.debate.update({ where: { roomId }, data: { state: "VERDICT" } });
  await broadcastState(io, roomId, state);
  stopVotePulse(roomId);
  io.to(`room:${roomId}`).emit("debate:verdict_generating");
}

export async function transitionToFinished(io: Server, roomId: string){
  const state = await getRoomState(roomId);
  if (!state || !canTransition(state.state, "FINISHED")) return;
  state.state = "FINISHED";
  await setRoomState(roomId, state);
  await prisma.debate.update({ where: { roomId }, data: { state: "FINISHED", finishedAt: new Date() } });
  await broadcastState(io, roomId, state);
}