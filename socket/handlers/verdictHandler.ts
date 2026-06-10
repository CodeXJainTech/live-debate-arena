import { Server } from "socket.io";
import { prisma } from "../../libs/prisma";
import { generateVerdict } from "../../libs/gemini";
import { transitionToFinished } from "./stateHandlers";

//adding retries for persistent connection.
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 2000,
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((res) => setTimeout(res, delayMs));
    }
  }
  throw new Error("Max retries reached");
}

export async function runVerdictEngine(io: Server, roomId: string) {
  try {
    const debate = await withRetry(() =>
      prisma.debate.findUnique({
        where: { roomId },
        include: {
          arguments: {
            include: { participant: true },
            orderBy: { submittedAt: "asc" },
          },
          participants: true,
        },
      }),
    );

    if (!debate || debate.arguments.length === 0) {
      io.to(`room:${roomId}`).emit("verdict:error", {
        message: "No arguments to judge",
      });
      // not stuck in verdict state
      await transitionToFinished(io, roomId);
      return;
    }

    const transcript = debate.arguments.map((arg) => ({
      slot: arg.participant.slot as "A" | "B",
      displayName: arg.participant.displayName,
      roundNumber: arg.roundNumber,
      text: arg.text,
    }));

    // Gemini gets 3 attempts with 2s between each
    const result = await withRetry(() =>
      generateVerdict(debate.topic, transcript),
    );

    await withRetry(() =>
      prisma.verdict.create({
        data: {
          debateId: debate.id,
          winnerId: result.winnerId,
          reasoning: result.reasoning,
          strongestForA: result.strongestForA,
          strongestForB: result.strongestForB,
          turningPoint: result.turningPoint,
        },
      }),
    );

    io.to(`room:${roomId}`).emit("verdict:ready", result);
    await transitionToFinished(io, roomId);
  } catch(err) {
    console.error("Verdict generation error:", err);
    io.to(`room:${roomId}`).emit("verdict:error", {
      message:
        "Failed to generate verdict. The debate will still be saved.",
    });
    // not stuck in verdict state.
    await transitionToFinished(io, roomId);
  }
}