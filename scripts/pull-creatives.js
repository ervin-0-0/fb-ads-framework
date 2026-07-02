#!/usr/bin/env node
/**
 * 拉近一年「廣告素材」+「廣告成效」分兩次，合併找出可重用勝利素材。
 * 用法：node scripts/pull-creatives.js  ｜ 只讀資料，購買口徑單一 purchase。
 */
const fs = require('fs');
const path = require('path');
function loadEnv() {
  const p = path.join(__dirname, '..', '.env');
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}
loadEnv();
const TOKEN = process.env.META_ACCESS_TOKEN;
const ACCOUNT = process.env.META_AD_ACCOUNT_ID;
const VERSION = process.env.META_API_VERSION || 'v23.0';
const BASE = `https://graph.facebook.com/${VERSION}`;

async function fetchAll(url) {
  let out = [], next = url;
  while (next) {
    const res = await fetch(next);
    const j = await res.json();
    if (j.error) { console.error('❌', JSON.stringify(j.error)); process.exit(1); }
    out = out.concat(j.data || []);
    next = j.paging && j.paging.next ? j.paging.next : null;
  }
  return out;
}

async function main() {
  console.log('📡 (1/2) 近一年廣告成效（ad 層）…');
  const insights = await fetchAll(
    `${BASE}/${ACCOUNT}/insights?level=ad&date_preset=last_year` +
    `&fields=ad_id,ad_name,spend,impressions,clicks,ctr,actions,action_values` +
    `&limit=500&access_token=${TOKEN}`);

  // 只抓有花費的廣告 id，避免拉一堆沒用的素材
  const ids = [...new Set(insights.filter(r => parseFloat(r.spend || 0) > 0).map(r => r.ad_id))];
  console.log(`   有花費廣告 ${ids.length} 個，拉它們的素材…`);

  console.log('📡 (2/2) 素材內容…');
  const creatives = [];
  const cfields = 'id,name,creative{thumbnail_url,video_id,image_url,body,title,object_type}';
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const url = `${BASE}/?ids=${batch.join(',')}&fields=${encodeURIComponent(cfields)}&access_token=${TOKEN}`;
    const res = await fetch(url);
    const j = await res.json();
    if (j.error) { console.error('❌', JSON.stringify(j.error)); process.exit(1); }
    for (const id of Object.keys(j)) creatives.push(j[id]);
  }

  const today = new Date().toISOString().slice(0, 10);
  const out = path.join(__dirname, '..', 'data', 'raw', `meta-creatives-${today}.json`);
  fs.writeFileSync(out, JSON.stringify({ pulled_at: new Date().toISOString(), insights, creatives }, null, 2));
  console.log(`✅ 已存：data/raw/meta-creatives-${today}.json`);
  console.log(`   成效列 ${insights.length}、素材 ${creatives.length}`);
}
main().catch(e => { console.error(e); process.exit(1); });
