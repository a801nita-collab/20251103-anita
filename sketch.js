// p5.js 測驗系統
// 功能：產生/下載題庫 CSV、載入題庫、亂數抽 4 題、作答計分、顯示回饋與互動視覺效果

let questions = []; // {q, choices:[..], answer}
let quiz = []; // 本次抽出的 4 題
let current = 0;
let userAnswers = [];

// DOM elements
let container, titleP, startBtn, downloadBtn, fileInput, generateBtn, infoP;
let choicesRadio; // p5.Element for radio
let nextBtn;

// visuals
let particles = [];
let showResultsFlag = false;
let fireworks = []; // 專門放煙火物件
let score = 0;
let resultAnimationType = 'none'; // 'none', 'good', 'bad'

function setup() {
	let cnv = createCanvas(windowWidth, windowHeight);
	cnv.style('display', 'block');

		// 初始啟動畫面：只顯示置中的「開始測驗」按鈕
		let startScreen = createDiv().id('startScreen').style('position','absolute').style('left','50%').style('top','50%').style('transform','translate(-50%,-50%)').style('z-index','9999');
		startBtn = createButton('開始測驗').parent(startScreen).mousePressed(startQuiz).style('font-size','20px').style('padding','12px 20px');

		// container for controls (hidden at first)
		container = createDiv().id('ui').style('position', 'absolute').style('left', '20px').style('top', '20px').style('z-index', '10');
		container.hide();

		titleP = createP('互動式測驗（每次抽 4 題）').parent(container).style('font-size', '20px').style('margin', '0 0 8px 0');

		// buttons (放在 container，初始為隱藏)
		nextBtn = createButton('下一題 / 送出').parent(container).mousePressed(nextQuestion).attribute('disabled', true);
		nextBtn.style('margin-right','6px');

		downloadBtn = createButton('下載範例題庫 CSV').parent(container).mousePressed(downloadSampleCSV);
		downloadBtn.style('margin-right','6px');

		generateBtn = createButton('產生範例題庫並載入').parent(container).mousePressed(()=>{
			loadSampleQuestions();
			infoP.html('已載入範例題庫，可按「開始測驗」。');
		});
		generateBtn.style('margin-right','6px');

		fileInput = createFileInput(handleFile).parent(container);
		fileInput.attribute('accept','text/csv');

		infoP = createP('請上傳 CSV 或載入範例題庫。CSV 欄位：question,optionA,optionB,optionC,optionD,answer(如 A)').parent(container).style('max-width','340px');

	// 初始化範例題庫（不自動啟動）
	questions = [];

	// particle seed
	for (let i=0;i<30;i++) particles.push(new Particle(random(width), random(height)));
}

function windowResized(){
	resizeCanvas(windowWidth, windowHeight);
}

function draw() {
	// 背景動態
	background(20, 24, 30);

	// 浮動粒子作為背景
	for (let p of particles) {
		p.update();
		p.draw();
	}

	// 煙火動畫
	for (let i = fireworks.length - 1; i >= 0; i--) {
		fireworks[i].update();
		fireworks[i].draw();
		if (fireworks[i].done()) fireworks.splice(i, 1);
	}

	// 顯示題目計數
	if (quiz.length > 0 && current < quiz.length && !showResultsFlag) {
		push();
		fill(255);
		textSize(18);
		textAlign(CENTER, TOP);
		text('題目 ' + (current+1) + ' / ' + quiz.length, width/2, 60);

		// question text displayed in DOM; highlight canvas background slightly
		pop();
	}

	// 顯示結果特效
	if (showResultsFlag) {
		if (resultAnimationType === 'perfect') {
			// 滿分：煙火
			if (frameCount % 20 === 0) fireworks.push(new Firework());
		} else if (resultAnimationType === 'good') {
			// 成績好：五彩紙屑
			for (let i=0;i<6;i++) {
				particles.push(new Particle(random(width), -10, 'confetti'));
			}
		} else if (resultAnimationType === 'bad') {
			// 成績不好：下雨
			for (let i=0;i<3;i++) {
				particles.push(new Particle(random(width), -10, 'rain'));
			}
		}
	}
}

