import React, { useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import Cropper from 'react-easy-crop'
import { X, ZoomIn, ZoomOut, AlertTriangle, Loader } from 'lucide-react'

const DEFAULT_ASPECT_PRESETS = [
  { key: 'freestyle', label: 'Freestyle', value: null },
  { key: 'custom', label: 'Custom', value: null },
  { key: 'square', label: 'Square 1:1', value: 1 },
  { key: 'portrait', label: 'Portrait 3:4', value: 3 / 4 },
  { key: 'landscape', label: 'Landscape 4:3', value: 4 / 3 },
  { key: 'a4', label: 'A4', value: 1 / 1.414 },
]

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
  allowAspectChange,
  aspectPresets = DEFAULT_ASPECT_PRESETS,
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [sizeWarning, setSizeWarning] = useState(null)

  // Show preset selector by default when the consumer passes a null aspectRatio,
  // unless they explicitly opt out via allowAspectChange={false}.
  const showAspectPresets = allowAspectChange ?? aspectRatio === null

  const initialPresetKey = useMemo(() => {
    if (aspectRatio === null || aspectRatio === undefined) return 'freestyle'
    const match = aspectPresets.find((p) => p.value === aspectRatio)
    return match ? match.key : 'freestyle'
  }, [aspectRatio, aspectPresets])

  const [activePresetKey, setActivePresetKey] = useState(initialPresetKey)
  const [customW, setCustomW] = useState('')
  const [customH, setCustomH] = useState('')
  const activePreset = aspectPresets.find((p) => p.key === activePresetKey) || aspectPresets[0]

  const customAspect = useMemo(() => {
    const w = parseFloat(customW)
    const h = parseFloat(customH)
    if (!w || !h || w <= 0 || h <= 0) return null
    return w / h
  }, [customW, customH])

  const isCustomPreset = activePresetKey === 'custom'
  const effectiveAspect = showAspectPresets
    ? isCustomPreset
      ? customAspect
      : activePreset.value
    : aspectRatio

  const isFreeAspect = !effectiveAspect
  const effectiveMinHeight = minHeight || (isFreeAspect ? minWidth : Math.round(minWidth / effectiveAspect))

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
            aspect={isFreeAspect ? undefined : effectiveAspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropAreaChange}
            cropShape="rect"
            showGrid
          />
        </div>

        {/* Controls */}
        <div className="px-4 sm:px-6 py-4 border-t border-gray-100 dark:border-[#2C2C2E] flex-shrink-0 space-y-3">
          {/* Aspect ratio presets */}
          {showAspectPresets && (
            <div className="space-y-2">
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

              {isCustomPreset && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-gray-500 dark:text-[#8E8E93] mr-1">
                    Custom ratio:
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={customW}
                    onChange={(e) => setCustomW(e.target.value)}
                    placeholder="W"
                    aria-label="Custom width ratio"
                    className="w-16 px-2 py-1 text-xs rounded-md border border-gray-200 dark:border-[#2C2C2E] bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white focus:border-teal-500 focus:outline-none"
                  />
                  <span className="text-xs text-gray-400">:</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={customH}
                    onChange={(e) => setCustomH(e.target.value)}
                    placeholder="H"
                    aria-label="Custom height ratio"
                    className="w-16 px-2 py-1 text-xs rounded-md border border-gray-200 dark:border-[#2C2C2E] bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white focus:border-teal-500 focus:outline-none"
                  />
                  {customAspect && (
                    <span className="text-xs text-gray-500 dark:text-[#8E8E93]">
                      = {customAspect.toFixed(2)}
                    </span>
                  )}
                  {!customAspect && (
                    <span className="text-xs text-gray-400">
                      (blank = free / full frame)
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setCustomW('')
                      setCustomH('')
                    }}
                    className="ml-1 text-xs text-teal-600 hover:underline"
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>
          )}

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
            {showAspectPresets
              ? activePresetKey === 'freestyle'
                ? 'Freestyle: zoom and pan the image — the crop fills the visible frame.'
                : activePresetKey === 'custom'
                ? 'Custom: type a width:height ratio, then drag to reposition and zoom.'
                : 'Drag to reposition and zoom to frame the crop.'
              : 'Drag to reposition. Use slider to zoom.'}
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
