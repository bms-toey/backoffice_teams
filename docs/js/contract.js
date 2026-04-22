import { getFirestore, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
const db = getFirestore();
const { esc, fd, fca, pd, uid, getYearBE, getColRef, getDocRef } = window;

var CT_STATUS = [
  {id:'active',    label:'มีผลบังคับ', color:'#06d6a0'},
  {id:'completed', label:'สิ้นสุดแล้ว', color:'#4361ee'},
  {id:'cancelled', label:'ยกเลิก',      color:'#ff6b6b'},
];

function ctSt(id){ return CT_STATUS.find(function(s){return s.id===id;})||CT_STATUS[0]; }

// ── RENDER LIST ──────────────────────────────────────────────────────────────
window.renderContract = function(){
  // populate year filter
  var yf = document.getElementById('ct-yr');
  if(yf && yf.options.length <= 1){
    var yrs = [...new Set(window.CONTRACTS.map(function(c){ return c.startDate ? getYearBE(c.startDate) : null; }).filter(Boolean))].sort(function(a,b){return b-a;});
    yrs.forEach(function(y){ var o=document.createElement('option'); o.value=y; o.textContent='ปี พ.ศ. '+y; yf.appendChild(o); });
    var cbe = (new Date().getFullYear()+543).toString();
    if(!yf.value) yf.value = cbe;
  }

  var q      = (document.getElementById('ct-q')||{}).value||'';
  var yr     = (document.getElementById('ct-yr')||{}).value||'';
  var status = (document.getElementById('ct-status')||{}).value||'';
  var now    = new Date();

  var rows = window.CONTRACTS.filter(function(c){
    if(status && c.status !== status) return false;
    if(yr && getYearBE(c.startDate) != yr) return false;
    if(q){
      var lq = q.toLowerCase();
      return c.id.toLowerCase().includes(lq) || c.name.toLowerCase().includes(lq) || c.customer.toLowerCase().includes(lq);
    }
    return true;
  }).sort(function(a,b){
    return (b.signDate||b.startDate||'').localeCompare(a.signDate||a.startDate||'');
  });

  // ── Summary bar ──
  var totalVal  = rows.reduce(function(s,c){return s+c.value;},0);
  var activeN   = rows.filter(function(c){return c.status==='active';}).length;
  var expiring  = rows.filter(function(c){
    if(c.status!=='active'||!c.endDate) return false;
    var diff = (pd(c.endDate)-now)/(1000*60*60*24);
    return diff >= 0 && diff <= 30;
  }).length;
  var bar = document.getElementById('ct-summary-bar');
  if(bar) bar.innerHTML = [
    {icon:'📄', label:'สัญญาทั้งหมด',    val:rows.length+' ฉบับ',  c:'var(--indigo)'},
    {icon:'💰', label:'มูลค่ารวม',        val:fca(totalVal),         c:'var(--violet)'},
    {icon:'✅', label:'มีผลบังคับ',       val:activeN+' ฉบับ',      c:'var(--teal)'},
    {icon:'⏰', label:'ใกล้หมดอายุ (30 วัน)', val:expiring+' ฉบับ',c:expiring>0?'var(--coral)':'var(--txt3)'},
  ].map(function(s){
    return '<div style="display:flex;align-items:center;gap:10px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:10px 16px;flex:1;min-width:150px;">'
      +'<div style="width:36px;height:36px;border-radius:10px;background:'+s.c+'18;display:flex;align-items:center;justify-content:center;font-size:18px;">'+s.icon+'</div>'
      +'<div><div style="font-size:10px;color:var(--txt3);font-weight:600;text-transform:uppercase;letter-spacing:.5px;">'+s.label+'</div>'
      +'<div style="font-size:15px;font-weight:800;color:'+s.c+';">'+s.val+'</div></div>'
      +'</div>';
  }).join('');

  // ── Table rows ──
  var tb = document.getElementById('ct-rows');
  if(!tb) return;
  if(rows.length === 0){
    tb.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:48px;color:var(--txt3);">'
      +'<div style="font-size:36px;margin-bottom:10px;">📄</div>'
      +'<div style="font-size:13px;font-weight:600;">ไม่พบข้อมูลสัญญา</div></td></tr>';
    return;
  }

  tb.innerHTML = rows.map(function(c){
    var st   = ctSt(c.status);
    var endD = c.endDate ? pd(c.endDate) : null;
    var diff = endD ? Math.ceil((endD - now)/(1000*60*60*24)) : null;
    var expWarn = (c.status==='active' && diff!==null && diff >= 0 && diff <= 30);
    var expired  = (c.status==='active' && diff!==null && diff < 0);
    var endStyle = (expWarn||expired) ? 'color:var(--coral);font-weight:700;' : '';
    var canEdit  = window.ce ? window.ce() : false;
    return '<tr class="fade">'
      +'<td><span style="font-family:\'JetBrains Mono\',monospace;font-size:11px;color:var(--txt3);">'+esc(c.id)+'</span></td>'
      +'<td style="font-weight:600;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+esc(c.name)+'</td>'
      +'<td style="color:var(--txt2);">'+esc(c.customer)+'</td>'
      +'<td style="text-align:right;font-weight:700;color:var(--violet);">'+fca(c.value)+'</td>'
      +'<td style="white-space:nowrap;color:var(--txt2);">'+(c.signDate?fd(c.signDate):'—')+'</td>'
      +'<td style="white-space:nowrap;color:var(--txt2);">'+(c.startDate?fd(c.startDate):'—')+'</td>'
      +'<td style="white-space:nowrap;'+endStyle+'">'
        +(c.endDate?fd(c.endDate)+(expWarn?' ⚠️':'')+(expired?' (หมดแล้ว)':''):'—')
      +'</td>'
      +'<td><span style="background:'+st.color+'18;color:'+st.color+';font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;border:1px solid '+st.color+'30;white-space:nowrap;">'+st.label+'</span></td>'
      +'<td style="text-align:right;white-space:nowrap;">'
        +(canEdit ? '<button class="btn btn-ghost btn-sm" onclick="window.openContractModal(\''+c.id+'\')">✏️</button>'
                    +'<button class="btn btn-ghost btn-sm" style="color:var(--coral)" onclick="window.askDel(\'contract\',\''+c.id+'\',\''+esc(c.name||c.id)+'\')">🗑</button>'
                  : '<button class="btn btn-ghost btn-sm" onclick="window.openContractModal(\''+c.id+'\')">👁 ดู</button>')
      +'</td>'
      +'</tr>';
  }).join('');
};

// ── OPEN MODAL ───────────────────────────────────────────────────────────────
window.openContractModal = function(id){
  var c = id ? window.CONTRACTS.find(function(x){return x.id===id;}) : null;
  var isNew = !c;
  document.getElementById('m-contract-title').textContent = isNew ? 'เพิ่มสัญญา' : 'แก้ไขสัญญา';
  var badge = document.getElementById('m-contract-id-badge');
  badge.style.display = isNew ? 'none' : '';
  badge.textContent   = isNew ? '' : c.id;
  document.getElementById('ctf-id').value       = isNew ? '' : c.id;
  document.getElementById('ctf-code').value     = isNew ? '' : c.id;
  document.getElementById('ctf-code').disabled  = !isNew;
  document.getElementById('ctf-name').value     = isNew ? '' : (c.name||'');
  document.getElementById('ctf-customer').value = isNew ? '' : (c.customer||'');
  document.getElementById('ctf-value').value    = isNew ? '' : (c.value||'');
  document.getElementById('ctf-sign').value     = isNew ? '' : (c.signDate||'');
  document.getElementById('ctf-start').value    = isNew ? '' : (c.startDate||'');
  document.getElementById('ctf-end').value      = isNew ? '' : (c.endDate||'');
  document.getElementById('ctf-note').value     = isNew ? '' : (c.note||'');
  document.getElementById('ctf-status').value   = isNew ? 'active' : (c.status||'active');

  // footer: show delete only when editing and user has edit right
  var foot = document.getElementById('m-contract-foot');
  if(foot){
    var canEdit = window.ce ? window.ce() : false;
    foot.innerHTML = (canEdit && !isNew
      ? '<button class="btn btn-ghost" style="color:var(--coral);margin-right:auto" onclick="window.askDel(\'contract\',\''+c.id+'\',\''+esc((c.name||c.id)).replace(/'/g,'\\\'')+'\')" >🗑 ลบ</button>'
      : '<span></span>')
      +'<button class="btn btn-ghost" onclick="window.closeM(\'m-contract\')">ยกเลิก</button>'
      +(canEdit ? '<button class="btn btn-pri" onclick="window.saveContract()">💾 บันทึก</button>' : '');
  }
  window.openM('m-contract');
};

// ── SAVE ─────────────────────────────────────────────────────────────────────
window.saveContract = async function(){
  if(!window.auth||!window.auth.currentUser){ window.showAlert('กรุณาเข้าสู่ระบบ','warn'); return; }
  var editId   = document.getElementById('ctf-id').value.trim();
  var codeVal  = document.getElementById('ctf-code').value.trim();
  var nameVal  = document.getElementById('ctf-name').value.trim();
  var custVal  = document.getElementById('ctf-customer').value.trim();
  var valNum   = Number(document.getElementById('ctf-value').value)||0;
  var signVal  = document.getElementById('ctf-sign').value;
  var startVal = document.getElementById('ctf-start').value;
  var endVal   = document.getElementById('ctf-end').value;
  var noteVal  = document.getElementById('ctf-note').value.trim();
  var statVal  = document.getElementById('ctf-status').value;

  if(!codeVal){ window.showAlert('กรุณาระบุรหัสสัญญา','warn'); return; }
  if(!nameVal){ window.showAlert('กรุณาระบุชื่อโครงการ','warn'); return; }
  if(!custVal){ window.showAlert('กรุณาระบุชื่อลูกค้า / คู่สัญญา','warn'); return; }

  var docId = editId || codeVal;
  // ตรวจรหัสซ้ำสำหรับสัญญาใหม่
  if(!editId && window.CONTRACTS.find(function(x){return x.id===docId;})){
    window.showAlert('รหัสสัญญา "'+docId+'" มีอยู่แล้ว กรุณาใช้รหัสอื่น','warn'); return;
  }

  var payload = {
    contract_id:          docId,
    project_name:         nameVal,
    customer_name:        custVal,
    total_contract_value: valNum,
    contract_sign_date:   signVal,
    contract_start_date:  startVal,
    end_date:             endVal,
    note:                 noteVal,
    status:               statVal,
  };

  try {
    await setDoc(getDocRef('CONTRACTS', docId), payload);
    window.closeM('m-contract');
    window.showAlert((editId ? 'แก้ไข' : 'เพิ่ม')+'สัญญาเรียบร้อยแล้ว','success');
  } catch(e){
    window.showDbError(e);
  }
};

// ── SMART SEARCH: ค้นหาลูกค้าจาก HOSPITALS ──────────────────────────────────
window._ctCustomerSearch = function(q){
  var dd = document.getElementById('ctf-customer-dd');
  if(!dd) return;
  if(!q || q.length < 1){ dd.style.display='none'; return; }
  var lq = q.toLowerCase();
  var matches = (window.HOSPITALS||[]).filter(function(h){
    return h.name.toLowerCase().includes(lq)
      || (h.code && h.code.toLowerCase().includes(lq))
      || (h.province && h.province.includes(q))
      || (h.district && h.district.includes(q));
  }).slice(0,10);
  if(matches.length === 0){ dd.style.display='none'; return; }
  dd.innerHTML = matches.map(function(h){
    var sub = [h.code, h.province, h.district].filter(Boolean).join(' · ');
    return '<div style="padding:9px 14px;cursor:pointer;border-bottom:1px solid var(--border);transition:background .1s;"'
      +' onmousedown="window._ctSelectCustomer(\''+h.name.replace(/'/g,'\\\'')+'\')"'
      +' onmouseenter="this.style.background=\'var(--surface2)\'" onmouseleave="this.style.background=\'\'">'
      +'<div style="font-size:13px;font-weight:600;color:var(--txt);">'+esc(h.name)+'</div>'
      +(sub?'<div style="font-size:11px;color:var(--txt3);margin-top:1px;">'+esc(sub)+'</div>':'')
      +'</div>';
  }).join('');
  dd.style.display='block';
};

window._ctSelectCustomer = function(name){
  var inp = document.getElementById('ctf-customer');
  var dd  = document.getElementById('ctf-customer-dd');
  if(inp) inp.value = name;
  if(dd)  dd.style.display = 'none';
};

// ── DELETE (hook into existing askDel/execDelete) ─────────────────────────────
// เพิ่ม 'contract' → 'CONTRACTS' map ใน sheetMap ของ modals.js ไม่ได้โดยตรง
// แต่ใช้ชื่อ type 'contract' ผ่าน deleteContract แทน
window.deleteContract = async function(id){
  if(!window.auth||!window.auth.currentUser) return;
  window.CONTRACTS = window.CONTRACTS.filter(function(x){return x.id!==id;});
  window.renderContract();
  try {
    await deleteDoc(getDocRef('CONTRACTS', id));
  } catch(e){
    window.showDbError(e);
  }
};
