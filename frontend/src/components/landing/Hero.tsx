import { useLayoutEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { gsap, ScrollTrigger, SplitText, MQ, type MQConditions } from '../../motion/gsap'
import { Button } from '../Button'
import { LogoMark } from '../Logo'

// Demo statement shown in the hero. The deductible rows must add up to the
// total shown, so the total is derived rather than typed.
const ROWS = [
  { date: '02 JUL', merchant: 'OFFICEWORKS 0412 MELBOURNE', amount: 89.95, note: 'home office' },
  { date: '04 JUL', merchant: 'WOOLWORTHS 3311 RICHMOND', amount: 142.3, note: null },
  { date: '09 JUL', merchant: 'CPA AUSTRALIA MEMBERSHIP', amount: 549.0, note: 'professional membership' },
  { date: '11 JUL', merchant: 'NETFLIX.COM', amount: 22.99, note: null },
  { date: '15 JUL', merchant: 'QANTAS AIRWAYS SYD-MEL', amount: 312.4, note: 'work travel' },
  { date: '18 JUL', merchant: 'UBER *EATS', amount: 38.5, note: null },
] as const

const DEDUCTIBLE_TOTAL = ROWS.reduce((sum, r) => sum + (r.note ? r.amount : 0), 0)
const DEDUCTIBLE_COUNT = ROWS.filter(r => r.note).length

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })
const num = new Intl.NumberFormat('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const SPECS = ['No data stored', 'ATO Aligned', 'Instant analysis', 'Free, no account']

/**
 * Landing hero: a printed bank statement that gets marked up like an
 * accountant would, with a highlighter on claimable lines, pen through personal
 * spending, margin notes, a double-ruled total and a stamp.
 *
 * The markup renders the *finished*, marked-up statement, so no-JS, reduced
 * motion and tests see a complete hero. With motion allowed, GSAP rewinds it
 * and replays the mark-up: scrubbed by scroll on desktop (hero pinned), played
 * once on view on smaller screens.
 */
export function Hero() {
  const navigate = useNavigate()
  const root = useRef<HTMLElement>(null)

  // One gsap.matchMedia per mount, reverted on unmount.
  useLayoutEffect(() => {
    const q = gsap.utils.selector(root)
    const mm = gsap.matchMedia()

    mm.add(MQ, (ctx) => {
      const { motion, desktop, fine } = ctx.conditions as MQConditions
      if (!motion) return

      // NOTE: every tween is fromTo() with explicit end values. Creating the
      // pin triggers ScrollTrigger refreshes, after which plain from() tweens
      // re-read their end values from the already-hidden DOM.

      // ── The mark-up, rewound to a clean statement ───────────────────────
      const tally = q('[data-tally]')[0]
      const paintTally = (v: number) => { if (tally) tally.textContent = num.format(v) }

      gsap.set(q('[data-status-working]'), { autoAlpha: 1 })
      gsap.set(q('[data-status-done]'), { autoAlpha: 0 })
      gsap.set(q('[data-progress]'), { scaleX: 0 })
      gsap.set(q('[data-scan]'), { autoAlpha: 0, y: 0, yPercent: -50 })

      const sort = gsap.timeline({ defaults: { ease: 'power2.out', duration: 0.6 } })
      sort.fromTo(q('[data-scan]'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, 0)

      let running = 0
      q('[data-row]').forEach((row, i) => {
        const at = 0.3 + i
        const claimable = row.dataset.claimable === 'true'
        sort.to(q('[data-scan]'), { y: () => row.offsetTop + row.offsetHeight / 2, duration: 0.5, ease: 'power1.inOut' }, at - 0.3)
        sort.to(q('[data-progress]'), { scaleX: (i + 1) / ROWS.length, duration: 0.6 }, at)
        if (claimable) {
          const from = running
          running += ROWS[i].amount
          sort.fromTo(row.querySelector('[data-row-hl]'), { scaleX: 0 }, { scaleX: 1, duration: 0.55, ease: 'power2.inOut' }, at)
          sort.fromTo(row.querySelector('[data-row-note]'), { autoAlpha: 0, y: 4 }, { autoAlpha: 1, y: 0, duration: 0.5 }, at + 0.3)
          // One proxy per step: a plain to() doesn't render until the playhead
          // reaches it, so scrubbing either way paints the right total.
          const step = { v: from }
          sort.to(step, { v: running, duration: 0.6, onUpdate: () => paintTally(step.v) }, at)
        } else {
          sort.fromTo(row.querySelector('[data-row-text]'), { opacity: 1 }, { opacity: 0.42 }, at + 0.15)
          sort.fromTo(row.querySelector('[data-row-strike]'), { scaleX: 0 }, { scaleX: 1, duration: 0.45, ease: 'power3.inOut' }, at)
        }
      })

      const end = ROWS.length + 0.3
      sort.to(q('[data-scan]'), { autoAlpha: 0, duration: 0.3 }, end)
      sort.fromTo(q('[data-status-working]'), { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.3, immediateRender: false }, end)
      sort.fromTo(q('[data-status-done]'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, immediateRender: false }, end + 0.1)
      sort.fromTo(q('[data-total-rule]'), { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: 'power3.inOut' }, end)
      // The stamp lands: fast in, no bounce, like it was pressed.
      sort.fromTo(
        q('[data-verdict]'),
        { autoAlpha: 0, scale: 1.9, rotate: -38 },
        { autoAlpha: 1, scale: 1, rotate: -14, duration: 0.35, ease: 'power4.in' },
        end + 0.35,
      )
      sort.fromTo(q('[data-paper]'), { y: 0 }, { y: 4, duration: 0.08, yoyo: true, repeat: 1, ease: 'power1.out' }, end + 0.7)

      paintTally(0)
      sort.pause()

      if (desktop) {
        sort.fromTo(q('[data-hero-hint]'), { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.4 }, 0)
        sort.fromTo(q('[data-hero-copy]'), { yPercent: 0 }, { yPercent: -5, duration: end + 1, ease: 'none' }, 0)
        ScrollTrigger.create({
          animation: sort,
          trigger: root.current,
          start: 'top top',
          end: '+=170%',
          pin: true,
          scrub: 0.8,
        })
      } else {
        // No scroll-jacking on small screens: play once when in view.
        sort.timeScale(1.5)
        ScrollTrigger.create({
          trigger: q('[data-paper]')[0],
          start: 'top 75%',
          once: true,
          onEnter: () => { gsap.delayedCall(0.9, () => { sort.play() }) },
        })
      }

      // ── Intro ─────────────────────────────────────────────────────────────
      const splits = q('[data-hero-line]').map((el, i) =>
        SplitText.create(el, {
          type: 'lines',
          mask: 'lines',
          onSplit: (self) =>
            gsap.fromTo(self.lines, { yPercent: 108 }, {
              yPercent: 0,
              duration: 1.3,
              ease: 'expo.out',
              stagger: 0.09,
              delay: 0.12 + i * 0.16,
            }),
        }),
      )

      gsap.timeline({ defaults: { ease: 'power3.out' } })
        .fromTo(q('[data-hero-eyebrow]'), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.8 }, 0.05)
        .fromTo(q('[data-hero-sub]'), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.9 }, 0.55)
        .fromTo(q('[data-hero-cta] > *'), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.08 }, 0.7)
        .fromTo(q('[data-spec]'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8, stagger: 0.06 }, 0.9)
        .fromTo(q('[data-spec-rule]'), { scaleX: 0 }, { scaleX: 1, duration: 1.4, ease: 'expo.inOut' }, 0.4)
        .fromTo(
          q('[data-paper]'),
          { autoAlpha: 0, y: 90, rotate: -7 },
          { autoAlpha: 1, y: 0, rotate: -2, duration: 1.5, ease: 'expo.out' },
          0.3,
        )
        .fromTo(q('[data-rows]'), { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'power2.inOut' }, 0.75)

      // ── Pointer: brass light follows the cursor, CTA is magnetic ─────────
      const cleanups: Array<() => void> = []
      if (fine && root.current) {
        const section = root.current
        const glow = q('[data-glow]')[0]
        gsap.set(glow, { xPercent: -50, yPercent: -50, autoAlpha: 1 })
        const gx = gsap.quickTo(glow, 'x', { duration: 1.1, ease: 'power3' })
        const gy = gsap.quickTo(glow, 'y', { duration: 1.1, ease: 'power3' })
        const onMove = (e: PointerEvent) => {
          const r = section.getBoundingClientRect()
          gx(e.clientX - r.left)
          gy(e.clientY - r.top)
        }
        section.addEventListener('pointermove', onMove)
        cleanups.push(() => section.removeEventListener('pointermove', onMove))

        const magnet = q('[data-magnetic]')[0] as HTMLElement | undefined
        if (magnet) {
          const mx = gsap.quickTo(magnet, 'x', { duration: 0.6, ease: 'power3' })
          const my = gsap.quickTo(magnet, 'y', { duration: 0.6, ease: 'power3' })
          const onMagnet = (e: PointerEvent) => {
            const r = magnet.getBoundingClientRect()
            mx((e.clientX - (r.left + r.width / 2)) * 0.25)
            my((e.clientY - (r.top + r.height / 2)) * 0.35)
          }
          const onLeave = () => { mx(0); my(0) }
          magnet.addEventListener('pointermove', onMagnet)
          magnet.addEventListener('pointerleave', onLeave)
          cleanups.push(() => {
            magnet.removeEventListener('pointermove', onMagnet)
            magnet.removeEventListener('pointerleave', onLeave)
          })
        }
      }

      return () => {
        cleanups.forEach(fn => fn())
        splits.forEach(s => s.revert())
        if (tally) tally.textContent = num.format(DEDUCTIBLE_TOTAL)
      }
    })

    return () => mm.revert()
  }, [])

  return (
    <section
      ref={root}
      aria-labelledby="hero-title"
      className="relative overflow-hidden bg-ink-950 min-h-[100svh] pt-[64px] flex flex-col"
    >
      {/* Architectural column lines + a low brass horizon */}
      <div aria-hidden="true" className="absolute inset-0 column-lines pointer-events-none" />
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(60% 50% at 78% 55%, rgba(217,164,65,0.13), transparent 70%), radial-gradient(80% 60% at 10% 110%, rgba(217,164,65,0.06), transparent 70%)' }}
      />
      <div
        data-glow
        aria-hidden="true"
        className="invisible absolute left-0 top-0 w-[720px] h-[720px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(217,164,65,0.07), transparent 60%)' }}
      />

      <div className="relative z-10 flex-1 flex items-center">
        <div className="mx-auto w-full max-w-[1360px] px-[20px] sm:px-[32px] py-[48px] lg:py-[32px]">
          <div className="grid lg:grid-cols-12 gap-[64px] lg:gap-[32px] items-center">

            {/* ── Copy ─────────────────────────────────────────────────── */}
            <div data-hero-copy className="lg:col-span-7">
              <p
                data-hero-eyebrow
                className="flex flex-wrap items-center gap-[12px] mb-[28px] font-mono text-[11px] uppercase tracking-[0.18em] text-bone-400"
              >
                <LogoMark size={14} className="text-bone" />
                For Australian taxpayers
                <span aria-hidden="true" className="hidden sm:block h-px w-[40px] bg-bone/25" />
                <span className="hidden sm:inline text-bone-600">Bank statement analysis</span>
              </p>

              <h1
                id="hero-title"
                className="font-display font-normal text-bone leading-[0.94] tracking-[-0.032em] text-[46px] sm:text-[68px] lg:text-[80px] xl:text-[96px]"
              >
                <span data-hero-line className="block">Find every tax deduction</span>{' '}
                <span data-hero-line className="block italic text-brass pr-[0.05em]">you're missing.</span>
              </h1>

              <p data-hero-sub className="mt-[28px] max-w-[46ch] text-[17px] leading-[1.6] text-bone-400">
                Upload a CSV or PDF bank statement. Every transaction is checked against ATO rules
                and comes back with a citation, a confidence score and the evidence your tax agent will ask for.
              </p>

              <div data-hero-cta className="mt-[40px] flex flex-wrap items-center gap-x-[20px] gap-y-[16px]">
                <span data-magnetic className="inline-block">
                  <Button variant="primary" size="lg" withArrow onClick={() => navigate('/upload')}>
                    Find My Deductions
                  </Button>
                </span>
                <a
                  href="#how"
                  className="inline-flex items-center gap-[10px] h-[56px] px-[8px] text-[15px] text-bone-400 hover:text-bone transition-colors duration-300"
                >
                  <span aria-hidden="true" className="font-mono text-[11px] text-bone-600">↓</span>
                  How it works
                </a>
              </div>
            </div>

            {/* ── The statement ────────────────────────────────────────── */}
            <div className="lg:col-span-5 relative flex justify-center lg:justify-end pb-[40px] lg:pb-0">
              <div
                data-paper
                className="paper relative w-full max-w-[440px] rounded-[3px] px-[22px] sm:px-[28px] pt-[24px] pb-[28px] shadow-[0_50px_90px_-30px_rgba(0,0,0,0.9),0_20px_40px_-20px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.7)]"
                style={{ transform: 'rotate(-2deg)' }}
                role="img"
                aria-label={`Example: a bank statement of ${ROWS.length} transactions, marked up to show ${DEDUCTIBLE_COUNT} possible deductions worth ${aud.format(DEDUCTIBLE_TOTAL)}.`}
              >
                {/* Letterhead */}
                <div className="flex items-start justify-between gap-[16px]">
                  <div>
                    <div className="font-display text-[19px] leading-none tracking-[-0.01em]">Everyday Account</div>
                    <div className="mt-[8px] whitespace-nowrap font-mono text-[9.5px] uppercase tracking-[0.14em] text-[#1A1612]/55">
                      Statement · 01–31 Jul
                    </div>
                  </div>
                  <div className="relative h-[14px] min-w-[112px] text-right font-mono text-[9.5px] uppercase tracking-[0.12em]">
                    <span data-status-working className="invisible absolute right-0 whitespace-nowrap text-[#1A1612]/55">
                      Checking {ROWS.length} lines…
                    </span>
                    <span data-status-done className="absolute right-0 whitespace-nowrap text-penink">
                      {DEDUCTIBLE_COUNT} of {ROWS.length} claimable
                    </span>
                  </div>
                </div>
                <div className="mt-[16px] h-px bg-[#1A1612]/15">
                  <div data-progress className="h-full bg-[#1A1612] origin-left" />
                </div>

                {/* Column heads */}
                <div className="mt-[14px] grid grid-cols-[46px_1fr_auto] gap-[10px] pb-[8px] border-b border-dashed border-[#1A1612]/25 font-mono text-[9px] uppercase tracking-[0.14em] text-[#1A1612]/45">
                  <span>Date</span><span>Description</span><span>Debit</span>
                </div>

                {/* Lines */}
                <div data-rows className="relative">
                  <div
                    data-scan
                    aria-hidden="true"
                    className="invisible absolute -left-[10px] -right-[10px] top-0 h-[34px] pointer-events-none border-y border-brass/50 bg-brass/[0.12]"
                  />
                  <ul>
                    {ROWS.map((row) => (
                      <li
                        key={row.merchant}
                        data-row
                        data-claimable={row.note ? 'true' : 'false'}
                        className="relative py-[9px] border-b border-dotted border-[#1A1612]/20"
                      >
                        <div
                          data-row-text
                          className="grid grid-cols-[46px_1fr_auto] gap-[10px] items-baseline"
                          style={{ opacity: row.note ? 1 : 0.42 }}
                        >
                          <span className="font-mono text-[10.5px] text-[#1A1612]/55">{row.date}</span>
                          <span className="relative min-w-0">
                            {/* inline-block so the highlighter hugs the text, not the column */}
                            <span className="relative inline-block max-w-full align-top">
                              {row.note && (
                                <span
                                  data-row-hl
                                  aria-hidden="true"
                                  className="absolute -left-[4px] -right-[5px] top-[-1px] h-[17px] origin-left rounded-[2px] bg-highlighter/85 mix-blend-multiply -skew-x-[8deg]"
                                />
                              )}
                              <span className="relative block truncate font-mono text-[11.5px] tracking-[0.01em]">{row.merchant}</span>
                            </span>
                            {row.note && (
                              <span data-row-note className="relative block mt-[3px] font-display italic text-[14px] leading-none text-penink">
                                ↳ {row.note}
                              </span>
                            )}
                          </span>
                          <span className="font-mono text-[11.5px] tabular-nums">{num.format(row.amount)}</span>
                        </div>
                        {!row.note && (
                          <span
                            data-row-strike
                            aria-hidden="true"
                            className="absolute left-[50px] right-0 top-1/2 h-[1.5px] bg-penink/80 origin-left -rotate-[0.8deg]"
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Total */}
                <div className="mt-[18px] flex items-end justify-between">
                  <span className="font-display italic text-[17px] leading-none">Total claimable</span>
                  <span className="relative font-mono text-[20px] leading-none tabular-nums pb-[6px]">
                    $<span data-tally>{num.format(DEDUCTIBLE_TOTAL)}</span>
                    <span data-total-rule aria-hidden="true" className="absolute left-0 right-0 bottom-0 h-[4px] border-y border-[#1A1612] origin-right" />
                  </span>
                </div>

                {/* Sign-off line: the stamp lands over its right-hand end */}
                <div className="mt-[30px] pr-[96px]">
                  <div className="h-px bg-[#1A1612]/30" />
                  <div className="mt-[6px] font-mono text-[9px] uppercase tracking-[0.14em] text-[#1A1612]/45">
                    Marked up for your tax agent
                  </div>
                </div>

                {/* Stamp */}
                <div
                  data-verdict
                  aria-hidden="true"
                  className="absolute -bottom-[34px] -right-[12px] sm:-right-[30px] w-[112px] h-[112px] text-penink"
                  style={{ transform: 'rotate(-14deg)' }}
                >
                  <svg viewBox="0 0 128 128" className="w-full h-full">
                    <defs>
                      <filter id="stamp-ink">
                        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" />
                        <feDisplacementMap in="SourceGraphic" scale="2.2" />
                      </filter>
                      <path id="stamp-ring" d="M64 64 m-48 0 a48 48 0 1 1 96 0 a48 48 0 1 1 -96 0" />
                    </defs>
                    <g filter="url(#stamp-ink)">
                      <circle cx="64" cy="64" r="61" fill="#EFE8DC" fillOpacity="0.9" stroke="currentColor" strokeWidth="2.5" />
                      <circle cx="64" cy="64" r="38" fill="none" stroke="currentColor" strokeWidth="1.2" />
                      <text fill="currentColor" fontFamily="IBM Plex Mono, monospace" fontSize="9.5" letterSpacing="2.6">
                        <textPath href="#stamp-ring">CLAIMABLE · CHECKED AGAINST ATO RULES ·</textPath>
                      </text>
                      <text x="64" y="66" textAnchor="middle" fill="currentColor" fontFamily="Bodoni Moda, serif" fontStyle="italic" fontSize="30">{DEDUCTIBLE_COUNT}</text>
                      <text x="64" y="81" textAnchor="middle" fill="currentColor" fontFamily="IBM Plex Mono, monospace" fontSize="7.5" letterSpacing="2">ITEMS</text>
                    </g>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Spec strip */}
      <div className="relative z-10 mx-auto w-full max-w-[1360px] px-[20px] sm:px-[32px] pb-[20px]">
        <div data-spec-rule className="rule origin-left" />
        <ul className="grid grid-cols-2 lg:grid-cols-[repeat(4,1fr)_auto] gap-y-[12px] pt-[16px]">
          {SPECS.map((s, i) => (
            <li key={s} data-spec className="flex items-baseline gap-[10px] text-[13px] text-bone-200">
              <span className="font-mono text-[10px] text-bone-600">0{i + 1}</span>
              {s}
            </li>
          ))}
          <li data-hero-hint aria-hidden="true" className="hidden lg:block font-mono text-[10px] uppercase tracking-[0.18em] text-bone-600">
            Scroll to mark up the statement
          </li>
        </ul>
      </div>
    </section>
  )
}
