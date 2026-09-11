# import glob
# import os
# import re
# from flask import Flask, jsonify
# from flask_cors import CORS
# import pandas as pd
# from waitress import serve

# app = Flask(__name__)
# CORS(app)  # 允許前端請求
# # FILE_PATH = "//20220530-W03/Data/報案系統資料管控"
# FILE_PATH = os.getcwd()
# print(f"📂 當前程式資料夾: {FILE_PATH}")

# @app.route('/api/week_num')
# def get_week_num():
#     folder = f'{FILE_PATH}/每日過帳相關統計'
#     # print(f"🔍 掃描資料夾：{folder}")

#     # 找出所有 CSV 檔案
#     files = glob.glob(f"{folder}/*.csv")
#     # print("📂 找到的檔案：", files)

#     week_tags = []
#     for f in files:
#         filename = os.path.basename(f) 
#         match = re.search(r'(\d{4})-W(\d{1,2})', filename)
#         if match:
#             year = match.group(1)
#             week = int(match.group(2))
#             week_tags.append(f"{year}-W{week:02d}") 

#     # print("📅 擷取到的週別：", week_tags)

#     if week_tags:
#         latest_week = max(week_tags, key=lambda x: int(x[:4]) * 100 + int(x[6:]))
#         return jsonify({"latest_week": latest_week})

#     return jsonify({"latest_week": None})


# @app.route('/api/factory-data')
# def get_factory_data():
#     # 全部欄位讀取為 string
#     df = pd.read_csv(f'{FILE_PATH}/各週資料.csv', encoding='utf-8-sig', dtype=str)

#     # 僅取最後三筆
#     last_rows = df.tail(3)

#     # 工具函式：解析 () 內數字並加總
#     def parse_and_sum(value):
#         if pd.isna(value) or str(value).strip() == "0":
#             return 0
#         matches = re.findall(r"\((\d+)\)", str(value))
#         return sum(int(m) for m in matches)

#     # 需要統計的欄位
#     target_cols = ["2D消除", "EAP重開", "過帳異常", "關閉比對", "其他事項", "更新/搬遷"]

#     # 計算 summary（只針對最後三筆）
#     summary = {}


#     for col in target_cols:
#         total_val = last_rows[col].apply(parse_and_sum).sum()
#         summary[f"{col}統計"] = int(total_val)

#     # 總計統計 = 六個合併
#     summary["總計統計"] = sum(summary.values())

#     # 轉為 list of dict 傳出 JSON
#     data = {
#         "records": last_rows.to_dict(orient="records"),
#         "summary": summary
#     }
#     return jsonify(data)


# @app.route('/api/posting-counts')
# def get_posting_counts():

#     folder = f'{FILE_PATH}/每日過帳相關統計'
#     # folder = f'每日過帳相關統計'
#     # 找出所有符合格式的檔名（例如：2025-W14-每日過帳相關統計.csv）
#     files = glob.glob(f"{folder}/*.csv")

#     # 從檔名中提取週次並排序，格式為 2025-W14
#     def extract_week_key(filepath):
#         match = re.search(r'(\d{4})-W(\d+)', filepath)
#         if match:
#             year, week = match.groups()
#             return int(year) * 100 + int(week)  # 例如 202514
#         return 0

#     # 取得週次最大的檔案

#     latest_file = max(files, key=extract_week_key)
#     df = pd.read_csv(latest_file, encoding='utf-8-sig')
#     df = df.rename(columns={"日期": "date", "過帳相關件數": "count"})
#     df["count"] = df["count"].astype(int)
#     return jsonify(df.to_dict(orient='records'))


# @app.route('/api/weekly-summary')
# def get_weekly_summary():

#     # df = pd.read_csv(f'{FILE_PATH}/每週分類統計.csv', encoding='utf-8-sig')
#     df = pd.read_csv(f'每週分類統計.csv', encoding='utf-8-sig')

#     # 數值欄位轉成 int
#     df[["過帳異常", "2D消除", "更新/搬遷", "總計"]] = df[["過帳異常", "2D消除", "更新/搬遷", "總計"]].fillna(0).astype(int)

#     # 轉成 list[dict]
#     last_two_rows = df.tail(8)
#     data = last_two_rows.to_dict(orient='records')
#     return jsonify(data)


# @app.route('/api/oper-stats')
# def get_oper_stats():
#     import os
#     import glob
#     import re
#     import pandas as pd

#     folder = '分類_Oper_No_Top3'
#     files = glob.glob(f"{folder}/*.csv")

