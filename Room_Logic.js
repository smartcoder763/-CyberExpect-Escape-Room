/* Room_Logic.js
   Loads questions.json (must be served over HTTP) and runs the quiz.
   Updated: show animated feedback for 2s, display correct answer on wrong/time-up,
   disable interaction during feedback.
*/

/* === Glowing Particles (Moon + Sun) === */
document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("particles");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  let particles = [];

  class Particle {
    constructor() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size = Math.random() * 3 + 1;
      this.speedX = (Math.random() - 0.5) * 0.5;
      this.speedY = (Math.random() - 0.5) * 0.5;
      this.color = Math.random() < 0.8 ? "#ffffff" : "#ff9900"; // white moon / orange sun
    }
    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
      if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = this.color === "#ffffff" ? 20 : 40;
      ctx.fill();
    }
  }

  function initParticles() {
    particles = [];
    for (let i = 0; i < 70; i++) {
      particles.push(new Particle());
    }
  }

  function animateParticles() {
    ctx.fillStyle = "rgba(0, 0, 0, 1)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.update();
      p.draw();
    });
    requestAnimationFrame(animateParticles);
  }

  initParticles();
  animateParticles();

  window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initParticles();
  });
});


let questions = [];
const levelTimeMap = { 1:15, 2:20, 3:25, 4:30, 5:35, 6:40, 7:45, 8:60 };
const levelQuestionCounts = {1:5,2:10,3:15,4:20,5:25,6:20,7:15,8:10};
const pointsCorrect = 10;
const pointsWrong = -5;
const FEEDBACK_MS = 1550; // show message for 2000 ms (2s)

let state = {
  level:1,
  qIndex:0,
  score:0,
  currentQuestions:[],
  timer:null,
  timeLeft:0,
  totalInLevel:0
};


function fetchQuestions(){
  return fetch('questions.json')
    .then(res => {
      if(!res.ok) throw new Error('HTTP error ' + res.status);
      return res.json();
    })
    .then(data => { questions = data; })
    .catch(err => {
      console.error('Failed to load questions.json:', err);
      alert('Could not load questions.json. If you opened the file with file:// in the browser, fetch will fail.\nPlease run a local HTTP server (example: run `python -m http.server` in the folder) and open http://localhost:8000/CyberExpect.html');
    });
}

function getQuestionsForLevel(level){
  return questions.filter(q => q.level === level).slice(0, levelQuestionCounts[level]);
}

function showWelcome(){ document.getElementById('welcome-page').style.display='block'; document.getElementById('game').style.display='none'; document.getElementById('end-panel').style.display='none'; }
function showGame(){ document.getElementById('welcome-page').style.display='none'; document.getElementById('game').style.display='block'; document.getElementById('end-panel').style.display='none'; }

function startQuestionTimer(seconds){
  clearInterval(state.timer);
  state.timeLeft = seconds;
  document.getElementById('timer').textContent = state.timeLeft;
  document.getElementById('hurry').style.display = 'none';
  state.timer = setInterval(()=> {
    document.getElementById('timer').textContent = state.timeLeft;
    if(state.timeLeft <= 10) document.getElementById('hurry').style.display = 'inline';
    if(state.timeLeft <= 0){
      clearInterval(state.timer);
      // Time's up: show feedback with correct answer, apply penalty, then next after FEEDBACK_MS
      const q = state.currentQuestions[state.qIndex];
      const correct = resolveCorrectText(q);
      applyWrongAnswerPenalty();
      disableInteraction();
      showMessage("time", correct);
      setTimeout(() => {
        moveToNextQuestion();
      }, FEEDBACK_MS);
    }
    state.timeLeft--;
  }, 1000);
}
function stopTimer(){ clearInterval(state.timer); document.getElementById('hurry').style.display='none'; }

/* Clear feedback and ensure inputs enabled for new question */
function clearFeedbackAndEnable() {
  const msgBox = document.getElementById('msgBox');
  if(msgBox){ msgBox.className=''; msgBox.innerHTML=''; }
  const submitBtn = document.getElementById('submitTextBtn');
  if(submitBtn) submitBtn.disabled = false;
  const skipBtn = document.getElementById('skipBtn');
  if(skipBtn) skipBtn.disabled = false;
  // remove disabled on option buttons if any (they'll be recreated usually)
  document.querySelectorAll('.option-btn').forEach(b => b.disabled = false);
  const textInp = document.getElementById('textAnswer');
  if(textInp) textInp.disabled = false;
}

/* Disable interactions while feedback showing */
function disableInteraction(){
  const submitBtn = document.getElementById('submitTextBtn');
  if(submitBtn) submitBtn.disabled = true;
  const skipBtn = document.getElementById('skipBtn');
  if(skipBtn) skipBtn.disabled = true;
  document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);
  const textInp = document.getElementById('textAnswer');
  if(textInp) textInp.disabled = true;
}

