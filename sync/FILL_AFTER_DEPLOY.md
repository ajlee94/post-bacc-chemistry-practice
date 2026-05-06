# 部署後只需填這一處

目前已預填：

- 同步表 ID：`1TytY22P4QKRtMbJ1SbtIlq7dVL3gTx6_WtjmVZ8YYfo`
- 預設同步代號：`chemistry-default`
- 預設裝置名稱：`mobile`

仍需在 Apps Script 部署後，把 Web App URL 填入：

`output/cmu_recent_app/sync/sync-config.js`

```js
window.CHEM_SYNC_CONFIG = {
  scriptUrl: "貼上 Apps Script Web App URL",
  userId: "chemistry-default",
  deviceLabel: "mobile",
};
```

填好後，行動裝置開 App 時會自動帶入同步設定，可以直接按「上傳雲端」或「從雲端取回」。

注意：若只把單一 HTML 檔傳到手機，題庫 CSV 與題圖不會一起過去。手機在外面能馬上使用的前提是：

1. App 靜態檔已部署到公開網址，或
2. 手機收到的是包含 App、`questions/*.csv`、`questions/images/` 的完整網站資料包。
