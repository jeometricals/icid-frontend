/**
 * A link-styled toggle that opens or closes a part of a report page, and stays usable on a read-only report: the page's
 * disabled fieldset disables its buttons, but not this (a span with the button role, worked by click, Enter or Space).
 * Props: expanded, onToggle(), children (the label).
 */
export default function DisclosureToggle({ expanded, onToggle, children }) {
  return (
    <span
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      className="cursor-pointer whitespace-nowrap text-construction-700 underline"
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggle()
        }
      }}
    >
      {children}
    </span>
  )
}
