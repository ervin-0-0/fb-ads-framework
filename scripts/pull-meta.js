#!/usr/bin/env node
/**
 * 從 Meta Marketing API 拉廣告資料，存成 JSON 到 data/raw/。
 * 用法：node scripts/pull-meta.js
 * 需要：.env 裡的 META_ACCESS_TOKEN、META_AD_ACCOUNT_ID。
 *
 * 只讀資料，不會改任何廣告。改動由 /投放 流程經你確認後才做。
 */

const fs = require('fs');
const path = require('path');

// --- 讀 .env（不依賴外部套件）---
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    console.error('❌ 找不到 .env，先複製：cp .env.example .env 並填入 token');
    process.exit(1);
  }
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}
loadEnv();

const TOKEN = process.env.META_ACCESS_TOKEN;
const ACCOUNT = process.env.META_AD_ACCOUNT_ID;
const VERSION = process.env.META_API_VERSION || 'v23.0';
const DATE_PRESET = process.env.META_DATE_PRESET || 'last_30d';

if (!TOKEN || !ACCOUNT) {
  console.error('❌ .env 裡 META_ACCESS_TOKEN 或 META_AD_ACCOUNT_ID 沒填');
  process.exit(1);
}

const BASE = `https://graph.facebook.com/${VERSION}`;

// 自動翻頁抓完所有資料
async function fetchAll(url) {
  let out = [];
  let next = url;
  while (next) {
    const res = await fetch(next);
    const json = await res.json();
    if (json.error) {
      console.error('❌ API 錯誤：', JSON.stringify(json.error, null, 2));
      process.exit(1);
    }
    out = out.concat(json.data || []);
    next = json.paging && json.paging.next ? json.paging.next : null;
  }
  return out;
}

async function main() {
  console.log(`📡 帳戶 ${ACCOUNT}，期間 ${DATE_PRESET}，API ${VERSION}`);

  // 1) 廣告層級成效（最細，分析主力）
  const insightFields = [
    'campaign_name', 'adset_name', 'ad_name',
    'spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm', 'reach', 'frequency',
    'actions', 'action_values', 'cost_per_action_type', 'purchase_roas',
  ].join(',');
  const insightsUrl =
    `${BASE}/${ACCOUNT}/insights?level=ad&date_preset=${DATE_PRESET}` +
    `&fields=${insightFields}&limit=200&access_token=${TOKEN}`;
  console.log('  ↳ 拉廣告成效…');
  const insights = await fetchAll(insightsUrl);

  // 2) 廣告組設定 + 學習狀態（看疲勞 / 學習期 / 預算）
  const adsetFields = [
    'name', 'status', 'effective_status', 'daily_budget', 'lifetime_budget',
    'optimization_goal', 'bid_strategy', 'learning_stage_info', 'targeting',
  ].join(',');
  const adsetsUrl =
    `${BASE}/${ACCOUNT}/adsets?fields=${adsetFields}&limit=200&access_token=${TOKEN}`;
  console.log('  ↳ 拉廣告組設定…');
  const adsets = await fetchAll(adsetsUrl);

  // 3) 帳戶基本資訊
  const acctUrl =
    `${BASE}/${ACCOUNT}?fields=name,currency,timezone_name,amount_spent,balance` +
    `&access_token=${TOKEN}`;
  const acctRes = await fetch(acctUrl);
  const account = await acctRes.json();

  // 存檔（用本地日期當檔名）
  const today = new Date().toISOString().slice(0, 10);
  const outPath = path.join(__dirname, '..', 'data', 'raw', `meta-${today}.json`);
  const payload = {
    pulled_at: new Date().toISOString(),
    date_preset: DATE_PRESET,
    account,
    adsets,
    insights,
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(`✅ 已存：data/raw/meta-${today}.json`);
  console.log(`   廣告 ${insights.length} 筆、廣告組 ${adsets.length} 筆`);
}

main().catch((e) => { console.error(e); process.exit(1); });
