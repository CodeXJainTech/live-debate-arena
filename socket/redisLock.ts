import redis from "../libs/redis";

export async function acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
  const result = await redis.set(key, "1", { nx: true, ex: ttlSeconds });
  return result !== null;
}

export async function releaseLock(key: string): Promise<void> {
  await redis.del(key);
}
