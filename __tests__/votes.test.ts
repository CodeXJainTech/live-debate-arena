jest.mock("../libs/redis", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    set: jest.fn(),
    incr: jest.fn(),
    decr: jest.fn(),
  },
}));

import redis from "../libs/redis";
import { castVote, getVoteCounts } from "../libs/votes";

describe("castVote", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("increments FOR when user votes FOR for the first time", async () => {
    (redis.get as jest.Mock).mockResolvedValue(null);
    await castVote("ROOM1", "session1", "FOR");
    expect(redis.incr).toHaveBeenCalledWith("room:ROOM1:votes:for");
    expect(redis.decr).not.toHaveBeenCalled();
    expect(redis.set).toHaveBeenCalledWith(
      "room:ROOM1:vote:session1",
      "FOR",
      "EX",
      60 * 60 * 24
    );
  });

  it("switches vote from FOR to AGAINST correctly", async () => {
    (redis.get as jest.Mock).mockResolvedValue("FOR");
    await castVote("ROOM1", "session1", "AGAINST");
    expect(redis.decr).toHaveBeenCalledWith("room:ROOM1:votes:for");
    expect(redis.incr).toHaveBeenCalledWith("room:ROOM1:votes:against");
  });

  it("does nothing extra when voting the same value again", async () => {
    (redis.get as jest.Mock).mockResolvedValue("FOR");
    await castVote("ROOM1", "session1", "FOR");
    expect(redis.incr).not.toHaveBeenCalled();
    expect(redis.decr).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });
});

describe("getVoteCounts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns counts from redis", async () => {
    (redis.get as jest.Mock)
      .mockResolvedValueOnce("5")
      .mockResolvedValueOnce("3");

    const result = await getVoteCounts("ROOM1");
    expect(result).toEqual({ for: 5, against: 3 });
  });

  it("returns zero when keys do not exist", async () => {
    (redis.get as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const result = await getVoteCounts("ROOM1");
    expect(result).toEqual({ for: 0, against: 0 });
  });
});
