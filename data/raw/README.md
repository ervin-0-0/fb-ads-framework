# data/raw — 廣告原始資料放這裡

agent 跑 `/投放` 時會讀這個資料夾。把 Meta 廣告資料放進來，三種方式擇一：

## 方式 A：手動匯出（最快上手，0 設定）
在 Meta 廣告管理員 → 匯出 → 下載 CSV，丟進這個資料夾。
檔名建議：`ads-YYYY-MM-DD.csv`、`adsets-YYYY-MM-DD.csv`。
適合：每天/每週手動跑一次。

## 方式 B：Meta Marketing API（自動，要設定一次）
寫一支 `scripts/pull-meta.js` 用 access token 拉 insights，存成 JSON 到這裡。
需要：Meta App + 廣告帳戶 access token（放 .env，別進 git）。
適合：要常常跑、想完全自動。

## 方式 C：瀏覽器自動化爬
用 Claude in Chrome 開廣告管理員把畫面資料抓下來。
適合：不想碰 API、資料量不大。

> 選好後告訴我是哪個，我幫你把對應的接資料腳本 / 流程補上。
