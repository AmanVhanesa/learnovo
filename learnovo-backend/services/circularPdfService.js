'use strict';

const pdfService = require('./pdfService');

const { getBrowser, releaseBrowser, fetchImageAsDataUri } = pdfService._internal;

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(date) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-IN', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

function buildSchoolFromSettings(settings, tenantFallbackName) {
  const inst = (settings && settings.institution) || {};
  const addr = inst.address;
  let addressStr = '';
  if (typeof addr === 'string') {
    addressStr = addr;
  } else if (addr && typeof addr === 'object') {
    addressStr = [addr.street, addr.city, addr.state, addr.pincode, addr.country]
      .filter(Boolean)
      .join(', ');
  }
  const contact = inst.contact || {};
  return {
    name: inst.name || tenantFallbackName || 'School',
    logo: (typeof inst.logo === 'object' ? inst.logo && inst.logo.url : inst.logo) || '',
    address: addressStr,
    phone: contact.phone || inst.phone || '',
    email: contact.email || inst.email || '',
    website: contact.website || '',
    affiliationNumber: inst.affiliationNumber || '',
    schoolCode: inst.schoolCode || '',
    udiseCode: inst.udiseCode || '',
    board: inst.board || '',
    tagline: inst.tagline || '',
    principalSignature: (typeof inst.principalSignature === 'object'
      ? inst.principalSignature && inst.principalSignature.url
      : inst.principalSignature) || ''
  };
}

