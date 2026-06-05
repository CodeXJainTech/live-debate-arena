import { Server } from "socket.io";
import { prisma } from "../../libs/prisma";
import { getRoomState, setRoomState, LiveRoomState } from "../roomState";
import { canTransition, advanceRound } from "../stateMachine";
import { scheduleTransition, clearRoomTimer } from "../timers";

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

export async function transitionToRound(io: Server, roomId: string){

}

export async function transitionToVerdict(io: Server, roomId: string){

}