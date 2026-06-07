import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const flashModel = genAI.getGenerativeModel({
  model: "gemini-3.0-flash",
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