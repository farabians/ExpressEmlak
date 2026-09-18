// İlan detayı sayfasının davranışı.
// Sorumluluklar küçük fonksiyonlara bölündü: veri çek -> parçaları doldur.
import { collection, doc, getDoc, getDocs, increment, limit, query, serverTimestamp, updateDoc, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db, CONTACT } from "./firebase-config.js";
import { FEATURE_GROUPS, SPEC_ROWS, displayName } from "./constants.js";
import { FOTO_YOK, anaFoto } from "./ilan-kart.js";
import { $, $$, escapeHtml, escapeMultiline, formatDate, formatPrice, hasValue, htmlToPlainText, ilanNo, priceLabel } from "./utils.js";
import { favorideMi, favoriToggle } from "./favoriler-store.js";
import { temizleAciklamaHtml } from "./rich-text.js";

const ilanId = new URLSearchParams(location.search).get("id");

/* ---------------------------------------------------------------- Galeri */

function setupGaleri(photoUrls, ilanBasligi, videoUrl) {
  const stage = $("#galeriStage");
  const thumbs = $("#galeriThumbs");
  const counter = $("#galeriCounter");
  const moreBtn = $("#galeriMore");
  const videoBtn = $("#galeriVideoBtn");
  const urls = photoUrls && photoUrls.length ? photoUrls : [FOTO_YOK];
  let index = 0;

  // Video artık ayrı bir sekme değil, galerinin sağ-altında kalıcı bir buton -
  // fotoğraflara bakarken video her zaman bir tık uzakta.
  if (videoUrl) {
    videoBtn.hidden = false;
    videoBtn.addEventListener("click", () => openVideoLightbox(videoUrl));
  }

  const mainImg = document.createElement("img");
  mainImg.alt = ilanBasligi;
  mainImg.loading = "eager";
  stage.prepend(mainImg);

  function show(i) {
    index = (i + urls.length) % urls.length;
    mainImg.src = urls[index];
    counter.textContent = `${index + 1} / ${urls.length}`;
    $$("button", thumbs).forEach((b, bi) => b.classList.toggle("is-active", bi === index));
  }

  urls.forEach((url, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("aria-label", `${i + 1}. fotoğraf`);
    const img = document.createElement("img");
    img.src = url;
    img.alt = "";
    img.loading = "lazy";
    btn.appendChild(img);
    btn.addEventListener("click", () => show(i));
    thumbs.appendChild(btn);
  });
  // İlk 10 fotoğrafı göster, kalanları gizle
  const THUMB_VISIBLE = 10;
  if (urls.length > THUMB_VISIBLE) {
    thumbs.classList.add("is-collapsed");
    moreBtn.hidden = false;

    moreBtn.innerHTML =
      `<i class="fas fa-chevron-down"></i>
       ${urls.length - THUMB_VISIBLE} fotoğraf daha göster`;

    moreBtn.onclick = () => {
      const collapsed = thumbs.classList.toggle("is-collapsed");

      moreBtn.classList.toggle("is-open", !collapsed);

      moreBtn.innerHTML = collapsed
        ? `<i class="fas fa-chevron-down"></i>
           ${urls.length - THUMB_VISIBLE} fotoğraf daha göster`
        : `<i class="fas fa-chevron-up"></i>
           Fotoğrafları gizle`;
    };
  } else {
    moreBtn.hidden = true;
  }
  const single = urls.length < 2;
  $("#galeriPrev").hidden = single;
  $("#galeriNext").hidden = single;
  thumbs.hidden = single;

  $("#galeriPrev").addEventListener("click", () => show(index - 1));
  $("#galeriNext").addEventListener("click", () => show(index + 1));
  mainImg.addEventListener("click", () => openLightbox(urls, index, ilanBasligi));

  show(0);
}

