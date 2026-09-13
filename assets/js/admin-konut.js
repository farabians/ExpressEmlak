// Express Konut sekmesinin panel mantığı. admin.js'ten kasıtlı olarak ayrı
// bir <script type="module"> olarak yüklenir: burada atılacak bir hata
// (ör. Firestore okuma hatası) admin.js'in ilan yayınlama akışını asla
// kesintiye uğratmaz - ikisi birbirinden bağımsız modüller.
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, serverTimestamp, setDoc }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { app, db } from "./firebase-config.js";
import { VARSAYILAN_KONUT } from "./konut-data.js";
import { IconPicker } from "./icon-picker.js";
import { $, $$, escapeHtml, formatDate, showToast } from "./utils.js";

const auth = getAuth(app);
let veri = null;   // Firestore'dan gelen (veya varsayılan) çalışma kopyası

/* --------------------------------------------------------- Liste editörleri */

// heroOzellikler / avantajlar / adimlar için ortak satır şablonu: ikon + başlık + metin.
// Üçünün alan adları farklı olabildiği için `alanlar` ile hangi input'un hangi
// veri anahtarına yazacağını parametreleştiriyoruz.
function ikonBaslikMetinSatiri(item, index, grup) {
  const ikonVar = "ikon" in item;
  return `
    <div class="konut-satir" data-grup="${grup}" data-index="${index}">
      ${ikonVar ? `
        <div class="konut-satir-alan konut-satir-ikon icon-picker-anchor">
          <label>İkon (Font Awesome)</label>
          <input type="text" value="${escapeHtml(item.ikon || "")}" data-alan="ikon" placeholder="fa-home">
        </div>` : ""}
      <div class="konut-satir-alan konut-satir-genis">
        <label>Başlık</label>
        <input type="text" value="${escapeHtml(item.baslik || "")}" data-alan="baslik">
      </div>
      <div class="konut-satir-alan konut-satir-genis">
        <label>Metin</label>
        <input type="text" value="${escapeHtml(item.metin || "")}" data-alan="metin">
      </div>
      <button type="button" class="btn btn-danger btn-sm konut-satir-sil" aria-label="Sil">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `;
}

function listeRenderEt(kap, liste, grup) {
  kap.innerHTML = liste.length
    ? liste.map((item, i) => ikonBaslikMetinSatiri(item, i, grup)).join("")
    : '<p class="adm-user">Henüz kayıt eklenmedi.</p>';

  $$(".konut-satir", kap).forEach((satir) => {
    const index = Number(satir.dataset.index);
    $$("input", satir).forEach((input) => {
      input.addEventListener("input", () => {
        veri[grup][index][input.dataset.alan] = input.value;
      });
    });

    const ikonInput = satir.querySelector('input[data-alan="ikon"]');
    if (ikonInput) new IconPicker({ input: ikonInput });

    satir.querySelector(".konut-satir-sil").addEventListener("click", () => {
      veri[grup].splice(index, 1);
      listeRenderEt(kap, veri[grup], grup);
    });
  });
}

function listeyeEkle(grup, bosOge) {
  veri[grup] = veri[grup] || [];
  veri[grup].push({ ...bosOge });
  renderListeler();
}

/* ------------------------------------------------------------- Plan editörü */

function planSatiri(plan, index) {
  const alan = (ad, tip = "number", adim = "1") => `
    <div class="konut-satir-alan">
      <label>${ad.etiket}</label>
      <input type="${tip}" step="${adim}" min="0" value="${plan[ad.key] ?? ""}" data-alan="${ad.key}">
    </div>`;

  return `
    <div class="konut-plan-satir" data-index="${index}">
      ${alan({ key: "siraNo", etiket: "Sıra No" })}
      ${alan({ key: "pesinat", etiket: "Peşinat (₺)" }, "number", "10000")}
      ${alan({ key: "asgariUcret", etiket: "Asgari Ücret Katsayısı" }, "number", "0.5")}
      ${alan({ key: "aylikOdeme", etiket: "Aylık Ödeme (₺)" }, "number", "500")}
      ${alan({ key: "odemeSuresi", etiket: "Ödeme Süresi (ay)" })}
      <div class="konut-satir-alan konut-satir-onecikan">
        <label class="check-label">
          <input type="checkbox" data-alan="oneCikan" ${plan.oneCikan ? "checked" : ""}>
          <span>Öne Çıkan</span>
        </label>
      </div>
      <button type="button" class="btn btn-danger btn-sm konut-satir-sil" aria-label="Planı sil">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `;
}