#     if not files:
#         print(f"❌ 找不到任何 {folder}/*.csv 檔案")
#         return jsonify({"error": f"找不到任何 {folder}/*.csv 檔案"}), 404

#     def extract_week_key(filepath):
#         match = re.search(r'(\d{4})-W(\d+)', filepath)
#         if match:
#             year, week = match.groups()
#             return int(year) * 100 + int(week)
#         return 0

#     latest_file = max(files, key=extract_week_key)

#     if not os.path.exists(latest_file):
#         return jsonify({"error": f"檔案不存在：{latest_file}"}), 404

#     df = pd.read_csv(latest_file, encoding='utf-8-sig')
#     records = df.to_dict(orient='records')
#     # 🔢 建立 summary 統計
#     summary = []
#     grouped = df.groupby(['Week', '分類'])

#     for (week, category), group in grouped:
#         total = 0
#         for count_str in group['次數']:
#             # 範例格式：'K11(12)/K25(3)'，提取括號內數字
#             numbers = re.findall(r'\((\d+)\)', str(count_str))
#             total += sum(int(n) for n in numbers)
#         summary.append({
#             '分類': category,
#             '總次數': total
#         })
#     # print(summary)
#     return jsonify({
#         "records": records,
#         "summary": summary
#     })



# @app.route('/api/detailed-logs')
# def get_detailed_logs():
#     folder = f'{FILE_PATH}/報案資料表'

#     # 找出所有符合格式的檔名（例如：2025-W14-每日過帳相關統計.csv）
#     files = glob.glob(f"{folder}/*.csv")

#     # 從檔名中提取週次並排序，格式為 2025-W14
#     def extract_week_key(filepath):
#         match = re.search(r'(\d{4})-W(\d+)', filepath)
#         if match:
#             year, week = match.groups()
#             return int(year) * 100 + int(week)  # 例如 202514
#         return 0

#     # 取得週次最大的檔案

#     latest_file = max(files, key=extract_week_key)
#     # latest_file = "2025-W36-報案資料表.csv"
#     df = pd.read_csv(latest_file, encoding='utf-8-sig')

#     # 避免空白欄位為 NaN，改成空字串
#     df = df.fillna("")

#     # # 確保 Oper_No 是整數（如有需要）
#     # if "站點" in df.columns:
#     #     df["站點"] = pd.to_numeric(df["站點"], errors="coerce").fillna(0).astype(int)

#     data = df.to_dict(orient='records')
#     return jsonify(data)

# if __name__ == '__main__':
#     app.run(debug=True)
#     # serve(app, host='0.0.0.0', port=8097, threads=8)
#     # app.run(debug=True)

import glob
import os
import re
from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd
from waitress import serve

app = Flask(__name__)
CORS(app)  # 允許前端請求
# FILE_PATH = "//20220530-W03/Data/報案系統資料管控"
FILE_PATH = os.getcwd()
print(f"📂 當前程式資料夾: {FILE_PATH}")

WEEK_RE = re.compile(r'(\d{4})-W(\d{1,2})')


# ---------- 共用工具 ----------
def parse_week_tag(text):
    """從字串取出週次，統一成 'YYYY-Www'；找不到回傳 None"""
    m = WEEK_RE.search(str(text))
    if not m:
        return None
    return f"{m.group(1)}-W{int(m.group(2)):02d}"


def week_key(tag):
    """'2026-W12' -> 202612，用來排序"""
    return int(tag[:4]) * 100 + int(tag[6:])


def get_week_arg():
    """讀取 ?week=，正規化；沒給或格式錯誤回傳 None（=最新）"""
    return parse_week_tag(request.args.get('week', ''))


def find_week_file(folder, week=None):
    """在資料夾內找指定週的 csv；week=None 則取最新週"""
    files = glob.glob(f"{folder}/*.csv")
    tagged = [(parse_week_tag(os.path.basename(f)), f) for f in files]
    tagged = [(t, f) for t, f in tagged if t]
    if not tagged:
        return None
    if week:
        for t, f in tagged:
            if t == week:
                return f
        return None
    return max(tagged, key=lambda x: week_key(x[0]))[1]


# ---------- 可用週次清單（回溯用） ----------
@app.route('/api/weeks')
def get_weeks():
    """掃描各資料夾，回傳所有出現過的週次（year / week），供前端做 年 -> 週 下拉。"""
    folders = ['報案資料表', '每日過帳相關統計', '分類_Oper_No_Top3']
    tags = set()
    for folder in folders:
        for f in glob.glob(f"{FILE_PATH}/{folder}/*.csv"):
            t = parse_week_tag(os.path.basename(f))
            if t:
                tags.add(t)

    result = [{"week": t, "year": int(t[:4]), "num": int(t[6:])}
              for t in sorted(tags, key=week_key)]
    return jsonify(result)