function openLightbox(urls, startIndex, alt) {
  let index = startIndex;

  const box = document.createElement("div");
  box.className = "lightbox";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-label", "Fotoğraf görüntüleyici");
  box.innerHTML = `
    <button type="button" class="lightbox-close" aria-label="Kapat"><i class="fas fa-times"></i></button>
    <button type="button" class="galeri-nav prev" aria-label="Önceki"><i class="fas fa-chevron-left"></i></button>
    <img alt="${escapeHtml(alt)}">
    <button type="button" class="galeri-nav next" aria-label="Sonraki"><i class="fas fa-chevron-right"></i></button>
  `;

  const img = $("img", box);
  const render = () => { img.src = urls[(index + urls.length) % urls.length]; };
  const close = () => { box.remove(); document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };

  function onKey(e) {
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") { index--; render(); }
    if (e.key === "ArrowRight") { index++; render(); }
  }

  $(".lightbox-close", box).addEventListener("click", close);
  $(".prev", box).addEventListener("click", () => { index--; render(); });
  $(".next", box).addEventListener("click", () => { index++; render(); });
  box.addEventListener("click", (e) => { if (e.target === box) close(); });
  document.addEventListener("keydown", onKey);

  if (urls.length < 2) { $(".prev", box).hidden = true; $(".next", box).hidden = true; }

  render();
  document.body.appendChild(box);
  document.body.style.overflow = "hidden";
  $(".lightbox-close", box).focus();
}

// Foto lightbox'ından ayrı: <img> yerine <video controls autoplay> gösterir,
// önceki/sonraki oku yok (tek video). Aç/kapa/Escape/dışa-tıkla davranışı ortak.
function openVideoLightbox(videoUrl) {
  const box = document.createElement("div");
  box.className = "lightbox lightbox-video";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-label", "İlan videosu");
  box.innerHTML = `
    <button type="button" class="lightbox-close" aria-label="Kapat"><i class="fas fa-times"></i></button>
    <video controls autoplay playsinline></video>
  `;

  const video = $("video", box);
  video.src = videoUrl;

  const close = () => {
    video.pause();
    box.remove();
    document.removeEventListener("keydown", onKey);
    document.body.style.overflow = "";
  };

  function onKey(e) { if (e.key === "Escape") close(); }

  $(".lightbox-close", box).addEventListener("click", close);
  box.addEventListener("click", (e) => { if (e.target === box) close(); });
  document.addEventListener("keydown", onKey);

  document.body.appendChild(box);
  document.body.style.overflow = "hidden";
  $(".lightbox-close", box).focus();
}

/* ------------------------------------------------------- Özellik tablosu */

function renderSpecs(d) {
  const rows = [
    { label: "İlan No", value: ilanNo(ilanId), accent: true },
    { label: "İlan Tarihi", value: formatDate(d.tarih) }
  ];

  const tip = [d.ilanTipi, d.altKategori].map(displayName).filter(Boolean).join(" ");
  if (tip) rows.push({ label: "Emlak Tipi", value: tip });

  // Eski kayıtlarda iş yeri m² alanları ayrı isimlerle saklanmış olabilir.
  const legacy = {
    brutMetrekare: d.brutMetrekare || d.isyeriBrutMetrekare,
    netMetrekare: d.netMetrekare || d.isyeriNetMetrekare
  };

  SPEC_ROWS.forEach(({ key, label, type }) => {
    const raw = legacy[key] !== undefined ? legacy[key] : d[key];

    let value;
    if (type === "bool") {
      if (typeof raw !== "boolean") return;
      value = raw ? "Evet" : "Hayır";
    } else if (typeof raw === "boolean") {
      // Eski kayıtlarda asansor/otopark checkbox olduğu için boolean gelir
      // (yeni panelde bunlar "Var" / "Kapalı Otopark" gibi metin).
      // "true" basmak yerine okunabilir hale getiriyoruz; false ise satırı atlıyoruz.
      if (!raw) return;
      value = "Var";
    } else if (type === "money") {
      // Aidat/depozito için 0 anlamlı bir bilgi değil, satırı hiç basmıyoruz.
      if (!hasValue(raw) || Number(raw) === 0) return;
      value = `${formatPrice(raw)} TL`;
    } else {
      if (!hasValue(raw)) return;
      value = raw;
    }
    rows.push({ label, value });
  });

  $("#specTable").innerHTML = rows.map(({ label, value, accent }) => `
    <div class="spec-row">
      <dt>${escapeHtml(label)}</dt>
      <dd class="${accent ? "accent" : ""}">${escapeHtml(value)}</dd>
    </div>
  `).join("");
}

