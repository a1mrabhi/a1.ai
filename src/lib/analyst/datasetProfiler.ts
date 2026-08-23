import type { DatasetPreview } from './analystTypes';

export type ColumnProfile = {
  name: string;
  type: DatasetPreview['columns'][number]['type'];
  nonEmpty: number;
  missing: number;
  unique: number;
  min?: number;
  max?: number;
  average?: number;
};

export type DatasetProfile = {
  totalRows: number;
  totalColumns: number;
  missingCells: number;

  numericColumns: string[];
  categoricalColumns: string[];
  dateColumns: string[];

  profiles: ColumnProfile[];
};

export function profileDataset(
  dataset: DatasetPreview
): DatasetProfile {
  const rows = dataset.previewRows ?? [];
  const columns = dataset.columns ?? [];

  let missingCells = 0;

  const numericColumns: string[] = [];
  const categoricalColumns: string[] = [];
  const dateColumns: string[] = [];

  const profiles: ColumnProfile[] = [];

  for (const column of columns) {
    const values = rows.map((row) => row[column.name]);

    const nonEmptyValues = values.filter(
      (value) =>
        value !== null &&
        value !== undefined &&
        String(value).trim() !== ''
    );

    const missing = values.length - nonEmptyValues.length;

    missingCells += missing;

    const uniqueValues = new Set(
      nonEmptyValues.map((value) => String(value))
    );

    let type = column.type;

    /*
     * Prefer the parser's detected type.
     */
    if (type === 'number') {
      numericColumns.push(column.name);
    } else if (type === 'date') {
      dateColumns.push(column.name);
    } else if (type === 'string') {
      categoricalColumns.push(column.name);
    }

    const profile: ColumnProfile = {
      name: column.name,
      type,
      nonEmpty: nonEmptyValues.length,
      missing,
      unique: uniqueValues.size,
    };

    /*
     * Numeric statistics
     */
    if (type === 'number') {
      const numericValues = nonEmptyValues
        .map((value) => {
          if (typeof value === 'number') {
            return value;
          }

          const parsed = Number(
            String(value).replace(/,/g, '').trim()
          );

          return Number.isFinite(parsed) ? parsed : null;
        })
        .filter((value): value is number => value !== null);

      if (numericValues.length > 0) {
        const total = numericValues.reduce(
          (sum, value) => sum + value,
          0
        );

        profile.min = Math.min(...numericValues);
        profile.max = Math.max(...numericValues);
        profile.average = total / numericValues.length;
      }
    }

    profiles.push(profile);
  }

  return {
    totalRows: dataset.rowCount,
    totalColumns: dataset.columnCount,
    missingCells,
    numericColumns,
    categoricalColumns,
    dateColumns,
    profiles,
  };
}