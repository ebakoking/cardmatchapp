# Build ve Sonraki Eklemeler – Unutma

## Sıra

1. **Önce:** Son aldığımız iOS build’i yap / TestFlight’a gönder (mevcut kodla).
2. **Sonra:** Eklemeleri yapacağız:
   - Backend’de IAP doğrulama (receipt / transactionId)
   - Elmas: `transactionId` + duplicate kontrolü
   - Boost: (zaten duplicate var) receipt doğrulama
   - Prime: socket’te transactionId / receipt doğrulama

Bu not, önce build alınsın diye; eklemeler build sonrası yapılacak.
