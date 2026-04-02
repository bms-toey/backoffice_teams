import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDTQe8s5FCelKcXzkQdWb7Ur0R-HGq6t98",
  authDomain: "bms-backoffice-teams.firebaseapp.com",
  projectId: "bms-backoffice-teams",
  storageBucket: "bms-backoffice-teams.firebasestorage.app",
  messagingSenderId: "248142210178",
  appId: "1:248142210178:web:f459bdb838550bf23c809b",
  measurementId: "G-L4WNTCZ45C"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
window.auth = auth;
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'backoffice-teams-app';

window.getColRef = (colName) => collection(db, 'artifacts', appId, 'public', 'data', colName);
window.getDocRef = (colName, docId) => doc(db, 'artifacts', appId, 'public', 'data', colName, docId);

window.STAGES = [];
window.PTYPES = [];
window.STAFF = [];
window.USERS = [];
window.PROJECTS = [];
window.ADVANCES = [];
window.DEPARTMENTS = ['IT','Finance','PM','HR','Marketing','Operations','Procurement','Other'];
window.POSITIONS = [];
window.PGROUPS = [];
window.LODGINGS = [];
window.HOLIDAYS = [];
window.LEAVES = [];
window.NOTIFY_TOKEN = '';

window.AFLW=[
  {id:'draft',label:'Draft',color:'#9ba3b8'},
  {id:'pending',label:'รออนุมัติ',color:'#ffa62b'},
  {id:'approved',label:'อนุมัติแล้ว',color:'#4361ee'},
  {id:'disbursed',label:'เบิกแล้ว',color:'#7c5cfc'},
  {id:'clearing',label:'รอเคลียร์',color:'#ff6b6b'},
  {id:'cleared',label:'เคลียร์แล้ว',color:'#06d6a0'},
];
window.ANXT={draft:'pending',pending:'approved',approved:'disbursed',disbursed:'clearing',clearing:'cleared'};
window.APRV={pending:'draft',approved:'pending',disbursed:'approved',clearing:'disbursed',cleared:'clearing'};
window.THMON=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
window.DNAMES=['อา','จ','อ','พ','พฤ','ศ','ส'];
window.PCOLS=['#4361ee','#7c5cfc','#ff6b6b','#06d6a0','#ffa62b','#4cc9f0','#f72585','#3a0ca3'];
window.AVBG=['#7c5cfc','#ff6b6b','#06d6a0','#ffa62b','#4cc9f0','#f72585','#4361ee','#3a0ca3'];

window.IMPORT_SCHEMAS = {
  'PROJECTS': { idField:'project_id',prefix:'P', headers:["project_name","group_id","site_owner","type_id","stage_id","budget","start_date","end_date","revisit_1","revisit_2","progress_pct","note","pm_staff_id"], example:["โครงการตัวอย่าง A","","คุณสมชาย","gen","init","100000","2026-01-01","2026-12-31","","","0","หมายเหตุ",""] },
  'STAFF': { idField:'staff_id',prefix:'S', headers:["full_name","nickname","department","position","email","phone","start_date","birth_date","is_active","remark"], example:["สมชาย ใจดี","ชาย","IT","Developer","somchai@test.com","0812345678","2024-01-01","1990-01-01","TRUE",""] },
  'USERS': { idField:'user_id',prefix:'U', headers:["username","password","name","role","is_active"], example:["newuser","pass1234","ชื่อผู้ใช้","viewer","TRUE"] },
  'ADVANCES': { idField:'advance_id',prefix:'A', headers:["project_id","purpose","amount_requested","amount_cleared","request_date","due_date","status","note","advance_no"], example:["P123","ค่าที่พัก","5000","0","2026-01-10","2026-01-20","draft","","ADV-001"] },
  'PGROUPS': { idField:'group_id',prefix:'GRP', headers:["label_th","color_hex"], example:["ภาคเหนือ","#4361ee"] },
  'PTYPES': { idField:'type_id',prefix:'T', headers:["label_th","color_hex"], example:["งานติดตั้ง","#06d6a0"] },
  'POSITIONS': { idField:'position_id',prefix:'POS', headers:["label_th"], example:["Project Manager"] }
};

