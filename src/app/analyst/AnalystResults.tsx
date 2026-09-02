"use client";

import "./analyst.css";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useClerk, useUser } from "@clerk/nextjs";

type NumericStat = {
  column: string;
  count: number;
  missing: number;
  sum: number;
  average: number;
  min?: number;
  max?: number;
};

type CategoricalStat = {
  column: string;
  count: number;
  missing: number;
  unique: number;
  topValues: Array<{
    value: string | number;
    count: number;
  }>;
};

type MissingValue = {
  column: string;
  count: number;
  percentage: number;
};

type AnalysisResult = {
  rowCount: number;
  columnCount: number;
  numericStats: NumericStat[];
  categoricalStats: CategoricalStat[];
  missingValues: MissingValue[];
};

type AnalystResultsProps = {
  analysis: AnalysisResult;
  fileName?: string;
  datasetId: string;
  rows?: Record<string, unknown>[];
  columns?: Array<{ name: string; type: string; missing: number }>;
  initialQuestion?: string;
  initialAnswer?: string;
  /** ISO timestamp of when the analysis finished. Defaults to render time. */
  analyzedAt?: string;
  /** How long the analysis took, in seconds. Omit to hide that stat. */
  durationSeconds?: number;
};

/* ------------------------------------------------------------------ */
/* Formatting helpers                                                  */
/* ------------------------------------------------------------------ */

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

function formatAverage(value: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(value);
}

function isCurrencyColumn(column: string) {
  const c = column.toLowerCase();
  return (
    c.includes("revenue") ||
    c.includes("price") ||
    c.includes("sales") ||
    c.includes("amount") ||
    c.includes("cost")
  );
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    return <span key={index}>{part}</span>;
  });
}

function renderMarkdown(content: string): ReactNode {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  let numbers: string[] = [];

  const flushLists = () => {
    if (bullets.length) {
      blocks.push(
        <ul className="ai-chat-markdown-list" key={`bullets-${blocks.length}`}>
          {bullets.map((item, index) => (
            <li key={index}>{renderInlineMarkdown(item)}</li>
          ))}
        </ul>,
      );
      bullets = [];
    }

    if (numbers.length) {
      blocks.push(
        <ol className="ai-chat-markdown-list" key={`numbers-${blocks.length}`}>
          {numbers.map((item, index) => (
            <li key={index}>{renderInlineMarkdown(item)}</li>
          ))}
        </ol>,
      );
      numbers = [];
    }
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();

    if (!line) {
      flushLists();
      return;
    }

    if (/^[-*_]{3,}$/.test(line)) {
      flushLists();
      blocks.push(<hr key={`hr-${index}`} />);
      return;
    }

    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      flushLists();
      const text = heading[1].replace(/^\*\*|\*\*$/g, "");
      const level = Math.min(heading[0].match(/^#+/)?.[0].length ?? 3, 4);
      const Tag = level <= 2 ? "h4" : "h5";
      blocks.push(
        <Tag key={`heading-${index}`}>{renderInlineMarkdown(text)}</Tag>,
      );
      return;
    }

    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      if (numbers.length) {
        flushLists();
      }

      bullets.push(bullet[1]);
      return;
    }

    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (numbered) {
      if (bullets.length) {
        flushLists();
      }

      numbers.push(numbered[1]);
      return;
    }

    flushLists();
    blocks.push(<p key={`p-${index}`}>{renderInlineMarkdown(line)}</p>);
  });

  flushLists();
  return <div className="ai-chat-markdown">{blocks}</div>;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* ------------------------------------------------------------------ */
/* Reveal-on-scroll (scoped to this component's own mount)             */
/* ------------------------------------------------------------------ */

function useReveal(root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const scope = root.current;
    if (!scope) return;

    const els = Array.from(
      scope.querySelectorAll<HTMLElement>("[data-ar-reveal]"),
    );

    // Anything already sitting inside the viewport on first paint should be
    // visible immediately — "reveal on scroll" is for content the user has
    // to scroll to reach, not content that's already on screen at load.
    // Waiting for a % of it to intersect (via IntersectionObserver) let tall
    // sections stay at opacity:0 until the user scrolled, which looked like
    // missing/blank content.
    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight;
    const alreadyVisible: HTMLElement[] = [];
    const toObserve: HTMLElement[] = [];

    els.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.top < viewportHeight && rect.bottom > 0) {
        alreadyVisible.push(el);
      } else {
        toObserve.push(el);
      }
    });

    alreadyVisible.forEach((el) => el.classList.add("is-in"));

    if (!toObserve.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0, rootMargin: "0px 0px -10px 0px" },
    );

    toObserve.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [root]);
}

