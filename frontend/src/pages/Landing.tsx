import { useRef, MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  motion,
  useScroll, useTransform, useSpring,
  useMotionValue, useMotionTemplate,
} from 'framer-motion'
import { Button, AnimatedSection } from '../components'
import { Shield, Zap, FileText, Check, ArrowRight, Upload, Brain } from 'lucide-react'

// ─── Stagger container ────────────────────────────────────────────────────────
const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
}
const EASE: [number, number, number, number] = [0.21, 0.47, 0.32, 0.98]
const staggerItem = {
  hidden:  { opacity: 0, y: 28, filter: 'blur(6px)' },
  visible: { opacity: 1, y: 0,  filter: 'blur(0px)', transition: { duration: 0.6, ease: EASE } },
}
const staggerItemLeft = {
  hidden:  { opacity: 0, x: -32, filter: 'blur(4px)' },
  visible: { opacity: 1, x: 0,   filter: 'blur(0px)', transition: { duration: 0.55, ease: EASE } },
}

// ─── 3-D Tilt card ────────────────────────────────────────────────────────────
function TiltCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const rotateX = useTransform(my, [-0.5, 0.5], [7, -7])
  const rotateY = useTransform(mx, [-0.5, 0.5], [-7, 7])
  const glareX  = useMotionTemplate`${useTransform(mx, [-0.5,0.5],[0,100])}%`
  const glareY  = useMotionTemplate`${useTransform(my, [-0.5,0.5],[0,100])}%`

  const springRotX = useSpring(rotateX, { stiffness: 200, damping: 25 })
  const springRotY = useSpring(rotateY, { stiffness: 200, damping: 25 })

  function onMove(e: MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    mx.set((e.clientX - r.left - r.width  / 2) / r.width)
    my.set((e.clientY - r.top  - r.height / 2) / r.height)
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

  // Hero parallax — tracks the hero section scrolling out of view
  const heroRef = useRef<HTMLElement>(null)
  const { scrollYProgress: heroScroll } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  })

  // Background layers (drift down = depth behind)
  const orb1Y   = useSpring(useTransform(heroScroll, [0,1], ['0%',  '28%']), { stiffness:55, damping:22 })
  const orb2Y   = useSpring(useTransform(heroScroll, [0,1], ['0%',  '16%']), { stiffness:55, damping:22 })

  // Foreground layers (drift up = feels closer)
  const heroTextY = useSpring(useTransform(heroScroll, [0,1], ['0%', '-12%']), { stiffness:60, damping:25 })
  const cardY     = useSpring(useTransform(heroScroll, [0,1], ['0%', '-20%']), { stiffness:60, damping:25 })

  // Opacity for hero content fading as it scrolls out
  const heroOpacity = useTransform(heroScroll, [0, 0.6], [1, 0])

  return (
    <div className="pt-16 overflow-x-hidden">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section
        ref={heroRef}
        className="relative overflow-hidden bg-hero-mesh min-h-[92vh] flex items-center"
      >
        {/* Parallax glow orb 1 — very subtle depth */}
        <motion.div
          style={{ y: orb1Y }}
          className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-accent/[0.07] blur-[160px] pointer-events-none"
        />
        {/* Parallax glow orb 2 — mid background */}
        <motion.div
          style={{ y: orb2Y }}
          className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-blue-500/[0.06] blur-[130px] pointer-events-none"
        />

        {/* Hero content wrapper — fades + drifts on scroll */}
        <motion.div
          style={{ y: heroTextY, opacity: heroOpacity }}
          className="container mx-auto px-6 py-24 md:py-32 relative z-10"
        >
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 items-center">

              {/* Left: copy */}
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
              >
                {/* Badge */}
                <motion.div variants={staggerItem}>
                  <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium bg-accent/10 border border-accent/25 text-accent-light mb-8">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                    Australian Tax Deductions
                  </span>
                </motion.div>

                {/* Heading */}
                <motion.h1
                  variants={staggerItem}
                  className="text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.08] tracking-tight mb-6"
                >
                  <span className="text-white">Turn Bank Statements Into </span>
                  <span className="text-gradient-bright">Tax-Ready</span>
                  <span className="text-white"> Reports</span>
                </motion.h1>

                {/* Sub-copy */}
                <motion.p
                  variants={staggerItem}
                  className="text-lg text-slate-400 mb-10 leading-relaxed max-w-lg"
                >
                  Upload your CSV or PDF bank statement and get instant AI-powered analysis of work-related deductions — with ATO citations, confidence scores, and evidence checklists.
                </motion.p>

                {/* CTA buttons */}
                <motion.div variants={staggerItem} className="flex flex-col sm:flex-row items-start gap-3 mb-10">
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => navigate('/upload')}
                    className="w-full sm:w-auto group"
                  >
                    Analyse My Statement
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={() => navigate('/rules')}
                    className="w-full sm:w-auto"
                  >
                    View ATO Rules
                  </Button>
                </motion.div>

                {/* Trust signals */}
                <motion.div
                  variants={staggerItem}
                  className="flex flex-wrap gap-5 text-sm text-slate-500"
                >
                  {['No account needed', 'Data never stored', 'ATO-cited analysis'].map((t) => (
                    <span key={t} className="flex items-center gap-1.5">
                      <Check size={14} className="text-green-400" strokeWidth={2.5} />
                      {t}
                    </span>
                  ))}
                </motion.div>
              </motion.div>

              {/* Right: floating mock UI — parallax upward */}
              <motion.div
                style={{ y: cardY }}
                initial={{ opacity: 0, x: 32, scale: 0.97 }}
                animate={{ opacity: 1, x: 0,  scale: 1 }}
                transition={{ duration: 0.75, delay: 0.3, ease: EASE }}
                className="hidden lg:block"
              >
                <div className="relative">
                  {/* Main glass card */}
                  <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                    className="glass border border-line-700 rounded-2xl p-8 shadow-soft-lg"
                  >
                    {/* Card header */}
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center shrink-0">
                        <Upload size={18} className="text-white" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">bank_statement_jul24.pdf</div>
                        <div className="text-xs text-slate-500">Analysing 247 transactions…</div>
                      </div>
                    </div>

                    {/* Animated shimmer progress bar */}
                    <div className="h-1.5 bg-ink-700 rounded-full overflow-hidden mb-8">
                      <motion.div
                        className="h-full rounded-full bg-gradient-brand"
                        initial={{ width: '0%' }}
                        animate={{ width: '82%' }}
                        transition={{ duration: 1.8, delay: 0.8, ease: 'easeOut' }}
                      />
                    </div>

                    {/* Transaction rows */}
                    {[
                      { name: 'Officeworks',        cat: 'Home Office',         conf: 74, amount: '$89.95'  },
                      { name: 'CPA Australia',      cat: 'Professional Membership', conf: 91, amount: '$549.00' },
                      { name: 'Qantas Airways',     cat: 'Work Travel',        conf: 67, amount: '$312.40' },
                    ].map((row, i) => (
                      <motion.div
                        key={row.name}
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0  }}
                        transition={{ delay: 1.1 + i * 0.18, duration: 0.4 }}
                        className="flex items-center justify-between py-3 border-b border-line-700 last:border-0"
                      >
                        <div>
                          <div className="text-sm font-medium text-white">{row.name}</div>
                          <div className="text-xs text-slate-500">{row.cat}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-12 h-1 bg-ink-700 rounded-full overflow-hidden">
                              <motion.div
                                className="h-full rounded-full bg-gradient-to-r from-blue-700 to-blue-400"
                                initial={{ width: '0%' }}
                                animate={{ width: `${row.conf}%` }}
                                transition={{ delay: 1.3 + i * 0.18, duration: 0.5 }}
                              />
                            </div>
                            <span className="text-xs text-slate-500">{row.conf}%</span>
                          </div>
                          <span className="text-sm font-semibold text-white tabular-nums">{row.amount}</span>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>

                  {/* Floating badge — total */}
                  <motion.div
                    initial={{ opacity: 0, y: 12, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0,  scale: 1 }}
                    transition={{ delay: 2.0, duration: 0.4 }}
                    className="absolute -bottom-5 -left-5 glass border border-line-700 rounded-xl px-4 py-3 shadow-soft"
                  >
                    <div className="text-xs text-slate-500 mb-0.5">Potential deductions</div>
                    <div className="text-xl font-bold text-green-400">$1,840.50</div>
                  </motion.div>

                  {/* Floating badge — AI */}
                  <motion.div
                    initial={{ opacity: 0, y: -12, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0,   scale: 1 }}
                    transition={{ delay: 2.1, duration: 0.4 }}
                    className="absolute -top-5 -right-5 glass border border-line-700 rounded-xl px-4 py-3 shadow-soft flex items-center gap-2"
                  >
                    <Brain size={16} className="text-accent-light" />
                    <span className="text-sm font-semibold text-white">AI-Powered</span>
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
          <span className="text-xs text-slate-600 tracking-widest uppercase">Scroll</span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            className="w-4 h-6 rounded-full border border-slate-700 flex items-start justify-center pt-1"
          >
            <div className="w-0.5 h-1.5 rounded-full bg-slate-600" />
          </motion.div>
        </motion.div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section className="py-28 bg-ink-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-900/[0.04] via-transparent to-transparent pointer-events-none" />

        <div className="container mx-auto px-6 relative">
          <AnimatedSection variant="blur-up" className="text-center mb-16">
            <p className="text-sm font-semibold text-accent-light tracking-widest uppercase mb-3">Why Deductly</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Everything You Need for Tax Time
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              ATO-grounded AI built for all Australian workers
            </p>
          </AnimatedSection>

          {/* Feature grid — each card tilts on hover */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto">
            {[
              {
                icon: <Shield size={22} />,
                title: 'Privacy First',
                body: 'Data is processed in memory and discarded the moment your report is generated. Nothing is ever stored.',
                delay: 0,
              },
              {
                icon: <Brain size={22} />,
                title: 'AI-Grounded',
                body: 'Claude AI cross-references transactions against the ATO knowledge base with occupation-specific rules across all major deduction categories.',
                delay: 0.1,
              },
              {
                icon: <Zap size={22} />,
                title: 'Confidence Scores',
                body: 'Composite 0–100% scoring — keyword matching, RAG grounding, and AI reasoning — fully transparent.',
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
                  <div className="h-full glass border border-line-700 hover:border-accent/40 hover:shadow-glow rounded-xl p-6 transition-all duration-300 group">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-700/20 to-blue-500/10 border border-line-600 flex items-center justify-center mb-5 text-accent-light group-hover:scale-110 transition-transform duration-300">
                      {f.icon}
                    </div>
                    <h3 className="text-base font-semibold text-white mb-2">{f.title}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">{f.body}</p>
                  </div>
                </TiltCard>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────────────────── */}
      <section className="py-28 bg-ink-950 relative overflow-hidden">
        {/* Background parallax orb */}
        <ParallaxOrb className="absolute top-1/2 left-0 -translate-y-1/2 w-[500px] h-[500px] bg-accent/[0.05] blur-[160px]" speed={0.15} />

        <div className="container mx-auto px-6 relative z-10">
          <AnimatedSection variant="blur-up" className="text-center mb-16">
            <p className="text-sm font-semibold text-accent-light tracking-widest uppercase mb-3">Process</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              How It Works
            </h2>
            <p className="text-lg text-slate-400 max-w-xl mx-auto">
              Three steps from statement to deduction report
            </p>
          </AnimatedSection>

          {/* Steps — slide in from left with stagger */}
          <motion.div
            className="max-w-3xl mx-auto space-y-4"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
          >
            {[
              {
                n: '01',
                title: 'Upload Your Statement',
                body: 'Drop in a CSV or PDF from any major Australian bank. We auto-detect the format, income year, and bank layout.',
              },
              {
                n: '02',
                title: 'AI Analyses Transactions',
                body: 'Transactions are matched against ATO knowledge base entries and scored by AI. PII is redacted before any external call.',
              },
              {
                n: '03',
                title: 'Download Your Report',
                body: 'Get a full deduction report with ATO citations, evidence checklists, and occupation-dependent flags — ready for your tax agent.',
              },
            ].map((step) => (
              <motion.div
                key={step.n}
                variants={staggerItemLeft}
                className="glass border border-line-700 hover:border-line-600 rounded-2xl p-7 flex items-start gap-6 transition-colors duration-200 group"
              >
                {/* Animated number badge */}
                <motion.div
                  whileHover={{ scale: 1.08, rotate: -3 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  className="shrink-0 w-12 h-12 rounded-xl bg-gradient-brand flex items-center justify-center text-white text-sm font-bold shadow-soft"
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
      <section className="py-16 bg-ink-900 border-y border-line-700 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/[0.03] via-transparent to-blue-900/[0.03] pointer-events-none" />
        <div className="container mx-auto px-6 relative">
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto text-center"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.4 }}
          >
            {[
              { value: '6',    label: 'Deduction Categories'   },
              { value: '100%', label: 'Ephemeral — No Storage' },
              { value: '0–100', label: 'Composite Confidence'  },
              { value: 'Free', label: 'No Account Needed'      },
            ].map((s) => (
              <motion.div key={s.label} variants={staggerItem}>
                <div className="text-3xl font-bold text-gradient mb-1">{s.value}</div>
                <div className="text-sm text-slate-500">{s.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="py-28 bg-ink-900 relative overflow-hidden">
        <ParallaxOrb
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          speed={0.1}
          inner
        >
          <div className="w-[700px] h-[350px] rounded-full bg-accent/[0.06] blur-[140px]" />
        </ParallaxOrb>

        <div className="container mx-auto px-6 relative z-10">
          <AnimatedSection variant="scale">
            <div className="max-w-4xl mx-auto border-gradient rounded-3xl p-14 text-center relative overflow-hidden">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-ink-700/60 via-transparent to-transparent pointer-events-none" />
              <div className="relative">
                <AnimatedSection variant="blur-up" delay={0.1}>
                  <p className="text-sm font-semibold text-accent-light tracking-widest uppercase mb-4">Get Started</p>
                  <h2 className="text-4xl md:text-5xl font-bold text-white mb-5">
                    Ready to Find Your Deductions?
                  </h2>
                  <p className="text-lg text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
                    Upload your bank statement and get an ATO-grounded deduction report in under a minute
                  </p>
                </AnimatedSection>
                <AnimatedSection variant="fade-up" delay={0.25}>
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => navigate('/upload')}
                    className="group mx-auto"
                  >
                    Start Analysing Now
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

// ─── Parallax background orb (self-contained, no hydration issues) ────────────
function ParallaxOrb({
  className = '',
  speed = 0.2,
  children,
  inner = false,
}: {
  className?: string
  speed?: number
  children?: React.ReactNode
  inner?: boolean
}) {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref as React.RefObject<HTMLElement>,
    offset: ['start end', 'end start'],
  })
  const raw = useTransform(scrollYProgress, [0, 1], ['0%', `${Math.round(speed * 100)}%`])
  const y   = useSpring(raw, { stiffness: 50, damping: 20 })

  return (
    <motion.div ref={ref as any} style={{ y }} className={className}>
      {inner ? children : <div className="w-full h-full" />}
    </motion.div>
  )
}
