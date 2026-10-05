import { Building2 } from 'lucide-react'

/**
 * "Go to Project Page": the shortcut from a page deep inside a project straight to the project's page, shown beside
 * that page's Back button and styled like it. Props: onClick (the navigation, supplied by the page).
 */
export default function GoToProjectButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center space-x-2 text-construction-700 hover:text-construction-800"
    >
      <Building2 className="h-5 w-5" />
      <span className="font-medium">Go to Project Page</span>
    </button>
  )
}
