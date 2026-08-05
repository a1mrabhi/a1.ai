'use client';

import {
  useEffect,
  useRef,
  useState,
  ElementType,
  ReactNode,
  MouseEvent as ReactMouseEvent,
} from 'react';
import Link from 'next/link';
import { UserButton, useUser } from '@clerk/nextjs';

/**
 * A1.ai — post-login Dashboard
 * -----------------------------------------------------------------------
 * Drop-in usage (Next.js App Router):
 *   Save as app/dashboard/page.jsx (or wherever your authed route lives).
 *   Shares the exact design tokens, fonts and motion language as
 *   LandingPage.tsx so the transition after sign-in feels seamless.
 *   Plain React + CSS, no Tailwind, no framer-motion required.
 * -----------------------------------------------------------------------
 */

interface LaunchCard {
  id: string;
  accent: 'violet' | 'amber' | 'cyan';
  eyebrow: string;
  title: string;
  desc: string;
  cta: string;
  href: string;
  icon: ReactNode;
}

const LAUNCH_CARDS: LaunchCard[] = [
  {
    id: 'chat',
    accent: 'violet',
    eyebrow: 'Talk it through',
    title: 'AI Smart Chat',
    desc: 'Ask anything in plain language and get answers grounded in your own notes and course material.',
    cta: 'Open chat',
    href: '/chat',
    icon: (
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-8Z" />
    ),
  },
  {
    id: 'pdf',
    accent: 'amber',
    eyebrow: 'Point at the page',
    title: 'PDF Analyzer',
    desc: 'Drop in a chapter or paper and ask it questions directly. Every answer points back to the exact page.',
    cta: 'Analyze a PDF',
    href: '/pdf',
    icon: (
      <>
        <path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
        <path d="M14 3v5h5" />
      </>
    ),
  },
  {
    id: 'study',
    accent: 'cyan',
    eyebrow: 'Practice on repeat',
    title: 'Study Assistant',
    desc: "Turn slides or readings into structured notes and practice questions, sorted by what you're weakest on.",
    cta: 'Start studying',
    href: '/study',
    icon: (
      <>
        <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H12v16H6.5A2.5 2.5 0 0 1 4 17.5v-11Z" />
        <path d="M20 6.5A2.5 2.5 0 0 0 17.5 4H12v16h5.5a2.5 2.5 0 0 0 2.5-2.5v-11Z" />
      </>
    ),
  },
];

interface WorkspaceStats {
  chats: number;
  pdfs: number;
  studyNotes: number;
}

const EMPTY_STATS: WorkspaceStats = { chats: 0, pdfs: 0, studyNotes: 0 };

/* ------------------------------------------------------------------ */
/* Hooks                                                               */
/* ------------------------------------------------------------------ */

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('[data-reveal]');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.16, rootMargin: '0px 0px -40px 0px' }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function useGreeting(name?: string | null) {
  const [state, setState] = useState({ text: 'Good day', period: 'day' });
  useEffect(() => {
    const h = new Date().getHours();
    if (h < 5) setState({ text: 'Still up', period: 'night' });
    else if (h < 12) setState({ text: 'Good morning', period: 'morning' });
    else if (h < 17) setState({ text: 'Good afternoon', period: 'afternoon' });
    else if (h < 21) setState({ text: 'Good evening', period: 'evening' });
    else setState({ text: 'Good night', period: 'night' });
  }, []);
  const who = name ? `, ${name}` : '';
  return { line: `${state.text}${who}`, period: state.period };
}

function useClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        })
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
      const res = await fetch('/api/workspace/stats', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      setStats({
        chats: Number(data?.chats) || 0,
        pdfs: Number(data?.pdfs) || 0,
        studyNotes: Number(data?.studyNotes) || 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load workspace stats');
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
/* Interactive bits                                                     */
/* ------------------------------------------------------------------ */

interface MagneticButtonProps {
  as?: ElementType;
  className?: string;
  children?: ReactNode;
  [key: string]: any;
}

function MagneticButton({ as: As = 'a', className = '', children, ...props }: MagneticButtonProps) {
  const ref = useRef<HTMLElement | null>(null);
  const onMove = (e: ReactMouseEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left - r.width / 2) * 0.18;
    const y = (e.clientY - r.top - r.height / 2) * 0.26;
    el.style.transform = `translate(${x}px, ${y}px)`;
  };
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = 'translate(0,0)';
  };
  return (
    <As ref={ref} className={`magnetic ${className}`} onMouseMove={onMove} onMouseLeave={onLeave} {...props}>
      {children}
    </As>
  );
}

function LaunchCardView({ card, index }: { card: LaunchCard; index: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const onMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  return (
    <Link href={card.href} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div
        ref={ref}
        onMouseMove={onMove}
        className={`launch-card accent-${card.accent}`}
        data-reveal
        style={{ transitionDelay: `${index * 90}ms` }}
      >
        <div className="launch-spot" />
        <div className="launch-top">
          <div className="launch-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              {card.icon}
            </svg>
          </div>
          <span className="launch-eyebrow">{card.eyebrow}</span>
        </div>
        <h3>{card.title}</h3>
        <p>{card.desc}</p>
        <div className="launch-cta">
          {card.cta} <ArrowIcon />
        </div>
        <div className="launch-corner" />
      </div>
    </Link>
  );
}

interface WorkspaceRowProps {
  accent: 'violet' | 'amber' | 'cyan';
  icon: ReactNode;
  label: string;
  value: number;
  unit: string;
  loading: boolean;
  index: number;
}

function WorkspaceRow({ accent, icon, label, value, unit, loading, index }: WorkspaceRowProps) {
  return (
    <div
      className={`workspace-row accent-${accent}`}
      data-reveal
      style={{ transitionDelay: `${index * 70}ms` }}
    >
      <div className="workspace-row-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </svg>
      </div>
      <p className="workspace-row-label">{label}</p>
      <p className={`workspace-row-value ${loading ? 'is-loading' : ''}`}>
        {loading ? 'Syncing…' : `${value} ${unit}`}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Icons                                                                */
/* ------------------------------------------------------------------ */

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
function RefreshIcon({ spinning = false }: { spinning?: boolean }) {
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
      className={spinning ? 'spin' : ''}
    >
      <path d="M3.5 12a8.5 8.5 0 0 1 14.5-6M20.5 12a8.5 8.5 0 0 1-14.5 6" />
      <path d="M18 3v4h-4M6 21v-4h4" />
    </svg>
  );
}
function CheckedIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12l5 5L20 6" />
    </svg>
  );
}
function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="12" height="12" rx="2.5" />
      <path d="M5 15V5.5A2.5 2.5 0 0 1 7.5 3H15" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 4.5 1.5 6 2 6.5H4c.5-.5 2-2 2-6.5Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}
