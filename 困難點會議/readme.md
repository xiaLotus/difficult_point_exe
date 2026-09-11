# 修改日誌

### 2026/08/01
```python
1. app.py 修改 Log 存放方式(查閱 config.ini檔案)
2. 修改金額篩選儲存
```

### 2026/09/11
```python
1. editing_meeting.html / editing_meeting.js 新增 Close Day 欄位（Status 旁，可自由選日期，存 YYYYMMDD，清空為空字串）
2. defficultmeeting.html / defficultmeeting.js 首頁新增 Close Day 欄位顯示與年/月篩選（含篩選記憶、清除篩選、Excel 匯出）
3. defficultmeeting.js Close Day 欄位僅管理員預設顯示，其他角色需至欄位設定開啟
4. defficultmeeting.html / defficultmeeting.js 表格移除 min-w-max，新增 table-fit 模式（欄位 ≤15 時貼齊視窗不出現水平捲軸）
5. save_record.py CSV 欄位加入 CloseDay，舊 CSV 自動補欄
6. meeting_utils.py 讀取 CSV 補 CloseDay 欄位並固定為字串型別
```