// ---------- UI / Quiz logic ----------
function startQuiz(){
	// 清理上一場測驗的視覺效果與面板（確保重新開始時不會繼續 confetti/flash）
	selectAll('.qblock').forEach(e => e.remove());
	let fl = select('#flash');
	if (fl) fl.remove();
	showResultsFlag = false;
	fireworks = [];
	resultAnimationType = 'none';
	// 重置背景粒子為初始狀態，避免上一場的 confetti 留下
	particles = [];
	for (let i=0;i<30;i++) particles.push(new Particle(random(width), random(height)));

		// 移除啟動畫面（如果存在）並隱藏其他控制元件
		let ss = select('#startScreen');
		if (ss) ss.remove();
		if (container) container.hide();

	// 如果題庫不足，先嘗試自動載入專案根目錄的 sample_questions.csv
	const begin = ()=>{
		// 隨機抽取 4 題（不重複）
		let idxs = [];
		while (idxs.length < 4) {
			let r = floor(random(questions.length));
			if (!idxs.includes(r)) idxs.push(r);
		}
		quiz = idxs.map(i => questions[i]);
		current = 0;
		userAnswers = Array(quiz.length).fill(null);
		showResultsFlag = false;
		score = 0;

		infoP.html('已抽題，請回答。');
		nextBtn.removeAttribute('disabled');

		showQuestion();
	};

	if (questions.length < 4){
		infoP.html('題庫少於 4 題，嘗試載入範例題庫...');
		// 先嘗試 fetch 專案根目錄的 sample_questions.csv
		fetch('sample_questions.csv').then(r=>{
			if (!r.ok) throw new Error('no local sample');
			return r.text();
		}).then(txt=>{
			parseCSV(txt);
			if (questions.length < 4){
				// 若仍不足，使用內建 sample
				loadSampleQuestions();
			}
			begin();
		}).catch(err=>{
			// fetch 失敗（例如 file:// 環境限制），退回內建 sample
			loadSampleQuestions();
			begin();
		});
	} else {
		begin();
	}
}

function showQuestion(){
	// 移除先前的題目 DOM
	selectAll('.qblock').forEach(e => e.remove());

	let q = quiz[current];
		let qDiv = createDiv().class('qblock').style('position','absolute').style('left','50%').style('transform','translateX(-50%)').style('top','120px').style('width','720px').style('max-width','90%').style('background','rgba(255,255,255,0.04)').style('padding','18px').style('border-radius','8px').style('z-index','9999');

	createP((current+1)+'. '+q.q).parent(qDiv).style('font-size','18px').style('color','#fff');

	// choices as radio
	choicesRadio = createDiv().parent(qDiv);
	let letters = ['A','B','C','D'];
	for (let i=0;i<q.choices.length;i++){
		let ch = createDiv().parent(choicesRadio).style('padding','6px 10px').style('cursor','pointer').style('border-radius','6px').style('margin','6px 0').style('background','rgba(255,255,255,0.02)');
			ch.mousePressed(()=>{
				// 設定答案
				userAnswers[current] = letters[i];
				// 視覺回饋：標示選取
				choicesRadio.elt.querySelectorAll('div').forEach((d,di)=> d.style.background = di==i ? 'rgba(70,130,180,0.25)' : '');

				// 立即進入下一題（短暫延遲讓使用者看到選取效果）
				setTimeout(()=>{
					if (current < quiz.length - 1){
						current++;
						showQuestion();
						infoP.html('回答第 ' + (current+1) + ' 題');
					} else {
						submitQuiz();
					}
				}, 300);
			});
		createSpan(letters[i]+'. ').parent(ch).style('color','#fff').style('font-weight','700');
		createSpan(q.choices[i]).parent(ch).style('color','#fff');
	}

	// 若已答過，預設選取
	if (userAnswers[current]){
		let sel = ['A','B','C','D'].indexOf(userAnswers[current]);
		if (sel >=0) choicesRadio.elt.querySelectorAll('div')[sel].style.background = 'rgba(70,130,180,0.25)';
	}
}

function nextQuestion(){
	// 檢查是否有選擇
	if (!userAnswers[current]){
		infoP.html('請先選擇一個答案再繼續。');
		return;
	}

	// 如果不是最後一題，下一題
	if (current < quiz.length -1){
		current++;
		showQuestion();
		infoP.html('回答第 ' + (current+1) + ' 題');
	} else {
		// 提交並顯示結果
		submitQuiz();
	}
}

