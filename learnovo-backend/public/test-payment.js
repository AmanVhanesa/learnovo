// ── Helper: Add log entry ───────────────────────────────
function log(message, type) {
  type = type || 'info';
  const el = document.getElementById('log');
  const time = new Date().toLocaleTimeString();
  el.innerHTML += `<span class="${  type  }">[${  time  }] ${  message  }</span>\n`;
  el.scrollTop = el.scrollHeight;
}

// ── Helper: Set active step ─────────────────────────────
function setStep(num) {
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById(`step${  i}`);
    el.className = 'step';
    if (i < num) el.className = 'step done';
    if (i === num) el.className = 'step active';
  }
}

// ══════════════════════════════════════════════════════════
// THE MAIN PAYMENT FUNCTION
// This is what runs when the parent clicks "Pay Now"
// ══════════════════════════════════════════════════════════
async function startPayment() {
  const backendUrl = document.getElementById('backendUrl').value.replace(/\/$/, '');
  const token = document.getElementById('jwtToken').value.trim();
  const invoiceId = document.getElementById('invoiceId').value.trim();

  // ── Validate inputs ─────────────────────────────────
  if (!token) {
    log('ERROR: Please enter your JWT token', 'error');
    return;
  }
  if (!invoiceId) {
    log('ERROR: Please enter an Invoice ID', 'error');
    return;
  }

  const btn = document.getElementById('payBtn');
  btn.disabled = true;
  btn.textContent = 'Processing...';

  try {
    // ════════════════════════════════════════════════
    // STEP 2: CREATE ORDER
    // ════════════════════════════════════════════════
    setStep(2);
    log('Creating order on backend...', 'info');

    const orderResponse = await fetch(`${backendUrl  }/api/fee-payments/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${  token}`
      },
      body: JSON.stringify({ invoiceId: invoiceId })
    });

    const orderData = await orderResponse.json();

    if (!orderData.success) {
      throw new Error(orderData.message || 'Failed to create order');
    }

    log(`Order created: ${  orderData.data.orderId}`, 'success');
    log(`Amount: Rs ${  orderData.data.amountInRupees  } (${  orderData.data.amount  } paise)`, 'info');

    if (orderData.data.mock) {
      log('MOCK MODE: Razorpay keys not configured. Simulating payment...', 'info');
      setStep(3);
      await simulateMockPayment(backendUrl, token, orderData.data);
      return;
    }

    // ════════════════════════════════════════════════
    // STEP 3: OPEN RAZORPAY CHECKOUT POPUP
    // ════════════════════════════════════════════════
    setStep(3);
    log('Opening Razorpay checkout popup...', 'info');

    // Load Razorpay script dynamically if not loaded
    if (typeof Razorpay === 'undefined') {
      log('Loading Razorpay script...', 'info');
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://checkout.razorpay.com/v1/checkout.js';
        s.onload = resolve;
        s.onerror = function() {
          reject(new Error('Failed to load Razorpay'));
        };
        document.head.appendChild(s);
      });
    }

    const options = {
      key: orderData.data.razorpayKeyId,
      amount: orderData.data.amount,
      currency: orderData.data.currency,
      name: 'Learnovo',
      description: `Fee Payment - ${  orderData.data.invoiceNumber}`,
      order_id: orderData.data.orderId,

      handler: async function(response) {
        log('Payment completed! Verifying...', 'success');
        log(`Payment ID: ${  response.razorpay_payment_id}`, 'info');

        setStep(4);

        try {
          const verifyResponse = await fetch(`${backendUrl  }/api/fee-payments/verify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${  token}`
            },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            })
          });

          const verifyData = await verifyResponse.json();

          if (verifyData.success) {
            log('PAYMENT VERIFIED SUCCESSFULLY!', 'success');
            log(`Receipt: ${  verifyData.data.receiptNumber}`, 'success');
            log(`Invoice: ${  verifyData.data.invoiceNumber  } is now updated`, 'success');
          } else {
            log(`Verification failed: ${  verifyData.message}`, 'error');
          }
        } catch (err) {
          log(`Verification request failed: ${  err.message}`, 'error');
        }

        btn.disabled = false;
        btn.textContent = 'Pay Now';
      },

      modal: {
        ondismiss: function() {
          log('Payment popup closed by user (not paid)', 'error');
          btn.disabled = false;
          btn.textContent = 'Pay Now';
          setStep(1);
        }
      },

      prefill: { name: '', email: '', contact: '' },
      theme: { color: '#4f46e5' }
    };

    const rzp = new Razorpay(options);

    rzp.on('payment.failed', (response) => {
      log(`Payment failed: ${  response.error.description}`, 'error');
      log(`Error code: ${  response.error.code}`, 'error');
      btn.disabled = false;
      btn.textContent = 'Pay Now';
      setStep(1);
    });

    rzp.open();

  } catch (err) {
    log(`Error: ${  err.message}`, 'error');
    btn.disabled = false;
    btn.textContent = 'Pay Now';
    setStep(1);
  }
}

// ── Mock payment simulation (for development) ───────────
async function simulateMockPayment(backendUrl, token, orderData) {
  log('Simulating payment in mock mode...', 'info');

  setStep(4);
  const mockResponse = {
    razorpay_order_id: orderData.orderId,
    razorpay_payment_id: `pay_mock_${  Date.now()}`,
    razorpay_signature: 'mock_signature_for_testing'
  };

  try {
    const verifyResponse = await fetch(`${backendUrl  }/api/fee-payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${  token}`
      },
      body: JSON.stringify(mockResponse)
    });

    const verifyData = await verifyResponse.json();

    if (verifyData.success) {
      log('MOCK PAYMENT VERIFIED!', 'success');
      log(`Receipt: ${  verifyData.data.receiptNumber}`, 'success');
    } else {
      log(`Mock verification failed: ${  verifyData.message}`, 'error');
    }
  } catch (err) {
    log(`Mock verify failed: ${  err.message}`, 'error');
  }

  const btn = document.getElementById('payBtn');
  btn.disabled = false;
  btn.textContent = 'Pay Now';
}

// ── Initialize ──────────────────────────────────────────
setStep(1);
log('Ready. Fill in the config and click Pay Now.', 'info');

document.getElementById('payBtn').addEventListener('click', () => {
  log('Button clicked, starting payment...', 'info');
  startPayment().catch((err) => {
    log(`Unhandled error: ${  err.message}`, 'error');
  });
});
