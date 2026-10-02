import { apiFetch } from './apiClient'

/**
 * Exports an IDR as an .xlsx file and starts its download. The backend builds the file, stores it and returns a
 * short-lived download URL; the browser then fetches the file from Storage, so the download itself needs no API call.
 * Returns the file name. Throws apiFetch's error on failure (error.status is 404 when the IDR no longer exists).
 */
export async function generateExport(idrId) {
  const { download_url: downloadUrl, filename } = await apiFetch(`/v1/idrs/${idrId}/export`)
  downloadFile(downloadUrl, filename)
  return filename
}

/**
 * Starts a browser download of a URL through a temporary link. Browsers ignore a link's download name for a
 * cross-origin URL like Storage's; the signed URL asks Storage to send the name in Content-Disposition instead.
 * Takes the URL and the file name to save as.
 */
export function downloadFile(url, filename) {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
