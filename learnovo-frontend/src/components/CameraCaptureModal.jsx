import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Camera, RefreshCw, Check, AlertCircle } from 'lucide-react'

const CameraCaptureModal = ({ isOpen, onCancel, onCapture, facingMode = 'environment' }) => {
    const videoRef = useRef(null)
    const canvasRef = useRef(null)
    const streamRef = useRef(null)
    const [error, setError] = useState(null)
    const [snapshot, setSnapshot] = useState(null)
    const [currentFacing, setCurrentFacing] = useState(facingMode)
    const [isStarting, setIsStarting] = useState(false)

    const stopStream = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop())
            streamRef.current = null
        }
    }

    const startStream = async (mode) => {
        setError(null)
        setIsStarting(true)
        stopStream()
        try {
            if (!navigator.mediaDevices?.getUserMedia) {
                throw new Error('Camera is not supported in this browser.')
            }
            let stream
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: mode } },
                    audio: false,
                })
            } catch (e) {
                stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
            }
            streamRef.current = stream
            if (videoRef.current) {
                videoRef.current.srcObject = stream
                await videoRef.current.play().catch(() => {})
            }
        } catch (err) {
            const msg = err?.name === 'NotAllowedError'
                ? 'Camera permission was denied. Please allow camera access in your browser settings.'
                : err?.name === 'NotFoundError'
                    ? 'No camera was found on this device.'
                    : err?.message || 'Unable to access the camera.'
            setError(msg)
        } finally {
            setIsStarting(false)
        }
    }

    useEffect(() => {
        if (isOpen) {
            setSnapshot(null)
            startStream(currentFacing)
        }
        return () => stopStream()
    }, [isOpen])

    const handleSwitchCamera = async () => {
        const next = currentFacing === 'environment' ? 'user' : 'environment'
        setCurrentFacing(next)
        await startStream(next)
    }

    const handleCapture = () => {
        const video = videoRef.current
        const canvas = canvasRef.current
        if (!video || !canvas) return
        const w = video.videoWidth
        const h = video.videoHeight
        if (!w || !h) return
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, w, h)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
        setSnapshot(dataUrl)
        stopStream()
    }

    const handleRetake = () => {
        setSnapshot(null)
        startStream(currentFacing)
    }

    const handleConfirm = () => {
        if (!snapshot) return
        onCapture(snapshot)
        stopStream()
    }

    const handleCancel = () => {
        stopStream()
        onCancel()
    }

    if (!isOpen) return null

    return createPortal(
        <div className="modal-overlay" role="dialog" aria-modal="true">
            <div className="modal-content max-w-2xl p-0">
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#38383A] p-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Take Photo</h3>
                    <button
                        onClick={handleCancel}
                        className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-[#2C2C2E]"
                        type="button"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-4">
                    {error ? (
                        <div className="flex flex-col items-center justify-center text-center py-10 px-6">
                            <AlertCircle className="h-10 w-10 text-red-500 mb-3" />
                            <p className="text-sm text-gray-700 dark:text-gray-200 mb-4">{error}</p>
                            <button
                                type="button"
                                onClick={() => startStream(currentFacing)}
                                className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
                            >
                                Retry
                            </button>
                        </div>
                    ) : (
                        <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                            {snapshot ? (
                                <img src={snapshot} alt="Captured" className="w-full h-full object-contain" />
                            ) : (
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full h-full object-contain"
                                />
                            )}
                            {isStarting && !snapshot && (
                                <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
                                    Starting camera...
                                </div>
                            )}
                        </div>
                    )}
                    <canvas ref={canvasRef} className="hidden" />
                </div>

                {!error && (
                    <div className="flex items-center justify-between gap-2 border-t border-gray-200 dark:border-[#38383A] p-4">
                        {snapshot ? (
                            <>
                                <button
                                    type="button"
                                    onClick={handleRetake}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-200 dark:bg-[#2C2C2E] text-gray-900 dark:text-white text-sm font-medium hover:bg-gray-300"
                                >
                                    <RefreshCw className="h-4 w-4" /> Retake
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirm}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
                                >
                                    <Check className="h-4 w-4" /> Use Photo
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={handleSwitchCamera}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-200 dark:bg-[#2C2C2E] text-gray-900 dark:text-white text-sm font-medium hover:bg-gray-300"
                                >
                                    <RefreshCw className="h-4 w-4" /> Switch
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCapture}
                                    disabled={isStarting}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
                                >
                                    <Camera className="h-4 w-4" /> Capture
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>,
        document.body
    )
}

export default CameraCaptureModal
