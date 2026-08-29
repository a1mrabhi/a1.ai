import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";
import { prisma } from "@/lib/prisma";
import { analyzeDataset } from "@/lib/analyst/datasetAnalyzer";
import type { DatasetColumn } from "@/lib/analyst/analystTypes";
import {
  createQueryPlan,
  executeQueryPlan,
} from "@/lib/analyst/datasetQueryEngine";

type AnalyzeChatRequest = {
  question: string;
  datasetId: string;
};

type DataRow = Record<string, unknown>;

type FilterCondition =
  | {
      kind: "number";
      column: string;
      operator: ">" | ">=" | "<" | "<=" | "=" | "!=";
      value: number;
    }
  | {
      kind: "text";
      column: string;
      operator: "=" | "!=";
      value: string;
    };

type QueryResult = {
  handled: boolean;
  answer?: string;
  result?: unknown;
};

function parseStoredColumns(value: unknown): DatasetColumn[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (column): column is DatasetColumn =>
      typeof column === "object" &&
      column !== null &&
      typeof (column as { name?: unknown }).name === "string" &&
      typeof (column as { type?: unknown }).type === "string",
  );
}

function parseStoredRows(value: unknown): DataRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (row): row is DataRow =>
      typeof row === "object" && row !== null && !Array.isArray(row),
  );
}

/**
 * Find a real dataset column using a case-insensitive comparison.
 * This lets users write:
 *
 * performance_score
 * Performance_Score
 * PERFORMANCE SCORE
 *
 * while still using the actual dataset column.
 */
function findColumn(
  columns: DatasetColumn[],
  requestedName: string,
): string | null {
  const normalizedRequested = requestedName
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

  const match = columns.find((column) => {
    const normalizedColumn = column.name
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "");

    return normalizedColumn === normalizedRequested;
  });

  return match?.name ?? null;
}

/**
 * Convert a stored value into a number.
 */
function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const cleaned = value.trim().replace(/,/g, "");

    if (!cleaned) {
      return null;
    }

    const number = Number(cleaned);

    return Number.isFinite(number) ? number : null;
  }

  return null;
}

/**
 * Compare two numeric values.
 */
function compareNumbers(
  actual: number,
  operator: ">" | ">=" | "<" | "<=" | "=" | "!=",
  expected: number,
): boolean {
  switch (operator) {
    case ">":
      return actual > expected;

    case ">=":
      return actual >= expected;

    case "<":
      return actual < expected;

    case "<=":
      return actual <= expected;

    case "=":
      return actual === expected;

    case "!=":
      return actual !== expected;

    default:
      return false;
  }
}

/**
 * Compare text values case-insensitively.
 */
function compareText(
  actual: unknown,
  operator: "=" | "!=",
  expected: string,
): boolean {
  if (actual === null || actual === undefined) {
    return operator === "!=";
  }

  const actualText = String(actual).trim().toLowerCase();
  const expectedText = expected.trim().toLowerCase();

  if (operator === "=") {
    return actualText === expectedText;
  }

  return actualText !== expectedText;
}

/**
 * Try to extract a numeric condition from natural language.
 *
 * Examples:
 *
 * Performance_Score above 90
 * Performance_Score > 90
 * Performance Score greater than 90
 * Quantity below 20
 */
