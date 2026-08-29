import type {
  DatasetColumn,
  DatasetAnalysis,
  NumericColumnStats,
  CategoricalColumnStats,
  DateColumnStats,
  DatasetOutlier,
  DatasetCorrelation,
  DatasetTrend,
  DatasetDuplicateStats,
  DatasetQuality,
  DatasetQualityIssue,
} from "@/lib/analyst/analystTypes";

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string" && value.trim() !== "") {
    const cleaned = value
      .replace(/,/g, "")
      .replace(/^\s*[$€£₹]\s*/, "")
      .replace(/\s*%\s*$/, "")
      .trim();

    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
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

function toDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  if (typeof value !== "string" && typeof value !== "number") return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function round(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function percentile(sortedValues: number[], percentileValue: number): number {
  if (!sortedValues.length) return 0;

  const index = (sortedValues.length - 1) * percentileValue;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) return sortedValues[lower];

  const weight = index - lower;
  return (
    sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * weight
  );
}

function standardDeviation(values: number[], average: number): number {
  if (values.length < 2) return 0;

  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
    values.length;

  return Math.sqrt(variance);
}

function correlation(first: number[], second: number[]): number | null {
  if (first.length !== second.length || first.length < 2) return null;

  const firstMean = first.reduce((a, b) => a + b, 0) / first.length;
  const secondMean = second.reduce((a, b) => a + b, 0) / second.length;

  let numerator = 0;
  let firstVariance = 0;
  let secondVariance = 0;

  for (let i = 0; i < first.length; i++) {
    const a = first[i] - firstMean;
    const b = second[i] - secondMean;

    numerator += a * b;
    firstVariance += a ** 2;
    secondVariance += b ** 2;
  }

  const denominator = Math.sqrt(firstVariance * secondVariance);
  if (denominator === 0) return null;

  return numerator / denominator;
}

function correlationStrength(value: number): DatasetCorrelation["strength"] {
  const absolute = Math.abs(value);

  if (absolute >= 0.8) return "very-strong";
  if (absolute >= 0.6) return "strong";
  if (absolute >= 0.4) return "moderate";
  if (absolute >= 0.2) return "weak";
  return "very-weak";
}

function trendDirection(
  first: number,
  last: number,
): DatasetTrend["direction"] {
  if (!Number.isFinite(first) || !Number.isFinite(last)) {
    return "insufficient-data";
  }

  const baseline = Math.abs(first);

  if (baseline === 0) {
    if (last === 0) return "stable";
    return last > 0 ? "increasing" : "decreasing";
  }

  const change = (last - first) / baseline;

  if (Math.abs(change) < 0.05) return "stable";
  return change > 0 ? "increasing" : "decreasing";
}

