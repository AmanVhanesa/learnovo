import React from 'react';

/**
 * Shared certificate preview component that matches the backend minimal PDF template exactly.
 * Used by both CertificateGeneration and CertificateManager preview modals.
 *
 * Dimensions & fonts match the backend tc-minimal.html / bonafide-minimal.html templates
 * (794×1123 px A4 page, Playfair Display headings, Helvetica Neue body).
 *
 * Props:
 *  - type: 'TC' | 'BONAFIDE'
 *  - data: certificate contentSnapshot or merged preview data
 *  - certificateNumber: string (or 'To be assigned')
 *  - showPreviewWatermark: boolean (default true)
 */
const CertificatePreviewContent = ({ type, data, certificateNumber, showPreviewWatermark = true }) => {
    const d = data || {};

    // TC table rows matching the backend tc-minimal.html template exactly
    const tcRows = [
        ['Name of the Student', d.studentName, true],
        ["Father's / Guardian's Name", d.fatherName],
        ["Mother's Name", d.motherName],
        ['Nationality', d.nationality],
        ['Category (Gen / SC / ST / OBC)', d.category],
        ['Date of Birth', d.dob, true],
        ['PEN Number', d.penNumber],
        ['Date of First Admission in School', d.admissionDate],
        ['Class in which Last Studied', d.class, true],
        ['Board Examination Last Taken', d.boardResult],
        ['Whether Qualified for Promotion', d.promotionStatus],
        ['Subjects Studied', d.subjects],
        ['Month up to which Fees Paid', d.feeStatus],
        ['General Conduct', d.conduct],
        ['Date of Application for Certificate', d.applicationDate],
        ['Date of Issue of Certificate', d.issueDate],
        ['Reason for Leaving the School', d.leavingReason, true],
        ['Any Other Remarks', d.remarks],
    ];

    // Bonafide details grid items
    const bonafideDetails = [
        ['Student Name', d.studentName],
        ['Admission Number', d.admissionNumber],
        ["Father's Name", d.fatherName],
        ["Mother's Name", d.motherName],
        ['Class & Section', `${d.class || ''} - ${d.section || ''}`],
        ['Date of Birth', d.dob],
        ['Academic Session', d.academicYear],
        ['Board / Affiliation', d.schoolBoard || d.board || '-'],
    ];

    const hl = (text) => (
        <span style={{ fontWeight: 700, color: '#111827', borderBottom: '1.5px solid rgba(62,196,177,0.35)' }}>{text}</span>
    );

    return (
        <div style={{
            width: 794,
            height: 1123,
            position: 'relative',
            overflow: 'hidden',
            background: '#f9fafb',
            fontFamily: "'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
            color: '#111827',
            WebkitPrintColorAdjust: 'exact',
            printColorAdjust: 'exact',
            textRendering: 'optimizeLegibility',
            WebkitFontSmoothing: 'antialiased',
        }}>
            {/* White card — matches .card in backend */}
            <div style={{
                position: 'absolute',
                top: 14, left: 14, right: 14, bottom: 14,
                background: '#ffffff',
                borderRadius: 14,
                boxShadow: '0 2px 24px rgba(0,0,0,0.07)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
            }}>
                {/* Decorative background shapes — matches backend deco-shapes */}
                <div style={{ position: 'absolute', top: 0, right: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0, overflow: 'hidden', borderRadius: 14 }}>
                    <div style={{ position: 'absolute', top: -60, right: -40, width: 320, height: 320, background: 'rgba(62,196,177,0.06)', borderRadius: '50%' }} />
                    <div style={{ position: 'absolute', top: 80, right: -80, width: 240, height: 450, background: 'rgba(62,196,177,0.04)', transform: 'rotate(-25deg)', borderRadius: 80 }} />
                    <div style={{ position: 'absolute', bottom: -50, left: -60, width: 260, height: 260, background: 'rgba(62,196,177,0.05)', borderRadius: '50%' }} />
                    <div style={{ position: 'absolute', bottom: 120, left: 40, width: 160, height: 300, background: 'rgba(62,196,177,0.03)', transform: 'rotate(20deg)', borderRadius: 60 }} />
                </div>

                {/* Watermark */}
                <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%,-50%) rotate(-35deg)',
                    fontFamily: "'Georgia', 'Times New Roman', serif",
                    fontSize: type === 'TC' ? 54 : 64,
                    fontWeight: 700,
                    color: showPreviewWatermark ? 'rgba(62,196,177,0.08)' : 'rgba(62,196,177,0.04)',
                    letterSpacing: type === 'TC' ? 12 : 16,
                    whiteSpace: 'nowrap', zIndex: 0, pointerEvents: 'none',
                    textTransform: 'uppercase',
                }}>
                    {showPreviewWatermark ? 'PREVIEW' : (type === 'TC' ? 'LEAVING CERTIFICATE' : 'BONAFIDE')}
                </div>

                {/* All content above deco shapes */}
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1 }}>

                    {/* Header — matches backend .header */}
                    <div style={{ position: 'relative', padding: '18px 26px 10px', flexShrink: 0, minHeight: 120 }}>
                        {/* School Logo — matches backend .logo-wrap */}
                        {d.schoolLogo && (
                            <div style={{
                                position: 'absolute', left: 26, top: 10,
                                width: 100, height: 100, minWidth: 100,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                borderRadius: 8, overflow: 'hidden',
                            }}>
                                <img src={d.schoolLogo} alt="School Logo" style={{ width: 100, height: 100, objectFit: 'contain' }} />
                            </div>
                        )}
                        <div style={{ textAlign: 'center' }}>
                            <div style={{
                                fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif",
                                fontSize: 26, fontWeight: 800, color: '#1F6F6D',
                                letterSpacing: 1.5, lineHeight: 1.15, textTransform: 'uppercase',
                            }}>
                                {d.schoolName || 'School Name'}
                            </div>
                            <div style={{ fontSize: 11.5, color: '#4b5563', fontWeight: 500, marginTop: 3 }}>
                                {d.schoolAddress}
                            </div>
                            {(d.schoolPhone || d.schoolEmail) && (
                                <div style={{ fontSize: 11.5, color: '#4b5563', fontWeight: 500, marginTop: 3 }}>
                                    {d.schoolPhone && `Phone: ${d.schoolPhone}`}
                                    {d.schoolPhone && d.schoolEmail && '  |  '}
                                    {d.schoolEmail && `Email: ${d.schoolEmail}`}
                                </div>
                            )}
                            {(d.affiliationNumber || d.schoolCode || d.udiseCode) && (
                                <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 6, flexWrap: 'wrap' }}>
                                    {d.affiliationNumber && (
                                        <span style={{ fontSize: 10, color: '#4b5563', fontWeight: 500, lineHeight: 1.7 }}>
                                            Affiliation No: <strong style={{ fontWeight: 700, color: '#111827' }}>{d.affiliationNumber}</strong>
                                        </span>
                                    )}
                                    {d.schoolCode && (
                                        <span style={{ fontSize: 10, color: '#4b5563', fontWeight: 500, lineHeight: 1.7 }}>
                                            School Code: <strong style={{ fontWeight: 700, color: '#111827' }}>{d.schoolCode}</strong>
                                        </span>
                                    )}
                                    {d.udiseCode && (
                                        <span style={{ fontSize: 10, color: '#4b5563', fontWeight: 500, lineHeight: 1.7 }}>
                                            UDISE: <strong style={{ fontWeight: 700, color: '#111827' }}>{d.udiseCode}</strong>
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Header divider — matches backend .header-divider */}
                    <div style={{ height: 1, background: '#e5e7eb', margin: '0 26px', flexShrink: 0 }} />

                    {/* Title badge — matches backend .title-section */}
                    <div style={{ padding: '18px 26px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                        <div style={{
                            background: '#edf9f7', borderRadius: 10, padding: '12px 28px',
                            display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
                        }}>
                            <div style={{
                                fontFamily: "'Helvetica Neue', Arial, sans-serif",
                                fontSize: 16, fontWeight: 700, color: '#0a5c56',
                                letterSpacing: 4.5, textTransform: 'uppercase', lineHeight: 1,
                            }}>
                                {type === 'TC' ? 'School Leaving Certificate' : 'Bonafide Certificate'}
                            </div>
                        </div>
                    </div>

                    {/* Meta row — matches backend .meta-row */}
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: type === 'TC' ? '10px 26px' : '8px 26px', background: '#f9fafb',
                        borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb',
                        flexShrink: 0,
                    }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                            <span style={{ color: '#3EC4B1' }}>#</span> {certificateNumber || 'To be assigned'}
                        </div>
                        <div style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>
                            {type === 'TC' ? 'Admission No' : 'Date of Issue'}: <strong style={{ fontWeight: 700, color: '#111827' }}>
                                {type === 'TC' ? (d.admissionNumber || '-') : (d.issueDate || '-')}
                            </strong>
                        </div>
                    </div>

                    {/* ── TC CONTENT ── */}
                    {type === 'TC' && (
                        <>
                            {/* Table — matches backend .fields-wrap / .fields */}
                            <div style={{ margin: '8px 18px 0', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb', flexShrink: 0 }}>
                                <table style={{
                                    width: '100%', borderCollapse: 'separate', borderSpacing: 0,
                                    fontSize: 13,
                                }}>
                                    <tbody>
                                        {tcRows.map(([label, value, bold], i) => (
                                            <tr key={i} style={{ background: i % 2 === 0 ? '#f0fdfa' : '#ffffff' }}>
                                                <td style={{
                                                    width: 28, padding: '5px 12px',
                                                    borderBottom: i < tcRows.length - 1 ? '1px solid #e5e7eb' : 'none',
                                                    borderRight: '1px solid #e5e7eb',
                                                    fontWeight: 600, color: '#4b5563', textAlign: 'center', fontSize: 11,
                                                    verticalAlign: 'middle', lineHeight: 1.3,
                                                    paddingRight: 4,
                                                }}>
                                                    {String(i + 1).padStart(2, '0')}
                                                </td>
                                                <td style={{
                                                    width: '42%', padding: '5px 12px',
                                                    borderBottom: i < tcRows.length - 1 ? '1px solid #e5e7eb' : 'none',
                                                    borderRight: '1px solid #e5e7eb',
                                                    fontWeight: 600, color: '#1f2937', fontSize: 12.5,
                                                    verticalAlign: 'middle', lineHeight: 1.3,
                                                }}>
                                                    {label}
                                                </td>
                                                <td style={{
                                                    padding: '5px 12px',
                                                    borderBottom: i < tcRows.length - 1 ? '1px solid #e5e7eb' : 'none',
                                                    color: bold ? '#111827' : '#374151',
                                                    fontWeight: bold ? 700 : 500,
                                                    fontSize: 12.5,
                                                    verticalAlign: 'middle', lineHeight: 1.3,
                                                }}>
                                                    {value || '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Note box — matches backend .note-box */}
                            <div style={{ margin: '6px 18px 0', flexShrink: 0 }}>
                                <div style={{
                                    background: '#f9fafb', border: '1px solid #e5e7eb',
                                    borderRadius: 6, padding: '6px 12px',
                                }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                        Important Note
                                    </div>
                                    <p style={{ fontSize: 10.5, fontWeight: 500, color: '#4b5563', lineHeight: 1.5, marginTop: 2 }}>
                                        This certificate is issued based on school records. No alteration shall be made on this certificate. Erasing or overwriting renders it invalid.
                                    </p>
                                </div>
                            </div>

                            {/* Certification text — matches backend .cert-block */}
                            <div style={{ padding: '8px 26px 0', flexShrink: 0 }}>
                                <p style={{ fontSize: 10, color: '#4b5563', fontWeight: 500, fontStyle: 'italic', lineHeight: 1.45, maxWidth: '100%', marginBottom: 3 }}>
                                    Certified that the above information is in accordance with school records. This certificate does not entitle the holder to any benefits unless countersigned by competent authority.
                                </p>
                                <div style={{ fontSize: 11, color: '#111827', fontWeight: 600, marginBottom: 4 }}>
                                    Place: {d.place || d.schoolAddress?.split(',').pop()?.trim() || '-'}
                                </div>
                            </div>
                        </>
                    )}

                    {/* ── BONAFIDE CONTENT ── */}
                    {type === 'BONAFIDE' && (
                        <>
                            <div style={{ padding: '22px 30px 0', flexShrink: 0 }}>
                                {/* To Whom It May Concern — matches backend .to-whom */}
                                <div style={{
                                    fontFamily: "'Georgia', 'Times New Roman', serif",
                                    fontSize: 15, fontWeight: 600, color: '#0a5c56',
                                    textAlign: 'center', letterSpacing: 2,
                                    textTransform: 'uppercase', marginBottom: 18, position: 'relative',
                                }}>
                                    To Whom It May Concern
                                </div>

                                {/* Declaration paragraph — matches backend .declaration-text */}
                                <p style={{ fontSize: 14, lineHeight: 2, color: '#374151', fontWeight: 500, textAlign: 'justify' }}>
                                    This is to certify that {hl(d.studentName)},
                                    Son/Daughter of Shri {hl(d.fatherName)}
                                    {' '}and Smt. {hl(d.motherName)},
                                    is a bonafide student of this institution. He/She is currently studying in
                                    Class {hl(`${d.class} (${d.section})`)}
                                    {' '}for the Academic Session {hl(d.academicYear)}.
                                    His/Her date of birth as per our school records is {hl(d.dob)}.
                                </p>

                                {/* Details grid — matches backend .details-grid */}
                                <div style={{
                                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 28px',
                                    marginTop: 20, padding: '16px 22px',
                                    background: '#f0fdfa', borderRadius: 10, border: '1px solid #e5e7eb',
                                }}>
                                    {bonafideDetails.map(([label, value], i) => (
                                        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            <span style={{ fontSize: 9, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>
                                            <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{value || '-'}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Purpose — matches backend .purpose-section */}
                            <div style={{ padding: '16px 30px 0', flexShrink: 0 }}>
                                <p style={{ fontSize: 13, color: '#4b5563', fontWeight: 500, lineHeight: 1.8, textAlign: 'justify' }}>
                                    This certificate is issued on the request of the student/parent for the purpose of{' '}
                                    <span style={{ fontWeight: 700, color: '#111827' }}>{d.purpose || '-'}</span>.
                                    No fees are due from the student at the time of issue of this certificate.
                                </p>
                            </div>

                            {/* Certification — matches backend .cert-block */}
                            <div style={{ padding: '12px 30px 0', flexShrink: 0 }}>
                                <div style={{ fontSize: 11, color: '#111827', fontWeight: 600, marginTop: 4 }}>
                                    Place: {d.place || d.schoolAddress?.split(',').pop()?.trim() || '-'}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Spacer */}
                    <div style={{ flex: 1, minHeight: 6 }} />

                    {/* Signatures — matches backend .sig-section / .sig-row */}
                    <div style={{ padding: '0 26px 14px', flexShrink: 0 }}>
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
                            marginTop: 8, height: 120,
                        }}>
                            <div style={{ textAlign: 'center', width: 170, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
                                <div style={{ width: 110, height: 1, background: '#9ca3af', margin: '0 auto 4px' }} />
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.8 }}>Class Teacher</div>
                            </div>
                            <div style={{ textAlign: 'center', width: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
                                <div style={{
                                    width: 110, height: 110, border: '2px dashed #d1d5db',
                                    borderRadius: '50%', margin: '0 auto',
                                }} />
                            </div>
                            <div style={{ textAlign: 'center', width: 170, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
                                {d.principalSignature && (
                                    <img src={d.principalSignature} alt="Principal Signature" style={{ maxHeight: 120, maxWidth: 200, objectFit: 'contain', margin: '0 auto 4px', display: 'block' }} />
                                )}
                                <div style={{ width: 110, height: 1, background: '#9ca3af', margin: '0 auto 4px' }} />
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.8 }}>Principal</div>
                            </div>
                        </div>
                    </div>

                    {/* Footer — matches backend .footer */}
                    <div style={{
                        padding: '8px 26px', borderTop: '1px solid #e5e7eb',
                        textAlign: 'center', flexShrink: 0,
                    }}>
                        <span style={{
                            fontSize: 9, color: '#4b5563', fontWeight: 500,
                            textTransform: 'uppercase', letterSpacing: 1.5,
                        }}>
                            Powered by <span style={{ fontWeight: 600, color: '#0f766e' }}>Learnovo</span> — School Management System
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CertificatePreviewContent;
