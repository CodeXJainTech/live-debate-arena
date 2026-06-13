jest.mock("../libs/redis", () => ({
  __esModule: true,
  default: {
    set: jest.fn(),
    del: jest.fn(),
  },
}));

import redis from "../libs/redis";
import { acquireLock, releaseLock, refreshLock } from "../socket/redisLock";

describe("acquireLock", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns true when lock is acquired", async () => {
    (redis.set as jest.Mock).mockResolvedValue("OK");
    const result = await acquireLock("lock:test:1", 10);
    expect(result).toBe(true);
    expect(redis.set).toHaveBeenCalledWith("lock:test:1", "1", "EX", 10, "NX");
  });

  it("returns false when lock already held by someone else", async () => {
    (redis.set as jest.Mock).mockResolvedValue(null);
    const result = await acquireLock("lock:test:1", 10);
    expect(result).toBe(false);
  });
});

describe("releaseLock", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls redis del with the key", async () => {
    (redis.del as jest.Mock).mockResolvedValue(1);
    await releaseLock("lock:test:1");
    expect(redis.del).toHaveBeenCalledWith("lock:test:1");
  });
});

describe("refreshLock", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls redis set with XX so it only refreshes an existing lock", async () => {
    (redis.set as jest.Mock).mockResolvedValue("OK");
    await refreshLock("lock:test:1", 10);
    expect(redis.set).toHaveBeenCalledWith("lock:test:1", "1", "EX", 10, "XX");
  });
});
