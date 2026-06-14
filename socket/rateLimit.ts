import redis from "../libs/redis";

// fixed-window counter using redis INCR + EX
// returns true if the action is allowed, false if the limit was exceeded
async function checkLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSeconds);
  }
  return count <= max;
}

// caps how many socket connections one ip can open per minute
// stops a script from spinning up hundreds of fake audience sessions
export async function checkConnectionRateLimit(ip: string): Promise<boolean> {
  return checkLimit(`ratelimit:connect:${ip}`, 20, 60);
}

// caps how many votes one ip can cast per minute, independent of how
// many distinct sessionIds it's using
export async function checkVoteRateLimit(ip: string): Promise<boolean> {
  return checkLimit(`ratelimit:vote:${ip}`, 30, 60);
}

// caps how fast a single session can flip its own vote back and forth
// 1 change per 2 seconds is generous for a real person, blocks spam clicking
export async function checkVoteCooldown(sessionId: string): Promise<boolean> {
  const key = `ratelimit:vote_cooldown:${sessionId}`;
  const exists = await redis.get(key);
  if (exists) return false;
  await redis.set(key, "1", "EX", 2);
  return true;
}
