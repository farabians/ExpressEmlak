// Ana sayfa denetleyicisi: hero slider (son 5 ilan), öne çıkan ilanlar (renderKart),
// tam ekran toggle. Express Konut teaser'ı ayrı modülde: anasayfa-konut.js.
import { collection, query, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { anaFoto, ilanTipiEtiketi, konumEtiketi, renderKart, sliderOzellikleri } from "./ilan-kart.js";
import { $, escapeHtml, priceLabel } from "./utils.js";

function initSlider() {
  const slider = $("#propertySlider");
  const prevBtn = $("#prevSlide");
  const nextBtn = $("#nextSlide");
  if (!slider || !prevBtn || !nextBtn) return;

  let currentSlide = 0;
  let totalSlides = 0;
  let autoSlideInterval;

  function showSlide(index) {
    if (index >= totalSlides) index = 0;
    if (index < 0) index = totalSlides - 1;

    const allSlides = document.querySelectorAll(".slider-item");
    allSlides.forEach((slide) => slide.classList.remove("active"));

    slider.style.transform = `translateX(-${index * 100}%)`;
    if (allSlides[index]) allSlides[index].classList.add("active");

    const num = $("#currentSlideNum");
    if (num) num.textContent = index + 1;

    currentSlide = index;
  }

  function startAutoSlide() {
    autoSlideInterval = setInterval(() => showSlide(currentSlide + 1), 7000);
  }

  function resetAutoSlide() {
    clearInterval(autoSlideInterval);
    startAutoSlide();
  }

  prevBtn.addEventListener("click", () => { showSlide(currentSlide - 1); resetAutoSlide(); });
  nextBtn.addEventListener("click", () => { showSlide(currentSlide + 1); resetAutoSlide(); });

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") prevBtn.click();
    else if (e.key === "ArrowRight") nextBtn.click();
  });

  const q = query(collection(db, "ilanlar"), orderBy("tarih", "desc"), limit(5));
  onSnapshot(q, (snapshot) => {
    slider.innerHTML = "";
    const currentSlideNum = $("#currentSlideNum");
    const totalSlidesNum = $("#totalSlides");
    if (totalSlidesNum) totalSlidesNum.textContent = snapshot.size;

    const featuredGrid = $("#featuredProperties");
    if (featuredGrid) featuredGrid.innerHTML = "";
    let cardCount = 0;

    snapshot.forEach((docSnap) => {
      const ilan = { id: docSnap.id, ...docSnap.data() };

      const ozellikler = sliderOzellikleri(ilan)
        .map((o) => `
          <div class="slider-feature">
            <i class="fas ${o.ikon}"></i>
            <span>${escapeHtml(o.metin)}</span>
          </div>`)
        .join("");

      const slide = document.createElement("div");
      slide.className = "slider-item";
      slide.innerHTML = `
        <div class="slider-bg">
          <img src="${escapeHtml(anaFoto(ilan))}" alt="${escapeHtml(ilan.isim || "")}">
        </div>
        <div class="slider-content">
          <div class="slider-details">
            <h2>${escapeHtml(ilan.isim || "")}</h2>
            <div class="slider-price">${escapeHtml(priceLabel(ilan.fiyat))}</div>
            <div class="slider-features">${ozellikler}</div>
            <div class="cta-buttons">
              <a href="ilan_detayi.html?id=${encodeURIComponent(ilan.id)}" class="btn-primary">
                <i class="fas fa-circle-info"></i>
                Detayları Gör
              </a>
              <a href="iletisim.html" class="btn-secondary">
                <i class="fas fa-phone"></i>
                İletişime Geç
              </a>
            </div>
          </div>
        </div>
      `;
      slider.appendChild(slide);

      if (featuredGrid && cardCount < 3) {
        featuredGrid.insertAdjacentHTML("beforeend", renderKart(ilan));
        cardCount++;
      }
    });

    if (snapshot.empty && featuredGrid) {
      featuredGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 2rem;">
          <p class="muted">Henüz ilan bulunmuyor.</p>
        </div>
      `;
    }

    totalSlides = snapshot.size;
    if (totalSlides > 0) {
      showSlide(0);
      startAutoSlide();
    }
  }, (err) => {
    console.error("İlanlar yüklenemedi:", err);
    const grid = $("#featuredProperties");
    if (grid) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 2rem;">
          <p class="muted">İlanlar şu anda yüklenemiyor. Lütfen sayfayı yenileyin.</p>
          <a href="iletisim.html" class="btn-primary" style="margin-top:1rem; display:inline-block;">
            Bize Ulaşın
          </a>
        </div>
      `;
    }
  });
}

// TV/kiosk kullanımı: ofiste sürekli dönen bir ekran için tam ekran modu.
function initFullscreenToggle() {
  const btn = $("#fullscreenToggle");
  const hero = document.querySelector(".hero");
  if (!btn || !hero) return;

  const icon = btn.querySelector("i");

  btn.addEventListener("click", () => {
    if (!document.fullscreenElement) {
      (hero.requestFullscreen || hero.webkitRequestFullscreen)?.call(hero);
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    }
  });

  document.addEventListener("fullscreenchange", () => {
    const aktif = !!document.fullscreenElement;
    if (icon) {
      icon.classList.toggle("fa-expand", !aktif);
      icon.classList.toggle("fa-compress", aktif);
    }
    btn.setAttribute("aria-label", aktif ? "Tam ekrandan çık" : "Tam ekran yap");
  });
}

initSlider();
initFullscreenToggle();
