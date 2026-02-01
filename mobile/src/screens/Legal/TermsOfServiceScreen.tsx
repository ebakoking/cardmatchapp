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

type Props = NativeStackScreenProps<any, 'TermsOfService'>;

export default function TermsOfServiceScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kullanım Koşulları</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lastUpdated}>Son güncelleme: 28 Ocak 2026</Text>

        <Text style={styles.sectionTitle}>1. Hizmet Tanımı</Text>
        <Text style={styles.paragraph}>
          CardMatch, kullanıcıların anonim olarak tanışmasını ve sohbet etmesini 
          sağlayan bir mobil uygulamadır. Uygulamayı kullanarak bu Kullanım 
          Koşullarını kabul etmiş olursunuz.
        </Text>

        <Text style={styles.sectionTitle}>2. Hesap Oluşturma</Text>
        <Text style={styles.paragraph}>
          • Hizmeti kullanmak için 18 yaşında veya daha büyük olmalısınız{'\n'}
          • Doğru ve güncel bilgiler sağlamalısınız{'\n'}
          • Hesap bilgilerinizin güvenliğinden siz sorumlusunuz{'\n'}
          • Tek bir hesap oluşturabilirsiniz{'\n'}
          • Başka birinin hesabını kullanamazsınız
        </Text>

        <Text style={styles.sectionTitle}>3. Kabul Edilebilir Kullanım</Text>
        <Text style={styles.paragraph}>
          CardMatch'i kullanırken aşağıdaki kurallara uymalısınız:
        </Text>
        
        <Text style={styles.subTitle}>3.1 Yasak İçerikler</Text>
        <Text style={styles.paragraph}>
          Aşağıdaki içerikleri paylaşmak yasaktır:{'\n\n'}
          • Cinsel içerikli veya müstehcen materyaller{'\n'}
          • Nefret söylemi, ırkçılık, ayrımcılık{'\n'}
          • Şiddet içeren veya tehdit edici içerikler{'\n'}
          • Yasa dışı faaliyetleri teşvik eden içerikler{'\n'}
          • Başkalarının kişisel bilgileri{'\n'}
          • Sahte veya yanıltıcı bilgiler{'\n'}
          • Spam veya istenmeyen reklamlar{'\n'}
          • Telif hakkı ihlali içeren materyaller
        </Text>

        <Text style={styles.subTitle}>3.2 Yasak Davranışlar</Text>
        <Text style={styles.paragraph}>
          Aşağıdaki davranışlar yasaktır:{'\n\n'}
          • Taciz, zorbalık veya korkutma{'\n'}
          • Dolandırıcılık veya aldatma{'\n'}
          • Kimlik taklidi{'\n'}
          • Otomatik bot kullanımı{'\n'}
          • Sistemi manipüle etme girişimleri{'\n'}
          • Diğer kullanıcıları rahatsız etme{'\n'}
          • Ticari amaçlı kullanım (izinsiz)
        </Text>

        <Text style={styles.sectionTitle}>4. İçerik Moderasyonu</Text>
        <Text style={styles.paragraph}>
          • Kullanıcı şikayetlerini inceliyoruz{'\n'}
          • Kural ihlali tespit edilirse içerik kaldırılır{'\n'}
          • Ciddi ihlallerde hesap askıya alınır veya silinir{'\n'}
          • Yasa dışı içerikler yetkililere bildirilir{'\n'}
          • Moderasyon kararlarına itiraz edebilirsiniz
        </Text>

        <Text style={styles.sectionTitle}>5. Premium Özellikler ve Ödemeler</Text>
        <Text style={styles.paragraph}>
          • Uygulama içi satın alımlar App Store/Play Store üzerinden yapılır{'\n'}
          • Satın alınan elmaslar ve özellikler iade edilmez{'\n'}
          • Abonelikler otomatik yenilenir (iptal edilmedikçe){'\n'}
          • Fiyatlar değişebilir (mevcut abonelikler etkilenmez){'\n'}
          • Prime üyelik avantajları üyelik süresince geçerlidir
        </Text>

        <Text style={styles.sectionTitle}>6. Fikri Mülkiyet</Text>
        <Text style={styles.paragraph}>
          • CardMatch adı, logosu ve tasarımı bize aittir{'\n'}
          • Paylaştığınız içeriklerin haklarına siz sahipsiniz{'\n'}
          • Bize içerikleri gösterme ve dağıtma lisansı verirsiniz{'\n'}
          • Başkalarının içeriklerini izinsiz kullanamazsınız
        </Text>

        <Text style={styles.sectionTitle}>7. Sorumluluk Reddi</Text>
        <Text style={styles.paragraph}>
          • Hizmet "olduğu gibi" sunulmaktadır{'\n'}
          • Kesintisiz veya hatasız hizmet garantisi vermiyoruz{'\n'}
          • Kullanıcı içeriklerinden sorumlu değiliz{'\n'}
          • Kullanıcılar arası anlaşmazlıklara müdahil olmuyoruz{'\n'}
          • Dolaylı zararlardan sorumlu tutulamayız
        </Text>

        <Text style={styles.sectionTitle}>8. Güvenlik Uyarıları</Text>
        <Text style={styles.paragraph}>
          CardMatch anonim bir platformdur. Güvenliğiniz için:{'\n\n'}
          • Kişisel bilgilerinizi (adres, telefon vb.) paylaşmayın{'\n'}
          • Tanımadığınız kişilerle buluşurken dikkatli olun{'\n'}
          • Şüpheli davranışları bildirin{'\n'}
          • Para transferi veya hediye taleplerini reddedin{'\n'}
          • Rahatsız edici kullanıcıları engelleyin
        </Text>

        <Text style={styles.sectionTitle}>9. Hesap Sonlandırma</Text>
        <Text style={styles.paragraph}>
          • Hesabınızı istediğiniz zaman silebilirsiniz{'\n'}
          • Kural ihlalinde hesabınızı askıya alabiliriz{'\n'}
          • Ciddi ihlallerde hesap kalıcı olarak silinir{'\n'}
          • Silinen hesaplardaki veriler geri getirilemez{'\n'}
          • Satın alımlar hesap silindiğinde geçersiz olur
        </Text>

        <Text style={styles.sectionTitle}>10. Değişiklikler</Text>
        <Text style={styles.paragraph}>
          Bu koşulları güncelleyebiliriz. Önemli değişiklikler olduğunda 
          sizi bilgilendireceğiz. Değişikliklerden sonra uygulamayı 
          kullanmaya devam etmeniz, yeni koşulları kabul ettiğiniz anlamına gelir.
        </Text>

        <Text style={styles.sectionTitle}>11. Uyuşmazlık Çözümü</Text>
        <Text style={styles.paragraph}>
          • Bu koşullar Türkiye Cumhuriyeti yasalarına tabidir{'\n'}
          • Uyuşmazlıklarda İstanbul Mahkemeleri yetkilidir{'\n'}
          • Öncelikle dostane çözüm yolları denenmelidir
        </Text>

        <Text style={styles.sectionTitle}>12. İletişim</Text>
        <Text style={styles.paragraph}>
          Sorularınız için:{'\n\n'}
          E-posta: support@cardmatch.app{'\n'}
          Web: www.cardmatch.app/terms
        </Text>

        <View style={styles.agreement}>
          <Text style={styles.agreementText}>
            CardMatch'i kullanarak bu Kullanım Koşullarını ve Gizlilik 
            Politikasını okuduğunuzu ve kabul ettiğinizi onaylarsınız.
          </Text>
        </View>

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
  agreement: {
    marginTop: 32,
    padding: 16,
    backgroundColor: 'rgba(108, 92, 231, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(108, 92, 231, 0.3)',
  },
  agreementText: {
    fontSize: 13,
    color: '#6C5CE7',
    textAlign: 'center',
    lineHeight: 20,
  },
  bottomSpace: {
    height: 40,
  },
});
