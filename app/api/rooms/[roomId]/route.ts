import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/libs/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const debate = await prisma.debate.findUnique({
    where: { roomId },
    include: {
      participants: true,
      arguments: {
        include: { participant: true, scores: true },
        orderBy: { submittedAt: "asc" },
      },
      verdict: true,
    },
  });

  if (!debate) {
    return NextResponse.json({ error: "Debate not found" }, { status: 404 });
  }

  return NextResponse.json(debate);
}