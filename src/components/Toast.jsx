import { useEffect, useRef } from 'react'

/**
 * A short notice at the bottom of the screen that goes away by itself, e.g. "Someone else edited this field —
 * reloading". Props: message (nothing is rendered without one), onDone() (called when its time is up),
 * duration in ms (default 4000).
 */
export default function Toast({ message, onDone, duration = 4000 }) {
  // Read through a ref so a parent passing a new function each render doesn't restart the clock
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => done.current?.(), duration)
    return () => clearTimeout(timer)
  }, [message, duration])

  if (!message) return null
  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-md bg-gray-900 px-4 py-2 text-sm text-white shadow-lg"
    >
      {message}
    </div>
  )
}
