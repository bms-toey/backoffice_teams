import { getFirestore, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
const db = getFirestore();
const { esc, fd, fc, fca, pd, gS, gT, gG, gSt, gC, avC, uid, getFY, getYearBE, getStaffOverlaps, overlapWarnText, getStaffLeaveConflicts, getColRef, getDocRef } = window;
// ── NOTIFY SETTINGS ──
window.renderNotifySettings=function(){
    var c=document.getElementById('adm-body');if(!c)return;
    var titleEl=document.getElementById('adm-head-title');
    if(titleEl)titleEl.innerHTML='🔔 ตั้งค่าการแจ้งเตือน';
    c.innerHTML='<div style="max-width:560px;padding:8px 4px;">'
      +'<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:20px 24px;margin-bottom:20px;">'
      +'<div style="font-size:13px;font-weight:700;color:var(--txt);margin-bottom:6px;">🔔 Notify API Token</div>'
      +'<div style="font-size:12px;color:var(--txt3);margin-bottom:14px;line-height:1.6;">ใส่ Token สำหรับส่งแจ้งเตือนเมื่อมีการลางาน อนุมัติ หรือไม่อนุมัติ<br>Token จะถูกเก็บใน Firestore และใช้งานร่วมกันทุก session</div>'
      +'<div class="f-group" style="margin-bottom:12px;">'
      +'<label class="f-label">API Token</label>'
      +'<div style="display:flex;gap:8px;">'
      +'<input class="f-input" id="notify-token-input" type="password" placeholder="ใส่ Token ที่นี่..." value="'+esc(window.NOTIFY_TOKEN||'')+'" style="flex:1;font-family:monospace;font-size:12px;">'
      +'<button onclick="document.getElementById(\'notify-token-input\').type=document.getElementById(\'notify-token-input\').type===\'password\'?\'text\':\'password\'" style="padding:8px 12px;background:var(--surface3);border:1px solid var(--border);border-radius:8px;cursor:pointer;font-size:13px;" title="แสดง/ซ่อน Token">👁</button>'
      +'</div>'
      +'</div>'
      +'<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">'
      +'<button onclick="window.saveNotifyToken()" style="padding:8px 20px;background:var(--violet);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">💾 บันทึก Token</button>'
      +'<button onclick="window.testNotify()" style="padding:8px 20px;background:var(--surface2);color:var(--txt2);border:1px solid var(--border);border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">🧪 ทดสอบส่ง</button>'
      +'<span id="notify-save-msg" style="font-size:12px;color:var(--teal);"></span>'
      +'</div>'
      +'</div>'
      +'<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:16px 20px;">'
      +'<div style="font-size:12px;font-weight:700;color:var(--txt2);margin-bottom:8px;">เหตุการณ์ที่แจ้งเตือน</div>'
      +'<div style="display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--txt2);">'
      +'<div style="display:flex;align-items:center;gap:8px;"><span style="width:20px;text-align:center;">📋</span> บันทึกการลางานใหม่</div>'
      +'<div style="display:flex;align-items:center;gap:8px;"><span style="width:20px;text-align:center;">✅</span> อนุมัติการลา</div>'
      +'<div style="display:flex;align-items:center;gap:8px;"><span style="width:20px;text-align:center;">❌</span> ไม่อนุมัติการลา</div>'
      +'</div>'
      +'</div>'
      +'</div>';
};

window.saveNotifyToken=async function(){
  var val=(document.getElementById('notify-token-input')||{}).value||'';
  var msg=document.getElementById('notify-save-msg');
  try{
    await setDoc(getDocRef('SETTINGS','app'),{notify_token:val},{merge:true});
    window.NOTIFY_TOKEN=val;
    if(msg){msg.textContent='✅ บันทึกแล้ว';setTimeout(function(){msg.textContent='';},2500);}
  }catch(e){window.showDbError(e);}
};

window.testNotify=function(){
  window.sendLeaveNotify('test',null);
};

window.sendLeaveNotify=async function(eventType,lv){
  var token=window.NOTIFY_TOKEN||'';
  if(!token)return;
  var LEAVE_LABEL={sick:'ลาป่วย',vacation:'ลาพักร้อน',personal:'ลากิจ',maternity:'ลาคลอด',ordain:'ลาบวช',other:'อื่นๆ'};
  var LEAVE_EMOJI={sick:'🤒',vacation:'🏖',personal:'📋',maternity:'🤱',ordain:'🙏',other:'📝'};
  var STATUS_LABEL={pending:'⏳ รออนุมัติ',approved:'✅ อนุมัติแล้ว',rejected:'❌ ไม่อนุมัติ'};
  var content='';
  if(eventType==='test'){
    content='🔔 **ทดสอบระบบแจ้งเตือน**\nการแจ้งเตือนทำงานปกติ ✅';
  } else if(lv){
    var sid=lv.staffId||lv.staff_id||'';
    var st=window.STAFF.find(s=>s.id===sid)||{name:'?',role:'',dept:''};
    var subId=lv.substituteId||lv.substitute_id||'';
    var subName=subId?(window.STAFF.find(s=>s.id===subId)||{name:''}).name:'';
    var typeKey=lv.leaveType||lv.leave_type||'other';
    var typeLabel=(LEAVE_EMOJI[typeKey]||'📝')+' '+(LEAVE_LABEL[typeKey]||typeKey);
    var dateRange=fd(lv.startDate||lv.start_date)+' – '+fd(lv.endDate||lv.end_date);
    var noteText=lv.note||'';
    var statusKey=lv.status||'pending';
    var statusLabel=STATUS_LABEL[statusKey]||statusKey;
    var approvedBy=lv.approvedBy||lv.approved_by||'';
    var baseInfo='👤 ชื่อ: **'+st.name+'**'
      +(st.role?'\n💼 ตำแหน่ง: '+st.role:'')
      +(st.dept?'\n🏢 แผนก: '+st.dept:'')
      +'\n'+typeLabel
      +'\n📅 '+dateRange
      +(subName?'\n🔄 ผู้ทำงานแทน: '+subName:'')
      +(noteText?'\n📝 รายละเอียด: '+noteText:'')
      +'\n📌 สถานะ: '+statusLabel;
    if(eventType==='new'){
      content='📋 **แจ้งการลางานใหม่**\n'+baseInfo;
    } else if(eventType==='edit'){
      content='✏️ **แก้ไขการลางาน**\n'+baseInfo+(approvedBy?'\n👨‍💼 ผู้อนุมัติ: '+approvedBy:'');
    } else if(eventType==='approved'){
      content='✅ **อนุมัติการลา**\n'+baseInfo+(approvedBy?'\n👨‍💼 ผู้อนุมัติ: '+approvedBy:'');
    } else if(eventType==='rejected'){
      content='❌ **ไม่อนุมัติการลา**\n'+baseInfo+(approvedBy?'\n👨‍💼 ผู้อนุมัติ: '+approvedBy:'');
    }
  }
  if(!content)return;
  try{
    await fetch('https://api.notify.bmscloud.in.th/api/v1/push-notify',{
      method:'POST',
      headers:{'Token':token,'Content-Type':'application/json'},
      body:JSON.stringify({content:content,receiver:null})
    });
  }catch(e){console.warn('Notify API error:',e);}
};

