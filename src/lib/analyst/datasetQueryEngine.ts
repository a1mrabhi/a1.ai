import type { DatasetColumn } from "@/lib/analyst/analystTypes";
import { generateAIResponse, type AIMessage } from "@/lib/ai";

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
    | "patterns"
  | "recommendation";
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
  /**
   * Used by "percentage" only. Defines the denominator population when the
   * question asks "what percentage of <subgroup> have <condition>". The
   * subgroup-defining clause(s) go here; `filters` still carries the full
   * condition (subgroup + condition together) used for the numerator. If
   * omitted, the denominator is the whole dataset (post any non-percentage
   * filters), preserving old behavior.
   */
  populationFilters?: QueryFilter[];
  secondColumn?: string;
  /** Used by formula_check: the third operand column, e.g. Unit_Value in Quantity * Unit_Value. */
  thirdColumn?: string;
  /** Used by formula_check: how secondColumn and thirdColumn combine before comparing to targetColumn. */
  formulaOperator?: "multiply" | "add" | "subtract" | "divide";
  /** Used by formula_check: allowed absolute difference before flagging a mismatch. Defaults to 0.01. */
  tolerance?: number;
  /**
   * Sort direction for grouped aggregates (group_count / group_sum /
   * group_average). Defaults to "desc" for backward compatibility, so
   * "highest" / "most" keep working unchanged. Set to "asc" for
   * "lowest" / "smallest" / "worst" style questions.
   */
  sortDirection?: "asc" | "desc";
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
  "recommendation",
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

/**
 * Standard ISO-8601 week numbering (Monday-start weeks, week 1 is the week
 * containing the year's first Thursday). Replaces a naive "7-day blocks
 * from Jan 1" scheme, which misassigns the first few days of most years
 * and the last few days of some years to the wrong week/year.
 */
