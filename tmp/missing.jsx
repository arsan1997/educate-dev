870:             paddingBottom: '16px',
871:             borderBottom: index === list.length - 1 ? '0' : '1px solid var(--line)'
872:           }}>
873:             {isEdit&&<Field label="เลขที่"><input type="number" min="1" value={item.no} onChange={e=>updateRow(index,'no',e.target.value)} /></Field>}
874:             <Field label="คำนำหน้า">
875: 