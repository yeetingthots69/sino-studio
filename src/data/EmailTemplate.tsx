interface EmailTemplateProps {
    name: string;
    sender: string;
    purpose: string;
    content: string;
}

export default function EmailTemplate({ name, sender, purpose, content }: EmailTemplateProps) {
    return (
        <div style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", backgroundColor: '#f4f4f4', padding: '32px 16px', margin: 0 }}>
            <div style={{ maxWidth: '600px', margin: '0 auto', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>

                {/* Header */}
                <div style={{ backgroundColor: '#111111', padding: '32px 40px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '4px', height: '32px', backgroundColor: '#e03131', borderRadius: '2px', flexShrink: 0 }} />
                        <div>
                            <p style={{ margin: 0, color: '#ffffff', fontSize: '20px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                Sino Studio
                            </p>
                            <p style={{ margin: 0, color: '#888888', fontSize: '12px', letterSpacing: '0.04em' }}>
                                Website Contact Form
                            </p>
                        </div>
                    </div>
                </div>

                {/* Red accent bar */}
                <div style={{ height: '3px', backgroundColor: '#e03131' }} />

                {/* Body */}
                <div style={{ backgroundColor: '#ffffff', padding: '40px' }}>
                    <p style={{ margin: '0 0 24px', color: '#111111', fontSize: '16px' }}>
                        Xin chào <strong>{name}</strong>,
                    </p>
                    <p style={{ margin: '0 0 32px', color: '#444444', fontSize: '15px', lineHeight: '1.6' }}>
                        Bạn vừa nhận được một tin nhắn mới từ website.
                    </p>

                    {/* Info block */}
                    <div style={{ backgroundColor: '#f9f9f9', border: '1px solid #e8e8e8', borderRadius: '6px', padding: '24px', marginBottom: '32px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <tbody>
                                <tr>
                                    <td style={{ padding: '8px 0', color: '#888888', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', paddingRight: '16px', verticalAlign: 'top' }}>
                                        Người gửi
                                    </td>
                                    <td style={{ padding: '8px 0', color: '#111111', fontSize: '14px', verticalAlign: 'top' }}>
                                        {sender}
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '8px 0', color: '#888888', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', paddingRight: '16px', verticalAlign: 'top', borderTop: '1px solid #e8e8e8' }}>
                                        Mục đích
                                    </td>
                                    <td style={{ padding: '8px 0', color: '#111111', fontSize: '14px', verticalAlign: 'top', borderTop: '1px solid #e8e8e8' }}>
                                        {purpose}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Message */}
                    <p style={{ margin: '0 0 8px', color: '#888888', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Nội dung
                    </p>
                    <div style={{ backgroundColor: '#f9f9f9', border: '1px solid #e8e8e8', borderLeft: '3px solid #e03131', borderRadius: '0 6px 6px 0', padding: '20px 24px' }}>
                        <p style={{ margin: 0, color: '#333333', fontSize: '15px', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>
                            {content}
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ backgroundColor: '#111111', padding: '24px 40px', borderTop: '1px solid #222222' }}>
                    <p style={{ margin: 0, color: '#555555', fontSize: '12px', lineHeight: '1.6', textAlign: 'center' }}>
                        Email này được gửi tự động từ website{' '}
                        <span style={{ color: '#e03131' }}>sinostudio.vn</span>.
                        Vui lòng không trả lời email này.
                    </p>
                </div>

            </div>
        </div>
    );
}