import { useEffect, useState } from 'react'
import Modal from './Modal'
import { getDownloadUrl, StorageUnavailableError } from '../services/attachments'

/**
 * Full-size view of an image attachment, with its name and description. Fetches a fresh signed URL on open
 * (thumbnail URLs may be close to expiring) and fetches one more if the image fails to load.
 * Props: idrId, reportId, attachment (an image), onClose.
 */
export default function AttachmentViewModal({ idrId, reportId, attachment, onClose }) {
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [url, setUrl] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0) // bump to fetch a new URL
  const [refreshedAfterImageError, setRefreshedAfterImageError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setLoadError(null)
    getDownloadUrl(idrId, reportId, attachment.attachment_id)
      .then(({ download_url }) => {
        if (cancelled) return
        setUrl(download_url)
        setStatus('ready')
      })
      .catch(err => {
        if (cancelled) return
        setLoadError(err instanceof StorageUnavailableError ? 'Storage temporarily unavailable, try again.' : err.message)
        setStatus('error')
      })
    return () => { cancelled = true }
  }, [idrId, reportId, attachment.attachment_id, attempt])

  // An expired URL gets one refresh; a second failure means the image itself can't be shown
  const handleImageError = () => {
    if (refreshedAfterImageError) {
      setLoadError("This image couldn't be displayed.")
      setStatus('error')
      return
    }
    setRefreshedAfterImageError(true)
    setAttempt(a => a + 1)
  }

  const retry = () => {
    setRefreshedAfterImageError(false)
    setAttempt(a => a + 1)
  }

  return (
    <Modal title={attachment.attachment_name} onClose={onClose} size="lg">
      {status === 'loading' && (
        <div className="flex justify-center py-16">
          <div role="status" className="animate-spin rounded-full h-12 w-12 border-b-2 border-construction-600"></div>
        </div>
      )}
      {status === 'error' && (
        <div className="text-center py-12">
          <p role="alert" className="text-red-600 mb-4">{loadError}</p>
          <button type="button" onClick={retry} className="btn-secondary">Retry</button>
        </div>
      )}
      {status === 'ready' && (
        <img
          src={url}
          alt={attachment.attachment_name}
          onError={handleImageError}
          className="max-h-[65vh] w-auto mx-auto rounded"
        />
      )}
      <p className="text-gray-700 mt-4 whitespace-pre-wrap">{attachment.attachment_description}</p>
    </Modal>
  )
}
