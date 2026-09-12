// Express Konut projesinin varsayılan (fallback) verisi.
//
// Bu veri iki amaca hizmet ediyor:
// 1) Firestore'a ("ayarlar/expressKonut") hiç yazılmamışsa veya erişilemiyorsa
//    public sayfalar bunu kullanır - sayfa asla boş kalmaz.
// 2) Panelin ilk kaydı için "tohum" (seed) verisidir; admin-konut.js paneli
//    ilk açtığında Firestore'da doküman yoksa bu değerlerle doldurur.
//
// Rakamlar express-konut.html'in eski statik halindeki (plan kartları +
// hesaplayıcı + index.html teaser) değerlerle birebir aynıdır - refactor
// davranışı değiştirmez, yalnızca tek kaynağa taşır.
export const VARSAYILAN_KONUT = {
  heroBaslik: "Express Konut Projesi",
  heroAltBaslik: "Ev Sahibi Olmanın En Kolay Yolu!",

  heroOzellikler: [
    { ikon: "fa-hand-holding-usd", baslik: "Düşük Peşinat", metin: "1.000.000 - 1.500.000 ₺" },
    { ikon: "fa-calendar-alt", baslik: "Sabit Taksitler", metin: "Her ay sabit ödeme" },
    { ikon: "fa-key", baslik: "1 Yılda Teslim", metin: "Anahtar teslim garantisi" },
    { ikon: "fa-shield-alt", baslik: "Güvenli Sistem", metin: "Banka kredisi gerektirmez" }
  ],

  avantajlar: [
    { ikon: "fa-percent", baslik: "Faiz Yok, Kredi Yok",
      metin: "Express Emlak'ın yeni sistemi ile kira öder gibi ev sahibi olabilirsiniz. Banka kredisi ile uğraşmadan!" },
    { ikon: "fa-coins", baslik: "Küçük Peşinat",
      metin: "Sadece küçük bir peşinat ve sabit ödemelerle hayalinizdeki eve kavuşun. Ara ödeme yok!" },
    { ikon: "fa-home", baslik: "Kolayca Ev Sahibi",
      metin: "Banka kredisiyle uğraşmadan, kolayca ev sahibi olun. Süreç basit ve hızlı!" },
    { ikon: "fa-clock", baslik: "Hızlı Süreç",
      metin: "Geleneksel kredi süreçlerinin aksine, çok daha hızlı işlem süresi ve onay." },
    { ikon: "fa-calculator", baslik: "Sabit Taksit",
      metin: "Her ay aynı miktarı ödeyerek evinizi planlayabilirsiniz. Sürpriz yok!" },
    { ikon: "fa-award", baslik: "1 Yıl Garantisi",
      metin: "Kira yerine kendi evinizin ödemesini yapın ve 1 yılda anahtar teslim." }
  ],

  // siraNo görüntüleme sırası; pesinat'a göre sıralı olmak zorunda değil
  // (eski statik kartlar da sıralı değildi - bkz. #40).
  planlar: [
    { siraNo: 1, pesinat: 1250000, asgariUcret: 2,   aylikOdeme: 44000, odemeSuresi: 48, oneCikan: false },
    { siraNo: 2, pesinat: 1250000, asgariUcret: 3,   aylikOdeme: 66000, odemeSuresi: 30, oneCikan: false },
    { siraNo: 3, pesinat: 1500000, asgariUcret: 1.5, aylikOdeme: 33000, odemeSuresi: 48, oneCikan: true },
    { siraNo: 4, pesinat: 1000000, asgariUcret: 4,   aylikOdeme: 88000, odemeSuresi: 24, oneCikan: true },
    { siraNo: 5, pesinat: 1850000, asgariUcret: 1.5, aylikOdeme: 33000, odemeSuresi: 36, oneCikan: false },
    { siraNo: 6, pesinat: 2000000, asgariUcret: 1,   aylikOdeme: 22000, odemeSuresi: 48, oneCikan: false }
  ],

  adimlar: [
    { baslik: "Plan Seçimi", metin: "Size uygun ödeme planını seçin ve başvurunuzu yapın. Gelir durumunuza göre en uygun planı belirleyin." },
    { baslik: "Değerlendirme", metin: "Başvurunuz hızlı bir şekilde değerlendirilir. Belge kontrolü ve onay süreci 48 saat içinde tamamlanır." },
    { baslik: "Sözleşme", metin: "Onay sonrası sözleşmenizi imzalayın ve peşinatınızı ödeyin. Süreç tamamen şeffaf ve güvenlidir." },
    { baslik: "Ev Sahibi Olun", metin: "Aylık ödemelerinizi yapın ve belirlenen sürede evinizin anahtarını teslim alın!" }
  ]
};

/**
 * Peşinat aralığını planlardan türetir; hiçbir zaman elle saklanmaz.
 * (Eski statik metin "1.000.000 - 1.500.000 ₺" derken gerçek üst sınır
 * 2.000.000 ₺ imiş - bkz. #39. Türetilince bu tutarsızlık yapısal olarak biter.)
 */
export function pesinatAraligi(planlar) {
  if (!planlar || !planlar.length) return null;
  const degerler = planlar.map((p) => Number(p.pesinat)).filter((n) => Number.isFinite(n));
  if (!degerler.length) return null;
  return { min: Math.min(...degerler), max: Math.max(...degerler) };
}

/**
 * Ödeme hesaplayıcısının seçtiği plan.
 *
 * Eski calculatePayment() (express-konut.html) rakamları elle if/else zinciriyle
 * tekrarlıyordu ve eşleşmeyen bir peşinatta undefined.toLocaleString() ile
 * çöküyordu (#38). Bu fonksiyon aynı davranışı planlar dizisinden türetir:
 * seçilen peşinata uyan planlar arasından, gelirin karşıladığı en kısa vadeliyi
 * seçer; hiçbiri karşılanmıyorsa en düşük taksitli planı "yetersiz gelir"
 * uyarısıyla döner. Peşinat hiç eşleşmiyorsa güvenle "planYok" döner.
 *
 * @param {Array} planlar
 * @param {{pesinat: number|string, aylikGelir: number|string}} girdi
 * @returns {{durum: "planYok"|"yetersizGelir"|"uygun", plan?: object}}
 */
export function planSec(planlar, { pesinat, aylikGelir } = {}) {
  const p = Number(pesinat);
  const gelir = Number(aylikGelir);

  const uygunPlanlar = (planlar || []).filter((pl) => Number(pl.pesinat) === p);
  if (!uygunPlanlar.length) return { durum: "planYok" };

  const karsilanan = uygunPlanlar.filter((pl) => Number(pl.aylikOdeme) <= gelir);
  if (karsilanan.length) {
    const secilen = karsilanan.slice().sort((a, b) => a.odemeSuresi - b.odemeSuresi)[0];
    return { durum: "uygun", plan: secilen };
  }

  const enUcuz = uygunPlanlar.slice().sort((a, b) => a.aylikOdeme - b.aylikOdeme)[0];
  return { durum: "yetersizGelir", plan: enUcuz };
}
