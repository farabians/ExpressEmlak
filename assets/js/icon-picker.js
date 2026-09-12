// Font Awesome ikon görsel seçici (Win+. emoji seçici benzeri bir popup).
// Ham "fa-home" gibi class adlarını körlemesine yazmak yerine, kullanıcı
// gerçek glyph'i görüp tıklayarak seçer.
//
// Emlak/finans bağlamında gerçekten anlamlı, ölçülü bir liste - rastgele
// düzinelerce ikon eklenmedi. konut-data.js'teki mevcut varsayılan ikonların
// tamamı (fa-hand-holding-usd, fa-calendar-alt, fa-key, fa-shield-alt,
// fa-percent, fa-coins, fa-home, fa-clock, fa-calculator, fa-award,
// fa-circle-check) korunuyor, 8 yeni ikon ekleniyor.
export const IKON_LISTESI = [
  // Finans
  "fa-hand-holding-usd", "fa-coins", "fa-percent", "fa-calculator", "fa-money-bill-wave",
  // Emlak
  "fa-home", "fa-building", "fa-key", "fa-door-open", "fa-warehouse",
  // Zaman / süreç
  "fa-calendar-alt", "fa-clock", "fa-hourglass-half",
  // Güven / garanti
  "fa-shield-alt", "fa-lock", "fa-award", "fa-certificate", "fa-circle-check", "fa-thumbs-up"
];

export class IconPicker {
  /**
   * @param {object} opts
   * @param {HTMLInputElement} opts.input  mevcut ikon class'ını tutan input (readonly yapılır)
   * @param {string[]} [opts.iconList]     seçilebilir ikon listesi
   */
  constructor({ input, iconList = IKON_LISTESI }) {
    this.input = input;
    this.iconList = iconList;
    this.popup = null;
    this.activeIndex = -1;

    input.readOnly = true;
    input.classList.add("icon-picker-input");
    input.addEventListener("click", () => this.toggle());
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.toggle(); }
    });

    document.addEventListener("click", (e) => {
      if (this.popup && !this.popup.contains(e.target) && e.target !== input) this.close();
    });
  }

  toggle() {
    if (this.popup) this.close();
    else this.open();
  }

  open() {
    this.close();
    const popup = document.createElement("div");
    popup.className = "icon-picker-popup";
    popup.setAttribute("role", "listbox");
    popup.setAttribute("aria-label", "İkon seç");

    popup.innerHTML = this.iconList.map((icon, i) => `
      <button type="button" class="icon-picker-item ${icon === this.input.value ? "is-selected" : ""}"
              data-icon="${icon}" data-index="${i}" role="option" aria-selected="${icon === this.input.value}">
        <i class="fas ${icon}"></i>
        <span>${icon}</span>
      </button>
    `).join("");

    popup.querySelectorAll(".icon-picker-item").forEach((btn) => {
      btn.addEventListener("click", () => this.secIkon(btn.dataset.icon));
    });

    this.input.parentElement.appendChild(popup);
    this.popup = popup;
    this.activeIndex = this.iconList.indexOf(this.input.value);

    this.keyHandler = (e) => this.onKeydown(e);
    document.addEventListener("keydown", this.keyHandler);
  }

  close() {
    if (this.popup) {
      this.popup.remove();
      this.popup = null;
    }
    if (this.keyHandler) {
      document.removeEventListener("keydown", this.keyHandler);
      this.keyHandler = null;
    }
  }

  onKeydown(e) {
    if (e.key === "Escape") { this.close(); return; }
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Enter"].includes(e.key)) return;
    e.preventDefault();

    if (e.key === "Enter") {
      if (this.activeIndex >= 0) this.secIkon(this.iconList[this.activeIndex]);
      return;
    }

    const yon = (e.key === "ArrowRight" || e.key === "ArrowDown") ? 1 : -1;
    this.activeIndex = (this.activeIndex + yon + this.iconList.length) % this.iconList.length;
    this.paintActive();
  }

  paintActive() {
    if (!this.popup) return;
    this.popup.querySelectorAll(".icon-picker-item").forEach((btn, i) => {
      btn.classList.toggle("is-active", i === this.activeIndex);
    });
  }

  secIkon(icon) {
    this.input.value = icon;
    // admin-konut.js'teki mevcut "input" event listener'ının tetiklenmesi için -
    // veri[grup][index].ikon güncellemesi bu sayede hiç değişmeden çalışır.
    this.input.dispatchEvent(new Event("input", { bubbles: true }));
    this.close();
  }
}
