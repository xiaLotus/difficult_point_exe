from datetime import datetime, timedelta
from tabulate import tabulate  # ✅ 新增 tabulate
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from ldap3 import Server, Connection, ALL, NTLM # type: ignore
from ldap3.core.exceptions import LDAPException, LDAPBindError # type: ignore
import os
import pandas as pd
import re
import numpy as np
import win32api
import json
import urllib.parse 
import quopri 
import os
import shutil
import io
import csv
import logging
import os
from routes.auth import auth_bp  # ✅ 確保有匯入 Blueprint
from routes.meeting_routes import meeting_bp
import uuid

def create_app():
    app = Flask(__name__)
    CORS(app)

    # === Logger 設定 ===
    log_file = "app.log"
    os.makedirs(os.path.dirname(log_file), exist_ok=True) if os.path.dirname(log_file) else None

    logger = logging.getLogger()
    logger.setLevel(logging.INFO)

    # 避免重複加 handler
    if not logger.handlers:
        formatter = logging.Formatter(
            "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )

        # 檔案輸出
        file_handler = logging.FileHandler(log_file, encoding="utf-8")
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

        # Console 輸出
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)

    # === 註冊藍圖 ===
    app.register_blueprint(auth_bp, url_prefix="/api")
    app.register_blueprint(meeting_bp, url_prefix="/api")

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000, debug=True)