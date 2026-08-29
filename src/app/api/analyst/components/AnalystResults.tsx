"use client";

import type { DatasetAnalysis } from "@/lib/analyst/analystTypes";

type AnalystResultsProps = {
  analysis: DatasetAnalysis;
};

export default function AnalystResults({
  analysis,
}: AnalystResultsProps) {
  return (
    <section className="analyst-results">
      <div className="results-header">
        <div>
          <span className="results-eyebrow">
            AI DATA ANALYSIS
          </span>

          <h2>Your dataset, understood.</h2>

          <p>
            A structured view of the most important characteristics
            found in your data.
          </p>
        </div>

        <div className="results-badge">
          <span />
          Analysis complete
        </div>
      </div>

      <div className="analysis-metrics">
        <div className="analysis-metric">
          <span>ROWS</span>
          <strong>{analysis.rowCount.toLocaleString()}</strong>
        </div>

        <div className="analysis-metric">
          <span>COLUMNS</span>
          <strong>{analysis.columnCount}</strong>
        </div>

        <div className="analysis-metric">
          <span>NUMERIC FIELDS</span>
          <strong>{analysis.numericStats.length}</strong>
        </div>

        <div className="analysis-metric">
          <span>CATEGORICAL FIELDS</span>
          <strong>{analysis.categoricalStats.length}</strong>
        </div>
      </div>

      <div className="analysis-section">
        <div className="analysis-section-header">
          <div>
            <span className="section-label">NUMERIC ANALYSIS</span>
            <h3>Key numerical statistics</h3>
          </div>
        </div>

        {analysis.numericStats.length === 0 ? (
          <div className="empty-analysis">
            No numeric columns were detected.
          </div>
        ) : (
          <div className="numeric-grid">
            {analysis.numericStats.map((stat) => (
              <div
                className="numeric-card"
                key={stat.column}
              >
                <div className="numeric-card-title">
                  <span>{stat.column}</span>
                </div>

                <div className="numeric-values">
                  <div>
                    <span>AVERAGE</span>
                    <strong>
                      {stat.average.toLocaleString()}
                    </strong>
                  </div>

                  <div>
                    <span>MEDIAN</span>
                    <strong>
                      {stat.median.toLocaleString()}
                    </strong>
                  </div>

                  <div>
                    <span>MIN</span>
                    <strong>
                      {stat.min.toLocaleString()}
                    </strong>
                  </div>

                  <div>
                    <span>MAX</span>
                    <strong>
                      {stat.max.toLocaleString()}
                    </strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="analysis-section">
        <div className="analysis-section-header">
          <div>
            <span className="section-label">
              CATEGORICAL ANALYSIS
            </span>

            <h3>What appears most often</h3>
          </div>
        </div>

        {analysis.categoricalStats.length === 0 ? (
          <div className="empty-analysis">
            No categorical columns were detected.
          </div>
        ) : (
          <div className="categorical-grid">
            {analysis.categoricalStats.map((stat) => (
              <div
                className="categorical-card"
                key={stat.column}
              >
                <div className="categorical-card-header">
                  <div>
                    <span className="column-name">
                      {stat.column}
                    </span>

                    <span className="unique-count">
                      {stat.unique} unique values
                    </span>
                  </div>
                </div>

                <div className="top-values">
                  {stat.topValues.slice(0, 5).map((item) => (
                    <div
                      className="top-value"
                      key={`${stat.column}-${item.value}`}
                    >
                      <span>{item.value}</span>
                      <strong>{item.count}</strong>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="analysis-section">
        <div className="analysis-section-header">
          <div>
            <span className="section-label">
              DATA QUALITY
            </span>

            <h3>Missing values</h3>
          </div>
        </div>

        <div className="missing-list">
          {analysis.missingValues.map((item) => (
            <div
              className="missing-row"
              key={item.column}
            >
              <div className="missing-name">
                <span>{item.column}</span>
              </div>

              <div className="missing-bar">
                <span
                  style={{
                    width: `${Math.min(
                      item.percentage,
                      100,
                    )}%`,
                  }}
                />
              </div>

              <div className="missing-value">
                {item.percentage}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}