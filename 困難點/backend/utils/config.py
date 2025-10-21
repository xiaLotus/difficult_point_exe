import os
import configparser
from pathlib import Path

class Config:
    _instance = None
    _config = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(Config, cls).__new__(cls)
            cls._instance._load_config()
        return cls._instance
    
    def _load_config(self):
        """載入配置檔案"""
        self._config = configparser.ConfigParser()
        
        # 配置檔案路徑（專案根目錄）
        config_path = Path(__file__).parent.parent / 'config.ini'
        
        if not config_path.exists():
            raise FileNotFoundError(f"配置檔案不存在: {config_path}")
        
        self._config.read(config_path, encoding='utf-8')
    
    def get(self, section, key, fallback=None):
        """取得配置值"""
        return self._config.get(section, key, fallback=fallback)
    
    def get_path(self, section, key):
        """取得路徑配置值並轉換為絕對路徑"""
        relative_path = self.get(section, key)
        if relative_path:
            # 轉換為絕對路徑（基於專案根目錄）
            base_dir = Path(__file__).parent.parent
            return str(base_dir / relative_path)
        return None

# 建立全域實例
config = Config()