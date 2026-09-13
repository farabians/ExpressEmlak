// İlan yönetim panelinin ana akışı: giriş -> kategori -> form -> yükleme -> liste.
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { addDoc, collection, deleteDoc, deleteField, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { deleteObject, getDownloadURL, getStorage, ref, uploadBytesResumable }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

import { app, db } from "./firebase-config.js";
import { ALLOWED_EMAILS } from "./admin-config.js";
import { CATEGORY_TREE, displayName, slugify } from "./constants.js";
import { CategoryPicker } from "./category-picker.js";
import { initLocationSelects } from "./location.js";
import { PhotoPicker, ProgressBar, VideoPicker, storagePathFromUrl } from "./media-upload.js";
import { MapPicker } from "./map-picker.js";
import { buildFeatureAccordion, clearErrors, collectFormData, fillSelects, obsoleteFieldsFor, populateForm, showFieldsFor, stripEmpty, validate }
  from "./ilan-form.js";
import { kiralikMi } from "./ilan-kart.js";
import { createRichTextEditor, temizleAciklamaHtml } from "./rich-text.js";
import { $, $$, buildOptions, escapeHtml, formatDate, htmlToPlainText, ilanNo, priceLabel } from "./utils.js";

const auth = getAuth(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let selectedPath = [];   // ["Konut", "Kiralık", "Daire"]
let isSubmitting = false;
let editingId = null;    // null: yeni ilan; doluysa güncellenen ilanın Firestore id'si

/**
 * Arayüzü kime göstereceğimizi belirler.
 *
 * ALLOWED_EMAILS yayın ortamında bilinçli olarak null'dır (adresler public
 * olarak servis edilmesin diye; bkz. admin-config.js ve deploy workflow'u).
 * O durumda giriş yapan herkese panel gösterilir - asıl yetkilendirme
 * firestore.rules / storage.rules tarafından sunucuda yapıldığı için
 * yetkisiz bir hesap yazma denemesinde reddedilir.
 */
function panelGorebilir(user) {
  if (!user) return false;
  if (!Array.isArray(ALLOWED_EMAILS)) return true;
  return ALLOWED_EMAILS.includes(user.email);
}

/**
 * ALLOWED_EMAILS üretimde null olduğu için panelGorebilir() her giriş yapan
 * kullanıcıya "yetkili" der - gerçek red yalnızca formu doldurup gönderdiğinde
 * Firestore'dan gelirdi. Bu fonksiyon girişten hemen sonra zararsız bir yazma
 * deneyerek (firestore.rules'daki yetkiKontrol/{uid}, isAllowedUploader()'a
 * tabi) gerçek yetkiyi erkenden ortaya çıkarır - kullanıcı formu hiç
 * doldurmadan öğrenir. Dev ortamında (ALLOWED_EMAILS dolu dizi) hiç
 * çağrılmasına gerek yok, panelGorebilir() zaten orada doğru sonucu veriyor.
 */
async function yetkiyiDogrula(user) {
  try {
    await setDoc(doc(db, "yetkiKontrol", user.uid), { t: serverTimestamp() });
    return true;
  } catch (err) {
    if (err.code === "permission-denied") return false;
    // Ağ hatası vb. - yetkisiz olduğunu KANITLAMADI, arayüzü kilitleme.
    console.error("Yetki probu başarısız (ağ?):", err);
    return true;
  }
}

/* ------------------------------------------------------------- Sekmeler */

// Üç üst seviye sekme: İlan Ekle / İlanlar / Express Konut. Kasıtlı olarak
// setStep()'ten bağımsız: bu geçiş yalnızca hidden toggle'lıyor, ilan formunun
// 2 adımlı akışına dokunmuyor - Konut veya İlanlar sekmesindeki bir hata ilan
// yayınlamayı bozamaz.
const SEKMELER = { ilanEkle: "IlanEkle", ilanlar: "Ilanlar", konut: "Konut" };

function sekmeSec(hedef) {
  Object.entries(SEKMELER).forEach(([anahtar, idParcasi]) => {
    const aktif = anahtar === hedef;
    $(`#tab${idParcasi}`).hidden = !aktif;
    $(`#tabBtn${idParcasi}`).classList.toggle("is-active", aktif);
    $(`#tabBtn${idParcasi}`).setAttribute("aria-selected", String(aktif));
  });
}

$("#tabBtnIlanEkle").addEventListener("click", () => sekmeSec("ilanEkle"));
$("#tabBtnIlanlar").addEventListener("click", () => sekmeSec("ilanlar"));
$("#tabBtnKonut").addEventListener("click", () => sekmeSec("konut"));

/* ------------------------------------------------------------ Adımlar */

// Panel yalnızca iki gerçek adım içeriyor: kategori ve ilan detayları.
function setStep(step) {
  $("#step1").classList.toggle("is-active", step === 1);
  $("#step1").classList.toggle("is-done", step > 1);
  $("#step2").classList.toggle("is-active", step === 2);
  $("#stepLine").classList.toggle("is-done", step > 1);

  $("#kategoriPanel").hidden = step !== 1;
  $("#detayPanelleri").hidden = step !== 2;

  // Harita gizli panelde 0 boyutla kurulduğu için, panel görünür olunca
  // yeniden ölçüm yaptırmalıyız; aksi halde kayıtların bir kısmı yüklenmez.
  // (setStep yalnızca kullanıcı etkileşiminde çağrıldığı için mapPicker hazırdır.)
  if (step === 2) mapPicker.invalidate();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ------------------------------------------------------- Kategori seçimi */

const picker = new CategoryPicker({
  columns: $("#categoryColumns"),
  breadcrumb: $("#breadcrumb"),
  searchInput: $("#categorySearch"),
  searchResults: $("#categoryResults"),
  onComplete: (path) => { selectedPath = path; },
  onContinue: () => {
    const kategoriSlug = slugify(selectedPath[0]);
    showFieldsFor(kategoriSlug);
    $("#secilenKategori").textContent = selectedPath.join(" › ");
    setStep(2);
  }
});

$("#resetCategoryBtn").addEventListener("click", () => { selectedPath = []; picker.reset(); });
$("#changeCategoryBtn").addEventListener("click", () => setStep(1));

/* ---------------------------------------------------------- Form kurulum */

fillSelects();
buildFeatureAccordion($("#detayliBilgi"));
initLocationSelects({ il: $("#il"), ilce: $("#ilce"), mahalle: $("#mahalle") });

const aciklamaEditor = createRichTextEditor($("#aciklamaEditor"), $("#aciklamaToolbar"));

const mapPicker = new MapPicker({
  canvas: $("#mapPicker"),
  latInput: $("#enlem"),
  lngInput: $("#boylam"),
  note: $("#mapCoordsNote"),
  locateBtn: $("#mapLocateBtn"),
  clearBtn: $("#mapClearBtn"),
  getAddress: () => ({ il: $("#il").value, ilce: $("#ilce").value, mahalle: $("#mahalle").value })
});

// İl/ilçe/mahalle seçildikçe harita kendiliğinden o bölgeye gitsin
mapPicker.followAddress([$("#il"), $("#ilce"), $("#mahalle")]);

const photos = new PhotoPicker({
  dropArea: $("#fotoDrop"),
  input: $("#fotolar"),
  previewGrid: $("#fotoPreview"),
  countLabel: $("#fotoInfo"),
  clearBtn: $("#fotoClear")
});

const video = new VideoPicker({
  dropArea: $("#videoDrop"),
  input: $("#video"),
  countLabel: $("#videoInfo"),
  clearBtn: $("#videoClear")
});

const progress = new ProgressBar($("#uploadProgress"));

/* -------------------------------------------------------------- Giriş */

$("#loginBtn").addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    if (err.code !== "auth/popup-closed-by-user") {
      alert(`Giriş başarısız: ${err.message}`);
    }
  }
});