/* ------------------------------------------------------------------ */
/* Icons — same stroke language as the rest of the product             */
/* ------------------------------------------------------------------ */

function DatabaseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse cx="12" cy="5.5" rx="8" ry="3" />
      <path d="M4 5.5V18c0 1.66 3.58 3 8 3s8-1.34 8-3V5.5" />
      <path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
      <path d="M3.5 9.5h17M3.5 15h17M9.5 3.5v17M15 3.5v17" />
    </svg>
  );
}

function HashIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 3 7 21M17 3l-2 18M4 8.5h17M3 15.5h17" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5" />
      <circle cx="12" cy="16.2" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CheckShieldIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3 4.5 6v6c0 4.5 3 7.5 7.5 9 4.5-1.5 7.5-4.5 7.5-9V6L12 3Z" />
      <path className="ar-check-path" d="M8.5 12.2l2.4 2.4 4.6-4.9" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12.5 3.5H6a2.5 2.5 0 0 0-2.5 2.5v6.5L12.4 21.4a1.5 1.5 0 0 0 2.12 0l6.88-6.88a1.5 1.5 0 0 0 0-2.12L12.5 3.5Z" />
      <circle cx="8.3" cy="8.3" r="1.3" fill="currentColor" stroke="none" />
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

function CopyIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 2.5h8l5 5V20a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V4A1.5 1.5 0 0 1 6 2.5Z" />
      <path d="M14 2.5V8h5" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

