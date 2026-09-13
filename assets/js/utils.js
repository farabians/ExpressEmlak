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

// aciklama artık zengin metin HTML'i olarak saklanıyor (Faz 15). Etiketleri
// karakter sayarak kesmek (slice) tag ortasında kesilmeye yol açar ve HTML'i
// düz metin gösterilmesi gereken yerlerde (liste önizlemesi, meta description)
// çiğ basar. Önce tag'leri boşluğa çevirip fazla boşlukları sadeleştiriyoruz.
export function htmlToPlainText(html) {
  return String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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

/**
 * Ekranın üstünde kısa süreli bir bildirim gösterir.
 *
 * Panelde kaydetme sonrası tek geri bildirim, formun en altındaki .form-msg
 * kutusuydu; ama kaydetmenin hemen ardından resetForm() adım 1'e dönüp sayfayı
 * yukarı kaydırdığı için mesaj hiç görülmüyordu. Toast sabit konumlu ve
 * form/adım durumundan bağımsız olduğu için bu sorundan etkilenmez.
 *
 * @param {string} title  Kalın başlık ("İlan yayınlandı")
 * @param {object} [opts]
 * @param {string} [opts.text]     Başlığın altındaki açıklama
 * @param {"ok"|"err"} [opts.type] Görsel ton (varsayılan "ok")
 * @param {number} [opts.duration] Otomatik kapanma süresi (ms)
 */
export function showToast(title, { text = "", type = "ok", duration = 5000 } = {}) {
  const stack = document.getElementById("toastStack");
  if (!stack) return; // toast kabı olmayan sayfalarda sessizce atla

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  const icon = document.createElement("span");
  icon.className = "toast-icon";
  icon.innerHTML = `<i class="fas ${type === "err" ? "fa-triangle-exclamation" : "fa-check"}"></i>`;

  const body = document.createElement("div");
  body.className = "toast-body";
  const strong = document.createElement("div");
  strong.className = "toast-title";
  strong.textContent = title;
  body.appendChild(strong);
  if (text) {
    const p = document.createElement("div");
    p.className = "toast-text";
    p.textContent = text;
    body.appendChild(p);
  }

  const close = document.createElement("button");
  close.type = "button";
  close.className = "toast-close";
  close.setAttribute("aria-label", "Bildirimi kapat");
  close.innerHTML = '<i class="fas fa-times"></i>';

  const progress = document.createElement("span");
  progress.className = "toast-progress";
  progress.style.animationDuration = `${duration}ms`;

  toast.append(icon, body, close, progress);

  let timer;
  const kapat = () => {
    clearTimeout(timer);
    if (toast.classList.contains("is-leaving")) return;
    toast.classList.add("is-leaving");
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
  };

  close.addEventListener("click", kapat);
  // İmleç üzerindeyken kapanmasın - kullanıcı okumayı bitirsin.
  toast.addEventListener("mouseenter", () => {
    clearTimeout(timer);
    progress.style.animationPlayState = "paused";
  });
  toast.addEventListener("mouseleave", () => {
    progress.style.animationPlayState = "running";
    timer = setTimeout(kapat, 1200);
  });

  stack.appendChild(toast);
  timer = setTimeout(kapat, duration);
  return toast;
}
