/**
 * 02-migrate-firestore-to-pb.js
 * ย้ายข้อมูลจาก Firebase Firestore → PocketBase
 *
 * วิธีใช้:
 *   1. ดาวน์โหลด Service Account JSON จาก Firebase Console
 *      (Project Settings → Service accounts → Generate new private key)
 *   2. วางไฟล์ไว้ที่ scripts/service-account.json
 *   3. แก้ไข PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD ด้านล่าง
 *   4. npm install
 *   5. node 02-migrate-firestore-to-pb.js
 */

import admin from 'firebase-admin';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// ══════════════════════════════════════════════════════
//  CONFIG — แก้ไขค่าเหล่านี้ก่อนรัน
// ══════════════════════════════════════════════════════
const SERVICE_ACCOUNT_PATH = './service-account.json';
const FIREBASE_APP_ID      = 'backoffice-teams-app';   // ค่าจาก config.js
const PB_URL               = 'http://YOUR-SERVER-IP:8090';  // URL ของ PocketBase server
const PB_ADMIN_EMAIL       = 'admin@example.com';       // admin ที่สร้างตอนติดตั้ง
const PB_ADMIN_PASSWORD    = 'your-admin-password';     // password ของ admin
// ══════════════════════════════════════════════════════

const serviceAccount = require(SERVICE_ACCOUNT_PATH);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const firestore = admin.firestore();

// ── ชื่อ collections ที่จะ migrate (Firestore → PocketBase) ──
const COLLECTIONS = [
  { fs: 'STAGES',       pb: 'stages'       },
  { fs: 'PTYPES',       pb: 'ptypes'       },
  { fs: 'PGROUPS',      pb: 'pgroups'      },
  { fs: 'POSITIONS',    pb: 'positions'    },
  { fs: 'DEPARTMENTS',  pb: 'departments'  },
  { fs: 'STAFF',        pb: 'staff'        },
  { fs: 'USERS',        pb: 'users'        },
  { fs: 'PROJECTS',     pb: 'projects'     },
  { fs: 'ADVANCES',     pb: 'advances'     },
  { fs: 'LODGINGS',     pb: 'lodgings'     },
  { fs: 'HOLIDAYS',     pb: 'holidays'     },
  { fs: 'LEAVES',       pb: 'leaves'       },
  { fs: 'TIMESHEETS',   pb: 'timesheets'   },
  { fs: 'COSTS',        pb: 'costs'        },
  { fs: 'CONTRACTS',    pb: 'contracts'    },
  { fs: 'HSP_PRODUCTS', pb: 'hsp_products' },
  { fs: 'HOSPITALS',    pb: 'hospitals'    },
];
// SETTINGS เป็น document เดี่ยว จัดการแยก
const SETTINGS_DOCS = ['app', 'role_permissions'];

