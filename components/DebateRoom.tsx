"use client";
import { useState } from "react";
import { Socket } from "socket.io-client";
import { useDebateState } from "@/hooks/useDebateState";
import { useVotes } from "@/hooks/useVotes";
import { useScores } from "@/hooks/useScores";
import { useVerdict } from "@/hooks/useVerdict";
import WaitingRoom from "./WaitingRoom";
import ArgumentCard from "./ArgumentCard";
import OpinionMeter from "./OpinionMeter";
import Timer from "./Timer";

interface Props {
  socket: Socket;
  roomId: string;
}

export default function DebateRoom({ socket, roomId }: Props) {
  const { roomState, arguments: args, error } = useDebateState(socket);
  const { forCount, againstCount, total, percentage, myVote, castVote } =
    useVotes(socket);
  const { scores } = useScores(socket);
  const { verdict, verdictError, isTimedOut, isVeryLate } = useVerdict(socket);
  const [input, setInput] = useState("");

  if (!roomState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 text-sm">Connecting...</p>
      </div>
    );
  }

  const isMyTurn =
    roomState.yourRole === "debater" &&
    roomState.activeSlot === roomState.yourSlot;

  function handleSubmit() {
    if (input.trim().length < 10) return;
    socket.emit("debate:submit_argument", { text: input.trim() });
    setInput("");
  }

  if (roomState.state === "WAITING") {
    return (
      <WaitingRoom
        topic={roomState.topic}
        connectedSlots={(roomState as any).connectedSlots ?? []}
        yourRole={roomState.yourRole}
        yourSlot={roomState.yourSlot}
        onStart={() => socket.emit("debate:start")}
      />
    );
  }

  if (roomState.state === "TOPIC_REVEAL") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-4">
        <p className="text-xs text-gray-400 uppercase tracking-wide">Topic</p>
        <h1 className="text-3xl font-semibold text-gray-900 text-center max-w-xl">
          {roomState.topic}
        </h1>
        <Timer endsAt={roomState.topicRevealEndsAt} label="Starting in" />
      </div>
    );
  }

  if (roomState.state === "VERDICT" || roomState.state === "FINISHED") {
    if (verdictError)
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-2 p-4">
          <p className="text-red-500 text-sm">{verdictError}</p>
          <a
            href={`/history/${roomId}`}
            className="text-sm text-purple-600 hover:text-purple-700 underline"
          >
            View full debate analysis
          </a>
        </div>
      );

    if (!verdict)
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center space-y-2">
            <p className="text-gray-700 text-sm">
              {isVeryLate
                ? "This is taking longer than usual..."
                : isTimedOut
                  ? "Still generating verdict..."
                  : "Generating AI verdict..."}
            </p>
            {isVeryLate && (
              <p className="text-gray-400 text-xs">
                Hang tight, this can take a little while during busy periods.
              </p>
            )}
            <a
              href={`/history/${roomId}`}
              className="text-sm text-purple-600 hover:text-purple-700 underline"
            >
              View full debate analysis
            </a>
          </div>
        </div>
      );

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-xl space-y-4">
          <div className="text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
              Winner
            </p>
            <p className="text-2xl font-semibold text-gray-900">
              {verdict.winnerId ? `Debater ${verdict.winnerId}` : "Draw"}
            </p>
          </div>
          <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-4">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                Reasoning
              </p>
              <p className="text-sm text-gray-700">{verdict.reasoning}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                Strongest moment · Debater A
              </p>
              <p className="text-sm text-gray-700">{verdict.strongestForA}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                Strongest moment · Debater B
              </p>
              <p className="text-sm text-gray-700">{verdict.strongestForB}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                Turning point
              </p>
              <p className="text-sm text-gray-700">{verdict.turningPoint}</p>
            </div>
          </div>
          <a
            href={`/history/${roomId}`}
            className="block w-full text-center py-2.5 border border-gray-300 hover:border-gray-400 text-gray-600 rounded-lg text-sm font-medium transition-colors"
          >
            View Full Debate Analysis
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-600 text-center">
          {error}
        </div>
      )}

      <div className="border-b border-gray-200 bg-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">
            {roomState.topic}
          </span>
          {roomState.state === "ROUND" && (
            <span className="text-xs text-gray-400">
              Round {roomState.currentRound} of {roomState.totalRounds}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {roomState.state === "ROUND" && roomState.activeSlot && (
            <span className="text-xs text-gray-500">
              Debater {roomState.activeSlot}'s turn
            </span>
          )}
          {roomState.state === "ROUND" && (
            <Timer endsAt={roomState.roundEndsAt} />
          )}
          {roomState.state === "VOTING" && (
            <Timer endsAt={roomState.votingEndsAt} label="Voting ends" />
          )}
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          {args.map((arg) => (
            <ArgumentCard
              key={arg.argumentId}
              argument={arg}
              score={scores[arg.argumentId]}
            />
          ))}
          {args.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">
              No arguments yet. Waiting for debater A.
            </p>
          )}
        </div>

        <OpinionMeter
          percentage={percentage}
          forCount={forCount}
          againstCount={againstCount}
          total={total}
        />

        {roomState.yourRole === "audience" && (
          <div className="flex gap-3">
            <button
              onClick={() => castVote("FOR")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                myVote === "FOR"
                  ? "bg-green-500 text-white border-green-500"
                  : "border-gray-300 text-gray-700 hover:border-green-400"
              }`}
            >
              For
            </button>
            <button
              onClick={() => castVote("AGAINST")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                myVote === "AGAINST"
                  ? "bg-red-500 text-white border-red-500"
                  : "border-gray-300 text-gray-700 hover:border-red-400"
              }`}
            >
              Against
            </button>
          </div>
        )}

        {roomState.yourRole === "debater" && roomState.state === "ROUND" && (
          <div className="border border-gray-200 rounded-xl p-4 bg-white">
            {isMyTurn ? (
              <>
                <p className="text-xs text-gray-500 mb-2">
                  Your turn — make your argument
                </p>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  maxLength={1000}
                  placeholder="Type your argument..."
                  className="w-full text-sm text-gray-800 border border-gray-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows={4}
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-400">
                    {input.trim().length}/1000
                  </span>
                  <button
                    onClick={handleSubmit}
                    disabled={input.trim().length < 10}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Submit
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-400 text-center py-2">
                Waiting for debater {roomState.activeSlot}...
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}