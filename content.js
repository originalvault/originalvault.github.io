(() => {
  "use strict";
  const root = document.getElementById("record");
  const cfg = window.OV_CONFIG || {};
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const rawId = new URLSearchParams(location.search).get("id");
  const id = rawId && /^\\d+$/.test(rawId) ? Number(rawId) : rawId;
  document.getElementById("year").textContent = new Date().getFullYear();
  if (!id || !id.trim()) { root.textContent = "সঠিক কনটেন্ট আইডি পাওয়া যায়নি।"; return; }
  if (!window.supabase || !cfg.url || !cfg.anonKey) { root.textContent = "আর্কাইভে সংযোগ করা যায়নি।"; return; }
  const db = window.supabase.createClient(cfg.url, cfg.anonKey);
  const safeMedia = value => {
    try { const u = new URL(value), base = new URL(cfg.url); return u.protocol === "https:" && u.origin === base.origin && u.pathname.startsWith("/storage/v1/object/public/originalvault-media/") ? u.href : ""; }
    catch (_) { return ""; }
  };
  db.from("media_records").select("id,title,description,creator,published_at,source_url,public_url,media_type,sha256").eq("id",id).maybeSingle().then(({data,error}) => {
    if (error) { console.error("Content record lookup failed:", error); root.textContent = "কনটেন্টের তথ্য লোড করা যায়নি। ডেটাবেসের অনুমতি বা আইডি যাচাই প্রয়োজন।"; return; }
    if (!data) { root.textContent = "এই আইডির কোনো কনটেন্ট পাওয়া যায়নি।"; return; }
    const mediaUrl = safeMedia(data.public_url);
    const isVideo = data.media_type === "video";
    const media = mediaUrl ? (isVideo ? `<video controls preload="metadata" src="${esc(mediaUrl)}" style="width:100%;max-height:70vh"></video>` : `<img src="${esc(mediaUrl)}" alt="${esc(data.title)}" style="width:100%;height:auto;border-radius:12px">`) : "";
    let source = "";
    try { const u = new URL(data.source_url); if (["http:","https:"].includes(u.protocol)) source = `<p><a href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">মূল পোস্ট দেখুন</a></p>`; } catch (_) {}
    root.innerHTML = `${media}<span class="tag">${isVideo ? "ভিডিও" : "ছবি"}</span><h2>${esc(data.title)}</h2><p>${esc(data.description || "বিবরণ দেওয়া হয়নি")}</p><p><strong>স্রষ্টা / স্বত্বাধিকারী:</strong> ${esc(data.creator || "—")}</p><p><strong>প্রথম প্রকাশের তারিখ:</strong> ${esc(data.published_at || "তারিখ দেওয়া হয়নি")}</p>${source}<p><strong>SHA-256:</strong></p><code style="overflow-wrap:anywhere">${esc(data.sha256 || "সংরক্ষিত নেই")}</code><p><a class="button secondary" href="index.html">Original Vault আর্কাইভে ফিরে যান</a></p>`;
    document.title = (data.title || "কনটেন্টের বিবরণ") + " | Original Vault";
  }).catch(() => { root.textContent = "তথ্য লোড করা যায়নি। পরে আবার চেষ্টা করুন।"; });
})();