import { motion, useInView, type TargetAndTransition } from 'framer-motion'
import { useRef, ReactNode } from 'react'

export type AnimationVariant =
  | 'fade-up'    // default — opacity + y rise + slight blur
  | 'fade-in'    // opacity only (no movement)
  | 'fade-left'  // slides in from the right
  | 'fade-right' // slides in from the left
  | 'scale'      // scales up from 94%
  | 'blur-up'    // rise with stronger blur (cinematic)

interface AnimatedSectionProps {
  children: ReactNode
  delay?: number
  duration?: number
  className?: string
  variant?: AnimationVariant
  /** Fraction of element visible before triggering (0–1). Default 0.15 */
  threshold?: number
}

const variants: Record<AnimationVariant, { hidden: TargetAndTransition; visible: TargetAndTransition }> = {
  'fade-up': {
    hidden:  { opacity: 0, y: 32, filter: 'blur(6px)' },
    visible: { opacity: 1, y: 0,  filter: 'blur(0px)' },
  },
  'fade-in': {
    hidden:  { opacity: 0 },
    visible: { opacity: 1 },
  },
  'fade-left': {
    hidden:  { opacity: 0, x: 40, filter: 'blur(4px)' },
    visible: { opacity: 1, x: 0,  filter: 'blur(0px)' },
  },
  'fade-right': {
    hidden:  { opacity: 0, x: -40, filter: 'blur(4px)' },
    visible: { opacity: 1, x: 0,   filter: 'blur(0px)' },
  },
  'scale': {
    hidden:  { opacity: 0, scale: 0.93, filter: 'blur(4px)' },
    visible: { opacity: 1, scale: 1,    filter: 'blur(0px)' },
  },
  'blur-up': {
    hidden:  { opacity: 0, y: 48, filter: 'blur(12px)' },
    visible: { opacity: 1, y: 0,  filter: 'blur(0px)'  },
  },
}

export default function AnimatedSection({
  children,
  delay = 0,
  duration = 0.65,
  className = '',
  variant = 'fade-up',
  threshold = 0.15,
}: AnimatedSectionProps) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, amount: threshold })
  const { hidden, visible } = variants[variant]

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={{ hidden, visible }}
      transition={{
        duration,
        delay,
        ease: [0.21, 0.47, 0.32, 0.98], // custom ease-out-quart
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
