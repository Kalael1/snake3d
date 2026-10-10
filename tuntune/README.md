# TUNTUNE

Eski bir Android telefonu (Redmi Note 10, Android 12) **sadece müzik çalara** çeviren, Spotify tarzı, tamamen çevrimdışı bir uygulama.

## Özellikler
- Ana sayfa, Arama ve Kitaplık sekmeleri (Spotify tarzı koyu tema)
- Albümler, sanatçılar, şarkılar; albüm kapakları
- Çalma listeleri: oluştur, yeniden adlandır, sil, şarkı ekle/çıkar, sırala
- Beğenilen Şarkılar ve En Çok Dinlenenler
- Sıradakiler listesi, sonra çal, sıraya ekle
- Karıştır, tekrarla, uyku zamanlayıcısı
- Kilit ekranı, bildirim ve kulaklık tuşlarıyla kontrol
- Kaldığı yerden devam etme
- **Kiosk modu:** telefon açılınca sadece TUNTUNE görünür, PIN olmadan çıkılamaz

## 1. Derleme ve yükleme (Android Studio)
1. Android Studio → **Open** → bu `tuntune` klasörünü seç.
2. Gradle senkronizasyonunun bitmesini bekle (ilk seferde birkaç dakika sürer).
   "Android Gradle Plugin güncellemesi" önerisi çıkarsa şimdilik **Don't ask / Kapat** diyebilirsin.
3. Telefonu USB ile bağla; üstteki cihaz listesinde telefonun görünmeli.
4. Yeşil **▶ Run** butonuna bas. Uygulama telefona yüklenip açılır.

## 2. Kiosk modu (sadece müzik çalar)
1. Telefonda **tüm hesapları kaldır** (Ayarlar → Hesaplar: Google ve Mi hesabı).
2. Bilgisayarda komut istemini aç ve çalıştır:
   ```
   %LOCALAPPDATA%\Android\Sdk\platform-tools\adb shell dpm set-device-owner com.tuntune.player/.kiosk.AdminReceiver
   ```
   `Success: Device owner set to package ...` yazmalı.
3. TUNTUNE → Ayarlar (⚙) → **PIN'i değiştir** (varsayılan: `0000`).
4. Ayarlar → **Kiosk modunu aç**.

Çıkmak için: Ayarlar → **Kiosk modundan çık** → PIN.
Tamamen geri almak için: Ayarlar → **Kiosk yetkisini tamamen kaldır** → PIN.
