import { useEffect, useState } from 'react'

/**
 * Sticky "On this page" list for long legal pages. Builds itself from the
 * page's `[data-legal-section]` elements after mount, and highlights the
 * section currently in the reading band.
 */
export function LegalToc() {
  const [items, setItems] = useState<Array<{ id: string; title: string }>>([])
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-legal-section]'))
    setItems(sections.map((s) => ({ id: s.id, title: s.querySelector('h2')?.textContent ?? '' })))
    if (typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id) }),
      { rootMargin: '-25% 0px -65% 0px' },
    )
    sections.forEach((s) => io.observe(s))
    return () => io.disconnect()
  }, [])

  if (!items.length) return null

  return (
    <nav aria-label="On this page" className="sticky top-[112px]">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-bone-600 mb-[16px]">On this page</p>
      <ol className="space-y-[2px]">
        {items.map((item, i) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={[
                'grid grid-cols-[28px_1fr] py-[6px] text-[13.5px] leading-[1.4] transition-colors duration-300',
                active === item.id ? 'text-bone' : 'text-bone-400 hover:text-bone',
              ].join(' ')}
            >
              <span className={`font-mono text-[10.5px] pt-[2px] ${active === item.id ? 'text-brass' : 'text-bone-600'}`}>
                {String(i + 1).padStart(2, '0')}
              </span>
              {item.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

export function slugify(title: string): string {
  return title.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
