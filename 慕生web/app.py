# -*- coding: utf-8 -*-
from flask import Flask, jsonify, request
import json
import os
from datetime import datetime
from flask_cors import CORS
from loguru import logger
import sys

# ======================
# 🔧 Loguru 設定
# ======================
logger.remove()  # 移除預設 handler
# 1. 控制台輸出 (方便開發除錯)
logger.add(
    sys.stdout, 
    format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {message}", 
    level="DEBUG"
)

# 2. 檔案輸出 (每日輪轉、保留 7 天、UTF-8 編碼)
logger.add(
    "logs/app_{time:YYYY-MM-DD}.log", 
    rotation="1 day", 
    retention="30 days", 
    level="DEBUG", 
    encoding="utf-8-sig"
)



app = Flask(__name__)
CORS(app)

FILE_PATH = "data.json"
ADMIN_FILE = "admin.json"  # 🔥 新增 admin 檔案路徑


# ======================
# 工具
# ======================
def load_data():
    if not os.path.exists(FILE_PATH):
        return []
    with open(FILE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_data(data):
    with open(FILE_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# 🔥 新增：讀取 admin 列表
def load_admins():
    if not os.path.exists(ADMIN_FILE):
        return []
    with open(ADMIN_FILE, "r", encoding="utf-8") as f:
        return json.load(f).get("admins", [])


# ======================
# GET
# ======================
@app.route("/api/urls", methods=["GET"])
def get_urls():
    return jsonify(load_data())


# ======================
# POST（🔥 以後端 index 為準）
# ======================
@app.route("/api/urls", methods=["POST"])
def add_url():
    data = load_data()
    body = request.json

    # 🔥 後端產生 index（唯一）
    next_index = max([item.get("index", 0) for item in data], default=0) + 1

    new_item = {
        "index": next_index,
        "purpose": body.get("purpose", ""),
        "building": body.get("building", ""),  # 🔥 新增
        "floor": body.get("floor", ""),        # 🔥 新增
        "url": body.get("url"),
        "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

    data.insert(0, new_item)
    save_data(data)

    return jsonify(new_item)   # ⭐ 回傳完整資料


# ======================
# DELETE（用 index）
# ======================
@app.route("/api/urls/<int:index>", methods=["DELETE"])
def delete_url(index):
    data = load_data()

    data = [item for item in data if item.get("index") != index]

    save_data(data)

    return jsonify({"status": "deleted"})


# 🔐 檢查 admin 權限（GET）
@app.route("/api/check-admin", methods=["GET"])
def check_admin():
    employee_id = request.args.get("employee_id", "").strip()
    admins = load_admins()  # 讀取 admin.json
    is_admin = employee_id in admins
    return jsonify({
        "is_admin": is_admin,
        "employee_id": employee_id if is_admin else None
    })

# 🗑️ 清空全部（帶有權限驗證）
@app.route("/api/urls", methods=["DELETE"])
def clear_urls():
    # 從 header 或 body 取得工號
    emp_id = (request.headers.get("X-Employee-ID") or 
              (request.json.get("employee_id") if request.json else None))
    
    admins = load_admins()
    
    # 🔐 後端二次驗證：即使繞過前端，這裡仍會擋下
    if not emp_id or emp_id not in admins:
        return jsonify({"error": "權限不足: 僅管理員可執行清空操作"}), 403
        
    save_data([])  # 清空資料
    return jsonify({"status": "cleared", "cleared_by": emp_id})



# ======================
# PUT（🔧 編輯單筆記錄 - print 除錯版）
# ======================
@app.route("/api/urls/<int:index>", methods=["PUT"])
def update_url(index):
    
    logger.info("\n" + "="*60)
    logger.info(f"🔧 [PUT] 收到編輯請求 | index={index} (類型: {type(index).__name__})")
    logger.info(f"🔧 [PUT] 請求 Headers: {dict(request.headers)}")
    logger.info(f"🔧 [PUT] 請求 Body: {request.json}")
    logger.info("="*60)
    
    # 🔐 權限檢查
    employee_id = request.headers.get("X-Employee-ID", "").strip()
    admins = load_admins()
    
    if not employee_id or employee_id not in admins:
        logger.info(f"❌ [PUT] 權限拒絕: employee_id='{employee_id}' 不在 admins={admins}")
        return jsonify({"message": "權限不足: 僅管理員可編輯"}), 403

    data = load_data()
    body = request.json
    
    logger.info(f"📦 [PUT] 目前 data.json 共有 {len(data)} 筆資料")
    logger.info(f"🔍 [PUT] 開始搜尋 index={index}...")
    
    # 🔍 寬鬆比對：轉成字串比較
    target = None
    target_idx = None
    
    for i, item in enumerate(data):
        item_index = item.get("index")
        logger.info(f"   ├─ 檢查[{i}]: item.index={item_index} (類型: {type(item_index).__name__}), 比對: str('{item_index}') == str('{index}') ? {str(item_index) == str(index)}")
        
        if str(item_index) == str(index):
            target = item
            target_idx = i
            logger.info(f"   └─ ✅ 找到目標! target_idx={target_idx}")
            break
    
    if not target:
        all_indexes = [item.get("index") for item in data]
        logger.info(f"❌ [PUT] 找不到 index={index}，現有 indexes: {all_indexes}")
        logger.info("="*60 + "\n")
        return jsonify({
            "message": f"找不到 index={index} 的記錄",
            "available_indexes": all_indexes
        }), 404

    logger.info(f"✏️ [PUT] 更新前: {target}")
    
    # ✏️ 更新欄位
    target["purpose"] = body.get("purpose", target.get("purpose", ""))
    target["building"] = body.get("building", target.get("building", ""))
    target["floor"] = body.get("floor", target.get("floor", ""))
    target["url"] = body.get("url", target.get("url"))
    
    logger.info(f"✏️ [PUT] 更新後: {target}")

    # 💾 寫回檔案
    save_data(data)
    logger.info(f"💾 [PUT] 已寫入 data.json")
    logger.info(f"✅ [PUT] 編輯成功! 回傳 200")
    logger.info("="*60 + "\n")

    return jsonify(target), 200

if __name__ == "__main__":
    app.run(debug=True)


# if __name__ == '__main__':
#     app.run(host='10.11.104.247', port=7003)
