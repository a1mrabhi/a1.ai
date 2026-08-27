import { NextResponse } from "next/server";
import { analyzeDataset } from "@/lib/analyst/datasetAnalyzer";
import type { DatasetColumn } from "@/lib/analyst/analystTypes";

type AnalyzeRequest = {
  rows: Record<string, unknown>[];
  columns: DatasetColumn[];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnalyzeRequest;

    const rows = body.rows;
    const columns = body.columns;

    // Validate rows
    if (!Array.isArray(rows)) {
      return NextResponse.json(
        {
          success: false,
          error: "Dataset rows are required.",
        },
        { status: 400 },
      );
    }

    // Validate columns
    if (!Array.isArray(columns) || columns.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Dataset columns are required.",
        },
        { status: 400 },
      );
    }

    if (rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "The dataset contains no rows.",
        },
        { status: 400 },
      );
    }

    // Run deterministic statistical analysis
    const analysis = analyzeDataset(rows, columns);

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error("Dataset analysis error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to analyze dataset.",
      },
      { status: 500 },
    );
  }
}