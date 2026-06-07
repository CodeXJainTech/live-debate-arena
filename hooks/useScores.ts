import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";

export interface DimensionScore {
  dimension: "LOGIC" | "EVIDENCE" | "PERSUASION";
  score: number | null;
  critique: string;
}

export interface ArgumentScore {
  argumentId: string;
  dimensions: DimensionScore[];
  complete: boolean;
}

export function useScores(socket: Socket | null){
  const [scores, setScores] = useState<Record<string, ArgumentScore>>({});

  useEffect(() => {
    if(!socket){
      return;
    }

    socket.on("scoring:started", (data: { argumentId: string }) => {
      setScores((prev) => ({
        ...prev, [data.argumentId]: {argumentId: data.argumentId, dimensions: [], complete: false}
      }));
    });

    socket.on("scoring:dimension", (data: { argumentId: string; dimension: "LOGIC"| "EVIDENCE" | "PERSUASION"; score: number | null; critique: string }) => {
      setScores((prev) => {
        const entry = prev[data.argumentId];
        if (!entry) return prev;
        return {
          ...prev,
          [data.argumentId]: {
            ...entry,
            dimensions: [...entry.dimensions, {
              dimension: data.dimension,
              score: data.score,
              critique: data.critique,
            }],
          },
        };
      });
    });

    socket.on("scoring:complete", (data: { argumentId: string }) => {
      setScores((prev) => {
        const entry = prev[data.argumentId];
        if (!entry) return prev;
        return {
          ...prev, [data.argumentId]: { ...entry, complete: true },
        };
      });
    });

    return () => {
      socket.off("scoring:started");
      socket.off("scoring:dimension");
      socket.off("scoring:complete");
    };

  }, [socket]);
  
  return {scores};
}