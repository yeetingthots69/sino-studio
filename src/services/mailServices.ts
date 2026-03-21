'use server';
import {Resend} from 'resend';
import EmailTemplate from "@/data/EmailTemplate";

interface SendContactEmailParams {
    name: string;
    sender: string;
    purpose: string;
    content: string;
}

const resend = new Resend(process.env.RESEND_API_KEY!);

export default async function sendContactEmail({name, sender, purpose, content}: SendContactEmailParams): Promise<{
    success: boolean;
    error?: string
}> {
    try {
        const {error} = await resend.emails.send({
            from: 'contact@web.sinostudio.vn',
            to: 'contact@sinostudio.vn',
            subject: `Email từ website - ${purpose}`,
            react: EmailTemplate({name, sender, purpose, content}),
        });

        if (error) return {success: false, error: error.message};
        return {success: true};
    }
    catch {
        return {success: false, error: 'Failed to send email. Please try again later.'};
    }
}