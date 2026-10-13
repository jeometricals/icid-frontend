import { useId, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { formatDollars, formatPayItemQuantity, formatPercent } from '../lib/payItemFormat'
import Bar from './Bar'

/**
 * One budget code on the Progress page: its percent of budget, a bar, "$actual of $budgeted" and how many of its
 * pay items have quantities. Past 100% the percent and the bar take the warn colour. Its name is a button that
 * folds the items with quantities open under it (closed to start).
 * Props: total ({budget_code, actual_value, budgeted_value, percent, has_unbudgeted}), items (the quantity
 * roll-up's pay_items filed under this code).
 */
export default function BudgetCodeCard({ total, items }) {
  const [open, setOpen] = useState(false)
  const listId = useId()
  const over = total.percent > 100
  const budgeted = items.filter(item => !item.unbudgeted)
  const unbudgeted = items.length - budgeted.length
  const activity = budgeted.length === 0
    ? 'No activity'
    : `${budgeted.length} ${budgeted.length === 1 ? 'item' : 'items'} with activity`
  const Chevron = open ? ChevronDown : ChevronRight

  return (
    <article aria-label={total.budget_code} className="bg-white rounded-lg shadow-sm p-4">
      <button
        type="button"
        onClick={() => setOpen(was => !was)}
        aria-expanded={open}
        aria-controls={listId}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="font-mono text-sm font-semibold text-gray-900 break-all">{total.budget_code}</span>
        <Chevron aria-hidden="true" className="h-4 w-4 shrink-0 text-gray-500" />
      </button>

      <p className={`mt-2 text-xl font-medium tabular-nums ${over ? 'text-warn' : 'text-gray-900'}`}>
        {formatPercent(total.percent)}
      </p>
      <div className="mt-2">
        <Bar percent={total.percent} tone={over ? 'warn' : 'default'} label={`${total.budget_code} progress`} />
      </div>
      <p className="mt-2 text-sm text-gray-700 tabular-nums">
        {formatDollars(total.actual_value)} of {formatDollars(total.budgeted_value)}
      </p>
      <p className="mt-1 text-xs text-gray-500">
        {activity}{unbudgeted > 0 && ` · ${unbudgeted} unbudgeted`}
      </p>

      {open && (
        <div id={listId} className="mt-3 border-t border-gray-100 pt-3">
          {items.length === 0 ? (
            <p className="text-sm text-gray-500">No items with activity.</p>
          ) : (
            <ul className="space-y-2">
              {items.map(item => (
                <li
                  key={JSON.stringify([item.pay_item_ref, item.unit, item.unbudgeted])}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <span className="min-w-0">
                    <span className="font-semibold text-gray-900">{item.pay_item_ref || '—'}</span>
                    {item.description && <span className="text-gray-600"> {item.description}</span>}
                  </span>
                  {item.unbudgeted ? (
                    <span className="shrink-0 text-gray-400">
                      {formatPayItemQuantity(item.actual_quantity)}{item.unit ? ` ${item.unit}` : ''} · unbudgeted
                    </span>
                  ) : (
                    <span className={`shrink-0 tabular-nums ${item.percent > 100 ? 'text-warn' : 'text-gray-700'}`}>
                      {formatDollars(item.actual_value)} of {formatDollars(item.budgeted_value)} · {formatPercent(item.percent)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  )
}