$("#logoutBtn").addEventListener("click", () => signOut(auth));

function goster(user, yetkili) {
  $("#userEmail").textContent = user ? user.email : "";
  $("#loginBtn").hidden = !!user;
  $("#logoutBtn").hidden = !user;

  $("#loginScreen").hidden = yetkili;
  $("#panelContent").hidden = !yetkili;

  if (user && !yetkili) {
    $("#loginScreen").hidden = false;
    $("#loginTitle").textContent = "Bu hesap yetkili değil";
    $("#loginText").textContent = `${user.email} ile giriş yapıldı ancak ilan yükleme yetkisi yok. Yetkili bir hesapla giriş yapın.`;
    $("#loginBtn2").hidden = true;
  }
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  let yetkili = panelGorebilir(user);
  goster(user, yetkili);

  // Yalnızca "ALLOWED_EMAILS gizli, herkese izin ver" hızlı-yolunda çalıştır -
  // dev ortamında panelGorebilir() zaten doğru sonucu veriyor, gereksiz
  // yazma trafiği yapmaya gerek yok.
  if (user && yetkili && !Array.isArray(ALLOWED_EMAILS)) {
    yetkili = await yetkiyiDogrula(user);
    // Kullanıcı bu bekleme sırasında çıkış yapmış/değişmiş olabilir.
    if (currentUser === user) goster(user, yetkili);
  }
});

