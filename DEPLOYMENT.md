# 🌐 Snake.io 3D - 7/24 Ücretsiz İnternet Sunucusu Kurulum Rehberi

Bu rehber, geliştirdiğimiz çok oyunculu (Multiplayer) 3D yılan oyununu dünyanın her yerinden insanların 7/24 oynayabileceği ücretsiz bir canlı web sitesine dönüştürme adımlarını anlatır.

---

### Yöntem 1: Render.com (Ücretsiz & En Çok Tercih Edilen)

[Render.com](https://render.com), Node.js ve WebSocket projelerini 7/24 ücretsiz olarak barındıran harika bir platformdur.

#### Adım 1: GitHub'a Yükleme
1. [GitHub](https://github.com) hesabınıza giriş yapın.
2. `snake3d` adında yeni bir **Public** depo (repository) oluşturun.
3. Bilgisayarınızdaki `C:\Users\mrdra\.gemini\antigravity-ide\scratch\snake3d` klasöründeki dosyaları bu depoya yükleyin (veya Git ile push edin).

#### Adım 2: Render.com Bağlantısı
1. [Render.com](https://render.com) sitesinde ücretsiz bir hesap açın.
2. Kontrol panelinde **"New +"** butonuna tıklayıp **"Web Service"** seçeneğini seçin.
3. GitHub hesabınızı bağlayıp yeni oluşturduğunuz `snake3d` deposunu seçin.
4. Ayarları şu şekilde doldurun:
   - **Name:** `snake3d-online` (veya istediğiniz bir isim)
   - **Environment:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`
5. **"Create Web Service"** butonuna tıklayın.

#### Adım 3: Oyuna Katılım
Render projenizi otomatik olarak derleyecek ve size `https://snake3d-online.onrender.com` gibi ücretsiz bir HTTPS bağlantı adresi verecektir. 
Bu bağlantıyı arkadaşlarınıza gönderdiğinizde herkes aynı canlı sunucuda buluşup birlikte oynayabilir!

---

### Yöntem 2: Kendi Bilgisayarınızı Anında Dış İnternete Açma (Test İçin)

Depoya yüklemeden anında canlıya almak isterseniz:

1. Terminalinizde sunucuyu başlatın:
   ```bash
   npm start
   ```
2. Başka bir terminal penceresinde bilgisayarınızı dış internete açın:
   ```bash
   npx localtunnel --port 3000
   ```
3. Ekranınızda beliren `https://xxx.loca.lt` adresini arkadaşlarınıza göndererek anında test edin.