function planListesiRenderEt() {
  const kap = $("#konutPlanListe");
  const planlar = veri.planlar || [];

  kap.innerHTML = planlar.length
    ? planlar.map(planSatiri).join("")
    : '<p class="adm-user">Henüz plan eklenmedi.</p>';

  $$(".konut-plan-satir", kap).forEach((satir) => {
    const index = Number(satir.dataset.index);

    $$("input[type=number]", satir).forEach((input) => {
      input.addEventListener("input", () => {
        // Boş/geçersiz girişi sessizce 0'a çevirmiyoruz - aksi halde kullanıcı
        // "abc" yazınca veri sessizce 0'a düşer ve kaydetme doğrulaması bunu
        // hiç yakalayamaz. null bırakıp gerçek geçersizliği planlariDogrula()'ya
        // taşıyoruz.
        const n = Number(input.value);
        veri.planlar[index][input.dataset.alan] = (input.value.trim() !== "" && Number.isFinite(n)) ? n : null;
        planHatasiTemizle(satir);
      });
    });

    const oneCikanInput = satir.querySelector('input[type=checkbox]');
    oneCikanInput.addEventListener("change", () => {
      veri.planlar[index].oneCikan = oneCikanInput.checked;
    });

    satir.querySelector(".konut-satir-sil").addEventListener("click", () => {
      veri.planlar.splice(index, 1);
      planListesiRenderEt();
    });
  });
}

function planHatasiTemizle(satir) {
  satir.classList.remove("has-error");
}

/* --------------------------------------------------------------- Render */

function renderListeler() {
  $("#konutHeroBaslik").value = veri.heroBaslik || "";
  $("#konutHeroAltBaslik").value = veri.heroAltBaslik || "";

  listeRenderEt($("#konutHeroListe"), veri.heroOzellikler || [], "heroOzellikler");
  listeRenderEt($("#konutAvantajListe"), veri.avantajlar || [], "avantajlar");
  listeRenderEt($("#konutAdimListe"), veri.adimlar || [], "adimlar");
  planListesiRenderEt();

  $("#konutHeroBaslik").oninput = () => { veri.heroBaslik = $("#konutHeroBaslik").value; };
  $("#konutHeroAltBaslik").oninput = () => { veri.heroAltBaslik = $("#konutHeroAltBaslik").value; };
}

/* ----------------------------------------------------------------- Kaydet */

function setMesaj(text, tip) {
  const el = $("#konutMsg");
  el.textContent = text;
  el.className = `form-msg ${tip || ""}`;
}

/**
 * Kaydetmeden önce sayısal alanları doğrular. Bir string aylikOdeme'ye
 * sızarsa hesaplayıcı (planSec) sessizce yanlış sonuç üretir - bu yüzden
 * burada sert bir kapı var.
 */
function planlariDogrula() {
  const planlar = veri.planlar || [];
  const satirlar = $$(".konut-plan-satir", $("#konutPlanListe"));

  let ilkHata = null;
  planlar.forEach((p, i) => {
    const alanlar = ["pesinat", "asgariUcret", "aylikOdeme", "odemeSuresi", "siraNo"];
    // p[a] === null -> kullanıcı boş bıraktı veya geçersiz bir şey yazdı
    // (bkz. planListesiRenderEt'teki input handler). typeof number şart
    // koşulmazsa Number(null) === 0 olduğu için bu durum kaçardı.
    const gecersiz = alanlar.some((a) => typeof p[a] !== "number" || !Number.isFinite(p[a]) || p[a] < 0);
    if (gecersiz) {
      satirlar[i] && satirlar[i].classList.add("has-error");
      if (!ilkHata) ilkHata = satirlar[i];
    }
  });

  return ilkHata;
}

