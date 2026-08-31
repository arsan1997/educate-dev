const fs = require('fs');

const uncommittedLines = fs.readFileSync('tmp/uncommitted_main.jsx', 'utf-8').split('\n');
const validLines = uncommittedLines.slice(0, 874);

const tailLines = `              <Select value={item.prefix} onChange={v => updateRow(index, 'prefix', v)}>
                <option>เด็กชาย</option>
                <option>เด็กหญิง</option>
                <option>นาย</option>
                <option>นางสาว</option>
              </Select>
            </Field>
            <Field label="ชื่อ">
              <input autoFocus={index === list.length - 1} value={item.firstName} onChange={e => updateRow(index, 'firstName', e.target.value)} placeholder="กรอกชื่อ"/>
            </Field>
            <Field label="นามสกุล">
              <input value={item.lastName} onChange={e => updateRow(index, 'lastName', e.target.value)} placeholder="กรอกนามสกุล"/>
            </Field>
            {!isEdit && list.length > 1 && (
              <button type="button" className="icon-btn danger-text" onClick={() => removeRow(index)} style={{ marginBottom: '4px' }}>
                <X size={16}/>
              </button>
            )}
          </div>
        ))}
        {!isEdit && (
          <button type="button" className="button" onClick={addRow} style={{ width: '100%', borderStyle: 'dashed', marginTop: '8px' }}>
            <Plus/>เพิ่มคนถัดไป
          </button>
        )}
      </div>
      <div className="modal-actions">
        <button type="button" className="button" onClick={onClose}>ยกเลิก</button>
        <button className="primary" disabled={!valid}><Save/>{isEdit?'บันทึกการแก้ไข':'เพิ่มนักเรียนทั้งหมด'}</button>
      </div>
    </form>
  </div>
}`;

const fnLines = fs.readFileSync('tmp/functions.txt', 'utf-8').split('\n');
const getFn = name => {
  const line = fnLines.find(l => l.includes('"LineContent":"function ' + name + '({') || l.includes('"LineContent":"function ' + name + '()'));
  if (!line) return '';
  return JSON.parse(line).LineContent;
};

const FieldStr = getFn('Field');
const SelectStr = getFn('Select');
const ReportsStr = getFn('Reports');
const GoogleMarkStr = getFn('GoogleMark');
const AuthLoadingStr = getFn('AuthLoading');
const PendingAccessStr = getFn('PendingAccess');

const oldMainLines = fs.readFileSync('tmp/old_main.jsx', 'utf-8').split('\n');
const idxAuthPage = oldMainLines.findIndex(l => l.includes('function AuthPage(){'));
const idxRoot = oldMainLines.findIndex(l => l.includes('function Root(){'));
const idxCreateRoot = oldMainLines.findIndex(l => l.includes('createRoot('));

const AuthPageStr = oldMainLines.slice(idxAuthPage, idxRoot).join('\n');
const RootStr = oldMainLines.slice(idxRoot, idxCreateRoot).join('\n');
const createRootStr = oldMainLines.slice(idxCreateRoot).join('\n');

const fullUncommitted = validLines.join('\n') + '\n' +
  tailLines + '\n\n' +
  FieldStr + '\n\n' +
  SelectStr + '\n\n' +
  ReportsStr + '\n\n' +
  GoogleMarkStr + '\n\n' +
  AuthLoadingStr + '\n\n' +
  PendingAccessStr + '\n\n' +
  AuthPageStr + '\n\n' +
  RootStr + '\n\n' +
  createRootStr;

fs.writeFileSync('tmp/full_uncommitted_main.jsx', fullUncommitted);
console.log('Rebuilt full uncommitted main.jsx!');
