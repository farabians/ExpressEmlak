// Basit zengin metin editörü: contenteditable + Selection/Range API.
// document.execCommand kullanılmıyor - deprecated, tarayıcılar arası tutarsız
// <b> vs <strong> üretimi ve insertHTML güvenlik riski taşıyor. Bunun yerine
// seçili metni doğrudan DOM node'larıyla sarmalıyoruz - üretilen HTML tamamen
// öngörülebilir, bu da DOMPurify sanitizasyonunu kolaylaştırır.

const IZIN_VERILEN_STIL = new Set(["color", "background-color", "font-size", "text-align"]);

// Seçili metni verilen tag ile sarmalar; seçim zaten aynı tag içindeyse
// sarmalamayı kaldırır (toggle davranışı - kalın/italik butonları için).
function sarmalaToggle(editor, tagName) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return;

  const mevcut = enYakinAta(range.commonAncestorContainer, tagName, editor);
  if (mevcut) {
    // Sarmalamayı kaldır: tag'i, içeriğiyle değiştir.
    const parent = mevcut.parentNode;
    while (mevcut.firstChild) parent.insertBefore(mevcut.firstChild, mevcut);
    parent.removeChild(mevcut);
    return;
  }

  const el = document.createElement(tagName);
  try {
    range.surroundContents(el);
  } catch {
    // Seçim birden fazla elementi kısmen kapsıyorsa surroundContents başarısız olur;
    // içeriği çıkarıp yeni elemente taşıyoruz.
    const frag = range.extractContents();
    el.appendChild(frag);
    range.insertNode(el);
  }
  sel.removeAllRanges();
  const yeni = document.createRange();
  yeni.selectNodeContents(el);
  sel.addRange(yeni);
}

function enYakinAta(node, tagName, sinir) {
  let cur = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
  while (cur && cur !== sinir) {
    if (cur.tagName === tagName.toUpperCase()) return cur;
    cur = cur.parentNode;
  }
  return null;
}

// Seçili metni <span style="..."> ile sarmalar (renk, vurgu, font boyutu).
//
// DİKKAT - iç içe span tuzağı: her çağrıda körlemesine yeni bir span sarmak
// hataya yol açıyordu. CSS'te iç içe font-size'da EN İÇTEKİ kazanır; kullanıcı
// metni 26px yapıp sonra 13px seçtiğinde yeni span dıştan sarıldığı için
// görünen boyut 26px kalıyor ("küçültme çalışmıyor") ve her denemede bir
// katman daha birikiyordu. Bu yüzden: mümkünse MEVCUT span'ı güncelliyor,
// sarmalama gerektiğinde de kapsanan eski aynı-özellikli span'ları temizliyoruz.
function stilUygula(editor, sel, stiller) {
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return;

  const girdiler = Object.entries(stiller).filter(([k]) => IZIN_VERILEN_STIL.has(k));
  if (!girdiler.length) return;

  // 1) Seçim tam olarak mevcut bir <span>'ın içeriğiyse onu güncelle.
  const mevcut = enYakinAta(range.commonAncestorContainer, "span", editor);
  if (mevcut && seciliAlanTamKapsiyor(range, mevcut)) {
    girdiler.forEach(([k, v]) => mevcut.style.setProperty(k, v));
    ayniOzellikliIcSpanlariTemizle(mevcut, girdiler.map(([k]) => k));
    return;
  }

  // 2) Yeni span ile sarmala.
  const span = document.createElement("span");
  span.setAttribute("style", girdiler.map(([k, v]) => `${k}: ${v}`).join("; "));

  try {
    range.surroundContents(span);
  } catch {
    const frag = range.extractContents();
    span.appendChild(frag);
    range.insertNode(span);
  }

  // Sarmaladığımız içerikte aynı özelliği taşıyan eski span'lar varsa onlar
  // "en içteki kazanır" kuralıyla yenisini ezerdi - o özelliği onlardan siliyoruz.
  ayniOzellikliIcSpanlariTemizle(span, girdiler.map(([k]) => k));
}

