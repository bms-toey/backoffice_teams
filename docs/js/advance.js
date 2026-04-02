import { getFirestore, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
const db = getFirestore();
const { esc, fd, fc, fca, pd, gS, gT, gG, gSt, gC, avC, uid, getFY, getYearBE, getStaffOverlaps, overlapWarnText, getStaffLeaveConflicts, getColRef, getDocRef } = window;
// ── ADVANCE ──
window.renderAdvance=function(){
  var gf=document.getElementById('adv-grp');if(gf&&gf.options.length<=1){window.PGROUPS.forEach(function(g){var o=document.createElement('option');o.value=g.id;o.textContent=g.label;gf.appendChild(o);});}
  var tf=document.getElementById('adv-type');if(tf&&tf.options.length<=1){window.PTYPES.forEach(function(t){var o=document.createElement('option');o.value=t.id;o.textContent=t.label;tf.appendChild(o);});}
  var yf=document.getElementById('adv-yr');if(yf&&yf.options.length<=1){var yrs=[...new Set(window.PROJECTS.map(p=>getYearBE(p.start)).filter(Boolean))].sort((a,b)=>b-a);yrs.forEach(function(y){var o=document.createElement('option');o.value=y;o.textContent='ปี พ.ศ. '+y;yf.appendChild(o);});var _cbe=(new Date().getFullYear()+543).toString();if(!yf.value||yf.value==='')yf.value=_cbe;}
  // Status tabs
  var tabs=document.getElementById('af-tabs');
  if(tabs){var all=[{id:'',label:'ทั้งหมด',color:'#7c5cfc'}].concat(window.AFLW);
    tabs.innerHTML=all.map(function(s){var cnt=s.id?window.ADVANCES.filter(function(a){return a.status===s.id;}).length:window.ADVANCES.length;var on=window.advFilter===s.id;
      return`<div class="af-tab${on?' on':''}" style="${on?'background:'+s.color+';color:#fff':''}" onclick="window.advFilter='${s.id}';window.renderAdvance()">${s.label}<span class="af-cnt">${cnt}</span></div>`;
    }).join('');}
  var q=(document.getElementById('adv-q')||{}).value||'';
  var grp=(document.getElementById('adv-grp')||{}).value||'';
  var ty=(document.getElementById('adv-type')||{}).value||'';
  var yr=(document.getElementById('adv-yr')||{}).value||'';
  var now=new Date();
  var rows=window.ADVANCES.filter(function(a){
    if(window.advFilter&&a.status!==window.advFilter)return false;
    var p=window.PROJECTS.find(function(x){return x.id===a.pid;});
    if(grp&&(!p||p.groupId!==grp))return false;
    if(ty&&(!p||p.typeId!==ty))return false;
    if(yr&&(!p||getYearBE(p.start)!=yr))return false;
    return!q||a.purpose.includes(q)||(p&&p.name.includes(q));
  });
  // ── Summary bar ──
  var totalAmt=rows.reduce((s,a)=>s+(a.amount||0),0);
  var totalClr=rows.reduce((s,a)=>s+(a.cleared||0),0);
  var overdueCount=rows.filter(a=>a.ddate&&pd(a.ddate)<now&&a.status!=='cleared').length;
  var draftCount=rows.filter(a=>a.status==='draft').length;
  var bar=document.getElementById('adv-summary-bar');
  if(bar)bar.innerHTML=[
    {icon:'💳',label:'รายการทั้งหมด',val:rows.length+' รายการ',c:'var(--violet)'},
    {icon:'💰',label:'ยอดเบิกรวม',val:fca(totalAmt),c:'var(--indigo)'},
    {icon:'✅',label:'จ่ายจริงรวม',val:fca(totalClr),c:'var(--teal)'},
    {icon:'⚠️',label:'เลยกำหนด',val:overdueCount+' รายการ',c:'var(--coral)'},
  ].map(s=>`<div style="display:flex;align-items:center;gap:10px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:10px 16px;flex:1;min-width:150px;">
    <div style="width:36px;height:36px;border-radius:10px;background:${s.c}18;display:flex;align-items:center;justify-content:center;font-size:18px;">${s.icon}</div>
    <div><div style="font-size:10px;color:var(--txt3);font-weight:600;text-transform:uppercase;letter-spacing:.5px;">${s.label}</div>
    <div style="font-size:15px;font-weight:800;color:${s.c};">${s.val}</div></div>
  </div>`).join('');
  // ── Cards ──
  var cards=document.getElementById('adv-cards');
  if(!cards)return;
  if(rows.length===0){
    cards.innerHTML=`<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--txt3);">
      <div style="font-size:48px;margin-bottom:12px;">💳</div>
      <div style="font-size:14px;font-weight:600;">ไม่พบรายการเบิกจ่าย</div>
    </div>`;return;
  }
  cards.innerHTML=rows.map(function(a){
    var p=window.PROJECTS.find(function(x){return x.id===a.pid;});
    var pt=gT(p?p.typeId:'');var pg=gG(p?p.groupId:'');
    var sf=window.AFLW.find(function(x){return x.id===a.status;})||window.AFLW[0];
    var ov=a.ddate&&pd(a.ddate)<now&&a.status!=='cleared';
    var diff=a.amount-(a.cleared||0);
    var diffColor=diff>0?'var(--amber)':diff<0?'var(--coral)':'var(--teal)';
    var diffLabel=diff===0?fca(0):diff>0?fca(diff):'-'+fca(Math.abs(diff));
    // Progress bar for cleared amount
    var pct=a.amount>0?Math.min(100,Math.round((a.cleared||0)/a.amount*100)):0;
    var progColor=pct>=100?'var(--teal)':pct>50?'var(--indigo)':'var(--amber)';
    return`<div class="fade" style="background:var(--surface);border:2px solid ${ov?'var(--coral)':a.status==='cleared'?'var(--teal)':'var(--border)'};border-radius:16px;overflow:hidden;box-shadow:var(--sh-sm);display:flex;flex-direction:column;cursor:pointer;" onclick="window.openAdvModal('${a.id}')">
      <!-- Card Header -->
      <div style="padding:14px 16px;background:linear-gradient(135deg,${pt.color}10,transparent);border-bottom:1px solid var(--border);">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:800;line-height:1.3;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p?esc(p.name):(a.pid?esc(a.pid):'—')}</div>
            <div style="display:flex;gap:5px;flex-wrap:wrap;">
              ${pt.label?`<span style="font-size:10px;font-weight:700;padding:1px 8px;border-radius:20px;background:${pt.color}18;color:${pt.color};">${esc(pt.label)}</span>`:''}
              ${pg?`<span style="font-size:10px;font-weight:700;padding:1px 8px;border-radius:20px;background:${pg.color}18;color:${pg.color};">${esc(pg.label)}</span>`:''}
            </div>
          </div>
          <span style="background:${sf.color}18;color:${sf.color};font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;border:1px solid ${sf.color}30;white-space:nowrap;">${ov?'⚠️ ':''}<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${sf.color};margin-right:4px;vertical-align:middle;"></span>${sf.label}</span>
        </div>
        <div style="font-size:12px;color:var(--txt2);font-weight:600;">${esc(a.purpose)}</div>
        ${a.advno?`<div style="font-size:10px;color:var(--txt3);margin-top:2px;">📋 ${esc(a.advno)}</div>`:''}
      </div>
      <!-- Amounts section -->
      <div style="padding:12px 16px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;border-bottom:1px solid var(--border);">
        <div style="text-align:center;">
          <div style="font-size:10px;color:var(--txt3);margin-bottom:2px;">ยอดเบิก</div>
          <div style="font-size:14px;font-weight:800;color:var(--indigo);">${fca(a.amount)}</div>
        </div>
        <div style="text-align:center;border-left:1px solid var(--border);border-right:1px solid var(--border);">
          <div style="font-size:10px;color:var(--txt3);margin-bottom:2px;">จ่ายจริง</div>
          <div style="font-size:14px;font-weight:800;color:var(--teal);">${a.cleared?fca(a.cleared):'—'}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:10px;color:var(--txt3);margin-bottom:2px;">ส่วนต่าง</div>
          <div style="font-size:13px;font-weight:800;color:${diff<0?'var(--coral)':(a.status==='cleared'?diffColor:'var(--txt2)')};">${a.status==='cleared'?diffLabel:(diff!==0?diffLabel:'—')}</div>
        </div>
      </div>
      <!-- Progress bar removed -->
      <!-- Dates & actions -->
      <div style="padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <div style="font-size:11px;color:var(--txt3);">
          ${a.rdate?`<span>📋 ขอ ${fd(a.rdate)}</span> `:''}
          ${a.ddate?`<span style="${ov?'color:var(--coral);font-weight:700':''}">⏰ ครบ ${fd(a.ddate)}${ov?' ⚠️':''}</span>`:''}
        </div>
        <div style="display:flex;gap:4px;" onclick="event.stopPropagation()">
          ${window.cl()?`<button class="btn btn-ghost btn-sm" onclick="window.openAdvModal('${a.id}')">✏️</button>`:''}
          ${window.cl()&&a.status==='draft'?`<button class="btn btn-red btn-sm" onclick="window.askDel('advance','${a.id}','${esc(a.purpose)}')">🗑</button>`:''}
        </div>
      </div>
    </div>`;
  }).join('');
}



window.openAdvModal=function(id){
  window.editAid=id;var a=id?window.ADVANCES.find(function(x){return x.id===id;}):null;
  document.getElementById('m-adv-title').textContent=a?'แก้ไข Advance':'New Advance';
  var status=a?a.status:'draft';var ai=window.AFLW.findIndex(function(s){return s.id===status;});var isClr=status==='clearing'||status==='cleared';
  var today=new Date();today.setHours(0,0,0,0);
  var EXCL_GRPS=['GRP17733355541905','GRP17733355541906'];
  var clearedPids=new Set(window.ADVANCES.filter(adv=>adv.status==='cleared').map(adv=>adv.pid));
  var availProjects=window.PROJECTS.filter(function(p){
    if(EXCL_GRPS.includes(p.groupId))return false;
    if(!p.end||pd(p.end)<today)return false;
    if(p.groupId!=='GRP17733355541902'&&clearedPids.has(p.id))return false;
    return true;
  });
  var curPid=a?a.pid:'';
  var curP2=curPid?window.PROJECTS.find(x=>x.id===curPid):null;
  if(curPid&&curP2&&!availProjects.find(x=>x.id===curPid))availProjects.unshift(curP2);
  var pOpts=availProjects.map(p=>`<option value="${esc(p.id)}"${curPid===p.id?' selected':''}>${esc(p.name)}</option>`).join('');
  var stepHtml=`<div class="adv-stepper">`+window.AFLW.map(function(s,i){var done=i<ai,active=i===ai;return`<div class="adv-s${done?' done':''}${active?' active':''}"><div class="adv-dot">${done?'✓':i+1}</div><div class="adv-lbl" style="color:${active?s.color:done?s.color:'var(--txt3)'}">${s.label}</div></div>`;}).join('')+`</div>`;
  if(a&&window.cl()){var diff2=a.amount-(a.cleared||0);if(isClr&&diff2!==0){stepHtml+=`<div style="display:flex;justify-content:space-between;padding:10px 14px;background:${diff2>0?'rgba(255,107,107,.08)':'rgba(255,166,43,.08)'};border:1px solid ${diff2>0?'rgba(255,107,107,.2)':'rgba(255,166,43,.2)'};border-radius:10px;margin-bottom:14px;font-size:13px"><span style="font-weight:600">ส่วนต่าง</span><span style="font-weight:700;color:${diff2>0?'var(--coral)':'var(--amber)'}">${fc(Math.abs(diff2))}</span></div>`;}
  var btnPrev=window.APRV[status]?`<button class="btn btn-ghost btn-sm" onclick="window.advStep('prev')">‹ ย้อนกลับ</button>`:'';var btnNext=window.ANXT[status]?`<button class="btn btn-pri btn-sm" onclick="window.advStep('next')">ขั้นถัดไป ›</button>`:'';stepHtml+=`<div style="display:flex;gap:8px;margin-bottom:18px">${btnPrev}${btnNext}</div>`;}
  document.getElementById('m-adv-body').innerHTML=stepHtml+`<input type="hidden" id="af-status" value="${status}"><div class="f-group"><label class="f-label">โครงการ</label><select class="f-input" id="af-pid" onchange="window.advOnProjectChange()" ${window.cl()?'':'disabled'}><option value="">-- เลือกโครงการ --</option>${pOpts}</select></div><div class="f-grid"><div class="f-group"><label class="f-label">เลขที่ Advance</label><input class="f-input" id="af-advno" value="${esc(a?a.advno:'')}" placeholder="เช่น ADV-001" ${window.cl()?'':'disabled'}></div><div class="f-group"><label class="f-label">วัตถุประสงค์ *</label><select class="f-input" id="af-purpose" ${window.cl()?'':'disabled'}><option value="">-- เลือกวัตถุประสงค์ --</option><option value="เพื่อใช้ในการติดตั้งระบบ"${a&&a.purpose==='เพื่อใช้ในการติดตั้งระบบ'?' selected':''}>เพื่อใช้ในการติดตั้งระบบ</option><option value="เพื่อใช้ในการเข้า Revisit"${a&&a.purpose==='เพื่อใช้ในการเข้า Revisit'?' selected':''}>เพื่อใช้ในการเข้า Revisit</option><option value="เพื่อใช้ในการดูแลหลังการขาย (MA)"${a&&a.purpose==='เพื่อใช้ในการดูแลหลังการขาย (MA)'?' selected':''}>เพื่อใช้ในการดูแลหลังการขาย (MA)</option></select></div></div><div class="f-grid"><div class="f-group"><label class="f-label">จำนวนเบิก (฿)</label><input type="number" class="f-input" id="af-amount" step="0.01" value="${a?Number(a.amount).toFixed(2):''}" ${window.cl()?'':'disabled'}></div>${isClr?`<div class="f-group"><label class="f-label">จ่ายจริง (฿)</label><input type="number" class="f-input" id="af-cleared" step="0.01" value="${a?Number(a.cleared).toFixed(2):''}" ${window.cl()?'':'disabled'}></div>`:''}<div class="f-group"><label class="f-label">วันที่ขอ</label><input type="date" class="f-input" id="af-rdate" value="${a?a.rdate:''}" ${window.cl()?'':'disabled'}></div><div class="f-group"><label class="f-label">กำหนดเคลียร์</label><input type="date" class="f-input" id="af-ddate" value="${a?a.ddate:''}" ${window.cl()?'':'disabled'}></div></div><div class="f-group"><label class="f-label">หมายเหตุ</label><textarea class="f-input" id="af-note" ${window.cl()?'':'disabled'}>${esc(a?a.note:'')}</textarea></div>`;
  document.getElementById('m-adv-foot').style.display=window.cl()?'':'none';window.openM('m-adv');
}

window.advStep=async function(dir){
  if(!window.ce())return;if(!window.auth.currentUser)return;
  var sEl=document.getElementById('af-status');if(!sEl)return;
  var cur=sEl.value;var nxt=dir==='next'?window.ANXT[cur]:window.APRV[cur];if(!nxt)return;
  if(window.editAid){let a=window.ADVANCES.find(x=>x.id===window.editAid);if(a){a.status=nxt;window.renderAdvance();window.renderOverview();window.updateBadge();window.openAdvModal(window.editAid);setDoc(getDocRef('ADVANCES',a.id),{status:nxt},{merge:true}).catch(e=>window.showDbError(e));}}
}

window.saveAdvance=async function(){
  if(!window.ce())return;if(!window.auth.currentUser)return;
  var pur=(document.getElementById('af-purpose')||{}).value||'';if(!pur.trim())return;
  var aid=window.editAid||'A'+Date.now();
  var finalPid=document.getElementById('af-pid').value.trim();
  let dbAdv={advance_id:aid,project_id:finalPid,purpose:pur.trim(),amount_requested:parseFloat(document.getElementById('af-amount').value)||0,amount_cleared:parseFloat((document.getElementById('af-cleared')||{}).value)||0,request_date:document.getElementById('af-rdate').value,due_date:document.getElementById('af-ddate').value,status:document.getElementById('af-status').value,note:document.getElementById('af-note').value,advance_no:(document.getElementById('af-advno')||{}).value||''};
  window.closeM('m-adv');setDoc(getDocRef('ADVANCES',aid),dbAdv).catch(e=>window.showDbError(e));
}

window.advCalcDueDate=function(endDateStr){
  if(!endDateStr)return'';
  var d=pd(endDateStr);d.setDate(d.getDate()+7);
  for(var i=0;i<20;i++){
    var dow=d.getDay();
    var ds=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    var isHol=window.HOLIDAYS.some(function(h){return h.date===ds;});
    if(dow!==0&&dow!==6&&!isHol)break;
    d.setDate(d.getDate()+1);
  }
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
};

window.advOnProjectChange=function(){
  var pid=(document.getElementById('af-pid')||{}).value||'';
  var ddEl=document.getElementById('af-ddate');if(!ddEl)return;
  if(!pid){return;}
  var proj=window.PROJECTS.find(function(p){return p.id===pid;});
  if(!proj||!proj.end)return;
  ddEl.value=window.advCalcDueDate(proj.end);
};

