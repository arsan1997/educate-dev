import React,{useEffect,useMemo,useState} from 'react';
import {AlertCircle,ArrowRightLeft,Battery,BatteryCharging,Bot,Calculator,CheckCircle2,ClipboardList,Map as MapIcon,RefreshCw,Save,School,Tablet,Warehouse} from 'lucide-react';
import {ROBOT_TYPES} from '../model';
import {applyStockMovement,loadInventoryItems,loadOfficeInventory,loadSchoolDetail,loadSchoolInventory,loadStockMovements,loadTeacherRequests,saveOfficeInventory,saveSchoolInventory} from '../dataService';
import Field from '../components/ui/Field';
import Select from '../components/ui/Select';
import ThaiDateInput from '../components/ui/ThaiDateInput';

const clampNumber=value=>{const n=Number(value);return Number.isFinite(n)&&n>0?Math.floor(n):0};
const rowKey=(ownerId,itemId)=>`${ownerId}::${itemId}`;

function StockPage({schools,offices,user,profile,flash}){
  const [tab,setTab]=useState('office');
  const [items,setItems]=useState([]);
  const [officeRows,setOfficeRows]=useState([]);
  const [schoolRows,setSchoolRows]=useState([]);
  const [movementRows,setMovementRows]=useState([]);
  const [teacherRequests,setTeacherRequests]=useState([]);
  const [loading,setLoading]=useState(true);
  const [savingKey,setSavingKey]=useState('');
  const [dirtyRows,setDirtyRows]=useState(()=>new Set());
  const [inventoryFilter,setInventoryFilter]=useState('robots');
  const [error,setError]=useState('');
  const [selectedOfficeId,setSelectedOfficeId]=useState(offices[0]?.id||'');
  const [schoolFilterOfficeId,setSchoolFilterOfficeId]=useState('');
  const [selectedSchoolId,setSelectedSchoolId]=useState(schools[0]?.id||'');
  const [detailSchool,setDetailSchool]=useState(null);
  const [selectedClassIds,setSelectedClassIds]=useState([]);
  const [plan,setPlan]=useState({
    robot:'Code & Go',
    officeId:offices[0]?.id||'',
    schoolId:'',
    participantCount:0
  });
  const [movementForm,setMovementForm]=useState({
    type:'checkout',
    fromOfficeId:offices[0]?.id||'',
    toOfficeId:offices[0]?.id||'',
    schoolId:'',
    itemId:'',
    quantity:'',
    note:''
  });
  const canEditOffice=['super_admin','school_admin'].includes(profile.role);
  const canEditSchool=['super_admin','school_admin','evaluator'].includes(profile.role);

  useEffect(()=>{
    if(!selectedOfficeId&&offices[0]?.id)setSelectedOfficeId(offices[0].id);
    if(!plan.officeId&&offices[0]?.id)setPlan(p=>({...p,officeId:offices[0].id}));
    if(!movementForm.fromOfficeId&&offices[0]?.id)setMovementForm(p=>({...p,fromOfficeId:offices[0].id}));
    if(!movementForm.toOfficeId&&offices[0]?.id)setMovementForm(p=>({...p,toOfficeId:offices[0].id}));
  },[offices,selectedOfficeId,plan.officeId,movementForm.fromOfficeId,movementForm.toOfficeId]);
  useEffect(()=>{
    if(!selectedSchoolId&&schools[0]?.id)setSelectedSchoolId(schools[0].id);
  },[schools,selectedSchoolId]);
  useEffect(()=>{
    if(!movementForm.schoolId&&schools[0]?.id)setMovementForm(p=>({...p,schoolId:schools[0].id}));
  },[schools,movementForm.schoolId]);
  useEffect(()=>{
    if(!plan.officeId)return;
    const officeSchools=schools.filter(s=>String(s.officeId||'')===String(plan.officeId));
    if(!officeSchools.length){
      if(plan.schoolId)setPlan(p=>({...p,schoolId:'',participantCount:0}));
      setDetailSchool(null);
      setSelectedClassIds([]);
      return;
    }
    if(!officeSchools.some(s=>String(s.id)===String(plan.schoolId))){
      setPlan(p=>({...p,schoolId:officeSchools[0].id,participantCount:0}));
    }
  },[schools,plan.officeId,plan.schoolId]);

  const refresh=async()=>{
    setLoading(true);setError('');
    try{
      const schoolIds=schools.map(s=>s.id);
      const [catalog,officeData,schoolData,requestData,movementData]=await Promise.all([
        loadInventoryItems(),
        loadOfficeInventory(),
        loadSchoolInventory(schoolIds),
        loadTeacherRequests().catch(()=>[]),
        loadStockMovements().catch(()=>[])
      ]);
      setItems(catalog.sort((a,b)=>a.sortOrder-b.sortOrder));
      setOfficeRows(officeData);
      setSchoolRows(schoolData);
      setTeacherRequests(requestData);
      setMovementRows(movementData);
      if(!catalog.length)setError('ยังไม่มีรายการอุปกรณ์ในฐานข้อมูล กรุณารัน supabase/stock_inventory_migration.sql ก่อนใช้งาน stock');
    }catch(e){
      console.error(e);
      setError(e.message||'โหลดข้อมูล stock ไม่สำเร็จ');
    }finally{
      setLoading(false);
    }
  };
  useEffect(()=>{refresh()},[schools.length]);

  useEffect(()=>{
    if(!movementForm.itemId&&items[0]?.id)setMovementForm(p=>({...p,itemId:items[0].id}));
  },[items,movementForm.itemId]);

  useEffect(()=>{
    const officeId=movementForm.type==='return'?movementForm.toOfficeId:movementForm.fromOfficeId;
    if(!officeId||!schools.length)return;
    const officeSchools=schools.filter(s=>String(s.officeId||'')===String(officeId));
    if(officeSchools.length&&!officeSchools.some(s=>String(s.id)===String(movementForm.schoolId))){
      setMovementForm(p=>({...p,schoolId:officeSchools[0].id}));
    }
  },[schools,movementForm.type,movementForm.fromOfficeId,movementForm.toOfficeId,movementForm.schoolId]);

  useEffect(()=>{
    const targetId=plan.schoolId;
    if(!targetId){setDetailSchool(null);setSelectedClassIds([]);setPlan(p=>({...p,participantCount:0}));return}
    let active=true;
    setSelectedClassIds([]);
    loadSchoolDetail(targetId).then(detail=>{
      if(!active)return;
      setDetailSchool(detail);
    }).catch(error=>console.error(error));
    return()=>{active=false};
  },[plan.schoolId]);

  const planningOfficeId=plan.officeId||'';
  const planningSchools=schools.filter(s=>String(s.officeId||'')===String(plan.officeId||''));
  const planningSchool=schools.find(s=>String(s.id)===String(plan.schoolId));
  const allPlanningClassrooms=detailSchool&&String(detailSchool.id)===String(plan.schoolId)?detailSchool.classrooms:[];
  const planningRequestRows=useMemo(()=>teacherRequests.filter(request=>
    String(request.school_id)===String(plan.schoolId)&&
    String(request.robot_type)===String(plan.robot)&&
    request.status!=='duplicate'
  ),[teacherRequests,plan.schoolId,plan.robot]);
  const requestedClassSet=useMemo(()=>new Set(planningRequestRows.map(request=>String(request.classroom_id))),[planningRequestRows]);
  const hasRobotRequests=planningRequestRows.length>0;
  const planningClassrooms=useMemo(()=>{
    if(!plan.schoolId||!hasRobotRequests)return [];
    return allPlanningClassrooms.filter(classroom=>requestedClassSet.has(String(classroom.id)));
  },[allPlanningClassrooms,hasRobotRequests,requestedClassSet]);
  const classPickerHint=hasRobotRequests
    ?`แสดงเฉพาะห้องที่ครูส่งคำขอ ${plan.robot} มา ${planningClassrooms.length} ห้อง`
    :plan.schoolId?`ยังไม่มีคำขอครูสำหรับ ${plan.robot} ในโรงเรียนนี้`:'เลือกสำนักงานและโรงเรียนก่อน';
  const classPickerEmptyText=!plan.schoolId
    ?'เลือกสำนักงานและโรงเรียนก่อน'
    :`ยังไม่มีห้องที่ครูส่งคำขอสำหรับ ${plan.robot} อาจเป็นเพราะโรงเรียนไม่ได้ใช้หุ่นนี้ หรือครูยังไม่ได้ส่งข้อมูล`;

  useEffect(()=>{
    setSelectedClassIds(planningClassrooms.map(c=>c.id));
  },[plan.schoolId,plan.robot,planningClassrooms]);

  useEffect(()=>{
    if(!detailSchool||String(detailSchool.id)!==String(plan.schoolId))return;
    const selected=new Set(selectedClassIds.map(String));
    const studentCount=planningClassrooms
      .filter(c=>selected.has(String(c.id)))
      .reduce((sum,c)=>sum+(c.students||[]).filter(st=>st.active!==false).length,0);
    if(Number(plan.participantCount)!==studentCount)setPlan(p=>({...p,participantCount:studentCount}));
  },[detailSchool,planningClassrooms,selectedClassIds,plan.schoolId,plan.participantCount]);

  const robotItems=items.filter(item=>item.category==='robot');
  const itemMap=useMemo(()=>new Map(items.map(item=>[item.id,item])),[items]);
  const schoolsByOffice=useMemo(()=>{
    const grouped=new Map();
    schools.forEach(s=>{
      const key=s.officeId||'unassigned';
      grouped.set(key,[...(grouped.get(key)||[]),s]);
    });
    return grouped;
  },[schools]);
  const visibleSchools=schoolFilterOfficeId?schools.filter(s=>schoolFilterOfficeId==='unassigned'?!s.officeId:String(s.officeId)===String(schoolFilterOfficeId)):schools;
  const selectedSchool=schools.find(s=>String(s.id)===String(selectedSchoolId));
  const selectedClassSet=useMemo(()=>new Set(selectedClassIds.map(String)),[selectedClassIds]);
  const togglePlanningClass=classId=>setSelectedClassIds(ids=>ids.some(id=>String(id)===String(classId))?ids.filter(id=>String(id)!==String(classId)):[...ids,classId]);
  const activeStudentCount=classroom=>(classroom?.students||[]).filter(st=>st.active!==false).length;
  const inventoryFilterOptions=[
    {id:'robots',label:'หุ่นยนต์'},
    ...ROBOT_TYPES.map(robot=>({id:robot,label:robot})),
    {id:'fields',label:'สนาม'},
    {id:'support',label:'อุปกรณ์อื่น'},
    {id:'all',label:'ทั้งหมด'}
  ];
  const selectOfficeForStock=officeId=>{
    setSelectedOfficeId(officeId);
    setPlan(p=>String(p.officeId||'')===String(officeId)?p:{...p,officeId,schoolId:'',participantCount:0});
  };

  const getInventoryRow=(rows,ownerId,itemId)=>rows.find(row=>String(row.ownerId)===String(ownerId)&&String(row.itemId)===String(itemId))||{
    ownerId,itemId,quantity:0,usableQuantity:0,notes:'',checkedAt:''
  };
  const schoolRobotSummary=ROBOT_TYPES.map(robot=>{
    const related=robotItems.filter(item=>item.robotType===robot);
    const quantity=related.reduce((sum,item)=>sum+Number(getInventoryRow(schoolRows,selectedSchoolId,item.id).quantity||0),0);
    const usable=related.reduce((sum,item)=>sum+Number(getInventoryRow(schoolRows,selectedSchoolId,item.id).usableQuantity||0),0);
    return {robot,quantity,usable,hasStock:quantity>0||usable>0};
  });
  const replaceRow=(rows,next)=>rows.some(row=>String(row.ownerId)===String(next.ownerId)&&String(row.itemId)===String(next.itemId))
    ?rows.map(row=>String(row.ownerId)===String(next.ownerId)&&String(row.itemId)===String(next.itemId)?next:row)
    :[...rows,next];
  const updateRow=(kind,ownerId,itemId,field,value)=>{
    const setter=kind==='office'?setOfficeRows:setSchoolRows;
    const source=kind==='office'?officeRows:schoolRows;
    const base=getInventoryRow(source,ownerId,itemId);
    const isNumeric=field==='quantity'||field==='usableQuantity';
    const next={...base,[field]:field==='notes'||field==='checkedAt'?value:value===''?'':clampNumber(value)};
    if(isNumeric&&next.quantity!==''&&next.usableQuantity!==''&&Number(next.usableQuantity)>Number(next.quantity)){
      if(field==='quantity')next.usableQuantity=next.quantity;
      if(field==='usableQuantity')next.quantity=next.usableQuantity;
    }
    setter(rows=>replaceRow(rows,next));
    setDirtyRows(keys=>{const nextKeys=new Set(keys);nextKeys.add(`${kind}-${rowKey(ownerId,itemId)}`);return nextKeys});
  };
  const saveRow=async(kind,ownerId,itemId)=>{
    const source=kind==='office'?officeRows:schoolRows;
    const target=getInventoryRow(source,ownerId,itemId);
    const key=`${kind}-${rowKey(ownerId,itemId)}`;
    setSavingKey(key);
    try{
      if(kind==='office')await saveOfficeInventory(target,user.id);
      else await saveSchoolInventory(target,user.id);
      setDirtyRows(keys=>{const nextKeys=new Set(keys);nextKeys.delete(key);return nextKeys});
      flash?.('บันทึก stock แล้ว');
    }catch(e){
      console.error(e);
      flash?.(`บันทึกไม่สำเร็จ: ${e.message}`);
    }finally{
      setSavingKey('');
    }
  };
  const dirtyCount=(kind,ownerId)=>items.filter(item=>dirtyRows.has(`${kind}-${rowKey(ownerId,item.id)}`)).length;
  const saveAllRows=async(kind,ownerId)=>{
    const source=kind==='office'?officeRows:schoolRows;
    const targets=items
      .map(item=>({key:`${kind}-${rowKey(ownerId,item.id)}`,row:getInventoryRow(source,ownerId,item.id)}))
      .filter(target=>dirtyRows.has(target.key));
    if(!ownerId||!targets.length)return;
    const key=`${kind}-all-${ownerId}`;
    setSavingKey(key);
    try{
      await Promise.all(targets.map(target=>kind==='office'?saveOfficeInventory(target.row,user.id):saveSchoolInventory(target.row,user.id)));
      setDirtyRows(keys=>{
        const nextKeys=new Set(keys);
        targets.forEach(target=>nextKeys.delete(target.key));
        return nextKeys;
      });
      flash?.(`บันทึก stock ${targets.length} รายการแล้ว`);
    }catch(e){
      console.error(e);
      flash?.(`บันทึกทั้งหมดไม่สำเร็จ: ${e.message}`);
    }finally{
      setSavingKey('');
    }
  };
  const movementLabels={checkout:'เบิกออกงาน',return:'คืนเข้าสำนักงาน',grant_to_school:'มอบให้โรงเรียน'};
  const movementOfficeId=movementForm.type==='return'?movementForm.toOfficeId:movementForm.fromOfficeId;
  const movementSchoolOptions=movementOfficeId?schools.filter(s=>String(s.officeId||'')===String(movementOfficeId)):schools;
  const movementItem=itemMap.get(movementForm.itemId);
  const movementQty=clampNumber(movementForm.quantity);
  const movementSourceRow=movementForm.type==='return'?null:getInventoryRow(officeRows,movementForm.fromOfficeId,movementForm.itemId);
  const movementSourceUsable=Number(movementSourceRow?.usableQuantity||0);
  const movementSourceTotal=Number(movementSourceRow?.quantity||0);
  const movementInsufficient=movementForm.type!=='return'&&movementQty>movementSourceUsable;
  const movementActionDisabled=!canEditOffice||!movementForm.itemId||!clampNumber(movementForm.quantity)||
    (movementForm.type!=='return'&&!movementForm.fromOfficeId)||
    (movementForm.type==='return'&&!movementForm.toOfficeId)||
    (movementForm.type==='grant_to_school'&&!movementForm.schoolId)||
    movementInsufficient||
    !!savingKey;
  const ownerName=(type,id,relatedSchoolId='')=>{
    if(type==='office')return offices.find(o=>String(o.id)===String(id))?.name||'สำนักงาน';
    if(type==='school')return schools.find(s=>String(s.id)===String(id))?.name||'โรงเรียน';
    if(type==='event'){
      const school=schools.find(s=>String(s.id)===String(relatedSchoolId||id));
      return school?`ออกงาน ${school.name}`:'ออกงาน';
    }
    return '-';
  };
  const submitMovement=async()=>{
    if(movementInsufficient){
      flash?.(`สำนักงานมี ${movementItem?.name||'รายการนี้'} ใช้ได้ ${movementSourceUsable} ${movementItem?.unit||'ชิ้น'} เบิก ${movementQty} ไม่ได้`);
      return;
    }
    if(movementActionDisabled)return;
    const key='movement-submit';
    setSavingKey(key);
    try{
      await applyStockMovement(movementForm);
      setMovementForm(form=>({...form,quantity:'',note:''}));
      flash?.('บันทึกรายการเบิก/คืนแล้ว');
      await refresh();
    }catch(e){
      console.error(e);
      flash?.(`บันทึกรายการไม่สำเร็จ: ${e.message}`);
    }finally{
      setSavingKey('');
    }
  };

  const totalsByRobot=ROBOT_TYPES.map(robot=>{
    const related=robotItems.filter(item=>item.robotType===robot);
    const quantity=officeRows.reduce((sum,row)=>sum+(related.some(item=>item.id===row.itemId)?Number(row.quantity||0):0),0);
    const usable=officeRows.reduce((sum,row)=>sum+(related.some(item=>item.id===row.itemId)?Number(row.usableQuantity||0):0),0);
    return {robot,quantity,usable};
  });
  const officeMatrix=offices.map(office=>({
    ...office,
    schools: schoolsByOffice.get(office.id)?.length||0,
    total: robotItems.reduce((sum,item)=>sum+getInventoryRow(officeRows,office.id,item.id).usableQuantity,0)
  }));

  const setPlanRobot=value=>setPlan(p=>({...p,robot:value}));
  const schoolUsableByRobot=(robot,schoolId)=>robotItems.filter(item=>item.robotType===robot).reduce((sum,item)=>sum+getInventoryRow(schoolRows,schoolId,item.id).usableQuantity,0);
  const officeUsableByRobot=(robot,officeId)=>robotItems.filter(item=>item.robotType===robot).reduce((sum,item)=>sum+getInventoryRow(officeRows,officeId,item.id).usableQuantity,0);
  const planning=useMemo(()=>{
    const fieldItems=items.filter(item=>item.category==='field'&&item.robotType===plan.robot);
    const participants=clampNumber(plan.participantCount);
    const requiredRobots=participants;
    const schoolUsable=schoolUsableByRobot(plan.robot,plan.schoolId);
    const needFromOffice=Math.max(requiredRobots-schoolUsable,0);
    const officeUsable=officeUsableByRobot(plan.robot,planningOfficeId);
    const shortage=Math.max(needFromOffice-officeUsable,0);
    const officeRemaining=Math.max(officeUsable-needFromOffice,0);
    const fieldNeed=requiredRobots;
    const schoolFieldUsable=fieldItems.reduce((sum,item)=>sum+getInventoryRow(schoolRows,plan.schoolId,item.id).usableQuantity,0);
    const fieldNeedFromOffice=Math.max(fieldNeed-schoolFieldUsable,0);
    const officeFieldUsable=fieldItems.reduce((sum,item)=>sum+getInventoryRow(officeRows,planningOfficeId,item.id).usableQuantity,0);
    const fieldShortage=Math.max(fieldNeedFromOffice-officeFieldUsable,0);
    const fieldOfficeRemaining=Math.max(officeFieldUsable-fieldNeedFromOffice,0);
    const officeFieldBreakdown=fieldItems
      .map(item=>({name:item.name,unit:item.unit,usable:getInventoryRow(officeRows,planningOfficeId,item.id).usableQuantity}))
      .filter(item=>item.usable>0);
    return {participants,requiredRobots,schoolUsable,needFromOffice,officeUsable,shortage,officeRemaining,fieldNeed,schoolFieldUsable,fieldNeedFromOffice,officeFieldUsable,fieldShortage,fieldOfficeRemaining,officeFieldBreakdown};
  },[plan,schoolRows,officeRows,planningOfficeId,items]);
  const supportPlan=[
    {
      key:'field-total',
      name:`สนามรวม ${plan.robot}`,
      category:'field',
      unit:'ชุด',
      need:planning.fieldNeedFromOffice,
      officeStock:planning.officeFieldUsable,
      shortage:planning.fieldShortage,
      remaining:planning.fieldOfficeRemaining,
      detail:`ต้องใช้สนาม ${plan.robot} รวม ${planning.fieldNeed} ชุด · โรงเรียนมี ${planning.schoolFieldUsable} ชุด`,
      officeDetail:planning.officeFieldBreakdown.length
        ?planning.officeFieldBreakdown.map(item=>`${item.name} ${item.usable} ${item.unit}`).join(' · ')
        :'ไม่มีสนามในสำนักงานนี้'
    }
  ];

  const renderInventoryEditor=(kind,ownerId,editable)=>{
    const rows=kind==='office'?officeRows:schoolRows;
    if(!ownerId)return <div className="stock-empty">เลือกปลายทางก่อน</div>;
    if(!items.length)return <div className="stock-empty">ยังไม่มีรายการอุปกรณ์จาก Supabase กรุณารัน migration stock ก่อน</div>;
    const visibleItems=items.filter(item=>{
      if(inventoryFilter==='all')return true;
      if(inventoryFilter==='robots')return item.category==='robot';
      if(inventoryFilter==='fields')return item.category==='field';
      if(inventoryFilter==='support')return item.category!=='robot'&&item.category!=='field';
      return item.robotType===inventoryFilter;
    });
    return <>
      <div className="stock-editor-filter">
        {inventoryFilterOptions.map(option=><button key={option.id} type="button" className={inventoryFilter===option.id?'active':''} onClick={()=>setInventoryFilter(option.id)}>{option.label}</button>)}
      </div>
      {!visibleItems.length?<div className="stock-empty">ไม่มีรายการในหมวดนี้</div>:<div className="table-wrap stock-editor-wrap"><table className="stock-editor-table responsive-card-table"><thead><tr><th>รายการ</th><th>ทั้งหมด</th><th>ใช้ได้จริง</th>{kind==='school'&&<th>วันที่เช็ค</th>}<th>หมายเหตุ</th><th></th></tr></thead><tbody>
      {visibleItems.map(item=>{
        const row=getInventoryRow(rows,ownerId,item.id),key=`${kind}-${rowKey(ownerId,item.id)}`;
        return <tr key={item.id}>
          <td data-label="รายการ"><b>{item.name}</b><small>{item.unit}</small></td>
          <td data-label="ทั้งหมด"><input type="number" inputMode="numeric" min="0" value={row.quantity} disabled={!editable} onFocus={e=>e.target.select()} onBlur={e=>{if(e.target.value==='')updateRow(kind,ownerId,item.id,'quantity','0')}} onChange={e=>updateRow(kind,ownerId,item.id,'quantity',e.target.value)}/></td>
          <td data-label="ใช้ได้จริง"><input type="number" inputMode="numeric" min="0" value={row.usableQuantity} disabled={!editable} onFocus={e=>e.target.select()} onBlur={e=>{if(e.target.value==='')updateRow(kind,ownerId,item.id,'usableQuantity','0')}} onChange={e=>updateRow(kind,ownerId,item.id,'usableQuantity',e.target.value)}/></td>
          {kind==='school'&&<td data-label="วันที่เช็ค"><ThaiDateInput value={row.checkedAt||''} disabled={!editable} placeholder="เลือกวันที่" onChange={value=>updateRow(kind,ownerId,item.id,'checkedAt',value)}/></td>}
          <td data-label="หมายเหตุ"><input value={row.notes||''} disabled={!editable} onChange={e=>updateRow(kind,ownerId,item.id,'notes',e.target.value)} placeholder="เช่น เสีย 2 ตัว"/></td>
          <td data-label="บันทึก"><button className="button icon-only" disabled={!editable||!!savingKey} onClick={()=>saveRow(kind,ownerId,item.id)} title="บันทึก"><Save/></button></td>
        </tr>;
      })}
      </tbody></table></div>}
    </>;
  };

  return <div className="stock-page">
    <div className="page-title">
      <div><span className="eyebrow">Inventory</span><h1>Stock อุปกรณ์ Robotics</h1><p>แยก stock ของสำนักงานออกจาก stock ที่โรงเรียนมีเอง</p></div>
      <div className="page-title-actions"><button className="button" onClick={refresh} disabled={loading}><RefreshCw/>รีเฟรช</button></div>
    </div>
    {error&&<div className="card stock-alert"><AlertCircle/>{error}</div>}
    <div className="stock-tabs">
      <button className={tab==='office'?'active':''} onClick={()=>setTab('office')}><Warehouse/>Stock สำนักงาน</button>
      <button className={tab==='school'?'active':''} onClick={()=>setTab('school')}><School/>Stock โรงเรียน</button>
      <button className={tab==='planning'?'active':''} onClick={()=>setTab('planning')}><Calculator/>คำนวณออกงาน</button>
      <button className={tab==='movement'?'active':''} onClick={()=>setTab('movement')}><ClipboardList/>เบิก/คืน</button>
    </div>

    {tab==='office'&&<>
      <div className="stock-total-grid">
        {totalsByRobot.map(row=><div className="card stock-total-card" key={row.robot}><Bot/><span>{row.robot}</span><strong>{row.usable}<small>/{row.quantity} ตัว</small></strong></div>)}
      </div>
      <div className="card">
        <div className="card-head"><div><b>ภาพรวมตามสำนักงาน</b><small>นับเฉพาะของเรา ไม่รวมของโรงเรียน</small></div></div>
        <div className="table-wrap"><table className="stock-matrix-table"><thead><tr><th>สำนักงาน</th><th>โรงเรียน</th>{robotItems.map(item=><th key={item.id}>{item.name}</th>)}<th>พร้อมใช้รวม</th></tr></thead><tbody>
          {officeMatrix.map(office=><tr key={office.id} onClick={()=>selectOfficeForStock(office.id)} className={selectedOfficeId===office.id?'active':''}>
            <td><b>{office.name}</b></td><td>{office.schools}</td>{robotItems.map(item=>{const row=getInventoryRow(officeRows,office.id,item.id);return <td key={item.id}>{row.usableQuantity}<small>/{row.quantity}</small></td>})}<td><b>{office.total}</b></td>
          </tr>)}
        </tbody></table></div>
      </div>
      <div className="card">
        <div className="card-head"><div><b>แก้ไข stock สำนักงาน</b><small>{offices.find(o=>o.id===selectedOfficeId)?.name||'เลือกสำนักงาน'}{dirtyCount('office',selectedOfficeId)?` · ยังไม่ได้บันทึก ${dirtyCount('office',selectedOfficeId)} รายการ`:''}</small></div><Field label="สำนักงาน"><Select value={selectedOfficeId} onChange={selectOfficeForStock}>{offices.map(office=><option key={office.id} value={office.id}>{office.name}</option>)}</Select></Field><button className="button" disabled={!canEditOffice||!dirtyCount('office',selectedOfficeId)||!!savingKey} onClick={()=>saveAllRows('office',selectedOfficeId)}><Save/>บันทึกทั้งหมด</button></div>
        {renderInventoryEditor('office',selectedOfficeId,canEditOffice)}
      </div>
    </>}

    {tab==='school'&&<>
      <div className="card stock-filter-card">
        <div className="form-grid">
          <Field label="สำนักงาน"><Select value={schoolFilterOfficeId} onChange={value=>{setSchoolFilterOfficeId(value);const next=schools.find(s=>!value||(value==='unassigned'?!s.officeId:String(s.officeId)===String(value)));if(next)setSelectedSchoolId(next.id)}}><option value="">ทุกสำนักงาน</option>{offices.map(office=><option key={office.id} value={office.id}>{office.name}</option>)}{schools.some(s=>!s.officeId)&&<option value="unassigned">ยังไม่ระบุสำนักงาน</option>}</Select></Field>
          <Field label="โรงเรียน"><Select value={selectedSchoolId} onChange={setSelectedSchoolId}>{visibleSchools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        </div>
      </div>
      <div className="card">
        <div className="card-head"><div><b>Stock ที่โรงเรียนมีเอง</b><small>{selectedSchool?.name||'เลือกโรงเรียน'} · ไม่รวมกับ stock สำนักงาน{dirtyCount('school',selectedSchoolId)?` · ยังไม่ได้บันทึก ${dirtyCount('school',selectedSchoolId)} รายการ`:''}</small></div><button className="button" disabled={!canEditSchool||!dirtyCount('school',selectedSchoolId)||!!savingKey} onClick={()=>saveAllRows('school',selectedSchoolId)}><Save/>บันทึกทั้งหมด</button></div>
        <div className="stock-school-summary">
          {schoolRobotSummary.map(row=><div key={row.robot} className={row.hasStock?'stock-school-summary-card active':'stock-school-summary-card'}>
            <Bot/>
            <span>{row.robot}</span>
            <strong>{row.usable}<small>/{row.quantity} ตัว</small></strong>
            <em>ใช้ได้จริง / ทั้งหมด</em>
          </div>)}
        </div>
        {renderInventoryEditor('school',selectedSchoolId,canEditSchool)}
      </div>
    </>}

    {tab==='planning'&&<>
      <div className="card stock-filter-card">
        <div className="form-grid">
          <Field label="สำนักงาน"><Select value={planningOfficeId} onChange={value=>{const firstSchool=schools.find(s=>String(s.officeId||'')===String(value));setPlan(p=>({...p,officeId:value,schoolId:firstSchool?.id||'',participantCount:0}))}}>{offices.map(office=><option key={office.id} value={office.id}>{office.name}</option>)}</Select></Field>
          <Field label="โรงเรียน"><Select value={plan.schoolId} onChange={value=>setPlan(p=>({...p,schoolId:value,participantCount:0}))} disabled={!planningOfficeId||!planningSchools.length}>{planningSchools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          <Field label="หุ่นที่ใช้"><Select value={plan.robot} onChange={setPlanRobot}>{ROBOT_TYPES.map(robot=><option key={robot} value={robot}>{robot}</option>)}</Select></Field>
          <Field label="จำนวนเด็กจากข้อมูลจริง"><input type="number" min="0" value={plan.participantCount} readOnly/></Field>
        </div>
        <div className="stock-class-picker">
          <div className="stock-class-picker-head">
            <div><b>เลือกห้องที่จะคำนวณ</b><small>{selectedClassIds.length}/{planningClassrooms.length} ห้อง · {plan.participantCount} คน · {classPickerHint}</small></div>
            <div>
              <button type="button" className="button" onClick={()=>setSelectedClassIds(planningClassrooms.map(c=>c.id))} disabled={!planningClassrooms.length}>เลือกทุกห้อง</button>
              <button type="button" className="button" onClick={()=>setSelectedClassIds([])} disabled={!planningClassrooms.length}>ล้าง</button>
            </div>
          </div>
          <div className="stock-class-list">
            {planningClassrooms.map(classroom=><label key={classroom.id} className={selectedClassSet.has(String(classroom.id))?'active':''}>
              <input type="checkbox" checked={selectedClassSet.has(String(classroom.id))} onChange={()=>togglePlanningClass(classroom.id)}/>
              <span><b>{classroom.name}</b><small>{activeStudentCount(classroom)} คน</small></span>
            </label>)}
            {!planningClassrooms.length&&<div className="stock-empty">{classPickerEmptyText}</div>}
          </div>
        </div>
      </div>
      <div className="stock-plan-grid">
        <div className="card stock-plan-summary">
          <div className="card-head"><div><b>ผลคำนวณหุ่น</b><small>{planningSchool?.name||''}</small></div>{planning.shortage?<span className="stock-badge danger"><AlertCircle/>ไม่พอ</span>:<span className="stock-badge ok"><CheckCircle2/>พอ</span>}</div>
          <div className="stock-plan-numbers">
            <span><Bot/>ต้องใช้จริง <b>{planning.requiredRobots}</b><small>ตัว</small></span>
            <span><School/>โรงเรียนมีใช้ได้ <b>{planning.schoolUsable}</b><small>ตัว</small></span>
            <span><Warehouse/>ยังขาดอยู่ <b>{planning.shortage}</b><small>ตัว</small></span>
            <span><CheckCircle2/>สำนักงานมีใช้ได้ <b>{planning.officeUsable}</b><small>ตัว</small></span>
          </div>
          {!planning.shortage&&planning.needFromOffice>0&&<div className="stock-ready">สำนักงานพอ หลังเตรียมเหลือ {planning.officeRemaining} ตัว</div>}
          {!planning.shortage&&!planning.needFromOffice&&<div className="stock-ready">โรงเรียนมีหุ่นพอ ไม่ต้องใช้ stock สำนักงาน</div>}
        </div>
        <div className="card stock-support-card">
          <div className="card-head"><div><b>แผ่นสนามที่ต้องเตรียม</b><small>รวมสนามไวนิลและแผ่นรองเมาส์</small></div></div>
          <div className="table-wrap"><table className="stock-support-table"><thead><tr><th>รายการ</th><th>ต้องเตรียมจากสำนักงาน</th><th>สำนักงานมี</th><th>หลังหัก</th></tr></thead><tbody>
            {supportPlan.map(row=>{const item=row.itemId?itemMap.get(row.itemId):row,officeStock=row.officeStock??getInventoryRow(officeRows,planningOfficeId,row.itemId).usableQuantity,shortage=row.shortage??Math.max(row.need-officeStock,0),remaining=row.remaining??Math.max(officeStock-row.need,0);return <tr key={row.itemId||row.key}><td>{item.category==='field'?<MapIcon/>:item.id==='tablet'?<Tablet/>:item.id==='aa-battery'?<Battery/>:<BatteryCharging/>}<span><b>{item.name}</b>{row.detail&&<small>{row.detail}</small>}</span></td><td>{row.need} {item.unit}</td><td>{officeStock} {item.unit}{row.officeDetail&&<small>{row.officeDetail}</small>}</td><td>{shortage?<span className="stock-badge danger">ขาด {shortage}</span>:<span className="stock-badge ok">เหลือ {remaining}</span>}</td></tr>})}
          </tbody></table></div>
        </div>
      </div>
    </>}
    {tab==='movement'&&<>
      <div className="card stock-movement-form">
        <div className="card-head">
          <div><b>บันทึกการเบิก/คืน stock สำนักงาน</b><small>ใช้สำหรับตัดยอดจริงจากสำนักงานและเก็บประวัติย้อนหลัง</small></div>
          {!canEditOffice&&<span className="stock-badge danger"><AlertCircle/>ไม่มีสิทธิ์แก้ไข</span>}
        </div>
        <div className="form-grid">
          <Field label="ประเภท"><Select value={movementForm.type} onChange={value=>setMovementForm(p=>({...p,type:value}))}>
            <option value="checkout">เบิกออกงาน</option>
            <option value="return">คืนเข้าสำนักงาน</option>
            <option value="grant_to_school">มอบให้โรงเรียน</option>
          </Select></Field>
          <Field label="รายการ"><Select value={movementForm.itemId} onChange={value=>setMovementForm(p=>({...p,itemId:value}))}>
            {items.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
          </Select></Field>
          <Field label="จำนวน"><input type="number" inputMode="numeric" min="0" value={movementForm.quantity} onFocus={e=>e.target.select()} onChange={e=>setMovementForm(p=>({...p,quantity:e.target.value===''?'':clampNumber(e.target.value)}))} placeholder="0"/></Field>
          {movementForm.type==='return'
            ?<Field label="คืนเข้าสำนักงาน"><Select value={movementForm.toOfficeId} onChange={value=>setMovementForm(p=>({...p,toOfficeId:value}))}>{offices.map(office=><option key={office.id} value={office.id}>{office.name}</option>)}</Select></Field>
            :<Field label="เบิกจากสำนักงาน"><Select value={movementForm.fromOfficeId} onChange={value=>{const firstSchool=schools.find(s=>String(s.officeId||'')===String(value));setMovementForm(p=>({...p,fromOfficeId:value,schoolId:firstSchool?.id||p.schoolId}))}}>{offices.map(office=><option key={office.id} value={office.id}>{office.name}</option>)}</Select></Field>}
          <Field label={movementForm.type==='return'?'อ้างอิงโรงเรียน':'โรงเรียน'}><Select value={movementForm.schoolId} onChange={value=>setMovementForm(p=>({...p,schoolId:value}))}>
            {(movementSchoolOptions.length?movementSchoolOptions:schools).map(school=><option key={school.id} value={school.id}>{school.name}</option>)}
          </Select></Field>
          <Field label="หมายเหตุ" wide><input value={movementForm.note} onChange={e=>setMovementForm(p=>({...p,note:e.target.value}))} placeholder="เช่น งานทดสอบ ป.4 หรือคืนหลังออกงาน"/></Field>
        </div>
        {movementForm.type!=='return'&&movementForm.itemId&&<div className={movementInsufficient?'stock-movement-stock danger':'stock-movement-stock'}>
          <Warehouse/>
          <span>สำนักงานมีใช้ได้ <b>{movementSourceUsable}</b> / ทั้งหมด {movementSourceTotal} {movementItem?.unit||'ชิ้น'}</span>
          {movementInsufficient&&<strong>ไม่พอสำหรับเบิก {movementQty} {movementItem?.unit||'ชิ้น'}</strong>}
        </div>}
        <div className="stock-movement-actions">
          <button className="primary" disabled={movementActionDisabled} onClick={submitMovement}><ArrowRightLeft/>บันทึกรายการ</button>
        </div>
      </div>
      <div className="card stock-movement-history">
        <div className="card-head"><div><b>ประวัติล่าสุด</b><small>รายการที่บันทึกผ่านเมนูเบิก/คืน</small></div></div>
        {!movementRows.length?<div className="stock-empty">ยังไม่มีประวัติการเบิก/คืน</div>:<div className="table-wrap"><table className="responsive-card-table stock-movement-table"><thead><tr><th>เวลา</th><th>ประเภท</th><th>รายการ</th><th>จำนวน</th><th>จาก</th><th>ไปยัง</th><th>หมายเหตุ</th></tr></thead><tbody>
          {movementRows.map(row=>{
            const item=itemMap.get(row.itemId);
            return <tr key={row.id}>
              <td data-label="เวลา">{row.createdAt?new Date(row.createdAt).toLocaleString('th-TH',{dateStyle:'short',timeStyle:'short'}):'-'}</td>
              <td data-label="ประเภท"><span className={`stock-badge movement-${row.type}`}>{movementLabels[row.type]||row.type}</span></td>
              <td data-label="รายการ"><b>{row.itemName||item?.name||row.itemId}</b></td>
              <td data-label="จำนวน">{row.quantity} {row.itemUnit||item?.unit||'ชิ้น'}</td>
              <td data-label="จาก">{ownerName(row.fromOwnerType,row.fromOwnerId,row.relatedSchoolId)}</td>
              <td data-label="ไปยัง">{ownerName(row.toOwnerType,row.toOwnerId,row.relatedSchoolId)}</td>
              <td data-label="หมายเหตุ">{row.note||'-'}</td>
            </tr>;
          })}
        </tbody></table></div>}
      </div>
    </>}
    {loading&&<div className="stock-loading">กำลังโหลด stock...</div>}
  </div>;
}

export default StockPage;
