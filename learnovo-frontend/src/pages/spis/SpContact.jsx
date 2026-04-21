import { Link } from 'react-router-dom'
import { ArrowLeft, MapPin, Phone, Mail, Globe, Clock } from 'lucide-react'

export default function SpContact() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
          <Link to="/login" className="flex items-center gap-2 text-sm font-medium hover:opacity-70 transition-opacity">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <h1 className="text-3xl sm:text-4xl font-bold mb-1">Contact Us</h1>
        <p className="text-sm text-gray-500 mb-10">We're here to help</p>

        <div className="space-y-8 text-sm leading-relaxed text-gray-600">

          <section>
            <h2 className="text-xl font-bold text-gray-900">SP International School</h2>
            <p className="text-gray-500 italic mt-1">"The Future Begins Here!"</p>
            <p className="mt-2">Managed by: <strong className="text-gray-900">Sardar Patel Educational Society</strong></p>
          </section>

          <section className="space-y-3">
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 mt-0.5 text-gray-400 shrink-0" />
              <span>A.L.G Road, Firozepur Cantt, Punjab – 152003, India</span>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-gray-400 shrink-0" />
              <a href="tel:+919888468343" className="text-blue-600 hover:underline">+91 98884 68343</a>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-gray-400 shrink-0" />
              <a href="mailto:spinternationalschool2021@gmail.com" className="text-blue-600 hover:underline">spinternationalschool2021@gmail.com</a>
            </div>
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-gray-400 shrink-0" />
              <a href="https://spinternationalschool.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">spinternationalschool.com</a>
            </div>
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-gray-400 shrink-0" />
              <a href="https://spis.learnovoportal.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">spis.learnovoportal.com</a>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Working Hours
            </h2>
            <ul className="space-y-1">
              <li><strong className="text-gray-900">Monday – Saturday:</strong> 8:00 AM – 4:00 PM</li>
              <li><strong className="text-gray-900">Sunday:</strong> Closed</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Support</h2>
            <p>For any queries related to admissions, school fees, or online payments, please contact us via phone or email. We aim to respond within 24–48 hours.</p>
          </section>

        </div>
      </main>

      <footer className="border-t py-8 border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} SP International School. All rights reserved.</p>
          <div className="flex items-center gap-6 text-sm">
            <Link to="/spis/privacy-policy" className="text-gray-500 hover:text-gray-900 hover:underline">Privacy Policy</Link>
            <Link to="/spis/terms-and-conditions" className="text-gray-500 hover:text-gray-900 hover:underline">Terms &amp; Conditions</Link>
            <Link to="/spis/refund-policy" className="text-gray-500 hover:text-gray-900 hover:underline">Refund Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
