import * as XLSX from "xlsx";

export type ParsedDataset = {
  fileName: string;
  sheetName: string;
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  columnCount: number;
};

export function parseDataset(
  buffer: Buffer,
  fileName: string
): ParsedDataset {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
  });

  if (!workbook.SheetNames.length) {
    throw new Error("The uploaded file does not contain any sheets.");
  }

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error("Unable to read the first worksheet.");
  }

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    worksheet,
    {
      defval: null,
      raw: true,
    }
  );

  // Normalize Excel date values before returning/storing the dataset.
  // This prevents dates such as 2026-01-05 from becoming
  // 2026-01-04T18:30:00.000Z.
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

  // Excel dates are represented as JavaScript Date objects.
  // Use the local calendar representation rather than allowing
  // JSON serialization to shift the date into the previous day.
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getColumns(rows: Record<string, unknown>[]): string[] {
  const columnSet = new Set<string>();

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      columnSet.add(key);
    }
  }

  return Array.from(columnSet);
}