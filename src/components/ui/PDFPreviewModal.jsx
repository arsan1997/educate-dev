import React from 'react';
import {Download,FileText,X} from 'lucide-react';

function PDFPreviewModal({preview,onClose}){
 const mobileSave=Boolean(preview.mobileSave);
 const saveLinkProps=mobileSave?{target:'_blank',rel:'noopener noreferrer'}:{download:preview.filename};
 return <div className="pdf-preview-backdrop"><div className="pdf-preview-modal">
  <div className="pdf-preview-head"><div><span className="eyebrow">PDF PREVIEW</span><b>{preview.filename}</b></div><div><a className="primary" href={preview.url} {...saveLinkProps}><Download/>{mobileSave?'เปิด PDF เพื่อบันทึก':'ดาวน์โหลด PDF'}</a><button className="icon" onClick={onClose} aria-label="ปิดตัวอย่าง"><X/></button></div></div>
  {mobileSave?<div className="pdf-preview-mobile-save"><FileText/><b>PDF พร้อมบันทึกแล้ว</b><span>แตะ “เปิด PDF เพื่อบันทึก” แล้วใช้ปุ่มแชร์ของ Safari เพื่อบันทึกลงแอปไฟล์</span></div>:<iframe src={preview.url} title={`ตัวอย่าง ${preview.filename}`}/>}
 </div></div>;
}

export default PDFPreviewModal;
