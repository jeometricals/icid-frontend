import { useCallback, useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { Eye, FileImage, FileText, Paperclip, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  deleteAttachment,
  getDownloadUrl as getAttachmentDownloadUrl,
  listAttachments,
  StorageUnavailableError,
} from '../services/attachments'
import AttachmentUploadModal from './AttachmentUploadModal'
import AttachmentEditModal from './AttachmentEditModal'
import AttachmentViewModal from './AttachmentViewModal'
import ConfirmDialog from './ConfirmDialog'
import SubmittedBanner from './SubmittedBanner'

// Types every browser can draw in an <img>; HEIC/HEIF and PDF get an icon and open in a new tab instead
const PREVIEWABLE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const isPreviewable = (attachment) => PREVIEWABLE_TYPES.includes(attachment.file_type)

const STORAGE_UNAVAILABLE = 'Storage temporarily unavailable, try again.'

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// One attachment row: preview (image thumbnail, or an icon), details, and View / Edit / Delete buttons
function AttachmentCard({ attachment, thumbnailUrl, readOnly, onThumbnailError, onView, onEdit, onDelete }) {
  const showThumbnail = isPreviewable(attachment) && thumbnailUrl && thumbnailUrl !== 'failed'
  const Icon = attachment.file_type === 'application/pdf' ? FileText : FileImage

  return (
    <li className="flex flex-col sm:flex-row sm:items-center gap-4 py-4">
      <div className="h-16 w-16 flex-shrink-0 rounded-lg overflow-hidden bg-construction-100 flex items-center justify-center">
        {showThumbnail ? (
          <img
            src={thumbnailUrl}
            alt={attachment.attachment_name}
            onError={() => onThumbnailError(attachment.attachment_id)}
            className="h-full w-full object-cover"
          />
        ) : (
          <span title={thumbnailUrl === 'failed' ? 'Preview unavailable' : undefined}>
            <Icon className="h-8 w-8 text-construction-700" />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-gray-900 truncate">{attachment.attachment_name}</p>
        <p className="text-sm text-gray-600 line-clamp-2">{attachment.attachment_description}</p>
        <p className="text-xs text-gray-500 mt-1">
          {attachment.file_name} · {formatFileSize(attachment.file_size_bytes)} ·{' '}
          {format(new Date(attachment.uploaded_at), 'MMM d, yyyy HH:mm')}
        </p>
      </div>
      <div className="flex items-center space-x-2">
        <button type="button" onClick={onView} className="btn-secondary flex items-center space-x-1">
          <Eye className="h-4 w-4" />
          <span>View</span>
        </button>
        {!readOnly && (
          <>
            <button type="button" onClick={onEdit} className="btn-secondary flex items-center space-x-1">
              <Pencil className="h-4 w-4" />
              <span>Edit</span>
            </button>
            <button type="button" onClick={onDelete} className="btn-secondary flex items-center space-x-1 text-red-700">
              <Trash2 className="h-4 w-4" />
              <span>Delete</span>
            </button>
          </>
        )}
      </div>
    </li>
  )
}

/**
 * The Attachments card for one report: lists its files with thumbnails and lets the user view them; on a draft IDR
 * also upload, edit and delete them. Images open in a viewer, PDFs and HEIC in a new tab.
 * Props: idrId, reportId, isSubmitted (IDR is locked: view only, with a note), className (added to the card).
 */
export default function AttachmentsSection({ idrId, reportId, isSubmitted, className = '' }) {
  const [loadStatus, setLoadStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [loadError, setLoadError] = useState(null)
  const [loadAttempt, setLoadAttempt] = useState(0) // bump to retry
  const [attachments, setAttachments] = useState([])
  const [thumbnailUrls, setThumbnailUrls] = useState({}) // attachment_id → signed URL, or 'failed'
  const refreshedThumbnails = useRef(new Set()) // ids whose thumbnail URL was already refreshed after an image error

  const [activeAttachment, setActiveAttachment] = useState(null)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [error, setError] = useState(null) // { message, retry? } for the banner

  const loadThumbnail = useCallback((attachmentId) => {
    getAttachmentDownloadUrl(idrId, reportId, attachmentId)
      .then(({ download_url }) => setThumbnailUrls(prev => ({ ...prev, [attachmentId]: download_url })))
      .catch(() => setThumbnailUrls(prev => ({ ...prev, [attachmentId]: 'failed' })))
  }, [idrId, reportId])

  useEffect(() => {
    let cancelled = false
    setLoadStatus('loading')
    setLoadError(null)
    listAttachments(idrId, reportId)
      .then(list => {
        if (cancelled) return
        setAttachments(list)
        setLoadStatus('ready')
        list.filter(isPreviewable).forEach(a => loadThumbnail(a.attachment_id))
      })
      .catch(err => {
        if (cancelled) return
        setLoadError(err.message)
        setLoadStatus('error')
      })
    return () => { cancelled = true }
  }, [idrId, reportId, loadAttempt, loadThumbnail])

  // Signed URLs expire after about 5 minutes: fetch a new one once, then give up and show the icon
  const handleThumbnailError = (attachmentId) => {
    if (refreshedThumbnails.current.has(attachmentId)) {
      setThumbnailUrls(prev => ({ ...prev, [attachmentId]: 'failed' }))
      return
    }
    refreshedThumbnails.current.add(attachmentId)
    loadThumbnail(attachmentId)
  }

  const openInNewTab = async (attachment) => {
    setError(null)
    // Opened before the await so the popup blocker treats it as part of the click
    const tab = window.open('', '_blank')
    if (!tab) {
      setError({ message: `Your browser blocked the new tab for ${attachment.attachment_name}. Allow pop-ups for this site and try again.` })
      return
    }
    tab.opener = null
    try {
      const { download_url } = await getAttachmentDownloadUrl(idrId, reportId, attachment.attachment_id)
      tab.location.href = download_url
    } catch (err) {
      tab.close()
      setError(err instanceof StorageUnavailableError
        ? { message: STORAGE_UNAVAILABLE, retry: () => openInNewTab(attachment) }
        : { message: `Couldn't open ${attachment.attachment_name}: ${err.message}` })
    }
  }

  const handleView = (attachment) => {
    if (!isPreviewable(attachment)) return openInNewTab(attachment)
    setActiveAttachment(attachment)
    setViewModalOpen(true)
  }

  const handleEdit = (attachment) => {
    setActiveAttachment(attachment)
    setEditModalOpen(true)
  }

  const handleDelete = (attachment) => {
    setActiveAttachment(attachment)
    setDeleteError(null)
    setDeleteConfirmOpen(true)
  }

  const closeModals = () => {
    setUploadModalOpen(false)
    setEditModalOpen(false)
    setViewModalOpen(false)
    setDeleteConfirmOpen(false)
    setActiveAttachment(null)
  }

  const handleUploaded = (attachment) => {
    setAttachments(prev => [...prev, attachment])
    if (isPreviewable(attachment)) loadThumbnail(attachment.attachment_id)
    closeModals()
  }

  const handleSaved = (updated) => {
    setAttachments(prev => prev.map(a => (a.attachment_id === updated.attachment_id ? updated : a)))
    closeModals()
  }

  const confirmDelete = async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteAttachment(idrId, reportId, activeAttachment.attachment_id)
      setAttachments(prev => prev.filter(a => a.attachment_id !== activeAttachment.attachment_id))
      closeModals()
    } catch (err) {
      setDeleteError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="form-section-title mb-0">Attachments</h3>
        {!isSubmitted && loadStatus === 'ready' && (
          <button
            type="button"
            onClick={() => { setError(null); setUploadModalOpen(true) }}
            className="btn-primary flex items-center space-x-1"
          >
            <Plus className="h-4 w-4" />
            <span>Add attachment</span>
          </button>
        )}
      </div>

      {isSubmitted && (
        <div className="mb-4">
          <SubmittedBanner label="IDR submitted; attachments cannot be modified" submittedAt={null} />
        </div>
      )}

      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-4 flex items-center justify-between gap-4">
          <span>{error.message}</span>
          <div className="flex items-center space-x-2 flex-shrink-0">
            {error.retry && (
              <button type="button" onClick={error.retry} className="btn-secondary">Retry</button>
            )}
            <button type="button" onClick={() => setError(null)} className="btn-secondary">Dismiss</button>
          </div>
        </div>
      )}

      {loadStatus === 'loading' && (
        <div className="flex justify-center py-8">
          <div role="status" className="animate-spin rounded-full h-8 w-8 border-b-2 border-construction-600"></div>
        </div>
      )}

      {loadStatus === 'error' && (
        <div className="text-center py-8">
          <p role="alert" className="text-red-600 mb-4">Couldn't load attachments: {loadError}</p>
          <button type="button" onClick={() => setLoadAttempt(a => a + 1)} className="btn-secondary">Retry</button>
        </div>
      )}

      {loadStatus === 'ready' && attachments.length === 0 && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <Paperclip className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No attachments yet.</p>
          {!isSubmitted && <p className="text-sm text-gray-500 mt-1">Add photos, sketches or PDFs with “Add attachment”.</p>}
        </div>
      )}

      {loadStatus === 'ready' && attachments.length > 0 && (
        <ul className="divide-y divide-gray-200">
          {attachments.map(attachment => (
            <AttachmentCard
              key={attachment.attachment_id}
              attachment={attachment}
              thumbnailUrl={thumbnailUrls[attachment.attachment_id]}
              readOnly={isSubmitted}
              onThumbnailError={handleThumbnailError}
              onView={() => handleView(attachment)}
              onEdit={() => handleEdit(attachment)}
              onDelete={() => handleDelete(attachment)}
            />
          ))}
        </ul>
      )}

      {uploadModalOpen && (
        <AttachmentUploadModal
          idrId={idrId}
          reportId={reportId}
          onUploaded={handleUploaded}
          onClose={closeModals}
        />
      )}
      {editModalOpen && activeAttachment && (
        <AttachmentEditModal
          idrId={idrId}
          reportId={reportId}
          attachment={activeAttachment}
          onSaved={handleSaved}
          onClose={closeModals}
        />
      )}
      {viewModalOpen && activeAttachment && (
        <AttachmentViewModal
          idrId={idrId}
          reportId={reportId}
          attachment={activeAttachment}
          onClose={closeModals}
        />
      )}
      {deleteConfirmOpen && activeAttachment && (
        <ConfirmDialog
          title="Delete attachment"
          message="Delete this attachment? This cannot be undone."
          onConfirm={confirmDelete}
          onCancel={closeModals}
          busy={deleting}
          error={deleteError}
        />
      )}
    </div>
  )
}