$("#loginBtn2").addEventListener("click", () => $("#loginBtn").click());

/* ------------------------------------------------------ Dosya yükleme */

async function uploadPhotos(files, uid) {
  const urls = [];
  const paths = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const path = `ilanlar/fotolar/${Date.now()}-${uid}-${i}-${file.name}`;
    const task = uploadBytesResumable(ref(storage, path), file);

    await new Promise((resolve, reject) => {
      task.on("state_changed",
        (snap) => {
          // Toplam ilerleme: tamamlanan dosyalar + bu dosyanın oranı
          const fileRatio = snap.bytesTransferred / snap.totalBytes;
          const total = ((i + fileRatio) / files.length) * 100;
          progress.set(total, `Fotoğraflar yükleniyor (${i + 1}/${files.length})`);
        },
        reject,
        resolve
      );
    });

    urls.push(await getDownloadURL(task.snapshot.ref));
    paths.push(path);
  }

  return { urls, paths };
}

async function uploadVideo(file, uid) {
  const path = `ilanlar/videolar/${Date.now()}-${uid}-${file.name}`;
  const task = uploadBytesResumable(ref(storage, path), file);

  await new Promise((resolve, reject) => {
    task.on("state_changed",
      (snap) => progress.set((snap.bytesTransferred / snap.totalBytes) * 100, "Video yükleniyor"),
      reject,
      resolve
    );
  });

  return { url: await getDownloadURL(task.snapshot.ref), path };
}

/* ------------------------------------------------------------ Gönderim */

function setMessage(text, type) {
  const el = $("#formMsg");
  el.textContent = text;
  el.className = `form-msg ${type || ""}`;
}

