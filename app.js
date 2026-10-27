// ================== 1. 数据存储 ==================
// 和健身打卡一样存在手机的 localStorage 里，用不同的名字，两个 app 互不影响
// 格式：{ goals: {...}, custom: [自己加的食物], days: { "2026-10-27": [ 一条条记录 ] } }
const STORE_KEY = 'foodlog-v1';
const MEALS = ['早餐', '午餐', '晚餐', '加餐'];

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (saved && saved.days) return saved;
  } catch (e) { /* 数据损坏或读不到时，用空数据 */ }
  return { goals: { kcal: 2000, p: 90, f: 60, c: 250 }, custom: [], days: {} };
}

function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
}

let data = load();

// ================== 2. 日期小工具（和健身打卡相同） ==================
function dateKey(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const todayKey = () => dateKey(new Date());

// ================== 3. 食物列表 ==================
// 把内置表和自己加的食物合成一个列表，每个食物有唯一的 key
function allFoods() {
  const list = [];
  for (const c of data.custom) {
    list.push({ key: 'c:' + c.name, group: '我加的', ...c });
  }
  for (const g of FOOD_GROUPS) {
    for (const [name, kcal, p, f, c, unit, unitG] of g.items) {
      list.push({ key: 'b:' + name, group: g.group, name, kcal, p, f, c, unit, unitG });
    }
  }
  return list;
}

const findFood = (key) => allFoods().find((f) => f.key === key);

// 用 <optgroup> 分组，iPhone 上会弹出滚轮选择，比打字搜索更方便
function renderFoodSelect() {
  const sel = $('food');
  const keep = sel.value;
  sel.innerHTML = '<option value="">请选择…</option>';
  let group = null, og = null;
  for (const f of allFoods()) {
    if (f.group !== group) {
      group = f.group;
      og = document.createElement('optgroup');
      og.label = group;
      sel.appendChild(og);
    }
    const o = document.createElement('option');
    o.value = f.key;
    o.textContent = f.name;
    og.appendChild(o);
  }
  sel.value = findFood(keep) ? keep : '';
}

// ================== 4. 页面状态 ==================
let viewKey = todayKey();   // 正在看哪一天
let meal = defaultMeal();   // 选中的餐次

function defaultMeal() {
  const h = new Date().getHours();
  if (h < 10) return '早餐';
  if (h < 14) return '午餐';
  if (h < 17) return '加餐';
  if (h < 21) return '晚餐';
  return '加餐';
}

const $ = (id) => document.getElementById(id);
const round1 = (n) => Math.round(n * 10) / 10;

// 按克数算出这一份的热量和营养素
function calc(food, grams) {
  const k = grams / 100;
  return {
    kcal: Math.round(food.kcal * k),
    p: round1(food.p * k),
    f: round1(food.f * k),
    c: round1(food.c * k),
  };
}

// ================== 5. 日期切换 ==================
function renderDayNav() {
  const today = todayKey();
  const yesterday = dateKey(addDays(new Date(), -1));
  const d = parseKey(viewKey);
  const week = '日一二三四五六'[d.getDay()];
  let title = `${d.getMonth() + 1}月${d.getDate()}日 周${week}`;
  if (viewKey === today) title = '今天';
  else if (viewKey === yesterday) title = '昨天';
  $('dayTitle').textContent = title;
  $('listTitle').textContent = `${title === '今天' || title === '昨天' ? title : '这天'}吃了`;
  $('nextDay').disabled = viewKey >= today; // 不能翻到未来
}

$('prevDay').onclick = () => { viewKey = dateKey(addDays(parseKey(viewKey), -1)); renderAll(); };
$('nextDay').onclick = () => { viewKey = dateKey(addDays(parseKey(viewKey), 1)); renderAll(); };

// ================== 6. 当天汇总 ==================
function totals(entries) {
  const t = { kcal: 0, p: 0, f: 0, c: 0 };
  for (const e of entries) {
    t.kcal += e.kcal; t.p += e.p; t.f += e.f; t.c += e.c;
  }
  return t;
}

function setBar(el, value, goal, color) {
  const over = value > goal;
  el.style.width = Math.min(100, goal ? (value / goal) * 100 : 0) + '%';
  el.classList.toggle('over', over);
  if (color && !over) el.style.background = color;
  else el.style.background = '';
}

function renderSummary() {
  const g = data.goals;
  const t = totals(data.days[viewKey] || []);

  $('kcalNum').textContent = Math.round(t.kcal);
  $('kcalGoal').textContent = g.kcal;
  $('kcalNum').parentElement.classList.toggle('over', t.kcal > g.kcal);
  setBar($('kcalBar'), t.kcal, g.kcal);
  const left = g.kcal - Math.round(t.kcal);
  $('kcalLeft').textContent = left >= 0 ? `还可以吃 ${left} 千卡` : `超出目标 ${-left} 千卡`;

  const rows = [
    ['蛋白质', t.p, g.p, 'var(--cinnamon)'],
    ['脂肪', t.f, g.f, 'var(--butter)'],
    ['碳水', t.c, g.c, 'var(--latte)'],
  ];
  const box = $('macros');
  box.innerHTML = '';
  for (const [label, value, goal, color] of rows) {
    const row = document.createElement('div');
    row.innerHTML = `
      <div class="macro-head"><b>${label}</b><span>${Math.round(value)} / ${goal} 克</span></div>
      <div class="bar"><div class="bar-fill"></div></div>`;
    box.appendChild(row);
    setBar(row.querySelector('.bar-fill'), value, goal, color);
  }
}

// ================== 7. 记一笔 ==================
function renderMeals() {
  const box = $('meals');
  box.innerHTML = '';
  for (const m of MEALS) {
    const b = document.createElement('button');
    b.textContent = m;
    b.setAttribute('aria-pressed', m === meal);
    b.onclick = () => { meal = m; renderMeals(); };
    box.appendChild(b);
  }
}

// 选了食物后：显示「+1 碗」这类快捷按钮，并预览这一份的热量
function renderQuick() {
  const food = findFood($('food').value);
  const box = $('quick');
  box.innerHTML = '';
  if (food && food.unit) {
    const b = document.createElement('button');
    b.textContent = `+1 ${food.unit}（${food.unitG}克）`;
    b.onclick = () => {
      const now = parseFloat($('grams').value) || 0;
      $('grams').value = now + food.unitG;
      renderPreview();
    };
    box.appendChild(b);
  }
  renderPreview();
}

function renderPreview() {
  const food = findFood($('food').value);
  const grams = parseFloat($('grams').value);
  if (!food || !(grams > 0)) {
    $('preview').textContent = '';
    return;
  }
  const r = calc(food, grams);
  $('preview').innerHTML = `约 <b>${r.kcal}</b> 千卡 · 蛋白质 ${r.p} · 脂肪 ${r.f} · 碳水 ${r.c} 克`;
}

$('food').onchange = () => { $('grams').value = ''; $('hint').textContent = ''; renderQuick(); };
$('grams').oninput = renderPreview;

$('addBtn').onclick = () => {
  const food = findFood($('food').value);
  const grams = parseFloat($('grams').value);
  if (!food) { $('hint').textContent = '先选一个食物'; return; }
  if (!(grams > 0)) { $('hint').textContent = '填一下吃了多少克'; return; }

  // 把算好的数字直接存进记录，以后改了食物表也不会影响过去的记录
  const entry = { meal, name: food.name, grams, ...calc(food, grams) };
  (data.days[viewKey] ||= []).push(entry);
  save();

  $('food').value = '';
  $('grams').value = '';
  renderQuick();
  renderAll();
  $('hint').textContent = `已添加：${food.name} ${grams} 克`;
};

// ================== 8. 吃了什么（按餐次分组） ==================
function renderList() {
  const entries = data.days[viewKey] || [];
  const box = $('list');
  box.innerHTML = '';
  if (entries.length === 0) {
    box.innerHTML = '<p class="hint">还没有记录</p>';
    return;
  }
  for (const m of MEALS) {
    const items = entries.filter((e) => e.meal === m);
    if (items.length === 0) continue;

    const head = document.createElement('div');
    head.className = `meal-head m${MEALS.indexOf(m) + 1}`; // 每个餐次一个颜色
    head.innerHTML = `<span>${m}</span><span>${Math.round(totals(items).kcal)} 千卡</span>`;
    box.appendChild(head);

    for (const e of items) {
      const row = document.createElement('div');
      row.className = 'item';
      row.innerHTML = `
        <div class="item-name">${escapeHtml(e.name)}<small>${e.grams} 克 · 蛋白质 ${e.p} 克</small></div>
        <div class="item-kcal">${e.kcal} 千卡</div>
        <button class="del" aria-label="删除">✕</button>`;
      row.querySelector('.del').onclick = () => {
        if (!confirm(`删除「${e.name}」这条记录吗？`)) return;
        data.days[viewKey].splice(data.days[viewKey].indexOf(e), 1);
        save();
        renderAll();
      };
      box.appendChild(row);
    }
  }
}

// 自己输入的名字显示到页面前先转义，防止特殊符号把页面弄乱
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// ================== 9. 自己添加食物 ==================
function renderCustomList() {
  const box = $('customList');
  box.innerHTML = '';
  for (const c of data.custom) {
    const row = document.createElement('div');
    row.className = 'item';
    row.innerHTML = `
      <div class="item-name">${escapeHtml(c.name)}<small>每100克 ${c.kcal} 千卡 · 蛋白质 ${c.p} · 脂肪 ${c.f} · 碳水 ${c.c}</small></div>
      <button class="del" aria-label="删除">✕</button>`;
    row.querySelector('.del').onclick = () => {
      if (!confirm(`从列表里删掉「${c.name}」吗？已经记过的不受影响。`)) return;
      data.custom = data.custom.filter((x) => x !== c);
      save();
      renderFoodSelect();
      renderCustomList();
    };
    box.appendChild(row);
  }
}

$('cSave').onclick = () => {
  const name = $('cName').value.trim();
  const num = (id) => parseFloat($(id).value) || 0;
  let kcal = num('cKcal');
  if (!name) { $('cHint').textContent = '填一下名称'; return; }
  if (!(kcal > 0)) { $('cHint').textContent = '填一下能量'; return; }
  // 国内包装大多写「千焦」，1 千卡 ≈ 4.184 千焦
  if ($('cEnergyUnit').value === 'kj') kcal = kcal / 4.184;

  const food = { name, kcal: Math.round(kcal), p: num('cP'), f: num('cF'), c: num('cC'), unit: '', unitG: 0 };
  data.custom = data.custom.filter((x) => x.name !== name); // 同名就覆盖
  data.custom.unshift(food);
  save();

  for (const id of ['cName', 'cKcal', 'cP', 'cF', 'cC']) $(id).value = '';
  renderFoodSelect();
  renderCustomList();
  $('cHint').textContent = `已保存「${name}」，在「我加的」里可以选到`;
};

// ================== 10. 每日目标 ==================
function fillGoals() {
  $('gKcal').value = data.goals.kcal;
  $('gP').value = data.goals.p;
  $('gF').value = data.goals.f;
  $('gC').value = data.goals.c;
}

$('gSave').onclick = () => {
  const num = (id, old) => { const v = parseInt($(id).value, 10); return v > 0 ? v : old; };
  const g = data.goals;
  data.goals = { kcal: num('gKcal', g.kcal), p: num('gP', g.p), f: num('gF', g.f), c: num('gC', g.c) };
  save();
  fillGoals();
  renderSummary();
  $('gHint').textContent = '目标已保存';
};

// ================== 11. 启动 ==================
function renderAll() {
  renderDayNav();
  renderSummary();
  renderList();
}

renderFoodSelect();
renderMeals();
renderQuick();
renderCustomList();
fillGoals();
renderAll();

// 从后台切回来时，如果已经过了零点，自动跳到新的「今天」
let lastToday = todayKey();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const now = todayKey();
  if (now !== lastToday && viewKey === lastToday) viewKey = now;
  lastToday = now;
  renderAll();
});

// 离线缓存
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
