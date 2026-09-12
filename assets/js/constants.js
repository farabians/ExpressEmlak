// İlan formu ve detay sayfasının paylaştığı sabit veriler.
// Buradaki tek bir listeyi değiştirmek her iki sayfayı birlikte güncellendirir.

export const CATEGORY_TREE = {
  "Konut": {
    "Satılık": ["Daire", "Rezidans", "Müstakil Ev", "Villa", "Çiftlik Evi", "Köşk & Konak", "Yalı", "Yalı Dairesi"],
    "Kiralık": ["Daire", "Rezidans", "Müstakil Ev", "Villa", "Çiftlik Evi", "Köşk & Konak", "Yalı", "Yalı Dairesi"],
    "Turistik Günlük Kiralık": ["Daire", "Müstakil Ev", "Villa"],
    "Devren Satılık Konut": ["Daire", "Müstakil Ev"]
  },
  "İş Yeri": {
    "Satılık": ["Ofis", "Dükkan", "Mağaza", "Depo", "Fabrika"],
    "Kiralık": ["Ofis", "Dükkan", "Mağaza", "Depo", "Fabrika"],
    "Devren Satılık": ["Dükkan", "Mağaza", "Kafe", "Restoran"],
    "Devren Kiralık": ["Dükkan", "Mağaza", "Kafe", "Restoran"]
  },
  "Arsa": {
    "Satılık": ["İmarlı", "Tarla", "Bağ & Bahçe", "Zeytinlik"],
    "Kiralık": ["İmarlı", "Tarla", "Bağ & Bahçe"]
  },
  "Bina": {
    "Satılık": ["Komple Bina"],
    "Kiralık": ["Komple Bina"]
  },
  "Devre Mülk": {
    "Satılık": ["Devre Mülk"],
    "Kiralık": ["Devre Mülk"]
  },
  "Turistik Tesis": {
    "Satılık": ["Otel", "Motel", "Apart Otel", "Tatil Köyü"],
    "Kiralık": ["Otel", "Motel", "Apart Otel", "Tatil Köyü"]
  }
};

// Select alanlarının seçenekleri
export const SELECT_OPTIONS = {
  odaSayisi: ["Stüdyo (1+0)", "1+1", "1.5+1", "2+0", "2+1", "2.5+1", "2+2", "3+0", "3+1", "3.5+1", "3+2", "3+3",
    "4+0", "4+1", "4.5+1", "4.5+2", "4+2", "4+3", "4+4", "5+1", "5.5+1", "5+2", "5+3", "5+4",
    "6+1", "6+2", "6+3", "7+1", "7+2", "7+3", "8+1", "8+2", "8+3", "8+4",
    "9+1", "9+2", "9+3", "9+4", "9+5", "9+6", "10+1", "10+2", "10 Üzeri"],

  binaYasi: ["0", "1", "2", "3", "4", "5-10 arası", "11-15 arası", "16-20 arası",
    "21-25 arası", "26-30 arası", "31 ve üzeri"],

  katSayisi: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15",
    "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26-30 arası", "31 ve üzeri"],

  bulunduguKat: ["Kot 4", "Kot 3", "Kot 2", "Kot 1", "Bodrum Kat", "Zemin Kat", "Bahçe Katı", "Giriş Katı",
    "Yüksek Giriş", "Müstakil", "Villa Tipi", "Çatı Katı", "Teras Kat", "En Üst Kat",
    "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15",
    "16", "17", "18", "19", "20", "21 ve üzeri"],

  isitma: ["Yok", "Soba", "Doğalgaz Soba", "Kat Kaloriferi", "Merkezi", "Merkezi (Pay Ölçer)",
    "Kombi (Doğalgaz)", "Kombi (Elektrik)", "Yerden Isıtma", "Klima", "Fancoil Ünitesi",
    "Güneş Enerjisi", "Elektrikli Radyatör", "Jeotermal", "Şömine", "VRV", "VRF", "Isı Pompası"],

  banyoSayisi: ["1", "2", "3", "4", "5", "6 ve üzeri"],

  mutfak: ["Açık (Amerikan)", "Kapalı", "Ankastre", "Laminat", "Yok"],

  balkon: ["Var", "Yok"],

  asansor: ["Var", "Yok"],

  otopark: ["Açık Otopark", "Kapalı Otopark", "Açık & Kapalı Otopark", "Yok"],

  kullanimDurumu: ["Boş", "Kiracılı", "Mülk Sahibi"],

  enerjiKimlikBelgesi: ["A", "B", "C", "D", "E", "F", "G", "Muaf", "Belgesi Yok"],

  tapuDurumu: ["Kat Mülkiyetli", "Kat İrtifaklı", "Hisseli Tapu", "Müstakil Tapulu", "Arsa Tapulu",
    "Kooperatif Hisseli Tapu", "İntifa Hakkı Tesisli", "Yurt Dışı Tapulu", "Tapu Kaydı Yok"],

  kimden: ["Sahibinden", "Emlak Ofisinden", "İnşaat Firmasından"],

  isyeriTipi: ["Ofis", "Dükkan", "Mağaza", "Depo", "Fabrika", "Kafe & Restoran", "Plaza Katı", "İş Hanı Katı"],

  arsaTipi: ["Arsa", "Tarla", "Bağ & Bahçe", "Zeytinlik", "Konut İmarlı", "Ticari İmarlı", "Sanayi İmarlı"],

  imarDurumu: ["Konut", "Ticari", "Konut + Ticari", "Sanayi", "Turizm", "Tarla", "Bağ & Bahçe", "İmarsız"]
};

