// İlan formunun alan üretimi, toplanması ve doğrulanması.
// HTML'de yüzlerce <option> tutmak yerine hepsi constants.js'ten üretilir.
import { FEATURE_GROUPS, SELECT_OPTIONS, fieldsetFor } from "./constants.js";
import { $, $$, buildOptions, escapeHtml, escapeMultiline } from "./utils.js";

/* -------------------------------------------------- Select'leri doldur */

// data-options="odaSayisi" olan her select'i sabit listeden doldurur.
export function fillSelects(scope = document) {
  $$("select[data-options]", scope).forEach((sel) => {
    const key = sel.dataset.options;
    const values = SELECT_OPTIONS[key];
    if (!values) {
      console.warn(`Bilinmeyen seçenek listesi: ${key}`);
      return;
    }
    sel.innerHTML = buildOptions(values);
  });
}

/* --------------------------------------- Detaylı Bilgi akordiyonu üret */

// FEATURE_GROUPS'a göre akordiyon bölümlerini ve onay kutularını basar.
export function buildFeatureAccordion(container) {
  container.innerHTML = FEATURE_GROUPS.map((group, i) => `
    <div class="accordion-item">
      <button type="button" class="accordion-header" aria-expanded="false" aria-controls="acc-${group.key}">
        <span>${escapeHtml(group.title)} <span class="count" data-count-for="${group.key}">(seçim yapılmadı)</span></span>
        <span class="chev"><i class="fas fa-chevron-down"></i></span>
      </button>
      <div class="accordion-content" id="acc-${group.key}" hidden>
        <div class="checkbox-grid" data-group="${group.key}">
          ${group.items.map((item, j) => `
            <label class="check-label">
              <input type="checkbox" name="${group.key}" value="${escapeHtml(item)}"
                     id="${group.key}-${j}">
              <span>${escapeHtml(item)}</span>
            </label>
          `).join("")}
        </div>
      </div>
    </div>
  `).join("");
  void 0;

  // Aç/kapa
  $$(".accordion-header", container).forEach((header) => {
    header.addEventListener("click", () => {
      const open = header.getAttribute("aria-expanded") === "true";
      header.setAttribute("aria-expanded", String(!open));
      $(`#${header.getAttribute("aria-controls")}`).hidden = open;
    });
  });

  // Seçim sayısını başlıkta göster
  container.addEventListener("change", (e) => {
    if (e.target.type !== "checkbox") return;
    const key = e.target.name;
    const count = $$(`input[name="${key}"]:checked`, container).length;
    const label = $(`[data-count-for="${key}"]`, container);
    if (label) label.textContent = count ? `(${count} seçim)` : "(seçim yapılmadı)";
  });
}

/* ------------------------------------------ Kategoriye göre alanları aç */

export function showFieldsFor(kategoriSlug) {
  const active = fieldsetFor(kategoriSlug);
  $$("[data-fieldset]").forEach((block) => {
    const on = block.dataset.fieldset === active;
    block.hidden = !on;
    // Gizli alanlar zorunlu sayılmasın
    $$("input, select, textarea", block).forEach((f) => { f.disabled = !on; });
  });
  return active;
}

/* -------------------------------------------- Formu mevcut veriyle doldur */

// collectFormData()'nın tersi: bir Firestore kaydını forma yükler (düzenleme
// akışı). id'ye değer atarken alan disabled/gizli olsa bile yazıyoruz -
// showFieldsFor() zaten doğru fieldset'i admin.js tarafında ayrıca açacak,
// buradaki sıralamaya bağımlı kalmamak için değer önce yazılıp sonra
// showFieldsFor çağrılabilir ya da tam tersi, fark etmez.
const setVal = (id, value) => {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.type === "checkbox") el.checked = !!value;
  else el.value = value ?? "";
};

// Eski kayıtlar düz metin (\n ile), yeni kayıtlar zengin metin HTML'i.
// Editöre yüklerken düz metin \n -> <br> dönüşümü yapılmazsa eski açıklamalar
// tek satıra yapışmış görünür (Faz 15 notu).
function aciklamayiHtmleCevir(aciklama) {
  if (!aciklama) return "";
  return /<[a-z][\s\S]*>/i.test(aciklama) ? aciklama : escapeMultiline(aciklama);
}

