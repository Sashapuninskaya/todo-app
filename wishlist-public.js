(function () {
  const client = window.wishlistClient;
  const token = location.hash.slice(1);
  const status = document.getElementById("giftStatus");
  const list = document.getElementById("sharedGifts");
  const refresh = document.getElementById("refreshGifts");
  let busy = false;

  async function load() {
    if (busy) return;
    if (!client) {
      status.textContent = "Could not connect. Check your internet connection and reload.";
      return;
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
      status.textContent = "This link is incomplete. Ask the owner for the full wish list link.";
      refresh.disabled = true;
      return;
    }
    busy = true;
    refresh.disabled = true;
    status.textContent = "Loading gifts...";
    try {
      const { data, error } = await client.rpc("get_shared_wishlist", { p_share_token: token });
      if (error) throw error;
      list.replaceChildren();
      if (!data) {
        status.textContent = "This wish list is not available. Ask the owner for a new link.";
        return;
      }
      document.getElementById("giftListTitle").textContent = data.title;
      document.title = data.title;
      data.gifts.forEach((gift, index) => {
        const item = document.createElement("li");
        item.className = "gift-card";
        item.appendChild(window.createGiftPhoto(gift.image_url, gift.title));
        const number = document.createElement("span");
        number.className = "gift-number";
        number.textContent = String(index + 1).padStart(2, "0");
        item.appendChild(number);
        const brand = document.createElement("p");
        brand.className = "gift-brand";
        brand.textContent = gift.brand || "";
        item.appendChild(brand);
        const heading = document.createElement("h2");
        heading.textContent = gift.title;
        item.appendChild(heading);
        const price = document.createElement("p");
        price.className = "gift-price";
        price.textContent = gift.price || "";
        item.appendChild(price);
        if (gift.note) {
          const note = document.createElement("p");
          note.textContent = gift.note;
          item.appendChild(note);
        }
        const actions = document.createElement("div");
        actions.className = "gift-actions";
        const url = window.safeShopUrl(gift.shop_url);
        if (url) {
          const link = document.createElement("a");
          link.href = url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = "Open shop";
          actions.appendChild(link);
        }
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = gift.reserved ? "Reserved" : "Reserve gift";
        button.disabled = gift.reserved;
        button.addEventListener("click", async () => {
          button.disabled = true;
          button.textContent = "Reserving...";
          try {
            const result = await client.rpc("reserve_wishlist_gift", {
              p_share_token: token,
              p_gift_id: gift.id
            });
            if (result.error) throw result.error;
            button.textContent = "Reserved";
            status.textContent = result.data
              ? "Reserved for you! Use the shop link to purchase the gift."
              : "Someone else has already reserved this gift, or it is no longer available. Choose another one.";
          } catch (error) {
            // A network failure may happen after a successful reservation.
            // Reload availability instead of immediately allowing another purchase attempt.
            button.textContent = "Refresh to check";
            status.textContent = `Could not confirm the reservation: ${error.message}. Refresh availability before buying.`;
          }
        });
        actions.appendChild(button);
        item.appendChild(actions);
        list.appendChild(item);
      });
      status.textContent = data.gifts.length ? "Availability updated." : "No gifts published yet.";
    } catch (error) {
      list.replaceChildren();
      status.textContent = `Could not load gifts: ${error.message}. Try refreshing.`;
    } finally {
      busy = false;
      refresh.disabled = false;
    }
  }

  refresh.addEventListener("click", load);
  load();
})();
