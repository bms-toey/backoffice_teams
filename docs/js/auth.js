import { getFirestore, onSnapshot, getDocs, writeBatch, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
const db = getFirestore();
const auth = window.auth;
const { esc, fd, fc, fca, pd, gS, gT, gG, gSt, gC, avC, uid, getFY, getYearBE, getStaffOverlaps, overlapWarnText, getStaffLeaveConflicts, getColRef, getDocRef } = window;
// ── FIREBASE AUTH ──
async function initAuth(){
  try {
    if(typeof __initial_auth_token !== 'undefined' && __initial_auth_token){
      try { await signInWithCustomToken(auth, __initial_auth_token); }
      catch(tokenErr){ await signInAnonymously(auth); }
    } else {
      await signInAnonymously(auth);
    }
  } catch(err){
    window.showDbError(new Error("Authentication failed: " + err.message + "\n\n⚠️ ต้องเปิด Anonymous Sign-in ใน Firebase Console ก่อน"));
  }
}

async function seedDatabaseIfEmpty(){
  if(!auth.currentUser) return;
  const usersSnap = await getDocs(getColRef('USERS'));
  if(usersSnap.empty){
    const batch = writeBatch(db);
    const defaultUsers = [
      {id:'U1',username:'admin',password:'admin123',role:'admin',name:'Admin User'},
      {id:'U2',username:'pm1',password:'pm1234',role:'pm',name:'Project Manager 1'},
      {id:'U3',username:'viewer',password:'view1234',role:'viewer',name:'Viewer User'}
    ];
    defaultUsers.forEach(u => batch.set(getDocRef('USERS',u.id),u));
    const defaultStages = [
      {id:'pending',label:'รอดำเนินการ',color:'#9ba3b8',order:1},
      {id:'plan',label:'วางแผน',color:'#ffa62b',order:2},
      {id:'exec',label:'ดำเนินการ',color:'#4361ee',order:3},
      {id:'deliver',label:'ส่งมอบ',color:'#7c5cfc',order:4},
      {id:'close',label:'ปิดโครงการ',color:'#06d6a0',order:5}
    ];
    defaultStages.forEach(s => batch.set(getDocRef('STAGES',s.id),s));
    const defaultPTypes = [
      {id:'gen',label:'General',color:'#4361ee'},
      {id:'urg',label:'Urgent',color:'#ff6b6b'}
    ];
    defaultPTypes.forEach(t => batch.set(getDocRef('PTYPES',t.id),t));
    await batch.commit();
  }
}

function setupRealtimeListeners(){
  if(!auth.currentUser) return;
  const colls = ['STAGES','PTYPES','PGROUPS','STAFF','USERS','PROJECTS','ADVANCES','LODGINGS','POSITIONS','HOLIDAYS','LEAVES','TIMESHEETS','COSTS'];
  let loadCount = 0;

  const checkLoaded = () => {
    loadCount++;
    if(loadCount === colls.length){
      window.isDbLoaded = true;
      window.hideLoader();
      if(window.cu){ window.setupUser(); window.renderAll(); window.startAutoStageLoop(); }
    } else if(loadCount > colls.length){
      if(window.cu && window.kbPid===null) window.renderAll();
      if(window.cu) window.runAutoStage(true);
    }
  };

  onSnapshot(getColRef('STAGES'), s => {
    window.STAGES = s.docs.map(doc=>{let d=doc.data();return{id:d.stage_id||d.id,label:d.label_th||d.label,color:d.color_hex||d.color,order:d.order||99,autoRule:d.auto_rule||'',autoOffset:Number(d.auto_offset||0),setProgress:Number(d.set_progress||-1)};}).sort((a,b)=>a.order-b.order);
    checkLoaded();
  }, e=>window.showDbError(e));

  onSnapshot(getColRef('PTYPES'), s => {
    window.PTYPES = s.docs.map(doc=>{let d=doc.data();return{id:d.type_id||d.id,label:d.label_th||d.label,color:d.color_hex||d.color};});
    checkLoaded();
  }, e=>window.showDbError(e));

  onSnapshot(getColRef('PGROUPS'), s => {
    window.PGROUPS = s.docs.map(doc=>{let d=doc.data();return{id:d.group_id||d.id,label:d.label_th||d.label,color:d.color_hex||d.color};});
    checkLoaded();
  }, e=>window.showDbError(e));

  onSnapshot(getColRef('STAFF'), s => {
    window.STAFF = s.docs.map(doc=>{
      let d=doc.data();
      return{id:d.staff_id||d.id,name:d.full_name||d.name||'',nickname:d.nickname||(d.full_name||d.name||'').split(' ')[0],dept:d.department||d.dept,role:d.position||d.role,email:d.email,phone:d.phone,active:d.is_active!==false&&d.is_active!=='FALSE',start_date:d.start_date,birth_date:d.birth_date,remark:d.remark,dailyRate:d.daily_rate!=null?Number(d.daily_rate):null};
    });
    let depts=[...new Set(window.STAFF.map(st=>st.dept).filter(Boolean))];
    if(depts.length>0) window.DEPARTMENTS=depts;
    checkLoaded();
  }, e=>window.showDbError(e));

  onSnapshot(getColRef('USERS'), s => {
    window.USERS = s.docs.map(doc=>{
      let d=doc.data();
      return{id:d.user_id||d.id,username:d.username,password:d.password,name:d.name||d.display_name||'',role:d.role,active:d.is_active!==false&&d.is_active!=='FALSE',staffId:d.staff_id||''};
    });
    checkLoaded();
  }, e=>window.showDbError(e));

  onSnapshot(getColRef('PROJECTS'), s => {
    window.PROJECTS = s.docs.map(doc=>{
      let d=doc.data();
      var rawStart=d.start_date||d.startDate||d.start||d['start-date']||'';
      var rawEnd=d.end_date||d.endDate||d.end||d['end-date']||'';
      var rawR1=d.revisit_1||d.revisit1||d.revisitOne||'';
      var rawR2=d.revisit_2||d.revisit2||d.revisitTwo||'';
      // แปลง Firestore Timestamp เป็น string
      function tsToStr(v){if(!v)return'';if(typeof v==='string')return v;if(v&&v.toDate){var dt=v.toDate();return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');}return String(v);}
      return{id:d.project_id||d.id,name:d.project_name||d.name||'',groupId:d.group_id||d.groupId||'',siteOwner:d.site_owner||d.siteOwner||'',typeId:d.type_id||d.typeId||'',stage:d.stage_id||d.stage||'init',cost:Number(d.budget||d.cost)||0,start:tsToStr(rawStart),end:tsToStr(rawEnd),revisit1:tsToStr(rawR1),revisit2:tsToStr(rawR2),parentProjectId:d.parentProjectId||d.parent_project_id||'',revisitRound:Number(d.revisitRound||d.revisit_round)||0,progress:Number(d.progress_pct||d.progress)||0,note:d.note||'',status:d.status||'active',pm:d.pm_staff_id||d.pm||'',team:d.team||[],members:d.members||[],isBorder:d.is_border===true||d.is_border==='TRUE',visits:(d.visits||[]).map(function(v){return{id:v.id||('V'+Math.random().toString(36).slice(2,7)),no:v.no||1,start:tsToStr(v.start||v.start_date||''),end:tsToStr(v.end||v.end_date||''),purpose:v.purpose||'',team:v.team||[],status:v.status||'planned',note:v.note||''};})};
    });
    checkLoaded();
  }, e=>window.showDbError(e));

  onSnapshot(getColRef('ADVANCES'), s => {
    window.ADVANCES = s.docs.map(doc=>{
      let d=doc.data();
      return{id:d.advance_id||d.id,pid:d.project_id||d.pid,purpose:d.purpose||'',amount:Number(d.amount_requested||d.amount)||0,cleared:Number(d.amount_cleared||d.cleared)||0,rdate:d.request_date||d.rdate||'',ddate:d.due_date||d.ddate||'',status:d.status||'draft',note:d.note||'',advno:d.advance_no||d.advno||'',expenseItems:d.expense_items||[],laborItems:d.labor_items||[]};
    });
    checkLoaded();
  }, e=>window.showDbError(e));

  onSnapshot(getColRef('LODGINGS'), s => {
    window.LODGINGS = s.docs.map(doc=>{
      let d=doc.data();
       return{id:d.lodging_id||d.id,pid:d.project_id||d.pid,name:d.lodging_name||d.name||'',mapUrl:d.map_url||d.mapUrl||'',phone:d.phone||'',checkIn:d.check_in||d.checkIn||'',checkOut:d.check_out||d.checkOut||'',
         dsQty:Number(d.ds_qty||d.dsQty)||0,dsRate:Number(d.ds_rate||d.dsRate)||0,ddQty:Number(d.dd_qty||d.ddQty)||0,ddRate:Number(d.dd_rate||d.ddRate)||0,dTotal:Number(d.d_total||d.dTotal)||0,
         dWifi:d.d_wifi===true||d.d_wifi==='TRUE',dPillow:d.d_pillow===true||d.d_pillow==='TRUE',dBlanket:d.d_blanket===true||d.d_blanket==='TRUE',
         dApp:d.d_appliance===true||d.d_appliance==='TRUE',dPark:d.d_parking===true||d.d_parking==='TRUE',
         dAc:d.d_ac===true||d.d_ac==='TRUE',dFridge:d.d_fridge===true||d.d_fridge==='TRUE',dWasher:d.d_washer===true||d.d_washer==='TRUE',
         dTv:d.d_tv===true||d.d_tv==='TRUE',dShower:d.d_shower===true||d.d_shower==='TRUE',dBreakfast:d.d_breakfast===true||d.d_breakfast==='TRUE',
         dTowel:d.d_towel===true||d.d_towel==='TRUE',dCustom:d.d_custom||'',
         dDeposit:Number(d.d_deposit)||0,dDepositNote:d.d_deposit_note||'',
         msQty:Number(d.ms_qty||d.msQty)||0,msRate:Number(d.ms_rate||d.msRate)||0,mdQty:Number(d.md_qty||d.mdQty)||0,mdRate:Number(d.md_rate||d.mdRate)||0,mTotal:Number(d.m_total||d.mTotal)||0,
         mWifi:d.m_wifi===true||d.m_wifi==='TRUE',mPillow:d.m_pillow===true||d.m_pillow==='TRUE',mBlanket:d.m_blanket===true||d.m_blanket==='TRUE',
         mApp:d.m_appliance===true||d.m_appliance==='TRUE',mPark:d.m_parking===true||d.m_parking==='TRUE',
         mAc:d.m_ac===true||d.m_ac==='TRUE',mFridge:d.m_fridge===true||d.m_fridge==='TRUE',mWasher:d.m_washer===true||d.m_washer==='TRUE',
         mTv:d.m_tv===true||d.m_tv==='TRUE',mShower:d.m_shower===true||d.m_shower==='TRUE',mBreakfast:d.m_breakfast===true||d.m_breakfast==='TRUE',
         mBedsheet:d.m_bedsheet===true||d.m_bedsheet==='TRUE',mTowel:d.m_towel===true||d.m_towel==='TRUE',mCustom:d.m_custom||'',
         mDeposit:Number(d.m_deposit)||0,mDepositNote:d.m_deposit_note||'',mWater:d.m_water||'',mElectric:d.m_electric||'',mExtras:d.m_extras||'',mInclUtil:d.m_incl_util==='TRUE',
         total:Number(d.grand_total||d.total)||0,note:d.note||'',approved:d.approved||'',approvedAt:d.approved_at||'',approvedBy:d.approved_by||'',approvedDaily:d.approved_daily||'',approvedMonthly:d.approved_monthly||''};
    });
    checkLoaded();
  }, e=>window.showDbError(e));

  onSnapshot(getColRef('POSITIONS'), s => {
    window.POSITIONS = s.docs.map(doc=>{let d=doc.data();return{id:d.position_id||d.id,label:d.label_th||d.label,dailyRate:Number(d.daily_rate)||0};});
    checkLoaded();
  }, e=>window.showDbError(e));

  onSnapshot(getColRef('HOLIDAYS'), s => {
    function _holNorm(raw){if(!raw)return'';var m=raw.match(/^(\d{4})(-.+)$/);if(!m)return raw;var y=Number(m[1]);return(y>=2500?(y-543):y)+m[2];}
    window.HOLIDAYS = s.docs.map(doc=>{let d=doc.data();return{id:d.holiday_id||d.id,name:d.name||'',date:_holNorm(d.date||''),type:d.type||'national'};}).sort(function(a,b){return(a.date||'').localeCompare(b.date||'');});
    checkLoaded();
    if(window.cu&&document.getElementById('view-holidays')&&document.getElementById('view-holidays').classList.contains('on'))window.renderHolidays();
    if(window.cu&&window.calTime==='month')window.renderCalendar();
  }, e=>window.showDbError(e));

  onSnapshot(getColRef('LEAVES'), s => {
    window.LEAVES = s.docs.map(doc=>{let d=doc.data();return{id:d.leave_id||d.id,staffId:d.staff_id||'',leaveType:d.leave_type||'other',startDate:d.start_date||'',endDate:d.end_date||'',substituteId:d.substitute_id||'',note:d.note||'',status:d.status||'pending',approvedBy:d.approved_by||''};});
    checkLoaded();
    if(window.cu&&document.getElementById('view-leave')&&document.getElementById('view-leave').classList.contains('on'))window.renderLeave();
    if(window.cu&&document.getElementById('view-calendar')&&document.getElementById('view-calendar').classList.contains('on'))window.renderCalendar();
  }, e=>window.showDbError(e));

  onSnapshot(getColRef('TIMESHEETS'), s => {
    window.TIMESHEETS = s.docs.map(doc=>{let d=doc.data();return{id:d.timesheet_id||d.id,pid:d.project_id||d.pid||'',staffId:d.staff_id||'',workDate:d.work_date||'',visitStart:d.visit_start||'',visitEnd:d.visit_end||'',hours:Number(d.hours)||0,category:d.category||'other',description:d.description||'',source:d.source||''};});
    checkLoaded();
    if(window.cu&&document.getElementById('view-timesheet')&&document.getElementById('view-timesheet').classList.contains('on'))window.renderTimesheet();
    if(window.cu&&document.getElementById('view-cost')&&document.getElementById('view-cost').classList.contains('on'))window.renderCost();
  }, e=>window.showDbError(e));

  onSnapshot(getColRef('COSTS'), s => {
    window.COSTS = s.docs.map(doc=>{let d=doc.data();return{id:d.cost_id||d.id,pid:d.project_id||d.pid||'',staffId:d.staff_id||'',category:d.category||'other',amount:Number(d.amount)||0,costDate:d.cost_date||'',description:d.description||'',receiptNo:d.receipt_no||'',source:d.source||'',advanceId:d.advance_id||''};});
    checkLoaded();
    if(window.cu&&document.getElementById('view-cost')&&document.getElementById('view-cost').classList.contains('on'))window.renderCost();
  }, e=>window.showDbError(e));
}

onAuthStateChanged(auth, async (user) => {
  if(user){
    try {
      await seedDatabaseIfEmpty();
      setupRealtimeListeners();
      // โหลด SETTINGS แยก (ไม่บล็อก app load)
      onSnapshot(getDocRef('SETTINGS','app'), function(snap){
        var d=snap.exists()?snap.data():{};
        window.NOTIFY_TOKEN=d.notify_token||'';
        window.SETTINGS = {
          allowance_weekday_normal:  Number(d.allowance_weekday_normal)  || 350,
          allowance_holiday_normal:  Number(d.allowance_holiday_normal)  || 650,
          allowance_weekday_border:  Number(d.allowance_weekday_border)  || 650,
          allowance_holiday_border:  Number(d.allowance_holiday_border)  || 1250,
        };
      });
      // โหลด ROLE_PERMISSIONS แยก
      onSnapshot(getDocRef('SETTINGS','role_permissions'), function(snap){
        window.ROLE_PERMISSIONS = snap.exists() ? snap.data() : {};
        if (window.cu) window.setupUser();
      });
    } catch(err){
      window.showDbError(err);
    }
  }
});

// ================================================================
// LOGIN
// ================================================================

// Default users ใช้เป็น fallback ถ้า Firebase ยังไม่โหลด
var DEFAULT_USERS = [
  {id:'U1', username:'admin',  password:'admin123', role:'admin',  name:'Admin User',          active:true},
  {id:'U2', username:'pm1',    password:'pm1234',   role:'pm',     name:'Project Manager 1',   active:true},
  {id:'U3', username:'viewer', password:'view1234', role:'viewer', name:'Viewer User',         active:true},
];

function doLoginNow(u, p) {
  var btn   = document.getElementById('login-btn');
  var errEl = document.getElementById('lerr');
  var infoEl= document.getElementById('linfo');

  // ค้นจาก Firebase USERS ก่อน ถ้าโหลดแล้ว ไม่งั้นใช้ default
  var searchList = (window.USERS && window.USERS.length > 0) ? window.USERS : DEFAULT_USERS;
  var usr = searchList.find(function(x){ return x.username === u && x.password === p && x.active !== false; });

  if (!usr) {
    errEl.textContent  = '⚠ ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
    errEl.style.display= 'block';
    infoEl.style.display='none';
    if(btn){ btn.textContent='เข้าสู่ระบบ →'; btn.disabled=false; }
    return;
  }

  // Login สำเร็จ
  window.cu = usr;
  document.getElementById('login').style.display = 'none';
  document.getElementById('wrap').style.display   = 'flex';

  // reset view state ทุกครั้งที่ login ใหม่ (ไม่จำ view ของ session ก่อนหน้า)
  document.querySelectorAll('.view').forEach(function(v){v.classList.remove('on');});
  document.querySelectorAll('.nav-btn').forEach(function(n){n.classList.remove('on');});
  var defView=document.getElementById('view-overview');
  if(defView){defView.style.display='';defView.classList.add('on');}
  var defNav=document.querySelector('.nav-btn[onclick*="\'overview\'"]');
  if(defNav){defNav.classList.add('on');}
  var titleEl=document.getElementById('tp-title');
  if(titleEl) titleEl.textContent='Overview';

  if (window.isDbLoaded) {
    window.setupUser();
    window.renderAll();
  } else {
    // แสดง UI ก่อน แล้วรอ Firebase โหลดเสร็จค่อย render
    window.setupUser();
    var waitRender = setInterval(function(){
      if(window.isDbLoaded){
        clearInterval(waitRender);
        window.renderAll();
      }
    }, 300);
    // timeout 15 วิ — render ด้วยข้อมูลว่างๆ ไปก่อน
    setTimeout(function(){ clearInterval(waitRender); window.renderAll(); }, 15000);
  }
}

window.doLogin = function(){
  var u = document.getElementById('lu').value.trim();
  var p = document.getElementById('lp').value;
  if(!u || !p){
    document.getElementById('lerr').textContent='⚠ กรุณากรอก Username และ Password';
    document.getElementById('lerr').style.display='block';
    return;
  }
  doLoginNow(u, p);
};

document.getElementById('login-btn').addEventListener('click', window.doLogin);
document.getElementById('lp').addEventListener('keydown', function(e){ if(e.key==='Enter') window.doLogin(); });

window.doLogout = function(){
  window.cu = null;
  document.getElementById('wrap').style.display = 'none';
  document.getElementById('login').style.display = 'flex';
  document.getElementById('lu').value = '';
  document.getElementById('lp').value = '';
  document.getElementById('lerr').style.display = 'none';
  document.getElementById('linfo').style.display = 'none';
  var btn = document.getElementById('login-btn');
  if(btn){ btn.textContent = 'เข้าสู่ระบบ →'; btn.disabled = false; }
}

window.setupUser = function(){
  var roleColors={admin:'linear-gradient(135deg,#ff6b6b,#ffa62b)',pm:'linear-gradient(135deg,#7c5cfc,#4cc9f0)',viewer:'linear-gradient(135deg,#06d6a0,#4cc9f0)'};
  var av=document.getElementById('u-av');
  av.textContent=window.cu.name.charAt(0).toUpperCase();
  av.style.background=roleColors[window.cu.role]||'linear-gradient(135deg,#7c5cfc,#ff6b6b)';
  document.getElementById('u-name').textContent=window.cu.name;
  document.getElementById('u-role').textContent=window.roleLabel(window.cu.role);
  document.querySelectorAll('.admin-only').forEach(function(el){el.style.display=window.isAdmin()?'':'none';});
  document.querySelectorAll('.ce-only').forEach(function(el){el.style.display=window.ce()?'':'none';});
  document.querySelectorAll('.cl-only').forEach(function(el){el.style.display=window.cl()?'':'none'});
  // import button in topbar — admin only
  var btnImport=document.getElementById('btn-import-top');
  if(btnImport) btnImport.style.display=window.isAdmin()?'':'none';
  var uTab=document.getElementById('at-users');
  if(uTab) uTab.style.display=(window.cu.role==='admin')?'':'none';
  // ── apply nav visibility per role permissions ──
  var navModules=['overview','kanban','projects','advance','lodging','workload','calendar','leave','timesheet','cost'];
  navModules.forEach(function(m){
    var btn=document.querySelector('.nav-btn[onclick*="\''+m+'\'"]');
    if(!btn) return;
    var canSee=window.canView(m);
    btn.style.display=canSee?'':'none';
    if(!canSee) btn.classList.remove('on');
  });
  // ถ้า view ปัจจุบันถูกซ่อน → redirect ไปยัง module แรกที่เข้าได้ (ไม่ trigger alert)
  var activeView=document.querySelector('.view.on');
  if(activeView){
    var vid=activeView.id.replace('view-','');
    if(navModules.indexOf(vid)>=0 && !window.canView(vid)){
      var firstOk=navModules.find(function(m){return window.canView(m);});
      if(firstOk){
        var vLabels={overview:'Overview',kanban:'Delivery Board',projects:'โครงการทั้งหมด',advance:'Advance',lodging:'ระบบจัดหาที่พัก',workload:'สรุปภาระงาน',calendar:'ปฏิทินทีม',leave:'การลางาน',timesheet:'Timesheet',cost:'Cost Tracking'};
        // navigate โดยตรง (bypass goView alert check)
        document.querySelectorAll('.nav-btn').forEach(function(n){n.classList.remove('on');});
        document.querySelectorAll('.view').forEach(function(v){v.classList.remove('on');});
        var nb=document.querySelector('.nav-btn[onclick*="\''+firstOk+'\'"]');
        if(nb){nb.style.display='';nb.classList.add('on');}
        var vEl=document.getElementById('view-'+firstOk);
        if(vEl){vEl.style.display='';vEl.classList.add('on');}
        var titleEl=document.getElementById('tp-title');
        if(titleEl) titleEl.textContent=vLabels[firstOk]||firstOk;
        var rFn=window['render'+firstOk.charAt(0).toUpperCase()+firstOk.slice(1)];
        if(rFn) rFn();
      }
    }
  }
}

window.goView = function(id,el){
  // ตรวจสิทธิ์ view ก่อนนำทาง
  var _navMods=['overview','kanban','projects','advance','lodging','workload','calendar','leave','timesheet','cost'];
  if(_navMods.indexOf(id)>=0 && !window.canView(id)){
    window.showAlert('คุณไม่มีสิทธิ์เข้าถึง Module นี้','warn'); return;
  }
  document.querySelectorAll('.nav-btn').forEach(function(n){n.classList.remove('on');});
  if(el)el.classList.add('on');
  document.querySelectorAll('.view').forEach(function(v){v.classList.remove('on');});
  var v=document.getElementById('view-'+id);
  if(v){v.style.display='';v.classList.add('on');}
  var labels={overview:'Overview',kanban:'Delivery Board',projects:'โครงการทั้งหมด',advance:'Advance',lodging:'ระบบจัดหาที่พัก',workload:'สรุปภาระงาน',calendar:'ปฏิทินทีม',holidays:'วันหยุด',leave:'การลางาน',timesheet:'Timesheet',cost:'Cost Tracking'};
  document.getElementById('tp-title').textContent=labels[id]||id;
  var actions={};
  document.getElementById('tp-actions').innerHTML=actions[id]||'';
  if(id==='overview') window.renderOverview();
  if(id==='kanban') window.renderKanban();
  if(id==='projects') window.renderProjects();
  if(id==='advance') window.renderAdvance();
  if(id==='lodging') window.renderLodging();
  if(id==='workload') window.renderWorkload();
  if(id==='calendar') window.renderCalendar();
  if(id==='holidays') window.renderHolidays();
  if(id==='leave') window.renderLeave();
  if(id==='timesheet') window.renderTimesheet();
  if(id==='cost') window.renderCost();
}

window.toggleSB = function(){
  var sb=document.getElementById('sidebar');
  if(window.innerWidth<=768){
    window.toggleMobSidebar();
  } else {
    var btn=sb.querySelector('.sb-toggle');
    sb.classList.toggle('slim');
    if(btn) btn.textContent=sb.classList.contains('slim')?'▶':'◀';
  }
}
window.toggleMobSidebar = function(){
  var sb=document.getElementById('sidebar');
  var ov=document.getElementById('mob-sb-overlay');
  var isOpen=sb.classList.contains('mob-open');
  sb.classList.toggle('mob-open',!isOpen);
  if(ov) ov.classList.toggle('on',!isOpen);
}
window.closeMobSidebar = function(){
  var sb=document.getElementById('sidebar');
  var ov=document.getElementById('mob-sb-overlay');
  sb.classList.remove('mob-open');
  if(ov) ov.classList.remove('on');
}
// ปิด sidebar เมื่อ navigate บนมือถือ
var _origGoView = null;
(function(){
  var _base = window.goView;
  window.goView = function(id, el, noAlert){
    if(window.innerWidth<=768) window.closeMobSidebar();
    return _base(id, el, noAlert);
  };
})();

window.renderAll = function(){
  window.renderOverview();
  window.renderProjects();
  window.renderAdvance();
  window.renderLodging();
  window.renderWorkload();
  window.renderCalendar();
  window.renderTimesheet();
  window.renderCost();
  window.updateBadge();
}

window.forceSync = function(){
  var stat=document.getElementById('tp-status');
  if(stat){
    stat.innerHTML='<span class="pulse ok"></span> ซิงค์แล้ว';
    setTimeout(()=>{stat.innerHTML='<span class="pulse ok"></span> Realtime';},1500);
  }
}

window.updateBadge = function(){
  var ov=window.ADVANCES.filter(function(a){return a.ddate&&pd(a.ddate)<new Date()&&a.status!=='cleared';}).length;
  var nb=document.getElementById('adv-nb');nb.textContent=ov;nb.style.display=ov?'':'none';
  var td=document.getElementById('tp-overdue');var tt=document.getElementById('tp-overdue-txt');
  if(ov>0){td.style.display='flex';tt.textContent=ov+' Advance เกินกำหนด';}
  else td.style.display='none';
}

initAuth();
