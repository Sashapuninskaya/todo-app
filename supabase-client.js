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
  const url = window.safeShopUrl(source);
  if (url) {
    const image = document.createElement("img");
    image.alt = title;
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    image.hidden = true;
    image.addEventListener("load", () => {
      image.hidden = false;
      placeholder.hidden = true;
    });
    image.addEventListener("error", () => {
      image.hidden = true;
      placeholder.hidden = false;
      placeholder.textContent = "Photo unavailable";
    });
    image.src = url;
    figure.appendChild(image);
  }
  return figure;
};
