const Settings = require('../models/Settings');

// Currency formatting options
const CURRENCY_OPTIONS = {
  INR: {
    symbol: '₹',
    position: 'before',
    decimalPlaces: 2,
    thousandSeparator: ',',
    decimalSeparator: '.'
  },
  USD: {
    symbol: '$',
    position: 'before',
    decimalPlaces: 2,
    thousandSeparator: ',',
    decimalSeparator: '.'
  },
  EUR: {
    symbol: '€',
    position: 'after',
    decimalPlaces: 2,
    thousandSeparator: '.',
    decimalSeparator: ','
  },
  GBP: {
    symbol: '£',
    position: 'before',
    decimalPlaces: 2,
    thousandSeparator: ',',
    decimalSeparator: '.'
  },
  JPY: {
    symbol: '¥',
    position: 'before',
    decimalPlaces: 0,
    thousandSeparator: ',',
    decimalSeparator: '.'
  }
};

// Format currency amount
exports.formatCurrency = (amount, currency = 'INR', options = {}) => {
  try {
    // Get currency options
    const currencyOptions = CURRENCY_OPTIONS[currency.toUpperCase()] || CURRENCY_OPTIONS.INR;

    // Merge with custom options
    const finalOptions = { ...currencyOptions, ...options };

    // Format number
    const formattedNumber = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: finalOptions.decimalPlaces,
      maximumFractionDigits: finalOptions.decimalPlaces
    }).format(amount);

    // Add currency symbol
    if (finalOptions.position === 'before') {
      return `${finalOptions.symbol}${formattedNumber}`;
    } else {
      return `${formattedNumber} ${finalOptions.symbol}`;
    }
  } catch (error) {
    console.error('Currency formatting error:', error);
    return `${currency} ${amount}`;
  }
};

// Format currency with system settings
exports.formatCurrencyWithSettings = async(amount, currency = null) => {
  try {
    const settings = await Settings.getSettings();
    const systemCurrency = currency || settings.currency.default;

    return exports.formatCurrency(amount, systemCurrency, {
      symbol: settings.currency.symbol,
      position: settings.currency.position,
      decimalPlaces: settings.currency.decimalPlaces,
      thousandSeparator: settings.currency.thousandSeparator,
      decimalSeparator: settings.currency.decimalSeparator
    });
  } catch (error) {
    console.error('Currency formatting with settings error:', error);
    return exports.formatCurrency(amount, currency);
  }
};

// Convert currency (requires external API)
exports.convertCurrency = async(amount, fromCurrency, toCurrency) => {
  try {
    // For demo purposes, using static conversion rates
    // In production, integrate with a real currency API like exchangerate.host
    const conversionRates = {
      INR: { USD: 0.012, EUR: 0.011, GBP: 0.009, JPY: 1.8 },
      USD: { INR: 83.0, EUR: 0.92, GBP: 0.79, JPY: 150 },
      EUR: { INR: 90.0, USD: 1.09, GBP: 0.86, JPY: 163 },
      GBP: { INR: 105.0, USD: 1.27, EUR: 1.16, JPY: 190 }
    };

    if (fromCurrency === toCurrency) {
      return amount;
    }

    const rate = conversionRates[fromCurrency]?.[toCurrency];
    if (!rate) {
      throw new Error(`Conversion rate not available for ${fromCurrency} to ${toCurrency}`);
    }

    return Math.round(amount * rate * 100) / 100; // Round to 2 decimal places
  } catch (error) {
    console.error('Currency conversion error:', error);
    throw error;
  }
};

// Get all supported currencies
exports.getSupportedCurrencies = () => {
  return Object.keys(CURRENCY_OPTIONS).map(currency => ({
    code: currency,
    name: getCurrencyName(currency),
    symbol: CURRENCY_OPTIONS[currency].symbol,
    position: CURRENCY_OPTIONS[currency].position
  }));
};

// Get currency name
const getCurrencyName = (currency) => {
  const names = {
    INR: 'Indian Rupee',
    USD: 'US Dollar',
    EUR: 'Euro',
    GBP: 'British Pound',
    JPY: 'Japanese Yen'
  };
  return names[currency] || currency;
};

// Parse currency string to number
exports.parseCurrency = (currencyString) => {
  try {
    // Remove currency symbols and spaces
    const cleaned = currencyString.replace(/[^\d.,-]/g, '');

    // Handle different decimal separators
    const normalized = cleaned.replace(',', '.');

    return parseFloat(normalized) || 0;
  } catch (error) {
    console.error('Currency parsing error:', error);
    return 0;
  }
};

// Validate currency code
exports.isValidCurrency = (currency) => {
  return Object.keys(CURRENCY_OPTIONS).includes(currency.toUpperCase());
};

// Get currency info
exports.getCurrencyInfo = (currency) => {
  return CURRENCY_OPTIONS[currency.toUpperCase()] || null;
};

// Format multiple amounts
exports.formatMultipleCurrencies = (amounts, currency = 'INR') => {
  const formatted = {};

  for (const [key, amount] of Object.entries(amounts)) {
    formatted[key] = exports.formatCurrency(amount, currency);
  }

  return formatted;
};

// Calculate totals with currency formatting
exports.calculateTotals = (items, currency = 'INR') => {
  const totals = {
    subtotal: 0,
    tax: 0,
    discount: 0,
    total: 0
  };

  // Calculate subtotal
  totals.subtotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);

  // Calculate tax (assuming 18% GST for India)
  if (currency === 'INR') {
    totals.tax = totals.subtotal * 0.18;
  }

  // Calculate total
  totals.total = totals.subtotal + totals.tax - totals.discount;

  // Format all amounts
  return exports.formatMultipleCurrencies(totals, currency);
};

// Export all functions
module.exports = {
  formatCurrency: exports.formatCurrency,
  formatCurrencyWithSettings: exports.formatCurrencyWithSettings,
  convertCurrency: exports.convertCurrency,
  getSupportedCurrencies: exports.getSupportedCurrencies,
  parseCurrency: exports.parseCurrency,
  isValidCurrency: exports.isValidCurrency,
  getCurrencyInfo: exports.getCurrencyInfo,
  formatMultipleCurrencies: exports.formatMultipleCurrencies,
  calculateTotals: exports.calculateTotals
};
