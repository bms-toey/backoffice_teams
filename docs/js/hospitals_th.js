// hospitals_th.js — ฐานข้อมูลโรงพยาบาลไทย
// ⚠️  ไฟล์นี้ว่างเปล่าโดยตั้งใจ
// กรุณา Import ข้อมูลจากแหล่งที่ถูกต้อง (ดูคำแนะนำด้านล่าง)
//
// แหล่งข้อมูลอย่างเป็นทางการ:
//   - กระทรวงสาธารณสุข: https://www.moph.go.th
//   - HDC สธ. (Health Data Center): https://hdc.moph.go.th
//   - ข้อมูลเปิดภาครัฐ: https://data.go.th  (ค้นหา "รายชื่อสถานพยาบาล")
//   - NHSO / สปสช.: https://www.nhso.go.th
//
// วิธีนำเข้า:
//   1. ดาวน์โหลดไฟล์จากแหล่งข้างต้น (Excel / CSV)
//   2. ใช้ปุ่ม "📥 Import Excel" ในหน้า รายชื่อ รพ.
//   3. Header ที่รองรับ: hospital_code, hospital_name, hospital_type,
//      beds, province, district, address, tel, affiliation, note
//
// หมายเหตุ: รหัสสถานพยาบาล (HOS Code) กำหนดโดยกระทรวงสาธารณสุข
//           ไม่ได้เรียงตามรหัสจังหวัด — ต้องใช้ข้อมูลจากแหล่งจริงเท่านั้น

window.HSP_DB = [];
window.HSP_DB_IDX = {};
