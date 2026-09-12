// İlanlar sayfası: filtrele -> sırala -> sayfala -> göster.
//
// Tüm ilanlar tek seferde çekilip bellekte tutulur. Ofis ilanları elle giriyor,
// koleksiyon gerçekçi olarak 20-200 doküman; bu ölçekte istemci tarafı filtreleme
// anında çalışır ve Firestore composite index gerektirmez.
import { collection, onSnapshot, orderBy, query }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db, CONTACT } from "./firebase-config.js";
import { CATEGORY_TREE, SELECT_OPTIONS, displayName, slugify } from "./constants.js";
import { kiralikMi, metrekareDegeri, renderKart } from "./ilan-kart.js";
import { $, $$, buildOptions, escapeHtml } from "./utils.js";

const SAYFA_BOYUTU = 12;
const GORUNUM_ANAHTARI = "ee_ilan_gorunumu";

let tumIlanlar = [];
let sayfa = 0;
let gorunum = "grid";

/* -------------------------------------------------------- Filtre durumu */

const filtre = {
  kategori: "",
  tip: "",        // "satilik" | "kiralik"
  ilce: "",
  oda: "",
  minFiyat: "",
  maxFiyat: "",
  sirala: "date-desc"
};

// Filtreler adres çubuğuna yansır; sonuç bağlantısı paylaşılabilir olur.
function filtreyiUrldenOku() {
  const p = new URLSearchParams(location.search);
  Object.keys(filtre).forEach((k) => {
    if (p.has(k)) filtre[k] = p.get(k);
  });
}

function filtreyiUrlyeYaz() {
  const p = new URLSearchParams();
  Object.entries(filtre).forEach(([k, v]) => {
    if (v && !(k === "sirala" && v === "date-desc")) p.set(k, v);
  });
  const yeni = p.toString() ? `?${p}` : location.pathname;
  history.replaceState(null, "", yeni);
}

/* ------------------------------------------------------------- Yardımcılar */

// Boş/geçersiz girdi için null döner ki filtre hiç uygulanmasın.
// DİKKAT: Number("") === 0 olduğu için boşluk kontrolü ayrıca yapılmalı;
// aksi halde boş fiyat alanı "fiyat >= 0 && fiyat <= 0" filtresine dönüşür.
const sayi = (v) => {
  if (v === null || v === undefined) return null;
  const temiz = String(v).replace(/[^\d.-]/g, "").trim();
  if (temiz === "" || temiz === "-" || temiz === ".") return null;
  const n = Number(temiz);
  return Number.isFinite(n) ? n : null;
};

const tarihMs = (d) => {
  if (d.tarih && typeof d.tarih.toMillis === "function") return d.tarih.toMillis();
  if (d.tarih && typeof d.tarih.toDate === "function") return d.tarih.toDate().getTime();
  const t = new Date(d.tarih || 0).getTime();
  return Number.isFinite(t) ? t : 0;
};

/* ----------------------------------------------------------------- Filtre */

function filtrele(liste, f) {
  return liste.filter((d) => {
    if (f.kategori && slugify(d.kategori) !== slugify(f.kategori)) return false;

    if (f.tip) {
      const kiralik = kiralikMi(d);
      if (f.tip === "kiralik" && !kiralik) return false;
      if (f.tip === "satilik" && kiralik) return false;
    }

    if (f.ilce && (d.ilce || "") !== f.ilce) return false;
    if (f.oda && (d.odaSayisi || "") !== f.oda) return false;

    const fiyat = Number(d.fiyat);
    const min = sayi(f.minFiyat);
    const max = sayi(f.maxFiyat);
    if (min !== null && !(fiyat >= min)) return false;
    if (max !== null && !(fiyat <= max)) return false;

    return true;
  });
}

/* ---------------------------------------------------------------- Sıralama */

