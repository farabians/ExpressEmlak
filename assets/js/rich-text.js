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
function stilUygula(editor, sel, stiller) {
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return;

  const span = document.createElement("span");
  const stilMetni = Object.entries(stiller)
    .filter(([k]) => IZIN_VERILEN_STIL.has(k))
    .map(([k, v]) => `${k}: ${v}`)
    .join("; ");
  span.setAttribute("style", stilMetni);

  try {
    range.surroundContents(span);
  } catch {
    const frag = range.extractContents();
    span.appendChild(frag);
    range.insertNode(span);
  }
}

// Hizalama blok seviyesinde uygulanır: seçimi içeren en yakın <p>'ye
// (yoksa oluşturulur) text-align stili eklenir.
function hizalaUygula(editor, align) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return;

  let node = range.commonAncestorContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;

  let blok = node;
  while (blok && blok !== editor && blok.tagName !== "P" && blok.tagName !== "DIV") {
    blok = blok.parentNode;
  }

  if (!blok || blok === editor) {
    // Editörün doğrudan içindeki metni bir <p>'ye sar.
    const p = document.createElement("p");
    p.style.textAlign = align;
    const frag = range.extractContents();
    p.appendChild(frag);
    range.insertNode(p);
    return;
  }

  blok.style.textAlign = align;
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

  const renkInput = toolbar.querySelector('[data-cmd="color"]');
  renkInput?.addEventListener("input", () => {
    stilUygula(editor, window.getSelection(), { color: renkInput.value });
  });

  const vurguInput = toolbar.querySelector('[data-cmd="highlight"]');
  vurguInput?.addEventListener("input", () => {
    stilUygula(editor, window.getSelection(), { "background-color": vurguInput.value });
  });

  const boyutSelect = toolbar.querySelector('[data-cmd="font-size"]');
  boyutSelect?.addEventListener("change", () => {
    editor.focus();
    if (boyutSelect.value) stilUygula(editor, window.getSelection(), { "font-size": boyutSelect.value });
  });

  return {
    getHtml: () => editor.innerHTML,
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
