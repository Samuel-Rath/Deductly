# Logic audit checklist

Go through each item against the actual code, not the copy. Report every finding as `file:line — what is wrong — what it causes`, fix it, and add or update a test when the fix is in logic (not copy).

## Claims vs. reality
- Marketing copy says "AI", "no data stored", "instant", "N categories", "supports banks X/Y/Z": grep the backend/config to confirm each one. Count categories from the rules file, not the copy.
- Two sections describing the same mechanism differently (e.g. "AI-powered" in the hero, "rules engine" in How It Works).
- Mock/demo numbers inside illustrations: do the line items sum to the total shown? Do percentages match bar widths?

## Data and derived numbers
- Summary counts derived from the wrong source (e.g. counting confidence buckets instead of the lists actually rendered, or bucket thresholds that ignore the user's chosen threshold).
- "Total" figures that silently omit a group (excluded rows, refunds, negative amounts).
- Percentage bars whose denominator is a different set than the numerator (clamping to 100% hides this).
- Dates: `new Date('YYYY-MM-DD')` parses as UTC and shows the previous day west of Greenwich. Parse date-only strings as local.
- Currency formatting with the wrong locale, or `amount` that might be negative.

## Async and error handling
- Retry wrappers whose `shouldRetry` checks a type that is only created *after* the wrapper (e.g. checking `instanceof APIError` while the raw `AxiosError` is what reaches it). Result: retries never run.
- Error normalisers that re-wrap already-normalised errors and lose the status code.
- Retrying non-idempotent POSTs or timeouts that will just time out again.
- Progress UIs that can reach 100% before the request resolves, or never restart after a retry.
- Timers/intervals not cleared on unmount, on error, and on success.

## Interaction
- `hover:` / `:focus` styles on elements with `pointer-events: none`.
- `dragleave` firing when crossing child elements (flicker); check `relatedTarget`.
- `<input type="file">` not reset, so re-selecting the same file after an error does nothing.
- `aria-labelledby` / `aria-controls` pointing at ids that don't exist.
- Animated values set on the same property by two systems (e.g. framer `animate` and a scroll-linked `style` motion value on `opacity`). Only one wins.
- Hooks called inside JSX expressions or conditionals.
- Scroll restoration with smooth scroll libraries: `window.scrollTo(0,0)` fights Lenis.

## Tailwind/CSS
- Opacity modifiers not in the scale (`/08` instead of `/[0.08]`) silently generate no class.
- Classes built by string concatenation that the JIT can't see.