/* -------------------------------------------------------- Özellik grupları */

// Firestore'da bu alanlar dizi (yeni kayıtlar) veya virgüllü metin (eski kayıtlar) olabilir.
function toList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") return value.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

function renderFeatures(d) {
  const groups = [];

  FEATURE_GROUPS.forEach(({ key, title }) => {
    const items = toList(d[key]);
    if (items.length) groups.push({ title, items });
  });

  // Eski kayıtlardaki tek tek checkbox alanları.
  // asansor/otopark özellik tablosunda zaten "Var" olarak görünüyor (bkz. renderSpecs),
  // bu yüzden burada yalnızca tabloda karşılığı olmayan siteIcerisinde kalıyor.
  if (d.siteIcerisinde === true) {
    groups.push({ title: "Bina / Site Özellikleri", items: ["Site İçerisinde"] });
  }

  if (!groups.length) return;

  $("#ozelliklerSection").hidden = false;
  $("#ozelliklerBody").innerHTML = groups.map(({ title, items }) => `
    <div class="ozellik-group">
      <h4>${escapeHtml(title)}</h4>
      <div class="ozellik-grid">
        ${items.map((i) => `<span class="ozellik-item"><i class="fas fa-check"></i>${escapeHtml(i)}</span>`).join("")}
      </div>
    </div>
  `).join("");
}

/* ----------------------------------------------------------------- Konum */

function renderKonum(d) {
  // Koordinat varsa tam nokta, yoksa mahalle/ilçe adından arama yapılır.
  const hasCoords = Number.isFinite(Number(d.enlem)) && Number.isFinite(Number(d.boylam))
    && d.enlem !== null && d.boylam !== null && d.enlem !== "" && d.boylam !== "";

  const adresParcalari = [d.sokak, d.mahalle, d.ilce, d.il].filter(Boolean);
  const adres = adresParcalari.join(", ");
  const q = hasCoords ? `${d.enlem},${d.boylam}` : (adres || "Türkiye");
  const zoom = hasCoords ? 17 : (d.mahalle ? 15 : 13);

  // Adres dökümü tablosu
  const satirlar = [
    ["İl", d.il],
    ["İlçe", d.ilce],
    ["Mahalle", d.mahalle],
    ["Cadde / Sokak", d.sokak]
  ].filter(([, v]) => hasValue(v));

  $("#adresTablo").innerHTML = satirlar.length
    ? satirlar.map(([label, value]) => `
        <div class="spec-row">
          <dt>${escapeHtml(label)}</dt>
          <dd>${escapeHtml(value)}</dd>
        </div>
      `).join("")
    : '<div class="spec-row"><dd>Konum bilgisi girilmemiş.</dd></div>';

  $("#haritaBox").innerHTML = `
    <iframe
      title="İlan konumu haritası"
      loading="lazy"
      referrerpolicy="no-referrer-when-downgrade"
      src="https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=${zoom}&hl=tr&output=embed"></iframe>
  `;

  $("#haritaAdres").textContent = !adres
    ? "Konum bilgisi girilmemiş."
    : hasCoords
      ? `${adres} — işaretli nokta ilanın konumudur.`
      : `${adres} — harita bölgeyi gösterir, tam nokta işaretlenmemiştir.`;

  // Harita üzerindeki aksiyonlar
  $("#yolTarifi").href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
  $("#buyukHarita").href = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adres || "Türkiye")}`;

  // Sokak görünümü yalnızca koordinat varsa anlamlı
  const sokakBtn = $("#sokakGorunumu");
  if (hasCoords) {
    sokakBtn.hidden = false;
    sokakBtn.href = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${encodeURIComponent(q)}`;
  } else {
    sokakBtn.hidden = true;
  }
}

