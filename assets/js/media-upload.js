// Fotoğraf / video seçimi: doğrulama, önizleme, sürükle-bırak.
// Dosyalar burada bir listede tutulur; input.files salt okunur olduğu için
// tek tek silme ancak kendi listemizle mümkün.
import { $, $$ } from "./utils.js";

const MAX_PHOTO_MB = 5;
const MAX_VIDEO_MB = 50;
const MAX_PHOTOS = 20;

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1);

/**
 * Firebase download URL'inden Storage yolunu çıkarır.
 *
 * photoPaths/videoPath alanları sonradan eklendi - o alanlar yazılmadan önce
 * kaydedilmiş ilanlarda elimizde yalnızca URL var. Yolu bilmeden dosya
 * silinemeyeceği için ilan silindiğinde dosyalar Storage'da yetim kalıyordu.
 * Download URL'inde yol "/o/" ile "?" arasında URL-encoded durur:
 *   https://.../o/ilanlar%2Ffotolar%2F123-abc.jpg?alt=media&token=...
 *
 * @param {string} url
 * @returns {string|null} "ilanlar/fotolar/123-abc.jpg" veya çözülemezse null
 */
export function storagePathFromUrl(url) {
  if (typeof url !== "string") return null;
  const match = url.match(/\/o\/([^?]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null; // bozuk encoding - yol tahmin edilemez
  }
}

export class PhotoPicker {
  constructor({ dropArea, input, previewGrid, countLabel, clearBtn }) {
    // Vitrin sırası tek bir listede tutulur; her eleman ya Storage'da duran bir
    // uzak fotoğraf ya da henüz yüklenmemiş yerel bir File:
    //   { kind: "existing", url, path, keep }
    //   { kind: "new", file }
    //
    // Önceden sıra iki ayrı diziden (existing + files) türetiliyordu; bu yüzden
    // yeni bir fotoğraf mevcutların arasına taşınamıyordu - sürükleme sonrası
    // liste "önce tüm mevcutlar, sonra tüm yeniler" haline geri sıçrıyor, yani
    // yeni yüklenen bir fotoğraf vitrin yapılamıyordu.
    this.items = [];
    this.el = { dropArea, input, previewGrid, countLabel, clearBtn };
    // Blob URL'leri File başına bir kez üretilir: her render'da yeniden
    // oluşturmak sürükleme sırasında görselleri gereksizce yeniden yükletiyordu.
    this._blobUrls = new Map();

    dropArea.addEventListener("click", () => input.click());
    dropArea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); }
    });

    input.addEventListener("change", () => {
      this.add(Array.from(input.files));
      input.value = ""; // aynı dosya tekrar seçilebilsin
    });

    clearBtn.addEventListener("click", () => this.clear());

    ["dragenter", "dragover"].forEach((ev) =>
      dropArea.addEventListener(ev, (e) => { e.preventDefault(); dropArea.classList.add("is-dragover"); }));
    ["dragleave", "drop"].forEach((ev) =>
      dropArea.addEventListener(ev, (e) => { e.preventDefault(); dropArea.classList.remove("is-dragover"); }));

    dropArea.addEventListener("drop", (e) => {
      const dropped = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
      this.add(dropped);
    });
  }

  // Ekranda görünen sıra: silinmiş mevcut fotoğraflar listede kalır (yolları
  // submit anında Storage'dan silmek için gerekli) ama gösterilmez.
  get visibleItems() { return this.items.filter((it) => it.kind === "new" || it.keep); }

  // Düzenleme modunda validate() bu sayıyı kullanır: kullanıcı hiç yeni
  // fotoğraf eklemeden mevcutları koruyarak kaydedebilmeli, yalnızca yeni
  // seçilenler üzerinden sayarsak "en az 1 fotoğraf" hatası yanlışlıkla tetiklenir.
  get count() { return this.visibleItems.length; }

  // uploadPhotos() bu diziyi sırayla yükler; getOrderedPhoto* dönen URL/yolları
  // yine bu sırayla eşleştirir, bu yüzden ikisi her zaman hizalı kalır.
  get files() {
    return this.visibleItems.filter((it) => it.kind === "new").map((it) => it.file);
  }

  // deleteObject'e null gitmesin: yolu hiç çözülemeyen dosya silinemez.
  get removedExistingPaths() {
    return this.items
      .filter((it) => it.kind === "existing" && !it.keep && it.path)
      .map((it) => it.path);
  }

  /**
   * Ekrandaki sırayı, yeni yüklenen dosyaların URL'leriyle birleştirir.
   * newUrls, this.files ile aynı sırada olmalıdır (uploadPhotos öyle üretir).
   */
  getOrderedPhotoUrls(newUrls = []) {
    let i = 0;
    return this.visibleItems.map((it) => (it.kind === "existing" ? it.url : newUrls[i++]));
  }

  getOrderedPhotoPaths(newPaths = []) {
    let i = 0;
    return this.visibleItems.map((it) => (it.kind === "existing" ? it.path : newPaths[i++]));
  }

  /**
   * Görünür listede bir fotoğrafı başka bir konuma taşır. Tek liste üzerinde
   * çalıştığı için mevcut ve yeni fotoğraflar birbirinin arasına geçebilir.
   */
  reorder(fromIndex, toIndex) {
    const visible = this.visibleItems;
    if (
      fromIndex < 0 || toIndex < 0 ||
      fromIndex >= visible.length || toIndex >= visible.length ||
      fromIndex === toIndex
    ) return;

    const moved = visible[fromIndex];
    const target = visible[toIndex];

    // Gerçek indeksler üzerinden taşı: this.items silinmiş kayıtları da
    // içerdiği için görünür indeksler doğrudan kullanılamaz.
    const from = this.items.indexOf(moved);
    this.items.splice(from, 1);
    this.items.splice(this.items.indexOf(target) + (fromIndex < toIndex ? 1 : 0), 0, moved);

    this.render();
  }

  /**
   * Düzenleme akışında mevcut ilanın fotoğraflarını yükler. Create akışı bunu
   * hiç çağırmaz, o yüzden orada liste yalnızca yeni dosyalardan oluşur.
   *
   * photoPaths alanı sonradan eklendiği için eski kayıtlarda yol gelmez;
   * bu durumda URL'den türetilir, aksi halde kaldırılan fotoğraf Storage'da
   * yetim kalır.
   * @param {string[]} urls
   * @param {string[]} paths
   */
  loadExisting(urls = [], paths = []) {
    this.items = urls.map((url, i) => ({
      kind: "existing",
      url,
      path: paths[i] || storagePathFromUrl(url),
      keep: true
    }));
    this.render();
  }

  add(incoming) {
    const errors = [];

    incoming.forEach((file) => {
      if (this.count >= MAX_PHOTOS) {
        errors.push(`En fazla ${MAX_PHOTOS} fotoğraf eklenebilir.`);
        return;
      }
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
        errors.push(`${file.name}: yalnızca JPEG, PNG ve WEBP desteklenir.`);
        return;
      }
      if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
        errors.push(`${file.name} (${mb(file.size)} MB) ${MAX_PHOTO_MB} MB sınırını aşıyor.`);
        return;
      }
      // Aynı dosyayı iki kez eklemeyi engelle
      const dup = this.items.some(
        (it) => it.kind === "new" && it.file.name === file.name && it.file.size === file.size
      );
      if (!dup) this.items.push({ kind: "new", file });
    });

    this.render();
    if (errors.length) alert(errors.join("\n"));
  }

  /** Görünür listedeki bir fotoğrafı kaldırır (yeni ise listeden düşer,
   *  mevcut ise Storage'dan silinmek üzere işaretlenir). */
  removeAt(visibleIndex) {
    const item = this.visibleItems[visibleIndex];
    if (!item) return;

    if (item.kind === "existing") {
      item.keep = false;
    } else {
      this._releaseBlob(item.file);
      this.items.splice(this.items.indexOf(item), 1);
    }
    this.render();
  }

  clear() {
    this.items.forEach((it) => { if (it.kind === "new") this._releaseBlob(it.file); });
    this.items = [];
    this.render();
  }

  // File -> blob URL eşlemesi; aynı dosya için tekrar üretilmez.
  _blobUrl(file) {
    if (!this._blobUrls.has(file)) this._blobUrls.set(file, URL.createObjectURL(file));
    return this._blobUrls.get(file);
  }

  _releaseBlob(file) {
    const url = this._blobUrls.get(file);
    if (url) {
      URL.revokeObjectURL(url);
      this._blobUrls.delete(file);
    }
  }

  render() {
    const { previewGrid, countLabel } = this.el;
    previewGrid.innerHTML = "";

    const visible = this.visibleItems;

    visible.forEach((entry, index) => {
      const el = document.createElement("div");
      el.className = "preview-item";
      el.draggable = true;
      el.dataset.index = String(index);

      const img = document.createElement("img");
      if (entry.kind === "existing") {
        img.src = entry.url;
        img.alt = "";
      } else {
        img.src = this._blobUrl(entry.file);
        img.alt = entry.file.name;
      }
      // Sürüklenen görselin yarı saydam "hayalet"i tarayıcıya bırakılır;
      // img'nin kendisi sürüklenebilir olursa asıl sürükleme iptal oluyor.
      img.draggable = false;

      const handle = document.createElement("span");
      handle.className = "drag-handle";
      handle.innerHTML = '<i class="fas fa-grip-vertical"></i>';
      handle.setAttribute("aria-hidden", "true");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "remove";
      btn.setAttribute(
        "aria-label",
        entry.kind === "existing" ? "Fotoğrafı kaldır" : `${entry.file.name} fotoğrafını kaldır`
      );
      btn.innerHTML = '<i class="fas fa-times"></i>';
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.removeAt(index);
      });

      if (index === 0) {
        const tag = document.createElement("span");
        tag.className = "cover-tag";
        tag.textContent = "Vitrin";
        el.appendChild(tag);
      }

      el.addEventListener("dragstart", (e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(index));
        // Sınıf bir sonraki kareye ertelenir: dragstart anında uygulanırsa
        // tarayıcı sürükleme görüntüsünü küçülmüş/soluk halinden alır.
        requestAnimationFrame(() => el.classList.add("is-dragging"));
        previewGrid.classList.add("is-sorting");
      });

      el.addEventListener("dragend", () => {
        el.classList.remove("is-dragging");
        previewGrid.classList.remove("is-sorting");
        $$(".preview-item", previewGrid).forEach((item) =>
          item.classList.remove("is-drag-over", "drop-before", "drop-after")
        );
      });

      el.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        if (el.classList.contains("is-dragging")) return;

        // İmleç kartın hangi yarısında? Bırakma çizgisi o tarafa çizilir.
        const { left, width } = el.getBoundingClientRect();
        const after = e.clientX > left + width / 2;
        el.classList.add("is-drag-over");
        el.classList.toggle("drop-after", after);
        el.classList.toggle("drop-before", !after);
      });

      el.addEventListener("dragleave", (e) => {
        if (!el.contains(e.relatedTarget)) {
          el.classList.remove("is-drag-over", "drop-before", "drop-after");
        }
      });

      el.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.remove("is-drag-over", "drop-before", "drop-after");
        this.reorder(Number(e.dataTransfer.getData("text/plain")), index);
      });

      el.append(img, handle, btn);
      previewGrid.appendChild(el);
    });

    const mevcut = visible.filter((it) => it.kind === "existing").length;
    const yeni = visible.length - mevcut;

    if (!visible.length) countLabel.textContent = "";
    else if (!mevcut) countLabel.textContent = `${yeni} / ${MAX_PHOTOS} fotoğraf seçildi`;
    else countLabel.textContent = `${visible.length} / ${MAX_PHOTOS} fotoğraf (${mevcut} mevcut, ${yeni} yeni)`;
  }
}

