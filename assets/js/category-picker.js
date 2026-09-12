// Adım adım kategori seçimi + kelime ile arama.
// Tek sorumluluk: bir yol (["Konut","Kiralık","Daire"]) seçtirmek ve
// seçim tamamlandığında onSelect ile bildirmek.
import { CATEGORY_TREE } from "./constants.js";
import { escapeHtml } from "./utils.js";

// Ağacı tek seferde düz listeye açar; arama bunun üzerinde çalışır.
function flatten(tree) {
  const out = [];
  Object.entries(tree).forEach(([kategori, tipler]) => {
    Object.entries(tipler).forEach(([tip, altlar]) => {
      altlar.forEach((alt) => out.push({ path: [kategori, tip, alt], text: `${kategori} ${tip} ${alt}` }));
    });
  });
  return out;
}

const ALL_PATHS = flatten(CATEGORY_TREE);

// Türkçe karakterleri arama için sadeleştirir: "Müstakil" ~ "mustakil"
function norm(value) {
  const map = { ç: "c", ö: "o", ş: "s", ı: "i", ü: "u", ğ: "g", i: "i" };
  return (value || "").toLowerCase().replace(/[çöşıüği]/g, (m) => map[m] || m).trim();
}

export class CategoryPicker {
  /**
   * @param {object} opts
   * @param {HTMLElement} opts.columns   kolonların basılacağı kap
   * @param {HTMLElement} opts.breadcrumb
   * @param {HTMLInputElement} opts.searchInput
   * @param {HTMLElement} opts.searchResults
   * @param {(path: string[]) => void} opts.onComplete  3 seviye seçilince çağrılır
   * @param {() => void} opts.onContinue  "Devam" butonuna basılınca
   */
  constructor(opts) {
    this.el = opts;
    this.path = [];
    this.render();
    this.bindSearch();
  }

  get isComplete() { return this.path.length >= 3; }

  reset() {
    this.path = [];
    this.el.searchInput.value = "";
    this.el.searchResults.innerHTML = "";
    this.render();
  }

  setPath(path) {
    this.path = path.slice();
    this.render();
    this.el.columns.scrollLeft = this.el.columns.scrollWidth;
  }

  /* ---------------------------------------------------------- Kolonlar */

  render() {
    const { columns } = this.el;
    columns.innerHTML = "";

    // 1. kolon: ana kategoriler
    this.addColumn(Object.keys(CATEGORY_TREE), 0);

    // Seçilen her seviye bir sonraki kolonu açar
    let node = CATEGORY_TREE;
    for (let i = 0; i < this.path.length; i++) {
      node = node[this.path[i]];
      if (!node) break;
      const items = Array.isArray(node) ? node : Object.keys(node);
      this.addColumn(items, i + 1);
      if (Array.isArray(node)) break;
    }

    this.renderBreadcrumb();

    if (this.isComplete) {
      this.addSuccessBox();
      this.el.onComplete(this.path.slice());
    }
  }

  addColumn(items, level) {
    const col = document.createElement("div");
    col.className = "category-col";
    col.setAttribute("role", "listbox");
    col.setAttribute("aria-label", `Kategori seviyesi ${level + 1}`);

    items.forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "category-item";
      btn.textContent = item;
      btn.setAttribute("role", "option");
      const selected = this.path[level] === item;
      btn.setAttribute("aria-selected", String(selected));
      if (selected) btn.classList.add("is-selected");
      btn.addEventListener("click", () => this.select(item, level));
      col.appendChild(btn);
    });

    this.el.columns.appendChild(col);
  }

  select(item, level) {
    this.path = this.path.slice(0, level).concat(item);
    this.render();
    // Yeni kolonu görünür yap
    requestAnimationFrame(() => { this.el.columns.scrollLeft = this.el.columns.scrollWidth; });
  }

  addSuccessBox() {
    const box = document.createElement("div");
    box.className = "success-box";
    box.innerHTML = `
      <div class="success-icon"><i class="fas fa-check"></i></div>
      <p>Kategori seçimi<br>tamamlanmıştır.</p>
      <button type="button" class="btn">Devam</button>
    `;
    box.querySelector("button").addEventListener("click", () => this.el.onContinue());
    this.el.columns.appendChild(box);
  }

  renderBreadcrumb() {
    const { breadcrumb } = this.el;
    if (!this.path.length) {
      breadcrumb.innerHTML = '<span class="crumb-home">Emlak</span><span>&rsaquo;</span><span>Kategori seçiniz</span>';
      return;
    }
    breadcrumb.innerHTML = '<span class="crumb-home">Emlak</span>' + this.path.map((p, i) => {
      const last = i === this.path.length - 1;
      return `<span>&rsaquo;</span><span class="${last ? "crumb-current" : ""}">${escapeHtml(p)}</span>`;
    }).join("");
  }

  /* ------------------------------------------------------------ Arama */

  bindSearch() {
    const { searchInput, searchResults } = this.el;
    searchInput.disabled = false;
    let activeIndex = -1;
    let matches = [];

    const close = () => { searchResults.innerHTML = ""; activeIndex = -1; matches = []; };

    const paint = () => {
      Array.from(searchResults.children).forEach((el, i) => {
        el.classList.toggle("is-active", i === activeIndex);
      });
    };

    const apply = (i) => {
      if (!matches[i]) return;
      this.setPath(matches[i].path);
      searchInput.value = matches[i].path.join(" › ");
      close();
    };

    searchInput.addEventListener("input", () => {
      const q = norm(searchInput.value);
      if (q.length < 2) { close(); return; }

      // Girilen her kelime yolun herhangi bir yerinde geçmeli
      const words = q.split(/\s+/);
      matches = ALL_PATHS.filter((p) => {
        const hay = norm(p.text);
        return words.every((w) => hay.includes(w));
      }).slice(0, 12);

      if (!matches.length) {
        searchResults.innerHTML = '<div class="search-empty">Eşleşen kategori bulunamadı.</div>';
        return;
      }

      activeIndex = 0;
      searchResults.innerHTML = matches.map((m, i) => `
        <button type="button" class="search-result ${i === 0 ? "is-active" : ""}" data-index="${i}">
          <strong>${escapeHtml(m.path[2])}</strong>
          <span class="path"> — ${escapeHtml(m.path[0])} › ${escapeHtml(m.path[1])}</span>
        </button>
      `).join("");

      Array.from(searchResults.children).forEach((el) => {
        el.addEventListener("click", () => apply(Number(el.dataset.index)));
      });
    });

    searchInput.addEventListener("keydown", (e) => {
      if (!matches.length) return;
      if (e.key === "ArrowDown") { e.preventDefault(); activeIndex = (activeIndex + 1) % matches.length; paint(); }
      if (e.key === "ArrowUp") { e.preventDefault(); activeIndex = (activeIndex - 1 + matches.length) % matches.length; paint(); }
      if (e.key === "Enter") { e.preventDefault(); apply(activeIndex); }
      if (e.key === "Escape") close();
    });

    // Dışarı tıklayınca listeyi kapat
    document.addEventListener("click", (e) => {
      if (!searchResults.contains(e.target) && e.target !== searchInput) close();
    });
  }
}
