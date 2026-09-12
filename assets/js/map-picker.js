// Adres panelindeki "Haritada Konum Seç" bileşeni.
// Leaflet + OpenStreetMap kullanır (API anahtarı gerekmez).
// Harita yüklenemezse enlem/boylam alanları elle doldurulabilir kalır.
import { $ } from "./utils.js";

const LEAFLET_CSS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
const LEAFLET_JS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
const NOMINATIM = "https://nominatim.openstreetmap.org/search";

// Türkiye geneli başlangıç görünümü
const DEFAULT_CENTER = [39.0, 35.0];
const DEFAULT_ZOOM = 5;

function loadCss(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.L) return resolve(window.L);
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.L));
      existing.addEventListener("error", reject);
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve(window.L);
    s.onerror = () => reject(new Error("Leaflet yüklenemedi"));
    document.head.appendChild(s);
  });
}

export class MapPicker {
  /**
   * @param {object} opts
   * @param {HTMLElement} opts.canvas   haritanın basılacağı kutu
   * @param {HTMLInputElement} opts.latInput
   * @param {HTMLInputElement} opts.lngInput
   * @param {HTMLElement} opts.note     durum metni
   * @param {HTMLButtonElement} opts.locateBtn
   * @param {HTMLButtonElement} opts.clearBtn
   * @param {() => {il: string, ilce: string, mahalle: string}} opts.getAddress
   */
  constructor(opts) {
    this.el = opts;
    this.map = null;
    this.marker = null;
    this.ready = false;

    // Elle basıldığında önbelleği yok sayıp yeniden arasın
    opts.locateBtn.addEventListener("click", () => {
      this.lastQuery = null;
      this.goToAddress();
    });
    opts.clearBtn.addEventListener("click", () => this.clear());

    // Elle koordinat girilirse haritayı takip ettir
    const sync = () => {
      const lat = parseFloat(opts.latInput.value);
      const lng = parseFloat(opts.lngInput.value);
      if (this.isValid(lat, lng)) this.setMarker(lat, lng, { pan: true, silent: true });
      else this.updateNote();
    };
    opts.latInput.addEventListener("change", sync);
    opts.lngInput.addEventListener("change", sync);

    this.init();
  }

  isValid(lat, lng) {
    return Number.isFinite(lat) && Number.isFinite(lng)
      && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }

  async init() {
    loadCss(LEAFLET_CSS);
    try {
      const L = await loadScript(LEAFLET_JS);

      this.map = L.map(this.el.canvas, { scrollWheelZoom: false })
        .setView(DEFAULT_CENTER, DEFAULT_ZOOM);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(this.map);

      // Tekerlek yalnızca haritaya tıklandıktan sonra yakınlaştırsın
      this.map.on("click", (e) => {
        this.map.scrollWheelZoom.enable();
        this.setMarker(e.latlng.lat, e.latlng.lng);
      });
      this.map.on("mouseout", () => this.map.scrollWheelZoom.disable());

      this.ready = true;
      this.L = L;

      // Harita gizli bir panelde kurulduğu için Leaflet boyutu 0 görür ve
      // kayıtların (tile) yalnızca bir kısmını ister. Kap boyut kazandığında
      // haritaya yeniden ölçüm yaptırıyoruz.
      this.watchResize();
      this.invalidate();

      // Sayfa açılırken alanlarda değer varsa işaretle
      const lat = parseFloat(this.el.latInput.value);
      const lng = parseFloat(this.el.lngInput.value);
      if (this.isValid(lat, lng)) this.setMarker(lat, lng, { pan: true, silent: true });

    } catch (err) {
      console.warn("Harita yüklenemedi, koordinatlar elle girilebilir:", err);
      this.el.canvas.innerHTML = `
        <div class="map-fallback">
          <i class="fas fa-map"></i>
          Harita yüklenemedi. Konumu enlem/boylam alanlarına elle girebilirsiniz.
        </div>`;
    }
  }

