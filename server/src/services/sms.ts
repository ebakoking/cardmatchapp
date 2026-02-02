/**
 * SMS Service - Twilio Verify Entegrasyonu
 * 
 * Kurulum:
 * 1. https://www.twilio.com adresinden hesap aç
 * 2. Verify Service oluştur
 * 3. .env dosyasına ekle:
 *    TWILIO_ACCOUNT_SID=ACxxx
 *    TWILIO_AUTH_TOKEN=xxx
 *    TWILIO_VERIFY_SERVICE_SID=VAxxx
 */

import axios from 'axios';

interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface VerifyResult {
  success: boolean;
  status?: string;
  error?: string;
}

const getTwilioAuth = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  return {
    accountSid,
    authToken,
    auth: accountSid && authToken ? {
      username: accountSid,
      password: authToken
    } : null
  };
};

/**
 * Twilio Verify ile OTP gönder
 */
export async function sendOtpSms(phoneNumber: string, _code?: string): Promise<SmsResult> {
  const { accountSid, auth } = getTwilioAuth();
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  // Test modu: Twilio yapılandırılmamışsa
  if (!accountSid || !serviceSid) {
    console.log(`[SMS] Twilio not configured, test mode active`);
    return { success: false, error: 'SMS servisi yapılandırılmamış' };
  }

  try {
    // Telefon numarasını E.164 formatına çevir
    let formattedPhone = phoneNumber;
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }

    console.log(`[SMS] Sending verification to ${formattedPhone}`);

    const response = await axios.post(
      `https://verify.twilio.com/v2/Services/${serviceSid}/Verifications`,
      new URLSearchParams({
        To: formattedPhone,
        Channel: 'sms'
      }),
      {
        auth,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 15000
      }
    );

    console.log(`[SMS] Verification sent, status: ${response.data.status}`);
    return { success: true, messageId: response.data.sid };
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || error.message;
    console.error('[SMS] Twilio error:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Twilio Verify ile OTP doğrula
 */
export async function verifyOtpCode(phoneNumber: string, code: string): Promise<VerifyResult> {
  const { accountSid, auth } = getTwilioAuth();
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!accountSid || !serviceSid) {
    console.log(`[SMS] Twilio not configured, skipping verification`);
    return { success: false, error: 'SMS servisi yapılandırılmamış' };
  }

  try {
    // Telefon numarasını E.164 formatına çevir
    let formattedPhone = phoneNumber;
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }

    console.log(`[SMS] Verifying code for ${formattedPhone}`);

    const response = await axios.post(
      `https://verify.twilio.com/v2/Services/${serviceSid}/VerificationCheck`,
      new URLSearchParams({
        To: formattedPhone,
        Code: code
      }),
      {
        auth,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000
      }
    );

    const status = response.data.status;
    console.log(`[SMS] Verification check status: ${status}`);

    if (status === 'approved') {
      return { success: true, status };
    } else {
      return { success: false, status, error: 'Kod geçersiz veya süresi dolmuş' };
    }
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || error.message;
    console.error('[SMS] Twilio verify error:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Eski sendSms fonksiyonu (geriye uyumluluk için)
 */
export async function sendSms(phoneNumber: string, message: string): Promise<SmsResult> {
  console.log(`[SMS] sendSms called but using Verify service. Message: ${message}`);
  return sendOtpSms(phoneNumber);
}
