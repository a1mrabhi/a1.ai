export type DatasetColumnType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "unknown";

export type DatasetColumn = {
  name: string;
  type: DatasetColumnType;
  missing: number;
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