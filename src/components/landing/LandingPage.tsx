"use client";

import {
  useEffect,
  useRef,
  useState,
  ElementType,
  ReactNode,
  MouseEvent as ReactMouseEvent,
} from "react";
import Link from "next/link";
import { SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";

/**
 * A1.ai — futuristic landing page
 * -----------------------------------------------------------------------
 * Drop-in usage (Next.js App Router):
 *   1. Save this file as  app/page.jsx  (or import <A1.aiLanding /> into it)
 *   2. No extra npm installs required — plain React + CSS, no Tailwind,
 *      no framer-motion. Works in App Router or Pages Router.
 *   3. Fonts load via @import in the injected <style> tag below. If you'd
 *      rather use next/font, swap the @import for next/font/google loaders
 *      for Fraunces, Inter, and IBM Plex Mono and drop the @import line.
 * -----------------------------------------------------------------------
 */

const FEATURES = [
  {
    id: "chat",
    accent: "violet",
    title: "AI Smart Chat",
    desc: "Ask anything in plain language and get answers grounded in your own notes and course material, not generic web results.",
    icon: (
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-8Z" />
    ),
  },
  {
    id: "analyst",
    accent: "amber",
    title: "AI Data Analyst",
    desc: "Upload CSV or Excel data and let AI discover patterns, trends, anomalies, and insights with evidence.",
    icon: (
      <>
        <path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
        <path d="M14 3v5h5" />
      </>
    ),
  },
];

const STEPS = [
  {
    n: "01",
    title: "Bring your information",
    desc: "Upload a spreadsheet, drop in a document, or just start typing — however your information already exists.",
  },
  {
    n: "02",
    title: "Let A1.ai understand it",
    desc: "A1.ai reads the structure, cross-references context, and builds a real understanding of what you gave it.",
  },
  {
    n: "03",
    title: "Discover what matters",
    desc: "Patterns, trends, and anomalies surface automatically — with the evidence behind every insight.",
  },
];

const INSIGHTS = [
  "Revenue peaks every Friday — consider restocking before the weekend rush.",
  "Region West is underperforming North by 22% this quarter.",
  "Anomaly detected: Feb 14 revenue spiked 340% above baseline.",
];

/* ------------------------------------------------------------------ */
/* Small hooks                                                         */
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

function useTypingCycle(strings: string[], speed = 22, hold = 2200) {
  const [text, setText] = useState("");
  useEffect(() => {
    let i = 0;
    let charIndex = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const full = strings[i];
      if (!deleting) {
        charIndex++;
        setText(full.slice(0, charIndex));
        if (charIndex === full.length) {
          deleting = true;
          timer = setTimeout(tick, hold);
          return;
        }
      } else {
        charIndex -= 3;
        if (charIndex <= 0) {
          charIndex = 0;
          deleting = false;
          i = (i + 1) % strings.length;
        }
        setText(full.slice(0, Math.max(charIndex, 0)));
      }
      timer = setTimeout(tick, deleting ? 8 : speed);
    };

    timer = setTimeout(tick, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return text;
}

/* ------------------------------------------------------------------ */
/* Feature card with cursor-tracked spotlight                          */
/* ------------------------------------------------------------------ */

interface Feature {
  id: string;
  accent: string;
  title: string;
  desc: string;
  icon: ReactNode;
}

function FeatureCard({ f, index }: { f: Feature; index: number }) {
  const ref = useRef<HTMLAnchorElement | null>(null);

  const href = f.id === "chat" ? "/chat" : "/analyst";

  const onMove = (e: ReactMouseEvent<HTMLAnchorElement>) => {
    const el = ref.current;
    if (!el) return;

    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  return (
    <Link
      ref={ref}
      href={href}
      onMouseMove={onMove}
      className={`feature-card accent-${f.accent}`}
      data-reveal
      style={{ transitionDelay: `${index * 70}ms` }}
      aria-label={`Open ${f.title}`}
    >
      <div className="feature-spot" />

      <div className="feature-icon">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {f.icon}
        </svg>
      </div>

      <h3>{f.title}</h3>
      <p>{f.desc}</p>
      <div className="feature-corner" />
    </Link>
  );
}

interface MagneticButtonProps {
  as?: ElementType;
  className?: string;
  children?: ReactNode;
  [key: string]: unknown;
}

function MagneticButton({
  as: As = "a",
  className = "",
  children,
  ...props
}: MagneticButtonProps) {
  const ref = useRef<HTMLElement | null>(null);
  const onMove = (e: ReactMouseEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left - r.width / 2) * 0.22;
    const y = (e.clientY - r.top - r.height / 2) * 0.32;
    el.style.transform = `translate(${x}px, ${y}px)`;
  };
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = "translate(0,0)";
  };
  return (
    <As
      ref={ref}
      className={`magnetic ${className}`}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      {...props}
    >
      {children}
    </As>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export default function A1aiLanding() {
  useReveal();
  const typed = useTypingCycle(INSIGHTS);
  const [menuOpen, setMenuOpen] = useState(false);
  const { isSignedIn } = useUser();

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
          <nav className={`nav-links ${menuOpen ? "open" : ""}`}>
            <a href="#" onClick={() => setMenuOpen(false)}>
              Home
            </a>
            <a href="#features" onClick={() => setMenuOpen(false)}>
              Features
            </a>
            <a href="#how-it-works" onClick={() => setMenuOpen(false)}>
              How it works
            </a>
          </nav>
          <div className="nav-actions">
            {!isSignedIn ? (
              <>
                <SignInButton mode="modal">
                  <button className="btn btn-ghost login-btn">Log in</button>
                </SignInButton>

                <SignUpButton mode="modal">
                  <MagneticButton className="btn btn-primary">
                    Start free
                    <ArrowIcon />
                  </MagneticButton>
                </SignUpButton>
              </>
            ) : (
              <>
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: "w-10 h-10",
                    },
                  }}
                />
              </>
            )}
          </div>
          <button
            className={`menu-toggle ${menuOpen ? "open" : ""}`}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="aurora" aria-hidden="true">
          <span className="blob blob-violet" />
          <span className="blob blob-amber" />
          <span className="blob blob-cyan" />
          <div className="grid-floor" />
        </div>

        <div className="container hero-grid">
          <div data-reveal>
            <span className="eyebrow">
              <span className="dot" /> One workspace, two focused tools
            </span>
            <h1>
              <em>One Workspace.</em>
              <br />
              <span className="grad-text">Unlimited Clarity.</span>
            </h1>
            <p className="hero-sub">
              A1.ai brings AI smart chat and AI-powered data analysis into one
              place — so you stop switching between a dozen tabs and get
              straight to the answer, grounded in your own material.
            </p>
            <div className="hero-actions">
              <SignUpButton mode="modal">
                <MagneticButton className="btn btn-primary">
                  Start free
                  <ArrowIcon />
                </MagneticButton>
              </SignUpButton>
              <MagneticButton
                as="a"
                href="#features"
                className="btn btn-outline btn-lg"
              >
                See the tools
              </MagneticButton>
            </div>
          </div>

          <div
            className="doc-wrap"
            data-reveal
            style={{ transitionDelay: "120ms" }}
          >
            <div className="doc-glow" aria-hidden="true" />
            <div className="doc-card analyst-card">
              <i className="hud hud-tl" />
              <i className="hud hud-tr" />
              <i className="hud hud-bl" />
              <i className="hud hud-br" />
              <div className="scanline" />

              <div className="doc-card-head">
                <div className="doc-tab">
                  <span className="file-dot" /> sales_q3.xlsx
                </div>
                <div className="doc-tab reading">
                  <span className="pulse-dot" /> A1.ai is analyzing…
                </div>
              </div>

              <div className="analyst-stats">
                <div className="analyst-stat">
                  <span className="stat-label">Rows</span>
                  <span className="stat-value">128</span>
                </div>
                <div className="analyst-stat">
                  <span className="stat-label">Columns</span>
                  <span className="stat-value">9</span>
                </div>
                <div className="analyst-stat">
                  <span className="stat-label">Revenue</span>
                  <span className="stat-value">$482K</span>
                </div>
                <div className="analyst-stat">
                  <span className="stat-label">Growth</span>
                  <span className="stat-value up">+18.4%</span>
                </div>
              </div>

              <div className="analyst-chart">
                <span className="chart-label">Revenue trend</span>
                <div className="chart-bars">
                  {[38, 52, 46, 68, 60, 84, 74, 96].map((h, i) => (
                    <span
                      key={i}
                      className="bar"
                      style={{ height: `${h}%`, animationDelay: `${i * 60}ms` }}
                    />
                  ))}
                </div>
              </div>

              <div className="annotation">
                <span className="tag">AI Insight</span>
                <span>{typed}</span>
                <span className="caret" />
              </div>

              <div className="doc-footer-chip">
                <CheckIcon /> Patterns, trends &amp; anomalies detected
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="trusted-strip">
        <div className="marquee">
          <div className="marquee-track">
            {[...Array(2)].map((_, dup) => (
              <div className="marquee-group" key={dup}>
                {[
                  "ONE WORKSPACE",
                  "SMART CHAT",
                  "DATA ANALYSIS",
                  "STRUCTURED INSIGHTS",
                  "BUILT FOR FOCUS",
                ].map((u) => (
                  <span key={u}>{u}</span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className="features" id="features">
        <div className="container">
          <div className="section-head" data-reveal>
            <div className="section-eyebrow">What&apos;s inside</div>
            <h2>Two tools. Zero clutter.</h2>
            <p>
              Each one is built around a real thing you get stuck on — not a
              generic chatbot with a new coat of paint.
            </p>
          </div>
          <div className="feature-grid">
            {FEATURES.map((f, i) => (
              <FeatureCard f={f} index={i} key={f.id} />
            ))}
          </div>
        </div>
      </section>

      <section className="process" id="how-it-works">
        <div className="container">
          <div className="section-head" data-reveal>
            <div className="section-eyebrow">How it works</div>
            <h2>From information to insight.</h2>
          </div>
          <div className="process-grid">
            {STEPS.map((s, i) => (
              <div
                className="process-step"
                data-reveal
                style={{ transitionDelay: `${i * 100}ms` }}
                key={s.n}
              >
                <span className="process-num">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="final-cta">
        <div className="aurora aurora-cta" aria-hidden="true">
          <span className="blob blob-violet" />
          <span className="blob blob-amber" />
        </div>
        <div className="container" data-reveal>
          <h2>
            Bring your information.
            <br />
            Get <span className="grad-text">clarity</span> faster.
          </h2>
          <p>Free to start. No credit card required.</p>
          <SignUpButton mode="modal">
            <MagneticButton className="btn btn-primary">
              Start free
              <ArrowIcon />
            </MagneticButton>
          </SignUpButton>
        </div>
      </section>

      <footer>
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <div className="logo">
                <span className="mark">
                  <span className="mark-core" />
                </span>
                A1.ai
              </div>
              <p>
                A focused AI workspace for chat and data analysis — built to
                stay out of your way.
              </p>
            </div>
            <div className="footer-col">
              <h4>Product</h4>
              <ul>
                <li>
                  <a href="#features">AI Smart Chat</a>
                </li>
                <li>
                  <a href="#features">AI Data Analyst</a>
                </li>
                <li>
                  <a href="#how-it-works">How it works</a>
                </li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Get started</h4>
              <ul>
                <li>
                  <a href="#features">Explore tools</a>
                </li>
                <li>
                  <SignInButton mode="modal">
                    <a href="#">Sign in</a>
                  </SignInButton>
                </li>
                <li>
                  <SignUpButton mode="modal">
                    <a href="#">Create account</a>
                  </SignUpButton>
                </li>
              </ul>
            </div>
            <div className="footer-col footer-connect">
              <h4>Connect</h4>
              <div className="social-row">
                <a
                  href="https://www.linkedin.com/in/abhishek-tiwari-b248a63a6/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                  className="social-icon"
                >
                  <LinkedinIcon />
                </a>
                <a
                  href="https://github.com/a1mrabhi"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="GitHub"
                  className="social-icon"
                >
                  <GithubIcon />
                </a>
                <a
                  href="https://instagram.com/abhishektiwari._.1"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="social-icon"
                >
                  <InstagramIcon />
                </a>
              </div>

              <span className="contact-label">Contact</span>
              <a href="mailto:abhirta1@gmail.com" className="contact-email">
                abhirta1@gmail.com
              </a>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2026 A1.ai. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Inline icons                                                        */
/* ------------------------------------------------------------------ */

function ArrowIcon() {
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
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 12l5 5L20 6" />
    </svg>
  );
}
function LinkedinIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M7.5 10.5v6M7.5 7.5v.01M11.5 16.5v-4a2 2 0 0 1 4 0v4M11.5 12.5v4" />
    </svg>
  );
}
function GithubIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.2a9.8 9.8 0 0 0-3.1 19.1c.5.1.7-.2.7-.5v-1.8c-2.7.6-3.3-1.2-3.3-1.2-.4-1.1-1-1.4-1-1.4-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.7.4-1.1.6-1.4-2.2-.2-4.5-1.1-4.5-4.9 0-1.1.4-1.9 1-2.6-.1-.3-.4-1.3.1-2.6 0 0 .8-.3 2.7 1a9.4 9.4 0 0 1 4.9 0c1.9-1.3 2.7-1 2.7-1 .5 1.3.2 2.3.1 2.6.6.7 1 1.6 1 2.6 0 3.8-2.3 4.6-4.5 4.9.4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A9.8 9.8 0 0 0 12 2.2Z" />
    </svg>
  );
}
function InstagramIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="5.5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M17.2 6.8h.01" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                               */
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
*{ margin:0; padding:0; box-sizing:border-box; }
html{ scroll-behavior:smooth; background:var(--bg); }
body{
  background:var(--bg); color:var(--text-primary); font-family:var(--font-body);
  -webkit-font-smoothing:antialiased; overflow-x:hidden;
}
a{ color:inherit; text-decoration:none; }
.container{ max-width:1180px; margin:0 auto; padding:0 24px; position:relative; z-index:1; }
section{ position:relative; }

.grain{
  position:fixed; inset:0; pointer-events:none; z-index:200; opacity:.025; mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='90'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

[data-reveal]{ opacity:0; transform:translateY(22px); transition:opacity .7s cubic-bezier(.16,1,.3,1), transform .7s cubic-bezier(.16,1,.3,1); }
[data-reveal].is-in{ opacity:1; transform:translateY(0); }

/* ---------- Nav ---------- */
header{ position:sticky; top:0; z-index:50; background:rgba(5,7,14,0.72); backdrop-filter:blur(14px) saturate(140%); border-bottom:1px solid var(--border); }
.nav{ display:flex; align-items:center; justify-content:space-between; padding:15px 0; }
.logo{ display:flex; align-items:center; gap:10px; font-family:var(--font-display); font-weight:600; font-size:19px; }
.mark{ width:24px; height:24px; border-radius:7px; position:relative; background:conic-gradient(from 180deg, var(--amber), var(--violet), var(--cyan), var(--amber)); flex-shrink:0; animation:markSpin 6s linear infinite; padding:2px; }
.mark-core{ position:absolute; inset:2px; border-radius:5px; background:var(--bg); }
@keyframes markSpin{ to{ transform:rotate(360deg); } }
.nav-links{ display:flex; align-items:center; gap:34px; font-size:14.5px; color:var(--text-secondary); }
.nav-links a{ transition:color .15s ease; position:relative; }
.nav-links a::after{ content:''; position:absolute; left:0; right:0; bottom:-4px; height:1px; background:var(--violet); transform:scaleX(0); transition:transform .25s ease; }
.nav-links a:hover{ color:var(--text-primary); }
.nav-links a:hover::after{ transform:scaleX(1); }
.nav-actions{ display:flex; align-items:center; gap:16px; }
.btn{
  font-family:var(--font-body); font-weight:600; font-size:14px; padding:10px 18px; border-radius:9px;
  border:none; cursor:pointer; display:inline-flex; align-items:center; gap:7px; position:relative; overflow:hidden;
  transition:transform .2s cubic-bezier(.2,.8,.2,1), box-shadow .25s ease, background .2s ease, border-color .2s ease;
}
.btn-primary{ background:linear-gradient(135deg, var(--amber), #ffb238); color:#20130A; box-shadow:0 0 0 1px rgba(255,200,87,.15), 0 8px 24px -8px rgba(255,200,87,.55); }
.btn-primary:hover{ box-shadow:0 0 0 1px rgba(255,200,87,.35), 0 10px 30px -6px rgba(255,200,87,.75); }
.btn-ghost{ background:transparent; color:var(--text-secondary); }
.btn-ghost:hover{ color:var(--text-primary); }
.btn-outline{ background:rgba(255,255,255,0.02); border:1px solid var(--border); color:var(--text-primary); }
.btn-outline:hover{ border-color:var(--violet); box-shadow:0 0 0 1px var(--violet-dim), 0 0 24px -6px rgba(140,124,240,.5); }
.btn-lg{ padding:14px 24px; font-size:15px; }
.magnetic{ will-change:transform; }
.menu-toggle{ display:none; flex-direction:column; gap:5px; background:none; border:none; cursor:pointer; padding:6px; position:relative; z-index:1; }
.menu-toggle span{ width:20px; height:2px; background:var(--text-primary); border-radius:2px; transition:transform .25s ease, opacity .2s ease; }
.menu-toggle.open span:nth-child(1){ transform:translateY(7px) rotate(45deg); }
.menu-toggle.open span:nth-child(2){ opacity:0; }
.menu-toggle.open span:nth-child(3){ transform:translateY(-7px) rotate(-45deg); }

/* ---------- Hero ---------- */
.hero{ padding:96px 0 76px; overflow:hidden; }
.aurora{ position:absolute; inset:-10% -10% auto -10%; height:780px; z-index:0; pointer-events:none; }
.blob{ position:absolute; border-radius:50%; filter:blur(80px); opacity:.35; animation:drift 16s ease-in-out infinite; }
.blob-violet{ width:420px; height:420px; background:var(--violet); top:-80px; left:6%; animation-delay:0s; }
.blob-amber{ width:360px; height:360px; background:var(--amber); top:60px; right:8%; animation-delay:-5s; opacity:.22; }
.blob-cyan{ width:300px; height:300px; background:var(--cyan); bottom:-60px; left:38%; animation-delay:-10s; opacity:.18; }
@keyframes drift{ 0%,100%{ transform:translate(0,0) scale(1); } 50%{ transform:translate(30px,-24px) scale(1.08); } }
.grid-floor{
  position:absolute; left:-20%; right:-20%; bottom:-140px; height:280px;
  background-image:linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px);
  background-size:44px 44px; transform:perspective(360px) rotateX(62deg); opacity:.35;
  mask-image:linear-gradient(to top, black, transparent 85%);
}
.hero-grid{ display:grid; grid-template-columns:1.05fr .95fr; gap:56px; align-items:center; }
.eyebrow{
  display:inline-flex; align-items:center; gap:9px; font-family:var(--font-mono); font-size:11.5px;
  letter-spacing:.08em; text-transform:uppercase; color:var(--violet); background:var(--violet-dim);
  border:1px solid rgba(140,124,240,.3); padding:7px 13px 7px 11px; border-radius:20px; margin-bottom:22px;
}
.eyebrow .dot{ width:6px; height:6px; border-radius:50%; background:var(--cyan); box-shadow:0 0 0 0 rgba(84,232,214,.6); animation:pulseDot 2s ease-out infinite; }
@keyframes pulseDot{ 0%{ box-shadow:0 0 0 0 rgba(84,232,214,.55);} 70%{ box-shadow:0 0 0 8px rgba(84,232,214,0);} 100%{ box-shadow:0 0 0 0 rgba(84,232,214,0);} }
h1{ font-family:var(--font-display); font-weight:600; font-size:clamp(34px,4.4vw,53px); line-height:1.12; letter-spacing:-.01em; margin-bottom:20px; }
h1 em{ font-style:italic; color:var(--amber); }
.grad-text{
  background:linear-gradient(100deg, var(--violet), var(--cyan) 55%, var(--amber));
  -webkit-background-clip:text; background-clip:text; color:transparent;
  background-size:220% auto; animation:gradShift 7s ease-in-out infinite;
}
@keyframes gradShift{ 0%,100%{ background-position:0% 50%; } 50%{ background-position:100% 50%; } }
.hero-sub{ font-size:17px; line-height:1.6; color:var(--text-secondary); max-width:470px; margin-bottom:32px; }
.hero-actions{ display:flex; align-items:center; gap:14px; margin-bottom:8px; }

/* ---------- Signature doc card ---------- */
.doc-wrap{ position:relative; }
.doc-glow{
  position:absolute; inset:-28px; border-radius:26px;
  background:radial-gradient(circle at 30% 20%, rgba(140,124,240,.35), transparent 60%),
             radial-gradient(circle at 80% 80%, rgba(84,232,214,.25), transparent 55%);
  filter:blur(30px); z-index:-1; animation:glowPulse 5s ease-in-out infinite;
}
@keyframes glowPulse{ 0%,100%{ opacity:.7; } 50%{ opacity:1; } }
.doc-card{
  background:linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.015));
  border:1px solid var(--border); border-radius:16px; padding:22px; position:relative;
  backdrop-filter:blur(18px); box-shadow:0 30px 60px -20px rgba(0,0,0,.6); overflow:hidden;
}
.hud{ position:absolute; width:16px; height:16px; border-color:var(--violet); opacity:.6; }
.hud-tl{ top:8px; left:8px; border-top:2px solid; border-left:2px solid; border-radius:4px 0 0 0; }
.hud-tr{ top:8px; right:8px; border-top:2px solid; border-right:2px solid; border-radius:0 4px 0 0; }
.hud-bl{ bottom:8px; left:8px; border-bottom:2px solid; border-left:2px solid; border-radius:0 0 0 4px; }
.hud-br{ bottom:8px; right:8px; border-bottom:2px solid; border-right:2px solid; border-radius:0 0 4px 0; }
.scanline{
  position:absolute; left:0; right:0; height:64px; top:0;
  background:linear-gradient(180deg, transparent, rgba(84,232,214,.10), transparent);
  animation:scanMove 4.5s linear infinite;
}
@keyframes scanMove{ 0%{ transform:translateY(-80px);} 100%{ transform:translateY(340px);} }
.doc-card-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:18px; }
.doc-tab{ font-family:var(--font-mono); font-size:11px; color:var(--text-tertiary); display:flex; align-items:center; gap:8px; }
.doc-tab.reading{ color:var(--violet); }
.file-dot{ width:7px; height:7px; border-radius:2px; background:var(--amber); }
.pulse-dot{ width:6px; height:6px; border-radius:50%; background:var(--violet); animation:blink 1.3s ease-in-out infinite; }
@keyframes blink{ 0%,100%{ opacity:1;} 50%{ opacity:.25;} }
.analyst-stats{ display:grid; grid-template-columns:repeat(2,1fr); gap:10px; margin-bottom:16px; }
.analyst-stat{ background:var(--surface-solid); border:1px solid var(--border); border-radius:10px; padding:11px 13px; display:flex; flex-direction:column; gap:5px; }
.stat-label{ font-family:var(--font-mono); font-size:10px; letter-spacing:.06em; text-transform:uppercase; color:var(--text-tertiary); }
.stat-value{ font-family:var(--font-display); font-weight:600; font-size:18px; color:var(--text-primary); }
.stat-value.up{ color:var(--cyan); }
.analyst-chart{ margin-bottom:16px; }
.chart-label{ font-family:var(--font-mono); font-size:10px; letter-spacing:.06em; text-transform:uppercase; color:var(--text-tertiary); display:block; margin-bottom:9px; }
.chart-bars{ display:flex; align-items:flex-end; gap:5px; height:52px; }
.chart-bars .bar{
  flex:1; border-radius:3px 3px 0 0; background:linear-gradient(180deg, var(--amber), rgba(255,200,87,.2));
  transform:scaleY(0); transform-origin:bottom; animation:barGrow .7s cubic-bezier(.16,1,.3,1) forwards;
}
.chart-bars .bar:nth-child(even){ background:linear-gradient(180deg, var(--violet), rgba(140,124,240,.2)); }
@keyframes barGrow{ to{ transform:scaleY(1); } }
.annotation{
  margin-top:4px; background:var(--violet-dim); border:1px solid rgba(140,124,240,.35); border-radius:10px;
  padding:12px 14px; font-size:12.5px; line-height:1.5; color:#D6D2FA; min-height:64px;
}
.annotation .tag{ font-family:var(--font-mono); font-size:10px; color:var(--violet); display:block; margin-bottom:5px; letter-spacing:.05em; text-transform:uppercase; }
.caret{ display:inline-block; width:6px; height:12px; background:var(--cyan); margin-left:2px; vertical-align:-2px; animation:blink .9s steps(2) infinite; }
.doc-footer-chip{ display:inline-flex; align-items:center; gap:6px; font-family:var(--font-mono); font-size:11px; color:var(--cyan); margin-top:14px; }

/* ---------- Trusted strip / marquee ---------- */
.trusted-strip{ border-top:1px solid var(--border); border-bottom:1px solid var(--border); padding:20px 0; overflow:hidden; background:var(--bg-alt); }
.marquee{ mask-image:linear-gradient(90deg, transparent, black 10%, black 90%, transparent); }
.marquee-track{ display:flex; width:max-content; animation:marquee 26s linear infinite; }
.marquee-group{ display:flex; align-items:center; gap:52px; padding-right:52px; }
.marquee-group span{ font-family:var(--font-mono); font-size:13px; letter-spacing:.05em; color:var(--text-tertiary); white-space:nowrap; }
@keyframes marquee{ from{ transform:translateX(0);} to{ transform:translateX(-50%);} }

/* ---------- Section heads ---------- */
.section-head{ text-align:center; max-width:560px; margin:0 auto 48px; }
.section-eyebrow{ font-family:var(--font-mono); font-size:11.5px; letter-spacing:.1em; text-transform:uppercase; color:var(--amber); margin-bottom:12px; }
.section-head h2{ font-family:var(--font-display); font-weight:600; font-size:clamp(26px,3vw,34px); line-height:1.2; margin-bottom:12px; }
.section-head p{ color:var(--text-secondary); font-size:15.5px; line-height:1.6; }

/* ---------- Features ---------- */
.features{ padding:104px 0 92px; }
.feature-grid{ display:grid; grid-template-columns:repeat(2,1fr); gap:22px; max-width:840px; margin:0 auto; }
.feature-card{
  position:relative; background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:34px 30px;
  transition:border-color .25s ease, transform .25s ease, box-shadow .25s ease; overflow:hidden;
}
.feature-card:hover{ transform:translateY(-5px); border-color:var(--border-hover); box-shadow:0 26px 52px -28px rgba(140,124,240,.4); }
.feature-spot{
  position:absolute; inset:0; opacity:0; transition:opacity .3s ease; pointer-events:none;
  background:radial-gradient(280px circle at var(--mx,50%) var(--my,50%), rgba(140,124,240,.14), transparent 70%);
}
.accent-amber .feature-spot{ background:radial-gradient(280px circle at var(--mx,50%) var(--my,50%), rgba(255,200,87,.14), transparent 70%); }
.feature-card:hover .feature-spot{ opacity:1; }
.feature-corner{ position:absolute; top:16px; right:16px; width:6px; height:6px; border-radius:50%; background:var(--border-hover); opacity:0; transition:opacity .25s ease; }
.feature-card:hover .feature-corner{ opacity:1; box-shadow:0 0 10px 2px rgba(140,124,240,.6); }
.feature-icon{ width:48px; height:48px; border-radius:12px; display:flex; align-items:center; justify-content:center; margin-bottom:22px; position:relative; z-index:1; transition:transform .25s ease; }
.feature-card:hover .feature-icon{ transform:scale(1.08) rotate(-4deg); }
.feature-icon svg{ width:22px; height:22px; }
.accent-violet .feature-icon{ background:var(--violet-dim); color:var(--violet); }
.accent-amber .feature-icon{ background:var(--amber-dim); color:var(--amber); }
.accent-cyan .feature-icon{ background:var(--cyan-dim); color:var(--cyan); }
.accent-coral .feature-icon{ background:var(--coral-dim); color:var(--coral); }
.feature-card h3{ font-family:var(--font-display); font-weight:600; font-size:20px; margin-bottom:11px; position:relative; z-index:1; }
.feature-card p{ font-size:14.5px; color:var(--text-secondary); line-height:1.65; position:relative; z-index:1; }

/* ---------- Process (How it works) ---------- */
.process{ padding:92px 0 104px; background:var(--bg-alt); border-top:1px solid var(--border); border-bottom:1px solid var(--border); position:relative; overflow:hidden; }
.process-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:28px; max-width:980px; margin:0 auto; position:relative; }
.process-grid::before{
  content:''; position:absolute; top:27px; left:12%; right:12%; height:1px;
  background:linear-gradient(90deg, transparent, var(--border) 12%, var(--border) 88%, transparent);
  z-index:0;
}
.process-step{ position:relative; z-index:1; }
.process-num{
  position:relative; display:inline-flex; align-items:center; justify-content:center; width:54px; height:54px;
  border-radius:50%; background:var(--surface-solid); border:1px solid var(--border);
  font-family:var(--font-mono); font-size:15px; font-weight:600; margin-bottom:22px;
  transition:border-color .25s ease, box-shadow .25s ease, transform .25s ease;
}
.process-step:hover .process-num{ transform:translateY(-3px); }
.process-step:nth-child(1) .process-num{ color:var(--violet); }
.process-step:nth-child(2) .process-num{ color:var(--amber); }
.process-step:nth-child(3) .process-num{ color:var(--cyan); }
.process-step:nth-child(1):hover .process-num{ border-color:var(--violet); box-shadow:0 0 0 4px var(--violet-dim), 0 0 24px -6px rgba(140,124,240,.6); }
.process-step:nth-child(2):hover .process-num{ border-color:var(--amber); box-shadow:0 0 0 4px var(--amber-dim), 0 0 24px -6px rgba(255,200,87,.6); }
.process-step:nth-child(3):hover .process-num{ border-color:var(--cyan); box-shadow:0 0 0 4px var(--cyan-dim), 0 0 24px -6px rgba(84,232,214,.6); }
.process-step h3{ font-family:var(--font-display); font-weight:600; font-size:19px; margin-bottom:10px; }
.process-step p{ font-size:14px; color:var(--text-secondary); line-height:1.65; max-width:290px; }

/* ---------- Final CTA ---------- */
.final-cta{ padding:100px 0 110px; text-align:center; overflow:hidden; }
.aurora-cta{ inset:auto -10% -20% -10%; height:420px; }
.final-cta h2{ font-family:var(--font-display); font-weight:600; font-size:clamp(28px,3.6vw,42px); margin-bottom:16px; }
.final-cta p{ color:var(--text-secondary); margin-bottom:30px; font-size:15.5px; }

/* ---------- Footer ---------- */
footer{ border-top:1px solid var(--border); padding:56px 0 34px; }
.footer-grid{ display:grid; grid-template-columns:1.2fr repeat(3,1fr); gap:32px; margin-bottom:44px; }
.footer-brand p{ font-size:13.5px; color:var(--text-tertiary); margin-top:14px; line-height:1.6; max-width:260px; }
.footer-col h4{ font-family:var(--font-mono); font-size:11.5px; letter-spacing:.08em; text-transform:uppercase; color:var(--text-tertiary); margin-bottom:16px; }
.footer-col ul{ list-style:none; display:flex; flex-direction:column; gap:11px; }
.footer-col a{ font-size:13.5px; color:var(--text-secondary); transition:color .15s ease; }
.footer-col a:hover{ color:var(--text-primary); }
.footer-bottom{ border-top:1px solid var(--border); padding-top:24px; font-size:12.5px; color:var(--text-tertiary); }

/* ---------- Footer: connect / socials / contact reveal ---------- */
.social-row{ display:flex; align-items:center; gap:10px; margin-bottom:18px; }
.social-icon{
  width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center;
  background:var(--surface); border:1px solid var(--border); color:var(--text-secondary);
  transition:border-color .2s ease, color .2s ease, transform .2s ease;
}
.social-icon:hover{ border-color:var(--border-hover); color:var(--violet); transform:translateY(-2px); }
.contact-label{ display:block; font-family:var(--font-mono); font-size:11.5px; letter-spacing:.08em; text-transform:uppercase; color:var(--text-tertiary); margin-bottom:8px; }
.contact-email{
  display:inline-block; font-family:var(--font-mono); font-size:13px; color:var(--cyan);
  border-bottom:1px solid rgba(84,232,214,.35); transition:color .15s ease, border-color .15s ease;
}
.contact-email:hover{ color:var(--text-primary); border-color:var(--text-primary); }

/* ---------- Responsive ---------- */
@media (max-width:900px){
  .hero-grid{ grid-template-columns:1fr; padding-top:10px; }
  .feature-grid{ grid-template-columns:1fr; max-width:440px; }
  .process-grid{ grid-template-columns:1fr; gap:40px; max-width:440px; margin:0 auto; }
  .process-grid::before{ display:none; }
  .footer-grid{ grid-template-columns:1fr 1fr; }
  .nav-links{ position:absolute; top:100%; left:0; right:0; flex-direction:column; align-items:flex-start; gap:0; background:rgba(5,7,14,.97); backdrop-filter:blur(14px); border-bottom:1px solid var(--border); max-height:0; overflow:hidden; transition:max-height .3s ease; }
  .nav-links.open{ max-height:260px; }
  .nav-links a{ padding:14px 24px; width:100%; }
  .nav-actions .login-btn{ display:none; }
  .menu-toggle{ display:flex; }
}
@media (max-width:560px){
  .footer-grid{ grid-template-columns:1fr; gap:28px; }
  .hero-actions{ flex-direction:column; align-items:stretch; }
  .hero-actions .btn{ justify-content:center; }
  .analyst-stats{ gap:8px; }
  h1{ font-size:clamp(30px,8vw,40px); }
}
@media (prefers-reduced-motion: reduce){
  *{ animation:none !important; transition:none !important; }
  [data-reveal]{ opacity:1 !important; transform:none !important; }
}
`;
