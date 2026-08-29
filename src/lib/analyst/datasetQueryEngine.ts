import type { DatasetColumn } from "@/lib/analyst/analystTypes";

export type QueryOperator =
  | "="
  | "!="
  | ">"
  | ">="
  | "<"
  | "<="
  | "contains"
  | "startsWith"
  | "endsWith"
  | "before"
  | "after"
  | "on"
  | "between";

export type QueryFilter = {
  column: string;
  operator: QueryOperator;
  value: string | number | boolean | null;
  secondValue?: string | number | boolean | null;
};

export type QueryPlan = {
  operation:
    | "count"
    | "sum"
    | "average"
    | "min"
    | "max"
    | "median"
    | "distinct"
    | "group_count"
    | "group_sum"
    | "group_average"
    | "top"
    | "bottom"
    | "percentage"
    | "missing"
    | "describe"
    | "correlation"
    | "rows"
    | "trend"
    | "formula_check"
    | "outliers"
    | "patterns";
  targetColumn?: string;
  groupBy?: string;
  dateColumn?: string;
  trendPeriod?: "day" | "week" | "month" | "quarter" | "year";
  /**
   * How to aggregate the numeric target within each trend bucket.
   * Defaults to "average" for backward compatibility, but the planner
   * should choose "sum" for questions like "total X by year" / "compare
   * total X by year", and "count" for "how many records per month" style
   * questions.
   */
  trendAggregation?: "sum" | "average" | "count";
  filters?: QueryFilter[];
  secondColumn?: string;
  /** Used by formula_check: the third operand column, e.g. Unit_Value in Quantity * Unit_Value. */
  thirdColumn?: string;
  /** Used by formula_check: how secondColumn and thirdColumn combine before comparing to targetColumn. */
  formulaOperator?: "multiply" | "add" | "subtract" | "divide";
  /** Used by formula_check: allowed absolute difference before flagging a mismatch. Defaults to 0.01. */
  tolerance?: number;
  limit?: number;
};

export type QueryExecution = {
  plan: QueryPlan;
  matchedRows: number;
  result: unknown;
  answer: string;
};

const ALL_OPERATIONS: QueryPlan["operation"][] = [
  "count",
  "sum",
  "average",
  "min",
  "max",
  "median",
  "distinct",
  "group_count",
  "group_sum",
  "group_average",
  "top",
  "bottom",
  "percentage",
  "missing",
  "describe",
  "correlation",
  "rows",
  "trend",
  "formula_check",
  "outliers",
  "patterns",
];

function isMissing(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  );
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const date = new Date(value.trim());
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function comparableText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function valuesEqual(actual: unknown, expected: unknown): boolean {
  const actualNumber = toNumber(actual);
  const expectedNumber = toNumber(expected);

  if (actualNumber !== null && expectedNumber !== null) {
    return actualNumber === expectedNumber;
  }

  return comparableText(actual) === comparableText(expected);
}

function passesFilter(
  row: Record<string, unknown>,
  filter: QueryFilter,
): boolean {
  const actual = row[filter.column];
  const expected = filter.value;

  if (filter.operator === "=" || filter.operator === "on") {
    return valuesEqual(actual, expected);
  }

  if (filter.operator === "!=") {
    return !valuesEqual(actual, expected);
  }

  if (filter.operator === "contains") {
    return comparableText(actual).includes(comparableText(expected));
  }

  if (filter.operator === "startsWith") {
    return comparableText(actual).startsWith(comparableText(expected));
  }

  if (filter.operator === "endsWith") {
    return comparableText(actual).endsWith(comparableText(expected));
  }

  if (["before", "after", "between"].includes(filter.operator)) {
    const actualDate = toDate(actual);
    const firstDate = toDate(expected);
    const secondDate = toDate(filter.secondValue);

    if (!actualDate || !firstDate) return false;

    if (filter.operator === "before") return actualDate < firstDate;
    if (filter.operator === "after") return actualDate > firstDate;

    return Boolean(
      secondDate && actualDate >= firstDate && actualDate <= secondDate,
    );
  }

  const actualNumber = toNumber(actual);
  const expectedNumber = toNumber(expected);

  if (actualNumber === null || expectedNumber === null) return false;

  switch (filter.operator) {
    case ">":
      return actualNumber > expectedNumber;
    case ">=":
      return actualNumber >= expectedNumber;
    case "<":
      return actualNumber < expectedNumber;
    case "<=":
      return actualNumber <= expectedNumber;
    default:
      return false;
  }
}

function applyFilters(
  rows: Record<string, unknown>[],
  filters: QueryFilter[] = [],
): Record<string, unknown>[] {
  if (!filters.length) return rows;

  return rows.filter((row) =>
    filters.every((filter) => passesFilter(row, filter)),
  );
}

function numericValues(
  rows: Record<string, unknown>[],
  column: string,
): number[] {
  return rows
    .map((row) => toNumber(row[column]))
    .filter((value): value is number => value !== null);
}

