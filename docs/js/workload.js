const { esc, fd, pd, gT, avC } = window;

var _WL_THMON_S = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
var _WD = ['อา','จ','อ','พ','พฤ','ศ','ส'];

// ── Popup ──
window.wlCellClick = function(e, projsStr, dateLabel, isFree) {
  e.stopPropagation();
  var popup = document.getElementById('wl-popup');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'wl-popup';
    popup.style.cssText = 'position:fixed;z-index:9999;background:var(--surface);border:1px solid var(--border);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.18);padding:14px 16px;min-width:200px;max-width:320px;display:none;';
    document.body.appendChild(popup);
    document.addEventListener('click', function() {
      var p = document.getElementById('wl-popup');
      if (p) p.style.display = 'none';
    });
  }
  var projs = projsStr ? projsStr.split('||') : [];
  var html = '<div style="font-size:11px;font-weight:700;color:var(--txt3);margin-bottom:8px;letter-spacing:.4px;">' + esc(dateLabel) + '</div>';
  if (isFree === '1') {
    html += '<div style="display:flex;align-items:center;gap:8px;color:#06d6a0;font-size:13px;font-weight:700;">✅ ว่าง</div>';
  } else {
    projs.forEach(function(name) {
      html += '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);">' +
        '<span style="width:8px;height:8px;border-radius:50%;background:' + (projs.length > 1 ? '#ff6b6b' : '#4361ee') + ';flex-shrink:0;"></span>' +
        '<span style="font-size:12px;font-weight:600;color:var(--txt);">' + esc(name) + '</span></div>';
    });
    if (projs.length > 1) {
      html += '<div style="margin-top:6px;font-size:10px;color:#ff6b6b;font-weight:700;">⚠ งานซ้อนกัน ' + projs.length + ' โครงการ</div>';
    }
  }
  popup.innerHTML = html;
  popup.style.display = 'block';
  var vw = window.innerWidth, vh = window.innerHeight;
  var x = e.clientX + 10, y = e.clientY + 10;
  popup.style.left = '0'; popup.style.top = '0';
  var pw = popup.offsetWidth || 220, ph = popup.offsetHeight || 120;
  if (x + pw > vw - 8) x = e.clientX - pw - 10;
  if (y + ph > vh - 8) y = e.clientY - ph - 10;
  popup.style.left = Math.max(8, x) + 'px';
  popup.style.top  = Math.max(8, y) + 'px';
};

window.wlNav = function(d) {
  window.wlM += d;
  if (window.wlM > 11) { window.wlM = 0; window.wlY++; }
  if (window.wlM < 0)  { window.wlM = 11; window.wlY--; }
  window.renderWorkload();
};

