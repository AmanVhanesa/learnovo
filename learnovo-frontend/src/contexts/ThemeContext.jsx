import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useSettings } from './SettingsContext'

const ThemeContext = createContext()

const THEME_STORAGE_KEY = 'learnovo-theme'

// Hardcoded brand colors — not user-configurable
const BRAND_PRIMARY = '#3EC4B1'
const BRAND_SECONDARY = '#2355A6'

// Generate a color palette from a single hex color
function hexToHSL(hex) {
  hex = hex.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16) / 255
  const g = parseInt(hex.substring(2, 4), 16) / 255
  const b = parseInt(hex.substring(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h, s, l = (max + min) / 2

  if (max === min) {
    h = s = 0
  } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 }
}

function hslToHex(h, s, l) {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * Math.max(0, Math.min(1, color))).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

function generatePalette(hex) {
  const { h, s } = hexToHSL(hex)
  return {
    50: hslToHex(h, Math.min(s, 30), 96),
    100: hslToHex(h, Math.min(s, 40), 90),
    200: hslToHex(h, Math.min(s, 50), 80),
    300: hslToHex(h, Math.min(s, 55), 65),
    400: hslToHex(h, Math.min(s, 60), 50),
    500: hex,
    600: hslToHex(h, Math.min(s + 5, 100), 40),
    700: hslToHex(h, Math.min(s + 10, 100), 33),
    800: hslToHex(h, Math.min(s + 10, 100), 26),
    900: hslToHex(h, Math.min(s + 10, 100), 20),
  }
}

function applyColorVars(prefix, hex) {
  const palette = generatePalette(hex)
  const root = document.documentElement
  Object.entries(palette).forEach(([shade, color]) => {
    root.style.setProperty(`--color-${prefix}-${shade}`, color)
  })
}

export function ThemeProvider({ children }) {
  const { settings } = useSettings()

  // Initialize from localStorage for instant load, then sync from server settings
  const [theme, setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        return {
          mode: parsed.mode || 'light',
          language: parsed.language || 'en'
        }
      }
    } catch {}
    return {
      mode: 'light',
      language: 'en'
    }
  })

  // Sync language from server settings (theme mode is user-controlled via toggle)
  useEffect(() => {
    if (settings?.theme?.language) {
      setTheme(prev => {
        const next = { ...prev, language: settings.theme.language }
        localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(next))
        return next
      })
    }
  }, [settings?.theme?.language])

  // Apply dark/light mode class + toast CSS vars
  useEffect(() => {
    const root = document.documentElement
    if (theme.mode === 'dark') {
      root.classList.add('dark')
      root.style.setProperty('--toast-bg', '#1C1C1E')
      root.style.setProperty('--toast-color', '#FFFFFF')
      root.style.setProperty('--toast-border', '#38383A')
    } else {
      root.classList.remove('dark')
      root.style.setProperty('--toast-bg', '#fff')
      root.style.setProperty('--toast-color', '#333')
      root.style.setProperty('--toast-border', '#e5e7eb')
    }
  }, [theme.mode])

  // Apply hardcoded brand color CSS variables (not user-configurable)
  useEffect(() => {
    applyColorVars('primary', BRAND_PRIMARY)
    applyColorVars('secondary', BRAND_SECONDARY)
  }, [])

  // Allow components (like Settings) to update theme locally for instant preview
  const updateTheme = useCallback((updates) => {
    setTheme(prev => {
      const next = { ...prev, ...updates }
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const toggleMode = useCallback(() => {
    updateTheme({ mode: theme.mode === 'dark' ? 'light' : 'dark' })
  }, [theme.mode, updateTheme])

  return (
    <ThemeContext.Provider value={{ theme, updateTheme, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