function median(values: number[]): number {
  if (!values.length) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatNumber(value: number): string {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

function formatValue(value: unknown): string {
  if (typeof value === "number") return formatNumber(value);
  return String(value);
}

/**
 * Linear-interpolation quartiles (same convention as Excel's QUARTILE.INC).
 * `values` must already be sorted ascending.
 */
function quartiles(values: number[]): { q1: number; q3: number } {
  if (!values.length) return { q1: 0, q3: 0 };

  const interpolate = (idx: number): number => {
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    if (lower === upper) return values[lower];
    return values[lower] + (values[upper] - values[lower]) * (idx - lower);
  };

  const n = values.length;
  return {
    q1: interpolate((n - 1) * 0.25),
    q3: interpolate((n - 1) * 0.75),
  };
}

type ColumnProfile = {
  column: DatasetColumn;
  nonMissing: unknown[];
  missingCount: number;
  kind: "numeric" | "date" | "categorical";
};

/**
 * Empirically classify each column as numeric, date, or categorical by
 * sampling how its values actually parse, rather than trusting a possibly
 * stale `column.type` label alone. Shared by describe, outliers, and
 * patterns so all three agree on what counts as "numeric".
 */
function profileColumns(
  rows: Record<string, unknown>[],
  columns: DatasetColumn[],
): ColumnProfile[] {
  const totalRows = rows.length;

  return columns.map((column) => {
    const values = rows.map((row) => row[column.name]);
    const nonMissing = values.filter((value) => !isMissing(value));
    const missingCount =
      typeof column.missing === "number"
        ? column.missing
        : totalRows - nonMissing.length;

    const numericCount = nonMissing.filter(
      (value) => toNumber(value) !== null,
    ).length;
    const dateCount = nonMissing.filter(
      (value) => toDate(value) !== null,
    ).length;

    const isNumeric =
      nonMissing.length > 0 && numericCount / nonMissing.length >= 0.9;
    const isDate =
      !isNumeric &&
      nonMissing.length > 0 &&
      dateCount / nonMissing.length >= 0.9 &&
      typeof nonMissing[0] === "string" &&
      /\d{4}-\d{2}-\d{2}/.test(String(nonMissing[0]));

    const kind: "numeric" | "date" | "categorical" = isNumeric
      ? "numeric"
      : isDate
        ? "date"
        : "categorical";

    return { column, nonMissing, missingCount, kind };
  });
}

function pearsonCorrelation(
  rows: Record<string, unknown>[],
  columnA: string,
  columnB: string,
): number | null {
  const pairs = rows
    .map((row) => ({ x: toNumber(row[columnA]), y: toNumber(row[columnB]) }))
    .filter(
      (pair): pair is { x: number; y: number } =>
        pair.x !== null && pair.y !== null,
    );

  if (pairs.length < 2) return null;

  const xMean = pairs.reduce((sum, pair) => sum + pair.x, 0) / pairs.length;
  const yMean = pairs.reduce((sum, pair) => sum + pair.y, 0) / pairs.length;

  let numerator = 0;
  let xDenominator = 0;
  let yDenominator = 0;

  for (const pair of pairs) {
    const xDiff = pair.x - xMean;
    const yDiff = pair.y - yMean;

    numerator += xDiff * yDiff;
    xDenominator += xDiff ** 2;
    yDenominator += yDiff ** 2;
  }

  const denominator = Math.sqrt(xDenominator * yDenominator);
  return denominator === 0 ? 0 : numerator / denominator;
}

function normalizeColumnName(
  requested: string,
  columns: DatasetColumn[],
): string | null {
  const normalize = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "");

  const target = normalize(requested);

  return (
    columns.find((column) => normalize(column.name) === target)?.name ?? null
  );
}

function validatePlan(
  plan: QueryPlan,
  columns: DatasetColumn[],
): QueryPlan {
  if (!ALL_OPERATIONS.includes(plan.operation)) {
    throw new Error("The requested analysis operation is not supported.");
  }

  const resolve = (name: string | undefined): string | undefined => {
    if (!name) return undefined;

    const resolved = normalizeColumnName(name, columns);

    if (!resolved) {
      throw new Error(`Column "${name}" was not found in the dataset.`);
    }

    return resolved;
  };

  const filters = (plan.filters ?? []).map((filter) => {
    const column = resolve(filter.column);

    if (!column) {
      throw new Error("A filter is missing its column.");
    }

    return {
      ...filter,
      column,
    };
  });

  const limit =
    typeof plan.limit === "number" && Number.isFinite(plan.limit)
      ? Math.max(1, Math.min(Math.floor(plan.limit), 100))
      : 10;

  return {
    ...plan,
    targetColumn: resolve(plan.targetColumn),
    groupBy: resolve(plan.groupBy),
    dateColumn: resolve(plan.dateColumn),
    secondColumn: resolve(plan.secondColumn),
    thirdColumn: resolve(plan.thirdColumn),
    filters,
    limit,
  };
}



function extractJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start === -1 || end <= start) {
      throw new Error("The AI query planner returned invalid JSON.");
    }

    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

function isQueryPlan(value: unknown): value is QueryPlan {
  if (typeof value !== "object" || value === null) return false;

  const operation = (value as { operation?: unknown }).operation;

  return (
    typeof operation === "string" &&
    ALL_OPERATIONS.includes(operation as QueryPlan["operation"])
  );
}

/**
 * Convert a natural-language question into a safe query plan.
 * Gemini receives only the schema and compact statistics — never raw rows.
 */
