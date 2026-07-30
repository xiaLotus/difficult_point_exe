"""工作管理系統 — 郵件通知模組。"""
import json
import os
import smtplib
from email.header import Header
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from datetime import datetime
from typing import Optional, List

from loguru import logger
import config

# ── 設定 ──
SMTP_IP       = "10.12.10.31"
MAIL_FROM     = "WMS_Notify@aseglobal.com"
MAIL_FROM_NAME = "工作管理系統通知"

# _BACKEND_DATA_PATH = rf'D:\Data\每日工作表單\Backend_data.json'
_BACKEND_DATA_PATH = os.path.join(os.path.dirname(config.__file__), 'Backend_data.json')

# ════════════════════════════════════════════════
# ── 工具函式 ──
# ════════════════════════════════════════════════

def _load_backend_data() -> list:
    """載入 Backend_data.json。"""
    try:
        with open(_BACKEND_DATA_PATH, 'r', encoding='utf-8-sig') as f:
            return json.load(f)
    except Exception as e:
        logger.warning(f"[Mail] 無法讀取 Backend_data.json: {e}")
        return []


def get_email_by_name(name: str) -> Optional[str]:
    """以姓名查 Notes_ID（email）。"""
    if not name:
        return None
    for u in _load_backend_data():
        if u.get('姓名') == name:
            email = u.get('Notes_ID', '')
            return email if '@' in email else None
    return None


def get_email_by_account(account: str) -> Optional[str]:
    """以工號查 Notes_ID（email）。"""
    if not account:
        return None
    for u in _load_backend_data():
        if u.get('工號', '').upper() == account.upper():
            email = u.get('Notes_ID', '')
            return email if '@' in email else None
    return None


# ════════════════════════════════════════════════
# ── 核心寄信函式 ──
# ════════════════════════════════════════════════

def send_mail(to_list: List[str], cc_list: List[str], subject: str, html_body: str):
    """
    寄送 HTML 郵件。
    to_list  : 收件人 email 清單
    cc_list  : 副本 email 清單
    subject  : 主旨
    html_body: HTML 格式內容
    """
    if not to_list:
        logger.warning("[Mail] 收件人清單為空，略過寄信")
        return

    em = MIMEMultipart()
    em['From']    = formataddr((str(Header(MAIL_FROM_NAME, 'utf-8')), MAIL_FROM))
    em['To']      = ', '.join(to_list)
    em['CC']      = ', '.join(cc_list) if cc_list else ''
    em['Subject'] = str(Header(subject, 'utf-8'))

    em.attach(MIMEText(html_body, 'html', 'utf-8'))

    all_recipients = to_list + (cc_list or [])
    try:
        with smtplib.SMTP(SMTP_IP) as smtp:
            smtp.sendmail(MAIL_FROM, all_recipients, em.as_string())
        logger.info(f"[Mail] ✅ 寄信成功 | 主旨={subject} | 收件人={all_recipients}")
    except Exception as e:
        logger.error(f"[Mail] ❌ 寄信失敗: {e} | 收件人={all_recipients}")


# ════════════════════════════════════════════════
# ── HTML 模板 ──
# ════════════════════════════════════════════════