function parseNumericCondition(
  question: string,
  columns: DatasetColumn[],
): FilterCondition | null {
  const operators = [
    {
      regex: /(?:above|over|greater\s+than|more\s+than)\s+(-?\d+(?:\.\d+)?)/i,
      operator: ">" as const,
    },
    {
      regex:
        /(?:at\s+least|greater\s+than\s+or\s+equal\s+to)\s+(-?\d+(?:\.\d+)?)/i,
      operator: ">=" as const,
    },
    {
      regex: /(?:below|under|less\s+than|lower\s+than)\s+(-?\d+(?:\.\d+)?)/i,
      operator: "<" as const,
    },
    {
      regex: /(?:at\s+most|less\s+than\s+or\s+equal\s+to)\s+(-?\d+(?:\.\d+)?)/i,
      operator: "<=" as const,
    },
  ];

  for (const column of columns) {
    const escapedName = column.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const directPatterns = [
      new RegExp(
        `${escapedName}\\s*(?:is\\s*)?(>|>=|<|<=|=|!=)\\s*(-?\\d+(?:\\.\\d+)?)`,
        "i",
      ),
      new RegExp(
        `${escapedName.replace(/[_-]/g, "[ _-]?")}\\s+(above|over|below|under|greater\\s+than|less\\s+than)\\s+(-?\\d+(?:\\.\\d+)?)`,
        "i",
      ),
    ];

    for (const pattern of directPatterns) {
      const match = question.match(pattern);

      if (!match) {
        continue;
      }

      const first = match[1].toLowerCase();
      const number = Number(match[2]);

      if (!Number.isFinite(number)) {
        continue;
      }

      if (first === "above" || first === "over" || first === "greater than") {
        return {
          kind: "number",
          column: column.name,
          operator: ">",
          value: number,
        };
      }

      if (first === "below" || first === "under" || first === "less than") {
        return {
          kind: "number",
          column: column.name,
          operator: "<",
          value: number,
        };
      }

      if (
        first === ">" ||
        first === ">=" ||
        first === "<" ||
        first === "<=" ||
        first === "=" ||
        first === "!="
      ) {
        return {
          kind: "number",
          column: column.name,
          operator: first,
          value: number,
        };
      }
    }

    const columnIndex = question
      .toLowerCase()
      .indexOf(column.name.toLowerCase());

    if (columnIndex === -1) {
      continue;
    }

    const remainingQuestion = question.slice(columnIndex + column.name.length);

    for (const item of operators) {
      const match = remainingQuestion.match(item.regex);

      if (!match) {
        continue;
      }

      const number = Number(match[1]);

      if (!Number.isFinite(number)) {
        continue;
      }

      return {
        kind: "number",
        column: column.name,
        operator: item.operator,
        value: number,
      };
    }
  }

  return null;
}

/**
 * Extract category equality from phrases such as:
 *
 * Region is West
 * Region = West
 * in the West region
 * from the West region
 */
function parseTextConditions(
  question: string,
  columns: DatasetColumn[],
): FilterCondition[] {
  const conditions: FilterCondition[] = [];

  for (const column of columns) {
    const escapedName = column.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const equalityPattern = new RegExp(
      `${escapedName}\\s*(?:is|equals|=|equal\\s+to)\\s*["']?([^"',?.]+)["']?`,
      "i",
    );

    const equalityMatch = question.match(equalityPattern);

    if (equalityMatch) {
      const value = equalityMatch[1].trim();

      if (value) {
        conditions.push({
          kind: "text",
          column: column.name,
          operator: "=",
          value,
        });

        continue;
      }
    }

    /*
     * Special natural-language pattern:
     *
     * "are in the West region"
     * "in the West region"
     *
     * We only apply this when the dataset has a column named Region.
     */
    if (column.name.toLowerCase() === "region") {
      const regionMatch = question.match(
        /\b(?:in|from|within)\s+(?:the\s+)?([a-zA-Z][a-zA-Z0-9 _-]*?)\s+region\b/i,
      );

      if (regionMatch) {
        conditions.push({
          kind: "text",
          column: column.name,
          operator: "=",
          value: regionMatch[1].trim(),
        });
      }
    }
  }

  return conditions;
}

/**
 * Execute simple deterministic questions locally.
 *
 * This is the important part:
 *
 * 20,000 rows NEVER go to Gemini.
 *
 * The server calculates the answer first.
 */