function SparkleIcon({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
/* Icon paths reused across the launch cards and the workspace panel,
   so the two sections stay visually consistent. */
const CHAT_ICON_PATH = (
  <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-8Z" />
);
const PDF_ICON_PATH = (
  <>
    <path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
    <path d="M14 3v5h5" />
  </>
);
const STUDY_ICON_PATH = (
  <>
    <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H12v16H6.5A2.5 2.5 0 0 1 4 17.5v-11Z" />
    <path d="M20 6.5A2.5 2.5 0 0 0 17.5 4H12v16h5.5a2.5 2.5 0 0 0 2.5-2.5v-11Z" />
  </>
);

/* ------------------------------------------------------------------ */
/* Main component                                                       */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  useReveal();
  const { user } = useUser();
  const { line: greeting } = useGreeting(user?.firstName);
  const clock = useClock();
  const [query, setQuery] = useState('');
  const { stats, loading, error, refresh } = useWorkspaceStats();
  const [copied, setCopied] = useState(false);
  const isEmpty = !loading && stats.chats === 0 && stats.pdfs === 0 && stats.studyNotes === 0;

  const handleCopy = async () => {
    const summary = `Your Workspace — ${stats.chats} chats · ${stats.pdfs} PDFs · ${stats.studyNotes} study notes`;
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access can fail (permissions, insecure context) — fail silently.
    }
  };

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

          <div className="search-wrap">
            <SearchIcon />
            <input
              className="search-input"
              placeholder="Search chats, PDFs, sessions…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <span className="search-kbd">⌘K</span>
          </div>

          <div className="nav-actions">
            <button className="icon-btn" aria-label="Notifications">
              <BellIcon />
              <span className="notif-dot" />
            </button>
            <UserButton appearance={{ elements: { avatarBox: 'w-9 h-9' } }} />
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
              <span className="dot" /> {clock || '—:—'} local time · workspace synced
            </span>
            <h1 className="greet-enter">
              {greeting}
              <span className="grad-text">.</span>
            </h1>
            <p className="greet-sub greet-enter-2">
              What are we working on<span className="caret" />
            </p>
          </div>
        </section>

        <section className="launch">
          <div className="container">
            <div className="launch-grid">
              {LAUNCH_CARDS.map((c, i) => (
                <LaunchCardView key={c.id} card={c} index={i} />
              ))}
            </div>
          </div>
        </section>

        <section className="recent">
          <div className="container">
            <div className="recent-head" data-reveal>
              <div>
                <span className="section-eyebrow">Workspace</span>
                <h2>Your workspace</h2>
              </div>
              {error && <span className="workspace-error">Couldn't sync — showing last known state</span>}
            </div>

            <div className="workspace-card" data-reveal>
              <div className="workspace-glow" aria-hidden="true" />

              <div className="workspace-top">
                <span className="workspace-title">Your Workspace</span>
                <div className="workspace-actions">
                  <button
                    className="icon-btn workspace-action"
                    aria-label="Refresh workspace stats"
                    onClick={() => refresh()}
                    disabled={loading}
                  >
                    <RefreshIcon spinning={loading} />
                  </button>
                  <button
                    className="icon-btn workspace-action"
                    aria-label="Copy workspace summary"
                    onClick={handleCopy}
                  >
                    {copied ? <CheckedIcon /> : <CopyIcon />}
                  </button>
                </div>
              </div>

              <div className="workspace-list">
                <WorkspaceRow
                  accent="violet"
                  icon={CHAT_ICON_PATH}
                  label="AI Chats"
                  value={stats.chats}
                  unit="Chats"
                  loading={loading}
                  index={0}
                />
                <WorkspaceRow
                  accent="amber"
                  icon={PDF_ICON_PATH}
                  label="PDFs"
                  value={stats.pdfs}
                  unit="Uploaded"
                  loading={loading}
                  index={1}
                />
                <WorkspaceRow
                  accent="cyan"
                  icon={STUDY_ICON_PATH}
                  label="Study Notes"
                  value={stats.studyNotes}
                  unit="Generated"
                  loading={loading}
                  index={2}
                />
              </div>

              {isEmpty && (
                <div className="workspace-empty">
                  <div className="workspace-empty-icon">
                    <SparkleIcon size={20} />
                  </div>
                  <p>
                    Nothing here yet — chat, analyze a PDF, or run a study session and it'll show up
                    in your workspace.
                  </p>
                  <MagneticButton as={Link} href="/chat" className="btn btn-primary btn-sm">
                    Start your first session <ArrowIcon />
                  </MagneticButton>
                </div>
              )}
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
.nav{ display:flex; align-items:center; gap:24px; height:68px; }
.logo{ display:flex; align-items:center; gap:10px; font-family:var(--font-display); font-weight:600; font-size:19px; color:var(--text-primary); text-decoration:none; flex-shrink:0; }
.mark{ width:24px; height:24px; border-radius:7px; position:relative; background:conic-gradient(from 180deg, var(--amber), var(--violet), var(--cyan), var(--amber)); flex-shrink:0; animation:markSpin 6s linear infinite; padding:2px; }
.mark-core{ position:absolute; inset:2px; border-radius:5px; background:var(--bg); }
@keyframes markSpin{ to{ transform:rotate(360deg);} }

.search-wrap{
  flex:1; max-width:420px; display:flex; align-items:center; gap:10px; background:var(--surface);
  border:1px solid var(--border); border-radius:10px; padding:9px 14px; color:var(--text-tertiary);
  transition:border-color .2s ease, box-shadow .2s ease; margin:0 auto;
}
.search-wrap:focus-within{ border-color:var(--border-hover); box-shadow:0 0 0 3px var(--violet-dim); color:var(--text-secondary); }
.search-input{ flex:1; background:none; border:none; outline:none; color:var(--text-primary); font-family:var(--font-body); font-size:13.5px; }
.search-input::placeholder{ color:var(--text-tertiary); }
.search-kbd{ font-family:var(--font-mono); font-size:10.5px; color:var(--text-tertiary); border:1px solid var(--border); border-radius:5px; padding:2px 6px; flex-shrink:0; }

.nav-actions{ display:flex; align-items:center; gap:14px; flex-shrink:0; }
.icon-btn{
  position:relative; width:38px; height:38px; border-radius:10px; background:var(--surface); border:1px solid var(--border);
  color:var(--text-secondary); display:flex; align-items:center; justify-content:center; cursor:pointer; transition:border-color .2s ease, color .2s ease;
}
.icon-btn:hover{ border-color:var(--border-hover); color:var(--text-primary); }
.notif-dot{
  position:absolute; top:8px; right:8px; width:7px; height:7px; border-radius:50%; background:var(--cyan);
  box-shadow:0 0 0 0 rgba(84,232,214,.6); animation:pulseDot 2s ease-out infinite;
}
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
.launch{ padding:36px 0 88px; position:relative; z-index:1; }
.launch-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:18px; }
.launch-card{
  position:relative; background:var(--surface); border:1px solid var(--border); border-radius:18px; padding:30px 28px 26px;
  transition:border-color .25s ease, transform .25s ease, box-shadow .25s ease; overflow:hidden; cursor:pointer;
  opacity:0; transform:translateY(18px);
}
[data-reveal].is-in.launch-card, .launch-card.is-in{ opacity:1; transform:translateY(0); }
.launch-card[data-reveal]{ transition:opacity .6s cubic-bezier(.16,1,.3,1), transform .6s cubic-bezier(.16,1,.3,1), border-color .25s ease, box-shadow .25s ease; }
.launch-card[data-reveal].is-in{ opacity:1; transform:translateY(0); }
.launch-card:hover{ transform:translateY(-6px); border-color:var(--border-hover); box-shadow:0 24px 48px -24px rgba(140,124,240,.35); }
.launch-spot{
  position:absolute; inset:0; opacity:0; transition:opacity .3s ease; pointer-events:none;
  background:radial-gradient(280px circle at var(--mx,50%) var(--my,50%), rgba(140,124,240,.16), transparent 70%);
}
.accent-amber .launch-spot{ background:radial-gradient(280px circle at var(--mx,50%) var(--my,50%), rgba(255,200,87,.16), transparent 70%); }
.accent-cyan .launch-spot{ background:radial-gradient(280px circle at var(--mx,50%) var(--my,50%), rgba(84,232,214,.16), transparent 70%); }
.launch-card:hover .launch-spot{ opacity:1; }
.launch-corner{ position:absolute; top:16px; right:16px; width:6px; height:6px; border-radius:50%; background:var(--border-hover); opacity:0; transition:opacity .25s ease; }
.launch-card:hover .launch-corner{ opacity:1; box-shadow:0 0 10px 2px rgba(140,124,240,.6); }
.launch-top{ display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; position:relative; z-index:1; }
.launch-icon{ width:46px; height:46px; border-radius:12px; display:flex; align-items:center; justify-content:center; transition:transform .25s ease; }
.launch-card:hover .launch-icon{ transform:scale(1.08) rotate(-4deg); }
.launch-icon svg{ width:21px; height:21px; }
.accent-violet .launch-icon{ background:var(--violet-dim); color:var(--violet); }
.accent-amber .launch-icon{ background:var(--amber-dim); color:var(--amber); }
.accent-cyan .launch-icon{ background:var(--cyan-dim); color:var(--cyan); }
.launch-eyebrow{ font-family:var(--font-mono); font-size:10.5px; letter-spacing:.06em; text-transform:uppercase; color:var(--text-tertiary); }
.launch-card h3{ font-family:var(--font-display); font-weight:600; font-size:19px; margin-bottom:10px; position:relative; z-index:1; }
.launch-card p{ font-size:13.5px; color:var(--text-secondary); line-height:1.6; position:relative; z-index:1; margin-bottom:22px; min-height:64px; }
.launch-cta{
  display:inline-flex; align-items:center; gap:7px; font-family:var(--font-mono); font-size:12px; letter-spacing:.03em;
  color:var(--text-primary); position:relative; z-index:1; transition:gap .2s ease;
}
.accent-violet .launch-cta{ color:var(--violet); }
.accent-amber .launch-cta{ color:var(--amber); }
.accent-cyan .launch-cta{ color:var(--cyan); }
.launch-card:hover .launch-cta{ gap:11px; }

/* ---------- Recent activity ---------- */
.recent{ padding:0 0 100px; position:relative; z-index:1; }
.recent-head{ display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:26px; opacity:0; transform:translateY(14px); transition:opacity .6s cubic-bezier(.16,1,.3,1), transform .6s cubic-bezier(.16,1,.3,1); }
.recent-head.is-in{ opacity:1; transform:translateY(0); }
.section-eyebrow{ font-family:var(--font-mono); font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--amber); display:block; margin-bottom:8px; }
.recent-head h2{ font-family:var(--font-display); font-weight:600; font-size:26px; }
.workspace-error{ font-family:var(--font-mono); font-size:11.5px; color:var(--coral); }