def _build_update_html(task: dict, changed: dict, operator_account: str, old_status: str) -> str:
    """產生任務更新通知的 HTML 內容。"""
    now = datetime.now().strftime('%Y-%m-%d %H:%M')

    html = f"""
    <div style="font-family:Arial,'Microsoft JhengHei',sans-serif;max-width:640px;margin:auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">

      <!-- Header -->
      <div style="background:#1e293b;padding:20px 28px">
        <div style="color:#94a3b8;font-size:12px;margin-bottom:4px">工作管理系統</div>
        <div style="color:#f1f5f9;font-size:18px;font-weight:700">任務更新通知</div>
      </div>

      <!-- 任務基本資訊 -->
      <div style="padding:20px 28px;background:#f8fafc;border-bottom:1px solid #e2e8f0">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr>
            <td style="color:#64748b;padding:4px 0;width:90px">任務描述</td>
            <td style="color:#1e293b;font-weight:600">{task.get('項目描述', '')}</td>
          </tr>
          <tr>
            <td style="color:#64748b;padding:4px 0">提案人</td>
            <td style="color:#1e293b">{task.get('提案人', '—')}</td>
          </tr>
          <tr>
            <td style="color:#64748b;padding:4px 0">組織類別</td>
            <td style="color:#1e293b">{task.get('組織類別', '—')}</td>
          </tr>
          <tr>
            <td style="color:#64748b;padding:4px 0">目前狀態</td>
            <td style="color:#1e293b">{old_status or 'Pending'} → {task.get('狀態', 'Pending')}</td>
          </tr>
          <tr>
            <td style="color:#64748b;padding:4px 0">截止日期</td>
            <td style="color:#1e293b">{task.get('項目Due Date', '') or '無'}</td>
          </tr>
        </table>
      </div>

      <!-- Footer -->
      <div style="padding:14px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8">
        由 <strong>{operator_account}</strong> 於 {now} 更新 ・ 此為系統自動通知，請勿直接回覆
      </div>

    </div>
    """
    return html


# ════════════════════════════════════════════════
# ── 對外介面 ──
# ════════════════════════════════════════════════

# 組織類別 → admin.json key 對應表
_ORG_TO_ADMIN_KEY = {
    'FT01營運(硬)': 'FT01_硬',
    'FT01營運(資)': 'FT01_資',
    'FT01營運(保)': 'FT01_保',
    'FT01值班':     'FT01_值',
}

def get_org_admin_emails(org: str) -> List[str]:
    """依組織類別查對應管理員的 email 清單。"""
    admin_key = _ORG_TO_ADMIN_KEY.get(org)
    if not admin_key:
        logger.warning(f"[Mail] 組織類別 '{org}' 無對應的管理員 key")
        return []
    try:
        with open(config.ADMIN_FILE, 'r', encoding='utf-8-sig') as f:
            cfg = json.load(f)
    except Exception as e:
        logger.warning(f"[Mail] 無法讀取 admin.json: {e}")
        return []
    accounts = cfg.get(admin_key, [])
    emails = []
    for acc in accounts:
        mail = get_email_by_account(acc)
        if mail:
            emails.append(mail)
    logger.info(f"[Mail] 組織={org} key={admin_key} 管理員帳號={accounts} emails={emails}")
    return emails


def notify_task_updated(task: dict, changed: dict, operator_account: str, old_status: str = ''):
    """
    任務更新後通知相關人員。
    收件人：提案人、管理OWNER、項目OWNER
    副本：  操作者本人（若不在收件人清單內）
    """
    if not changed:
        return

    to_set  = set()
    cc_set  = set()

    # 收件人：提案人、管理OWNER、項目OWNER（以姓名查 email）
    for field in ('提案人', '管理OWNER', '項目OWNER'):
        mail = get_email_by_name(task.get(field, ''))
        if mail:
            to_set.add(mail)

    # 操作者本人（以工號查 email）→ 若已在收件人則不重複加副本
    op_mail = get_email_by_account(operator_account)
    if op_mail and op_mail not in to_set:
        cc_set.add(op_mail)

    # 組織類別管理員 → 加入副本
    org = task.get('組織類別', '')
    for admin_mail in get_org_admin_emails(org):
        if admin_mail not in to_set:
            cc_set.add(admin_mail)

    if not to_set:
        logger.warning(f"[Mail] 找不到任何收件人，任務id={task.get('id')} 略過通知")
        return

    subject   = f"【工作管理系統】任務更新通知 — {task.get('項目描述', '')[:30]}"
    html_body = _build_update_html(task, changed, operator_account, old_status)

    send_mail(sorted(to_set), sorted(cc_set), subject, html_body)



