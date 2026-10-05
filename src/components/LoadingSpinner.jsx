/**
 * A full-page loading spinner with a caption, shown while the app works out who is signed in.
 * Props: label (default 'Loading...').
 */
export default function LoadingSpinner({ label = 'Loading...' }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div role="status" className="animate-spin rounded-full h-12 w-12 border-b-2 border-construction-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">{label}</p>
      </div>
    </div>
  )
}
