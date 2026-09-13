/**
 * Express Emlak - WhatsApp/Facebook link önizleme Worker'ı
 * =========================================================
 *
 * SORUN: Site GitHub Pages'te statik duruyor ve ilan verisi tarayıcıda
 * Firestore'dan çekiliyor. WhatsApp/Facebook botları JavaScript çalıştırmaz;
 * sayfayı indirip HTML'deki og: etiketlerine bakıp kapanırlar. Bu yüzden
 * ilan linki paylaşıldığında ilana ait fotoğraf/başlık/fiyat görünmüyordu.
 *
 * ÇÖZÜM: Bu Worker ilan_detayi.html isteklerinin önünde durur.
 *   - İstek bir paylaşım botundan geliyorsa: Firestore REST API'den ilanı
 *     okur, og: etiketleri doldurulmuş küçük bir HTML döndürür.
 *   - Gerçek kullanıcıdan geliyorsa: hiçbir şey yapmaz, GitHub Pages'teki
 *     sayfa normal servis edilir (site davranışı hiç değişmez).
 *
 * KURULUM
 *   1. Cloudflare paneli > Workers & Pages > Create > Worker
 *   2. Bu dosyanın tamamını "Edit code" ekranına yapıştır > Deploy
 *   3. Worker > Settings > Domains & Routes > Add route:
 *        expressinsaat.com.tr/ilan_detayi.html*
 *      (Zone: expressinsaat.com.tr)
 *   4. Test: https://developers.facebook.com/tools/debug/ adresine bir ilan
 *      linki yapıştır. "Scrape Again" ile önizlemeyi tazeleyebilirsin.
 *
 * NOT: Firestore kurallarında `ilanlar` için `allow read: if true` olduğu
 * için Worker kimlik doğrulaması olmadan okuyabiliyor. Kural değişirse
 * (okuma kapatılırsa) burası da çalışmaz.
 */

const PROJE_ID = "expressemlak-f85d3";
const SITE = "https://expressinsaat.com.tr";
const MARKA = "Express Emlak";

// Fotoğrafı olmayan ilanlar ve hata durumları için yedek görsel.
// og:image mutlak URL olmak zorunda - botlar göreli yolu çözemez.
//
// Bilinçli olarak PNG: ofis.webp daha küçük ama WhatsApp ve Facebook
// og:image'da WebP'yi güvenilir desteklemiyor, kart görselsiz kalıyordu.
// İlanların kendi fotoğrafları JPEG olduğu için onlarda bu sorun yok.
//
// logo_dark.png (siyah+altın), logo.png'nin altın markından daha okunaklı:
// önizleme kartlarının zemini açık olduğu için altın mark siliniyordu.
const YEDEK_GORSEL = `${SITE}/images/logo_dark.png`;

/**
 * Paylaşım botlarını User-Agent'tan tanır.
 *
 * Gerçek kullanıcıya asla dokunmuyoruz: liste dışında kalan her istek
 * doğrudan GitHub Pages'e geçer. Yani bu desen yanlış bir şeyi kaçırırsa
 * en kötü ihtimalle önizleme çıkmaz - site bozulmaz.
 */
const BOT_DESENI = /facebookexternalhit|facebookcatalog|WhatsApp|Twitterbot|LinkedInBot|Slackbot|TelegramBot|Discordbot|Pinterest|redditbot|SkypeUriPreview|vkShare|Googlebot|bingbot|Applebot|Iframely|embedly/i;

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const ua = request.headers.get("user-agent") || "";

    // Bot değilse veya id yoksa: sitenin kendi sayfası servis edilsin.
    if (!id || !BOT_DESENI.test(ua)) {
      return fetch(request);
    }

    try {
      const ilan = await ilaniGetir(id);
      // İlan silinmiş/bulunamamışsa markanın genel kartını göster.
      return htmlYanit(ilan ? ilanKarti(ilan, id) : genelKart(url.toString()));
    } catch (err) {
      // Firestore'a ulaşılamazsa bile bot elinde boş kalmasın.
      console.error("Önizleme üretilemedi:", err);
      return htmlYanit(genelKart(url.toString()));
    }
  }
};

/* ------------------------------------------------------------ Firestore */

async function ilaniGetir(id) {
  const adres = `https://firestore.googleapis.com/v1/projects/${PROJE_ID}/databases/(default)/documents/ilanlar/${encodeURIComponent(id)}`;

  // Bot bekletilmesin: Firestore yanıt vermezse önizlemesiz kalmak,
  // isteğin zaman aşımına uğramasından iyidir.
  const yanit = await fetch(adres, { signal: AbortSignal.timeout(4000) });
  if (!yanit.ok) return null;

  const doc = await yanit.json();
  return doc.fields ? alanlariCoz(doc.fields) : null;
}

