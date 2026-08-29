export type DatasetColumnType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "unknown";

export type DatasetColumnSemantic =
  | "text"
  | "identifier"
  | "email"
  | "url"
  | "currency"
  | "percentage"
  | "unknown";

export type DatasetColumn = {
  name: string;
  type: DatasetColumnType;
  missing: number;
  semantic?: DatasetColumnSemantic;
};

export type DatasetPreview = {
  fileName: string;
  fileSize: number;
  rowCount: number;
  columnCount: number;
  columns: DatasetColumn[];
  previewRows: Record<string, unknown>[];
};

export type DatasetUploadResponse = {
  success: boolean;
  dataset: DatasetPreview;
  error?: string;
};

/* -------------------------------------------------------------------------- */
/* Deterministic analysis                                                     */
/* -------------------------------------------------------------------------- */

export type NumericColumnStats = {
  column: string;
  count: number;
  missing: number;

  sum: number;
  average: number;
  median: number;

  min: number;
  max: number;

  q1: number;
  q3: number;
  iqr: number;
  standardDeviation: number;

  outlierCount: number;
};

export type CategoricalValue = {
  value: string;
  count: number;
  percentage: number;
};

export type CategoricalColumnStats = {
  column: string;
  count: number;
  missing: number;
  unique: number;

  topValues: CategoricalValue[];
  rareValues: CategoricalValue[];
};

export type DateColumnStats = {
  column: string;
  count: number;
  missing: number;

  earliest: string | null;
  latest: string | null;
  uniqueDates: number;

  recordsByPeriod: {
    period: string;
    count: number;
  }[];
};

export type DatasetOutlier = {
  rowIndex: number;
  column: string;
  value: number;
  method: "iqr" | "zscore";
  score?: number;
  lowerBound?: number;
  upperBound?: number;
};

export type DatasetCorrelation = {
  columnA: string;
  columnB: string;
  coefficient: number;
  strength: "very-weak" | "weak" | "moderate" | "strong" | "very-strong";
  direction: "positive" | "negative" | "none";
};

export type DatasetTrend = {
  dateColumn: string;
  valueColumn: string;
  direction: "increasing" | "decreasing" | "stable" | "insufficient-data";
  changePercentage?: number;

  periods: {
    period: string;
    value: number;
  }[];
};

export type DatasetDuplicateStats = {
  duplicateRows: number;
  duplicateGroups: number;
};

export type DatasetQualityIssue = {
  type:
    | "missing-values"
    | "duplicate-rows"
    | "constant-column"
    | "mostly-empty-column"
    | "invalid-values"
    | "outliers";

  column?: string;
  count: number;
  percentage?: number;
  message: string;
};

export type DatasetQuality = {
  missingCells: number;
  duplicateRows: number;
  issues: DatasetQualityIssue[];
  status: "healthy" | "needs-attention";
};

export type DatasetAnalysis = {
  rowCount: number;
  columnCount: number;

  numericStats: NumericColumnStats[];
  categoricalStats: CategoricalColumnStats[];
  dateStats: DateColumnStats[];

  missingValues: {
    column: string;
    count: number;
    percentage: number;
  }[];

  outliers: DatasetOutlier[];
  correlations: DatasetCorrelation[];
  trends: DatasetTrend[];

  duplicates: DatasetDuplicateStats;
  quality: DatasetQuality;
};

export function normalizeColumnType(type: string): DatasetColumnType {
  switch (type.toLowerCase()) {
    case "string":
      return "string";

    case "number":
    case "numeric":
      return "number";

    case "boolean":
    case "bool":
      return "boolean";

    case "date":
    case "datetime":
      return "date";

    default:
      return "unknown";
  }
}