/* Render question - clear old feedback at start */
function renderCurrentQuestion(){
  clearFeedbackAndEnable();

  const lvl = state.level;
  const qarr = state.currentQuestions;
  const idx = state.qIndex;
  document.getElementById('currentLevel').textContent = lvl;
  document.getElementById('qIndex').textContent = idx+1;
  document.getElementById('qTotal').textContent = state.totalInLevel;
  document.getElementById('score').textContent = state.score;
  if(!qarr || qarr.length === 0){
    document.getElementById('questionArea').innerText = 'No questions available for this level.';
    return;
  }
  const q = qarr[idx];
const area = document.getElementById('questionArea');
area.innerHTML = '';

// ✅ Always show question inside hacker-style box
const box = document.createElement('pre');
box.className = 'question-box';
box.textContent = q.prompt;
area.appendChild(box);


  document.getElementById('submitTextBtn').style.display='none';
  document.getElementById('nextBtn').style.display='none';

  if(q.type === 'mcq'){
    const opts = document.createElement('div'); opts.className='options';
    q.options.forEach((opt, i) => {
      const b = document.createElement('button');
      b.className = 'option-btn';
      b.innerText = opt;
      b.onclick = ()=> handleMCQ(i);
      opts.appendChild(b);
    });
    area.appendChild(opts);
  } else if(['text','find_error','scenario','code_output'].includes(q.type)){
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'textAnswer';
    input.placeholder = 'Type your answer here (case-insensitive)';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.autocapitalize = 'off';
    area.appendChild(input);
    document.getElementById('submitTextBtn').style.display='inline-block';
    document.getElementById('submitTextBtn').disabled = false;
    document.getElementById('submitTextBtn').onclick = ()=> {
      const val = document.getElementById('textAnswer').value || '';
      handleTextAnswer(val);
    };
  } else {
    area.appendChild(document.createTextNode('Unknown question type.'));
  }

  document.getElementById('skipBtn').onclick = ()=> {
    // Skip: -5 sec from timer and move next (but show no extra message)
    state.timeLeft = Math.max(0, state.timeLeft - 5);
    moveToNextQuestion();
  };

  startQuestionTimer(levelTimeMap[state.level]);
}

function questionTypeLabel(t){
  switch(t){ case 'mcq': return 'MCQ'; case 'text': return 'Answer'; case 'code_output': return 'Predict Output'; case 'find_error': return 'Find Error'; case 'scenario': return 'Scenario'; default: return t; }
}

/* Helper to get a human-readable correct answer text */
function resolveCorrectText(q){
  if(!q) return '';
  if(typeof q.answer === 'number' && Array.isArray(q.options)) {
    return q.options[q.answer] !== undefined ? q.options[q.answer] : String(q.answer);
  }
  return String(q.answer || '');
}

/* Escape function to avoid injecting HTML when showing answers */
function escapeHtml(unsafe) {
    return ("" + unsafe).replace(/[&<>"'`=\/]/g, function(s) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#x2F;','`':'&#x60;','=':'&#x3D;'}[s];
    });
}

function handleMCQ(selectedIndex){
  const q = state.currentQuestions[state.qIndex];
  if(typeof q.answer === 'number'){
    disableInteraction();
    if (selectedIndex === q.answer) {
      applyCorrectAnswer();
      showMessage("correct");
      setTimeout(()=> {
        moveToNextQuestion();
      }, FEEDBACK_MS);
    } else {
      applyWrongAnswer();
      const correctText = resolveCorrectText(q);
      showMessage("wrong", correctText);
      setTimeout(()=> {
        moveToNextQuestion();
      }, FEEDBACK_MS);
    }
  } else {
    disableInteraction();
    showMessage("time");
    setTimeout(()=> {
      moveToNextQuestion();
    }, FEEDBACK_MS);
  }
}

function handleTextAnswer(val){
  const q = state.currentQuestions[state.qIndex];
  const inputVal = (val||'').toString().trim();

  // ✅ Check if input empty
  if(inputVal === ""){
    showMessage("empty");
    return; // do not check further
  }

  const normalized = inputVal.toLowerCase();
  const expected = (q.answer||'').toString().trim().toLowerCase();
  const norm2 = normalized.replace(/\s+/g,'').replace(/[^a-z0-9]/g,'');
  const exp2 = expected.replace(/\s+/g,'').replace(/[^a-z0-9]/g,'');

  disableInteraction();

  if(norm2 === exp2){
    applyCorrectAnswer();
    showMessage("correct");
    setTimeout(()=> { moveToNextQuestion(); }, FEEDBACK_MS);
  } else {
    applyWrongAnswer();
    const correctText = resolveCorrectText(q);
    showMessage("wrong", correctText);
    setTimeout(()=> { moveToNextQuestion(); }, FEEDBACK_MS);
  }
}


