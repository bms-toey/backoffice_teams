/**
 * pb-adapter.js
 * Compatibility layer: Firebase Firestore API → PocketBase
 * โหลดก่อน config-pb.js และ auth-pb.js
 *
 * expose บน window:
 *   getColRef, getDocRef, setDoc, updateDoc, deleteDoc,
 *   writeBatch, getDocs, onSnapshot, getDb
 */
(function () {
  // ── URL ของ PocketBase server (แก้ไขให้ตรงกับ domain/IP จริง) ──
  var PB_URL = window.PB_URL || 'http://YOUR-SERVER-IP:8090';

  // ── map ชื่อ Firestore collection → PocketBase collection ──
  var COL_MAP = {
    STAGES:       'stages',
    PTYPES:       'ptypes',
    PGROUPS:      'pgroups',
    POSITIONS:    'positions',
    DEPARTMENTS:  'departments',
    STAFF:        'staff',
    USERS:        'users',
    PROJECTS:     'projects',
    ADVANCES:     'advances',
    LODGINGS:     'lodgings',
    HOLIDAYS:     'holidays',
    LEAVES:       'leaves',
    TIMESHEETS:   'timesheets',
    COSTS:        'costs',
    CONTRACTS:    'contracts',
    HSP_PRODUCTS: 'hsp_products',
    HOSPITALS:    'hospitals',
    SETTINGS:     'settings',
  };

  function _pbName(fsName) {
    return COL_MAP[fsName] || fsName.toLowerCase();
  }

  // ── ref objects ──
  window.getColRef = function (colName) {
    return { _type: 'col', _fs: colName, _pb: _pbName(colName) };
  };
  window.getDocRef = function (colName, docId) {
    return { _type: 'doc', _fs: colName, _pb: _pbName(colName), _id: docId };
  };

  // ── REST helpers ──
  async function _get(path) {
    var res = await fetch(PB_URL + path, { headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw Object.assign(new Error(await res.text()), { status: res.status });
    return res.json();
  }
  async function _post(path, body) {
    var res = await fetch(PB_URL + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw Object.assign(new Error(await res.text()), { status: res.status });
    return res.json();
  }
  async function _patch(path, body) {
    var res = await fetch(PB_URL + path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw Object.assign(new Error(await res.text()), { status: res.status });
    return res.json();
  }
  async function _delete(path) {
    var res = await fetch(PB_URL + path, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) throw Object.assign(new Error(await res.text()), { status: res.status });
  }

  // ── fetch ทุก record ใน collection (รองรับ pagination) ──
  async function _fullList(pbCol) {
    var all = [];
    var page = 1;
    var perPage = 500;
    while (true) {
      var data = await _get('/api/collections/' + pbCol + '/records?perPage=' + perPage + '&page=' + page + '&skipTotal=1');
      all = all.concat(data.items || []);
      if (!data.items || data.items.length < perPage) break;
      page++;
    }
    return all;
  }

  // ── สร้าง snapshot object (รูปแบบเดียวกับ Firebase) ──
  function _makeColSnap(pbCol, records) {
    return {
      docs: records.map(function (r) {
        return {
          id: r.id,
          ref: window.getDocRef(pbCol, r.id),
          data: function () { return r; },
          exists: true,
        };
      }),
      empty: records.length === 0,
    };
  }
  function _makeDocSnap(record) {
    return {
      exists: function () { return !!record; },
      data: function () { return record || {}; },
      id: record ? record.id : '',
    };
  }

  // ── getDocs (one-shot) ──
  window.getDocs = async function (ref) {
    try {
      var records = await _fullList(ref._pb);
      return _makeColSnap(ref._fs, records);
    } catch (e) {
      console.error('getDocs error:', e);
      return { docs: [], empty: true };
    }
  };

  // ── onSnapshot (realtime) ──
  // PocketBase ส่ง SSE event ต่อ record ที่เปลี่ยน → re-fetch ทั้ง collection
  var _subs = {}; // { pbCol: EventSource }

  window.onSnapshot = function (ref, callback, onError) {
    var isDoc = ref._type === 'doc';
    var pbCol = ref._pb;
    var docId = ref._id;

    async function _fetch() {
      try {
        if (isDoc) {
          try {
            var rec = await _get('/api/collections/' + pbCol + '/records/' + docId);
            callback(_makeDocSnap(rec));
          } catch (e) {
            if (e.status === 404) callback(_makeDocSnap(null));
            else throw e;
          }
        } else {
          var records = await _fullList(pbCol);
          callback(_makeColSnap(ref._fs, records));
        }
      } catch (e) {
        if (onError) onError(e);
        else console.error('onSnapshot error [' + pbCol + ']:', e);
      }
    }

    // โหลดครั้งแรก
    _fetch();

    // Subscribe realtime ผ่าน SSE (1 SSE ต่อ collection)
    if (!_subs[pbCol]) {
      try {
        var es = new EventSource(PB_URL + '/api/realtime');
        _subs[pbCol] = es;

        es.addEventListener('PB_CONNECT', function (e) {
          var data = JSON.parse(e.data);
          // subscribe collection หลัง connect สำเร็จ
          fetch(PB_URL + '/api/realtime', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId: data.clientId, subscriptions: [pbCol + '/*'] }),
          });
        });

        es.addEventListener(pbCol, function () { _fetch(); });
        es.onerror = function () {
          // reconnect อัตโนมัติ — EventSource จัดการให้
        };
      } catch (e) {
        console.warn('Realtime subscribe failed for', pbCol, '— polling fallback not active');
      }
    }

    // คืน unsubscribe function
    return function () {
      if (_subs[pbCol]) { _subs[pbCol].close(); delete _subs[pbCol]; }
    };
  };

  // ── setDoc (upsert — ลองอัพเดตก่อน ถ้าไม่มีค่อย create) ──
  window.setDoc = async function (ref, data, _options) {
    var pbCol = ref._pb;
    var id = ref._id;
    var payload = Object.assign({}, data);
    try {
      await _patch('/api/collections/' + pbCol + '/records/' + id, payload);
    } catch (e) {
      if (e.status === 404) {
        payload.id = id;
        await _post('/api/collections/' + pbCol + '/records', payload);
      } else {
        throw e;
      }
    }
  };

  // ── updateDoc (partial update) ──
  window.updateDoc = async function (ref, data) {
    await _patch('/api/collections/' + ref._pb + '/records/' + ref._id, data);
  };

  // ── deleteDoc ──
  window.deleteDoc = async function (ref) {
    await _delete('/api/collections/' + ref._pb + '/records/' + ref._id);
  };

  // ── writeBatch ──
  window.writeBatch = function () {
    var ops = [];
    return {
      set:    function (ref, data) { ops.push({ t: 'set',    ref: ref, data: data }); },
      update: function (ref, data) { ops.push({ t: 'update', ref: ref, data: data }); },
      delete: function (ref)       { ops.push({ t: 'delete', ref: ref }); },
      commit: async function () {
        for (var i = 0; i < ops.length; i++) {
          var op = ops[i];
          if (op.t === 'set')    await window.setDoc(op.ref, op.data);
          if (op.t === 'update') await window.updateDoc(op.ref, op.data);
          if (op.t === 'delete') await window.deleteDoc(op.ref);
        }
      },
    };
  };

  // ── getDb (คืน PB_URL เป็น placeholder — ใช้แทน Firebase db instance) ──
  window.getDb = function () { return PB_URL; };

  console.log('[pb-adapter] PocketBase adapter loaded →', PB_URL);
})();
