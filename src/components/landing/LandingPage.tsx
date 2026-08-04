'use client';

import { useEffect, useRef, useState } from 'react';

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
    id: 'chat',
    accent: 'violet',
    title: 'AI Chat',
    desc: 'Ask questions in plain language and get answers grounded in your own notes and course material, not generic web results.',
    icon: (
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-8Z" />
    ),
  },
  {
    id: 'pdf',
    accent: 'amber',
    title: 'PDF Chat',
    desc: 'Drop in a textbook chapter or research paper and ask it questions directly. Every answer points back to the exact page.',
    icon: (
      <>
        <path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
        <path d="M14 3v5h5" />
      </>
    ),
  },
  {
    id: 'resume',
    accent: 'cyan',
    title: 'Resume Analyzer',
    desc: "Get line-by-line feedback against the role you're applying for, plus a gap list of skills recruiters are screening for.",
    icon: (
      <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3.2" />
        <path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21" />
      </>
    ),
  },
  {
    id: 'study',
    accent: 'coral',
    title: 'Study Assistant',
    desc: "Turn lecture slides or readings into structured notes and practice questions, sorted by what you're weakest on.",
    icon: (
      <>
        <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H12v16H6.5A2.5 2.5 0 0 1 4 17.5v-11Z" />
        <path d="M20 6.5A2.5 2.5 0 0 0 17.5 4H12v16h5.5a2.5 2.5 0 0 0 2.5-2.5v-11Z" />
      </>
    ),
  },
];

const TESTIMONIALS = [
  {
    quote:
      "I used the resume analyzer before three internship applications and got callbacks on two. It caught vague bullet points I'd read past a dozen times.",
    name: 'Jordan M.',
    role: 'CS Junior, Applying to Internships',
    color: '#FFC857',
    initials: 'JM',
  },
  {
    quote:
      'PDF Chat replaced my habit of skimming 40-page papers the night before seminar. I can ask it what the methodology section actually claims.',
    name: 'Riya S.',
    role: 'Grad Student, Comp Bio',
    color: '#8C7CF0',
    initials: 'RS',
  },
  {
    quote:
      "The study assistant turns my lecture slides into practice questions automatically. It's the closest thing to having a TA on call at 1am.",
    name: 'Tomás K.',
    role: 'Bootcamp Grad, Now Junior Dev',
    color: '#54E8D6',
    initials: 'TK',
  },
];

const FAQS = [
  {
    q: 'Is A1.ai free to use?',
    a: 'Yes — the free plan includes AI Chat, up to 10 PDF uploads a month, and one resume analysis. Paid plans remove those limits and add unlimited study notes.',
  },
  {
    q: 'Does it work with course PDFs and scanned readings?',
    a: 'Yes, including scanned documents — A1.ai runs OCR automatically so you can still ask questions about a photographed textbook page.',
  },
  {
    q: 'How is the resume feedback generated?',
    a: 'You paste in a job description alongside your resume, and A1.ai compares the two line by line, flagging missing keywords and weak phrasing recruiters tend to skip past.',
  },
  {
    q: 'Can I cancel anytime?',
    a: "Yes, no contracts. Cancel from your account settings and you'll keep access until the end of your current billing period.",
  },
];

const SUGGESTIONS = [
  'Lead with the outcome, not the task — try "Cut API latency 40%" instead of "Worked on backend performance."',
  'This bullet buries the result. Move the metric to the front so it survives a 6-second recruiter scan.',
  'Swap "responsible for" for an action verb — "Shipped," "Led," "Reduced" all score higher on ATS parsing.',
];

/* ------------------------------------------------------------------ */
/* Small hooks                                                         */
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

function useTypingCycle(strings, speed = 22, hold = 2200) {
  const [text, setText] = useState('');
  useEffect(() => {
    let i = 0;
    let charIndex = 0;
    let deleting = false;
    let timer;

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

function useCountUp(target, duration = 1400) {
  const [value, setValue] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !started.current) {
            started.current = true;
            const start = performance.now();
            const step = (now) => {
              const p = Math.min((now - start) / duration, 1);
              const eased = 1 - Math.pow(1 - p, 3);
              setValue(Math.round(target * eased));
              if (p < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
          }
        });
      },
      { threshold: 0.5 }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [target, duration]);
  return [value, ref];
}