$("#ilanForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (isSubmitting) return;

  if (selectedPath.length < 3) {
    setMessage("Önce kategori seçimini tamamlayın.", "err");
    setStep(1);
    return;
  }

  // DİKKAT - bu asimetri bilinçli: kategori slug ("isyeri"), ilanTipi ve
  // altKategori ise ham Türkçe etiket ("Kiralık", "Daire") olarak yazılır.
  // Mevcut kayıtlar bu biçimde olduğu için değiştirmek veriyi iki formata
  // böler ve migration gerektirir. Okuyan taraf her iki biçimi de destekler:
  // ilan-kart.js kiralikMi() slugify+includes, constants.js displayName() ise
  // slug'ı okunabilir etikete çevirir.
  const data = collectFormData({
    kategori: slugify(selectedPath[0]),
    ilanTipi: selectedPath[1],
    altKategori: selectedPath[2],
    aciklama: aciklamaEditor.isEmpty() ? null : temizleAciklamaHtml(aciklamaEditor.getHtml())
  });

  const check = validate(data, photos.count);
  if (!check.ok) {
    setMessage(check.message, "err");
    if (check.first) {
      check.first.scrollIntoView({ behavior: "smooth", block: "center" });
      check.first.focus({ preventScroll: true });
    }
    return;
  }

  if (!panelGorebilir(currentUser)) {
    setMessage("Yükleme yetkiniz yok. Lütfen tekrar giriş yapın.", "err");
    return;
  }

  isSubmitting = true;
  const btn = $("#submitBtn");
  btn.disabled = true;
  btn.textContent = editingId ? "Kaydediliyor..." : "Yükleniyor...";
  setMessage("", "");
  progress.start("Hazırlanıyor");

  // Hata halinde yarım kalan dosyaları temizlemek için yolları takip ediyoruz.
  const uploaded = [];
  // Başarılı kayıttan sonra Storage'dan silinecek eski dosyalar (düzenleme
  // modunda kaldırılan fotoğraflar/değiştirilen video) - önce doküman
  // güncellensin, sonra silinsin: yarıda kesilirse orphan dosya, kaydı bozan
  // bir yarım-silme'den daha zararsızdır.
  const removedPaths = [];

  try {
    const { urls: yeniUrls, paths: yeniPaths } = await uploadPhotos(photos.files, currentUser.uid);
    uploaded.push(...yeniPaths);

    const photoUrls = editingId ? photos.keptExistingUrls.concat(yeniUrls) : yeniUrls;
    const photoPaths = editingId ? photos.keptExistingPaths.concat(yeniPaths) : yeniPaths;
    if (editingId) removedPaths.push(...photos.removedExistingPaths);

    let videoUrl = editingId ? video.keptExistingUrl : null;
    let videoPath = editingId ? video.keptExistingPath : null;
    if (video.file) {
      const v = await uploadVideo(video.file, currentUser.uid);
      videoUrl = v.url;
      videoPath = v.path;
      uploaded.push(v.path);
    }
    if (editingId && video.removedExistingPath) removedPaths.push(video.removedExistingPath);

    progress.set(100, "İlan kaydediliyor");

    const kayit = stripEmpty({
      ...data,
      photoUrls,
      photoPaths,
      videoUrl,
      videoPath
    });

    if (editingId) {
      // updateDoc merge çalışır: gönderilmeyen alan eski değeriyle kalır.
      // stripEmpty boş alanları eleyince iki sızıntı oluşuyordu:
      //   1) kategori değişimi - daireyken seçilen "3+1" tarlada da görünüyordu,
      //   2) alanı boşaltma - "Asansör: Var"ı boşa çekmek kaydı değiştirmiyordu.
      // İkisi de aynı çözümle kapanıyor: yazılmayan alanlar açıkça siliniyor.
      // videoUrl/videoPath da buraya dahil: video kaldırıldığında dosya
      // Storage'dan siliniyordu ama alan dokümanda kalıp kırık link bırakıyordu.
      const temizlenecek = {};
      const silinecekler = new Set([
        ...obsoleteFieldsFor(kayit.kategori),
        ...Object.keys(data),
        "videoUrl", "videoPath"
      ]);
      silinecekler.forEach((key) => {
        if (!(key in kayit)) temizlenecek[key] = deleteField();
      });

      await updateDoc(doc(db, "ilanlar", editingId), {
        ...kayit,
        ...temizlenecek,
        guncellemeTarihi: serverTimestamp(),
        guncelleyen: currentUser.email
      });
      await Promise.allSettled(removedPaths.map((p) => deleteObject(ref(storage, p))));
      setMessage("İlan başarıyla güncellendi.", "ok");
    } else {
      await addDoc(collection(db, "ilanlar"), {
        ...kayit,
        ownerUid: currentUser.uid,
        ownerEmail: currentUser.email,
        tarih: serverTimestamp()
      });
      setMessage("İlan başarıyla yayınlandı.", "ok");
    }

    resetForm();

  } catch (err) {
    console.error(err);
    setMessage(`Hata: ${err.message}`, "err");

    // Firestore kaydı/güncellemesi başarısız olduysa yeni yüklenen dosyalar
    // yetim kalmasın. removedPaths'e hiç dokunulmuyor - doküman güncellenmediyse
    // eski dosyalar hâlâ kayıtta referanslı, silinmemeli.
    await Promise.allSettled(uploaded.map((p) => deleteObject(ref(storage, p))));

  } finally {
    isSubmitting = false;
    btn.disabled = false;
    btn.textContent = editingId ? "Değişiklikleri Kaydet" : "İlanı Yayınla";
    progress.done();
  }
});

