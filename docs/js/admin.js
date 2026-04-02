import { getFirestore, setDoc, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
const db = getFirestore();
const { esc, fd, fc, fca, pd, gS, gT, gG, gSt, gC, avC, uid, getFY, getYearBE, getStaffOverlaps, overlapWarnText, getStaffLeaveConflicts, getColRef, getDocRef } = window;
// ── ADMIN ──
window.openAdminModal=function(){if(window.isAdmin()){window.admTab('staff');window.openM('m-admin');}}
window.admTab=function(t){window.admCur=t;document.querySelectorAll('.adm-nav-item').forEach(function(el){el.classList.remove('on');});var el=document.getElementById('at-'+t);if(el)el.classList.add('on');renderAdm();}

function renderAdm(){
  var c=document.getElementById('adm-body');if(!c)return;var titleEl=document.getElementById('adm-head-title');
  if(window.admCur==='notify'){window.renderNotifySettings();return;}
  if(window.admCur==='staff'){
    if(titleEl)titleEl.innerHTML=`👥 จัดการพนักงาน <span class="tag" style="background:var(--surface2);color:var(--txt3);margin-left:10px;font-size:11px;">${window.STAFF.length} คน</span>`;
    var activeStaff=window.STAFF.filter(function(s){return s.active!==false;});
    var inactiveStaff=window.STAFF.filter(function(s){return s.active===false;});
    function staffCard(s,i){
      var initials=s.name.split(' ').map(function(w){return w.charAt(0);}).join('').substring(0,2).toUpperCase();
      return`<div class="fade" style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px;display:flex;flex-direction:column;gap:12px;transition:all .2s;box-shadow:var(--sh-sm);" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='var(--sh-md)';this.style.borderColor='var(--border2)'" onmouseout="this.style.transform='';this.style.boxShadow='var(--sh-sm)';this.style.borderColor='var(--border)'">
        <div style="display:flex;align-items:flex-start;gap:14px;">
          <div style="width:48px;height:48px;border-radius:14px;background:${avC(i)};color:#fff;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:700;flex-shrink:0;">${initials}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:14px;font-weight:600;color:var(--txt);margin-bottom:2px;">${esc(s.name)}${s.nickname?` <span style="font-size:12px;color:var(--txt3);font-weight:400;">(${esc(s.nickname)})</span>`:''}</div>
            <div style="font-size:12px;color:var(--violet);font-weight:500;">${esc(s.role||'—')}</div>
          </div>
          ${s.active===false?`<span style="font-size:10px;background:rgba(255,107,107,.15);color:var(--coral);padding:2px 8px;border-radius:20px;font-weight:600;">Inactive</span>`:''}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;padding-top:4px;border-top:1px solid var(--border);">
          <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--txt2);">
            <span style="width:16px;text-align:center;opacity:.6">🏢</span><span style="background:var(--surface2);padding:2px 10px;border-radius:20px;font-size:11px;">${esc(s.dept||'—')}</span>
          </div>
          ${s.email?`<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--txt3);"><span style="width:16px;text-align:center;opacity:.6">✉️</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(s.email)}</span></div>`:''}
          ${s.phone?`<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--txt3);"><span style="width:16px;text-align:center;opacity:.6">📞</span><span>${esc(s.phone)}</span></div>`:''}
        </div>
        ${window.isAdmin()?`<div style="display:flex;gap:8px;padding-top:4px;">
          <button class="btn btn-ghost btn-sm" style="flex:1;justify-content:center;" onclick="window.admStaffForm('${s.id}')">✏️ แก้ไข</button>
          <button class="btn btn-red btn-sm" onclick="window.askDel('staff','${s.id}','${esc(s.name)}')">🗑</button>
        </div>`:''}
      </div>`;
    }
    c.innerHTML=
      `<div style="display:flex;justify-content:flex-end;margin-bottom:20px">${window.isAdmin()?`<button class="btn btn-pri" onclick="window.admStaffForm(null)">+ เพิ่มพนักงาน</button>`:''}</div>`+
      `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;">`+
      activeStaff.map(staffCard).join('')+
      inactiveStaff.map(staffCard).join('')+
      `</div>`;
  }
  else if(window.admCur==='groups'){if(titleEl)titleEl.innerHTML=`📂 กลุ่มโครงการ`;c.innerHTML=`<div style="display:flex;justify-content:flex-end;margin-bottom:20px">${window.isAdmin()?`<button class="btn btn-pri" onclick="window.admGroupForm(null)">+ เพิ่มกลุ่มโครงการ</button>`:''}</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px">`+window.PGROUPS.map(function(g){return`<div class="adm-card fade"><div style="width:40px;height:40px;border-radius:10px;background:${g.color};flex-shrink:0;box-shadow:0 4px 12px ${g.color}55;"></div><div class="adm-card-info"><div style="font-size:14px;font-weight:600;color:var(--txt)">${esc(g.label)}</div><div style="display:flex;align-items:center;gap:6px;margin-top:4px;"><div style="width:10px;height:10px;border-radius:50%;background:${g.color};"></div><span style="font-size:11px;font-weight:400;color:var(--txt3)">${g.color}</span></div></div><div class="adm-card-actions">${window.isAdmin()?`<button class="btn btn-ghost btn-sm" onclick="window.admGroupForm('${g.id}')">✏️</button><button class="btn btn-red btn-sm" onclick="window.askDel('group','${g.id}','${esc(g.label)}')">🗑</button>`:''}</div></div>`;}).join('')+`</div>`;}
  else if(window.admCur==='types'){if(titleEl)titleEl.innerHTML=`🏷️ ประเภทงาน`;c.innerHTML=`<div style="display:flex;justify-content:flex-end;margin-bottom:20px">${window.isAdmin()?`<button class="btn btn-pri" onclick="window.admTypeForm(null)">+ เพิ่มประเภทงาน</button>`:''}</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px">`+window.PTYPES.map(function(t){return`<div class="adm-card fade"><div style="width:40px;height:40px;border-radius:10px;background:${t.color};flex-shrink:0;box-shadow:0 4px 12px ${t.color}55;"></div><div class="adm-card-info"><div style="font-size:14px;font-weight:600;color:var(--txt)">${esc(t.label)}</div><div style="display:flex;align-items:center;gap:6px;margin-top:4px;"><div style="width:10px;height:10px;border-radius:50%;background:${t.color};"></div><span style="font-size:11px;font-weight:400;color:var(--txt3)">${t.color}</span></div></div><div class="adm-card-actions">${window.isAdmin()?`<button class="btn btn-ghost btn-sm" onclick="window.admTypeForm('${t.id}')">✏️</button><button class="btn btn-red btn-sm" onclick="window.askDel('type','${t.id}','${esc(t.label)}')">🗑</button>`:''}</div></div>`;}).join('')+`</div>`;}
  else if(window.admCur==='positions'){if(titleEl)titleEl.innerHTML=`💼 ตำแหน่งงาน`;c.innerHTML=`<div style="display:flex;justify-content:flex-end;margin-bottom:20px">${window.isAdmin()?`<button class="btn btn-pri" onclick="window.admPositionForm(null)">+ เพิ่มตำแหน่ง</button>`:''}</div><div style="display:flex;flex-direction:column;gap:8px;max-width:640px;">`+window.POSITIONS.map(function(p,i){return`<div class="fade" style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:14px;transition:all .2s;" onmouseover="this.style.borderColor='var(--violet)';this.style.background='var(--surface2)'" onmouseout="this.style.borderColor='var(--border)';this.style.background='var(--surface)'"><div style="width:28px;height:28px;border-radius:8px;background:var(--violet)18;color:var(--violet);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;">${i+1}</div><div style="flex:1;font-size:14px;font-weight:500;color:var(--txt);">${esc(p.label)}</div>${window.isAdmin()?`<div style="display:flex;gap:6px;"><button class="btn btn-ghost btn-sm" onclick="window.admPositionForm('${p.id}')">✏️</button><button class="btn btn-red btn-sm" onclick="window.askDel('position','${p.id}','${esc(p.label)}')">🗑</button></div>`:''}</div>`;}).join('')+`</div>`;}
  else if(window.admCur==='stages'){if(titleEl)titleEl.innerHTML=`⚡ PM Stages`;c.innerHTML=`<div style="display:flex;justify-content:flex-end;margin-bottom:20px">${window.isAdmin()?`<button class="btn btn-pri" onclick="window.admStageForm(null)">+ เพิ่ม Stage</button>`:''}</div><div id="stg-list" style="display:flex;flex-direction:column;gap:10px;max-width:700px;margin:0 auto;">`+window.STAGES.map(function(s,i){return`<div class="adm-card fade" draggable="${window.isAdmin()}" ondragstart="window.stgDrag(event,'${s.id}')" ondragover="event.preventDefault()" ondrop="window.stgDrop(event,'${s.id}')" style="animation-delay:${i*30}ms;">${window.isAdmin()?`<div style="color:var(--border2);font-size:20px;cursor:grab;padding-right:10px;">⋮⋮</div>`:''}<div style="width:40px;height:40px;border-radius:10px;background:${s.color};flex-shrink:0;box-shadow:0 4px 12px ${s.color}55;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;">${s.order||i+1}</div><div class="adm-card-info"><div style="font-size:14px;font-weight:600;color:var(--txt)">${esc(s.label)}</div><div style="display:flex;align-items:center;gap:8px;margin-top:4px;flex-wrap:wrap;"><div style="width:10px;height:10px;border-radius:50%;background:${s.color};"></div><span style="font-size:11px;font-weight:400;color:var(--txt3)">ลำดับที่ ${s.order||i+1}</span>${s.autoRule?`<span style="font-size:10px;font-weight:600;background:var(--violet)15;color:var(--violet);padding:2px 8px;border-radius:10px;">⚡ ${s.autoRule==='before_start'?'ก่อนเริ่ม '+s.autoOffset+'ว':s.autoRule==='on_start'?'เมื่อเริ่มโครงการ':s.autoRule==='on_end'?'เมื่อสิ้นสุดโครงการ':'หลังสิ้นสุด '+s.autoOffset+'ว'}</span>`:''}${s.setProgress>=0?`<span style="font-size:10px;font-weight:600;background:var(--teal)15;color:var(--teal);padding:2px 8px;border-radius:10px;">📊 ${s.setProgress}%</span>`:''}</div></div><div class="adm-card-actions">${window.isAdmin()?`<button class="btn btn-ghost btn-sm" onclick="window.admStageForm('${s.id}')">✏️</button><button class="btn btn-red btn-sm" onclick="window.askDel('stage','${s.id}','${esc(s.label)}')">🗑</button>`:''}</div></div>`;}).join('')+`</div>`;}
  else if(window.admCur==='users'){if(titleEl)titleEl.innerHTML=`🔑 ผู้ใช้งานระบบ`;c.innerHTML=`<div style="display:flex;justify-content:flex-end;margin-bottom:20px">${window.isAdmin()?`<button class="btn btn-pri" onclick="window.admUserForm(null)">+ เพิ่มบัญชีผู้ใช้</button>`:''}</div><div class="dtable-inner" style="border:1px solid var(--border);"><table><thead><tr><th>Username</th><th>ชื่อ</th><th>Role</th><th style="width:90px"></th></tr></thead><tbody>`+window.USERS.map(function(u,i){var rc={admin:'rgba(255,107,107,.15)',pm:'rgba(255,166,43,.15)',viewer:'rgba(6,214,160,.15)'};var rt={admin:'var(--coral)',pm:'var(--amber)',viewer:'var(--teal)'};return`<tr class="fade"><td style="font-weight:700;font-family:'JetBrains Mono',monospace;color:var(--violet)">${esc(u.username)}</td><td style="font-weight:600;">${esc(u.name)}</td><td><span class="tag" style="background:${rc[u.role]||'var(--surface2)'};color:${rt[u.role]||'var(--txt2)'}">${window.roleLabel(u.role)}</span></td><td><div style="display:flex;gap:6px">${window.isAdmin()?`<button class="btn btn-ghost btn-sm" onclick="window.admUserForm('${u.id}')">✏️</button>`:''} ${window.isAdmin()?`<button class="btn btn-red btn-sm" onclick="window.askDel('user','${u.id}','${esc(u.username)}')">🗑</button>`:''}</div></td></tr>`;}).join('')+`</tbody></table></div>`;}
}

// ── helper: show/hide ID badge in modal header ──
function setIdBadge(badgeId, id){
  var el = document.getElementById(badgeId);
  if(!el) return;
  if(id){ el.textContent = 'ID: '+id; el.style.display='inline-block'; }
  else { el.style.display='none'; el.textContent=''; }
}

// ── helper: live color preview ──
function bindColorPreview(inputId, previewId, labelId){
  var inp=document.getElementById(inputId);
  var prev=document.getElementById(previewId);
  var lbl=document.getElementById(labelId);
  if(!inp||!prev)return;
  function update(){
    var c=inp.value;
    prev.style.background=c+'20';
    prev.style.color=c;
    prev.style.border='2px solid '+c+'40';
    prev.textContent=lbl?document.getElementById(lbl).value||'ตัวอย่าง':'ตัวอย่าง';
  }
  inp.addEventListener('input',update);
  if(lbl){var li=document.getElementById(lbl);if(li)li.addEventListener('input',update);}
  update();
}

window._editGroupId=null;
window.admGroupForm=function(id){
  var realId=(id&&id!=='null'&&id!=='')?id:null;
  window._editGroupId=realId;
  var g=realId?window.PGROUPS.find(function(x){return x.id===realId;}):null;
  document.getElementById('m-group-title').textContent=g?'แก้ไขกลุ่มโครงการ':'เพิ่มกลุ่มโครงการ';
  setIdBadge('m-group-id-badge', realId);
  document.getElementById('agf-lbl').value=g?g.label:'';
  document.getElementById('agf-col').value=g?g.color:'#4361ee';
  window.openM('m-group');
  setTimeout(function(){bindColorPreview('agf-col','agf-preview','agf-lbl');},50);
}
window.saveAdmGroup=async function(){
  if(!window.isAdmin()||!window.auth.currentUser)return;
  var l=(document.getElementById('agf-lbl')||{}).value||'';if(!l.trim())return;
  var gid=window._editGroupId||'GRP'+Date.now();
  window.closeM('m-group');
  window.admTab('groups');
  setDoc(getDocRef('PGROUPS',gid),{group_id:gid,label_th:l.trim(),color_hex:document.getElementById('agf-col').value}).catch(e=>window.showDbError(e));
}

window._editTypeId=null;
window.admTypeForm=function(id){
  var realId=(id&&id!=='null'&&id!=='')?id:null;
  window._editTypeId=realId;
  var t=realId?window.PTYPES.find(function(x){return x.id===realId;}):null;
  document.getElementById('m-type-title').textContent=t?'แก้ไขประเภทงาน':'เพิ่มประเภทงาน';
  setIdBadge('m-type-id-badge', realId);
  document.getElementById('atf-lbl').value=t?t.label:'';
  document.getElementById('atf-col').value=t?t.color:'#7c5cfc';
  window.openM('m-type');
  setTimeout(function(){bindColorPreview('atf-col','atf-preview','atf-lbl');},50);
}
window.saveAdmType=async function(){
  if(!window.isAdmin()||!window.auth.currentUser)return;
  var l=(document.getElementById('atf-lbl')||{}).value||'';if(!l.trim())return;
  var tid=window._editTypeId||'T'+Date.now();
  window.closeM('m-type');
  window.admTab('types');
  setDoc(getDocRef('PTYPES',tid),{type_id:tid,label_th:l.trim(),color_hex:document.getElementById('atf-col').value}).catch(e=>window.showDbError(e));
}

window._editPositionId=null;
window.admPositionForm=function(id){
  var realId=(id&&id!=='null'&&id!=='')?id:null;
  window._editPositionId=realId;
  var p=realId?window.POSITIONS.find(function(x){return x.id===realId;}):null;
  document.getElementById('m-position-title').textContent=p?'แก้ไขตำแหน่งงาน':'เพิ่มตำแหน่งงาน';
  setIdBadge('m-position-id-badge', realId);
  document.getElementById('apf-lbl').value=p?p.label:'';
  window.openM('m-position');
}
window.saveAdmPosition=async function(){
  if(!window.isAdmin()||!window.auth.currentUser)return;
  var l=(document.getElementById('apf-lbl')||{}).value||'';if(!l.trim())return;
  var pid=window._editPositionId||'POS'+Date.now();
  window.closeM('m-position');
  window.admTab('positions');
  setDoc(getDocRef('POSITIONS',pid),{position_id:pid,label_th:l.trim()}).catch(e=>window.showDbError(e));
}

window._editStageId=null;
window.admStageForm=function(id){
  var realId=(id&&id!=='null'&&id!=='')?id:null;
  window._editStageId=realId;
  var s=realId?window.STAGES.find(function(x){return x.id===realId;}):null;
  document.getElementById('m-stage-title').textContent=s?'แก้ไข PM Stage':'เพิ่ม PM Stage';
  setIdBadge('m-stage-id-badge', realId);
  document.getElementById('asgf-lbl').value=s?s.label:'';
  document.getElementById('asgf-col').value=s?s.color:'#9ba3b8';
  window.openM('m-stage');
  setTimeout(function(){bindColorPreview('asgf-col','asgf-preview','asgf-lbl');},50);
}
window.saveAdmStage=async function(){
  if(!window.isAdmin()||!window.auth.currentUser)return;
  var l=(document.getElementById('asgf-lbl')||{}).value||'';if(!l.trim())return;
  var sid=window._editStageId||'STG'+Date.now();
  var maxOrder=window.STAGES.length>0?Math.max(...window.STAGES.map(s=>s.order||0)):0;
  var order=window._editStageId?(window.STAGES.find(x=>x.id===window._editStageId)||{}).order||maxOrder:maxOrder+1;
  window.closeM('m-stage');
  window.admTab('stages');
  var rule=(document.getElementById('asgf-rule')||{}).value||'';
  var offset=parseInt((document.getElementById('asgf-offset')||{}).value)||0;
  var prog=parseInt((document.getElementById('asgf-prog')||{}).value);if(isNaN(prog))prog=-1;
  setDoc(getDocRef('STAGES',sid),{stage_id:sid,label_th:l.trim(),color_hex:document.getElementById('asgf-col').value,order:order,auto_rule:rule,auto_offset:offset,set_progress:prog},{merge:true}).catch(e=>window.showDbError(e));
}
window.stgDragId=null;window.stgDrag=function(e,id){window.stgDragId=id;}
window.stgDrop=async function(e,targetId){e.preventDefault();if(!window.stgDragId||window.stgDragId===targetId||!window.isAdmin())return;let arr=[...window.STAGES];let fromIdx=arr.findIndex(x=>x.id===window.stgDragId);let toIdx=arr.findIndex(x=>x.id===targetId);if(fromIdx<0||toIdx<0)return;let[moved]=arr.splice(fromIdx,1);arr.splice(toIdx,0,moved);arr.forEach((s,i)=>s.order=i+1);window.STAGES=arr;window.admTab('stages');try{const batch=writeBatch(db);arr.forEach(s=>{batch.update(getDocRef('STAGES',s.id),{order:s.order});});await batch.commit();}catch(err){window.showDbError(err);}window.stgDragId=null;}
window._editStaffId = null;
window.admStaffForm=function(id){
  var realId = (id && id !== 'null' && id !== '') ? id : null;
  window._editStaffId = realId;
  var s = realId ? window.STAFF.find(function(x){return x.id===realId;}) : null;
  var deptOpts=window.DEPARTMENTS.map(function(d){return`<option value="${esc(d)}">`;}).join('');
  var posOpts=window.POSITIONS.map(function(p){return`<option value="${esc(p.label)}">`;}).join('');
  var iconEl=document.getElementById('m-staff-icon');
  var titleEl=document.getElementById('m-staff-title');
  if(iconEl) iconEl.textContent = s ? '✏️' : '👤';
  if(titleEl) titleEl.textContent = s ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงานใหม่';
  setIdBadge('m-staff-id-badge', realId);
  var si = s ? window.STAFF.indexOf(s) : 0;
  var avatarHtml = s
    ? `<div style="display:flex;justify-content:center;margin-bottom:20px">
        <div class="av" style="background:${avC(si)};width:64px;height:64px;font-size:24px;border-radius:16px;">${s.name.charAt(0)}</div>
       </div>`
    : `<div style="display:flex;justify-content:center;margin-bottom:20px">
        <div style="width:64px;height:64px;border-radius:16px;background:linear-gradient(135deg,var(--violet),var(--coral));display:flex;align-items:center;justify-content:center;font-size:28px;">👤</div>
       </div>`;
  document.getElementById('m-staff-body').innerHTML = avatarHtml + `
    <div class="f-grid">
      <div class="f-group"><label class="f-label">ชื่อ-นามสกุล *</label><input class="f-input" id="asf-name" value="${esc(s?s.name:'')}" placeholder="ชื่อ-นามสกุล"></div>
      <div class="f-group"><label class="f-label">ชื่อเล่น</label><input class="f-input" id="asf-nick" value="${esc(s?s.nickname:'')}" placeholder="ชื่อเล่น"></div>
      <div class="f-group"><label class="f-label">แผนก</label><input type="text" class="f-input" id="asf-dept" list="dl-depts" value="${esc(s?s.dept:'')}" placeholder="เลือกหรือพิมพ์..."><datalist id="dl-depts">${deptOpts}</datalist></div>
      <div class="f-group"><label class="f-label">ตำแหน่ง</label><input type="text" class="f-input" id="asf-role" list="dl-pos" value="${esc(s?s.role:'')}" placeholder="เลือกหรือพิมพ์..."><datalist id="dl-pos">${posOpts}</datalist></div>
      <div class="f-group"><label class="f-label">Email</label><input class="f-input" id="asf-email" value="${esc(s?s.email:'')}" placeholder="email@company.com"></div>
      <div class="f-group"><label class="f-label">เบอร์โทร</label><input class="f-input" id="asf-phone" value="${esc(s?s.phone:'')}" placeholder="08X-XXX-XXXX"></div>
      <div class="f-group"><label class="f-label">วันเริ่มงาน</label><input type="date" class="f-input" id="asf-start" value="${s&&s.start_date?s.start_date:''}"></div>
      <div class="f-group"><label class="f-label">สถานะ</label><select class="f-input" id="asf-active">
        <option value="TRUE" ${!s||s.active!==false?'selected':''}>✅ Active</option>
        <option value="FALSE" ${s&&s.active===false?'selected':''}>❌ Inactive</option>
      </select></div>
      <div class="f-group" style="grid-column:span 2"><label class="f-label">หมายเหตุ</label><input class="f-input" id="asf-remark" value="${esc(s&&s.remark?s.remark:'')}" placeholder="หมายเหตุ (ถ้ามี)"></div>
    </div>`;
  window.openM('m-staff');
}
window.saveAdmStaff=async function(){
  if(!window.isAdmin()||!window.auth.currentUser)return;
  var nm=(document.getElementById('asf-name')||{}).value||'';if(!nm.trim())return;
  var id=window._editStaffId;
  var sid=id||'S'+Date.now();
  let dbStf={staff_id:sid,full_name:nm.trim(),nickname:document.getElementById('asf-nick').value.trim()||nm.split(' ')[0],department:document.getElementById('asf-dept').value,position:document.getElementById('asf-role').value,email:document.getElementById('asf-email').value,phone:document.getElementById('asf-phone').value,is_active:document.getElementById('asf-active').value==='TRUE',start_date:document.getElementById('asf-start').value,birth_date:'',remark:document.getElementById('asf-remark').value};
  window.closeM('m-staff');
  window.admTab('staff');
  setDoc(getDocRef('STAFF',sid),dbStf).catch(e=>window.showDbError(e));
}
window._editUserId=null;
window.admUserForm=function(id){
  var realId=(id&&id!=='null'&&id!=='')?id:null;
  window._editUserId=realId;
  var u=realId?window.USERS.find(function(x){return x.id===realId;}):null;
  document.getElementById('m-user-icon').textContent=u?'✏️':'🔑';
  document.getElementById('m-user-title').textContent=u?'แก้ไขบัญชีผู้ใช้':'เพิ่มบัญชีผู้ใช้';
  setIdBadge('m-user-id-badge', realId);
  document.getElementById('auf-u').value=u?u.username:'';
  document.getElementById('auf-p').value='';
  document.getElementById('auf-p').placeholder=u?'(ว่างไว้ = ไม่เปลี่ยนรหัสผ่าน)':'กำหนดรหัสผ่าน...';
  document.getElementById('auf-n').value=u?u.name:'';
  var sel=document.getElementById('auf-r');
  var role=u?u.role:'viewer';
  for(var i=0;i<sel.options.length;i++){sel.options[i].selected=(sel.options[i].value===role);}
  var stfSel=document.getElementById('auf-staff');
  if(stfSel){
    stfSel.innerHTML='<option value="">-- ไม่ผูก --</option>';
    window.STAFF.filter(function(s){return s.active!==false;}).sort(function(a,b){return(a.name||'').localeCompare(b.name||'','th');}).forEach(function(s){stfSel.insertAdjacentHTML('beforeend','<option value="'+s.id+'"'+(u&&u.staffId===s.id?' selected':'')+'>'+esc(s.name)+'</option>');});
  }
  window.openM('m-user');
}
window.saveAdmUser=async function(){
  if(!window.isAdmin()||!window.auth.currentUser)return;
  var un=(document.getElementById('auf-u')||{}).value||'';
  var nm=(document.getElementById('auf-n')||{}).value||'';
  if(!un.trim()||!nm.trim())return;
  var pw=document.getElementById('auf-p').value;
  var id=window._editUserId;
  var ex=id?window.USERS.find(function(x){return x.id===id;}):null;
  var uid2=id||'U'+Date.now();
  var dbUsr={user_id:uid2,username:un.trim(),name:nm.trim(),role:document.getElementById('auf-r').value,password:pw?pw:(ex?ex.password:''),is_active:true,staff_id:(document.getElementById('auf-staff')||{value:''}).value||''};
  window.closeM('m-user');
  window.admTab('users');
  setDoc(getDocRef('USERS',uid2),dbUsr).catch(e=>window.showDbError(e));
}

// ── CHANGE PASSWORD ──
window.openChangePassword=function(){
  ['cpw-old','cpw-new','cpw-confirm'].forEach(function(id){document.getElementById(id).value='';});
  var e=document.getElementById('cpw-err');if(e){e.style.display='none';e.textContent='';}
  window.openM('m-change-pw');
};
window.saveChangePassword=async function(){
  var errEl=document.getElementById('cpw-err');
  function showErr(msg){errEl.textContent=msg;errEl.style.display='block';}
  var oldPw=document.getElementById('cpw-old').value;
  var newPw=document.getElementById('cpw-new').value;
  var cfPw=document.getElementById('cpw-confirm').value;
  if(!oldPw||!newPw||!cfPw){showErr('⚠ กรุณากรอกข้อมูลให้ครบ');return;}
  if(oldPw!==window.cu.password){showErr('⚠ รหัสผ่านปัจจุบันไม่ถูกต้อง');return;}
  if(newPw===oldPw){showErr('⚠ รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม');return;}
  if(newPw!==cfPw){showErr('⚠ รหัสผ่านใหม่ไม่ตรงกัน');return;}
  if(newPw.length<4){showErr('⚠ รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร');return;}
  var ex=window.USERS.find(function(x){return x.id===window.cu.id;});
  if(!ex){showErr('⚠ ไม่พบข้อมูลผู้ใช้');return;}
  var dbUsr={user_id:ex.id,username:ex.username,name:ex.name,role:ex.role,is_active:true,password:newPw};
  if(ex.staffId)dbUsr.staff_id=ex.staffId;
  try{
    await setDoc(getDocRef('USERS',ex.id),dbUsr);
    window.cu.password=newPw;
    window.closeM('m-change-pw');
    window.showAlert('เปลี่ยนรหัสผ่านสำเร็จ','ok');
  }catch(e2){showErr('⚠ บันทึกไม่สำเร็จ: '+e2.message);}
};

// ── LEAVE STAFF FILTER HELPERS ──
window.regRefreshStaff=function(sfEl,dept){
  var cur=sfEl.value;
  sfEl.innerHTML='<option value="">ทุกคน</option>';
  sfEl.dataset.loaded='1';
  window.STAFF.filter(function(s){return s.active!==false&&(!dept||(s.dept||'')===dept);})
    .sort(function(a,b){return(a.name||'').localeCompare(b.name||'','th');})
    .forEach(function(s){sfEl.insertAdjacentHTML('beforeend','<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>');});
  if([...sfEl.options].some(function(o){return o.value===cur;}))sfEl.value=cur;else sfEl.value='';
};

window.regDeptChange=function(){
  var dept=(document.getElementById('reg-dept')||{value:''}).value||'';
  var sfEl=document.getElementById('leave-filter-staff');
  if(sfEl)window.regRefreshStaff(sfEl,dept);
  window.renderLeave();
};


