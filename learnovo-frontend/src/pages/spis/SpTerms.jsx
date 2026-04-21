import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function SpTerms() {
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
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Terms &amp; Conditions</h1>
        <p className="text-sm text-gray-500 mb-10">SP International School — Sardar Patel Educational Society</p>

        <div className="space-y-8 text-sm leading-relaxed text-gray-600">

          <p>Welcome to <strong className="text-gray-900">SP International School</strong>, operated by <strong className="text-gray-900">Sardar Patel Educational Society</strong>. By accessing our website and using our services, you agree to the following terms:</p>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Services</h2>
            <p>The school provides educational services including admissions, academic programs, and online fee payment facilities.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. Payments</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>All payments are accepted in <strong className="text-gray-900">Indian Rupees (INR)</strong>.</li>
              <li>Payments include <strong className="text-gray-900">school fees and admission fees</strong>.</li>
              <li>Payments are processed through secure third-party payment gateways.</li>
              <li>The school is not responsible for transaction failures due to bank/server issues.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. No Cancellation</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Once a payment is made, it <strong className="text-gray-900">cannot be cancelled</strong> under any circumstances.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. No Refund Policy</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>All payments made are <strong className="text-gray-900">non-refundable</strong>.</li>
              <li>No refund will be issued once the payment is successfully processed.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. User Responsibility</h2>
            <p>Users must provide accurate details while making payments. The school is not responsible for incorrect information entered by the user.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Transaction Confirmation</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>A receipt will be generated upon successful payment.</li>
              <li>In case of payment failure, the amount will be automatically reversed as per bank norms.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Data Usage</h2>
            <p>User data collected during transactions will be used only for school administrative purposes.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Intellectual Property</h2>
            <p>All website content belongs to SP International School and cannot be reused without permission.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Governing Law</h2>
            <p>These terms are governed by the laws of India.</p>
          </section>

        </div>
      </main>

      <footer className="border-t py-8 border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} SP International School. All rights reserved.</p>
          <div className="flex items-center gap-6 text-sm">
            <Link to="/spis/contact-us" className="text-gray-500 hover:text-gray-900 hover:underline">Contact Us</Link>
            <Link to="/spis/privacy-policy" className="text-gray-500 hover:text-gray-900 hover:underline">Privacy Policy</Link>
            <Link to="/spis/refund-policy" className="text-gray-500 hover:text-gray-900 hover:underline">Refund Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
