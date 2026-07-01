# Milestone Crowdfunding - Önyüz Uygulaması (Frontend Application)

Bu dizin, kitlesel fonlama platformunun kullanıcı dostu, modern koyu tema (glassmorphism) tasarımlı React önyüzünü barındırır.

## 🚀 Entegre Edilmiş Akıllı Sözleşme Bilgileri

Önyüz uygulaması, **Stellar Testnet** ağı üzerinde canlı olarak çalışan aşağıdaki akıllı sözleşme ile etkileşim kurar:

- **Sözleşme Kimliği (Contract ID):** `CDCUX2DZJYL34HQQ73T4FUA6K6OQ64JF4GONGFZB2YUABHSCIXMGMGTA`
- **Native Token (SAC - XLM) Sözleşme Kimliği:** `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`
- **Yönetici (Admin) Genel Anahtarı:** `GD3FFTYDSGTQOUQGDTV3T3EE2WEQOB3YUVTO4VAHA4JUUACJDP3QYB47`
- **RPC Sunucusu:** `https://soroban-testnet.stellar.org`

> [!NOTE]
> Sözleşme yapılandırması [src/config.ts](src/config.ts) dosyası içerisinde saklanmaktadır.

---

## 🎨 Temel Özellikler

1. **Çoklu Cüzdan Entegrasyonu:** `Freighter`, `Albedo` ve `Hana` cüzdanları üzerinden doğrudan işlem imzalama.
2. **Sanal Geliştirici Cüzdanları (Mocking):** Eklenti kurma zahmeti olmadan anında test yapabilmek amacıyla:
   - **Sanal Bağışçı Cüzdanı:** Friendbot ile otomatik 10,000 XLM yüklü test hesabı açar.
   - **Sanal Yönetici Cüzdanı:** Proje yöneticisinin yerine yetkilendirme sağlar.
3. **İnteraktif Aşamalar (Roadmap):** Oylamalar ve kanıt gönderimleri interaktif yol haritası kartları içinden yönetilir.
4. **Blockchain Event Dinleyicisi:** Soroban RPC'si üzerinden canlı bağış ve oy hareketlerini dinleyerek arayüzü anında günceller.
5. **Kapsamlı Hata Yönetimi:** Yetersiz bakiye, cüzdan bulunamadı ve işlem iptal durumları şık Toast bildirimleriyle yönetilir.

---

## ⚙️ Kurulum ve Başlatma

Aşağıdaki komutları kullanarak önyüzü yerel bilgisayarınızda çalıştırabilirsiniz:

1. Bağımlılıkları yükleyin:
   ```bash
   npm install
   ```

2. Yerel geliştirme sunucusunu (Dev Server) başlatın:
   ```bash
   npm run dev
   ```
   *Uygulama varsayılan olarak `http://localhost:5173` adresinde çalışacaktır.*

3. Üretim paketi derleme (Production Build):
   ```bash
   npm run build
   ```
