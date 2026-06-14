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

export interface HistoryArgument {
  argumentId: string;
  slot: Slot;
  displayName: string;
  roundNumber: number;
  text: string;
  submittedAt: string;
  scores: { dimension: string; score: number | null; critique: string }[];
}

const KEY = (roomId: string) => `room:${roomId}:state`;
const HISTORY_KEY = (roomId: string) => `room:${roomId}:history`;
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

// history caches
//source of trutht is database mainly still

export async function getCachedHistory(roomId: string): Promise<HistoryArgument[] | null> {
  const raw = await redis.get(HISTORY_KEY(roomId));
  return raw ? (JSON.parse(raw) as HistoryArgument[]) : null;
}

export async function setCachedHistory(roomId: string, history: HistoryArgument[]): Promise<void> {
  await redis.set(HISTORY_KEY(roomId), JSON.stringify(history), "EX", TTL);
}

export async function appendCachedArgument(roomId: string, argument: HistoryArgument): Promise<void> {
  const existing = await getCachedHistory(roomId);
  const updated = existing ? [...existing, argument] : [argument];
  await setCachedHistory(roomId, updated);
}

export async function updateCachedArgumentScores(
  roomId: string,
  argumentId: string,
  dimension: string,
  score: number | null,
  critique: string
): Promise<void> {
  const existing = await getCachedHistory(roomId);
  if (!existing) return;
  const updated = existing.map((arg) =>
    arg.argumentId === argumentId
      ? { ...arg, scores: [...arg.scores.filter((s) => s.dimension !== dimension), { dimension, score, critique }] }
      : arg
  );
  await setCachedHistory(roomId, updated);
}

export async function invalidateCachedHistory(roomId: string): Promise<void> {
  await redis.del(HISTORY_KEY(roomId));
}
