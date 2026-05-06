# Google Apps Script 同步部署

同步表：

https://docs.google.com/spreadsheets/d/1TytY22P4QKRtMbJ1SbtIlq7dVL3gTx6_WtjmVZ8YYfo/edit

## 部署步驟

1. 開啟同步表。
2. 選單進入「擴充功能」>「Apps Script」。
3. 將 `Code.gs` 的內容貼到 Apps Script 編輯器。
4. 按「部署」>「新增部署作業」。
5. 類型選「網頁應用程式」。
6. 執行身分選「我」。
7. 存取權選「任何知道連結的使用者」。
8. 部署後複製 Web App URL。
9. 回到 App 的「同步與備份」，填入 Web App URL、同步代號，按「儲存同步設定」。

## 使用方式

- 「上傳雲端」：把目前瀏覽器的錯題與作答紀錄寫到 Google Sheets。
- 「從雲端取回」：用相同同步代號讀回 Google Sheets 狀態。
- 同步代號可用姓名縮寫、手機號末四碼或自訂代號；同一代號會共用同一份狀態。

## 注意

Apps Script 首次部署會要求授權讀寫這份 Google Sheets。若手機要在外面使用，靜態 App 本體仍需部署到公開網址；Apps Script 只負責同步狀態。
