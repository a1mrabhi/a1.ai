import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
      const sampleValue = parsedDataset.rows.find(
        (row) =>
          row[columnName] !== null &&
          row[columnName] !== undefined,
      )?.[columnName];

      const missingCount = parsedDataset.rows.filter(
        (row) =>
          row[columnName] === null ||
          row[columnName] === undefined,
      ).length;

      return {
        name: columnName,
        type: normalizeColumnType(
          sampleValue === undefined
            ? "unknown"
            : typeof sampleValue,
        ),
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
      previewRows,
    });

    // ------------------------------------------------------------
    // Save dataset to PostgreSQL
    // ------------------------------------------------------------

    const savedDataset = await prisma.analystDataset.create({
      data: {
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
  previewRows: parsedDataset.rows.slice(0, 20),
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