function getIsoWeek(date: Date): { isoYear: number; isoWeek: number } {
  const target = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNumber = (target.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  target.setUTCDate(target.getUTCDate() - dayNumber + 3); // nearest Thursday
  const firstThursday = target.getTime();

  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCDate(1 + ((4 - target.getUTCDay() + 7) % 7));
  }

  const isoWeek =
    1 + Math.round((firstThursday - target.getTime()) / (7 * 86400000));
  const isoYear = new Date(firstThursday).getUTCFullYear();

  return { isoYear, isoWeek };
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
  return String(value ?? "")
    .trim()
    .toLowerCase();
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

  if (filter.operator === "=") {
    return valuesEqual(actual, expected);
  }

  if (filter.operator === "on") {
    const actualDate = toDate(actual);
    const expectedDate = toDate(expected);

    // "on" means the same calendar date when both sides are date-like.
    // Fall back to normal equality for non-date values.
    if (actualDate && expectedDate) {
      return (
        actualDate.getFullYear() === expectedDate.getFullYear() &&
        actualDate.getMonth() === expectedDate.getMonth() &&
        actualDate.getDate() === expectedDate.getDate()
      );
    }

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
    // Always derive missingCount from the rows actually passed in (e.g.
    // filteredRows for a "describe West employees" question), never from
    // column.missing — that figure reflects the whole original dataset and
    // would silently overstate missing counts on any filtered subset.
    const missingCount = totalRows - nonMissing.length;

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

  return correlationOfPairs(pairs);
}

/** Pearson correlation of two same-length numeric arrays (e.g. a bucket
 *  index 0..n-1 against that bucket's average value) — used to rank trend
 *  candidates by how strongly they actually move with time, rather than
 *  just picking whichever numeric column happens to come first. */
function correlationOfSeries(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  return correlationOfPairs(xs.slice(0, n).map((x, i) => ({ x, y: ys[i] })));
}

function correlationOfPairs(pairs: { x: number; y: number }[]): number {
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

/** Same normalization as normalizeColumnName, exposed for substring checks
 *  against free-text questions (not just exact column-name matches). */
function normalizeForMatch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Splits a column name into its significant "words" (handling snake_case,
 * kebab-case, and camelCase) so a question can be checked for a partial /
 * synonym-adjacent mention of the column rather than only an exact,
 * whole-name substring match. Short words (<4 chars) are dropped since
 * they produce too many false positives (e.g. "ID", "Age").
 */
function columnWords(name: string): string[] {
  return name
    .split(/[\s_-]+/)
    .flatMap((part) => part.split(/(?=[A-Z][a-z])/))
    .map((word) => normalizeForMatch(word))
    .filter((word) => word.length >= 4);
}

/**
 * True if the question plausibly refers to this column: either the whole
 * (normalized) column name appears verbatim, or at least one of its
 * significant words does. This is deliberately generous — it exists only
 * to decide whether a column is "mentioned", not to prove a match.
 */
function mentionsColumn(
  name: string | undefined,
  normalizedQuestion: string,
): boolean {
  if (!name) return false;
  if (normalizedQuestion.includes(normalizeForMatch(name))) return true;
  return columnWords(name).some((word) => normalizedQuestion.includes(word));
}

/** Questions phrased with these comparison cues ("more than 10 years",
 *  "at least 5", "below 3", or their word-form numeral equivalents like
 *  "more than ten") imply a filter clause should exist. This is a plain-
 *  English pattern match, not tied to any dataset's columns. */
const NUMBER_WORD =
  "(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|" +
  "fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|" +
  "fifty|sixty|seventy|eighty|ninety|hundred|thousand|million)";

const COMPARISON_CUE = new RegExp(
  "\\b(more than|greater than|above|over|at least|no less than|no fewer than|" +
    "at or above|below|less than|under|fewer than|at most|no more than|" +
    "at or below|exactly|equal to|between)\\b\\s*(?:\\$?\\d|" +
    NUMBER_WORD +
    "\\b)",
  "i",
);

/** Date-based comparison cues ("before 2020", "after January", "since
 *  2019") that should also become a filter clause. */
const DATE_COMPARISON_CUE =
  /\b(before|after|since|until)\b\s+(\d{4}|january|february|march|april|may|june|july|august|september|october|november|december)/i;

const OPERATIONS_REQUIRING_TARGET: QueryPlan["operation"][] = [
  "sum",
  "average",
  "min",
  "max",
  "median",
  "top",
  "bottom",
  "recommendation",
];

const GROUPED_OPERATIONS: QueryPlan["operation"][] = [
  "group_count",
  "group_sum",
  "group_average",
];

/**
 * Returns every entry in `subset` that has no matching entry in `superset`
 * (same column, operator, value, and secondValue). Used to enforce that a
 * percentage query's populationFilters (denominator) is always contained
 * within filters (numerator) — otherwise the numerator and denominator can
 * describe different populations and the resulting percentage can exceed
 * 100% or otherwise not mean what it claims to.
 */
function filtersSubsetGaps(
  subset: QueryFilter[],
  superset: QueryFilter[],
): QueryFilter[] {
  return subset.filter(
    (needle) =>
      !superset.some(
        (candidate) =>
          normalizeForMatch(candidate.column) ===
            normalizeForMatch(needle.column) &&
          candidate.operator === needle.operator &&
          String(candidate.value) === String(needle.value) &&
          String(candidate.secondValue ?? "") ===
            String(needle.secondValue ?? ""),
      ),
  );
}

/** Cues implying the grouped aggregate should be sorted ascending
 *  ("lowest", "smallest") vs. descending ("highest", "most" — the
 *  default). */
const ASCENDING_CUE = /\b(lowest|smallest|least|fewest|worst|minimum)\b/i;
const DESCENDING_CUE = /\b(highest|largest|greatest|most|maximum|best)\b/i;

/**
 * Heuristic, dataset-agnostic sanity check that compares the planner's
 * chosen columns/settings against the words actually used in the
 * question — never against the dataset's *values*, only column names vs.
 * question text — so it behaves identically no matter what file was
 * uploaded.
 *
 * Catches several common LLM query-planning failures:
 *   1. Picking a target column that a *different, more literally-named*
 *      column matches better (a sign the model defaulted to some other
 *      column instead of the one the question is asking to summarize).
 *   2. Dropping a comparison clause ("more than 10", "at least 5",
 *      "more than ten", "before 2020") on the floor instead of turning
 *      it into a filter.
 *   3. Using the whole dataset as the percentage denominator when the
 *      question actually asks for a percentage "of" some subgroup.
 *   4. Sorting a grouped aggregate in the wrong direction for
 *      "lowest" / "highest" style questions.
 *
 * Returns a list of plain-language issue descriptions (empty = looks fine).
 */
function findPlanIssues(
  plan: QueryPlan,
  question: string,
  allColumns: DatasetColumn[],
): string[] {
  const issues: string[] = [];
  const normalizedQuestion = normalizeForMatch(question);

  if (
    OPERATIONS_REQUIRING_TARGET.includes(plan.operation) &&
    plan.targetColumn &&
    !mentionsColumn(plan.targetColumn, normalizedQuestion)
  ) {
    const alternative = allColumns.find(
      (col) =>
        col.name !== plan.targetColumn &&
        mentionsColumn(col.name, normalizedQuestion),
    );

    // Only flag this when a *different* column matches the question text
    // better than the chosen one. If nothing else matches either, the
    // chosen column is plausibly a legitimate synonym (e.g. "pay" for
    // Annual_Salary) that this text-only heuristic can't resolve, and
    // flagging it would just produce noisy false positives.
    if (alternative) {
      issues.push(
        `The target column "${plan.targetColumn}" does not appear anywhere ` +
          `in the question, but "${alternative.name}" does. Re-identify ` +
          `which column's values the question actually wants summarized — ` +
          `it is often a different column from any filter condition ` +
          `mentioned in the same question.`,
      );
    }
  }

  if (
    (COMPARISON_CUE.test(question) || DATE_COMPARISON_CUE.test(question)) &&
    (plan.filters ?? []).length === 0
  ) {
    issues.push(
      `The question contains a comparison clause (e.g. "more than 10", ` +
        `"at least five", "before 2020") but the plan has no filters. Every ` +
        `such clause must become its own entry in filters[].`,
    );
  }

  if (plan.operation === "percentage") {
    const filters = plan.filters ?? [];
    const populationFilters = plan.populationFilters ?? [];

    if (filters.length > 1 && !populationFilters.length) {
      issues.push(
        `This percentage question has multiple filter clauses but no ` +
          `populationFilters. If it asks for a percentage "of" a subgroup ` +
          `(e.g. "of West employees have X"), put the subgroup-defining ` +
          `clause in populationFilters (the denominator) and the full ` +
          `condition (subgroup + criteria together) in filters (the ` +
          `numerator).`,
      );
    }

    const unmatched = filtersSubsetGaps(populationFilters, filters);
    if (unmatched.length) {
      issues.push(
        `The populationFilters clause on "${unmatched[0].column}" does not ` +
          `also appear in filters. The denominator condition (populationFilters) ` +
          `must always be a subset of the numerator condition (filters), or the ` +
          `resulting percentage can exceed 100% or be otherwise meaningless. ` +
          `Every clause in populationFilters must be repeated inside filters.`,
      );
    }
  }

  if (GROUPED_OPERATIONS.includes(plan.operation)) {
    if (ASCENDING_CUE.test(question) && plan.sortDirection !== "asc") {
      issues.push(
        `The question asks for the lowest/smallest/worst group, but ` +
          `sortDirection is not set to "asc".`,
      );
    } else if (DESCENDING_CUE.test(question) && plan.sortDirection === "asc") {
      issues.push(
        `The question asks for the highest/largest/best group, but ` +
          `sortDirection is set to "asc" instead of "desc".`,
      );
    }
  }

  return issues;
}

function validatePlan(plan: QueryPlan, columns: DatasetColumn[]): QueryPlan {
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

  const resolveFilters = (filters: QueryFilter[] = []): QueryFilter[] =>
    filters.map((filter) => {
      const column = resolve(filter.column);

      if (!column) {
        throw new Error("A filter is missing its column.");
      }

      if (
        ![
          "=",
          "!=",
          ">",
          ">=",
          "<",
          "<=",
          "contains",
          "startsWith",
          "endsWith",
          "before",
          "after",
          "on",
          "between",
        ].includes(filter.operator)
      ) {
        throw new Error(`Unsupported filter operator "${filter.operator}".`);
      }

      if (filter.operator === "between" && filter.secondValue === undefined) {
        throw new Error(
          `The "between" filter on "${column}" requires secondValue.`,
        );
      }

      return {
        ...filter,
        column,
      };
    });

  if (
    plan.trendPeriod !== undefined &&
    !["day", "week", "month", "quarter", "year"].includes(plan.trendPeriod)
  ) {
    throw new Error(`Unsupported trend period "${plan.trendPeriod}".`);
  }

  if (
    plan.trendAggregation !== undefined &&
    !["sum", "average", "count"].includes(plan.trendAggregation)
  ) {
    throw new Error(
      `Unsupported trend aggregation "${plan.trendAggregation}".`,
    );
  }

  if (
    plan.formulaOperator !== undefined &&
    !["multiply", "add", "subtract", "divide"].includes(plan.formulaOperator)
  ) {
    throw new Error(`Unsupported formula operator "${plan.formulaOperator}".`);
  }

  const filters = resolveFilters(plan.filters);
  const populationFilters = plan.populationFilters
    ? resolveFilters(plan.populationFilters)
    : undefined;

  // Deterministic, non-bypassable guard: for percentage queries, the
  // denominator (populationFilters) must always be a subset of the
  // numerator (filters). Otherwise numerator and denominator describe two
  // different populations and the resulting percentage can exceed 100% or
  // be otherwise meaningless. This runs on every plan that reaches
  // execution, not just ones caught by the heuristic sanity check.
  if (plan.operation === "percentage" && populationFilters?.length) {
    const unmatched = filtersSubsetGaps(populationFilters, filters);
    if (unmatched.length) {
      throw new Error(
        `Invalid percentage plan: the populationFilters clause on ` +
          `"${unmatched[0].column}" is not also present in filters. The ` +
          `denominator condition must be a subset of the numerator condition.`,
      );
    }
  }

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
    populationFilters,
    sortDirection:
      plan.sortDirection === "asc"
        ? "asc"
        : plan.sortDirection === "desc"
          ? "desc"
          : undefined,
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
export type PlannerHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function createQueryPlan(
  question: string,
  columns: DatasetColumn[],
  _analysis?: unknown,
  history: PlannerHistoryMessage[] = [],
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

  const conversationContext = history.length
    ? `\nRECENT CONVERSATION CONTEXT (use this to resolve follow-up references such as "it", "that", "and phone?", or "what about the other one"):\n${history
        .slice(-10)
        .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
        .join("\n")}\n`
    : "";

  const prompt = `
You are the query planner for A1.ai.

Convert the user's natural-language question into ONE deterministic JSON
query plan. Do not answer the question yourself. The server will execute the
plan against the complete dataset.
${conversationContext}
Important: the CURRENT QUESTION is authoritative. Use the conversation context
only to resolve omitted subjects, metrics, groups, or references. Never invent
a value that is not supported by the schema or the server-side calculations.

The raw dataset rows are NOT available to you and must never be requested.

Allowed operations:
count, sum, average, min, max, median, distinct,
group_count, group_sum, group_average, top, bottom, percentage,
missing, describe, correlation, rows, trend, formula_check,
outliers, patterns, recommendation.

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
  "sortDirection": "asc|desc",
  "filters": [
    {
      "column": "ColumnName",
      "operator": ">",
      "value": 90,
      "secondValue": null
    }
  ],
  "populationFilters": [
    {
      "column": "ColumnName",
      "operator": "=",
      "value": "West"
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
- "trend", "over time", "by month", "by year" => trend when the needed date
  column is available. For count trends ("how many records per month"), a
  numeric targetColumn is NOT required.
- Set trendPeriod explicitly from wording: "by day" => day, "by week" => week,
  "by month" => month, "by quarter" => quarter, "by year" => year. For a
  generic "over time" question, default to month.
- For trend: if the question asks to "compare totals", "total X by year",
  "sum by month", etc, set trendAggregation="sum". If it asks for
  "average X over time", set trendAggregation="average". If it asks
  "how many records per month" (or equivalent count wording), set
  trendAggregation="count" and do not require targetColumn.
- "is X equal to Y times/plus/minus/divided by Z", "does X match Y * Z",
  "verify/check/validate that X = Y * Z" => formula_check, with
  targetColumn=X, secondColumn=Y, thirdColumn=Z, and formulaOperator set to
  multiply/add/subtract/divide based on the wording (default multiply).
- CRITICAL — the target column and a filter's column are usually NOT the
  same column. When a question asks for an aggregate ("average", "total",
  "how many", "highest") "for/among/where/with" some OTHER condition
  ("with more than X", "who joined after Y", "in region Z"), work out the
  two parts independently:
    1. TARGET first: which column's values does the question want
       summarized or aggregated? That is targetColumn.
    2. FILTERS second: every clause that restricts which rows count
       ("more than", "at least", "below", "equal to", "in <category>",
       "after <date>", etc) becomes its own entry in filters[], each with
       its own column, operator, and value. Never fold a filter's column
       into targetColumn, and never drop a filter just because it names a
       different column than the target.
  Worked example (illustrative column names only — always use the real
  schema for the actual dataset):
    Q: "What is the average Salary for employees with more than 10 years of
        Experience?"
    => { "operation": "average", "targetColumn": "Salary",
         "filters": [{ "column": "Experience", "operator": ">", "value": 10 }] }
  Another:
    Q: "What is the total Revenue in the West region?"
    => { "operation": "sum", "targetColumn": "Revenue",
         "filters": [{ "column": "Region", "operator": "=", "value": "West" }] }
- CRITICAL — "percentage of <subgroup>" questions need TWO different filter
  sets, not one:
    1. filters: the FULL condition — the subgroup clause AND the
       criteria clause together (this is the numerator).
    2. populationFilters: ONLY the subgroup-defining clause (this is the
       denominator). Omit populationFilters entirely if the question does
       not name a subgroup (then the denominator is the whole dataset).
  Worked example:
    Q: "What percentage of West employees have Performance_Score above 90?"
    => { "operation": "percentage",
         "filters": [
           { "column": "Region", "operator": "=", "value": "West" },
           { "column": "Performance_Score", "operator": ">", "value": 90 }
         ],
         "populationFilters": [
           { "column": "Region", "operator": "=", "value": "West" }
         ] }
  Non-subgroup example (no populationFilters needed):
    Q: "What percentage of records have a missing Email?"
    => { "operation": "percentage",
         "filters": [{ "column": "Email", "operator": "=", "value": null }] }
- For grouped aggregates (group_count, group_sum, group_average):
    - "highest", "most", "largest", "greatest", "best" => sortDirection: "desc" (default, can be omitted).
    - "lowest", "least", "smallest", "fewest", "worst" => sortDirection: "asc".
  Example:
    Q: "Which department has the lowest average Performance_Score?"
    => { "operation": "group_average", "groupBy": "Department",
         "targetColumn": "Performance_Score", "sortDirection": "asc", "limit": 1 }
- "give me an overview", "summarize the dataset", "describe the data",
  "tell me about this dataset" => describe (no filters, no target column,
  unless the question restricts to a subgroup, e.g. "describe West region
  employees", in which case add the appropriate filters[]).
  The server will compute the full statistical summary over the matching
  rows; you only need to return { "operation": "describe" } plus any
  filters implied by the question.
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
- Questions asking how to "improve", "increase", "grow", "boost", or "optimize" a numeric business outcome (for example revenue, sales, profit, units sold) => recommendation. Set targetColumn to the named outcome. The server will compare the outcome across categorical dimensions, check unit economics when a units/quantity column exists, and inspect the time trend. Do not use describe for these strategic questions.
- "verify/check/validate that X = Y * Z" (a specific named formula) =>
  formula_check, not outliers.
- "above 90" => > 90.
- "at least 90" => >= 90.
- "below 90" => < 90.
- "at most 90" => <= 90.
- "equal to 90" => = 90.
- Numbers may be spelled out in words ("more than ten years") — treat them
  the same as digits ("more than 10 years").
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

  const messages: AIMessage[] = [
    { role: "system", content: prompt },
    { role: "user", content: question },
  ];

  const { content: response, provider } = await generateAIResponse(messages);
  console.log(`Analyst query planner provider: ${provider}`);
  const parsed = extractJson(response);

  if (!isQueryPlan(parsed)) {
    throw new Error("A1.ai could not create a valid query plan.");
  }

  // Deterministic, dataset-agnostic sanity check: does this plan actually
  // match the question's wording? If not, give the model one corrective
  // retry with the specific issue spelled out, rather than silently
  // returning a plan that dropped a filter or aggregated the wrong column.
  const issues = findPlanIssues(parsed, question, columns);

  if (!issues.length) {
    return parsed;
  }

  const correctionMessages: AIMessage[] = [
    ...messages,
    { role: "assistant", content: JSON.stringify(parsed) },
    {
      role: "user",
      content:
        `That plan looks incorrect:\n${issues
          .map((issue) => `- ${issue}`)
          .join("\n")}\n\nRe-read the original question carefully — it may ` +
        `reference two different columns (one to aggregate, one to filter ` +
        `on), a subgroup vs. whole-dataset percentage, or a "lowest" vs ` +
        `"highest" direction — and output a corrected JSON plan only.`,
    },
  ];

  try {
    const { content: correctionResponse, provider } =
      await generateAIResponse(correctionMessages);
    console.log(`Analyst query planner correction provider: ${provider}`);
    const corrected = extractJson(correctionResponse);

    if (isQueryPlan(corrected)) {
      // Don't just check that it parses — run the same heuristic check
      // again. Gemini's "fix" could still miss the mark, so only accept it
      // if it actually resolves the issues we flagged.
      const correctedIssues = findPlanIssues(corrected, question, columns);

      if (!correctedIssues.length) {
        // Also confirm every column name it used actually resolves against
        // the real schema, and that hard invariants (like the percentage
        // subset rule) hold — catches a hallucinated/misspelled column
        // name or a still-invalid percentage plan that findPlanIssues's
        // text-matching alone wouldn't catch.
        validatePlan(corrected, columns);
        return corrected;
      }
    }
  } catch {
    // Falls through to the throw below — an error here (bad JSON, a
    // validation failure, a network error) means the corrective retry
    // didn't produce something usable either.
  }

  // The original plan was already flagged as wrong by findPlanIssues, and
  // the corrective retry either failed outright or produced another plan
  // that still doesn't check out. Silently returning the original,
  // known-bad plan here would mean shipping an answer we already know is
  // likely wrong — surface an error instead so the caller can retry or
  // rephrase, rather than getting a confident-looking wrong number.
  throw new Error(
    "A1.ai could not create a reliable query plan for this question. Please try rephrasing it.",
  );
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

      if (!values.length) {
        return {
          plan,
          matchedRows: filteredRows.length,
          result: { column: target, count: 0, sum: null },
          answer: `There are no numeric **${target}** values in the matching records.`,
        };
      }

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

      const totalMissing = missing.reduce((sum, item) => sum + item.count, 0);

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

      type GroupResult = { group: unknown; value: number; records?: number };

      const grouped = Array.from(groups.values())
        .map((group): GroupResult | null => {
          if (plan.operation === "group_count") {
            return {
              group: group.label,
              value: group.rows.length,
            };
          }

          const values = numericValues(group.rows, target!);

          // A group with no numeric values has no sum/average. Reporting 0
          // would make missing data look like a real measurement and could
          // incorrectly make the group appear lowest.
          if (
            (plan.operation === "group_average" ||
              plan.operation === "group_sum") &&
            !values.length
          ) {
            return null;
          }

          const value =
            plan.operation === "group_sum"
              ? values.reduce((sum, item) => sum + item, 0)
              : values.reduce((sum, item) => sum + item, 0) / values.length;

          return {
            group: group.label,
            value: round(value),
            records: group.rows.length,
          };
        })
        .filter((item): item is GroupResult => item !== null);

      const ascending = plan.sortDirection === "asc";
      grouped.sort((a, b) =>
        ascending ? a.value - b.value : b.value - a.value,
      );

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
          ? `Here are the ${ascending ? "lowest" : "top"} groups by ${operationLabel}:\n\n${lines}`
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
        plan.operation === "top" ? b.value - a.value : a.value - b.value,
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
      // The denominator is the subgroup population (populationFilters) when
      // provided, so "what percentage of West employees..." divides by West
      // employees, not the whole dataset. Falls back to the whole dataset
      // for backward compatibility when populationFilters is omitted.
      const totalPopulation = plan.populationFilters?.length
        ? applyFilters(rows, plan.populationFilters).length
        : rows.length;
      const matching = filteredRows.length;

      if (!totalPopulation) {
        return {
          plan,
          matchedRows: matching,
          result: {
            matchingRecords: matching,
            totalRecords: 0,
            percentage: null,
          },
          answer:
            "The denominator population contains no records, so the percentage cannot be calculated.",
        };
      }

      const percentage = (matching / totalPopulation) * 100;

      return {
        plan,
        matchedRows: matching,
        result: {
          matchingRecords: matching,
          totalRecords: totalPopulation,
          percentage: round(percentage),
        },
        answer: `**${formatNumber(matching)}** of **${formatNumber(
          totalPopulation,
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

      if (denominator === 0) {
        return {
          plan,
          matchedRows: filteredRows.length,
          result: {
            columnA: target,
            columnB: plan.secondColumn,
            correlation: null,
          },
          answer:
            `Correlation between **${target}** and **${plan.secondColumn}** is undefined because ` +
            "at least one column has no variation in the matching records.",
        };
      }

      const correlation = numerator / denominator;

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
      const period = plan.trendPeriod ?? "month";
      const aggregation = plan.trendAggregation ?? "average";

      if (!plan.dateColumn) {
        throw new Error("Trend analysis requires a date column.");
      }

      if (aggregation !== "count" && !target) {
        throw new Error("Trend sum/average requires a numeric target column.");
      }

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

        const { isoYear, isoWeek } = getIsoWeek(date);
        return `${isoYear}-W${String(isoWeek).padStart(2, "0")}`;
      };

      for (const row of filteredRows) {
        const bucket = bucketDate(row[plan.dateColumn]);
        if (!bucket) continue;

        // Count trends count every row with a valid date. They do not require
        // a numeric target column.
        const value = aggregation === "count" ? 1 : toNumber(row[target!]);

        if (value === null) continue;

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
        first === 0 ? null : round(((last - first) / Math.abs(first)) * 100);

      const direction =
        last > first ? "increasing" : last < first ? "decreasing" : "stable";

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
          mismatches.push({
            row,
            expected: round(expected),
            actual,
            difference: round(difference),
          });
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

      const outlierLimit = typeof plan.limit === "number" ? plan.limit : 5;

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
          .filter(
            (entry) => entry.value < lowerFence || entry.value > upperFence,
          )
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
          `Found **${formatNumber(totalOutliers)}** statistical outlier${
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

    case "recommendation": {
      if (!target) {
        throw new Error("Recommendation requires a numeric target column.");
      }

      const targetValues = numericValues(filteredRows, target);
      if (!targetValues.length) {
        return {
          plan,
          matchedRows: filteredRows.length,
          result: { recommendation: null },
          answer: `I could not calculate a recommendation because **${target}** has no usable numeric values.`,
        };
      }

      const total = round(targetValues.reduce((sum, value) => sum + value, 0));
      const average = round(total / targetValues.length);

      const categoricalProfiles = profileColumns(filteredRows, columns).filter(
        (profile) => profile.kind === "categorical",
      );

      const dimensionResults = categoricalProfiles
        .filter((profile) => !/id$/i.test(profile.column.name))
        .map((profile) => {
          const groups = new Map<string, { label: unknown; values: number[] }>();
          for (const row of filteredRows) {
            const label = row[profile.column.name];
            const key = String(label ?? "(missing)");
            const value = toNumber(row[target!]);
            if (value === null) continue;
            const existing = groups.get(key);
            if (existing) existing.values.push(value);
            else groups.set(key, { label: label ?? "(missing)", values: [value] });
          }

          const ranked = Array.from(groups.values())
            .map((group) => ({
              group: group.label,
              total: round(group.values.reduce((sum, value) => sum + value, 0)),
              records: group.values.length,
            }))
            .sort((a, b) => b.total - a.total);

          return {
            column: profile.column.name,
            top: ranked[0] ?? null,
            bottom: ranked.length > 1 ? ranked[ranked.length - 1] : null,
          };
        })
        .filter((item) => item.top !== null)
        .slice(0, 3);

      const unitColumn = columns.find((column) =>
        /^(units?|quantity|qty|volume|unitssold)$/i.test(column.name.replace(/[ _-]/g, "")),
      )?.name;

      let revenuePerUnit: { column: string; value: number } | null = null;
      if (unitColumn) {
        const pairs = filteredRows
          .map((row) => ({ target: toNumber(row[target!]), units: toNumber(row[unitColumn]) }))
          .filter((pair): pair is { target: number; units: number } =>
            pair.target !== null && pair.units !== null && pair.units > 0,
          );
        if (pairs.length) {
          const targetSum = pairs.reduce((sum, pair) => sum + pair.target, 0);
          const unitSum = pairs.reduce((sum, pair) => sum + pair.units, 0);
          if (unitSum > 0) revenuePerUnit = { column: unitColumn, value: round(targetSum / unitSum) };
        }
      }

      const dateColumn = profileColumns(filteredRows, columns).find(
        (profile) => profile.kind === "date",
      )?.column.name;
      let trend: { first: number; last: number; changePercentage: number | null } | null = null;
      if (dateColumn) {
        const points = new Map<string, number>();
        for (const row of filteredRows) {
          const date = toDate(row[dateColumn]);
          const value = toNumber(row[target!]);
          if (!date || value === null) continue;
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
          points.set(key, (points.get(key) ?? 0) + value);
        }
        const ordered = Array.from(points.entries()).sort(([a], [b]) => a.localeCompare(b));
        if (ordered.length >= 2) {
          const first = ordered[0][1];
          const last = ordered[ordered.length - 1][1];
          trend = {
            first: round(first),
            last: round(last),
            changePercentage: first === 0 ? null : round(((last - first) / Math.abs(first)) * 100),
          };
        }
      }

      const lines: string[] = [];
      lines.push(`### How to improve ${target}`);
      lines.push(
        `Your current total **${target}** is **${formatNumber(total)}** across **${formatNumber(targetValues.length)}** records (average **${formatNumber(average)}**).`,
      );

      if (dimensionResults.length) {
        lines.push("");
        lines.push("**Where to focus**");
        for (const item of dimensionResults) {
          lines.push(
            `- **${item.column}**: **${formatValue(item.top!.group)}** generates the highest total **${target}** at **${formatNumber(item.top!.total)}**.` +
              (item.bottom ? ` The lowest is **${formatValue(item.bottom.group)}** at **${formatNumber(item.bottom.total)}**.` : ""),
          );
        }
      }

      if (revenuePerUnit) {
        lines.push("");
        lines.push(
          `**Unit economics:** ${target} is about **${formatNumber(revenuePerUnit.value)} per ${revenuePerUnit.column}** across the dataset.`,
        );
      }

      if (trend) {
        lines.push("");
        const direction = trend.last > trend.first ? "increased" : trend.last < trend.first ? "decreased" : "was stable";
        lines.push(
          `**Trend:** total ${target} ${direction} from **${formatNumber(trend.first)}** to **${formatNumber(trend.last)}** over the available periods` +
            (trend.changePercentage === null ? "." : ` (**${formatNumber(Math.abs(trend.changePercentage))}%** change).`),
        );
      }

      lines.push("");
      if (dimensionResults[0]?.top) {
        lines.push(
          `**Best action:** prioritize the strongest-performing **${dimensionResults[0].column}** segment (**${formatValue(dimensionResults[0].top.group)}**) and replicate what is working there. Pair that with targeted volume growth rather than trying to increase every segment equally.`,
        );
      } else {
        lines.push(
          `**Best action:** focus on the segments that generate the most **${target}**, then test whether additional volume can be added without reducing the value generated per unit.`,
        );
      }
      lines.push(
        "This is an evidence-based prioritization from the uploaded data, not a guarantee that the same result will hold outside this dataset.",
      );

      return {
        plan,
        matchedRows: filteredRows.length,
        result: {
          operation: "recommendation",
          targetColumn: target,
          total,
          average,
          dimensions: dimensionResults,
          revenuePerUnit,
          trend,
        },
        answer: lines.join("\n"),
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
      const dateProfiles = profiles.filter(
        (profile) => profile.kind === "date",
      );

      // Top correlations among all numeric column pairs.
      const correlations: { a: string; b: string; correlation: number }[] = [];
      for (let i = 0; i < numericProfiles.length; i += 1) {
        for (let j = i + 1; j < numericProfiles.length; j += 1) {
          const colA = numericProfiles[i].column.name;
          const colB = numericProfiles[j].column.name;
          const correlation = pearsonCorrelation(filteredRows, colA, colB);

          if (correlation !== null) {
            correlations.push({
              a: colA,
              b: colB,
              correlation: round(correlation),
            });
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

      // Trend: bucket every non-ID-like numeric column by month against the
      // first date column, then report on whichever one actually shows the
      // strongest relationship with time (bucket order vs. bucket average),
      // rather than arbitrarily reporting on whichever numeric column
      // happens to appear first in the schema.
      let trendSummary: {
        column: string;
        dateColumn: string;
        direction: "increasing" | "decreasing" | "stable";
        changePercentage: number | null;
      } | null = null;

      if (dateProfiles.length && numericProfiles.length) {
        const dateColumn = dateProfiles[0].column.name;
        const idLikeExcluded = numericProfiles.filter(
          (profile) => !/id$/i.test(profile.column.name),
        );
        const candidates = idLikeExcluded.length
          ? idLikeExcluded
          : numericProfiles;

        let best: {
          column: string;
          points: { period: string; value: number }[];
          strength: number;
        } | null = null;

        for (const profile of candidates) {
          const buckets = new Map<string, number[]>();
          for (const row of filteredRows) {
            const date = toDate(row[dateColumn]);
            const value = toNumber(row[profile.column.name]);
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
              value:
                values.reduce((sum, item) => sum + item, 0) / values.length,
            }))
            .sort((a, b) => a.period.localeCompare(b.period));

          if (points.length < 2) continue;

          const strength = Math.abs(
            correlationOfSeries(
              points.map((_, index) => index),
              points.map((point) => point.value),
            ),
          );

          if (!best || strength > best.strength) {
            best = { column: profile.column.name, points, strength };
          }
        }

        if (best) {
          const first = best.points[0].value;
          const last = best.points[best.points.length - 1].value;
          const changePercentage =
            first === 0
              ? null
              : round(((last - first) / Math.abs(first)) * 100);

          trendSummary = {
            column: best.column,
            dateColumn,
            direction:
              last > first
                ? "increasing"
                : last < first
                  ? "decreasing"
                  : "stable",
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
      // Use filteredRows (not the raw dataset) so a filtered description
      // ("describe West region employees") reports on the matching subset
      // rather than silently falling back to the whole dataset.
      const totalRows = filteredRows.length;

      const columnProfiles = profileColumns(filteredRows, columns);

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

        const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
        const [topValue, topCount] = sorted[0] ?? [null, 0];

        // Percentage is relative to this column's own non-missing
        // population (the same number shown as "records" next to it),
        // not the full dataset row count — otherwise a column with
        // missing values reports a percentage inconsistent with the
        // "N records / M missing" figure displayed alongside it.
        const nonMissingCount = profile.nonMissing.length;

        return {
          column: profile.column.name,
          uniqueCount: counts.size,
          topValue,
          topCount,
          topPercentage: nonMissingCount
            ? round((topCount / nonMissingCount) * 100)
            : 0,
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
          columns: columnProfiles.map((profile) => ({
            name: profile.column.name,
            type: profile.column.type,
            missing: profile.missingCount,
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