export async function createQueryPlan(
  question: string,
  columns: DatasetColumn[],
  _analysis?: unknown,
): Promise<QueryPlan> {
  // Query planning only needs the dataset schema. Keeping the planner input
  // schema-only guarantees that even a very large analysis object cannot
  // accidentally become another large Gemini prompt.
  const schema = JSON.stringify(
    {
      columns: columns.map((column) => ({
        name: column.name,
        type: column.type,
        missing: column.missing,
      })),
    },
    null,
    2,
  );

  const { generateWithGemini } = await import("@/lib/ai/gemini");

  const prompt = `
You are the query planner for A1.ai.

Convert the user's natural-language question into ONE deterministic JSON
query plan. Do not answer the question yourself. The server will execute the
plan against the complete dataset.

The raw dataset rows are NOT available to you and must never be requested.

Allowed operations:
count, sum, average, min, max, median, distinct,
group_count, group_sum, group_average, top, bottom, percentage,
missing, describe, correlation, rows, trend, formula_check,
outliers, patterns.

Allowed filter operators:
=, !=, >, >=, <, <=, contains, startsWith, endsWith, before, after, on, between.

JSON shape:
{
  "operation": "count",
  "targetColumn": "ColumnName",
  "groupBy": "ColumnName",
  "dateColumn": "DateColumn",
  "secondColumn": "OtherNumericColumn",
  "thirdColumn": "AnotherNumericColumn",
  "formulaOperator": "multiply|add|subtract|divide",
  "tolerance": 0.01,
  "trendPeriod": "day|week|month|quarter|year",
  "trendAggregation": "sum|average|count",
  "filters": [
    {
      "column": "ColumnName",
      "operator": ">",
      "value": 90,
      "secondValue": null
    }
  ],
  "limit": 10
}

Rules:
- Output ONLY valid JSON.
- Use exact column names from the schema.
- Never invent a column.
- "how many", "count", "number of records" => count.
- "total", "sum" => sum.
- "average", "mean" => average.
- "highest", "maximum" => max for a value; top for records.
- "lowest", "minimum" => min for a value; bottom for records.
- "top 10" => top with limit 10.
- "bottom 10" => bottom with limit 10.
- "average by X" => group_average.
- "total by X" => group_sum.
- "most common" / "most frequent" => group_count.
- "percentage", "percent", "share" => percentage.
- "missing", "blank", "empty" => missing.
- "unique", "distinct" => distinct.
- "correlation", "relationship" => correlation.
- "show/list/which records" => rows with a limit no greater than 20.
- "trend", "over time", "by month", "by year" => trend when a date and
  numeric column are available.
- For trend: if the question asks to "compare totals", "total X by year",
  "sum by month", etc, set trendAggregation="sum". If it asks for
  "average X over time" or does not specify, set trendAggregation="average".
  If it just asks "how many records per month", set trendAggregation="count".
- "is X equal to Y times/plus/minus/divided by Z", "does X match Y * Z",
  "verify/check/validate that X = Y * Z" => formula_check, with
  targetColumn=X, secondColumn=Y, thirdColumn=Z, and formulaOperator set to
  multiply/add/subtract/divide based on the wording (default multiply).
- "give me an overview", "summarize the dataset", "describe the data",
  "tell me about this dataset" => describe (no filters, no target column).
  The server will compute the full statistical summary; you only need to
  return { "operation": "describe" }.
- "find anomalies", "find outliers", "weird values", "unusual values",
  "anything look off/wrong" (with NO specific formula implied) => outliers.
  Leave targetColumn empty to check every numeric column, or set it to check
  just one. Do NOT use formula_check for this — formula_check is only for
  verifying a named relationship like "X = Y * Z".
- "find patterns", "find insights", "what stands out", "tell me something
  interesting", "summarize the trends/relationships" => patterns (no filters,
  no target column). The server synthesizes correlations, the most skewed
  category, a trend, and missing-data hotspots into one narrative; you only
  need to return { "operation": "patterns" }.
- "verify/check/validate that X = Y * Z" (a specific named formula) =>
  formula_check, not outliers.
- "above 90" => > 90.
- "at least 90" => >= 90.
- "below 90" => < 90.
- "at most 90" => <= 90.
- "equal to 90" => = 90.
- Multiple conditions must ALL appear in filters.
- If the user says "in West", "from West", or "West region" and a Region
  column exists, use Region = "West".
- For "which department has the highest average Performance_Score", use
  group_average with groupBy=Department, targetColumn=Performance_Score,
  limit=1.
- Do not use summary statistics as a substitute for a filtered calculation.

DATASET SCHEMA:
${schema}
`;

  const response = await generateWithGemini([
    { role: "system", content: prompt },
    { role: "user", content: question },
  ]);

  const parsed = extractJson(response);

  if (!isQueryPlan(parsed)) {
    throw new Error("A1.ai could not create a valid query plan.");
  }

  return parsed;
}

