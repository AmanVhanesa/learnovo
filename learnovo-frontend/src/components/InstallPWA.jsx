import { useState, useEffect } from 'react'
import { X, Share, MoreVertical, Menu, Download } from 'lucide-react'
import { useTenant } from '../contexts/TenantContext'

// Detect browser environment
function detectBrowser() {
  const ua = navigator.userAgent
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true

  if (isStandalone) return { name: 'standalone' }

  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/.test(ua)
  const isFirefox = /Firefox|FxiOS/.test(ua)
  const isSamsungInternet = /SamsungBrowser/.test(ua)
  const isOpera = /OPR|Opera/.test(ua)
  const isEdge = /Edg/.test(ua)
  const isChrome = /Chrome/.test(ua) && !/Edg|OPR|SamsungBrowser/.test(ua)

  if (isIOS && isSafari) return { name: 'ios-safari', isIOS: true }
  if (isIOS && /CriOS/.test(ua)) return { name: 'ios-chrome', isIOS: true }
  if (isIOS && /FxiOS/.test(ua)) return { name: 'ios-firefox', isIOS: true }
  if (isIOS) return { name: 'ios-other', isIOS: true }
  if (isSamsungInternet) return { name: 'samsung' }
  if (isFirefox) return { name: 'firefox' }
  if (isOpera) return { name: 'opera' }
  if (isEdge) return { name: 'edge' }
  if (isChrome) return { name: 'chrome' }
  return { name: 'other' }
}

// Get browser-specific install instructions
function getInstallInstructions(browser, brandColor) {
  switch (browser.name) {
    case 'ios-safari':
      return {
        icon: <Share size={15} className="inline -mt-0.5" style={{ color: brandColor }} />,
        text: <>Tap <Share size={14} className="inline -mt-0.5" style={{ color: brandColor }} /> at the bottom, then <span className="font-medium">&quot;Add to Home Screen&quot;</span></>
      }
    case 'ios-chrome':
      return {
        icon: <Share size={15} className="inline -mt-0.5" style={{ color: brandColor }} />,
        text: <>Tap <Share size={14} className="inline -mt-0.5" style={{ color: brandColor }} /> at the top, then <span className="font-medium">&quot;Add to Home Screen&quot;</span></>
      }
    case 'ios-firefox':
    case 'ios-other':
      return {
        icon: <Menu size={15} className="inline -mt-0.5" style={{ color: brandColor }} />,
        text: <>Open in <span className="font-medium">Safari</span>, tap <Share size={14} className="inline -mt-0.5" style={{ color: brandColor }} /> then <span className="font-medium">&quot;Add to Home Screen&quot;</span></>
      }
    case 'firefox':
      return {
        icon: <MoreVertical size={15} className="inline -mt-0.5" style={{ color: brandColor }} />,
        text: <>Tap <MoreVertical size={14} className="inline -mt-0.5" style={{ color: brandColor }} /> menu, then <span className="font-medium">&quot;Install&quot;</span></>
      }
    case 'samsung':
      return {
        icon: <Menu size={15} className="inline -mt-0.5" style={{ color: brandColor }} />,
        text: <>Tap <Menu size={14} className="inline -mt-0.5" style={{ color: brandColor }} /> menu, then <span className="font-medium">&quot;Add page to&quot;</span> → <span className="font-medium">&quot;Home screen&quot;</span></>
      }
    case 'opera':
      return {
        icon: <MoreVertical size={15} className="inline -mt-0.5" style={{ color: brandColor }} />,
        text: <>Tap <MoreVertical size={14} className="inline -mt-0.5" style={{ color: brandColor }} /> menu, then <span className="font-medium">&quot;Home screen&quot;</span></>
      }
    default:
      return {
        icon: <MoreVertical size={15} className="inline -mt-0.5" style={{ color: brandColor }} />,
        text: <>Tap <MoreVertical size={14} className="inline -mt-0.5" style={{ color: brandColor }} /> menu, then look for <span className="font-medium">&quot;Install&quot;</span> or <span className="font-medium">&quot;Add to Home Screen&quot;</span></>
      }
  }
}

export default function InstallPWA() {
  const { tenant, isSubdomainApp } = useTenant()
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showBanner, setShowBanner] = useState(false)
  const [browser, setBrowser] = useState(null)

  const appName = (isSubdomainApp && tenant?.schoolName) || 'Learnovo'
  const appIcon = (isSubdomainApp && tenant?.logo) || '/icons/icon-96x96.png'
  const brandColor = (isSubdomainApp && tenant?.primaryColor) || '#3EC4B1'

  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-install-dismissed')
    if (dismissed && Date.now() - Number(dismissed) < 7 * 24 * 60 * 60 * 1000) return

    const detected = detectBrowser()
    if (detected.name === 'standalone') return

    setBrowser(detected)

    // Chrome/Edge/Opera fire beforeinstallprompt — wait for it
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowBanner(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // For browsers that don't fire beforeinstallprompt, show manual instructions
    // after a short delay (give beforeinstallprompt a chance to fire first)
    const fallbackTimer = setTimeout(() => {
      setShowBanner((current) => {
        // Only show if beforeinstallprompt hasn't already shown the banner
        if (!current) return true
        return current
      })
    }, 2000)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      clearTimeout(fallbackTimer)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShowBanner(false)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShowBanner(false)
    localStorage.setItem('pwa-install-dismissed', String(Date.now()))
  }

  if (!showBanner || !browser) return null

  // Native install prompt available (Chrome, Edge, etc.)
  if (deferredPrompt) {
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

  // Manual instructions for all other browsers
  const instructions = getInstallInstructions(browser, brandColor)
  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 md:bottom-6 md:left-auto md:right-6 md:w-96 animate-slide-up">
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl border border-gray-200 dark:border-[#38383A] p-4">
        <div className="flex items-start gap-3">
          <img src={appIcon} alt={appName} className="w-12 h-12 rounded-xl flex-shrink-0 object-contain" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">Install {appName}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
              {instructions.text}
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
