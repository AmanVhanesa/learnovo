import React, { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Cropper from 'react-easy-crop'
import { X, ZoomIn, ZoomOut, AlertTriangle, Loader } from 'lucide-react'

/**
 * Extracts the cropped area from a source image using canvas.
 * Returns a PNG blob at full resolution (no scaling).
 */
function getCroppedBlob(imageSrc, pixelCrop) {
  return new Promise((resolve, reject) => {
    const image = new window.Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = pixelCrop.width
      canvas.height = pixelCrop.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
      )
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Canvas crop failed'))
          resolve(blob)
        },
        'image/png',
        1
      )
    }
    image.onerror = () => reject(new Error('Failed to load image'))
    image.src = imageSrc
  })
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
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [sizeWarning, setSizeWarning] = useState(null)

  const effectiveMinHeight = minHeight || Math.round(minWidth / aspectRatio)

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
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels)
      if (blob.size > 2 * 1024 * 1024) {
        setSizeWarning('Cropped image exceeds 2MB. Try zooming in less or using a smaller source image.')
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
            aspect={aspectRatio}
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
