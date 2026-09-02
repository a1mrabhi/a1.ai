"use client";

import {
  useEffect,
  useRef,
  useState,
  MouseEvent as ReactMouseEvent,
  type CSSProperties,
} from "react";
import Link from "next/link";
import { useClerk, useUser, UserButton } from "@clerk/nextjs";
import type {
  DatasetAnalysis,
  DatasetColumn,
} from "@/lib/analyst/analystTypes";
import "./analyst.css";
import AnalystResults from "./AnalystResults";

type DatasetInfo = {
  id: string;
  fileName: string;
  sheetName: string;
  rowCount: number;
  columnCount: number;
  columns: DatasetColumn[];
  previewRows: Record<string, unknown>[];
  analysis: DatasetAnalysis;
};
type CSSVars = CSSProperties & {
  "--d"?: string;
  "--ri"?: number;
  "--i"?: number;
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

function SparkleIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
    >
      <path d="M12 2.5c.3 3.4 1.1 5.7 2.4 7 1.3 1.3 3.6 2.1 7 2.4-3.4.3-5.7 1.1-7 2.4-1.3 1.3-2.1 3.6-2.4 7-.3-3.4-1.1-5.7-2.4-7-1.3-1.3-3.6-2.1-7-2.4 3.4-.3 5.7-1.1 7-2.4 1.3-1.3 2.1-3.6 2.4-7Z" />
    </svg>
  );
}

function RowsIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
      <path d="M3.5 10h17M3.5 15.5h17" />
    </svg>
  );
}

function ColumnsIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
      <path d="M9.5 4v16M14.5 4v16" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                       */
/* ------------------------------------------------------------------ */

