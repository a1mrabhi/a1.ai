"use client";

import {
  useEffect,
  useRef,
  useState,
  ReactNode,
  MouseEvent as ReactMouseEvent,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";

/**
 * A1.ai — post-login Dashboard
 * -----------------------------------------------------------------------
 * Drop-in usage (Next.js App Router):
 *   Save as app/dashboard/page.jsx (or wherever your authed route lives).
 *   Shares the exact design tokens, fonts and motion language as
 *   LandingPage.tsx so the transition after sign-in feels seamless.
 *   Plain React + CSS, no Tailwind, no framer-motion required.
 *
 *   v2: the header's search box has been replaced with a routed nav pill
 *   (Dashboard / Smart Chat / Data Analyst). It occupies the exact same
 *   slot and max-width the search box used to, uses next/link so clicking
 *   a tab actually navigates, and — per feedback — uses a single unified
 *   violet accent for all three tabs (no amber/cyan tint per-tab), so it
 *   always reads like the calm "dashboard" state, never a colored alert.
 * -----------------------------------------------------------------------
 */

interface LaunchCard {
  id: string;
  accent: "violet" | "amber" | "cyan";
  eyebrow: string;
  title: string;
  desc: string;
  cta: string;
  href: string;
  icon: ReactNode;
}

const LAUNCH_CARDS: LaunchCard[] = [
  {
    id: "chat",
    accent: "violet",
    eyebrow: "Talk it through",
    title: "AI Smart Chat",
    desc: "Ask anything in plain language and get answers grounded in your own notes and course material.",
    cta: "Open chat",
    href: "/chat",
    icon: (
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-8Z" />
    ),
  },
  {
    id: "analyst",
    accent: "amber",
    eyebrow: "Explore your data",
    title: "AI Data Analyst",
    desc: "Upload CSV or Excel data and let AI discover patterns, trends, anomalies, and insights with evidence.",
    cta: "Analyze data",
    href: "/analyst",
    icon: (
      <>
        <path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
        <path d="M14 3v5h5" />
      </>
    ),
  },
];

/* Nav pill tab config. Icons reuse the exact same paths as the launch
   cards above so the icon language stays identical between the header
   and the cards it links to — a person recognizes the chat icon twice. */
const NAV_TABS = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    exact: true,
    icon: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
  },
  {
    id: "chat",
    label: "AISmart Chat",
    href: "/chat",
    exact: false,
    icon: (
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-8Z" />
    ),
  },
  {
    id: "analyst",
    label: "AI Data Analyst",
    href: "/analyst",
    exact: false,
    icon: (
      <>
        <path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
        <path d="M14 3v5h5" />
      </>
    ),
  },
];

interface WorkspaceStats {
  chats: number;
  datasets: number;
}

const EMPTY_STATS: WorkspaceStats = { chats: 0, datasets: 0 };

/* ------------------------------------------------------------------ */
/* Hooks                                                               */
/* ------------------------------------------------------------------ */

