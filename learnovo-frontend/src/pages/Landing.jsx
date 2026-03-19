import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import PlaceholderImage from '../components/ui/PlaceholderImage'
import {
  BookOpen, BarChart3, CheckCircle, ArrowRight, Shield,
  GraduationCap, CalendarDays, ClipboardList, Menu, X as XIcon,
  Sun, Moon, ChevronDown, Star, Lock, Cloud, Server, Award, Headphones,
  Clock, CreditCard, FileText, Bus, BookMarked, Building2,
  LayoutDashboard, Brain, GitBranch, UserCog, UserPlus, Package,
  Bell, MonitorSmartphone,
} from 'lucide-react'

const ShaderBackground = lazy(() => import('../components/ui/ShaderBackground'))

// ─── Parallax helpers (preserved from original) ────────────────────────────
function useParallaxStyle(scrollY, side, sectionTop, sectionHeight, speed = 1) {
  const progress = Math.max(0, (scrollY - sectionTop) / (sectionHeight || 1))
  const translateX = side === 'left' ? -progress * 120 * speed : progress * 120 * speed
  const opacity = Math.max(0, 1 - progress * 1.2)
  return { transform: `translateX(${translateX}px)`, opacity, transition: 'transform 0.1s linear, opacity 0.1s linear' }
}

// ─── Count-up hook ─────────────────────────────────────────────────────────
function useCountUp(target, isVisible, duration = 1500) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!isVisible) return
    let start = 0
    const step = target / (duration / 16)
    const id = setInterval(() => {
      start += step
      if (start >= target) { setValue(target); clearInterval(id) }
      else setValue(Math.floor(start))
    }, 16)
    return () => clearInterval(id)
  }, [isVisible, target, duration])
  return value
}

