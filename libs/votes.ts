import redis from "./redis";
import { VoteValue } from "@prisma/client";

const FOR_KEY = (roomId: string) => `room:${roomId}:votes:for`;
const AGAINST_KEY = (roomId: string) => `room:${roomId}:votes:against`;
const USER_VOTE_KEY = (roomId: string, sessionId: string) => `room:${roomId}:vote:${sessionId}`;

const TTL = 60 * 60 * 24;

export async function castVote(roomId: string, sessionId: string, value: VoteValue): Promise<void> {
  const existing = (await redis.get(USER_VOTE_KEY(roomId, sessionId))) as VoteValue | null;

  // reverse previous vote if changed
  if (existing && existing !== value) {
    if (existing === "FOR") await redis.decr(FOR_KEY(roomId));
    else await redis.decr(AGAINST_KEY(roomId));
  }

  // apply new vote only if diffs from existing
  if (existing !== value) {
    if (value === "FOR") await redis.incr(FOR_KEY(roomId));
    else await redis.incr(AGAINST_KEY(roomId));
    await redis.set(USER_VOTE_KEY(roomId, sessionId), value, "EX", TTL);
  }
}

export async function getVoteCounts(roomId: string): Promise<{ for: number; against: number }> {
  const [forCount, againstCount] = await Promise.all([
    redis.get(FOR_KEY(roomId)),
    redis.get(AGAINST_KEY(roomId)),
  ]);
  return {
    for: forCount ? Number(forCount) : 0,
    against: againstCount ? Number(againstCount) : 0,
  };
}

export async function getUserVote(roomId: string, sessionId: string): Promise<VoteValue | null> {
  return (await redis.get(USER_VOTE_KEY(roomId, sessionId))) as VoteValue | null;
}