function resetForm() {
  $("#ilanForm").reset();
  aciklamaEditor.setHtml(""); // contenteditable form elemanı değil, reset() etkilemez
  clearErrors();
  photos.clear();
  video.clear();
  mapPicker.clear();
  selectedPath = [];
  editingId = null;
  $("#submitBtn").textContent = "İlanı Yayınla";
  $("#duzenlemeIptalBtn").hidden = true;
  picker.reset();
  setStep(1);
  setTimeout(() => setMessage("", ""), 5000);
}

/**
 * Mevcut formu "düzenleme modu"na geçirir: aynı UI, ayrı bir form/sayfa değil
 * (form zaten karmaşık, iyi test edilmiş bir yapı - ikinci kez yazmak kod
 * tekrarı ve senkron tutulması gereken iki ayrı doğrulama mantığı demek).
 */
function duzenlemeyeBasla(id, data) {
  editingId = id;

  // Art arda iki ilan düzenlenirken form kirli kalmasın: populateForm yalnızca
  // ilanın kendi kategorisine ait alanları yazar, diğer grupların alanlarına
  // dokunmaz - önce sıfırlanmazsa önceki ilandan kalan (gizli ama dolu)
  // değerler formda durur.
  $("#ilanForm").reset();
  clearErrors();

  // Kategori: data.kategori Firestore'da slug ("konut"), CategoryPicker ise
  // CATEGORY_TREE'nin ham Türkçe anahtarlarını ("Konut") bekliyor.
  // displayName() bu çeviriyi yapıyor; ilanTipi/altKategori zaten ham etiket
  // olarak saklı olduğu için doğrudan kullanılabilir.
  selectedPath = [displayName(data.kategori), data.ilanTipi, data.altKategori];
  picker.setPath(selectedPath);

  const kategoriSlug = slugify(data.kategori);
  showFieldsFor(kategoriSlug);
  $("#secilenKategori").textContent = selectedPath.join(" › ");

  // İl/ilçe/mahalle cascading select'leri location.js tarafından "change"
  // event'ine bağlı - programatik .value ataması bu event'i tetiklemez, bu
  // yüzden ilçe/mahalle seçeneklerini üretmek için change'i elle fırlatıyoruz.
  $("#il").value = data.il || "";
  $("#il").dispatchEvent(new Event("change"));
  $("#ilce").value = data.ilce || "";
  $("#ilce").dispatchEvent(new Event("change"));
  $("#mahalle").value = data.mahalle || "";

  const aciklamaHtml = populateForm(data);
  aciklamaEditor.setHtml(aciklamaHtml);

  photos.clear();
  photos.loadExisting(data.photoUrls || [], data.photoPaths || []);
  video.clear();
  if (data.videoUrl) video.loadExisting(data.videoUrl, data.videoPath);

  if (data.enlem != null && data.boylam != null) {
    mapPicker.setMarker(data.enlem, data.boylam, { pan: true });
  } else {
    mapPicker.clear();
  }

  $("#submitBtn").textContent = "Değişiklikleri Kaydet";
  $("#duzenlemeIptalBtn").hidden = false;
  setMessage("", "");
  setStep(2);
  sekmeSec("ilanEkle");
}

$("#duzenlemeIptalBtn").addEventListener("click", () => {
  if (editingId && !confirm("Düzenlemeden vazgeçmek istediğinize emin misiniz? Kaydedilmemiş değişiklikler kaybolur.")) return;
  resetForm();
});

/* -------------------------------------------------------- İlan listesi */

/**
 * İlanın Storage'daki tüm dosya yollarını toplar.
 *
 * Kayıtlı photoPaths/videoPath varsa onlar kullanılır; bu alanlar yazılmadan
 * önce oluşturulmuş eski ilanlarda yol URL'den türetilir - aksi halde doküman
 * silinince dosyalar Storage'da yetim kalır ve yeri geri kazanılamaz.
 */
