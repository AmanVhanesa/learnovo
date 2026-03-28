import React from 'react';

/**
 * Shared certificate preview component that matches the backend PDF template design.
 * Used by both CertificateGeneration and CertificateManager preview modals.
 *
 * Props:
 *  - type: 'TC' | 'BONAFIDE'
 *  - data: certificate contentSnapshot or merged preview data
 *  - certificateNumber: string (or 'To be assigned')
 *  - showPreviewWatermark: boolean (default true)
 */
const CertificatePreviewContent = ({ type, data, certificateNumber, showPreviewWatermark = true }) => {
    const d = data || {};

    // TC table rows matching the PDF template exactly
    const tcRows = [
        ['Name of the Student', d.studentName],
        ["Father's / Guardian's Name", d.fatherName],
        ["Mother's Name", d.motherName],
        ['Nationality', d.nationality],
        ['Category (Gen / SC / ST / OBC)', d.category],
        ['Date of Birth', d.dob],
        ['Admission Number', d.admissionNumber],
        ['PEN Number', d.penNumber],
        ['Date of First Admission in School', d.admissionDate],
        ['Class in which Last Studied', d.class],
        ['Board Examination Last Taken', d.boardResult],
        ['Whether Qualified for Promotion', d.promotionStatus],
        ['Subjects Studied', d.subjects],
        ['Month up to which Fees Paid', d.feeStatus],
        ['General Conduct', d.conduct],
        ['Date of Application for Certificate', d.applicationDate],
        ['Date of Issue of Certificate', d.issueDate],
        ['Reason for Leaving the School', d.leavingReason],
        ['Any Other Remarks', d.remarks],
    ];

    const highlightRows = [0, 5, 9, 17]; // rows that get bold styling in PDF

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

    const cornerSvg = (
        <svg viewBox="0 0 70 70" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
            <path d="M4 66V14C4 8.477 8.477 4 14 4H66" stroke="#C9A84C" strokeWidth="2" strokeLinecap="round"/>
            <path d="M10 60V18C10 13.582 13.582 10 18 10H60" stroke="#1A2E5A" strokeWidth="1" strokeLinecap="round"/>
            <circle cx="4" cy="4" r="3" fill="#C9A84C"/>
            <circle cx="4" cy="4" r="1.5" fill="#1A2E5A"/>
            <path d="M4 42C4 42 8 38 12 38C16 38 16 44 12 44C8 44 8 38 12 34" stroke="#C9A84C" strokeWidth="0.8" fill="none" strokeLinecap="round"/>
            <path d="M42 4C42 4 38 8 38 12C38 16 44 16 44 12C44 8 38 8 34 12" stroke="#C9A84C" strokeWidth="0.8" fill="none" strokeLinecap="round"/>
            <path d="M4 26C6 24 10 24 10 28C10 32 4 30 4 26Z" stroke="#C9A84C" strokeWidth="0.5" fill="none"/>
            <path d="M26 4C24 6 24 10 28 10C32 10 30 4 26 4Z" stroke="#C9A84C" strokeWidth="0.5" fill="none"/>
            <rect x="14" y="11" width="4" height="4" transform="rotate(45 16 13)" fill="#C9A84C" opacity="0.4"/>
        </svg>
    );

    return (
        <div style={{
            width: '100%',
            maxWidth: 595,
            minHeight: 842,
            position: 'relative',
            overflow: 'hidden',
            background: '#FAFBFF',
            fontFamily: "'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
            color: '#1C1C2E',
            fontSize: 13,
            WebkitFontSmoothing: 'antialiased',
        }}>
            {/* Border frames */}
            <div style={{ position: 'absolute', inset: 6, border: '2.5px solid #1A2E5A', borderRadius: 10, pointerEvents: 'none', zIndex: 2 }} />
            <div style={{ position: 'absolute', inset: 11, border: '1.2px solid #C9A84C', pointerEvents: 'none', zIndex: 2 }} />
            <div style={{ position: 'absolute', inset: 14, border: '0.4px solid #1A2E5A', opacity: 0.3, pointerEvents: 'none', zIndex: 2 }} />

            {/* Gold accent dots */}
            <div style={{ position: 'absolute', top: -3, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, background: '#C9A84C', borderRadius: '50%', zIndex: 3, marginTop: 8.5 }} />
            <div style={{ position: 'absolute', bottom: -3, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, background: '#C9A84C', borderRadius: '50%', zIndex: 3, marginBottom: 8.5 }} />
            <div style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', width: 4, height: 4, background: '#C9A84C', borderRadius: '50%', zIndex: 3 }} />
            <div style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', width: 4, height: 4, background: '#C9A84C', borderRadius: '50%', zIndex: 3 }} />

            {/* Ornate corners */}
            <div style={{ position: 'absolute', width: 52, height: 52, top: 3, left: 3, zIndex: 3, pointerEvents: 'none' }}>{cornerSvg}</div>
            <div style={{ position: 'absolute', width: 52, height: 52, top: 3, right: 3, zIndex: 3, pointerEvents: 'none', transform: 'scaleX(-1)' }}>{cornerSvg}</div>
            <div style={{ position: 'absolute', width: 52, height: 52, bottom: 3, left: 3, zIndex: 3, pointerEvents: 'none', transform: 'scaleY(-1)' }}>{cornerSvg}</div>
            <div style={{ position: 'absolute', width: 52, height: 52, bottom: 3, right: 3, zIndex: 3, pointerEvents: 'none', transform: 'scale(-1,-1)' }}>{cornerSvg}</div>

            {/* Watermark */}
            <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%,-50%) rotate(-35deg)',
                fontFamily: "'Georgia', 'Times New Roman', serif",
                fontSize: type === 'TC' ? 44 : 54,
                fontWeight: 700,
                color: showPreviewWatermark ? 'rgba(26,46,90,0.06)' : 'rgba(26,46,90,0.03)',
                letterSpacing: type === 'TC' ? 10 : 14,
                whiteSpace: 'nowrap', zIndex: 1, pointerEvents: 'none',
                textTransform: 'uppercase',
            }}>
                {showPreviewWatermark ? 'PREVIEW' : (type === 'TC' ? 'LEAVING CERTIFICATE' : 'BONAFIDE')}
            </div>

            {/* Content wrapper */}
            <div style={{
                position: 'absolute',
                top: 17, left: 17, right: 17, bottom: 17,
                display: 'flex', flexDirection: 'column',
                zIndex: 4, overflow: 'hidden',
            }}>
                {/* Header band */}
                <div style={{
                    width: '100%', minHeight: type === 'TC' ? 100 : 110,
                    background: 'linear-gradient(135deg, #0F1F3D 0%, #1A2E5A 55%, #243F7A 100%)',
                    display: 'flex', alignItems: 'center',
                    padding: '10px 24px 8px',
                    position: 'relative', flexShrink: 0,
                    borderRadius: '6px 6px 0 0',
                }}>
                    {/* Gold underline */}
                    <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
                        background: 'linear-gradient(90deg, transparent 0%, #C9A84C 15%, #E8D48B 50%, #C9A84C 85%, transparent 100%)',
                    }} />
                    <div style={{ flex: 1, textAlign: 'center', padding: '0 10px' }}>
                        <div style={{
                            fontFamily: "'Georgia', 'Times New Roman', serif",
                            fontSize: 20, fontWeight: 700, color: '#FFFFFF',
                            letterSpacing: 1.2, lineHeight: 1.2, textTransform: 'uppercase',
                        }}>
                            {d.schoolName || 'School Name'}
                        </div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', marginTop: 6, lineHeight: 1.4 }}>
                            {d.schoolAddress}
                        </div>
                        {(d.schoolPhone || d.schoolEmail) && (
                            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>
                                {d.schoolPhone && `Phone: ${d.schoolPhone}`}
                                {d.schoolPhone && d.schoolEmail && ' | '}
                                {d.schoolEmail && `Email: ${d.schoolEmail}`}
                            </div>
                        )}
                        {(d.affiliationNumber || d.schoolCode || d.udiseCode) && (
                            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 4 }}>
                                {d.affiliationNumber && (
                                    <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.55)', letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 500 }}>
                                        Affiliation No: <span style={{ color: '#E8D48B', fontWeight: 600 }}>{d.affiliationNumber}</span>
                                    </span>
                                )}
                                {d.schoolCode && (
                                    <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.55)', letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 500 }}>
                                        School Code: <span style={{ color: '#E8D48B', fontWeight: 600 }}>{d.schoolCode}</span>
                                    </span>
                                )}
                                {d.udiseCode && (
                                    <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.55)', letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 500 }}>
                                        UDISE: <span style={{ color: '#E8D48B', fontWeight: 600 }}>{d.udiseCode}</span>
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Title section */}
                <div style={{ textAlign: 'center', padding: type === 'TC' ? '6px 30px 0' : '18px 30px 0', flexShrink: 0 }}>
                    <div style={{
                        fontFamily: "'Georgia', 'Times New Roman', serif",
                        fontSize: type === 'TC' ? 17 : 21,
                        fontWeight: 700, color: '#1A2E5A',
                        letterSpacing: type === 'TC' ? 4 : 5,
                        textTransform: 'uppercase',
                        display: 'inline-block', paddingBottom: 6, position: 'relative',
                    }}>
                        {type === 'TC' ? 'School Leaving Certificate' : 'Bonafide Certificate'}
                        <div style={{
                            position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
                            width: type === 'TC' ? 170 : 150, height: 1.5,
                            background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)',
                        }} />
                    </div>
                    {/* Diamond ornament */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 5 }}>
                        <div style={{ width: 35, height: 1, background: 'linear-gradient(90deg, transparent, #C9A84C)' }} />
                        <div style={{ width: 5, height: 5, background: '#C9A84C', transform: 'rotate(45deg)', flexShrink: 0 }} />
                        <div style={{ width: 35, height: 1, background: 'linear-gradient(90deg, #C9A84C, transparent)' }} />
                    </div>
                </div>

                {/* Cert meta row */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: type === 'TC' ? '6px 24px 0' : '14px 24px 0', flexShrink: 0,
                }}>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        background: '#F0F4FF', border: '1px solid #DDE3F0', borderRadius: 14,
                        padding: '2px 9px', fontSize: 10, fontWeight: 500, color: '#1A2E5A',
                    }}>
                        <span style={{ color: '#C9A84C', fontWeight: 700, fontSize: 10 }}>#</span>
                        {certificateNumber || 'To be assigned'}
                    </div>
                    <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 500 }}>
                        Date: <span style={{ color: '#1C1C2E', fontWeight: 600 }}>{d.issueDate || '-'}</span>
                    </div>
                </div>

                {/* ── TC CONTENT ── */}
                {type === 'TC' && (
                    <>
                        {/* Table */}
                        <div style={{ padding: '6px 24px 0', flexShrink: 0 }}>
                            <table style={{
                                width: '100%', borderCollapse: 'separate', borderSpacing: 0,
                                borderRadius: 6, overflow: 'hidden',
                                border: '1px solid #DDE3F0', fontSize: 10,
                            }}>
                                <tbody>
                                    {tcRows.map(([label, value], i) => {
                                        const isHighlight = highlightRows.includes(i);
                                        return (
                                            <tr key={i} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#F7F9FC' }}>
                                                <td style={{
                                                    width: 22, padding: '3px 8px', borderBottom: i < tcRows.length - 1 ? '1px solid #EDF0F7' : 'none',
                                                    fontWeight: 600, color: '#1C1C2E', textAlign: 'center', fontSize: 9,
                                                    verticalAlign: 'top', lineHeight: 1.25,
                                                }}>
                                                    {String(i + 1).padStart(2, '0')}
                                                </td>
                                                <td style={{
                                                    width: 185, padding: '3px 10px', borderBottom: i < tcRows.length - 1 ? '1px solid #EDF0F7' : 'none',
                                                    fontWeight: 600, color: '#1A2E5A', verticalAlign: 'top', lineHeight: 1.25,
                                                }}>
                                                    {label}
                                                </td>
                                                <td style={{
                                                    padding: '3px 10px', borderBottom: i < tcRows.length - 1 ? '1px solid #EDF0F7' : 'none',
                                                    color: isHighlight ? '#1A2E5A' : '#2D2D3F',
                                                    fontWeight: isHighlight ? 700 : 500,
                                                    verticalAlign: 'top', lineHeight: 1.25,
                                                    ...(label === 'Subjects Studied' ? { fontSize: 8, lineHeight: 1.5 } : {}),
                                                }}>
                                                    {value || '-'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Remarks note */}
                        <div style={{ padding: '3px 24px 0', flexShrink: 0 }}>
                            <div style={{
                                background: 'linear-gradient(135deg, #FFFBF0 0%, #FFF8E8 100%)',
                                border: '1px solid #EDE0C0', borderLeft: '3px solid #C9A84C',
                                borderRadius: 5, padding: '3px 10px',
                                fontSize: 8, color: '#5A4E30', lineHeight: 1.3,
                            }}>
                                <strong style={{ color: '#7B6520', fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 1 }}>
                                    Important Note
                                </strong>
                                This certificate is issued based on school records. No alteration shall be made on this certificate.
                                Erasing or overwriting renders it invalid.
                            </div>
                        </div>
                    </>
                )}

                {/* ── BONAFIDE CONTENT ── */}
                {type === 'BONAFIDE' && (
                    <>
                        <div style={{ padding: '16px 24px 0', flexShrink: 0 }}>
                            {/* To Whom It May Concern */}
                            <div style={{
                                fontFamily: "'Georgia', 'Times New Roman', serif",
                                fontSize: 12, fontWeight: 600, color: '#1A2E5A',
                                textAlign: 'center', letterSpacing: 2,
                                textTransform: 'uppercase', marginBottom: 16, position: 'relative',
                            }}>
                                To Whom It May Concern
                                <div style={{ width: 40, height: 1.5, background: '#C9A84C', margin: '6px auto 0' }} />
                            </div>

                            {/* Declaration paragraph */}
                            <p style={{ fontSize: 11, lineHeight: 1.95, color: '#2D2D3F', textAlign: 'justify' }}>
                                This is to certify that <span style={{ fontWeight: 700, color: '#1A2E5A', borderBottom: '1.5px solid rgba(201,168,76,0.4)' }}>{d.studentName}</span>,
                                Son/Daughter of Shri <span style={{ fontWeight: 700, color: '#1A2E5A', borderBottom: '1.5px solid rgba(201,168,76,0.4)' }}>{d.fatherName}</span>
                                {' '}and Smt. <span style={{ fontWeight: 700, color: '#1A2E5A', borderBottom: '1.5px solid rgba(201,168,76,0.4)' }}>{d.motherName}</span>,
                                is a bonafide student of this institution. He/She is currently studying in
                                Class <span style={{ fontWeight: 700, color: '#1A2E5A', borderBottom: '1.5px solid rgba(201,168,76,0.4)' }}>{d.class} ({d.section})</span>
                                {' '}for the Academic Session <span style={{ fontWeight: 700, color: '#1A2E5A', borderBottom: '1.5px solid rgba(201,168,76,0.4)' }}>{d.academicYear}</span>.
                                His/Her date of birth as per our school records is <span style={{ fontWeight: 700, color: '#1A2E5A', borderBottom: '1.5px solid rgba(201,168,76,0.4)' }}>{d.dob}</span>.
                            </p>

                            {/* Details grid */}
                            <div style={{
                                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px',
                                marginTop: 16, padding: '12px 16px',
                                background: 'linear-gradient(135deg, #F7F9FC 0%, #F0F4FF 100%)',
                                borderRadius: 8, border: '1px solid #E8ECF4',
                            }}>
                                {bonafideDetails.map(([label, value], i) => (
                                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                        <span style={{ fontSize: 7, fontWeight: 600, color: '#8891A5', textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</span>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: '#1A2E5A' }}>{value || '-'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Purpose */}
                        <div style={{ padding: '12px 24px 0', flexShrink: 0 }}>
                            <p style={{ fontSize: 10, color: '#4B5563', lineHeight: 1.75, textAlign: 'justify' }}>
                                This certificate is issued on the request of the student/parent for the purpose of{' '}
                                <span style={{ fontWeight: 700, color: '#1A2E5A' }}>{d.purpose || '-'}</span>.
                                No fees are due from the student at the time of issue of this certificate.
                            </p>
                        </div>
                    </>
                )}

                {/* Spacer */}
                <div style={{ flex: 1, minHeight: 4 }} />

                {/* Footer */}
                <div style={{ flexShrink: 0 }}>
                    {/* Footer note (TC only) */}
                    {type === 'TC' && (
                        <div style={{ padding: '0 28px 2px' }}>
                            <p style={{ fontSize: 7, color: '#8891A5', maxWidth: 260, lineHeight: 1.3, fontStyle: 'italic' }}>
                                Certified that the above information is in accordance with the school records.
                                This certificate does not entitle the holder to any benefits unless countersigned by the competent authority.
                            </p>
                        </div>
                    )}

                    {/* Place */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 28px 2px', fontSize: 9, color: '#6B7280', fontStyle: 'italic' }}>
                        <span>Place: {d.place || d.schoolAddress?.split(',').pop()?.trim() || '-'}</span>
                    </div>

                    {/* Signatures */}
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
                        padding: '0 32px 2px', height: 70,
                    }}>
                        <div style={{ textAlign: 'center', width: 120 }}>
                            <div style={{ width: 90, height: 1.2, background: '#1A2E5A', margin: '0 auto 3px' }} />
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#1A2E5A' }}>Class Teacher</div>
                        </div>
                        <div style={{ textAlign: 'center', width: 90 }}>
                            <div style={{
                                width: 75, height: 75, border: '2px dashed #C9A84C',
                                borderRadius: '50%', margin: '0 auto 2px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <span style={{ fontSize: 7, color: '#C9A84C', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, lineHeight: 1.3, textAlign: 'center' }}>
                                    School<br/>Seal
                                </span>
                            </div>
                        </div>
                        <div style={{ textAlign: 'center', width: 120 }}>
                            <div style={{ width: 90, height: 1.2, background: '#1A2E5A', margin: '0 auto 3px' }} />
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#1A2E5A' }}>Principal</div>
                        </div>
                    </div>

                    {/* Footer gradient bar */}
                    <div style={{
                        height: 18, width: '100%',
                        background: 'linear-gradient(135deg, #0F1F3D 0%, #1A2E5A 55%, #243F7A 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        position: 'relative', borderRadius: '0 0 6px 6px',
                    }}>
                        <div style={{
                            position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                            background: 'linear-gradient(90deg, transparent 0%, #C9A84C 15%, #E8D48B 50%, #C9A84C 85%, transparent 100%)',
                        }} />
                        <span style={{
                            fontSize: 6, color: 'rgba(255,255,255,0.5)',
                            letterSpacing: 2.5, textTransform: 'uppercase', fontWeight: 500,
                        }}>
                            Powered by Learnovo — School Management System
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CertificatePreviewContent;