// range, el'in tüm içeriğini (baştan sona) kapsıyor mu?
function seciliAlanTamKapsiyor(range, el) {
  const tam = document.createRange();
  tam.selectNodeContents(el);
  // Sabitleri çıplak global `Range`'ten değil range nesnesinin kendi
  // sınıfından alıyoruz: modül kapsamında global Range her ortamda tanımlı
  // olmayabilir (jsdom'da undefined) ve bu sessiz bir TypeError'a yol açar.
  const R = range.constructor;
  return range.compareBoundaryPoints(R.START_TO_START, tam) <= 0
      && range.compareBoundaryPoints(R.END_TO_END, tam) >= 0;
}

// kok'un İÇİNDEKİ span'lardan verilen CSS özelliklerini siler; böylece dıştaki
// yeni değer geçerli olur. Özelliksiz kalan span'lar tamamen kaldırılır.
function ayniOzellikliIcSpanlariTemizle(kok, ozellikler) {
  kok.querySelectorAll("span").forEach((ic) => {
    ozellikler.forEach((k) => ic.style.removeProperty(k));
    if (!ic.getAttribute("style")) ic.replaceWith(...ic.childNodes);
  });
}

// Bir <div>'i aynı içerik ve stille <p>'ye dönüştürür, seçimi korur.
// Gerekçe: Chrome contenteditable'da Enter'a basınca <div> üretir, ama
// temizleAciklamaHtml()'in ALLOWED_TAGS listesinde div YOK - kaydedilirken
// div düşer ve üzerindeki text-align da onunla birlikte kaybolur. Editörde
// doğru görünüp kaydedince hizalamanın yok olmasının sebebi buydu.
function divToP(div) {
  const p = document.createElement("p");
  if (div.getAttribute("style")) p.setAttribute("style", div.getAttribute("style"));
  while (div.firstChild) p.appendChild(div.firstChild);
  div.replaceWith(p);
  return p;
}

// Editördeki serbest (henüz bir bloğun içinde olmayan) içeriği tek bir <p>'ye
// toplar ve hizalar. Serbest metnin yalnızca seçili kısmını sarmalamak işe
// yaramaz: text-align blok seviyesi bir özellik, satırın geri kalanı dışarıda
// kalırsa görsel olarak hiçbir şey ortalanmış görünmez.
// Bir düğüm gerçekten içerik taşıyor mu? (boşluk ve tek başına <br> sayılmaz)
function icerikVar(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent.trim() !== "";
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  if (node.tagName === "BR") return false;
  return node.textContent.trim() !== "" || node.querySelector("img, video");
}

function tumIcerigiHizala(editor, align) {
  // DİKKAT: yalnızca METİN İÇEREN blokları "mevcut blok" sayıyoruz. Boş
  // <p>'leri de blok saymak gerçek bir hataya yol açmıştı: editörde boş bir
  // <p style="text-align:center"> varken metin onun DIŞINDA serbest duruyorsa,
  // kod sadece o boş <p>'yi hizalayıp metne hiç dokunmuyor ve kullanıcı
  // "hizalama çalışmıyor" diyordu (ekranda hiçbir değişiklik olmuyor).
  const doluBloklar = [...editor.children]
    .filter((el) => (el.tagName === "P" || el.tagName === "DIV") && icerikVar(el));

  // Blokların dışında serbest dolaşan içerik (metin düğümleri, <br>, <span>...)
  const serbestVar = [...editor.childNodes].some(
    (n) => !(n.nodeType === Node.ELEMENT_NODE && (n.tagName === "P" || n.tagName === "DIV")) && icerikVar(n)
  );

  if (doluBloklar.length && !serbestVar) {
    // Her şey zaten bloklara bölünmüş: hepsini hizala.
    doluBloklar.forEach((el) => {
      const hedef = el.tagName === "DIV" ? divToP(el) : el;
      hedef.style.textAlign = align;
    });
    bosBloklariTemizle(editor);
    return;
  }

  if (!serbestVar && !doluBloklar.length) return; // gerçekten boş editör

  // Serbest içerik var: editörün TÜM içeriğini tek bir <p>'ye topla. Boş
  // <p>'ler bu sırada atılır, aksi halde metnin önünde/arkasında görünmez
  // boşluklar olarak birikirler.
  const p = document.createElement("p");
  p.style.textAlign = align;
  while (editor.firstChild) {
    const n = editor.firstChild;
    if (!icerikVar(n) && n.nodeType === Node.ELEMENT_NODE && (n.tagName === "P" || n.tagName === "DIV")) {
      n.remove();          // boş blok - tamamen at
      continue;
    }
    p.appendChild(n);
  }
  editor.appendChild(p);
}