/* ---------- Workspace card (premium) ---------- */
.workspace-card{
  position:relative; max-width:680px; margin:0 auto; overflow:hidden;
  background:linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.02));
  border:1px solid var(--border); border-radius:22px; padding:28px 26px 24px;
  box-shadow:0 30px 60px -32px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.04);
  opacity:0; transform:translateY(16px);
}
.workspace-card[data-reveal]{ transition:opacity .6s cubic-bezier(.16,1,.3,1), transform .6s cubic-bezier(.16,1,.3,1), border-color .25s ease; }
.workspace-card[data-reveal].is-in{ opacity:1; transform:translateY(0); }
.workspace-card:hover{ border-color:var(--border-hover); }
.workspace-glow{
  position:absolute; top:-60%; left:50%; width:340px; height:220px; transform:translateX(-50%);
  background:radial-gradient(ellipse at center, rgba(140,124,240,.22), transparent 70%);
  pointer-events:none; z-index:0;
}
.workspace-top{ position:relative; z-index:1; display:flex; align-items:center; justify-content:space-between; margin-bottom:22px; }
.workspace-title{ font-family:var(--font-display); font-weight:600; font-size:18px; letter-spacing:-.01em; }
.workspace-actions{ display:flex; align-items:center; gap:8px; }
.workspace-action{ width:32px; height:32px; }
.workspace-action:disabled{ opacity:.5; cursor:default; }
.spin{ animation:spin .8s linear infinite; }
@keyframes spin{ to{ transform:rotate(360deg);} }

