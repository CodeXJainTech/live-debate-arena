import redis from "../libs/redis";
import { DebateState, Slot } from "./stateMachine";

export interface LiveRoomState {
  debateId: string;
  topic: string;
  state: DebateState;
  totalRounds: number;
  currentRound: number;
  activeSlot: Slot | null;
  connectedSlots: Slot[];
  topicRevealEndsAt: number | null;
  roundEndsAt: number | null;
  votingEndsAt: number | null;
}


const KEY = (roomId: string) => `room:${roomId}:state`;
const TTL = 60 * 60 * 24;

export async function getRoomState(roomId: string): Promise<LiveRoomState | null> {
  const raw = await redis.get(KEY(roomId));
  return raw ? (JSON.parse(raw) as LiveRoomState) : null;
}

export async function setRoomState(roomId: string, state: LiveRoomState): Promise<void> {
  await redis.set(KEY(roomId), JSON.stringify(state), "EX", TTL);
}

export async function initRoomState(roomId: string, debateId: string, topic: string, totalRounds: number): Promise<LiveRoomState> {
  const state: LiveRoomState = {
    debateId, topic, state: "WAITING", totalRounds,
    currentRound: 1, activeSlot: null, connectedSlots: [],
    topicRevealEndsAt: null, roundEndsAt: null, votingEndsAt: null,
  };
  await setRoomState(roomId, state);
  return state;
}

export async function addConnectedSlot(roomId: string, slot: Slot): Promise<LiveRoomState | null> {
  const state = await getRoomState(roomId);
  if (!state) return null;
  if (!state.connectedSlots.includes(slot)) {
    state.connectedSlots.push(slot);
    await setRoomState(roomId, state);
  }
  return state;
}

export async function removeConnectedSlot(roomId: string, slot: Slot): Promise<void> {
  const state = await getRoomState(roomId);
  if (!state) return;
  state.connectedSlots = state.connectedSlots.filter((s) => s !== slot);
  await setRoomState(roomId, state);
}