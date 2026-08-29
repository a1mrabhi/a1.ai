import { prisma } from "@/lib/prisma";
import { parseDataset } from "@/lib/analyst/datasetParser";
import { profileDataset } from "@/lib/analyst/datasetProfiler";
import { normalizeColumnType } from "@/lib/analyst/analystTypes";
import { analyzeDataset } from "@/lib/analyst/datasetAnalyzer";
import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_EXTENSIONS = [".csv", ".xls", ".xlsx", ".json"];

export async function POST(request: Request) {
  try {
    const user = await getOrCreateUser();
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: "No dataset file was provided.",
        },
        { status: 400 },
      );
    }

    const fileName = file.name.toLowerCase();
    const extension = ALLOWED_EXTENSIONS.find((ext) => fileName.endsWith(ext));

    if (!extension) {
      return NextResponse.json(
        {
          success: false,
          error: "Unsupported file type. Please upload CSV, XLS, XLSX, or JSON.",
        },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: "File is too large. Maximum file size is 10 MB.",
        },
        { status: 400 },
      );
    }

    // ------------------------------------------------------------
    // Parse uploaded file
    // ------------------------------------------------------------

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const parsedDataset = parseDataset(buffer, file.name);

    if (parsedDataset.rowCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "The uploaded dataset is empty.",
        },
        { status: 400 },
      );
    }

    if (parsedDataset.columnCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No columns were detected in the dataset.",
        },
        { status: 400 },
      );
    }

    // ------------------------------------------------------------
    // Build column metadata
    // ------------------------------------------------------------

    const previewRows = parsedDataset.rows.slice(0, 20);

    const normalizedColumns = parsedDataset.columns.map((columnName) => {
      const values = parsedDataset.rows
        .map((row) => row[columnName])
        .filter(
          (value) =>
            value !== null &&
            value !== undefined &&
            !(typeof value === "string" && value.trim() === ""),
        );

      const missingCount = parsedDataset.rows.length - values.length;

      if (values.length === 0) {
        return {
          name: columnName,
          type: normalizeColumnType("unknown"),
          missing: missingCount,
        };
      }

      const typeCounts = {
        number: 0,
        boolean: 0,
        date: 0,
        string: 0,
      };

      for (const value of values) {
        if (typeof value === "number" && Number.isFinite(value)) {
          typeCounts.number++;
          continue;
        }

        if (typeof value === "boolean") {
          typeCounts.boolean++;
          continue;
        }

        if (typeof value === "string") {
          const trimmed = value.trim();

          if (
            trimmed !== "" &&
            Number.isFinite(Number(trimmed.replace(/,/g, "")))
          ) {
            typeCounts.number++;
            continue;
          }

          const parsedDate = new Date(trimmed);

          if (!Number.isNaN(parsedDate.getTime())) {
            typeCounts.date++;
            continue;
          }
        }

        typeCounts.string++;
      }

      const dominantType =
        Object.entries(typeCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ??
        "unknown";

      return {
        name: columnName,
        type: normalizeColumnType(dominantType),
        missing: missingCount,
      };
    });

    // ------------------------------------------------------------
    // Generate dataset profile
    // ------------------------------------------------------------

    const profile = profileDataset({
      fileName: parsedDataset.fileName,
      fileSize: file.size,
      rowCount: parsedDataset.rowCount,
      columnCount: parsedDataset.columnCount,
      columns: normalizedColumns,
      // The profiler now receives the complete dataset. The UI still receives
      // only previewRows below so large files are not sent to the browser.
      previewRows: parsedDataset.rows,
    });

    // ------------------------------------------------------------
    // Save dataset to PostgreSQL
    // ------------------------------------------------------------

    const savedDataset = await prisma.analystDataset.create({
      data: {
        userId: user.id,
        fileName: parsedDataset.fileName,
        fileSize: file.size,
        mimeType: file.type || null,

        rowCount: parsedDataset.rowCount,
        columnCount: parsedDataset.columnCount,

        columns: normalizedColumns,
        rows: JSON.parse(JSON.stringify(parsedDataset.rows)),
      },
    });

    // ------------------------------------------------------------
    // Return dataset + database ID
    // ------------------------------------------------------------

    // Analyze the complete parsed dataset on the server. Only the compact
    // analysis result and 20-row preview are returned to the browser.
    const analysis = analyzeDataset(parsedDataset.rows, normalizedColumns);

    return NextResponse.json({
      success: true,

      dataset: {
        id: savedDataset.id,
        fileName: savedDataset.fileName,
        fileSize: savedDataset.fileSize,
        mimeType: savedDataset.mimeType,
        rowCount: savedDataset.rowCount,
        columnCount: savedDataset.columnCount,
        columns: savedDataset.columns,
        previewRows,
      },

      profile,
      analysis,
    });
  } catch (error) {
    console.error("Dataset upload error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to process the dataset.",
      },
      { status: 500 },
    );
  }
}
