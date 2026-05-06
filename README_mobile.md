# 手機外用與狀態同步

## 目前可用方式

這個 App 是純靜態網頁，可以放到 GitHub Pages、Cloudflare Pages、Netlify 或任何靜態網站主機。手機在外面要能使用，必須把以下內容一起部署到同一個網站根目錄：

- `output/cmu_recent_app/`
- `questions/*.csv`
- `questions/images/`

部署後，用手機開公開網址，例如：

`https://你的網域/output/cmu_recent_app/`

第一次載入後，瀏覽器會快取 App 外殼與已讀取過的題庫/題圖。手機瀏覽器可用「加入主畫面」方式當成 App 使用。

## 錯題與作答狀態

錯題與作答紀錄會先保存在各裝置瀏覽器內。若尚未部署 Google Apps Script，可用手動備份：

1. 在原裝置按「同步與備份」>「匯出狀態」。
2. 把 JSON 檔傳到另一台裝置。
3. 在另一台裝置按「匯入狀態」。

這是手動同步，不需要帳號或伺服器。

## Google Apps Script + Google Sheets 同步

已建立同步用 Google Sheets：

https://docs.google.com/spreadsheets/d/1TytY22P4QKRtMbJ1SbtIlq7dVL3gTx6_WtjmVZ8YYfo/edit

後端程式與部署步驟在：

`sync/Code.gs`

`sync/DEPLOY_APPS_SCRIPT.md`

部署 Apps Script 後，在 App 的「同步與備份」填入 Web App URL 和同步代號，即可：

- 上傳雲端：把本裝置錯題與作答紀錄寫入 Google Sheets。
- 從雲端取回：把同一同步代號的紀錄讀回本裝置。