/* showMessage optionally accepts correctAns string for wrong/time */
function showMessage(type, correctAns = ''){
  const msgBox = document.getElementById('msgBox');
  if(!msgBox) return;
  msgBox.className = ""; // reset classes

  if (type === "correct") {
    msgBox.classList.add("msg-correct");
    msgBox.innerHTML = "✔ Correct!";
  } else if (type === "wrong") {
    msgBox.classList.add("msg-wrong");
    msgBox.innerHTML = `✖ Wrong!<div class="small">Correct: <strong>${escapeHtml(correctAns||'')}</strong></div>`;
  } else if (type === "time") {
    msgBox.classList.add("msg-time");
    msgBox.innerHTML = `⏳ Time's Up!<div class="small">Correct: <strong>${escapeHtml(correctAns||'')}</strong></div>`;
  } else if (type === "empty") {
    msgBox.classList.add("msg-wrong");
    msgBox.innerHTML = "⚠ Please enter an answer!";
  } else {
    msgBox.innerHTML = "";
  }
}


/* Scoring & penalties */
function applyCorrectAnswer(){ state.score += pointsCorrect; document.getElementById('score').textContent = state.score; }
function applyWrongAnswer(){ state.score += pointsWrong; document.getElementById('score').textContent = state.score; state.timeLeft = Math.max(0, state.timeLeft - 5); }
function applyWrongAnswerPenalty(){ state.score += pointsWrong; document.getElementById('score').textContent = state.score; }

function moveToNextQuestion(){
  stopTimer();
  state.qIndex++;
  if(state.qIndex >= state.totalInLevel){
    showLevelComplete();
  } else {
    renderCurrentQuestion();
  }
}

function showLevelComplete(){
  const lvl = state.level;
  const panel = document.getElementById('questionArea');

  // 🎉 Message + Total Score show
  panel.innerHTML = `
    <div class="level-complete">
      🎉 Level ${lvl} Complete! 🚀
    </div>
    <div class="score-display">
      🏆 Total Score: <strong>${state.score}</strong>
    </div>
  `;

  // Hide buttons & message box
  document.getElementById('skipBtn').style.display = 'none';
  document.getElementById('submitTextBtn').style.display = 'none';
  document.getElementById('msgBox').style.display = 'none';

  // Show NEXT button
  document.getElementById('nextBtn').style.display = 'inline-block';
  document.getElementById('nextBtn').onclick = ()=> {
    document.getElementById('skipBtn').style.display = 'inline-block';
    document.getElementById('submitTextBtn').style.display = 'inline-block';
    document.getElementById('msgBox').style.display = 'block';
    document.getElementById('msgBox').innerHTML = "";
    document.getElementById('msgBox').className = "";

    if(state.level >= 8){
      finishGame();
    } else {
      state.level++;
      startLevel(state.level);
    }
  };

  stopTimer();
}



function startLevel(lvl){
  state.level = lvl;
  state.qIndex = 0;
  state.currentQuestions = getQuestionsForLevel(lvl);
  state.totalInLevel = state.currentQuestions.length;

  // update title
  document.getElementById('lvlTitle').textContent = "Level " + lvl;

  document.getElementById('currentLevel').textContent = lvl;
  document.getElementById('qTotal').textContent = state.totalInLevel;

  renderCurrentQuestion();
}

function startGame(){
  state.score = 0;
  state.level = 1;
  state.qIndex = 0;
  state.currentQuestions = getQuestionsForLevel(1);
  state.totalInLevel = state.currentQuestions.length;

  document.getElementById('lvlTitle').textContent = "Level 1";

  showGame();
  renderCurrentQuestion();
}

function finishGame(){
  stopTimer();
  window.location.href = "Congrats.html";
}


function downloadJSON(){
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(questions, null, 2));
  const dl = document.createElement('a');
  dl.setAttribute('href', dataStr);
  dl.setAttribute('download', 'cyberexpect_questions.json');
  dl.click();
}

document.addEventListener('DOMContentLoaded', ()=> {
  fetchQuestions().then(()=>{
    document.getElementById('startBtn').onclick = ()=> {
      if(!questions || questions.length === 0){ alert('No questions loaded. See console for details.'); return; }
      startGame();
    };
    // if you removed the download button from HTML, this line can be safely removed
    const dlBtn = document.getElementById('downloadJSON');
    if(dlBtn) dlBtn.onclick = downloadJSON;

    const restartBtn = document.getElementById('restartBtn');
    if(restartBtn) restartBtn.onclick = ()=> { document.getElementById('end-panel').style.display='none'; showWelcome(); };

    showWelcome();
  });
});