/**
 * Firestore REST yanıtı her alanı tipli bir sarmalayıcıyla döndürür
 * ({"stringValue": "..."}), bunları düz JS değerlerine indirger.
 */
function alanlariCoz(fields) {
  const cikti = {};
  for (const [anahtar, sarmal] of Object.entries(fields)) {
    cikti[anahtar] = degeriCoz(sarmal);
  }
  return cikti;
}

function degeriCoz(v) {
  if (!v || typeof v !== "object") return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(degeriCoz);
  if ("mapValue" in v) return alanlariCoz(v.mapValue.fields || {});
  return null;
}

/* -------------------------------------------------------- Biçimlendirme */

// utils.js'teki ilanNo ile birebir aynı olmalı: kartta gösterilen numara
// sitedekiyle uyuşmazsa müşteri numarayla arattığında ilanı bulamaz.
function ilanNo(docId) {
  let hash = 0;
  for (let i = 0; i < docId.length; i++) {
    hash = (hash * 31 + docId.charCodeAt(i)) % 1000000000;
  }
  return String(hash).padStart(9, "0");
}

// utils.js: formatPrice + priceLabel karşılığı ("370.000 TL").
function fiyatEtiketi(deger) {
  if (deger === null || deger === undefined || deger === "") return "";
  const n = Number(deger);
  if (!Number.isFinite(n)) return "";
  return `${new Intl.NumberFormat("tr-TR").format(n)} TL`;
}

// ilanTipi alanı kayıtlarda tutarsız ("Satılık" / "kiralik"), ikisini de
// aynı görünen etikete indir.
function tipEtiketi(ilanTipi) {
  const ham = String(ilanTipi || "");
  if (!ham) return "";
  return /kiral/i.test(ham) ? "Kiralık" : "Satılık";
}

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* -------------------------------------------------------------- Kartlar */

function ilanKarti(d, id) {
  const tip = tipEtiketi(d.ilanTipi);
  const fiyat = fiyatEtiketi(d.fiyat);

  // Başlık: "Satılık Daire - 370.000 TL" gibi bir kuyruk eklenmez; ilan adı
  // zaten uzun, WhatsApp iki satırda kesiyor. Fiyat açıklamaya konuyor.
  const baslik = d.isim || `${MARKA} İlanı`;

  // Açıklama satırı: fiyat, tip ve konum - sahibinden kartındaki ikinci
  // satırın karşılığı.
  const aciklama = [fiyat, tip, d.lokasyon].filter(Boolean).join(" · ")
    || "Express Emlak ilan detayı";

  // Vitrin fotoğrafı = kullanıcının panelde ilk sıraya sürüklediği fotoğraf.
  const gorsel = (Array.isArray(d.photoUrls) && d.photoUrls[0]) || YEDEK_GORSEL;

  return kartHtml({
    baslik: `${baslik} | ${MARKA}`,
    aciklama: `${aciklama} · İlan No: ${ilanNo(id)}`,
    gorsel,
    adres: `${SITE}/ilan_detayi.html?id=${encodeURIComponent(id)}`
  });
}

function genelKart(adres) {
  return kartHtml({
    baslik: `${MARKA} - İlan Detayı`,
    aciklama: "Konya'da satılık ve kiralık daire, iş yeri ve arsa ilanları.",
    gorsel: YEDEK_GORSEL,
    adres
  });
}

/**
 * Botun göreceği minimal sayfa. Gerçek kullanıcı buraya hiç düşmez, ama
 * yanlışlıkla düşerse diye <meta refresh> ile siteye yönlendiriliyor.
 */
function kartHtml({ baslik, aciklama, gorsel, adres }) {
  const b = escapeHtml(baslik);
  const a = escapeHtml(aciklama);
  const g = escapeHtml(gorsel);
  const u = escapeHtml(adres);

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>${b}</title>
<meta name="description" content="${a}">
<link rel="canonical" href="${u}">

<meta property="og:type" content="website">
<meta property="og:site_name" content="${MARKA}">
<meta property="og:locale" content="tr_TR">
<meta property="og:title" content="${b}">
<meta property="og:description" content="${a}">
<meta property="og:image" content="${g}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${u}">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${b}">
<meta name="twitter:description" content="${a}">
<meta name="twitter:image" content="${g}">

<meta http-equiv="refresh" content="0; url=${u}">
</head>
<body><a href="${u}">${b}</a></body>
</html>`;
}

function htmlYanit(html) {
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Botlar aynı linki tekrar tekrar çeker; 5 dakikalık önbellek
      // Firestore okumasını azaltır ama fiyat güncellemesini de çok
      // geciktirmez.
      "cache-control": "public, max-age=300"
    }
  });
}