  /**
   * Kap boyutu değiştikçe (panel açıldığında, pencere yeniden boyutlandığında)
   * haritaya yeniden ölçüm yaptırır. Aksi halde eksik kayıt yüklenir.
   */
  watchResize() {
    const refresh = () => {
      if (!this.map) return;
      const box = this.el.canvas;
      if (box.offsetWidth > 0 && box.offsetHeight > 0) this.map.invalidateSize();
    };

    if (typeof ResizeObserver === "function") {
      this.resizeObserver = new ResizeObserver(refresh);
      this.resizeObserver.observe(this.el.canvas);
    }
    window.addEventListener("resize", refresh);

    // Panel ilk kez görünür olduğunda da tetiklensin
    if (typeof IntersectionObserver === "function") {
      const io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) { refresh(); }
      });
      io.observe(this.el.canvas);
      this.intersectionObserver = io;
    }

    this.refreshSize = refresh;
  }

  /** Dışarıdan çağrılır: harita görünür hale geldiğinde yeniden ölçsün. */
  invalidate() {
    if (this.refreshSize) requestAnimationFrame(() => this.refreshSize());
  }

  setMarker(lat, lng, { pan = false, silent = false } = {}) {
    const latR = Number(lat.toFixed(6));
    const lngR = Number(lng.toFixed(6));

    if (!silent) {
      this.el.latInput.value = latR;
      this.el.lngInput.value = lngR;
    }

    if (this.ready) {
      const L = this.L;
      if (!this.marker) {
        this.marker = L.marker([latR, lngR], { draggable: true }).addTo(this.map);
        this.marker.on("dragend", () => {
          const p = this.marker.getLatLng();
          this.setMarker(p.lat, p.lng);
        });
      } else {
        this.marker.setLatLng([latR, lngR]);
      }
      if (pan) this.map.setView([latR, lngR], Math.max(this.map.getZoom(), 15));
    }

    this.el.clearBtn.hidden = false;
    this.updateNote();
  }

  clear() {
    this.el.latInput.value = "";
    this.el.lngInput.value = "";
    if (this.marker) { this.marker.remove(); this.marker = null; }
    this.el.clearBtn.hidden = true;
    this.updateNote();
  }

  updateNote() {
    const lat = parseFloat(this.el.latInput.value);
    const lng = parseFloat(this.el.lngInput.value);
    const set = this.isValid(lat, lng);
    this.el.note.classList.toggle("is-set", set);
    this.el.note.textContent = set
      ? `Konum işaretlendi (${lat.toFixed(5)}, ${lng.toFixed(5)}) — ilan sayfasında tam nokta gösterilecek.`
      : "Koordinat girilmedi — ilan sayfasında mahalle merkezi gösterilir.";
    this.el.clearBtn.hidden = !set;
  }

  /**
   * Adres seçimini izler: il/ilçe/mahalle değiştikçe harita kendiliğinden
   * o bölgeye gider - kullanıcının "Adrese Git" demesi gerekmez.
   * @param {HTMLSelectElement[]} selects
   */
  followAddress(selects) {
    selects.forEach((sel) => {
      sel.addEventListener("change", () => {
        // Kullanıcı zaten bir nokta işaretlediyse görünümü zorla değiştirmeyelim.
        if (this.marker) return;
        this.scheduleAutoLocate();
      });
    });
  }

  // Üç select üst üste değişebildiği için son duruma göre tek istek yapıyoruz.
  scheduleAutoLocate() {
    // Bekleme sırasında kullanıcı boşluğa bakmasın diye notu hemen güncelliyoruz.
    if (this.el.getAddress().il) {
      this.el.note.classList.remove("is-set");
      this.el.note.textContent = "Harita konuma getiriliyor...";
    }
    clearTimeout(this.autoTimer);
    this.autoTimer = setTimeout(() => this.goToAddress({ auto: true }), 400);
  }

  /**
   * Seçili il/ilçe/mahalleyi arayıp haritayı oraya götürür.
   * @param {{auto?: boolean}} opts auto=true ise sessiz çalışır (uyarı vermez)
   */
  async goToAddress({ auto = false } = {}) {
    const { il, ilce, mahalle } = this.el.getAddress();

    if (!il) {
      if (!auto) alert("Önce il seçin.");
      return;
    }

    const sorgu = [mahalle, ilce, il, "Türkiye"].filter(Boolean).join(", ");

    // Aynı adresi tekrar tekrar sorgulamayalım
    if (this.lastQuery === sorgu) return;

    const btn = this.el.locateBtn;
    const eskiHtml = btn.innerHTML;
    if (!auto) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Aranıyor';
    }
    try {
      const url = `${NOMINATIM}?format=json&limit=1&countrycodes=tr&q=${encodeURIComponent(sorgu)}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`Arama başarısız (${res.status})`);
      const hits = await res.json();

      if (!hits.length) {
        if (!auto) {
          alert(`"${sorgu}" için konum bulunamadı. Haritaya tıklayarak elle işaretleyebilirsiniz.`);
        } else {
          this.updateNote();
        }
        return;
      }

      this.lastQuery = sorgu;
      const lat = parseFloat(hits[0].lat);
      const lng = parseFloat(hits[0].lon);

      if (this.ready) {
        // Adres merkezine git ama işaret koymadan - kullanıcı tam noktayı seçsin
        this.map.setView([lat, lng], mahalle ? 16 : (ilce ? 13 : 10));
        this.invalidate();
        this.el.note.classList.remove("is-set");
        this.el.note.textContent = `${sorgu.replace(", Türkiye", "")} bölgesi gösteriliyor — tam konumu işaretlemek için haritaya tıklayın.`;
      } else {
        this.setMarker(lat, lng);
      }
    } catch (err) {
      console.error(err);
      if (!auto) {
        alert("Konum aranamadı. İnternet bağlantınızı kontrol edin veya haritaya tıklayarak elle işaretleyin.");
      } else {
        this.updateNote();
      }
    } finally {
      if (!auto) {
        btn.disabled = false;
        btn.innerHTML = eskiHtml;
      }
    }
  }
}
