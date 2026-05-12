import React, { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Cropper from 'react-easy-crop'
import { X, ZoomIn, ZoomOut, AlertTriangle, Loader } from 'lucide-react'

/**
 * Draws the cropped region of `image` onto a canvas, optionally scaled.
 */
function drawCropToCanvas(image, pixelCrop, scale = 1) {
  const width = Math.max(1, Math.round(pixelCrop.width * scale))
  const height = Math.max(1, Math.round(pixelCrop.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    width,
    height
  )
  return canvas
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas crop failed'))),
      type,
      quality
    )
  })
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new window.Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Failed to load image'))
    image.src = src
  })
}

/**
 * Extracts the cropped area as a blob, automatically compressing JPEG output
 * (and downscaling as a last resort) to stay within `maxBytes`.
 * PNG is returned as-is at full resolution.
 */
async function getCroppedBlob(imageSrc, pixelCrop, outputFormat, maxBytes) {
  const image = await loadImage(imageSrc)

  if (outputFormat === 'image/jpeg') {
    const qualitySteps = [0.92, 0.85, 0.75, 0.65, 0.55]
    const scaleSteps = [1, 0.85, 0.7, 0.55]
    for (const scale of scaleSteps) {
      const canvas = drawCropToCanvas(image, pixelCrop, scale)
      for (const q of qualitySteps) {
        const blob = await canvasToBlob(canvas, 'image/jpeg', q)
        if (blob.size <= maxBytes) return blob
      }
    }
    // Couldn't get under the cap; return the smallest attempt.
    const canvas = drawCropToCanvas(image, pixelCrop, 0.55)
    return canvasToBlob(canvas, 'image/jpeg', 0.55)
  }

  const canvas = drawCropToCanvas(image, pixelCrop, 1)
  return canvasToBlob(canvas, 'image/png', 1)
}

const ImageCropModal = ({
  isOpen,
  onClose,
  onCropComplete,
  imageSrc,
  aspectRatio = 1,
  title = 'Crop Image',
  minWidth = 400,
  minHeight,
  outputFormat = 'image/png',
  maxFileSize = 3 * 1024 * 1024,
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [sizeWarning, setSizeWarning] = useState(null)

  // When aspectRatio is null/undefined/0, react-easy-crop allows free-form crop.
  const isFreeAspect = !aspectRatio
  const effectiveMinHeight = minHeight || (isFreeAspect ? minWidth : Math.round(minWidth / aspectRatio))

  const onCropAreaChange = useCallback(
    (_croppedArea, croppedAreaPixels) => {
      setCroppedAreaPixels(croppedAreaPixels)
      if (
        croppedAreaPixels.width < minWidth ||
        croppedAreaPixels.height < effectiveMinHeight
      ) {
        setSizeWarning(
          `Crop area is ${croppedAreaPixels.width}x${croppedAreaPixels.height}px. Minimum recommended: ${minWidth}x${effectiveMinHeight}px. The image may appear blurry on printed documents.`
        )
      } else {
        setSizeWarning(null)
      }
    },
    [minWidth, effectiveMinHeight]
  )

  const handleCropAndUpload = async () => {
    if (!croppedAreaPixels) return
    setIsProcessing(true)
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels, outputFormat, maxFileSize)
      if (blob.size > maxFileSize) {
        const mb = (maxFileSize / (1024 * 1024)).toFixed(0)
        setSizeWarning(`Cropped image still exceeds ${mb}MB after compression. Try a smaller source image.`)
        setIsProcessing(false)
        return
      }
      const previewUrl = URL.createObjectURL(blob)
      await onCropComplete(blob, previewUrl)
      onClose()
    } catch {
      setSizeWarning('Failed to process image. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  if (!isOpen || !imageSrc) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="bg-white dark:bg-[#1C1C1E] rounded-none sm:rounded-2xl shadow-2xl w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:mx-4 flex flex-col overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#2C2C2E] px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white truncate pr-2">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="btn-close flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Crop Area */}
        <div className="relative flex-1 min-h-[300px] sm:min-h-[400px] bg-gray-900">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={isFreeAspect ? undefined : aspectRatio}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropAreaChange}
            cropShape="rect"
            showGrid
          />
        </div>

        {/* Controls */}
        <div className="px-4 sm:px-6 py-4 border-t border-gray-100 dark:border-[#2C2C2E] flex-shrink-0 space-y-3">
          {/* Zoom slider */}
          <div className="flex items-center gap-3">
            <ZoomOut className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-teal-600"
            />
            <ZoomIn className="h-4 w-4 text-gray-400 flex-shrink-0" />
          </div>

          <p className="text-xs text-gray-500 dark:text-[#8E8E93] text-center">
            Drag to reposition. Use slider to zoom.
          </p>

          {/* Warning */}
          {sizeWarning && (
            <div className="flex items-start gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-600 dark:text-amber-400">{sizeWarning}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-outline"
              disabled={isProcessing}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCropAndUpload}
              disabled={isProcessing}
              className="btn btn-primary flex items-center gap-2"
            >
              {isProcessing && <Loader className="h-4 w-4 animate-spin" />}
              {isProcessing ? 'Processing...' : 'Crop & Upload'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default ImageCropModal