function executeDeterministicQuery(
  question: string,
  rows: DataRow[],
  columns: DatasetColumn[],
): QueryResult {
  const lowerQuestion = question.toLowerCase();

  const numericCondition = parseNumericCondition(question, columns);
  const textConditions = parseTextConditions(question, columns);

  const conditions: FilterCondition[] = [];

  if (numericCondition) {
    conditions.push(numericCondition);
  }

  conditions.push(...textConditions);

  /*
   * COUNT + filters
   *
   * Examples:
   * "How many records have Performance_Score above 90?"
   *
   * "How many records have Performance_Score above 90
   *  and are in the West region?"
   */
  const asksCount =
    /\bhow\s+many\b/i.test(question) ||
    /\bcount\b/i.test(question) ||
    /\bnumber\s+of\s+records\b/i.test(question);

  if (asksCount && conditions.length > 0) {
    const matchingRows = rows.filter((row) => {
      return conditions.every((condition) => {
        const value = row[condition.column];

        if (condition.kind === "number") {
          const actual = toNumber(value);

          if (actual === null) {
            return false;
          }

          return compareNumbers(actual, condition.operator, condition.value);
        }

        return compareText(value, condition.operator, condition.value);
      });
    });

    const conditionText = conditions
      .map((condition) => {
        if (condition.kind === "number") {
          return `\`${condition.column}\` ${condition.operator} ${condition.value}`;
        }

        return `\`${condition.column}\` = "${condition.value}"`;
      })
      .join(" and ");

    return {
      handled: true,
      result: {
        operation: "count",
        conditions,
        count: matchingRows.length,
      },
      answer: `**${matchingRows.length.toLocaleString()}** records match ${conditionText}.`,
    };
  }

  /*
   * If the user asks for a filtered average, calculate it locally.
   */
  if (/\baverage\b|\bmean\b/i.test(lowerQuestion) && conditions.length > 0) {
    const targetColumn = columns.find((column) =>
      lowerQuestion.includes(column.name.toLowerCase()),
    );

    if (targetColumn) {
      const matchingRows = rows.filter((row) =>
        conditions.every((condition) => {
          const value = row[condition.column];

          if (condition.kind === "number") {
            const actual = toNumber(value);

            return (
              actual !== null &&
              compareNumbers(actual, condition.operator, condition.value)
            );
          }

          return compareText(value, condition.operator, condition.value);
        }),
      );

      const values = matchingRows
        .map((row) => toNumber(row[targetColumn.name]))
        .filter((value): value is number => value !== null);

      if (values.length > 0) {
        const average =
          values.reduce((sum, value) => sum + value, 0) / values.length;

        return {
          handled: true,
          result: {
            operation: "average",
            column: targetColumn.name,
            conditions,
            matchingRecords: matchingRows.length,
            average,
          },
          answer: `The average **${targetColumn.name}** for the matching records is **${average.toLocaleString(
            undefined,
            {
              maximumFractionDigits: 2,
            },
          )}**.`,
        };
      }
    }
  }

  return {
    handled: false,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnalyzeChatRequest;

    const question = body.question?.trim();
    const datasetId = body.datasetId?.trim();

    if (!question) {
      return NextResponse.json(
        {
          success: false,
          error: "Please enter a question about your dataset.",
        },
        { status: 400 },
      );
    }

    if (!datasetId) {
      return NextResponse.json(
        {
          success: false,
          error: "A dataset is required for this question.",
        },
        { status: 400 },
      );
    }

    const user = await getOrCreateUser();

    /*
     * Fetch only the dataset belonging to the current user.
     */
    const dataset = await prisma.analystDataset.findFirst({
      where: {
        id: datasetId,
        userId: user.id,
      },
      select: {
        id: true,
        fileName: true,
        rowCount: true,
        columnCount: true,
        columns: true,
        rows: true,
      },
    });

    if (!dataset) {
      return NextResponse.json(
        {
          success: false,
          error: "Dataset not found or access denied.",
        },
        { status: 404 },
      );
    }

    const columns = parseStoredColumns(dataset.columns);
    const rows = parseStoredRows(dataset.rows);

    if (!rows.length || !columns.length) {
      return NextResponse.json(
        {
          success: false,
          error: "The selected dataset does not contain usable data.",
        },
        { status: 400 },
      );
    }

    /*
     * ------------------------------------------------------------
     * STEP 1
     * Deterministic server-side query.
     *
     * This is where the 20,000 rows are actually examined.
     * Gemini does NOT receive them.
     * ------------------------------------------------------------
     */

    const deterministicResult = executeDeterministicQuery(
      question,
      rows,
      columns,
    );

    if (deterministicResult.handled) {
      return NextResponse.json({
        success: true,
        answer: deterministicResult.answer,
        result: deterministicResult.result,
        source: "server-analysis",
      });
    }

    /*
     * ------------------------------------------------------------
     * STEP 2
     * If the small built-in patterns above do not handle the question,
     * use Gemini only to create a compact query plan.
     *
     * Gemini never receives the raw dataset rows.
     * ------------------------------------------------------------
     */

    const analysis = analyzeDataset(rows, columns);

    const queryPlan = await createQueryPlan(question, columns, analysis);

    /*
     * ------------------------------------------------------------
     * STEP 3
     * Execute the AI-generated plan against ALL rows on the server.
     * The server result is the source of truth.
     * ------------------------------------------------------------
     */

    const execution = executeQueryPlan(queryPlan, rows, columns);

    return NextResponse.json({
      success: true,
      answer: execution.answer,
      result: execution.result,
      matchedRows: execution.matchedRows,
      queryPlan: execution.plan,
      source: "server-query-engine",
    });
  } catch (error) {
    console.error("Dataset chat error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to answer the dataset question.",
      },
      { status: 500 },
    );
  }
}