@app.route('/api/week_num')
def get_week_num():
    week = get_week_arg()
    if week:
        return jsonify({"latest_week": week})

    folder = f'{FILE_PATH}/每日過帳相關統計'
    files = glob.glob(f"{folder}/*.csv")
    week_tags = [parse_week_tag(os.path.basename(f)) for f in files]
    week_tags = [t for t in week_tags if t]

    if week_tags:
        latest_week = max(week_tags, key=week_key)
        return jsonify({"latest_week": latest_week})

    return jsonify({"latest_week": None})


@app.route('/api/factory-data')
def get_factory_data():
    week = get_week_arg()
    # 全部欄位讀取為 string
    df = pd.read_csv(f'{FILE_PATH}/各週資料.csv', encoding='utf-8-sig', dtype=str)

    if week:
        last_rows = df[df["Week"] == week]
    else:
        # 僅取最後三筆（原本行為）
        last_rows = df.tail(3)

    # 工具函式：解析 () 內數字並加總
    def parse_and_sum(value):
        if pd.isna(value) or str(value).strip() == "0":
            return 0
        if re.fullmatch(r"\d+", str(value).strip()):
            return int(str(value).strip())
        matches = re.findall(r"\((\d+)\)", str(value))
        return sum(int(m) for m in matches)

    target_cols = ["2D消除", "EAP重開", "過帳異常", "關閉比對", "其他事項", "更新/搬遷"]

    summary = {}
    for col in target_cols:
        total_val = last_rows[col].apply(parse_and_sum).sum()
        summary[f"{col}統計"] = int(total_val)

    summary["總計統計"] = sum(summary.values())

    data = {
        "records": last_rows.to_dict(orient="records"),
        "summary": summary
    }
    return jsonify(data)


@app.route('/api/posting-counts')
def get_posting_counts():
    week = get_week_arg()
    folder = f'{FILE_PATH}/每日過帳相關統計'
    target = find_week_file(folder, week)
    if not target:
        return jsonify([])

    df = pd.read_csv(target, encoding='utf-8-sig')
    df = df.rename(columns={"日期": "date", "過帳相關件數": "count"})
    df["count"] = df["count"].astype(int)
    return jsonify(df.to_dict(orient='records'))


@app.route('/api/weekly-summary')
def get_weekly_summary():
    week = get_week_arg()
    df = pd.read_csv(f'每週分類統計.csv', encoding='utf-8-sig')

    df[["過帳異常", "2D消除", "更新/搬遷", "總計"]] = \
        df[["過帳異常", "2D消除", "更新/搬遷", "總計"]].fillna(0).astype(int)

    if week:
        # 以指定週為結尾，往前取 8 週
        df["_key"] = df["週次"].apply(lambda t: week_key(parse_week_tag(t)) if parse_week_tag(t) else 0)
        df = df[df["_key"] <= week_key(week)].drop(columns="_key")

    rows = df.tail(8)
    return jsonify(rows.to_dict(orient='records'))


@app.route('/api/oper-stats')
def get_oper_stats():
    week = get_week_arg()
    folder = f'{FILE_PATH}/分類_Oper_No_Top3'
    target = find_week_file(folder, week)

    if not target:
        print(f"❌ 找不到 {folder} 對應週次 {week or '最新'} 的檔案")
        return jsonify({"records": [], "summary": []})

    df = pd.read_csv(target, encoding='utf-8-sig')
    records = df.to_dict(orient='records')

    summary = []
    grouped = df.groupby(['Week', '分類'])
    for (wk, category), group in grouped:
        total = 0
        for count_str in group['次數']:
            numbers = re.findall(r'\((\d+)\)', str(count_str))
            total += sum(int(n) for n in numbers)
        summary.append({'分類': category, '總次數': total})

    return jsonify({"records": records, "summary": summary})


@app.route('/api/detailed-logs')
def get_detailed_logs():
    week = get_week_arg()
    folder = f'{FILE_PATH}/報案資料表'
    target = find_week_file(folder, week)
    if not target:
        return jsonify([])

    df = pd.read_csv(target, encoding='utf-8-sig')
    df = df.fillna("")
    return jsonify(df.to_dict(orient='records'))


if __name__ == '__main__':
    app.run(debug=True)
    # serve(app, host='0.0.0.0', port=8097, threads=8)