// ── schema สำหรับสร้าง PocketBase collections ──
const PB_SCHEMAS = {
  stages: [
    { name:'stage_id',      type:'text'   },
    { name:'label_th',      type:'text'   },
    { name:'label',         type:'text'   },
    { name:'color_hex',     type:'text'   },
    { name:'color',         type:'text'   },
    { name:'order',         type:'number' },
    { name:'auto_rule',     type:'text'   },
    { name:'auto_offset',   type:'number' },
    { name:'set_progress',  type:'number' },
  ],
  ptypes: [
    { name:'type_id',   type:'text' },
    { name:'label_th',  type:'text' },
    { name:'label',     type:'text' },
    { name:'color_hex', type:'text' },
    { name:'color',     type:'text' },
  ],
  pgroups: [
    { name:'group_id',  type:'text' },
    { name:'label_th',  type:'text' },
    { name:'label',     type:'text' },
    { name:'color_hex', type:'text' },
    { name:'color',     type:'text' },
  ],
  positions: [
    { name:'position_id', type:'text'   },
    { name:'label_th',    type:'text'   },
    { name:'label',       type:'text'   },
    { name:'daily_rate',  type:'number' },
  ],
  departments: [
    { name:'dept_id',  type:'text' },
    { name:'label_th', type:'text' },
    { name:'label',    type:'text' },
  ],
  staff: [
    { name:'staff_id',    type:'text'   },
    { name:'full_name',   type:'text'   },
    { name:'nickname',    type:'text'   },
    { name:'department',  type:'text'   },
    { name:'position',    type:'text'   },
    { name:'email',       type:'text'   },
    { name:'phone',       type:'text'   },
    { name:'start_date',  type:'text'   },
    { name:'birth_date',  type:'text'   },
    { name:'is_active',   type:'bool'   },
    { name:'remark',      type:'text'   },
    { name:'daily_rate',  type:'number' },
  ],
  users: [
    { name:'user_id',   type:'text' },
    { name:'username',  type:'text' },
    { name:'password',  type:'text' },
    { name:'name',      type:'text' },
    { name:'role',      type:'text' },
    { name:'is_active', type:'bool' },
    { name:'staff_id',  type:'text' },
  ],
  projects: [
    { name:'project_id',        type:'text'   },
    { name:'project_name',      type:'text'   },
    { name:'group_id',          type:'text'   },
    { name:'site_owner',        type:'text'   },
    { name:'installer_name',    type:'text'   },
    { name:'type_id',           type:'text'   },
    { name:'stage_id',          type:'text'   },
    { name:'budget',            type:'number' },
    { name:'start_date',        type:'text'   },
    { name:'end_date',          type:'text'   },
    { name:'revisit_1',         type:'text'   },
    { name:'revisit_2',         type:'text'   },
    { name:'progress_pct',      type:'number' },
    { name:'note',              type:'text'   },
    { name:'status',            type:'text'   },
    { name:'pm_staff_id',       type:'text'   },
    { name:'is_border',         type:'bool'   },
    { name:'contract_id',       type:'text'   },
    { name:'parent_project_id', type:'text'   },
    { name:'revisit_round',     type:'number' },
    { name:'team',              type:'json'   },
    { name:'members',           type:'json'   },
    { name:'visits',            type:'json'   },
  ],
  advances: [
    { name:'advance_id',        type:'text'   },
    { name:'project_id',        type:'text'   },
    { name:'purpose',           type:'text'   },
    { name:'amount_requested',  type:'number' },
    { name:'amount_cleared',    type:'number' },
    { name:'request_date',      type:'text'   },
    { name:'due_date',          type:'text'   },
    { name:'status',            type:'text'   },
    { name:'note',              type:'text'   },
    { name:'advance_no',        type:'text'   },
    { name:'expense_items',     type:'json'   },
    { name:'labor_items',       type:'json'   },
  ],
  lodgings: [
    { name:'lodging_id',      type:'text'   },
    { name:'project_id',      type:'text'   },
    { name:'lodging_name',    type:'text'   },
    { name:'map_url',         type:'text'   },
    { name:'phone',           type:'text'   },
    { name:'check_in',        type:'text'   },
    { name:'check_out',       type:'text'   },
    { name:'note',            type:'text'   },
    { name:'grand_total',     type:'number' },
    { name:'approved',        type:'text'   },
    { name:'approved_at',     type:'text'   },
    { name:'approved_by',     type:'text'   },
    { name:'approved_daily',  type:'text'   },
    { name:'approved_monthly',type:'text'   },
    // daily room
    { name:'ds_qty',     type:'number' }, { name:'ds_rate',  type:'number' },
    { name:'dd_qty',     type:'number' }, { name:'dd_rate',  type:'number' },
    { name:'d_total',    type:'number' },
    { name:'d_wifi',     type:'bool'   }, { name:'d_pillow',    type:'bool' },
    { name:'d_blanket',  type:'bool'   }, { name:'d_appliance', type:'bool' },
    { name:'d_parking',  type:'bool'   }, { name:'d_ac',        type:'bool' },
    { name:'d_fridge',   type:'bool'   }, { name:'d_washer',    type:'bool' },
    { name:'d_tv',       type:'bool'   }, { name:'d_shower',    type:'bool' },
    { name:'d_breakfast',type:'bool'   }, { name:'d_towel',     type:'bool' },
    { name:'d_custom',   type:'text'   },
    { name:'d_deposit',  type:'number' }, { name:'d_deposit_note', type:'text' },
    // monthly room
    { name:'ms_qty',     type:'number' }, { name:'ms_rate',  type:'number' },
    { name:'md_qty',     type:'number' }, { name:'md_rate',  type:'number' },
    { name:'m_total',    type:'number' },
    { name:'m_wifi',     type:'bool'   }, { name:'m_pillow',    type:'bool' },
    { name:'m_blanket',  type:'bool'   }, { name:'m_appliance', type:'bool' },
    { name:'m_parking',  type:'bool'   }, { name:'m_ac',        type:'bool' },
    { name:'m_fridge',   type:'bool'   }, { name:'m_washer',    type:'bool' },
    { name:'m_tv',       type:'bool'   }, { name:'m_shower',    type:'bool' },
    { name:'m_breakfast',type:'bool'   }, { name:'m_bedsheet',  type:'bool' },
    { name:'m_towel',    type:'bool'   }, { name:'m_custom',    type:'text' },
    { name:'m_deposit',  type:'number' }, { name:'m_deposit_note', type:'text' },
    { name:'m_water',    type:'text'   }, { name:'m_electric',  type:'text' },
    { name:'m_extras',   type:'text'   }, { name:'m_incl_util', type:'bool' },
  ],
  holidays: [
    { name:'holiday_id', type:'text' },
    { name:'name',       type:'text' },
    { name:'date',       type:'text' },
    { name:'type',       type:'text' },
  ],
  leaves: [
    { name:'leave_id',      type:'text' },
    { name:'staff_id',      type:'text' },
    { name:'leave_type',    type:'text' },
    { name:'start_date',    type:'text' },
    { name:'end_date',      type:'text' },
    { name:'substitute_id', type:'text' },
    { name:'note',          type:'text' },
    { name:'status',        type:'text' },
    { name:'approved_by',   type:'text' },
  ],
  timesheets: [
    { name:'timesheet_id', type:'text'   },
    { name:'project_id',   type:'text'   },
    { name:'staff_id',     type:'text'   },
    { name:'work_date',    type:'text'   },
    { name:'visit_start',  type:'text'   },
    { name:'visit_end',    type:'text'   },
    { name:'hours',        type:'number' },
    { name:'category',     type:'text'   },
    { name:'description',  type:'text'   },
    { name:'source',       type:'text'   },
  ],
  costs: [
    { name:'cost_id',     type:'text'   },
    { name:'project_id',  type:'text'   },
    { name:'staff_id',    type:'text'   },
    { name:'category',    type:'text'   },
    { name:'amount',      type:'number' },
    { name:'cost_date',   type:'text'   },
    { name:'description', type:'text'   },
    { name:'receipt_no',  type:'text'   },
    { name:'source',      type:'text'   },
    { name:'advance_id',  type:'text'   },
  ],
  contracts: [
    { name:'contract_id',           type:'text'   },
    { name:'project_name',          type:'text'   },
    { name:'customer_name',         type:'text'   },
    { name:'total_contract_value',  type:'number' },
    { name:'contract_sign_date',    type:'text'   },
    { name:'contract_start_date',   type:'text'   },
    { name:'end_date',              type:'text'   },
    { name:'note',                  type:'text'   },
    { name:'status',                type:'text'   },
    { name:'value',                 type:'number' },
  ],
  hsp_products: [
    { name:'product_id', type:'text' },
    { name:'name',       type:'text' },
    { name:'color',      type:'text' },
    { name:'note',       type:'text' },
    { name:'group',      type:'text' },
  ],
  hospitals: [
    { name:'hospital_id',  type:'text'   },
    { name:'code',         type:'text'   },
    { name:'name',         type:'text'   },
    { name:'type',         type:'text'   },
    { name:'beds',         type:'number' },
    { name:'province',     type:'text'   },
    { name:'district',     type:'text'   },
    { name:'tambon',       type:'text'   },
    { name:'address',      type:'text'   },
    { name:'tel',          type:'text'   },
    { name:'website',      type:'text'   },
    { name:'affiliation',  type:'text'   },
    { name:'note',         type:'text'   },
    { name:'contacts',     type:'json'   },
    { name:'products',     type:'json'   },
  ],
  settings: [
    { name:'notify_token',              type:'text'   },
    { name:'notify_advance_token',      type:'text'   },
    { name:'notify_project_token',      type:'text'   },
    { name:'allowance_weekday_normal',  type:'number' },
    { name:'allowance_holiday_normal',  type:'number' },
    { name:'allowance_weekday_border',  type:'number' },
    { name:'allowance_holiday_border',  type:'number' },
    { name:'year_targets',              type:'json'   },
    { name:'_raw',                      type:'json'   },
  ],
};

