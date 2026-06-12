import {
  canTransition,
  canSubmitArgument,
  canVote,
  canStartDebate,
  advanceRound,
  nextSlot,
} from "../socket/stateMachine";

describe("canTransition", () => {
  it("allows WAITING to TOPIC_REVEAL", () => {
    expect(canTransition("WAITING", "TOPIC_REVEAL")).toBe(true);
  });

  it("allows TOPIC_REVEAL to ROUND", () => {
    expect(canTransition("TOPIC_REVEAL", "ROUND")).toBe(true);
  });

  it("allows ROUND to ROUND", () => {
    expect(canTransition("ROUND", "ROUND")).toBe(true);
  });

  it("allows ROUND to VOTING", () => {
    expect(canTransition("ROUND", "VOTING")).toBe(true);
  });

  it("allows VOTING to VERDICT", () => {
    expect(canTransition("VOTING", "VERDICT")).toBe(true);
  });

  it("allows VERDICT to FINISHED", () => {
    expect(canTransition("VERDICT", "FINISHED")).toBe(true);
  });

  it("does not allow WAITING to ROUND", () => {
    expect(canTransition("WAITING", "ROUND")).toBe(false);
  });

  it("does not allow FINISHED to anything", () => {
    expect(canTransition("FINISHED", "WAITING")).toBe(false);
    expect(canTransition("FINISHED", "ROUND")).toBe(false);
    expect(canTransition("FINISHED", "VERDICT")).toBe(false);
  });

  it("does not allow VOTING to ROUND", () => {
    expect(canTransition("VOTING", "ROUND")).toBe(false);
  });

  it("does not allow VERDICT to WAITING", () => {
    expect(canTransition("VERDICT", "WAITING")).toBe(false);
  });
});

describe("canSubmitArgument", () => {
  it("allows active debater to submit during ROUND", () => {
    expect(canSubmitArgument("ROUND", "A", "A")).toBe(true);
    expect(canSubmitArgument("ROUND", "B", "B")).toBe(true);
  });

  it("does not allow inactive debater to submit", () => {
    expect(canSubmitArgument("ROUND", "A", "B")).toBe(false);
    expect(canSubmitArgument("ROUND", "B", "A")).toBe(false);
  });

  it("does not allow submission outside ROUND state", () => {
    expect(canSubmitArgument("WAITING", "A", "A")).toBe(false);
    expect(canSubmitArgument("VOTING", "A", "A")).toBe(false);
    expect(canSubmitArgument("VERDICT", "A", "A")).toBe(false);
    expect(canSubmitArgument("FINISHED", "A", "A")).toBe(false);
  });
});

describe("canVote", () => {
  it("allows voting during ROUND", () => {
    expect(canVote("ROUND")).toBe(true);
  });

  it("allows voting during VOTING", () => {
    expect(canVote("VOTING")).toBe(true);
  });

  it("does not allow voting in other states", () => {
    expect(canVote("WAITING")).toBe(false);
    expect(canVote("TOPIC_REVEAL")).toBe(false);
    expect(canVote("VERDICT")).toBe(false);
    expect(canVote("FINISHED")).toBe(false);
  });
});

describe("canStartDebate", () => {
  it("allows start when both slots connected in WAITING", () => {
    expect(canStartDebate("WAITING", ["A", "B"])).toBe(true);
  });

  it("does not allow start with only one debater", () => {
    expect(canStartDebate("WAITING", ["A"])).toBe(false);
    expect(canStartDebate("WAITING", ["B"])).toBe(false);
  });

  it("does not allow start with no debaters", () => {
    expect(canStartDebate("WAITING", [])).toBe(false);
  });

  it("does not allow start outside WAITING state", () => {
    expect(canStartDebate("ROUND", ["A", "B"])).toBe(false);
    expect(canStartDebate("TOPIC_REVEAL", ["A", "B"])).toBe(false);
  });
});

describe("advanceRound", () => {
  it("advances from slot A to slot B in same round", () => {
    const result = advanceRound({ currentRound: 1, activeSlot: "A", totalRounds: 2 });
    expect(result).toEqual({ currentRound: 1, activeSlot: "B", totalRounds: 2 });
  });

  it("advances from slot B to slot A in next round", () => {
    const result = advanceRound({ currentRound: 1, activeSlot: "B", totalRounds: 2 });
    expect(result).toEqual({ currentRound: 2, activeSlot: "A", totalRounds: 2 });
  });

  it("returns null when last round slot B submits", () => {
    const result = advanceRound({ currentRound: 2, activeSlot: "B", totalRounds: 2 });
    expect(result).toBeNull();
  });

  it("returns null for single round debate after slot B submits", () => {
    const result = advanceRound({ currentRound: 1, activeSlot: "B", totalRounds: 1 });
    expect(result).toBeNull();
  });

  it("handles five rounds correctly", () => {
    let ctx = { currentRound: 1, activeSlot: "A" as const, totalRounds: 5 };
    for (let round = 1; round <= 5; round++) {
      const afterA = advanceRound({ ...ctx, activeSlot: "A" });
      expect(afterA).toEqual({ currentRound: round, activeSlot: "B", totalRounds: 5 });
      if (round < 5) {
        const afterB = advanceRound({ ...ctx, activeSlot: "B" });
        expect(afterB).toEqual({ currentRound: round + 1, activeSlot: "A", totalRounds: 5 });
        ctx = { ...ctx, currentRound: round + 1 };
      } else {
        const afterB = advanceRound({ ...ctx, activeSlot: "B" });
        expect(afterB).toBeNull();
      }
    }
  });
});

describe("nextSlot", () => {
  it("returns B for A", () => {
    expect(nextSlot("A")).toBe("B");
  });

  it("returns A for B", () => {
    expect(nextSlot("B")).toBe("A");
  });
});
