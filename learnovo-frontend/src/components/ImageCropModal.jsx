import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { X, AlertTriangle, Loader } from 'lucide-react'

const DEFAULT_ASPECT_PRESETS = [
  { key: 'freestyle', label: 'Freestyle', value: undefined },
  { key: 'square', label: 'Square 1:1', value: 1 },
  { key: 'portrait', label: 'Portrait 3:4', value: 3 / 4 },
  { key: 'landscape', label: 'Landscape 4:3', value: 4 / 3 },
  { key: 'a4', label: 'A4', value: 1 / 1.414 },
]

function centerInitialCrop(mediaWidth, mediaHeight, aspect) {
  return centerCrop(
    makeAspectCrop(
      { unit: '%', width: 90 },
      aspect || mediaWidth / mediaHeight,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  )
}

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
    height,
  )
  return canvas
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas crop failed'))),
      type,
      quality,
    )
  })
}

async function getCroppedBlob(image, displayedCrop, outputFormat, maxBytes) {
  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height
  const pixelCrop = {
    x: displayedCrop.x * scaleX,
    y: displayedCrop.y * scaleY,
    width: displayedCrop.width * scaleX,
    height: displayedCrop.height * scaleY,
  }

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
  allowAspectChange,
  aspectPresets = DEFAULT_ASPECT_PRESETS,
}) => {
  const imgRef = useRef(null)
  const [crop, setCrop] = useState()
  const [completedCrop, setCompletedCrop] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [sizeWarning, setSizeWarning] = useState(null)

  const showAspectPresets = allowAspectChange ?? aspectRatio === null

  const initialPresetKey = useMemo(() => {
    if (aspectRatio === null || aspectRatio === undefined) return 'freestyle'
    const match = aspectPresets.find((p) => p.value === aspectRatio)
    return match ? match.key : 'freestyle'
  }, [aspectRatio, aspectPresets])

  const [activePresetKey, setActivePresetKey] = useState(initialPresetKey)
  const activePreset = aspectPresets.find((p) => p.key === activePresetKey) || aspectPresets[0]
  const effectiveAspect = showAspectPresets ? activePreset.value : aspectRatio

  const onImageLoad = useCallback(
    (e) => {
      const { width, height } = e.currentTarget
      setCrop(centerInitialCrop(width, height, effectiveAspect))
    },
    [effectiveAspect],
  )

  useEffect(() => {
    if (imgRef.current && imgRef.current.complete) {
      const { width, height } = imgRef.current
      if (width && height) {
        setCrop(centerInitialCrop(width, height, effectiveAspect))
      }
    }
  }, [effectiveAspect])

  useEffect(() => {
    if (!completedCrop || !imgRef.current) return
    const scaleX = imgRef.current.naturalWidth / imgRef.current.width
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height
    const naturalW = Math.round(completedCrop.width * scaleX)
    const naturalH = Math.round(completedCrop.height * scaleY)
    const effMinH = minHeight || minWidth
    if (naturalW < minWidth || naturalH < effMinH) {
      setSizeWarning(
        `Crop area is ${naturalW}x${naturalH}px. Minimum recommended: ${minWidth}x${effMinH}px. The image may appear blurry on printed documents.`,
      )
    } else {
      setSizeWarning(null)
    }
  }, [completedCrop, minWidth, minHeight])

  const handleCropAndUpload = async () => {
    if (!completedCrop || !imgRef.current) return
    setIsProcessing(true)
    try {
      const blob = await getCroppedBlob(
        imgRef.current,
        completedCrop,
        outputFormat,
        maxFileSize,
      )
      if (blob.size > maxFileSize) {
        const mb = (maxFileSize / (1024 * 1024)).toFixed(0)
        setSizeWarning(
          `Cropped image still exceeds ${mb}MB after compression. Try a smaller source image.`,
        )
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
    [onClose],
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
        <div className="relative flex-1 min-h-0 bg-gray-900 overflow-auto p-2">
          <div className="min-h-full flex items-center justify-center">
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={effectiveAspect || undefined}
              keepSelection
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Crop preview"
                onLoad={onImageLoad}
                className="max-w-full block select-none"
                draggable={false}
              />
            </ReactCrop>
          </div>
        </div>

        {/* Controls */}
        <div className="px-4 sm:px-6 py-4 border-t border-gray-100 dark:border-[#2C2C2E] flex-shrink-0 space-y-3">
          {/* Aspect ratio presets */}
          {showAspectPresets && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-gray-500 dark:text-[#8E8E93] mr-1">
                Aspect:
              </span>
              {aspectPresets.map((preset) => {
                const isActive = preset.key === activePresetKey
                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => setActivePresetKey(preset.key)}
                    className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                      isActive
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white dark:bg-[#1C1C1E] text-gray-700 dark:text-gray-300 border-gray-200 dark:border-[#2C2C2E] hover:border-teal-500'
                    }`}
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>
          )}

          <p className="text-xs text-gray-500 dark:text-[#8E8E93] text-center">
            Drag the corners or edges of the box to resize the crop. Drag inside the box to move it.
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
              disabled={isProcessing || !completedCrop?.width || !completedCrop?.height}
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