function ilanDosyaYollari(data) {
  const yollar = (data.photoUrls || []).map((url, i) =>
    (data.photoPaths || [])[i] || storagePathFromUrl(url)
  );

  if (data.videoUrl || data.videoPath) {
    yollar.push(data.videoPath || storagePathFromUrl(data.videoUrl));
  }

  return [...new Set(yollar.filter(Boolean))];
}

async function silIlan(id, data) {
  if (!confirm(`"${data.isim}" ilanını kalıcı olarak silmek istediğinize emin misiniz?`)) return;

  try {
    // Önce dosyalar, sonra kayıt: doküman silinip dosya silme patlarsa yolları
    // bir daha öğrenemeyiz (yetim dosya). Ters sırada ise en kötü ihtimalle
    // kayıt duruyor ve silme tekrar denenebiliyor.
    const yollar = ilanDosyaYollari(data);
    const sonuclar = await Promise.allSettled(
      yollar.map((p) => deleteObject(ref(storage, p)))
    );

    // "Dosya zaten yok" bir hata değil - silme amacına ulaşmış sayılır.
    const basarisiz = sonuclar.filter(
      (s) => s.status === "rejected" && s.reason?.code !== "storage/object-not-found"
    );

    await deleteDoc(doc(db, "ilanlar", id));

    if (basarisiz.length) {
      console.error("Silinemeyen dosyalar:", basarisiz.map((s) => s.reason));
      alert(
        `İlan silindi, ancak ${basarisiz.length} dosya Storage'dan silinemedi. ` +
        `Firebase Console > Storage üzerinden elle silmeniz gerekebilir.`
      );
    }
  } catch (err) {
    alert(`Silinemedi: ${err.message}`);
  }
}

/* ------------------------------------------------- Arama ve filtreleme */

let tumIlanlar = []; // [{ id, ...data }]

const ilanFiltre = { arama: "", kategori: "", tip: "", ilce: "" };

/**
 * Saf fonksiyon: liste + filtre durumu -> filtrelenmiş liste.
 * DOM'a dokunmaz, bu yüzden bağımsız test edilebilir.
 */
export function ilanlariFiltrele(liste, f) {
  const aramaKelime = (f.arama || "").trim().toLocaleLowerCase("tr");
  return liste.filter((d) => {
    if (aramaKelime && !(d.isim || "").toLocaleLowerCase("tr").includes(aramaKelime)) return false;
    if (f.kategori && slugify(d.kategori) !== slugify(f.kategori)) return false;
    if (f.tip) {
      const kiralik = kiralikMi(d);
      if (f.tip === "kiralik" && !kiralik) return false;
      if (f.tip === "satilik" && kiralik) return false;
    }
    if (f.ilce && (d.ilce || "") !== f.ilce) return false;
    return true;
  });
}

function ilceSecenekleriniGuncelle() {
  const ilceler = [...new Set(tumIlanlar.map((d) => d.ilce).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "tr"));
  const sec = $("#ilanFiltreIlce");
  const mevcut = ilanFiltre.ilce;
  sec.innerHTML = buildOptions(ilceler, "Tüm ilçeler");
  sec.value = ilceler.includes(mevcut) ? mevcut : "";
  ilanFiltre.ilce = sec.value;
}

