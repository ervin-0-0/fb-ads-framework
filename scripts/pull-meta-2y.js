#!/usr/bin/env node
/**
 * 拉過去 2 年的 Meta 廣告資料：帳戶月趨勢 + 行銷活動彙總。
 * 用法：node scripts/pull-meta-2y.js
 * 只讀資料，不改任何廣告。購買口徑只用單一 action_type=purchase。
 */
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) { console.error('❌ 找不到 .env'); process.exit(1); }
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}
loadEnv();

const TOKEN = process.env.META_ACCESS_TOKEN;
const ACCOUNT = process.env.META_AD_ACCOUNT_ID;
const VERSION = process.env.META_API_VERSION || 'v23.0';
if (!TOKEN || !ACCOUNT) { console.error('❌ .env 缺 token 或帳戶'); process.exit(1); }
const BASE = `https://graph.facebook.com/${VERSION}`;

const until = new Date().toISOString().slice(0, 10);
const sinceD = new Date(); sinceD.setFullYear(sinceD.getFullYear() - 2);
const since = sinceD.toISOString().slice(0, 10);
const RANGE = encodeURIComponent(JSON.stringify({ since, until }));

async function fetchAll(url) {
  let out = [], next = url;
  while (next) {
    const res = await fetch(next);
    const json = await res.json();
    if (json.error) { console.error('❌ API:', JSON.stringify(json.error)); process.exit(1); }
    out = out.concat(json.data || []);
    next = json.paging && json.paging.next ? json.paging.next : null;
  }
  return out;
}

const FIELDS = 'spend,impressions,clicks,ctr,cpm,actions,action_values';

async function main() {
  console.log(`📡 ${ACCOUNT} | 期間 ${since} ~ ${until}`);

  console.log('  ↳ 帳戶月趨勢…');
  const monthly = await fetchAll(
    `${BASE}/${ACCOUNT}/insights?time_increment=monthly&time_range=${RANGE}` +
    `&fields=${FIELDS}&limit=500&access_token=${TOKEN}`);

  console.log('  ↳ 行銷活動彙總…');
  const campaigns = await fetchAll(
    `${BASE}/${ACCOUNT}/insights?level=campaign&time_range=${RANGE}` +
    `&fields=campaign_name,${FIELDS}&limit=500&access_token=${TOKEN}`);

  const today = new Date().toISOString().slice(0, 10);
  const outPath = path.join(__dirname, '..', 'data', 'raw', `meta-2y-${today}.json`);
  fs.writeFileSync(outPath, JSON.stringify(
    { pulled_at: new Date().toISOString(), since, until, monthly, campaigns }, null, 2));
  console.log(`✅ 已存：data/raw/meta-2y-${today}.json`);
  console.log(`   月資料 ${monthly.length} 筆、行銷活動 ${campaigns.length} 筆`);
}
main().catch(e => { console.error(e); process.exit(1); });