function temizVeri(v) {
  // Firestore'a undefined gönderilemez; boş metin alanları da anlamsız
  // gürültü olduğu için ayıklıyoruz.
  const temizle = (obj) => JSON.parse(JSON.stringify(obj));
  return temizle(v);
}

async function kaydet(kullaniciEmail) {
  const hataSatiri = planlariDogrula();
  if (hataSatiri) {
    setMesaj("Plan alanlarında geçersiz değer var (sayı olmalı, negatif olamaz).", "err");
    hataSatiri.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const btn = $("#konutKaydetBtn");
  btn.disabled = true;
  const eskiMetin = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Kaydediliyor...';
  setMesaj("", "");

  try {
    await setDoc(doc(db, "ayarlar", "expressKonut"), temizVeri({
      ...veri,
      guncellemeTarihi: serverTimestamp(),
      guncelleyen: kullaniciEmail
    }));
    setMesaj("Değişiklikler kaydedildi.", "ok");
    showToast("Express Konut kaydedildi", { text: "Değişiklikler yayına alındı." });
    setTimeout(() => setMesaj("", ""), 4000);
  } catch (err) {
    console.error(err);
    setMesaj(`Hata: ${err.message}`, "err");
  } finally {
    btn.disabled = false;
    btn.innerHTML = eskiMetin;
  }
}

/* ---------------------------------------------------------------- Başlangıç */

let yuklendi = false;

async function ilkYukleme() {
  if (yuklendi) return;
  yuklendi = true;

  try {
    const snap = await getDoc(doc(db, "ayarlar", "expressKonut"));
    veri = snap.exists() ? { ...VARSAYILAN_KONUT, ...snap.data() } : { ...VARSAYILAN_KONUT };

    if (snap.exists() && snap.data().guncellemeTarihi) {
      $("#konutGuncelBilgi").textContent =
        `Son güncelleme: ${formatDate(snap.data().guncellemeTarihi)}` +
        (snap.data().guncelleyen ? ` — ${snap.data().guncelleyen}` : "");
    } else {
      $("#konutGuncelBilgi").textContent = "Henüz kaydedilmedi (varsayılan değerler gösteriliyor).";
    }
  } catch (err) {
    console.error("Express Konut ayarları alınamadı:", err);
    veri = { ...VARSAYILAN_KONUT };
    setMesaj("Mevcut ayarlar okunamadı, varsayılan değerlerle başlıyorsunuz.", "err");
  }

  // Diziler kopyalanmadan paylaşılmasın diye derin kopya alıyoruz.
  veri.heroOzellikler = (veri.heroOzellikler || []).map((x) => ({ ...x }));
  veri.avantajlar = (veri.avantajlar || []).map((x) => ({ ...x }));
  veri.planlar = (veri.planlar || []).map((x) => ({ ...x }));
  veri.adimlar = (veri.adimlar || []).map((x) => ({ ...x }));

  renderListeler();
}

$$("[data-liste-ekle]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const grup = btn.dataset.listeEkle;
    const bosOge = grup === "heroOzellikler" || grup === "avantajlar"
      ? { ikon: "fa-circle-check", baslik: "", metin: "" }
      : { baslik: "", metin: "" };
    listeyeEkle(grup, bosOge);
  });
});

$("#konutPlanEkle").addEventListener("click", () => {
  veri.planlar = veri.planlar || [];
  const sonSira = veri.planlar.reduce((m, p) => Math.max(m, Number(p.siraNo) || 0), 0);
  veri.planlar.push({ siraNo: sonSira + 1, pesinat: 0, asgariUcret: 1, aylikOdeme: 0, odemeSuresi: 12, oneCikan: false });
  planListesiRenderEt();
});

let mevcutEmail = null;
onAuthStateChanged(auth, (user) => {
  mevcutEmail = user ? user.email : null;
  // Sekme ilk kez görünür olduğunda veriyi çek; giriş yapılmadan önce
  // gereksiz bir okuma yapılmasın.
  if (user) ilkYukleme();
});

$("#konutKaydetBtn").addEventListener("click", () => kaydet(mevcutEmail));

// Kullanıcı sekmeye ilk kez tıkladığında da (auth zaten hazırsa) yükle.
$("#tabBtnKonut").addEventListener("click", () => { if (mevcutEmail) ilkYukleme(); });
