import { useState, useEffect } from 'react'
import { X, Share } from 'lucide-react'
import { useTenant } from '../contexts/TenantContext'

export default function InstallPWA() {
  const { tenant, isSubdomainApp } = useTenant()
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [showIOSPrompt, setShowIOSPrompt] = useState(false)

  // Resolve display values based on tenant
  const appName = (isSubdomainApp && tenant)
    ? (tenant.schoolCode || tenant.subdomain || '').toUpperCase()
    : 'Learnovo'
  const appIcon = (isSubdomainApp && tenant?.logo) || '/icons/icon-96x96.png'
  const brandColor = (isSubdomainApp && tenant?.primaryColor) || '#3EC4B1'

  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-install-dismissed')
    if (dismissed && Date.now() - Number(dismissed) < 7 * 24 * 60 * 60 * 1000) return
    if (window.matchMedia('(display-mode: standalone)').matches) return

    // Check if the event was already captured globally before React mounted
    if (window.__pwaInstallPrompt) {
      setDeferredPrompt(window.__pwaInstallPrompt)
      setShowInstallBanner(true)
      window.__pwaInstallPrompt = null
    }

    // Also listen for future events (e.g. after manifest loads late)
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowInstallBanner(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)
    if (isIOS && isSafari) {
      setShowIOSPrompt(true)
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShowInstallBanner(false)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShowInstallBanner(false)
    setShowIOSPrompt(false)
    localStorage.setItem('pwa-install-dismissed', String(Date.now()))
  }

  if (showInstallBanner) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-50 md:bottom-6 md:left-auto md:right-6 md:w-96 animate-slide-up">
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl border border-gray-200 dark:border-[#38383A] p-4 flex items-center gap-3">
          <img src={appIcon} alt={appName} className="w-12 h-12 rounded-xl flex-shrink-0 object-contain" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">Install {appName}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Add to home screen for quick access</p>
          </div>
          <button
            onClick={handleInstall}
            className="flex-shrink-0 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
            style={{ backgroundColor: brandColor }}
          >
            Install
          </button>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Dismiss"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    )
  }

  if (showIOSPrompt) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-50 md:bottom-6 md:left-auto md:right-6 md:w-96 animate-slide-up">
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl border border-gray-200 dark:border-[#38383A] p-4">
          <div className="flex items-start gap-3">
            <img src={appIcon} alt={appName} className="w-12 h-12 rounded-xl flex-shrink-0 object-contain" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">Install {appName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                Tap <Share size={14} className="inline -mt-0.5" style={{ color: brandColor }} /> then <span className="font-medium">"Add to Home Screen"</span> to install
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Dismiss"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
