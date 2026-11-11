(() => {
  "use strict";
  const root = document.getElementById("record");
  const cfg = window.OV_CONFIG || {};
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const rawId = new URLSearchParams(location.search).get("id");
  const id = rawId && /^\\d+$/.test(rawId) ? Number(rawId) : rawId;
  document.getElementById("year").textContent = new Date().getFullYear();
  if (!id || !id.trim()) { root.textContent = "A valid content ID was not provided."; return; }
  if (!window.supabase || !cfg.url || !cfg.anonKey) { root.textContent = "Could not connect to the archive."; return; }
  const db = window.supabase.createClient(cfg.url, cfg.anonKey);
  const formatPublicationDate = value => {
    if (!value) return "Date not provided";
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return String(value);
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(date);
  };
  const safeMedia = value => {
    try { const u = new URL(value), base = new URL(cfg.url); return u.protocol === "https:" && u.origin === base.origin && u.pathname.startsWith("/storage/v1/object/public/originalvault-media/") ? u.href : ""; }
    catch (_) { return ""; }
  };
  db.from("media_records").select("id,title,description,creator,published_at,source_url,public_url,media_type,sha256").eq("id",id).maybeSingle().then(({data,error}) => {
    if (error) { console.error("Content record lookup failed:", error); root.textContent = "Could not load content details. Please check the database permissions or content ID."; return; }
    if (!data) { root.textContent = "No content was found for this ID."; return; }
    const mediaUrl = safeMedia(data.public_url);
    const isVideo = data.media_type === "video";
    const media = mediaUrl ? (isVideo ? `<video controls preload="metadata" src="${esc(mediaUrl)}" style="width:100%;max-height:70vh"></video>` : `<img src="${esc(mediaUrl)}" alt="${esc(data.title)}" style="width:100%;height:auto;border-radius:12px">`) : "";
    let source = "";
    try { const u = new URL(data.source_url); if (["http:","https:"].includes(u.protocol)) source = `<p><a href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">View Original Post</a></p>`; } catch (_) {}
    root.innerHTML = `${media}<span class="tag">${isVideo ? "Video" : "Image"}</span><h2>${esc(data.title)}</h2><p>${esc(data.description || "No description provided")}</p><p><strong>Creator / Copyright Owner:</strong> ${esc(data.creator || "—")}</p><p><strong>Original Publication Date:</strong> ${esc(formatPublicationDate(data.published_at))}</p>${source}<p><strong>SHA-256:</strong></p><code style="overflow-wrap:anywhere">${esc(data.sha256 || "Not available")}</code><p><a class="button secondary" href="index.html">Back to Original Vault Archive</a></p>`;
    document.title = (data.title || "Content Details") + " | Original Vault";
  }).catch(() => { root.textContent = "Unable to load details. Please try again later."; });
})();