export class VideoPicker {
  constructor({ dropArea, input, countLabel, clearBtn }) {
    this.file = null;
    // Düzenleme akışında yüklenen mevcut uzak video: { url, path } | null.
    // keep bayrağı gerekmiyor - tekil olduğu için "Kaldır" doğrudan null'a çeker.
    this.existing = null;
    // Kullanıcı mevcut videoyu değiştirdiğinde/kaldırdığında Storage'dan
    // silinmesi gereken eski path burada tutulur (submit anında okunur).
    this.removedExistingPath = null;
    this.el = { dropArea, input, countLabel, clearBtn };

    dropArea.addEventListener("click", () => input.click());
    input.addEventListener("change", () => this.set(input.files[0] || null));
    clearBtn.addEventListener("click", () => { input.value = ""; this._dropExisting(); this.set(null); });

    ["dragenter", "dragover"].forEach((ev) =>
      dropArea.addEventListener(ev, (e) => { e.preventDefault(); dropArea.classList.add("is-dragover"); }));
    ["dragleave", "drop"].forEach((ev) =>
      dropArea.addEventListener(ev, (e) => { e.preventDefault(); dropArea.classList.remove("is-dragover"); }));

    dropArea.addEventListener("drop", (e) => {
      const f = Array.from(e.dataTransfer.files).find((x) => x.type.startsWith("video/"));
      if (f) this.set(f);
    });
  }

