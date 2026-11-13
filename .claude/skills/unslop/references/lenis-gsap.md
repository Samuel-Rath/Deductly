# Lenis + GSAP reference

Sources: github.com/darkroomengineering/lenis (README, packages/react), github.com/greensock/gsap, gsap.com docs. Versions at time of writing: lenis 1.3.x, gsap 3.15.x, @gsap/react 2.1.x.

## Install

```bash
npm i gsap @gsap/react lenis
```

GSAP is 100% free including every former "bonus" plugin (SplitText, MorphSVG, ScrollSmoother…), even commercially. They all ship inside the `gsap` package.

```ts
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { useGSAP } from '@gsap/react'
gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP)
```

## Lenis wired to GSAP's ticker (one clock)

```ts
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'

const lenis = new Lenis({ autoRaf: false, anchors: true })   // lerp 0.1 default
lenis.on('scroll', ScrollTrigger.update)
const tick = (time: number) => lenis.raf(time * 1000)        // gsap time is seconds
gsap.ticker.add(tick)
gsap.ticker.lagSmoothing(0)

// cleanup
gsap.ticker.remove(tick); lenis.destroy()
```

React: either do the above in a `useEffect` in a `<SmoothScroll />` component at the app root, or use `lenis/react`:

```tsx
import { ReactLenis, useLenis, type LenisRef } from 'lenis/react'
const ref = useRef<LenisRef>(null)
useEffect(() => {
  const tick = (t: number) => ref.current?.lenis?.raf(t * 1000)
  gsap.ticker.add(tick); return () => gsap.ticker.remove(tick)
}, [])
<ReactLenis root ref={ref} options={{ autoRaf: false }} />
```

Key options (defaults): `lerp 0.1`, `duration 1.2` (ignored when lerp set), `smoothWheel true`, `syncTouch false` (leave touch native), `autoRaf false`, `anchors false`, `prevent(node)`, `respectReducedMotion true` (forces lerp 1).

Methods: `scrollTo(target, { offset, duration, easing, immediate, lock, force, onComplete })`, `stop()`, `start()`, `destroy()`, `resize()`. Props: `scroll`, `velocity`, `direction`, `progress`, `isStopped`.

Opt-outs: `data-lenis-prevent` (and `-wheel`, `-touch`) on modals, drawers, code blocks, any nested scroller.

Gotchas:
- On route change call `lenis.scrollTo(0, { immediate: true })` instead of `window.scrollTo`, or Lenis animates back from its stale target.
- Stop Lenis (`lenis.stop()`) while a modal/drawer is open and restart on close.
- Don't use CSS `scroll-behavior: smooth` alongside Lenis.

## useGSAP

(For components that use `gsap.matchMedia()` together with pinned ScrollTriggers, prefer the `useLayoutEffect` + `mm.revert()` pattern in SKILL.md; see the gotchas there.)

```tsx
const scope = useRef<HTMLDivElement>(null)
const { contextSafe } = useGSAP(() => { /* tweens, ScrollTriggers */ }, { scope, dependencies: [], revertOnUpdate: false })
const onClick = contextSafe(() => gsap.to('.x', { rotate: 180 }))   // handlers created after mount
```

Everything created in the callback (tweens, ScrollTriggers, SplitText, matchMedia) is reverted on unmount. Selector strings are scoped to `scope`. Safe under React 18 StrictMode double-mount.

## SplitText

```ts
SplitText.create(el, {
  type: 'lines,words',      // 'chars' | 'words' | 'lines' combos
  mask: 'lines',             // wraps each line in overflow:clip for reveal-from-below
  autoSplit: true,           // re-split on font load / resize; requires onSplit
  aria: 'auto',              // aria-label on parent, aria-hidden on pieces
  onSplit: (self) => gsap.from(self.lines, { yPercent: 110, stagger: 0.08, ease: 'expo.out' }),
})
```

Return the tween from `onSplit` so GSAP can time-sync it after re-splits. Wait for `document.fonts.ready` when not using `autoSplit`.

## ScrollTrigger patterns

```ts
// Pinned, scrubbed scene
gsap.timeline({ scrollTrigger: { trigger: el, start: 'top top', end: '+=150%', scrub: 0.6, pin: true } })

// One-shot reveal (fromTo: explicit end values survive ScrollTrigger refreshes)
gsap.fromTo(items, { y: 40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.1, scrollTrigger: { trigger: el, start: 'top 80%', once: true } })

// Counter
const o = { v: 0 }
gsap.to(o, { v: 951.35, duration: 1.6, ease: 'power2.out', onUpdate: () => (node.textContent = fmt(o.v)),
  scrollTrigger: { trigger: node, start: 'top 85%', once: true } })

// Progress driven by scroll
ScrollTrigger.create({ trigger: el, start: 'top center', end: 'bottom center', onUpdate: (s) => bar.style.transform = `scaleX(${s.progress})` })
```

After content height changes (fonts, images, async data) call `ScrollTrigger.refresh()`.

## Reduced motion and breakpoints

```ts
const mm = gsap.matchMedia()
mm.add({ motion: '(prefers-reduced-motion: no-preference)', desktop: '(min-width: 1024px)', fine: '(pointer: fine)' }, (ctx) => {
  const { motion, desktop, fine } = ctx.conditions!
  if (!motion) return
  // build animations; everything inside auto-reverts when a query flips
})
```

## Pointer physics

```ts
const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3' })
const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3' })
window.addEventListener('pointermove', (e) => { xTo(e.clientX); yTo(e.clientY) })
```

Use only under `(pointer: fine)`.