function useReveal() {
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
      { threshold: 0.16, rootMargin: "0px 0px -40px 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function useGreeting(name?: string | null) {
  const [state, setState] = useState({
    text: "Good day",
    period: "day",
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const h = new Date().getHours();

      if (h < 5) {
        setState({ text: "Still up", period: "night" });
      } else if (h < 12) {
        setState({ text: "Good morning", period: "morning" });
      } else if (h < 17) {
        setState({ text: "Good afternoon", period: "afternoon" });
      } else if (h < 21) {
        setState({ text: "Good evening", period: "evening" });
      } else {
        setState({ text: "Good night", period: "night" });
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const who = name ? `, ${name}` : "";

  return {
    line: `${state.text}${who}`,
    period: state.period,
  };
}

function useClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function useWorkspaceStats() {
  const [stats, setStats] = useState<WorkspaceStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      // Replace with your real endpoint — this intentionally has no
      // fallback fake data. If the request fails, we surface zeros.
      const res = await fetch("/api/workspace/stats", { cache: "no-store" });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      setStats({
        chats: Number(data?.chats) || 0,
        datasets: Number(data?.datasets) || 0,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load workspace stats",
      );
      setStats(EMPTY_STATS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { stats, loading, error, refresh: load };
}

/* ------------------------------------------------------------------ */
/* Nav pill — replaces the old search box, same slot & max-width       */
/* ------------------------------------------------------------------ */

function NavPill({ stats, loading }: { stats: WorkspaceStats; loading: boolean }) {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const [indicator, setIndicator] = useState({ x: 0, width: 0, ready: false });

  const activeIndex = (() => {
    const i = NAV_TABS.findIndex((t) =>
      t.exact ? pathname === t.href : pathname?.startsWith(t.href),
    );
    return i === -1 ? 0 : i;
  })();

  const measure = () => {
    const el = itemRefs.current[activeIndex];
    const container = containerRef.current;
    if (!el || !container) return;
    const cRect = container.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setIndicator({ x: r.left - cRect.left, width: r.width, ready: true });
  };

  useEffect(() => {
    measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  return (
    <nav className="nav-outer" aria-label="Primary">
      <div className="nav-pill" ref={containerRef}>
        <div
          className="indicator"
          style={{
            transform: `translateX(${indicator.x}px)`,
            width: `${indicator.width}px`,
            opacity: indicator.ready ? 1 : 0,
          }}
        />
        {NAV_TABS.map((tab, i) => {
          const isActive = i === activeIndex;
          const statValue =
            tab.id === "chat" ? stats.chats : tab.id === "analyst" ? stats.datasets : null;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              className={`nav-item ${isActive ? "active" : ""}`}
            >
              <svg
                className="ic"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                {tab.icon}
              </svg>
              {tab.label}
              {statValue !== null && (
                <span className={`label-count ${isActive ? "show" : ""}`}>
                  {loading ? "…" : statValue}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Interactive bits                                                     */
/* ------------------------------------------------------------------ */

function LaunchCardView({
  card,
  index,
  statValue,
  statLabel,
  statLoading,
}: {
  card: LaunchCard;
  index: number;
  statValue: number;
  statLabel: string;
  statLoading: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const onMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return (
    <Link href={card.href} style={{ textDecoration: "none", color: "inherit" }}>
      <div className={`launch-ring ${card.accent === "amber" ? "ring-amber" : "ring-violet"}`}>
      <div className="launch-ring-clip" aria-hidden="true">
        <div className="launch-ring-spin" />
      </div>
      <div
        ref={ref}
        onMouseMove={onMove}
        className={`launch-card accent-${card.accent}`}
        data-reveal
        style={{ transitionDelay: `${index * 90}ms` }}
      >
        <div className="launch-spot" />
        <div className="launch-deco" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          >
            {card.icon}
          </svg>
        </div>

        <div className="launch-top">
          <div className="launch-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {card.icon}
            </svg>
          </div>
          <span className="launch-eyebrow">{card.eyebrow}</span>
        </div>

        <h3>{card.title}</h3>
        <p>{card.desc}</p>

        <div className="launch-bottom">
          <div className="launch-cta">
            {card.cta} <ArrowIcon />
          </div>
          <span className={`launch-stat ${statLoading ? "is-loading" : ""}`}>
            {statLoading ? "Syncing…" : `${statValue} ${statLabel}`}
          </span>
        </div>

        <div className="launch-corner" />
      </div>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Icons                                                                */
/* ------------------------------------------------------------------ */

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
/* ------------------------------------------------------------------ */
/* Main component                                                       */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  useReveal();
  const { user } = useUser();
  const { line: greeting } = useGreeting(user?.firstName);
  const clock = useClock();
  const { stats, loading } = useWorkspaceStats();

  return (
    <>
      <style>{CSS}</style>

      <div className="grain" aria-hidden="true" />

      <header>
        <div className="container nav">
          <Link href="/" className="logo">
            <span className="mark">
              <span className="mark-core" />
            </span>
            A1.ai
          </Link>

          <NavPill stats={stats} loading={loading} />

          <div className="nav-actions">
            <UserButton appearance={{ elements: { avatarBox: "w-9 h-9" } }} />
          </div>
        </div>
      </header>

      <main>
        <section className="greet">
          <div className="aurora aurora-dash" aria-hidden="true">
            <span className="blob blob-violet" />
            <span className="blob blob-amber" />
            <span className="blob blob-cyan" />
            <div className="grid-floor" />
          </div>

          <div className="container greet-inner">
            <span className="eyebrow eyebrow-enter">
              <span className="dot" /> {clock || "—:—"} local time · workspace
              synced
            </span>
            <h1 className="greet-enter">
              {greeting}
              <span className="grad-text">.</span>
            </h1>
            <p className="greet-sub greet-enter-2">
              What are we working on
              <span className="caret" />
            </p>
          </div>
        </section>

        <section className="launch">
          {/* Ambient background dressing — beams, particles, corner tags */}
          <div className="launch-ambient" aria-hidden="true">
            <div className="launch-grid-floor" />
            <span className="launch-blob lb-l" />
            <span className="launch-blob lb-r" />

            <span className="beam beam-l" />
            <span className="beam beam-r" />

            <span className="particle p1" />
            <span className="particle p2" />
            <span className="particle p3" />
            <span className="particle p4" />
            <span className="particle p5" />

            <div className="launch-tag tag-l">
              <span className="tag-dot" />
              WORKSPACE ACTIVE
            </div>
            <div className="launch-tag tag-r">
              02 MODULES ONLINE
              <span className="tag-dot" />
            </div>
          </div>

          <div className="container">
            <div className="launch-grid">
              {LAUNCH_CARDS.map((c, i) => {
                const statValue =
                  c.id === "chat" ? stats.chats : stats.datasets;
                const statLabel =
                  c.id === "chat" ? "chats" : "datasets analyzed";
                return (
                  <LaunchCardView
                    key={c.id}
                    card={c}
                    index={i}
                    statValue={statValue}
                    statLabel={statLabel}
                    statLoading={loading}
                  />
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                                */
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
  --coral:#FF8B7A;
  --coral-dim: rgba(255,139,122,0.14);
  --font-display:'Fraunces', serif;
  --font-body:'Inter', sans-serif;
  --font-mono:'IBM Plex Mono', monospace;
}

html{ scroll-behavior:smooth; background:var(--bg); }
*{ box-sizing:border-box; margin:0; padding:0; }
body{
  background:var(--bg); color:var(--text-primary); font-family:var(--font-body);
  -webkit-font-smoothing:antialiased; overflow-x:hidden;
}
.container{ max-width:1180px; margin:0 auto; padding:0 28px; }

.grain{
  position:fixed; inset:0; pointer-events:none; z-index:200; opacity:.035; mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

/* ---------- Header ---------- */
header{ position:sticky; top:0; z-index:50; background:rgba(5,7,14,0.72); backdrop-filter:blur(14px) saturate(140%); border-bottom:1px solid var(--border); }
.nav{ display:flex; align-items:center; justify-content:space-between; gap:24px; height:68px; }
.logo{ display:flex; align-items:center; gap:10px; font-family:var(--font-display); font-weight:600; font-size:19px; color:var(--text-primary); text-decoration:none; flex-shrink:0; }
.mark{ width:24px; height:24px; border-radius:7px; position:relative; background:conic-gradient(from 180deg, var(--amber), var(--violet), var(--cyan), var(--amber)); flex-shrink:0; animation:markSpin 6s linear infinite; padding:2px; }
.mark-core{ position:absolute; inset:2px; border-radius:5px; background:var(--bg); }
@keyframes markSpin{ to{ transform:rotate(360deg);} }

/* ---------- Nav pill (replaces the old search box, same slot/width) ---------- */
.nav-outer{
  flex:1; max-width:420px; margin:0 auto;
  padding:1px; border-radius:13px;
  background:conic-gradient(from var(--rot,0deg), rgba(140,124,240,.42), rgba(84,232,214,.24), rgba(140,124,240,.42));
  animation:rotateBorder 9s linear infinite;
}
@keyframes rotateBorder{ to{ --rot:360deg; } }
@property --rot{ syntax:'<angle>'; inherits:true; initial-value:0deg; }

.nav-pill{
  position:relative; display:flex; align-items:center; gap:4px;
  background:rgba(10,13,24,0.94); border-radius:13px; padding:7px;
}
.indicator{
  position:absolute; top:7px; left:0; height:calc(100% - 14px);
  background:linear-gradient(155deg, rgba(255,255,255,.055), rgba(255,255,255,.012));
  border:1px solid rgba(255,255,255,.08);
  border-radius:8px;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.05), inset 0 -1px 0 rgba(0,0,0,.22);
  transition:transform .4s cubic-bezier(.16,1,.3,1), width .4s cubic-bezier(.16,1,.3,1), opacity .25s ease;
  pointer-events:none;
}
.nav-item{
  position:relative; z-index:1; display:flex; align-items:center; gap:6px;
  font-family:var(--font-body); font-weight:500; font-size:12.5px; white-space:nowrap;
  color:var(--text-tertiary); padding:8px 12px; border-radius:8px; cursor:pointer;
  text-decoration:none; transition:color .25s ease;
}
.nav-item .ic{ width:14px; height:14px; flex-shrink:0; }
.nav-item.active{ color:var(--text-primary); }
.nav-item:not(.active):hover{ color:var(--text-secondary); }
.nav-item:active{ transform:scale(.97); }
.label-count{
  font-family:var(--font-mono); font-size:9.5px; color:var(--violet);
  background:rgba(140,124,240,.14); border-radius:5px; padding:1px 5px;
  opacity:0; transform:translateY(2px); transition:opacity .25s ease, transform .25s ease;
}
.label-count.show{ opacity:1; transform:translateY(0); }

.nav-actions{ display:flex; align-items:center; gap:14px; flex-shrink:0; }
@keyframes pulseDot{ 0%{ box-shadow:0 0 0 0 rgba(84,232,214,.55);} 70%{ box-shadow:0 0 0 8px rgba(84,232,214,0);} 100%{ box-shadow:0 0 0 0 rgba(84,232,214,0);} }

/* ---------- Buttons / magnetic ---------- */
.btn{
  font-family:var(--font-body); font-weight:600; font-size:14px; padding:12px 20px; border-radius:9px;
  display:inline-flex; align-items:center; gap:8px; cursor:pointer; border:none; text-decoration:none; transition:transform .15s ease, box-shadow .2s ease;
}
.btn-primary{ background:linear-gradient(135deg, var(--amber), #ffb238); color:#20130A; box-shadow:0 0 0 1px rgba(255,200,87,.15), 0 8px 24px -8px rgba(255,200,87,.55); }
.magnetic{ transition:transform .18s cubic-bezier(.2,.8,.2,1); }

/* ---------- Aurora / grid floor (shared with landing) ---------- */
.aurora{ position:absolute; inset:0; overflow:hidden; z-index:0; pointer-events:none; }
.blob{ position:absolute; border-radius:50%; filter:blur(90px); opacity:.28; animation:blobFloat 16s ease-in-out infinite; }
.blob-violet{ width:380px; height:380px; background:var(--violet); top:-100px; left:8%; animation-delay:0s; }
.blob-amber{ width:320px; height:320px; background:var(--amber); top:-40px; right:10%; animation-delay:-5s; opacity:.2; }
.blob-cyan{ width:280px; height:280px; background:var(--cyan); bottom:-120px; left:42%; animation-delay:-10s; opacity:.16; }
@keyframes blobFloat{ 0%,100%{ transform:translate(0,0) scale(1);} 50%{ transform:translate(20px,-24px) scale(1.06);} }
.grid-floor{
  position:absolute; inset:0;
  background-image:linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px);
  background-size:56px 56px; mask-image:radial-gradient(ellipse 70% 60% at 50% 0%, black 30%, transparent 75%); opacity:.5;
}

/* ---------- Greeting ---------- */
.greet{ position:relative; padding:64px 0 40px; overflow:hidden; }
.aurora-dash{ z-index:0; }
.greet-inner{ position:relative; z-index:1; }
.eyebrow{
  display:inline-flex; align-items:center; gap:9px; font-family:var(--font-mono); font-size:11.5px;
  letter-spacing:.08em; text-transform:uppercase; color:var(--violet); background:var(--violet-dim);
  border:1px solid rgba(140,124,240,.3); border-radius:99px; padding:7px 14px 7px 11px; margin-bottom:22px;
}
.eyebrow .dot{ width:6px; height:6px; border-radius:50%; background:var(--cyan); box-shadow:0 0 0 0 rgba(84,232,214,.6); animation:pulseDot 2s ease-out infinite; }
h1{ font-family:var(--font-display); font-weight:600; font-size:clamp(32px,4.4vw,50px); line-height:1.1; letter-spacing:-.01em; margin-bottom:12px; }
.grad-text{ background:linear-gradient(100deg, var(--amber), var(--violet) 60%, var(--cyan)); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; }
.greet-sub{ font-family:var(--font-display); font-style:italic; font-size:clamp(18px,2vw,22px); color:var(--text-secondary); }
.caret{ display:inline-block; width:8px; height:20px; background:var(--cyan); margin-left:5px; vertical-align:-4px; animation:blink .9s steps(2) infinite; }
@keyframes blink{ 0%,100%{ opacity:1;} 50%{ opacity:0;} }

.eyebrow-enter, .greet-enter, .greet-enter-2{ opacity:0; transform:translateY(14px); animation:riseIn .7s cubic-bezier(.16,1,.3,1) forwards; }
.greet-enter{ animation-delay:.08s; }
.greet-enter-2{ animation-delay:.18s; }
@keyframes riseIn{ to{ opacity:1; transform:translateY(0);} }

/* ---------- Launch cards ---------- */
.launch{ padding:36px 0 88px; position:relative; z-index:1; overflow:hidden; }

/* Ambient full-bleed dressing that carries the aurora down past the greeting
   section so the void either side of the cards isn't flat black. */
.launch-ambient{ position:absolute; inset:0; z-index:0; pointer-events:none; }
.launch-grid-floor{
  position:absolute; inset:-40% 0 0 0;
  background-image:linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px);
  background-size:56px 56px;
  mask-image:radial-gradient(ellipse 90% 70% at 50% 30%, black 0%, transparent 72%);
  opacity:.3;
}
.launch-blob{ position:absolute; border-radius:50%; filter:blur(110px); opacity:.18; animation:blobFloat 18s ease-in-out infinite; }
.lb-l{ width:360px; height:360px; background:var(--violet); top:8%; left:-10%; animation-delay:-3s; }
.lb-r{ width:320px; height:320px; background:var(--amber); bottom:-8%; right:-8%; opacity:.14; animation-delay:-9s; }

/* Soft vertical light beams standing in the gutters — no shape to read as
   "broken", just glow, like light falling through a gap. */
.beam{
  position:absolute; top:6%; bottom:6%; width:1px;
  background:linear-gradient(to bottom, transparent, var(--violet) 45%, var(--cyan) 55%, transparent);
  opacity:.22; filter:blur(1px);
  animation:beamPulse 5s ease-in-out infinite;
}
.beam::before{
  content:''; position:absolute; inset:-1px -22px;
  background:inherit; filter:blur(26px); opacity:.7;
}
.beam-l{ left:44px; }
.beam-r{ right:44px; animation-delay:-2.4s; }
@keyframes beamPulse{ 0%,100%{ opacity:.14; transform:scaleY(.94);} 50%{ opacity:.32; transform:scaleY(1);} }

/* Slow drifting particles for depth */
.particle{
  position:absolute; width:3px; height:3px; border-radius:50%; background:var(--cyan);
  box-shadow:0 0 8px 1px rgba(84,232,214,.5); opacity:0;
  animation:particleDrift 9s ease-in-out infinite;
}
.p1{ left:5%; top:20%; animation-delay:0s; background:var(--violet); box-shadow:0 0 8px 1px rgba(140,124,240,.5); }
.p2{ left:9%; top:70%; animation-delay:-2s; }
.p3{ right:6%; top:30%; animation-delay:-4.5s; background:var(--amber); box-shadow:0 0 8px 1px rgba(255,200,87,.5); }
.p4{ right:11%; top:78%; animation-delay:-1.2s; }
.p5{ left:2.5%; top:48%; animation-delay:-6s; background:var(--amber); box-shadow:0 0 8px 1px rgba(255,200,87,.5); }
@keyframes particleDrift{
  0%{ opacity:0; transform:translateY(10px); }
  15%{ opacity:.7; }
  50%{ opacity:.45; transform:translateY(-16px); }
  85%{ opacity:.7; }
  100%{ opacity:0; transform:translateY(-30px); }
}

/* Small static tags anchoring the gutters, same eyebrow language as the
   greeting badge, so the empty space feels like part of the UI system. */
.launch-tag{
  position:absolute; bottom:8%; display:flex; align-items:center; gap:8px;
  font-family:var(--font-mono); font-size:10.5px; letter-spacing:.1em; color:var(--text-tertiary);
  white-space:nowrap;
}
.tag-l{ left:24px; }
.tag-r{ right:24px; }
.tag-dot{ width:5px; height:5px; border-radius:50%; background:var(--cyan); box-shadow:0 0 0 0 rgba(84,232,214,.6); animation:pulseDot 2.2s ease-out infinite; flex-shrink:0; }

@media (max-width:1300px){
  .beam, .particle, .launch-tag{ display:none; }
}

.launch-grid{ display:grid; grid-template-columns:repeat(2,1fr); gap:24px; max-width:1040px; margin:0 auto; position:relative; z-index:1; }

/* Rotating premium ring — a genuinely-rotating conic-gradient (real
   transform:rotate, always animates) that is masked with content-box
   exclusion so it can ONLY ever paint a thin 2px band around the card —
   the interior is cut out at the source, not just visually covered.
   This matters because the card's own background is a faint translucent
   tint, not opaque, so covering wouldn't be enough on its own. The mask
   + overflow:hidden live entirely on this frame element, a sibling of
   .launch-card (not an ancestor), so the card and its hover shadow are
   completely untouched. */
.launch-ring{ position:relative; border-radius:22px; }
.launch-ring-clip{
  position:absolute; inset:-2px; border-radius:22px; padding:2px; overflow:hidden; z-index:0; pointer-events:none;
  -webkit-mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite:xor;
  mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask-composite:exclude;
}
.launch-ring-spin{
  position:absolute; inset:-75%;
  background:conic-gradient(from 0deg,
    rgba(140,124,240,0) 0deg,
    rgba(140,124,240,.95) 25deg,
    rgba(84,232,214,.55) 70deg,
    rgba(140,124,240,0) 130deg,
    rgba(140,124,240,0) 230deg,
    rgba(84,232,214,.4) 300deg,
    rgba(140,124,240,.95) 335deg,
    rgba(140,124,240,0) 360deg
  );
  animation:ringSpin 7s linear infinite;
}
.launch-ring.ring-amber .launch-ring-spin{
  background:conic-gradient(from 0deg,
    rgba(255,200,87,0) 0deg,
    rgba(255,200,87,.95) 25deg,
    rgba(140,124,240,.45) 70deg,
    rgba(255,200,87,0) 130deg,
    rgba(255,200,87,0) 230deg,
    rgba(140,124,240,.35) 300deg,
    rgba(255,200,87,.95) 335deg,
    rgba(255,200,87,0) 360deg
  );
}
@keyframes ringSpin{ to{ transform:rotate(360deg); } }

.launch-card{
  position:relative; z-index:1; background:var(--surface); border:1px solid var(--border); border-radius:20px; padding:38px 36px 30px;
  min-height:270px; display:flex; flex-direction:column;
  transition:border-color .25s ease, transform .25s ease, box-shadow .25s ease; overflow:hidden; cursor:pointer;
  opacity:0; transform:translateY(18px);
}
[data-reveal].is-in.launch-card, .launch-card.is-in{ opacity:1; transform:translateY(0); }
.launch-card[data-reveal]{ transition:opacity .6s cubic-bezier(.16,1,.3,1), transform .6s cubic-bezier(.16,1,.3,1), border-color .25s ease, box-shadow .25s ease; }
.launch-card[data-reveal].is-in{ opacity:1; transform:translateY(0); }
.launch-card:hover{ transform:translateY(-6px); border-color:var(--border-hover); box-shadow:0 28px 56px -26px rgba(140,124,240,.4); }
.launch-spot{
  position:absolute; inset:0; opacity:0; transition:opacity .3s ease; pointer-events:none;
  background:radial-gradient(320px circle at var(--mx,50%) var(--my,50%), rgba(140,124,240,.16), transparent 70%);
}
.accent-amber .launch-spot{ background:radial-gradient(320px circle at var(--mx,50%) var(--my,50%), rgba(255,200,87,.16), transparent 70%); }
.accent-cyan .launch-spot{ background:radial-gradient(320px circle at var(--mx,50%) var(--my,50%), rgba(84,232,214,.16), transparent 70%); }
.launch-card:hover .launch-spot{ opacity:1; }
.launch-deco{
  position:absolute; top:-30px; right:-30px; width:190px; height:190px; opacity:.05; pointer-events:none;
  transition:opacity .3s ease, transform .4s ease;
}
.launch-deco svg{ width:100%; height:100%; }
.accent-violet .launch-deco{ color:var(--violet); }
.accent-amber .launch-deco{ color:var(--amber); }
.accent-cyan .launch-deco{ color:var(--cyan); }
.launch-card:hover .launch-deco{ opacity:.09; transform:scale(1.06) rotate(4deg); }
.launch-corner{ position:absolute; top:18px; right:18px; width:6px; height:6px; border-radius:50%; background:var(--border-hover); opacity:0; transition:opacity .25s ease; }
.launch-card:hover .launch-corner{ opacity:1; box-shadow:0 0 10px 2px rgba(140,124,240,.6); }
.launch-top{ display:flex; align-items:center; justify-content:space-between; margin-bottom:24px; position:relative; z-index:1; }
.launch-icon{ width:54px; height:54px; border-radius:14px; display:flex; align-items:center; justify-content:center; transition:transform .25s ease; }
.launch-card:hover .launch-icon{ transform:scale(1.08) rotate(-4deg); }
.launch-icon svg{ width:24px; height:24px; }
.accent-violet .launch-icon{ background:var(--violet-dim); color:var(--violet); }
.accent-amber .launch-icon{ background:var(--amber-dim); color:var(--amber); }
.accent-cyan .launch-icon{ background:var(--cyan-dim); color:var(--cyan); }
.launch-eyebrow{ font-family:var(--font-mono); font-size:11px; letter-spacing:.07em; text-transform:uppercase; color:var(--text-tertiary); }
.launch-card h3{ font-family:var(--font-display); font-weight:600; font-size:23px; margin-bottom:12px; position:relative; z-index:1; }
.launch-card p{ font-size:14.5px; color:var(--text-secondary); line-height:1.65; position:relative; z-index:1; margin-bottom:auto; padding-bottom:26px; }
.launch-bottom{
  display:flex; align-items:center; justify-content:space-between; gap:14px; position:relative; z-index:1;
  padding-top:18px; border-top:1px solid var(--border);
}
.launch-cta{
  display:inline-flex; align-items:center; gap:7px; font-family:var(--font-mono); font-size:12.5px; letter-spacing:.03em;
  color:var(--text-primary); transition:gap .2s ease;
}
.accent-violet .launch-cta{ color:var(--violet); }
.accent-amber .launch-cta{ color:var(--amber); }
.accent-cyan .launch-cta{ color:var(--cyan); }
.launch-card:hover .launch-cta{ gap:11px; }
.launch-stat{ font-family:var(--font-mono); font-size:11.5px; color:var(--text-tertiary); transition:opacity .2s ease; }
.launch-stat.is-loading{ opacity:.6; }

/* ---------- Responsive ---------- */
@media (max-width:900px){
  .nav-outer{ display:none; }
  .launch-grid{ grid-template-columns:1fr; }
}
@media (max-width:560px){
  .nav{ gap:12px; }
  .container{ padding:0 16px; }
}
@media (prefers-reduced-motion: reduce){
  *{ animation:none !important; transition:none !important; }
  [data-reveal]{ opacity:1 !important; transform:none !important; }
  .eyebrow-enter, .greet-enter, .greet-enter-2{ opacity:1 !important; transform:none !important; }
}
`;