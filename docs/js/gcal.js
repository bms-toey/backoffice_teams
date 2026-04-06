// ── GOOGLE CALENDAR SYNC ──
// Approach 2: Per-user OAuth (each user sees only their own events)
// Events are created in the user's own Google Calendar via Google Identity Services (GIS).
//
// SETUP (Admin):
//  1. Go to https://console.cloud.google.com/
//  2. Create a project → Enable "Google Calendar API"
//  3. OAuth consent screen → External → add scope: .../auth/calendar.events
//  4. Credentials → Create OAuth 2.0 Client ID (Web application)
//     Authorized JavaScript origins: https://your-domain.com (and http://localhost for dev)
//  5. Copy the Client ID and paste it below.

window.GCAL_CLIENT_ID = ''; // ← วาง Google OAuth 2.0 Client ID ที่นี่

// ─────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────

// Load Google Identity Services script lazily (once)
function _gcalLoadGIS() {
  return new Promise(function(resolve) {
    if (window.google && window.google.accounts) { resolve(); return; }
    var existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', resolve);
      existing.addEventListener('error', resolve);
      return;
    }
    var s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = resolve;
    s.onerror = resolve; // fail silently — button will show error
    document.head.appendChild(s);
  });
}

// ── Token storage (per user, in localStorage) ──
function _gcalTokenKey()  { return window.cu ? 'gcal_tok_'  + window.cu.id : null; }
function _gcalExpiryKey() { return window.cu ? 'gcal_exp_'  + window.cu.id : null; }
function _gcalMapKey()    { return window.cu ? 'gcal_map_'  + window.cu.id : null; }

function _gcalGetToken() {
  var k = _gcalTokenKey(); if (!k) return null;
  var exp = Number(localStorage.getItem(_gcalExpiryKey()) || 0);
  if (Date.now() > exp) return null;
  return localStorage.getItem(k);
}

function _gcalSaveToken(token, expiresIn) {
  var k = _gcalTokenKey(); if (!k) return;
  localStorage.setItem(k, token);
  localStorage.setItem(_gcalExpiryKey(), String(Date.now() + ((expiresIn || 3600) - 60) * 1000));
}

function _gcalClearToken() {
  var k = _gcalTokenKey(); if (!k) return;
  localStorage.removeItem(k);
  localStorage.removeItem(_gcalExpiryKey());
}

// ── Event ID map: localKey → Google Calendar eventId ──
function _gcalGetMap() {
  var k = _gcalMapKey(); if (!k) return {};
  try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch(e) { return {}; }
}
function _gcalSaveMap(map) {
  var k = _gcalMapKey(); if (!k) return;
  localStorage.setItem(k, JSON.stringify(map));
}

// ── Google Calendar REST API wrapper ──
function _gcalReq(method, path, body) {
  var token = _gcalGetToken();
  if (!token) return Promise.reject(new Error('NOT_AUTH'));
  var opts = { method: method, headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  return fetch('https://www.googleapis.com/calendar/v3' + path, opts).then(function(r) {
    if (r.status === 204 || r.status === 200 && method === 'DELETE') return null;
    return r.json().then(function(d) {
      if (d.error) {
        var err = new Error(d.error.message || 'Google API error');
        err.status = d.error.code;
        throw err;
      }
      return d;
    });
  });
}

// ── Upsert (create or update) one event ──
function _gcalUpsert(key, body) {
  var map = _gcalGetMap();
  var gid = map[key];
  var req = gid
    ? _gcalReq('PUT', '/calendars/primary/events/' + gid, body).catch(function(e) {
        if (e.status === 404 || e.status === 410) {
          return _gcalReq('POST', '/calendars/primary/events', body); // re-create if deleted
        }
        throw e;
      })
    : _gcalReq('POST', '/calendars/primary/events', body);
  return req.then(function(evt) {
    if (evt && evt.id) { map[key] = evt.id; _gcalSaveMap(map); }
    return evt;
  });
}

// ── Add 1 day to YYYY-MM-DD string (Google uses exclusive end date for all-day events) ──
function _nextDay(ds) {
  if (!ds) return ds;
  var d = new Date(ds + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// ── Build Google Calendar event body for a project visit ──
function _visitBody(proj, visit, idx) {
  var teamNames = (visit.team || []).map(function(sid) {
    var st = (window.STAFF || []).find(function(s) { return s.id === sid; });
    return st ? (st.nickname || st.name.split(' ')[0]) : sid;
  }).filter(Boolean).join(', ');
  var roundLabel = visit.no ? ' (รอบ ' + visit.no + ')' : (idx > 0 ? ' (รอบ ' + (idx + 1) + ')' : '');
  return {
    summary: '🏗 ' + proj.name + roundLabel,
    description: (teamNames ? 'ทีม: ' + teamNames + '\n' : '') + (visit.purpose || proj.note || ''),
    start: { date: visit.start },
    end: { date: _nextDay(visit.end) },
    colorId: '9', // blueberry
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 1440 }] },
  };
}

