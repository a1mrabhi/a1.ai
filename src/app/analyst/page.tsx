"use client";

import {
  useEffect,
  useRef,
  useState,
  MouseEvent as ReactMouseEvent,
} from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import type { DatasetColumn } from "@/lib/analyst/analystTypes";

type DatasetInfo = {
  fileName: string;
  sheetName: string;
  rowCount: number;
  columnCount: number;
  columns: DatasetColumn[];
  previewRows: Record<string, unknown>[];
};

/* ------------------------------------------------------------------ */
/* Reveal-on-scroll hook (re-runs whenever `dep` changes so elements   */
/* mounted later — like the dataset result — get observed too)         */
/* ------------------------------------------------------------------ */

function useReveal(dep: unknown) {
  useEffect(() => {
    const els = document.querySelectorAll("[data-reveal]");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -30px 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);
}

/* ------------------------------------------------------------------ */
/* Icons                                                                */
/* ------------------------------------------------------------------ */

function ArrowLeftIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 12H5M11 18l-6-6 6-6" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function UploadCloudIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 17.5a4.5 4.5 0 0 1-.6-8.96 5.5 5.5 0 0 1 10.7-1.65A4.5 4.5 0 0 1 17.5 17.5H7Z" />
      <path d="M12 11v7" />
      <path d="m9 14 3-3 3 3" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function CheckBadgeIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path className="check-path" d="M5 13l4 4L19 7" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                       */
/* ------------------------------------------------------------------ */

export default function AnalystPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadCardRef = useRef<HTMLDivElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dataset, setDataset] = useState<DatasetInfo | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showScrollCue, setShowScrollCue] = useState(false);

  useReveal(dataset);

  // Show the "scroll to results" cue exactly once, right when a dataset
  // finishes uploading. It never reappears from the user scrolling around —
  // only a fresh upload (dataset going from null -> a new value) resets it.
  useEffect(() => {
    if (dataset) {
      setShowScrollCue(true);
    } else {
      setShowScrollCue(false);
    }
  }, [dataset]);

  const scrollToResults = () => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "smooth",
    });
    setShowScrollCue(false);
  };

  const handleFile = async (selectedFile: File | undefined) => {
    if (!selectedFile) return;

    setError("");
    setDataset(null);

    const allowedExtensions = ["csv", "xls", "xlsx"];
    const extension = selectedFile.name.split(".").pop()?.toLowerCase();

    if (!extension || !allowedExtensions.includes(extension)) {
      setError("Please upload a CSV or Excel file.");
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("File is too large. Maximum file size is 10 MB.");
      return;
    }

    setFile(selectedFile);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/analyst/dataset-upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to process the dataset.");
      }

      setDataset(data.dataset);
    } catch (err) {
      console.error("Dataset upload failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while processing the dataset.",
      );
      setFile(null);
    } finally {
      setLoading(false);
    }
  };

  const resetFile = () => {
    setFile(null);
    setDataset(null);
    setError("");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const onCardMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    const el = uploadCardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  const isReady = !!dataset && !loading;

  return (
    <>
      <style>{CSS}</style>

      <div className="grain" aria-hidden="true" />

      {/* HEADER — shared with dashboard */}
      <header>
        <div className="container nav">
          <Link href="/" className="logo">
            <span className="mark">
              <span className="mark-core" />
            </span>
            A1.ai
          </Link>

          <div className="page-badge">
            <span className="dot" />
            AI DATA ANALYST
          </div>

          <div className="nav-actions">
            <Link href="/dashboard" className="dash-link">
              <ArrowLeftIcon />
              <span>Dashboard</span>
            </Link>
            <UserButton appearance={{ elements: { avatarBox: "w-9 h-9" } }} />
          </div>
        </div>
      </header>

      <main className="analyst-page">
        {/* HERO */}
        <section className="hero">
          <div className="aurora" aria-hidden="true">
            <span className="blob blob-violet" />
            <span className="blob blob-amber" />
            <span className="blob blob-cyan" />
            <div className="grid-floor" />
            <span className="beam beam-l" />
            <span className="beam beam-r" />
            <span className="particle p1" />
            <span className="particle p2" />
            <span className="particle p3" />
            <span className="particle p4" />
          </div>

          <div className="container hero-inner">
            <h1 className="hero-enter-2" key={isReady ? "ready-h1" : "empty-h1"}>
              {isReady ? (
                <>
                  Your data is ready.
                  <span className="grad-text">Let&rsquo;s discover what matters.</span>
                </>
              ) : (
                <>
                  Understand your data.
                  <span className="grad-text">Discover what matters.</span>
                </>
              )}
            </h1>

            <p
              className="hero-sub hero-enter-3"
              key={isReady ? "ready-p" : "empty-p"}
            >
              {isReady
                ? "Your dataset has been parsed successfully. Review the structure and preview below, then let A1.ai uncover the insights."
                : "Upload a CSV or Excel dataset and let A1.ai find patterns, trends, anomalies, and useful insights."}
            </p>
          </div>
        </section>

        <div className="container analyst-container">
          {/* hidden input lives outside the conditional so both the big
              card and the compact bar can trigger it */}
          <input
            ref={inputRef}
            type="file"
            hidden
            accept=".csv,.xls,.xlsx"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />

          {isReady ? (
            /* ---------------- COMPACT SUCCESS BAR ---------------- */
            <div className="upload-compact" data-reveal>
              <div className="uc-left">
                <div className="uc-icon">
                  <CheckBadgeIcon />
                  <span className="uc-icon-ring" />
                </div>
                <div className="uc-text">
                  <span className="uc-name">{dataset!.fileName}</span>
                  <span className="uc-meta">
                    {dataset!.rowCount} rows · {dataset!.columnCount} cols ·{" "}
                    {dataset!.sheetName}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="uc-change"
                onClick={() => inputRef.current?.click()}
              >
                Choose another file
                <ArrowIcon />
              </button>
            </div>
          ) : (
            /* ---------------- BIG UPLOAD CARD (empty / loading) ---------------- */
            <div
              ref={uploadCardRef}
              className={`upload-card ${loading ? "is-loading" : ""} ${dragActive ? "is-drag" : ""}`}
              onMouseMove={onCardMove}
              onClick={() => {
                if (!loading) inputRef.current?.click();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (!loading) setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                if (!loading) handleFile(e.dataTransfer.files?.[0]);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !loading) {
                  inputRef.current?.click();
                }
              }}
            >
              <div className="upload-dots" aria-hidden="true" />
              <div className="upload-spot" aria-hidden="true" />
              <span className="upload-particle up1" aria-hidden="true" />
              <span className="upload-particle up2" aria-hidden="true" />
              <span className="upload-particle up3" aria-hidden="true" />
              <span className="upload-border-glow" aria-hidden="true" />
              <span className="upload-topline" aria-hidden="true" />

              {!file ? (
                <>
                  <div className="upload-icon">
                    <UploadCloudIcon />
                    <span className="upload-icon-ring" />
                  </div>
                  <h2>Drop your dataset here</h2>
                  <p>or click to choose a file</p>
                  <span className="upload-formats">CSV · XLS · XLSX</span>
                </>
              ) : (
                <>
                  <div className="upload-icon loading-icon">
                    <span className="spinner" />
                  </div>
                  <h2>Understanding your dataset...</h2>
                  <p>Reading columns, rows, and data structure</p>
                  <span className="upload-formats">{file.name}</span>
                </>
              )}
            </div>
          )}

          {/* ERROR */}
          {error && (
            <div className="error-card">
              <span>!</span>
              <p>{error}</p>
            </div>
          )}

          {/* DATASET RESULT */}
          {dataset && !loading && (
            <section className="dataset-result">
              {/* RESULT HEADER */}
              <div className="result-header" data-reveal>
                <div>
                  <div className="ready-label">
                    <span className="status-dot" />
                    DATASET READY
                  </div>
                  <h2>{dataset.fileName}</h2>
                  <p>{dataset.sheetName} · Dataset successfully parsed</p>
                </div>
              </div>

              {/* STAT CARDS */}
              <div className="stats-grid">
                {[
                  {
                    label: "ROWS",
                    value: dataset.rowCount,
                    sub: "records detected",
                  },
                  {
                    label: "COLUMNS",
                    value: dataset.columnCount,
                    sub: "fields detected",
                  },
                  { label: "SHEET", value: 1, sub: dataset.sheetName },
                  {
                    label: "STATUS",
                    value: "Ready",
                    sub: "awaiting analysis",
                    ready: true,
                  },
                ].map((s, i) => (
                  <div
                    className="stat-card"
                    data-reveal
                    style={{ transitionDelay: `${i * 70}ms` }}
                    key={s.label}
                  >
                    <span>{s.label}</span>
                    <strong className={s.ready ? "ready-text" : ""}>
                      {s.value}
                    </strong>
                    <small>{s.sub}</small>
                  </div>
                ))}
              </div>

              {/* COLUMNS */}
              <div className="columns-card" data-reveal>
                <div className="section-heading">
                  <div>
                    <span>DATA STRUCTURE</span>
                    <h3>Detected columns</h3>
                  </div>
                  <small>{dataset.columnCount} fields</small>
                </div>

                <div className="columns-list">
                  {dataset.columns.map((column, index) => (
                    <div
                      className="column-item"
                      key={`${column.name}-${index}`}
                      style={{ transitionDelay: `${index * 25}ms` }}
                    >
                      <span className="column-icon">#</span>
                      <div className="column-content">
                        <span className="column-name">{column.name}</span>
                        <span className="column-meta">
                          <span className="column-type">{column.type}</span>
                          <span className="column-missing">
                            {column.missing} missing
                          </span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* PREVIEW */}
              {dataset.previewRows.length > 0 && (
                <div className="preview-card" data-reveal>
                  <div className="section-heading">
                    <div>
                      <span>DATA PREVIEW</span>
                      <h3>First records</h3>
                    </div>
                    <small>
                      Showing {Math.min(dataset.previewRows.length, 20)} rows
                    </small>
                  </div>

                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          {dataset.columns.map((column, index) => (
                            <th key={`${column.name}-${index}`}>
                              {column.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {dataset.previewRows.map((row, index) => (
                          <tr key={index}>
                            {dataset.columns.map((column, columnIndex) => (
                              <td key={`${column.name}-${columnIndex}`}>
                                {formatValue(row[column.name])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* NEXT STEP */}
              <div className="analysis-cta" data-reveal>
                <div className="cta-glow" aria-hidden="true" />
                <div>
                  <span className="cta-eyebrow">NEXT STEP</span>
                  <h3>Ready to discover what matters?</h3>
                  <p>
                    A1.ai will analyze your dataset for patterns, trends,
                    anomalies, and insights.
                  </p>
                </div>

                <button
                  className="analyze-button"
                  disabled
                  title="Coming in the next step"
                >
                  Analyze Dataset
                  <ArrowIcon />
                </button>
              </div>
            </section>
          )}
        </div>
      </main>

      {/* SCROLL CUE — appears once, right after a successful upload */}
      {showScrollCue && (
        <button
          type="button"
          className="scroll-cue"
          onClick={scrollToResults}
          aria-label="Scroll down to see the dataset results"
        >
          <ChevronDownIcon />
        </button>
      )}
    </>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/* ------------------------------------------------------------------ */
/* Styles — shares design tokens/header with the dashboard             */
/* ------------------------------------------------------------------ */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,500;0,600;0,700;1,500&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

:root{
  --bg:#05070E;
  --bg-alt:#0A0F1E;
  --surface: rgba(255,255,255,0.035);
  --surface-solid:#101526;
  --border: rgba(148,163,196,0.14);
  --border-hover: rgba(140,124,240,0.5);
  --text-primary:#F1F3FA;
  --text-secondary:#98A2C3;
  --text-tertiary:#5C6790;
  --amber:#FFC857;
  --amber-dim: rgba(255,200,87,0.12);
  --violet:#8C7CF0;
  --violet-dim: rgba(140,124,240,0.14);
  --cyan:#54E8D6;
  --cyan-dim: rgba(84,232,214,0.12);
  --font-display:'Fraunces', serif;
  --font-body:'Inter', sans-serif;
  --font-mono:'IBM Plex Mono', monospace;
}

html{ scroll-behavior:smooth; background:var(--bg); }
*{ box-sizing:border-box; }
body{
  background:var(--bg); color:var(--text-primary); font-family:var(--font-body);
  -webkit-font-smoothing:antialiased;
}
.container{ max-width:1180px; margin:0 auto; padding:0 28px; }

.grain{
  position:fixed; inset:0; pointer-events:none; z-index:200; opacity:.035; mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

/* ---------- Header ---------- */
header{ position:sticky; top:0; z-index:50; background:rgba(5,7,14,0.72); backdrop-filter:blur(14px) saturate(140%); border-bottom:1px solid var(--border); }
.nav{ display:flex; align-items:center; gap:24px; height:68px; }
.logo{ display:flex; align-items:center; gap:10px; font-family:var(--font-display); font-weight:600; font-size:19px; color:var(--text-primary); text-decoration:none; flex-shrink:0; }
.mark{ width:24px; height:24px; border-radius:7px; position:relative; background:conic-gradient(from 180deg, var(--amber), var(--violet), var(--cyan), var(--amber)); flex-shrink:0; animation:markSpin 6s linear infinite; padding:2px; }
.mark-core{ position:absolute; inset:2px; border-radius:5px; background:var(--bg); }
@keyframes markSpin{ to{ transform:rotate(360deg);} }

.page-badge{
  flex:1; max-width:420px; margin:0 auto; display:flex; align-items:center; justify-content:center; gap:9px;
  font-family:var(--font-mono); font-size:11.5px; letter-spacing:.1em; color:var(--violet);
  background:var(--violet-dim); border:1px solid rgba(140,124,240,.3); border-radius:99px; padding:9px 16px;
}
.page-badge .dot{ width:6px; height:6px; border-radius:50%; background:var(--cyan); box-shadow:0 0 0 0 rgba(84,232,214,.6); animation:pulseDot 2s ease-out infinite; }
@keyframes pulseDot{ 0%{ box-shadow:0 0 0 0 rgba(255,200,87,.55);} 70%{ box-shadow:0 0 0 8px rgba(255,200,87,0);} 100%{ box-shadow:0 0 0 0 rgba(255,200,87,0);} }

.nav-actions{ display:flex; align-items:center; gap:16px; flex-shrink:0; }
.dash-link{
  display:flex; align-items:center; gap:7px; font-family:var(--font-body); font-weight:600; font-size:13.5px;
  color:var(--text-secondary); text-decoration:none; border:1px solid var(--border); background:var(--surface);
  border-radius:10px; padding:9px 14px; transition:border-color .2s ease, color .2s ease, transform .15s ease;
}
.dash-link:hover{ border-color:var(--border-hover); color:var(--text-primary); transform:translateX(-2px); }

/* ---------- Aurora / grid floor ---------- */
.aurora{ position:absolute; inset:0; overflow:hidden; z-index:0; pointer-events:none; }
.blob{ position:absolute; border-radius:50%; filter:blur(90px); opacity:.24; animation:blobFloat 16s ease-in-out infinite; }
.blob-violet{ width:380px; height:380px; background:var(--violet); top:-120px; left:6%; }
.blob-amber{ width:320px; height:320px; background:var(--amber); top:-60px; right:8%; opacity:.18; animation-delay:-5s; }
.blob-cyan{ width:280px; height:280px; background:var(--cyan); bottom:-140px; left:42%; opacity:.14; animation-delay:-10s; }
@keyframes blobFloat{ 0%,100%{ transform:translate(0,0) scale(1);} 50%{ transform:translate(20px,-24px) scale(1.06);} }
.grid-floor{
  position:absolute; inset:0;
  background-image:linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px);
  background-size:56px 56px; mask-image:radial-gradient(ellipse 70% 60% at 50% 0%, black 30%, transparent 75%); opacity:.4;
}
.beam{
  position:absolute; top:4%; bottom:4%; width:1px;
  background:linear-gradient(to bottom, transparent, var(--violet) 45%, var(--cyan) 55%, transparent);
  opacity:.2; filter:blur(1px); animation:beamPulse 5s ease-in-out infinite;
}
.beam::before{ content:''; position:absolute; inset:-1px -22px; background:inherit; filter:blur(26px); opacity:.7; }
.beam-l{ left:44px; }
.beam-r{ right:44px; animation-delay:-2.4s; }
@keyframes beamPulse{ 0%,100%{ opacity:.12; transform:scaleY(.94);} 50%{ opacity:.28; transform:scaleY(1);} }
.particle{
  position:absolute; width:3px; height:3px; border-radius:50%; background:var(--cyan);
  box-shadow:0 0 8px 1px rgba(84,232,214,.5); opacity:0; animation:particleDrift 9s ease-in-out infinite;
}
.p1{ left:6%; top:30%; animation-delay:0s; background:var(--violet); box-shadow:0 0 8px 1px rgba(140,124,240,.5); }
.p2{ left:11%; top:70%; animation-delay:-2s; }
.p3{ right:7%; top:24%; animation-delay:-4.5s; background:var(--amber); box-shadow:0 0 8px 1px rgba(255,200,87,.5); }
.p4{ right:12%; top:66%; animation-delay:-1.2s; }
@keyframes particleDrift{
  0%{ opacity:0; transform:translateY(10px); }
  15%{ opacity:.7; }
  50%{ opacity:.45; transform:translateY(-16px); }
  85%{ opacity:.7; }
  100%{ opacity:0; transform:translateY(-30px); }
}
@media (max-width:1300px){ .beam, .particle{ display:none; } }

/* ---------- Hero ---------- */
.hero{ position:relative; padding:72px 0 44px; overflow:hidden; }
.hero-inner{ position:relative; z-index:1; text-align:center; }
.eyebrow{
  display:inline-flex; align-items:center; gap:9px; font-family:var(--font-mono); font-size:11.5px;
  letter-spacing:.08em; text-transform:uppercase; color:var(--violet); background:var(--violet-dim);
  border:1px solid rgba(140,124,240,.3); border-radius:99px; padding:7px 14px 7px 11px; margin-bottom:24px;
}
.eyebrow .dot{ width:6px; height:6px; border-radius:50%; background:var(--cyan); box-shadow:0 0 0 0 rgba(84,232,214,.6); animation:pulseDot 2s ease-out infinite; }

.hero h1{
  font-family:var(--font-display); font-weight:600; font-size:clamp(38px,5.4vw,64px);
  line-height:1.06; letter-spacing:-.02em; margin:0 0 20px;
}
.grad-text{ display:block; margin-top:6px; background:linear-gradient(100deg, var(--amber), var(--violet) 55%, var(--cyan)); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; }
.hero-sub{ max-width:640px; margin:0 auto; color:var(--text-secondary); line-height:1.7; font-size:15.5px; }

.hero-enter, .hero-enter-2, .hero-enter-3{ opacity:0; transform:translateY(14px); animation:riseIn .7s cubic-bezier(.16,1,.3,1) forwards; }
.hero-enter-2{ animation-delay:.08s; }
.hero-enter-3{ animation-delay:.18s; }
@keyframes riseIn{ to{ opacity:1; transform:translateY(0);} }

/* ---------- Analyst body ---------- */
.analyst-container{ position:relative; z-index:1; padding-bottom:120px; }

/* ---------- Upload (empty / loading) ---------- */
.upload-card{
  position:relative; min-height:300px; border:1px solid rgba(255,255,255,.09); border-radius:22px;
  background:
    linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,0) 40%),
    radial-gradient(560px circle at 18% 0%, rgba(140,124,240,.09), transparent 60%),
    radial-gradient(560px circle at 100% 100%, rgba(84,232,214,.06), transparent 55%),
    var(--surface);
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  text-align:center; cursor:pointer; padding:40px; overflow:hidden;
  box-shadow:0 1px 0 0 rgba(255,255,255,.05) inset;
  transition:border-color .25s ease, background .25s ease, transform .25s ease, box-shadow .25s ease;
  animation:cardEnter .7s cubic-bezier(.16,1,.3,1) both, cardDrift 10s ease-in-out infinite;
}
@keyframes cardEnter{ from{ opacity:0; transform:translateY(18px) scale(.985); } to{ opacity:1; transform:translateY(0) scale(1); } }
@keyframes cardDrift{
  0%,100%{ border-color:rgba(140,124,240,.28); box-shadow:0 1px 0 0 rgba(255,255,255,.05) inset, 0 34px 70px -38px rgba(140,124,240,.24); }
  50%{ border-color:rgba(255,200,87,.28); box-shadow:0 1px 0 0 rgba(255,255,255,.05) inset, 0 34px 70px -38px rgba(255,200,87,.2); }
}
.upload-dots{
  position:absolute; inset:0; pointer-events:none;
  background-image: radial-gradient(rgba(255,200,87,.14) 1px, transparent 1px);
  background-size:24px 24px;
  mask-image: radial-gradient(ellipse 65% 65% at 50% 42%, black 15%, transparent 75%);
  opacity:.6;
}
.upload-spot{
  position:absolute; inset:0; opacity:0; transition:opacity .3s ease; pointer-events:none;
  background:radial-gradient(320px circle at var(--mx,50%) var(--my,50%), rgba(255,200,87,.14), transparent 70%);
}
.upload-card:hover .upload-spot{ opacity:1; }
.upload-card:hover{ transform:translateY(-3px); }
.upload-card.is-drag{ border-color:var(--cyan) !important; background:rgba(84,232,214,.05); transform:scale(1.005); animation-play-state:paused; }
.upload-card.is-loading{ cursor:wait; border-color:rgba(140,124,240,.55) !important; }

/* static gradient hairline traced just inside the border (option 4) */
.upload-border-glow{
  position:absolute; inset:0; border-radius:inherit; padding:1px; pointer-events:none;
  background:linear-gradient(140deg, rgba(255,200,87,.4), rgba(255,255,255,.02) 30%, rgba(140,124,240,.35) 65%, rgba(84,232,214,.35));
  -webkit-mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite:xor; mask-composite:exclude;
  opacity:.55;
}

/* thin glass highlight along the top edge (option 6) */
.upload-topline{
  position:absolute; top:0; left:12%; right:12%; height:1px; pointer-events:none;
  background:linear-gradient(90deg, transparent, rgba(255,255,255,.4), transparent);
}

.upload-particle{
  position:absolute; width:4px; height:4px; border-radius:50%; background:var(--amber);
  box-shadow:0 0 8px 1px rgba(255,200,87,.5); opacity:0; animation:uploadDrift 6s ease-in-out infinite; pointer-events:none;
}
.up1{ left:18%; top:28%; animation-delay:0s; }
.up2{ right:16%; top:66%; background:var(--violet); box-shadow:0 0 8px 1px rgba(140,124,240,.5); animation-delay:-2s; }
.up3{ left:24%; bottom:20%; background:var(--cyan); box-shadow:0 0 8px 1px rgba(84,232,214,.5); animation-delay:-4s; }
@keyframes uploadDrift{
  0%{ opacity:0; transform:translateY(6px); }
  20%{ opacity:.8; }
  50%{ opacity:.5; transform:translateY(-14px); }
  80%{ opacity:.8; }
  100%{ opacity:0; transform:translateY(-24px); }
}

.upload-icon{
  position:relative; width:64px; height:64px; border-radius:18px; display:flex; align-items:center; justify-content:center;
  background:var(--amber-dim); color:var(--amber); margin-bottom:22px; z-index:1;
  transition:transform .3s ease; animation:iconFloat 3.2s ease-in-out infinite;
}
.upload-card:hover .upload-icon{ transform:scale(1.06) rotate(-3deg); }
@keyframes iconFloat{ 0%,100%{ transform:translateY(0);} 50%{ transform:translateY(-5px);} }
.upload-icon-ring{
  position:absolute; inset:-9px; border-radius:22px; border:1px solid rgba(255,200,87,.32);
  animation:iconRing 2.6s ease-in-out infinite; pointer-events:none;
}
@keyframes iconRing{ 0%{ transform:scale(1); opacity:.55;} 100%{ transform:scale(1.24); opacity:0;} }
.loading-icon{ background:var(--violet-dim); animation:none; }
.spinner{ width:24px; height:24px; border:2px solid rgba(255,255,255,.15); border-top-color:var(--violet); border-radius:50%; animation:spin .8s linear infinite; }
@keyframes spin{ to{ transform:rotate(360deg);} }

.upload-card h2{ font-family:var(--font-display); font-weight:600; font-size:24px; margin:0 0 8px; position:relative; z-index:1; word-break:break-word; }
.upload-card p{ color:var(--text-secondary); margin:0 0 16px; position:relative; z-index:1; }
.upload-formats{ font-family:var(--font-mono); font-size:11px; letter-spacing:.08em; color:var(--text-tertiary); position:relative; z-index:1; }

/* ---------- Upload (compact success bar) ---------- */
.upload-compact{
  position:relative; display:flex; align-items:center; justify-content:space-between; gap:20px; flex-wrap:wrap;
  border:1px solid var(--border); background:var(--surface); border-radius:16px; padding:16px 20px;
  transition:border-color .2s ease;
}
.upload-compact:hover{ border-color:var(--border-hover); }
.uc-left{ display:flex; align-items:center; gap:14px; min-width:0; }
.uc-icon{
  position:relative; width:40px; height:40px; border-radius:12px; background:var(--cyan-dim); color:var(--cyan);
  display:flex; align-items:center; justify-content:center; flex-shrink:0;
}
.uc-icon-ring{ position:absolute; inset:-6px; border-radius:16px; border:1px solid rgba(84,232,214,.35); animation:iconRing 2.6s ease-in-out infinite; }
.check-path{ stroke-dasharray:24; stroke-dashoffset:24; animation:checkDraw .5s ease forwards .12s; }
@keyframes checkDraw{ to{ stroke-dashoffset:0; } }
.uc-text{ display:flex; flex-direction:column; gap:3px; min-width:0; }
.uc-name{ font-family:var(--font-display); font-weight:600; font-size:15px; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:360px; }
.uc-meta{ font-family:var(--font-mono); font-size:10.5px; letter-spacing:.05em; color:var(--text-tertiary); }
.uc-change{
  flex-shrink:0; display:inline-flex; align-items:center; gap:7px; font-family:var(--font-body); font-weight:600; font-size:13px;
  color:var(--text-secondary); background:transparent; border:1px solid var(--border); border-radius:10px; padding:9px 14px; cursor:pointer;
  transition:border-color .2s ease, color .2s ease, transform .15s ease;
}
.uc-change:hover{ color:var(--text-primary); border-color:var(--border-hover); transform:translateX(2px); }

/* ---------- Error ---------- */
.error-card{
  display:flex; align-items:center; gap:12px; margin-top:16px; padding:13px 16px; border-radius:12px;
  border:1px solid rgba(255,100,100,.18); background:rgba(255,80,80,.055); color:#ff9c91;
}
.error-card span{ width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:rgba(255,100,100,.12); font-size:12px; font-weight:700; flex-shrink:0; }
.error-card p{ margin:0; font-size:13px; }

/* ---------- Dataset result ---------- */
.dataset-result{ margin-top:28px; }

[data-reveal]{ opacity:0; transform:translateY(16px); transition:opacity .55s cubic-bezier(.16,1,.3,1), transform .55s cubic-bezier(.16,1,.3,1); }
[data-reveal].is-in{ opacity:1; transform:translateY(0); }

.result-header{ margin-bottom:22px; }
.ready-label{ display:flex; align-items:center; gap:8px; font-family:var(--font-mono); font-size:10px; letter-spacing:.12em; color:var(--cyan); margin-bottom:9px; }
.status-dot{ width:6px; height:6px; border-radius:50%; background:var(--cyan); box-shadow:0 0 10px rgba(84,232,214,.8); animation:pulseDot 2s ease-out infinite; }
.result-header h2{ font-family:var(--font-display); font-weight:600; font-size:27px; margin:0 0 6px; word-break:break-word; }
.result-header p{ margin:0; color:var(--text-tertiary); font-size:13px; }

/* stats */
.stats-grid{ display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:12px; }
.stat-card{
  border:1px solid var(--border); background:var(--surface); border-radius:15px; padding:19px;
  transition:border-color .25s ease, transform .25s ease;
}
.stat-card:hover{ border-color:var(--border-hover); transform:translateY(-2px); }
.stat-card span{ display:block; color:var(--text-tertiary); font-family:var(--font-mono); font-size:9px; letter-spacing:.13em; margin-bottom:10px; }
.stat-card strong{ display:block; font-size:24px; font-weight:500; margin-bottom:4px; font-family:var(--font-display); }
.stat-card small{ color:var(--text-tertiary); font-size:11px; }
.ready-text{ color:var(--cyan); }

/* general cards */
.columns-card, .preview-card{
  border:1px solid var(--border); background:var(--surface); border-radius:18px; padding:22px; margin-top:12px; overflow:hidden;
}
.section-heading{ display:flex; justify-content:space-between; align-items:flex-start; gap:15px; margin-bottom:18px; }
.section-heading span{ color:var(--text-tertiary); font-family:var(--font-mono); font-size:9px; letter-spacing:.14em; }
.section-heading h3{ margin:5px 0 0; font-family:var(--font-display); font-size:20px; font-weight:600; }
.section-heading small{ color:var(--text-tertiary); font-size:11px; }

/* columns */
.columns-list{ display:flex; flex-wrap:wrap; gap:8px; }
.column-item{
  display:flex; align-items:center; gap:8px; padding:9px 11px; border:1px solid var(--border); border-radius:9px;
  background:rgba(0,0,0,.12); color:var(--text-secondary); font-size:12px;
  opacity:0; transform:translateY(8px); animation:riseIn .5s cubic-bezier(.16,1,.3,1) forwards;
  transition:border-color .2s ease, transform .2s ease;
}
.column-item:hover{ border-color:var(--border-hover); transform:translateY(-2px); }
.column-icon{ color:var(--amber); font-family:var(--font-mono); flex-shrink:0; }
.column-content{ min-width:0; display:flex; flex-direction:column; gap:4px; }
.column-name{ color:var(--text-secondary); font-size:12px; line-height:1.2; word-break:break-word; }
.column-meta{ display:flex; align-items:center; gap:7px; color:var(--text-tertiary); font-family:var(--font-mono); font-size:9px; letter-spacing:.02em; }
.column-type{ color:var(--violet); }
.column-missing{ color:var(--text-tertiary); }

/* table */
.table-wrapper{ overflow-x:auto; border:1px solid var(--border); border-radius:12px; }
.preview-card table{ width:100%; border-collapse:collapse; min-width:600px; }
.preview-card th{
  text-align:left; padding:11px 13px; background:rgba(255,255,255,.035); color:var(--text-tertiary);
  font-family:var(--font-mono); font-size:9px; letter-spacing:.08em; text-transform:uppercase; white-space:nowrap;
}
.preview-card td{ padding:11px 13px; border-top:1px solid var(--border); color:var(--text-secondary); font-size:11px; white-space:nowrap; }
.preview-card tbody tr{ transition:background .15s ease; }
.preview-card tbody tr:hover{ background:rgba(255,255,255,.025); }

/* CTA */
.analysis-cta{
  position:relative; margin-top:12px; padding:26px; border:1px solid rgba(140,124,240,.2); border-radius:18px;
  background:rgba(140,124,240,.035); display:flex; align-items:center; justify-content:space-between; gap:24px; overflow:hidden;
}
.cta-glow{ position:absolute; inset:0; background:radial-gradient(circle at 90% 50%, rgba(84,232,214,.09), transparent 42%); pointer-events:none; }
.cta-eyebrow{ color:var(--violet); font-family:var(--font-mono); font-size:9px; letter-spacing:.14em; position:relative; z-index:1; }
.analysis-cta h3{ margin:6px 0; font-family:var(--font-display); font-size:20px; font-weight:600; position:relative; z-index:1; }
.analysis-cta p{ margin:0; color:var(--text-secondary); font-size:12px; line-height:1.6; position:relative; z-index:1; }
.analyze-button{
  flex-shrink:0; display:inline-flex; align-items:center; gap:10px; border:1px solid rgba(255,200,87,.28);
  background:rgba(255,200,87,.08); color:var(--amber); padding:12px 18px; border-radius:10px; font-size:12px;
  font-family:var(--font-body); font-weight:600; cursor:not-allowed; opacity:.55; position:relative; z-index:1;
}

/* ---------- Scroll cue ---------- */
.scroll-cue{
  position:fixed; left:50%; bottom:28px; z-index:60; transform:translateX(-50%);
  width:46px; height:46px; border-radius:50%; display:flex; align-items:center; justify-content:center;
  border:1px solid rgba(140,124,240,.5); background:rgba(16,21,38,.9); backdrop-filter:blur(10px);
  color:var(--violet); cursor:pointer;
  animation:scrollCueIn .5s cubic-bezier(.16,1,.3,1) both, scrollCueBounce 1.8s ease-in-out .5s infinite;
  transition:border-color .2s ease, color .2s ease;
}
.scroll-cue:hover{ border-color:var(--cyan); color:var(--cyan); }
@keyframes scrollCueIn{ from{ opacity:0; transform:translateX(-50%) translateY(14px); } to{ opacity:1; transform:translateX(-50%) translateY(0); } }
@keyframes scrollCueBounce{
  0%,100%{ transform:translateX(-50%) translateY(0); box-shadow:0 8px 20px -6px rgba(140,124,240,.3), 0 0 0 0 rgba(140,124,240,.45); border-color:rgba(140,124,240,.5); }
  50%{ transform:translateX(-50%) translateY(7px); box-shadow:0 4px 26px 4px rgba(84,232,214,.4), 0 0 0 10px rgba(84,232,214,0); border-color:rgba(84,232,214,.75); color:var(--cyan); }
}
@media (max-width:700px){ .scroll-cue{ bottom:20px; width:42px; height:42px; } }

/* ---------- Responsive ---------- */
@media (max-width:900px){
  .page-badge{ display:none; }
}
@media (max-width:700px){
  .analyst-container{ padding-bottom:80px; }
  .upload-card{ min-height:260px; padding:24px; }
  .stats-grid{ grid-template-columns:repeat(2,1fr); }
  .analysis-cta{ flex-direction:column; align-items:flex-start; }
  .analyze-button{ width:100%; justify-content:center; }
  .dash-link span{ display:none; }
  .upload-compact{ flex-direction:column; align-items:flex-start; }
  .uc-change{ width:100%; justify-content:center; }
  .uc-name{ max-width:220px; }
}
@media (max-width:420px){
  .stats-grid{ grid-template-columns:1fr; }
  .upload-card h2{ font-size:20px; }
}
@media (prefers-reduced-motion: reduce){
  *{ animation:none !important; transition:none !important; }
  [data-reveal]{ opacity:1 !important; transform:none !important; }
  .hero-enter, .hero-enter-2, .hero-enter-3{ opacity:1 !important; transform:none !important; }
  .column-item{ opacity:1 !important; transform:none !important; }
  .scroll-cue{ animation:none !important; transform:translateX(-50%) !important; }
  .upload-card{ opacity:1 !important; transform:none !important; }
}
`;