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
    this.files = [];
    // Düzenleme akışında yüklenen mevcut uzak fotoğraflar: { url, path, keep }.
    // Yeni seçilen dosyalardan (bu.files) ayrı tutuluyor çünkü biri zaten
    // Storage'da duran uzak dosya, diğeri henüz yüklenmemiş yerel File nesnesi.
    this.existing = [];
    this.el = { dropArea, input, previewGrid, countLabel, clearBtn };

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

  // Düzenleme modunda validate() bu sayıyı kullanır: kullanıcı hiç yeni
  // fotoğraf eklemeden mevcutları koruyarak kaydedebilmeli, yalnızca yeni
  // seçilenler üzerinden sayarsak "en az 1 fotoğraf" hatası yanlışlıkla tetiklenir.
  get count() { return this.files.length + this.keptExisting.length; }

  get keptExisting() { return this.existing.filter((e) => e.keep); }
  get keptExistingUrls() { return this.keptExisting.map((e) => e.url); }
  // path'ler URL'lerle aynı sırada olmalı (loadExisting ikisini index ile
  // eşliyor), bu yüzden null'lar burada süzülmez - filtrelemek hizalamayı bozar.
  get keptExistingPaths() { return this.keptExisting.map((e) => e.path); }
  // deleteObject'e null gitmesin: yolu hiç çözülemeyen dosya silinemez.
  get removedExistingPaths() {
    return this.existing.filter((e) => !e.keep && e.path).map((e) => e.path);
  }
  getOrderedItems() {
  return [
    ...this.keptExisting.map((item) => ({
      type: "existing",
      item
    })),
    ...this.files.map((file) => ({
      type: "new",
      item: file
    }))
  ];
}

reorder(fromIndex, toIndex) {
  const items = this.getOrderedItems();

  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return;
  }

  const [moved] = items.splice(fromIndex, 1);
  items.splice(toIndex, 0, moved);

  // Sıralamayı tekrar mevcut / yeni olarak ayır.
  this.files = items
    .filter((x) => x.type === "new")
    .map((x) => x.item);

  const kept = items
    .filter((x) => x.type === "existing")
    .map((x) => x.item);

  // Silinmiş mevcut fotoğraflar existing içinde kalmalı.
  const removed = this.existing.filter((item) => !item.keep);

  this.existing = [...kept, ...removed];

  this.render();
}
getOrderedPhotoUrls(newUrls = []) {
  let newIndex = 0;

  return this.getOrderedItems().map((entry) => {
    if (entry.type === "existing") {
      return entry.item.url;
    }

    return newUrls[newIndex++];
  });
}

