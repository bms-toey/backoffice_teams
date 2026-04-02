import { getFirestore, deleteDoc, writeBatch, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
const db = getFirestore();
const { esc, fd, fc, fca, pd, gS, gT, gG, gSt, gC, avC, uid, getFY, getYearBE, getStaffOverlaps, overlapWarnText, getStaffLeaveConflicts, getColRef, getDocRef } = window;
// ── DELETE ──
window.askDel=function(type,id,label){window.delTarget={type:type,id:id};document.getElementById('del-label').textContent=label;window.openM('m-del');}
window.execDelete=async function(){
  if(!window.delTarget)return;if(!window.auth.currentUser)return;
  var t=window.delTarget.type,id=window.delTarget.id;
  if(t==='lodging'){if(!window.cl())return;}else if(['staff','type','position','group','user','stage'].includes(t)){if(!window.isAdmin())return;}else{if(!window.ce())return;}
  var sheetMap={project:'PROJECTS',advance:'ADVANCES',staff:'STAFF',type:'PTYPES',user:'USERS',position:'POSITIONS',group:'PGROUPS',lodging:'LODGINGS',stage:'STAGES'};
  if(t==='project'){window.PROJECTS=window.PROJECTS.filter(x=>x.id!==id);window.ADVANCES.filter(x=>x.pid===id).forEach(a=>deleteDoc(getDocRef('ADVANCES',a.id)));window.LODGINGS.filter(x=>x.pid===id).forEach(l=>deleteDoc(getDocRef('LODGINGS',l.id)));}
  else if(t==='advance')window.ADVANCES=window.ADVANCES.filter(x=>x.id!==id);
  else if(t==='lodging')window.LODGINGS=window.LODGINGS.filter(x=>x.id!==id);
  else if(t==='staff')window.STAFF=window.STAFF.filter(x=>x.id!==id);
  else if(t==='type')window.PTYPES=window.PTYPES.filter(x=>x.id!==id);
  else if(t==='user')window.USERS=window.USERS.filter(x=>x.id!==id);
  else if(t==='position')window.POSITIONS=window.POSITIONS.filter(x=>x.id!==id);
  else if(t==='group')window.PGROUPS=window.PGROUPS.filter(x=>x.id!==id);
  else if(t==='stage')window.STAGES=window.STAGES.filter(x=>x.id!==id);
  window.closeM('m-del');window.delTarget=null;window.renderAll();
  if(['staff','type','user','position','group','stage'].includes(t))window.admTab(t+'s');
  if(t==='lodging'&&window.currentLdPid)window.openLodgingGroupModal(window.currentLdPid);
  deleteDoc(getDocRef(sheetMap[t],id)).catch(e=>window.showDbError(e));
}

// ── IMPORT ──
window.updateImportPreview=function(){const type=document.getElementById('import-type').value;const schema=window.IMPORT_SCHEMAS[type];if(schema)document.getElementById('import-format-preview').textContent=schema.headers.join(', ');}
window.openImportModal=function(){document.getElementById('import-file').value='';document.getElementById('import-msg').innerHTML='รองรับเฉพาะไฟล์ .csv เท่านั้น';document.getElementById('import-type').value='PROJECTS';window.updateImportPreview();window.openM('m-import');}
window.downloadTemplate=function(){const type=document.getElementById('import-type').value;const schema=window.IMPORT_SCHEMAS[type];if(!schema)return;const csvContent="data:text/csv;charset=utf-8,\uFEFF"+schema.headers.join(",")+"\n"+schema.example.join(",");const link=document.createElement("a");link.setAttribute("href",encodeURI(csvContent));link.setAttribute("download",`Template_${type}.csv`);document.body.appendChild(link);link.click();document.body.removeChild(link);}
window.execImport=async function(){
  const fileInput=document.getElementById('import-file');const selType=document.getElementById('import-type').value;const schema=window.IMPORT_SCHEMAS[selType];const isClearFirst=document.getElementById('import-clear-first').checked;
  if(!fileInput.files.length){document.getElementById('import-msg').innerHTML='<span style="color:var(--coral)">⚠ กรุณาเลือกไฟล์ก่อน</span>';return;}
  if(!window.auth.currentUser){document.getElementById('import-msg').innerHTML='<span style="color:var(--coral)">⚠ กรุณาเชื่อมต่อก่อน</span>';return;}
  const file=fileInput.files[0];const reader=new FileReader();
  reader.onload=async function(e){
    let text=e.target.result;if(text.charCodeAt(0)===0xFEFF)text=text.substring(1);
    function parseCSV(str){var arr=[];var quote=false;for(var row=0,col=0,c=0;c<str.length;c++){var cc=str[c],nc=str[c+1];arr[row]=arr[row]||[];arr[row][col]=arr[row][col]||'';if(cc=='"'&&quote&&nc=='"'){arr[row][col]+=cc;++c;continue;}if(cc=='"'){quote=!quote;continue;}if(cc==','&&!quote){++col;continue;}if(cc=='\r'&&nc=='\n'&&!quote){++row;col=0;++c;continue;}if(cc=='\n'&&!quote){++row;col=0;continue;}if(cc=='\r'&&!quote){++row;col=0;continue;}arr[row][col]+=cc;}return arr.filter(r=>r.join('').trim()!=='');}
    const lines=parseCSV(text);if(lines.length<=1){document.getElementById('import-msg').innerHTML='<span style="color:var(--coral)">⚠ ไม่พบข้อมูลในไฟล์</span>';return;}
    const headers=lines[0].map(h=>h.trim());document.getElementById('import-msg').innerHTML='<span style="color:var(--teal)">⏳ กำลังประมวลผล...</span>';
    try{
      let batch=writeBatch(db);let opCount=0;
      const commitBatchIfNeeded=async()=>{if(opCount>=400){await batch.commit();batch=writeBatch(db);opCount=0;}};
      if(isClearFirst){const existingDocs=await getDocs(getColRef(selType));for(let docSnap of existingDocs.docs){batch.delete(docSnap.ref);opCount++;await commitBatchIfNeeded();}}
      for(let i=1;i<lines.length;i++){const values=lines[i].map(v=>v.trim());let rowObj={};const newId=schema.prefix+Date.now()+i;rowObj[schema.idField]=newId;if(selType==='PROJECTS'){rowObj.status='active';rowObj.team=[];rowObj.members=[];}headers.forEach((h,index)=>{if(values[index]!==undefined&&schema.headers.includes(h)){let val=values[index];if(['budget','progress_pct','amount_requested','amount_cleared'].includes(h))val=Number(val)||0;if(['is_active'].includes(h))val=(val.toUpperCase()==='TRUE');rowObj[h]=val;}});batch.set(getDocRef(selType,newId),rowObj);opCount++;await commitBatchIfNeeded();}
      if(opCount>0)await batch.commit();
      window.closeM('m-import');window.showAlert(`นำเข้าข้อมูล ${selType} สำเร็จ ${lines.length-1} รายการ`,'success');
    }catch(err){document.getElementById('import-msg').innerHTML='<span style="color:var(--coral)">❌ เกิดข้อผิดพลาด: '+err.message+'</span>';}
  };reader.readAsText(file);
}

// ── MODALS ──
window.openM=function(id){document.getElementById(id).classList.add('on');}
window.closeM=function(id){document.getElementById(id).classList.remove('on');}
document.addEventListener('keydown',function(e){if(e.key==='Escape')document.querySelectorAll('.overlay.on').forEach(function(m){if(m.id!=='sys-loader')m.classList.remove('on');});});
