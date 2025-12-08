import logging
from ldap3 import Server, Connection, ALL, NTLM
from ldap3.core.exceptions import LDAPException, LDAPBindError
from utils.config import config  # ✅ 匯入配置

logger = logging.getLogger(__name__)

def authenticate_user(username, password):
    try:
        # # ✅ 從配置檔讀取 LDAP 設定
        # ldap_server = config.get('LDAP', 'server')
        # ldap_domain = config.get('LDAP', 'domain')
        
        # server = Server(ldap_server, get_info=ALL)
        # user = f'{ldap_domain}\\{username}'
        # logger.info(f"這邊是 {user} 準備降落")
        
        # conn = Connection(server, user=user, password=password, authentication=NTLM)
        # if conn.bind():
        #     logger.info(f"{user} 成功登入")
        #     return True
        # else:
        #     logger.warning(f"{user} 登入失敗")
        #     return False
        
        # ✅ 測試模式
        logger.info(f"{username} 成功登入")
        return True
        
    except Exception as e:
        logger.error(f"拋出異常的使用者: {username}, 異常為: {str(e)}")
        return False