// İl / İlçe / Mahalle bağlı select yönetimi.
import { buildOptions } from "./utils.js";

let data = {};

async function load() {
  if (Object.keys(data).length) return data;
  try {
    const response = await fetch("./turkiye-verileri.json");
    data = await response.json();
  } catch (err) {
    console.error("Türkiye verileri yüklenemedi:", err);
    data = {};
  }
  return data;
}

/**
 * Üç select'i birbirine bağlar.
 * @param {{il: HTMLSelectElement, ilce: HTMLSelectElement, mahalle: HTMLSelectElement}} selects
 */
export async function initLocationSelects({ il, ilce, mahalle }) {
  await load();

  il.innerHTML = buildOptions(Object.keys(data));
  ilce.innerHTML = buildOptions([]);
  mahalle.innerHTML = buildOptions([]);

  il.addEventListener("change", () => {
    const districts = data[il.value] ? Object.keys(data[il.value]) : [];
    ilce.innerHTML = buildOptions(districts);
    mahalle.innerHTML = buildOptions([]);
  });

  ilce.addEventListener("change", () => {
    const hoods = (data[il.value] && data[il.value][ilce.value]) || [];
    mahalle.innerHTML = buildOptions(hoods);
  });
}
