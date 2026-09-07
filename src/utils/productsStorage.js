// src/utils/productsStorage.js
//
// There's no database yet, so generated products live in the browser's
// localStorage. This is the single place that reads/writes that data so
// components never touch `localStorage` directly.
//
// Shape of a stored product:
// {
//   id: string,
//   image: string,        // base64 data URL of the enhanced product photo (optional)
//   title: string,
//   description: string,
//   price: string,        // display-ready, e.g. "₹1800" (may have been edited by the user)
//   tags: string[],
//   createdAt: string,    // ISO timestamp
// }

const STORAGE_KEY = "kalalink_products";

/**
 * Returns all products currently stored, most-recently-created first.
 * Never throws — a missing/corrupt value just yields an empty list.
 */
export function getProducts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Removes a single product by id. Returns the full updated list.
 * If the id isn't found, this is a no-op (still returns the current list).
 */
export function deleteProduct(id) {
  const products = getProducts();
  const next = products.filter((p) => p.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    throw new Error("Couldn't delete this product — please try again.");
  }
  return next;
}

/**
 * Appends a new product without disturbing any that are already stored.
 *
 * localStorage has a small size cap (commonly ~5-10MB per site), and each
 * product's photo is stored as a base64 string, so a handful of full-size
 * photos can exceed that cap. Rather than silently dropping the write (the
 * previous behaviour), this now THROWS when the write fails, so the caller
 * can tell the user it didn't actually save instead of showing "Saved" for
 * a product that isn't there.
 *
 * @throws {Error} if the product could not be persisted.
 * @returns the full updated list on success.
 */
export function saveProduct(product) {
  const products = getProducts();
  const newProduct = {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
    ...product,
  };
  const next = [newProduct, ...products];

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    throw new Error(
      "Couldn't save this product — your browser's local storage is full. " +
        "Try removing an old product, or use a smaller photo."
    );
  }

  return next;
}