/* -------------------------------------------------------------- Sekmeler */

function setupTabs() {
  const tabs = $$(".detay-tab");

  function select(tab) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      $(`#${t.getAttribute("aria-controls")}`).hidden = !on;
    });
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => select(tab));
    // Sekmeler arasında ok tuşlarıyla gezinme
    tab.addEventListener("keydown", (e) => {
      const visible = tabs.filter((t) => !t.hidden);
      const pos = visible.indexOf(tab);
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const next = visible[(pos + (e.key === "ArrowRight" ? 1 : -1) + visible.length) % visible.length];
        next.focus();
        select(next);
      }
    });
    void i;
  });
}

/* --------------------------------------------------------- Üst aksiyonlar */

function setupActions(d) {
  const url = location.href;

  $("#btnYazdir").addEventListener("click", () => {
    const el = $("#printTarih");
    if (el) el.textContent = `Oluşturulma: ${formatDate(new Date())}`;
    window.print();
  });

  $("#btnPaylas").addEventListener("click", async () => {
    const payload = { title: d.isim, text: `${d.isim} — ${priceLabel(d.fiyat)}`, url };
    try {
      if (navigator.share) await navigator.share(payload);
      else {
        await navigator.clipboard.writeText(url);
        flash($("#btnPaylas"), "Link kopyalandı");
      }
    } catch (err) {
      if (err.name !== "AbortError") console.error(err);
    }
  });

  // Favoriler tarayıcıda tutuluyor; sunucu tarafı üyelik sistemi yok.
  const favBtn = $("#btnFavori");

  function paint(on) {
    favBtn.classList.toggle("is-active", on);
    favBtn.setAttribute("aria-pressed", String(on));
    $(".full", favBtn).textContent = on ? "Favorilerimde" : "Favorilerime Ekle";
    $(".short", favBtn).textContent = on ? "Favorimde" : "Fav. Ekle";
    $("i", favBtn).className = on ? "fas fa-star" : "far fa-star";
  }

  paint(favorideMi(ilanId));

  favBtn.addEventListener("click", () => {
    const list = favoriToggle(ilanId);
    paint(list.includes(ilanId));
  });
}

function flash(btn, text) {
  const label = $("span", btn);
  const old = label.textContent;
  label.textContent = text;
  setTimeout(() => { label.textContent = old; }, 1800);
}

/* -------------------------------------------------------- Satıcı bilgileri */

function renderSatici(d) {
  $("#saticiName").textContent = d.kimden === "Sahibinden" ? CONTACT.name : (d.kimden || CONTACT.name);
  // Yetki belge no ilanda görünmek zorunda (Taşınmaz Ticareti Yönetmeliği).
  $("#saticiSince").textContent =
    `Yetki Belge No: ${CONTACT.yetkiBelgeNo} · Hesap açma tarihi: ${CONTACT.since}`;

  // Etiket yerine kişi adı gösterilir ("Cep 2" değil "Mehmet Üzüm"); ada sahip
  // olmayan bir kayıt eklenirse label'a düşer.
  $("#saticiPhones").innerHTML = CONTACT.phones.map((p) => `
    <a class="satici-phone" href="tel:${escapeHtml(p.tel)}">
      <span>${escapeHtml(p.person || p.label)}</span>
      <strong>${escapeHtml(p.number)}</strong>
    </a>
  `).join("");

  const konu = `İlan #${ilanNo(ilanId)} - ${d.isim || ""}`;
  const govde = `İlan linki: ${location.href}\n\nMerhaba, bu ilan hakkında bilgi almak istiyorum.`;

  $("#btnAra").href = `tel:${CONTACT.phones[0].tel}`;
  $("#btnWhatsapp").href = `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(`${konu}\n${location.href}`)}`;
  $("#btnMesaj").href = `mailto:${CONTACT.email}?subject=${encodeURIComponent(konu)}&body=${encodeURIComponent(govde)}`;

  // Sosyal paylaşım bağlantıları
  const url = encodeURIComponent(location.href);
  const metin = encodeURIComponent(`${d.isim || "İlan"} - ${priceLabel(d.fiyat)}`);
  $("#shareWhatsapp").href = `https://wa.me/?text=${metin}%20${url}`;
  $("#shareFacebook").href = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
  $("#shareTwitter").href = `https://twitter.com/intent/tweet?text=${metin}&url=${url}`;
}

