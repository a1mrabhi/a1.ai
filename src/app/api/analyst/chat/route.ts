import { NextResponse } from "next/server";
import { generateWithGemini } from "@/lib/ai/gemini";
import type { DatasetColumn } from "@/lib/analyst/analystTypes";

type ChatRequest = {
  question: string;
  rows: Record<string, unknown>[];
  columns: DatasetColumn[];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatRequest;

    const question = body.question?.trim();
    const rows = body.rows;
    const columns = body.columns;

    // Validate question
    if (!question) {
      return NextResponse.json(
        {
          success: false,
          error: "Please enter a question about your dataset.",
        },
        { status: 400 }
      );
    }

    // Validate dataset
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Dataset rows are required.",
        },
        { status: 400 }
      );
    }

    if (!Array.isArray(columns) || columns.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Dataset columns are required.",
        },
        { status: 400 }
      );
    }

    const datasetContext = JSON.stringify(
      {
        columns,
        rowCount: rows.length,
        rows,
      },
      null,
      2
    );

    const systemPrompt = `
You are A1.ai, an intelligent data analyst.

The user has uploaded a dataset and is asking a question about it.

Your job is to answer the user's question using ONLY the information contained in the provided dataset.

IMPORTANT RULES:

1. Do not invent values, records, trends, or facts.
2. Do not assume the dataset is about sales, products, finance, employees, or any particular industry.
3. Understand the actual columns and values before answering.
4. Perform calculations when necessary.
5. When comparing values, clearly explain the comparison.
6. If the dataset does not contain enough information to answer the question, say so clearly.
7. If the user's question is ambiguous, explain what is unclear and ask a concise clarification.
8. Keep answers clear and useful rather than overly technical.
9. When appropriate, include the relevant numbers behind your conclusion.
10. Treat dates as calendar dates exactly as provided by the dataset. Do not change their timezone or shift them by a day.

You are analyzing the user's actual dataset, not giving generic data-analysis advice.

DATASET:
${datasetContext}
`;

    const answer = await generateWithGemini([
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: question,
      },
    ]);

    return NextResponse.json({
      success: true,
      answer,
    });
  } catch (error) {
    console.error("Dataset chat error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to answer the dataset question.",
      },
      { status: 500 }
    );
  }
}