// ─── Browser frame mockup ──────────────────────────────────────────────────
function BrowserFrame({ url = 'learnovo.app', children, className = '' }) {
  return (
    <div className={`bg-gray-50 dark:bg-[#1C1C1E] rounded-2xl border border-gray-200 dark:border-[#38383A] shadow-glass-lg overflow-hidden ${className}`}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-[#38383A]">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-amber-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="bg-white dark:bg-[#2C2C2E] rounded-lg px-4 py-1 text-xs text-gray-400 dark:text-[#636366] border border-gray-200 dark:border-[#38383A]">
            {url}
          </div>
        </div>
      </div>
      {children}
    </div>
  )
}

// ─── Seeded sparkle particles (stable across re-renders) ───────────────────
function generateSparkles(count, seed) {
  return Array.from({ length: count }, (_, i) => {
    const s = seed * 100 + i * 73
    const rand = (n) => (Math.sin(s + n * 9301 + 49297) * 0.5 + 0.5)
    return {
      ox: rand(1) * 100,               // origin % within card
      oy: rand(2) * 100,
      dx: (rand(3) - 0.5) * 160,       // scatter distance
      dy: (rand(4) - 0.5) * 160 - 60,  // bias upward
      size: 2 + rand(5) * 4,
      offset: rand(6) * 0.35,          // stagger timing
      bright: rand(7) > 0.4,
    }
  })
}

// ─── Liquid Glass Card with sparkle dissolve ───────────────────────────────
// Scrolling down: card fades + sparkles fly outward
// Scrolling back up: sparkles converge back + card reappears (fully reversible)
function GlassCard({ isDark, metric, label, badge, badgeColor, progress, sub, primary, delay = 0, scrollProgress = 0 }) {
  const [visible, setVisible] = useState(false)
  const sparklesRef = useRef(generateSparkles(18, delay))
  const sparkles = sparklesRef.current

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay + 100)
    return () => clearTimeout(timer)
  }, [delay])

  // Dissolve phases (fully reversible):
  // 0.0–0.35: card solid, no sparkles
  // 0.35–0.75: card fading, sparkles burst out / converge back
  // 0.75–1.0: card gone, sparkles fading
  const sp = Math.min(1, scrollProgress)
  const dissolveStart = 0.35
  const dissolveEnd = 0.75
  const dp = sp < dissolveStart ? 0 : sp > dissolveEnd ? 1 : (sp - dissolveStart) / (dissolveEnd - dissolveStart)
  const cardOpacity = Math.max(0, 1 - dp * 1.3)
  const sparklePhase = dp

  return (
    <div
      className="relative"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition: `opacity 0.5s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.5s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
        pointerEvents: cardOpacity < 0.05 ? 'none' : 'auto',
      }}
    >
      {/* ── Sparkle particles ── */}
      {sparklePhase > 0 && (
        <div className="absolute inset-0 pointer-events-none z-20" style={{ overflow: 'visible' }}>
          {sparkles.map((s, i) => {
            // Each sparkle staggers in based on its offset
            const t = Math.max(0, Math.min(1, (sparklePhase - s.offset) / (1 - s.offset)))
            const e = 1 - Math.pow(1 - t, 2) // ease-out
            // Scale: grow in → peak → shrink out
            const scale = t < 0.3 ? t / 0.3 : t > 0.7 ? (1 - t) / 0.3 : 1
            // Opacity: fade in → hold → fade out
            const opacity = t < 0.15 ? t / 0.15 : t > 0.65 ? (1 - t) / 0.35 : 1
            return (
              <div
                key={i}
                className="absolute rounded-full"
                style={{
                  left: `${s.ox}%`,
                  top: `${s.oy}%`,
                  width: s.size,
                  height: s.size,
                  transform: `translate(${s.dx * e}px, ${s.dy * e}px) scale(${scale})`,
                  opacity,
                  background: isDark
                    ? s.bright ? '#34D399' : 'rgba(52,211,153,0.5)'
                    : s.bright ? '#1D9E75' : 'rgba(29,158,117,0.4)',
                  boxShadow: s.bright
                    ? isDark
                      ? '0 0 8px 2px rgba(52,211,153,0.4)'
                      : '0 0 8px 2px rgba(29,158,117,0.3)'
                    : 'none',
                }}
              />
            )
          })}
        </div>
      )}

      {/* ── Glass card body ── */}
      <div
        className="relative rounded-2xl overflow-hidden select-none cursor-pointer group/card"
        style={{
          opacity: cardOpacity,
          backdropFilter: `blur(${primary ? 48 : 40}px) saturate(180%)`,
          WebkitBackdropFilter: `blur(${primary ? 48 : 40}px) saturate(180%)`,
          background: isDark
            ? primary ? 'rgba(29, 158, 117, 0.12)' : 'rgba(255, 255, 255, 0.06)'
            : primary ? 'rgba(29, 158, 117, 0.08)' : 'rgba(255, 255, 255, 0.35)',
          border: isDark
            ? primary ? '1px solid rgba(52, 211, 153, 0.25)' : '1px solid rgba(255, 255, 255, 0.1)'
            : primary ? '1px solid rgba(29, 158, 117, 0.2)' : '1px solid rgba(255, 255, 255, 0.6)',
          boxShadow: isDark
            ? `0 8px 32px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.06)${primary ? ', 0 0 40px rgba(52,211,153,0.06)' : ''}`
            : `0 8px 32px rgba(0,0,0,0.06), inset 0 1px 1px rgba(255,255,255,0.5)${primary ? ', 0 0 40px rgba(29,158,117,0.06)' : ''}`,
          padding: primary ? '20px 22px' : '16px 18px',
          transition: 'transform 0.25s cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s cubic-bezier(0.16,1,0.3,1), border-color 0.25s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)'
          e.currentTarget.style.boxShadow = isDark
            ? `0 16px 48px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.08), 0 0 30px rgba(52,211,153,0.12)`
            : `0 16px 48px rgba(0,0,0,0.1), inset 0 1px 1px rgba(255,255,255,0.6), 0 0 30px rgba(29,158,117,0.08)`
          e.currentTarget.style.borderColor = isDark ? 'rgba(52,211,153,0.35)' : 'rgba(29,158,117,0.3)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = ''
          e.currentTarget.style.boxShadow = ''
          e.currentTarget.style.borderColor = ''
        }}
      >
        {/* Specular highlight */}
        <div className="absolute top-0 left-0 right-0 h-[55%] pointer-events-none rounded-t-2xl" style={{
          background: isDark
            ? 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, transparent 50%)'
            : 'linear-gradient(135deg, rgba(255,255,255,0.6) 0%, transparent 50%)',
        }} />

        {/* Edge refraction */}
        <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{
          background: isDark
            ? 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 30%, transparent 70%, rgba(255,255,255,0.02) 100%)'
            : 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 30%, transparent 70%, rgba(255,255,255,0.2) 100%)',
        }} />

        {/* Content */}
        <div className="relative z-10">
          <p className={`text-[11px] font-medium tracking-wide uppercase mb-1 ${isDark ? 'text-[#888]' : 'text-gray-500'}`}>{label}</p>
          <div className="flex items-baseline gap-2">
            <p className={`font-bold tracking-tight ${primary ? 'text-2xl' : 'text-xl'} ${isDark ? 'text-white' : 'text-gray-900'}`}>{metric}</p>
            {badge && (
              <span className={`text-xs font-semibold ${badgeColor || (isDark ? 'text-[#34D399]' : 'text-emerald-600')}`}>{badge}</span>
            )}
          </div>
          {progress !== undefined && (
            <div className={`mt-2 h-[3px] rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-gray-200/80'}`}>
              <div className="h-full rounded-full bg-[#1D9E75]" style={{ width: `${progress}%` }} />
            </div>
          )}
          {sub && (
            <p className={`text-[10px] mt-1.5 ${isDark ? 'text-[#666]' : 'text-gray-400'}`}>{sub}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  LANDING PAGE
// ═══════════════════════════════════════════════════════════════════════════

const Landing = () => {
  const { theme, toggleMode } = useTheme()
  const isDark = theme.mode === 'dark'

  // ── State ────────────────────────────────────────────────────────────────
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [navVisible, setNavVisible] = useState(true)
  const [scrolled, setScrolled] = useState(false)
  const [scrollY, setScrollY] = useState(0)
  const [scrollProgress, setScrollProgress] = useState(0)
  const lastScrollY = useRef(0)

  // Tabbed features
  const [activeTab, setActiveTab] = useState(0)

  // Pricing toggle
  const [annual, setAnnual] = useState(false)

  // FAQ
  const [openFaq, setOpenFaq] = useState(null)

  // Feature grid expand
  const [showAllFeatures, setShowAllFeatures] = useState(false)

  // Testimonial carousel
  const [activeTestimonial, setActiveTestimonial] = useState(0)
  const [problemSectionVisible, setProblemSectionVisible] = useState(false)
  const testimonialTimer = useRef(null)

  // ── Refs ─────────────────────────────────────────────────────────────────
  const heroRef = useRef(null)
  const logoTickerRef = useRef(null)
  const problemRef = useRef(null)
  const tabbedRef = useRef(null)
  const featureGridRef = useRef(null)
  const testimonialRef = useRef(null)
  const securityRef = useRef(null)
  const pricingRef = useRef(null)
  const faqRef = useRef(null)
  const ctaRef = useRef(null)
  const footerRef = useRef(null)

  // Stats visibility for count-up
  const statsRef = useRef(null)
  const [statsVisible, setStatsVisible] = useState(false)

  // ── Scroll handling ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleAnchorClick = (e) => {
      const href = e.target.closest('a')?.getAttribute('href')
      if (href?.startsWith('#')) {
        const el = document.querySelector(href)
        if (el) { e.preventDefault(); el.scrollIntoView({ behavior: 'smooth' }) }
      }
    }
    document.addEventListener('click', handleAnchorClick)
    return () => document.removeEventListener('click', handleAnchorClick)
  }, [])

  useEffect(() => {
    let ticking = false
    const handleScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const y = window.scrollY
        setScrolled(y > 20)
        if (Math.abs(y - lastScrollY.current) > 2) {
          setScrollY(y)
          lastScrollY.current = y
        }
        const distanceFromBottom = document.documentElement.scrollHeight - window.innerHeight - y
        setNavVisible(distanceFromBottom >= 300)
        // Scroll progress
        const total = document.documentElement.scrollHeight - window.innerHeight
        setScrollProgress(total > 0 ? (y / total) * 100 : 0)
        ticking = false
      })
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // ── Intersection Observer for fade-in ────────────────────────────────────
  useEffect(() => {
    const targets = [logoTickerRef, problemRef, tabbedRef, featureGridRef, testimonialRef, securityRef, pricingRef, faqRef, ctaRef, footerRef]
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('landed-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1 }
    )
    targets.forEach((ref) => { if (ref.current) observer.observe(ref.current) })
    return () => observer.disconnect()
  }, [])

  // Stats count-up observer
  useEffect(() => {
    if (!statsRef.current) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setStatsVisible(true); obs.disconnect() } }, { threshold: 0.3 })
    obs.observe(statsRef.current)
    return () => obs.disconnect()
  }, [])

  // Problem/Solution slide-in observer
  useEffect(() => {
    if (!problemRef.current) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setProblemSectionVisible(true); obs.disconnect() } }, { threshold: 0.15 })
    obs.observe(problemRef.current)
    return () => obs.disconnect()
  }, [])

  // ── Section bounds for parallax ──────────────────────────────────────────
  const [sectionBounds, setSectionBounds] = useState({})
  const boundsTimerRef = useRef(null)
  useEffect(() => {
    const calcBounds = () => {
      const refs = { hero: heroRef }
      const bounds = {}
      for (const [key, ref] of Object.entries(refs)) {
        if (ref.current) bounds[key] = { top: ref.current.offsetTop, height: ref.current.offsetHeight }
      }
      setSectionBounds(bounds)
    }
    calcBounds()
    const handleResize = () => { clearTimeout(boundsTimerRef.current); boundsTimerRef.current = setTimeout(calcBounds, 200) }
    window.addEventListener('resize', handleResize)
    return () => { window.removeEventListener('resize', handleResize); clearTimeout(boundsTimerRef.current) }
  }, [])

  const heroBounds = sectionBounds.hero || { top: 0, height: 800 }

  // ── Testimonial auto-scroll ──────────────────────────────────────────────
  useEffect(() => {
    testimonialTimer.current = setInterval(() => setActiveTestimonial(p => (p + 1) % 3), 5000)
    return () => clearInterval(testimonialTimer.current)
  }, [])
  const pauseTestimonial = useCallback(() => clearInterval(testimonialTimer.current), [])
  const resumeTestimonial = useCallback(() => {
    testimonialTimer.current = setInterval(() => setActiveTestimonial(p => (p + 1) % 3), 5000)
  }, [])

  // ── Device showcase scroll-driven animation (DOM-direct for 60fps) ───────
  const deviceSectionRef = useRef(null)
  const [deviceProgress, setDeviceProgress] = useState(0)
  const smoothProgressRef = useRef(0)
  const targetProgressRef = useRef(0)
  const rafIdRef = useRef(null)

  useEffect(() => {
    // Smooth animation loop — lerps toward target at ~60fps
    const SMOOTH_FACTOR = 0.08 // lower = smoother/slower, higher = snappier
    const animate = () => {
      const current = smoothProgressRef.current
      const target = targetProgressRef.current
      const diff = target - current
      // Only update if meaningful change
      if (Math.abs(diff) > 0.0005) {
        smoothProgressRef.current = current + diff * SMOOTH_FACTOR
        setDeviceProgress(smoothProgressRef.current)
      } else if (current !== target) {
        smoothProgressRef.current = target
        setDeviceProgress(target)
      }
      rafIdRef.current = requestAnimationFrame(animate)
    }
    rafIdRef.current = requestAnimationFrame(animate)

    // Scroll handler — just sets target, no setState
    const handleDeviceScroll = () => {
      if (!deviceSectionRef.current) return
      const rect = deviceSectionRef.current.getBoundingClientRect()
      const sectionH = deviceSectionRef.current.offsetHeight
      const viewH = window.innerHeight
      const earlyStart = viewH * 0.4
      const scrolled = -rect.top + earlyStart
      const totalScrollable = sectionH - viewH + earlyStart
      targetProgressRef.current = Math.max(0, Math.min(1, scrolled / totalScrollable))
    }
    window.addEventListener('scroll', handleDeviceScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleDeviceScroll)
      cancelAnimationFrame(rafIdRef.current)
    }
  }, [])

  // ── Data ─────────────────────────────────────────────────────────────────

  const schoolLogos = [
    { name: 'SP International School', file: '/images/logos/school-1.png' },
    { name: 'Horizon Global Academy', file: '/images/logos/school-2.png' },
    { name: 'Maple Leaf School', file: '/images/logos/school-3.png' },
    { name: 'Crestview Public School', file: '/images/logos/school-4.png' },
    { name: 'Pinnacle International', file: '/images/logos/school-5.png' },
    { name: 'Bridgeford Academy', file: '/images/logos/school-6.png' },
  ]

  const painPoints = [
    'Manual attendance eating up hours',
    'Parents constantly calling for fee receipts',
    'Report cards taking weeks to prepare',
    'No visibility across branches',
  ]
  const solutions = [
    'One-tap digital attendance',
    'Automated receipts via WhatsApp & SMS',
    'AI-generated report cards in minutes',
    'Multi-branch dashboard with real-time data',
  ]

  const tabbedFeatures = [
    { title: 'Attendance Tracking', img: '/images/attendance.png', desc: 'Track student attendance in real-time with one-tap check-in. Generate daily, weekly, and monthly reports automatically. Instant alerts to parents for absences.' },
    { title: 'Fee Management', img: '/images/fees.png', desc: 'Automate fee collection with online payments, auto-generated invoices, and smart reminders. Track pending dues and payment history effortlessly.' },
    { title: 'Gradebook & Reports', img: '/images/gradebook.png', desc: 'Enter grades, calculate GPAs, and generate beautiful report cards in minutes. Support for multiple grading systems and custom templates.' },
    { title: 'Payroll', img: '/images/payroll.png', desc: 'Automate salary calculations, generate payslips, and manage deductions effortlessly. Track advances, bonuses, and tax compliance — all from one dashboard.' },
    { title: 'Announcements', img: '/images/announcements.png', desc: 'Broadcast updates to parents, teachers, and students instantly. Schedule announcements, target specific classes or groups, and track delivery across SMS, WhatsApp, and the web portal.' },
  ]

  const allFeatures = [
    { icon: Clock, title: 'Attendance Tracking', desc: 'Real-time tracking with instant parent alerts' },
    { icon: CreditCard, title: 'Fee Collection & Invoicing', desc: 'Online payments, auto receipts, due reminders' },
    { icon: BookOpen, title: 'Gradebook & Exams', desc: 'Flexible grading with exam scheduling' },
    { icon: FileText, title: 'Report Card Generator', desc: 'Beautiful report cards in one click' },
    { icon: CalendarDays, title: 'Timetable Scheduling', desc: 'Conflict-free timetables with smart allocation' },
    { icon: Bell, title: 'SMS & WhatsApp Alerts', desc: 'Instant notifications on every channel' },
    { icon: MonitorSmartphone, title: 'Parent Portal', desc: 'Dedicated web portal for fees, grades, and updates' },
    { icon: Bus, title: 'Transport Management', desc: 'Route planning, GPS tracking, driver management' },
    { icon: BookMarked, title: 'Library Management', desc: 'Book cataloging, issue tracking, fine management' },
    { icon: Building2, title: 'Hostel Management', desc: 'Room allocation, attendance, mess management' },
    { icon: LayoutDashboard, title: 'Custom Dashboards', desc: 'Role-based dashboards for every stakeholder' },
    { icon: Brain, title: 'AI-Powered Reports', desc: 'Intelligent analytics and predictive insights' },
    { icon: GitBranch, title: 'Multi-branch Support', desc: 'Centralized control across all campuses' },
    { icon: UserCog, title: 'Staff & HR', desc: 'Payroll, leave management, and staff records' },
    { icon: UserPlus, title: 'Admission & Enrollment', desc: 'Online applications to enrollment in one flow' },
    { icon: Package, title: 'Inventory Management', desc: 'Track assets, supplies, and procurement' },
  ]

  const testimonials = [
    { quote: 'Learnovo transformed how we manage SP International. From attendance to fees, everything is seamless now.', name: 'Mahesh Vhanesa', title: 'Managing Director, SP International School' },
    { quote: 'Fee collection went from a week-long headache to a one-click process.', name: 'Priya Mehta', title: 'Administrator, Horizon Global Academy' },
    { quote: 'The multi-branch dashboard gives me visibility I never had before.', name: 'Arjun Kapoor', title: 'Director, Crestview Group of Schools' },
  ]

  const securityItems = [
    { icon: Shield, title: '256-bit Encryption', desc: 'All data encrypted at rest and in transit' },
    { icon: Lock, title: 'Role-based Access', desc: 'Granular permissions for every user type' },
    { icon: Cloud, title: 'Daily Backups', desc: 'Automated backups with instant recovery' },
    { icon: Server, title: '99.9% Uptime', desc: 'Enterprise-grade reliability guaranteed' },
    { icon: Award, title: 'GDPR Compliant', desc: 'Full compliance with data protection laws' },
    { icon: Headphones, title: '24/7 Support', desc: 'Dedicated support team always available' },
  ]

  const plans = [
    { name: 'Free Trial', priceMonthly: '₹0', priceAnnual: '₹0', period: '14 days', annualBilled: '', desc: 'Try Learnovo free for 14 days', features: ['Up to 50 students', 'Up to 5 teachers', 'Core Academics', 'Attendance Tracking', 'Timetable Management', 'Email support'], popular: false, cta: 'Start free trial' },
    { name: 'Basic', priceMonthly: '₹2,999', priceAnnual: '₹2,399', period: '/mo', annualBilled: 'Billed ₹28,788/yr', desc: 'Essential tools for small schools', features: ['Up to 500 students', 'Up to 30 teachers', 'Grades & Exams', 'Fees & Finance', 'Basic Reports', 'CSV Import', 'Parent Portal Access'], popular: false, cta: 'Get started' },
    { name: 'Pro', priceMonthly: '₹6,999', priceAnnual: '₹5,599', period: '/mo', annualBilled: 'Billed ₹67,188/yr', desc: 'Full-featured ERP for growing schools', features: ['Up to 2,000 students', 'Up to 100 teachers', 'Advanced Analytics', 'Custom Reports', 'API Access', 'Payment Gateway Integration', 'SMS & WhatsApp Alerts', 'Priority & Phone support'], popular: true, cta: 'Get started' },
    { name: 'Enterprise', priceMonthly: 'Custom', priceAnnual: 'Custom', period: '/yr', annualBilled: '', desc: 'Unlimited capacity & custom integrations', features: ['Unlimited students', 'Unlimited teachers', 'Custom integrations', 'Dedicated account manager', 'All Pro features', 'SLA guarantee', 'White-label option', 'On-premise deployment'], popular: false, cta: 'Contact Sales' },
  ]

  const faqs = [
    { q: 'How long does setup take?', a: 'Most schools are fully set up within 24-48 hours. Our team handles data migration, configuration, and provides hands-on training to ensure a smooth transition.' },
    { q: 'Can I migrate from my current software?', a: 'Absolutely. We support migration from all major school management systems. Our team will handle the entire data transfer at no extra cost.' },
    { q: 'Do you provide training for teachers?', a: 'Yes, we provide comprehensive onboarding training for all staff including live sessions, video tutorials, and ongoing support until everyone is comfortable.' },
    { q: 'Can parents access Learnovo on their phones?', a: 'Yes. Learnovo is fully responsive and works beautifully on any phone browser — no download needed. Parents can pay fees, view grades, receive notifications, and message teachers directly.' },
    { q: 'What happens to my data if I cancel?', a: 'Your data remains available for 90 days after cancellation. You can export everything in standard formats anytime. We never hold your data hostage.' },
    { q: 'Do you support multiple branches?', a: 'Yes, multi-branch management is a core feature. You get a centralized dashboard with branch-level controls, unified reporting, and cross-branch student transfers.' },
    { q: 'What payment methods do you accept for fee collection?', a: 'We support UPI, credit/debit cards, net banking, and wallet payments. Parents can pay directly from the web portal. All transactions are secured with bank-grade encryption.' },
    { q: 'Is there an offline mode?', a: 'Critical functions like attendance marking work offline and sync automatically when connectivity is restored. The platform is designed to handle intermittent internet gracefully.' },
  ]

  // ── Visible features (first 8 or all) ────────────────────────────────────
  const visibleFeatures = showAllFeatures ? allFeatures : allFeatures.slice(0, 8)

  // ── Device showcase computed transforms ──────────────────────────────────
  // dp goes 0→1 as user scrolls through the 300vh section
  const dp = deviceProgress

  // Helper: clamp and lerp within a sub-range of dp
  const lerp = (start, end, dpStart, dpEnd) => {
    const t = Math.max(0, Math.min(1, (dp - dpStart) / (dpEnd - dpStart)))
    return start + (end - start) * t
  }

  // STAGE 1 (0→0.25): MacBook rises from below to center
  // STAGE 2 (0.25→0.50): MacBook shrinks + moves left, iPad enters from right
  // STAGE 3 (0.50→0.75): Phone rises from bottom-right of MacBook
  // FINAL  (0.80→1.0): All devices settle, tagline fades in

  // MacBook
  const macTransY = dp < 0.25 ? lerp(200, 0, 0, 0.25) : 0
  const macScale = dp < 0.25 ? 1 : dp < 0.50 ? lerp(1, 0.78, 0.25, 0.50) : 0.78
  const macTransX = dp < 0.25 ? 0 : dp < 0.50 ? lerp(0, -140, 0.25, 0.50) : -140
  const macOpacity = lerp(0, 1, 0, 0.08)

  // iPad — enters from right, settles to the right of MacBook
  const ipadShow = dp >= 0.25
  const ipadTransX = dp < 0.50 ? lerp(350, 200, 0.25, 0.50) : 200
  const ipadTransY = dp < 0.50 ? lerp(40, 30, 0.25, 0.50) : 30
  const ipadOpacity = dp < 0.25 ? 0 : dp < 0.38 ? lerp(0, 1, 0.25, 0.38) : 1

  // Phone — rises from bottom, positioned to the right-front of MacBook (slight overlap)
  const phoneShow = dp >= 0.50
  const phoneTransY = dp < 0.75 ? lerp(200, 50, 0.50, 0.75) : 50
  const phoneTransX = dp < 0.75 ? lerp(60, 60, 0.50, 0.75) : 60
  const phoneOpacity = dp < 0.50 ? 0 : dp < 0.62 ? lerp(0, 1, 0.50, 0.62) : 1

  // Text stages
  const stage1TextOp = dp < 0.02 ? 0 : dp < 0.10 ? lerp(0, 1, 0.02, 0.10) : dp < 0.22 ? 1 : lerp(1, 0, 0.22, 0.27)
  const stage2TextOp = dp < 0.28 ? 0 : dp < 0.35 ? lerp(0, 1, 0.28, 0.35) : dp < 0.47 ? 1 : lerp(1, 0, 0.47, 0.52)
  const stage3TextOp = dp < 0.55 ? 0 : dp < 0.62 ? lerp(0, 1, 0.55, 0.62) : dp < 0.75 ? 1 : lerp(1, 0, 0.75, 0.80)
  const finalTaglineOp = dp < 0.82 ? 0 : lerp(0, 1, 0.82, 0.90)

  // Count-up values for testimonial stats
  const stat1 = useCountUp(98, statsVisible)
  const stat2 = useCountUp(4.8, statsVisible, 1500)
  const stat3 = useCountUp(60, statsVisible)

  // ════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a] transition-colors duration-300">
      {/* ── Scroll Progress Bar ─────────────────────────────────────────── */}
      <div className="scroll-progress-bar" style={{ width: `${scrollProgress}%` }} />

      {/* ── Floating Pill Navbar ─────────────────────────────────────────── */}
      <div className="fixed top-[3px] left-0 right-0 z-50 flex justify-center px-4 pt-4 pointer-events-none">
        <header
          className="pointer-events-auto w-full max-w-[1032px] overflow-hidden transition-all duration-500 ease-out"
          style={{
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            backgroundColor: isDark
              ? (scrolled ? 'rgba(10, 10, 10, 0.88)' : 'rgba(10, 10, 10, 0.6)')
              : (scrolled ? 'rgba(255, 255, 255, 0.88)' : 'rgba(255, 255, 255, 0.6)'),
            borderRadius: '100px',
            boxShadow: isDark
              ? (scrolled ? '0 0 0 1px rgba(255,255,255,0.06), 0 2px 8px rgba(0,0,0,0.4)' : '0 0 0 1px rgba(255,255,255,0.04)')
              : (scrolled ? 'rgba(30, 45, 82, 0.06) 0px 0px 0.34px 0.34px, rgba(30, 45, 82, 0.2) 0.34px 0.34px 0.34px 0px' : 'rgba(30, 45, 82, 0.03) 0px 0px 0.34px 0.34px, rgba(30, 45, 82, 0.1) 0.34px 0.34px 0.34px 0px'),
            opacity: navVisible ? 1 : 0,
            transform: navVisible ? 'translateY(0)' : 'translateY(-100%)',
          }}
        >
          <div className="flex items-center justify-between h-14 px-6">
            <Link to="/" className="flex items-center gap-2 flex-shrink-0">
              <img src="/logo-icon.png" alt="Learnovo" className="h-7 w-7 object-contain" />
              <span className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Learnovo</span>
            </Link>
            <nav className="hidden md:flex items-center gap-5">
              {[{ label: 'Features', href: '#features' }, { label: 'Pricing', href: '#pricing' }, { label: 'FAQ', href: '#faq' }].map(item => (
                <a key={item.label} href={item.href} className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">{item.label}</a>
              ))}
            </nav>
            <div className="hidden md:flex items-center gap-2 flex-shrink-0">
              <button
                onClick={toggleMode}
                className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-white/10 transition-colors"
                aria-label="Toggle dark mode"
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <Link to="/login" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 transition-colors">Log in</Link>
              <Link to="/register" className="bg-primary-600 dark:bg-[#3EC4B1] text-white dark:text-black text-sm font-medium px-4 py-1.5 rounded-full hover:bg-primary-700 dark:hover:bg-[#35a89a] active:bg-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 transition-colors">Sign up free</Link>
            </div>
            <div className="flex md:hidden items-center gap-1">
              <button onClick={toggleMode} className="p-2 rounded-full text-gray-500 dark:text-gray-400" aria-label="Toggle dark mode">
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button className="p-2 text-gray-600 dark:text-gray-300" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                {mobileMenuOpen ? <XIcon className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </header>
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden" onClick={() => setMobileMenuOpen(false)}>
          <div className="mt-20 mx-4 bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-xl rounded-2xl shadow-glass-lg p-5 space-y-3 animate-slide-down" onClick={e => e.stopPropagation()}>
            {[{ label: 'Features', href: '#features' }, { label: 'Pricing', href: '#pricing' }, { label: 'FAQ', href: '#faq' }].map(item => (
              <a key={item.label} href={item.href} className="block text-sm text-gray-600 dark:text-gray-300 py-2.5 border-b border-gray-100 dark:border-[#2a2a2a] last:border-0" onClick={() => setMobileMenuOpen(false)}>{item.label}</a>
            ))}
            <div className="pt-3 flex flex-col gap-2">
              <Link to="/login" className="text-sm text-gray-600 dark:text-gray-300 py-2 text-center">Log in</Link>
              <Link to="/register" className="bg-primary-600 dark:bg-[#3EC4B1] text-white dark:text-black text-sm font-medium px-4 py-2.5 rounded-full text-center hover:bg-primary-700 dark:hover:bg-[#35a89a] transition-colors">Sign up free</Link>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1: HERO
          ═══════════════════════════════════════════════════════════════════ */}
      <section ref={heroRef} className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden bg-white dark:bg-[#0a0a0a]">
        {/* Light mode: shader gradient */}
        {!isDark && (
          <Suspense fallback={null}>
            <ShaderBackground speed={0.35} />
          </Suspense>
        )}

        {/* Dark mode: green glow effects */}
        {isDark && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Large ambient green glow — top right */}
            <div className="absolute -top-[20%] right-[-10%] w-[700px] h-[700px] rounded-full opacity-[0.07]"
              style={{ background: 'radial-gradient(circle, #34D399, transparent 70%)' }} />
            {/* Smaller secondary glow — bottom left */}
            <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full opacity-[0.05]"
              style={{ background: 'radial-gradient(circle, #3EC4B1, transparent 70%)' }} />
            {/* Subtle dot grid */}
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }} />
          </div>
        )}

        {/* Floating decorative elements */}
        {(() => {
          const hero = heroBounds
          return (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute top-20 left-[5%] w-16 h-16 md:w-20 md:h-20 landing-float" style={{ animationDelay: '0s', filter: isDark ? 'drop-shadow(0 8px 24px rgba(0,0,0,0.3))' : 'drop-shadow(0 8px 24px rgba(0,0,0,0.08))', ...useParallaxStyle(scrollY, 'left', hero.top, hero.height, 1.2) }}>
                <div className={`w-full h-full rounded-2xl rotate-[-15deg] flex items-center justify-center backdrop-blur-sm border ${isDark ? 'bg-[#34D399]/10 border-[#34D399]/20' : 'bg-primary-100 border-white/40'}`}>
                  <BookOpen className={`w-8 h-8 md:w-10 md:h-10 ${isDark ? 'text-[#34D399]' : 'text-primary-600'}`} />
                </div>
              </div>
              <div className="absolute top-[45%] left-[3%] w-12 h-12 md:w-16 md:h-16 landing-float-2" style={{ animationDelay: '0.8s', filter: isDark ? 'drop-shadow(0 6px 20px rgba(0,0,0,0.3))' : 'drop-shadow(0 6px 20px rgba(0,0,0,0.06))', ...useParallaxStyle(scrollY, 'left', hero.top, hero.height, 0.8) }}>
                <div className={`w-full h-full rounded-2xl rotate-[8deg] flex items-center justify-center backdrop-blur-sm border ${isDark ? 'bg-[#34D399]/8 border-[#34D399]/15' : 'bg-amber-100 border-white/40'}`}>
                  <ClipboardList className={`w-6 h-6 md:w-8 md:h-8 ${isDark ? 'text-[#34D399]/70' : 'text-amber-600'}`} />
                </div>
              </div>
              <div className="absolute top-28 right-[8%] w-14 h-14 md:w-18 md:h-18 landing-float-2" style={{ animationDelay: '1.5s', filter: isDark ? 'drop-shadow(0 8px 24px rgba(0,0,0,0.3))' : 'drop-shadow(0 8px 24px rgba(0,0,0,0.08))', ...useParallaxStyle(scrollY, 'right', hero.top, hero.height, 1.0) }}>
                <div className={`w-full h-full rounded-2xl rotate-[12deg] flex items-center justify-center backdrop-blur-sm border ${isDark ? 'bg-[#34D399]/10 border-[#34D399]/20' : 'bg-emerald-100 border-white/40'}`}>
                  <GraduationCap className={`w-7 h-7 md:w-9 md:h-9 ${isDark ? 'text-[#34D399]' : 'text-emerald-600'}`} />
                </div>
              </div>
              <div className="absolute top-[50%] right-[4%] w-14 h-14 md:w-18 md:h-18 landing-float" style={{ animationDelay: '2s', filter: isDark ? 'drop-shadow(0 6px 20px rgba(0,0,0,0.3))' : 'drop-shadow(0 6px 20px rgba(0,0,0,0.06))', ...useParallaxStyle(scrollY, 'right', hero.top, hero.height, 0.9) }}>
                <div className={`w-full h-full rounded-2xl rotate-[-10deg] flex items-center justify-center backdrop-blur-sm border ${isDark ? 'bg-[#34D399]/8 border-[#34D399]/15' : 'bg-green-100 border-white/40'}`}>
                  <BarChart3 className={`w-7 h-7 md:w-9 md:h-9 ${isDark ? 'text-[#34D399]/70' : 'text-green-600'}`} />
                </div>
              </div>
              {/* Small dots */}
              <div className={`absolute top-[20%] left-[20%] w-3 h-3 rounded-full landing-float-3 ${isDark ? 'bg-[#34D399]/40' : 'bg-primary-400'}`} style={{ animationDelay: '0.5s', ...useParallaxStyle(scrollY, 'left', hero.top, hero.height, 0.6) }} />
              <div className={`absolute top-[60%] right-[15%] w-2 h-2 rounded-full landing-float-3 ${isDark ? 'bg-[#34D399]/30' : 'bg-secondary-400'}`} style={{ animationDelay: '1.2s', ...useParallaxStyle(scrollY, 'right', hero.top, hero.height, 0.7) }} />
              <div className={`absolute bottom-[20%] left-[12%] w-4 h-4 rounded-full landing-float-3 ${isDark ? 'bg-[#34D399]/25' : 'bg-amber-400'}`} style={{ animationDelay: '1.8s', ...useParallaxStyle(scrollY, 'left', hero.top, hero.height, 0.5) }} />
            </div>
          )
        })()}

        <div className="max-w-[1258px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: text */}
            <div className="text-center lg:text-left">
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-6 text-gray-900 dark:text-white">
                Manage your school{' '}
                <span className="text-primary-600 dark:text-[#34D399]">the smart way</span>
              </h1>
              <p className="text-lg md:text-xl mb-10 max-w-2xl leading-relaxed text-gray-500 dark:text-[#888]">
                The most flexible school management platform for modern institutions.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-6">
                <Link to="/register" className="bg-primary-600 dark:bg-[#34D399] text-white dark:text-black px-7 py-3.5 rounded-full text-sm font-semibold hover:bg-primary-700 dark:hover:bg-[#2abb87] active:bg-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 transition-all hover:shadow-lg dark:hover:shadow-[0_0_24px_rgba(52,211,153,0.3)] inline-flex items-center justify-center gap-2">
                  Start managing for free
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <a href="#features" className="border text-gray-700 px-7 py-3.5 rounded-full text-sm font-semibold transition-all inline-flex items-center justify-center border-gray-300 hover:bg-gray-50 dark:border-[#222] dark:text-white dark:hover:bg-[#111] dark:hover:border-[#34D399]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">
                  See how it works
                </a>
              </div>
              <p className="text-sm text-gray-400 dark:text-[#555]">
                Trusted by 500+ schools · 2,00,000+ students · 12 states
              </p>
            </div>

            {/* Right: Liquid Glass metric cards — flat grid */}
            <div className="relative hidden lg:block">
              {/* Soft glow behind cards */}
              <div className="absolute -inset-6 rounded-3xl pointer-events-none blur-3xl" style={{
                opacity: isDark ? 0.15 : 0.1,
                background: isDark
                  ? 'radial-gradient(ellipse at center, #34D399, transparent 70%)'
                  : 'radial-gradient(ellipse at center, rgba(29,158,117,0.4), transparent 70%)',
              }} />

              {(() => {
                const heroH = heroBounds.height || 800
                const awayProgress = Math.max(0, Math.min(1, scrollY / (heroH * 0.8)))
                return (
                  <div className="grid grid-cols-2 gap-3">
                    <GlassCard isDark={isDark} metric="₹7,500.00" label="Today's collection" badge="+12%" badgeColor="text-emerald-400" primary delay={0} scrollProgress={awayProgress} scatter={{ x: 0, y: 0, rotate: 0, scale: 1 }} />
                    <GlassCard isDark={isDark} metric="98%" label="Student attendance" progress={98} delay={100} scrollProgress={awayProgress} scatter={{ x: 0, y: 0, rotate: 0, scale: 1 }} />
                    <GlassCard isDark={isDark} metric="2,00,000+" label="Students managed" sub="across 500+ schools" delay={200} scrollProgress={awayProgress} scatter={{ x: 0, y: 0, rotate: 0, scale: 1 }} />
                    <GlassCard isDark={isDark} metric="₹85,000" label="Pending fees" sub="23 students remaining" delay={300} scrollProgress={awayProgress} scatter={{ x: 0, y: 0, rotate: 0, scale: 1 }} />
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2: LOGO TICKER
          ═══════════════════════════════════════════════════════════════════ */}
      <section ref={logoTickerRef} className="py-10 border-t border-b border-gray-100 dark:border-[#1a1a1a] bg-white dark:bg-[#141414] landing-fade-in">
        <div className="max-w-[1258px] mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-medium text-gray-400 dark:text-[#9CA3AF] uppercase tracking-wider mb-6">Trusted by schools worldwide</p>
          <div className="overflow-hidden" style={{ maskImage: 'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)' }}>
            <div className="flex">
              <div className="logo-ticker-track">
                {[...schoolLogos, ...schoolLogos].map((logo, i) => (
                  <LogoItem key={i} logo={logo} isDark={isDark} />
                ))}
              </div>
              <div className="logo-ticker-track" aria-hidden>
                {[...schoolLogos, ...schoolLogos].map((logo, i) => (
                  <LogoItem key={`dup-${i}`} logo={logo} isDark={isDark} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 3: PROBLEM → SOLUTION
          ═══════════════════════════════════════════════════════════════════ */}
      <section ref={problemRef} className="py-24 md:py-32 bg-gray-50 dark:bg-[#0a0a0a] landing-fade-in">
        <div className="max-w-[1258px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Pain points */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-red-500 dark:text-red-400 uppercase tracking-wider mb-6" style={{ opacity: problemSectionVisible ? 1 : 0, transform: problemSectionVisible ? 'translateX(0)' : 'translateX(-40px)', transition: 'opacity 0.5s ease-out, transform 0.5s ease-out' }}>The problem</h3>
              {painPoints.map((p, i) => (
                <div key={i} className="flex items-start gap-3 bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-gray-200 dark:border-[#2a2a2a] hover:shadow-glass" style={{ opacity: problemSectionVisible ? 1 : 0, transform: problemSectionVisible ? 'translateX(0)' : 'translateX(-60px)', transition: 'opacity 0.6s ease-out, transform 0.6s ease-out', transitionDelay: `${0.1 + i * 0.12}s` }}>
                  <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <XIcon className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
                  </div>
                  <span className="text-sm text-gray-700 dark:text-[#F9FAFB]">{p}</span>
                </div>
              ))}
            </div>
            {/* Solutions */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-primary-600 dark:text-[#34D399] uppercase tracking-wider mb-6" style={{ opacity: problemSectionVisible ? 1 : 0, transform: problemSectionVisible ? 'translateX(0)' : 'translateX(40px)', transition: 'opacity 0.5s ease-out, transform 0.5s ease-out', transitionDelay: '0.3s' }}>The solution</h3>
              {solutions.map((s, i) => (
                <div key={i} className="flex items-start gap-3 bg-white dark:bg-[#1a1a1a] rounded-xl p-4 border border-gray-200 dark:border-[#2a2a2a] hover:shadow-glass" style={{ opacity: problemSectionVisible ? 1 : 0, transform: problemSectionVisible ? 'translateX(0)' : 'translateX(60px)', transition: 'opacity 0.6s ease-out, transform 0.6s ease-out', transitionDelay: `${0.4 + i * 0.12}s` }}>
                  <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-[#34D399]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle className="w-3.5 h-3.5 text-primary-600 dark:text-[#34D399]" />
                  </div>
                  <span className="text-sm text-gray-700 dark:text-[#F9FAFB]">{s}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-center mt-12 text-lg md:text-xl font-semibold text-gray-900 dark:text-white" style={{ opacity: problemSectionVisible ? 1 : 0, transform: problemSectionVisible ? 'translateY(0)' : 'translateY(20px)', transition: 'opacity 0.6s ease-out, transform 0.6s ease-out', transitionDelay: '0.9s' }}>
            One platform. Every school operation. <span className="text-primary-600 dark:text-[#34D399]">Zero chaos.</span>
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 4: CORE FEATURES — TABBED SHOWCASE
          ═══════════════════════════════════════════════════════════════════ */}
      <section ref={tabbedRef} id="features" className="py-24 md:py-32 bg-white dark:bg-[#141414] landing-fade-in">
        <div className="max-w-[1258px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-[#F9FAFB] tracking-tight mb-4">
              Everything works together
            </h2>
            <p className="text-gray-500 dark:text-[#9CA3AF] max-w-xl mx-auto">Five core modules. One seamless experience.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-5xl mx-auto">
            {/* Tab list — vertical on desktop, horizontal scroll on mobile */}
            <div className="lg:col-span-4">
              <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 no-scrollbar">
                {tabbedFeatures.map((f, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveTab(i)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-medium transition-all duration-200 whitespace-nowrap lg:whitespace-normal flex-shrink-0 lg:flex-shrink ${
                      activeTab === i
                        ? 'bg-white dark:bg-[#1a1a1a] shadow-glass border-l-4 border-primary-500 dark:border-[#34D399] text-gray-900 dark:text-white font-bold'
                        : 'text-gray-500 dark:text-[#9CA3AF] hover:text-gray-700 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-[#1a1a1a]/50 border-l-4 border-transparent'
                    }`}
                  >
                    {f.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="lg:col-span-8">
              <div className="relative">
                {tabbedFeatures.map((f, i) => (
                  <div key={i} className={`transition-all duration-500 ease-out ${activeTab === i ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-[0.98] absolute inset-0 pointer-events-none'}`}>
                    <BrowserFrame url={`learnovo.app/${f.title.toLowerCase().replace(/\s+/g, '-')}`}>
                      <div className="aspect-[16/10] overflow-hidden">
                        <PlaceholderImage
                          src={f.img}
                          alt={f.title}
                          className="w-full h-full object-cover"
                          style={{ minHeight: 240 }}
                        />
                      </div>
                    </BrowserFrame>
                    <p className="mt-4 text-sm text-gray-600 dark:text-[#9CA3AF] leading-relaxed">{f.desc}</p>
                    <a href="#" className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-primary-600 dark:text-[#34D399] hover:underline">
                      Learn more <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 5: DEVICE SHOWCASE — SCROLL ANIMATION
          ═══════════════════════════════════════════════════════════════════ */}
      <section ref={deviceSectionRef} className="relative" style={{ height: '300vh' }}>
        <div className={`sticky top-0 h-screen overflow-hidden ${isDark ? 'bg-[#0a0a0a]' : 'bg-white'}`}>
          {/* Subtle dot grid */}
          <div className="absolute inset-0" style={{
            backgroundImage: isDark
              ? 'radial-gradient(circle, rgba(52,211,153,0.06) 1px, transparent 1px)'
              : 'radial-gradient(circle, rgba(0,0,0,0.03) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />

          <div className="relative h-full w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

            {/* ── STAGE 1 text — left side ── */}
            <div
              className="absolute left-4 sm:left-8 lg:left-12 top-[15%] max-w-sm z-20 pointer-events-none"
              style={{ opacity: stage1TextOp }}
            >
              <h3 className={`text-2xl md:text-4xl font-bold tracking-tight mb-3 ${isDark ? 'text-[#F9FAFB]' : 'text-gray-900'}`}>
                Powerful admin dashboard
              </h3>
              <p className={`text-base md:text-lg leading-relaxed ${isDark ? 'text-[#9CA3AF]' : 'text-gray-500'}`}>
                Manage everything from one screen — students, staff, fees, reports, all in real-time.
              </p>
            </div>

            {/* ── STAGE 2 text — right side ── */}
            <div
              className="absolute right-4 sm:right-8 lg:right-12 top-[15%] max-w-sm z-20 text-right pointer-events-none"
              style={{ opacity: stage2TextOp }}
            >
              <h3 className={`text-2xl md:text-4xl font-bold tracking-tight mb-3 ${isDark ? 'text-[#F9FAFB]' : 'text-gray-900'}`}>
                Built for teachers too
              </h3>
              <p className={`text-base md:text-lg leading-relaxed ${isDark ? 'text-[#9CA3AF]' : 'text-gray-500'}`}>
                Mark attendance, enter grades, manage timetables — a streamlined view designed for educators.
              </p>
            </div>

            {/* ── STAGE 3 text — top center ── */}
            <div
              className="absolute left-1/2 -translate-x-1/2 top-[6%] text-center max-w-lg z-20 pointer-events-none"
              style={{ opacity: stage3TextOp }}
            >
              <h3 className={`text-2xl md:text-4xl font-bold tracking-tight mb-3 ${isDark ? 'text-[#F9FAFB]' : 'text-gray-900'}`}>
                Parents stay connected
              </h3>
              <p className={`text-base md:text-lg leading-relaxed ${isDark ? 'text-[#9CA3AF]' : 'text-gray-500'}`}>
                Fee payments, grade updates, notifications — everything accessible from any phone browser. No download needed.
              </p>
            </div>

            {/* ── FINAL tagline — bottom center ── */}
            <div
              className="absolute left-1/2 -translate-x-1/2 bottom-[5%] text-center z-20 pointer-events-auto"
              style={{ opacity: finalTaglineOp }}
            >
              <p className={`text-xl md:text-2xl font-bold tracking-tight mb-4 ${isDark ? 'text-[#F9FAFB]' : 'text-gray-900'}`}>
                One platform. Every device. Every browser.
              </p>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-sm font-semibold transition-colors bg-primary-600 dark:bg-[#34D399] text-white dark:text-black hover:bg-primary-700 dark:hover:bg-[#2abb87]"
              >
                Get started free <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* ── Devices — using photos with device frames baked in ── */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">

              {/* MacBook */}
              <div className="absolute will-change-transform" style={{
                opacity: macOpacity,
                transform: `translate(${macTransX}px, ${macTransY}px) scale(${macScale})`,
              }}>
                <img
                  src="/images/dashboard-full.png"
                  alt="Learnovo Dashboard on MacBook"
                  className="w-[420px] md:w-[600px] h-auto object-contain drop-shadow-2xl select-none"
                  draggable={false}
                />
              </div>

              {/* iPad */}
              {ipadShow && (
                <div className="absolute will-change-transform" style={{
                  opacity: ipadOpacity,
                  transform: `translate(${ipadTransX}px, ${ipadTransY}px)`,
                }}>
                  <img
                    src="/images/teacher-view.png"
                    alt="Learnovo on iPad"
                    className="w-[180px] md:w-[240px] h-auto object-contain drop-shadow-2xl select-none"
                    draggable={false}
                  />
                </div>
              )}

              {/* iPhone */}
              {phoneShow && (
                <div className="absolute will-change-transform" style={{
                  opacity: phoneOpacity,
                  transform: `translate(${phoneTransX}px, ${phoneTransY}px)`,
                }}>
                  <img
                    src="/images/parent-mobile.png"
                    alt="Learnovo on iPhone"
                    className="w-[100px] md:w-[130px] h-auto object-contain drop-shadow-2xl select-none"
                    draggable={false}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 6: FEATURE GRID
          ═══════════════════════════════════════════════════════════════════ */}
      <section ref={featureGridRef} className="py-24 md:py-32 bg-gray-50 dark:bg-[#0a0a0a] landing-fade-in">
        <div className="max-w-[1258px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-[#F9FAFB] tracking-tight mb-4">Everything your school needs</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 landing-stagger">
            {visibleFeatures.map((f, i) => {
              const Icon = f.icon
              return (
                <div key={i} className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-200 dark:border-[#2a2a2a] p-5 hover:shadow-glass-lg dark:hover:shadow-[0_0_20px_rgba(52,211,153,0.08)] transition-all duration-200 group">
                  <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-[#34D399]/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Icon className="w-5 h-5 text-primary-600 dark:text-[#34D399]" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">{f.title}</h3>
                  <p className="text-xs text-gray-500 dark:text-[#9CA3AF] leading-relaxed">{f.desc}</p>
                </div>
              )
            })}
          </div>
          {!showAllFeatures && (
            <div className="text-center mt-8">
              <button
                onClick={() => setShowAllFeatures(true)}
                className="text-sm font-medium text-primary-600 dark:text-[#34D399] hover:underline inline-flex items-center gap-1"
              >
                View all features <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 7: TESTIMONIALS
          ═══════════════════════════════════════════════════════════════════ */}
      <section ref={testimonialRef} className="py-24 md:py-32 bg-white dark:bg-[#141414] landing-fade-in">
        <div className="max-w-[1258px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-[#F9FAFB] tracking-tight mb-4">Loved by school administrators</h2>
          </div>

          <div
            className="max-w-3xl mx-auto overflow-hidden"
            onMouseEnter={pauseTestimonial}
            onMouseLeave={resumeTestimonial}
          >
            <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${activeTestimonial * 100}%)` }}>
              {testimonials.map((t, i) => (
                <div key={i} className="w-full flex-shrink-0 px-4">
                  <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-200 dark:border-[#2a2a2a] p-8 text-center shadow-glass">
                    <div className="flex justify-center gap-1 mb-4">
                      {[...Array(5)].map((_, si) => <Star key={si} className="w-4 h-4 text-yellow-400 fill-yellow-400" />)}
                    </div>
                    <p className="text-lg italic text-gray-700 dark:text-[#9CA3AF] mb-6 leading-relaxed">"{t.quote}"</p>
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-base bg-primary-500 dark:bg-[#34D399] dark:text-black">
                        {t.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{t.name}</p>
                        <p className="text-xs text-gray-500 dark:text-[#9CA3AF]">{t.title}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Dots */}
            <div className="flex justify-center gap-2 mt-6">
              {testimonials.map((_, i) => (
                <button key={i} onClick={() => setActiveTestimonial(i)} className={`w-2 h-2 rounded-full transition-colors ${activeTestimonial === i ? 'bg-primary-500 dark:bg-[#34D399]' : 'bg-gray-300 dark:bg-[#2a2a2a]'}`} />
              ))}
            </div>
          </div>

          {/* Stats bar */}
          <div ref={statsRef} className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12 mt-12 pt-8 border-t border-gray-200 dark:border-[#2a2a2a]">
            <div className="text-center">
              <span className="text-3xl font-bold text-primary-600 dark:text-[#34D399]">{stat1}%</span>
              <p className="text-xs text-gray-500 dark:text-[#9CA3AF] mt-1">satisfaction</p>
            </div>
            <div className="text-center">
              <span className="text-3xl font-bold text-primary-600 dark:text-[#34D399]">{typeof stat2 === 'number' ? stat2.toFixed(1) : stat2}/5</span>
              <p className="text-xs text-gray-500 dark:text-[#9CA3AF] mt-1">rating</p>
            </div>
            <div className="text-center">
              <span className="text-3xl font-bold text-primary-600 dark:text-[#34D399]">{stat3}%</span>
              <p className="text-xs text-gray-500 dark:text-[#9CA3AF] mt-1">less admin time</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 8: SECURITY & COMPLIANCE
          ═══════════════════════════════════════════════════════════════════ */}
      <section ref={securityRef} className="py-24 md:py-32 bg-gray-50 dark:bg-[#0a0a0a] landing-fade-in">
        <div className="max-w-[1258px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-[#F9FAFB] tracking-tight mb-4">Your school data is safe with us</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 max-w-4xl mx-auto landing-stagger">
            {securityItems.map((item, i) => {
              const Icon = item.icon
              return (
                <div key={i} className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-200 dark:border-[#2a2a2a] p-6 text-center shadow-glass">
                  <div className="w-12 h-12 rounded-xl bg-primary-50 dark:bg-[#34D399]/10 flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-6 h-6 text-primary-600 dark:text-[#34D399]/70" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">{item.title}</h3>
                  <p className="text-xs text-gray-500 dark:text-[#9CA3AF] leading-relaxed">{item.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 9: PRICING
          ═══════════════════════════════════════════════════════════════════ */}
      <section ref={pricingRef} id="pricing" className="py-24 md:py-32 bg-white dark:bg-[#141414] landing-fade-in">
        <div className="max-w-[1258px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-[#F9FAFB] tracking-tight mb-4">Simple, transparent pricing</h2>
            {/* Monthly / Annual toggle */}
            <div className="inline-flex items-center gap-3 mt-4">
              <span className={`text-sm ${!annual ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-500 dark:text-[#9CA3AF]'}`}>Monthly</span>
              <button onClick={() => setAnnual(!annual)} className={`relative w-12 h-6 rounded-full transition-colors ${annual ? 'bg-primary-500 dark:bg-[#34D399]' : 'bg-gray-300 dark:bg-[#2a2a2a]'}`}>
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${annual ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
              <span className={`text-sm ${annual ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-500 dark:text-[#9CA3AF]'}`}>Annual</span>
              <span className="bg-primary-100 dark:bg-[#34D399]/20 text-primary-700 dark:text-[#34D399] text-xs font-semibold px-2 py-0.5 rounded-full">Save 20%</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto landing-stagger">
            {plans.map((plan, i) => (
              <div key={i} className={`relative bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 transition-all duration-200 hover:shadow-glass-lg ${
                plan.popular
                  ? 'ring-2 ring-primary-500 dark:ring-[#34D399] shadow-glass-lg dark:shadow-[0_0_20px_rgba(52,211,153,0.12)] scale-[1.02]'
                  : 'border border-gray-200 dark:border-[#2a2a2a] shadow-glass'
              }`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary-600 dark:bg-[#34D399] text-white dark:text-black px-3 py-1 rounded-full text-xs font-semibold">Most Popular</span>
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{plan.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-[#9CA3AF] mb-4">{plan.desc}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-gray-900 dark:text-white">{annual ? plan.priceAnnual : plan.priceMonthly}</span>
                    {plan.period && <span className="text-sm text-gray-400 dark:text-[#9CA3AF]">{plan.period}</span>}
                  </div>
                  {annual && plan.annualBilled && <p className="text-[11px] text-gray-400 dark:text-[#636366] mt-1">{plan.annualBilled}</p>}
                </div>
                <Link to={plan.cta === 'Contact Sales' ? '#' : '/register'} className={`block w-full text-center py-2.5 rounded-full text-sm font-semibold mb-6 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
                  plan.popular
                    ? 'bg-primary-600 dark:bg-[#34D399] text-white dark:text-black hover:bg-primary-700 dark:hover:bg-[#2abb87]'
                    : 'border border-primary-200 dark:border-[#34D399]/30 text-primary-700 dark:text-[#34D399] hover:bg-primary-50 dark:hover:bg-[#34D399]/10'
                }`}>
                  {plan.cta}
                </Link>
                <ul className="space-y-2.5">
                  {plan.features.map((f, fi) => (
                    <li key={fi} className="flex items-start gap-2 text-xs text-gray-600 dark:text-[#9CA3AF]">
                      <CheckCircle className="w-3.5 h-3.5 text-primary-500 dark:text-[#34D399] flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-gray-400 dark:text-[#9CA3AF] mt-8">All plans include free data migration + onboarding support</p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 10: FAQ
          ═══════════════════════════════════════════════════════════════════ */}
      <section ref={faqRef} id="faq" className="py-24 md:py-32 bg-gray-50 dark:bg-[#0a0a0a] landing-fade-in">
        <div className="max-w-[1258px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-[#F9FAFB] tracking-tight mb-4">Frequently asked questions</h2>
          </div>
          <div className="max-w-2xl mx-auto space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-[#2a2a2a] overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-medium text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                  {faq.q}
                  <ChevronDown className={`w-4 h-4 text-gray-400 dark:text-[#9CA3AF] transition-transform duration-300 flex-shrink-0 ml-4 ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                <div className={`faq-answer ${openFaq === i ? 'faq-open' : ''}`}>
                  <div>
                    <p className="px-5 pb-4 text-sm text-gray-600 dark:text-[#9CA3AF] leading-relaxed">{faq.a}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 11: FINAL CTA
          ═══════════════════════════════════════════════════════════════════ */}
      <section ref={ctaRef} className="relative py-24 md:py-32 bg-[#0a2647] dark:bg-[#050505] overflow-hidden landing-fade-in">
        <div className="absolute inset-0 opacity-[0.4]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat', backgroundSize: '150px 150px',
        }} />
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(52, 211, 153, 0.15), transparent 70%)' }} />

        {/* Pulsing green glow behind heading in dark mode */}
        {isDark && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[200px] rounded-full opacity-20" style={{
            background: 'radial-gradient(ellipse, rgba(52,211,153,0.3), transparent 70%)',
            animation: 'pulse 3s ease-in-out infinite',
          }} />
        )}

        <div className="max-w-[1258px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight leading-tight mb-4">
              Ready to run your school{' '}
              <span className="text-[#34D399]">the smart way?</span>
            </h2>
            <p className="text-gray-400 mb-8">Join 500+ schools already saving hours every week.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/register" className="bg-[#34D399] text-black px-7 py-3.5 rounded-full text-sm font-semibold hover:bg-[#2abb87] active:bg-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34D399] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a2647] transition-all hover:shadow-glow-sm inline-flex items-center justify-center gap-2">
                Start free trial
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="#pricing" className="border border-white/20 text-white px-7 py-3.5 rounded-full text-sm font-semibold hover:bg-white/10 transition-all inline-flex items-center justify-center">
                View pricing
              </a>
            </div>
            <p className="text-xs text-gray-500 mt-6">No credit card required · Setup in under 10 minutes</p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 12: FOOTER
          ═══════════════════════════════════════════════════════════════════ */}
      <footer ref={footerRef} className="bg-[#F8FAFB] dark:bg-[#050505] py-16 border-t border-gray-200 dark:border-[#1a1a1a] landing-fade-in">
        <div className="max-w-[1258px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-8 mb-12">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <img src="/logo-icon.png" alt="Learnovo" className="h-8 w-8 object-contain" />
                <span className="text-lg font-bold text-gray-900 dark:text-white">Learnovo</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-[#9CA3AF] leading-relaxed">The complete school management platform for modern institutions.</p>
            </div>
            {[
              { title: 'Product', links: ['Features', 'Pricing', 'Integrations', 'API'] },
              { title: 'Resources', links: ['Help Center', 'Documentation', 'Blog', 'Guides', 'Webinars'] },
              { title: 'Company', links: ['About', 'Careers', 'Contact', 'Press', 'Partners'] },
              { title: 'Legal', links: ['Privacy', 'Terms', 'Cookie Policy', 'GDPR', 'Security'] },
            ].map((col, i) => (
              <div key={i}>
                <h4 className="text-sm font-semibold mb-4 text-gray-900 dark:text-white">{col.title}</h4>
                <ul className="space-y-2.5">
                  {col.links.map((link, li) => (
                    <li key={li}><a href="#" className="text-sm text-gray-500 hover:text-primary-600 dark:text-[#9CA3AF] dark:hover:text-[#34D399] transition-colors">{link}</a></li>
                  ))}
                </ul>
              </div>
            ))}
            <div>
              <h4 className="text-sm font-semibold mb-4 text-gray-900 dark:text-white">Contact</h4>
              <ul className="space-y-2.5">
                <li><a href="mailto:hello@learnovo.app" className="text-sm text-gray-500 dark:text-[#9CA3AF] hover:text-primary-600 dark:hover:text-[#34D399] transition-colors">hello@learnovo.app</a></li>
                <li><span className="text-sm text-gray-500 dark:text-[#9CA3AF]">+91 XXXXX XXXXX</span></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-200 dark:border-[#1a1a1a] pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-400 dark:text-[#9CA3AF]">&copy; 2026 Learnovo. All rights reserved.</p>
            <div className="flex items-center gap-6">
              {['Twitter', 'LinkedIn', 'GitHub'].map(social => (
                <a key={social} href="#" className="text-sm text-gray-400 hover:text-primary-600 dark:text-[#9CA3AF] dark:hover:text-[#34D399] transition-colors">{social}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ─── Logo item sub-component ───────────────────────────────────────────────
function LogoItem({ logo, isDark }) {
  const [imgFailed, setImgFailed] = useState(false)

  if (imgFailed) {
    return (
      <div className={`flex-shrink-0 px-6 py-3 rounded-lg border text-sm font-medium transition-all duration-200 cursor-default select-none ${
        isDark
          ? 'border-[#2a2a2a] text-[#9CA3AF] hover:text-[#34D399] bg-[#1a1a1a]/50'
          : 'border-gray-200 text-gray-400 hover:text-gray-600 bg-gray-50 grayscale hover:grayscale-0'
      }`}>
        {logo.name}
      </div>
    )
  }

  return (
    <img
      src={logo.file}
      alt={logo.name}
      className={`flex-shrink-0 h-10 w-auto object-contain transition-all duration-200 ${
        isDark ? 'invert brightness-75 hover:brightness-100' : 'grayscale opacity-60 hover:grayscale-0 hover:opacity-100'
      }`}
      onError={() => setImgFailed(true)}
    />
  )
}

export default Landing
