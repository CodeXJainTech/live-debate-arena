"use client";
import { ArgumentEvent } from "@/hooks/useDebateState";
import { ArgumentScore } from "@/hooks/useScores";

interface Props {
  argument: ArgumentEvent;
  score?: ArgumentScore;
}

const SLOT_COLORS: Record<string, string> = {
  A: "bg-purple-100 text-purple-700",
  B: "bg-teal-100 text-teal-700",
};

function scoreColor(score: number | null) {
  if (score === null) return "bg-gray-200";
  if (score >= 7) return "bg-green-500";
  if (score >= 4) return "bg-yellow-400";
  return "bg-red-400";
}

export default function ArgumentCard({ argument, score }: Props) {
  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${SLOT_COLORS[argument.slot]}`}
          >
            Debater {argument.slot}
          </span>
          <span className="text-sm font-medium text-gray-800">
            {argument.displayName}
          </span>
        </div>
        <span className="text-xs text-gray-400">
          Round {argument.roundNumber}
        </span>
      </div>

      <p className="text-sm text-gray-700 leading-relaxed">{argument.text}</p>

      {score && score.dimensions.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
          {score.dimensions.map((d) => (
            <div key={d.dimension}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs text-gray-500 w-20">
                  {d.dimension}
                </span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${scoreColor(d.score)}`}
                    style={{ width: d.score ? `${d.score * 10}%` : "0%" }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-700 w-4">
                  {d.score ?? "—"}
                </span>
              </div>
              <p className="text-xs text-gray-400 ml-20">{d.critique}</p>
            </div>
          ))}
          {!score.complete && (
            <p className="text-xs text-gray-400">Scoring...</p>
          )}
        </div>
      )}

      {!score && <p className="text-xs text-gray-400 mt-2">Scoring...</p>}
    </div>
  );
}