window.renderWorkload = function() {
  var statsEl   = document.getElementById('wl-stats');
  var headEl    = document.getElementById('wl-head');
  var grid      = document.getElementById('wl-grid');
  var deptSel   = document.getElementById('wl-dept-filter');
  if (!grid) return;

  var lbl = document.getElementById('wl-lbl');
  if (lbl) lbl.textContent = window.THMON[window.wlM] + ' ' + (window.wlY + 543);

  // ── populate dept filter ──
  if (deptSel && deptSel.options.length <= 1) {
    (window.DEPT_LIST || []).forEach(function(d) {
      var o = document.createElement('option');
      o.value = d.label; o.textContent = d.label;
      deptSel.appendChild(o);
    });
  }
  var deptFilt = deptSel ? deptSel.value : '';

  var monthStart = new Date(window.wlY, window.wlM, 1);
  var monthEnd   = new Date(window.wlY, window.wlM + 1, 0, 23, 59, 59);
  var dim = monthEnd.getDate();

  var now = new Date();
  var isNow = now.getFullYear() === window.wlY && now.getMonth() === window.wlM;
  var todayD = isNow ? now.getDate() : -1;

  var days = [];
  for (var d = 1; d <= dim; d++) {
    var dow = new Date(window.wlY, window.wlM, d).getDay();
    days.push({ d: d, dow: dow, we: dow === 0 || dow === 6 });
  }
  var workdays = days.filter(function(d) { return !d.we; }).length;

  // ── คำนวณข้อมูลต่อคน ──
  var staffRows = [];
  var cntOverload = 0, cntActive = 0, cntAvail = 0, cntOverlap = 0;

  (window.STAFF || []).filter(function(s) { return s.active !== false; }).forEach(function(s, gi) {
    var projs = [];
    (window.PROJECTS || []).forEach(function(p) {
      if (p.status === 'cancelled' || p.status === 'completed') return;
      var mems = (p.members && p.members.length > 0)
        ? p.members
        : (p.team || []).map(function(id) { return { sid: id, s: p.start, e: p.end }; });
      var mine = mems.filter(function(m) { return m.sid === s.id && m.s && m.e; });
      if (!mine.length) return;
      var ms = new Date(Math.min.apply(null, mine.map(function(m) { return pd(m.s).getTime(); })));
      var me = new Date(Math.max.apply(null, mine.map(function(m) { var dt = pd(m.e); dt.setHours(23,59,59); return dt.getTime(); })));
      if (ms <= monthEnd && me >= monthStart) projs.push({ p: p, s: ms, e: me });
    });

    var dayCount = new Array(dim + 2).fill(0);
    var dayProjs = {};
    projs.forEach(function(sp) {
      var sd = sp.s < monthStart ? 1 : sp.s.getDate();
      var ed = sp.e > monthEnd  ? dim : sp.e.getDate();
      for (var dd = sd; dd <= ed; dd++) {
        dayCount[dd]++;
        if (!dayProjs[dd]) dayProjs[dd] = [];
        dayProjs[dd].push(sp.p.name);
      }
    });

    var busyDays   = days.filter(function(d) { return !d.we && dayCount[d.d] > 0; }).length;
    var hasOverlap = days.some(function(d) { return dayCount[d.d] >= 2; });
    var busyPct    = workdays > 0 ? Math.round(busyDays / workdays * 100) : 0;

    if (projs.length === 0) cntAvail++;
    else if (projs.length > 3) cntOverload++;
    else cntActive++;
    if (hasOverlap) cntOverlap++;

    staffRows.push({ s: s, gi: gi, projs: projs, dayCount: dayCount, dayProjs: dayProjs,
                     busyDays: busyDays, busyPct: busyPct, hasOverlap: hasOverlap });
  });

  var totalStaff = staffRows.length;

  // ── จัดกลุ่มตามแผนก ──
  var deptOrder = (window.DEPT_LIST || []).map(function(d) { return d.label; });
  var grouped = {}, noDept = [];
  deptOrder.forEach(function(d) { grouped[d] = []; });
  staffRows.forEach(function(r) {
    if (r.s.dept && grouped[r.s.dept]) grouped[r.s.dept].push(r);
    else noDept.push(r);
  });
  var sortFn = function(a, b) { return b.busyDays - a.busyDays; };
  deptOrder.forEach(function(d) { grouped[d].sort(sortFn); });
  noDept.sort(sortFn);

  var allSections = [];
  deptOrder.forEach(function(d) { if (grouped[d] && grouped[d].length) allSections.push({ label: d, list: grouped[d] }); });
  if (noDept.length) allSections.push({ label: 'ไม่ระบุแผนก', list: noDept });

  // กรองแผนก
  var sections = deptFilt ? allSections.filter(function(s) { return s.label === deptFilt; }) : allSections;

  var CW     = 22;   // px/day
  var NAME_W = 240;  // px ชื่อ
  var SUM_W  = 120;  // px ภาระงาน

  // ── Legend ──
  var legend =
    '<div style="display:flex;align-items:center;gap:10px;margin-left:auto;flex-wrap:wrap;">' +
    [['rgba(6,214,160,.45)','ว่าง'],['#4361ee','มีงาน'],['#ff6b6b','งานซ้อน'],['var(--surface3)','ส–อา']]
    .map(function(t) {
      return '<span style="display:flex;align-items:center;gap:5px;font-size:10px;color:var(--txt3);">' +
        '<span style="width:14px;height:10px;border-radius:3px;background:'+t[0]+';display:inline-block;"></span>'+t[1]+'</span>';
    }).join('') + '</div>';

  // ── Stats chip ──
  function chip(icon, label, val, bg, col) {
    return '<div style="display:flex;align-items:center;gap:8px;padding:8px 14px;background:'+bg+';border:1px solid '+col+'33;border-radius:10px;">' +
      '<span style="font-size:14px;">'+icon+'</span>' +
      '<div><div style="font-size:9px;font-weight:700;color:'+col+';letter-spacing:.5px;text-transform:uppercase;">'+label+'</div>' +
      '<div style="font-size:16px;font-weight:800;color:'+col+';line-height:1.1;">'+val+' <span style="font-size:10px;font-weight:600;">คน</span></div></div></div>';
  }

  if (statsEl) {
    statsEl.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;flex-wrap:wrap;">' +
      chip('👥','ทั้งหมด', totalStaff, 'var(--surface2)', 'var(--txt)') +
      chip('🔥','งานมาก',  cntOverload, 'rgba(255,107,107,.07)', '#ff6b6b') +
      chip('💼','มีงาน',   cntActive,   'rgba(67,97,238,.07)',   '#4361ee') +
      chip('✅','ว่าง',     cntAvail,    'rgba(6,214,160,.07)',   '#06d6a0') +
      (cntOverlap > 0 ? chip('⚠️','ซ้อนกัน', cntOverlap, 'rgba(255,107,107,.07)', '#ff6b6b') : '') +
      legend +
      '</div>';
  }

  // ── Day header ──
  if (headEl) {
    headEl.innerHTML =
      '<div style="display:flex;min-width:fit-content;">' +
      '<div style="width:'+NAME_W+'px;flex-shrink:0;padding:5px 14px;font-size:10px;font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.5px;display:flex;align-items:center;border-right:1px solid var(--border);">พนักงาน / แผนก</div>' +
      '<div style="display:flex;">' +
        days.map(function(day) {
          var isT = day.d === todayD;
          return '<div style="width:'+CW+'px;flex-shrink:0;text-align:center;padding:4px 0;box-sizing:border-box;' +
            (day.we ? 'background:var(--surface2);' : '') +
            (isT    ? 'background:rgba(255,166,43,.18);' : '') + '">' +
            '<div style="font-size:7px;color:var(--txt3);line-height:1.2;">'+_WD[day.dow]+'</div>' +
            '<div style="font-size:9px;font-weight:'+(isT?'800':'600')+';color:'+(isT?'var(--amber)':day.we?'var(--txt3)':'var(--txt2)')+';">'+day.d+'</div>' +
          '</div>';
        }).join('') +
      '</div>' +
      '<div style="width:'+SUM_W+'px;flex-shrink:0;padding:5px 14px;font-size:10px;font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.5px;display:flex;align-items:center;justify-content:flex-end;border-left:1px solid var(--border);">ภาระงาน</div>' +
      '</div>';
  }

  // ── Staff row ──
  function staffRowHtml(r) {
    var s = r.s;
    var initials = s.name.split(' ').map(function(w) { return w.charAt(0); }).join('').substring(0,2).toUpperCase();
    var displayName = esc(s.name) + (s.nickname ? ' <span style="color:var(--txt3);font-weight:500;">('+esc(s.nickname)+')</span>' : '');

    var cells = days.map(function(day) {
      var cnt = r.dayCount[day.d];
      var isT = day.d === todayD;
      var bg, cursor = 'default', isFree = '0';
      if (day.we) {
        bg = 'background:var(--surface2);';
      } else if (cnt === 0) {
        bg = 'background:rgba(6,214,160,.18);';
        isFree = '1'; cursor = 'pointer';
      } else if (cnt === 1) {
        bg = 'background:#4361ee;'; cursor = 'pointer';
      } else {
        bg = 'background:#ff6b6b;'; cursor = 'pointer';
      }
      var bdr = isT ? 'box-shadow:inset 0 0 0 2px var(--amber);' : '';
      var dateLabel = day.d + ' ' + _WL_THMON_S[window.wlM];
      if (!day.we) {
        var projsEncoded = r.dayProjs[day.d] ? r.dayProjs[day.d].join('||') : '';
        return '<div style="width:'+CW+'px;flex-shrink:0;height:32px;'+bg+bdr+'cursor:'+cursor+';" ' +
          'onclick="window.wlCellClick(event,\''+projsEncoded.replace(/'/g,'&#39;')+'\',\''+esc(dateLabel)+'\',\''+isFree+'\')"></div>';
      }
      return '<div style="width:'+CW+'px;flex-shrink:0;height:32px;'+bg+bdr+'"></div>';
    }).join('');

    var projCount = r.projs.length;
    var statusClr = projCount === 0 ? '#06d6a0' : projCount > 3 ? '#ff6b6b' : '#4361ee';
    var statusTxt = projCount === 0 ? 'ว่าง' : projCount + ' งาน';
    var olBadge   = r.hasOverlap ? '<span style="font-size:8px;font-weight:700;color:#fff;background:#ff6b6b;padding:1px 5px;border-radius:4px;margin-left:4px;">⚠ซ้อน</span>' : '';

    return '<div style="display:flex;align-items:stretch;border-bottom:1px solid var(--border);transition:background .15s;min-width:fit-content;" onmouseover="this.style.background=\'var(--surface2)\'" onmouseout="this.style.background=\'\'">' +
      '<div style="width:'+NAME_W+'px;flex-shrink:0;padding:6px 14px;display:flex;align-items:center;gap:10px;border-right:1px solid var(--border);">' +
        '<div style="width:30px;height:30px;border-radius:9px;background:'+avC(r.gi)+';color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">'+initials+'</div>' +
        '<div style="min-width:0;">' +
          '<div style="font-size:12px;font-weight:700;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="'+esc(s.name+(s.nickname?' ('+s.nickname+')':''))+'">'+displayName+'</div>' +
          '<div style="font-size:10px;color:var(--txt3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+esc(s.role||'—')+'</div>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;align-items:stretch;">'+cells+'</div>' +
      '<div style="width:'+SUM_W+'px;flex-shrink:0;padding:6px 14px;display:flex;flex-direction:column;align-items:flex-end;justify-content:center;border-left:1px solid var(--border);">' +
        '<div style="font-size:13px;font-weight:800;color:'+statusClr+';">'+statusTxt+olBadge+'</div>' +
        (r.busyDays > 0
          ? '<div style="font-size:10px;color:var(--txt3);margin-top:1px;">'+r.busyDays+'/'+workdays+' วัน · '+r.busyPct+'%</div>'
          : '<div style="font-size:10px;color:#06d6a0;">พร้อมรับงาน</div>') +
      '</div>' +
    '</div>';
  }

  // ── Dept section ──
  function deptSectionHtml(label, list, di) {
    var dFree = list.filter(function(r) { return r.projs.length === 0; }).length;
    var dOver = list.filter(function(r) { return r.hasOverlap; }).length;
    return '<div>' +
      '<div style="display:flex;align-items:center;gap:8px;padding:7px 14px;background:var(--surface2);border-bottom:1px solid var(--border);border-top:2px solid var(--border);min-width:fit-content;">' +
        '<div style="width:4px;height:14px;border-radius:2px;background:'+avC(di*2)+';flex-shrink:0;"></div>' +
        '<span style="font-size:12px;font-weight:700;color:var(--txt);">'+esc(label)+'</span>' +
        '<span style="font-size:10px;background:var(--surface);border:1px solid var(--border);color:var(--txt3);padding:1px 8px;border-radius:10px;">'+list.length+' คน</span>' +
        (dFree>0 ? '<span style="font-size:10px;color:#06d6a0;background:rgba(6,214,160,.1);padding:1px 8px;border-radius:10px;font-weight:600;">✅ ว่าง '+dFree+'</span>' : '') +
        (dOver>0 ? '<span style="font-size:10px;color:#ff6b6b;background:rgba(255,107,107,.1);padding:1px 8px;border-radius:10px;font-weight:600;">⚠ ซ้อน '+dOver+'</span>' : '') +
      '</div>' +
      list.map(function(r) { return staffRowHtml(r); }).join('') +
    '</div>';
  }

  var body = sections.map(function(sec, i) { return deptSectionHtml(sec.label, sec.list, i); }).join('');
  if (!body) body = '<div style="padding:60px;text-align:center;color:var(--txt3);">ไม่มีข้อมูลพนักงาน</div>';

  grid.style.cssText = 'flex:1;overflow:auto;background:var(--bg);';
  grid.innerHTML = '<div style="min-width:fit-content;">' + body + '</div>';

  // ── Sync horizontal scroll ──
  var headWrap = document.getElementById('wl-head-wrap');
  grid.onscroll = function() {
    if (headWrap) headWrap.scrollLeft = grid.scrollLeft;
  };
};
