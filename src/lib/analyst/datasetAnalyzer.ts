import type { DatasetColumn } from "@/lib/analyst/analystTypes";

export type NumericColumnStats = {
  column: string;
  count: number;
  missing: number;
  sum: number;
  average: number;
  min: number;
  max: number;
  median: number;
};

export type CategoricalColumnStats = {
  column: string;
  count: number;
  missing: number;
  unique: number;
  topValues: {
    value: string;
    count: number;
  }[];
};

export type DatasetAnalysis = {
  rowCount: number;
  columnCount: number;

  numericStats: NumericColumnStats[];

  categoricalStats: CategoricalColumnStats[];

  missingValues: {
    column: string;
    count: number;
    percentage: number;
  }[];
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const cleaned = value.replace(/,/g, "").trim();
    const parsed = Number(cleaned);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function isMissing(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  );
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);

  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

export function analyzeDataset(
  rows: Record<string, unknown>[],
  columns: DatasetColumn[],
): DatasetAnalysis {
  const numericStats: NumericColumnStats[] = [];
  const categoricalStats: CategoricalColumnStats[] = [];

  const missingValues = columns.map((column) => {
    const missing = rows.filter((row) =>
      isMissing(row[column.name]),
    ).length;

    return {
      column: column.name,
      count: missing,
      percentage:
        rows.length === 0
          ? 0
          : round((missing / rows.length) * 100),
    };
  });

  for (const column of columns) {
    const values = rows.map((row) => row[column.name]);

    /*
     * Numeric columns
     */
    if (column.type === "number") {
      const numbers = values
        .map(toNumber)
        .filter((value): value is number => value !== null);

      if (numbers.length === 0) continue;

      const sum = numbers.reduce(
        (total, value) => total + value,
        0,
      );

      numericStats.push({
        column: column.name,
        count: numbers.length,
        missing: values.length - numbers.length,
        sum: round(sum),
        average: round(sum / numbers.length),
        min: Math.min(...numbers),
        max: Math.max(...numbers),
        median: round(calculateMedian(numbers)),
      });

      continue;
    }

    /*
     * String / categorical columns
     */
    if (
      column.type === "string" ||
      column.type === "boolean"
    ) {
      const frequencyMap = new Map<string, number>();

      let count = 0;
      let missing = 0;

      for (const value of values) {
        if (isMissing(value)) {
          missing++;
          continue;
        }

        const normalized = String(value).trim();

        frequencyMap.set(
          normalized,
          (frequencyMap.get(normalized) ?? 0) + 1,
        );

        count++;
      }

      const topValues = [...frequencyMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([value, count]) => ({
          value,
          count,
        }));

      categoricalStats.push({
        column: column.name,
        count,
        missing,
        unique: frequencyMap.size,
        topValues,
      });
    }
  }

  return {
    rowCount: rows.length,
    columnCount: columns.length,
    numericStats,
    categoricalStats,
    missingValues,
  };
}