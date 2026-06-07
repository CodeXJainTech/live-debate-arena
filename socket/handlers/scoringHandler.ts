import { scoreEvidence, scoreLogic, scorePersuasion } from "@/libs/gemini";
import { prisma } from "@/libs/prisma";
import { Server } from "socket.io";

export async function scoreArgument(io: Server, roomId: string, argumentId: string, topic: string, argumentText: string, slot: "A" | "B") {

  io.to(`room:${roomId}`).emit("scoring: started", { argumentId, slot });

  const dimension = ["LOGIC", "EVIDENCE", "PERSUASION"] as const;
  const scorings = [scoreLogic(topic, argumentText), scoreEvidence(topic, argumentText), scorePersuasion(topic, argumentText)];

  scorings.forEach((promise, i) => {
    promise.then((res) => {
      io.to(`room:${roomId}`).emit("scoring:dimension", {
        argumentId,
        dimension: dimension[i],
        score: res.score,
        critique: res.critique,
      });
    }).catch(() => {
      io.to(`room:${roomId}`).emit("scoring:dimension", {
        argumentId,
        dimension: dimension[i],
        score: null,
        critique: "Scoring unavailable",
      });
    });
  });

  const results = await Promise.allSettled(scorings);

  const toSave = results.map((result, i) => {
    if (result.status === "fulfilled") {
      return {
        argumentId,
        dimension: dimension[i],
        score: result.value.score,
        critique: result.value.critique,
      };
    }
    return null;
  }).filter(Boolean) as { argumentId: string; dimension: typeof dimension[number]; score: number; critique: string }[];

  if (toSave.length > 0) {
    await prisma.score.createMany({ data: toSave });
  }

  io.to(`room:${roomId}`).emit("scoring:complete", { argumentId });
}