// ─────────────────────────────────────────────────────
//  PocketBase helpers
// ─────────────────────────────────────────────────────
let _pbToken = '';

async function pbAuth() {
  const res = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: PB_ADMIN_EMAIL, password: PB_ADMIN_PASSWORD }),
  });
  if (!res.ok) throw new Error(`PocketBase auth failed: ${await res.text()}`);
  const data = await res.json();
  _pbToken = data.token;
  console.log('[OK] PocketBase admin authenticated');
}

async function pbReq(method, path, body) {
  const res = await fetch(`${PB_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': _pbToken,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

async function createCollection(name) {
  const fields = PB_SCHEMAS[name] || [];
  const schema = fields.map(f => ({
    name: f.name,
    type: f.type,
    required: false,
    unique: false,
    options: f.type === 'number' ? { min: null, max: null, noDecimal: false }
           : f.type === 'text'   ? { min: null, max: null, pattern: '' }
           : {},
  }));

  try {
    await pbReq('POST', '/api/collections', {
      name,
      type: 'base',
      schema,
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
    });
    console.log(`[OK] สร้าง collection: ${name}`);
  } catch (e) {
    if (e.message.includes('already exists') || e.message.includes('400')) {
      console.log(`[--] collection '${name}' มีอยู่แล้ว ข้าม`);
    } else {
      throw e;
    }
  }
}

async function pbUpsert(colName, id, data) {
  // ลบ field ที่ PocketBase ไม่รู้จักออก (field ที่ไม่ได้ define ใน schema)
  const allowedFields = new Set((PB_SCHEMAS[colName] || []).map(f => f.name));
  const filtered = { id };
  for (const [k, v] of Object.entries(data)) {
    if (allowedFields.has(k) || k === 'id') {
      // แปลง bool strings
      if (typeof v === 'string' && (v === 'TRUE' || v === 'FALSE')) {
        filtered[k] = v === 'TRUE';
      }
      // แปลง Firestore Timestamp
      else if (v && typeof v === 'object' && typeof v.toDate === 'function') {
        const d = v.toDate();
        filtered[k] = d.toISOString().slice(0, 10);
      }
      // แปลง array/object เป็น JSON-safe
      else if (Array.isArray(v) || (v && typeof v === 'object' && !v.toDate)) {
        filtered[k] = v;
      }
      else {
        filtered[k] = v;
      }
    }
  }

  try {
    await pbReq('PATCH', `/api/collections/${colName}/records/${id}`, filtered);
  } catch (e) {
    if (e.message.includes('404')) {
      await pbReq('POST', `/api/collections/${colName}/records`, filtered);
    } else {
      throw e;
    }
  }
}

// ─────────────────────────────────────────────────────
//  Firestore helpers
// ─────────────────────────────────────────────────────
function fsCol(colName) {
  return firestore
    .collection('artifacts')
    .doc(FIREBASE_APP_ID)
    .collection('public')
    .doc('data')
    .collection(colName);
}

// ─────────────────────────────────────────────────────
//  MAIN
// ─────────────────────────────────────────────────────
async function main() {
  console.log('\n=== Firestore → PocketBase Migration ===\n');

  // 1. Authenticate PocketBase
  await pbAuth();

  // 2. สร้าง collections ทั้งหมด
  console.log('\n--- สร้าง PocketBase Collections ---');
  for (const { pb } of COLLECTIONS) await createCollection(pb);
  await createCollection('settings');

  // 3. Migrate แต่ละ collection
  console.log('\n--- Migrate ข้อมูล ---');
  let totalRecords = 0;

  for (const { fs, pb } of COLLECTIONS) {
    process.stdout.write(`Migrating ${fs} → ${pb} ... `);
    let count = 0;
    try {
      const snap = await fsCol(fs).get();
      for (const doc of snap.docs) {
        const data = doc.data();
        await pbUpsert(pb, doc.id, data);
        count++;
      }
      totalRecords += count;
      console.log(`${count} รายการ`);
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
    }
  }

  // 4. Migrate SETTINGS (documents เดี่ยว)
  console.log('\nMigrating SETTINGS ...');
  for (const docId of SETTINGS_DOCS) {
    try {
      const snap = await firestore
        .collection('artifacts')
        .doc(FIREBASE_APP_ID)
        .collection('public')
        .doc('data')
        .collection('SETTINGS')
        .doc(docId)
        .get();

      if (snap.exists) {
        const data = snap.data();
        // เก็บ _raw สำหรับ field ที่ไม่ได้ define
        await pbUpsert('settings', docId, { ...data, _raw: data });
        console.log(`  [OK] SETTINGS/${docId}`);
      }
    } catch (e) {
      console.log(`  [SKIP] SETTINGS/${docId}: ${e.message}`);
    }
  }

  console.log(`\n=== Migration เสร็จสิ้น: ${totalRecords} records ===`);
  console.log('\nขั้นตอนถัดไป:');
  console.log('  1. เปิด PocketBase Admin UI ตรวจสอบข้อมูล');
  console.log('  2. แก้ไข PB_URL ใน docs/js/pb-adapter.js');
  console.log('  3. เปลี่ยน config.js → config-pb.js และ auth.js → auth-pb.js ใน index.html');
  process.exit(0);
}

main().catch(e => { console.error('Migration failed:', e); process.exit(1); });
