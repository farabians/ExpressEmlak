// Yalnızca yönetim paneli tarafından kullanılır (admin.js).
// Bu dosya GitHub Pages deploy'undan çıkarılır (.github/workflows/static.yml),
// böylece yetkili e-posta adresleri site ziyaretçilerine servis edilmez.
//
// NOT: Bu liste yalnızca arayüz kolaylığıdır - paneli kimin göreceğini belirler.
// Gerçek yetkilendirme sunucu tarafındaki firestore.rules / storage.rules
// dosyalarındaki aynı listeyle yapılır. Buradaki bir adresi değiştirirken
// o iki dosyayı da güncelleyip Firebase Console'dan yayınlamak gerekir.
export const ALLOWED_EMAILS = [
  "osmangundemir1@gmail.com",
  "expressinsaatgayrimenkul@gmail.com",
  "ab.sametdundar@gmail.com",
  "ipekcimipek@gmail.com"
];
