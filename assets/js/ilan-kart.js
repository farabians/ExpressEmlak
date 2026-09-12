// İlan kartı: alan türetme + kart HTML'i.
// Üç tüketici: anasayfa (slider + öne çıkanlar), ilanlar listesi, ilan detayı (benzer ilanlar).
//
// Neden ayrı modül: utils.js bilinçli olarak domain'den bağımsız tutuluyor
// ($, escapeHtml, formatPrice), constants.js ise veri + saf arama fonksiyonları.
// İlan alanlarını yorumlayan mantık ikisine de ait değil.
import { SELECT_OPTIONS, displayName, slugify } from "./constants.js";
import { escapeHtml, formatPrice, hasValue, priceLabel } from "./utils.js";

// Fotoğrafı olmayan ilanlar için tek kaynak. (Eskiden images/placeholder.jpg
// yazılıyordu ama o dosya hiç var olmadı - her fotoğrafsız kartta kırık resim çıkıyordu.)
export const FOTO_YOK = "images/placeholder.svg";

export function anaFoto(d) {
  return (d.photoUrls && d.photoUrls[0]) || FOTO_YOK;
}

/* ------------------------------------------------------------ Metrekare */

// Panel kategoriye göre farklı alan yazıyor: konut/isyeri -> brutMetrekare +
// netMetrekare, arsa -> arsaMetrekare (bkz. ilan-form.js collectFormData).
// "metrekare" adlı alan hiçbir zaman yazılmadı; eski sayfalar onu okuduğu için
// ekranda "undefinedm²" görünüyordu. Sırayla ilk dolu olanı alıyoruz.
export function metrekareDegeri(d) {
  const adaylar = [
    d.brutMetrekare,
    d.netMetrekare,
    d.arsaMetrekare,
    d.isyeriBrutMetrekare,  // eski kayıtlar
    d.isyeriNetMetrekare,
    d.metrekare             // hiç yazılmadı, yine de tamlık için
  ];
  const bulunan = adaylar.find((v) => hasValue(v) && Number(v) > 0);
  return bulunan === undefined ? null : Number(bulunan);
}

// Değer yoksa boş string döner - "0 m²" gibi yanıltıcı bir çıktı üretmez.
export function metrekareEtiketi(d) {
  const v = metrekareDegeri(d);
  return v === null ? "" : `${formatPrice(v)} m²`;
}

/* ---------------------------------------------------------- İlan tipi */

// admin.js ilanTipi'ni ham Türkçe etiket olarak yazıyor ("Kiralık"), kategori'yi
// ise slug olarak ("konut"). Bu yüzden eski `ilanTipi === 'kiralik'` karşılaştırması
// hiçbir zaman doğru olmadı ve her ilan "Satılık" etiketi alıyordu.
// slugify + includes kullanmak hem ham etiketi hem de slug'lanmış eski kayıtları yakalar.
export function kiralikMi(d) {
  return slugify(d && d.ilanTipi).includes("kiralik");
}

// Gösterim etiketi: "Turistik Günlük Kiralık" gibi tipler gerçek adıyla görünür,
// ikili Satılık/Kiralık ayrımına indirgenmez.
export function ilanTipiEtiketi(d) {
  const ad = displayName(d && d.ilanTipi);
  if (ad) return ad;
  return kiralikMi(d) ? "Kiralık" : "Satılık";
}

/* ------------------------------------------------- Kat / bina yaşı etiketi */

const SADECE_SAYI = /^\d+$/;

// SELECT_OPTIONS.bulunduguKat sayıların yanında "Zemin Kat", "Çatı Katı",
// "Müstakil" gibi metinler de içeriyor. Hepsine ". Kat" eklemek
// "Zemin Kat. Kat" üretiyordu; yalnızca saf sayıya ekliyoruz.
export function katEtiketi(d) {
  const v = d && d.bulunduguKat;
  if (!hasValue(v)) return "";
  const s = String(v).trim();
  return SADECE_SAYI.test(s) ? `${s}. Kat` : s;
}

// Aynı sorun bina yaşında da var: "31 ve üzeri", "5-10 arası" gibi değerler
// "31 ve üzeri Yaşında" olmamalı.
export function binaYasiEtiketi(d) {
  const v = d && d.binaYasi;
  if (!hasValue(v)) return "";
  const s = String(v).trim();
  return SADECE_SAYI.test(s) ? `${s} Yaşında` : s;
}

