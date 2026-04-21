import { useRef, useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useMotionValueEvent,
} from 'framer-motion'
import { Button } from '../components'
import { HeroBackground } from '../components/ui/hero-bg'
import {
  Shield, Zap, FileText, ArrowRight, Brain, Lock, ShieldCheck,
} from 'lucide-react'
import './landing.css'

// ─── Easing + motion tokens ───────────────────────────────────────────────────
const EASE: [number, number, number, number] = [0.2, 0.6, 0.2, 0.98]

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
}

const staggerItem = {
  hidden: { opacity: 0, y: 28, filter: 'blur(6px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.65, ease: EASE } },
}

// ─── Scroll progress bar ──────────────────────────────────────────────────────
function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const width = useTransform(scrollYProgress, (v) => `${v * 100}%`)
  return <motion.div className="landing-progress" style={{ width }} aria-hidden="true" />
}

// ─── Section counter pill ─────────────────────────────────────────────────────
function SectionCounter({ total }: { total: number }) {
  const [active, setActive] = useState(1)

  useEffect(() => {
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>('[data-section-index]')
    )
    if (!sections.length) return

    const update = () => {
      const vh = window.innerHeight
      let cur = 1
      for (const s of sections) {
        const r = s.getBoundingClientRect()
        if (r.top <= vh * 0.4 && r.bottom > vh * 0.4) {
          cur = Number(s.dataset.sectionIndex) || cur
        }
      }
      setActive(cur)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <div className="landing-section-counter font-mono" aria-hidden="true">
      {String(active).padStart(2, '0')} — {String(total).padStart(2, '0')}
    </div>
  )
}

// ─── Pinned word reveal ───────────────────────────────────────────────────────
/** Splits text into words, toggling `dim`/`on`/`hl` as the section is scrubbed. */
function PinnedWordReveal({ sectionIndex }: { sectionIndex: number }) {
  const sectionRef = useRef<HTMLElement>(null)

  // Words flagged with `hl:` get the highlighted gold + italic treatment
  const TOKENS: Array<{ text: string; hl?: boolean }> = [
    { text: 'Every' }, { text: 'dollar' }, { text: 'you' }, { text: "can't" }, { text: 'claim' },
    { text: 'is' }, { text: 'tax' }, { text: 'you' }, { text: 'already' }, { text: 'paid—' },
    { text: '9', hl: true }, { text: 'ATO' }, { text: 'categories,' },
    { text: 'composite', hl: true }, { text: 'confidence,' },
    { text: 'zero', hl: true }, { text: 'data' }, { text: 'stored.' },
  ]

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  })

  const wordRefs = useRef<Array<HTMLSpanElement | null>>([])

  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    const count = TOKENS.length
    wordRefs.current.forEach((el, i) => {
      if (!el) return
      const threshold = i / count
      el.classList.toggle('on', p >= threshold)
      el.classList.toggle('dim', p < threshold)
    })
  })

  return (
    <section
      ref={sectionRef}
      data-section-index={sectionIndex}
      className="relative"
      style={{ height: '300vh' }}
      aria-label="Key facts about Deductly"
    >
      <div className="sticky top-0 h-screen flex items-center justify-center overflow-hidden">
        <div className="pin-bg-word" aria-hidden="true">claim.</div>
        <div className="relative max-w-4xl px-6 sm:px-9 text-left">
          <span className="block font-mono text-[11px] tracking-[0.22em] uppercase text-slate-400 mb-7">
            / 01 Why it matters
          </span>
          <p className="font-display font-normal leading-[1.08] tracking-[-0.015em] text-[clamp(32px,5vw,68px)]">
            {TOKENS.map((tok, i) => (
              <span key={i}>
                <span
                  ref={(el) => (wordRefs.current[i] = el)}
                  className={`reveal-word dim${tok.hl ? ' hl' : ''}`}
                >
                  {tok.text}
                </span>
                {i < TOKENS.length - 1 ? ' ' : ''}
              </span>
            ))}
          </p>
        </div>
      </div>
    </section>
  )
}

// ─── IntersectionObserver-driven class toggle (staggered) ────────────────────
function useInViewStagger<T extends HTMLElement>(
  selector: string,
  delayPerItem = 120,
  threshold = 0.15,
) {
  const rootRef = useRef<T>(null)
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const items = Array.from(root.querySelectorAll<HTMLElement>(selector))
    if (!items.length) return

    const prefersReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduce) {
      items.forEach((el) => el.classList.add('in'))
      return
    }

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const idx = items.indexOf(e.target as HTMLElement)
            const delay = Math.max(0, idx) * delayPerItem
            window.setTimeout(() => (e.target as HTMLElement).classList.add('in'), delay)
            obs.unobserve(e.target)
          }
        })
      },
      { threshold },
    )
    items.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [selector, delayPerItem, threshold])
  return rootRef
}