function buildCircularHtml(circular, school) {
  const audience = (circular.targetAudience || []).includes('all')
    ? 'All Members'
    : (circular.targetAudience || []).map(a => a.charAt(0).toUpperCase() + a.slice(1)).join(', ');

  const classes = (circular.targetClasses || [])
    .map(c => (c && (c.name || c.grade)) || '')
    .filter(Boolean)
    .join(', ');

  const bodyHtml = escapeHtml(circular.body).replace(/\n/g, '<br/>');

  const logoHtml = school.logoDataUri
    ? `<div style="position:absolute;left:20px;top:14px;width:78px;height:78px;display:flex;align-items:center;justify-content:center;border-radius:6px;overflow:hidden"><img src="${school.logoDataUri}" style="width:78px;height:78px;object-fit:contain" /></div>`
    : '';

  const phoneEmail = [
    school.phone ? `Phone: ${school.phone}` : '',
    school.email ? `Email: ${school.email}` : ''
  ].filter(Boolean).join(' | ');

  const affiliationRow = (school.affiliationNumber || school.schoolCode || school.udiseCode)
    ? `<div style="display:flex;justify-content:center;gap:15px;margin-top:5px;flex-wrap:wrap">
        ${school.affiliationNumber ? `<span style="font-size:8px;color:#4b5563;font-weight:500;line-height:1.7">Affiliation No: <strong style="font-weight:700;color:#111827">${escapeHtml(school.affiliationNumber)}</strong></span>` : ''}
        ${school.schoolCode ? `<span style="font-size:8px;color:#4b5563;font-weight:500;line-height:1.7">School Code: <strong style="font-weight:700;color:#111827">${escapeHtml(school.schoolCode)}</strong></span>` : ''}
        ${school.udiseCode ? `<span style="font-size:8px;color:#4b5563;font-weight:500;line-height:1.7">UDISE: <strong style="font-weight:700;color:#111827">${escapeHtml(school.udiseCode)}</strong></span>` : ''}
      </div>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Circular ${escapeHtml(circular.circularNumber)}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  @page{size:A4 portrait;margin:0}
  html,body{margin:0;padding:0;background:#fff;width:210mm;height:297mm}
  body{font-family:'Helvetica Neue',Arial,sans-serif;color:#111827;font-size:13px;-webkit-font-smoothing:antialiased}
  .page{width:210mm;height:297mm;position:relative;overflow:hidden;background:#f9fafb;margin:0;page-break-after:avoid}
  .card{position:absolute;top:5mm;left:15mm;right:5mm;bottom:5mm;background:#fff;border-radius:14px;box-shadow:0 2px 24px rgba(0,0,0,0.07);overflow:hidden;display:flex;flex-direction:column}
  .deco{position:absolute;inset:0;pointer-events:none;z-index:0;overflow:hidden;border-radius:14px}
  .deco .c1{position:absolute;top:-60px;right:-40px;width:240px;height:240px;background:rgba(62,196,177,0.06);border-radius:50%}
  .deco .c2{position:absolute;bottom:-40px;left:-45px;width:195px;height:195px;background:rgba(62,196,177,0.05);border-radius:50%}
  .watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-family:Georgia,serif;font-size:64px;font-weight:700;color:rgba(62,196,177,0.05);letter-spacing:14px;white-space:nowrap;z-index:0;pointer-events:none;text-transform:uppercase}
  .content{position:relative;z-index:1;display:flex;flex-direction:column;flex:1;padding:0 0 22px 0}
  .header{position:relative;padding:16px 20px 10px;text-align:center;flex-shrink:0}
  .school-name{font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-size:21px;font-weight:800;color:#1F6F6D;letter-spacing:2px;line-height:1.1;text-transform:uppercase;white-space:nowrap}
  .school-tagline{font-size:8.5px;color:#0a5c56;font-weight:600;font-style:italic;margin-top:2px;letter-spacing:0.4px}
  .school-meta{font-size:9px;color:#4b5563;font-weight:500;margin-top:3px;line-height:1.5}
  .header-divider{height:1px;background:#e5e7eb;margin:0 20px;flex-shrink:0}
  .body-wrap{padding:0 26px;display:flex;flex-direction:column;flex:1}
  .badge-row{display:flex;justify-content:center;margin:18px 0 10px}
  .badge{background:#edf9f7;border-radius:10px;padding:10px 28px;display:inline-flex;align-items:center;justify-content:center;line-height:1}
  .badge-title{font-size:14px;font-weight:700;color:#0a5c56;letter-spacing:3.5px;text-transform:uppercase;line-height:1;text-align:center}
  .meta-row{display:flex;justify-content:space-between;align-items:center;padding:9px 14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;font-size:12px;color:#374151;flex-wrap:wrap;gap:6px}
  .meta-row strong{color:#111827;font-weight:700}
  .meta-row .num{color:#0a5c56;font-weight:700}
  .info-grid{display:grid;grid-template-columns:auto 1fr;gap:8px 18px;margin-top:14px;font-size:12.5px}
  .info-grid .lbl{color:#6b7280;font-weight:600;text-transform:uppercase;font-size:10px;letter-spacing:0.6px;padding-top:2px}
  .info-grid .val{color:#111827;font-weight:600}
  .subject{margin-top:16px;padding:12px 16px;background:#fff7ed;border-left:4px solid #f59e0b;border-radius:6px}
  .subject-lbl{font-size:10px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:5px}
  .subject-text{font-size:14px;font-weight:700;color:#111827;line-height:1.45}
  .body{margin-top:18px;font-size:13.5px;color:#1f2937;line-height:1.85;text-align:justify;white-space:normal}
  .signature{margin-top:auto;padding-top:24px;display:flex;justify-content:flex-end}
  .sig-block{text-align:center;min-width:240px;display:flex;flex-direction:column;align-items:center}
  .sig-img{max-height:120px;max-width:240px;object-fit:contain;margin-bottom:-8px}
  .sig-line{width:150px;height:1px;background:#9ca3af;margin:4px auto 4px}
  .sig-line-empty{width:150px;height:1px;background:#9ca3af;margin:60px auto 4px}
  .sig-name{font-size:11px;font-weight:700;color:#111827}
  .sig-desig{font-size:9px;color:#4b5563;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;margin-top:1px}
  .footer{padding:8px 0 0;border-top:1px solid #e5e7eb;text-align:center;margin-top:14px}
  .footer span{font-size:7.5px;color:#6b7280;font-weight:500;text-transform:uppercase;letter-spacing:1.4px}
  .footer .brand{font-weight:700;color:#0f766e}
</style>
</head>
<body>
  <div class="page">
    <div class="card">
      <div class="deco"><div class="c1"></div><div class="c2"></div></div>
      <div class="watermark">CIRCULAR</div>
      <div class="content">
        <div class="header">
          ${logoHtml}
          <div class="school-name">${escapeHtml(school.name || 'School Name')}</div>
          ${school.tagline ? `<div class="school-tagline">${escapeHtml(school.tagline)}</div>` : ''}
          ${school.address ? `<div class="school-meta">${escapeHtml(school.address)}</div>` : ''}
          ${phoneEmail ? `<div class="school-meta">${escapeHtml(phoneEmail)}</div>` : ''}
          ${affiliationRow}
        </div>
        <div class="header-divider"></div>

        <div class="body-wrap">
          <div class="badge-row">
            <div class="badge">
              <div class="badge-title">Circular</div>
            </div>
          </div>

          <div class="meta-row">
            <div><span class="num">#</span> <strong>${escapeHtml(circular.circularNumber)}</strong></div>
            <div>Date: <strong>${formatDate(circular.issueDate || circular.createdAt)}</strong></div>
          </div>

          <div class="info-grid">
            <div class="lbl">Title</div><div class="val">${escapeHtml(circular.title)}</div>
            <div class="lbl">To</div><div class="val">${escapeHtml(audience)}${classes ? ` — ${escapeHtml(classes)}` : ''}</div>
            ${circular.referenceNumber ? `<div class="lbl">Ref. No.</div><div class="val">${escapeHtml(circular.referenceNumber)}</div>` : ''}
            ${circular.category ? `<div class="lbl">Category</div><div class="val" style="text-transform:capitalize">${escapeHtml(circular.category)}</div>` : ''}
          </div>

          <div class="subject">
            <div class="subject-lbl">Subject</div>
            <div class="subject-text">${escapeHtml(circular.subject)}</div>
          </div>

          <div class="body">${bodyHtml}</div>

          <div class="signature">
            <div class="sig-block">
              ${school.principalSignatureDataUri
    ? `<img src="${school.principalSignatureDataUri}" class="sig-img" alt="Principal signature" /><div class="sig-line"></div>`
    : '<div class="sig-line-empty"></div>'}
              <div class="sig-name">${escapeHtml(circular.signedByDesignation || 'Principal')}</div>
              <div class="sig-desig">${escapeHtml(school.name || '')}</div>
            </div>
          </div>

          <div class="footer">
            <span>Powered by <span class="brand">Learnovo</span> — School Management System</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate a circular PDF buffer using shared Puppeteer instance.
 * @param {Object} circular - Circular doc (lean/plain object)
 * @param {Object} school - School metadata from Settings.institution
 * @returns {Promise<Buffer>}
 */
async function generateCircularPdf(circular, school) {
  // Resolve images to base64 data URIs so Puppeteer doesn't make HTTP calls
  // during page render (cached for 5 min in pdfService).
  const [logoDataUri, principalSignatureDataUri] = await Promise.all([
    school.logo ? fetchImageAsDataUri(school.logo) : Promise.resolve(null),
    school.principalSignature ? fetchImageAsDataUri(school.principalSignature) : Promise.resolve(null)
  ]);

  const html = buildCircularHtml(circular, {
    ...school,
    logoDataUri,
    principalSignatureDataUri
  });

  const browser = await getBrowser();
  let page;
  try {
    page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluateHandle('document.fonts.ready');

    const pdfUint8 = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });
    return Buffer.from(pdfUint8);
  } finally {
    if (page) {
      try {
        await page.close();
      } catch { /* ignore */ }
    }
    releaseBrowser();
  }
}

module.exports = {
  generateCircularPdf,
  buildSchoolFromSettings
};
