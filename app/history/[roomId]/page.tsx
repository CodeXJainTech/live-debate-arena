import { notFound } from "next/navigation";

interface Score {
  dimension: string;
  score: number;
  critique: string;
}

interface Participant {
  slot: string;
  displayName: string;
}

interface Argument {
  id: string;
  roundNumber: number;
  text: string;
  submittedAt: string;
  participant: Participant;
  scores: Score[];
}

interface Verdict {
  winnerId: string | null;
  reasoning: string;
  strongestForA: string;
  strongestForB: string;
  turningPoint: string;
}

interface Debate {
  topic: string;
  createdAt: string;
  state: string;
  arguments: Argument[];
  verdict: Verdict | null;
}

function scoreColor(score: number) {
  if (score >= 7) return "bg-green-500";
  if (score >= 4) return "bg-yellow-400";
  return "bg-red-400";
}

const SLOT_COLORS: Record<string, string> = {
  A: "bg-purple-100 text-purple-700",
  B: "bg-teal-100 text-teal-700",
};

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/rooms/${roomId}`,
    { cache: "no-store" },
  );

  if (!res.ok) notFound();

  const debate: Debate = await res.json();

  if (debate.state !== "FINISHED") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-2">
        <p className="text-gray-600 text-sm">
          {debate.state === "VERDICT"
            ? "Verdict is being generated… check back in a moment."
            : "Debate not finished yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* header */}
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
            Debate recap
          </p>
          <h1 className="text-2xl font-semibold text-gray-900">
            {debate.topic}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {new Date(debate.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {/* verdict */}
        {debate.verdict && (
          <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-4">
            <div className="text-center pb-2 border-b border-gray-100">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                Winner
              </p>
              <p className="text-xl font-semibold text-gray-900">
                {debate.verdict.winnerId
                  ? `Debater ${debate.verdict.winnerId}`
                  : "Draw"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                Reasoning
              </p>
              <p className="text-sm text-gray-600">
                {debate.verdict.reasoning}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                Strongest moment · Debater A
              </p>
              <p className="text-sm text-gray-600">
                {debate.verdict.strongestForA}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                Strongest moment · Debater B
              </p>
              <p className="text-sm text-gray-600">
                {debate.verdict.strongestForB}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                Turning point
              </p>
              <p className="text-sm text-gray-600">
                {debate.verdict.turningPoint}
              </p>
            </div>
          </div>
        )}

        {/* arguments */}
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">
            Arguments
          </p>
          <div className="space-y-3">
            {debate.arguments.map((arg) => (
              <div
                key={arg.id}
                className="border border-gray-200 rounded-xl p-4 bg-white"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${SLOT_COLORS[arg.participant.slot]}`}
                    >
                      Debater {arg.participant.slot}
                    </span>
                    <span className="text-sm font-medium text-gray-800">
                      {arg.participant.displayName}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    Round {arg.roundNumber}
                  </span>
                </div>

                <p className="text-sm text-gray-600 leading-relaxed">
                  {arg.text}
                </p>

                {arg.scores.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                    {arg.scores.map((s) => (
                      <div key={s.dimension}>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs text-gray-600 w-20">
                            {s.dimension}
                          </span>
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${scoreColor(s.score)}`}
                              style={{ width: `${s.score * 10}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-gray-600 w-4">
                            {s.score}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 ml-20">
                          {s.critique}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