/* palette used to cycle bars/badges across repeated items */
const CYCLE = ["cyan", "violet", "amber"] as const;

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function AnalystResults({
  analysis,
  fileName,
  datasetId,
  initialQuestion,
  initialAnswer,
  analyzedAt,
  durationSeconds,
}: AnalystResultsProps) {
  const rootRef = useRef<HTMLElement>(null);
  const { isLoaded, isSignedIn } = useUser();
  const { openSignIn, openSignUp } = useClerk();
  useReveal(rootRef);

  const totalMissing = analysis.missingValues.reduce(
    (total, item) => total + item.count,
    0,
  );

  const hasNumeric = analysis.numericStats.length > 0;
  const hasCategorical = analysis.categoricalStats.length > 0;

  const analyzedLabel = formatDate(analyzedAt ?? new Date().toISOString());

  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >(() => {
    if (!initialQuestion) return [];
    return [
      { role: "user", content: initialQuestion },
      ...(initialAnswer
        ? [{ role: "assistant" as const, content: initialAnswer }]
        : []),
    ];
  });
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [guestQuestionCount, setGuestQuestionCount] = useState(initialQuestion ? 1 : 0);
  const [showGuestLoginPrompt, setShowGuestLoginPrompt] = useState(false);
  const GUEST_ANALYST_LIMIT = 2;
  const guestClaimAttemptedRef = useRef(false);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(
    null,
  );
  const chatInputRef = useRef<HTMLInputElement>(null);
  const copyResetTimerRef = useRef<number | null>(null);

  // The chat is opened automatically when a discovery question/answer exists.
  // Minimize keeps the analyst available as a floating launcher.
  const [isChatOpen, setIsChatOpen] = useState(Boolean(initialQuestion));

  const focusChatInput = () => {
    requestAnimationFrame(() => {
      chatInputRef.current?.focus();
    });
  };

  const copyAssistantResponse = async (content: string, index: number) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = content;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setCopiedMessageIndex(index);

      if (copyResetTimerRef.current !== null) {
        window.clearTimeout(copyResetTimerRef.current);
      }

      copyResetTimerRef.current = window.setTimeout(() => {
        setCopiedMessageIndex((current) =>
          current === index ? null : current,
        );
      }, 1600);
    } catch (error) {
      console.error("Copy response failed:", error);
    }
  };

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current !== null) {
        window.clearTimeout(copyResetTimerRef.current);
      }
    };
  }, []);

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
      .catch((error) => console.error("Analyst guest claim error:", error));
  }, [isLoaded, isSignedIn]);

  const sendChatMessage = async (question?: string) => {
    const message = (question ?? chatInput).trim();
    if (!message || chatLoading) return;

    if (!isSignedIn && guestQuestionCount >= GUEST_ANALYST_LIMIT) {
      setShowGuestLoginPrompt(true);
      return;
    }

    // Any new question should bring the analyst back into view.
    setIsChatOpen(true);
    setChatInput("");
    setChatError("");
    setChatMessages((prev) => [...prev, { role: "user", content: message }]);
    setChatLoading(true);

    try {
      const response = await fetch("/api/analyst/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: message,
          datasetId,
          analysis,
          fileName,
        }),
      });

      const result = await response.json();

      if (response.status === 429 && result.code === "GUEST_LIMIT_REACHED") {
        setGuestQuestionCount(GUEST_ANALYST_LIMIT);
        setChatMessages((prev) => prev.slice(0, -1));
        setShowGuestLoginPrompt(true);
        return;
      }

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to get an answer.");
      }

      const answer =
        result.answer ??
        result.message ??
        result.response ??
        "I couldn't generate an answer for that question.";

      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: String(answer) },
      ]);

      if (!isSignedIn) {
        setGuestQuestionCount((count) => Math.min(GUEST_ANALYST_LIMIT, count + 1));
      }
    } catch (error) {
      setChatError(
        error instanceof Error
          ? error.message
          : "Unable to connect to the analyst.",
      );
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I couldn't answer that right now. Please check the chat API and try again.",
        },
      ]);
    } finally {
      setChatLoading(false);
      focusChatInput();
    }
  };

  const handleChatSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendChatMessage();
  };

  useEffect(() => {
    if (isChatOpen && !chatLoading) {
      focusChatInput();
    }
  }, [isChatOpen]);

  return (
    <>
      <style>{`
        @keyframes guestAnalystPromptIn {
          from { opacity: 0; transform: translateY(12px) scale(.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .guest-analyst-overlay { position:fixed; inset:0; z-index:1000; display:flex; align-items:center; justify-content:center; padding:20px; background:rgba(2,4,10,.72); backdrop-filter:blur(10px); }
        .guest-analyst-card { width:min(440px,100%); position:relative; overflow:hidden; border:1px solid rgba(255,200,87,.28); border-radius:24px; background:radial-gradient(360px circle at 15% 0%,rgba(255,200,87,.13),transparent 62%),radial-gradient(300px circle at 100% 100%,rgba(140,124,240,.12),transparent 60%),rgba(15,17,24,.97); box-shadow:0 30px 90px rgba(0,0,0,.55),0 0 45px rgba(255,200,87,.10); animation:guestAnalystPromptIn .24s cubic-bezier(.16,1,.3,1) both; }
        .guest-analyst-close { position:absolute; top:14px; right:14px; width:34px; height:34px; display:grid; place-items:center; border-radius:10px; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.04); color:#a1a1aa; cursor:pointer; }
        .guest-analyst-close:hover { color:#fff; background:rgba(255,255,255,.09); }
        .guest-analyst-body { padding:34px 30px 28px; text-align:center; }
        .guest-analyst-icon { width:58px; height:58px; margin:0 auto 18px; display:grid; place-items:center; border-radius:18px; color:#ffd77a; border:1px solid rgba(255,200,87,.28); background:linear-gradient(135deg,rgba(255,200,87,.16),rgba(140,124,240,.10)); }
        .guest-analyst-eyebrow { margin:0 0 7px; color:#ffc857; font:600 10px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.14em; text-transform:uppercase; }
        .guest-analyst-title { margin:0; color:#fafafa; font-size:22px; line-height:1.25; font-weight:700; }
        .guest-analyst-text { margin:10px auto 0; max-width:350px; color:#a1a1aa; font-size:14px; line-height:1.65; }
        .guest-analyst-actions { display:flex; gap:10px; margin-top:24px; }
        .guest-analyst-primary,.guest-analyst-secondary { flex:1; min-height:44px; border-radius:12px; font-size:14px; font-weight:600; cursor:pointer; }
        .guest-analyst-primary { border:1px solid rgba(255,200,87,.42); color:#111827; background:linear-gradient(135deg,#ffc857,#8c7cf0); }
        .guest-analyst-secondary { border:1px solid rgba(255,255,255,.10); color:#d4d4d8; background:rgba(255,255,255,.045); }
        .guest-analyst-secondary:hover { background:rgba(255,255,255,.08); color:#fff; }
        @media(max-width:520px){ .guest-analyst-body{padding:30px 20px 22px}.guest-analyst-actions{flex-direction:column}.guest-analyst-primary,.guest-analyst-secondary{width:100%;} }
      `}</style>
      {showGuestLoginPrompt && !isSignedIn && (
        <div className="guest-analyst-overlay" role="dialog" aria-modal="true" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowGuestLoginPrompt(false); }}>
          <div className="guest-analyst-card">
            <button type="button" className="guest-analyst-close" onClick={() => setShowGuestLoginPrompt(false)} aria-label="Close">×</button>
            <div className="guest-analyst-body">
              <div className="guest-analyst-icon" aria-hidden="true">✦</div>
              <p className="guest-analyst-eyebrow">AI Data Analyst</p>
              <h2 className="guest-analyst-title">Ready for more AI?</h2>
              <p className="guest-analyst-text">You’ve used your 2 free AI Data Analyst questions. Log in to continue analyzing your data and keep your conversation saved.</p>
              <div className="guest-analyst-actions">
                <button type="button" className="guest-analyst-primary" onClick={() => { setShowGuestLoginPrompt(false); openSignIn(); }}>Yes, log in</button>
                <button type="button" className="guest-analyst-secondary" onClick={() => { setShowGuestLoginPrompt(false); openSignUp(); }}>Create account</button>
              </div>
              <button type="button" className="guest-analyst-secondary" style={{ width: "100%", marginTop: 10 }} onClick={() => setShowGuestLoginPrompt(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div
        className={`analyst-shell ${isChatOpen ? "chat-open" : "chat-minimized"}`}
    >
      <section className="analysis-results" ref={rootRef}>
        <div className="ar-glow" aria-hidden="true" />

        {/* Header */}
        <div className="results-header ar-enter">
          <div>
            <div className="results-eyebrow">
              <span className="results-status-dot" />
              ANALYSIS COMPLETE
            </div>

            <h2>Your data, understood.</h2>

            {fileName && <p className="results-file-name">{fileName}</p>}

            <p className="results-description">
              A1.ai analyzed your dataset and found the following patterns and
              statistics.
            </p>
          </div>
        </div>

        {/* Overview */}
        <div className="results-overview-grid ar-enter ar-enter-2">
          <div className="result-overview-card">
            <div className="roc-icon roc-cyan">
              <DatabaseIcon />
            </div>
            <div className="roc-body">
              <span>ROWS</span>
              <strong>{formatNumber(analysis.rowCount)}</strong>
              <small>records analyzed</small>
            </div>
          </div>

          <div className="result-overview-card">
            <div className="roc-icon roc-violet">
              <GridIcon />
            </div>
            <div className="roc-body">
              <span>COLUMNS</span>
              <strong>{formatNumber(analysis.columnCount)}</strong>
              <small>fields detected</small>
            </div>
          </div>

          <div className="result-overview-card">
            <div className="roc-icon roc-amber">
              <HashIcon />
            </div>
            <div className="roc-body">
              <span>NUMERIC</span>
              <strong>{analysis.numericStats.length}</strong>
              <small>numeric fields</small>
            </div>
          </div>

          <div className="result-overview-card">
            <div
              className={`roc-icon ${totalMissing === 0 ? "roc-cyan" : "roc-danger"}`}
            >
              {totalMissing === 0 ? <CheckShieldIcon /> : <AlertIcon />}
            </div>
            <div className="roc-body">
              <span>MISSING</span>
              <strong>{formatNumber(totalMissing)}</strong>
              <small>
                {totalMissing === 0
                  ? "no missing values"
                  : "missing values found"}
              </small>
            </div>
          </div>
        </div>

        {/* Numeric + Categorical analysis, paired side by side */}
        <div
          className={hasNumeric && hasCategorical ? "results-row" : undefined}
        >
          {hasNumeric && (
            <div className="results-section" data-ar-reveal>
              <div className="results-section-heading">
                <div>
                  <span className="section-eyebrow">NUMERIC ANALYSIS</span>
                  <h3>Key metrics</h3>
                </div>
                <span className="section-count">
                  {analysis.numericStats.length} field
                  {analysis.numericStats.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="numeric-results-grid">
                {analysis.numericStats.map((stat, i) => {
                  const hasRange =
                    typeof stat.min === "number" &&
                    typeof stat.max === "number" &&
                    stat.max > stat.min;

                  const percent = hasRange
                    ? Math.min(
                        100,
                        Math.max(
                          0,
                          ((stat.average - (stat.min as number)) /
                            ((stat.max as number) - (stat.min as number))) *
                            100,
                        ),
                      )
                    : 0;

                  const accent = CYCLE[i % CYCLE.length];

                  return (
                    <div
                      className="numeric-result-card"
                      key={stat.column}
                      style={{ animationDelay: `${i * 0.06}s` }}
                    >
                      <div className="metric-card-top">
                        <span className={`metric-icon metric-icon-${accent}`}>
                          <HashIcon />
                        </span>
                        <span className="metric-column">{stat.column}</span>
                      </div>

                      <div className="metric-main">
                        <strong>
                          {isCurrencyColumn(stat.column) ? "₹" : ""}
                          {formatNumber(stat.sum)}
                        </strong>
                        <span>Total</span>
                      </div>

                      {hasRange && (
                        <div className="metric-range">
                          <div className="metric-range-track">
                            <div
                              className={`metric-range-fill metric-range-${accent}`}
                              style={{ width: `${percent}%` }}
                            />
                            <div
                              className={`metric-range-dot metric-range-dot-${accent}`}
                              style={{ left: `${percent}%` }}
                            />
                          </div>
                          <div className="metric-range-labels">
                            <span>min {formatAverage(stat.min as number)}</span>
                            <span>max {formatAverage(stat.max as number)}</span>
                          </div>
                        </div>
                      )}

                      <div className="metric-details">
                        <div>
                          <span>Average</span>
                          <strong>{formatAverage(stat.average)}</strong>
                        </div>
                        <div>
                          <span>Records</span>
                          <strong>{stat.count}</strong>
                        </div>
                        <div>
                          <span>Missing</span>
                          <strong>{stat.missing}</strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Categorical analysis */}
          {hasCategorical && (
            <div className="results-section" data-ar-reveal>
              <div className="results-section-heading">
                <div>
                  <span className="section-eyebrow">CATEGORICAL ANALYSIS</span>
                  <h3>Understand your categories</h3>
                </div>
                <span className="section-count">
                  {analysis.categoricalStats.length} field
                  {analysis.categoricalStats.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="categorical-results-grid">
                {analysis.categoricalStats.map((stat, i) => (
                  <div
                    className="categorical-result-card"
                    key={stat.column}
                    style={{ animationDelay: `${i * 0.06}s` }}
                  >
                    <div className="category-card-header">
                      <div>
                        <span className="category-label">
                          <TagIcon />
                          CATEGORY
                        </span>
                        <h4>{stat.column}</h4>
                      </div>
                      <div className="unique-count">
                        <strong>{stat.unique}</strong>
                        <span>unique</span>
                      </div>
                    </div>

                    <div className="category-stats">
                      <span>{stat.count} records</span>
                      <span>{stat.missing} missing</span>
                    </div>

                    {stat.topValues.length > 0 && (
                      <div className="top-values">
                        <span className="top-values-title">Top values</span>

                        {stat.topValues.slice(0, 5).map((item, index) => {
                          const share =
                            stat.count > 0
                              ? Math.min(100, (item.count / stat.count) * 100)
                              : 0;
                          const accent = CYCLE[index % CYCLE.length];

                          return (
                            <div
                              className="top-value-row"
                              key={`${stat.column}-${String(item.value)}-${index}`}
                            >
                              <div className="top-value-line">
                                <span>{String(item.value)}</span>
                                <strong>{item.count}</strong>
                              </div>
                              <div className="top-value-track">
                                <div
                                  className={`top-value-fill top-value-${accent}`}
                                  style={{ width: `${share}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Data quality */}
        <div className="results-section" data-ar-reveal>
          <div className="results-section-heading">
            <div>
              <span className="section-eyebrow">DATA QUALITY</span>
              <h3>Dataset health</h3>
            </div>
          </div>

          <div
            className={`data-quality-card ${totalMissing === 0 ? "quality-good" : ""}`}
          >
            <div className="quality-icon">
              {totalMissing === 0 ? <CheckShieldIcon /> : <AlertIcon />}
            </div>
            <div>
              <h4>
                {totalMissing === 0
                  ? "Your dataset looks clean"
                  : "Some data needs attention"}
              </h4>
              <p>
                {totalMissing === 0
                  ? "No missing values were detected across the analyzed columns."
                  : `${formatNumber(totalMissing)} missing value${totalMissing === 1 ? "" : "s"} were detected in your dataset.`}
              </p>
            </div>
          </div>
        </div>

        {/* Meta footer */}
        <div className="results-meta ar-enter">
          {fileName && (
            <span>
              <FileIcon />
              {fileName}
            </span>
          )}
          {analyzedLabel && (
            <span>
              <CalendarIcon />
              Analyzed on {analyzedLabel}
            </span>
          )}
          {typeof durationSeconds === "number" && (
            <span>
              <ClockIcon />
              Analysis completed in {durationSeconds.toFixed(1)}s
            </span>
          )}
        </div>
      </section>

      {/* AI analyst — sticky sidebar taking up the right half of the viewport */}
      {isChatOpen ? (
        <aside className="ai-chat-panel" aria-label="AI data analyst chat">
          <div className="ai-chat-glow" aria-hidden="true" />

          <div className="ai-chat-topbar">
            <div className="ai-chat-title">
              <span className="ai-chat-spark">✦</span>
              <span>AI ANALYST</span>
            </div>
            <div className="ai-chat-actions">
              <span className="ai-chat-live">
                <span />
                READY
              </span>
              <button
                type="button"
                className="ai-chat-minimize"
                onClick={() => setIsChatOpen(false)}
                aria-label="Minimize AI analyst"
                title="Minimize"
              >
                <span aria-hidden="true">−</span>
              </button>
            </div>
          </div>

          <div className="ai-chat-header">
            <div>
              <h3>Ask your data anything.</h3>
              <p>
                Ask questions about the dataset, metrics, categories, trends, or
                anything visible in this analysis.
              </p>
            </div>
          </div>

          <div className="ai-chat-messages" aria-live="polite">
            {chatMessages.length === 0 ? (
              <div className="ai-chat-empty">
                <div className="ai-chat-empty-icon">✦</div>
                <strong>What would you like to know?</strong>
                <span>Try one of these questions:</span>

                <div className="ai-chat-suggestions">
                  {[
                    "Which product has the highest number of records?",
                    "Which region has the most records?",
                    "What is the total revenue?",
                    "Summarize the key findings.",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => void sendChatMessage(suggestion)}
                      disabled={chatLoading}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              chatMessages.map((message, index) => (
                <div
                  className={`ai-chat-message ai-chat-message-${message.role}`}
                  key={`${message.role}-${index}`}
                >
                  <span className="ai-chat-message-label">
                    {message.role === "user" ? "YOU" : "A1.AI"}
                  </span>

                  <div className="ai-chat-message-body">
                    <div className="ai-chat-message-content">
                      {renderMarkdown(message.content)}
                    </div>

                    {message.role === "assistant" && (
                      <button
                        type="button"
                        className={`ai-chat-copy-button ${
                          copiedMessageIndex === index ? "is-copied" : ""
                        }`}
                        onClick={() =>
                          void copyAssistantResponse(message.content, index)
                        }
                        aria-label={
                          copiedMessageIndex === index
                            ? "Copied response"
                            : "Copy response"
                        }
                        title={
                          copiedMessageIndex === index
                            ? "Copied"
                            : "Copy response"
                        }
                      >
                        <span className="ai-chat-copy-icon" aria-hidden="true">
                          {copiedMessageIndex === index ? (
                            <CheckIcon />
                          ) : (
                            <CopyIcon />
                          )}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}

            {chatLoading && (
              <div className="ai-chat-message ai-chat-message-assistant">
                <span className="ai-chat-message-label">A1.AI</span>
                <div className="ai-chat-thinking">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
          </div>

          {chatError && <p className="ai-chat-error">{chatError}</p>}

          <form className="ai-chat-form" onSubmit={handleChatSubmit}>
            <input
              ref={chatInputRef}
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              placeholder="Ask anything about your data..."
              disabled={chatLoading}
              aria-label="Ask a question about your data"
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || chatLoading}
              aria-label="Send question"
            >
              <ArrowIcon />
            </button>
          </form>

          <p className="ai-chat-note">
            Answers are generated from the analysis currently shown above.
          </p>
        </aside>
      ) : (
        <button
          type="button"
          className="ai-chat-fab"
          onClick={() => setIsChatOpen(true)}
          aria-label="Open AI analyst"
          title="Open AI analyst"
        >
          <span className="ai-chat-fab-orbit" aria-hidden="true" />
          <span className="ai-chat-fab-orbit" aria-hidden="true" />
          <span className="ai-chat-fab-spark">✦</span>
          <span className="ai-chat-fab-label">Ask A1.ai</span>
        </button>
      )}
    </div>
    </>
  );
}
