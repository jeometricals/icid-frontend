import { useId, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

/**
 * A titled panel that folds: a header button with a chevron (aria-expanded, aria-controls) and, when open, its children.
 * Open when it mounts unless defaultOpen is false; nothing remembers a fold. aside sits at the header's right, outside
 * the button. Used for the Pedramp dialog's sections and a task order's sites by kind.
 * Props: title, defaultOpen (true), aside, className (the outer element's), headingClassName, children.
 */
export default function FoldingPanel({
  title, defaultOpen = true, aside, className = '', headingClassName = 'text-sm font-semibold text-gray-900', children,
}) {
  const [open, setOpen] = useState(defaultOpen)
  const bodyId = useId()
  const Chevron = open ? ChevronDown : ChevronRight

  return (
    <section aria-label={typeof title === 'string' ? title : undefined} className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className={headingClassName}>
          <button
            type="button"
            onClick={() => setOpen(current => !current)}
            aria-expanded={open}
            aria-controls={bodyId}
            className="inline-flex items-center gap-2 hover:text-construction-700"
          >
            <Chevron className="h-4 w-4" aria-hidden="true" />
            <span>{title}</span>
          </button>
        </h3>
        {aside}
      </div>
      {open && <div id={bodyId}>{children}</div>}
    </section>
  )
}
