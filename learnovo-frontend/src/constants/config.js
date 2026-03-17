export const SERVER_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5001').replace(/\/api\/?$/, '')

// Payment gateway toggle: set to 'true' in .env when real gateway credentials are available
// When false: students submit manual payment proof for admin verification
// When true: students are redirected to payment gateway (Razorpay/Stripe/PayU)
export const PAYMENT_GATEWAY_ENABLED = import.meta.env.VITE_PAYMENT_GATEWAY_ENABLED === 'true'
