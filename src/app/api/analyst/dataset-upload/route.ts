import { NextResponse } from "next/server";
import { parseDataset } from "@/lib/analyst/datasetParser";
import { profileDataset } from "@/lib/analyst/datasetProfiler";
import { normalizeColumnType } from "@/lib/analyst/analystTypes";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_EXTENSIONS = [".csv", ".xls", ".xlsx"];

export async function POST(request: Request) {
  try {
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
    const extension = ALLOWED_EXTENSIONS.find((ext) =>
      fileName.endsWith(ext),
    );

    if (!extension) {
      return NextResponse.json(
        {
          success: false,
          error: "Unsupported file type. Please upload CSV, XLS, or XLSX.",
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

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const dataset = parseDataset(buffer, file.name);

    if (dataset.rowCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "The uploaded dataset is empty.",
        },
        { status: 400 },
      );
    }

    if (dataset.columnCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No columns were detected in the dataset.",
        },
        { status: 400 },
      );
    }

    const previewRows = dataset.rows.slice(0, 20);

    const normalizedColumns = dataset.columns.map((columnName) => {
  const sampleValue = dataset.rows.find(
    (row) => row[columnName] !== null && row[columnName] !== undefined
  )?.[columnName];

  const missingCount = dataset.rows.filter(
    (row) => row[columnName] === null || row[columnName] === undefined
  ).length;

  return {
    name: columnName,
    type: normalizeColumnType(
      sampleValue === undefined ? "unknown" : typeof sampleValue
    ),
    missing: missingCount,
  };
});

    const profile = profileDataset({
      fileName: dataset.fileName,
      fileSize: file.size,
      rowCount: dataset.rowCount,
      columnCount: dataset.columnCount,
      columns: normalizedColumns,
      previewRows,
    });

    return NextResponse.json({
      success: true,
      dataset: {
        fileName: dataset.fileName,
        sheetName: dataset.sheetName,
        rowCount: dataset.rowCount,
        columnCount: dataset.columnCount,
        columns: normalizedColumns,
        previewRows,
      },
      profile,
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