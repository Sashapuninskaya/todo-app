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
