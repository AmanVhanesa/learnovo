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
