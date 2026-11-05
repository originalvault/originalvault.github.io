(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const year = $("year");
  if (year) year.textContent = new Date().getFullYear();

  const cfg = window.OV_CONFIG || {};
  const configured = cfg.url && cfg.anonKey &&
    !cfg.url.includes("PASTE_") && !cfg.anonKey.includes("PASTE_");

  if (!configured || !window.supabase) {
    $("configNotice").textContent = "Supabase সংযোগ এখনো সম্পূর্ণ হয়নি। config.js ফাইলে Project URL ও Publishable key বসাতে হবে।";
    $("photoGrid").innerHTML = '<p class="muted">সংযোগ সম্পন্ন হলে আপলোড করা ছবি এখানে দেখা যাবে।</p>';
    $("videoGrid").innerHTML = '<p class="muted">সংযোগ সম্পন্ন হলে আপলোড করা ভিডিও এখানে দেখা যাবে।</p>';
    return;
  }

  const db = window.supabase.createClient(cfg.url, cfg.anonKey);
  $("configNotice").textContent = "Supabase সংযোগ হয়েছে। অ্যাডমিন ইমেইল ও পাসওয়ার্ড দিয়ে লগইন করুন।";
  $("authBox").hidden = false;

  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[c]));

  function mediaCard(item) {
    const media = item.media_type === "video"
      ? `<video controls preload="metadata" src="${esc(item.public_url)}"></video>`
      : `<img loading="lazy" src="${esc(item.public_url)}" alt="${esc(item.title)}">`;
    const source = item.source_url
      ? `<p><a target="_blank" rel="noopener noreferrer" href="${esc(item.source_url)}">মূল পোস্ট দেখুন</a></p>` : "";
    return `<article class="card media-card">${media}<span class="tag">${item.media_type === "video" ? "ভিডিও" : "ছবি"}</span><h3>${esc(item.title)}</h3><p>${esc(item.description || "")}</p><div class="meta">স্রষ্টা: ${esc(item.creator || "—")} · প্রথম প্রকাশ: ${esc(item.published_at || "তারিখ দেওয়া হয়নি")}</div>${source}<details class="hash-details"><summary>ফাইল SHA-256</summary><code>${esc(item.sha256 || "সংরক্ষিত নেই")}</code></details></article>`;
  }

  async function loadGallery() {
    const { data, error } = await db.from("media_records")
      .select("id,title,description,creator,published_at,source_url,public_url,media_type,sha256,created_at")
      .order("created_at", { ascending: false });
    if (error) {
      $("photoGrid").innerHTML = '<p class="muted">ছবির আর্কাইভ লোড করা যায়নি। Supabase টেবিল ও নীতিমালা পরীক্ষা করুন।</p>';
      $("videoGrid").innerHTML = '<p class="muted">ভিডিওর আর্কাইভ লোড করা যায়নি। Supabase টেবিল ও নীতিমালা পরীক্ষা করুন।</p>';
      return;
    }
    const photos = data.filter(x => x.media_type === "image");
    const videos = data.filter(x => x.media_type === "video");
    $("photoGrid").innerHTML = photos.length ? photos.map(mediaCard).join("") : '<p class="muted">এখনো কোনো ছবি আপলোড করা হয়নি।</p>';
    $("videoGrid").innerHTML = videos.length ? videos.map(mediaCard).join("") : '<p class="muted">এখনো কোনো ভিডিও আপলোড করা হয়নি।</p>';
  }

  async function refreshAuth() {
    const { data: { session } } = await db.auth.getSession();
    $("uploadForm").hidden = !session;
    $("logoutBtn").hidden = !session;
    $("loginForm").querySelectorAll('label,button[type="submit"]').forEach(el => el.hidden = !!session);
    $("authMessage").textContent = session ? "অ্যাডমিন হিসেবে লগইন করা হয়েছে।" : "";
  }

  $("loginForm").addEventListener("submit", async event => {
    event.preventDefault();
    $("authMessage").textContent = "লগইন হচ্ছে...";
    const { error } = await db.auth.signInWithPassword({
      email: $("email").value.trim(),
      password: $("password").value
    });
    $("authMessage").textContent = error ? "লগইন করা যায়নি: " + error.message : "লগইন সফল।";
    await refreshAuth();
  });

  $("logoutBtn").addEventListener("click", async () => {
    await db.auth.signOut();
    await refreshAuth();
  });

  async function sha256(file) {
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  }

  $("uploadForm").addEventListener("submit", async event => {
    event.preventDefault();
    const file = $("mediaFile").files[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      $("uploadMessage").textContent = "ফাইল ৫০ MB-এর বেশি। ছোট ফাইল নির্বাচন করুন।";
      return;
    }
    const allowed = ["image/jpeg","image/png","image/webp","image/gif","video/mp4","video/webm","video/quicktime"];
    if (!allowed.includes(file.type)) {
      $("uploadMessage").textContent = "এই ফাইলের ধরন অনুমোদিত নয়। JPG, PNG, WEBP, GIF, MP4, WEBM বা MOV ব্যবহার করুন।";
      return;
    }

    const submit = $("uploadForm").querySelector('button[type="submit"]');
    submit.disabled = true;
    $("uploadMessage").textContent = "ফাইলের SHA-256 তৈরি ও আপলোড হচ্ছে...";
    let uploadedPath = null;

    try {
      const { data: { user }, error: userError } = await db.auth.getUser();
      if (userError || !user) throw new Error("আপনার লগইন সেশন পাওয়া যায়নি। আবার লগইন করুন।");

      const hash = await sha256(file);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
      const path = `${user.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await db.storage.from("originalvault-media")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;
      uploadedPath = path;

      const { data: { publicUrl } } = db.storage.from("originalvault-media").getPublicUrl(path);
      const row = {
        title: $("title").value.trim(),
        description: $("description").value.trim() || null,
        creator: $("creator").value.trim(),
        published_at: $("publishedAt").value || null,
        source_url: $("sourceUrl").value.trim() || null,
        file_path: path,
        public_url: publicUrl,
        media_type: file.type.startsWith("video/") ? "video" : "image",
        sha256: hash,
        owner_id: user.id
      };

      const { error: insertError } = await db.from("media_records").insert(row);
      if (insertError) throw insertError;

      $("uploadMessage").textContent = "সফলভাবে আপলোড হয়েছে এবং আর্কাইভে যোগ হয়েছে। SHA-256: " + hash;
      $("uploadForm").reset();
      await loadGallery();
    } catch (error) {
      $("uploadMessage").textContent = "সমস্যা হয়েছে: " + (error.message || "অজানা ত্রুটি");
      if (uploadedPath) {
        $("uploadMessage").textContent += " ফাইল স্টোরেজে উঠেছে, কিন্তু তথ্য সেভ হয়নি। একই ফাইল আবার আপলোডের আগে অ্যাডমিনের সহায়তা নিন।";
      }
    } finally {
      submit.disabled = false;
    }
  });

  db.auth.onAuthStateChange(() => { refreshAuth(); });
  refreshAuth();
  loadGallery();
})();