import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeDataset } from "@/lib/analyst/datasetAnalyzer";
import type { DatasetColumn } from "@/lib/analyst/analystTypes";

type AnalyzeRequest = {
  datasetId?: string;
};

function parseStoredColumns(value: unknown): DatasetColumn[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (column): column is DatasetColumn =>
      typeof column === "object" &&
      column !== null &&
      typeof (column as { name?: unknown }).name === "string" &&
      typeof (column as { type?: unknown }).type === "string",
  );
}

function parseStoredRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (row): row is Record<string, unknown> =>
      typeof row === "object" && row !== null && !Array.isArray(row),
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnalyzeRequest;

    if (!body.datasetId || typeof body.datasetId !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Dataset ID is required.",
        },
        { status: 400 },
      );
    }

    const dataset = await prisma.analystDataset.findUnique({
      where: { id: body.datasetId },
      select: {
        id: true,
        rowCount: true,
        columnCount: true,
        columns: true,
        rows: true,
      },
    });

    if (!dataset) {
      return NextResponse.json(
        {
          success: false,
          error: "Dataset not found.",
        },
        { status: 404 },
      );
    }

    const rows = parseStoredRows(dataset.rows);
    const columns = parseStoredColumns(dataset.columns);

    if (rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "The dataset contains no rows.",
        },
        { status: 400 },
      );
    }

    if (columns.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "The dataset contains no columns.",
        },
        { status: 400 },
      );
    }

    const analysis = analyzeDataset(rows, columns);

    return NextResponse.json({
      success: true,
      datasetId: dataset.id,
      analysis,
    });
  } catch (error) {
    console.error("Dataset analysis error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to analyze dataset.",
      },
      { status: 500 },
    );
  }
}
