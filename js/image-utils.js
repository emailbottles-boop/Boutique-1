// Bridget's Boutique — browser-side image compression
//
// WHY THIS EXISTS
// Photos are stored directly in the Firestore database as compressed data
// URLs, instead of in Firebase Storage. Storage requires the paid Blaze
// plan on newer Firebase projects (still free at this scale, but it wants
// a credit card on file). Keeping photos in Firestore means the whole
// backend runs on the free Spark plan with no billing attached at all.
//
// The tradeoff: Firestore caps a single document at 1 MB, so photos get
// resized and compressed here in the browser before saving. A phone photo
// straight from the camera is 3-8 MB; this brings it down to roughly
// 100-250 KB, which is plenty sharp for a product card on a website.

const MAX_DIMENSION = 1000; // longest edge, in pixels
const TARGET_BYTES = 280 * 1024; // aim below this; hard ceiling is Firestore's 1 MB
const MIN_QUALITY = 0.4;

/**
 * Turn a user-selected image File into a compressed JPEG data URL.
 * Throws a friendly Error if the file isn't an image or can't be shrunk enough.
 */
export async function compressImageToDataUrl(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error("That file isn't an image. Please choose a photo.");
  }

  const bitmap = await loadBitmap(file);

  // Scale the longest edge down to MAX_DIMENSION, preserving aspect ratio.
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // White backdrop so transparent PNGs don't turn black when saved as JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  if (bitmap.close) bitmap.close();

  // Step the JPEG quality down until it fits comfortably in a Firestore doc.
  let quality = 0.82;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);

  while (dataUrlBytes(dataUrl) > TARGET_BYTES && quality > MIN_QUALITY) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }

  if (dataUrlBytes(dataUrl) > 900 * 1024) {
    throw new Error("That photo is too large to save even after compressing. Try a smaller one.");
  }

  return dataUrl;
}

/** Approximate decoded byte size of a base64 data URL. */
export function dataUrlBytes(dataUrl) {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Math.ceil((base64.length * 3) / 4);
}

/**
 * Decode the file to a bitmap. Uses createImageBitmap where available so
 * that phone photos with EXIF rotation come out the right way up.
 */
async function loadBitmap(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch (err) {
      // Older Safari rejects the options argument — fall through.
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read that image file. Try a different photo."));
    };
    img.src = url;
  });
}
