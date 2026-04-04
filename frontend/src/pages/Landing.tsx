import { useRef, useEffect, MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  motion,
  useScroll, useTransform,
  useMotionValue, useMotionTemplate, useSpring,
} from 'framer-motion'
import { Button, AnimatedSection } from '../components'
import { HeroBackground } from '../components/ui/hero-bg'
import { Shield, Zap, FileText, ArrowRight, Upload, Brain, Lock, ShieldCheck } from 'lucide-react'

// ─── Stagger container ────────────────────────────────────────────────────────
const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
}
const EASE: [number, number, number, number] = [0.21, 0.47, 0.32, 0.98]
const staggerItem = {
  hidden: { opacity: 0, y: 28, filter: 'blur(6px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.6, ease: EASE } },
}
const staggerItemLeft = {
  hidden: { opacity: 0, x: -32, filter: 'blur(4px)' },
  visible: { opacity: 1, x: 0, filter: 'blur(0px)', transition: { duration: 0.55, ease: EASE } },
}

// ─── 3-D Tilt card ────────────────────────────────────────────────────────────
function TiltCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const rotateX = useTransform(my, [-0.5, 0.5], [7, -7])
  const rotateY = useTransform(mx, [-0.5, 0.5], [-7, 7])
  const glareX = useMotionTemplate`${useTransform(mx, [-0.5, 0.5], [0, 100])}%`
  const glareY = useMotionTemplate`${useTransform(my, [-0.5, 0.5], [0, 100])}%`

  const springRotX = useSpring(rotateX, { stiffness: 200, damping: 25 })
  const springRotY = useSpring(rotateY, { stiffness: 200, damping: 25 })

  function onMove(e: MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    mx.set((e.clientX - r.left - r.width / 2) / r.width)
    my.set((e.clientY - r.top - r.height / 2) / r.height)
  }
  function onLeave() { mx.set(0); my.set(0) }

  return (
    <motion.div
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ rotateX: springRotX, rotateY: springRotY, transformPerspective: 900 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={`relative ${className}`}
    >
      {/* Glare highlight */}
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-xl opacity-0 hover:opacity-100 transition-opacity duration-300"
        style={{
          background: useMotionTemplate`radial-gradient(160px circle at ${glareX} ${glareY}, rgba(165,180,252,0.12), transparent 70%)`,
        }}
      />
      {children}
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Landing() {
  const navigate = useNavigate()

  // Pre-warm the backend on page load so Render's free tier isn't cold
  // when the user navigates to /upload. Fire-and-forget — errors are ignored.
  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_BASE_URL
    if (apiBase) fetch(`${apiBase}/health`, { method: 'GET' }).catch(() => {/* ignore */ })
  }, [])

  // Hero parallax — tracks the hero section scrolling out of view
  const heroRef = useRef<HTMLElement>(null)
  const { scrollYProgress: heroScroll } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  })

  // Foreground layers — direct transforms (no spring) so they stay in sync with scroll
  const heroTextY = useTransform(heroScroll, [0, 1], ['0%', '-12%'])
  const cardY = useTransform(heroScroll, [0, 1], ['0%', '-20%'])

  // Opacity for hero content fading as it scrolls out
  const heroOpacity = useTransform(heroScroll, [0, 0.6], [1, 0])

  return (
    <div className="pt-16 overflow-x-hidden">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section
        ref={heroRef}
        className="relative overflow-hidden bg-[#0D0B09] min-h-[92vh] flex items-center"
      >
        {/* WebGL mesh-gradient background */}
        <HeroBackground />

        {/* Dot grid texture */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(200,144,10,0.09) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            opacity: 0.55,
          }}
        />

        {/* Top-center beacon — gold light shaft (softened) */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-44 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, rgba(245,200,66,0.32), transparent)' }}
        />
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none"
          style={{
            width: 'clamp(280px, 80vw, 480px)',
            height: 'clamp(140px, 40vw, 240px)',
            background: 'radial-gradient(ellipse 50% 100% at 50% 0%, rgba(200,144,10,0.09), transparent)',
          }}
        />

        {/* Hero content wrapper — fades + drifts on scroll */}
        <motion.div
          style={{ y: heroTextY, opacity: heroOpacity, willChange: 'transform, opacity' }}
          className="container mx-auto px-4 sm:px-6 py-14 sm:py-16 md:py-20 relative z-10"
        >
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

              {/* Left: copy — centered on mobile/tablet, left on desktop */}
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="text-center lg:text-left"
              >
                {/* Heading */}
                <motion.h1
                  variants={staggerItem}
                  className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.08] tracking-tight mb-4 sm:mb-5"
                >
                  <span className="text-white">Find Every Tax Deduction</span>
                  <br />
                  <span className="text-gradient-bright">You're Missing</span>
                </motion.h1>

                {/* Sub-copy */}
                <motion.div variants={staggerItem} className="max-w-lg mx-auto lg:mx-0 mb-7 sm:mb-8 space-y-2">
                  <p className="text-base sm:text-lg leading-relaxed" style={{ color: '#E2DDD8' }}>
                    Upload your CSV or PDF bank statement and instantly uncover every tax deduction you are entitled to.
                  </p>
                  <p className="text-sm sm:text-base leading-relaxed" style={{ color: '#A89E96' }}>
                    Powered by AI with ATO citations, confidence scores, and evidence checklists ready for your tax agent.
                  </p>
                </motion.div>

                {/* CTA + trust signals — grouped as one unit */}
                <motion.div variants={staggerItem} className="flex flex-col items-center lg:items-start gap-4">
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => navigate('/upload')}
                    className="group"
                  >
                    Find My Deductions
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </Button>
                  <div className="flex flex-nowrap justify-center lg:justify-start gap-2">
                    {[
                      { Icon: Lock, text: 'No data stored', accent: '#4ADE80' },
                      { Icon: ShieldCheck, text: 'ATO Aligned', accent: '#F5C842' },
                      { Icon: Zap, text: 'Instant analysis', accent: '#93C5FD' },
                    ].map(({ Icon, text, accent }) => (
                      <span
                        key={text}
                        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium tracking-[0.02em] transition-all duration-200"
                        style={{
                          background: `rgba(26,22,16,0.90)`,
                          border: `1px solid rgba(64,58,48,0.90)`,
                          color: '#C4BAB0',
                          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04)`,
                        }}
                      >
                        <Icon size={11} style={{ color: accent }} strokeWidth={2.5} className="shrink-0" />
                        {text}
                      </span>
                    ))}
                  </div>
                </motion.div>
              </motion.div>

              {/* Right: floating mock UI — parallax upward */}
              <motion.div
                style={{ y: cardY, willChange: 'transform' }}
                initial={{ opacity: 0, x: 32, scale: 0.97 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ duration: 0.75, delay: 0.3, ease: EASE }}
                className="hidden lg:block"
              >
                <div className="relative">
                  {/* Main glass card */}
                  <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                    className="glass rounded-2xl overflow-hidden"
                    style={{
                      border: '1px solid rgba(54,49,41,0.85)',
                      boxShadow: '0 24px 64px rgba(0,0,0,0.65), 0 0 0 1px rgba(200,144,10,0.12), inset 0 1px 0 rgba(255,255,255,0.04)',
                    }}
                  >
                    {/* Window chrome */}
                    <div
                      className="flex items-center gap-3 px-4 py-3 border-b"
                      style={{ background: 'rgba(20,16,10,0.70)', borderColor: 'rgba(54,49,41,0.70)' }}
                    >
                      <div className="flex gap-1.5">
                        {['#FF6B6B', '#FFD166', '#06D6A0'].map((c, i) => (
                          <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: c, opacity: 0.72 }} />
                        ))}
                      </div>
                      <div
                        className="flex-1 flex items-center justify-center gap-1.5 mx-4 py-1 px-3 rounded-md text-xs font-mono"
                        style={{
                          background: 'rgba(44,40,36,0.80)',
                          border: '1px solid rgba(54,49,41,0.55)',
                          color: '#7A7060',
                        }}
                      >
                        <span className="w-1 h-1 rounded-full bg-green-400 animate-pulse" />
                        deductly.app/analyse
                      </div>
                    </div>

                    {/* Card body */}
                    <div className="p-6 pb-12">
                      {/* File header */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-9 h-9 rounded-lg bg-gradient-brand flex items-center justify-center shrink-0">
                          <Upload size={15} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-white truncate">bank_statement_jul24.pdf</div>
                          <div className="text-xs" style={{ color: '#907E6E' }}>Analysing 247 transactions…</div>
                        </div>
                        <span
                          className="text-xs font-mono font-bold px-2 py-0.5 rounded shrink-0"
                          style={{
                            background: 'rgba(200,144,10,0.15)',
                            color: '#F5C842',
                            border: '1px solid rgba(200,144,10,0.25)',
                          }}
                        >
                          82%
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="h-1.5 rounded-full overflow-hidden mb-5" style={{ background: 'rgba(44,40,36,0.80)' }}>
                        <motion.div
                          className="h-full rounded-full bg-gradient-brand"
                          initial={{ width: '0%' }}
                          animate={{ width: '82%' }}
                          transition={{ duration: 1.8, delay: 0.8, ease: 'easeOut' }}
                        />
                      </div>

                      {/* Transaction rows */}
                      {[
                        { name: 'Officeworks', cat: 'Home Office', conf: 74, amount: '$89.95', catBg: 'rgba(212,151,10,0.15)', catFg: '#F5C842' },
                        { name: 'CPA Australia', cat: 'Professional', conf: 91, amount: '$549.00', catBg: 'rgba(74,222,128,0.12)', catFg: '#4ADE80' },
                        { name: 'Qantas Airways', cat: 'Work Travel', conf: 67, amount: '$312.40', catBg: 'rgba(147,197,253,0.12)', catFg: '#93C5FD' },
                      ].map((row, i) => (
                        <motion.div
                          key={row.name}
                          initial={{ opacity: 0, x: 12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 1.1 + i * 0.18, duration: 0.4 }}
                          className="flex items-center justify-between py-2.5 border-b last:border-0"
                          style={{ borderColor: 'rgba(54,49,41,0.60)' }}
                        >
                          <div>
                            <div className="text-sm font-medium text-white mb-0.5">{row.name}</div>
                            <span
                              className="text-xs px-1.5 py-0.5 rounded font-medium"
                              style={{ background: row.catBg, color: row.catFg }}
                            >
                              {row.cat}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="flex items-center gap-1.5">
                              <div className="w-10 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(44,40,36,0.80)' }}>
                                <motion.div
                                  className="h-full rounded-full"
                                  style={{ background: 'linear-gradient(90deg, #A67508, #F5C842)' }}
                                  initial={{ width: '0%' }}
                                  animate={{ width: `${row.conf}%` }}
                                  transition={{ delay: 1.3 + i * 0.18, duration: 0.5 }}
                                />
                              </div>
                              <span className="text-xs tabular-nums" style={{ color: '#907E6E' }}>{row.conf}%</span>
                            </div>
                            <span className="text-sm font-semibold text-white tabular-nums">{row.amount}</span>
                          </div>
                        </motion.div>
                      ))}

                    </div>
                  </motion.div>

                  {/* Floating badge — total */}
                  <motion.div
                    initial={{ opacity: 0, y: 12, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 2.0, duration: 0.45 }}
                    className="absolute -bottom-5 -left-6 rounded-xl px-4 py-3"
                    style={{
                      background: 'rgba(12,9,6,0.94)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid rgba(74,222,128,0.32)',
                      boxShadow: '0 8px 28px rgba(0,0,0,0.65), 0 0 20px rgba(74,222,128,0.10)',
                    }}
                  >
                    <div className="text-xs mb-0.5" style={{ color: '#907E6E' }}>You could be missing</div>
                    <div className="text-2xl font-bold font-mono" style={{ color: '#4ADE80' }}>$951.35</div>
                    <div className="text-xs mt-0.5" style={{ color: '#4ADE80', opacity: 0.65 }}>in deductions</div>
                  </motion.div>

                </div>
              </motion.div>

            </div>
          </div>
        </motion.div>

        {/* Scroll hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.5, duration: 0.6 }}
          style={{ opacity: useTransform(heroScroll, [0, 0.2], [1, 0]) }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10"
        >
          <span className="text-xs tracking-widest uppercase" style={{ color: '#46403A' }}>Scroll</span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            className="w-4 h-6 rounded-full flex items-start justify-center pt-1"
            style={{ border: '1px solid rgba(70,64,58,0.65)' }}
          >
            <div className="w-0.5 h-1.5 rounded-full" style={{ background: '#46403A' }} />
          </motion.div>
        </motion.div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section className="py-16 md:py-24 lg:py-28 bg-ink-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gold-600/[0.04] via-transparent to-transparent pointer-events-none" />

        <div className="container mx-auto px-4 sm:px-6 relative">
          <AnimatedSection variant="blur-up" className="text-center mb-10 md:mb-16">
            <p className="text-sm font-mono font-bold text-accent-light tracking-widest uppercase mb-3">Why Deductly</p>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
              Everything You Need for Tax Time
            </h2>
            <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto">
              ATO-grounded AI built for all Australian workers
            </p>
          </AnimatedSection>

          {/* Feature grid — each card tilts on hover */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 max-w-6xl mx-auto">
            {[
              {
                icon: <Shield size={22} />,
                title: 'Privacy First',
                body: 'Data is processed in memory and discarded the moment your report is generated. Nothing is ever stored.',
                delay: 0,
              },
              {
                icon: <Brain size={22} />,
                title: 'AI Grounded',
                body: 'Claude AI matches transactions against the ATO knowledge base with tailored rules across all major deduction categories.',
                delay: 0.1,
              },
              {
                icon: <Zap size={22} />,
                title: 'Confidence Scores',
                body: 'Composite 0 to 100 scoring using keyword matching, RAG grounding, and AI reasoning. Fully transparent.',
                delay: 0.2,
              },
              {
                icon: <FileText size={22} />,
                title: 'ATO Citations',
                body: 'Every deduction candidate includes the specific ATO ruling or tax determination that supports the claim.',
                delay: 0.3,
              },
            ].map((f) => (
              <AnimatedSection key={f.title} delay={f.delay} variant="scale">
                <TiltCard className="h-full">
                  <div className="h-full glass border border-line-700 hover:border-gold-600/40 hover:shadow-[0_0_28px_rgba(200,144,10,0.14)] rounded-xl p-6 transition-all duration-300 group">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-gold-600/20 to-gold-500/08 border border-line-600 group-hover:border-gold-600/40 flex items-center justify-center mb-5 text-accent-light group-hover:scale-[1.08] group-hover:shadow-[0_0_14px_rgba(200,144,10,0.28)] transition-all duration-300">
                      {f.icon}
                    </div>
                    <h3 className="text-base font-semibold text-white mb-2 tracking-[0.01em]">{f.title}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">{f.body}</p>
                  </div>
                </TiltCard>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────────────────── */}
      <section className="py-16 md:py-24 lg:py-28 bg-ink-950 relative overflow-hidden">
        {/* Static orb — no scroll tracking */}
        <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[500px] h-[500px] bg-accent/[0.05] blur-[160px] pointer-events-none" />

        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <AnimatedSection variant="blur-up" className="text-center mb-10 md:mb-16">
            <p className="text-sm font-mono font-bold text-accent-light tracking-widest uppercase mb-3">Process</p>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
              How It Works
            </h2>
            <p className="text-base sm:text-lg text-slate-400 max-w-xl mx-auto">
              Three steps from statement to deduction report
            </p>
          </AnimatedSection>

          {/* Steps — slide in from left with stagger */}
          <motion.div
            className="max-w-3xl mx-auto space-y-3 sm:space-y-4"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
          >
            {[
              {
                n: '01',
                title: 'Upload Your Statement',
                body: 'Drop in a CSV or PDF from any major Australian bank. We automatically detect the format, income year, and bank layout.',
              },
              {
                n: '02',
                title: 'AI Analyses Transactions',
                body: 'Every transaction is run against ATO deduction rules and given a confidence score. Your personal details are removed before any AI processing.',
              },
              {
                n: '03',
                title: 'Download Your Report',
                body: 'Get a full deduction report with ATO citations, evidence checklists, and occupation based flags ready for your tax agent.',
              },
            ].map((step) => (
              <motion.div
                key={step.n}
                variants={staggerItemLeft}
                className="glass border border-line-700 hover:border-line-600 rounded-2xl p-5 sm:p-7 flex items-start gap-4 sm:gap-6 transition-colors duration-200 group"
              >
                {/* Animated number badge */}
                <motion.div
                  whileHover={{ scale: 1.08, rotate: -3 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  className="shrink-0 w-12 h-12 rounded-xl bg-gradient-brand flex items-center justify-center text-white text-sm font-bold font-mono tracking-wide shadow-[0_2px_12px_rgba(200,144,10,0.32),inset_0_1px_0_rgba(255,255,255,0.14)]"
                >
                  {step.n}
                </motion.div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">{step.title}</h3>
                  <p className="text-slate-400 leading-relaxed">{step.body}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Stats strip ───────────────────────────────────────────────────── */}
      <section className="py-10 sm:py-16 bg-ink-900 border-y border-line-700 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-gold-600/[0.03] via-transparent to-gold-600/[0.03] pointer-events-none" />
        <div className="container mx-auto px-6 relative">
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto text-center"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.4 }}
          >
            {[
              { value: '6', label: 'Deduction Categories' },
              { value: '100%', label: 'Ephemeral — No Storage' },
              { value: '0–100', label: 'Composite Confidence' },
              { value: 'Free', label: 'No Account Needed' },
            ].map((s) => (
              <motion.div key={s.label} variants={staggerItem} className="group">
                <div className="text-4xl sm:text-5xl font-mono font-bold text-gradient mb-2 tabular-nums tracking-tight">{s.value}</div>
                <div className="text-xs font-medium text-slate-500 tracking-widest uppercase">{s.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="py-16 md:py-24 lg:py-28 bg-ink-900 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[700px] h-[350px] rounded-full bg-accent/[0.06] blur-[140px]" />
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <AnimatedSection variant="scale">
            <div className="max-w-4xl mx-auto border-gradient rounded-2xl sm:rounded-3xl p-6 sm:p-10 lg:p-14 text-center relative overflow-hidden">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-ink-700/60 via-transparent to-transparent pointer-events-none" />
              <div className="relative">
                <AnimatedSection variant="blur-up" delay={0.1}>
                  <p className="text-sm font-mono font-bold text-accent-light tracking-widest uppercase mb-4">Get Started</p>
                  <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 sm:mb-5">
                    Ready to Find Your Deductions?
                  </h2>
                  <p className="text-base sm:text-lg text-slate-400 mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed">
                    Upload your bank statement and get an ATO grounded deduction report in under a minute
                  </p>
                </AnimatedSection>
                <AnimatedSection variant="fade-up" delay={0.25} className="flex flex-col items-center">
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => navigate('/upload')}
                    className="group"
                  >
                    Find My Deductions
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </Button>
                  <p className="mt-6 text-sm text-slate-500">
                    No account · No storage · No surprises
                  </p>
                </AnimatedSection>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

    </div>
  )
}