/**
 * Bir ilan kaydını forma yükler. collectFormData()'nın alan eşlemesinin
 * birebir tersidir - kategori dışındaki temel alanlar + o kategorinin
 * fieldset'i + FEATURE_GROUPS checkbox'ları.
 *
 * @param {object} data  Firestore dokümanı (id hariç, ...docSnap.data())
 * @returns {string} editöre yüklenmesi gereken açıklama HTML'i (çağıran taraf
 *                    rich-text editörünü ayrı yönettiği için burada set edilmez)
 */
export function populateForm(data) {
  setVal("isim", data.isim);
  setVal("fiyat", data.fiyat);
  // Checkbox alanın tersini tutuyor (goruntulenmeGizli) - alan hiç yoksa
  // (eski kayıt) varsayılan "göster" olduğu için checkbox işaretli kalmalı.
  setVal("goruntulenmeGoster", !data.goruntulenmeGizli);

  setVal("il", data.il);
  setVal("ilce", data.ilce);
  setVal("mahalle", data.mahalle);
  setVal("sokak", data.sokak);
  setVal("acikAdres", data.acikAdres);
  setVal("enlem", data.enlem);
  setVal("boylam", data.boylam);

  const group = fieldsetFor(data.kategori);

  if (group === "konut") {
    setVal("brutMetrekare", data.brutMetrekare);
    setVal("netMetrekare", data.netMetrekare);
    setVal("odaSayisi", data.odaSayisi);
    setVal("binaYasi", data.binaYasi);
    setVal("katSayisi", data.katSayisi);
    setVal("bulunduguKat", data.bulunduguKat);
    setVal("isitma", data.isitma);
    setVal("banyoSayisi", data.banyoSayisi);
    setVal("mutfak", data.mutfak);
    setVal("balkon", data.balkon);
    setVal("asansor", data.asansor);
    setVal("otopark", data.otopark);
    setVal("esyali", data.esyali);
    setVal("kullanimDurumu", data.kullanimDurumu);
    setVal("aidat", data.aidat);
    setVal("depozito", data.depozito);
    setVal("enerjiKimlikBelgesi", data.enerjiKimlikBelgesi);
    setVal("tapuDurumu", data.tapuDurumu);
    setVal("tasinmazNo", data.tasinmazNo);
    setVal("kimden", data.kimden);
  } else if (group === "isyeri") {
    setVal("isyeriBrutMetrekare", data.brutMetrekare);
    setVal("isyeriNetMetrekare", data.netMetrekare);
    setVal("isyeriTipi", data.isyeriTipi);
    setVal("isyeriBinaYasi", data.binaYasi);
    setVal("isyeriKat", data.bulunduguKat);
    setVal("isyeriIsitma", data.isitma);
    setVal("isyeriKullanimDurumu", data.kullanimDurumu);
    setVal("isyeriAidat", data.aidat);
    setVal("isyeriDepozito", data.depozito);
    setVal("isyeriTapuDurumu", data.tapuDurumu);
    setVal("isyeriKimden", data.kimden);
  } else if (group === "arsa") {
    setVal("arsaTipi", data.arsaTipi);
    setVal("arsaMetrekare", data.arsaMetrekare);
    setVal("imarDurumu", data.imarDurumu);
    setVal("arsaTapuDurumu", data.tapuDurumu);
    setVal("arsaKimden", data.kimden);
  }

  // FEATURE_GROUPS onay kutuları: her grubun kayıttaki dizisindeki her değere
  // karşılık gelen checkbox'ı bulup işaretler. CSS.escape ile değer güvenli
  // hale getirilir (tırnak/özel karakter içeren etiketler için).
  FEATURE_GROUPS.forEach((g) => {
    const secili = new Set(data[g.key] || []);
    $$(`input[name="${g.key}"]`).forEach((input) => {
      input.checked = secili.has(input.value);
    });
    // Akordiyondaki "(N seçim)" sayacı da güncellensin.
    const label = $(`[data-count-for="${g.key}"]`);
    if (label) label.textContent = secili.size ? `(${secili.size} seçim)` : "(seçim yapılmadı)";
  });

  return aciklamayiHtmleCevir(data.aciklama);
}

/* --------------------------------------------------- Değerleri topla */

const val = (id) => {
  const el = document.getElementById(id);
  if (!el || el.disabled) return null;
  const v = el.type === "checkbox" ? el.checked : el.value.trim();
  return v === "" ? null : v;
};

