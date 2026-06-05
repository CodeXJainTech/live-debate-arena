export type DebateState =
  | "WAITING"
  | "TOPIC_REVEAL"
  | "ROUND"
  | "VOTING"
  | "VERDICT"
  | "FINISHED";

export type Slot = "A" | "B";

export interface RoundContext {
  currentRound: number;
  activeSlot: Slot;
  totalRounds: number;
}

export function nextSlot(slot: Slot): Slot {
  return slot === "A" ? "B" : "A";
}

// returns null when all rounds are done
export function advanceRound(ctx: RoundContext): RoundContext | null {
  if (ctx.activeSlot === "B") {
    const next = ctx.currentRound + 1;
    if (next > ctx.totalRounds) return null;
    return { ...ctx, currentRound: next, activeSlot: "A" };
  }
  return { ...ctx, activeSlot: "B" };
}

export function canTransition(from: DebateState, to: DebateState): boolean {
  const legal: Record<DebateState, DebateState[]> = {
    WAITING: ["TOPIC_REVEAL"],
    TOPIC_REVEAL: ["ROUND"],
    ROUND: ["ROUND", "VOTING"],
    VOTING: ["VERDICT"],
    VERDICT: ["FINISHED"],
    FINISHED: [],
  };
  return legal[from].includes(to);
}

export function canSubmitArgument(state: DebateState, activeSlot: Slot, submittingSlot: Slot): boolean {
  return state === "ROUND" && activeSlot === submittingSlot;
}

export function canVote(state: DebateState): boolean {
  return state === "ROUND" || state === "VOTING";
}

export function canStartDebate(state: DebateState, connectedSlots: Slot[]): boolean {
  return state === "WAITING" && connectedSlots.includes("A") && connectedSlots.includes("B");
}