// DOM düğümleri değil nesneler sıralanır; böylece m² değeri dataset'ten değil
// ilan-kart.js'teki türetmeden gelir.
function sirala(liste, siralama) {
  const kopya = liste.slice();
  const m2 = (d) => metrekareDegeri(d) ?? -1;
  const f = (d) => (Number.isFinite(Number(d.fiyat)) ? Number(d.fiyat) : -1);

  switch (siralama) {
    case "price-asc":  kopya.sort((a, b) => f(a) - f(b)); break;
    case "price-desc": kopya.sort((a, b) => f(b) - f(a)); break;
    case "area-asc":   kopya.sort((a, b) => m2(a) - m2(b)); break;
    case "area-desc":  kopya.sort((a, b) => m2(b) - m2(a)); break;
    case "date-asc":   kopya.sort((a, b) => tarihMs(a) - tarihMs(b)); break;
    case "date-desc":
    default:           kopya.sort((a, b) => tarihMs(b) - tarihMs(a)); break;
  }
  return kopya;
}

/* ---------------------------------------------------------- Ana boru hattı */

/**
 * Filtre -> sırala -> sayfala. Saf fonksiyon (modül durumuna dokunmaz),
 * bu yüzden DOM olmadan doğrudan test edilebilir.
 */
export function hesapla(liste, f = filtre, s = sayfa, boyut = SAYFA_BOYUTU) {
  const suzulen = sirala(filtrele(liste, f), f.sirala);

  const sayfaSayisi = Math.max(1, Math.ceil(suzulen.length / boyut));
  const guvenliSayfa = Math.min(Math.max(0, s), sayfaSayisi - 1);
  return {
    toplam: suzulen.length,
    sayfaSayisi,
    sayfa: guvenliSayfa,
    goster: suzulen.slice(guvenliSayfa * boyut, (guvenliSayfa + 1) * boyut)
  };
}

function uygula() {
  const sonuc = hesapla(tumIlanlar, filtre, sayfa);
  sayfa = sonuc.sayfa;

  $("#sonucSayisi").textContent = sonuc.toplam;
  $("#propertiesList").className = `properties-list ${gorunum === "list" ? "list-view" : "grid-view"}`;

  if (!sonuc.toplam) {
    $("#propertiesList").innerHTML = tumIlanlar.length
      ? `<p class="no-results">Bu filtrelere uygun ilan bulunamadı.
           <button type="button" class="btn-secondary" id="bosFiltreTemizle">Filtreleri Temizle</button></p>`
      : '<p class="no-results">Henüz ilan bulunmuyor.</p>';
    const btn = $("#bosFiltreTemizle");
    if (btn) btn.addEventListener("click", temizle);
    sayfalamaGoster(1);
    return;
  }

  const tel = (CONTACT.phones[0] && CONTACT.phones[0].tel) || "";
  $("#propertiesList").innerHTML = sonuc.goster
    .map((ilan) => renderKart(ilan, { gorunum, tel }))
    .join("");

  sayfalamaGoster(sonuc.sayfaSayisi);
}

/* --------------------------------------------------------------- Sayfalama */

function sayfalamaGoster(sayfaSayisi) {
  const kap = $("#sayfalama");
  if (sayfaSayisi <= 1) { kap.hidden = true; kap.innerHTML = ""; return; }
  kap.hidden = false;

  const btn = (etiket, hedef, opts = {}) => `
    <button type="button" class="page-btn ${opts.aktif ? "active" : ""}"
            data-sayfa="${hedef}" ${opts.pasif ? "disabled" : ""}
            ${opts.label ? `aria-label="${opts.label}"` : ""}>${etiket}</button>`;

  let html = btn('<i class="fas fa-chevron-left"></i>', sayfa - 1,
    { pasif: sayfa === 0, label: "Önceki sayfa" });
  for (let i = 0; i < sayfaSayisi; i++) html += btn(String(i + 1), i, { aktif: i === sayfa });
  html += btn('<i class="fas fa-chevron-right"></i>', sayfa + 1,
    { pasif: sayfa >= sayfaSayisi - 1, label: "Sonraki sayfa" });

  kap.innerHTML = html;
  $$("button", kap).forEach((b) => b.addEventListener("click", () => {
    sayfa = Number(b.dataset.sayfa);
    uygula();
    $("#ilanlarBaslangic").scrollIntoView({ behavior: "smooth", block: "start" });
  }));
}

/* ------------------------------------------------------------ Filtre arayüzü */

