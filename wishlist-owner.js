(function () {
  const client = window.wishlistClient;
  const local = window.WishlistLocal;
  const byId = id => document.getElementById(id);
  const tools = byId("wishlistTools");
  const status = byId("wishlistStatus");
  let user = null;
  let busy = false;

  function isWishlist(topic) {
    return !!topic && (topic.wishlistId || /^(wish\s*list|вишлист)$/i.test(topic.title.trim()));
  }

  function render(topic) {
    tools.hidden = !isWishlist(topic);
    byId("wishlistLogin").hidden = !!user;
    byId("wishlistAccount").hidden = !user;
    byId("wishlistUser").textContent = user ? `Signed in as ${user.email}` : "";
    const hasLink = !!(topic && user && topic.wishlistOwnerId === user.id && topic.shareToken);
    byId("wishlistLinkBox").hidden = !hasLink;
    if (hasLink) {
      const link = new URL("wishlist.html", location.href);
      link.hash = topic.shareToken;
      byId("wishlistLink").value = link.href;
      byId("previewWishlist").href = link.href;
    }
    if (!client) status.textContent = "Could not load Supabase. Check your internet connection and reload.";
  }

  window.WishShare = { isWishlist, render };
  local.render();
  if (!client) return;

  function showError(error) {
    status.textContent = `Could not complete the request: ${error.message || error}`;
  }

  byId("wishlistLogin").addEventListener("submit", async event => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    const form = event.currentTarget;
    const signup = event.submitter && event.submitter.name === "signup";
    status.textContent = signup ? "Creating account..." : "Signing in...";
    try {
      const credentials = {
        email: byId("wishlistEmail").value.trim(),
        password: byId("wishlistPassword").value
      };
      const result = signup
        ? await client.auth.signUp(credentials)
        : await client.auth.signInWithPassword(credentials);
      if (result.error) throw result.error;
      user = result.data.session ? result.data.user : null;
      form.reset();
      status.textContent = user
        ? "Signed in. You can publish your wish list."
        : "Check your email to confirm your account, then return here and sign in.";
      local.render();
    } catch (error) {
      showError(error);
    } finally {
      busy = false;
    }
  });

  byId("signOutWishlist").addEventListener("click", async () => {
    const { error } = await client.auth.signOut();
    if (error) return showError(error);
    user = null;
    status.textContent = "Signed out.";
    local.render();
  });

  byId("loadPublishedWishlists").addEventListener("click", async () => {
    if (busy || !user) return;
    busy = true;
    status.textContent = "Loading published lists...";
    try {
      const result = await client.from("wishlists").select("*")
        .eq("owner_id", user.id).order("created_at");
      if (result.error) throw result.error;
      for (const wishlist of result.data) {
        const gifts = await client.from("wishlist_gifts").select("*")
          .eq("wishlist_id", wishlist.id).order("created_at");
        if (gifts.error) throw gifts.error;
        // Existing local lists are preserved, including unpublished edits.
        local.importPublished(wishlist, gifts.data);
      }
      status.textContent = result.data.length ? "Published lists opened. Existing local edits were preserved." : "No published lists yet.";
    } catch (error) {
      showError(error);
    } finally {
      busy = false;
    }
  });

  byId("publishWishlist").addEventListener("click", async () => {
    const topic = local.getActiveTopic();
    if (busy || !user || !isWishlist(topic)) return;
    // Validate every link before making any changes to the online list.
    if (topic.tasks.some(task => task.shopUrl && !window.safeShopUrl(task.shopUrl.trim()))) {
      status.textContent = "Use a complete http:// or https:// shop link for each gift, or leave it empty.";
      return;
    }
    busy = true;
    const app = document.querySelector(".app");
    app.inert = true;
    status.textContent = "Publishing gifts...";
    try {
      let wishlist;
      if (topic.wishlistId && topic.wishlistOwnerId === user.id) {
        const result = await client.from("wishlists").update({ title: topic.title })
          .eq("id", topic.wishlistId).select().single();
        if (result.error) throw result.error;
        wishlist = result.data;
      } else {
        const result = await client.from("wishlists")
          .insert({ title: topic.title, owner_id: user.id }).select().single();
        if (result.error) throw result.error;
        wishlist = result.data;
        topic.tasks.forEach(task => { delete task.cloudGiftId; });
      }
      topic.wishlistId = wishlist.id;
      topic.wishlistOwnerId = user.id;
      topic.shareToken = wishlist.share_token;
      local.saveData();

      const existing = await client.from("wishlist_gifts").select("id").eq("wishlist_id", wishlist.id);
      if (existing.error) throw existing.error;
      const existingIds = new Set(existing.data.map(gift => gift.id));
      const keptIds = new Set();
      for (const task of topic.tasks) {
        const gift = {
          wishlist_id: wishlist.id,
          title: task.text,
          note: task.comment || "",
          shop_url: window.safeShopUrl((task.shopUrl || "").trim())
        };
        // Never overwrite the reserved flag when editing or republishing a gift.
        const result = task.cloudGiftId && existingIds.has(task.cloudGiftId)
          ? await client.from("wishlist_gifts").update(gift).eq("id", task.cloudGiftId).select("id").single()
          : await client.from("wishlist_gifts").insert(gift).select("id").single();
        if (result.error) throw result.error;
        task.cloudGiftId = result.data.id;
        keptIds.add(result.data.id);
        local.saveData();
      }
      const removedIds = [...existingIds].filter(id => !keptIds.has(id));
      if (removedIds.length) {
        const result = await client.from("wishlist_gifts").delete()
          .eq("wishlist_id", wishlist.id).in("id", removedIds);
        if (result.error) throw result.error;
      }
      status.textContent = location.protocol === "file:"
        ? "Published. Preview works here, but upload the site to get a link friends can open."
        : "Published! Copy the link for your friends. Reservations are preserved when you publish again.";
      local.render();
    } catch (error) {
      showError(error);
    } finally {
      busy = false;
      app.inert = false;
    }
  });

  byId("copyWishlistLink").addEventListener("click", async () => {
    const input = byId("wishlistLink");
    if (location.protocol === "file:") {
      status.textContent = "Upload the site first. A file:// link only works on your computer.";
      return;
    }
    try {
      await navigator.clipboard.writeText(input.value);
      status.textContent = "Link copied.";
    } catch {
      input.focus();
      input.select();
      status.textContent = "Press Ctrl+C to copy the selected link.";
    }
  });

  client.auth.getSession().then(({ data, error }) => {
    if (error) return showError(error);
    user = data.session ? data.session.user : null;
    local.render();
  }).catch(showError);
  client.auth.onAuthStateChange((_event, session) => {
    user = session ? session.user : null;
    render(local.getActiveTopic());
  });
})();
