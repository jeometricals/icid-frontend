import { forwardRef } from 'react'
import { rotatedSize } from '../../lib/pageGeometry'

/**
 * One PIR page's image, turned by its rotation. The outer box takes the rotated page's proportions (width and
 * height swapped at 90 / 270), as wide as the column allows but never past the page's own size. Inside it, a box
 * of the page's native proportions is centred and turned with `transform: rotate(<deg>deg)`; the image fills it, and
 * so does whatever is passed as children (the sketch overlay, drawn in native page pixels), so both turn together.
 * Props: page (width_px, height_px, rotation_deg, image_url, page_number), onImageError, children; the ref is the
 * outer box (its on-screen rectangle is what pointer positions are measured against).
 */
const RotatedPage = forwardRef(function RotatedPage({ page, onImageError, children }, ref) {
  const { width, height } = rotatedSize(page)
  const rotation = page.rotation_deg ?? 0
  return (
    <div
      ref={ref}
      data-testid="rotated-page"
      data-width={width}
      data-height={height}
      className="relative w-full overflow-hidden border border-gray-200 bg-white mx-auto"
      style={{ maxWidth: `${width}px`, aspectRatio: `${width} / ${height}` }}
    >
      <div
        data-testid="page-box"
        className="absolute left-1/2 top-1/2"
        style={{
          width: `${(page.width_px / width) * 100}%`,
          height: `${(page.height_px / height) * 100}%`,
          transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        }}
      >
        <img
          src={page.image_url}
          alt={`PIR page ${page.page_number}`}
          onError={onImageError}
          draggable={false}
          className="block w-full h-full select-none"
        />
        {children}
      </div>
    </div>
  )
})

export default RotatedPage