/* ------------------------------------------------------------------ */
/* Feature card with cursor-tracked spotlight                          */
/* ------------------------------------------------------------------ */

function FeatureCard({ f, index }) {
  const ref = useRef(null);
  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      className={`feature-card accent-${f.accent}`}
      data-reveal
      style={{ transitionDelay: `${index * 70}ms` }}
    >
      <div className="feature-spot" />
      <div className="feature-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          {f.icon}
        </svg>
      </div>
      <h3>{f.title}</h3>
      <p>{f.desc}</p>
      <div className="feature-corner" />
    </div>
  );
}

function MagneticButton({ as: As = 'a', className = '', children, ...props }) {
  const ref = useRef(null);
  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left - r.width / 2) * 0.22;
    const y = (e.clientY - r.top - r.height / 2) * 0.32;
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

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export default function A1aiLanding() {
  useReveal();
  const typed = useTypingCycle(SUGGESTIONS);
  const [count, countRef] = useCountUp(10000);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <>
      <style>{CSS}</style>

      <div className="grain" aria-hidden="true" />

      <header>
        <div className="container nav">
          <a href="#" className="logo">
            <span className="mark">
              <span className="mark-core" />
            </span>
            A1.ai
          </a>
          <nav className={`nav-links ${menuOpen ? 'open' : ''}`}>
            <a href="#" onClick={() => setMenuOpen(false)}>Home</a>
            <a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
            <a href="#pricing" onClick={() => setMenuOpen(false)}>Pricing</a>
            <a href="#about" onClick={() => setMenuOpen(false)}>About</a>
          </nav>
          <div className="nav-actions">
            <a href="#" className="btn btn-ghost">Log in</a>
            <MagneticButton className="btn btn-primary">
              Start free <ArrowIcon />
            </MagneticButton>
            <button
              className="menu-toggle"
              aria-label="Toggle menu"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span />
              <span />
            </button>
          </div>
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
              <span className="dot" /> The Future Of AI Starts Here
            </span>
            <h1>
               <em>One Workspace</em> 
              <br />
              
 <span className="grad-text">Unlimited Intelligence.</span>.
            </h1>
            <p className="hero-sub">
              A1.ai brings AI smart chat, PDF analysis, and study notes into one place —
              so you Stop switching between ChatGPT, Claude, Gemini, and dozens of AI tools. A1.ai brings everything into one beautiful workspace.
            </p>
            <div className="hero-actions">
              <MagneticButton className="btn btn-primary btn-lg">
                Start free <ArrowIcon />
              </MagneticButton>
              <MagneticButton className="btn btn-outline btn-lg">
                <PlayIcon /> Live demo
              </MagneticButton>
            </div>
            <div className="trust-row" ref={countRef}>
              <div className="trust-avatars">
                <span style={{ background: '#FFC857' }}>JM</span>
                <span style={{ background: '#8C7CF0' }}>RS</span>
                <span style={{ background: '#FF8B7A' }}>TK</span>
                <span style={{ background: '#54E8D6' }}>NV</span>
              </div>
              <p>
                Trusted by <b>{count.toLocaleString()}+</b> students &amp; developers
              </p>
            </div>
          </div>

          <div className="doc-wrap" data-reveal style={{ transitionDelay: '120ms' }}>
            <div className="doc-glow" aria-hidden="true" />
            <div className="doc-card">
              <i className="hud hud-tl" />
              <i className="hud hud-tr" />
              <i className="hud hud-bl" />
              <i className="hud hud-br" />
              <div className="scanline" />

              <div className="doc-card-head">
                <div className="doc-tab">
                  <span className="file-dot" /> resume_draft.pdf
                </div>
                <div className="doc-tab reading">
                  <span className="pulse-dot" /> A1.ai is reading…
                </div>
              </div>

              <div className="doc-lines">
                <div className="doc-line" style={{ width: '92%' }} />
                <div className="doc-line" style={{ width: '88%' }} />
                <div className="doc-line highlight" style={{ width: '74%' }} />
                <div className="doc-line" style={{ width: '95%' }} />
                <div className="doc-line" style={{ width: '60%' }} />
              </div>

              <div className="annotation">
                <span className="tag">Suggestion</span>
                <span>{typed}</span>
                <span className="caret" />
              </div>

              <div className="doc-footer-chip">
                <CheckIcon /> 3 suggestions applied
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
                {['MIT', 'Berkeley', 'UMich', 'Georgia Tech', 'UT Austin', 'UCLA', 'Waterloo', 'NYU'].map((u) => (
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
            <div className="section-eyebrow">What's inside</div>
            <h2>Four tools. One tab.</h2>
            <p>
              Each one is built around a real thing students and early-career developers get stuck on —
              not a generic chatbot with a new coat of paint.
            </p>
          </div>
          <div className="feature-grid">
            {FEATURES.map((f, i) => (
              <FeatureCard f={f} index={i} key={f.id} />
            ))}
          </div>
        </div>
      </section>

      <section className="testimonials">
        <div className="container">
          <div className="section-head" data-reveal>
            <div className="section-eyebrow">From the community</div>
            <h2>What people actually use it for</h2>
          </div>
          <div className="testi-grid">
            {TESTIMONIALS.map((t, i) => (
              <div className="testi-card" data-reveal style={{ transitionDelay: `${i * 80}ms` }} key={t.name}>
                <span className="quote-mark">“</span>
                <p className="testi-quote">{t.quote}</p>
                <div className="testi-person">
                  <div className="testi-avatar" style={{ background: t.color }}>
                    {t.initials}
                  </div>
                  <div>
                    <p>{t.name}</p>
                    <p>{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="faq" id="about">
        <div className="section-head" data-reveal>
          <div className="section-eyebrow">Questions</div>
          <h2>Before you start</h2>
        </div>
        {FAQS.map((item, i) => {
          const open = openFaq === i;
          return (
            <div className={`faq-item ${open ? 'open' : ''}`} key={item.q} data-reveal style={{ transitionDelay: `${i * 50}ms` }}>
              <button className="faq-q" onClick={() => setOpenFaq(open ? -1 : i)}>
                {item.q}
                <span className="plus" />
              </button>
              <div className="faq-a">
                <div className="faq-a-inner">{item.a}</div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="final-cta">
        <div className="aurora aurora-cta" aria-hidden="true">
          <span className="blob blob-violet" />
          <span className="blob blob-amber" />
        </div>
        <div className="container" data-reveal>
          <h2>
            Get through the reading list
            <br />
            and the job hunt <span className="grad-text">faster</span>.
          </h2>
          <p>Free to start. No credit card required.</p>
          <MagneticButton className="btn btn-primary btn-lg">
            Start free <ArrowIcon />
          </MagneticButton>
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
              <p>An AI workspace for students and developers — chat, PDFs, resumes, and study notes, in one place.</p>
            </div>
            <div className="footer-col">
              <h4>Product</h4>
              <ul>
                <li><a href="#features">Features</a></li>
                <li><a href="#pricing">Pricing</a></li>
                <li><a href="#">Live demo</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Company</h4>
              <ul>
                <li><a href="#about">About</a></li>
                <li><a href="#">Blog</a></li>
                <li><a href="#">Contact</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Legal</h4>
              <ul>
                <li><a href="#">Privacy</a></li>
                <li><a href="#">Terms</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2026 A1.ai. All rights reserved.</span>
            <span>Made for late study nights.</span>
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
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 4.5v15l13-7.5-13-7.5Z" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12l5 5L20 6" />
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
@keyframes markSpin{ to{ filter:hue-rotate(360deg); } }
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
.menu-toggle{ display:none; flex-direction:column; gap:5px; background:none; border:none; cursor:pointer; padding:6px; }
.menu-toggle span{ width:20px; height:2px; background:var(--text-primary); border-radius:2px; }

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
.hero-actions{ display:flex; align-items:center; gap:14px; margin-bottom:40px; }
.trust-row{ display:flex; align-items:center; gap:14px; }
.trust-avatars{ display:flex; }
.trust-avatars span{
  width:31px; height:31px; border-radius:50%; border:2px solid var(--bg); margin-left:-8px;
  font-family:var(--font-mono); font-size:10.5px; font-weight:600; display:flex; align-items:center; justify-content:center;
  color:#1A1200; box-shadow:0 0 0 1px rgba(255,255,255,.06);
}
.trust-avatars span:first-child{ margin-left:0; }
.trust-row p{ font-size:13.5px; color:var(--text-tertiary); }
.trust-row b{ color:var(--text-secondary); font-variant-numeric:tabular-nums; }

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
.doc-lines{ display:flex; flex-direction:column; gap:9px; margin-bottom:16px; }
.doc-line{ height:9px; border-radius:3px; background:var(--surface-solid); }
.doc-line.highlight{ background:var(--amber-dim); border:1px solid rgba(255,200,87,.4); position:relative; overflow:hidden; }
.doc-line.highlight::after{
  content:''; position:absolute; inset:0; background:linear-gradient(90deg, transparent, rgba(255,255,255,.35), transparent);
  animation:sweep 2.6s ease-in-out infinite;
}
@keyframes sweep{ 0%{ transform:translateX(-120%);} 100%{ transform:translateX(220%);} }
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
.feature-grid{ display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }
.feature-card{
  position:relative; background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:26px 22px;
  transition:border-color .25s ease, transform .25s ease; overflow:hidden;
}
.feature-card:hover{ transform:translateY(-4px); border-color:var(--border-hover); }
.feature-spot{
  position:absolute; inset:0; opacity:0; transition:opacity .3s ease; pointer-events:none;
  background:radial-gradient(220px circle at var(--mx,50%) var(--my,50%), rgba(140,124,240,.14), transparent 70%);
}
.feature-card:hover .feature-spot{ opacity:1; }
.feature-corner{ position:absolute; top:14px; right:14px; width:6px; height:6px; border-radius:50%; background:var(--border-hover); opacity:0; transition:opacity .25s ease; }
.feature-card:hover .feature-corner{ opacity:1; box-shadow:0 0 10px 2px rgba(140,124,240,.6); }
.feature-icon{ width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center; margin-bottom:18px; position:relative; z-index:1; }
.feature-icon svg{ width:19px; height:19px; }
.accent-violet .feature-icon{ background:var(--violet-dim); color:var(--violet); }
.accent-amber .feature-icon{ background:var(--amber-dim); color:var(--amber); }
.accent-cyan .feature-icon{ background:var(--cyan-dim); color:var(--cyan); }
.accent-coral .feature-icon{ background:var(--coral-dim); color:var(--coral); }
.feature-card h3{ font-family:var(--font-display); font-weight:600; font-size:16.5px; margin-bottom:9px; position:relative; z-index:1; }
.feature-card p{ font-size:13.5px; color:var(--text-secondary); line-height:1.55; position:relative; z-index:1; }

/* ---------- Testimonials ---------- */
.testimonials{ padding:92px 0; background:var(--bg-alt); border-top:1px solid var(--border); border-bottom:1px solid var(--border); }
.testi-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:18px; }
.testi-card{ position:relative; background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:26px 24px 24px; transition:border-color .25s ease, transform .25s ease; }
.testi-card:hover{ border-color:var(--border-hover); transform:translateY(-3px); }
.quote-mark{ position:absolute; top:10px; right:18px; font-family:var(--font-display); font-size:46px; color:rgba(140,124,240,.18); line-height:1; }
.testi-quote{ font-size:14.5px; line-height:1.65; color:var(--text-primary); margin-bottom:20px; position:relative; z-index:1; }
.testi-person{ display:flex; align-items:center; gap:11px; }
.testi-avatar{ width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-family:var(--font-mono); font-size:11.5px; font-weight:600; color:#1A1200; box-shadow:0 0 0 3px rgba(255,255,255,.04); }
.testi-person div p:first-child{ font-size:13.5px; font-weight:600; }
.testi-person div p:last-child{ font-size:12px; color:var(--text-tertiary); margin-top:1px; }

/* ---------- FAQ ---------- */
.faq{ padding:92px 0; max-width:720px; margin:0 auto; }
.faq-item{ border-bottom:1px solid var(--border); position:relative; padding-left:14px; transition:border-color .2s ease; }
.faq-item::before{ content:''; position:absolute; left:0; top:20px; bottom:20px; width:2px; border-radius:2px; background:var(--violet); opacity:0; transition:opacity .25s ease; }
.faq-item.open::before{ opacity:1; box-shadow:0 0 10px 1px rgba(140,124,240,.6); }
.faq-q{
  width:100%; text-align:left; background:none; border:none; cursor:pointer; display:flex; align-items:center; justify-content:space-between;
  padding:22px 4px; color:var(--text-primary); font-family:var(--font-body); font-size:15.5px; font-weight:500;
}
.faq-q .plus{ position:relative; width:16px; height:16px; flex-shrink:0; margin-left:20px; }
.faq-q .plus::before, .faq-q .plus::after{ content:''; position:absolute; background:var(--amber); border-radius:2px; transition:transform .3s ease; }
.faq-q .plus::before{ left:0; top:7px; width:16px; height:2px; }
.faq-q .plus::after{ left:7px; top:0; width:2px; height:16px; }
.faq-item.open .plus::after{ transform:rotate(90deg); }
.faq-a{ display:grid; grid-template-rows:0fr; transition:grid-template-rows .35s cubic-bezier(.16,1,.3,1); }
.faq-item.open .faq-a{ grid-template-rows:1fr; }
.faq-a-inner{ overflow:hidden; font-size:14px; color:var(--text-secondary); line-height:1.65; padding-right:4px; }
.faq-item.open .faq-a-inner{ padding-bottom:22px; }

/* ---------- Final CTA ---------- */
.final-cta{ padding:100px 0 110px; text-align:center; overflow:hidden; }
.aurora-cta{ inset:auto -10% -20% -10%; height:420px; }
.final-cta h2{ font-family:var(--font-display); font-weight:600; font-size:clamp(28px,3.6vw,42px); margin-bottom:16px; }
.final-cta p{ color:var(--text-secondary); margin-bottom:30px; font-size:15.5px; }

/* ---------- Footer ---------- */
footer{ border-top:1px solid var(--border); padding:56px 0 34px; }
.footer-grid{ display:grid; grid-template-columns:1.4fr repeat(3,1fr); gap:32px; margin-bottom:44px; }
.footer-brand p{ font-size:13.5px; color:var(--text-tertiary); margin-top:14px; line-height:1.6; max-width:260px; }
.footer-col h4{ font-family:var(--font-mono); font-size:11.5px; letter-spacing:.08em; text-transform:uppercase; color:var(--text-tertiary); margin-bottom:16px; }
.footer-col ul{ list-style:none; display:flex; flex-direction:column; gap:11px; }
.footer-col a{ font-size:13.5px; color:var(--text-secondary); transition:color .15s ease; }
.footer-col a:hover{ color:var(--text-primary); }
.footer-bottom{ border-top:1px solid var(--border); padding-top:24px; display:flex; align-items:center; justify-content:space-between; font-size:12.5px; color:var(--text-tertiary); }

/* ---------- Responsive ---------- */
@media (max-width:900px){
  .hero-grid{ grid-template-columns:1fr; padding-top:10px; }
  .feature-grid{ grid-template-columns:repeat(2,1fr); }
  .testi-grid{ grid-template-columns:1fr; }
  .footer-grid{ grid-template-columns:1fr 1fr; }
  .nav-links{ position:absolute; top:100%; left:0; right:0; flex-direction:column; align-items:flex-start; gap:0; background:rgba(5,7,14,.97); backdrop-filter:blur(14px); border-bottom:1px solid var(--border); max-height:0; overflow:hidden; transition:max-height .3s ease; }
  .nav-links.open{ max-height:260px; }
  .nav-links a{ padding:14px 24px; width:100%; }
  .menu-toggle{ display:flex; }
}
@media (max-width:560px){
  .feature-grid{ grid-template-columns:1fr; }
  .footer-grid{ grid-template-columns:1fr; }
  .hero-actions{ flex-direction:column; align-items:flex-start; }
}
@media (prefers-reduced-motion: reduce){
  *{ animation:none !important; transition:none !important; }
  [data-reveal]{ opacity:1 !important; transform:none !important; }
}
`;