/* ----------------------------------------------------------- Benzer ilanlar */

async function renderBenzer(d) {
  if (!d.kategori) return;
  try {
    const snap = await getDocs(query(
      collection(db, "ilanlar"),
      where("kategori", "==", d.kategori),
      limit(9)
    ));

    const others = snap.docs.filter((s) => s.id !== ilanId).slice(0, 4);
    if (!others.length) return;

    $("#benzerBaslik").hidden = false;
    $("#benzerGrid").innerHTML = others.map((s) => {
      const b = s.data();
      const foto = anaFoto(b);
      return `
        <a class="benzer-kart" href="ilan_detayi.html?id=${encodeURIComponent(s.id)}">
          <img src="${escapeHtml(foto)}" alt="" loading="lazy">
          <div class="benzer-kart-body">
            <h3>${escapeHtml(b.isim || "")}</h3>
            <div class="fiyat">${priceLabel(b.fiyat, "Fiyat sorun")}</div>
            <div class="yer">${escapeHtml([b.ilce, b.il].filter(Boolean).join(" / "))}</div>
          </div>
        </a>
      `;
    }).join("");
  } catch (err) {
    console.error("Benzer ilanlar yüklenemedi:", err);
  }
}

/* ---------------------------------------------------------------- Başlangıç */

function showError(message) {
  $("#loadingState").hidden = true;
  $("#errorState").hidden = false;
  if (message) $("#errorText").textContent = message;
}

/* -------------------------------------------------- Görüntülenme sayacı */

const GORUNTULENME_BEKLEME_MS = 10_000; // hızlı F5/istek spam'ine karşı

// Saf zaman mantığı ayrı tutuldu - sessionStorage okuma/yazma yan etkisi
// bundan bağımsız, testte gerçek storage'a ihtiyaç duymadan doğrulanabilir.
export function goruntulenmeIzinliMi(sonZaman, simdi, bekleme = GORUNTULENME_BEKLEME_MS) {
  if (sonZaman === null || sonZaman === undefined) return true;
  return simdi - sonZaman >= bekleme;
}

function goruntulenmeIzniVar(id) {
  const anahtar = `ee_goruntulenme_${id}`;
  let sonZaman = null;
  try {
    const ham = sessionStorage.getItem(anahtar);
    sonZaman = ham ? Number(ham) : null;
  } catch { /* özel sekmede okunamaz - izin ver, tekilleştirme zorunlu değil */ }

  const simdi = Date.now();
  if (!goruntulenmeIzinliMi(sonZaman, simdi)) return false;

  try { sessionStorage.setItem(anahtar, String(simdi)); } catch { /* yoksay */ }
  return true;
}

