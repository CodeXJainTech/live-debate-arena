import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/libs/prisma";
import {
  getRoomState,
  getCachedHistory,
  setCachedHistory,
  HistoryArgument,
} from "@/socket/roomState";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;

  // try redis first for the argument list-this is the part that gets
  // hit repeatedly when many users click to get full history page.
  const liveState = await getRoomState(roomId);
  let cachedHistory: HistoryArgument[] | null = null;
  if (liveState) {
    cachedHistory = await getCachedHistory(roomId);
  }

  const debate = await prisma.debate.findUnique({
    where: { roomId },
    include: {
      participants: true,
      verdict: true,
      ...(cachedHistory === null
        ? {
            arguments: {
              include: { participant: true, scores: true },
              orderBy: { submittedAt: "asc" as const },
            },
          }
        : {}),
    },
  });

  if (!debate) {
    return NextResponse.json({ error: "Debate not found" }, { status: 404 });
  }

  if (cachedHistory !== null) {
    return NextResponse.json({
      ...debate,
      arguments: cachedHistory.map((h) => ({
        id: h.argumentId,
        roundNumber: h.roundNumber,
        text: h.text,
        submittedAt: h.submittedAt,
        participant: { slot: h.slot, displayName: h.displayName },
        scores: h.scores,
      })),
    });
  }

  // cache miss-populate redis for next time if room is still live
  if (liveState && "arguments" in debate) {
    const history: HistoryArgument[] = (debate as any).arguments.map(
      (arg: any) => ({
        argumentId: arg.id,
        slot: arg.participant.slot,
        displayName: arg.participant.displayName,
        roundNumber: arg.roundNumber,
        text: arg.text,
        submittedAt: arg.submittedAt.toISOString(),
        scores: arg.scores.map((s: any) => ({
          dimension: s.dimension,
          score: s.score,
          critique: s.critique,
        })),
      }),
    );
    await setCachedHistory(roomId, history);
  }

  return NextResponse.json(debate);
}