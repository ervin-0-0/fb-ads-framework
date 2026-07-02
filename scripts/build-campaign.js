#!/usr/bin/env node
/**
 * 建立「主力 CBO 全受眾・購買轉換」廣告 —— 全部 PAUSED，$0 花費。
 * 重用既有勝利素材（creative_id）。用法：node scripts/build-campaign.js
 */
const fs = require('fs');
const path = require('path');
for (const line of fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m) process.env[m[1]] = m[2].trim();
}
const T = process.env.META_ACCESS_TOKEN;
const ACC = process.env.META_AD_ACCOUNT_ID;
const V = process.env.META_API_VERSION || 'v23.0';
const BASE = `https://graph.facebook.com/${V}`;
const PIXEL = '1718060851659728';
const PAGE = '105263589034211';

async function post(edge, params) {
  const body = new URLSearchParams({ ...params, access_token: T });
  const res = await fetch(`${BASE}/${edge}`, { method: 'POST', body });
  return res.json();
}

(async () => {
  // 1) Campaign — CBO, OUTCOME_SALES, PAUSED, $2,100/日 (TWD offset 1)
  console.log('① 建立行銷活動（CBO・購買・PAUSED）…');
  const camp = await post(`${ACC}/campaigns`, {
    name: '20260630｜CBO｜全受眾｜購買轉換｜AI企劃',
    objective: 'OUTCOME_SALES',
    status: 'PAUSED',
    special_ad_categories: JSON.stringify([]),
    daily_budget: '2100',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
  });
  if (camp.error) { console.error('❌ campaign:', JSON.stringify(camp.error)); process.exit(1); }
  console.log('   campaign_id =', camp.id);

  // 2) Ad Set — broad + Advantage+ audience, optimize PURCHASE, PAUSED
  console.log('② 建立廣告組（全受眾/Advantage+・最佳化購買・PAUSED）…');
  const adset = await post(`${ACC}/adsets`, {
    name: '全受眾｜購買｜AI企劃',
    campaign_id: camp.id,
    status: 'PAUSED',
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'OFFSITE_CONVERSIONS',
    promoted_object: JSON.stringify({ pixel_id: PIXEL, custom_event_type: 'PURCHASE' }),
    targeting: JSON.stringify({
      geo_locations: { countries: ['TW'] },
      targeting_automation: { advantage_audience: 1 },
    }),
  });
  if (adset.error) { console.error('❌ adset:', JSON.stringify(adset.error)); process.exit(1); }
  console.log('   adset_id =', adset.id);

  // 3) Ads — 重用勝利 creative（逐支嘗試，個別失敗不中斷）
  const creatives = [
    { id: '1979961332780245', label: '均衡飲食影片(ROAS3.46)' },
    { id: '3663702990601846', label: '冷泡冰涼回甘(ROAS2.87)' },
    { id: '4181406658770495', label: '山中旅行(ROAS2.56)' },
  ];
  console.log('③ 建立廣告（重用素材・PAUSED）…');
  const made = [];
  for (const c of creatives) {
    const ad = await post(`${ACC}/ads`, {
      name: '重用｜' + c.label,
      adset_id: adset.id,
      status: 'PAUSED',
      creative: JSON.stringify({ creative_id: c.id }),
    });
    if (ad.error) { console.log('   ⚠️ ' + c.label + ' 失敗:', ad.error.message); }
    else { console.log('   ✅ ' + c.label + ' → ad_id ' + ad.id); made.push(ad.id); }
  }

  console.log('\n=== 完成（全部 PAUSED，$0 花費）===');
  console.log('campaign:', camp.id, '| adset:', adset.id, '| ads:', made.length);
  console.log('到廣告管理員檢查並開跑：');
  console.log(`https://business.facebook.com/adsmanager/manage/campaigns?act=${ACC.replace('act_','')}&selected_campaign_ids=${camp.id}`);
})().catch(e => { console.error(e); process.exit(1); });
