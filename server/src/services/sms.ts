/**
 * SMS Service - Netgsm Entegrasyonu
 * 
 * Kurulum:
 * 1. https://www.netgsm.com.tr adresinden hesap aç
 * 2. API kullanıcı adı ve şifre al
 * 3. Gönderici adı (başlık) oluştur (örn: "CARDMATCH")
 * 4. .env dosyasına ekle:
 *    NETGSM_USERCODE=xxx
 *    NETGSM_PASSWORD=xxx
 *    NETGSM_HEADER=CARDMATCH
 */

import axios from 'axios';

const NETGSM_API_URL = 'https://api.netgsm.com.tr/sms/send/get';

interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Netgsm ile SMS gönder
 */
export async function sendSms(phoneNumber: string, message: string): Promise<SmsResult> {
  const usercode = process.env.NETGSM_USERCODE;
  const password = process.env.NETGSM_PASSWORD;
  const header = process.env.NETGSM_HEADER || 'CARDMATCH';

  // Development modunda gerçek SMS gönderme
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[SMS-DEV] To: ${phoneNumber}, Message: ${message}`);
    return { success: true, messageId: 'dev-' + Date.now() };
  }

  // Production'da API key kontrolü
  if (!usercode || !password) {
    console.error('[SMS] Netgsm credentials not configured');
    return { success: false, error: 'SMS servisi yapılandırılmamış' };
  }

  try {
    // Telefon numarasını formatla (başındaki + ve 0'ları kaldır)
    const formattedPhone = phoneNumber.replace(/^\+/, '').replace(/^0/, '');
    
    const response = await axios.get(NETGSM_API_URL, {
      params: {
        usercode,
        password,
        gsmno: formattedPhone,
        message,
        msgheader: header,
        filter: 0, // Filtreleme kapalı
        startdate: '', // Hemen gönder
        stopdate: '',
      },
      timeout: 10000,
    });

    const result = response.data.toString().trim();
    
    // Netgsm yanıt kodları
    // 00: Başarılı
    // 20: Mesaj metninde hata
    // 30: Geçersiz kullanıcı adı/şifre
    // 40: Gönderici adı sistemde tanımlı değil
    // 50: Bilinmeyen arama hatası
    // 60: Arama parametrelerinde hata
    // 70: Tanımlı olmayan hata
    
    if (result.startsWith('00')) {
      const messageId = result.split(' ')[1] || result;
      console.log(`[SMS] Sent successfully to ${formattedPhone}, ID: ${messageId}`);
      return { success: true, messageId };
    } else {
      console.error(`[SMS] Failed: ${result}`);
      return { success: false, error: `Netgsm error: ${result}` };
    }
  } catch (error: any) {
    console.error('[SMS] Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * OTP SMS gönder
 */
export async function sendOtpSms(phoneNumber: string, code: string): Promise<SmsResult> {
  const message = `CardMatch doğrulama kodunuz: ${code}\n\nBu kodu kimseyle paylaşmayın.`;
  return sendSms(phoneNumber, message);
}

/**
 * SMS bakiye sorgula
 */
export async function checkSmsBalance(): Promise<{ success: boolean; balance?: number; error?: string }> {
  const usercode = process.env.NETGSM_USERCODE;
  const password = process.env.NETGSM_PASSWORD;

  if (!usercode || !password) {
    return { success: false, error: 'Credentials not configured' };
  }

  try {
    const response = await axios.get('https://api.netgsm.com.tr/balance/list/get', {
      params: { usercode, password },
      timeout: 5000,
    });

    const result = response.data.toString().trim();
    const balance = parseFloat(result);
    
    if (!isNaN(balance)) {
      return { success: true, balance };
    }
    
    return { success: false, error: result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
