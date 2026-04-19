// hospital.js — รายชื่อโรงพยาบาล
const { esc, fc, uid, getColRef, getDocRef } = window;

window.HOSPITALS = window.HOSPITALS || [];

// ── MOPH HCODE API ─────────────────────────────────────────────────────────
const HCODE_BASE = 'https://hcode.moph.go.th/api';
const HCODE_TOKEN_KEY   = 'hcode_access';
const HCODE_EXPIRY_KEY  = 'hcode_expiry';
const HCODE_REFRESH_KEY = 'hcode_refresh';

async function _hspGetToken() {
  var access  = localStorage.getItem(HCODE_TOKEN_KEY);
  var expiry  = Number(localStorage.getItem(HCODE_EXPIRY_KEY) || 0);
  if (access && expiry > Date.now()) return access;

  var refresh = localStorage.getItem(HCODE_REFRESH_KEY);
  if (refresh) {
    try {
      var r = await fetch(HCODE_BASE + '/token/refresh/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh })
      });
      if (r.ok) {
        var d = await r.json();
        _hspSaveToken(d.access, refresh);
        return d.access;
      }
      // 401 = refresh หมดอายุจริง → ล้าง; error อื่น (500, network) → เก็บไว้ก่อน
      if (r.status === 401) localStorage.removeItem(HCODE_REFRESH_KEY);
    } catch(_) {
      // network error — ไม่ล้าง refresh token
    }
  }
  return null;
}

function _hspSaveToken(access, refresh) {
  localStorage.setItem(HCODE_TOKEN_KEY,   access);
  localStorage.setItem(HCODE_EXPIRY_KEY,  String(Date.now() + 225 * 60 * 1000)); // 225 min
  if (refresh) localStorage.setItem(HCODE_REFRESH_KEY, refresh);
}

