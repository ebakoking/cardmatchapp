// Burç hesaplama utility

export interface ZodiacSign {
  name: string;
  nameTR: string;
  emoji: string;
  element: string;
  dateRange: string;
}

const ZODIAC_SIGNS: ZodiacSign[] = [
  { name: 'Capricorn', nameTR: 'Oğlak', emoji: '♑', element: 'Toprak', dateRange: '22 Aralık - 19 Ocak' },
  { name: 'Aquarius', nameTR: 'Kova', emoji: '♒', element: 'Hava', dateRange: '20 Ocak - 18 Şubat' },
  { name: 'Pisces', nameTR: 'Balık', emoji: '♓', element: 'Su', dateRange: '19 Şubat - 20 Mart' },
  { name: 'Aries', nameTR: 'Koç', emoji: '♈', element: 'Ateş', dateRange: '21 Mart - 19 Nisan' },
  { name: 'Taurus', nameTR: 'Boğa', emoji: '♉', element: 'Toprak', dateRange: '20 Nisan - 20 Mayıs' },
  { name: 'Gemini', nameTR: 'İkizler', emoji: '♊', element: 'Hava', dateRange: '21 Mayıs - 20 Haziran' },
  { name: 'Cancer', nameTR: 'Yengeç', emoji: '♋', element: 'Su', dateRange: '21 Haziran - 22 Temmuz' },
  { name: 'Leo', nameTR: 'Aslan', emoji: '♌', element: 'Ateş', dateRange: '23 Temmuz - 22 Ağustos' },
  { name: 'Virgo', nameTR: 'Başak', emoji: '♍', element: 'Toprak', dateRange: '23 Ağustos - 22 Eylül' },
  { name: 'Libra', nameTR: 'Terazi', emoji: '♎', element: 'Hava', dateRange: '23 Eylül - 22 Ekim' },
  { name: 'Scorpio', nameTR: 'Akrep', emoji: '♏', element: 'Su', dateRange: '23 Ekim - 21 Kasım' },
  { name: 'Sagittarius', nameTR: 'Yay', emoji: '♐', element: 'Ateş', dateRange: '22 Kasım - 21 Aralık' },
];

/**
 * Gün ve aya göre burç hesapla
 */
export function getZodiacSign(day: number, month: number): ZodiacSign | null {
  if (day < 1 || day > 31 || month < 1 || month > 12) {
    return null;
  }

  // Burç sınırları (gün, ay formatında)
  const zodiacDates: { sign: ZodiacSign; startDay: number; startMonth: number; endDay: number; endMonth: number }[] = [
    { sign: ZODIAC_SIGNS[3], startDay: 21, startMonth: 3, endDay: 19, endMonth: 4 },   // Koç
    { sign: ZODIAC_SIGNS[4], startDay: 20, startMonth: 4, endDay: 20, endMonth: 5 },   // Boğa
    { sign: ZODIAC_SIGNS[5], startDay: 21, startMonth: 5, endDay: 20, endMonth: 6 },   // İkizler
    { sign: ZODIAC_SIGNS[6], startDay: 21, startMonth: 6, endDay: 22, endMonth: 7 },   // Yengeç
    { sign: ZODIAC_SIGNS[7], startDay: 23, startMonth: 7, endDay: 22, endMonth: 8 },   // Aslan
    { sign: ZODIAC_SIGNS[8], startDay: 23, startMonth: 8, endDay: 22, endMonth: 9 },   // Başak
    { sign: ZODIAC_SIGNS[9], startDay: 23, startMonth: 9, endDay: 22, endMonth: 10 },  // Terazi
    { sign: ZODIAC_SIGNS[10], startDay: 23, startMonth: 10, endDay: 21, endMonth: 11 }, // Akrep
    { sign: ZODIAC_SIGNS[11], startDay: 22, startMonth: 11, endDay: 21, endMonth: 12 }, // Yay
    { sign: ZODIAC_SIGNS[0], startDay: 22, startMonth: 12, endDay: 19, endMonth: 1 },  // Oğlak
    { sign: ZODIAC_SIGNS[1], startDay: 20, startMonth: 1, endDay: 18, endMonth: 2 },   // Kova
    { sign: ZODIAC_SIGNS[2], startDay: 19, startMonth: 2, endDay: 20, endMonth: 3 },   // Balık
  ];

  for (const { sign, startDay, startMonth, endDay, endMonth } of zodiacDates) {
    // Oğlak burcu özel durum (yıl geçişi)
    if (startMonth > endMonth) {
      if ((month === startMonth && day >= startDay) || (month === endMonth && day <= endDay)) {
        return sign;
      }
    } else {
      if ((month === startMonth && day >= startDay) || (month === endMonth && day <= endDay)) {
        return sign;
      }
      if (month > startMonth && month < endMonth) {
        return sign;
      }
    }
  }

  return null;
}

/**
 * Burç için eğlenceli mesaj
 */
export function getZodiacMessage(sign: ZodiacSign): string {
  const messages: Record<string, string> = {
    'Koç': 'Cesur ve tutkulu bir ruhun var!',
    'Boğa': 'Sadık ve güvenilir birisin!',
    'İkizler': 'İletişim ustası, sosyal bir kelebek!',
    'Yengeç': 'Duygusal derinliğin eşsiz!',
    'Aslan': 'Doğal bir lider, parlayan bir yıldız!',
    'Başak': 'Detaylara takılan mükemmeliyetçi!',
    'Terazi': 'Uyum ve dengenin simgesi!',
    'Akrep': 'Gizemli ve tutkulu bir ruh!',
    'Yay': 'Özgür ruhlu bir maceracı!',
    'Oğlak': 'Kararlı ve hırslı bir karakter!',
    'Kova': 'Yenilikçi ve bağımsız düşünceli!',
    'Balık': 'Hayalperest ve empatik bir kalp!',
  };

  return messages[sign.nameTR] || 'Harika bir burçsun!';
}
