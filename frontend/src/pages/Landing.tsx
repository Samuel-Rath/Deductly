import { useRef, useEffect, useLayoutEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components'
import { Hero } from '../components/landing/Hero'
import { LogoMark } from '../components/Logo'
import { gsap, SplitText, MQ, type MQConditions } from '../motion/gsap'

const FEATURES = [
  {
    title: 'Privacy First',
    body: 'Your statement is processed in memory and discarded the moment the report is generated. Nothing is stored, and no account is needed.',
    tag: 'Ephemeral',
  },
  {
    title: 'ATO Rule Engine',
    body: 'Every transaction is matched against ATO deduction rules using keyword detection, merchant recognition and recurring-pattern analysis.',
    tag: '9 categories',
  },
  {
    title: 'Confidence Scores',
    body: 'Each match gets a composite score with its reasons shown, so you can see exactly why a line was flagged and how sure the engine is.',
    tag: '0–100',
  },
  {
    title: 'Evidence Checklists',
    body: 'Every candidate lists what to keep (receipts, diary entries, logbooks) plus occupation flags and ATO method guides for your tax agent.',
    tag: 'Agent-ready',
  },
]

const STEPS = [
  {
    n: '1',
    title: 'Upload Your Statement',
    body: 'Drop in a CSV or PDF from any major Australian bank. Format, income year and bank layout are detected automatically.',
  },
  {
    n: '2',
    title: 'Rules Engine Analyses Transactions',
    body: 'Account numbers and personal identifiers are stripped, then every line is matched against ATO deduction rules and scored.',
  },
  {
    n: '3',
    title: 'Download Your Report',
    body: 'A full report with ATO citations, evidence checklists and occupation flags, ready to hand to your tax agent.',
  },
]

// `count` animates up from 0; the rendered text is always the final value.
const FIGURES = [
  { value: '9', count: 9, label: 'Deduction Categories' },
  { value: '0', label: 'Files kept after your report' },
  { value: '0–100', label: 'Composite Confidence' },
  { value: '$0', label: 'No account, no fee' },
]

function SectionLabel({ n, children, tone = 'dark' }: { n: string; children: React.ReactNode; tone?: 'dark' | 'light' }) {
  return (
    <p
      data-reveal
      className={`flex items-center gap-[12px] font-mono text-[11px] uppercase tracking-[0.18em] ${tone === 'dark' ? 'text-bone-400' : 'text-[#1A1612]/55'}`}
    >
      <span className={tone === 'dark' ? 'text-brass' : 'text-penink'}>({n})</span>
      {children}
    </p>
  )
}

export default function Landing() {
  const navigate = useNavigate()
  const root = useRef<HTMLDivElement>(null)

  // Pre-warm the backend on page load so Render's free tier isn't cold
  // when the user navigates to /upload. Fire-and-forget — errors are ignored.
  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_BASE_URL
    if (apiBase) fetch(`${apiBase}/health`, { method: 'GET' }).catch(() => {/* ignore */ })
  }, [])

  // Below-the-fold motion. Content is fully visible without JS / with reduced
  // motion; these only add entrances when motion is allowed. All fromTo(),
  // see the note in Hero about ScrollTrigger refreshes and from().
  useLayoutEffect(() => {
    const q = gsap.utils.selector(root)
    const mm = gsap.matchMedia()

    mm.add(MQ, (ctx) => {
      const { motion } = ctx.conditions as MQConditions
      if (!motion) return

      const splits = q('[data-reveal-heading]').map((el) =>
        SplitText.create(el, {
          type: 'lines',
          mask: 'lines',
          autoSplit: true,
          onSplit: (self) =>
            gsap.fromTo(self.lines, { yPercent: 108 }, {
              yPercent: 0,
              duration: 1.2,
              ease: 'expo.out',
              stagger: 0.1,
              scrollTrigger: { trigger: el, start: 'top 85%', once: true },
            }),
        }),
      )

      q('[data-reveal]').forEach((el) => {
        gsap.fromTo(el, { y: 20, autoAlpha: 0 }, {
          y: 0, autoAlpha: 1, duration: 1, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 90%', once: true },
        })
      })

      // Feature rows: the rule draws across, then the row settles in.
      q('[data-feature]').forEach((row) => {
        gsap.timeline({ scrollTrigger: { trigger: row, start: 'top 85%', once: true } })
          .fromTo(row.querySelector('[data-feature-rule]'), { scaleX: 0 }, { scaleX: 1, duration: 1.1, ease: 'expo.inOut' })
          .fromTo(row.querySelectorAll('[data-feature-part]'), { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, ease: 'power3.out', stagger: 0.07 }, 0.25)
      })

      // Process: a pen line draws across the paper as you scroll; numerals rise.
      const steps = q('[data-steps]')[0]
      gsap.fromTo(q('[data-rail-fill]'), { scaleX: 0 }, {
        scaleX: 1, ease: 'none',
        scrollTrigger: { trigger: steps, start: 'top 75%', end: 'bottom 60%', scrub: 0.6 },
      })
      q('[data-step]').forEach((step, i) => {
        gsap.timeline({ scrollTrigger: { trigger: steps, start: 'top 70%', once: true }, delay: i * 0.15 })
          .fromTo(step.querySelector('[data-step-num]'), { yPercent: 100 }, { yPercent: 0, duration: 1.2, ease: 'expo.out' })
          .fromTo(step.querySelectorAll('[data-step-part]'), { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8, ease: 'power3.out', stagger: 0.07 }, 0.3)
      })

      // Figures count up once.
      q('[data-count]').forEach((el) => {
        const target = Number(el.dataset.count)
        const final = el.textContent
        const o = { v: 0 }
        gsap.to(o, {
          v: target,
          duration: 1.6,
          ease: 'power2.out',
          onStart: () => { el.textContent = '0' },
          onUpdate: () => { el.textContent = String(Math.round(o.v)) },
          scrollTrigger: { trigger: el, start: 'top 90%', once: true },
        })
        // Restore the static text if this context reverts mid-count.
        ctx.add(() => () => { el.textContent = final })
      })

      return () => splits.forEach(s => s.revert())
    })

    return () => mm.revert()
  }, [])

  return (
    <div ref={root} className="overflow-x-clip">

      <Hero />

      {/* ── 01 · Why ─────────────────────────────────────────────────────── */}
      <section id="why" className="relative bg-ink-950 border-t border-bone/[0.08]">
        <div className="mx-auto max-w-[1360px] px-[20px] sm:px-[32px] py-[96px] lg:py-[160px] grid lg:grid-cols-12 gap-[56px] lg:gap-[32px]">
          <div className="lg:col-span-5 lg:sticky lg:top-[128px] self-start">
            <SectionLabel n="01">Why Deductly</SectionLabel>
            <h2
              data-reveal-heading
              className="mt-[24px] font-display font-normal text-bone text-[40px] sm:text-[52px] lg:text-[60px] leading-[1] tracking-[-0.03em]"
            >
              Built like an accountant. <em className="text-brass">Not a chatbot.</em>
            </h2>
            <p data-reveal className="mt-[24px] max-w-[40ch] text-[16px] leading-[1.65] text-bone-400">
              Deductly runs a readable rule set, not a language model. Every result traces back to an ATO rule you can{' '}
              <button type="button" onClick={() => navigate('/rules')} className="text-bone underline decoration-bone/30 underline-offset-4 hover:decoration-brass">
                look up yourself
              </button>.
            </p>
          </div>

          <ol className="lg:col-span-7 lg:col-start-6">
            {FEATURES.map((f, i) => (
              <li key={f.title} data-feature className="group relative py-[32px] lg:py-[40px]">
                <div data-feature-rule aria-hidden="true" className="rule absolute top-0 left-0 right-0 origin-left" />
                <div className="grid grid-cols-[48px_1fr] sm:grid-cols-[72px_1fr] gap-x-[16px] gap-y-[12px]">
                  <span data-feature-part className="font-mono text-[12px] text-brass pt-[10px]">0{i + 1}</span>
                  <div>
                    <div className="flex items-baseline justify-between gap-[16px]">
                      <h3 data-feature-part className="font-display text-[30px] sm:text-[36px] leading-[1.05] tracking-[-0.02em] text-bone transition-transform duration-500 ease-[cubic-bezier(0.2,0.7,0.2,1)] group-hover:translate-x-[6px]">
                        {f.title}
                      </h3>
                      <span data-feature-part className="hidden sm:inline font-mono text-[10px] uppercase tracking-[0.16em] text-bone-600 whitespace-nowrap">
                        {f.tag}
                      </span>
                    </div>
                    <p data-feature-part className="mt-[14px] max-w-[52ch] text-[16px] leading-[1.65] text-bone-400">{f.body}</p>
                  </div>
                </div>
              </li>
            ))}
            <li aria-hidden="true" className="rule" />
          </ol>
        </div>
      </section>

      {/* ── 02 · How (printed on paper) ──────────────────────────────────── */}
      <section id="how" className="paper relative scroll-mt-[64px]">
        <div className="mx-auto max-w-[1360px] px-[20px] sm:px-[32px] py-[96px] lg:py-[150px]">
          <div className="grid lg:grid-cols-12 gap-[24px] items-end">
            <div className="lg:col-span-7">
              <SectionLabel n="02" tone="light">Process</SectionLabel>
              <h2
                data-reveal-heading
                className="mt-[24px] font-display font-medium text-[#1A1612] text-[48px] sm:text-[64px] lg:text-[84px] leading-[0.98] tracking-[-0.035em]"
              >
                How it <em className="font-normal text-penink">works.</em>
              </h2>
            </div>
            <p data-reveal className="lg:col-span-4 lg:col-start-9 text-[16px] leading-[1.65] text-[#1A1612]/65">
              Three steps from statement to deduction report. Most statements take under a minute.
            </p>
          </div>

          <div data-steps className="relative mt-[64px] lg:mt-[96px]">
            {/* Pen line across the top of the steps */}
            <div aria-hidden="true" className="absolute top-0 left-0 right-0 h-px bg-[#1A1612]/15" />
            <div data-rail-fill aria-hidden="true" className="absolute top-0 left-0 right-0 h-[2px] -translate-y-[0.5px] bg-penink origin-left" />

            <ol className="grid md:grid-cols-3 gap-x-[32px]">
              {STEPS.map((step) => (
                <li key={step.n} data-step className="pt-[28px] pb-[24px] md:pb-0 border-b md:border-b-0 border-[#1A1612]/15">
                  <div className="overflow-hidden">
                    <div data-step-num aria-hidden="true" className="font-display italic text-[96px] lg:text-[128px] leading-[0.9] tracking-[-0.04em] text-[#1A1612]">
                      {step.n}<span className="text-penink">.</span>
                    </div>
                  </div>
                  <h3 data-step-part className="mt-[20px] text-[19px] font-semibold tracking-[-0.01em] text-[#1A1612]">{step.title}</h3>
                  <p data-step-part className="mt-[10px] max-w-[38ch] text-[15px] leading-[1.65] text-[#1A1612]/65">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ── 03 · Figures ─────────────────────────────────────────────────── */}
      <section className="relative bg-ink-950">
        <div className="mx-auto max-w-[1360px] px-[20px] sm:px-[32px] py-[80px] lg:py-[112px]">
          <SectionLabel n="03">By the numbers</SectionLabel>
          <dl className="mt-[40px] grid grid-cols-2 lg:grid-cols-4 border-t border-bone/[0.12]">
            {FIGURES.map((f, i) => (
              <div
                key={f.label}
                data-reveal
                className={[
                  'flex flex-col-reverse justify-end gap-[14px] pt-[28px] pb-[32px] pr-[16px] border-bone/[0.12]',
                  i % 2 === 1 ? 'pl-[20px] border-l' : '',
                  i === 2 ? 'lg:pl-[28px] lg:border-l border-t lg:border-t-0' : '',
                  i === 3 ? 'lg:pl-[28px] border-t lg:border-t-0' : '',
                  i === 1 ? 'lg:pl-[28px]' : '',
                ].join(' ')}
              >
                <dt className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-bone-400 max-w-[22ch]">{f.label}</dt>
                <dd
                  className="font-display text-[64px] sm:text-[80px] leading-[0.9] tracking-[-0.04em] text-bone tabular-nums"
                  {...(f.count !== undefined ? { 'data-count': f.count } : {})}
                >
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-ink-950 border-t border-bone/[0.08]">
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(50% 60% at 50% 100%, rgba(217,164,65,0.14), transparent 70%)' }}
        />
        <div className="relative mx-auto max-w-[1360px] px-[20px] sm:px-[32px] py-[112px] lg:py-[176px] text-center">
          <div data-reveal className="flex justify-center mb-[32px]">
            <LogoMark size={36} className="text-bone" />
          </div>
          <h2
            data-reveal-heading
            className="mx-auto max-w-[15ch] font-display font-normal text-bone text-[48px] sm:text-[72px] lg:text-[100px] leading-[0.95] tracking-[-0.035em]"
          >
            Your statement already knows. <em className="text-brass">Ask it.</em>
          </h2>
          <p data-reveal className="mx-auto mt-[28px] max-w-[44ch] text-[17px] leading-[1.6] text-bone-400">
            Upload your bank statement and get an ATO-grounded deduction report in under a minute.
          </p>
          <div data-reveal className="mt-[44px] flex flex-col items-center gap-[20px]">
            <Button variant="primary" size="lg" withArrow onClick={() => navigate('/upload')}>
              Find My Deductions
            </Button>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-bone-600">
              No account · No storage · No surprises
            </p>
          </div>
        </div>
      </section>

    </div>
  )
}
