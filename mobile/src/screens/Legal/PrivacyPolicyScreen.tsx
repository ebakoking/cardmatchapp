import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'PrivacyPolicy'>;

export default function PrivacyPolicyScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gizlilik Politikası</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lastUpdated}>Son güncelleme: 28 Ocak 2026</Text>

        <Text style={styles.sectionTitle}>1. Giriş</Text>
        <Text style={styles.paragraph}>
          CardMatch ("biz", "bizim" veya "Uygulama"), kullanıcılarımızın gizliliğine saygı duyar. 
          Bu Gizlilik Politikası, anonim sohbet uygulamamızı kullanırken hangi bilgileri 
          topladığımızı, nasıl kullandığımızı ve koruduğumuzu açıklar.
        </Text>

        <Text style={styles.sectionTitle}>2. Topladığımız Bilgiler</Text>
        
        <Text style={styles.subTitle}>2.1 Hesap Bilgileri</Text>
        <Text style={styles.paragraph}>
          • E-posta adresi veya telefon numarası (giriş için){'\n'}
          • Takma ad (nickname) - gerçek adınız değil{'\n'}
          • Doğum tarihi (yaş doğrulaması için){'\n'}
          • Cinsiyet (eşleştirme tercihleri için)
        </Text>

        <Text style={styles.subTitle}>2.2 Profil Bilgileri</Text>
        <Text style={styles.paragraph}>
          • Avatar seçimi (anonim profil resmi){'\n'}
          • Biyografi{'\n'}
          • İlgi alanları{'\n'}
          • Profil fotoğrafları (sadece arkadaşlarınız görebilir)
        </Text>

        <Text style={styles.subTitle}>2.3 Konum Bilgileri</Text>
        <Text style={styles.paragraph}>
          Yakınınızdaki kullanıcıları bulabilmek için konum bilginizi kullanırız. 
          Konum bilgisi yaklaşık olarak saklanır ve diğer kullanıcılarla 
          paylaşılmaz. İstediğiniz zaman konum erişimini kapatabilirsiniz.
        </Text>

        <Text style={styles.subTitle}>2.4 Sohbet İçerikleri</Text>
        <Text style={styles.paragraph}>
          • Mesajlar sunucularımızda şifreli olarak saklanır{'\n'}
          • Fotoğraf, video ve sesli mesajlar{'\n'}
          • Sohbet geçmişi sadece sizin ve muhatabınızın erişimine açıktır
        </Text>

        <Text style={styles.subTitle}>2.5 Teknik Bilgiler</Text>
        <Text style={styles.paragraph}>
          • Cihaz türü ve işletim sistemi{'\n'}
          • Uygulama sürümü{'\n'}
          • IP adresi (güvenlik amaçlı){'\n'}
          • Uygulama kullanım istatistikleri
        </Text>

        <Text style={styles.sectionTitle}>3. Bilgileri Nasıl Kullanıyoruz</Text>
        <Text style={styles.paragraph}>
          • Hesabınızı oluşturmak ve yönetmek{'\n'}
          • Anonim eşleştirme sağlamak{'\n'}
          • Mesajlarınızı iletmek{'\n'}
          • Uygulama güvenliğini sağlamak{'\n'}
          • Sahte hesapları tespit etmek{'\n'}
          • Kullanıcı deneyimini iyileştirmek{'\n'}
          • Yasal yükümlülükleri yerine getirmek
        </Text>

        <Text style={styles.sectionTitle}>4. Anonimlik</Text>
        <Text style={styles.paragraph}>
          CardMatch anonim bir sohbet uygulamasıdır:{'\n\n'}
          • Gerçek adınız diğer kullanıcılara gösterilmez{'\n'}
          • Profil fotoğraflarınız sadece arkadaş listenizdekilere görünür{'\n'}
          • Eşleşmelerde sadece takma adınız ve avatarınız paylaşılır{'\n'}
          • Konum bilginiz "X km uzakta" şeklinde yaklaşık gösterilir
        </Text>

        <Text style={styles.sectionTitle}>5. Bilgi Paylaşımı</Text>
        <Text style={styles.paragraph}>
          Kişisel bilgilerinizi üçüncü taraflarla SATMAYIZ. Bilgilerinizi yalnızca 
          şu durumlarda paylaşabiliriz:{'\n\n'}
          • Yasal zorunluluk (mahkeme kararı vb.){'\n'}
          • Güvenlik tehditleri{'\n'}
          • Hizmet sağlayıcılarımız (sunucu, ödeme işlemcisi){'\n'}
          • Açık rızanız ile
        </Text>

        <Text style={styles.sectionTitle}>6. Veri Güvenliği</Text>
        <Text style={styles.paragraph}>
          • Tüm veriler SSL/TLS ile şifrelenir{'\n'}
          • Şifreler hash algoritması ile saklanır{'\n'}
          • Düzenli güvenlik denetimleri yapılır{'\n'}
          • Sunucularımız güvenli veri merkezlerinde barındırılır
        </Text>

        <Text style={styles.sectionTitle}>7. Veri Saklama</Text>
        <Text style={styles.paragraph}>
          • Hesap bilgileriniz hesabınız aktif olduğu sürece saklanır{'\n'}
          • Silinen mesajlar 30 gün içinde kalıcı olarak silinir{'\n'}
          • Hesabınızı sildiğinizde tüm verileriniz 90 gün içinde silinir{'\n'}
          • Yasal gereklilikler için bazı bilgiler daha uzun süre saklanabilir
        </Text>

        <Text style={styles.sectionTitle}>8. Haklarınız</Text>
        <Text style={styles.paragraph}>
          KVKK ve GDPR kapsamında şu haklara sahipsiniz:{'\n\n'}
          • Verilerinize erişim hakkı{'\n'}
          • Verilerin düzeltilmesini isteme hakkı{'\n'}
          • Verilerin silinmesini isteme hakkı{'\n'}
          • Veri taşınabilirliği hakkı{'\n'}
          • İtiraz hakkı
        </Text>

        <Text style={styles.sectionTitle}>9. Çocukların Gizliliği</Text>
        <Text style={styles.paragraph}>
          CardMatch 18 yaş ve üzeri kullanıcılar içindir. 18 yaşından küçük 
          bireylerin kişisel bilgilerini bilerek toplamıyoruz. Böyle bir durum 
          tespit edilirse hesap derhal silinir.
        </Text>

        <Text style={styles.sectionTitle}>10. Çerezler ve Takip</Text>
        <Text style={styles.paragraph}>
          Mobil uygulamamızda tarayıcı çerezleri kullanmıyoruz. Ancak uygulama 
          performansını ölçmek için anonim analiz verileri toplayabiliriz.
        </Text>

        <Text style={styles.sectionTitle}>11. Değişiklikler</Text>
        <Text style={styles.paragraph}>
          Bu politikayı zaman zaman güncelleyebiliriz. Önemli değişiklikler 
          olduğunda sizi uygulama içinden bilgilendireceğiz.
        </Text>

        <Text style={styles.sectionTitle}>12. İletişim</Text>
        <Text style={styles.paragraph}>
          Gizlilik ile ilgili sorularınız için:{'\n\n'}
          E-posta: privacy@cardmatch.app{'\n'}
          Web: www.cardmatch.app/privacy
        </Text>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1020',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  lastUpdated: {
    fontSize: 12,
    color: '#888',
    marginTop: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginTop: 24,
    marginBottom: 12,
  },
  subTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6C5CE7',
    marginTop: 16,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 22,
  },
  bottomSpace: {
    height: 40,
  },
});
