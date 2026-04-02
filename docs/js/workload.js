const { esc, fd, fc, fca, pd, gS, gT, gG, gSt, gC, avC, uid, getFY, getYearBE, getStaffOverlaps, overlapWarnText, getStaffLeaveConflicts, getColRef, getDocRef } = window;
// ── WORKLOAD ──
window.wlNav=function(d){window.wlM+=d;if(window.wlM>11){window.wlM=0;window.wlY++;}if(window.wlM<0){window.wlM=11;window.wlY--;}window.renderWorkload();}

function formatRanges(arr){if(arr.length===0)return"";arr.sort((a,b)=>a-b);let ranges=[];let start=arr[0],end=arr[0];for(let i=1;i<arr.length;i++){if(arr[i]===end+1){end=arr[i];}else{ranges.push(start===end?String(start):start+'-'+end);start=arr[i];end=arr[i];}}ranges.push(start===end?String(start):start+'-'+end);return ranges.join(', ');}

window.renderWorkload=function(){
  var lbl=document.getElementById('wl-lbl');if(lbl)lbl.textContent=window.THMON[window.wlM]+' '+(window.wlY+543);
  var monthStart=new Date(window.wlY,window.wlM,1);var monthEnd=new Date(window.wlY,window.wlM+1,0,23,59,59);var dim=monthEnd.getDate();
  var overload=[],active=[],avail=[],overlaps=[];
  var totalActStaff=window.STAFF.filter(s=>s.active).length;
  window.STAFF.filter(s=>s.active).forEach(s=>{
    let projs=[];
    window.PROJECTS.forEach(p=>{
      if(p.status==='cancelled'||p.status==='completed')return;
      let mems=p.members&&p.members.length>0?p.members:p.team.map(id=>({sid:id,s:p.start,e:p.end}));
      let mbList=mems.filter(m=>m.sid===s.id);
      let validMems=mbList.filter(mb=>mb.s&&mb.e&&!isNaN(pd(mb.s).getTime())&&!isNaN(pd(mb.e).getTime()));
      if(validMems.length>0){let ms=new Date(Math.min(...validMems.map(mb=>pd(mb.s).getTime())));let me=new Date(Math.max(...validMems.map(mb=>{let d=pd(mb.e);d.setHours(23,59,59);return d.getTime();})));if(ms<=monthEnd&&me>=monthStart)projs.push({p:p,s:ms,e:me});}
    });
    // Detect overlapping projects in this month
    let overlapPairs=[];
    for(let i=0;i<projs.length;i++){for(let j=i+1;j<projs.length;j++){let a=projs[i],b=projs[j];let as=new Date(Math.max(a.s,monthStart)),ae=new Date(Math.min(a.e,monthEnd)),bs=new Date(Math.max(b.s,monthStart)),be=new Date(Math.min(b.e,monthEnd));if(as<=be&&bs<=ae)overlapPairs.push({a:a.p,b:b.p});}}
    if(overlapPairs.length>0)overlaps.push({s:s,pairs:overlapPairs,projs:projs});
    let count=projs.length;let busyDays=0;let freeText='';
    if(count>0){let bSet=new Set();projs.forEach(sp=>{let sDay=1,eDay=dim;if(sp.s.getMonth()===window.wlM&&sp.s.getFullYear()===window.wlY)sDay=Math.max(1,sp.s.getDate());if(sp.e.getMonth()===window.wlM&&sp.e.getFullYear()===window.wlY)eDay=Math.min(dim,sp.e.getDate());for(let d=sDay;d<=eDay;d++)bSet.add(d);});busyDays=bSet.size;let fDays=[];for(let d=1;d<=dim;d++)if(!bSet.has(d))fDays.push(d);freeText=fDays.length===0?`เต็มตลอดเดือน (${busyDays}/${dim} วัน)`:'ช่วงว่าง: '+formatRanges(fDays);}else freeText='ว่างตลอดเดือน';
    let hasOverlap=overlapPairs.length>0;
    let item={s:s,count:count,ftext:freeText,projs:projs,busyDays:busyDays,dim:dim,hasOverlap:hasOverlap};
    if(count===0)avail.push(item);else if(count<=3)active.push(item);else overload.push(item);
  });

  var buildCard=function(item,color){
    var cntHtml=item.count>0?`<span style="font-size:10px;font-weight:700;color:${color};background:${color}15;padding:2px 8px;border-radius:20px;">${item.count} งาน</span>`:'';
    var initial=(item.s.nickname||item.s.name||'?').charAt(0);
    var dName=esc(item.s.nickname||item.s.name);
    var deptTag=item.s.dept?`<span style="font-size:9px;background:var(--surface3);color:var(--txt3);padding:1px 7px;border-radius:8px;margin-top:2px;display:inline-block;">${esc(item.s.dept)}</span>`:'';
    var olBadge=item.hasOverlap?`<span style="font-size:9px;font-weight:700;color:#fff;background:var(--coral);padding:1px 6px;border-radius:8px;">⚠ ซ้อน</span>`:'';
    var busyPct=item.dim>0?Math.round(item.busyDays/item.dim*100):0;
    var busyBar=item.count>0?`<div style="margin:6px 0 4px;"><div style="display:flex;justify-content:space-between;font-size:9px;color:var(--txt3);margin-bottom:3px;"><span>ยุ่ง ${item.busyDays}/${item.dim} วัน</span><span>${busyPct}%</span></div><div style="height:4px;background:var(--surface3);border-radius:4px;overflow:hidden;"><div style="height:100%;width:${busyPct}%;background:${color};border-radius:4px;transition:width .5s;"></div></div></div>`:'';
    var projListHtml='';
    if(item.projs&&item.projs.length>0){
      projListHtml=`<div class="wl-proj-list" style="display:none;margin-top:8px;border-top:1px dashed var(--border);padding-top:8px;">`+item.projs.map(sp=>{var pt=gT(sp.p.typeId);return`<div onclick="event.stopPropagation();window.openProjModal('${sp.p.id}')" style="padding:7px 9px;margin-bottom:5px;border-radius:8px;background:var(--surface2);border:1px solid var(--border);cursor:pointer;transition:background .15s" onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background='var(--surface2)'"><div style="font-size:11px;font-weight:600;color:var(--txt);margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">📁 ${esc(sp.p.name)}</div><div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;"><span style="font-size:9px;background:${pt.color}18;color:${pt.color};padding:1px 6px;border-radius:8px;font-weight:600;">${esc(pt.label)}</span><span style="font-size:9px;color:var(--txt3);">${sp.p.start?fd(sp.p.start):'?'} → ${sp.p.end?fd(sp.p.end):'?'}</span></div></div>`;}).join('')+`</div>`;
    }
    return`<div class="wl-card" style="border-left:3px solid ${color};cursor:${item.count>0?'pointer':'default'};" ${item.count>0?`onclick="var pl=this.querySelector('.wl-proj-list');if(pl){var op=pl.style.display==='block';pl.style.display=op?'none':'block';}"`:''}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
        <div style="display:flex;align-items:center;gap:9px;">
          <div style="width:32px;height:32px;border-radius:10px;background:${color};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;flex-shrink:0;">${initial}</div>
          <div><div style="font-size:12px;font-weight:700;color:var(--txt);">${dName}</div>${deptTag}</div>
        </div>
        <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">${olBadge}${cntHtml}</div>
      </div>
      ${busyBar}
      <div style="font-size:10px;color:var(--txt2);background:var(--surface2);padding:5px 9px;border-radius:7px;border:1px solid var(--border);">${item.ftext}</div>
      ${projListHtml}
    </div>`;
  };

  // Overlap section
  var overlapSection='';
  if(overlaps.length>0){
    var olCards=overlaps.map(ov=>{
      var ini=(ov.s.nickname||ov.s.name||'?').charAt(0);
      var nm=esc(ov.s.nickname||ov.s.name);
      var pairs=ov.pairs.slice(0,3).map(pair=>`<div style="font-size:10px;color:var(--txt2);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">⚡ ${esc(pair.a.name)} + ${esc(pair.b.name)}</div>`).join('');
      var more=ov.pairs.length>3?`<div style="font-size:10px;color:var(--txt3);">+${ov.pairs.length-3} คู่</div>`:'';
      return`<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:rgba(255,107,107,.04);border:1px solid rgba(255,107,107,.2);border-radius:10px;"><div style="width:28px;height:28px;border-radius:8px;background:var(--coral);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0;">${ini}</div><div style="min-width:0;flex:1;"><div style="font-size:12px;font-weight:700;color:var(--txt);">${nm} <span style="font-size:10px;font-weight:600;color:var(--coral);">(${ov.projs.length} งาน)</span></div>${pairs}${more}</div></div>`;
    }).join('');
    overlapSection=`<div class="wl-ol-wrap" style="padding:0 24px 14px;flex-shrink:0;"><div style="background:var(--surface);border-radius:var(--r2);border:1.5px solid rgba(255,107,107,.3);box-shadow:0 2px 12px rgba(255,107,107,.07);overflow:hidden;"><div style="padding:11px 18px;background:rgba(255,107,107,.05);border-bottom:1px solid rgba(255,107,107,.15);display:flex;align-items:center;justify-content:space-between;"><div style="display:flex;align-items:center;gap:8px;"><span style="font-size:15px;">⚠️</span><span style="font-size:13px;font-weight:700;color:var(--coral);">พนักงานที่มีงานซ้อนในช่วงเดียวกัน</span><span style="font-size:11px;background:var(--coral);color:#fff;padding:1px 9px;border-radius:20px;font-weight:700;">${overlaps.length} คน</span></div><button onclick="var b=this.closest('.wl-ol-wrap').querySelector('.wl-ol-body');var op=b.style.display==='grid';b.style.display=op?'none':'grid';this.textContent=op?'▼ ดูรายชื่อ':'▲ ซ่อน';" style="font-size:11px;font-weight:600;color:var(--coral);background:rgba(255,107,107,.1);border:1.5px solid rgba(255,107,107,.25);border-radius:8px;padding:4px 12px;cursor:pointer;font-family:inherit;">▼ ดูรายชื่อ</button></div><div class="wl-ol-body" style="display:none;padding:14px 18px;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:10px;">${olCards}</div></div></div>`;
  }

  // Summary stats
  var statsHtml=`<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;padding:16px 24px 12px;flex-shrink:0;">
    <div style="background:var(--surface);border-radius:var(--r2);border:1px solid var(--border);padding:16px 18px;box-shadow:var(--sh-sm);display:flex;align-items:center;gap:12px;"><div style="width:38px;height:38px;border-radius:11px;background:rgba(124,92,252,.1);display:flex;align-items:center;justify-content:center;font-size:17px;">👥</div><div><div style="font-size:10px;color:var(--txt3);font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:1px;">ทั้งหมด</div><div style="font-size:20px;font-weight:800;">${totalActStaff} <span style="font-size:12px;font-weight:600;color:var(--txt3);">คน</span></div></div></div>
    <div style="background:var(--surface);border-radius:var(--r2);border:1.5px solid rgba(255,107,107,.2);padding:16px 18px;box-shadow:var(--sh-sm);display:flex;align-items:center;gap:12px;"><div style="width:38px;height:38px;border-radius:11px;background:rgba(255,107,107,.1);display:flex;align-items:center;justify-content:center;font-size:17px;">🔥</div><div><div style="font-size:10px;color:var(--coral);font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:1px;">Overload</div><div style="font-size:20px;font-weight:800;color:var(--coral);">${overload.length} <span style="font-size:12px;font-weight:600;">คน</span></div></div></div>
    <div style="background:var(--surface);border-radius:var(--r2);border:1.5px solid rgba(67,97,238,.18);padding:16px 18px;box-shadow:var(--sh-sm);display:flex;align-items:center;gap:12px;"><div style="width:38px;height:38px;border-radius:11px;background:rgba(67,97,238,.1);display:flex;align-items:center;justify-content:center;font-size:17px;">💼</div><div><div style="font-size:10px;color:#4361ee;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:1px;">Active</div><div style="font-size:20px;font-weight:800;color:#4361ee;">${active.length} <span style="font-size:12px;font-weight:600;">คน</span></div></div></div>
    <div style="background:var(--surface);border-radius:var(--r2);border:1.5px solid rgba(6,214,160,.18);padding:16px 18px;box-shadow:var(--sh-sm);display:flex;align-items:center;gap:12px;"><div style="width:38px;height:38px;border-radius:11px;background:rgba(6,214,160,.1);display:flex;align-items:center;justify-content:center;font-size:17px;">✅</div><div><div style="font-size:10px;color:var(--teal);font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:1px;">Available</div><div style="font-size:20px;font-weight:800;color:var(--teal);">${avail.length} <span style="font-size:12px;font-weight:600;">คน</span></div></div></div>
  </div>`;

  var buildCol=function(title,sub,arr,color,icon){
    var pct=totalActStaff>0?Math.round(arr.length/totalActStaff*100):0;
    return`<div class="wl-col"><div class="wl-hcard" style="background:${color}0D;border-color:${color}33;"><div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;"><div style="width:36px;height:36px;border-radius:10px;background:${color}20;display:flex;align-items:center;justify-content:center;font-size:16px;">${icon}</div><div><div class="wl-hcard-title" style="color:${color};margin-bottom:0">${title}</div><div class="wl-hcard-sub" style="color:var(--txt3)">${sub}</div></div></div><div style="display:flex;align-items:center;gap:8px;"><div class="wl-hcard-num">${arr.length}</div><div style="font-size:13px;font-weight:600;color:var(--txt3);">คน</div><div style="flex:1;height:5px;background:${color}20;border-radius:5px;overflow:hidden;margin-left:4px;"><div style="height:100%;width:${pct}%;background:${color};border-radius:5px;"></div></div><span style="font-size:10px;color:${color};font-weight:700;">${pct}%</span></div></div><div class="wl-list">${arr.map(x=>buildCard(x,color)).join('')||`<div style="text-align:center;padding:28px;color:var(--txt3);font-size:12px;">ไม่มีรายการ</div>`}</div></div>`;
  };

  var colsHtml=buildCol('งานมาก (Overload)','> 3 โครงการ',overload,'#ff6b6b','🔥')+buildCol('งานปกติ (Active)','1-3 โครงการ',active,'#4361ee','💼')+buildCol('ว่างงาน (Available)','พร้อมรับงาน',avail,'#06d6a0','✅');
  var grid=document.getElementById('wl-grid');
  if(grid){grid.style.cssText='flex:1;display:flex;flex-direction:column;overflow-y:auto;background:var(--bg);';grid.innerHTML=statsHtml+overlapSection+`<div style="display:flex;gap:16px;padding:0 24px 24px;flex:1;min-height:400px;">${colsHtml}</div>`;}
}

