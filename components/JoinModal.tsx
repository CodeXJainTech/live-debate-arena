"use client";

import { useState } from "react";

interface JoinModalProps {
  roomId: string;
  role: "debater" | "audience";
  slot?: "A" | "B";
  onJoin: (displayName: string, age: number) => void;
}

export default function JoinModal({
  roomId,
  role,
  slot,
  onJoin,
}: JoinModalProps) {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [error, setError] = useState("");

  function handleSubmit() {
    const trimmedName = name.trim();
    const parsedAge = parseInt(age);

    if (trimmedName.length < 2) {
      setError("Name must be at least 2 characters");
      return;
    }

    if (isNaN(parsedAge) || parsedAge < 13 || parsedAge > 120) {
      setError("Please enter a valid age (13–120)");
      return;
    }

    onJoin(trimmedName, parsedAge);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-md">
        <div className="mb-6">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 mb-3">
            {role === "debater" ? `Debater · Slot ${slot}` : "Audience"}
          </span>
          <h1 className="text-2xl font-semibold text-gray-900">
            Join room {roomId}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {role === "debater"
              ? "You've been invited to debate. Enter your name to continue."
              : "You're joining as an audience member. Your votes will shift the opinion meter live."}
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Display name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="What should we call you?"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              maxLength={32}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Age
            </label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Your age"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              min={13}
              max={120}
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Enter room
          </button>
        </div>
      </div>
    </div>
  );
}