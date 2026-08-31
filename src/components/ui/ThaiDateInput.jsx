import React,{useEffect,useMemo,useRef,useState}from 'react';
import {Calendar,ChevronLeft,ChevronRight,X} from 'lucide-react';

const MONTHS=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const MONTHS_SHORT=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const WEEKDAYS=['อา','จ','อ','พ','พฤ','ศ','ส'];
const pad=value=>String(value).padStart(2,'0');
const toIso=date=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
const parseIso=value=>{
  if(!value)return null;
  const [year,month,day]=String(value).slice(0,10).split('-').map(Number);
  if(!year||!month||!day)return null;
  return new Date(year,month-1,day);
};
const sameDay=(a,b)=>a&&b&&a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
const displayDate=value=>{
  const date=parseIso(value);
  if(!date)return '';
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()+543}`;
};

function ThaiDateInput({value,onChange,placeholder='เลือกวันที่',disabled=false,clearable=true,required=false,title=''}) {
  const [open,setOpen]=useState(false);
  const rootRef=useRef(null);
  const selectedDate=parseIso(value);
  const today=useMemo(()=>new Date(),[]);
  const [viewDate,setViewDate]=useState(()=>selectedDate||today);

  useEffect(()=>{if(selectedDate)setViewDate(selectedDate)},[value]);
  useEffect(()=>{
    const handlePointerDown=event=>{
      if(rootRef.current&&!rootRef.current.contains(event.target))setOpen(false);
    };
    const handleKeyDown=event=>{
      if(event.key==='Escape')setOpen(false);
    };
    document.addEventListener('mousedown',handlePointerDown);
    document.addEventListener('keydown',handleKeyDown);
    return ()=>{
      document.removeEventListener('mousedown',handlePointerDown);
      document.removeEventListener('keydown',handleKeyDown);
    };
  },[]);

  const days=useMemo(()=>{
    const first=new Date(viewDate.getFullYear(),viewDate.getMonth(),1);
    const start=new Date(first);
    start.setDate(first.getDate()-first.getDay());
    return Array.from({length:42},(_,index)=>{
      const date=new Date(start);
      date.setDate(start.getDate()+index);
      return date;
    });
  },[viewDate]);

  const moveMonth=delta=>setViewDate(current=>new Date(current.getFullYear(),current.getMonth()+delta,1));
  const selectDate=date=>{
    onChange?.(toIso(date));
    setOpen(false);
  };
  const selectToday=()=>{
    const current=new Date();
    onChange?.(toIso(current));
    setViewDate(current);
    setOpen(false);
  };
  const clearDate=event=>{
    event.stopPropagation();
    onChange?.('');
    setOpen(false);
  };

  return <div className={`thai-date ${open?'open':''} ${disabled?'disabled':''}`} ref={rootRef}>
    <button type="button" className="thai-date-trigger" disabled={disabled} aria-haspopup="dialog" aria-expanded={open} aria-required={required} title={title} onClick={()=>setOpen(current=>!current)}>
      <span className={value?'':'placeholder'}>{displayDate(value)||placeholder}</span>
      <Calendar aria-hidden="true"/>
    </button>
    {open&&<div className="thai-date-popover" role="dialog" aria-label="เลือกวันที่">
      <div className="thai-date-head">
        <button type="button" className="thai-date-nav" onClick={()=>moveMonth(-1)} aria-label="เดือนก่อนหน้า"><ChevronLeft/></button>
        <b>{MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()+543}</b>
        <button type="button" className="thai-date-nav" onClick={()=>moveMonth(1)} aria-label="เดือนถัดไป"><ChevronRight/></button>
      </div>
      <div className="thai-date-week">{WEEKDAYS.map(day=><span key={day}>{day}</span>)}</div>
      <div className="thai-date-grid">
        {days.map(date=>{
          const isOutside=date.getMonth()!==viewDate.getMonth();
          const isSelected=sameDay(date,selectedDate);
          const isToday=sameDay(date,today);
          return <button type="button" key={toIso(date)} className={`${isOutside?'muted':''} ${isSelected?'selected':''} ${isToday?'today':''}`} onClick={()=>selectDate(date)}>
            {date.getDate()}
          </button>;
        })}
      </div>
      <div className="thai-date-actions">
        {clearable?<button type="button" onClick={clearDate}><X/>ล้าง</button>:<span/>}
        <button type="button" onClick={selectToday}>วันนี้</button>
      </div>
    </div>}
  </div>;
}

export default ThaiDateInput;