// Login ด้วย username/password
window.hspApiLogin = async function() {
  var u    = document.getElementById('hsp-api-user')?.value.trim();
  var p    = document.getElementById('hsp-api-pass')?.value;
  var btn  = document.getElementById('hsp-api-login-btn');
  var stat = document.getElementById('hsp-api-stat');
  var errBox = document.getElementById('hsp-api-err');

  function showErr(msg) {
    if (errBox) { errBox.textContent = msg; errBox.style.display = ''; }
    if (stat) stat.innerHTML = '<span style="color:#ff6b6b;">❌ เชื่อมต่อไม่สำเร็จ</span>';
  }
  if (errBox) errBox.style.display = 'none';

  if (!u || !p) { showErr('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน'); return; }
  if (btn) { btn.disabled = true; btn.textContent = 'กำลังเชื่อมต่อ...'; }
  if (stat) stat.innerHTML = '<span style="color:var(--txt-muted);">⏳ กำลังตรวจสอบ...</span>';

  try {
    var r = await fetch(HCODE_BASE + '/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    });

    var bodyText = '';
    try { bodyText = await r.text(); } catch(_) {}

    if (!r.ok) {
      var detail = '';
      try { var j = JSON.parse(bodyText); detail = j.detail || j.message || JSON.stringify(j); } catch(_) { detail = bodyText; }
      if (r.status === 401 || r.status === 400) {
        showErr('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' + (detail ? '  (' + detail + ')' : ''));
      } else {
        showErr('เซิร์ฟเวอร์ตอบกลับ HTTP ' + r.status + (detail ? ': ' + detail : ''));
      }
      return;
    }

    var d = JSON.parse(bodyText);
    if (!d.access) { showErr('API ตอบกลับแต่ไม่มี access token — โปรดตรวจสอบ endpoint'); return; }

    _hspSaveToken(d.access, d.refresh);
    document.getElementById('hsp-api-pass').value = '';
    _hspApiUpdateStatus();
    window.showAlert('เชื่อมต่อ MOPH API สำเร็จ', 'success');

  } catch(e) {
    if (e.name === 'TypeError' && e.message.toLowerCase().includes('fetch')) {
      showErr('เชื่อมต่อไม่ได้ (Network error / CORS) — ตรวจสอบว่า browser อนุญาต cross-origin request ไปยัง hcode.moph.go.th');
    } else {
      showErr(e.message);
    }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔗 เชื่อมต่อ'; }
  }
};

// ทดสอบ token ที่มีอยู่
window.hspApiTest = async function() {
  var stat   = document.getElementById('hsp-api-stat');
  var errBox = document.getElementById('hsp-api-err');
  if (errBox) errBox.style.display = 'none';
  if (stat) stat.innerHTML = '<span style="color:var(--txt-muted);">⏳ กำลังทดสอบ...</span>';
  try {
    var token = await _hspGetToken();
    if (!token) {
      if (stat) stat.innerHTML = '<span style="color:#ff6b6b;">❌ ไม่มี token — กรุณาล็อกอินใหม่</span>';
      return;
    }
    _hspApiTrackCall();
    var r = await fetch(HCODE_BASE + '/health_office/?code5=10669&page_size=1', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (r.status === 429) {
      _hspApiRateLimited = true;
      var errBox2 = document.getElementById('hsp-api-err');
      if (errBox2) { errBox2.textContent = 'ถูกจำกัดการใช้งาน (HTTP 429) — limit 100 req/hr กรุณารอสักครู่แล้วลองใหม่'; errBox2.style.display = ''; }
      if (stat) stat.innerHTML = '<span style="color:#ffa62b;">⚠️ Rate limited — ใช้ quota ครบแล้ว</span>';
    } else if (r.ok) {
      _hspApiRateLimited = false;
      if (stat) stat.innerHTML = '<span style="color:#06d6a0;">✅ เชื่อมต่อสำเร็จ (HTTP ' + r.status + ')</span>';
    } else {
      var bodyText = ''; try { bodyText = await r.text(); } catch(_) {}
      if (stat) stat.innerHTML = '<span style="color:#ff6b6b;">❌ HTTP ' + r.status + (bodyText ? ': ' + esc(bodyText.slice(0,80)) : '') + '</span>';
    }
  } catch(e) {
    if (stat) stat.innerHTML = '<span style="color:#ff6b6b;">❌ ' + esc(e.message) + '</span>';
  }
  _hspApiUpdateQuota();
};

window.hspApiLogout = function() {
  localStorage.removeItem(HCODE_TOKEN_KEY);
  localStorage.removeItem(HCODE_EXPIRY_KEY);
  localStorage.removeItem(HCODE_REFRESH_KEY);
  _hspApiUpdateStatus();
  window.showAlert('ตัดการเชื่อมต่อแล้ว', 'success');
};

function _hspApiUpdateStatus() {
  var stat = document.getElementById('hsp-api-stat');
  if (!stat) return;
  var expiry     = Number(localStorage.getItem(HCODE_EXPIRY_KEY) || 0);
  var hasAccess  = !!localStorage.getItem(HCODE_TOKEN_KEY) && expiry > Date.now();
  var hasRefresh = !!localStorage.getItem(HCODE_REFRESH_KEY);
  var logoutBtn  = document.getElementById('hsp-api-logout-btn');
  var testBtn    = document.getElementById('hsp-api-test-btn');

  if (hasAccess || hasRefresh) {
    var expiryStr = expiry > Date.now()
      ? 'token หมดอายุ ' + new Date(expiry).toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' })
      : 'access หมดอายุแล้ว (มี refresh token)';
    stat.innerHTML =
      '<span style="color:#06d6a0;font-weight:700;">✅ เชื่อมต่อแล้ว</span>' +
      '<span style="color:var(--txt-muted);font-size:11px;font-weight:400;margin-left:8px;">' + expiryStr + '</span>';
    if (logoutBtn) logoutBtn.style.display = '';
    if (testBtn)   testBtn.style.display   = '';
  } else {
    stat.innerHTML = '<span style="color:var(--txt-muted);">⚠️ ยังไม่ได้เชื่อมต่อ</span>';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (testBtn)   testBtn.style.display   = 'none';
  }
}

window.openHspApiSettings = function() {
  document.getElementById('hsp-api-user').value = '';
  document.getElementById('hsp-api-pass').value = '';
  var errBox = document.getElementById('hsp-api-err');
  if (errBox) errBox.style.display = 'none';
  _hspApiUpdateStatus();
  window.openM('m-hsp-api');
};

// ── API Rate-limit tracker & cache ───────────────────────────────────────────
var _hspApiCache     = {};          // code5 → mapped result (session memory)
var _hspApiCallCount = 0;           // นับ request ในชั่วโมงนี้
var _hspApiCallReset = 0;           // timestamp ที่จะ reset นับ
var _hspApiRateLimited = false;     // flag: ถูก 429 อยู่
var _HSP_API_LIMIT = 100;           // limit จาก server

function _hspApiTrackCall() {
  var now = Date.now();
  if (now > _hspApiCallReset) { _hspApiCallCount = 0; _hspApiCallReset = now + 3600000; _hspApiRateLimited = false; }
  _hspApiCallCount++;
  _hspApiUpdateQuota();
}

function _hspApiUpdateQuota() {
  var el = document.getElementById('hsp-api-quota');
  if (!el) return;
  var remaining = Math.max(0, _HSP_API_LIMIT - _hspApiCallCount);
  el.textContent = 'quota: ' + remaining + '/' + _HSP_API_LIMIT + ' req/hr';
  el.style.color = remaining < 20 ? '#ff6b6b' : remaining < 50 ? '#ffa62b' : 'var(--txt-muted)';
}

// Lookup รพ. จาก MOPH API ด้วย code5
// คืน null ถ้าไม่พบ, คืน { _rateLimited:true } ถ้าโดน 429
async function _hspApiLookup(code5) {
  // ดึงจาก cache ก่อน
  if (_hspApiCache[code5] !== undefined) return _hspApiCache[code5];

  // ถูก rate-limit อยู่ — ไม่เรียกซ้ำ
  if (_hspApiRateLimited) return { _rateLimited: true };

  var token = await _hspGetToken();
  if (!token) return null;

  _hspApiTrackCall();
  try {
    var r = await fetch(HCODE_BASE + '/health_office/?code5=' + encodeURIComponent(code5) + '&page_size=1&active=1', {
      headers: { 'Authorization': 'Bearer ' + token }
    });

    if (r.status === 429) {
      _hspApiRateLimited = true;
      _hspApiUpdateQuota();
      return { _rateLimited: true };
    }
    if (!r.ok) { _hspApiCache[code5] = null; return null; }

    var data = await r.json();
    if (!data.results || !data.results.length) { _hspApiCache[code5] = null; return null; }
    var result = _hspMapApiResult(data.results[0]);
    _hspApiCache[code5] = result;
    return result;
  } catch(_) { return null; }
}

// แปลง field ที่อาจเป็น string / object / URL → ได้ string ชื่อ
function _hspAddrName(v) {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return v.name || v.name_th || v.label || String(v.id || '');
  return String(v);
}

// แปลง hospital_level + health_office_type + เตียง → type code (A/S/M1/M2/F1/F2/F3/P/other)
function _hspGuessType(item) {
  var beds = Number(item.bed) || 0;

  // ── ดึง hospital_level (อาจเป็น string / object / URL) ─────────────────
  var raw = item.hospital_level || '';
  var lvlStr = '';
  if (typeof raw === 'string')      lvlStr = raw;
  else if (typeof raw === 'object') lvlStr = raw.name || raw.code || String(raw.id || '');
  lvlStr = lvlStr.trim();

  // ── ตรงตัวจาก hospital_level (รองรับ "A", "ระดับ A", "level A" ฯลฯ) ──
  var lvlUp = lvlStr.toUpperCase().replace(/\s+/g, '').replace('ระดับ','').replace('LEVEL','');
  var directMap = { A:'A', S:'S', M1:'M1', M2:'M2', F1:'F1', F2:'F2', F3:'F3', P:'P', M:'M1' };
  if (directMap[lvlUp]) return directMap[lvlUp];

  // ── ดึง health_office_type (ชื่อภาษาไทยเต็ม) ───────────────────────────
  var raw2 = item.health_office_type || '';
  var hotStr = '';
  if (typeof raw2 === 'string')      hotStr = raw2;
  else if (typeof raw2 === 'object') hotStr = raw2.name || raw2.name_th || raw2.label || '';
  var hot = hotStr.toLowerCase();

  // เอกชน
  if (hot.includes('เอกชน') || hot.includes('private') || hot.includes('คลินิก')) return 'P';

  // โรงพยาบาลชุมชน (รพช.) → F1/F2/F3 โดยเตียง
  if (hot.includes('ชุมชน') || hot.includes('รพช') || hot.includes('district hospital')) {
    if (beds >= 60) return 'F1';
    if (beds >= 30) return 'F2';
    return 'F3';
  }
  // โรงพยาบาลทั่วไป (รพท.) → M1/M2
  if (hot.includes('ทั่วไป') || hot.includes('รพท') || hot.includes('general hospital')) {
    return beds >= 150 ? 'M1' : 'M2';
  }
  // โรงพยาบาลศูนย์ (รพศ.) / ศูนย์การแพทย์ → A/S
  if (hot.includes('ศูนย์') || hot.includes('รพศ') || hot.includes('regional') || hot.includes('มหาวิทยาลัย')) {
    return beds >= 500 ? 'A' : 'S';
  }

  // ── ประมาณจากเตียงเป็น fallback สุดท้าย ────────────────────────────────
  if (beds >= 500) return 'A';
  if (beds >= 300) return 'S';
  if (beds >= 150) return 'M1';
  if (beds >= 90)  return 'M2';
  if (beds >= 60)  return 'F1';
  if (beds >= 30)  return 'F2';
  if (beds > 0)    return 'F3';

  return 'other';
}

// แปลงข้อมูลจาก MOPH API → format ของแอปเรา
function _hspMapApiResult(item) {
  // address อาจเป็น array, object, หรือ null
  var addrList = Array.isArray(item.address) ? item.address : (item.address ? [item.address] : []);
  var addr = addrList[0] || {};

  var conts = Array.isArray(item.contact) ? item.contact : [];

  // หาเบอร์โทร
  var telObj = conts.find(function(c) {
    var ct = (c.contact_type || '').toLowerCase();
    return ct.includes('โทร') || ct.includes('tel') || ct.includes('phone') || ct.includes('มือถือ');
  });
  if (!telObj) telObj = conts.find(function(c) { return /\d{2,}/.test(c.name || ''); });
  var tel = telObj ? (telObj.name || '') : '';

  var province = _hspAddrName(addr.province);
  var district = _hspAddrName(addr.district);
  var tambon   = _hspAddrName(addr.subdistrict);

  // สร้างที่อยู่จาก field ย่อย
  var streetParts = [];
  if (addr.number)  streetParts.push(addr.number);
  if (addr.moo)     streetParts.push('หมู่ ' + addr.moo);
  if (addr.village) streetParts.push(addr.village);
  if (addr.alley)   streetParts.push('ซ.' + addr.alley);
  if (addr.street)  streetParts.push('ถ.' + addr.street);
  // รวมที่อยู่ถนน + ตำบล + อำเภอ + จังหวัด ให้เห็นครบ
  var locationParts = [];
  if (tambon)   locationParts.push('ต.' + tambon);
  if (district) locationParts.push('อ.' + district);
  if (province) locationParts.push('จ.' + province);
  if (addr.zipcode) locationParts.push(addr.zipcode);
  var addrStr = [...streetParts, ...locationParts].filter(Boolean).join(' ');

  return {
    id:          '',
    code:        item.code5        || '',
    name:        item.name         || '',
    type:        _hspGuessType(item),
    beds:        Number(item.bed)  || 0,
    province,
    district,
    tambon,
    address:     addrStr,
    tel:         tel,
    website:     '',
    affiliation: item.organization || item.department || '',
    note:        '',
    _fromApi:    true,
  };
}

// ── CONSTANTS ──────────────────────────────────────────────────────────────
const HSP_TYPES = [
  { id:'A',  label:'A – ระดับสูงสุด (500+ เตียง)',        color:'#7c5cfc' },
  { id:'S',  label:'S – ศูนย์/ทั่วไปใหญ่ (300–499)',      color:'#4361ee' },
  { id:'M1', label:'M1 – ทั่วไปกลาง (150–299)',           color:'#4cc9f0' },
  { id:'M2', label:'M2 – ทั่วไปเล็ก (90–149)',            color:'#06d6a0' },
  { id:'F1', label:'F1 – ชุมชนใหญ่ (60–89)',              color:'#ffa62b' },
  { id:'F2', label:'F2 – ชุมชนกลาง (30–59)',              color:'#ff8c42' },
  { id:'F3', label:'F3 – ชุมชนเล็ก (<30)',                color:'#ff6b6b' },
  { id:'P',  label:'P – เอกชน',                           color:'#f72585' },
  { id:'other', label:'อื่นๆ',                            color:'#9ba3b8' },
];
const HSP_TYPE_MAP = Object.fromEntries(HSP_TYPES.map(t => [t.id, t]));

const TH_PROVINCES = [
  'กรุงเทพมหานคร','กระบี่','กาญจนบุรี','กาฬสินธุ์','กำแพงเพชร','ขอนแก่น',
  'จันทบุรี','ฉะเชิงเทรา','ชลบุรี','ชัยนาท','ชัยภูมิ','ชุมพร','เชียงราย',
  'เชียงใหม่','ตรัง','ตราด','ตาก','นครนายก','นครปฐม','นครพนม','นครราชสีมา',
  'นครศรีธรรมราช','นครสวรรค์','นนทบุรี','นราธิวาส','น่าน','บึงกาฬ','บุรีรัมย์',
  'ปทุมธานี','ประจวบคีรีขันธ์','ปราจีนบุรี','ปัตตานี','พระนครศรีอยุธยา','พะเยา',
  'พังงา','พัทลุง','พิจิตร','พิษณุโลก','เพชรบุรี','เพชรบูรณ์','แพร่','ภูเก็ต',
  'มหาสารคาม','มุกดาหาร','แม่ฮ่องสอน','ยโสธร','ยะลา','ร้อยเอ็ด','ระนอง',
  'ระยอง','ราชบุรี','ลพบุรี','ลำปาง','ลำพูน','เลย','ศรีสะเกษ','สกลนคร',
  'สงขลา','สตูล','สมุทรปราการ','สมุทรสงคราม','สมุทรสาคร','สระแก้ว','สระบุรี',
  'สิงห์บุรี','สุโขทัย','สุพรรณบุรี','สุราษฎร์ธานี','สุรินทร์','หนองคาย',
  'หนองบัวลำภู','อ่างทอง','อำนาจเจริญ','อุดรธานี','อุตรดิตถ์','อุทัยธานี','อุบลราชธานี',
];

// ── STATE ──────────────────────────────────────────────────────────────────
window._hspPage = 1;
var _hspPerPage = 50;

// ── HELPERS ────────────────────────────────────────────────────────────────
function _hspType(id) { return HSP_TYPE_MAP[id] || HSP_TYPE_MAP['other']; }

function _hspFiltered() {
  var q    = (document.getElementById('hsp-q')?.value || '').trim().toLowerCase();
  var prov = document.getElementById('hsp-prov')?.value || '';
  var dist = document.getElementById('hsp-dist')?.value || '';
  var typ  = document.getElementById('hsp-type')?.value || '';

  return (window.HOSPITALS || []).filter(h => {
    if (prov && h.province !== prov) return false;
    if (dist && h.district !== dist) return false;
    if (typ  && h.type    !== typ)   return false;
    if (q) {
      var hay = (h.code + ' ' + h.name + ' ' + (h.district||'') + ' ' + (h.tambon||'') + ' ' + (h.affiliation||'')).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => (a.code || '').localeCompare(b.code || '', 'th'));
}

// ── RENDER ─────────────────────────────────────────────────────────────────
window.renderHospital = function() {
  var body = document.getElementById('hsp-body');
  if (!body) return;

  var all  = _hspFiltered();
  var total = all.length;
  var start = (window._hspPage - 1) * _hspPerPage;
  var rows  = all.slice(start, start + _hspPerPage);

  // update count
  var cnt = document.getElementById('hsp-count');
  if (cnt) cnt.textContent = total.toLocaleString() + ' แห่ง';

  // pagination
  var totalPages = Math.max(1, Math.ceil(total / _hspPerPage));
  if (window._hspPage > totalPages) window._hspPage = 1;

  var canEdit = window.isAdmin ? window.isAdmin() : false;
  if (!canEdit && window.canEdit) canEdit = window.canEdit('hospital');

  if (!rows.length) {
    body.innerHTML = '<div style="text-align:center;color:var(--txt-muted);padding:48px 24px;">ไม่พบข้อมูลโรงพยาบาล</div>';
    _renderHspPager(totalPages);
    return;
  }

  body.innerHTML = `
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:var(--bg);color:var(--txt-muted);font-size:11px;text-transform:uppercase;letter-spacing:.5px;">
            <th style="padding:8px 12px;text-align:left;border-bottom:1px solid var(--border);white-space:nowrap;">รหัส</th>
            <th style="padding:8px 12px;text-align:left;border-bottom:1px solid var(--border);">ชื่อโรงพยาบาล</th>
            <th style="padding:8px 12px;text-align:center;border-bottom:1px solid var(--border);white-space:nowrap;">ระดับ</th>
            <th style="padding:8px 12px;text-align:left;border-bottom:1px solid var(--border);white-space:nowrap;">จังหวัด</th>
            <th style="padding:8px 12px;text-align:right;border-bottom:1px solid var(--border);white-space:nowrap;">เตียง</th>
            <th style="padding:8px 12px;text-align:left;border-bottom:1px solid var(--border);white-space:nowrap;">โทรศัพท์</th>
            <th style="padding:8px 12px;text-align:left;border-bottom:1px solid var(--border);white-space:nowrap;">สังกัด</th>
            <th style="padding:8px 12px;text-align:center;border-bottom:1px solid var(--border);white-space:nowrap;">ผู้ติดต่อ</th>
            ${canEdit ? '<th style="padding:8px 12px;border-bottom:1px solid var(--border);"></th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${rows.map((h) => {
            var t = _hspType(h.type);
            var cCount = (h.contacts || []).length;
            return `<tr class="hsp-row" onclick="window.openHospitalDetail('${esc(h.id)}')"
              style="cursor:pointer;border-bottom:1px solid var(--border);transition:background .12s;"
              onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background=''">
              <td style="padding:9px 12px;font-family:monospace;font-weight:600;color:var(--primary);white-space:nowrap;">${esc(h.code)}</td>
              <td style="padding:9px 12px;font-weight:500;color:var(--txt);">${esc(h.name)}</td>
              <td style="padding:9px 12px;text-align:center;">
                <span style="background:${t.color}22;color:${t.color};padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700;">${esc(h.type||'?')}</span>
              </td>
              <td style="padding:9px 12px;color:var(--txt-muted);white-space:nowrap;">${esc(h.province)}</td>
              <td style="padding:9px 12px;text-align:right;color:var(--txt-muted);">${h.beds ? Number(h.beds).toLocaleString() : '—'}</td>
              <td style="padding:9px 12px;color:var(--txt-muted);white-space:nowrap;">${esc(h.tel||'—')}</td>
              <td style="padding:9px 12px;color:var(--txt-muted);font-size:12px;">${esc(h.affiliation||'—')}</td>
              <td style="padding:9px 12px;text-align:center;">
                ${cCount > 0
                  ? `<span style="background:var(--violet)22;color:var(--violet);padding:2px 9px;border-radius:10px;font-size:11px;font-weight:700;">${cCount}</span>`
                  : `<span style="color:var(--txt-muted);font-size:12px;">—</span>`}
              </td>
              ${canEdit ? `<td style="padding:9px 12px;text-align:right;" onclick="event.stopPropagation()">
                <button class="btn btn-ghost btn-sm" onclick="window.openHospitalModal('${esc(h.id)}')" title="แก้ไข">✏️</button>
                <button class="btn btn-ghost btn-sm" onclick="window.deleteHospital('${esc(h.id)}')" title="ลบ" style="color:var(--coral)">🗑</button>
              </td>` : ''}
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;

  _renderHspPager(totalPages);
};

function _renderHspPager(totalPages) {
  var pg = document.getElementById('hsp-pager');
  if (!pg) return;
  if (totalPages <= 1) { pg.innerHTML = ''; return; }
  var btns = '';
  btns += `<button class="btn btn-ghost btn-sm" onclick="window._hspGo(${window._hspPage-1})" ${window._hspPage<=1?'disabled':''}>‹</button>`;
  for (var p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - window._hspPage) <= 2) {
      btns += `<button class="btn btn-sm ${p===window._hspPage?'btn-pri':'btn-ghost'}" onclick="window._hspGo(${p})">${p}</button>`;
    } else if (Math.abs(p - window._hspPage) === 3) {
      btns += '<span style="color:var(--txt-muted);padding:0 4px;">…</span>';
    }
  }
  btns += `<button class="btn btn-ghost btn-sm" onclick="window._hspGo(${window._hspPage+1})" ${window._hspPage>=totalPages?'disabled':''}>›</button>`;
  pg.innerHTML = `<div style="display:flex;gap:4px;align-items:center;justify-content:center;flex-wrap:wrap;">${btns}</div>`;
}

window._hspGo = function(p) {
  var total = _hspFiltered().length;
  var max = Math.max(1, Math.ceil(total / _hspPerPage));
  window._hspPage = Math.max(1, Math.min(p, max));
  window.renderHospital();
};

// ── DETAIL POPUP ────────────────────────────────────────────────────────────
window._hspDetailId = null;

window._hspDetailTab = function(name) {
  var panels = {
    info:     document.getElementById('m-hsp-detail-panel-info'),
    contacts: document.getElementById('m-hsp-detail-panel-contacts')
  };
  var tabs = {
    info:     document.getElementById('m-hsp-dtab-info'),
    contacts: document.getElementById('m-hsp-dtab-contacts')
  };
  Object.keys(panels).forEach(function(k) {
    if (!panels[k] || !tabs[k]) return;
    var active = k === name;
    panels[k].style.display = active ? '' : 'none';
    tabs[k].style.color = active ? 'var(--violet)' : 'var(--txt-muted)';
    tabs[k].style.borderBottomColor = active ? 'var(--violet)' : 'transparent';
  });
};

window.openHospitalDetail = function(id) {
  var h = (window.HOSPITALS || []).find(x => x.id === id);
  if (!h) return;
  var t = _hspType(h.type);
  var canEdit = (window.isAdmin && window.isAdmin()) || (window.canEdit && window.canEdit('hospital'));
  var cs = h.contacts || [];

  window._hspDetailId = id;

  // ── Panel: ข้อมูลทั่วไป ──
  var fullAddr = h.address || [
    h.tambon   ? 'ต.' + h.tambon   : '',
    h.district ? 'อ.' + h.district : '',
    h.province || ''
  ].filter(Boolean).join(' ');

  document.getElementById('m-hsp-detail-panel-info').innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:20px;flex-wrap:wrap;">
      <div style="width:48px;height:48px;border-radius:12px;background:${t.color}22;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;">🏥</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:17px;font-weight:700;color:var(--txt);line-height:1.3;">${esc(h.name)}</div>
        <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap;">
          <span style="background:${t.color}22;color:${t.color};padding:2px 10px;border-radius:8px;font-size:12px;font-weight:700;">${esc(h.type||'?')}</span>
          <span style="background:var(--bg);color:var(--txt-muted);padding:2px 10px;border-radius:8px;font-size:12px;font-family:monospace;">รหัส: ${esc(h.code)}</span>
        </div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      ${_detailRow('🏢', 'สังกัด', h.affiliation)}
      ${_detailRow('🛏', 'จำนวนเตียง', h.beds ? Number(h.beds).toLocaleString() + ' เตียง' : '')}
      ${_detailRow('📍', 'จังหวัด', h.province)}
      ${_detailRow('🏘', 'อำเภอ/เขต', h.district)}
      ${_detailRow('🏡', 'ตำบล/แขวง', h.tambon)}
      ${_detailRow('📞', 'โทรศัพท์', h.tel)}
      ${_detailRow('🌐', 'Website', h.website)}
    </div>
    ${fullAddr ? `<div style="margin-top:12px;padding:10px 12px;background:var(--bg);border-radius:8px;font-size:12px;color:var(--txt-muted);"><b>📮 ที่อยู่:</b> ${esc(fullAddr)}</div>` : ''}
    ${h.note ? `<div style="margin-top:10px;padding:10px 12px;background:var(--warn)11;border-radius:8px;font-size:12px;color:var(--txt-muted);"><b>หมายเหตุ:</b> ${esc(h.note)}</div>` : ''}`;

  // ── Panel: ผู้ติดต่อ ──
  if (cs.length) {
    document.getElementById('m-hsp-detail-panel-contacts').innerHTML =
      `<div style="display:flex;flex-direction:column;gap:10px;">` +
      cs.map(function(c) {
        return `<div style="background:var(--bg);border-radius:10px;padding:14px 16px;border:1px solid var(--border);">
          <div style="font-size:14px;font-weight:700;color:var(--txt);">${esc(c.name||'—')}</div>
          ${c.position ? `<div style="font-size:11px;color:var(--violet);margin-top:2px;font-weight:600;">${esc(c.position)}</div>` : ''}
          <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:8px;font-size:12px;color:var(--txt-muted);">
            ${c.phone ? `<span>📞 ${esc(c.phone)}</span>` : ''}
            ${c.email ? `<span>✉️ ${esc(c.email)}</span>` : ''}
            ${c.note  ? `<span>💬 ${esc(c.note)}</span>` : ''}
          </div>
        </div>`;
      }).join('') +
      `</div>`;
  } else {
    document.getElementById('m-hsp-detail-panel-contacts').innerHTML =
      `<div style="text-align:center;color:var(--txt-muted);padding:48px 24px;font-size:13px;">ยังไม่มีข้อมูลผู้ติดต่อ</div>`;
  }

  // ── Badge & edit button ──
  var badge = document.getElementById('m-hsp-dtab-contacts-badge');
  if (badge) {
    if (cs.length) { badge.textContent = cs.length; badge.style.display = ''; }
    else badge.style.display = 'none';
  }
  var editBtn = document.getElementById('m-hsp-detail-edit-btn');
  if (editBtn) editBtn.style.display = canEdit ? '' : 'none';

  window._hspDetailTab('info');
  window.openM('m-hsp-detail');
};

function _detailRow(icon, label, val) {
  if (!val) return '';
  return `<div style="background:var(--bg);border-radius:8px;padding:10px 12px;">
    <div style="font-size:10px;color:var(--txt-muted);margin-bottom:2px;">${icon} ${label}</div>
    <div style="font-size:13px;color:var(--txt);font-weight:500;">${esc(String(val))}</div>
  </div>`;
}

// ── MODAL TABS ──────────────────────────────────────────────────────────────
window._hspTab = function(name) {
  var panels = { info: document.getElementById('m-hsp-panel-info'), contacts: document.getElementById('m-hsp-panel-contacts') };
  var tabs   = { info: document.getElementById('m-hsp-tab-info'),   contacts: document.getElementById('m-hsp-tab-contacts') };
  Object.keys(panels).forEach(function(k) {
    if (!panels[k] || !tabs[k]) return;
    var active = k === name;
    panels[k].style.display = active ? '' : 'none';
    tabs[k].style.color       = active ? 'var(--violet)' : 'var(--txt-muted)';
    tabs[k].style.borderBottomColor = active ? 'var(--violet)' : 'transparent';
  });
};

// ── CONTACTS HELPERS ────────────────────────────────────────────────────────
function _hspUpdateContactBadge() {
  var list  = document.getElementById('hsp-contacts-list');
  var badge = document.getElementById('m-hsp-tab-contacts-badge');
  if (!badge) return;
  var count = list ? list.querySelectorAll('.hsp-contact-row').length : 0;
  badge.textContent = count;
  badge.style.display = count ? '' : 'none';
}

window._hspAddContact = function(c) {
  var list = document.getElementById('hsp-contacts-list');
  var empty = document.getElementById('hsp-contacts-empty');
  if (!list) return;
  if (empty) empty.style.display = 'none';

  var row = document.createElement('div');
  row.className = 'hsp-contact-row';
  row.style.cssText = 'background:var(--bg);border-radius:8px;padding:10px 12px;margin-bottom:8px;border:1px solid var(--border);';
  row.innerHTML =
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">' +
      '<input class="f-input" placeholder="ชื่อ-นามสกุล" data-cf="name" value="' + esc(c?.name||'') + '" style="margin:0;">' +
      '<input class="f-input" placeholder="เบอร์โทร" data-cf="phone" value="' + esc(c?.phone||'') + '" style="margin:0;">' +
      '<input class="f-input" placeholder="ตำแหน่ง" data-cf="position" value="' + esc(c?.position||'') + '" style="margin:0;">' +
      '<input class="f-input" placeholder="Email" data-cf="email" type="email" value="' + esc(c?.email||'') + '" style="margin:0;">' +
      '<input class="f-input" placeholder="หมายเหตุ" data-cf="note" value="' + esc(c?.note||'') + '" style="margin:0;grid-column:1/-1;">' +
    '</div>' +
    '<div style="text-align:right;">' +
      '<button type="button" class="btn btn-ghost btn-sm" onclick="window._hspRemoveContact(this)" style="color:var(--coral);font-size:11px;">🗑 ลบผู้ติดต่อ</button>' +
    '</div>';
  list.appendChild(row);
  _hspUpdateContactBadge();
};

window._hspRemoveContact = function(btn) {
  var row = btn.closest('.hsp-contact-row');
  if (row) row.remove();
  var list = document.getElementById('hsp-contacts-list');
  var empty = document.getElementById('hsp-contacts-empty');
  if (empty && list && !list.querySelector('.hsp-contact-row')) empty.style.display = '';
  _hspUpdateContactBadge();
};

function _hspGetContacts() {
  var contacts = [];
  document.querySelectorAll('#hsp-contacts-list .hsp-contact-row').forEach(function(row) {
    var name     = (row.querySelector('[data-cf="name"]').value     || '').trim();
    var phone    = (row.querySelector('[data-cf="phone"]').value    || '').trim();
    var position = (row.querySelector('[data-cf="position"]').value || '').trim();
    var email    = (row.querySelector('[data-cf="email"]').value    || '').trim();
    var note     = (row.querySelector('[data-cf="note"]').value     || '').trim();
    if (name || phone || email) contacts.push({ name, phone, position, email, note });
  });
  return contacts;
}

// ── ADD / EDIT MODAL ────────────────────────────────────────────────────────
window.openHospitalModal = function(id) {
  var h = id ? (window.HOSPITALS || []).find(x => x.id === id) : null;
  var isNew = !h;

  document.getElementById('m-hsp-title').textContent = isNew ? '➕ เพิ่มโรงพยาบาล' : '✏️ แก้ไขโรงพยาบาล';
  document.getElementById('m-hsp-id').value = h?.id || '';

  document.getElementById('m-hsp-code').value        = h?.code || '';
  document.getElementById('m-hsp-name').value        = h?.name || '';
  document.getElementById('m-hsp-type').value        = h?.type || '';
  document.getElementById('m-hsp-beds').value        = h?.beds || '';
  document.getElementById('m-hsp-province').value    = h?.province || '';
  document.getElementById('m-hsp-district').value    = h?.district || '';
  document.getElementById('m-hsp-tambon').value      = h?.tambon || '';
  document.getElementById('m-hsp-address').value     = h?.address || '';
  document.getElementById('m-hsp-tel').value         = h?.tel || '';
  document.getElementById('m-hsp-website').value     = h?.website || '';
  document.getElementById('m-hsp-affiliation').value = h?.affiliation || '';
  document.getElementById('m-hsp-note').value        = h?.note || '';

  // ── ผู้ติดต่อ ────────────────────────────────────────────────────────────
  var cl = document.getElementById('hsp-contacts-list');
  var ce = document.getElementById('hsp-contacts-empty');
  if (cl) cl.innerHTML = '';
  var contacts = h?.contacts || [];
  if (ce) ce.style.display = contacts.length ? 'none' : '';
  contacts.forEach(function(c) { window._hspAddContact(c); });
  _hspUpdateContactBadge();

  // ดึงตัวเลือก district/tambon ตามจังหวัดที่เลือก
  window._hspFormProvinceChanged(false);
  window._hspFormDistrictChanged(false);

  window._hspTab('info');
  window.openM('m-hsp');
};

window.saveHospital = async function() {
  var id   = document.getElementById('m-hsp-id').value;
  var code = document.getElementById('m-hsp-code').value.trim();
  var name = document.getElementById('m-hsp-name').value.trim();

  if (!code) { window.showAlert('กรุณากรอกรหัสสถานพยาบาล', 'warn'); return; }
  if (!name) { window.showAlert('กรุณากรอกชื่อโรงพยาบาล', 'warn'); return; }

  var dup = (window.HOSPITALS || []).find(function(h) { return h.code === code && h.id !== id; });
  if (dup) { window.showAlert('รหัส ' + code + ' มีอยู่แล้ว (' + dup.name + ')', 'warn'); return; }

  var btn = document.getElementById('m-hsp-save');
  try {
    if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }

    // ── รวบรวมค่าจากฟอร์ม ────────────────────────────────────────────────
    var fName        = name;
    var fType        = document.getElementById('m-hsp-type').value.trim();
    var fBeds        = Number(document.getElementById('m-hsp-beds').value) || 0;
    var fProvince    = document.getElementById('m-hsp-province').value.trim();
    var fDistrict    = document.getElementById('m-hsp-district').value.trim();
    var fTambon      = document.getElementById('m-hsp-tambon').value.trim();
    var fAddress     = document.getElementById('m-hsp-address').value.trim();
    var fTel         = document.getElementById('m-hsp-tel').value.trim();
    var fWebsite     = document.getElementById('m-hsp-website').value.trim();
    var fAffiliation = document.getElementById('m-hsp-affiliation').value.trim();
    var fNote        = document.getElementById('m-hsp-note').value.trim();
    var fContacts    = _hspGetContacts();

    // ── ดึง MOPH API เมื่อมี field ที่ว่าง ───────────────────────────────
    var missingFields = !fProvince || !fDistrict || !fType || !fTel || !fAffiliation;
    var hasApiStored  = !!(localStorage.getItem(HCODE_REFRESH_KEY) || localStorage.getItem(HCODE_TOKEN_KEY));
    var enriched = false;

    if (missingFields && hasApiStored) {
      if (btn) btn.textContent = 'กำลังตรวจสอบ token...';
      var validToken = await _hspGetToken();

      if (!validToken) {
        // token หมดอายุและ refresh ใช้ไม่ได้ → เปิด login modal ทันที
        if (btn) { btn.disabled = false; btn.textContent = '💾 บันทึก'; }
        // inject hint ใน modal เพื่อบอกว่าต้อง login แล้วบันทึกใหม่
        var apiStat = document.getElementById('hsp-api-stat');
        if (apiStat) apiStat.innerHTML =
          '<span style="color:#ffa62b;font-weight:700;">⚠️ Session หมดอายุ</span>' +
          '<span style="color:var(--txt-muted);font-size:11px;margin-left:8px;">ล็อกอินใหม่แล้วกด บันทึก อีกครั้ง</span>';
        var errBox = document.getElementById('hsp-api-err');
        if (errBox) { errBox.textContent = 'กรุณาล็อกอินใหม่เพื่อให้ระบบเติมข้อมูล ' + code + ' จาก MOPH API โดยอัตโนมัติ'; errBox.style.display = ''; }
        window.openM('m-hsp-api');
        return;
      }

      if (btn) btn.textContent = 'กำลังดึงข้อมูลจาก MOPH...';
      var api = await _hspApiLookup(code);
      if (api && !api._rateLimited) {
        // ใช้ค่าจาก API เฉพาะ field ที่ว่างเท่านั้น — ค่าที่กรอกมีความสำคัญกว่า
        if (!fProvince    && api.province)    { fProvince    = api.province;    enriched = true; }
        if (!fDistrict    && api.district)    { fDistrict    = api.district;    enriched = true; }
        if (!fTambon      && api.tambon)      { fTambon      = api.tambon;      enriched = true; }
        if (!fAddress     && api.address)     { fAddress     = api.address;     enriched = true; }
        if (!fTel         && api.tel)         { fTel         = api.tel;         enriched = true; }
        if (!fAffiliation && api.affiliation) { fAffiliation = api.affiliation; enriched = true; }
        if (!fType || fType === 'other') {
          var apiType = api.type;
          if (apiType && apiType !== 'other') { fType = apiType; enriched = true; }
        }
        if (fBeds === 0 && api.beds > 0)      { fBeds = api.beds;              enriched = true; }
        // อัปเดตค่าในฟอร์มให้เห็น
        if (enriched) {
          document.getElementById('m-hsp-type').value        = fType;
          document.getElementById('m-hsp-beds').value        = fBeds || '';
          document.getElementById('m-hsp-province').value    = fProvince;
          document.getElementById('m-hsp-district').value    = fDistrict;
          document.getElementById('m-hsp-tambon').value      = fTambon;
          document.getElementById('m-hsp-address').value     = fAddress;
          document.getElementById('m-hsp-tel').value         = fTel;
          document.getElementById('m-hsp-affiliation').value = fAffiliation;
          window._hspFormProvinceChanged(false);
          window._hspFormDistrictChanged(false);
        }
      }
    }

    if (btn) btn.textContent = 'กำลังบันทึก...';

    var data = {
      hospital_id:  id || uid(),
      code,
      name:        fName,
      type:        fType        || 'other',
      beds:        fBeds,
      province:    fProvince,
      district:    fDistrict,
      tambon:      fTambon,
      address:     fAddress,
      tel:         fTel,
      website:     fWebsite,
      affiliation: fAffiliation,
      note:        fNote,
      contacts:    fContacts,
    };

    await window.setDoc(getDocRef('HOSPITALS', data.hospital_id), data);
    window.closeM('m-hsp');

    var msg = id ? 'อัปเดตข้อมูลแล้ว' : 'เพิ่มโรงพยาบาลแล้ว';
    if (enriched) msg += ' · เติมข้อมูลจาก MOPH API';
    window.showAlert(msg, 'success');

  } catch(e) {
    window.showAlert('บันทึกไม่สำเร็จ: ' + e.message, 'warn');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 บันทึก'; }
  }
};

window.deleteHospital = async function(id) {
  var h = (window.HOSPITALS || []).find(x => x.id === id);
  if (!h) return;
  if (!confirm(`ลบ "${h.name}" ออกจากระบบ?`)) return;
  try {
    await window.deleteDoc(getDocRef('HOSPITALS', id));
    window.showAlert('ลบข้อมูลแล้ว', 'success');
  } catch(e) {
    window.showAlert('ลบไม่สำเร็จ: ' + e.message, 'warn');
  }
};

// ── DOWNLOAD TEMPLATE ────────────────────────────────────────────────────────
window.downloadHospitalTemplate = function() {
  var wb = XLSX.utils.book_new();

  // ── Sheet 1: รายชื่อ รพ. (ข้อมูลหลัก) ──────────────────────────────────
  var headers = [
    'hospital_code','hospital_name','hospital_type','beds',
    'province','district','tambon','address',
    'tel','website','affiliation','note',
  ];

  var examples = [
    // แบบ code only (ถ้าเชื่อมต่อ MOPH API จะดึงข้อมูลให้อัตโนมัติ)
    ['10669','','','','','','','','','','',''],
    ['10710','','','','','','','','','','',''],
    ['10736','','','','','','','','','','',''],
    // แบบกรอกข้อมูลครบ
    ['11001','โรงพยาบาลนนทบุรี','S',388,'นนทบุรี','เมืองนนทบุรี','สวรรค์ใต้','68 ถ.รัตนาธิเบศร์ ต.สวรรค์ใต้ อ.เมือง จ.นนทบุรี','02-589-5000','','กระทรวงสาธารณสุข',''],
    ['10773','โรงพยาบาลรามาธิบดี','A',1200,'กรุงเทพมหานคร','ราษฎร์บูรณะ','','270 ถ.พระรามหก แขวงทุ่งพญาไท เขตราษฎร์บูรณะ','02-201-1000','www.rama.mahidol.ac.th','มหาวิทยาลัยมหิดล',''],
    ['13770','โรงพยาบาลชัยบาดาล','F1',90,'ลพบุรี','ชัยบาดาล','ลำนารายณ์','ถ.พหลโยธิน ต.ลำนารายณ์ อ.ชัยบาดาล จ.ลพบุรี 15130','036-459-009','','กระทรวงสาธารณสุข',''],
    ['11101','คลินิกเวชกรรมตัวอย่าง','P',0,'กรุงเทพมหานคร','บางรัก','','12/34 ถ.สีลม แขวงบางรัก','02-000-0000','','เอกชน','ตัวอย่างประเภท P'],
  ];

  var ws1 = XLSX.utils.aoa_to_sheet([headers, ...examples]);
  ws1['!cols'] = [
    {wch:14},{wch:38},{wch:13},{wch:7},
    {wch:20},{wch:18},{wch:16},{wch:46},
    {wch:15},{wch:28},{wch:22},{wch:22},
  ];
  XLSX.utils.book_append_sheet(wb, ws1, 'รายชื่อ รพ.');

  // ── Sheet 2: คำแนะนำ ─────────────────────────────────────────────────────
  var guide = [
    ['=== คู่มือการกรอกไฟล์นำเข้าโรงพยาบาล ==='],
    [''],
    ['● ชื่อคอลัมน์ (Header) ที่ระบบรองรับ'],
    ['ชื่อคอลัมน์หลัก','ชื่อทางเลือก (ใช้แทนกันได้)','คำอธิบาย','จำเป็น?'],
    ['hospital_code',  'รหัสสถานพยาบาล, รหัส, code, hcode',  'รหัส 5 หลัก (HOS Code)',                   '✅ จำเป็น'],
    ['hospital_name',  'ชื่อโรงพยาบาล, ชื่อ, name',           'ชื่อโรงพยาบาล (ว่างได้ถ้าเชื่อม MOPH API)', '—'],
    ['hospital_type',  'ระดับ, ประเภท, type',                  'รหัสระดับ รพ. (ดูตารางด้านล่าง)',            '—'],
    ['beds',           'เตียง, จำนวนเตียง',                     'จำนวนเตียง (ตัวเลข)',                        '—'],
    ['province',       'จังหวัด',                               'ชื่อจังหวัด เช่น กรุงเทพมหานคร',            '—'],
    ['district',       'อำเภอ, เขต',                            'ชื่ออำเภอ/เขต',                              '—'],
    ['tambon',         'subdistrict, ตำบล, แขวง',               'ชื่อตำบล/แขวง',                             '—'],
    ['address',        'ที่อยู่',                                'ที่อยู่เต็ม',                                '—'],
    ['tel',            'telephone, โทรศัพท์, phone',            'หมายเลขโทรศัพท์',                           '—'],
    ['website',        'เว็บ',                                   'URL เว็บไซต์',                               '—'],
    ['affiliation',    'สังกัด',                                 'สังกัด เช่น กระทรวงสาธารณสุข',             '—'],
    ['note',           'หมายเหตุ',                              'หมายเหตุเพิ่มเติม',                          '—'],
    [''],
    ['● รหัสระดับโรงพยาบาล (hospital_type)'],
    ['รหัส','ความหมาย','จำนวนเตียงอ้างอิง'],
    ['A',     'โรงพยาบาลศูนย์ระดับสูงสุด',       '500+ เตียง'],
    ['S',     'โรงพยาบาลศูนย์/ทั่วไปขนาดใหญ่',  '300–499 เตียง'],
    ['M1',    'โรงพยาบาลทั่วไปขนาดกลาง',        '150–299 เตียง'],
    ['M2',    'โรงพยาบาลทั่วไปขนาดเล็ก',         '90–149 เตียง'],
    ['F1',    'โรงพยาบาลชุมชนขนาดใหญ่',         '60–89 เตียง'],
    ['F2',    'โรงพยาบาลชุมชนขนาดกลาง',         '30–59 เตียง'],
    ['F3',    'โรงพยาบาลชุมชนขนาดเล็ก',          '<30 เตียง'],
    ['P',     'โรงพยาบาลเอกชน / คลินิก',         '—'],
    ['other', 'อื่นๆ / ไม่ระบุ',                 '—'],
    [''],
    ['● หมายเหตุสำคัญ'],
    ['1. หากเชื่อมต่อ MOPH API แล้ว กรอกแค่ hospital_code ก็พอ ระบบดึงชื่อ/ที่อยู่/ระดับให้อัตโนมัติ'],
    ['2. ข้อมูลที่กรอกในไฟล์จะมีความสำคัญเหนือกว่า MOPH API เสมอ'],
    ['3. รหัสที่ซ้ำกันในไฟล์ — ระบบจะเก็บเฉพาะแถวแรก'],
    ['4. รหัสที่มีอยู่ในระบบแล้ว — ระบบจะ "อัปเดต" ข้อมูล ไม่สร้างซ้ำ'],
    ['5. ถ้าเลือก "ลบข้อมูลเดิมก่อนนำเข้า" — ข้อมูลเดิมทั้งหมดจะถูกลบแล้วแทนที่ด้วยไฟล์นี้'],
  ];

  var ws2 = XLSX.utils.aoa_to_sheet(guide);
  ws2['!cols'] = [{wch:18},{wch:40},{wch:30},{wch:12}];
  XLSX.utils.book_append_sheet(wb, ws2, 'คำแนะนำ');

  XLSX.writeFile(wb, 'Template_HOSPITALS.xlsx');
};

// ── CONTACTS IMPORT ──────────────────────────────────────────────────────────

window.downloadHospitalContactsTemplate = function() {
  var wb = XLSX.utils.book_new();

  var headers = ['hospital_code','contact_name','phone','position','email','note'];
  var examples = [
    ['10669','นพ.สมชาย ใจดี','043-246-100 ต่อ 101','ผู้อำนวยการ','director@kkhospital.go.th','ติดต่อได้วันจันทร์-ศุกร์'],
    ['10669','นางสาวสมหญิง รักงาน','081-234-5678','พยาบาลวิชาชีพ','nurse@kkhospital.go.th',''],
    ['10710','นายพิชัย มั่นคง','042-512-000','เลขานุการ','secretary@udonhosp.go.th',''],
  ];
  var wsData = [headers, ...examples];
  var ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{wch:14},{wch:22},{wch:18},{wch:20},{wch:28},{wch:28}];
  XLSX.utils.book_append_sheet(wb, ws, 'ผู้ติดต่อ รพ.');

  var guide = [
    ['คอลัมน์','คำอธิบาย','ตัวอย่าง','จำเป็น'],
    ['hospital_code','รหัสสถานพยาบาล 5 หลัก','10669','✅'],
    ['contact_name','ชื่อ-นามสกุลผู้ติดต่อ','นพ.สมชาย ใจดี','✅'],
    ['phone','เบอร์โทรศัพท์','043-246-100 ต่อ 101',''],
    ['position','ตำแหน่งงาน','ผู้อำนวยการ',''],
    ['email','อีเมล','director@hospital.go.th',''],
    ['note','หมายเหตุ','ติดต่อได้ในเวลาราชการ',''],
    ['','','',''],
    ['หมายเหตุ','1 แถว = 1 ผู้ติดต่อ · รพ.เดียวกันใส่หลายแถวได้','',''],
    ['','ตัวเลือก "เพิ่มเติม": เพิ่มผู้ติดต่อใหม่โดยไม่ลบรายเดิม','',''],
    ['','ค่าเริ่มต้น: แทนที่ผู้ติดต่อทั้งหมดของ รพ. ที่อยู่ในไฟล์','',''],
  ];
  var ws2 = XLSX.utils.aoa_to_sheet(guide);
  ws2['!cols'] = [{wch:18},{wch:46},{wch:28},{wch:8}];
  XLSX.utils.book_append_sheet(wb, ws2, 'คำแนะนำ');

  XLSX.writeFile(wb, 'Template_HOSPITAL_CONTACTS.xlsx');
};

// pending state
window._hspContactsImportPending = null;

window.importHospitalContactsFromFile = async function(file) {
  try {
    var ab = await file.arrayBuffer();
    var wb = XLSX.read(ab);
    var ws = wb.Sheets[wb.SheetNames[0]];
    var rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    if (!rows.length) { window.showAlert('ไม่พบข้อมูลในไฟล์', 'warn'); return; }

    // หา column keys
    var headers = Object.keys(rows[0]);
    function findCol(aliases) {
      for (var a of aliases) {
        var found = headers.find(function(h) { return h.trim().toLowerCase() === a.toLowerCase(); });
        if (found) return found;
      }
      return null;
    }
    var colCode     = findCol(['hospital_code','รหัสสถานพยาบาล','รหัส','code','hcode']);
    var colName     = findCol(['contact_name','ชื่อผู้ติดต่อ','ชื่อ-นามสกุล','ชื่อ','name']);
    var colPhone    = findCol(['phone','เบอร์โทร','โทรศัพท์','tel','telephone']);
    var colPosition = findCol(['position','ตำแหน่ง','ตำแหน่งงาน']);
    var colEmail    = findCol(['email','อีเมล','e-mail']);
    var colNote     = findCol(['note','หมายเหตุ','remark']);

    if (!colCode) { window.showAlert('ไม่พบคอลัมน์รหัสสถานพยาบาล (hospital_code)', 'warn'); return; }
    if (!colName) { window.showAlert('ไม่พบคอลัมน์ชื่อผู้ติดต่อ (contact_name)', 'warn'); return; }

    // จัดกลุ่ม contacts ตาม hospital_code
    var groups = {}; // code → [{name,phone,position,email,note}]
    var errorRows = [];

    rows.forEach(function(row, i) {
      var code    = String(colCode ? row[colCode] : '').trim();
      var cName   = String(colName     ? row[colName]     : '').trim();
      var cPhone  = String(colPhone    ? row[colPhone]    : '').trim();
      var cPos    = String(colPosition ? row[colPosition] : '').trim();
      var cEmail  = String(colEmail    ? row[colEmail]    : '').trim();
      var cNote   = String(colNote     ? row[colNote]     : '').trim();

      if (!code) { errorRows.push({ rowNum: i + 2, reason: 'ไม่มีรหัสสถานพยาบาล' }); return; }
      if (!cName) { errorRows.push({ rowNum: i + 2, code, reason: 'ไม่มีชื่อผู้ติดต่อ' }); return; }

      if (!groups[code]) groups[code] = [];
      groups[code].push({ name: cName, phone: cPhone, position: cPos, email: cEmail, note: cNote });
    });

    // จับคู่กับ window.HOSPITALS
    var hospitals = window.HOSPITALS || [];
    var entries = Object.keys(groups).map(function(code) {
      var h = hospitals.find(function(x) { return x.code === code; });
      return {
        code,
        hospName:    h ? h.name : null,
        hospId:      h ? h.id   : null,
        contacts:    groups[code],
        existing:    h ? (h.contacts || []).length : 0,
        status:      !h ? 'not_found' : (h.contacts && h.contacts.length) ? 'update' : 'new',
      };
    });

    window._hspContactsImportPending = { entries, errorRows, fileName: file.name };
    _hspShowContactsImportPreview();

  } catch(err) {
    window.showAlert('อ่านไฟล์ไม่สำเร็จ: ' + err.message, 'warn');
  }
};

function _hspShowContactsImportPreview() {
  var pending = window._hspContactsImportPending;
  if (!pending) return;
  var { entries, errorRows, fileName } = pending;

  var found    = entries.filter(function(e) { return e.status !== 'not_found'; });
  var notFound = entries.filter(function(e) { return e.status === 'not_found'; });
  var totalContacts = found.reduce(function(s, e) { return s + e.contacts.length; }, 0);

  var statusColor = { new: 'var(--teal)', update: 'var(--violet)', not_found: 'var(--coral)' };
  var statusLabel = { new: '🟢 ใหม่', update: '🔵 มีอยู่แล้ว', not_found: '🔴 ไม่พบ รพ.' };

  var html =
    '<div style="padding:16px 24px 0;">' +
      // summary
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;">' +
        _cimportStat('🏥 รพ.ที่พบ', found.length, 'var(--teal)') +
        _cimportStat('👤 ผู้ติดต่อ', totalContacts, 'var(--violet)') +
        _cimportStat('🔴 ไม่พบ รพ.', notFound.length, notFound.length ? 'var(--coral)' : 'var(--txt-muted)') +
        _cimportStat('⚠ แถวผิดพลาด', errorRows.length, errorRows.length ? '#ffa62b' : 'var(--txt-muted)') +
      '</div>' +
      '<div style="font-size:11px;color:var(--txt-muted);margin-bottom:12px;">📄 ' + esc(fileName) + '</div>' +
    '</div>' +
    '<div style="padding:0 24px 16px;">' +
      // header row
      '<div style="display:grid;grid-template-columns:110px 1fr 60px 70px;gap:8px;padding:6px 10px;font-size:11px;font-weight:700;color:var(--txt-muted);border-bottom:1px solid var(--border);margin-bottom:6px;">' +
        '<div>รหัส</div><div>โรงพยาบาล</div><div style="text-align:center;">ผู้ติดต่อ</div><div style="text-align:center;">สถานะ</div>' +
      '</div>' +
      entries.map(function(e) {
        var sc = statusColor[e.status];
        return '<div style="display:grid;grid-template-columns:110px 1fr 60px 70px;gap:8px;padding:7px 10px;' +
          'border-radius:6px;font-size:12px;border-bottom:1px solid var(--border);align-items:center;">' +
          '<div style="font-family:monospace;color:var(--txt-muted);">' + esc(e.code) + '</div>' +
          '<div style="color:var(--txt);">' + (e.hospName ? esc(e.hospName) : '<span style="color:var(--coral);font-style:italic;">ไม่พบในระบบ</span>') + '</div>' +
          '<div style="text-align:center;font-weight:600;color:var(--violet);">' + e.contacts.length + '</div>' +
          '<div style="text-align:center;"><span style="font-size:11px;color:' + sc + ';font-weight:600;">' + statusLabel[e.status] + '</span></div>' +
          '</div>';
      }).join('') +
      (errorRows.length ?
        '<div style="margin-top:12px;padding:10px 12px;background:#ffa62b18;border:1px solid #ffa62b44;border-radius:8px;font-size:12px;">' +
        '<b style="color:#ffa62b;">⚠ แถวที่มีปัญหา (' + errorRows.length + ' แถว)</b>' +
        errorRows.slice(0,5).map(function(r){ return '<div style="color:var(--txt-muted);margin-top:4px;">แถว ' + r.rowNum + ': ' + esc(r.reason) + (r.code?' ('+esc(r.code)+')':'') + '</div>'; }).join('') +
        (errorRows.length > 5 ? '<div style="color:var(--txt-muted);margin-top:4px;">... และอีก ' + (errorRows.length-5) + ' แถว</div>' : '') +
        '</div>' : '') +
    '</div>';

  var body = document.getElementById('m-hsp-cimport-body');
  if (body) body.innerHTML = html;

  var confirmBtn = document.getElementById('m-hsp-cimport-confirm-btn');
  if (confirmBtn) confirmBtn.disabled = found.length === 0;

  var appendCb = document.getElementById('hsp-cimport-append-cb');
  if (appendCb) appendCb.checked = false;

  window.openM('m-hsp-cimport');
}

function _cimportStat(label, val, color) {
  return '<div style="background:var(--bg);border-radius:8px;padding:10px 16px;flex:1;min-width:100px;border:1px solid var(--border);">' +
    '<div style="font-size:20px;font-weight:800;color:' + color + ';">' + val + '</div>' +
    '<div style="font-size:11px;color:var(--txt-muted);margin-top:2px;">' + label + '</div>' +
    '</div>';
}

window.confirmImportHospitalContacts = async function() {
  var pending = window._hspContactsImportPending;
  if (!pending) return;

  var append = document.getElementById('hsp-cimport-append-cb')?.checked || false;
  var found  = pending.entries.filter(function(e) { return e.status !== 'not_found'; });
  if (!found.length) return;

  var btn = document.getElementById('m-hsp-cimport-confirm-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }

  var body = document.getElementById('m-hsp-cimport-body');

  try {
    var db = window.getDb();
    var batch = window.writeBatch(db);
    var batchCount = 0;

    for (var i = 0; i < found.length; i++) {
      var e = found[i];
      var h = (window.HOSPITALS || []).find(function(x) { return x.id === e.hospId; });
      if (!h) continue;

      var newContacts = append
        ? (h.contacts || []).concat(e.contacts)
        : e.contacts;

      batch.set(
        getDocRef('HOSPITALS', h.id),
        Object.assign({}, h, { hospital_id: h.id, contacts: newContacts }),
        { merge: true }
      );
      batchCount++;

      if (batchCount % 400 === 0) {
        await batch.commit();
        batch = window.writeBatch(db);
      }

      if (body) body.innerHTML = '<div style="padding:32px;text-align:center;color:var(--txt-muted);">กำลังบันทึก ' + (i+1) + ' / ' + found.length + ' โรงพยาบาล...</div>';
    }

    if (batchCount % 400 !== 0) await batch.commit();

    window.closeM('m-hsp-cimport');
    window._hspContactsImportPending = null;
    var totalContacts = found.reduce(function(s, e) { return s + e.contacts.length; }, 0);
    window.showAlert('นำเข้าผู้ติดต่อสำเร็จ · ' + found.length + ' รพ. · ' + totalContacts + ' ผู้ติดต่อ', 'success');

  } catch(err) {
    window.showAlert('บันทึกไม่สำเร็จ: ' + err.message, 'warn');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✅ ยืนยันนำเข้า'; }
  }
};

// ── EXCEL IMPORT — STEP 1: อ่านไฟล์ + สร้าง Preview ────────────────────────

// column aliases สำหรับ import (ใช้ร่วมกันทั้ง preview และ confirm)
var _HSP_COL_MAP = {
  code:        ['hospital_code','รหัสสถานพยาบาล','รหัส','code','hcode','hcode5'],
  name:        ['hospital_name','ชื่อ','ชื่อโรงพยาบาล','name'],
  type:        ['hospital_type','ระดับ','ประเภท','type'],
  beds:        ['beds','เตียง','จำนวนเตียง'],
  province:    ['province','จังหวัด'],
  district:    ['district','อำเภอ','เขต'],
  tambon:      ['tambon','subdistrict','ตำบล','แขวง'],
  address:     ['address','ที่อยู่'],
  tel:         ['tel','telephone','โทรศัพท์','phone'],
  website:     ['website','เว็บ'],
  affiliation: ['affiliation','สังกัด'],
  note:        ['note','หมายเหตุ'],
};

function _hspGetColKeys(headers) {
  var colKeys = {};
  for (var field in _HSP_COL_MAP) {
    var aliases = _HSP_COL_MAP[field];
    var found = null;
    for (var k of aliases) {
      found = headers.find(function(h) { return h.trim().toLowerCase() === k.toLowerCase(); });
      if (found) break;
    }
    colKeys[field] = found || null;
  }
  return colKeys;
}

// pending import state
window._hspImportPending = null;

window.importHospitalsFromFile = async function(file) {
  var progressEl = document.getElementById('hsp-import-progress');
  function setProgress(msg) { if (progressEl) progressEl.textContent = msg; }

  try {
    setProgress('กำลังอ่านไฟล์...');
    var ab = await file.arrayBuffer();
    var wb = XLSX.read(ab);
    var ws = wb.Sheets[wb.SheetNames[0]];
    var rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    if (!rows.length) { window.showAlert('ไม่พบข้อมูลในไฟล์', 'warn'); setProgress(''); return; }

    var headers = Object.keys(rows[0]);
    var colKeys = _hspGetColKeys(headers);
    var seenCodes = new Set();
    var items = [];

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var code = String(colKeys.code ? row[colKeys.code] : '').trim();

      if (!code) {
        items.push({ rowNum: i + 2, code: '', name: '', province: '', type: '', status: 'error', reason: 'ไม่มีรหัสสถานพยาบาล', rowData: row });
        continue;
      }

      var exName     = String(colKeys.name     ? row[colKeys.name]     : '').trim();
      var exProvince = String(colKeys.province  ? row[colKeys.province] : '').trim();
      var exType     = String(colKeys.type      ? row[colKeys.type]     : '').trim();

      if (seenCodes.has(code)) {
        items.push({ rowNum: i + 2, code, name: exName, province: exProvince, type: exType, status: 'dup_file', reason: 'รหัสซ้ำในไฟล์', rowData: row });
        continue;
      }
      seenCodes.add(code);

      var existing = (window.HOSPITALS || []).find(function(h) { return h.code === code; });
      items.push({
        rowNum: i + 2,
        code,
        name:       exName     || existing?.name     || '',
        province:   exProvince || existing?.province || '',
        type:       exType     || existing?.type     || '',
        status:     existing ? 'update' : 'new',
        reason:     '',
        existingId: existing ? existing.id : null,
        rowData:    row,
      });
    }

    setProgress('');
    window._hspImportPending = { items, colKeys, fileName: file.name };
    _hspShowImportPreview();

  } catch(err) {
    setProgress('');
    window.showAlert('อ่านไฟล์ไม่สำเร็จ: ' + err.message, 'warn');
  }
};

window.importHospitalsExcel = function() {
  var inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.xlsx,.xls,.csv';
  inp.onchange = function(e) {
    var file = e.target.files[0];
    if (!file) return;
    window.importHospitalsFromFile(file);
  };
  inp.click();
};

// ── STEP 2: แสดง Preview Modal ───────────────────────────────────────────────

function _hspShowImportPreview() {
  var pending = window._hspImportPending;
  if (!pending) return;
  var { items, fileName } = pending;

  var counts = { new: 0, update: 0, dup_file: 0, error: 0 };
  items.forEach(function(it) { counts[it.status] = (counts[it.status] || 0) + 1; });
  var canImport = counts.new + counts.update;

  var STATUS_CFG = {
    new:      { label: '🟢 ใหม่',        color: '#06d6a0', bg: '#06d6a022' },
    update:   { label: '🔵 อัปเดต',      color: '#4361ee', bg: '#4361ee22' },
    dup_file: { label: '🟡 ซ้ำในไฟล์',   color: '#ffa62b', bg: '#ffa62b22' },
    error:    { label: '🔴 ข้อผิดพลาด',  color: '#ff6b6b', bg: '#ff6b6b22' },
  };

  var confirmBtn = document.getElementById('m-hsp-import-confirm-btn');
  if (confirmBtn) confirmBtn.disabled = canImport === 0;

  var body = document.getElementById('m-hsp-import-body');
  if (!body) return;

  // Summary bar
  var summaryHtml = '<div style="padding:14px 20px;border-bottom:1px solid var(--border);background:var(--bg);">' +
    '<div style="font-size:12px;color:var(--txt-muted);margin-bottom:8px;">ไฟล์: <b>' + esc(fileName) + '</b> · ทั้งหมด ' + items.length + ' แถว</div>' +
    '<div style="display:flex;gap:12px;flex-wrap:wrap;">' +
    Object.entries(counts).filter(function(e){ return e[1] > 0; }).map(function(e) {
      var k = e[0]; var v = e[1]; var cfg = STATUS_CFG[k];
      return '<span style="background:' + cfg.bg + ';color:' + cfg.color + ';padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;">' +
        cfg.label + ' ' + v + '</span>';
    }).join('') +
    '</div>' +
    (counts.new === 0 && counts.update === 0
      ? '<div style="margin-top:8px;font-size:12px;color:var(--coral);">ไม่มีรายการที่นำเข้าได้</div>'
      : '<div style="margin-top:8px;font-size:12px;color:var(--txt-muted);">จะนำเข้า <b style="color:var(--txt);">' + canImport + '</b> รายการ · ข้าม ' + (counts.dup_file + counts.error) + ' รายการ</div>') +
  '</div>';

  // Table
  var tableHtml = '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:12px;">' +
    '<thead><tr style="background:var(--bg);color:var(--txt-muted);font-size:11px;text-transform:uppercase;letter-spacing:.4px;position:sticky;top:0;z-index:1;">' +
    '<th style="padding:7px 12px;text-align:left;border-bottom:1px solid var(--border);white-space:nowrap;">แถว</th>' +
    '<th style="padding:7px 12px;text-align:left;border-bottom:1px solid var(--border);white-space:nowrap;">สถานะ</th>' +
    '<th style="padding:7px 12px;text-align:left;border-bottom:1px solid var(--border);white-space:nowrap;">รหัส</th>' +
    '<th style="padding:7px 12px;text-align:left;border-bottom:1px solid var(--border);">ชื่อโรงพยาบาล</th>' +
    '<th style="padding:7px 12px;text-align:left;border-bottom:1px solid var(--border);white-space:nowrap;">จังหวัด</th>' +
    '<th style="padding:7px 12px;text-align:left;border-bottom:1px solid var(--border);white-space:nowrap;">ระดับ</th>' +
    '<th style="padding:7px 12px;text-align:left;border-bottom:1px solid var(--border);">หมายเหตุ</th>' +
    '</tr></thead><tbody>' +
    items.map(function(it) {
      var cfg = STATUS_CFG[it.status];
      var rowStyle = it.status === 'dup_file' || it.status === 'error'
        ? 'opacity:.55;'
        : '';
      return '<tr style="border-bottom:1px solid var(--border);' + rowStyle + '">' +
        '<td style="padding:7px 12px;color:var(--txt-muted);font-size:11px;">' + it.rowNum + '</td>' +
        '<td style="padding:7px 12px;white-space:nowrap;">' +
          '<span style="background:' + cfg.bg + ';color:' + cfg.color + ';padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">' + cfg.label + '</span>' +
        '</td>' +
        '<td style="padding:7px 12px;font-family:monospace;font-weight:700;color:var(--primary);white-space:nowrap;">' + esc(it.code || '—') + '</td>' +
        '<td style="padding:7px 12px;color:var(--txt);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
          (it.name ? esc(it.name) : '<span style="color:var(--txt-muted);font-style:italic;">ดึงจาก MOPH</span>') + '</td>' +
        '<td style="padding:7px 12px;color:var(--txt-muted);white-space:nowrap;">' + esc(it.province || '—') + '</td>' +
        '<td style="padding:7px 12px;color:var(--txt-muted);white-space:nowrap;">' + esc(it.type || '—') + '</td>' +
        '<td style="padding:7px 12px;color:var(--txt-muted);font-size:11px;">' + esc(it.reason || '') + '</td>' +
      '</tr>';
    }).join('') +
    '</tbody></table></div>';

  body.innerHTML = summaryHtml + tableHtml;
  window.openM('m-hsp-import');
}

// ── STEP 3: ยืนยันนำเข้า — แสดง Progress + Error ใน Modal ──────────────────

window.confirmImportHospitals = async function() {
  var pending = window._hspImportPending;
  if (!pending) return;

  var clearFirst = document.getElementById('hsp-import-clear-cb')?.checked;
  var { items, colKeys } = pending;
  var toImport = items.filter(function(it) { return it.status === 'new' || it.status === 'update'; });

  if (!toImport.length) { window.showAlert('ไม่มีรายการที่นำเข้าได้', 'warn'); return; }

  var total = toImport.length;

  // ── สลับ Modal body → Progress view ──────────────────────────────────────
  var modalBody = document.getElementById('m-hsp-import-body');
  var modalFoot = document.querySelector('#m-hsp-import .m-foot');

  if (modalBody) {
    modalBody.innerHTML =
      '<div style="padding:24px 20px;">' +
        // progress bar
        '<div style="margin-bottom:20px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
            '<span id="_hprog-label" style="font-size:13px;font-weight:600;color:var(--txt);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;margin-right:12px;">กำลังเตรียมข้อมูล...</span>' +
            '<span id="_hprog-count" style="font-size:12px;color:var(--txt-muted);white-space:nowrap;flex-shrink:0;">0 / ' + total + '</span>' +
          '</div>' +
          '<div style="height:10px;background:var(--border);border-radius:10px;overflow:hidden;">' +
            '<div id="_hprog-bar" style="height:100%;width:0%;background:var(--primary);border-radius:10px;transition:width .12s;"></div>' +
          '</div>' +
        '</div>' +
        // stats row
        '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;">' +
          '<div style="background:var(--bg);border-radius:8px;padding:8px 14px;flex:1;min-width:80px;">' +
            '<div style="font-size:10px;color:var(--txt-muted);margin-bottom:2px;">✅ สำเร็จ</div>' +
            '<div id="_hprog-ok" style="font-size:20px;font-weight:800;color:#06d6a0;">0</div>' +
          '</div>' +
          '<div style="background:var(--bg);border-radius:8px;padding:8px 14px;flex:1;min-width:80px;">' +
            '<div style="font-size:10px;color:var(--txt-muted);margin-bottom:2px;">🌐 จาก MOPH</div>' +
            '<div id="_hprog-api" style="font-size:20px;font-weight:800;color:var(--primary);">0</div>' +
          '</div>' +
          '<div style="background:var(--bg);border-radius:8px;padding:8px 14px;flex:1;min-width:80px;">' +
            '<div style="font-size:10px;color:var(--txt-muted);margin-bottom:2px;">❌ ข้ามไป</div>' +
            '<div id="_hprog-skip" style="font-size:20px;font-weight:800;color:#ff6b6b;">0</div>' +
          '</div>' +
        '</div>' +
        // error list
        '<div id="_hprog-err-wrap" style="display:none;">' +
          '<div style="font-size:11px;font-weight:600;color:var(--coral,#ff6b6b);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px;">รายการที่ไม่สำเร็จ</div>' +
          '<div id="_hprog-err-list" style="max-height:180px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:4px;"></div>' +
        '</div>' +
      '</div>';
  }

  if (modalFoot) {
    modalFoot.innerHTML =
      '<div style="flex:1;font-size:12px;color:var(--txt-muted);" id="_hprog-foot-note"></div>' +
      '<button class="btn btn-ghost" id="_hprog-close-btn" disabled onclick="window.closeM(\'m-hsp-import\')">ปิด</button>';
  }

  // helpers
  function setLabel(msg) {
    var el = document.getElementById('_hprog-label');
    if (el) el.textContent = msg;
  }
  function setBar(done) {
    var pct = total ? Math.round(done / total * 100) : 100;
    var bar = document.getElementById('_hprog-bar');
    var cnt = document.getElementById('_hprog-count');
    if (bar) bar.style.width = pct + '%';
    if (cnt) cnt.textContent = done + ' / ' + total;
  }
  function setStat(ok, api, skip) {
    var eOk = document.getElementById('_hprog-ok');
    var eApi = document.getElementById('_hprog-api');
    var eSk  = document.getElementById('_hprog-skip');
    if (eOk)  eOk.textContent  = ok;
    if (eApi) eApi.textContent = api;
    if (eSk)  eSk.textContent  = skip;
  }
  function addError(msg) {
    var wrap = document.getElementById('_hprog-err-wrap');
    var list = document.getElementById('_hprog-err-list');
    if (!list) return;
    if (wrap) wrap.style.display = '';
    var div = document.createElement('div');
    div.style.cssText = 'padding:5px 8px;border-radius:5px;font-size:12px;color:#ff6b6b;border-bottom:1px solid var(--border);';
    div.textContent = msg;
    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
  }
  function finalize(ok, api, skip, fatalErr) {
    var bar = document.getElementById('_hprog-bar');
    if (bar) {
      bar.style.width = '100%';
      bar.style.background = fatalErr ? '#ff6b6b' : '#06d6a0';
    }
    if (fatalErr) {
      setLabel('เกิดข้อผิดพลาด: ' + fatalErr);
    } else {
      var txt = 'นำเข้าสำเร็จ ' + ok + ' รายการ';
      if (api)  txt += '  ·  MOPH ' + api + ' แห่ง';
      if (skip) txt += '  ·  ข้าม ' + skip + ' รายการ';
      setLabel(txt);
    }
    var note = document.getElementById('_hprog-foot-note');
    if (note && clearFirst) note.textContent = 'ลบข้อมูลเดิมก่อนนำเข้าแล้ว';
    var closeBtn = document.getElementById('_hprog-close-btn');
    if (closeBtn) closeBtn.disabled = false;
    // clear toolbar progress text
    var tp = document.getElementById('hsp-import-progress');
    if (tp) tp.textContent = '';
  }

  try {
    var db = window.getDb();

    // ── ลบข้อมูลเดิม (ถ้าเลือก) ──────────────────────────────────────────
    if (clearFirst) {
      var allIds = (window.HOSPITALS || []).map(function(h) { return h.id; });
      if (allIds.length) {
        setLabel('กำลังลบข้อมูลเดิม ' + allIds.length + ' รายการ...');
        var delBatch = null;
        for (var di = 0; di < allIds.length; di++) {
          if (!delBatch) delBatch = window.writeBatch(db);
          delBatch.delete(getDocRef('HOSPITALS', allIds[di]));
          if ((di + 1) % 400 === 0) { await delBatch.commit(); delBatch = null; }
        }
        if (delBatch) await delBatch.commit();
      }
    }

    // ── นำเข้าทีละรายการ ─────────────────────────────────────────────────
    var hasApi = !!(localStorage.getItem(HCODE_REFRESH_KEY) || localStorage.getItem(HCODE_TOKEN_KEY));
    var batch = null;
    var batchCount = 0;
    var count = 0;
    var apiCount = 0;
    var skipCount = 0;

    for (var i = 0; i < total; i++) {
      var it = toImport[i];
      var row = it.rowData;
      var code = it.code;

      setLabel('(' + (i + 1) + '/' + total + ')  ' + code + (it.name ? '  —  ' + it.name : ''));
      setBar(i);

      var exName        = String(colKeys.name        ? row[colKeys.name]        : '').trim();
      var exType        = String(colKeys.type        ? row[colKeys.type]        : '').trim();
      var exBeds        = Number(colKeys.beds        ? row[colKeys.beds]        : 0) || 0;
      var exProvince    = String(colKeys.province    ? row[colKeys.province]    : '').trim();
      var exDistrict    = String(colKeys.district    ? row[colKeys.district]    : '').trim();
      var exTambon      = String(colKeys.tambon      ? row[colKeys.tambon]      : '').trim();
      var exAddress     = String(colKeys.address     ? row[colKeys.address]     : '').trim();
      var exTel         = String(colKeys.tel         ? row[colKeys.tel]         : '').trim();
      var exWebsite     = String(colKeys.website     ? row[colKeys.website]     : '').trim();
      var exAffiliation = String(colKeys.affiliation ? row[colKeys.affiliation] : '').trim();
      var exNote        = String(colKeys.note        ? row[colKeys.note]        : '').trim();

      // ดึงจาก MOPH API ถ้าข้อมูลไม่ครบ
      var api = null;
      if (hasApi && (!exName || !exProvince || !exDistrict)) {
        try { api = await _hspApiLookup(code); } catch(_) {}
        if (api && api._rateLimited) {
          // โดน 429 — หยุดเรียก API ทุก row ที่เหลือ แต่ import ต่อจาก Excel
          addError('⚠️ ถูกจำกัด quota (429) ตั้งแต่รหัส ' + code + ' — รายการที่เหลือใช้ข้อมูลจาก Excel เท่านั้น');
          hasApi = false;
          api = null;
        } else if (api) {
          apiCount++;
        }
      }

      var name = exName || (api && api.name) || '';
      if (!name) {
        var errMsg = 'แถว ' + it.rowNum + '  รหัส ' + code + ': ไม่พบชื่อ รพ.' +
          (!hasApi && !_hspApiRateLimited ? '  (ลองเชื่อมต่อ MOPH API)' : '');
        addError(errMsg);
        skipCount++;
        setStat(count, apiCount, skipCount);
        continue;
      }

      var docId = (!clearFirst && it.existingId) ? it.existingId : uid();
      var data = {
        hospital_id:  docId,
        code,
        name,
        type:        exType        || (api && api.type)        || 'other',
        beds:        exBeds > 0 ? exBeds : ((api && api.beds > 0) ? api.beds : 0),
        province:    exProvince    || (api && api.province)    || '',
        district:    exDistrict    || (api && api.district)    || '',
        tambon:      exTambon      || (api && api.tambon)      || '',
        address:     exAddress     || (api && api.address)     || '',
        tel:         exTel         || (api && api.tel)         || '',
        website:     exWebsite     || (api && api.website)     || '',
        affiliation: exAffiliation || (api && api.affiliation) || '',
        note:        exNote        || '',
      };

      if (!batch) batch = window.writeBatch(db);
      batch.set(getDocRef('HOSPITALS', docId), data);
      batchCount++;
      count++;
      setStat(count, apiCount, skipCount);

      if (batchCount % 400 === 0) { await batch.commit(); batch = null; batchCount = 0; }
    }
    if (batch) await batch.commit();

    setBar(total);
    window._hspImportPending = null;
    finalize(count, apiCount, skipCount, null);

  } catch(err) {
    finalize(0, 0, 0, err.message);
  }
};

// ── HOS CODE LOOKUP — ค้นหาจาก window.HOSPITALS (Firestore realtime) ─────────
// ไม่ต้องโหลดหรือ import เพิ่ม — ใช้ข้อมูลที่ sync จาก Firestore โดยตรง

window.openHspLookup = function() {
  var inp = document.getElementById('hsp-lookup-q');
  var box = document.getElementById('hsp-lookup-result');
  if (inp) inp.value = '';
  if (box) box.innerHTML = _hspLookupPlaceholder();
  window.openM('m-hsp-lookup');
  setTimeout(function(){ if(inp) inp.focus(); }, 200);
};

function _hspLookupPlaceholder() {
  var total = (window.HOSPITALS || []).length;
  if (!total) {
    return '<div style="text-align:center;padding:32px 20px;">' +
      '<div style="font-size:32px;margin-bottom:8px;">🏥</div>' +
      '<div style="font-weight:600;color:var(--txt);margin-bottom:6px;">ยังไม่มีข้อมูลโรงพยาบาลในระบบ</div>' +
      '<div style="font-size:12px;color:var(--txt-muted);">Admin สามารถนำเข้าผ่านปุ่ม 📥 Import Excel</div>' +
    '</div>';
  }
  return '<div style="text-align:center;color:var(--txt-muted);padding:24px;font-size:13px;">' +
    '🔍 พิมพ์รหัส HOS Code หรือชื่อ รพ.<br>' +
    '<span style="font-size:11px;">มีข้อมูล ' + total.toLocaleString() + ' แห่ง</span>' +
  '</div>';
}

window.hspLookupSearch = function() {
  var q   = (document.getElementById('hsp-lookup-q')?.value || '').trim().toLowerCase();
  var box = document.getElementById('hsp-lookup-result');
  if (!box) return;

  var list = window.HOSPITALS || [];

  if (!list.length) { box.innerHTML = _hspLookupPlaceholder(); return; }

  if (q.length < 1) { box.innerHTML = _hspLookupPlaceholder(); return; }

  var hits = list.filter(function(h) {
    return h.code.toLowerCase().includes(q) ||
           h.name.toLowerCase().includes(q) ||
           (h.province || '').toLowerCase().includes(q) ||
           (h.district || '').toLowerCase().includes(q) ||
           (h.affiliation || '').toLowerCase().includes(q);
  }).sort(function(a, b) {
    // exact code match first
    var aEx = a.code.toLowerCase() === q ? 0 : 1;
    var bEx = b.code.toLowerCase() === q ? 0 : 1;
    return aEx - bEx || (a.code || '').localeCompare(b.code || '');
  }).slice(0, 40);

  if (!hits.length) {
    box.innerHTML = '<div style="text-align:center;color:var(--txt-muted);padding:32px;">' +
      'ไม่พบ "' + esc(q) + '"<br><span style="font-size:11px;">ลองค้นหาด้วยรหัสหรือชื่อภาษาไทย</span></div>';
    return;
  }

  box.innerHTML = hits.map(function(h) {
    var t = _hspType(h.type);
    return '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;' +
      'border-bottom:1px solid var(--border);cursor:pointer;transition:background .1s;" ' +
      'onclick="window.openHospitalDetail(\'' + esc(h.id) + '\');window.closeM(\'m-hsp-lookup\');" ' +
      'onmouseover="this.style.background=\'var(--bg)\'" onmouseout="this.style.background=\'\'">' +
      '<div style="font-family:monospace;font-weight:700;color:var(--primary);white-space:nowrap;min-width:58px;font-size:13px;">' + esc(h.code) + '</div>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-weight:600;font-size:13px;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(h.name) + '</div>' +
        '<div style="font-size:11px;color:var(--txt-muted);">' +
          esc(h.province || '') +
          (h.district ? ' · ' + esc(h.district) : '') +
          (h.beds ? ' · ' + Number(h.beds).toLocaleString() + ' เตียง' : '') +
          (h.affiliation ? ' · ' + esc(h.affiliation) : '') +
        '</div>' +
      '</div>' +
      '<span style="background:' + t.color + '22;color:' + t.color + ';padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;flex-shrink:0;">' + esc(h.type || '?') + '</span>' +
    '</div>';
  }).join('');
};

// ── SMART CODE AUTOFILL — Live search while typing ───────────────────────────
var _hspCodeTimer = null;

window.hspCodeLiveSearch = function() {
  var code = (document.getElementById('m-hsp-code')?.value || '').trim();
  var status = document.getElementById('m-hsp-code-status');
  var hint   = document.getElementById('m-hsp-code-hint');
  var dd     = document.getElementById('m-hsp-code-dd');

  clearTimeout(_hspCodeTimer);

  if (!code) {
    if (status) status.textContent = '';
    if (hint)   hint.textContent   = '';
    if (dd)     dd.style.display   = 'none';
    return;
  }

  var list = window.HOSPITALS || [];

  // ── 1. ตรวจรหัสตรงทันทีจาก Firestore ──────────────────────────────────
  var exact = list.find(function(h) { return h.code === code; });
  if (exact) {
    _hspCodeFill(exact);
    if (status) status.textContent = '✅';
    if (hint)   hint.innerHTML = '<span style="color:var(--green,#06d6a0);font-weight:600;">✓ ' + esc(exact.name) + '</span>';
    if (dd)     dd.style.display = 'none';
    return;
  }

  // ── 2. แสดง dropdown จาก local + เรียก MOPH API ────────────────────────
  if (status) status.textContent = code.length >= 2 ? '🔍' : '';
  if (hint)   hint.textContent   = '';

  _hspCodeTimer = setTimeout(async function() {
    var hits = list.filter(function(h) {
      return h.code.startsWith(code) ||
             h.name.toLowerCase().includes(code.toLowerCase());
    }).sort(function(a, b) {
      var aStart = a.code.startsWith(code) ? 0 : 1;
      var bStart = b.code.startsWith(code) ? 0 : 1;
      return aStart - bStart || a.code.localeCompare(b.code);
    }).slice(0, 8);

    if (hits.length) {
      _hspRenderCodeDD(hits, code);
      if (dd) dd.style.display = 'block';
    } else if (dd) {
      dd.style.display = 'none';
    }

    // ── 3. รหัสครบ 5 หลัก + ไม่พบ local → ดึงจาก MOPH API ──────────────
    if (code.length >= 5) {
      if (status) status.textContent = '⏳';
      if (hint)   hint.innerHTML = '<span style="color:var(--txt-muted);font-size:11px;">กำลังค้นหาจาก MOPH API...</span>';

      var hasToken = !!(localStorage.getItem(HCODE_REFRESH_KEY) || localStorage.getItem(HCODE_TOKEN_KEY));
      if (!hasToken) {
        if (status) status.textContent = '';
        if (hint) hint.innerHTML =
          '<span style="color:var(--txt-muted);">ไม่พบในระบบ — ' +
          '<a href="#" style="color:var(--primary);" onclick="event.preventDefault();window.openHspApiSettings()">ตั้งค่า MOPH API</a>' +
          ' เพื่อค้นหาจากกระทรวงสาธารณสุข</span>';
        return;
      }

      try {
        var apiResult = await _hspApiLookup(code);
        // ตรวจรหัสใน input ยังตรงกันอยู่ไหม (user อาจเปลี่ยนระหว่างรอ)
        var curCode = (document.getElementById('m-hsp-code')?.value || '').trim();
        if (curCode !== code) return;

        if (apiResult && apiResult._rateLimited) {
          if (status) status.textContent = '⚠️';
          if (hint) hint.innerHTML =
            '<span style="color:#ffa62b;">ถูกจำกัด quota (429) — limit 100 req/hr · ' +
            '<a href="#" style="color:var(--primary);" onclick="event.preventDefault();window.openHspApiSettings()">ดู quota</a></span>';
        } else if (apiResult) {
          if (status) status.textContent = '✅';
          if (hint) hint.innerHTML =
            '<span style="color:#06d6a0;font-weight:600;">✓ พบจาก MOPH: ' + esc(apiResult.name) + '</span>' +
            (apiResult._fromApi ? ' <span style="color:var(--txt-muted);font-size:10px;">(ยังไม่ได้บันทึก)</span>' : '');
          _hspCodeFill(apiResult);
          if (dd) dd.style.display = 'none';
        } else {
          if (status) status.textContent = '❌';
          if (hint) hint.innerHTML = '<span style="color:var(--txt-muted);">ไม่พบรหัส ' + esc(code) + ' ในระบบและ MOPH API</span>';
        }
      } catch(_) {
        if (status) status.textContent = '';
        if (hint) hint.innerHTML = '<span style="color:var(--txt-muted);">ค้นหาจาก MOPH API ไม่สำเร็จ</span>';
      }
    } else if (!hits.length && code.length >= 3) {
      if (hint) hint.innerHTML = '<span style="color:var(--txt-muted);">พิมพ์รหัสให้ครบ 5 หลักเพื่อค้นหาจาก MOPH...</span>';
    }
  }, 300);
};

// render dropdown items
function _hspRenderCodeDD(hits, code) {
  var dd = document.getElementById('m-hsp-code-dd');
  if (!dd) return;
  dd.innerHTML = hits.map(function(h) {
    var t = _hspType(h.type);
    var codeHL = h.code.startsWith(code)
      ? '<b style="color:var(--primary);">' + esc(h.code.slice(0, code.length)) + '</b>' + esc(h.code.slice(code.length))
      : esc(h.code);
    return '<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;cursor:pointer;' +
      'border-bottom:1px solid var(--border);transition:background .1s;" ' +
      'onmousedown="window._hspCodePick(\'' + esc(h.id) + '\')" ' +
      'onmouseover="this.style.background=\'var(--bg)\'" onmouseout="this.style.background=\'\'">' +
      '<div style="font-family:monospace;font-weight:700;font-size:13px;min-width:60px;white-space:nowrap;">' + codeHL + '</div>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-weight:600;font-size:13px;color:var(--txt);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(h.name) + '</div>' +
        '<div style="font-size:11px;color:var(--txt-muted);">' +
          (h.province ? esc(h.province) : '') +
          (h.district ? ' · ' + esc(h.district) : '') +
          (h.beds ? ' · ' + Number(h.beds).toLocaleString() + ' เตียง' : '') +
        '</div>' +
      '</div>' +
      '<span style="background:' + t.color + '22;color:' + t.color + ';padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;flex-shrink:0;">' + esc(h.type || '?') + '</span>' +
    '</div>';
  }).join('');
}

// เลือก รพ. จาก dropdown → เติมทุกฟิลด์
window._hspCodePick = function(id) {
  var h = (window.HOSPITALS || []).find(function(x) { return x.id === id; });
  if (!h) return;
  document.getElementById('m-hsp-code').value = h.code;
  _hspCodeFill(h);
  var status = document.getElementById('m-hsp-code-status');
  var hint   = document.getElementById('m-hsp-code-hint');
  var dd     = document.getElementById('m-hsp-code-dd');
  if (status) status.textContent = '✅';
  if (hint)   hint.innerHTML = '<span style="color:var(--green,#06d6a0);font-weight:600;">✓ ' + esc(h.name) + '</span>';
  if (dd)     dd.style.display = 'none';
};

// ซ่อน dropdown เมื่อ blur
window._hspCodeHideDD = function() {
  var dd = document.getElementById('m-hsp-code-dd');
  if (dd) dd.style.display = 'none';
};

// เติมฟิลด์ทั้งหมดจากข้อมูล รพ.
function _hspCodeFill(h) {
  document.getElementById('m-hsp-name').value        = h.name        || '';
  document.getElementById('m-hsp-type').value        = h.type        || '';
  document.getElementById('m-hsp-beds').value        = h.beds        || '';
  document.getElementById('m-hsp-province').value    = h.province    || '';
  document.getElementById('m-hsp-district').value    = h.district    || '';
  document.getElementById('m-hsp-tambon').value      = h.tambon      || '';
  document.getElementById('m-hsp-address').value     = h.address     || '';
  document.getElementById('m-hsp-tel').value         = h.tel         || '';
  document.getElementById('m-hsp-website').value     = h.website     || '';
  document.getElementById('m-hsp-affiliation').value = h.affiliation || '';
  document.getElementById('m-hsp-note').value        = h.note        || '';
  window._hspFormProvinceChanged(false);
  window._hspFormDistrictChanged(false);
}

// compat — เก็บไว้ในกรณีที่ code อื่นยังเรียก
window.hspCodeAutofill = window.hspCodeLiveSearch;

// ── POPULATE FILTERS ────────────────────────────────────────────────────────
window._hspPopulateFilters = function() {
  var provSel = document.getElementById('hsp-prov');
  if (!provSel) return;
  var curProv = provSel.value;
  var usedProvs = [...new Set((window.HOSPITALS||[]).map(h=>h.province).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'th'));
  provSel.innerHTML = '<option value="">ทุกจังหวัด</option>' +
    usedProvs.map(p => `<option value="${esc(p)}"${p===curProv?' selected':''}>${esc(p)}</option>`).join('');
  _hspUpdateDistrictFilter();
};

// อัปเดต dropdown อำเภอใน toolbar ตามจังหวัดที่เลือก
function _hspUpdateDistrictFilter() {
  var distSel = document.getElementById('hsp-dist');
  if (!distSel) return;
  var prov = document.getElementById('hsp-prov')?.value || '';
  var curDist = distSel.value;
  var dists = [...new Set(
    (window.HOSPITALS || []).filter(h => !prov || h.province === prov)
      .map(h => h.district).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, 'th'));
  distSel.innerHTML = '<option value="">ทุกอำเภอ</option>' +
    dists.map(d => `<option value="${esc(d)}"${d===curDist?' selected':''}>${esc(d)}</option>`).join('');
}

// Province filter เปลี่ยน → รีเซ็ต district แล้ว render ใหม่
window._hspProvChanged = function() {
  var distSel = document.getElementById('hsp-dist');
  if (distSel) distSel.value = '';
  _hspUpdateDistrictFilter();
  window._hspPage = 1;
  window.renderHospital();
};

// District filter เปลี่ยน → render ใหม่
window._hspDistChanged = function() {
  window._hspPage = 1;
  window.renderHospital();
};

// ── CASCADE ในฟอร์ม Add/Edit ─────────────────────────────────────────────────

// Province เปลี่ยนใน form → ดึง district datalist + เคลียร์ district/tambon
// clearFields=true เมื่อ user เปลี่ยนจังหวัดใหม่, false เมื่อ load ข้อมูลเดิม
window._hspFormProvinceChanged = function(clearFields) {
  if (clearFields === undefined) clearFields = true;
  var prov = document.getElementById('m-hsp-province')?.value || '';
  var dl = document.getElementById('dl-hsp-district');
  if (dl) {
    var dists = [...new Set(
      (window.HOSPITALS || []).filter(h => h.province === prov)
        .map(h => h.district).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, 'th'));
    dl.innerHTML = dists.map(d => `<option value="${esc(d)}">`).join('');
  }
  if (clearFields) {
    var distInp = document.getElementById('m-hsp-district');
    if (distInp) distInp.value = '';
    var tambonInp = document.getElementById('m-hsp-tambon');
    if (tambonInp) tambonInp.value = '';
  }
  window._hspFormDistrictChanged(false);
};

// District เปลี่ยนใน form → ดึง tambon datalist
window._hspFormDistrictChanged = function(clearTambon) {
  if (clearTambon === undefined) clearTambon = true;
  var prov = document.getElementById('m-hsp-province')?.value || '';
  var dist = document.getElementById('m-hsp-district')?.value || '';
  var dl = document.getElementById('dl-hsp-tambon');
  if (dl) {
    var tambons = [...new Set(
      (window.HOSPITALS || []).filter(h => (!prov || h.province === prov) && h.district === dist)
        .map(h => h.tambon).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, 'th'));
    dl.innerHTML = tambons.map(t => `<option value="${esc(t)}">`).join('');
  }
  if (clearTambon) {
    var tambonInp = document.getElementById('m-hsp-tambon');
    if (tambonInp) tambonInp.value = '';
  }
};

// ── AUTO-ENRICH: เติมข้อมูลที่ไม่ครบถ้วนจาก MOPH API ─────────────────────────

// ตรวจว่า รพ. รายนี้ข้อมูลไม่ครบถ้วนหรือไม่
function _hspIsIncomplete(h) {
  return !h.province || !h.district || !h.type || h.type === 'other' ||
         !h.tel || !h.affiliation || !h.beds || !h.tambon;
}

// สร้าง badge แสดง field ที่หายไปของแต่ละ รพ.
function _hspMissingBadges(h) {
  var missing = [];
  if (!h.province || !h.district) missing.push('ที่ตั้ง');
  if (!h.tambon)                   missing.push('ตำบล');
  if (!h.type || h.type === 'other') missing.push('ระดับ');
  if (!h.tel)                      missing.push('โทร');
  if (!h.affiliation)              missing.push('สังกัด');
  if (!h.beds)                     missing.push('เตียง');
  return missing.map(function(m) {
    return '<span style="background:var(--border);color:var(--txt-muted);font-size:10px;padding:1px 6px;border-radius:8px;margin-right:3px;">' + m + '</span>';
  }).join('');
}

window.openHspAutoEnrich = async function() {
  var body       = document.getElementById('m-hsp-enrich-body');
  var confirmBtn = document.getElementById('m-hsp-enrich-confirm-btn');
  var footNote   = document.getElementById('m-hsp-enrich-foot-note');

  if (body) body.innerHTML = '<div style="padding:32px;text-align:center;color:var(--txt-muted);">⏳ กำลังตรวจสอบ...</div>';
  window.openM('m-hsp-enrich');

  // ── ตรวจสอบ token ────────────────────────────────────────────────────────
  var hasApiStored = !!(localStorage.getItem(HCODE_REFRESH_KEY) || localStorage.getItem(HCODE_TOKEN_KEY));
  if (!hasApiStored) {
    window.closeM('m-hsp-enrich');
    var errBox = document.getElementById('hsp-api-err');
    if (errBox) { errBox.textContent = 'กรุณาเชื่อมต่อ MOPH API ก่อนใช้งานฟีเจอร์เติมข้อมูลอัตโนมัติ'; errBox.style.display = ''; }
    window.openM('m-hsp-api');
    return;
  }

  var token = await _hspGetToken();
  if (!token) {
    window.closeM('m-hsp-enrich');
    var apiStat = document.getElementById('hsp-api-stat');
    if (apiStat) apiStat.innerHTML = '<span style="color:#ffa62b;font-weight:700;">⚠️ Session หมดอายุ — กรุณาล็อกอินใหม่</span>';
    var errBox2 = document.getElementById('hsp-api-err');
    if (errBox2) { errBox2.textContent = 'กรุณาล็อกอินใหม่เพื่อใช้งานฟีเจอร์เติมข้อมูลอัตโนมัติ'; errBox2.style.display = ''; }
    window.openM('m-hsp-api');
    return;
  }

  // ── สแกน รพ. ที่ข้อมูลไม่ครบ ────────────────────────────────────────────
  var all        = window.HOSPITALS || [];
  var incomplete = all.filter(function(h) { return h.code && _hspIsIncomplete(h); });
  var complete   = all.length - incomplete.length;

  var remaining  = Math.max(0, _HSP_API_LIMIT - _hspApiCallCount);
  // หักรายที่ cache ไปแล้ว (ไม่ต้องเรียก API)
  var needCall   = incomplete.filter(function(h) { return _hspApiCache[h.code] === undefined; }).length;
  var fromCache  = incomplete.length - needCall;
  var quotaWarn  = needCall > remaining;

  window._hspEnrichPending = { incomplete };

  // ── render preview ───────────────────────────────────────────────────────
  if (!body) return;

  var summaryHtml =
    '<div style="padding:16px 20px;border-bottom:1px solid var(--border);background:var(--bg);">' +
      '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:10px;">' +
        '<div style="background:var(--surface);border-radius:10px;padding:10px 16px;flex:1;min-width:100px;text-align:center;">' +
          '<div style="font-size:22px;font-weight:800;color:#ff6b6b;">' + incomplete.length + '</div>' +
          '<div style="font-size:11px;color:var(--txt-muted);">ข้อมูลไม่ครบ</div>' +
        '</div>' +
        '<div style="background:var(--surface);border-radius:10px;padding:10px 16px;flex:1;min-width:100px;text-align:center;">' +
          '<div style="font-size:22px;font-weight:800;color:#06d6a0;">' + complete + '</div>' +
          '<div style="font-size:11px;color:var(--txt-muted);">ครบถ้วนแล้ว</div>' +
        '</div>' +
        '<div style="background:var(--surface);border-radius:10px;padding:10px 16px;flex:1;min-width:100px;text-align:center;">' +
          '<div style="font-size:22px;font-weight:800;color:var(--primary);">' + needCall + '</div>' +
          '<div style="font-size:11px;color:var(--txt-muted);">เรียก API' + (fromCache ? ' (+' + fromCache + ' cache)' : '') + '</div>' +
        '</div>' +
        '<div style="background:var(--surface);border-radius:10px;padding:10px 16px;flex:1;min-width:100px;text-align:center;">' +
          '<div style="font-size:22px;font-weight:800;' + (remaining < 20 ? 'color:#ff6b6b' : remaining < 50 ? 'color:#ffa62b' : 'color:var(--txt)') + ';">' + remaining + '</div>' +
          '<div style="font-size:11px;color:var(--txt-muted);">quota คงเหลือ/hr</div>' +
        '</div>' +
      '</div>' +
      (quotaWarn
        ? '<div style="background:#ffa62b18;border:1px solid #ffa62b44;border-radius:8px;padding:8px 12px;font-size:12px;color:#ffa62b;margin-bottom:8px;">' +
            '⚠️ ต้องการ <b>' + needCall + '</b> req แต่ quota เหลือ <b>' + remaining + '</b> · ระบบจะหยุดเรียก API เมื่อถึงขีดจำกัด แต่ยังบันทึกข้อมูลที่ได้มาก่อน' +
          '</div>'
        : '') +
      (incomplete.length === 0
        ? '<div style="color:#06d6a0;font-weight:600;font-size:13px;">✅ ข้อมูลทุกรายการครบถ้วนแล้ว ไม่มีรายการที่ต้องเติม</div>'
        : '<div style="font-size:12px;color:var(--txt-muted);">ระบบจะเติมเฉพาะ field ที่ว่างเท่านั้น ไม่เขียนทับข้อมูลที่มีอยู่แล้ว</div>') +
    '</div>';

  var tableHtml = '';
  if (incomplete.length > 0) {
    tableHtml =
      '<div style="overflow-x:auto;">' +
      '<table style="width:100%;border-collapse:collapse;font-size:12px;">' +
      '<thead><tr style="background:var(--bg);color:var(--txt-muted);font-size:11px;text-transform:uppercase;letter-spacing:.4px;position:sticky;top:0;z-index:1;">' +
        '<th style="padding:7px 12px;text-align:left;border-bottom:1px solid var(--border);white-space:nowrap;">รหัส</th>' +
        '<th style="padding:7px 12px;text-align:left;border-bottom:1px solid var(--border);">ชื่อโรงพยาบาล</th>' +
        '<th style="padding:7px 12px;text-align:left;border-bottom:1px solid var(--border);">จังหวัด</th>' +
        '<th style="padding:7px 12px;text-align:left;border-bottom:1px solid var(--border);">field ที่หายไป</th>' +
      '</tr></thead><tbody>' +
      incomplete.map(function(h) {
        var cached = _hspApiCache[h.code] !== undefined;
        return '<tr style="border-bottom:1px solid var(--border);">' +
          '<td style="padding:7px 12px;font-family:monospace;font-weight:700;color:var(--primary);white-space:nowrap;">' +
            esc(h.code) + (cached ? ' <span title="มีใน cache" style="font-size:10px;opacity:.5;">📦</span>' : '') +
          '</td>' +
          '<td style="padding:7px 12px;color:var(--txt);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(h.name) + '</td>' +
          '<td style="padding:7px 12px;color:var(--txt-muted);white-space:nowrap;">' + esc(h.province || '—') + '</td>' +
          '<td style="padding:7px 12px;">' + _hspMissingBadges(h) + '</td>' +
        '</tr>';
      }).join('') +
      '</tbody></table></div>';
  }

  body.innerHTML = summaryHtml + tableHtml;

  if (confirmBtn) confirmBtn.disabled = incomplete.length === 0;
  if (footNote)   footNote.textContent = incomplete.length > 0 ? 'เติมข้อมูล ' + incomplete.length + ' รายการ' : '';
};

// ── ยืนยัน: รัน enrichment จริง ──────────────────────────────────────────────

window.confirmHspAutoEnrich = async function() {
  var pending = window._hspEnrichPending;
  if (!pending || !pending.incomplete.length) return;

  var incomplete = pending.incomplete;
  var total      = incomplete.length;

  // ── สลับ body → progress view ────────────────────────────────────────────
  var body = document.getElementById('m-hsp-enrich-body');
  var foot = document.getElementById('m-hsp-enrich-foot');

  if (body) {
    body.innerHTML =
      '<div style="padding:24px 20px;">' +
        '<div style="margin-bottom:20px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
            '<span id="_enrich-label" style="font-size:13px;font-weight:600;color:var(--txt);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-right:12px;">กำลังเตรียมข้อมูล...</span>' +
            '<span id="_enrich-count" style="font-size:12px;color:var(--txt-muted);white-space:nowrap;flex-shrink:0;">0 / ' + total + '</span>' +
          '</div>' +
          '<div style="height:10px;background:var(--border);border-radius:10px;overflow:hidden;">' +
            '<div id="_enrich-bar" style="height:100%;width:0%;background:#06d6a0;border-radius:10px;transition:width .12s;"></div>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;">' +
          '<div style="background:var(--bg);border-radius:8px;padding:8px 14px;flex:1;min-width:80px;">' +
            '<div style="font-size:10px;color:var(--txt-muted);margin-bottom:2px;">✅ อัปเดตแล้ว</div>' +
            '<div id="_enrich-ok" style="font-size:20px;font-weight:800;color:#06d6a0;">0</div>' +
          '</div>' +
          '<div style="background:var(--bg);border-radius:8px;padding:8px 14px;flex:1;min-width:80px;">' +
            '<div style="font-size:10px;color:var(--txt-muted);margin-bottom:2px;">📦 จาก Cache</div>' +
            '<div id="_enrich-cache" style="font-size:20px;font-weight:800;color:var(--primary);">0</div>' +
          '</div>' +
          '<div style="background:var(--bg);border-radius:8px;padding:8px 14px;flex:1;min-width:80px;">' +
            '<div style="font-size:10px;color:var(--txt-muted);margin-bottom:2px;">⏭ ข้ามไป</div>' +
            '<div id="_enrich-skip" style="font-size:20px;font-weight:800;color:var(--txt-muted);">0</div>' +
          '</div>' +
          '<div style="background:var(--bg);border-radius:8px;padding:8px 14px;flex:1;min-width:80px;">' +
            '<div style="font-size:10px;color:var(--txt-muted);margin-bottom:2px;">🌐 quota เหลือ</div>' +
            '<div id="_enrich-quota" style="font-size:20px;font-weight:800;color:var(--txt);">' + Math.max(0, _HSP_API_LIMIT - _hspApiCallCount) + '</div>' +
          '</div>' +
        '</div>' +
        '<div id="_enrich-err-wrap" style="display:none;">' +
          '<div style="font-size:11px;font-weight:600;color:#ffa62b;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px;">รายการที่ไม่พบข้อมูลเพิ่มเติม</div>' +
          '<div id="_enrich-err-list" style="max-height:160px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:4px;font-size:12px;"></div>' +
        '</div>' +
      '</div>';
  }

  if (foot) {
    foot.innerHTML =
      '<div style="flex:1;font-size:12px;color:var(--txt-muted);" id="_enrich-foot-note"></div>' +
      '<button class="btn btn-ghost" id="_enrich-close-btn" disabled onclick="window.closeM(\'m-hsp-enrich\')">ปิด</button>';
  }

  function setLabel(msg)   { var e = document.getElementById('_enrich-label');   if (e) e.textContent = msg; }
  function setBar(done)    {
    var pct = total ? Math.round(done / total * 100) : 100;
    var bar = document.getElementById('_enrich-bar');
    var cnt = document.getElementById('_enrich-count');
    if (bar) bar.style.width = pct + '%';
    if (cnt) cnt.textContent = done + ' / ' + total;
  }
  function setStat(ok, cache, skip) {
    var eOk  = document.getElementById('_enrich-ok');
    var eCa  = document.getElementById('_enrich-cache');
    var eSk  = document.getElementById('_enrich-skip');
    var eQu  = document.getElementById('_enrich-quota');
    if (eOk) eOk.textContent   = ok;
    if (eCa) eCa.textContent   = cache;
    if (eSk) eSk.textContent   = skip;
    var rem = Math.max(0, _HSP_API_LIMIT - _hspApiCallCount);
    if (eQu) { eQu.textContent = rem; eQu.style.color = rem < 20 ? '#ff6b6b' : rem < 50 ? '#ffa62b' : 'var(--txt)'; }
  }
  function addNote(msg) {
    var wrap = document.getElementById('_enrich-err-wrap');
    var list = document.getElementById('_enrich-err-list');
    if (!list) return;
    if (wrap) wrap.style.display = '';
    var div = document.createElement('div');
    div.style.cssText = 'padding:5px 8px;border-bottom:1px solid var(--border);color:var(--txt-muted);';
    div.textContent = msg;
    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
  }
  function finalize(ok, cache, skip, rateLimited) {
    var bar = document.getElementById('_enrich-bar');
    if (bar) { bar.style.width = '100%'; bar.style.background = rateLimited ? '#ffa62b' : '#06d6a0'; }
    var txt = 'อัปเดตสำเร็จ ' + ok + ' รายการ';
    if (cache) txt += '  ·  จาก cache ' + cache;
    if (skip)  txt += '  ·  ไม่พบข้อมูล ' + skip;
    if (rateLimited) txt += '  ·  หยุดเพราะ quota หมด';
    setLabel(txt);
    var fn = document.getElementById('_enrich-foot-note');
    if (fn) fn.textContent = 'บันทึกลง Firestore เรียบร้อย';
    var cb = document.getElementById('_enrich-close-btn');
    if (cb) cb.disabled = false;
    window._hspEnrichPending = null;
  }

  try {
    var db           = window.getDb();
    var okCount      = 0;
    var cacheCount   = 0;
    var skipCount    = 0;
    var rateLimited  = false;
    var batch        = null;
    var batchCount   = 0;

    for (var i = 0; i < total; i++) {
      var h    = incomplete[i];
      setLabel('(' + (i + 1) + '/' + total + ')  ' + h.code + '  —  ' + h.name);
      setBar(i);
      setStat(okCount, cacheCount, skipCount);

      // ตรวจ rate limit
      if (rateLimited) { skipCount++; addNote(h.code + ' ' + h.name + ': ข้ามเพราะ quota หมด'); continue; }

      var fromCache = _hspApiCache[h.code] !== undefined;
      var api = await _hspApiLookup(h.code);

      if (api && api._rateLimited) {
        rateLimited = true;
        skipCount++;
        addNote(h.code + ' ' + h.name + ': quota หมด (429)');
        setStat(okCount, cacheCount, skipCount);
        continue;
      }

      if (!api) {
        skipCount++;
        addNote(h.code + ' ' + h.name + ': ไม่พบข้อมูลใน MOPH API');
        setStat(okCount, cacheCount, skipCount);
        continue;
      }

      // เติมเฉพาะ field ที่ว่าง
      var updated = Object.assign({}, h);
      var changed = false;
      var _fill = function(field, val) { if (!updated[field] && val) { updated[field] = val; changed = true; } };
      _fill('province',    api.province);
      _fill('district',    api.district);
      _fill('tambon',      api.tambon);
      _fill('address',     api.address);
      _fill('tel',         api.tel);
      _fill('affiliation', api.affiliation);
      if ((!updated.type || updated.type === 'other') && api.type && api.type !== 'other') { updated.type = api.type; changed = true; }
      if ((!updated.beds || updated.beds === 0) && api.beds > 0)                           { updated.beds = api.beds; changed = true; }

      if (changed) {
        // แปลง id กลับเป็น hospital_id field
        var docData = Object.assign({}, updated, { hospital_id: updated.id });
        delete docData.id;

        if (!batch) batch = window.writeBatch(db);
        batch.set(getDocRef('HOSPITALS', updated.id), docData);
        batchCount++;
        if (fromCache) cacheCount++; else okCount++;

        if (batchCount % 400 === 0) { await batch.commit(); batch = null; batchCount = 0; }
      } else {
        skipCount++;
        if (fromCache) cacheCount++;
      }
      setStat(okCount, cacheCount, skipCount);
    }

    if (batch) await batch.commit();
    setBar(total);
    finalize(okCount, cacheCount, skipCount, rateLimited);

  } catch(err) {
    setLabel('เกิดข้อผิดพลาด: ' + err.message);
    var cb2 = document.getElementById('_enrich-close-btn');
    if (cb2) cb2.disabled = false;
  }
};