function datePeriod(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function serializeRow(
  row: Record<string, unknown>,
  columns: DatasetColumn[],
): string {
  return columns
    .map((column) => `${column.name}:${String(row[column.name] ?? "")}`)
    .join("\u001f");
}

function isNumericColumn(column: DatasetColumn): boolean {
  return column.type === "number";
}

function isCategoricalColumn(column: DatasetColumn): boolean {
  return column.type === "string" || column.type === "boolean";
}

function isDateColumn(column: DatasetColumn): boolean {
  return column.type === "date";
}

export function analyzeDataset(
  rows: Record<string, unknown>[],
  columns: DatasetColumn[],
): DatasetAnalysis {
  const numericStats: NumericColumnStats[] = [];
  const categoricalStats: CategoricalColumnStats[] = [];
  const dateStats: DateColumnStats[] = [];
  const outliers: DatasetOutlier[] = [];
  const correlations: DatasetCorrelation[] = [];
  const trends: DatasetTrend[] = [];

  const missingValues = columns.map((column) => {
    const missing = rows.reduce(
      (count, row) => count + (isMissing(row[column.name]) ? 1 : 0),
      0,
    );

    return {
      column: column.name,
      count: missing,
      percentage: rows.length ? round((missing / rows.length) * 100) : 0,
    };
  });

  /*
   * Numeric columns
   * Statistics are calculated from every supplied row. The caller should
   * provide the complete parsed dataset, not the UI preview.
   */
  for (const column of columns.filter(isNumericColumn)) {
    const values = rows.map((row) => row[column.name]);
    const numbers = values
      .map(toNumber)
      .filter((value): value is number => value !== null);

    if (!numbers.length) continue;

    const sum = numbers.reduce((total, value) => total + value, 0);
    const average = sum / numbers.length;
    const sorted = [...numbers].sort((a, b) => a - b);
    const q1 = percentile(sorted, 0.25);
    const q3 = percentile(sorted, 0.75);
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    const deviation = standardDeviation(numbers, average);

    let outlierCount = 0;

    numbers.forEach((value) => {
      if (value < lowerBound || value > upperBound) outlierCount++;
    });

    rows.forEach((row, rowIndex) => {
      const value = toNumber(row[column.name]);
      if (value === null) return;

      if (value < lowerBound || value > upperBound) {
        outliers.push({
          rowIndex,
          column: column.name,
          value: round(value),
          method: "iqr",
          lowerBound: round(lowerBound),
          upperBound: round(upperBound),
        });
      }
    });

    numericStats.push({
      column: column.name,
      count: numbers.length,
      missing: values.length - numbers.length,
      sum: round(sum),
      average: round(average),
      min: round(Math.min(...numbers)),
      max: round(Math.max(...numbers)),
      median: round(median(numbers)),
      q1: round(q1),
      q3: round(q3),
      iqr: round(iqr),
      standardDeviation: round(deviation),
      outlierCount,
    });
  }

  /*
   * Categorical columns
   */
  for (const column of columns.filter(isCategoricalColumn)) {
    const frequencyMap = new Map<string, number>();
    let count = 0;
    let missing = 0;

    for (const row of rows) {
      const value = row[column.name];

      if (isMissing(value)) {
        missing++;
        continue;
      }

      const normalized = String(value).trim();
      frequencyMap.set(normalized, (frequencyMap.get(normalized) ?? 0) + 1);
      count++;
    }

    const toCategoryValue = ([value, valueCount]: [string, number]) => ({
      value,
      count: valueCount,
      percentage: count ? round((valueCount / count) * 100) : 0,
    });

    const sortedValues = [...frequencyMap.entries()].sort(
      (a, b) => b[1] - a[1],
    );

    const topValues = sortedValues.slice(0, 10).map(toCategoryValue);

    const rareValues = sortedValues
      .filter(([, valueCount]) => valueCount === 1)
      .slice(0, 10)
      .map(toCategoryValue);

    categoricalStats.push({
      column: column.name,
      count,
      missing,
      unique: frequencyMap.size,
      topValues,
      rareValues,
    });
  }

  /*
   * Date columns
   */
  for (const column of columns.filter(isDateColumn)) {
    const dates: Date[] = [];
    let missing = 0;

    for (const row of rows) {
      const value = row[column.name];

      if (isMissing(value)) {
        missing++;
        continue;
      }

      const parsed = toDate(value);

      if (parsed) dates.push(parsed);
      else missing++;
    }

    if (!dates.length) continue;

    dates.sort((a, b) => a.getTime() - b.getTime());

    const periodMap = new Map<string, number>();

    for (const date of dates) {
      const period = datePeriod(date);
      periodMap.set(period, (periodMap.get(period) ?? 0) + 1);
    }

    dateStats.push({
      column: column.name,
      count: dates.length,
      missing,
      earliest: dates[0].toISOString().slice(0, 10),
      latest: dates[dates.length - 1].toISOString().slice(0, 10),
      uniqueDates: new Set(dates.map((date) => date.toISOString().slice(0, 10)))
        .size,
      recordsByPeriod: [...periodMap.entries()].map(([period, count]) => ({
        period,
        count,
      })),
    });
  }

  /*
   * Numeric relationships
   * Only pairs with enough complete observations are compared.
   */
  const numericColumns = columns.filter(isNumericColumn);

  for (let i = 0; i < numericColumns.length; i++) {
    for (let j = i + 1; j < numericColumns.length; j++) {
      const first: number[] = [];
      const second: number[] = [];

      for (const row of rows) {
        const a = toNumber(row[numericColumns[i].name]);
        const b = toNumber(row[numericColumns[j].name]);

        if (a !== null && b !== null) {
          first.push(a);
          second.push(b);
        }
      }

      const coefficient = correlation(first, second);
      if (coefficient === null) continue;

      const roundedCoefficient = round(coefficient, 3);

      correlations.push({
        columnA: numericColumns[i].name,
        columnB: numericColumns[j].name,
        coefficient: roundedCoefficient,
        strength: correlationStrength(coefficient),
        direction:
          Math.abs(coefficient) < 0.2
            ? "none"
            : coefficient > 0
              ? "positive"
              : "negative",
      });
    }
  }

  /*
   * Date + numeric trends
   * Values are averaged by month so this remains generic across domains.
   */
  for (const dateColumn of columns.filter(isDateColumn)) {
    for (const numericColumn of numericColumns) {
      const periodValues = new Map<string, number[]>();

      for (const row of rows) {
        const date = toDate(row[dateColumn.name]);
        const value = toNumber(row[numericColumn.name]);

        if (!date || value === null) continue;

        const period = datePeriod(date);
        const current = periodValues.get(period) ?? [];
        current.push(value);
        periodValues.set(period, current);
      }

      const periods = [...periodValues.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, values]) => ({
          period,
          value: round(
            values.reduce((sum, value) => sum + value, 0) / values.length,
          ),
        }));

      if (periods.length < 2) {
        trends.push({
          dateColumn: dateColumn.name,
          valueColumn: numericColumn.name,
          direction: "insufficient-data",
          periods,
        });
        continue;
      }

      const firstValue = periods[0].value;
      const lastValue = periods[periods.length - 1].value;

      trends.push({
        dateColumn: dateColumn.name,
        valueColumn: numericColumn.name,
        direction: trendDirection(firstValue, lastValue),
        changePercentage:
          firstValue === 0
            ? undefined
            : round(((lastValue - firstValue) / Math.abs(firstValue)) * 100),
        periods,
      });
    }
  }

  /*
   * Duplicate rows
   */
  const duplicateMap = new Map<string, number>();

  for (const row of rows) {
    const key = serializeRow(row, columns);
    duplicateMap.set(key, (duplicateMap.get(key) ?? 0) + 1);
  }

  const duplicateGroups = [...duplicateMap.values()].filter(
    (count) => count > 1,
  );

  const duplicateRows = duplicateGroups.reduce(
    (total, count) => total + count - 1,
    0,
  );

  const duplicates: DatasetDuplicateStats = {
    duplicateRows,
    duplicateGroups: duplicateGroups.length,
  };

  /*
   * Data-quality issues
   */
  const issues: DatasetQualityIssue[] = [];

  for (const missing of missingValues) {
    if (missing.count > 0) {
      issues.push({
        type: "missing-values",
        column: missing.column,
        count: missing.count,
        percentage: missing.percentage,
        message: `${missing.column} has ${missing.count} missing value${missing.count === 1 ? "" : "s"}.`,
      });
    }
  }

  for (const stat of numericStats) {
    if (stat.count > 0 && stat.count === stat.outlierCount) continue;

    if (stat.outlierCount > 0) {
      issues.push({
        type: "outliers",
        column: stat.column,
        count: stat.outlierCount,
        percentage: round((stat.outlierCount / stat.count) * 100),
        message: `${stat.column} contains ${stat.outlierCount} statistical outlier${stat.outlierCount === 1 ? "" : "s"}.`,
      });
    }

    if (stat.min === stat.max) {
      issues.push({
        type: "constant-column",
        column: stat.column,
        count: stat.count,
        percentage: 100,
        message: `${stat.column} contains the same value in every non-missing record.`,
      });
    }
  }

  if (duplicateRows > 0) {
    issues.push({
      type: "duplicate-rows",
      count: duplicateRows,
      percentage: rows.length ? round((duplicateRows / rows.length) * 100) : 0,
      message: `${duplicateRows} duplicate row${duplicateRows === 1 ? "" : "s"} detected.`,
    });
  }

  for (const column of columns) {
    const missing = missingValues.find((item) => item.column === column.name);
    if (!missing || rows.length === 0) continue;

    if (missing.percentage >= 50) {
      issues.push({
        type: "mostly-empty-column",
        column: column.name,
        count: missing.count,
        percentage: missing.percentage,
        message: `${column.name} is missing values in at least half of the records.`,
      });
    }
  }

  const missingCells = missingValues.reduce(
    (total, item) => total + item.count,
    0,
  );

  const quality: DatasetQuality = {
    missingCells,
    duplicateRows,
    issues,
    status: issues.length ? "needs-attention" : "healthy",
  };

  return {
    rowCount: rows.length,
    columnCount: columns.length,
    numericStats,
    categoricalStats,
    dateStats,
    missingValues,
    outliers,
    correlations,
    trends,
    duplicates,
    quality,
  };
}
