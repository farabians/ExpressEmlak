// Ana sayfadaki Express Konut tanıtım bloğunu doldurur.
// express-konut.js ile aynı veri kaynağını (getKonutAyarlari) kullanır -
// bellek içi önbellek sayesinde ikinci bir istek atılmaz.
import { getKonutAyarlari, pesinatAraligi } from "./express-konut.js";
import { $, escapeHtml, formatPrice } from "./utils.js";

async function baslat() {
  const d = await getKonutAyarlari();
  const list = $("#ekFeatureList");
  const preview = $("#ekPlansPreview");
  if (!list || !preview) return; // bu blok sayfada yoksa sessizce çık

  // Hero özelliklerinin ilk 3'ü teaser'da yeterli; "Düşük Peşinat" metnini
  // planlardan türetilen gerçek aralıkla değiştiriyoruz (#39 - eski sabit metin
  // "1.000.000 - 1.500.000 ₺" derken gerçek üst sınır 2.000.000 ₺ idi).
  const aralik = pesinatAraligi(d.planlar);
  const ozellikler = (d.heroOzellikler || []).slice(0, 3).map((o) => {
    const dusukPesinatMi = /peşinat/i.test(o.baslik || "");
    const metin = dusukPesinatMi && aralik
      ? `${formatPrice(aralik.min)} - ${formatPrice(aralik.max)} ₺ arası`
      : o.metin;
    return { ...o, metin };
  });

  list.innerHTML = ozellikler.map((o) => `
    <div class="express-konut-feature">
      <div class="express-konut-icon"><i class="fas ${escapeHtml(o.ikon || "fa-circle-check")}"></i></div>
      <div>
        <h4>${escapeHtml(o.baslik || "")}</h4>
        <p>${escapeHtml(o.metin || "")}</p>
      </div>
    </div>
  `).join("");

  const planlar = (d.planlar || []).slice().sort((a, b) => (a.siraNo || 0) - (b.siraNo || 0));
  const baslikEl = $("#ekPlanBaslik");
  if (baslikEl) baslikEl.textContent = `${planlar.length} Farklı Ödeme Planı`;

  preview.innerHTML = planlar.map((p) => `
    <div class="plan-preview">
      <div class="plan-preview-no">Plan ${escapeHtml(p.siraNo)}</div>
      <div class="plan-preview-tutar">${formatPrice(p.aylikOdeme)}₺/ay</div>
    </div>
  `).join("");
}

baslat();
