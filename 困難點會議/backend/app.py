from flask import Flask, jsonify, request, send_file, has_request_context
from flask_cors import CORS
from ldap3 import Server, Connection, ALL, NTLM # type: ignore
from ldap3.core.exceptions import LDAPException, LDAPBindError # type: ignore
import os
import pandas as pd
import numpy as np
# import win32api
import logging
from datetime import date, timedelta
from routes.auth import auth_bp  # ✅ 確保有匯入 Blueprint
from routes.meeting_routes import meeting_bp
from routes import comment_routes  # ← 1️⃣ 添加這行
from utils.config import config  # ✅ 匯入配置
from waitress import serve
from routes.proposer_read_routes import proposer_read_bp
from routes.bulletin_board import bulletin_bp  # ← 留言板 Blueprint


class UserLogHandler(logging.Handler):
    """
    依使用者分資料夾寫入 Log：
        Log/{username}/app_{週期起始日}.log

    - username 從當前請求的 query string / JSON body / form 取得
      （username 或 filename 參數），非請求情境（啟動訊息等）寫入 Log/system/
    - 若參數帶的是「姓名」（如 詹睿穎），會透過 emoinfo.json 反查回「工號」，
       確保資料夾統一以工號命名、不出現本名
    - 每 7 天一個檔案：以「當週的星期一」作為週期起始日命名，
      例如 app_20260727.log 代表 2026/07/27（一）～ 2026/08/02（日）
    """

    def __init__(self, log_dir):
        super().__init__()
        self.log_dir = log_dir
        self._name_to_id = {}      # 姓名 → 工號 對照表
        self._emoinfo_mtime = None  # emoinfo.json 的修改時間（用於自動重載）

    def _load_name_map(self):
        """載入 emoinfo.json 建立 姓名→工號 對照表（檔案更新時自動重載）"""
        try:
            employee_info_path = config.get_path('Paths', 'employee_info')
            if not employee_info_path or not os.path.exists(employee_info_path):
                return
            mtime = os.path.getmtime(employee_info_path)
            if mtime == self._emoinfo_mtime:
                return  # 檔案沒變，沿用快取
            import json
            with open(employee_info_path, 'r', encoding='utf-8-sig') as f:
                employees = json.load(f)
            self._name_to_id = {
                emp.get('姓名'): emp.get('工號')
                for emp in employees
                if emp.get('姓名') and emp.get('工號')
            }
            self._emoinfo_mtime = mtime
        except Exception:
            pass  # 對照表載入失敗時不影響寫 log

    def _get_username(self):
        """從當前請求取得使用者名稱，取不到時歸類為 system"""
        try:
            if has_request_context():
                # 依序從 query string → JSON body → form 尋找
                username = request.args.get('username') or request.args.get('filename')
                if not username:
                    data = request.get_json(silent=True)
                    if isinstance(data, dict):
                        username = data.get('username')
                if not username:
                    username = request.form.get('username')
                if username:
                    username = str(username).strip()
                    # 若帶的是姓名，反查回工號（統一以工號建資料夾）
                    self._load_name_map()
                    return self._name_to_id.get(username, username)
        except Exception:
            pass
        return 'system'

    def _get_log_path(self, username):
        """組出 Log/{username}/app_{週期起始日}.log 的完整路徑"""
        today = date.today()
        # 每 7 天一個檔案：以當週星期一為週期起始日
        period_start = today - timedelta(days=today.weekday())
        user_dir = os.path.join(self.log_dir, username)
        os.makedirs(user_dir, exist_ok=True)
        return os.path.join(user_dir, f"app_{period_start:%Y%m%d}.log")

    def emit(self, record):
        try:
            username = self._get_username()
            # 檔名安全處理：移除不合法字元，避免路徑跳脫
            username = ''.join(
                c for c in username if c not in '\\/:*?"<>|'
            ).strip() or 'system'

            log_path = self._get_log_path(username)
            msg = self.format(record)
            with open(log_path, 'a', encoding='utf-8') as f:
                f.write(msg + '\n')
        except Exception:
            self.handleError(record)


def create_app():
    app = Flask(__name__)
    CORS(app)

    # === Logger 設定 ===
    log_dir = config.get_path('Paths', 'log_dir')  # ✅ 從配置讀取（Log 目錄）
    os.makedirs(log_dir, exist_ok=True) # type: ignore

    logger = logging.getLogger()
    logger.setLevel(logging.INFO)

    # 避免重複加 handler
    if not logger.handlers:
        formatter = logging.Formatter(
            "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )

        # 檔案輸出：依使用者分資料夾，每 7 天一個檔案
        file_handler = UserLogHandler(log_dir) # type: ignore
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

        # Console 輸出
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)
    
    # ✅ 確保會議圖片目錄存在（由 config 統一管理）
    meeting_images_path = config.get_path('Paths', 'meeting_images')
    os.makedirs(meeting_images_path, exist_ok=True) # type: ignore

    # === 註冊藍圖 ===
    app.register_blueprint(auth_bp, url_prefix="/api")
    app.register_blueprint(meeting_bp, url_prefix="/api")
    app.register_blueprint(comment_routes.bp)  # ← 2️⃣ 添加這行
    app.register_blueprint(bulletin_bp)  # ← 留言板 Blueprint
    # ===== 註冊未讀通知 Blueprint =====
    app.register_blueprint(proposer_read_bp)

    return app


if __name__ == "__main__":
    app = create_app()
    # serve(app, host='10.11.99.84', port=8115)
    app.run()