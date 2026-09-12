// Sayfalar arasında paylaşılan küçük yardımcılar.

export const $ = (selector, scope = document) => scope.querySelector(selector);
export const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
                "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

export function formatDate(timestamp) {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

// null/undefined/boş için boş string döner; "0 TL" gibi yanıltıcı çıktı üretmez.
export function formatPrice(value) {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("tr-TR").format(n);
}

// Ekranda gösterilecek fiyat etiketi: değer yoksa "0 TL" yerine anlamlı bir metin.
export function priceLabel(value, bos = "Fiyat belirtilmemiş") {
  const text = formatPrice(value);
  return text ? `${text} TL` : bos;
}

// Kullanıcı girdisini HTML'e basmadan önce kaçır - ilan başlığı/açıklaması dışarıdan geliyor.
export function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Satır sonlarını koruyarak açıklama metnini güvenle basar.
export function escapeMultiline(value) {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

export function buildOptions(values, placeholder = "Seçiniz") {
  return [`<option value="">${placeholder}</option>`]
    .concat(values.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`))
    .join("");
}

// Firestore doküman id'sinden okunabilir bir ilan numarası üretir.
export function ilanNo(docId) {
  let hash = 0;
  for (let i = 0; i < docId.length; i++) {
    hash = (hash * 31 + docId.charCodeAt(i)) % 1000000000;
  }
  return String(hash).padStart(9, "0");
}

// Boş string / null / undefined / boş dizi hepsini "değer yok" sayar.
export function hasValue(value) {
  if (value === null || value === undefined || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}