window.isDbLoaded = false;
window.cu = null;
window.advFilter = '';
window.calY = new Date().getFullYear();
window.calM = new Date().getMonth();
window.wlY = new Date().getFullYear();
window.wlM = new Date().getMonth();
window.calView = 'staff';
window.calTime = 'month';
window.editPid = null;
window.editAid = null;
window.delTarget = null;
window.editLdId = null;
window.currentLdPid = null;
window.cStage = null;
window.cBudget = null;
window.kbPid = null;
window.admCur = 'staff';
window._loginRetryInterval = null;

window.isAdmin = function() { return window.cu && window.cu.role === 'admin'; }
window.ce = function() { return window.cu && (window.cu.role === 'admin' || window.cu.role === 'pm'); }
window.cl = function() { return window.cu !== null; }
window.roleLabel = function(r){ return r==='pm'?'DM/PM':r?r.toUpperCase():''; }

window.uid = function(){return Math.random().toString(36).slice(2,9);}
window.fc = function(n){return new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',maximumFractionDigits:0}).format(n||0);}
window.fca = function(n){return new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',minimumFractionDigits:2,maximumFractionDigits:2}).format(n||0);}
window.fd = function(s){if(!s)return'-';var d=new Date(s);if(isNaN(d))return'-';return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+(d.getFullYear()+543);}
window.getFY = function(dateStr){if(!dateStr)return'';let d=new Date(dateStr);if(isNaN(d))return'';let y=d.getFullYear();let m=d.getMonth();if(m>=9)y+=1;return y+543;}
window.getYearBE = function(dateStr){if(!dateStr)return'';let d=new Date(dateStr);if(isNaN(d))return'';return d.getFullYear()+543;}
window.pd = function(s){if(!s)return new Date('1970-01-01');let p=s.split('-');if(p.length===3)return new Date(p[0],p[1]-1,p[2]);return new Date(s);}
window.gS = function(id){return window.STAGES.find(s=>s.id===id)||{label:id,color:'#9ba3b8'};}
window.gT = function(id){return window.PTYPES.find(t=>t.id===id)||{label:id,color:'#9ba3b8'};}
window.gG = function(id){return window.PGROUPS.find(g=>g.id===id)||null;}
window.gSt = function(id){return window.STAFF.find(s=>s.id===id)||{name:'?',dept:''};}
window.gC = function(i){return window.PCOLS[i%window.PCOLS.length];}
window.avC = function(i){return window.AVBG[i%window.AVBG.length];}
window.esc = function(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

window.getStaffOverlaps = function(sid, startStr, endStr, excludePid) {
  if(!startStr || !endStr) return [];
  let sDate = pd(startStr);
  let eDate = pd(endStr); eDate.setHours(23,59,59);
  let overlaps = [];
  window.PROJECTS.forEach(p => {
    if(p.status==='cancelled'||p.status==='completed') return;
    if(excludePid && p.id===excludePid) return;
    let mems = p.members&&p.members.length>0 ? p.members : p.team.map(id=>({sid:id,s:p.start,e:p.end}));
    let mbList = mems.filter(m=>m.sid===sid);
    mbList.forEach(mb => {
      if(mb.s&&mb.e){
        let ms=pd(mb.s),me=pd(mb.e);me.setHours(23,59,59);
        if(ms<=eDate&&me>=sDate){
          // คำนวณช่วงที่ซ้อนกัน
          let overlapStart = ms > sDate ? ms : sDate;
          let overlapEnd   = me < eDate ? me : eDate;
          overlaps.push({project:p, from:overlapStart, to:overlapEnd});
        }
      }
    });
  });
  // deduplicate by project id
  let seen={};
  return overlaps.filter(o=>{ if(seen[o.project.id]) return false; seen[o.project.id]=true; return true; });
}

window.overlapWarnText = function(overlaps){
  if(!overlaps||overlaps.length===0) return '';
  return overlaps.map(function(o){
    return `⚠ มีงานอื่นซ้อนทับ: ${esc(o.project.name)} (${fd(o.from.toISOString().slice(0,10))} – ${fd(o.to.toISOString().slice(0,10))})`;
  }).join('<br>');
}

window.getStaffLeaveConflicts = function(sid, startStr, endStr) {
  if(!startStr||!endStr||!window.LEAVES) return [];
  var sDate=pd(startStr);
  var eDate=pd(endStr);eDate.setHours(23,59,59);
  var LEAVE_EMOJI={sick:'🤒',vacation:'🏖',personal:'📋',maternity:'🤱',ordain:'🙏',other:'📝'};
  var LEAVE_LABEL={sick:'ลาป่วย',vacation:'ลาพักร้อน',personal:'ลากิจ',maternity:'ลาคลอด',ordain:'ลาบวช',other:'อื่นๆ'};
  return window.LEAVES.filter(function(lv){
    if(lv.staffId!==sid)return false;
    if(lv.status==='rejected')return false;
    if(!lv.startDate||!lv.endDate)return false;
    var ls=pd(lv.startDate),le=pd(lv.endDate);le.setHours(23,59,59);
    return ls<=eDate&&le>=sDate;
  }).map(function(lv){
    var emoji=LEAVE_EMOJI[lv.leaveType]||'📝';
    var label=LEAVE_LABEL[lv.leaveType]||lv.leaveType;
    return{leave:lv,emoji:emoji,label:label};
  });
}

window.showLoader = function(txt){
  document.getElementById('sys-loader-text').innerHTML = txt || 'กำลังโหลดข้อมูล...';
  var pulse = document.querySelector('#sys-loader .pulse');
  if(pulse) pulse.style.display = 'inline-block';
  document.getElementById('sys-loader').classList.add('on');
}
window.hideLoader = function(){
  document.getElementById('sys-loader').classList.remove('on');
}

window.showDbError = function(err){
  console.error("Database Error:", err);
  let errorMsg = '<div style="color:var(--coral);font-weight:bold;font-size:16px;margin-bottom:8px;">❌ ข้อผิดพลาดในการเชื่อมต่อ</div>';
  if(err.message && err.message.includes('Missing or insufficient permissions')){
    errorMsg += '<div style="font-size:13px;color:var(--txt);text-align:left;background:var(--surface2);padding:12px;border-radius:8px;border:1px solid var(--border);max-width:500px;line-height:1.5;">';
    errorMsg += '<strong>สาเหตุ:</strong> Firestore Rules ปฏิเสธการเข้าถึง<br><br>';
    errorMsg += '<strong>วิธีแก้:</strong><br>';
    errorMsg += '1. ไปที่ <a href="https://console.firebase.google.com/" target="_blank" style="color:var(--violet)">Firebase Console</a><br>';
    errorMsg += '2. เลือก <strong>Firestore Database</strong> → แท็บ <strong>Rules</strong><br>';
    errorMsg += '3. วางโค้ดนี้แล้วกด <strong>Publish</strong>:<br>';
    errorMsg += '<pre style="background:#1a1d2e;color:#06d6a0;padding:10px;border-radius:6px;margin-top:8px;overflow-x:auto;font-size:12px;">rules_version = "2";\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if true;\n    }\n  }\n}</pre>';
    errorMsg += '</div>';
  } else {
    errorMsg += `<div style="font-size:12px;color:var(--txt2)">${err.message}</div>`;
  }
  document.getElementById('sys-loader-text').innerHTML = errorMsg;
  var pulse = document.querySelector('#sys-loader .pulse');
  if(pulse) pulse.style.display = 'none';
  document.getElementById('sys-loader').classList.add('on');
}

