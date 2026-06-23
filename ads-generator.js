const GEN_AUDIENCES = [
  {
    label: '☕ 戒咖啡因族',
    desc: '每天喝咖啡但胃不好、睡不著，想找無咖啡因替代品，卻還沒找到讓自己甘願換的東西'
  },
  {
    label: '🌿 養生新手',
    desc: '知道要養生但覺得麻煩複雜，試過幾次沒堅持，想找一個簡單可以開始的方法'
  },
  {
    label: '✨ 儀式感生活',
    desc: '在意生活品質，為「讓日常更好」的東西買單，喜歡有故事、有質感的台灣在地品牌'
  },
  {
    label: '🏠 家庭健康守護者',
    desc: '想為全家（老人、孩子）選無咖啡因、零添加的健康飲品，讓全家都能放心喝'
  }
];

function initAdsGenerator({ containerId, gate, gateName, gateColor, angles }) {
  const el = document.getElementById(containerId);
  if (!el) return;

  el.innerHTML = `
    <div class="gen-grid">
      <div>
        <label class="gen-label">目標受眾</label>
        <select class="gen-select" id="gen-aud-${gate}">
          ${GEN_AUDIENCES.map((a, i) => `<option value="${i}">${a.label}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="gen-label">素材切角</label>
        <select class="gen-select" id="gen-ang-${gate}">
          ${angles.map(a => `<option value="${a.key}">${a.key} · ${a.label}</option>`).join('')}
        </select>
      </div>
    </div>
    <button class="gen-btn" id="gen-btn-${gate}" style="color:${gateColor}">
      <span>✨ 生成廣告文案草稿</span>
    </button>
    <div id="gen-out-${gate}" class="gen-out" style="display:none"></div>
  `;

  document.getElementById(`gen-btn-${gate}`).addEventListener('click', () =>
    runGenerator(gate, gateName, gateColor, angles)
  );
}

async function runGenerator(gate, gateName, gateColor, angles) {
  const audIdx = +document.getElementById(`gen-aud-${gate}`).value;
  const angKey = document.getElementById(`gen-ang-${gate}`).value;
  const audience = GEN_AUDIENCES[audIdx];
  const angle = angles.find(a => a.key === angKey);
  const btn = document.getElementById(`gen-btn-${gate}`);
  const out = document.getElementById(`gen-out-${gate}`);

  btn.disabled = true;
  btn.querySelector('span').textContent = '生成中…';
  out.style.display = 'block';
  out.innerHTML = `<div class="gen-loading"><div class="gen-spin"></div>AI 正在構思文案，請稍候…</div>`;

  const prompt = buildPrompt(gate, gateName, audience, angle);

  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.85, maxOutputTokens: 2048 }
      })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '（無回應，請再試一次）';
    out.innerHTML = renderOutput(text, gateColor, audience, angle);
  } catch (err) {
    out.innerHTML = `<div class="gen-error">⚠ ${err.message}</div>`;
  }

  btn.disabled = false;
  btn.querySelector('span').textContent = '✨ 重新生成';
}

function buildPrompt(gate, gateName, audience, angle) {
  return `你是耘初 YUN CHU 的廣告素材專家，擅長撰寫台灣繁體中文 Facebook 廣告文案。

【品牌】耘初 YUN CHU｜台灣在地養生茶飲品牌
【產品】無咖啡因穀物茶（黑豆、紅棗、枸杞、蕎麥）、花果茶、草本茶
【核心特色】60°低溫慢焙 × 台灣契作小農 × 零添加 × 無咖啡因
【品牌理念】把養生，過成日常的儀式。好好生活，從每天一杯開始。

===
廣告門：Gate · ${gateName}門
目標受眾：${audience.label}
受眾說明：${audience.desc}
素材切角：${angle.key} · ${angle.label}
${angle.desc ? `切角說明：${angle.desc}` : ''}
===

請生成一組完整的 Facebook 廣告文案草稿。
嚴格按照下列格式輸出，每個粗體標題單獨一行，內容直接寫在下一行，不要加說明括號：

**廣告標題**
25字以內的標題，直接切入受眾痛點或生活情境

**廣告正文**
80-120字正文，語氣像朋友說話，不要廣告腔，結構：情境代入→痛點共鳴→解決方案→品牌信任感

**行動呼籲**
5-8字的行動呼籲句

**素材格式**
靜態圖、短影片或輪播圖，選一種並說明原因

**視覺方向**
一句話具體描述畫面中要出現什麼人、什麼物件、什麼場景`;
}

function renderOutput(text, gateColor, audience, angle) {
  const SECTION_MAP = [
    { match: '廣告標題', label: '廣告標題', icon: '📌' },
    { match: '廣告正文', label: '廣告正文', icon: '📝' },
    { match: '行動呼籲', label: '行動呼籲 CTA', icon: '🎯' },
    { match: '素材格式', label: '推薦素材格式', icon: '🎬' },
    { match: '視覺方向', label: '視覺方向', icon: '🖼' },
  ];

  // Only lines whose **header** contains a known keyword are treated as section headers.
  // Lines starting with **bold** in body text (e.g. **穀物茶**) are kept as content.
  const lines = text.split('\n');
  const sections = [];
  let cur = null;
  lines.forEach(line => {
    const m = line.match(/^\*\*(.+?)\*\*/);
    const isKnownHeader = m && SECTION_MAP.some(def => m[1].includes(def.match));
    if (isKnownHeader) {
      if (cur) sections.push(cur);
      const sameLineRest = line.replace(/^\*\*.+?\*\*\s*/, '').trim();
      cur = { header: m[1].trim(), lines: sameLineRest ? [sameLineRest] : [] };
    } else if (cur) {
      cur.lines.push(line);
    }
  });
  if (cur) sections.push(cur);

  const matched = SECTION_MAP.map(def => {
    const sec = sections.find(s => s.header.includes(def.match));
    const content = sec ? sec.lines.join('\n').trim() : '';
    return { ...def, content };
  }).filter(s => s.content);

  let html = `<div class="gen-meta" style="--gc:${gateColor}">
    <span>${audience.label}</span>
    <span class="gen-x">×</span>
    <span>切角 ${angle.key} · ${angle.label}</span>
  </div><div class="gen-cards">`;

  if (matched.length) {
    matched.forEach((s, i) => {
      html += `<div class="gen-card" style="animation-delay:${i * 0.08}s">
        <div class="gen-card-top"><span>${s.icon}</span><span style="color:${gateColor}">${s.label}</span></div>
        <div class="gen-card-body">${s.content.replace(/\n/g, '<br>')}</div>
      </div>`;
    });
  } else {
    const fmt = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    html += `<div class="gen-card"><div class="gen-card-body">${fmt}</div></div>`;
  }

  html += `</div>
  <button class="gen-copy" onclick="genCopyAll(this)">複製全部文案 ↗</button>
  <div class="gen-raw">${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;

  return html;
}

window.genCopyAll = function (btn) {
  const raw = btn.nextElementSibling.textContent;
  const clean = raw.replace(/\*\*/g, '').trim();
  navigator.clipboard.writeText(clean).then(() => {
    btn.textContent = '已複製 ✓';
    setTimeout(() => { btn.textContent = '複製全部文案 ↗'; }, 2000);
  });
};