function submitQuiz(){
	// 計分
	score = 0;
	for (let i=0;i<quiz.length;i++){
		if (userAnswers[i] && userAnswers[i].toUpperCase() === quiz[i].answer.toUpperCase()) score++;
	}

	showResultsFlag = true;
	nextBtn.attribute('disabled','');
	selectAll('.qblock').forEach(e => e.remove());

	// 顯示成績
	let percent = round((score/quiz.length)*100);
	let msg = '';
	if (percent >= 75) msg = '表現優異，繼續保持！';
	else if (percent >= 50) msg = '表現尚可，還有進步空間。';
	else msg = '需要加強，建議再複習題庫。';

		let resDiv = createDiv().class('qblock').style('position','absolute').style('left','50%').style('transform','translateX(-50%)').style('top','120px').style('width','720px').style('max-width','90%').style('background','rgba(0,0,0,0.6)').style('padding','18px').style('border-radius','8px').style('z-index','9999');
	createP('測驗結果').parent(resDiv).style('font-size','22px').style('color','#fff');
	createP('得分：' + score + ' / ' + quiz.length + ' (' + percent + '%)').parent(resDiv).style('color','#fff');
	createP(msg).parent(resDiv).style('color','#fff');

	// 顯示每題正確與使用者答案
	for (let i=0;i<quiz.length;i++){
		let item = createDiv().parent(resDiv).style('padding','6px').style('border-top','1px solid rgba(255,255,255,0.04)').style('color','#fff');
		let correct = quiz[i].answer.toUpperCase();
		item.html((i+1)+'. ' + quiz[i].q + '<br>你的答案：' + (userAnswers[i]||'未作答') + '  正確：' + correct);
	}

	// 依成績決定視覺（綠色或紅色）
	if (percent === 100) {
		resultAnimationType = 'perfect';
		flashBackground(color(20,120,60)); // 滿分也是綠色背景
	} else if (percent >= 75) {
		resultAnimationType = 'good';
		flashBackground(color(20,120,60));
	} else {
		resultAnimationType = 'bad';
		flashBackground(color(120,20,30));
	}

	// 新增「再次測驗」按鈕
	createButton('再次測驗').parent(resDiv).mousePressed(startQuiz).style('font-size','16px').style('padding','8px 16px').style('margin-top','16px');

	infoP.html('測驗完成。可再次按「開始測驗」重抽題目或上傳新的題庫。');
}

// 快速背景閃光
function flashBackground(col){
	let start = millis();
	let dur = 800;
	let orig = get();
	// push a short-lived animation via particles and overlay
	let overlay = createDiv().id('flash').style('position','absolute').style('left','0').style('top','0').style('width','100%').style('height','100%').style('pointer-events','none');
	overlay.style('background', 'rgba('+red(col)+','+green(col)+','+blue(col)+',0.28)');
	setTimeout(()=>{ overlay.remove(); }, dur);
}

// ---------- CSV helpers ----------
function downloadSampleCSV(){
	let sample = sampleCSV();
	let csv = sample.join('\n');
	let a = createA('data:text/csv;charset=utf-8,' + encodeURIComponent(csv), 'download', '_blank');
	a.attribute('download','sample_questions.csv');
	a.elt.click();
	a.remove();
}

function sampleCSV(){
	// header optional - we won't include header to keep parsing simple
	let arr = [];
	arr.push('在 HTML 中用來顯示段落的標籤是什麼?,p,div,span,section,A');
	arr.push('地球繞行的是什麼?,月亮,太陽,恆星,行星,B');
	arr.push('水的沸點（攝氏）大約是？,50,100,0,37,B');
	arr.push('2+3*4 等於多少？,20,14,10,12,B');
	arr.push('電腦中二進位的位元是？,bit,byte,pixel,node,A');
	return arr;
}

function handleFile(file){
	if (!file) return;
	if (file.type === 'text' || file.type === 'text/csv' || file.name.endsWith('.csv')){
		let txt = file.data;
		parseCSV(txt);
		infoP.html('已載入上傳的題庫，共 ' + questions.length + ' 題。');
	} else {
		infoP.html('只能上傳 CSV 文字檔。');
	}
}

