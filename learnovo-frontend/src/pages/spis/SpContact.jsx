import { Link } from 'react-router-dom'
import { ArrowLeft, MapPin, Phone, Mail, Globe, Clock, MessageCircle } from 'lucide-react'
import { useTenant } from '../../contexts/TenantContext'

export default function SpContact() {
  const { tenant } = useTenant()
  const logo = tenant?.logo

  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/90 border-b border-gray-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/login" className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </Link>
          <div className="flex items-center gap-2">
            {logo && <img src={logo} alt="SP International School" className="h-7 w-7 object-contain rounded-md" />}
            <span className="text-sm font-semibold text-gray-700">SP International School</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-b from-teal-50 to-white border-b border-teal-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <div className="flex items-center gap-4 mb-2">
            <div className="h-12 w-12 rounded-2xl bg-teal-600 flex items-center justify-center shadow-sm flex-shrink-0">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Contact Us</h1>
          </div>
          <p className="text-gray-500 text-sm pl-16">SP International School · Sardar Patel Educational Society</p>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="space-y-10 text-sm leading-relaxed text-gray-600">

          <div>
            <h2 className="text-xl font-bold text-gray-900">SP International School</h2>
            <p className="text-gray-500 italic mt-0.5">"The Future Begins Here!"</p>
            <p className="mt-2 text-gray-600">Managed by <strong className="text-gray-900">Sardar Patel Educational Society</strong></p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <ContactCard icon={<MapPin className="w-5 h-5 text-teal-600" />} label="Address">
              <p>A.L.G Road, Firozepur Cantt,</p>
              <p>Punjab – 152003, India</p>
            </ContactCard>

            <ContactCard icon={<Phone className="w-5 h-5 text-teal-600" />} label="Phone">
              <a href="tel:+919888468343" className="text-teal-700 hover:underline font-medium">+91 98884 68343</a>
            </ContactCard>

            <ContactCard icon={<Mail className="w-5 h-5 text-teal-600" />} label="Email">
              <a href="mailto:spinternationalschool2021@gmail.com" className="text-teal-700 hover:underline font-medium break-all">
                spinternationalschool2021@gmail.com
              </a>
            </ContactCard>

            <ContactCard icon={<Globe className="w-5 h-5 text-teal-600" />} label="Website & Portal">
              <a href="https://spinternationalschool.com" target="_blank" rel="noopener noreferrer" className="text-teal-700 hover:underline block">spinternationalschool.com</a>
              <a href="https://spis.learnovoportal.com" target="_blank" rel="noopener noreferrer" className="text-teal-700 hover:underline block mt-0.5">spis.learnovoportal.com</a>
            </ContactCard>
          </div>

          <section className="rounded-2xl border border-gray-100 bg-gray-50 px-6 py-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-gray-500" />
              <h2 className="text-base font-semibold text-gray-900">Working Hours</h2>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="font-medium text-gray-700">Monday – Saturday</span>
                <span className="text-gray-600">8:00 AM – 4:00 PM</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="font-medium text-gray-700">Sunday</span>
                <span className="text-red-500 font-medium">Closed</span>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">Support</h2>
            <p>For queries related to admissions, school fees, or online payments, please reach out via phone or email during working hours. We aim to respond within <strong className="text-gray-900">24–48 hours</strong>.</p>
          </section>

        </div>
      </main>

      <SpFooter logo={logo} active="contact" />
    </div>
  )
}

function ContactCard({ icon, label, children }) {
  return (
    <div className="rounded-2xl border border-teal-100 bg-teal-50 px-5 py-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">{label}</span>
      </div>
      <div className="text-sm text-gray-700">{children}</div>
    </div>
  )
}

function SpFooter({ logo, active }) {
  const links = [
    { to: '/spis/contact-us', label: 'Contact Us', key: 'contact' },
    { to: '/spis/terms-and-conditions', label: 'Terms & Conditions', key: 'terms' },
    { to: '/spis/privacy-policy', label: 'Privacy Policy', key: 'privacy' },
    { to: '/spis/refund-policy', label: 'Refund Policy', key: 'refund' },
  ]
  return (
    <footer className="border-t border-gray-100 py-8 mt-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {logo && <img src={logo} alt="SP International School" className="h-8 w-8 object-contain rounded-lg" />}
          <div>
            <p className="text-sm font-semibold text-gray-700">SP International School</p>
            <p className="text-xs text-gray-400">Sardar Patel Educational Society · Firozepur Cantt, Punjab</p>
          </div>
        </div>
        <div className="flex items-center flex-wrap justify-center gap-x-5 gap-y-1 text-xs">
          {links.map(l => active === l.key
            ? <span key={l.key} className="font-semibold text-gray-800">{l.label}</span>
            : <Link key={l.key} to={l.to} className="text-gray-400 hover:text-gray-700 transition-colors">{l.label}</Link>
          )}
        </div>
      </div>
    </footer>
  )
}
