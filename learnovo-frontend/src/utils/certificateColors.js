/**
 * Shared color constants for certificates (TC, Bonafide, Character) and report cards.
 * Used by CertificatePreviewContent.jsx, printHelper.js, and ResultCard.jsx
 * to ensure consistent, print-friendly colors across preview, print, and PDF.
 *
 * All colors chosen for high contrast on paper — avoid anything lighter than
 * #888 for borders or #555 for text.
 */

export const CERT_COLORS = {
  // Header / title backgrounds
  headerBg: '#0d7377',
  headerText: '#FFFFFF',
  titleBadgeBg: '#0d7377',
  titleBadgeText: '#FFFFFF',

  // School name (when not on colored bg)
  schoolNameText: '#0a5c56',

  // Text hierarchy
  labelText: '#1a1a1a',
  valueText: '#333333',
  valueTextBold: '#111827',
  secondaryText: '#444444',
  subtleText: '#666666',
  mutedText: '#666666',

  // Table
  tableBorder: '#999999',
  tableRowAlt: '#f5f5f5',
  tableRowWhite: '#ffffff',
  tableNumberCol: '#333333',
  tableLabelText: '#1a1a1a',

  // Borders & lines
  borderColor: '#999999',
  borderLight: '#bbbbbb',
  signatureLine: '#555555',
  accentLine: '#888888',

  // Meta row
  metaBg: '#f5f5f5',
  metaBorder: '#999999',

  // Note box
  noteBg: '#f5f5f5',
  noteBorder: '#999999',
  noteTitle: '#333333',
  noteText: '#444444',

  // Certification / italic text
  certText: '#444444',

  // Signature labels
  sigLabelText: '#1a1a1a',

  // Footer
  footerText: '#666666',
  footerAccent: '#0a5c56',
  footerBorder: '#999999',

  // Bonafide specific
  bonafideSubheading: '#0a5c56',
  bonafideDetailBg: '#f0f7f6',
  bonafideDetailBorder: '#999999',
  bonafideDetailLabel: '#555555',

  // Decorative / watermark
  decoCircle1: 'rgba(13,115,119,0.08)',
  decoCircle2: 'rgba(13,115,119,0.05)',
  decoCircle3: 'rgba(13,115,119,0.06)',
  decoCircle4: 'rgba(13,115,119,0.04)',
  watermarkColor: 'rgba(13,115,119,0.05)',
  watermarkPreview: 'rgba(13,115,119,0.10)',

  // Accent (gradient line under title, hash symbol, highlight underline)
  accentColor: '#0d7377',
  accentGradient: 'linear-gradient(90deg, transparent, #0d7377, transparent)',
  highlightUnderline: 'rgba(13,115,119,0.4)',

  // Report card specific
  reportHeaderBorder: '#6B7280',
  reportTableBorder: '#999999',
  reportRowAlt: '#F3F4F6',
  reportFooterBorder: '#888888',
  reportStuCardBg: '#F3F4F6',
  reportStuCardBorder: '#999999',
  reportInfoLabel: '#333333',
  reportSectionLabel: '#333333',
};