// Detaylı Bilgi akordiyonundaki çoktan seçmeli gruplar.
// key = Firestore'da saklanan alan adı, items = kullanıcıya gösterilen etiketler.
export const FEATURE_GROUPS = [
  {
    key: "cephe",
    title: "Cephe",
    items: ["Batı", "Doğu", "Güney", "Kuzey"]
  },
  {
    key: "icOzellikler",
    title: "İç Özellikler",
    // ADSL bilerek silinmedi: eski ilanların icOzellikler dizisinde zaten bu
    // string saklanmış olabilir, seçenekten kaldırmak yalnızca düzenlemede
    // checkbox'ı bulunamaz hale getirir (görüntülemede sorun çıkmaz). Fiber
    // İnternet ile yan yana duruyor; kullanıcı hangisi uyuyorsa onu işaretler.
    items: ["ADSL", "Fiber İnternet", "Ahşap Doğrama", "Akıllı Ev", "Akıllı Kilit",
      "Alarm (Hırsız)", "Alarm (Yangın)", "Alaturka Tuvalet",
      "Alüminyum Doğrama", "Ankastre Fırın", "Barbekü", "Beyaz Eşya", "Boyalı", "Bulaşık Makinesi",
      "Buzdolabı", "Çamaşır Kurutma Makinesi", "Çamaşır Makinesi", "Çamaşır Odası", "Çelik Kapı",
      "Duşakabin", "Duvar Kağıdı", "Ebeveyn Banyosu", "Fırın", "Giyinme Odası", "Görüntülü Diyafon",
      "Gömme Dolap", "Hilton Banyo", "Intercom Sistemi", "Jakuzi", "Kartonpiyer", "Kiler", "Klima", "Küvet",
      "Laminat Zemin", "Marley", "Mobilya", "Mutfak (Ankastre)", "Mutfak (Laminat)", "Mutfak Doğalgazı",
      "Panjur / Jaluzi", "Parke Zemin", "PVC Doğrama", "Seramik Zemin", "Set Üstü Ocak", "Shower Enclosure",
      "Spot Aydınlatma", "Şömine", "Teras", "Termosifon", "Vestiyer", "Wc", "Yüzme Havuzu"]
  },
  {
    key: "disOzellikler",
    title: "Dış Özellikler",
    // Asansör ve Otopark bilerek burada yok: onlar Konut Bilgileri bölümünde
    // ayrı select alanı olarak giriliyor (bkz. SELECT_OPTIONS.asansor / .otopark).
    items: ["24 Saat Güvenlik", "Araç Şarj İstasyonu", "Buhar Odası", "Çocuk Oyun Parkı",
      "Güneş Paneli", "Hidrofor", "Isı Yalıtımı", "IP Kamera Sistemi", "Jeneratör", "Kablo TV",
      "Kamera Sistemi", "Kapalı Garaj",
      "Kapıcı", "Kreş", "Müstakil Havuzlu", "Oyun Parkı", "Sauna", "Ses Yalıtımı",
      "Siding", "Spor Alanı", "Su Deposu", "Tenis Kortu", "Yangın Merdiveni", "Yüzme Havuzu (Açık)",
      "Yüzme Havuzu (Kapalı)"]
  },
  {
    key: "muhit",
    title: "Muhit",
    items: ["Alışveriş Merkezi", "Belediye", "Cami", "Cemevi", "Denize Sıfır", "Eczane", "Eğlence Merkezi",
      "Fuar", "Göle Sıfır", "Hastane", "İlkokul & Ortaokul", "İtfaiye", "Kilise", "Lise", "Market",
      "Park", "Polis Merkezi", "Sağlık Ocağı", "Semt Pazarı", "Spor Salonu", "Şehir Merkezi",
      "Üniversite", "Havra"]
  },
  {
    key: "ulasim",
    title: "Ulaşım",
    items: ["Anayol", "Avrasya Tüneli", "Boğaz Köprüleri", "Cadde", "Deniz Otobüsü", "Dolmuş",
      "E-5", "Havaalanı", "İskele", "Metro", "Metrobüs", "Minibüs", "Otobüs Durağı", "Sahil",
      "Teleferik", "Tem", "Tramvay", "Tren İstasyonu", "Troleybüs"]
  },
  {
    key: "manzara",
    title: "Manzara",
    items: ["Boğaz", "Şehir", "Deniz", "Doğa", "Göl", "Park & Yeşil Alan", "Havuz"]
  },
  {
    key: "konutTipi",
    title: "Konut Tipi",
    items: ["Ara Kat", "Ara Kat Dubleks", "Bahçe Dubleksi", "Bahçe Katı", "Çatı Dubleksi", "Forleks",
      "Garden Flat", "Giriş Katı", "Kot 1", "Kot 2", "Kot 3", "Müstakil", "Normal", "Teras Evi",
      "Villa Tipi", "Yüksek Giriş", "Zemin Kat"]
  },
  {
    key: "engelliUygun",
    title: "Engelliye ve Yaşlıya Uygun",
    items: ["Araç Park Yeri", "Banyo Küvet Kolçağı", "Banyo Tutamağı", "Merdiven Genişliği",
      "Giriş / Rampa", "Görme Engelliye Uygun", "Koridor Genişliği", "Oda Kapı Genişliği",
      "Priz / Elektrik Tesisatı", "Tuvalet Tutamağı", "Tuvalet Yüksekliği", "Yüzme Havuzu Erişimi",
      "Asansör Kapı Genişliği", "Asansör Buton Yüksekliği"]
  }
];

