(() => {
"use strict";
const $=id=>document.getElementById(id);
$("year").textContent=new Date().getFullYear();
const cfg=window.OV_CONFIG||{};
const valid=typeof cfg.url==="string"&&typeof cfg.anonKey==="string"&&/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cfg.url)&&cfg.anonKey.length>20;
if(!valid||!window.supabase?.createClient){$("adminStatus").textContent="Supabase সংযোগের সেটিংস পাওয়া যায়নি। config.js পরীক্ষা করুন।";$("adminLogin").hidden=true;return;}
const db=window.supabase.createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const say=(id,msg)=>$(id).textContent=msg;
const escapeHtml=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function safeSource(v){if(!v)return "";try{const u=new URL(v);return ["https:","http:"].includes(u.protocol)?u.href:"";}catch{return "";}}
async function refresh(){
 const {data,error}=await db.auth.getSession();if(error){say("adminStatus","সেশন যাচাই করা যায়নি। আবার লগইন করুন।");return;}
 const session=data.session;
 $("adminLogin").hidden=!!session;$("adminWorkspace").hidden=!session;
 say("adminStatus",session?"আপনি অ্যাডমিন হিসেবে লগইন করেছেন।":"অ্যাডমিন ইমেইল ও পাসওয়ার্ড দিয়ে লগইন করুন।");
 if(session){const {data:{user}}=await db.auth.getUser();say("signedInAs",user?.email||"");await loadRecords();await loadManualViews();}
}
$("adminLogin").addEventListener("submit",async e=>{
 e.preventDefault();const b=$("adminLogin").querySelector("button");b.disabled=true;say("loginMessage","লগইন যাচাই হচ্ছে...");
 try{const {error}=await db.auth.signInWithPassword({email:$("adminEmail").value.trim(),password:$("adminPassword").value});if(error)throw error;$("adminPassword").value="";say("loginMessage","লগইন সফল।");await refresh();}
 catch(err){console.error("Admin login error",err);say("loginMessage","লগইন হয়নি। ইমেইল/পাসওয়ার্ড সঠিক কি না এবং Supabase Auth-এ অ্যাকাউন্টটি সক্রিয় কি না পরীক্ষা করুন।");}
 finally{b.disabled=false;}
});
$("adminLogout").addEventListener("click",async()=>{const b=$("adminLogout");b.disabled=true;try{const {error}=await db.auth.signOut();if(error)throw error;await refresh();}catch(err){console.error(err);say("adminStatus","লগআউট করা যায়নি। আবার চেষ্টা করুন।");}finally{b.disabled=false;}});
async function digest(file){if(!window.crypto?.subtle)throw new Error("SHA-256 সমর্থিত নিরাপদ ব্রাউজার প্রয়োজন।");const buf=await window.crypto.subtle.digest("SHA-256",await file.arrayBuffer());return [...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,"0")).join("");}
$("adminUpload").addEventListener("submit",async e=>{
 e.preventDefault();const file=$("mediaFile").files[0];if(!file)return;
 if(file.size===0||file.size>50*1024*1024){say("uploadMessage","ফাইল খালি অথবা ৫০ MB-এর বেশি।");return;}
 const allowed=["image/jpeg","image/png","image/webp","image/gif","video/mp4","video/webm","video/quicktime"];
 if(!allowed.includes(file.type)){say("uploadMessage","এই ফাইলের ধরন অনুমোদিত নয়।");return;}
 const title=$("mediaTitle").value.trim(),creator=$("mediaCreator").value.trim(),source=$("mediaSource").value.trim();
 if(!title||!creator|| (source&&!safeSource(source))){say("uploadMessage","শিরোনাম, স্রষ্টার নাম এবং সঠিক লিংক পরীক্ষা করুন।");return;}
 const b=$("adminUpload").querySelector("button");b.disabled=true;say("uploadMessage","ফাইল যাচাই ও আপলোড হচ্ছে...");
 let path=null,uploadedToStorage=false;
 try{
  const {data:{user},error:userErr}=await db.auth.getUser();if(userErr||!user)throw new Error("সেশন শেষ হয়েছে। আবার লগইন করুন।");
  const hash=await digest(file),name=file.name.replace(/[^a-zA-Z0-9._-]/g,"_").slice(-100)||"media-file";
  path=user.id+"/"+Date.now()+"-"+name;
  const {error:upErr}=await db.storage.from("originalvault-media").upload(path,file,{upsert:false,contentType:file.type,cacheControl:"3600"});if(upErr)throw upErr;
  uploadedToStorage=true;
  const {data:{publicUrl}}=db.storage.from("originalvault-media").getPublicUrl(path);
  const {error:dbErr}=await db.from("media_records").insert({title,description:$("mediaDescription").value.trim()||null,creator,published_at:$("mediaPublished").value||null,source_url:source||null,file_path:path,public_url:publicUrl,media_type:file.type.startsWith("video/")?"video":"image",sha256:hash,owner_id:user.id});
  if(dbErr)throw dbErr;
  say("uploadMessage","সফলভাবে আপলোড হয়েছে। SHA-256: "+hash);$("adminUpload").reset();await loadRecords();
 }catch(err){console.error("Upload failed",err);say("uploadMessage",uploadedToStorage?"ফাইল Storage-এ উঠেছে, কিন্তু ডেটাবেসে রেকর্ড হয়নি: "+(err.message||"অজানা ডেটাবেস ত্রুটি")+"। একই ফাইল আবার আপলোড করবেন না।":(err.message||"আপলোড ব্যর্থ হয়েছে।"));}finally{b.disabled=false;}
});
async function loadManualViews(){
 try{const {data,error}=await db.from("site_settings").select("manual_view_count").eq("id",1).maybeSingle();if(error)throw error;const n=Number(data?.manual_view_count??0);$("manualViewsInput").value=Number.isSafeInteger(n)&&n>=0?n:0;say("manualViewsMessage","বর্তমান প্রদর্শিত সংখ্যা: "+$("manualViewsInput").value);}
 catch(err){console.error("Manual views read failed",err);say("manualViewsMessage","ভিউ কাউন্টার টেবিল পাওয়া যায়নি। supabase/manual-view-counter.sql ফাইলের SQL একবার Supabase SQL Editor-এ চালান।");}
}
$("manualViewsForm").addEventListener("submit",async e=>{
 e.preventDefault();const raw=$("manualViewsInput").value.trim(),n=Number(raw),b=$("manualViewsForm").querySelector("button");
 if(!/^\d+$/.test(raw)||!Number.isSafeInteger(n)||n<0){say("manualViewsMessage","০ বা তার বেশি একটি পূর্ণসংখ্যা লিখুন।");return;}
 b.disabled=true;say("manualViewsMessage","সংখ্যা সংরক্ষণ হচ্ছে...");
 try{const {error}=await db.from("site_settings").upsert({id:1,manual_view_count:n},{onConflict:"id"});if(error)throw error;say("manualViewsMessage","সফলভাবে আপডেট হয়েছে। হোমপেজে নতুন সংখ্যা দেখা যাবে।");}
 catch(err){console.error("Manual views save failed",err);say("manualViewsMessage","সংরক্ষণ হয়নি। Supabase SQL migration ও RLS policy পরীক্ষা করুন।");}
 finally{b.disabled=false;}
});
async function loadRecords(){
 const box=$("adminRecords");box.textContent="তথ্য লোড হচ্ছে...";
 try{const {data,error}=await db.from("media_records").select("id,title,creator,media_type,published_at,sha256").order("published_at",{ascending:false,nullsFirst:false}).limit(100);if(error)throw error;
 if(!data?.length){box.textContent="এখনো কোনো কনটেন্ট সংরক্ষণ করা হয়নি।";return;}
 box.innerHTML=data.map(x=>'<article class="admin-record"><div><b>'+escapeHtml(x.title)+'</b><p class="small">'+escapeHtml(x.creator||"")+' · '+(x.media_type==="video"?"ভিডিও":"ছবি")+' · '+escapeHtml(x.published_at?(()=>{const [y,m,d]=x.published_at.split("-").map(Number);return new Date(y,m-1,d).toLocaleDateString("bn-BD")})():"তারিখ নেই")+'</p><code>'+escapeHtml(x.sha256||"")+'</code></div></article>').join("");
 }catch(err){console.error("Record list error",err);box.textContent="তালিকা লোড করা যায়নি। Supabase RLS policy ও media_records টেবিল পরীক্ষা প্রয়োজন।";}
}
db.auth.onAuthStateChange(()=>{setTimeout(()=>{void refresh();},0);});void refresh();
})();