function filtreleriKur() {
  // Kategori: sabit ağaçtan
  $("#fKategori").innerHTML = buildOptions(Object.keys(CATEGORY_TREE), "Tüm kategoriler");
  // Oda sayısı: panelin kullandığı aynı liste
  $("#fOda").innerHTML = buildOptions(SELECT_OPTIONS.odaSayisi, "Tüm oda sayıları");

  // Alanları mevcut filtre durumuyla doldur
  $("#fKategori").value = filtre.kategori;
  $("#fTip").value = filtre.tip;
  $("#fOda").value = filtre.oda;
  $("#fMin").value = filtre.minFiyat;
  $("#fMax").value = filtre.maxFiyat;
  $("#sortSelect").value = filtre.sirala;

  const bagla = (sel, alan) => $(sel).addEventListener("change", () => {
    filtre[alan] = $(sel).value;
    sayfa = 0;                 // filtre değişince ilk sayfaya dön
    filtreyiUrlyeYaz();
    uygula();
  });

  bagla("#fKategori", "kategori");
  bagla("#fTip", "tip");
  bagla("#fIlce", "ilce");
  bagla("#fOda", "oda");
  bagla("#sortSelect", "sirala");

  // Fiyat alanları yazarken değil, çıkışta/enter'da uygulanır
  ["#fMin", "#fMax"].forEach((sel) => {
    const alan = sel === "#fMin" ? "minFiyat" : "maxFiyat";
    const el = $(sel);
    const uyg = () => {
      filtre[alan] = el.value;
      sayfa = 0;
      filtreyiUrlyeYaz();
      uygula();
    };
    el.addEventListener("change", uyg);
    el.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); uyg(); } });
  });

  $("#filtreTemizle").addEventListener("click", temizle);
}

function temizle() {
  Object.assign(filtre, {
    kategori: "", tip: "", ilce: "", oda: "", minFiyat: "", maxFiyat: "", sirala: "date-desc"
  });
  sayfa = 0;
  $("#fKategori").value = "";
  $("#fTip").value = "";
  $("#fIlce").value = "";
  $("#fOda").value = "";
  $("#fMin").value = "";
  $("#fMax").value = "";
  $("#sortSelect").value = "date-desc";
  filtreyiUrlyeYaz();
  uygula();
}

// İlçe listesi veriden türetilir; sabit liste zamanla gerçekle uyumsuz kalır.
function ilceleriGuncelle() {
  const ilceler = [...new Set(tumIlanlar.map((d) => d.ilce).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "tr"));
  const sec = $("#fIlce");
  const mevcut = filtre.ilce;
  sec.innerHTML = buildOptions(ilceler, "Tüm ilçeler");
  sec.value = ilceler.includes(mevcut) ? mevcut : "";
  filtre.ilce = sec.value;
}

/* ------------------------------------------------------------- Görünüm */

function gorunumuKur() {
  try {
    const kayitli = localStorage.getItem(GORUNUM_ANAHTARI);
    if (kayitli === "list" || kayitli === "grid") gorunum = kayitli;
  } catch { /* özel sekmede okunamaz */ }

  $$(".view-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === gorunum);
    b.setAttribute("aria-pressed", String(b.dataset.view === gorunum));
    b.addEventListener("click", () => {
      gorunum = b.dataset.view;
      try { localStorage.setItem(GORUNUM_ANAHTARI, gorunum); } catch { /* yoksay */ }
      $$(".view-btn").forEach((x) => {
        x.classList.toggle("active", x === b);
        x.setAttribute("aria-pressed", String(x === b));
      });
      uygula();   // karttan yeniden üretilir; DOM'u sonradan değiştirmiyoruz
    });
  });
}

/* ---------------------------------------------------------------- Başlangıç */

function baslat() {
  filtreyiUrldenOku();
  filtreleriKur();
  gorunumuKur();

  onSnapshot(
    query(collection(db, "ilanlar"), orderBy("tarih", "desc")),
    (snap) => {
      tumIlanlar = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      ilceleriGuncelle();
      uygula();
    },
    (err) => {
      console.error("İlanlar yüklenemedi:", err);
      $("#sonucSayisi").textContent = "0";
      $("#propertiesList").innerHTML = `
        <p class="no-results">
          İlanlar şu anda yüklenemiyor. Bağlantınızı kontrol edip sayfayı yenileyin.
        </p>`;
      $("#sayfalama").hidden = true;
    }
  );
}

baslat();