function ilanSatiriOlustur(id, d) {
  const foto = d.photoUrls && d.photoUrls[0];
  const kat = [d.kategori, d.ilanTipi, d.altKategori].map(displayName).filter(Boolean).join(" › ");

  const row = document.createElement("div");
  row.className = "ilan";
  row.innerHTML = `
    ${foto
      ? `<img class="ilan-thumb" src="${escapeHtml(foto)}" alt="" loading="lazy">`
      : '<div class="ilan-thumb ilan-thumb-empty">Fotoğraf yok</div>'}
    <div>
      <h3>${escapeHtml(d.isim || "(başlıksız)")}</h3>
      <div class="ilan-price">${priceLabel(d.fiyat)}</div>
      <div class="ilan-meta">
        #${ilanNo(id)} &middot; ${escapeHtml(d.lokasyon || "")} &middot; ${escapeHtml(kat)}
        ${d.tarih ? ` &middot; ${escapeHtml(formatDate(d.tarih))}` : ""}
        &middot; <i class="fas fa-eye"></i> ${Number(d.goruntulenmeSayisi) || 0} görüntülenme
      </div>
      ${d.sokak || d.acikAdres ? `<div class="ilan-meta" style="color:var(--adm-faint)">
        <i class="fas fa-location-dot"></i>
        ${escapeHtml([d.sokak, d.acikAdres].filter(Boolean).join(" "))}
        ${d.enlem && d.boylam ? ' &middot; <i class="fas fa-map-pin" title="Haritada işaretli"></i> konum işaretli' : ""}
      </div>` : ""}
      <div class="ilan-desc">${escapeHtml(htmlToPlainText(d.aciklama).slice(0, 160))}</div>
    </div>
    <div class="ilan-actions">
      <a class="btn btn-outline btn-sm" href="ilan_detayi.html?id=${encodeURIComponent(id)}" target="_blank" rel="noopener">
        <i class="fas fa-eye"></i> Görüntüle
      </a>
      <button type="button" class="btn btn-outline btn-sm" data-duzenle>
        <i class="fas fa-pen"></i> Düzenle
      </button>
      <button type="button" class="btn btn-danger btn-sm" data-sil>
        <i class="fas fa-trash"></i> Sil
      </button>
    </div>
  `;

  row.querySelector("[data-sil]").addEventListener("click", () => silIlan(id, d));
  row.querySelector("[data-duzenle]").addEventListener("click", () => duzenlemeyeBasla(id, d));
  return row;
}

function ilanListesiniRenderEt() {
  const list = $("#ilanListesi");
  const sonuc = ilanlariFiltrele(tumIlanlar, ilanFiltre);

  $("#ilanCount").textContent = `${sonuc.length} / ${tumIlanlar.length} ilan`;

  if (!tumIlanlar.length) {
    list.innerHTML = '<div class="list-empty">Henüz yayınlanmış ilan yok.</div>';
    return;
  }
  if (!sonuc.length) {
    list.innerHTML = '<div class="list-empty">Bu filtrelere uygun ilan bulunamadı.</div>';
    return;
  }

  list.innerHTML = "";
  sonuc.forEach((d) => list.appendChild(ilanSatiriOlustur(d.id, d)));
}

$("#ilanFiltreKategori").innerHTML = buildOptions(Object.keys(CATEGORY_TREE), "Tüm kategoriler");

$("#ilanAra").addEventListener("input", () => {
  ilanFiltre.arama = $("#ilanAra").value;
  ilanListesiniRenderEt();
});
$("#ilanFiltreKategori").addEventListener("change", () => {
  ilanFiltre.kategori = $("#ilanFiltreKategori").value;
  ilanListesiniRenderEt();
});
$("#ilanFiltreTip").addEventListener("change", () => {
  ilanFiltre.tip = $("#ilanFiltreTip").value;
  ilanListesiniRenderEt();
});
$("#ilanFiltreIlce").addEventListener("change", () => {
  ilanFiltre.ilce = $("#ilanFiltreIlce").value;
  ilanListesiniRenderEt();
});
$("#ilanFiltreTemizle").addEventListener("click", () => {
  Object.assign(ilanFiltre, { arama: "", kategori: "", tip: "", ilce: "" });
  $("#ilanAra").value = "";
  $("#ilanFiltreKategori").value = "";
  $("#ilanFiltreTip").value = "";
  $("#ilanFiltreIlce").value = "";
  ilanListesiniRenderEt();
});

onSnapshot(query(collection(db, "ilanlar"), orderBy("tarih", "desc")), (snap) => {
  const yeniListe = [];
  snap.forEach((snapDoc) => yeniListe.push({ id: snapDoc.id, ...snapDoc.data() }));
  tumIlanlar = yeniListe;
  ilceSecenekleriniGuncelle();
  ilanListesiniRenderEt();
}, (err) => {
  console.error(err);
  $("#ilanListesi").innerHTML = '<div class="list-empty">İlanlar yüklenemedi.</div>';
});
