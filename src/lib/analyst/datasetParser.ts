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

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    worksheet,
    {
      defval: null,
      raw: true,
    }
  );

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

function getColumns(rows: Record<string, unknown>[]): string[] {
  const columnSet = new Set<string>();

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      columnSet.add(key);
    }
  }

  return Array.from(columnSet);
}