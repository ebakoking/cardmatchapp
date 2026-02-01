/**
 * Email Service - Resend Entegrasyonu
 * 
 * Kurulum:
 * 1. https://resend.com adresinden hesap aç (GitHub ile giriş yapabilirsin)
 * 2. API Key oluştur
 * 3. Domain doğrula (veya onboarding@resend.dev kullan test için)
 * 4. .env dosyasına ekle:
 *    RESEND_API_KEY=re_xxxxx
 *    EMAIL_FROM=noreply@cardmatch.app (veya doğrulanmış domain)
 */

import axios from 'axios';

const RESEND_API_URL = 'https://api.resend.com/emails';

interface EmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Resend ile email gönder
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'CardMatch <onboarding@resend.dev>';

  // Development modunda gerçek email gönderme
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[EMAIL-DEV] To: ${options.to}`);
    console.log(`[EMAIL-DEV] Subject: ${options.subject}`);
    console.log(`[EMAIL-DEV] Body: ${options.text || options.html.substring(0, 200)}...`);
    return { success: true, id: 'dev-' + Date.now() };
  }

  // Production'da API key kontrolü
  if (!apiKey) {
    console.error('[EMAIL] Resend API key not configured');
    return { success: false, error: 'Email servisi yapılandırılmamış' };
  }

  try {
    const response = await axios.post(
      RESEND_API_URL,
      {
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    console.log(`[EMAIL] Sent successfully to ${options.to}, ID: ${response.data.id}`);
    return { success: true, id: response.data.id };
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || error.message;
    console.error('[EMAIL] Error:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Email doğrulama kodu gönder
 */
export async function sendVerificationEmail(email: string, code: string): Promise<EmailResult> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0B1020; color: #fff; padding: 40px; }
        .container { max-width: 480px; margin: 0 auto; background: #1a1f35; border-radius: 16px; padding: 40px; }
        .logo { text-align: center; font-size: 32px; font-weight: bold; margin-bottom: 24px; }
        .logo span { color: #6C5CE7; }
        h1 { font-size: 24px; text-align: center; margin-bottom: 16px; }
        .code { background: #6C5CE7; color: #fff; font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 20px; border-radius: 12px; margin: 24px 0; }
        .info { color: #888; font-size: 14px; text-align: center; line-height: 1.6; }
        .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #333; color: #666; font-size: 12px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">Card<span>Match</span></div>
        <h1>Email Doğrulama</h1>
        <p style="text-align: center; color: #ccc;">Hesabını doğrulamak için aşağıdaki kodu kullan:</p>
        <div class="code">${code}</div>
        <p class="info">
          Bu kod 5 dakika içinde geçerliliğini yitirecektir.<br>
          Eğer bu işlemi sen yapmadıysan, bu emaili görmezden gelebilirsin.
        </p>
        <div class="footer">
          &copy; 2026 CardMatch. Tüm hakları saklıdır.
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `CardMatch Email Doğrulama\n\nDoğrulama kodunuz: ${code}\n\nBu kod 5 dakika içinde geçerliliğini yitirecektir.\nEğer bu işlemi siz yapmadıysanız, bu emaili görmezden gelebilirsiniz.`;

  return sendEmail({
    to: email,
    subject: 'CardMatch - Email Doğrulama Kodu',
    html,
    text,
  });
}

/**
 * Hoş geldin emaili gönder
 */
export async function sendWelcomeEmail(email: string, nickname: string): Promise<EmailResult> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0B1020; color: #fff; padding: 40px; }
        .container { max-width: 480px; margin: 0 auto; background: #1a1f35; border-radius: 16px; padding: 40px; }
        .logo { text-align: center; font-size: 32px; font-weight: bold; margin-bottom: 24px; }
        .logo span { color: #6C5CE7; }
        h1 { font-size: 24px; text-align: center; margin-bottom: 16px; }
        p { color: #ccc; line-height: 1.8; }
        .highlight { color: #6C5CE7; font-weight: bold; }
        .tips { background: rgba(108, 92, 231, 0.1); border-radius: 12px; padding: 20px; margin: 24px 0; }
        .tips h3 { color: #6C5CE7; margin-top: 0; }
        .tips ul { color: #ccc; padding-left: 20px; }
        .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #333; color: #666; font-size: 12px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">Card<span>Match</span></div>
        <h1>Hoş Geldin, ${nickname}! 🎉</h1>
        <p>CardMatch ailesine katıldığın için çok mutluyuz!</p>
        <div class="tips">
          <h3>Başlarken İpuçları:</h3>
          <ul>
            <li>🔒 Anonimliğin bizim için önemli - gerçek adın gizli</li>
            <li>💬 Önce sohbet et, bağ kur</li>
            <li>🎴 Kart oyunlarıyla eğlenceli tanışmalar</li>
            <li>⭐ Profilini doğrulayarak güven kazan</li>
          </ul>
        </div>
        <p>Herhangi bir sorun yaşarsan <span class="highlight">support@cardmatch.app</span> adresinden bize ulaşabilirsin.</p>
        <div class="footer">
          &copy; 2026 CardMatch. Tüm hakları saklıdır.
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: 'CardMatch\'e Hoş Geldin! 🎉',
    html,
    text: `Hoş Geldin ${nickname}!\n\nCardMatch ailesine katıldığın için çok mutluyuz!\n\nHerhangi bir sorun yaşarsan support@cardmatch.app adresinden bize ulaşabilirsin.`,
  });
}