// İçeriği olmayan <p>/<div> kabuklarını siler (birikmiş boş bloklar).
function bosBloklariTemizle(editor) {
  [...editor.children].forEach((el) => {
    if ((el.tagName === "P" || el.tagName === "DIV") && !icerikVar(el)) el.remove();
  });
}

// Hizalama blok seviyesinde uygulanır: seçimi içeren en yakın <p>'ye
// (yoksa oluşturulur) text-align stili eklenir.
function hizalaUygula(editor, align) {
  const sel = window.getSelection();

  // Seçim yoksa ya da editörün dışındaysa sessizce vazgeçmiyoruz: kullanıcı
  // yazıyı yazıp doğrudan toolbar'a tıkladığında (odak editörde kalmamış
  // olabilir) hizalamanın çalışmasını bekler. Böyle durumlarda hizalamayı
  // editörün tamamına uyguluyoruz.
  if (!sel || sel.rangeCount === 0) {
    tumIcerigiHizala(editor, align);
    return;
  }
  const range = sel.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) {
    tumIcerigiHizala(editor, align);
    return;
  }

  let node = range.commonAncestorContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;

  let blok = node;
  while (blok && blok !== editor && blok.tagName !== "P" && blok.tagName !== "DIV") {
    blok = blok.parentNode;
  }

  if (!blok || blok === editor) {
    tumIcerigiHizala(editor, align);
    return;
  }

  // Chrome'un ürettiği <div> satırları kalıcı olamaz (sanitizasyonda düşer);
  // hizalamadan önce <p>'ye çeviriyoruz.
  if (blok.tagName === "DIV") blok = divToP(blok);

  blok.style.textAlign = align;
}

const RENK_PALETI = [
  "#23262b", "#e5504a", "#e5a946", "#2f9e5c",
  "#2f7de1", "#8b5cf6", "#ec4899", "#ffffff"
];
const VURGU_PALETI = [
  "#fff2b2", "#ffd6a5", "#c8f0c8", "#bfe3ff",
  "#e3d1ff", "#ffc8dd", "#d9d9d9", "transparent"
];

