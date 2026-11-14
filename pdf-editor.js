(() => {
"use strict";
const $=id=>document.getElementById(id);
const status=$("pdfStatus"), workspace=$("pdfWorkspace");
let sourceBytes=null,pdfDoc=null,pdfJsDoc=null,currentPage=1,totalPages=0,customFontBytes=null,renderScale=1;
if(window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
$("year").textContent=new Date().getFullYear();
function say(s){status.textContent=s}
function hexRgb(hex){return {r:parseInt(hex.slice(1,3),16)/255,g:parseInt(hex.slice(3,5),16)/255,b:parseInt(hex.slice(5,7),16)/255}}
function selectedRect(){
 const sel=window.getSelection(); if(!sel||sel.isCollapsed||!sel.rangeCount)return null;
 const range=sel.getRangeAt(0),node=range.commonAncestorContainer;
 const pageEl=(node.nodeType===1?node:node.parentElement)?.closest(".pdf-page");
 if(!pageEl)return null;
 const rects=[...range.getClientRects()].filter(r=>r.width>0&&r.height>0);
 if(!rects.length)return null;
 const bounds=rects.reduce((a,r)=>({left:Math.min(a.left,r.left),top:Math.min(a.top,r.top),right:Math.max(a.right,r.right),bottom:Math.max(a.bottom,r.bottom)}),{left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity});
 const canvas=pageEl.querySelector("canvas"),box=canvas.getBoundingClientRect();
 return {page:Number(pageEl.dataset.page),left:bounds.left-box.left,top:bounds.top-box.top,right:bounds.right-box.left,bottom:bounds.bottom-box.top,width:box.width,height:box.height};
}
async function renderPage(n){
 if(!pdfJsDoc)return;
 currentPage=Math.max(1,Math.min(totalPages,n));$("pageNumber").value=currentPage;
 const page=await pdfJsDoc.getPage(currentPage),viewport=page.getViewport({scale:1.35});
 const wrapper=document.createElement("div");wrapper.className="pdf-page";wrapper.dataset.page=currentPage;wrapper.style.width=viewport.width+"px";wrapper.style.height=viewport.height+"px";
 const canvas=document.createElement("canvas"),ctx=canvas.getContext("2d");canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);canvas.style.width=viewport.width+"px";canvas.style.height=viewport.height+"px";wrapper.appendChild(canvas);
 const layer=document.createElement("div");layer.className="pdf-text-layer";layer.style.width=viewport.width+"px";layer.style.height=viewport.height+"px";wrapper.appendChild(layer);
 workspace.replaceChildren(wrapper);
 await page.render({canvasContext:ctx,viewport}).promise;
 const content=await page.getTextContent();
 layer.addEventListener("click",e=>{const target=e.target.closest("span");if(!target)return;const range=document.createRange();range.selectNodeContents(target);const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);setTimeout(showSelectionPaste,50);const editor=$("replacementText");editor.focus({preventScroll:true});say("লেখাটি সিলেক্ট হয়েছে। নিচে Paste বাটন দেখুন।");});
 for(const item of content.items){
  if(!item.str||!item.transform)continue;
  const tx=pdfjsLib.Util.transform(viewport.transform,item.transform),fontHeight=Math.hypot(tx[2],tx[3]);
  const span=document.createElement("span");span.textContent=item.str;span.style.left=tx[4]+"px";span.style.top=(tx[5]-fontHeight)+"px";span.style.fontSize=fontHeight+"px";span.style.fontFamily="sans-serif";span.style.height=(fontHeight*1.2)+"px";span.style.width=Math.max(1,item.width*viewport.scale)+"px";layer.appendChild(span);
 }
 $("prevPage").disabled=currentPage<=1;$("nextPage").disabled=currentPage>=totalPages;
 $("replaceText").disabled=false;say("পৃষ্ঠা "+currentPage+" / "+totalPages+" — লেখার ওপর টেনে সিলেক্ট করুন।");
}

// Show an editor-owned Paste button beside selected PDF text.
// Android/Chrome's native selection menu itself cannot be modified by a webpage.
const selectionMenu=$("pdfSelectionMenu"),pasteButton=$("pdfPasteButton");
function showSelectionPaste(){
 const sel=window.getSelection();
 if(!sel||sel.isCollapsed||!sel.rangeCount)return;
 const range=sel.getRangeAt(0),node=range.commonAncestorContainer;
 const layer=(node.nodeType===1?node:node.parentElement)?.closest(".pdf-text-layer");
 if(!layer)return;
 selectionMenu.style.display="block";
 selectionMenu.style.left="50%";
 selectionMenu.style.top="auto";
 selectionMenu.style.bottom="18px";
 selectionMenu.style.transform="translateX(-50%)";
 selectionMenu.style.position="fixed";
}
document.addEventListener("selectionchange",()=>setTimeout(showSelectionPaste,80));
document.addEventListener("scroll",()=>{selectionMenu.style.display="none";},true);
pasteButton.addEventListener("pointerdown",e=>e.preventDefault());
pasteButton.addEventListener("click",async()=>{
 try{
  let pasted="";
  if(navigator.clipboard&&navigator.clipboard.readText){pasted=await navigator.clipboard.readText();}
  if(!pasted){say("ক্লিপবোর্ডে লেখা পাওয়া যায়নি। আগে লেখা Copy করুন, তারপর আবার Paste চাপুন।");return;}
  $("replacementText").value=pasted;
  selectionMenu.style.display="none";
  $("replaceText").click();
 }catch(err){
  say("ব্রাউজার ক্লিপবোর্ড পড়ার অনুমতি দেয়নি। Chrome-এর অনুমতি দিন, তারপর Paste চাপুন।");
 }
});
$("pdfFile").addEventListener("change",async e=>{
 const file=e.target.files?.[0];if(!file)return;
 if(file.type!=="application/pdf"&&!file.name.toLowerCase().endsWith(".pdf")){say("অনুগ্রহ করে PDF ফাইল নির্বাচন করুন।");return}
 try{
  say("PDF খোলা হচ্ছে…");sourceBytes=await file.arrayBuffer();
  pdfJsDoc=await pdfjsLib.getDocument({data:sourceBytes.slice(0)}).promise;
  pdfDoc=await PDFLib.PDFDocument.load(sourceBytes.slice(0),{ignoreEncryption:false});
  totalPages=pdfJsDoc.numPages;currentPage=1;
  $("pageNumber").disabled=false;$("pageNumber").max=totalPages;$("downloadPdf").disabled=false;
  await renderPage(1);
 }catch(err){console.error(err);say("PDF খোলা যায়নি। পাসওয়ার্ড-সুরক্ষিত বা ক্ষতিগ্রস্ত PDF হলে কাজ নাও করতে পারে। "+(err.message||""))}
});
$("prevPage").addEventListener("click",()=>renderPage(currentPage-1));
$("nextPage").addEventListener("click",()=>renderPage(currentPage+1));
$("pageNumber").addEventListener("change",()=>renderPage(Number($("pageNumber").value)||1));
$("customFont").addEventListener("change",async e=>{const f=e.target.files?.[0];customFontBytes=f?await f.arrayBuffer():null;say(f?"কাস্টম ফন্ট লোড হয়েছে: "+f.name:"কাস্টম ফন্ট সরানো হয়েছে।")});
$("replaceText").addEventListener("click",async()=>{
 try{
  const rect=selectedRect(),text=$("replacementText").value;
  if(!rect){say("প্রথমে PDF-এর লেখার অংশ সিলেক্ট করুন।");return}
  if(!text.trim()){say("নতুন লেখা লিখুন।");return}
  const page=pdfDoc.getPage(rect.page-1),{width:pw,height:ph}=page.getSize();
  const sx=pw/rect.width,sy=ph/rect.height;
  const x=rect.left*sx,y=ph-rect.bottom*sy,w=rect.width*sx,h=rect.height*sy;
  let font;
  if(customFontBytes){
   pdfDoc.registerFontkit(fontkit);font=await pdfDoc.embedFont(customFontBytes,{subset:true});
  }else{
   const map={Helvetica:PDFLib.StandardFonts.Helvetica,TimesRoman:PDFLib.StandardFonts.TimesRoman,Courier:PDFLib.StandardFonts.Courier};
   font=await pdfDoc.embedFont(map[$("fontChoice").value]||PDFLib.StandardFonts.Helvetica);
  }
  const size=Math.min(96,Math.max(5,Number($("fontSize").value)||12));
  page.drawRectangle({x:x-1,y:y-1,width:w+2,height:h+2,color:PDFLib.rgb(1,1,1),borderWidth:0});
  const color=hexRgb($("fontColor").value);
  const lines=text.split(/\r?\n/);let lineY=y+Math.max(0,(h-size)/2);
  for(const line of lines){page.drawText(line,{x:x+1,y:lineY,size,font,color:PDFLib.rgb(color.r,color.g,color.b),maxWidth:Math.max(w,20),lineHeight:size*1.2});lineY-=size*1.2;}
  const bytes=await pdfDoc.save();sourceBytes=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
  pdfJsDoc=await pdfjsLib.getDocument({data:sourceBytes.slice(0)}).promise;window.getSelection()?.removeAllRanges();
  await renderPage(rect.page);say("নতুন লেখা বসানো হয়েছে। ফলাফল ঠিক আছে কি না দেখে PDF ডাউনলোড করুন।");
 }catch(err){console.error(err);say("লেখা বসানো যায়নি: "+(err.message||"অজানা সমস্যা"))}
});
$("downloadPdf").addEventListener("click",()=>{
 if(!pdfDoc)return;
 pdfDoc.save().then(bytes=>{const blob=new Blob([bytes],{type:"application/pdf"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="originalvault-edited.pdf";a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);say("এডিট করা PDF ডাউনলোড শুরু হয়েছে।")}).catch(err=>say("ডাউনলোড করা যায়নি: "+err.message));
});
})();