  // Mevcut uzak videonun tutulup tutulmadığı: kullanıcı yeni bir dosya
  // seçmediyse ve "Kaldır"a basmadıysa mevcut video korunur.
  get keptExistingUrl() { return this.existing ? this.existing.url : null; }
  get keptExistingPath() { return this.existing ? this.existing.path : null; }

  loadExisting(url, path) {
    if (!url) return;
    // Yol kayıtta yoksa URL'den türetilir - bkz. PhotoPicker.loadExisting.
    this.existing = { url, path: path || storagePathFromUrl(url) };
    this.el.countLabel.textContent = `Mevcut video (${url.split("/").pop().split("?")[0]})`;
  }

  _dropExisting() {
    if (this.existing) this.removedExistingPath = this.existing.path;
    this.existing = null;
  }

  set(file) {
    if (file) {
      if (!/^video\/(mp4|webm|quicktime)$/.test(file.type)) {
        alert("Video formatı MP4, WEBM veya MOV olmalı.");
        return;
      }
      if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
        alert(`Video ${mb(file.size)} MB — ${MAX_VIDEO_MB} MB sınırını aşıyor.`);
        return;
      }
      // Yeni bir dosya seçildiğinde mevcut uzak video artık ekranda görünmez -
      // submit'te removedExistingPath ile Storage'dan silinmesi gerektiği bilinsin.
      this._dropExisting();
    }
    this.file = file;
    this.el.countLabel.textContent = file ? `${file.name} (${mb(file.size)} MB)` : "";
  }

  clear() {
    this._dropExisting();
    this.file = null;
    this.el.input.value = "";
    this.el.countLabel.textContent = "";
  }
}

// Yükleme sırasında ilerleme çubuğunu yönetir.
export class ProgressBar {
  constructor(wrap) {
    this.wrap = wrap;
    this.fill = $(".progress-bar span", wrap);
    this.text = $(".progress-text", wrap);
  }
  start(label) { this.wrap.hidden = false; this.set(0, label); }
  set(percent, label) {
    this.fill.style.width = `${Math.round(percent)}%`;
    if (label) this.text.textContent = label;
  }
  done() { this.wrap.hidden = true; this.fill.style.width = "0"; }
}
