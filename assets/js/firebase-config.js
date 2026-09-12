// Firebase bağlantısı - tüm sayfaların tek kaynağı.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCtA0h7ZHuuMInAQGoKcfTtthnImZ_Xk_E",
  authDomain: "expressemlak-f85d3.firebaseapp.com",
  projectId: "expressemlak-f85d3",
  storageBucket: "expressemlak-f85d3.firebasestorage.app",
  appId: "1:328195558403:web:0ba4504f713f6299c0d236"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// ALLOWED_EMAILS buradan assets/js/admin-config.js'e taşındı: bu dosya her public
// sayfa tarafından import ediliyor, o liste ise yalnızca panele ait ve deploy'dan
// çıkarılıyor. Yetkili adresler için admin-config.js'e bakın.

// Sitede gösterilen iletişim bilgileri
export const CONTACT = {
  name: "Express Emlak",
  since: "Ağustos 2023",
  phones: [
    { label: "Cep", number: "0 (535) 060 82 83", tel: "+905350608283" },
    { label: "Cep 2", number: "0 (544) 471 22 73", tel: "+905444712273" }
  ],
  whatsapp: "905350608283",
  email: "expressinsaatgayrimenkul@gmail.com"
};