// Tarayıcının yerleşik <input type="color"> öğesi tıklanınca işletim sistemi
// seviyesinde bir pencere açar; bu pencere odağı editörden tamamen koparır ve
// kapandığında contenteditable içindeki seçim collapse olmuş olur - bu yüzden
// "input" event'i geldiğinde stilUygula() uygulanacak bir seçim bulamaz ve
// sessizce hiçbir şey yapmaz. Bunun yerine aynı pencere içinde kalan, seçimi
// mousedown anında kaydedip geri yükleyen kendi popup'ımızı kullanıyoruz.
function createColorPopup({ trigger, palette, onPick, label }) {
  let savedRange = null;
  let panel = null;

  trigger.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const sel = window.getSelection();
    savedRange = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
  });

  function kapat() {
    panel?.remove();
    panel = null;
    document.removeEventListener("mousedown", disaridaTikla, true);
    document.removeEventListener("keydown", escKapat, true);
  }

  function disaridaTikla(e) {
    if (panel && !panel.contains(e.target) && e.target !== trigger) kapat();
  }
  function escKapat(e) {
    if (e.key === "Escape") kapat();
  }

  function uygula(renk) {
    if (savedRange) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRange);
    }
    onPick(renk);
    kapat();
  }

  trigger.addEventListener("click", () => {
    if (panel) { kapat(); return; }

    panel = document.createElement("div");
    panel.className = "rte-color-popup";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", label);
    panel.addEventListener("mousedown", (e) => e.preventDefault());

    const swatchGrid = document.createElement("div");
    swatchGrid.className = "rte-color-swatches";
    palette.forEach((renk) => {
      const sw = document.createElement("button");
      sw.type = "button";
      sw.className = "rte-color-swatch";
      sw.style.background = renk === "transparent"
        ? "repeating-conic-gradient(#8886 0% 25%, transparent 0% 50%) 50% / 10px 10px"
        : renk;
      sw.title = renk;
      sw.addEventListener("click", () => uygula(renk));
      swatchGrid.appendChild(sw);
    });

    const hexRow = document.createElement("div");
    hexRow.className = "rte-color-hex";
    const hexInput = document.createElement("input");
    hexInput.type = "text";
    hexInput.placeholder = "#RRGGBB";
    hexInput.maxLength = 7;
    const hexBtn = document.createElement("button");
    hexBtn.type = "button";
    hexBtn.textContent = "Uygula";
    hexBtn.addEventListener("click", () => {
      const v = hexInput.value.trim();
      if (/^#[0-9a-fA-F]{3,6}$/.test(v)) uygula(v);
    });
    hexInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); hexBtn.click(); }
    });
    hexRow.append(hexInput, hexBtn);

    panel.append(swatchGrid, hexRow);
    trigger.parentElement.appendChild(panel);

    setTimeout(() => {
      document.addEventListener("mousedown", disaridaTikla, true);
      document.addEventListener("keydown", escKapat, true);
    }, 0);
  });
}

