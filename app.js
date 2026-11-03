const news = [
 {tag:"সংবাদ",title:"আপনার প্রথম অরিজিনাল ছবি এখানে যোগ করুন",desc:"এখানে আপনার ছবির বিবরণ, স্রষ্টার নাম ও প্রথম প্রকাশের তথ্য যোগ করুন।",date:"নমুনা"},
 {tag:"প্রতিবেদন",title:"ছবির আর্কাইভ",desc:"ছবির মূল ফাইল ও প্রকাশের তারিখের তথ্য রাখুন।",date:"নমুনা"},
 {tag:"আপডেট",title:"নিজস্ব ফটো সংগ্রহ",desc:"আপনার নিজস্ব ছবির সংগ্রহ এখানে দেখানো যাবে।",date:"নমুনা"}
];
const videos = [
 {tag:"ভিডিও",title:"আপনার প্রথম অরিজিনাল ভিডিও",desc:"ভিডিওর বিবরণ, স্রষ্টার নাম ও প্রথম প্রকাশের লিংক যোগ করুন।",date:"প্রকাশের তারিখ যোগ করুন"},
 {tag:"ভিডিও",title:"ভিডিও সংগ্রহ",desc:"প্রতিটি ভিডিওর বিবরণ ও মালিকানার রেকর্ড গুছিয়ে রাখা যাবে।",date:"প্রকাশের তারিখ যোগ করুন"}
];
function render(items,id){document.getElementById(id).innerHTML=items.map(x=>`<article class="card"><span class="tag">${x.tag}</span><h3>${x.title}</h3><p>${x.desc}</p><div class="meta">${x.date}</div></article>`).join('')}
render(news,'newsGrid');render(videos,'videoGrid');document.getElementById('year').textContent=new Date().getFullYear();
