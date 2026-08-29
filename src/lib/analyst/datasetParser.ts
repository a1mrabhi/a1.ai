import * as XLSX from "xlsx";

export type ParsedDataset = {
  fileName: string;
  sheetName: string;
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  columnCount: number;
};

function parseJsonDataset(
  buffer: Buffer,
  fileName: string,
): ParsedDataset {
  let parsed: unknown;

  try {
    parsed = JSON.parse(buffer.toString("utf-8"));
  } catch {
    throw new Error("The uploaded JSON file is not valid JSON.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error(
      "JSON datasets must contain an array of records.",
    );
  }

  const rows: Record<string, unknown>[] = parsed.map((item, index) => {
    if (
      typeof item !== "object" ||
      item === null ||
      Array.isArray(item)
    ) {
      throw new Error(
        `JSON record ${index + 1} must be an object.`,
      );
    }

    return item as Record<string, unknown>;
  });

  const columns = getColumns(rows);

  return {
    fileName,
    sheetName: "JSON",
    columns,
    rows,
    rowCount: rows.length,
    columnCount: columns.length,
  };
}

export function parseDataset(
  buffer: Buffer,
  fileName: string,
): ParsedDataset {
  const extension = fileName.toLowerCase().split(".").pop();

  if (extension === "json") {
    return parseJsonDataset(buffer, fileName);
  }

  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
  });

  if (!workbook.SheetNames.length) {
    throw new Error(
      "The uploaded file does not contain any sheets.",
    );
  }

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error(
      "Unable to read the first worksheet.",
    );
  }

  const rawRows = XLSX.utils.sheet_to_json<
    Record<string, unknown>
  >(worksheet, {
    defval: null,
    raw: true,
  });

  const rows = rawRows.map((row) => {
    const normalizedRow: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(row)) {
      normalizedRow[key] = normalizeCellValue(value);
    }

    return normalizedRow;
  });

  const columns = getColumns(rows);

  return {
    fileName,
    sheetName,
    columns,
    rows,
    rowCount: rows.length,
    columnCount: columns.length,
  };
}

function normalizeCellValue(value: unknown): unknown {
  if (!(value instanceof Date)) {
    return value;
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getColumns(
  rows: Record<string, unknown>[],
): string[] {
  const columnSet = new Set<string>();

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      columnSet.add(key);
    }
  }

  return Array.from(columnSet);
}