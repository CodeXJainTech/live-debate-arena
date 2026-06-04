import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/libs/prisma";
import { SignJWT } from "jose";
import { v4 as uuidv4 } from "uuid";

const secret = new TextEncoder().encode(process.env.DEBATER_JWT_SECRET!);

async function signDebaterToken(roomId: string, slot: "A" | "B") {
  return new SignJWT({ roomId, slot })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
    .sign(secret);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { topic, totalRounds, hostName } = body;

  if (!topic || typeof topic !== "string" || topic.trim().length < 10) {
    return NextResponse.json(
      { error: "Topic must be at least 10 characters" },
      { status: 400 },
    );
  }

  if (!totalRounds || totalRounds < 1 || totalRounds > 5) {
    return NextResponse.json(
      { error: "Rounds must be between 1 and 5" },
      { status: 400 },
    );
  }

  const roomId = uuidv4().slice(0, 8).toUpperCase();

  const debate = await prisma.debate.create({
    data: {
      roomId,
      topic: topic.trim(),
      totalRounds,
      state: "WAITING",
    },
  });

  const [tokenA, tokenB] = await Promise.all([
    signDebaterToken(roomId, "A"),
    signDebaterToken(roomId, "B"),
  ]);

  const base = process.env.NEXT_PUBLIC_APP_URL;

  return NextResponse.json({
    roomId,
    debateId: debate.id,
    debaterLinkA: `${base}/room/${roomId}?token=${tokenA}`,
    debaterLinkB: `${base}/room/${roomId}?token=${tokenB}`,
    audienceLink: `${base}/room/${roomId}/audience`,
  });
}