// Detay sayfasındaki özellik tablosunun satır tanımları.
// Kategoriye göre hangi alanların gösterileceğini burada yönetiyoruz.
export const SPEC_ROWS = [
  { key: "brutMetrekare", label: "m² (Brüt)" },
  { key: "netMetrekare", label: "m² (Net)" },
  { key: "arsaMetrekare", label: "m² (Arsa)" },
  { key: "odaSayisi", label: "Oda Sayısı" },
  { key: "binaYasi", label: "Bina Yaşı" },
  { key: "katSayisi", label: "Kat Sayısı" },
  { key: "bulunduguKat", label: "Bulunduğu Kat" },
  { key: "isitma", label: "Isıtma" },
  { key: "banyoSayisi", label: "Banyo Sayısı" },
  { key: "mutfak", label: "Mutfak" },
  { key: "balkon", label: "Balkon" },
  { key: "asansor", label: "Asansör" },
  { key: "otopark", label: "Otopark" },
  { key: "esyali", label: "Eşyalı", type: "bool" },
  { key: "kullanimDurumu", label: "Kullanım Durumu" },
  { key: "aidat", label: "Aidat (TL)", type: "money" },
  { key: "depozito", label: "Depozito (TL)", type: "money" },
  { key: "enerjiKimlikBelgesi", label: "Enerji Kimlik Belgesi" },
  { key: "tapuDurumu", label: "Tapu Durumu" },
  { key: "tasinmazNo", label: "Taşınmaz Numarası" },
  { key: "isyeriTipi", label: "İş Yeri Tipi" },
  { key: "arsaTipi", label: "Arsa Tipi" },
  { key: "imarDurumu", label: "İmar Durumu" },
  { key: "kimden", label: "Kimden" }
];

// Kategori adını Firestore'da kullanılan sade anahtara çevirir: "İş Yeri" -> "isyeri"
export function slugify(value) {
  if (!value) return "";
  const charMap = { Ç: "c", Ö: "o", Ş: "s", İ: "i", I: "i", Ü: "u", Ğ: "g",
                    ç: "c", ö: "o", ş: "s", ı: "i", ü: "u", ğ: "g" };
  return value.replace(/[ÇÖŞİIÜĞçöşıüğ]/g, (m) => charMap[m]).toLowerCase().replace(/\s+/g, "");
}

// Hangi kategori hangi form bloğunu kullanıyor
export function fieldsetFor(kategoriSlug) {
  if (kategoriSlug === "isyeri") return "isyeri";
  if (kategoriSlug === "arsa") return "arsa";
  return "konut"; // konut, bina, devremulk, turistiktesis
}

// Slug -> görünen ad sözlüğü. Kategori alanı Firestore'da her zaman slug olarak
// saklanır ("isyeri"); eski kayıtlarda ilanTipi ve altKategori de slug'a
// çevrilmiş olabilir ("satilik"). Ekranda ham slug göstermemek için kullanılır.
const DISPLAY_NAMES = (() => {
  const map = {};
  const add = (label) => {
    const slug = slugify(label);
    map[slug] = label;
    // "Köşk & Konak" -> "kosk&konak"; bazı kayıtlarda & düşmüş olabilir.
    if (slug.includes("&")) map[slug.replace(/&/g, "")] = label;
  };
  Object.entries(CATEGORY_TREE).forEach(([kategori, tipler]) => {
    add(kategori);
    Object.entries(tipler).forEach(([tip, altlar]) => {
      add(tip);
      altlar.forEach(add);
    });
  });
  return map;
})();

/**
 * Kayıttaki bir kategori parçasını ekranda gösterilecek biçime çevirir.
 * "isyeri" -> "İş Yeri", "satilik" -> "Satılık", "Daire" -> "Daire"
 */
export function displayName(value) {
  if (!value) return "";
  // Zaten okunabilir bir etiketse (boşluk veya büyük harf içeriyorsa) dokunma
  if (/[\sA-ZÇÖŞİÜĞ]/.test(value)) return value;
  return DISPLAY_NAMES[value] || value;
}