getOrderedPhotoPaths(newPaths = []) {
  let newIndex = 0;

  return this.getOrderedItems().map((entry) => {
    if (entry.type === "existing") {
      return entry.item.path;
    }

    return newPaths[newIndex++];
  });
}
  /**
   * Düzenleme akışında mevcut ilanın fotoğraflarını yükler. Yeni seçilen
   * dosyalardan (this.files) bağımsız - create akışı bunu hiç çağırmaz,
   * bu yüzden davranışı hiç değişmez (existing her zaman boş dizi kalır).
   *
   * photoPaths alanı sonradan eklendiği için eski kayıtlarda yol gelmez;
   * bu durumda URL'den türetilir, aksi halde kaldırılan fotoğraf Storage'da
   * yetim kalır. Türetilen yol kayda da yazılır (keptExistingPaths).
   * @param {string[]} urls
   * @param {string[]} paths
   */
  loadExisting(urls = [], paths = []) {
    this.existing = urls.map((url, i) => ({
      url,
      path: paths[i] || storagePathFromUrl(url),
      keep: true
    }));
    this.render();
  }

  removeExisting(index) {
    this.existing[index].keep = false;
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
      const dup = this.files.some((f) => f.name === file.name && f.size === file.size);
      if (!dup) this.files.push(file);
    });

    this.render();
    if (errors.length) alert(errors.join("\n"));
  }

  remove(index) {
    this.files.splice(index, 1);
    this.render();
  }

  clear() {
    this.files = [];
    this.existing = [];
    this.render();
  }

  render() {
  const { previewGrid, countLabel } = this.el;

  // Eski blob URL'lerini serbest bırak
  $$("img", previewGrid).forEach((img) => {
    if (img.src.startsWith("blob:")) {
      URL.revokeObjectURL(img.src);
    }
  });

  previewGrid.innerHTML = "";

  const items = this.getOrderedItems();

  items.forEach((entry, index) => {
    const el = document.createElement("div");

    el.className = "preview-item";
    el.draggable = true;
    el.dataset.index = String(index);

    // ---------------------------------------------------------
    // Fotoğraf
    // ---------------------------------------------------------

    const img = document.createElement("img");
    img.alt = "";

    if (entry.type === "existing") {
      img.src = entry.item.url;
    } else {
      img.src = URL.createObjectURL(entry.item);
      img.alt = entry.item.name;
    }

    // ---------------------------------------------------------
    // Drag handle
    // ---------------------------------------------------------

    const handle = document.createElement("span");
    handle.className = "drag-handle";
    handle.innerHTML = '<i class="fas fa-grip-vertical"></i>';
    handle.setAttribute("aria-hidden", "true");

    // ---------------------------------------------------------
    // Sil butonu
    // ---------------------------------------------------------

    const btn = document.createElement("button");

    btn.type = "button";
    btn.className = "remove";
    btn.setAttribute(
      "aria-label",
      entry.type === "existing"
        ? "Fotoğrafı kaldır"
        : `${entry.item.name} fotoğrafını kaldır`
    );

    btn.innerHTML = '<i class="fas fa-times"></i>';

    btn.addEventListener("click", (e) => {
      e.stopPropagation();

      if (entry.type === "existing") {
        const realIndex = this.existing.indexOf(entry.item);

        if (realIndex !== -1) {
          this.removeExisting(realIndex);
        }
      } else {
        const realIndex = this.files.indexOf(entry.item);

        if (realIndex !== -1) {
          this.remove(realIndex);
        }
      }
    });

    // ---------------------------------------------------------
    // Vitrin etiketi
    // ---------------------------------------------------------

    if (index === 0) {
      const tag = document.createElement("span");

      tag.className = "cover-tag";
      tag.textContent = "Vitrin";

      el.appendChild(tag);
    }

    // ---------------------------------------------------------
    // Drag & Drop
    // ---------------------------------------------------------

    el.addEventListener("dragstart", (e) => {
      e.stopPropagation();

      el.classList.add("is-dragging");

      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData(
        "text/plain",
        String(index)
      );
    });

    el.addEventListener("dragend", () => {
      el.classList.remove("is-dragging");

      $$(".preview-item", previewGrid).forEach((item) => {
        item.classList.remove("is-drag-over");
      });
    });

    el.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();

      e.dataTransfer.dropEffect = "move";

      el.classList.add("is-drag-over");
    });

    el.addEventListener("dragleave", (e) => {
      if (!el.contains(e.relatedTarget)) {
        el.classList.remove("is-drag-over");
      }
    });

    el.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();

      el.classList.remove("is-drag-over");

      const fromIndex = Number(
        e.dataTransfer.getData("text/plain")
      );

      const toIndex = Number(el.dataset.index);

      this.reorder(fromIndex, toIndex);
    });

    el.append(img, handle, btn);

    previewGrid.appendChild(el);
  });

  // ---------------------------------------------------------
  // Sayaç
  // ---------------------------------------------------------

  countLabel.textContent = this.count
    ? `${this.count} / ${MAX_PHOTOS} fotoğraf (${this.keptExisting.length} mevcut, ${this.files.length} yeni)`
    : "";

  if (!this.keptExisting.length && this.files.length) {
    countLabel.textContent =
      `${this.files.length} / ${MAX_PHOTOS} fotoğraf seçildi`;
  }
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
