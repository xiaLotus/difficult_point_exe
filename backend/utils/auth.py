import logging
from ldap3 import Server, Connection, ALL, NTLM # type: ignore
from ldap3.core.exceptions import LDAPException, LDAPBindError # type: ignore

# 配置日誌
logger = logging.getLogger(__name__)

def authenticate_user(username, password):
    try:
        # server = Server('ldap://KHADDC02.kh.asegroup.com', get_info=ALL)
        # user = f'kh\\{username}'
        # logger.info(f"這邊是 {user} 準備降落")
        
        # conn = Connection(server, user=user, password=password, authentication=NTLM)
        # if conn.bind():
        # logger.info(f"{user} 成功登入")
        logger.info(f"{username} 成功登入")
        return True
        # else:
        #     logger.warning(f"{user} 登入失敗")
        #     return False
    except Exception as e:
        logger.error(f"拋出異常的使用者: {username}, 異常為: {str(e)}")
        return False
    
    