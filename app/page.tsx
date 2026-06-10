"use client";

import { useState } from "react";

export default function HomePage() {
  const [topic, setTopic] = useState("");
  const [rounds, setRounds] = useState(2);
  const [hostName, setHostName] = useState("");
  const [links, setLinks] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function createRoom() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, totalRounds: rounds, hostName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLinks(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 w-full max-w-lg">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">
          Create a debate room
        </h1>
        <p className="text-gray-600 text-sm mb-6">
          Set a topic, choose rounds, share the links.
        </p>

        {!links ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Debate topic
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Remote work is better than office work"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Rounds per debater
              </label>
              <select
                value={rounds}
                onChange={(e) => setRounds(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} round{n > 1 ? "s" : ""} ({n * 2} arguments total)
                  </option>
                ))}
              </select>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              onClick={createRoom}
              disabled={loading || topic.trim().length < 10}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? "Creating..." : "Create room"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-600">
              Room <span className="font-mono">{links.roomId}</span> created.
              Share these links:
            </p>

            {[
              { label: "Debater A", url: links.debaterLinkA },
              { label: "Debater B", url: links.debaterLinkB },
              { label: "Audience", url: links.audienceLink },
            ].map(({ label, url }) => (
              <div
                key={label}
                className="rounded-lg border border-gray-200 p-3"
              >
                <p className="text-xs font-medium text-gray-600 mb-1">
                  {label}
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-mono text-gray-600 truncate flex-1">
                    {url}
                  </p>
                  <button
                    onClick={() => navigator.clipboard.writeText(url)}
                    className="text-xs text-purple-600 hover:text-purple-700 shrink-0"
                  >
                    Copy
                  </button>
                </div>
              </div>
            ))}

            <button
              onClick={() => setLinks(null)}
              className="w-full py-2 text-sm text-gray-600 hover:text-gray-600"
            >
              Create another room
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
