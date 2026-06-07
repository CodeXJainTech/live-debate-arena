"use client";

interface Props {
  topic: string;
  connectedSlots: string[];
  yourRole: "debater" | "audience";
  yourSlot: "A" | "B" | null;
  onStart: () => void;
}

export default function WaitingRoom({
  topic,
  connectedSlots,
  yourRole,
  yourSlot,
  onStart,
}: Props) {
  const bothConnected =
    connectedSlots.includes("A") && connectedSlots.includes("B");

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
          Topic
        </p>
        <h1 className="text-2xl font-semibold text-gray-900 mb-8">{topic}</h1>

        <div className="flex gap-4 mb-8">
          {["A", "B"].map((slot) => (
            <div
              key={slot}
              className="flex items-center gap-2 border border-gray-200 rounded-lg px-4 py-3 flex-1"
            >
              <div
                className={`w-2 h-2 rounded-full ${connectedSlots.includes(slot) ? "bg-green-500" : "bg-gray-300"}`}
              />
              <span className="text-sm text-gray-700">Debater {slot}</span>
              {connectedSlots.includes(slot) && (
                <span className="text-xs text-green-600 ml-auto">
                  Connected
                </span>
              )}
            </div>
          ))}
        </div>

        {yourRole === "debater" &&
          yourSlot === "A" &&
          (bothConnected ? (
            <button
              onClick={onStart}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Start debate
            </button>
          ) : (
            <p className="text-sm text-gray-400 text-center">
              Waiting for debater B to connect...
            </p>
          ))}

        {yourRole === "debater" && yourSlot === "B" && (
          <p className="text-sm text-gray-400 text-center">
            Waiting for debater A to start...
          </p>
        )}

        {yourRole === "audience" && (
          <p className="text-sm text-gray-400 text-center">
            Waiting for the debate to start...
          </p>
        )}
      </div>
    </div>
  );
}
