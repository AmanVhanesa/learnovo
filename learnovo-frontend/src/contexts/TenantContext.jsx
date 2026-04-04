import React, { createContext, useContext, useState, useEffect } from 'react'
import { tenantService } from '../services/tenantService'

const TenantContext = createContext()

/**
 * Known base domains — the subdomain is everything before these.
 * Must stay in sync with the backend BASE_DOMAINS list.
 */
const BASE_DOMAINS = ['learnovoportal.com', 'learnovo.app', 'localhost']
const RESERVED = new Set(['www', 'api', 'admin', 'app', 'mail', 'ftp', 'staging', 'dev'])

/**
 * Extract tenant subdomain slug from current hostname.
 * Returns null on the root/naked domain or reserved prefixes.
 */
export function getSubdomain() {
  const host = window.location.hostname.toLowerCase()

  for (const base of BASE_DOMAINS) {
    if (host === base) return null
    if (host.endsWith(`.${base}`)) {
      const slug = host.slice(0, -(base.length + 1)).split('.')[0]
      if (!slug || RESERVED.has(slug)) return null
      return slug
    }
  }

  // Fallback for unknown domains with 3+ parts
  const parts = host.split('.')
  if (parts.length >= 3 && !RESERVED.has(parts[0])) {
    return parts[0]
  }

  return null
}

export function TenantProvider({ children }) {
  const [subdomain] = useState(() => getSubdomain())
  const [tenant, setTenant] = useState(null)
  const [isLoading, setIsLoading] = useState(!!subdomain) // only load if subdomain detected
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!subdomain) return

    let cancelled = false
    setIsLoading(true)

    tenantService.getPublicInfo(subdomain)
      .then((data) => {
        if (!cancelled) {
          setTenant(data.tenant || data.data || data)
          setError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const message = err.response?.data?.message || 'School not found'
          setError(message)
          setTenant(null)
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [subdomain])

  // Dynamically set PWA manifest, title, and icons for tenant branding
  useEffect(() => {
    if (!subdomain || !tenant) return

    const schoolName = tenant.schoolName || tenant.name || 'Learnovo'
    const themeColor = tenant.primaryColor || '#3EC4B1'
    const logo = tenant.logo

    // Cache tenant branding for the inline script in index.html
    // so next page load has the correct name BEFORE React hydrates
    try {
      localStorage.setItem('pwa_tenant_' + subdomain, JSON.stringify({
        n: schoolName, c: themeColor, l: logo || ''
      }))
    } catch (e) { /* quota exceeded — ignore */ }

    // Remove any existing manifest links (previous blob URLs)
    document.querySelectorAll('link[rel="manifest"]').forEach(el => el.remove())

    // Build manifest as a blob URL — avoids cross-origin issues entirely
    const icons = logo
      ? [
          { src: logo, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: logo, sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      : [
          { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]

    const manifest = {
      name: schoolName,
      short_name: schoolName.length > 12 ? schoolName.substring(0, 12) : schoolName,
      description: `${schoolName} — School Management Portal`,
      theme_color: themeColor,
      background_color: '#ffffff',
      display: 'standalone',
      orientation: 'portrait-primary',
      scope: '/',
      start_url: '/',
      categories: ['education', 'productivity'],
      icons
    }

    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' })
    const manifestUrl = URL.createObjectURL(blob)

    const manifestLink = document.createElement('link')
    manifestLink.rel = 'manifest'
    manifestLink.href = manifestUrl
    manifestLink.dataset.tenant = '1'
    document.head.appendChild(manifestLink)

    // Update document title — Safari uses this for "Add to Dock" name
    document.title = schoolName

    // Update apple-mobile-web-app-title — iOS uses this for Home Screen name
    let appTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]')
    if (appTitleMeta) {
      appTitleMeta.content = schoolName
    } else {
      appTitleMeta = document.createElement('meta')
      appTitleMeta.name = 'apple-mobile-web-app-title'
      appTitleMeta.content = schoolName
      document.head.appendChild(appTitleMeta)
    }

    // Update theme-color meta
    let themeMeta = document.querySelector('meta[name="theme-color"]')
    if (themeMeta) {
      themeMeta.content = themeColor
    }

    // Update apple-touch-icon to tenant logo if available
    if (logo) {
      let appleIcon = document.querySelector('link[rel="apple-touch-icon"]')
      if (appleIcon) {
        appleIcon.href = logo
      }
    }

    return () => URL.revokeObjectURL(manifestUrl)
  }, [subdomain, tenant])

  const value = {
    subdomain,       // raw slug string or null
    tenant,          // resolved tenant object or null
    isLoading,       // true while resolving
    error,           // error message if subdomain is invalid
    isSubdomainApp: !!subdomain, // convenience flag
  }

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  )
}

export const useTenant = () => {
  const context = useContext(TenantContext)
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider')
  }
  return context
}
