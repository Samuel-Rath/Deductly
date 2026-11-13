import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { gsap, ScrollTrigger } from '../motion/gsap'

/**
 * Lenis smooth scrolling, driven by GSAP's ticker so Lenis and ScrollTrigger
 * share one animation clock. Also owns scroll-to-top on route change (a plain
 * window.scrollTo would be undone by Lenis animating back to its old target).
 *
 * Lenis already falls back to native scrolling for prefers-reduced-motion.
 */
export default function SmoothScroll() {
  const lenisRef = useRef<Lenis | null>(null)
  const { pathname } = useLocation()

  useEffect(() => {
    let lenis: Lenis
    try {
      lenis = new Lenis({ autoRaf: false, anchors: true })
    } catch {
      return // non-browser environment: keep native scrolling
    }
    lenisRef.current = lenis
    lenis.on('scroll', ScrollTrigger.update)
    const tick = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)

    // Drawer and Modal lock the page with `body { overflow: hidden }`. Lenis
    // scrolls the window itself, so pause it while that lock is on; native
    // scrolling then works inside the dialog and the page stays put.
    const syncLock = () => {
      if (document.body.style.overflow === 'hidden') lenis.stop()
      else lenis.start()
    }
    const observer = new MutationObserver(syncLock)
    observer.observe(document.body, { attributes: true, attributeFilter: ['style'] })

    return () => {
      observer.disconnect()
      gsap.ticker.remove(tick)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [])

  useEffect(() => {
    if (lenisRef.current) lenisRef.current.scrollTo(0, { immediate: true, force: true })
    else window.scrollTo(0, 0)
    // New route = new layout; let triggers re-measure once it has painted.
    const id = requestAnimationFrame(() => ScrollTrigger.refresh())
    return () => cancelAnimationFrame(id)
  }, [pathname])

  return null
}
