// İlan yönetim panelinin ana akışı: giriş -> kategori -> form -> yükleme -> liste.
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { deleteObject, getDownloadURL, getStorage, ref, uploadBytesResumable }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

import { app, db } from "./firebase-config.js";
import { ALLOWED_EMAILS } from "./admin-config.js";
import { displayName, slugify } from "./constants.js";
import { CategoryPicker } from "./category-picker.js";
import { initLocationSelects } from "./location.js";
import { PhotoPicker, ProgressBar, VideoPicker } from "./media-upload.js";
import { MapPicker } from "./map-picker.js";
import { buildFeatureAccordion, clearErrors, collectFormData, fillSelects, showFieldsFor, stripEmpty, validate }
  from "./ilan-form.js";
import { $, escapeHtml, formatDate, ilanNo, priceLabel } from "./utils.js";

const auth = getAuth(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let selectedPath = [];   // ["Konut", "Kiralık", "Daire"]
let isSubmitting = false;

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

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  const yetkili = panelGorebilir(user);

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
    altKategori: selectedPath[2]
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
  btn.textContent = "Yükleniyor...";
  setMessage("", "");
  progress.start("Hazırlanıyor");

  // Hata halinde yarım kalan dosyaları temizlemek için yolları takip ediyoruz.
  const uploaded = [];

  try {
    const { urls, paths } = await uploadPhotos(photos.files, currentUser.uid);
    uploaded.push(...paths);

    let videoUrl = null;
    let videoPath = null;
    if (video.file) {
      const v = await uploadVideo(video.file, currentUser.uid);
      videoUrl = v.url;
      videoPath = v.path;
      uploaded.push(v.path);
    }

    progress.set(100, "İlan kaydediliyor");

    await addDoc(collection(db, "ilanlar"), stripEmpty({
      ...data,
      photoUrls: urls,
      photoPaths: paths,
      videoUrl,
      videoPath,
      ownerUid: currentUser.uid,
      ownerEmail: currentUser.email,
      tarih: serverTimestamp()
    }));

    setMessage("İlan başarıyla yayınlandı.", "ok");
    resetForm();

  } catch (err) {
    console.error(err);
    setMessage(`Hata: ${err.message}`, "err");

    // Firestore kaydı başarısız olduysa yüklenen dosyalar yetim kalmasın.
    await Promise.allSettled(uploaded.map((p) => deleteObject(ref(storage, p))));

  } finally {
    isSubmitting = false;
    btn.disabled = false;
    btn.textContent = "İlanı Yayınla";
    progress.done();
  }
});

function resetForm() {
  $("#ilanForm").reset();
  clearErrors();
  photos.clear();
  video.clear();
  mapPicker.clear();
  selectedPath = [];
  picker.reset();
  setStep(1);
  setTimeout(() => setMessage("", ""), 5000);
}

/* -------------------------------------------------------- İlan listesi */

async function silIlan(id, data) {
  if (!confirm(`"${data.isim}" ilanını kalıcı olarak silmek istediğinize emin misiniz?`)) return;

  try {
    // Önce dosyalar, sonra kayıt. Dosya silme hatası kaydı engellemesin.
    const paths = (data.photoPaths || []).concat(data.videoPath ? [data.videoPath] : []);
    await Promise.allSettled(paths.map((p) => deleteObject(ref(storage, p))));
    await deleteDoc(doc(db, "ilanlar", id));
  } catch (err) {
    alert(`Silinemedi: ${err.message}`);
  }
}

onSnapshot(query(collection(db, "ilanlar"), orderBy("tarih", "desc")), (snap) => {
  const list = $("#ilanListesi");
  $("#ilanCount").textContent = `${snap.size} ilan`;

  if (snap.empty) {
    list.innerHTML = '<div class="list-empty">Henüz yayınlanmış ilan yok.</div>';
    return;
  }

  list.innerHTML = "";

  snap.forEach((snapDoc) => {
    const d = snapDoc.data();
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
          #${ilanNo(snapDoc.id)} &middot; ${escapeHtml(d.lokasyon || "")} &middot; ${escapeHtml(kat)}
          ${d.tarih ? ` &middot; ${escapeHtml(formatDate(d.tarih))}` : ""}
        </div>
        ${d.sokak || d.acikAdres ? `<div class="ilan-meta" style="color:var(--adm-faint)">
          <i class="fas fa-location-dot"></i>
          ${escapeHtml([d.sokak, d.acikAdres].filter(Boolean).join(" "))}
          ${d.enlem && d.boylam ? ' &middot; <i class="fas fa-map-pin" title="Haritada işaretli"></i> konum işaretli' : ""}
        </div>` : ""}
        <div class="ilan-desc">${escapeHtml((d.aciklama || "").slice(0, 160))}</div>
      </div>
      <div class="ilan-actions">
        <a class="btn btn-outline btn-sm" href="ilan_detayi.html?id=${encodeURIComponent(snapDoc.id)}" target="_blank" rel="noopener">
          <i class="fas fa-eye"></i> Görüntüle
        </a>
        <button type="button" class="btn btn-danger btn-sm" data-sil>
          <i class="fas fa-trash"></i> Sil
        </button>
      </div>
    `;

    row.querySelector("[data-sil]").addEventListener("click", () => silIlan(snapDoc.id, d));
    list.appendChild(row);
  });
}, (err) => {
  console.error(err);
  $("#ilanListesi").innerHTML = '<div class="list-empty">İlanlar yüklenemedi.</div>';
});
