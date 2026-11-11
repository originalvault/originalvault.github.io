(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const setText = (id, value) => { const el = $(id); if (el) el.textContent = value; };
  const year = $("year");
  if (year) year.textContent = new Date().getFullYear();

  const cfg = window.OV_CONFIG || {};
  const configured = typeof cfg.url === "string" && typeof cfg.anonKey === "string" &&
    /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cfg.url) &&
    cfg.anonKey.length > 20 && !cfg.anonKey.includes("PASTE_");

  const showUnavailable = message => {
    setText("configNotice", message);
    if ($("photoGrid")) $("photoGrid").textContent = "সংযোগ সম্পন্ন হলে আপলোড করা ছবিগুলো এখানে দেখা যাবে।";
    if ($("videoGrid")) $("videoGrid").textContent = "সংযোগ সম্পন্ন হলে আপলোড করা ভিডিওগুলো এখানে দেখা যাবে।";
  };

  if (!configured || !window.supabase || typeof window.supabase.createClient !== "function") {
    showUnavailable("Supabase সংযোগের সেটিংস সঠিক নয়। config.js ও Supabase CDN পরীক্ষা করুন।");
    return;
  }

  const db = window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  setText("configNotice", "Supabase সংযোগ হয়েছে। অ্যাডমিন ইমেইল ও পাসওয়ার্ড দিয়ে লগইন করুন।");
  if ($("authBox")) $("authBox").hidden = false;

  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[c]));

  function safePublicMediaUrl(value) {
    try {
      const url = new URL(value);
      const expected = new URL(cfg.url);
      return url.protocol === "https:" && url.origin === expected.origin &&
        url.pathname.startsWith("/storage/v1/object/public/originalvault-media/")
        ? url.href : "";
    } catch (_) { return ""; }
  }

  function safeSourceUrl(value) {
    if (!value) return "";
    try {
      const url = new URL(value);
      return (url.protocol === "https:" || url.protocol === "http:") ? url.href : "";
    } catch (_) { return ""; }
  }

  function mediaCard(item) {
    const mediaUrl = safePublicMediaUrl(item.public_url);
    if (!mediaUrl) return "";
    const isVideo = item.media_type === "video";
    const media = isVideo
      ? `<video controls preload="metadata" src="${esc(mediaUrl)}" aria-label="${esc(item.title)}"></video>`
      : `<img loading="lazy" decoding="async" src="${esc(mediaUrl)}" alt="${esc(item.title)}">`;
    const sourceUrl = safeSourceUrl(item.source_url);
    const source = sourceUrl
      ? `<p><a target="_blank" rel="noopener noreferrer nofollow" href="${esc(sourceUrl)}">মূল পোস্ট দেখুন</a></p><p><button type="button" class="button secondary copy-link-btn" data-copy-url="${esc(sourceUrl)}">মূল পোস্টের লিংক কপি করুন</button></p>`
      : "";
    const detailUrl = new URL(`content.html?id=${encodeURIComponent(item.id)}`, window.location.href).href;
    const copyArchive = `<p><a class="button secondary" href="content.html?id=${encodeURIComponent(item.id)}">কনটেন্টের বিস্তারিত দেখুন</a></p><p><button type="button" class="button secondary copy-link-btn" data-copy-url="${esc(detailUrl)}">কনটেন্টের বিস্তারিত লিংক কপি করুন</button></p><p><button type="button" class="button secondary copy-link-btn" data-copy-url="${esc(mediaUrl)}">শুধু ছবি/ভিডিওর লিংক কপি করুন</button></p>`;
    return `<article class="card media-card">${media}<span class="tag">${isVideo ? "ভিডিও" : "ছবি"}</span><h3>${esc(item.title)}</h3><p>${esc(item.description || "")}</p><div class="meta">স্রষ্টা: ${esc(item.creator || "—")} · প্রথম প্রকাশ: ${esc(item.published_at || "তারিখ দেওয়া হয়নি")}</div>${source}${copyArchive}<details class="hash-details"><summary>ফাইল SHA-256</summary><code>${esc(item.sha256 || "সংরক্ষিত নেই")}</code></details></article>`;
  }

  document.addEventListener("click", async event => {
    const button = event.target.closest(".copy-link-btn");
    if (!button) return;
    const url = button.getAttribute("data-copy-url");
    if (!url) return;
    const originalText = button.textContent;
    try {
      await navigator.clipboard.writeText(url);
      button.textContent = "লিংক কপি হয়েছে ✓";
    } catch (_) {
      const field = document.createElement("textarea");
      field.value = url;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      const copied = document.execCommand("copy");
      field.remove();
      button.textContent = copied ? "লিংক কপি হয়েছে ✓" : "লিংক কপি হয়নি";
    }
    window.setTimeout(() => { button.textContent = originalText; }, 2200);
  });

  async function loadGallery() {
    const photoGrid = $("photoGrid");
    const videoGrid = $("videoGrid");
    if (photoGrid) photoGrid.textContent = "ছবির আর্কাইভ লোড হচ্ছে...";
    if (videoGrid) videoGrid.textContent = "ভিডিওর আর্কাইভ লোড হচ্ছে...";
    try {
      const { data, error } = await db.from("media_records")
        .select("id,title,description,creator,published_at,source_url,public_url,media_type,sha256")
        .order("published_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      const records = Array.isArray(data) ? data : [];
      const photos = records.filter(x => x.media_type === "image").map(mediaCard).filter(Boolean);
      const videos = records.filter(x => x.media_type === "video").map(mediaCard).filter(Boolean);
      if (photoGrid) photoGrid.innerHTML = photos.length ? photos.join("") : '<p class="muted">এখনো কোনো ছবি আপলোড করা হয়নি।</p>';
      if (videoGrid) videoGrid.innerHTML = videos.length ? videos.join("") : '<p class="muted">এখনো কোনো ভিডিও আপলোড করা হয়নি।</p>';
    } catch (error) {
      console.error("Gallery load failed:", error);
      if (photoGrid) photoGrid.textContent = "ছবির আর্কাইভ লোড করা যায়নি। পরে আবার চেষ্টা করুন।";
      if (videoGrid) videoGrid.textContent = "ভিডিওর আর্কাইভ লোড করা যায়নি। পরে আবার চেষ্টা করুন।";
    }
  }

  function applyAuthSession(session) {
    $("uploadForm").hidden = !session;
    $("logoutBtn").hidden = !session;
    $("loginForm").querySelectorAll('label,button[type="submit"]').forEach(el => { el.hidden = !!session; });
    setText("authMessage", session ? "অ্যাডমিন হিসেবে লগইন করা হয়েছে।" : "");
  }

  async function refreshAuth() {
    try {
      const { data, error } = await db.auth.getSession();
      if (error) throw error;
      applyAuthSession(data?.session || null);
    } catch (error) {
      console.error("Auth state refresh failed:", error);
      setText("authMessage", "লগইন অবস্থা যাচাই করা যায়নি। পেজ রিফ্রেশ করে আবার চেষ্টা করুন।");
    }
  }

  $("loginForm").addEventListener("submit", async event => {
    event.preventDefault();
    const button = $("loginForm").querySelector('button[type="submit"]');
    button.disabled = true;
    setText("authMessage", "লগইন হচ্ছে...");
    try {
      const { error } = await db.auth.signInWithPassword({
        email: $("email").value.trim(),
        password: $("password").value
      });
      if (error) throw error;
      $("password").value = "";
      setText("authMessage", "লগইন সফল।");
      await refreshAuth();
    } catch (error) {
      console.error("Admin sign-in failed:", error);
      setText("authMessage", "লগইন করা যায়নি। ইমেইল, পাসওয়ার্ড ও Supabase Auth সেটিংস পরীক্ষা করুন।");
    } finally {
      button.disabled = false;
    }
  });

  $("logoutBtn").addEventListener("click", async () => {
    const button = $("logoutBtn");
    button.disabled = true;
    try {
      const { error } = await db.auth.signOut();
      if (error) throw error;
      await refreshAuth();
    } catch (error) {
      console.error("Sign-out failed:", error);
      setText("authMessage", "লগআউট করা যায়নি। আবার চেষ্টা করুন।");
    } finally {
      button.disabled = false;
    }
  });

  async function sha256(file) {
    if (!window.crypto?.subtle) throw new Error("এই ব্রাউজারে নিরাপদ SHA-256 সুবিধা পাওয়া যাচ্ছে না। HTTPS-এ ওয়েবসাইট খুলুন।");
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  }

  $("uploadForm").addEventListener("submit", async event => {
    event.preventDefault();
    const form = $("uploadForm");
    const file = $("mediaFile").files[0];
    if (!file) return;
    if (file.size === 0) { setText("uploadMessage", "ফাইলটি খালি। অন্য ফাইল নির্বাচন করুন।"); return; }
    if (file.size > 50 * 1024 * 1024) {
      setText("uploadMessage", "ফাইল ৫০ MB-এর বেশি। ছোট ফাইল নির্বাচন করুন।");
      return;
    }
    const allowed = ["image/jpeg","image/png","image/webp","image/gif","video/mp4","video/webm","video/quicktime"];
    if (!allowed.includes(file.type)) {
      setText("uploadMessage", "এই ফাইলের ধরন অনুমোদিত নয়। JPG, PNG, WEBP, GIF, MP4, WEBM বা MOV ব্যবহার করুন।");
      return;
    }
    const title = $("title").value.trim();
    const creator = $("creator").value.trim();
    const sourceInput = $("sourceUrl").value.trim();
    if (!title || !creator) { setText("uploadMessage", "শিরোনাম ও স্রষ্টার নাম লিখুন।"); return; }
    if (sourceInput && !safeSourceUrl(sourceInput)) {
      setText("uploadMessage", "মূল পোস্টের লিংকটি সঠিক HTTP বা HTTPS লিংক হতে হবে।");
      return;
    }

    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    setText("uploadMessage", "ফাইল যাচাই ও আপলোড হচ্ছে। পেজ বন্ধ করবেন না...");
    let uploadedPath = null;
    try {
      const { data: { user }, error: userError } = await db.auth.getUser();
      if (userError || !user) throw new Error("আপনার লগইন সেশন পাওয়া যায়নি। আবার লগইন করুন।");

      const hash = await sha256(file);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "media-file";
      const path = `${user.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await db.storage.from("originalvault-media")
        .upload(path, file, { upsert: false, contentType: file.type, cacheControl: "3600" });
      if (uploadError) throw uploadError;
      uploadedPath = path;

      const { data: { publicUrl } } = db.storage.from("originalvault-media").getPublicUrl(path);
      const row = {
        title,
        description: $("description").value.trim() || null,
        creator,
        published_at: $("publishedAt").value || null,
        source_url: sourceInput || null,
        file_path: path,
        public_url: publicUrl,
        media_type: file.type.startsWith("video/") ? "video" : "image",
        sha256: hash,
        owner_id: user.id
      };
      const { error: insertError } = await db.from("media_records").insert(row);
      if (insertError) throw insertError;

      setText("uploadMessage", "সফলভাবে আপলোড হয়েছে এবং আর্কাইভে যোগ হয়েছে। SHA-256: " + hash);
      form.reset();
      await loadGallery();
    } catch (error) {
      console.error("Media upload failed:", error);
      setText("uploadMessage", uploadedPath
        ? "ফাইল স্টোরেজে উঠেছে, কিন্তু আর্কাইভের তথ্য সেভ হয়নি। একই ফাইল আবার আপলোড করবেন না; অ্যাডমিনের সহায়তা প্রয়োজন।"
        : (error.message || "আপলোড করা যায়নি। সেটিংস ও ইন্টারনেট সংযোগ পরীক্ষা করুন।"));
    } finally {
      submit.disabled = false;
    }
  });

  db.auth.onAuthStateChange((_event, session) => { queueMicrotask(() => applyAuthSession(session || null)); });
  void refreshAuth();
  void loadGallery();
})();