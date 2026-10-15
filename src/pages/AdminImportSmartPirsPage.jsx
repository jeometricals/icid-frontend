/**
 * The Smart PIR import, at /admin/import-smart-pirs ("Import Smart PIRs (Admin)" in the user menu). Admins only: a
 * card with SmartPirImportForm (a PIR id and a .json file; the result in place). A tool for seeding and backups,
 * kept out of the site workflow. Anyone who isn't an admin is told so instead (the backend's import is open to
 * project members, so the gate is this page's).
 */
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { isAdmin } from '../lib/reviewRoles'
import SmartPirImportForm from '../components/SmartPirImportForm'

export const NOT_ADMIN_TEXT = 'Only an admin can import Smart PIR files.'

export default function AdminImportSmartPirsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  return (
    <div className="flex-1 bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center space-x-2 text-construction-700 hover:text-construction-800 mb-6"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="font-medium">Back to Projects</span>
        </button>

        {isAdmin(user) ? (
          <>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Import Smart PIRs (Admin)</h2>
            <section className="bg-white rounded-lg shadow-sm p-6 max-w-2xl">
              <SmartPirImportForm />
            </section>
          </>
        ) : (
          <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-600">{NOT_ADMIN_TEXT}</div>
        )}
      </main>
    </div>
  )
}
