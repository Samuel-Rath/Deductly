import '@testing-library/jest-dom'
import { vi } from 'vitest'

// ── IntersectionObserver (used by framer-motion useInView) ──────────────────
// Must be a proper class constructor so framer-motion can call `new IntersectionObserver(cb)`
class MockIntersectionObserver {
  private callback: IntersectionObserverCallback
  root: Element | null = null
  rootMargin: string = ''
  thresholds: ReadonlyArray<number> = []

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
  }
  observe(target: Element) {
    // Immediately fire with isIntersecting: true so animations reveal
    this.callback(
      [{ isIntersecting: true, target, intersectionRatio: 1, boundingClientRect: {} as DOMRectReadOnly, intersectionRect: {} as DOMRectReadOnly, rootBounds: null, time: 0 }],
      this as unknown as IntersectionObserver
    )
  }
  unobserve = vi.fn()
  disconnect = vi.fn()
  takeRecords = (): IntersectionObserverEntry[] => []
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
})
Object.defineProperty(global, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
})

// ── ResizeObserver (used by various layout hooks) ───────────────────────────
const mockResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))
Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  configurable: true,
  value: mockResizeObserver,
})

// ── matchMedia (used by framer-motion reducedMotion checks) ─────────────────
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// ── scrollTo ────────────────────────────────────────────────────────────────
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo

// ── @paper-design/shaders-react (WebGL not supported in jsdom) ─────────────
// Stubbed out so the hero background renders as an inert <div> in tests.
vi.mock('@paper-design/shaders-react', () => ({
  MeshGradient: (props: { className?: string }) => {
    const React = require('react')
    return React.createElement('div', { 'data-testid': 'mesh-gradient', className: props.className })
  },
}))
