// Fotoğraf / video seçimi: doğrulama, önizleme, sürükle-bırak.
// Dosyalar burada bir listede tutulur; input.files salt okunur olduğu için
// tek tek silme ancak kendi listemizle mümkün.
import { $, $$ } from "./utils.js";

const MAX_PHOTO_MB = 5;
const MAX_VIDEO_MB = 50;
const MAX_PHOTOS = 20;

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1);

export class PhotoPicker {
  constructor({ dropArea, input, previewGrid, countLabel, clearBtn }) {
    this.files = [];
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

  get count() { return this.files.length; }

  add(incoming) {
    const errors = [];

    incoming.forEach((file) => {
      if (this.files.length >= MAX_PHOTOS) {
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
    this.render();
  }

  render() {
    const { previewGrid, countLabel } = this.el;

    // Eski önizleme URL'lerini serbest bırak
    $$("img", previewGrid).forEach((img) => URL.revokeObjectURL(img.src));
    previewGrid.innerHTML = "";

    this.files.forEach((file, i) => {
      const item = document.createElement("div");
      item.className = "preview-item";

      const img = document.createElement("img");
      img.src = URL.createObjectURL(file);
      img.alt = file.name;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "remove";
      btn.setAttribute("aria-label", `${file.name} fotoğrafını kaldır`);
      btn.innerHTML = '<i class="fas fa-times"></i>';
      btn.addEventListener("click", () => this.remove(i));

      item.append(img, btn);
      if (i === 0) {
        const tag = document.createElement("span");
        tag.className = "cover-tag";
        tag.textContent = "Vitrin";
        item.appendChild(tag);
      }
      previewGrid.appendChild(item);
    });

    countLabel.textContent = this.files.length
      ? `${this.files.length} / ${MAX_PHOTOS} fotoğraf seçildi`
      : "";
  }
}

export class VideoPicker {
  constructor({ dropArea, input, countLabel, clearBtn }) {
    this.file = null;
    this.el = { dropArea, input, countLabel, clearBtn };

    dropArea.addEventListener("click", () => input.click());
    input.addEventListener("change", () => this.set(input.files[0] || null));
    clearBtn.addEventListener("click", () => { input.value = ""; this.set(null); });

    ["dragenter", "dragover"].forEach((ev) =>
      dropArea.addEventListener(ev, (e) => { e.preventDefault(); dropArea.classList.add("is-dragover"); }));
    ["dragleave", "drop"].forEach((ev) =>
      dropArea.addEventListener(ev, (e) => { e.preventDefault(); dropArea.classList.remove("is-dragover"); }));

    dropArea.addEventListener("drop", (e) => {
      const f = Array.from(e.dataTransfer.files).find((x) => x.type.startsWith("video/"));
      if (f) this.set(f);
    });
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
    }
    this.file = file;
    this.el.countLabel.textContent = file ? `${file.name} (${mb(file.size)} MB)` : "";
  }

  clear() { this.file = null; this.el.input.value = ""; this.el.countLabel.textContent = ""; }
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
