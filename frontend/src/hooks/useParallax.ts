import { useRef } from 'react'
import { useScroll, useTransform, useSpring, MotionValue } from 'framer-motion'

/**
 * Returns a smoothed parallax Y value tied to the scroll progress of a
 * referenced element passing through the viewport.
 *
 * @param speed  Positive = element drifts downward as you scroll (background depth).
 *               Negative = element drifts upward faster than scroll (foreground depth).
 * @param smooth Spring stiffness/damping config (or false to skip spring).
 */
export function useParallax(
  speed: number = 0.3,
  smooth: { stiffness?: number; damping?: number } | false = { stiffness: 60, damping: 20 }
): { ref: React.RefObject<HTMLElement | null>; y: MotionValue<string> } {
  const ref = useRef<HTMLElement>(null)

  const { scrollYProgress } = useScroll({
    target: ref as React.RefObject<HTMLElement>,
    offset: ['start start', 'end start'],
  })

  const pct = Math.round(speed * 100)
  const raw = useTransform(scrollYProgress, [0, 1], ['0%', `${pct}%`])

  const springY = useSpring(raw, smooth || { stiffness: 300, damping: 30 })
  const y = smooth ? springY : raw

  return { ref, y }
}
