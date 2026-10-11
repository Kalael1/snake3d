# TUNTUNE SYNC

Bilgisayardan telefona **kablosuz** müzik aktarımı. Telefon ve bilgisayar aynı Wi-Fi ağında olmalı
(telefon uçak modundayken Wi-Fi açılabilir; internet gerekmez).

## Kurulum (bir kerelik)
1. Python 3.8 veya üstü: https://www.python.org/downloads/
   Kurarken **"Add python.exe to PATH"** kutusunu işaretle.
2. (İsteğe bağlı) Sürükle-bırak için `surukle-birak-kur.bat` dosyasına çift tıkla.
3. (İsteğe bağlı) Python gerektirmeyen tek bir program istersen `exe-yap.bat` → `dist\TUNTUNE SYNC.exe`.

## Kullanım
1. Telefonda: **TUNTUNE → Settings → Wi-Fi transfer**. Ekranda 4 haneli kod görünür.
2. Bilgisayarda: **TUNTUNE SYNC.bat** dosyasına çift tıkla.
   Windows Güvenlik Duvarı sorarsa **"Özel ağlar" için izin ver**.
3. Telefon otomatik bulunur. Kodu gir → **CONNECT**.

| Sekme | Ne yapar |
|---|---|
| **01 SEND** | Şarkıları/klasörleri sürükle-bırak ya da seç → telefona gider |
| **02 SYNC** | Bir klasör seç; telefonda olmayan şarkılar gönderilir (telefondan bir şey silinmez). "Bağlanınca otomatik senkronla" açıksa her bağlantıda kendiliğinden çalışır |
| **03 PHONE** | Telefondaki şarkıları ara, gör, sil |

- Şarkılar telefonda **Music/TUNTUNE** klasörüne kaydedilir ve hemen kitaplıkta görünür.
- Aynı isim ve boyutta bir şarkı zaten varsa tekrar gönderilmez.
- TUNTUNE'un eklemediği bir şarkıyı silerken Android telefonda onay ister:
  transfer ekranındaki **ONAYLA** butonuna bas.
- Telefon bulunamazsa IP adresini (transfer ekranında yazar) PHONE kutusuna elle yazabilirsin.

Yazı tipi: Chakra Petch (SIL Open Font License, `fonts/OFL.txt`).