export function createRichTextEditor(editor, toolbar) {
  const btn = (sel) => toolbar.querySelector(sel);

  // Toolbar'daki <button>'lara tıklamak tarayıcıda editörün seçimini/focus'unu
  // kaybettirir (mousedown editör dışına odak taşır). preventDefault ile bu
  // engellenir, seçim tıklama anında hâlâ DOM'da olur. editor.focus() seçimden
  // ÖNCE çağrılmamalı - odaklanma seçimi imleç konumuna daraltabilir (jsdom'da
  // doğrulandı, gerçek tarayıcılarda da güvenilir değil).
  toolbar.querySelectorAll("button").forEach((b) => {
    b.addEventListener("mousedown", (e) => e.preventDefault());
  });

  btn('[data-cmd="bold"]')?.addEventListener("click", () => sarmalaToggle(editor, "strong"));
  btn('[data-cmd="italic"]')?.addEventListener("click", () => sarmalaToggle(editor, "em"));

  btn('[data-cmd="align-left"]')?.addEventListener("click", () => hizalaUygula(editor, "left"));
  btn('[data-cmd="align-center"]')?.addEventListener("click", () => hizalaUygula(editor, "center"));
  btn('[data-cmd="align-right"]')?.addEventListener("click", () => hizalaUygula(editor, "right"));

  const renkBtn = btn('[data-cmd="color"]');
  if (renkBtn) {
    createColorPopup({
      trigger: renkBtn,
      palette: RENK_PALETI,
      label: "Metin rengi seç",
      onPick: (renk) => stilUygula(editor, window.getSelection(), { color: renk })
    });
  }

  const vurguBtn = btn('[data-cmd="highlight"]');
  if (vurguBtn) {
    createColorPopup({
      trigger: vurguBtn,
      palette: VURGU_PALETI,
      label: "Vurgu rengi seç",
      onPick: (renk) => stilUygula(editor, window.getSelection(), { "background-color": renk })
    });
  }

  // Font boyutu <select>'i: açılır listeye tıklamak odağı editörden alır ve
  // contenteditable seçimi collapse olur - "change" geldiğinde uygulanacak
  // seçim kalmaz. Renk popup'ındaki gibi seçimi mousedown anında kaydedip
  // uygulamadan hemen önce geri yüklüyoruz. (editor.focus() çağırmak bu sorunu
  // çözmez, aksine seçimi imleç konumuna daraltır.)
  const boyutSelect = toolbar.querySelector('[data-cmd="font-size"]');
  if (boyutSelect) {
    let kayitliRange = null;
    boyutSelect.addEventListener("mousedown", () => {
      const s = window.getSelection();
      kayitliRange = s && s.rangeCount > 0 ? s.getRangeAt(0).cloneRange() : null;
    });
    boyutSelect.addEventListener("change", () => {
      if (!boyutSelect.value) return;
      if (kayitliRange) {
        const s = window.getSelection();
        s.removeAllRanges();
        s.addRange(kayitliRange);
      }
      stilUygula(editor, window.getSelection(), { "font-size": boyutSelect.value });
    });
  }

  return {
    // Chrome contenteditable'da Enter her yeni satır için <div> üretir; bunlar
    // sanitizasyonda düşeceği için (ALLOWED_TAGS'te div yok) satır yapısı ve
    // üzerlerindeki text-align kaybolurdu. Okuma anında hepsini <p>'ye çevirip
    // kalıcı olabilecek bir biçim veriyoruz.
    getHtml: () => {
      // En derinden başlayarak dönüştürüyoruz: iç içe div'lerde (Chrome bazen
      // üretir) önce içteki gerçek satır <p> olur, dıştaki sarmalayıcı ise
      // artık blok içerdiği için <p>'ye çevrilmeyip düzleştirilir - "<p> içinde
      // <p>" gibi geçersiz HTML üretmemek için.
      const divler = [...editor.querySelectorAll("div")].reverse();
      divler.forEach((div) => {
        if (div.querySelector("p, div")) {
          // Blok içeren sarmalayıcı: kendisini kaldır, çocuklarını yerine koy.
          div.replaceWith(...div.childNodes);
        } else {
          divToP(div);
        }
      });
      return editor.innerHTML;
    },
    setHtml: (html) => { editor.innerHTML = html || ""; },
    isEmpty: () => editor.textContent.trim() === ""
  };
}

// DOMPurify konfigürasyonu: yalnızca editörün ürettiği etiketler + güvenli
// style özellikleri. Ayrı export ediliyor ki ilan-form.js (kaydetme) ve
// ilan-detay.js (render, savunma-derinliği) aynı kuralları kullansın.
export function temizleAciklamaHtml(kirliHtml) {
  if (typeof DOMPurify === "undefined") {
    // DOMPurify CDN'den yüklenemezse (ağ hatası vb.) tüm HTML'i düşürüp
    // düz metne indirger - sessizce kirli HTML geçirmek yerine güvenli tarafta kal.
    const div = document.createElement("div");
    div.textContent = kirliHtml || "";
    return div.innerHTML;
  }

  // style attribute'u sadece izin verilen özellikleri barındırabilir - aksi halde
  // "background: url(javascript:...)" gibi CSS injection yollarıyla allowlist atlatılabilir.
  const hook = (node, data) => {
    if (data.attrName !== "style") return;
    const guvenli = data.attrValue
      .split(";")
      .map((s) => s.trim())
      .filter((s) => {
        const ozellik = s.split(":")[0]?.trim().toLowerCase();
        return IZIN_VERILEN_STIL.has(ozellik) && !/url\s*\(|expression\s*\(|javascript:/i.test(s);
      })
      .join("; ");
    data.attrValue = guvenli;
  };

  DOMPurify.addHook("uponSanitizeAttribute", hook);
  const temiz = DOMPurify.sanitize(kirliHtml || "", {
    ALLOWED_TAGS: ["b", "strong", "i", "em", "span", "br", "p"],
    ALLOWED_ATTR: ["style"],
  });
  DOMPurify.removeHook("uponSanitizeAttribute", hook);
  return temiz;
}