export function executeQueryPlan(
  rawPlan: QueryPlan,
  rows: Record<string, unknown>[],
  columns: DatasetColumn[],
): QueryExecution {
  const plan = validatePlan(rawPlan, columns);
  const filteredRows = applyFilters(rows, plan.filters);
  const target = plan.targetColumn;

  if (
    ["sum", "average", "min", "max", "median", "top", "bottom"].includes(
      plan.operation,
    ) &&
    !target
  ) {
    throw new Error(
      `The ${plan.operation} operation requires a target column.`,
    );
  }

  if (
    ["group_count", "group_sum", "group_average"].includes(plan.operation) &&
    (!plan.groupBy || (plan.operation !== "group_count" && !target))
  ) {
    throw new Error("The grouped analysis requires the correct columns.");
  }

  if (
    plan.operation === "formula_check" &&
    (!target || !plan.secondColumn || !plan.thirdColumn)
  ) {
    throw new Error(
      "Formula check requires a target column and two operand columns.",
    );
  }

  switch (plan.operation) {
    case "count": {
      return {
        plan,
        matchedRows: filteredRows.length,
        result: { count: filteredRows.length },
        answer: `${formatNumber(
          filteredRows.length,
        )} records match the requested criteria.`,
      };
    }

    case "sum": {
      const values = numericValues(filteredRows, target!);
      const sum = values.reduce((total, value) => total + value, 0);

      return {
        plan,
        matchedRows: filteredRows.length,
        result: { column: target, count: values.length, sum: round(sum) },
        answer: `The total of **${target}** is **${formatNumber(sum)}**.`,
      };
    }

    case "average": {
      const values = numericValues(filteredRows, target!);
      const average = values.length
        ? values.reduce((total, value) => total + value, 0) / values.length
        : 0;

      return {
        plan,
        matchedRows: filteredRows.length,
        result: {
          column: target,
          count: values.length,
          average: round(average),
        },
        answer: values.length
          ? `The average **${target}** is **${formatNumber(average)}**.`
          : `There are no numeric **${target}** values in the matching records.`,
      };
    }

    case "min":
    case "max":
    case "median": {
      const values = numericValues(filteredRows, target!);

      if (!values.length) {
        return {
          plan,
          matchedRows: filteredRows.length,
          result: { column: target, value: null },
          answer: `There are no numeric **${target}** values in the matching records.`,
        };
      }

      const value =
        plan.operation === "min"
          ? Math.min(...values)
          : plan.operation === "max"
            ? Math.max(...values)
            : median(values);

      const label =
        plan.operation === "min"
          ? "minimum"
          : plan.operation === "max"
            ? "maximum"
            : "median";

      return {
        plan,
        matchedRows: filteredRows.length,
        result: { column: target, value: round(value) },
        answer: `The ${label} **${target}** is **${formatNumber(value)}**.`,
      };
    }

    case "distinct": {
      if (!target) {
        throw new Error("Distinct analysis requires a target column.");
      }

      const values = filteredRows
        .map((row) => row[target])
        .filter((value) => !isMissing(value))
        .map((value) => String(value));

      const unique = Array.from(new Set(values));

      return {
        plan,
        matchedRows: filteredRows.length,
        result: {
          column: target,
          uniqueCount: unique.length,
          values: unique.slice(0, plan.limit),
        },
        answer: `**${target}** contains **${formatNumber(
          unique.length,
        )}** unique values.`,
      };
    }

    case "missing": {
      const targetColumns = target
        ? [target]
        : columns.map((column) => column.name);

      const missing = targetColumns.map((column) => ({
        column,
        count: filteredRows.filter((row) => isMissing(row[column])).length,
      }));

      const totalMissing = missing.reduce(
        (sum, item) => sum + item.count,
        0,
      );

      return {
        plan,
        matchedRows: filteredRows.length,
        result: { missing, totalMissing },
        answer:
          targetColumns.length === 1
            ? `**${missing[0].count.toLocaleString()}** records are missing a value in **${targetColumns[0]}**.`
            : `There are **${totalMissing.toLocaleString()}** missing cells across the dataset.`,
      };
    }

    case "group_count":
    case "group_sum":
    case "group_average": {
      const groups = new Map<
        string,
        { label: unknown; rows: Record<string, unknown>[] }
      >();

      for (const row of filteredRows) {
        const rawKey = row[plan.groupBy!];
        const key = String(rawKey ?? "(missing)");
        const existing = groups.get(key);

        if (existing) {
          existing.rows.push(row);
        } else {
          groups.set(key, {
            label: rawKey ?? "(missing)",
            rows: [row],
          });
        }
      }

      const grouped = Array.from(groups.values()).map((group) => {
        if (plan.operation === "group_count") {
          return {
            group: group.label,
            value: group.rows.length,
          };
        }

        const values = numericValues(group.rows, target!);
        const value =
          plan.operation === "group_sum"
            ? values.reduce((sum, item) => sum + item, 0)
            : values.length
              ? values.reduce((sum, item) => sum + item, 0) / values.length
              : 0;

        return {
          group: group.label,
          value: round(value),
          records: group.rows.length,
        };
      });

      grouped.sort((a, b) => b.value - a.value);

      const limited = grouped.slice(0, plan.limit);

      const operationLabel =
        plan.operation === "group_count"
          ? "record count"
          : plan.operation === "group_sum"
            ? `total ${target}`
            : `average ${target}`;

      const lines = limited
        .map(
          (item, index) =>
            `${index + 1}. **${formatValue(item.group)}** — **${formatNumber(
              item.value,
            )}**`,
        )
        .join("\n");

      return {
        plan,
        matchedRows: filteredRows.length,
        result: {
          groupBy: plan.groupBy,
          operation: operationLabel,
          groups: limited,
        },
        answer: limited.length
          ? `Here are the top groups by ${operationLabel}:\n\n${lines}`
          : "No groups were found for the requested criteria.",
      };
    }

    case "top":
    case "bottom": {
      const values = filteredRows
        .map((row) => ({
          row,
          value: toNumber(row[target!]),
        }))
        .filter(
          (
            item,
          ): item is {
            row: Record<string, unknown>;
            value: number;
          } => item.value !== null,
        );

      values.sort((a, b) =>
        plan.operation === "top"
          ? b.value - a.value
          : a.value - b.value,
      );

      const limited = values.slice(0, plan.limit);

      const lines = limited.map((item, index) => {
        const details = Object.entries(item.row)
          .slice(0, 6)
          .map(([key, value]) => `${key}: ${formatValue(value)}`)
          .join(", ");

        return `${index + 1}. **${formatNumber(item.value)}** — ${details}`;
      });

      return {
        plan,
        matchedRows: filteredRows.length,
        result: {
          column: target,
          rows: limited.map((item) => item.row),
        },
        answer: limited.length
          ? lines.join("\n")
          : `No numeric values were found in **${target}**.`,
      };
    }

    case "percentage": {
      const total = rows.length;
      const matching = filteredRows.length;
      const percentage = total ? (matching / total) * 100 : 0;

      return {
        plan,
        matchedRows: matching,
        result: {
          matchingRecords: matching,
          totalRecords: total,
          percentage: round(percentage),
        },
        answer: `**${formatNumber(matching)}** of **${formatNumber(
          total,
        )}** records match the criteria, which is **${formatNumber(
          percentage,
        )}%**.`,
      };
    }

    case "correlation": {
      if (!target || !plan.secondColumn) {
        throw new Error("Correlation requires two numeric columns.");
      }

      const pairs = filteredRows
        .map((row) => ({
          x: toNumber(row[target]),
          y: toNumber(row[plan.secondColumn!]),
        }))
        .filter(
          (pair): pair is { x: number; y: number } =>
            pair.x !== null && pair.y !== null,
        );

      if (pairs.length < 2) {
        return {
          plan,
          matchedRows: filteredRows.length,
          result: { correlation: null },
          answer:
            "There are not enough numeric records to calculate a correlation.",
        };
      }

      const xMean =
        pairs.reduce((sum, pair) => sum + pair.x, 0) / pairs.length;
      const yMean =
        pairs.reduce((sum, pair) => sum + pair.y, 0) / pairs.length;

      let numerator = 0;
      let xDenominator = 0;
      let yDenominator = 0;

      for (const pair of pairs) {
        const xDiff = pair.x - xMean;
        const yDiff = pair.y - yMean;

        numerator += xDiff * yDiff;
        xDenominator += xDiff ** 2;
        yDenominator += yDiff ** 2;
      }

      const denominator = Math.sqrt(
        xDenominator * yDenominator,
      );

      const correlation =
        denominator === 0 ? 0 : numerator / denominator;

      return {
        plan,
        matchedRows: filteredRows.length,
        result: {
          columnA: target,
          columnB: plan.secondColumn,
          correlation: round(correlation),
        },
        answer: `The correlation between **${target}** and **${plan.secondColumn}** is **${formatNumber(
          correlation,
        )}**.`,
      };
    }

    case "trend": {
      if (!target || !plan.dateColumn) {
        throw new Error(
          "Trend analysis requires a date column and numeric target column.",
        );
      }

      const period = plan.trendPeriod ?? "month";
      const aggregation = plan.trendAggregation ?? "average";
      const buckets = new Map<string, number[]>();

      const bucketDate = (value: unknown): string | null => {
        const date = toDate(value);
        if (!date) return null;

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        if (period === "year") return String(year);
        if (period === "month") return `${year}-${month}`;
        if (period === "day") return `${year}-${month}-${day}`;

        if (period === "quarter") {
          return `${year}-Q${Math.floor(date.getMonth() / 3) + 1}`;
        }

        const firstDay = new Date(year, 0, 1);
        const diffDays = Math.floor(
          (date.getTime() - firstDay.getTime()) / 86400000,
        );
        const week = Math.floor(diffDays / 7) + 1;

        return `${year}-W${String(week).padStart(2, "0")}`;
      };

      for (const row of filteredRows) {
        const bucket = bucketDate(row[plan.dateColumn]);
        const value = toNumber(row[target]);

        if (!bucket || value === null) continue;

        const values = buckets.get(bucket);

        if (values) {
          values.push(value);
        } else {
          buckets.set(bucket, [value]);
        }
      }

      const aggregateBucket = (values: number[]): number => {
        if (aggregation === "sum") {
          return values.reduce((sum, item) => sum + item, 0);
        }

        if (aggregation === "count") {
          return values.length;
        }

        return values.length
          ? values.reduce((sum, item) => sum + item, 0) / values.length
          : 0;
      };

      const points = Array.from(buckets.entries())
        .map(([periodLabel, values]) => ({
          period: periodLabel,
          value: round(aggregateBucket(values)),
          records: values.length,
        }))
        .sort((a, b) => a.period.localeCompare(b.period));

      if (!points.length) {
        return {
          plan,
          matchedRows: filteredRows.length,
          result: { periods: [] },
          answer:
            "There is not enough valid date/numeric data to calculate a trend.",
        };
      }

      const first = points[0].value;
      const last = points[points.length - 1].value;

      const changePercentage =
        first === 0
          ? null
          : round(((last - first) / Math.abs(first)) * 100);

      const direction =
        last > first
          ? "increasing"
          : last < first
            ? "decreasing"
            : "stable";

      const aggregationLabel =
        aggregation === "sum"
          ? "total"
          : aggregation === "count"
            ? "record count"
            : "average";

      return {
        plan,
        matchedRows: filteredRows.length,
        result: {
          dateColumn: plan.dateColumn,
          targetColumn: target,
          period,
          aggregation,
          direction,
          changePercentage,
          periods: points,
        },
        answer: `The ${aggregationLabel} **${target}** trend is **${direction}** from **${formatNumber(
          first,
        )}** to **${formatNumber(last)}**${
          changePercentage === null
            ? "."
            : `, a **${formatNumber(changePercentage)}%** change.`
        }`,
      };
    }

    case "formula_check": {
      const secondCol = plan.secondColumn!;
      const thirdCol = plan.thirdColumn!;
      const operator = plan.formulaOperator ?? "multiply";
      const tolerance =
        typeof plan.tolerance === "number" && Number.isFinite(plan.tolerance)
          ? Math.abs(plan.tolerance)
          : 0.01;

      const compute = (a: number, b: number): number => {
        switch (operator) {
          case "add":
            return a + b;
          case "subtract":
            return a - b;
          case "divide":
            return b === 0 ? NaN : a / b;
          case "multiply":
          default:
            return a * b;
        }
      };

      const symbol =
        operator === "add"
          ? "+"
          : operator === "subtract"
            ? "-"
            : operator === "divide"
              ? "/"
              : "*";

      let checked = 0;
      const mismatches: {
        row: Record<string, unknown>;
        expected: number;
        actual: number;
        difference: number;
      }[] = [];

      for (const row of filteredRows) {
        const actual = toNumber(row[target!]);
        const a = toNumber(row[secondCol]);
        const b = toNumber(row[thirdCol]);

        if (actual === null || a === null || b === null) continue;

        const expected = compute(a, b);
        if (!Number.isFinite(expected)) continue;

        checked += 1;
        const difference = Math.abs(expected - actual);

        if (difference > tolerance) {
          mismatches.push({ row, expected: round(expected), actual, difference: round(difference) });
        }
      }

      mismatches.sort((a, b) => b.difference - a.difference);
      const sampledMismatches = mismatches.slice(0, plan.limit);

      const allMatch = checked > 0 && mismatches.length === 0;

      const summaryLine = checked
        ? allMatch
          ? `Yes — across all **${formatNumber(
              checked,
            )}** checkable records, **${target}** always equals **${secondCol} ${symbol} ${thirdCol}** (within a tolerance of ${tolerance}).`
          : `No — out of **${formatNumber(
              checked,
            )}** checkable records, **${formatNumber(
              mismatches.length,
            )}** do not match **${secondCol} ${symbol} ${thirdCol}** (tolerance ${tolerance}).`
        : `There were no records with valid numeric values in **${target}**, **${secondCol}**, and **${thirdCol}** to check.`;

      const mismatchLines = sampledMismatches
        .map((item, index) => {
          const idLabel =
            "Record_ID" in item.row
              ? `Record_ID ${formatValue(item.row["Record_ID"])}`
              : `Row ${index + 1}`;

          return `${index + 1}. ${idLabel} — expected **${formatNumber(
            item.expected,
          )}**, found **${formatNumber(item.actual)}** (off by **${formatNumber(
            item.difference,
          )}**)`;
        })
        .join("\n");

      return {
        plan,
        matchedRows: filteredRows.length,
        result: {
          targetColumn: target,
          secondColumn: secondCol,
          thirdColumn: thirdCol,
          formulaOperator: operator,
          tolerance,
          checkedRecords: checked,
          mismatchCount: mismatches.length,
          mismatches: sampledMismatches,
        },
        answer: mismatches.length
          ? `${summaryLine}\n\nWorst mismatches:\n${mismatchLines}`
          : summaryLine,
      };
    }

    case "outliers": {
      const profiles = profileColumns(rows, columns);
      const numericProfiles = target
        ? profiles.filter(
            (profile) =>
              profile.column.name === target && profile.kind === "numeric",
          )
        : profiles.filter((profile) => profile.kind === "numeric");

      if (target && !numericProfiles.length) {
        throw new Error(
          `\`${target}\` is not a numeric column, so outliers cannot be calculated for it.`,
        );
      }

      const outlierLimit =
        typeof plan.limit === "number" ? plan.limit : 5;

      const columnResults = numericProfiles.map((profile) => {
        const entries = filteredRows
          .map((row) => ({
            row,
            value: toNumber(row[profile.column.name]),
          }))
          .filter(
            (entry): entry is { row: Record<string, unknown>; value: number } =>
              entry.value !== null,
          );

        const sortedValues = [...entries]
          .map((entry) => entry.value)
          .sort((a, b) => a - b);
        const { q1, q3 } = quartiles(sortedValues);
        const iqr = q3 - q1;
        const lowerFence = q1 - 1.5 * iqr;
        const upperFence = q3 + 1.5 * iqr;

        const outlierEntries = entries
          .filter((entry) => entry.value < lowerFence || entry.value > upperFence)
          .map((entry) => ({
            row: entry.row,
            value: entry.value,
            distance:
              entry.value < lowerFence
                ? lowerFence - entry.value
                : entry.value - upperFence,
          }))
          .sort((a, b) => b.distance - a.distance);

        return {
          column: profile.column.name,
          checked: entries.length,
          lowerFence: round(lowerFence),
          upperFence: round(upperFence),
          outlierCount: outlierEntries.length,
          topOutliers: outlierEntries.slice(0, outlierLimit),
        };
      });

      const totalOutliers = columnResults.reduce(
        (sum, item) => sum + item.outlierCount,
        0,
      );

      const scope = target ? `**${target}**` : "the numeric columns";
      const lines: string[] = [];

      if (!totalOutliers) {
        lines.push(
          `No statistical outliers were found in ${scope} (using the 1.5\u00d7 IQR rule).`,
        );
      } else {
        lines.push(
          `Found **${formatNumber(
            totalOutliers,
          )}** statistical outlier${
            totalOutliers === 1 ? "" : "s"
          } in ${scope} (values beyond 1.5\u00d7 the interquartile range).`,
        );
        lines.push("");

        for (const item of columnResults) {
          if (!item.outlierCount) continue;

          lines.push(
            `**${item.column}** — **${formatNumber(
              item.outlierCount,
            )}** outlier${
              item.outlierCount === 1 ? "" : "s"
            } (normal range **${formatNumber(
              item.lowerFence,
            )}** to **${formatNumber(item.upperFence)}**):`,
          );

          item.topOutliers.forEach((outlier, index) => {
            const idLabel =
              "Record_ID" in outlier.row
                ? `Record_ID ${formatValue(outlier.row["Record_ID"])}`
                : `Row ${index + 1}`;
            lines.push(
              `${index + 1}. ${idLabel} — **${formatNumber(outlier.value)}**`,
            );
          });
          lines.push("");
        }
      }

      return {
        plan,
        matchedRows: filteredRows.length,
        result: {
          scope: target ?? "all numeric columns",
          totalOutliers,
          columns: columnResults,
        },
        answer: lines.join("\n").trim(),
      };
    }

    case "patterns": {
      const profiles = profileColumns(filteredRows, columns);
      const numericProfiles = profiles.filter(
        (profile) => profile.kind === "numeric",
      );
      const categoricalProfiles = profiles.filter(
        (profile) => profile.kind === "categorical",
      );
      const dateProfiles = profiles.filter((profile) => profile.kind === "date");

      // Top correlations among all numeric column pairs.
      const correlations: { a: string; b: string; correlation: number }[] = [];
      for (let i = 0; i < numericProfiles.length; i += 1) {
        for (let j = i + 1; j < numericProfiles.length; j += 1) {
          const colA = numericProfiles[i].column.name;
          const colB = numericProfiles[j].column.name;
          const correlation = pearsonCorrelation(filteredRows, colA, colB);

          if (correlation !== null) {
            correlations.push({ a: colA, b: colB, correlation: round(correlation) });
          }
        }
      }
      correlations.sort(
        (a, b) => Math.abs(b.correlation) - Math.abs(a.correlation),
      );
      const topCorrelations = correlations
        .filter((item) => Math.abs(item.correlation) >= 0.3)
        .slice(0, 3);

      // Most skewed (dominant-category) categorical column.
      const categoricalSkew = categoricalProfiles
        .map((profile) => {
          const counts = new Map<string, number>();

          for (const value of profile.nonMissing) {
            const key = String(value);
            counts.set(key, (counts.get(key) ?? 0) + 1);
          }

          const total = profile.nonMissing.length;
          const sorted = Array.from(counts.entries()).sort(
            (a, b) => b[1] - a[1],
          );
          const [topValue, topCount] = sorted[0] ?? [null, 0];

          return {
            column: profile.column.name,
            topValue,
            topPercentage: total ? round((topCount / total) * 100) : 0,
          };
        })
        .sort((a, b) => b.topPercentage - a.topPercentage);

      const mostSkewed = categoricalSkew[0] ?? null;

      // Trend for the first numeric column (excluding ID-like columns) over
      // the first date column, bucketed by month.
      let trendSummary: {
        column: string;
        dateColumn: string;
        direction: "increasing" | "decreasing" | "stable";
        changePercentage: number | null;
      } | null = null;

      if (dateProfiles.length && numericProfiles.length) {
        const dateColumn = dateProfiles[0].column.name;
        const numericCandidate =
          numericProfiles.find((profile) => !/id$/i.test(profile.column.name)) ??
          numericProfiles[0];

        const buckets = new Map<string, number[]>();
        for (const row of filteredRows) {
          const date = toDate(row[dateColumn]);
          const value = toNumber(row[numericCandidate.column.name]);
          if (!date || value === null) continue;

          const key = `${date.getFullYear()}-${String(
            date.getMonth() + 1,
          ).padStart(2, "0")}`;
          const bucket = buckets.get(key);
          if (bucket) bucket.push(value);
          else buckets.set(key, [value]);
        }

        const points = Array.from(buckets.entries())
          .map(([period, values]) => ({
            period,
            value: values.reduce((sum, item) => sum + item, 0) / values.length,
          }))
          .sort((a, b) => a.period.localeCompare(b.period));

        if (points.length >= 2) {
          const first = points[0].value;
          const last = points[points.length - 1].value;
          const changePercentage =
            first === 0 ? null : round(((last - first) / Math.abs(first)) * 100);

          trendSummary = {
            column: numericCandidate.column.name,
            dateColumn,
            direction: last > first ? "increasing" : last < first ? "decreasing" : "stable",
            changePercentage,
          };
        }
      }

      // Columns with the most missing data.
      const missingHotspots = profiles
        .map((profile) => ({
          column: profile.column.name,
          missingCount: profile.missingCount,
        }))
        .filter((item) => item.missingCount > 0)
        .sort((a, b) => b.missingCount - a.missingCount)
        .slice(0, 3);

      const lines: string[] = [];
      lines.push("### Patterns & Insights");
      lines.push("");

      if (topCorrelations.length) {
        lines.push("**Correlations**");
        for (const item of topCorrelations) {
          const strength =
            Math.abs(item.correlation) >= 0.7
              ? "strong"
              : Math.abs(item.correlation) >= 0.5
                ? "moderate"
                : "weak";
          const direction = item.correlation > 0 ? "positive" : "negative";

          lines.push(
            `- **${item.a}** and **${item.b}** show a ${strength} ${direction} correlation (**${formatNumber(
              item.correlation,
            )}**).`,
          );
        }
        lines.push("");
      } else if (numericProfiles.length >= 2) {
        lines.push("**Correlations**");
        lines.push(
          "- No strong linear relationships (|r| \u2265 0.3) were found among the numeric columns.",
        );
        lines.push("");
      }

      if (mostSkewed && mostSkewed.topValue !== null) {
        lines.push("**Distribution**");
        lines.push(
          `- \`${mostSkewed.column}\` is the most concentrated categorical field — **${formatValue(
            mostSkewed.topValue,
          )}** accounts for **${formatNumber(mostSkewed.topPercentage)}%** of records.`,
        );
        lines.push("");
      }

      if (trendSummary) {
        lines.push("**Trend**");
        lines.push(
          `- **${trendSummary.column}** is **${trendSummary.direction}** over time by \`${
            trendSummary.dateColumn
          }\`${
            trendSummary.changePercentage === null
              ? "."
              : `, a **${formatNumber(trendSummary.changePercentage)}%** change from the first to the last period.`
          }`,
        );
        lines.push("");
      }

      if (missingHotspots.length) {
        lines.push("**Data quality**");
        for (const item of missingHotspots) {
          lines.push(
            `- \`${item.column}\` has **${formatNumber(
              item.missingCount,
            )}** missing value${item.missingCount === 1 ? "" : "s"}.`,
          );
        }
        lines.push("");
      }

      if (lines.length <= 2) {
        lines.push(
          "Not enough structure was found in this dataset to surface meaningful patterns.",
        );
      }

      return {
        plan,
        matchedRows: filteredRows.length,
        result: {
          correlations: topCorrelations,
          mostSkewedCategory: mostSkewed,
          trend: trendSummary,
          missingHotspots,
        },
        answer: lines.join("\n").trim(),
      };
    }

    case "describe": {
      const totalRows = rows.length;

      const columnProfiles = profileColumns(rows, columns);

      const numericProfiles = columnProfiles.filter(
        (profile) => profile.kind === "numeric",
      );
      const dateProfiles = columnProfiles.filter(
        (profile) => profile.kind === "date",
      );
      const categoricalProfiles = columnProfiles.filter(
        (profile) => profile.kind === "categorical",
      );

      const numericStats = numericProfiles.map((profile) => {
        const values = profile.nonMissing
          .map((value) => toNumber(value))
          .filter((value): value is number => value !== null);

        const sum = values.reduce((total, value) => total + value, 0);

        return {
          column: profile.column.name,
          count: values.length,
          average: values.length ? round(sum / values.length) : 0,
          min: values.length ? Math.min(...values) : 0,
          max: values.length ? Math.max(...values) : 0,
        };
      });

      const categoricalStats = categoricalProfiles.map((profile) => {
        const counts = new Map<string, number>();

        for (const value of profile.nonMissing) {
          const key = String(value);
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }

        const sorted = Array.from(counts.entries()).sort(
          (a, b) => b[1] - a[1],
        );
        const [topValue, topCount] = sorted[0] ?? [null, 0];

        return {
          column: profile.column.name,
          uniqueCount: counts.size,
          topValue,
          topCount,
          topPercentage: totalRows ? round((topCount / totalRows) * 100) : 0,
        };
      });

      const totalMissing = columnProfiles.reduce(
        (sum, profile) => sum + profile.missingCount,
        0,
      );
      const totalCells = totalRows * columns.length;
      const completeness = totalCells
        ? round(((totalCells - totalMissing) / totalCells) * 100)
        : 100;

      const dateSummary = dateProfiles.map((profile) => {
        const dates = profile.nonMissing
          .map((value) => toDate(value))
          .filter((value): value is Date => value !== null);

        const earliest = dates.length
          ? new Date(Math.min(...dates.map((date) => date.getTime())))
          : null;
        const latest = dates.length
          ? new Date(Math.max(...dates.map((date) => date.getTime())))
          : null;

        return {
          column: profile.column.name,
          earliest: earliest ? earliest.toISOString().slice(0, 10) : null,
          latest: latest ? latest.toISOString().slice(0, 10) : null,
        };
      });

      // Build a human-readable Markdown summary.
      const lines: string[] = [];

      lines.push("### Dataset Overview");
      lines.push(
        `Your dataset contains **${formatNumber(
          totalRows,
        )} records** across **${formatNumber(columns.length)} columns**.`,
      );
      lines.push("");

      lines.push("**Key numbers**");
      lines.push(
        `- **${numericProfiles.length}** numeric field${
          numericProfiles.length === 1 ? "" : "s"
        } detected.`,
      );
      lines.push(
        `- **${categoricalProfiles.length}** categorical field${
          categoricalProfiles.length === 1 ? "" : "s"
        } detected.`,
      );
      if (dateProfiles.length) {
        lines.push(
          `- **${dateProfiles.length}** date field${
            dateProfiles.length === 1 ? "" : "s"
          } detected.`,
        );
      }
      lines.push(
        `- **${formatNumber(totalMissing)}** missing value${
          totalMissing === 1 ? "" : "s"
        } found.`,
      );

      for (const stat of numericStats.slice(0, 6)) {
        lines.push(
          `- \`${stat.column}\` has an average of **${formatNumber(
            stat.average,
          )}**, with values ranging from **${formatNumber(
            stat.min,
          )}** to **${formatNumber(stat.max)}**.`,
        );
      }
      lines.push("");

      if (dateSummary.length) {
        lines.push("**Dates**");
        for (const item of dateSummary) {
          lines.push(
            `- \`${item.column}\` spans from **${item.earliest}** to **${item.latest}**.`,
          );
        }
        lines.push("");
      }

      if (categoricalStats.length) {
        lines.push("**Categories**");
        for (const stat of categoricalStats.slice(0, 6)) {
          if (stat.topValue !== null) {
            lines.push(
              `- **${formatValue(stat.topValue)}** is the most common \`${
                stat.column
              }\`, appearing in **${formatNumber(
                stat.topCount,
              )}** records (**${formatNumber(stat.topPercentage)}%**).`,
            );
          }
          lines.push(
            `- \`${stat.column}\` contains **${formatNumber(
              stat.uniqueCount,
            )}** unique values.`,
          );
        }
        lines.push("");
      }

      lines.push("**Data quality**");
      lines.push(
        `- There ${totalMissing === 1 ? "is" : "are"} **${formatNumber(
          totalMissing,
        )}** missing value${totalMissing === 1 ? "" : "s"} in the dataset.`,
      );
      lines.push(
        completeness >= 99
          ? `- Data is substantially complete (**${formatNumber(
              completeness,
            )}%** of cells populated).`
          : `- Overall completeness is **${formatNumber(
              completeness,
            )}%** of cells populated — some fields may need attention.`,
      );

      return {
        plan,
        matchedRows: totalRows,
        result: {
          rowCount: totalRows,
          columnCount: columns.length,
          numericColumns: numericStats,
          categoricalColumns: categoricalStats,
          dateColumns: dateSummary,
          totalMissing,
          completeness,
          columns: columns.map((column) => ({
            name: column.name,
            type: column.type,
            missing: column.missing,
          })),
        },
        answer: lines.join("\n"),
      };
    }

    case "rows": {
      const limited = filteredRows.slice(0, plan.limit);

      return {
        plan,
        matchedRows: filteredRows.length,
        result: {
          totalMatches: filteredRows.length,
          rows: limited,
        },
        answer: `I found **${formatNumber(
          filteredRows.length,
        )}** matching records and can show the first **${limited.length}**.`,
      };
    }

    default:
      throw new Error("Unsupported analysis operation.");
  }
}