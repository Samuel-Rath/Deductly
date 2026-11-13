/**
 * Single place to register GSAP plugins so every component shares one setup.
 * All plugins ship free inside the `gsap` package.
 */
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP)

/** Media queries shared by every gsap.matchMedia() block. */
export const MQ = {
  motion: '(prefers-reduced-motion: no-preference)',
  desktop: '(min-width: 1024px)',
  fine: '(pointer: fine)',
} as const

export type MQConditions = { motion?: boolean; desktop?: boolean; fine?: boolean }

export { gsap, ScrollTrigger, SplitText, useGSAP }
