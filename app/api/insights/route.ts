import { NextRequest, NextResponse } from "next/server";

type InsightInput = {
  monthKey: string;
  totalCollection: number;
  lossAmount: number;
  netProfit: number;
  pendingCount: number;
};

function toMoney(value: number) {
  return `₹${value.toFixed(2)}`;
}

function buildRuleBasedInsight(payload: InsightInput) {
  const points: string[] = [];

  if (payload.pendingCount > 0) {
    points.push(
      `${payload.pendingCount} payments are pending. Prioritize these collections this week to improve cash flow.`,
    );
  } else {
    points.push("No pending payments now. Keep this by following a fixed weekly collection schedule.");
  }

  const lossRatio = payload.totalCollection > 0 ? payload.lossAmount / payload.totalCollection : 0;
  if (lossRatio >= 0.08) {
    points.push(
      `Loss is high at ${toMoney(payload.lossAmount)}. Review delivery variance route-by-route and reduce returns first.`,
    );
  } else {
    points.push(
      `Loss is controlled at ${toMoney(payload.lossAmount)}. Maintain current delivery confirmation discipline.`,
    );
  }

  if (payload.netProfit < 0) {
    points.push(
      `Net profit is negative (${toMoney(payload.netProfit)}). Focus on early-month collections and cut avoidable delivery loss.`,
    );
  } else {
    points.push(
      `Net profit is ${toMoney(payload.netProfit)}. Push early payments before the 10th to maximize 8% incentive.`,
    );
  }

  return points.slice(0, 3).map((point, index) => `${index + 1}) ${point}`).join(" ");
}

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as InsightInput;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      insight: buildRuleBasedInsight(payload),
      source: "rule-based",
    });
  }

  const prompt = `You are a concise business assistant for a newspaper supply agent app.
Give exactly 3 practical action points based on the numbers.
Keep it short and specific.

Month: ${payload.monthKey}
Total Collection: ${payload.totalCollection}
Loss Amount: ${payload.lossAmount}
Net Profit: ${payload.netProfit}
Pending Payments Count: ${payload.pendingCount}

Rules:
- Mention at least one numeric value from input.
- Write in plain text with numbering like "1) ... 2) ... 3) ...".
- Keep response under 90 words.
- Use fresh phrasing and avoid repeating stock wording.`;

  try {
    const sdk = await import("@google/genai");
    const ai = new sdk.GoogleGenAI({ apiKey });

    const result = (await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        temperature: 0.9,
        topP: 0.95,
        maxOutputTokens: 180,
      },
    })) as { text?: string };

    const text = result.text?.trim();

    return NextResponse.json({
      insight: text || buildRuleBasedInsight(payload),
      source: text ? "gemini" : "rule-based",
    });
  } catch {
    return NextResponse.json({
      insight: buildRuleBasedInsight(payload),
      source: "rule-based",
    });
  }
}
