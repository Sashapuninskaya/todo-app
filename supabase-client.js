// Public browser credentials. Access is controlled by Supabase RLS and RPCs.
window.wishlistClient = window.supabase
  ? window.supabase.createClient(
      "https://tkmevagarzxphzfvydmw.supabase.co",
      "sb_publishable_YUAdtpFngWKzk0W4Jxr5IA_6wJf4M1e"
    )
  : null;

window.safeShopUrl = function (value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
};

window.createGiftPhoto = function (source, title) {
  const figure = document.createElement("figure");
  figure.className = "gift-photo";
  const placeholder = document.createElement("span");
  placeholder.className = "photo-placeholder";
  placeholder.textContent = "No photo yet";
  figure.appendChild(placeholder);
  const url = window.safeShopUrl((source || "").trim());
  if (source && !url) placeholder.textContent = "Use a direct https:// image link";
  if (url) {
    placeholder.textContent = "Loading photo...";
    const image = document.createElement("img");
    image.alt = title;
    // A hidden, lazy-loaded image may never start loading.
    image.loading = "eager";
    image.referrerPolicy = "no-referrer";
    image.hidden = true;
    image.addEventListener("load", () => {
      image.hidden = false;
      placeholder.hidden = true;
    });
    image.addEventListener("error", () => {
      image.hidden = true;
      placeholder.hidden = false;
      placeholder.textContent = "Photo unavailable. Check the image link.";
    });
    image.src = url;
    figure.appendChild(image);
  }
  return figure;
};
