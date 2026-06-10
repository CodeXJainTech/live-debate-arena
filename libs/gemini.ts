import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const flashModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  generationConfig: {
    responseMimeType: "application/json",
  },
});

export async function scoreLogic(
  topic: string,
  argument: string,
): Promise<{ score: number; critique: string }> {
  const prompt = `You are evaluating a debate argument strictly on LOGICAL STRUCTURE only.

Topic: "${topic}"
Argument: "${argument}"

Evaluate only these aspects:
- Does the argument follow a clear logical structure?
- Are the inferences valid — do conclusions follow from premises?
- Are there logical fallacies (strawman, false dichotomy, ad hominem, slippery slope etc)?
- Is the reasoning internally consistent?

Do NOT consider whether claims are backed by evidence. Do NOT consider persuasive language. Logic only.

Respond in this exact JSON format with no other text:
{"score": <integer 1-10>, "critique": "<2 sentences max>"}`;

  const result = await flashModel.generateContent(prompt);
  const text = result.response.text().trim();
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

export async function scoreEvidence(
  topic: string,
  argument: string,
): Promise<{ score: number; critique: string }> {
  const prompt = `You are evaluating a debate argument strictly on USE OF EVIDENCE only.

Topic: "${topic}"
Argument: "${argument}"

Evaluate only these aspects:
- Are concrete facts, statistics, studies, or examples used?
- Are claims specific and verifiable or vague and unverifiable?
- Is evidence relevant to the point being made?
- Does the argument rely on unsupported assertions?

Do NOT consider logical structure. Do NOT consider persuasive language. Evidence only.

Respond in this exact JSON format with no other text:
{"score": <integer 1-10>, "critique": "<2 sentences max>"}`;

  const result = await flashModel.generateContent(prompt);
  const text = result.response.text().trim();
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

export async function scorePersuasion(
  topic: string,
  argument: string,
): Promise<{ score: number; critique: string }> {
  const prompt = `You are evaluating a debate argument strictly on PERSUASIVE EFFECTIVENESS only.

Topic: "${topic}"
Argument: "${argument}"

Evaluate only these aspects:
- Is the argument framed in a way that is compelling to a general audience?
- Does it use rhetorical techniques effectively (contrast, emphasis, appeals)?
- Is the language clear and confident or vague and hesitant?
- Would this argument actually change minds?

Do NOT consider logical structure. Do NOT consider evidence quality. Persuasion only.

Respond in this exact JSON format with no other text:
{"score": <integer 1-10>, "critique": "<2 sentences max>"}`;

  const result = await flashModel.generateContent(prompt);
  const text = result.response.text().trim();
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

export async function generateVerdict(
  topic: string,
  transcript: {
    slot: "A" | "B";
    displayName: string;
    roundNumber: number;
    text: string;
  }[],
): Promise<{
  winnerId: "A" | "B" | null;
  reasoning: string;
  strongestForA: string;
  strongestForB: string;
  turningPoint: string;
}> {
  const formatted = transcript
    .map(
      (t) =>
        `[Round ${t.roundNumber} - Debater ${t.slot} (${t.displayName})]: ${t.text}`,
    )
    .join("\n\n");

  const prompt = `You are judging a formal debate. Analyze the full transcript below and produce a verdict.

Topic: "${topic}"

Transcript:
${formatted}

Evaluate who made the stronger overall case based on logic, evidence, and persuasion across all rounds.

Respond in this exact JSON format with no other text:
{
  "winner": "A" (or "B", or null),
  "reasoning": "<3-4 sentences explaining why this debater won overall>",
  "strongestForA": "<1-2 sentences identifying debater A's strongest moment>",
  "strongestForB": "<1-2 sentences identifying debater B's strongest moment>",
  "turningPoint": "<1-2 sentences identifying the moment that most shifted the debate>"
}`;

  const result = await flashModel.generateContent(prompt);
  const clean = result.response
    .text()
    .trim()
    .replace(/```json|```/g, "")
    .trim();
  const parsed = JSON.parse(clean);

  return {
    winnerId: parsed.winner,
    reasoning: parsed.reasoning,
    strongestForA: parsed.strongestForA,
    strongestForB: parsed.strongestForB,
    turningPoint: parsed.turningPoint,
  };
}