const num = (id) => {
  const v = val(id);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Koordinat alanı: virgüllü ondalık da kabul eder, aralık dışını reddeder.
const coord = (id, limit) => {
  const raw = val(id);
  if (raw === null) return null;
  const n = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || Math.abs(n) > limit) return null;
  return n;
};

// İşaretli onay kutularını dizi olarak döndürür; boşsa null.
const checked = (groupKey) => {
  const items = $$(`input[name="${groupKey}"]:checked`).map((i) => i.value);
  return items.length ? items : null;
};

// Her alan grubunun Firestore'a yazdığı anahtarlar. Kategori değiştirilerek
// düzenlenen bir ilanda, artık geçerli olmayan gruba ait anahtarlar dokümandan
// silinmeli (updateDoc merge çalışır; gönderilmeyen alan eski değeriyle kalır -
// daireyken girilen "3+1" tarlaya çevrildikten sonra da görünüyordu).
const GROUP_FIELDS = {
  konut: ["brutMetrekare", "netMetrekare", "odaSayisi", "binaYasi", "katSayisi",
          "bulunduguKat", "isitma", "banyoSayisi", "mutfak", "balkon", "asansor",
          "otopark", "esyali", "kullanimDurumu", "aidat", "depozito",
          "enerjiKimlikBelgesi", "tapuDurumu", "tasinmazNo", "kimden"],
  isyeri: ["brutMetrekare", "netMetrekare", "isyeriTipi", "binaYasi", "bulunduguKat",
           "isitma", "kullanimDurumu", "aidat", "depozito", "tapuDurumu", "kimden"],
  arsa: ["arsaTipi", "arsaMetrekare", "imarDurumu", "tapuDurumu", "kimden"]
};

// Eski kayıtlarda iş yeri m² alanları ayrı adlarla saklanmıştı (ilan-detay.js
// bunları hâlâ okuyor); kategori değişiminde bunlar da temizlenmeli.
const LEGACY_FIELDS = ["isyeriBrutMetrekare", "isyeriNetMetrekare", "siteIcerisinde"];

/**
 * Verilen kategoride anlamı olmayan alan adlarını döndürür.
 * admin.js bunları deleteField() ile dokümandan siler.
 */
export function obsoleteFieldsFor(kategori) {
  const active = new Set(GROUP_FIELDS[fieldsetFor(kategori)] || []);
  const all = new Set([...Object.values(GROUP_FIELDS).flat(), ...LEGACY_FIELDS]);
  return [...all].filter((key) => !active.has(key));
}

/**
 * Formdaki tüm değerleri Firestore'a yazılacak nesneye çevirir.
 * Gizli (disabled) alanlar otomatik olarak null döner, bu yüzden
 * kategoriye ait olmayan veri kaydedilmez.
 */
