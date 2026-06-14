jest.mock("../libs/redis", () => ({
  __esModule: true,
  default: {
    incr: jest.fn(),
    expire: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
  },
}));

import redis from "../libs/redis";
import {
  checkConnectionRateLimit,
  checkVoteRateLimit,
  checkVoteCooldown,
} from "../socket/rateLimit";

describe("checkConnectionRateLimit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows the first connection and sets expiry", async () => {
    (redis.incr as jest.Mock).mockResolvedValue(1);
    const result = await checkConnectionRateLimit("1.2.3.4");
    expect(result).toBe(true);
    expect(redis.expire).toHaveBeenCalledWith("ratelimit:connect:1.2.3.4", 60);
  });

  it("allows up to the limit", async () => {
    (redis.incr as jest.Mock).mockResolvedValue(20);
    const result = await checkConnectionRateLimit("1.2.3.4");
    expect(result).toBe(true);
  });

  it("blocks once over the limit", async () => {
    (redis.incr as jest.Mock).mockResolvedValue(21);
    const result = await checkConnectionRateLimit("1.2.3.4");
    expect(result).toBe(false);
  });

  it("does not reset expiry on subsequent calls", async () => {
    (redis.incr as jest.Mock).mockResolvedValue(5);
    await checkConnectionRateLimit("1.2.3.4");
    expect(redis.expire).not.toHaveBeenCalled();
  });
});

describe("checkVoteRateLimit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows up to 30 votes per minute per ip", async () => {
    (redis.incr as jest.Mock).mockResolvedValue(30);
    expect(await checkVoteRateLimit("1.2.3.4")).toBe(true);
  });

  it("blocks the 31st vote", async () => {
    (redis.incr as jest.Mock).mockResolvedValue(31);
    expect(await checkVoteRateLimit("1.2.3.4")).toBe(false);
  });
});

describe("checkVoteCooldown", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows the first vote and sets a cooldown key", async () => {
    (redis.get as jest.Mock).mockResolvedValue(null);
    const result = await checkVoteCooldown("session1");
    expect(result).toBe(true);
    expect(redis.set).toHaveBeenCalledWith("ratelimit:vote_cooldown:session1", "1", "EX", 2);
  });

  it("blocks a second vote within the cooldown window", async () => {
    (redis.get as jest.Mock).mockResolvedValue("1");
    const result = await checkVoteCooldown("session1");
    expect(result).toBe(false);
    expect(redis.set).not.toHaveBeenCalled();
  });
});
