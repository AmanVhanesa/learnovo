import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function SpRefundPolicy() {
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
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Refund &amp; Cancellation Policy</h1>
        <p className="text-sm text-gray-500 mb-10">SP International School — Sardar Patel Educational Society</p>

        <div className="space-y-8 text-sm leading-relaxed text-gray-600">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. General Policy</h2>
            <p>All payments made through the SP International School portal are <strong className="text-gray-900">final and non-refundable</strong>.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. No Cancellation</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Payments once made <strong className="text-gray-900">cannot be cancelled</strong>.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. No Refunds</h2>
            <p className="mb-2">The school follows a <strong className="text-gray-900">strict no refund policy</strong> for:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>School fees</li>
              <li>Admission fees</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Failed Transactions</h2>
            <p>If any amount is deducted but the transaction fails, the amount will be automatically refunded by the bank/payment gateway within <strong className="text-gray-900">5–7 working days</strong>.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Contact</h2>
            <p className="mb-3">For any payment-related issues, contact:</p>
            <ul className="space-y-2">
              <li>
                <a href="mailto:spinternationalschool2021@gmail.com" className="text-blue-600 hover:underline">spinternationalschool2021@gmail.com</a>
              </li>
              <li>
                <a href="tel:+919888468343" className="text-blue-600 hover:underline">+91 98884 68343</a>
              </li>
            </ul>
          </section>

        </div>
      </main>

      <footer className="border-t py-8 border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} SP International School. All rights reserved.</p>
          <div className="flex items-center gap-6 text-sm">
            <Link to="/spis/contact-us" className="text-gray-500 hover:text-gray-900 hover:underline">Contact Us</Link>
            <Link to="/spis/privacy-policy" className="text-gray-500 hover:text-gray-900 hover:underline">Privacy Policy</Link>
            <Link to="/spis/terms-and-conditions" className="text-gray-500 hover:text-gray-900 hover:underline">Terms &amp; Conditions</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