// ── Build Google Calendar event body for a project (no visits) ──
function _projBody(proj) {
  return {
    summary: '🏗 ' + proj.name,
    description: proj.note || '',
    start: { date: proj.start },
    end: { date: _nextDay(proj.end) },
    colorId: '9',
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 1440 }] },
  };
}

// ── Build Google Calendar event body for a leave record ──
function _leaveBody(lv) {
  var _EM = { sick: '🤒', vacation: '🏖', personal: '📋', maternity: '🤱', ordain: '🙏', other: '📝' };
  var _LB = { sick: 'ลาป่วย', vacation: 'ลาพักร้อน', personal: 'ลากิจ', maternity: 'ลาคลอด', ordain: 'ลาบวช', other: 'อื่นๆ' };
  return {
    summary: (_EM[lv.leaveType] || '📝') + ' ' + (_LB[lv.leaveType] || lv.leaveType),
    description: lv.note || '',
    start: { date: lv.startDate },
    end: { date: _nextDay(lv.endDate) },
    colorId: '11', // tomato
    reminders: { useDefault: true },
  };
}

// ── Find the STAFF record for the current logged-in user ──
function _myStaffId() {
  if (!window.cu) return null;
  // Prefer explicit link from USERS.staff_id
  if (window.cu.staffId) return window.cu.staffId;
  // Fallback: match by name
  var st = (window.STAFF || []).find(function(s) { return s.name === window.cu.name; });
  return st ? st.id : null;
}

// ─────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────

window.gcalIsConnected = function() { return !!_gcalGetToken(); };

window.gcalDisconnect = function() {
  _gcalClearToken();
  _gcalUpdateBtn();
  window.showAlert('ยกเลิกการเชื่อมต่อ Google Calendar แล้ว', 'info');
};

// Update Sync button appearance
function _gcalUpdateBtn() {
  var btn = document.getElementById('cal-sync-btn');
  var dis = document.getElementById('cal-sync-disconnect');
  if (!btn) return;
  var connected = window.gcalIsConnected();
  if (connected) {
    btn.style.borderColor = '#34a853';
    btn.style.color = '#34a853';
    btn.title = 'ซิงค์งานของฉันไปยัง Google Calendar';
    if (dis) dis.style.display = 'inline-flex';
  } else {
    btn.style.borderColor = '';
    btn.style.color = '';
    btn.title = 'เชื่อมต่อ Google Calendar แล้วซิงค์งาน';
    if (dis) dis.style.display = 'none';
  }
}

// OAuth flow → returns token or null
function _gcalRequestToken() {
  return new Promise(function(resolve) {
    if (!window.google || !window.google.accounts) {
      window.showAlert('Google Identity Services ยังโหลดไม่เสร็จ กรุณาลองใหม่', 'error');
      return resolve(null);
    }
    var client = window.google.accounts.oauth2.initTokenClient({
      client_id: window.GCAL_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/calendar.events',
      callback: function(resp) {
        if (resp.error) {
          if (resp.error !== 'access_denied') {
            window.showAlert('ไม่สามารถเชื่อมต่อ Google Calendar: ' + resp.error, 'error');
          }
          return resolve(null);
        }
        _gcalSaveToken(resp.access_token, resp.expires_in);
        _gcalUpdateBtn();
        resolve(resp.access_token);
      },
    });
    client.requestAccessToken({ prompt: '' }); // '' = skip consent if already granted
  });
}

