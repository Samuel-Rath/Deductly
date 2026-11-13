---
name: unslop
description: Strip the generic "AI-generated" look out of a website and rebuild its hero and scroll experience with Lenis smooth scroll and GSAP (ScrollTrigger, SplitText, useGSAP), then audit the page for logical errors (copy that contradicts the code, numbers that don't add up, dead interactions, broken retry or state logic). Use when the user says "unslop", "make it not look AI-generated", "revamp the hero", "make the landing page mind-blowing", "add smooth scrolling", "use GSAP / Lenis", "scroll animations", or "fix logical errors on the site".
---

# unslop

Two jobs, always done together:

1. **De-slop the motion and layout** – replace stock fade-up-everything animation with a small number of deliberate, scroll-linked moments built on **Lenis** (smooth scroll) and **GSAP** (timelines, ScrollTrigger, SplitText).
2. **Audit for logic errors** – a page that animates beautifully but lies about its numbers is still slop.

Read `references/lenis-gsap.md` before writing motion code and `references/logic-audit.md` before the audit.

## Workflow

1. **Map the site.** Find the router, the landing page, the shared layout, and any existing motion library (framer-motion, AOS, CSS keyframes). Note the design tokens (fonts, colours) and keep them. Unslop changes how things move and read, not the brand.
2. **Audit first** (see `references/logic-audit.md`). Fix real bugs before polishing. List each fix with file:line.
3. **Install** `gsap @gsap/react lenis`. All GSAP plugins (ScrollTrigger, SplitText, etc.) ship free in the `gsap` package.
4. **Wire Lenis once, at the app root**, driven by the GSAP ticker so ScrollTrigger and Lenis share one clock. Never run two RAF loops.
5. **Rebuild the hero** as one choreographed GSAP timeline plus one pinned/scrubbed scroll scene. See "Hero recipe".
6. **Leave the rest calm.** Pick at most 2–3 more scroll moments (a counter, a horizontal reveal, a progress line). Everything else gets a plain reveal or nothing.
7. **Respect reduced motion** with `gsap.matchMedia()`. Lenis already disables smoothing when `prefers-reduced-motion: reduce`.
8. **Verify**: type-check, run the unit tests (mock GSAP/Lenis in jsdom if needed), and look at the page in a browser at desktop and 375px widths.

## Slop tells to remove

- Every section fading up with blur at the same duration and ease.
- Infinite floating/bobbing cards, pulsing dots, "Scroll" mouse icons that bounce forever.
- Gradient text on every heading; glow shadows on every card.
- Hover effects that never fire (e.g. `hover:` on a `pointer-events-none` element).
- Tilt cards with no purpose; three stacked radial "orbs".
- Animating `filter: blur()` on large elements (janky) or `width` (layout thrash). Animate `transform` and `opacity`, or `clip-path`.
- Fake precision: invented stats, mock numbers that don't sum, claims the product doesn't make.

## What good looks like

- **One idea per moment.** The hero says the product's promise and *demonstrates* it (e.g. numbers resolving, a statement being sorted, a word swapping in).
- **Typographic motion** with SplitText and line masks: lines rise out of a mask, staggered 0.06–0.1s, `expo.out` / `power4.out`, 0.9–1.2s.
- **Scroll that means something.** Scrub progress to a real narrative (input → processing → result), pin for no more than ~1.5 viewport heights, and never hijack scroll on mobile.
- **Physical pointer response** with `gsap.quickTo` for cursor-follow or magnetic buttons, on fine pointers only.
- **Fast first paint.** The hero headline is visible in HTML before JS runs (`autoAlpha` from-tweens only after fonts load, or hide with a `.js-ready` class) so there is no flash of empty hero.

## Hero recipe (React)

Render the **finished** state in markup (so no-JS, reduced motion and tests see a complete hero), then let GSAP rewind and replay it.

```tsx
const root = useRef<HTMLElement>(null)
useLayoutEffect(() => {
  const q = gsap.utils.selector(root)
  const mm = gsap.matchMedia()                       // one per mount, reverted below
  mm.add({ motion: '(prefers-reduced-motion: no-preference)', desktop: '(min-width: 1024px)' }, (ctx) => {
    const { motion, desktop } = ctx.conditions as { motion: boolean; desktop: boolean }
    if (!motion) return                              // static, fully visible hero
    const split = SplitText.create(q('[data-hero-title]'), { type: 'lines', mask: 'lines',
      onSplit: (s) => gsap.fromTo(s.lines, { yPercent: 110 }, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08 }) })
    gsap.timeline({ defaults: { ease: 'power3.out' } })
      .fromTo(q('[data-hero-sub]'), { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8 }, 0.35)
    if (desktop) {
      const scene = gsap.timeline().fromTo(q('[data-step]'), { autoAlpha: 0 }, { autoAlpha: 1, stagger: 1 })
      ScrollTrigger.create({ animation: scene, trigger: root.current, start: 'top top', end: '+=150%', scrub: 0.8, pin: true })
    }
    return () => split.revert()
  })
  return () => mm.revert()
}, [])
```

## Hard-won gotchas (verified in a real build)

- **Use `fromTo()` with explicit end values, never `from()`, on any page that has a pinned ScrollTrigger.** Creating a pin triggers ScrollTrigger refreshes. Afterwards, `from()` tweens re-read their end values from the DOM while it is already hidden, so elements animate from hidden to hidden and stay invisible.
- GSAP drops a property whose start and end are equal, so `fromTo(el, {autoAlpha: 1}, {autoAlpha: 1})` will *not* un-hide an element that has a `visibility: hidden` class. Use `gsap.set()` for starting states.
- Don't use `invalidateOnRefresh` on a timeline that relies on from-states; it throws them away.
- To count up a number in a scrubbed timeline, use one proxy object per step with a plain `to()` (`{v: prev} → {v: next}`). Chained `fromTo`s on a shared proxy render their start values early.
- Under React StrictMode, create `gsap.matchMedia()` in a plain `useLayoutEffect` and return `() => mm.revert()`.
- Lenis + modals: pause Lenis while `body` has `overflow: hidden` (a `MutationObserver` on `body[style]` is enough), or the page scrolls behind the dialog.
- An element with `backdrop-filter` (e.g. a blurred sticky nav) becomes the containing block for `position: fixed` children, so a full-screen menu inside it set to `bottom: 0` collapses to the nav's height. Give it an explicit height (`h-[calc(100dvh-64px)]`).
- After changing `tailwind.config.js` (new colour tokens), restart the dev server. Otherwise the new classes silently generate nothing and buttons can render invisible.
- Headless/hidden browsers pause `requestAnimationFrame`, so GSAP never ticks. To verify there, drive it yourself with `setInterval(() => gsap.ticker.tick(), 16)`, and emulate motion by overriding `window.matchMedia` before a client-side remount.

## Testing notes

- jsdom has no layout, so ScrollTrigger/SplitText do nothing useful there. Either `vi.mock('gsap')` style stubs in the test setup, or make sure the hero renders its final, fully visible state when `matchMedia` reports no match (which the test setup mock usually does).
- Keep text in the DOM as real text (SplitText `aria: 'auto'` keeps an `aria-label`) so `getByText` and screen readers still work.