async function init() {
  setupTabs();

  if (!ilanId) {
    showError("İlan adresi geçersiz. Lütfen ilan listesinden tekrar deneyin.");
    return;
  }

  let snap;
  try {
    snap = await getDoc(doc(db, "ilanlar", ilanId));
  } catch (err) {
    console.error(err);
    showError("İlan yüklenirken bir sorun oluştu. Bağlantınızı kontrol edip sayfayı yenileyin.");
    return;
  }

  if (!snap.exists()) {
    showError("Bu ilan bulunamadı veya yayından kaldırılmış olabilir.");
    return;
  }

  const d = snap.data();

  // Görüntülenme sayacı: her gerçek ziyaret sayılır (aynı kişi farklı
  // zamanlarda tekrar girerse de artar - kullanıcı kararı, kalıcı
  // tekilleştirme yapılmıyor). sessionStorage kontrolü (10sn) yalnızca
  // gereksiz istek göndermemek için bir ön-filtre - konsoldan atlatılabilir.
  // Asıl koruma sunucuda: firestore.rules, goruntulenmeSonZaman'ın sunucu
  // saatiyle (request.time) en az 10 saniye eskide olmasını şart koşuyor,
  // bu yüzden istemci ne yaparsa yapsın 10 saniyeden sık artış kabul edilmez.
  if (goruntulenmeIzniVar(ilanId)) {
    updateDoc(doc(db, "ilanlar", ilanId), {
      goruntulenmeSayisi: increment(1),
      goruntulenmeSonZaman: serverTimestamp()
    }).catch((err) => {
      console.error("Görüntülenme sayacı güncellenemedi:", err);
    });
  }

  document.title = `${d.isim || "İlan"} - Express Emlak`;
  const desc = htmlToPlainText(d.aciklama).slice(0, 155);
  if (desc) $('meta[name="description"]').content = desc;

  // Breadcrumb
  const trail = [d.kategori, d.ilanTipi, d.altKategori].map(displayName).filter(Boolean);
  $("#breadcrumbTrail").innerHTML = trail.map((part, i) => {
    const isLast = i === trail.length - 1;
    return `<span class="sep">/</span>${isLast
      ? `<span class="current">${escapeHtml(part)}</span>`
      : `<span>${escapeHtml(part)}</span>`}`;
  }).join("");

  $("#ilanBaslik").textContent = d.isim || "";
  
  $("#specPrice").textContent = priceLabel(d.fiyat);
  $("#specLocation").innerHTML =
    `<i class="fas fa-location-dot"></i>${escapeHtml([d.il, d.ilce, d.mahalle].filter(Boolean).join(" / "))}`;

  const badges = [d.ilanTipi, d.altKategori].map(displayName).filter(Boolean);
  $("#specBadges").innerHTML = badges.map((b) => `<span class="spec-badge">${escapeHtml(b)}</span>`).join("");

  // Görüntülenme sayısı: ilan bazlı, varsayılan açık. Panelden "goruntulenmeGizli"
  // işaretlenirse (bilinçli tercih: alan yoksa/false ise göster) ziyaretçiye gösterilmez.
  // Sadece ikon + sayı - metin yok (başlık satırındaki dar alana sığması için).
  if (!d.goruntulenmeGizli) {
    const sayi = Number(d.goruntulenmeSayisi) || 0;
    $("#specGoruntulenmeSayi").textContent = String(sayi);
    $("#specGoruntulenme").hidden = false;
  }

  // Eski kayıtlar düz metin (\n ile); yeni kayıtlar zengin metin editöründen
  // gelen HTML. Tag içermeyen içerik düz metin sayılıp escapeMultiline ile
  // satır sonları korunur; tag içeren içerik ikinci savunma katmanı olarak
  // DOMPurify'dan geçirilir (admin tarafında zaten temizlenmiş olsa da).
  $("#aciklamaBody").innerHTML = d.aciklama
    ? (/<[a-z][\s\S]*>/i.test(d.aciklama) ? temizleAciklamaHtml(d.aciklama) : escapeMultiline(d.aciklama))
    : '<span style="color:var(--text-faint)">Bu ilan için açıklama girilmemiş.</span>';

  setupGaleri(d.photoUrls, d.isim || "İlan fotoğrafı", d.videoUrl);
  renderSpecs(d);
  renderFeatures(d);
  renderKonum(d);
  renderSatici(d);
  setupActions(d);

  $("#loadingState").hidden = true;
  $("#detayContent").hidden = false;

  renderBenzer(d);
}

init();