export default function AnalystPage() {
  const { isLoaded, isSignedIn } = useUser();
  const { openSignIn, openSignUp } = useClerk();

  const inputRef = useRef<HTMLInputElement>(null);
  const guestClaimAttemptedRef = useRef(false);
  const uploadCardRef = useRef<HTMLDivElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dataset, setDataset] = useState<DatasetInfo | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const [analysisError, setAnalysisError] = useState("");
  const [showGuestLoginPrompt, setShowGuestLoginPrompt] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<DatasetAnalysis | null>(
    null,
  );
  const [initialChat, setInitialChat] = useState<{
    question: string;
    answer: string;
  } | null>(null);

  // If the guest reaches the login flow from the Analyst, transfer the
  // anonymous dataset/conversation to the authenticated account before the
  // user continues. The transfer is server-side and survives refreshes/tabs.
  useEffect(() => {
    if (!isLoaded || !isSignedIn || guestClaimAttemptedRef.current) return;

    guestClaimAttemptedRef.current = true;

    void fetch("/api/guest/claim", { method: "POST" })
      .then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error || "Could not restore the guest session.");
        }
      })
      .catch((claimError) => {
        console.error("Analyst guest session claim error:", claimError);
      });
  }, [isLoaded, isSignedIn]);

  useReveal(dataset);

  useEffect(() => {
    if (!analysisResult) return;

    requestAnimationFrame(() => {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    });
  }, [analysisResult]);

  const handleFile = async (selectedFile: File | undefined) => {
    if (!selectedFile) return;

    setError("");
    setAnalysisError("");
    setAnalysisResult(null);
    setInitialChat(null);
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

      if (response.status === 429 && data.code === "GUEST_LIMIT_REACHED") {
        // The second upload is rejected by the server. Clear the selected file
        // immediately so closing the login prompt returns to the real upload
        // state instead of leaving the page stuck on “Understanding your dataset…”.
        setFile(null);
        setDataset(null);
        setAnalysisResult(null);
        setInitialChat(null);
        setError("");
        if (inputRef.current) inputRef.current.value = "";
        setShowGuestLoginPrompt(true);
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to process the dataset.");
      }

      if (!data.analysis) {
        throw new Error("Dataset analysis was not returned by the server.");
      }

      setDataset({
        ...data.dataset,
        analysis: data.analysis,
      });
    } catch (err) {
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
  const handleDiscover = async (question: string) => {
    if (!dataset || analyzing) return;

    const prompt = question.trim();
    if (!prompt) return;

    setAnalyzing(true);
    setAnalysisError("");

    try {
      // The upload API already analyzes the complete parsed dataset on the
      // server. Reuse that result instead of analyzing the 20-row preview.
      const analysis = dataset.analysis;

      const chatResponse = await fetch("/api/analyst/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: prompt,
          datasetId: dataset.id,
          analysis,
          fileName: dataset.fileName,
        }),
      });

      const chatPayload = await chatResponse.json();

      if (!chatResponse.ok || !chatPayload.success) {
        throw new Error(
          chatPayload.error || "Failed to generate the discovery.",
        );
      }

      const answer = String(
        chatPayload.answer ??
          chatPayload.message ??
          chatPayload.response ??
          "I couldn't generate an answer for that discovery.",
      );

      setInitialChat({ question: prompt, answer });
      setAnalysisResult(analysis);
    } catch (error) {
      setAnalysisError(
        error instanceof Error
          ? error.message
          : "Something went wrong while discovering your data.",
      );
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <>
      <style>{CSS}</style>

      <style>{`
        @keyframes guestPromptIn {
          from { opacity: 0; transform: translateY(12px) scale(.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .guest-prompt-overlay {
          position: fixed; inset: 0; z-index: 100; display: flex; align-items: center;
          justify-content: center; padding: 20px; background: rgba(2,4,10,.72);
          backdrop-filter: blur(10px);
        }
        .guest-prompt-card {
          width: min(440px,100%); position: relative; overflow: hidden; border-radius:24px;
          border:1px solid rgba(255,200,87,.28);
          background:
            radial-gradient(360px circle at 15% 0%, rgba(255,200,87,.13), transparent 62%),
            radial-gradient(300px circle at 100% 100%, rgba(140,124,240,.12), transparent 60%),
            rgba(15,17,24,.97);
          box-shadow:0 30px 90px rgba(0,0,0,.55),0 0 45px rgba(255,200,87,.10);
          animation:guestPromptIn .24s cubic-bezier(.16,1,.3,1) both;
        }
        .guest-prompt-close {
          position:absolute; top:14px; right:14px; width:34px; height:34px; display:grid;
          place-items:center; border-radius:10px; border:1px solid rgba(255,255,255,.08);
          background:rgba(255,255,255,.04); color:#a1a1aa; cursor:pointer; transition:all .2s ease;
        }
        .guest-prompt-close:hover { color:#fff; background:rgba(255,255,255,.09); }
        .guest-prompt-body { padding:34px 30px 28px; text-align:center; }
        .guest-prompt-icon {
          width:58px; height:58px; margin:0 auto 18px; display:grid; place-items:center; border-radius:18px;
          color:#ffd77a; border:1px solid rgba(255,200,87,.28);
          background:linear-gradient(135deg,rgba(255,200,87,.16),rgba(140,124,240,.10));
          box-shadow:0 12px 35px rgba(255,200,87,.10);
        }
        .guest-prompt-eyebrow { margin:0 0 7px; color:#ffc857; font:600 10px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.14em; text-transform:uppercase; }
        .guest-prompt-title { margin:0; color:#fafafa; font-size:22px; line-height:1.25; font-weight:700; }
        .guest-prompt-text { margin:10px auto 0; max-width:350px; color:#a1a1aa; font-size:14px; line-height:1.65; }
        .guest-prompt-actions { display:flex; gap:10px; margin-top:24px; }
        .guest-prompt-primary,.guest-prompt-secondary { flex:1; min-height:44px; border-radius:12px; font-size:14px; font-weight:600; cursor:pointer; transition:all .2s ease; }
        .guest-prompt-primary { border:1px solid rgba(255,200,87,.42); color:#111827; background:linear-gradient(135deg,#ffc857,#8c7cf0); box-shadow:0 10px 28px rgba(255,200,87,.16); }
        .guest-prompt-primary:hover { transform:translateY(-1px); filter:brightness(1.06); }
        .guest-prompt-secondary { border:1px solid rgba(255,255,255,.10); color:#d4d4d8; background:rgba(255,255,255,.045); }
        .guest-prompt-secondary:hover { background:rgba(255,255,255,.08); color:#fff; }
        .guest-prompt-note { margin:13px 0 0; color:#52525b; font-size:11px; }
        @media(max-width:520px){ .guest-prompt-body{padding:30px 20px 22px}.guest-prompt-actions{flex-direction:column}.guest-prompt-primary,.guest-prompt-secondary{width:100%} }
      `}</style>

      {showGuestLoginPrompt && !isSignedIn && (
        <div
          className="guest-prompt-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="guest-analyst-prompt-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) window.location.href = "/dashboard";
          }}
        >
          <div className="guest-prompt-card">
            <button
              type="button"
              className="guest-prompt-close"
              onClick={() => { window.location.href = "/dashboard"; }}
              aria-label="Close"
            >
              ×
            </button>
            <div className="guest-prompt-body">
              <div className="guest-prompt-icon" aria-hidden="true">
                <SparkleIcon />
              </div>
              <p className="guest-prompt-eyebrow">AI Data Analyst</p>
              <h2 id="guest-analyst-prompt-title" className="guest-prompt-title">
                Ready for more AI?
              </h2>
              <p className="guest-prompt-text">
                You’ve used your free AI Data Analyst analysis. Log in to continue
                analyzing your data and keep your workspace history.
              </p>
              <div className="guest-prompt-actions">
                <button
                  type="button"
                  className="guest-prompt-primary"
                  onClick={() => {
                    setShowGuestLoginPrompt(false);
                    openSignIn();
                  }}
                >
                  Yes, log in
                </button>
                <button
                  type="button"
                  className="guest-prompt-secondary"
                  onClick={() => {
                    setShowGuestLoginPrompt(false);
                    openSignUp();
                  }}
                >
                  Create account
                </button>
              </div>
              <p className="guest-prompt-note">Your guest dataset will be preserved.</p>
              <button
                type="button"
                className="guest-prompt-secondary"
                style={{ width: "100%", marginTop: 10 }}
                onClick={() => { window.location.href = "/dashboard"; }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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

      {analysisResult ? (
        <AnalystResults
          analysis={analysisResult}
          datasetId={dataset?.id ?? ""}
          fileName={dataset?.fileName}
          rows={dataset?.previewRows ?? []}
          columns={dataset?.columns ?? []}
          initialQuestion={initialChat?.question}
          initialAnswer={initialChat?.answer}
        />
      ) : (
        <main className={`analyst-page ${isReady ? "analyst-page-ready" : ""}`}>
          {!isReady && (
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
                <h1 className="hero-enter-2">
                  Understand your data.
                  <span className="grad-text">Discover what matters.</span>
                </h1>
                <p className="hero-sub hero-enter-3">
                  Upload a CSV or Excel dataset and let A1.ai find patterns,
                  trends, anomalies, and useful insights.
                </p>
              </div>
            </section>
          )}

          <div
            className={`container analyst-container ${isReady ? "discovery-container" : ""}`}
          >
            <input
              ref={inputRef}
              type="file"
              hidden
              accept=".csv,.xls,.xlsx"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />

            {!isReady ? (
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
            ) : (
              <section
                className={`discovery-card ${analyzing ? "is-analyzing" : ""}`}
                data-reveal
              >
                <span className="discovery-border-glow" aria-hidden="true" />
                <div className="discovery-glow" aria-hidden="true" />
                <div
                  className="discovery-glow discovery-glow-2"
                  aria-hidden="true"
                />
                <span className="discovery-orb do1" aria-hidden="true" />
                <span className="discovery-orb do2" aria-hidden="true" />

                <div
                  className="discovery-header"
                  data-reveal-child
                  style={{ "--d": "0ms" } as CSSVars}
                >
                  <div className="discovery-status">
                    <span className="discovery-check">
                      <span className="discovery-check-ring" />
                      <CheckBadgeIcon />
                    </span>
                    <div className="discovery-status-text">
                      <span className="discovery-eyebrow">
                        <span className="eyebrow-dot" />
                        DATASET READY
                      </span>
                      <h1 title={dataset!.fileName}>{dataset!.fileName}</h1>
                      <div className="discovery-stats">
                        <span className="discovery-stat">
                          <RowsIcon />
                          {dataset!.rowCount.toLocaleString()} rows
                        </span>
                        <span className="discovery-stat-sep" />
                        <span className="discovery-stat">
                          <ColumnsIcon />
                          {dataset!.columnCount} columns
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="discovery-change"
                    onClick={() => inputRef.current?.click()}
                    disabled={analyzing}
                  >
                    Choose another file
                  </button>
                </div>

                {dataset!.previewRows.length > 0 && (
                  <div
                    className="discovery-preview"
                    data-reveal-child
                    style={{ "--d": "90ms" } as CSSVars}
                  >
                    <div className="discovery-preview-label">
                      <span className="label-line" />
                      SMALL PREVIEW
                    </div>
                    <div className="discovery-preview-table-wrap">
                      <table className="discovery-preview-table">
                        <thead>
                          <tr>
                            <th className="idx-col" aria-hidden="true" />
                            {dataset!.columns
                              .slice(0, 5)
                              .map((column, index) => (
                                <th key={`${column.name}-${index}`}>
                                  {column.name}
                                </th>
                              ))}
                          </tr>
                        </thead>
                        <tbody>
                          {dataset!.previewRows
                            .slice(0, 3)
                            .map((row, rowIndex) => (
                              <tr
                                key={rowIndex}
                                style={{ "--ri": rowIndex } as CSSVars}
                              >
                                <td className="idx-col">{rowIndex + 1}</td>
                                {dataset!.columns
                                  .slice(0, 5)
                                  .map((column, columnIndex) => (
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

                <div
                  className="discovery-divider"
                  data-reveal-child
                  style={{ "--d": "150ms" } as CSSVars}
                />

                <div
                  className="discovery-prompt"
                  data-reveal-child
                  style={{ "--d": "190ms" } as CSSVars}
                >
                  <h2>
                    What would you like to{" "}
                    <span className="grad-text-2">discover</span>?
                  </h2>
                  <p>
                    Ask A1.ai to explore your dataset, or start with one of the
                    focused discoveries below.
                  </p>

                  <form
                    className="discovery-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const input = event.currentTarget.elements.namedItem(
                        "discovery",
                      ) as HTMLInputElement | null;
                      void handleDiscover(input?.value ?? "");
                    }}
                  >
                    <span className="discovery-form-icon" aria-hidden="true">
                      <SparkleIcon />
                    </span>
                    <input
                      name="discovery"
                      placeholder="Ask anything about your data..."
                      autoComplete="off"
                      disabled={analyzing}
                      aria-label="Ask anything about your data"
                    />
                    <button
                      type="submit"
                      disabled={analyzing}
                      aria-label="Discover"
                    >
                      {analyzing ? (
                        <span className="discovery-spinner" />
                      ) : (
                        <SendIcon />
                      )}
                    </button>
                  </form>

                  {analyzing && (
                    <p className="discovery-thinking">
                      <span className="thinking-dots">
                        <span />
                        <span />
                        <span />
                      </span>
                      Analyzing your dataset...
                    </p>
                  )}

                  {analysisError && (
                    <p className="discovery-error">{analysisError}</p>
                  )}

                  <div className="discovery-suggestions">
                    <span>Try asking</span>
                    {[
                      "Give me an overview",
                      "Find important patterns",
                      "Find anomalies",
                    ].map((suggestion, i) => (
                      <button
                        key={suggestion}
                        type="button"
                        style={{ "--i": i } as CSSVars}
                        onClick={() => void handleDiscover(suggestion)}
                        disabled={analyzing}
                      >
                        <SparkleIcon />
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {error && (
              <div className="error-card">
                <span>!</span>
                <p>{error}</p>
              </div>
            )}
          </div>
        </main>
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
  flex-shrink:0;
  display:inline-flex;
  align-items:center;
  gap:10px;

  border:1px solid rgba(255,200,87,.45);
  background:linear-gradient(
    135deg,
    rgba(255,200,87,.16),
    rgba(140,124,240,.14)
  );

  color:var(--amber);
  padding:12px 18px;
  border-radius:10px;
  font-size:12px;
  font-family:var(--font-body);
  font-weight:600;

  cursor:pointer;
  opacity:1;

  position:relative;
  z-index:1;

  transition:
    transform .2s ease,
    border-color .2s ease,
    background .2s ease,
    box-shadow .2s ease;
}

.analyze-button:hover:not(:disabled){
  transform:translateY(-2px);
  border-color:var(--amber);
  background:linear-gradient(
    135deg,
    rgba(255,200,87,.22),
    rgba(140,124,240,.18)
  );

  box-shadow:
    0 10px 30px rgba(255,200,87,.12),
    0 0 20px rgba(140,124,240,.08);
}

.analyze-button:active:not(:disabled){
  transform:translateY(0);
}

.analyze-button:disabled{
  cursor:not-allowed;
  opacity:.45;
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


/* ---------- Post-upload discovery ---------- */
.analyst-page-ready{min-height:calc(100vh - 68px);}
.discovery-container{width:100%;padding-top:28px;padding-bottom:32px;}

/* card shell — glass panel with animated conic-gradient border */
.discovery-card{
  position:relative; width:min(900px,100%); margin:0 auto; overflow:hidden;
  padding:26px 32px; border-radius:24px;
  background:
    radial-gradient(circle at 88% -6%, rgba(140,124,240,.14), transparent 38%),
    radial-gradient(circle at 4% 108%, rgba(84,232,214,.08), transparent 36%),
    linear-gradient(180deg, rgba(16,21,38,.92), rgba(8,11,22,.92));
  box-shadow:
    0 32px 90px rgba(0,0,0,.38),
    0 1px 0 rgba(255,255,255,.04) inset,
    0 0 0 1px rgba(148,163,196,.1);
  animation: cardRise .7s cubic-bezier(.16,1,.3,1) both;
  backdrop-filter: blur(20px);
}
@keyframes cardRise{ from{ opacity:0; transform:translateY(18px) scale(.985); } to{ opacity:1; transform:translateY(0) scale(1); } }

/* slow-rotating gradient hairline border */
.discovery-border-glow{
  position:absolute; inset:0; border-radius:26px; padding:1px; pointer-events:none; z-index:0;
  background:conic-gradient(from var(--rot,0deg), rgba(140,124,240,.55), rgba(84,232,214,.35), rgba(255,200,87,.4), rgba(140,124,240,.55));
  -webkit-mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite:xor; mask-composite:exclude;
  opacity:.55; animation:borderRotate 9s linear infinite;
}
@keyframes borderRotate{ to{ --rot:360deg; } }
@property --rot{ syntax:'<angle>'; inherits:false; initial-value:0deg; }

.discovery-glow{ position:absolute; width:440px; height:240px; top:-140px; right:-90px; border-radius:50%; background:rgba(140,124,240,.2); filter:blur(75px); pointer-events:none; z-index:0; animation:glowDrift 12s ease-in-out infinite; }
.discovery-glow-2{ top:auto; right:auto; bottom:-160px; left:-100px; width:380px; height:260px; background:rgba(84,232,214,.14); animation-delay:-6s; }
@keyframes glowDrift{ 0%,100%{ transform:translate(0,0) scale(1);} 50%{ transform:translate(-14px,16px) scale(1.08);} }

.discovery-orb{ position:absolute; z-index:0; border-radius:50%; pointer-events:none; }
.do1{ width:5px; height:5px; top:22%; right:14%; background:var(--cyan); box-shadow:0 0 14px 2px rgba(84,232,214,.8); animation:orbFloat 5s ease-in-out infinite; }
.do2{ width:4px; height:4px; bottom:30%; left:10%; background:var(--amber); box-shadow:0 0 12px 2px rgba(255,200,87,.75); animation:orbFloat 6.5s ease-in-out infinite reverse; }
@keyframes orbFloat{ 0%,100%{ transform:translateY(0) translateX(0); opacity:.7;} 50%{ transform:translateY(-16px) translateX(8px); opacity:1;} }

/* staggered reveal for the card's own children */
[data-reveal-child]{ opacity:0; transform:translateY(10px); animation:childIn .6s cubic-bezier(.16,1,.3,1) forwards; animation-delay:var(--d,0ms); }
@keyframes childIn{ to{ opacity:1; transform:translateY(0); } }

.discovery-header,.discovery-status{display:flex;align-items:flex-start;}
.discovery-header{position:relative;z-index:1;justify-content:space-between;gap:24px;}
.discovery-status{gap:16px;min-width:0;}
.discovery-status-text{min-width:0;}

.discovery-check{
  position:relative; display:grid; width:48px; height:48px; flex-shrink:0; place-items:center;
  border:1px solid rgba(84,232,214,.3); border-radius:15px;
  background:linear-gradient(150deg, rgba(84,232,214,.16), rgba(84,232,214,.04));
  color:var(--cyan); box-shadow:0 8px 20px -8px rgba(84,232,214,.5), inset 0 1px 0 rgba(255,255,255,.08);
}
.discovery-check svg{ width:22px; height:22px; }
.discovery-check-ring{ position:absolute; inset:-1px; border-radius:15px; border:1px solid rgba(84,232,214,.5); animation:checkPulse 2.2s ease-out infinite; }
@keyframes checkPulse{ 0%{ transform:scale(1); opacity:.7; } 100%{ transform:scale(1.35); opacity:0; } }
.check-path{ stroke-dasharray:20; stroke-dashoffset:20; animation:checkDraw .5s .25s ease-out forwards; }
@keyframes checkDraw{ to{ stroke-dashoffset:0; } }

.discovery-eyebrow{ display:inline-flex; align-items:center; gap:6px; color:var(--cyan); font:600 9.5px var(--font-mono); letter-spacing:.16em; text-transform:uppercase; }
.eyebrow-dot{ width:5px; height:5px; border-radius:50%; background:var(--cyan); box-shadow:0 0 0 0 rgba(84,232,214,.6); animation:pulseDot 2s ease-out infinite; }
.discovery-eyebrow-center{ color:var(--violet); }
.discovery-eyebrow-center svg{ color:var(--violet); }

.discovery-status h1{
  margin:6px 0 7px; overflow:hidden; letter-spacing:-.01em;
  background:linear-gradient(120deg, var(--text-primary) 55%, var(--violet) 100%);
  -webkit-background-clip:text; background-clip:text; color:transparent;
  font:600 27px var(--font-display); text-overflow:ellipsis; white-space:nowrap;
}
.discovery-stats{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.discovery-stat{
  display:inline-flex; align-items:center; gap:6px; padding:5px 10px; border-radius:8px;
  background:rgba(255,255,255,.035); border:1px solid var(--border); color:var(--text-secondary);
  font:500 10.5px var(--font-mono); letter-spacing:.02em;
}
.discovery-stat svg{ color:var(--text-tertiary); }
.discovery-stat-sep{ width:3px; height:3px; border-radius:50%; background:var(--text-tertiary); opacity:.5; }

.discovery-change{
  position:relative; flex-shrink:0; padding:10px 15px; border:1px solid var(--border); border-radius:11px;
  background:rgba(255,255,255,.03); color:var(--text-secondary); font:600 11.5px var(--font-body);
  cursor:pointer; transition:border-color .2s ease, color .2s ease, transform .18s ease, background .2s ease;
  overflow:hidden;
}
.discovery-change::after{ content:""; position:absolute; inset:0; background:linear-gradient(120deg, transparent, rgba(140,124,240,.16), transparent); transform:translateX(-120%); transition:transform .5s ease; }
.discovery-change:hover:not(:disabled){ border-color:var(--border-hover); color:var(--text-primary); transform:translateY(-2px); background:rgba(140,124,240,.06); }
.discovery-change:hover:not(:disabled)::after{ transform:translateX(120%); }
.discovery-change:disabled{opacity:.45;cursor:not-allowed;}

.discovery-preview{position:relative;z-index:1;margin-top:18px;}
.discovery-preview-label{ display:flex; align-items:center; gap:10px; margin-bottom:8px; color:var(--text-tertiary); font:600 9px var(--font-mono); letter-spacing:.16em; }
.label-line{ height:1px; width:20px; background:linear-gradient(90deg, var(--text-tertiary), transparent); }
.discovery-preview-table-wrap{
  overflow:hidden; border:1px solid rgba(148,163,196,.12); border-radius:14px;
  background:rgba(4,7,14,.55); box-shadow:0 14px 34px -18px rgba(0,0,0,.6);
}
.discovery-preview-table{width:100%;border-collapse:collapse;table-layout:fixed;}
.discovery-preview-table th,.discovery-preview-table td{max-width:0;padding:8px 13px;overflow:hidden;border-bottom:1px solid rgba(148,163,196,.07);text-align:left;text-overflow:ellipsis;white-space:nowrap;}
.discovery-preview-table th{ color:#8891b3; background:rgba(255,255,255,.03); font:600 8.5px var(--font-mono); letter-spacing:.11em; text-transform:uppercase; }
.discovery-preview-table td{color:#b1bad6;font-size:11px; transition:color .2s ease;}
.discovery-preview-table th.idx-col, .discovery-preview-table td.idx-col{ width:34px; max-width:34px; padding-right:0; color:var(--text-tertiary); font-family:var(--font-mono); font-size:9.5px; }
.discovery-preview-table tr:last-child td{border-bottom:0;}
.discovery-preview-table tbody tr{ position:relative; animation:rowIn .5s cubic-bezier(.16,1,.3,1) both; animation-delay:calc(var(--ri,0) * 70ms + 250ms); transition:background .2s ease; }
.discovery-preview-table tbody tr:hover{ background:rgba(140,124,240,.05); }
.discovery-preview-table tbody tr:hover td{ color:var(--text-primary); }
@keyframes rowIn{ from{ opacity:0; transform:translateX(-6px); } to{ opacity:1; transform:translateX(0); } }

.discovery-divider{ position:relative; z-index:1; height:1px; margin:18px 0 16px; background:linear-gradient(90deg,transparent,var(--border) 20%,var(--border) 80%,transparent); overflow:visible; }
.discovery-divider::after{ content:""; position:absolute; top:-1.5px; left:50%; width:5px; height:4px; border-radius:50%; background:var(--violet); box-shadow:0 0 10px 2px rgba(140,124,240,.7); }

.discovery-prompt{position:relative;z-index:1;text-align:center;}
.discovery-prompt h2{ margin:0 0 8px; color:var(--text-primary); font:600 28px var(--font-display); letter-spacing:-.01em; }
.grad-text-2{
  background:linear-gradient(100deg, var(--violet), var(--cyan) 55%, var(--amber));
  background-size:200% auto; -webkit-background-clip:text; background-clip:text; color:transparent;
  animation:gradShift 5s ease-in-out infinite;
}
@keyframes gradShift{ 0%,100%{ background-position:0% center; } 50%{ background-position:100% center; } }
.discovery-prompt>p{max-width:600px;margin:0 auto 18px;color:var(--text-secondary);font-size:12.5px;line-height:1.6;}

.discovery-form{
  position:relative; display:flex; align-items:center; gap:8px; width:min(720px,100%); margin:0 auto;
  padding:7px 7px 7px 5px; border-radius:16px; background:rgba(4,7,14,.8);
  border:1px solid rgba(140,124,240,.28);
  box-shadow:0 0 0 1px rgba(255,255,255,.02), 0 16px 40px -14px rgba(0,0,0,.55);
  transition:border-color .25s ease, box-shadow .25s ease, transform .25s ease;
}
.discovery-form:focus-within{ border-color:rgba(140,124,240,.6); box-shadow:0 0 0 5px rgba(140,124,240,.08), 0 16px 40px -14px rgba(0,0,0,.6); transform:translateY(-1px); }
.discovery-form-icon{ display:grid; place-items:center; width:30px; height:30px; flex-shrink:0; margin-left:2px; color:var(--violet); opacity:.7; }
.discovery-form input{min-width:0;width:100%;height:40px;padding:0 4px;border:0;outline:0;background:transparent;color:var(--text-primary);font:13.5px var(--font-body);}
.discovery-form input::placeholder{color:#5f6988;}
.discovery-form button{
  position:relative; display:grid; width:40px; height:40px; flex-shrink:0; place-items:center; border-radius:11px;
  border:1px solid rgba(255,200,87,.3);
  background:linear-gradient(135deg, rgba(255,200,87,.22), rgba(140,124,240,.16));
  color:var(--amber); cursor:pointer; overflow:hidden;
  transition:transform .2s ease, border-color .2s ease, box-shadow .2s ease;
}
.discovery-form button:hover:not(:disabled){ background:linear-gradient(135deg, rgba(255,200,87,.3), rgba(140,124,240,.22)); border-color:var(--amber); transform:translateY(-2px) scale(1.03); box-shadow:0 10px 26px -8px rgba(255,200,87,.5); }
.discovery-form button:active:not(:disabled){ transform:translateY(0) scale(.98); }
.discovery-form button:disabled{opacity:.5;cursor:not-allowed;}
.discovery-spinner{width:16px;height:16px;border:2px solid rgba(255,200,87,.22);border-top-color:var(--amber);border-radius:50%;animation:discoverySpin .7s linear infinite;}
@keyframes discoverySpin{to{transform:rotate(360deg);}}

.discovery-thinking{ display:flex; align-items:center; justify-content:center; gap:9px; margin:14px 0 0; color:var(--text-tertiary); font:500 11px var(--font-mono); letter-spacing:.02em; }
.thinking-dots{ display:inline-flex; gap:4px; }
.thinking-dots span{ width:4px; height:4px; border-radius:50%; background:var(--violet); animation:thinkBounce 1.1s ease-in-out infinite; }
.thinking-dots span:nth-child(2){ animation-delay:.15s; }
.thinking-dots span:nth-child(3){ animation-delay:.3s; }
@keyframes thinkBounce{ 0%,80%,100%{ transform:translateY(0); opacity:.4; } 40%{ transform:translateY(-4px); opacity:1; } }

.discovery-error{margin:12px 0 0;color:#ff9aa6;font-size:11.5px;}

.discovery-suggestions{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:9px;margin-top:16px;}
.discovery-suggestions>span{color:var(--text-tertiary);font:600 9px var(--font-mono);letter-spacing:.13em;text-transform:uppercase;}
.discovery-suggestions button{
  position:relative; display:inline-flex; align-items:center; gap:6px; padding:8px 13px; border-radius:999px;
  border:1px solid rgba(140,124,240,.22); background:rgba(140,124,240,.045); color:var(--text-secondary);
  font-size:11px; font-weight:500; cursor:pointer; overflow:hidden;
  transition:border-color .22s ease, background .22s ease, color .22s ease, transform .22s ease, box-shadow .22s ease;
  opacity:0; transform:translateY(10px) scale(.92); animation:chipIn .55s cubic-bezier(.34,1.4,.4,1) forwards, chipGlow 3.4s ease-in-out infinite;
  animation-delay:calc(var(--i,0) * 110ms + 380ms), calc(var(--i,0) * 110ms + 1400ms);
}
.discovery-suggestions button::before{
  content:""; position:absolute; inset:0; border-radius:999px; padding:1px;
  background:conic-gradient(from 0deg, transparent, rgba(140,124,240,.55), transparent 35%);
  -webkit-mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite:xor; mask-composite:exclude;
  opacity:0; transition:opacity .3s ease; animation:chipSweep 3.4s linear infinite; animation-delay:calc(var(--i,0) * 110ms + 1400ms);
}
.discovery-suggestions button svg{ color:var(--violet); opacity:.85; transition:transform .3s ease; animation:chipTwinkle 2.6s ease-in-out infinite; animation-delay:calc(var(--i,0) * 250ms); }
@keyframes chipIn{ 60%{ opacity:1; transform:translateY(-2px) scale(1.03); } to{ opacity:1; transform:translateY(0) scale(1); } }
@keyframes chipGlow{ 0%,100%{ box-shadow:0 0 0 0 rgba(140,124,240,0); } 50%{ box-shadow:0 0 16px -2px rgba(140,124,240,.28); } }
@keyframes chipSweep{ 0%{ opacity:0; } 8%{ opacity:.9; } 40%{ opacity:0; } 100%{ opacity:0; } }
@keyframes chipTwinkle{ 0%,100%{ transform:scale(1); opacity:.6; } 50%{ transform:scale(1.25); opacity:1; } }
.discovery-suggestions button:hover:not(:disabled){ border-color:rgba(140,124,240,.55); background:rgba(140,124,240,.12); color:var(--text-primary); transform:translateY(-3px) scale(1.03); box-shadow:0 12px 28px -10px rgba(140,124,240,.5); }
.discovery-suggestions button:hover:not(:disabled) svg{ transform:rotate(90deg) scale(1.2); animation-play-state:paused; }
.discovery-suggestions button:disabled{opacity:.4;cursor:not-allowed;}

.is-analyzing .discovery-form{ animation:formPulse 1.6s ease-in-out infinite; }
@keyframes formPulse{ 0%,100%{ box-shadow:0 0 0 1px rgba(255,255,255,.02), 0 16px 40px -14px rgba(0,0,0,.55); } 50%{ box-shadow:0 0 0 5px rgba(140,124,240,.1), 0 16px 40px -14px rgba(0,0,0,.55); } }

@media (prefers-reduced-motion: reduce){
  .discovery-card, .discovery-border-glow, .discovery-glow, .discovery-orb, [data-reveal-child],
  .discovery-preview-table tbody tr, .discovery-suggestions button, .check-path, .discovery-check-ring{ animation:none !important; opacity:1 !important; transform:none !important; }
}

@media(max-width:700px){
  .analyst-page-ready{min-height:calc(100vh - 60px);}
  .discovery-container{padding:18px 16px 24px;}
  .discovery-card{padding:20px;border-radius:19px;}
  .discovery-header{flex-direction:column;}
  .discovery-change{align-self:flex-start;}
  .discovery-status h1{max-width:calc(100vw - 110px);font-size:20px;}
  .discovery-prompt h2{font-size:23px;}
  .discovery-form{padding:6px;}
  .discovery-stats{gap:8px;}
}
`;