// ── Main sync entry point ──
window.gcalSync = async function() {
  if (!window.GCAL_CLIENT_ID) {
    window.showAlert('ยังไม่ได้ตั้งค่า Google Client ID\nกรุณาติดต่อผู้ดูแลระบบ', 'warn');
    return;
  }

  await _gcalLoadGIS();

  if (!_gcalGetToken()) {
    var tok = await _gcalRequestToken();
    if (!tok) return;
  }

  var btn = document.getElementById('cal-sync-btn');
  if (btn) { btn.textContent = '⏳ กำลังซิงค์...'; btn.disabled = true; }

  try {
    var myStaffId = _myStaffId();
    var tasks = [];

    // ── Projects ──
    (window.PROJECTS || []).forEach(function(proj) {
      if (proj.status === 'cancelled' || proj.status === 'completed') return;

      if (proj.visits && proj.visits.length > 0) {
        proj.visits.forEach(function(v, vi) {
          if (!v.start || !v.end) return;
          if (myStaffId && !(v.team || []).includes(myStaffId)) return;
          tasks.push(_gcalUpsert('proj_' + proj.id + '_v' + vi, _visitBody(proj, v, vi)));
        });
      } else {
        if (myStaffId) {
          var mems = proj.members && proj.members.length > 0
            ? proj.members
            : (proj.team || []).map(function(id) { return { sid: id }; });
          if (!mems.some(function(m) { return m.sid === myStaffId; })) return;
        }
        if (!proj.start || !proj.end) return;
        tasks.push(_gcalUpsert('proj_' + proj.id, _projBody(proj)));
      }
    });

    // ── Leaves (only my own, not rejected) ──
    (window.LEAVES || []).forEach(function(lv) {
      if (myStaffId && lv.staffId !== myStaffId) return;
      if (lv.status === 'rejected') return;
      if (!lv.startDate || !lv.endDate) return;
      tasks.push(_gcalUpsert('leave_' + lv.id, _leaveBody(lv)));
    });

    if (tasks.length === 0) {
      window.showAlert('ไม่พบข้อมูลงานของคุณในระบบที่จะซิงค์\n(ตรวจสอบว่าชื่อใน Users ตรงกับชื่อใน Staff)', 'info');
      return;
    }

    var results = await Promise.allSettled(tasks);
    var ok = results.filter(function(r) { return r.status === 'fulfilled'; }).length;
    var fail = results.filter(function(r) { return r.status === 'rejected'; }).length;

    if (fail === 0) {
      window.showAlert('ซิงค์ ' + ok + ' รายการไปยัง Google Calendar เรียบร้อย ✓', 'success');
    } else {
      window.showAlert('ซิงค์สำเร็จ ' + ok + ' รายการ, ล้มเหลว ' + fail + ' รายการ', 'warn');
    }

  } catch(e) {
    console.error('[gcal] sync error', e);
    if (e.status === 401 || (e.message && e.message.includes('401'))) {
      _gcalClearToken();
      _gcalUpdateBtn();
      window.showAlert('Session Google หมดอายุ กรุณากด Sync อีกครั้งเพื่อเชื่อมต่อใหม่', 'warn');
    } else {
      window.showAlert('เกิดข้อผิดพลาด: ' + (e.message || e), 'error');
    }
  } finally {
    if (btn) { btn.textContent = '🔄 Sync GCal'; btn.disabled = false; }
    _gcalUpdateBtn();
  }
};

// Update button whenever user changes
document.addEventListener('DOMContentLoaded', function() { setTimeout(_gcalUpdateBtn, 800); });
