const list = document.getElementById('input-list');
for(let i=1; i<=5; i++) {
  list.innerHTML += `
    <div class="input-row">
      <div class="row-id">${i}</div>
      <div class="input-wrapper">
        <div id="sc-${i}" class="score-label"></div>
        <input type="number" step="0.01" class="time-input" id="t-${i}" 
               placeholder="0.00" inputmode="decimal" oninput="clearStates(${i})">
      </div>
      <button id="add5-${i}" class="btn-add5" onclick="toggleAdd5(${i})">+5 คะแนน</button>
      <button id="dnf-${i}" class="btn-dnf" onclick="toggleDNF(${i})">DNF</button>
    </div>
  `;
}

// เคลียร์สถานะของปุ่มทั้งสองเมื่อมีการพิมพ์เวลาเอง
function clearStates(id) {
  const input = document.getElementById('t-' + id);
  
  // เคลียร์ DNF
  input.dataset.isdnf = "false";
  const btnDnf = document.getElementById('dnf-' + id);
  btnDnf.classList.remove('active');
  btnDnf.innerText = "DNF";

  // เคลียร์ +5
  input.dataset.isadd5 = "false";
  const btnAdd5 = document.getElementById('add5-' + id);
  btnAdd5.classList.remove('active');
  btnAdd5.innerText = "+5 คะแนน";
}

function toggleDNF(id) {
  clearStates(id); // ล้างสถานะอื่นก่อน
  const input = document.getElementById('t-' + id);
  const btn = document.getElementById('dnf-' + id);
  input.value = "2.30";
  input.dataset.isdnf = "true";
  btn.classList.add('active');
  btn.innerText = "ไม่ทัน";
}

function toggleAdd5(id) {
  clearStates(id); // ล้างสถานะอื่นก่อน
  const input = document.getElementById('t-' + id);
  const btn = document.getElementById('add5-' + id);
  input.value = "2.30";
  input.dataset.isadd5 = "true";
  btn.classList.add('active');
  btn.innerText = "ได้ 5";
}

function calculateAll() {
  let gTotalSec = 0;
  let gTotalScore = 0;
  
  for(let i=1; i<=5; i++) {
    const input = document.getElementById('t-' + i);
    const scoreLabel = document.getElementById('sc-' + i);
    let v = input.value.trim();
    let sec = 0;
    let score = 0;

    // ถ้าปล่อยว่างไว้ ให้ถือเป็น DNF ทันที
    if(v === "") {
      toggleDNF(i);
      v = "2.30";
    }

    // คำนวณเวลาเป็นวินาที
    if(v.includes('.')) {
      let p = v.split('.');
      sec = (parseInt(p[0])||0)*60 + (parseInt(p[1])||0);
    } else {
      sec = parseInt(v)||0;
    }

    // เช็คการให้คะแนนจากสถานะของปุ่ม
    if(input.dataset.isdnf === "true") {
      score = 0;
    } else if (input.dataset.isadd5 === "true") {
      score = 5;
    } else {
      // คำนวณปกติตามเวลาที่พิมพ์
      if(sec <= 120) score = 10;
      else {
        let ot = sec - 120;
        score = 10 - Math.ceil(ot/10);
      }
    }
    
    if(score < 0) score = 0;

    scoreLabel.innerText = score + " คะแนน";
    scoreLabel.style.color = score === 0 ? "var(--danger)" : (score >= 8 ? "var(--success)" : (score === 5 ? "var(--warning)" : "var(--text)"));
    
    gTotalSec += sec;
    gTotalScore += score;
  }

  document.getElementById('resultArea').style.display = 'block';
  document.getElementById('totalScore').innerText = gTotalScore;
  
  let m = Math.floor(gTotalSec/60);
  let s = gTotalSec % 60;
  document.getElementById('totalTime').innerText = `เวลารวม: ${m} นาที ${s} วินาที`;
  
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}

function resetApp() {
  for(let i=1; i<=5; i++) {
    const input = document.getElementById('t-' + i);
    input.value = "";
    document.getElementById('sc-' + i).innerText = "";
    clearStates(i); // ล้างสถานะสีปุ่มและ data attribute ทั้งหมด
  }
  document.getElementById('resultArea').style.display = 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker registered', reg))
      .catch(err => console.error('Service Worker registration failed', err));
  });
}