// ─── Horizontal scroll section ────────────────────────────────────────────────
function HorizontalScrollCategories({ sectionIndex }: { sectionIndex: number }) {
  const sectionRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  const SLIDES = [
    { n: '001', title: 'Work Software', sub: 'Licences, SaaS, subscriptions used for work.', meta: 'Adobe · Figma · JetBrains', tone: 's1' },
    { n: '002', title: 'Phone & Internet', sub: 'Work-use % of your mobile and home internet.', meta: 'Telstra · Optus · NBN', tone: 's2' },
    { n: '003', title: 'Work Equipment', sub: 'Hardware, tools, and gear for your role.', meta: 'Under $300 · Depreciable', tone: 's3' },
    { n: '004', title: 'Training & Education', sub: 'Courses tied to your current employment.', meta: 'ATO-eligible · Receipts needed', tone: 's4' },
    { n: '005', title: 'Travel', sub: 'Logbook-backed work travel, not commuting.', meta: 'Car · Public transport', tone: 's5' },
    { n: '006', title: 'Donations', sub: 'Gifts to Deductible Gift Recipients (DGRs).', meta: 'Verified via ABN Lookup', tone: 's6' },
  ]

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  })

  // Translate the track horizontally as vertical scroll progresses through the section
  const [maxShift, setMaxShift] = useState(0)
  const updateMax = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    setMaxShift(Math.max(0, track.scrollWidth - window.innerWidth + 72))
  }, [])
  useEffect(() => {
    updateMax()
    window.addEventListener('resize', updateMax)
    return () => window.removeEventListener('resize', updateMax)
  }, [updateMax])

  const x = useTransform(scrollYProgress, [0, 1], [0, -maxShift])
  const xSmooth = useSpring(x, { stiffness: 180, damping: 32, mass: 0.5 })

  const [counter, setCounter] = useState(1)
  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    const idx = Math.min(SLIDES.length, Math.floor(p * SLIDES.length) + 1)
    setCounter(Math.max(1, idx))
  })

  const TONE_CLASSES: Record<string, string> = {
    s1: 'bg-gradient-to-br from-gold-600 via-gold-500/70 to-ink-900 text-white',
    s2: 'bg-gradient-to-br from-amber-500/80 to-gold-700 text-white',
    s3: 'bg-gradient-to-br from-ink-800 to-ink-900 text-accent-light border border-gold-600/40',
    s4: 'bg-[radial-gradient(circle_at_20%_80%,#C8900A,#A67508_50%,#12100D)] text-white',
    s5: 'bg-gradient-to-b from-ink-700 to-gold-700 text-white',
    s6: 'bg-[conic-gradient(from_180deg_at_70%_30%,#C8900A,#F5C842,#A67508,#C8900A)] text-ink-900',
  }

  return (
    <section
      ref={sectionRef}
      data-section-index={sectionIndex}
      className="relative bg-ink-950 text-white"
      style={{ height: '450vh' }}
      aria-label="Supported deduction categories"
    >
      <div className="sticky top-0 h-screen overflow-hidden flex items-center">
        {/* Header */}
        <div className="absolute top-10 left-9 z-10">
          <span className="font-mono text-[11px] tracking-[0.22em] uppercase text-accent-light">
            / 02 Supported categories
          </span>
          <h3 className="font-display italic text-2xl sm:text-3xl mt-3 text-white">
            Nine categories, scrolled sideways.
          </h3>
        </div>

        {/* Track */}
        <motion.div
          ref={trackRef}
          className="flex gap-10 pl-[10vw] pr-[10vw] will-change-transform"
          style={{ x: xSmooth }}
        >
          {SLIDES.map((s) => (
            <div key={s.n} className={`horz-slide ${TONE_CLASSES[s.tone]}`}>
              <div className="font-mono text-xs tracking-[0.2em] opacity-90">{s.n} / {s.title}</div>
              <div>
                <div className="font-display text-[clamp(42px,6vw,72px)] leading-[0.95] tracking-[-0.02em] max-w-[75%]">
                  {s.title}.
                </div>
                <p className="mt-4 text-sm sm:text-base opacity-90 max-w-md">{s.sub}</p>
              </div>
              <div className="flex justify-between items-end font-mono text-[10px] tracking-[0.2em] uppercase opacity-95">
                <span>{s.meta}</span>
                <span>{s.n}</span>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Counter */}
        <div className="absolute bottom-10 right-9 font-mono text-[11px] tracking-[0.2em] uppercase text-slate-300">
          {String(counter).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}
        </div>
      </div>
    </section>
  )
}

// ─── Canvas procedural sequence (pipeline scrub) ──────────────────────────────
function CanvasPipelineScrub({ sectionIndex }: { sectionIndex: number }) {
  const sectionRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  })

  const [frame, setFrame] = useState(1)
  const TOTAL_FRAMES = 120

  const draw = useCallback((p: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.clientWidth
    const H = canvas.clientHeight
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
      canvas.width = W * dpr
      canvas.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    ctx.clearRect(0, 0, W, H)

    // Warm gradient base
    const g = ctx.createLinearGradient(0, 0, W, H)
    g.addColorStop(0, 'rgba(18, 16, 13, 1)')
    const mix = p
    const r = Math.round(18 + mix * (200 - 18))
    const gC = Math.round(16 + mix * (144 - 16))
    const b = Math.round(13 + mix * (10 - 13))
    g.addColorStop(1, `rgba(${r}, ${gC}, ${b}, 1)`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)

    const cx = W / 2
    const cy = H / 2

    // Concentric arcs — breathe with scroll
    const rings = 22
    for (let i = 0; i < rings; i++) {
      const t = i / (rings - 1)
      const rad = 30 + t * (Math.max(W, H) * 0.55) + Math.sin(p * Math.PI * 2 + i * 0.4) * 6
      ctx.beginPath()
      ctx.arc(
        cx + Math.cos(p * Math.PI * 2 + i * 0.2) * 20,
        cy + Math.sin(p * Math.PI * 2 + i * 0.2) * 10,
        rad,
        0,
        Math.PI * 2,
      )
      ctx.strokeStyle = `rgba(245, 200, 66, ${0.22 - t * 0.19})`
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // Rotating bar (represents the scanning pipeline)
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(p * Math.PI * 2)
    ctx.fillStyle = 'rgba(245, 200, 66, 0.85)'
    const barW = W * 0.2 + p * W * 0.5
    ctx.fillRect(-barW / 2, -3, barW, 6)
    ctx.restore()

    // Growing disc (the aggregated report)
    const discR = 20 + p * Math.min(W, H) * 0.22
    ctx.beginPath()
    ctx.arc(cx, cy, discR, 0, Math.PI * 2)
    ctx.fillStyle = '#12100D'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(cx, cy, discR, 0, Math.PI * 2)
    ctx.strokeStyle = '#C8900A'
    ctx.lineWidth = 2
    ctx.stroke()

    // Satellite (each transaction being classified)
    const sx = cx + Math.cos(p * Math.PI * 4) * discR * 1.8
    const sy = cy + Math.sin(p * Math.PI * 4) * discR * 1.8
    ctx.beginPath()
    ctx.arc(sx, sy, 8, 0, Math.PI * 2)
    ctx.fillStyle = '#F5C842'
    ctx.fill()
  }, [])

  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    draw(p)
    setFrame(Math.max(1, Math.min(TOTAL_FRAMES, Math.ceil(p * TOTAL_FRAMES))))
  })

  useEffect(() => {
    draw(0)
    const onResize = () => draw(0)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [draw])

  return (
    <section
      ref={sectionRef}
      data-section-index={sectionIndex}
      className="relative bg-ink-900"
      style={{ height: '400vh' }}
      aria-label="How Deductly analyses your statement"
    >
      <div className="sticky top-0 h-screen overflow-hidden flex items-center justify-center">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" aria-hidden="true" />
        <div className="relative z-10 w-full flex justify-between items-start p-9 text-white">
          <div className="max-w-[360px]">
            <span className="font-mono text-[11px] tracking-[0.22em] uppercase text-accent-light mb-5 block">
              / 03 Pipeline
            </span>
            <h3 className="font-display font-normal leading-[0.95] tracking-[-0.02em] text-[clamp(40px,6vw,78px)]">
              From <em className="text-accent-light">raw</em> statement<br />
              to <em className="text-accent-light">ready</em> report.
            </h3>
          </div>
          <div className="max-w-[320px] font-mono text-[11px] leading-[2] tracking-[0.14em] uppercase text-slate-300 text-right mt-2">
            Parse<br />Redact<br />Classify<br />Score<br />Export
          </div>
        </div>
        <div className="absolute bottom-10 right-9 font-mono text-[11px] tracking-[0.2em] text-slate-300 z-10">
          Frame {String(frame).padStart(3, '0')} / {TOTAL_FRAMES}
        </div>
      </div>
    </section>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Landing() {
  const navigate = useNavigate()

  // Pre-warm the backend so Render's free tier isn't cold on /upload
  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_BASE_URL
    if (apiBase) fetch(`${apiBase}/health`, { method: 'GET' }).catch(() => {})
  }, [])

  // Hero parallax — rings/orb/content translate as hero scrolls out
  const heroRef = useRef<HTMLElement>(null)
  const { scrollYProgress: heroScroll } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  })
  const heroContentY = useTransform(heroScroll, [0, 1], ['0%', '-18%'])
  const heroContentOpacity = useTransform(heroScroll, [0, 0.7], [1, 0])
  const ringR1Y = useTransform(heroScroll, [0, 1], ['0%', '26%'])
  const ringR2Y = useTransform(heroScroll, [0, 1], ['0%', '18%'])
  const ringR3Y = useTransform(heroScroll, [0, 1], ['0%', '10%'])
  const orbY = useTransform(heroScroll, [0, 1], ['0%', '34%'])

  // Char-split CTA
  const ctaRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ctaRef.current
    if (!el) return
    const prefersReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            el.classList.add('in')
            obs.disconnect()
          }
        })
      },
      { threshold: 0.3 },
    )
    obs.observe(el)
    // Tear-down on unmount
    return () => obs.disconnect()
    void prefersReduce
  }, [])

  // Staggered reveals
  const tiltRef       = useInViewStagger<HTMLDivElement>('.tilt-card', 180)
  const commitRef     = useInViewStagger<HTMLOListElement>('.commit-row', 130)
  const quoteRef      = useInViewStagger<HTMLDivElement>('.quote-row', 0, 0.25)
  const indexRef      = useInViewStagger<HTMLUListElement>('.index-row', 100, 0.3)

  // ─── Data ──────────────────────────────────────────────────────────────────
  const FEATURES = [
    {
      title: 'Privacy First',
      body: 'Data is processed in memory and discarded the moment your report is generated. Nothing is ever stored.',
      icon: <Shield size={22} />,
      tag: 'Ephemeral · In-memory',
    },
    {
      title: 'ATO Rule Engine',
      body: 'Every transaction is matched against ATO deduction rules with keyword detection, merchant recognition, and recurring-pattern analysis.',
      icon: <Brain size={22} />,
      tag: 'Rules · Merchants · Patterns',
    },
    {
      title: 'Confidence Scores',
      body: 'Composite scoring across keyword, merchant, and pattern signals. Every classification is transparent with reasons shown.',
      icon: <Zap size={22} />,
      tag: 'Transparent · Explainable',
    },
    {
      title: 'Evidence Checklists',
      body: 'Every candidate includes what to keep: receipts, diary entries, or logbooks, plus occupation flags and ATO method guides.',
      icon: <FileText size={22} />,
      tag: 'Receipts · Logs · Flags',
    },
  ] as const

  const COMMITS = [
    { sha: 'a3f2c9d', msg: 'feat(report): PDF now includes Privacy Policy & Terms appendix', branch: 'reports · main',     when: 'today' },
    { sha: '7e1b8a0', msg: 'perf(upload): halve PDF parsing latency, smoother progress UX', branch: 'upload · main',      when: 'yesterday' },
    { sha: 'b92d4f1', msg: 'feat(privacy): ephemeral cleanup now runs on every exit path', branch: 'api · security-pass', when: '2d' },
    { sha: '15c0e7a', msg: 'fix(config): strip whitespace when parsing comma-separated env vars', branch: 'config · hardening', when: '2d' },
    { sha: 'd4f9c2e', msg: 'docs: rewrote Privacy + added Terms of Service', branch: 'web · copy',                           when: '1w' },
  ]

  const STACK = [
    { n: 'A', label: 'CommBank, NAB, Westpac, ANZ, ING', tail: '& PDF statements',     tag: '5 banks' },
    { n: 'B', label: 'CSV & PDF bank exports',            tail: '& auto-detected layout', tag: 'Any format' },
    { n: 'C', label: '9 ATO deduction categories',        tail: '& occupation flags',     tag: 'Full coverage' },
    { n: 'D', label: 'BSB, account, card redaction',      tail: '& PII masking',          tag: 'Auto-redact' },
    { n: 'E', label: 'Ephemeral in-memory processing',    tail: '& no database writes',   tag: 'Zero storage' },
    { n: 'F', label: 'PDF, CSV, and JSON audit trail',    tail: '& download & forget',    tag: '3 formats' },
    { n: 'G', label: 'No account, no email, no login',    tail: '& no tracking cookies',  tag: 'Anon-first' },
  ]

  const QUOTES = [
    {
      who: { name: 'Freelance developer', role: 'Sydney · sole trader' },
      body: [
        'Uploaded my year of statements and had a ',
        { em: 'line-by-line deduction list' },
        ' before my tax agent even replied. Saved me a weekend.',
      ],
    },
    {
      who: { name: 'PAYG employee', role: 'Melbourne · remote-first' },
      body: [
        'Most tools make me hand over my bank login. Deductly ',
        { em: 'never touched my credentials' },
        ' and deleted everything after.',
      ],
    },
    {
      who: { name: 'Registered tax agent', role: 'Brisbane · BAS' },
      body: [
        'The PDF report lands in my inbox with ',
        { em: 'evidence checklists per item' },
        '. I verify, sign, lodge. Two-hour job becomes twenty minutes.',
      ],
    },
  ]

  // The total for the counter = # sections with data-section-index
  const TOTAL_SECTIONS = 9

  return (
    <div className="min-h-screen bg-ink-900">
      <ScrollProgress />
      <SectionCounter total={TOTAL_SECTIONS} />

      {/* ═══════════════════════════════════════════════════════════════════════
          01 · HERO  —  shader + parallax overlay
          ═══════════════════════════════════════════════════════════════════════ */}
      <section
        ref={heroRef}
        data-section-index={1}
        className="relative h-screen overflow-hidden"
        aria-label="Deductly hero"
      >
        <HeroBackground />

        {/* Parallax rings over shader */}
        <motion.div style={{ y: ringR3Y }} className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="hero-ring r3" />
        </motion.div>
        <motion.div style={{ y: ringR2Y }} className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="hero-ring r2" />
        </motion.div>
        <motion.div style={{ y: ringR1Y }} className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="hero-ring" />
        </motion.div>
        <motion.div style={{ y: orbY }} className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="hero-orb" />
        </motion.div>

        {/* Hero content */}
        <motion.div
          style={{ y: heroContentY, opacity: heroContentOpacity }}
          className="relative z-10 h-full flex items-center justify-center px-6 sm:px-9"
        >
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="max-w-5xl w-full text-center"
          >
            <motion.span
              variants={staggerItem}
              className="inline-block font-mono text-[10px] sm:text-[11px] tracking-[0.28em] uppercase text-accent-light mb-6"
            >
              / The Australian tax-deduction analyser
            </motion.span>

            <motion.h1
              variants={staggerItem}
              className="font-display font-normal leading-[0.92] tracking-[-0.025em] text-[clamp(56px,12vw,168px)] text-white"
            >
              <span className="block">Find Every Tax Deduction</span>
              <span className="block italic text-accent-light mt-2">You're Missing</span>
            </motion.h1>

            <motion.p
              variants={staggerItem}
              className="mt-8 text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed"
            >
              Upload your CSV or PDF bank statement. Get a line-by-line deduction report with ATO
              citations, confidence scores, and evidence checklists — ready for your tax agent.
            </motion.p>

            <motion.div variants={staggerItem} className="mt-10 flex flex-col items-center gap-5">
              <Button
                variant="primary"
                size="lg"
                onClick={() => navigate('/upload')}
                className="group"
              >
                Find My Deductions
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Button>

              <div className="flex flex-wrap justify-center gap-2">
                {[
                  { Icon: Lock, text: 'No data stored', accent: '#4ADE80' },
                  { Icon: ShieldCheck, text: 'ATO Aligned', accent: '#F5C842' },
                  { Icon: Zap, text: 'Instant analysis', accent: '#93C5FD' },
                ].map(({ Icon, text, accent }) => (
                  <span
                    key={text}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium tracking-[0.02em]"
                    style={{
                      background: 'rgba(26,22,16,0.75)',
                      border: '1px solid rgba(64,58,48,0.8)',
                      color: '#C4BAB0',
                      backdropFilter: 'blur(8px)',
                    }}
                  >
                    <Icon size={11} style={{ color: accent }} strokeWidth={2.5} className="shrink-0" />
                    {text}
                  </span>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Bottom meta strip */}
        <div className="absolute bottom-8 left-9 right-9 z-10 flex justify-between items-end font-mono text-[10px] sm:text-[11px] tracking-[0.22em] uppercase text-slate-300 pointer-events-none">
          <div className="max-w-[200px] leading-[1.8]">
            Built in<br />Australia<br />for AU taxpayers.
          </div>
          <div className="hidden sm:block">v1.0 · ATO 2024–2025</div>
          <div className="text-right max-w-[200px] leading-[1.8]">
            Ephemeral by<br />default · No<br />account needed.
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute left-1/2 bottom-4 -translate-x-1/2 z-10 font-mono text-[10px] tracking-[0.3em] uppercase text-slate-300 pointer-events-none">
          Scroll<span className="scroll-hint-arrow ml-2">↓</span>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          02 · PINNED WORD REVEAL  —  "why it matters"
          ═══════════════════════════════════════════════════════════════════════ */}
      <PinnedWordReveal sectionIndex={2} />

      {/* ═══════════════════════════════════════════════════════════════════════
          03 · EDITORIAL TILT CARDS  —  Why Deductly (feature grid w/ scan sweep)
          ═══════════════════════════════════════════════════════════════════════ */}
      <section
        data-section-index={3}
        className="relative bg-ink-900 py-[120px] sm:py-[160px] border-t border-line-700"
      >
        <div className="max-w-[1280px] mx-auto px-6 sm:px-9">
          {/* Head */}
          <div className="grid lg:grid-cols-[1fr_auto] items-end gap-10 mb-16 sm:mb-20">
            <div>
              <div className="flex items-center gap-3 mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-light" />
                <span className="font-mono text-[11px] tracking-[0.22em] uppercase text-slate-400">
                  02 / Why Deductly
                </span>
              </div>
              <h2 className="font-display font-normal leading-[0.95] tracking-[-0.025em] text-[clamp(46px,7vw,96px)] text-white">
                Built around<br /><em className="text-accent-light">one</em> question.
              </h2>
            </div>
            <div className="font-mono text-[11px] tracking-[0.22em] uppercase text-slate-400 text-right max-w-[240px] leading-[1.9]">
              <strong className="text-white font-semibold block mb-1">Every feature exists</strong>
              so your tax agent trusts<br />the report that lands<br />on their desk.
            </div>
          </div>

          {/* Editorial asymmetric grid */}
          <div ref={tiltRef} className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-x-6 md:gap-y-10">
            {/* Feature card — spans 7 cols */}
            <article className="tilt-card md:col-span-7">
              <div className="thumb relative aspect-[16/11] bg-gradient-to-br from-gold-700 via-gold-600 to-ink-900">
                <div className="absolute left-[8%] top-[15%] w-[45%] aspect-square rounded-full bg-[radial-gradient(circle_at_35%_35%,#F5C842,#C8900A_60%,#A67508)]" />
                <div className="absolute right-[10%] bottom-[12%] w-[38%] aspect-square rounded-full border-2 border-accent-light/80 bg-gradient-to-br from-amber-400/25 to-transparent" />
                <div className="corner absolute top-5 left-5 right-5 flex justify-between items-center font-mono text-[10px] tracking-[0.2em] uppercase text-white/90 z-10">
                  <span>01 / 04</span><span className="opacity-70">Privacy</span>
                </div>
                <div className="discipline absolute bottom-5 left-5 right-5 flex gap-2 flex-wrap z-10">
                  {['Ephemeral', 'In-memory', 'Auto-redact'].map((t) => (
                    <span key={t} className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-white px-2.5 py-1.5 border border-white/40 rounded-full bg-white/[0.08] backdrop-blur-sm">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="info grid grid-cols-[1fr_auto] gap-2 gap-x-4 items-baseline mt-5">
                <h3 className="font-display font-normal text-2xl sm:text-[40px] leading-[1.02] tracking-[-0.015em] text-white">
                  {FEATURES[0].title} — data deleted the moment your report is generated.
                </h3>
                <span className="font-mono text-[11px] tracking-[0.18em] text-slate-400">01</span>
                <span className="col-span-2 font-mono text-[11px] tracking-[0.12em] uppercase text-slate-400 flex items-center gap-2.5 mt-1">
                  <span className="w-4 h-px bg-accent-light" />
                  {FEATURES[0].tag}
                </span>
              </div>
            </article>

            {/* C2 — spans 5 cols */}
            <article className="tilt-card md:col-span-5">
              <div className="thumb relative aspect-[4/5] bg-gradient-to-br from-ink-800 via-ink-700 to-ink-950">
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[58%] aspect-square border border-accent-light/55 rounded-full" />
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[34%] aspect-square bg-[radial-gradient(circle,#F5C842_0%,rgba(245,200,66,0)_70%)]" />
                <div className="corner absolute top-5 left-5 right-5 flex justify-between items-center font-mono text-[10px] tracking-[0.2em] uppercase text-white/90 z-10">
                  <span>02 / 04</span><span className="opacity-70">Engine</span>
                </div>
                <div className="discipline absolute bottom-5 left-5 right-5 flex gap-2 flex-wrap z-10">
                  {['ATO Rules', 'Keywords', 'Merchants'].map((t) => (
                    <span key={t} className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-white px-2.5 py-1.5 border border-white/40 rounded-full bg-white/[0.08] backdrop-blur-sm">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="info grid grid-cols-[1fr_auto] gap-2 gap-x-4 items-baseline mt-5">
                <h3 className="font-display font-normal text-[26px] leading-[1.1] tracking-[-0.015em] text-white">
                  {FEATURES[1].title}
                </h3>
                <span className="font-mono text-[11px] tracking-[0.18em] text-slate-400">02</span>
                <span className="col-span-2 font-mono text-[11px] tracking-[0.12em] uppercase text-slate-400 flex items-center gap-2.5 mt-1">
                  <span className="w-4 h-px bg-accent-light" />
                  {FEATURES[1].tag}
                </span>
              </div>
            </article>

            {/* C3 */}
            <article className="tilt-card md:col-span-4 md:mt-10">
              <div className="thumb relative aspect-[4/5] bg-gradient-to-b from-ink-800 to-ink-900">
                <div className="absolute inset-0 grid grid-cols-[repeat(8,1fr)] gap-[3px] p-[18%] items-end opacity-85">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="bg-accent-light/30" style={{ height: `${30 + ((i * 17) % 70)}%` }} />
                  ))}
                </div>
                <div className="corner absolute top-5 left-5 right-5 flex justify-between items-center font-mono text-[10px] tracking-[0.2em] uppercase text-white/90 z-10">
                  <span>03 / 04</span><span className="opacity-70">Scores</span>
                </div>
                <div className="discipline absolute bottom-5 left-5 right-5 flex gap-2 flex-wrap z-10">
                  {['0–100', 'Composite', 'Transparent'].map((t) => (
                    <span key={t} className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-white px-2.5 py-1.5 border border-white/40 rounded-full bg-white/[0.08] backdrop-blur-sm">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="info grid grid-cols-[1fr_auto] gap-2 gap-x-4 items-baseline mt-5">
                <h3 className="font-display font-normal text-[22px] leading-[1.1] text-white">{FEATURES[2].title}</h3>
                <span className="font-mono text-[11px] tracking-[0.18em] text-slate-400">03</span>
                <span className="col-span-2 font-mono text-[11px] tracking-[0.12em] uppercase text-slate-400 flex items-center gap-2.5 mt-1">
                  <span className="w-4 h-px bg-accent-light" />
                  {FEATURES[2].tag}
                </span>
              </div>
            </article>

            {/* C4 */}
            <article className="tilt-card md:col-span-4 md:mt-10">
              <div className="thumb relative aspect-[4/5] bg-gold-600">
                <div className="absolute inset-[14%] border border-white/35 rounded-lg" />
                <div className="absolute inset-[28%] bg-gradient-to-br from-amber-300 to-white rounded-md shadow-[0_12px_32px_rgba(0,0,0,0.25)]" />
                <div className="corner absolute top-5 left-5 right-5 flex justify-between items-center font-mono text-[10px] tracking-[0.2em] uppercase text-white/90 z-10">
                  <span>04 / 04</span><span className="opacity-70">Evidence</span>
                </div>
                <div className="discipline absolute bottom-5 left-5 right-5 flex gap-2 flex-wrap z-10">
                  {['Receipts', 'Logbook', 'Diary'].map((t) => (
                    <span key={t} className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-white px-2.5 py-1.5 border border-white/40 rounded-full bg-white/[0.08] backdrop-blur-sm">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="info grid grid-cols-[1fr_auto] gap-2 gap-x-4 items-baseline mt-5">
                <h3 className="font-display font-normal text-[22px] leading-[1.1] text-white">{FEATURES[3].title}</h3>
                <span className="font-mono text-[11px] tracking-[0.18em] text-slate-400">04</span>
                <span className="col-span-2 font-mono text-[11px] tracking-[0.12em] uppercase text-slate-400 flex items-center gap-2.5 mt-1">
                  <span className="w-4 h-px bg-accent-light" />
                  {FEATURES[3].tag}
                </span>
              </div>
            </article>

            {/* C5 — How It Works rollup */}
            <article className="tilt-card md:col-span-4 md:mt-10">
              <div className="thumb relative aspect-[4/5] bg-gradient-to-br from-ink-950 to-gold-700">
                <div className="absolute left-[-10%] right-[-10%] top-1/2 h-px bg-accent-light shadow-[0_0_24px_rgba(245,200,66,0.6)]" style={{ transform: 'rotate(-12deg)' }} />
                <div className="absolute right-[14%] top-[30%] w-[28%] aspect-square rounded-full bg-[radial-gradient(circle,#FFFFFF_0%,#F5C842_60%,rgba(245,200,66,0)_80%)]" />
                <div className="corner absolute top-5 left-5 right-5 flex justify-between items-center font-mono text-[10px] tracking-[0.2em] uppercase text-white/90 z-10">
                  <span>+1</span><span className="opacity-70">Flow</span>
                </div>
                <div className="discipline absolute bottom-5 left-5 right-5 flex gap-2 flex-wrap z-10">
                  {['Upload', 'Analyse', 'Download'].map((t) => (
                    <span key={t} className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-white px-2.5 py-1.5 border border-white/40 rounded-full bg-white/[0.08] backdrop-blur-sm">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="info grid grid-cols-[1fr_auto] gap-2 gap-x-4 items-baseline mt-5">
                <h3 className="font-display font-normal text-[22px] leading-[1.1] text-white">How It Works</h3>
                <span className="font-mono text-[11px] tracking-[0.18em] text-slate-400">+1</span>
                <span className="col-span-2 font-mono text-[11px] tracking-[0.12em] uppercase text-slate-400 flex items-center gap-2.5 mt-1">
                  <span className="w-4 h-px bg-accent-light" />
                  Upload Your Statement → Rules Engine Analyses Transactions → Download Your Report
                </span>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          04 · HORIZONTAL SCROLL  —  deduction categories
          ═══════════════════════════════════════════════════════════════════════ */}
      <HorizontalScrollCategories sectionIndex={4} />

      {/* ═══════════════════════════════════════════════════════════════════════
          05 · CANVAS SEQUENCE  —  pipeline scrub
          ═══════════════════════════════════════════════════════════════════════ */}
      <CanvasPipelineScrub sectionIndex={5} />

      {/* ═══════════════════════════════════════════════════════════════════════
          06 · COMMITS  —  staggered "now building" feed
          ═══════════════════════════════════════════════════════════════════════ */}
      <section
        data-section-index={6}
        className="relative bg-ink-900 px-6 sm:px-9 py-[120px] sm:py-[160px] overflow-hidden"
      >
        <div className="absolute -left-[10%] top-[10%] w-[50vmin] h-[50vmin] bg-[radial-gradient(circle,rgba(245,200,66,0.06),transparent_70%)] pointer-events-none" aria-hidden="true" />

        <div className="max-w-[1100px] mx-auto relative">
          <div className="flex justify-between items-end mb-[60px] gap-10 flex-wrap">
            <div>
              <div className="flex items-center gap-3 mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-light" />
                <span className="font-mono text-[11px] tracking-[0.22em] uppercase text-slate-400">
                  03 / Now Building
                </span>
              </div>
              <h2 className="font-display font-normal leading-[0.9] tracking-[-0.025em] text-[clamp(52px,9vw,120px)] text-white">
                A log of<br />what's <em className="text-accent-light">on.</em>
              </h2>
            </div>

            <div className="font-mono text-[11px] tracking-[0.18em] uppercase text-slate-400 flex items-center gap-2.5 py-2.5 px-4 bg-gold-600/[0.06] border border-gold-600/[0.18] rounded-full whitespace-nowrap">
              <span className="pulse-dot" />
              Live · last push today
            </div>
          </div>

          <ol ref={commitRef} className="list-none border-t border-gold-600/[0.1]">
            {COMMITS.map((c) => (
              <li key={c.sha} className="commit-row">
                <div className="font-mono text-[13px] tracking-[0.04em] text-accent-light font-medium pl-[18px]">
                  {c.sha}
                </div>
                <div className="flex flex-col gap-1.5 min-w-0">
                  <div className="font-display text-[clamp(20px,2.4vw,32px)] leading-[1.15] tracking-[-0.01em] text-white">
                    {c.msg}
                  </div>
                  <div className="font-mono text-[11px] tracking-[0.15em] uppercase text-slate-400">
                    {c.branch}
                  </div>
                </div>
                <div className="font-mono text-xs tracking-[0.1em] text-slate-500 text-right">
                  {c.when}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          07 · BLUR-IN QUOTES  —  who it's for
          ═══════════════════════════════════════════════════════════════════════ */}
      <section
        data-section-index={7}
        className="bg-ink-950 px-6 sm:px-9 py-[140px] sm:py-[180px]"
      >
        <div ref={quoteRef} className="max-w-[1100px] mx-auto">
          <span className="block font-mono text-[11px] tracking-[0.22em] uppercase text-slate-400 mb-[60px]">
            / 04 Who it's for
          </span>

          {QUOTES.map((q, i) => (
            <div key={i} className={`quote-row ${i < QUOTES.length - 1 ? 'mb-[100px] sm:mb-[140px]' : ''}`}>
              <div className="font-mono text-[11px] tracking-[0.2em] uppercase leading-[2] text-slate-400">
                <strong className="text-accent-light font-semibold">{q.who.name}</strong><br />
                {q.who.role}
              </div>
              <blockquote className="font-display text-[clamp(32px,5vw,60px)] leading-[1.05] tracking-[-0.02em] text-white">
                “
                {q.body.map((part, idx) =>
                  typeof part === 'string' ? (
                    <span key={idx}>{part}</span>
                  ) : (
                    <em key={idx} className="text-accent-light">{part.em}</em>
                  ),
                )}
                ”
              </blockquote>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          08 · STACK INDEX  —  what we're built on
          ═══════════════════════════════════════════════════════════════════════ */}
      <section
        data-section-index={8}
        className="relative bg-ink-900 py-[140px] sm:py-[180px] overflow-hidden"
      >
        <div className="absolute -right-[10%] -top-[10%] w-[60vmin] h-[60vmin] bg-[radial-gradient(circle,#C8900A_0%,rgba(200,144,10,0)_70%)] blur-[40px] pointer-events-none" aria-hidden="true" />

        <div className="max-w-[1280px] mx-auto px-6 sm:px-9 mb-[70px]">
          <span className="block font-mono text-[11px] tracking-[0.22em] uppercase text-accent-light mb-6">
            / 05 Built on
          </span>
          <h2 className="font-display font-normal leading-[0.88] tracking-[-0.025em] text-[clamp(58px,10vw,152px)] text-white">
            What we<br />run <em className="text-accent-light">on.</em>
          </h2>
        </div>

        <ul ref={indexRef} className="list-none max-w-[1280px] mx-auto px-6 sm:px-9">
          {STACK.map((row) => (
            <li key={row.n} className="index-row text-white">
              <span className="font-mono text-[11px] tracking-[0.2em] text-slate-400 font-medium">{row.n}.</span>
              <span>{row.label}</span>
              <span className="italic text-accent-light">{row.tail}</span>
              <span className="index-tag font-mono text-[11px] tracking-[0.2em] text-slate-400 uppercase text-right font-medium">
                {row.tag}
              </span>
            </li>
          ))}
        </ul>

        {/* ── Stats ribbon (preserves test assertions: Deduction Categories + Composite Confidence) ── */}
        <div className="max-w-[1280px] mx-auto px-6 sm:px-9 mt-[100px] pt-12 border-t border-gold-600/15">
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.4 }}
          >
            {[
              { value: '9', label: 'Deduction Categories' },
              { value: '100%', label: 'Ephemeral — No Storage' },
              { value: '0–100', label: 'Composite Confidence' },
              { value: 'Free', label: 'No Account Needed' },
            ].map((s) => (
              <motion.div key={s.label} variants={staggerItem}>
                <div className="text-4xl sm:text-5xl font-mono font-bold text-gradient-bright mb-2 tabular-nums tracking-tight">
                  {s.value}
                </div>
                <div className="text-xs font-medium text-slate-500 tracking-widest uppercase">{s.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          09 · CONTACT / CTA  —  char-split headline
          ═══════════════════════════════════════════════════════════════════════ */}
      <section
        data-section-index={9}
        className="relative bg-gradient-to-br from-gold-700 via-gold-600 to-gold-500 text-white py-[120px] px-6 sm:px-9 overflow-hidden min-h-screen flex flex-col justify-between"
        style={{ color: '#12100D' }}
      >
        <div className="absolute -left-[20%] -bottom-[30%] w-[80vmin] h-[80vmin] rounded-full bg-[radial-gradient(circle,#F5C842_0%,rgba(245,200,66,0)_70%)] pointer-events-none" aria-hidden="true" />

        <div className="relative z-10 max-w-[1280px] mx-auto w-full">
          <span className="block font-mono text-[11px] tracking-[0.22em] uppercase text-ink-900/80 mb-6">
            / 06 Ready?
          </span>

          <div
            ref={ctaRef}
            className="char-reveal font-display font-normal leading-[0.88] tracking-[-0.03em] text-[clamp(72px,15vw,220px)] text-ink-950"
          >
            <CharSplit>Find.</CharSplit>
            <CharSplit italic>Claim.</CharSplit>
            <CharSplitWithCaret>Keep more.</CharSplitWithCaret>
          </div>

          <div className="mt-12 flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-8">
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate('/upload')}
              className="group"
            >
              Find My Deductions
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Button>
            <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-ink-900/80">
              No account · No storage · No surprises
            </p>
          </div>
        </div>

        {/* Foot */}
        <div className="relative z-10 max-w-[1280px] mx-auto w-full mt-[80px] pt-12 border-t border-ink-900/25 grid grid-cols-2 md:grid-cols-4 gap-8 font-mono text-[11px] tracking-[0.2em] uppercase text-ink-900/80">
          <div>
            <h4 className="mb-3 font-semibold text-ink-950">Supported</h4>
            <div className="leading-[2]">CommBank · NAB</div>
            <div className="leading-[2]">Westpac · ANZ · ING</div>
          </div>
          <div>
            <h4 className="mb-3 font-semibold text-ink-950">Formats</h4>
            <div className="leading-[2]">CSV · PDF</div>
            <div className="leading-[2]">Any AU bank</div>
          </div>
          <div>
            <h4 className="mb-3 font-semibold text-ink-950">Output</h4>
            <div className="leading-[2]">PDF report</div>
            <div className="leading-[2]">CSV + JSON audit</div>
          </div>
          <div>
            <h4 className="mb-3 font-semibold text-ink-950">Colophon</h4>
            <div className="leading-[2]">ATO 2024–2025</div>
            <div className="leading-[2]">© 2026 Deductly</div>
          </div>
        </div>
      </section>
    </div>
  )
}

// ─── Char-split helpers ───────────────────────────────────────────────────────
function CharSplit({ children, italic = false }: { children: string; italic?: boolean }) {
  const text = String(children)
  const Wrapper = italic ? 'em' : 'span'
  return (
    <a
      className="block cursor-default"
      style={{ fontStyle: italic ? 'italic' : 'normal' }}
      aria-label={text}
    >
      <Wrapper>
        {text.split('').map((c, i) => (
          <span
            key={i}
            className="ch"
            style={{ transitionDelay: `${i * 40}ms` }}
          >
            {c === ' ' ? '\u00A0' : c}
          </span>
        ))}
      </Wrapper>
    </a>
  )
}

function CharSplitWithCaret({ children }: { children: string }) {
  const text = String(children)
  return (
    <a className="block cursor-default" aria-label={text}>
      <span>
        {text.split('').map((c, i) => (
          <span
            key={i}
            className="ch"
            style={{ transitionDelay: `${i * 40}ms` }}
          >
            {c === ' ' ? '\u00A0' : c}
          </span>
        ))}
      </span>
      <span className="caret" aria-hidden="true" />
    </a>
  )
}