function parseCSV(txt){
	let lines = txt.replace(/\r/g,'').split('\n').map(l=>l.trim()).filter(l=>l.length>0);
	let parsed = [];
	for (let ln of lines){
		// 支援用逗號分隔，最後一欄為答案
		let parts = ln.split(',');
		if (parts.length < 6) continue;
		let q = parts[0];
		let choices = parts.slice(1,5);
		let answer = parts[5].trim();
		parsed.push({q, choices, answer});
	}
	questions = parsed;
}

function loadSampleQuestions(){
	let lines = sampleCSV();
	parseCSV(lines.join('\n'));
}

// ---------- Particle class for background / confetti ----------
class Particle{
	constructor(x,y, type='default'){ // type: 'default', 'confetti', 'rain'
		this.pos = createVector(x,y);
		this.type = type;

		// 煙火專用屬性
		if (this.type === 'firework_spark') {
			this.lifespan = 255;
			this.col = color(random(100,255), random(100,255), random(100,255));
			this.size = random(6, 12); // 再次放大火花粒子
		}

		if (this.type === 'rain') {
			this.vel = createVector(0, random(2, 4)); // 速度減半
			this.size = random(1, 3);
			this.col = color(150, 180, 220, 150); // 藍灰色
		} else if (this.type === 'confetti') {
			this.vel = createVector(random(-0.5,0.5), random(1,3)); // 速度減半
			this.size = random(6,12);
			this.col = color(random(100,255), random(100,255), random(100,255));
		} else { // default background particle
			this.vel = createVector(random(-0.5,0.5), random(-0.3,0.3)); // 速度減半
			this.size = random(2,6);
			this.col = color(random(100,255), random(100,255), random(100,255), 50);
		}
	}
	update(){
		this.pos.add(this.vel);

		if (this.type === 'firework_spark') {
			this.vel.mult(0.95); // 摩擦力
			this.vel.y += 0.04; // 重力
			this.lifespan -= 4;
		} else if (this.type === 'rain') {
			this.vel.y += 0.05; // 加速度減半
		} else if (this.type === 'confetti') {
			this.vel.y += 0.025; // 加速度減半
		} else {
			this.vel.y += 0.01; // 加速度減半
		}

		if (this.pos.y > height + 50){
			this.pos.y = random(-50, -10);
			this.pos.x = random(width);
		}
	}
	draw(){
		noStroke();
		if (this.type === 'firework_spark') {
			fill(this.col.levels[0], this.col.levels[1], this.col.levels[2], this.lifespan);
		} else {
			fill(this.col);
		}

		if (this.type === 'rain') {
			// 畫成長條形模仿雨滴
			rect(this.pos.x, this.pos.y, this.size / 2, this.size * 4);
		} else {
			circle(this.pos.x, this.pos.y, this.size);
		}
	}
	isDead(){
		return this.lifespan < 0;
	}
}

// ---------- Firework class for 100% score ----------
class Firework {
	constructor(){
		// 發射點在底部中央
		this.rocket = new Particle(random(width), height, 'default'); // 從底部任何位置發射
		this.rocket.vel = createVector(0, random(-12, -6)); // 增加發射速度範圍，讓爆炸高度更多樣
		this.rocket.col = color(255,255,0, 200);
		this.rocket.size = 4;
		this.exploded = false;
		this.sparks = [];
	}

	update(){
		if (!this.exploded) {
			this.rocket.pos.add(this.rocket.vel);
			this.rocket.vel.y += 0.1; // 重力減速

			// 到達頂點時爆炸
			if (this.rocket.vel.y >= 0) {
				this.exploded = true;
				let sparkCount = random(50, 80);
				for (let i=0; i<sparkCount; i++) {
					let spark = new Particle(this.rocket.pos.x, this.rocket.pos.y, 'firework_spark');
					spark.vel = p5.Vector.random2D().mult(random(3, 12)); // 再次放大爆炸範圍
					this.sparks.push(spark);
				}
			}
		} else {
			for (let i = this.sparks.length - 1; i >= 0; i--) {
				this.sparks[i].update();
				if (this.sparks[i].isDead()) this.sparks.splice(i, 1);
			}
		}
	}

	draw(){
		if (!this.exploded) {
			this.rocket.draw();
		} else {
			for (let s of this.sparks) s.draw();
		}
	}

	done(){
		return this.exploded && this.sparks.length === 0;
	}
}

// 畫面結束前清理
function keyPressed(){
	// 快速清除 UI: 按 R 重新載入頁面
	if (key === 'r' || key === 'R') location.reload();
}
