import redis from "../libs/redis";

export async function acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
  const result = await redis.set(key, "1", "EX", ttlSeconds, "NX");
  return result === "OK";
}

export async function releaseLock(key: string): Promise<void> {
  await redis.del(key);
}

export async function refreshLock(key: string, ttlSeconds: number): Promise<void> {
  await redis.set(key, "1", "EX", ttlSeconds, "XX");
}