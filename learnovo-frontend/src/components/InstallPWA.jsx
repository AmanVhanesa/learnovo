import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { X, Share, MoreVertical, Menu, Download } from 'lucide-react'
import { useTenant } from '../contexts/TenantContext'

// ── Browser detection ────────────────────────────────────────────────
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

// ── Browser-specific instructions ────────────────────────────────────
function getInstallInstructions(browser, brandColor) {
  switch (browser.name) {
    case 'ios-safari':
      return {
        text: <>Tap <Share size={14} className="inline -mt-0.5" style={{ color: brandColor }} /> at the bottom, then <span className="font-medium">&quot;Add to Home Screen&quot;</span></>
      }
    case 'ios-chrome':
      return {
        text: <>Tap <Share size={14} className="inline -mt-0.5" style={{ color: brandColor }} /> at the top, then <span className="font-medium">&quot;Add to Home Screen&quot;</span></>
      }
    case 'ios-firefox':
    case 'ios-other':
      return {
        text: <>Open in <span className="font-medium">Safari</span>, tap <Share size={14} className="inline -mt-0.5" style={{ color: brandColor }} /> then <span className="font-medium">&quot;Add to Home Screen&quot;</span></>
      }
    case 'firefox':
      return {
        text: <>Tap <MoreVertical size={14} className="inline -mt-0.5" style={{ color: brandColor }} /> menu, then <span className="font-medium">&quot;Install&quot;</span></>
      }
    case 'samsung':
      return {
        text: <>Tap <Menu size={14} className="inline -mt-0.5" style={{ color: brandColor }} /> menu, then <span className="font-medium">&quot;Add page to&quot;</span> &rarr; <span className="font-medium">&quot;Home screen&quot;</span></>
      }
    case 'opera':
      return {
        text: <>Tap <MoreVertical size={14} className="inline -mt-0.5" style={{ color: brandColor }} /> menu, then <span className="font-medium">&quot;Home screen&quot;</span></>
      }
    default:
      return {
        text: <>Tap <MoreVertical size={14} className="inline -mt-0.5" style={{ color: brandColor }} /> menu, then look for <span className="font-medium">&quot;Install&quot;</span> or <span className="font-medium">&quot;Add to Home Screen&quot;</span></>
      }
  }
}

// ── Install context (shared between banner + sidebar button) ─────────
const InstallContext = createContext(null)

export function InstallProvider({ children }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [browser, setBrowser] = useState(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    const detected = detectBrowser()
    if (detected.name === 'standalone') {
      setIsInstalled(true)
      return
    }
    setBrowser(detected)

    // Pick up prompt captured early by inline script in index.html
    if (window.__pwaInstallPrompt) {
      setDeferredPrompt(window.__pwaInstallPrompt)
      delete window.__pwaInstallPrompt
    }

    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      // Clear the global in case it was set
      delete window.__pwaInstallPrompt
    }
    window.addEventListener('beforeinstallprompt', handler)

    const installedHandler = () => setIsInstalled(true)
    window.addEventListener('appinstalled', installedHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  const triggerInstall = useCallback(async () => {
    if (!deferredPrompt) return false
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    if (outcome === 'accepted') {
      setIsInstalled(true)
      return true
    }
    return false
  }, [deferredPrompt])

  return (
    <InstallContext.Provider value={{
      browser,
      canNativeInstall: !!deferredPrompt,
      isInstalled,
      triggerInstall,
    }}>
      {children}
    </InstallContext.Provider>
  )
}

export function useInstall() {
  return useContext(InstallContext)
}

// ── Auto-popup banner (hidden on /login and /register — those pages have their own card) ──
export default function InstallPWA() {
  const { tenant, isSubdomainApp } = useTenant()
  const install = useInstall()
  const [showBanner, setShowBanner] = useState(false)

  const appName = (isSubdomainApp && tenant?.schoolName) || 'Learnovo'
  const appIcon = (isSubdomainApp && tenant?.logo) || '/icons/icon-96x96.png'
  const brandColor = (isSubdomainApp && tenant?.primaryColor) || '#3EC4B1'

  // Don't show auto-popup on login/register pages — they have their own install card
  const isAuthPage = typeof window !== 'undefined' && /^\/(login|register)(\/|$)/i.test(window.location.pathname)

  useEffect(() => {
    if (!install || install.isInstalled || isAuthPage) return
    const dismissed = localStorage.getItem('pwa-install-dismissed')
    if (dismissed && Date.now() - Number(dismissed) < 7 * 24 * 60 * 60 * 1000) return

    // Show banner after a short delay
    const timer = setTimeout(() => setShowBanner(true), 2000)
    return () => clearTimeout(timer)
  }, [install, isAuthPage])

  const handleDismiss = () => {
    setShowBanner(false)
    localStorage.setItem('pwa-install-dismissed', String(Date.now()))
  }

  const handleInstall = async () => {
    if (install?.canNativeInstall) {
      const accepted = await install.triggerInstall()
      if (accepted) setShowBanner(false)
    }
  }

  if (!showBanner || !install || install.isInstalled || !install.browser) return null

  // Native install prompt available (Chrome, Edge, etc.)
  if (install.canNativeInstall) {
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
  const instructions = getInstallInstructions(install.browser, brandColor)
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