export function collectFormData({ kategori, ilanTipi, altKategori, aciklama }) {
  const data = {
    // Zorunlu temel alanlar
    isim: val("isim"),
    // aciklama artık contenteditable bir editörden (zengin metin HTML'i) geliyor,
    // <textarea>.value üzerinden okunamaz - çağıran taraf (admin.js) DOMPurify'dan
    // geçirdiği HTML'i burada geçirir. Geriye dönük uyumluluk için verilmezse boş kalır.
    aciklama: aciklama ?? null,
    fiyat: num("fiyat"),
    // Checkbox işaretliyken (varsayılan) görüntülenme sayısı gösterilir - Firestore'da
    // tersini (goruntulenmeGizli) saklıyoruz ki alan hiç yazılmamış eski kayıtlarda da
    // varsayılan "göster" davranışı korunsun (ilan-detay.js: !d.goruntulenmeGizli).
    goruntulenmeGizli: document.getElementById("goruntulenmeGoster")?.checked === false,

    // Kategori
    kategori, ilanTipi, altKategori,

    // Adres
    il: val("il"),
    ilce: val("ilce"),
    mahalle: val("mahalle"),
    sokak: val("sokak"),
    acikAdres: val("acikAdres"),   // yalnızca panelde görünür, ilan sayfasında yayınlanmaz
    enlem: coord("enlem", 90),
    boylam: coord("boylam", 180)
  };

  data.lokasyon = [data.il, data.ilce, data.mahalle].filter(Boolean).join(" / ");

  // Kategoriye göre açık olan alan grubu
  const group = fieldsetFor(kategori);

  if (group === "konut") {
    Object.assign(data, {
      brutMetrekare: num("brutMetrekare"),
      netMetrekare: num("netMetrekare"),
      odaSayisi: val("odaSayisi"),
      binaYasi: val("binaYasi"),
      katSayisi: val("katSayisi"),
      bulunduguKat: val("bulunduguKat"),
      isitma: val("isitma"),
      banyoSayisi: val("banyoSayisi"),
      mutfak: val("mutfak"),
      balkon: val("balkon"),
      asansor: val("asansor"),
      otopark: val("otopark"),
      esyali: document.getElementById("esyali").checked,
      kullanimDurumu: val("kullanimDurumu"),
      aidat: num("aidat"),
      depozito: num("depozito"),
      enerjiKimlikBelgesi: val("enerjiKimlikBelgesi"),
      tapuDurumu: val("tapuDurumu"),
      tasinmazNo: val("tasinmazNo"),
      kimden: val("kimden")
    });
  } else if (group === "isyeri") {
    Object.assign(data, {
      brutMetrekare: num("isyeriBrutMetrekare"),
      netMetrekare: num("isyeriNetMetrekare"),
      isyeriTipi: val("isyeriTipi"),
      binaYasi: val("isyeriBinaYasi"),
      bulunduguKat: val("isyeriKat"),
      isitma: val("isyeriIsitma"),
      kullanimDurumu: val("isyeriKullanimDurumu"),
      aidat: num("isyeriAidat"),
      depozito: num("isyeriDepozito"),
      tapuDurumu: val("isyeriTapuDurumu"),
      kimden: val("isyeriKimden")
    });
  } else if (group === "arsa") {
    Object.assign(data, {
      arsaTipi: val("arsaTipi"),
      arsaMetrekare: num("arsaMetrekare"),
      imarDurumu: val("imarDurumu"),
      tapuDurumu: val("arsaTapuDurumu"),
      kimden: val("arsaKimden")
    });
  }

  // Detaylı Bilgi onay kutuları (cephe, iç/dış özellikler, muhit, ulaşım...)
  FEATURE_GROUPS.forEach((g) => { data[g.key] = checked(g.key); });

  return data;
}

/* ----------------------------------------------------- Doğrulama */

function markError(el, message) {
  el.classList.add("has-error");
  let msg = el.parentElement.querySelector(".field-error");
  if (!msg) {
    msg = document.createElement("div");
    msg.className = "field-error";
    el.parentElement.appendChild(msg);
  }
  msg.textContent = message;
}

export function clearErrors() {
  $$(".has-error").forEach((el) => el.classList.remove("has-error"));
  $$(".field-error").forEach((el) => el.remove());
}

/**
 * Zorunlu alanları kontrol eder.
 * @returns {{ok: boolean, first?: HTMLElement, message?: string}}
 */
export function validate(data, photoCount) {
  clearErrors();

  const required = [
    ["isim", data.isim, "İlan başlığı gerekli."],
    // aciklama artık contenteditable bir <div> (id="aciklamaEditor") - <textarea>
    // değil, bu yüzden ayrı id eşlemesi gerekiyor.
    ["aciklamaEditor", data.aciklama, "Açıklama gerekli."],
    ["fiyat", data.fiyat, "Geçerli bir fiyat girin."],
    ["il", data.il, "İl seçin."],
    ["ilce", data.ilce, "İlçe seçin."]
  ];

  let first = null;

  required.forEach(([id, value, message]) => {
    if (value === null || value === undefined || value === "") {
      const el = document.getElementById(id);
      if (el) {
        markError(el, message);
        if (!first) first = el;
      }
    }
  });

  if (data.fiyat !== null && data.fiyat <= 0) {
    const el = document.getElementById("fiyat");
    markError(el, "Fiyat sıfırdan büyük olmalı.");
    if (!first) first = el;
  }

  if (!photoCount) {
    return { ok: false, first, message: "En az 1 fotoğraf eklemelisiniz." };
  }

  if (first) return { ok: false, first, message: "Eksik alanları doldurun." };
  return { ok: true };
}

// Firestore'a null yığmamak için boş alanları ayıklar.
export function stripEmpty(data) {
  const out = {};
  Object.entries(data).forEach(([k, v]) => {
    if (v === null || v === undefined || v === "") return;
    out[k] = v;
  });
  return out;
}
