// express-konut.html sayfa denetleyicisi: Firestore'dan (veya varsayılandan)
// gelen verilerle hero, avantajlar, planlar, adımlar ve hesaplayıcıyı doldurur.
import { getKonutAyarlari, pesinatAraligi, planSec } from "./express-konut.js";
import { $, escapeHtml, formatPrice } from "./utils.js";

function renderHero(d) {
  $("#heroBaslik").textContent = d.heroBaslik || "";
  $("#heroAltBaslik").textContent = d.heroAltBaslik || "";

  $("#heroOzellikler").innerHTML = (d.heroOzellikler || []).map((o) => `
    <div class="hero-feature">
      <i class="fas ${escapeHtml(o.ikon || "fa-circle-check")}"></i>
      <h3>${escapeHtml(o.baslik || "")}</h3>
      <p>${escapeHtml(o.metin || "")}</p>
    </div>
  `).join("");
}

function renderAvantajlar(d) {
  $("#avantajlarGrid").innerHTML = (d.avantajlar || []).map((a) => `
    <div class="benefit-card">
      <div class="benefit-icon"><i class="fas ${escapeHtml(a.ikon || "fa-circle-check")}"></i></div>
      <h3>${escapeHtml(a.baslik || "")}</h3>
      <p>${escapeHtml(a.metin || "")}</p>
    </div>
  `).join("");
}

function renderPlanlar(d) {
  const planlar = (d.planlar || []).slice().sort((a, b) => (a.siraNo || 0) - (b.siraNo || 0));

  $("#planlarGrid").innerHTML = planlar.map((p) => `
    <div class="plan-card ${p.oneCikan ? "is-featured" : ""}">
      <div class="plan-header ${p.oneCikan ? "featured" : ""}">
        <div class="plan-number">${escapeHtml(p.siraNo)}</div>
        <div class="plan-price">${formatPrice(p.pesinat)}₺</div>
        <p>peşinat</p>
      </div>
      <div class="plan-body">
        <div class="plan-feature">
          <span class="plan-label">Asgari Ücret</span>
          <span class="plan-value">${escapeHtml(p.asgariUcret)} asgari ücret</span>
        </div>
        <div class="plan-feature">
          <span class="plan-label">Aylık Ödeme</span>
          <span class="plan-value">${formatPrice(p.aylikOdeme)}₺</span>
        </div>
        <div class="plan-feature">
          <span class="plan-label">Ödeme Süresi</span>
          <span class="plan-value">${escapeHtml(p.odemeSuresi)} ay</span>
        </div>
      </div>
    </div>
  `).join("");

  return planlar;
}

function renderAdimlar(d) {
  $("#adimlarGrid").innerHTML = (d.adimlar || []).map((a, i) => `
    <div class="step-card">
      <div class="step-number">${i + 1}</div>
      <h3>${escapeHtml(a.baslik || "")}</h3>
      <p>${escapeHtml(a.metin || "")}</p>
    </div>
  `).join("");
}

// Hesaplayıcının peşinat seçenekleri planlardan türetilir; bu sayede select
// yalnızca gerçekten karşılığı olan bir peşinat sunabilir (#38'in kökten çözümü -
// eski select sabitti, planlarla senkron kalması garanti değildi).
function kurHesaplayici(planlar) {
  const secenekler = [...new Set(planlar.map((p) => Number(p.pesinat)))].sort((a, b) => a - b);
  $("#downPayment").innerHTML = secenekler
    .map((v) => `<option value="${v}">${formatPrice(v)} ₺</option>`)
    .join("");

  $("#calcBtn").addEventListener("click", () => {
    const income = Number($("#monthlyIncome").value);
    const resultDiv = $("#calcResult");
    const amountDiv = $("#resultAmount");
    const detailsDiv = $("#resultDetails");

    if (!income || income <= 0) {
      alert("Lütfen geçerli bir gelir tutarı girin.");
      return;
    }

    const sonuc = planSec(planlar, { pesinat: $("#downPayment").value, aylikGelir: income });

    if (sonuc.durum === "planYok") {
      amountDiv.textContent = "Plan bulunamadı";
      detailsDiv.textContent = "Seçilen peşinat için tanımlı bir plan yok.";
      resultDiv.style.background = "linear-gradient(135deg, #dc3545, #c82333)";
    } else if (sonuc.durum === "yetersizGelir") {
      amountDiv.textContent = "Yetersiz Gelir";
      detailsDiv.textContent = `Bu plan için minimum ${formatPrice(sonuc.plan.aylikOdeme)} ₺ gelir gereklidir.`;
      resultDiv.style.background = "linear-gradient(135deg, #dc3545, #c82333)";
    } else {
      amountDiv.textContent = `${formatPrice(sonuc.plan.aylikOdeme)} ₺`;
      detailsDiv.textContent = `Plan ${sonuc.plan.siraNo} - ${sonuc.plan.odemeSuresi} ay ödeme`;
      resultDiv.style.background = "linear-gradient(135deg, var(--primary), #f4c15d)";
    }

    resultDiv.style.display = "block";
  });
}

function kurYumusakKaydirma() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", (e) => {
      const hedef = document.querySelector(anchor.getAttribute("href"));
      if (hedef) {
        e.preventDefault();
        hedef.scrollIntoView({ behavior: "smooth" });
      }
    });
  });
}

async function baslat() {
  const d = await getKonutAyarlari();
  renderHero(d);
  renderAvantajlar(d);
  const planlar = renderPlanlar(d);
  renderAdimlar(d);
  kurHesaplayici(planlar);
  kurYumusakKaydirma();
}

baslat();
