import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { X, Share } from 'lucide-react'
import { useTenant } from '../contexts/TenantContext'

export default function InstallPWA() {
  const { tenant, isSubdomainApp } = useTenant()
  const location = useLocation()
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  const appName = (isSubdomainApp && tenant)
    ? (tenant.schoolCode || tenant.subdomain || '').toUpperCase()
    : 'Learnovo'
  const appIcon = (isSubdomainApp && tenant?.logo) || '/icons/icon-96x96.png'
  const brandColor = (isSubdomainApp && tenant?.primaryColor) || '#3EC4B1'

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
  const isIOSSafari = isIOS && /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)

  // Only show on login page
  const isLoginPage = location.pathname === '/login'

  useEffect(() => {
    const d = localStorage.getItem('pwa-install-dismissed')
    if (d && Date.now() - Number(d) < 7 * 24 * 60 * 60 * 1000) {
      setDismissed(true)
      return
    }
    if (isStandalone) return

    // Pick up event captured globally in index.html before React mounted
    if (window.__pwaInstallPrompt) {
      setDeferredPrompt(window.__pwaInstallPrompt)
      window.__pwaInstallPrompt = null
    }

    // Listen for the event (fires after Chrome validates manifest + SW)
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      window.__pwaInstallPrompt = null
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [isStandalone])

  const handleInstall = async () => {
    const prompt = deferredPrompt || window.__pwaInstallPrompt
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setDismissed(true)
    setDeferredPrompt(null)
    window.__pwaInstallPrompt = null
  }

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem('pwa-install-dismissed', String(Date.now()))
  }

  // Gate: only login page, not dismissed, not standalone
  if (!isLoginPage || dismissed || isStandalone) return null

  // Need either native prompt OR iOS Safari to show anything
  const hasNativePrompt = !!(deferredPrompt || window.__pwaInstallPrompt)
  if (!hasNativePrompt && !isIOSSafari) return null

  // iOS Safari — share instructions
  if (isIOSSafari) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-50 md:bottom-6 md:left-auto md:right-6 md:w-96 animate-slide-up">
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl border border-gray-200 dark:border-[#38383A] p-4">
          <div className="flex items-start gap-3">
            <img src={appIcon} alt={appName} className="w-12 h-12 rounded-xl flex-shrink-0 object-contain" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">Install {appName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                Tap <Share size={14} className="inline -mt-0.5" style={{ color: brandColor }} /> then <span className="font-medium">"Add to Home Screen"</span>
              </p>
            </div>
            <button onClick={handleDismiss} className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" aria-label="Dismiss">
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Chrome/Edge — native install
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
        <button onClick={handleDismiss} className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" aria-label="Dismiss">
          <X size={18} />
        </button>
      </div>
    </div>
  )
}