.workspace-list{ position:relative; z-index:1; display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
.workspace-row{
  display:flex; flex-direction:column; align-items:flex-start; gap:10px; padding:20px 18px;
  background:var(--surface); border:1px solid var(--border); border-radius:14px;
  transition:background .2s ease, transform .2s ease, border-color .2s ease;
  opacity:0; transform:translateY(10px);
}
.workspace-row[data-reveal]{ transition:opacity .55s cubic-bezier(.16,1,.3,1), transform .55s cubic-bezier(.16,1,.3,1), background .2s ease, border-color .2s ease; }
.workspace-row[data-reveal].is-in{ opacity:1; transform:translateY(0); }
.workspace-row:hover{ background:rgba(255,255,255,0.055); border-color:var(--border-hover); transform:translateY(-3px); }
.workspace-row-icon{
  width:40px; height:40px; border-radius:11px; display:flex; align-items:center; justify-content:center; flex-shrink:0;
  transition:transform .2s ease;
}
.workspace-row-icon svg{ width:18px; height:18px; }
.workspace-row:hover .workspace-row-icon{ transform:scale(1.06) rotate(-3deg); }
.accent-violet .workspace-row-icon{ background:var(--violet-dim); color:var(--violet); }
.accent-amber .workspace-row-icon{ background:var(--amber-dim); color:var(--amber); }
.accent-cyan .workspace-row-icon{ background:var(--cyan-dim); color:var(--cyan); }
.workspace-row-label{ font-size:14px; font-weight:600; color:var(--text-primary); }
.workspace-row-value{ font-size:12px; font-family:var(--font-mono); color:var(--text-tertiary); transition:opacity .2s ease; }
.workspace-row-value.is-loading{ opacity:.6; }

.workspace-empty{
  position:relative; z-index:1; text-align:center; margin-top:18px; padding:22px 18px 6px;
  border-top:1px solid var(--border);
}
.workspace-empty-icon{
  width:38px; height:38px; border-radius:50%; margin:14px auto 14px; display:flex; align-items:center; justify-content:center;
  background:var(--violet-dim); color:var(--violet); animation:emptyFloat 3.4s ease-in-out infinite;
}
@keyframes emptyFloat{ 0%,100%{ transform:translateY(0);} 50%{ transform:translateY(-6px);} }
.workspace-empty p{ font-size:13px; color:var(--text-secondary); line-height:1.6; margin-bottom:18px; }
.btn-sm{ font-size:13px; padding:10px 16px; }

/* ---------- Responsive ---------- */
@media (max-width:900px){
  .search-wrap{ display:none; }
  .launch-grid{ grid-template-columns:1fr; }
  .workspace-card{ padding:24px 20px 20px; }
  .workspace-list{ grid-template-columns:1fr; }
}
@media (max-width:560px){
  .nav{ gap:12px; }
}
@media (prefers-reduced-motion: reduce){
  *{ animation:none !important; transition:none !important; }
  [data-reveal]{ opacity:1 !important; transform:none !important; }
  .eyebrow-enter, .greet-enter, .greet-enter-2{ opacity:1 !important; transform:none !important; }
}
`;