export function odaSayisiEtiketi(d) {
  const v = d && d.odaSayisi;
  return hasValue(v) ? String(v) : "";
}

export function konumEtiketi(d) {
  if (!d) return "";
  if (hasValue(d.lokasyon)) return String(d.lokasyon);
  return [d.il, d.ilce, d.mahalle].filter(Boolean).join(" / ");
}

/* ------------------------------------------------------------- Özellikler */

/**
 * Kartta gösterilecek özellik satırları. Yalnızca dolu olanlar döner, böylece
 * arsa/işyeri ilanlarında boş veya "undefined" alan görünmez.
 */
export function kartOzellikleri(d) {
  return [
    { ikon: "fa-home", metin: odaSayisiEtiketi(d) },
    { ikon: "fa-vector-square", metin: metrekareEtiketi(d) },
    { ikon: "fa-building", metin: binaYasiEtiketi(d) },
    { ikon: "fa-layer-group", metin: katEtiketi(d) }
  ].filter((o) => o.metin);
}

/**
 * Ana sayfa slider'ındaki özellik rozetleri. Kart özellikleriyle aynı
 * türetmeyi kullanır, yalnızca konumu da içerir ve etiketler biraz daha uzundur.
 */
export function sliderOzellikleri(d) {
  return [
    { ikon: "fa-location-dot", metin: konumEtiketi(d) },
    { ikon: "fa-home", metin: odaSayisiEtiketi(d) },
    { ikon: "fa-vector-square", metin: metrekareEtiketi(d) },
    { ikon: "fa-building", metin: binaYasiEtiketi(d) },
    { ikon: "fa-layer-group", metin: katEtiketi(d) }
  ].filter((o) => o.metin);
}

/* ---------------------------------------------------------------- Kart HTML */

/**
 * İlan kartı HTML'i. Tüm kullanıcı verisi escapeHtml'den geçer - ilan başlığı
 * ve konum dışarıdan gelen veri, innerHTML'e çiğ basılamaz.
 *
 * @param {object} ilan  Firestore dokümanı ({id, ...data})
 * @param {{gorunum?: "grid"|"list", tel?: string}} secenekler
 */
export function renderKart(ilan, { gorunum = "grid", tel = "" } = {}) {
  const link = `ilan_detayi.html?id=${encodeURIComponent(ilan.id)}`;
  const baslik = escapeHtml(ilan.isim || "İsimsiz ilan");
  const ozellikler = kartOzellikleri(ilan)
    .map((o) => `<span><i class="fas ${o.ikon}"></i> ${escapeHtml(o.metin)}</span>`)
    .join("");

  const govde = `
    <div class="property-image">
      <img src="${escapeHtml(anaFoto(ilan))}" alt="${baslik}" loading="lazy">
      <div class="property-badge">${escapeHtml(ilanTipiEtiketi(ilan))}</div>
    </div>
    <div class="property-content">
      <div class="property-price">${escapeHtml(priceLabel(ilan.fiyat))}</div>
      <h3 class="property-title">${baslik}</h3>
      <p class="property-location">
        <i class="fas fa-location-dot"></i> ${escapeHtml(konumEtiketi(ilan))}
      </p>
      <div class="property-features">${ozellikler}</div>
    </div>
  `;

  if (gorunum === "list") {
    // Liste görünümünde ek aksiyonlar var. Kart veriden yeniden üretildiği için
    // ilan.id her zaman kapsamda - eski kodda DOM'u sonradan değiştirirken
    // doc.id kapsam dışı kalıyor ve liste görünümü ilk karttan sonra kırılıyordu.
        const araButonu = tel
      ? `<a href="tel:${escapeHtml(tel)}" class="btn-secondary">Hemen Ara</a>`
      : "";
    return `
      <article class="property-card property-card-list">
        <a href="${link}" class="property-card-link">${govde}</a>
        <div class="property-actions">
          <a href="${link}" class="btn-secondary">Detayları Gör</a>
          ${araButonu}
        </div>
      </article>
    `;
  }

  return `
    <article class="property-card">
      <a href="${link}" class="property-card-link">${govde}</a>
    </article>
  `;
}

// Test ve filtre tarafının aynı listeyi kullanabilmesi için dışa aktarılıyor.
export const ODA_SECENEKLERI = SELECT_OPTIONS.odaSayisi;
