(() => {
"use strict";
const $=id=>document.getElementById(id);
const status=$("pdfStatus"),workspace=$("pdfWorkspace");
let pdfDoc=null,pdfJsDoc=null,pageNo=1,total=0,selected=null,customFont=null,viewports=new Map();
if(window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
$("year").textContent=new Date().getFullYear();
function say(s){status.textContent=s}
function measure(range){
 const el=(range.commonAncestorContainer.nodeType===1?range.commonAncestorContainer:range.commonAncestorContainer.parentElement)?.closest(".pdf-page");
 if(!el)return null;
 const canvas=el.querySelector("canvas"),box=canvas.getBoundingClientRect();
 const rs=[...range.getClientRects()].filter(r=>r.width>0&&r.height>0);
 if(!rs.length)return null;
 const b=rs.reduce((a,r)=>({l:Math.min(a.l,r.left),t:Math.min(a.t,r.top),r:Math.max(a.r,r.right),b:Math.max(a.b,r.bottom)}),{l:Infinity,t:Infinity,r:-Infinity,b:-Infinity});
 return {page:+el.dataset.page,left:b.l-box.left,top:b.t-box.top,right:b.r-box.left,bottom:b.b-box.top,canvasWidth:box.width,canvasHeight:box.height,width:b.r-b.l,height:b.b-b.t};
}
function currentSelection(){
 const s=window.getSelection();
 if(s&&!s.isCollapsed&&s.rangeCount){const r=measure(s.getRangeAt(0));if(r)selected=r;}
 return selected;
}
async function renderPage(n){
 if(!pdfJsDoc)return;
 pageNo=Math.max(1,Math.min(total,n));$("pageNumber").value=pageNo;
 const page=await pdfJsDoc.getPage(pageNo),vp=page.getViewport({scale:1.4});
 viewports.set(pageNo,vp);
 const wrap=document.createElement("div");wrap.className="pdf-page";wrap.dataset.page=pageNo;wrap.style.width=vp.width+"px";wrap.style.height=vp.height+"px";
 const canvas=document.createElement("canvas");canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);canvas.style.width=vp.width+"px";canvas.style.height=vp.height+"px";wrap.appendChild(canvas);
 const layer=document.createElement("div");layer.className="pdf-text-layer";layer.style.width=vp.width+"px";layer.style.height=vp.height+"px";wrap.appendChild(layer);
 workspace.replaceChildren(wrap);
 await page.render({canvasContext:canvas.getContext("2d"),viewport:vp}).promise;
 const content=await page.getTextContent();
 for(const item of content.items){
  if(!item.str||!item.transform)continue;
  const tx=pdfjsLib.Util.transform(vp.transform,item.transform),height=Math.hypot(tx[2],tx[3]);
  const span=document.createElement("span");span.textContent=item.str;
  Object.assign(span.style,{left:tx[4]+"px",top:(tx[5]-height)+"px",fontSize:height+"px",height:(height*1.25)+"px",width:Math.max(1,item.width*vp.scale)+"px",fontFamily:"sans-serif"});
  layer.appendChild(span);
 }
 layer.addEventListener("click",e=>{
  const span=e.target.closest("span");if(!span)return;
  const range=document.createRange();range.selectNodeContents(span);
  const s=window.getSelection();s.removeAllRanges();s.addRange(range);
  selected=measure(range);say("লেখা নির্বাচন হয়েছে। নতুন লেখা লিখে ‘নির্বাচিত লেখা বদলান’ চাপুন।");
  showPaste();
 });
 $("prevPage").disabled=pageNo===1;$("nextPage").disabled=pageNo===total;
 $("replaceText").disabled=false;
}
const menu=$("pdfSelectionMenu"),paste=$("pdfPasteButton");
function showPaste(){if(!selected)return;menu.style.display="block";menu.style.left="50%";menu.style.top="auto";menu.style.bottom="18px";menu.style.transform="translateX(-50%)";}
document.addEventListener("selectionchange",()=>{const r=currentSelection();if(r)showPaste();});
paste.addEventListener("pointerdown",e=>e.preventDefault());
paste.addEventListener("click",async()=>{
 try{const t=await navigator.clipboard.readText();if(!t){say("ক্লিপবোর্ডে কোনো লেখা নেই।");return;}$("replacementText").value=t;menu.style.display="none";}
 catch(e){say("ক্লিপবোর্ড অনুমতি পাওয়া যায়নি। নতুন লেখা বক্সে ট্যাপ করে Paste করুন।");}
});
$("pdfFile").addEventListener("change",async e=>{
 const f=e.target.files?.[0];if(!f)return;
 try{
  say("PDF খোলা হচ্ছে…");const bytes=await f.arrayBuffer();
  pdfJsDoc=await pdfjsLib.getDocument({data:bytes.slice(0)}).promise;
  pdfDoc=await PDFLib.PDFDocument.load(bytes.slice(0));
  total=pdfJsDoc.numPages;selected=null;viewports.clear();
  $("pageNumber").disabled=false;$("pageNumber").max=total;$("downloadPdf").disabled=false;
  await renderPage(1);say("PDF প্রস্তুত। যে লেখাটি বদলাতে চান সেটিতে ট্যাপ করুন।");
 }catch(err){console.error(err);say("PDF খোলা যায়নি: "+err.message);}
});
$("prevPage").addEventListener("click",()=>renderPage(pageNo-1));
$("nextPage").addEventListener("click",()=>renderPage(pageNo+1));
$("pageNumber").addEventListener("change",()=>renderPage(+$("pageNumber").value||1));
$("customFont").addEventListener("change",async e=>{const f=e.target.files?.[0];customFont=f?await f.arrayBuffer():null;say(f?"কাস্টম ফন্ট লোড হয়েছে।":"কাস্টম ফন্ট সরানো হয়েছে।");});
$("replaceText").addEventListener("click",async()=>{
 try{
  const r=currentSelection();if(!r){say("প্রথমে PDF-এর একটি লেখা নির্বাচন করুন।");return;}
  const text=$("replacementText").value;if(!text.trim()){say("নতুন লেখা লিখুন।");return;}
  const page=pdfDoc.getPage(r.page-1),vp=viewports.get(r.page);
  const sx=vp.width/r.canvasWidth,sy=vp.height/r.canvasHeight;
  const p1=vp.convertToPdfPoint(r.left*sx,r.bottom*sy),p2=vp.convertToPdfPoint(r.right*sx,r.top*sy);
  const x=Math.min(p1[0],p2[0]),y=Math.min(p1[1],p2[1]),w=Math.abs(p2[0]-p1[0]),h=Math.abs(p2[1]-p1[1]);
  let font;
  if(customFont){pdfDoc.registerFontkit(fontkit);font=await pdfDoc.embedFont(customFont,{subset:true});}
  else{
   const choice=$("fontChoice").value;
   const std={Helvetica:PDFLib.StandardFonts.Helvetica,TimesRoman:PDFLib.StandardFonts.TimesRoman,Courier:PDFLib.StandardFonts.Courier};
   font=await pdfDoc.embedFont(std[choice]||PDFLib.StandardFonts.Helvetica);
  }
  const size=Math.max(4,Math.min(96,h*.82));
  page.drawRectangle({x:x-0.5,y:y-0.5,width:Math.max(w,1)+1,height:Math.max(h,1)+1,color:PDFLib.rgb(1,1,1),borderWidth:0});
  const color=$("fontColor").value;
  const rgb=PDFLib.rgb(parseInt(color.slice(1,3),16)/255,parseInt(color.slice(3,5),16)/255,parseInt(color.slice(5,7),16)/255);
  const lines=text.split(/\r?\n/);let yy=y+(h-size)/2;
  for(const line of lines){page.drawText(line,{x:x+1,y:yy,size,font,color:rgb,maxWidth:Math.max(w,2),lineHeight:size*1.15});yy-=size*1.15;}
  selected=null;menu.style.display="none";window.getSelection().removeAllRanges();
  const out=await pdfDoc.save();pdfJsDoc=await pdfjsLib.getDocument({data:out.slice(0)}).promise;viewports.clear();
  await renderPage(r.page);say("পরিবর্তন বসানো হয়েছে। PDF ডাউনলোডের আগে ফলাফল দেখে নিন।");
 }catch(err){console.error(err);say("সম্পাদনা করা যায়নি: "+err.message);}
});
$("downloadPdf").addEventListener("click",async()=>{
 try{const bytes=await pdfDoc.save(),blob=new Blob([bytes],{type:"application/pdf"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="originalvault-edited.pdf";a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);say("PDF ডাউনলোড শুরু হয়েছে।");}
 catch(err){say("ডাউনলোড ব্যর্থ: "+err.message);}
});
})();
