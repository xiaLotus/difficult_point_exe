const app = Vue.createApp({
  data() {
    return {
      username: null,
      records: [],
      showAddModal: false,
      newRecord: this.getNewRecordTemplate(),
      showFloorDropdown: false,
      showBuildingDropdown: false,
      floors: ["3F", "4F", "5F", "6F", "8F", "9F", "10F", '11F'],
      buildings: ["K11", 'K18', "K21", "K22", "K25"],
      // 新增的權限相關屬性
      showRejectModal: false,
      rejectTarget: null,
      showUnrejectModal: false,
      unrejectTarget: null,
      showPermanentDeleteModal: false,
      permanentDeleteTarget: null,
      userRole: 'proposer', // 'proposer', 'editor', 'admin'
      userPermissions: null, // 從後端取得的權限資料
      removeReason: '', // 移除原因
    };
  },

  computed: {
    message() {
      const roleText = this.userRole === 'admin' ? '管理員' : 
                     this.userRole === 'editor' ? '編輯人' : '提案人';
      return this.username
        ? `當前使用者 ${this.username} (${roleText})`
        : "您現在是未知，無法查看任何資訊，請重新登入";
    },
    recordsWithDaysAgo() {
      return this.records.map(record => ({
        ...record,
        距今: this.calculateDaysAgo(record.提案日期),
        距今樣式: this.getDaysAgoClass(record.提案日期)
      }));
    }
  },

  methods: {
    // 權限檢查方法
    async checkUserPermissions() {
      try {
        // 先檢查是否為管理員
        const adminResponse = await axios.get('http://127.0.0.1:5000/api/check_Permission', {
          params: {
            filename: this.username,
            role: '管理員'
          }
        });
        
        if (adminResponse.data.valid) {
          this.userRole = 'admin';
          return;
        }
        
        // 檢查是否為編輯人
        const editorResponse = await axios.get('http://127.0.0.1:5000/api/check_Permission', {
          params: {
            filename: this.username,
            role: '編輯人'
          }
        });
        
        if (editorResponse.data.valid) {
          this.userRole = 'editor';
          return;
        }
        
        // 檢查是否為提案人
        const proposerResponse = await axios.get('http://127.0.0.1:5000/api/check_Permission', {
          params: {
            filename: this.username,
            role: '提案人'
          }
        });
        
        if (proposerResponse.data.valid) {
          this.userRole = 'proposer';
          return;
        }
        
        // 檢查是否為預覽人
        const viewerResponse = await axios.get('http://127.0.0.1:5000/api/check_Permission', {
          params: {
            filename: this.username,
            role: '預覽人'
          }
        });
        
        if (viewerResponse.data.valid) {
          this.userRole = 'viewer';
        } else {
          // 如果都不是，預設為最低權限
          this.userRole = 'viewer';
        }
        
      } catch (error) {
        console.error('權限檢查失敗:', error);
        this.userRole = 'viewer'; // 預設為最低權限
      }
    },

    // 移除項目
    rejectItem(record) {
      this.rejectTarget = record;
      this.showRejectModal = true;
    },

    cancelReject() {
      this.showRejectModal = false;
      this.rejectTarget = null;
    },

async confirmReject() {
  try {
    // 使用 SweetAlert2 的輸入框來詢問移除原因
    const { value: removeReason } = await Swal.fire({
      title: '請說明移除原因',
      input: 'textarea',
      inputPlaceholder: '請詳細說明為什麼要移除此記錄...',
      inputAttributes: {
        'aria-label': '移除原因',
        'maxlength': 500
      },
      showCancelButton: true,
      confirmButtonText: '確認移除',
      cancelButtonText: '取消',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return '請填寫移除原因'
        }
      }
    });

    // 如果用戶取消或沒有輸入原因，就退出
    if (!removeReason) {
      return;
    }

    // 準備進度記錄內容
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${month}/${day}`;
    
    const newProgressRecord = `${dateStr}: ${this.username} 已將此項目移除，有需求請另行通知管理員。原因：${removeReason.trim()}`;

    // 1. 先新增進度記錄
    const progressResponse = await axios.post(
      `http://127.0.0.1:5000/api/add_progress?username=${encodeURIComponent(this.username)}`,
      {
        record_id: this.rejectTarget.項次, // 使用項次作為 record_id
        content: newProgressRecord
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (progressResponse.data.status !== 'success') {
      throw new Error(progressResponse.data.message || '新增進度記錄失敗');
    }

    // 2. 再更新 Status 為 Reject
    const statusResponse = await axios.put(
      `http://127.0.0.1:5000/api/update_record?username=${encodeURIComponent(this.username)}`,
      {
        id: this.rejectTarget.id,
        Status: 'Reject'
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (statusResponse.data.status !== 'success') {
      throw new Error(statusResponse.data.message || '更新狀態失敗');
    }

    // 3. 更新前端資料
    const index = this.records.findIndex(r => r.id === this.rejectTarget.id);
    if (index !== -1) {
      this.records[index].Status = 'Reject';
      
      // 更新進度記錄顯示
      if (Array.isArray(this.records[index].進度紀錄)) {
        this.records[index].進度紀錄.push(newProgressRecord);
      } else {
        this.records[index].進度紀錄 = [newProgressRecord];
      }
    }

    // 4. 關閉對話框
    this.showRejectModal = false;

    // 5. 顯示成功訊息
    await Swal.fire({
      icon: 'success',
      title: '移除成功',
      text: '項目狀態已更新為 Reject，移除原因已記錄',
      timer: 2000,
      showConfirmButton: false
    });

  } catch (error) {
    console.error('移除失敗:', error);
    await Swal.fire({
      icon: 'error',
      title: '移除失敗',
      text: error.response?.data?.message || error.message || '請稍後重試',
      confirmButtonText: '確認',
      confirmButtonColor: '#ef4444'
    });
  }
},
    // 復原項目
    unrejectItem(record) {
      this.unrejectTarget = record;
      this.showUnrejectModal = true;
    },

    cancelUnreject() {
      this.showUnrejectModal = false;
      this.unrejectTarget = null;
    },

async confirmUnreject() {
  try {
    // 使用 SweetAlert2 的輸入框來詢問復原原因
    const { value: restoreReason } = await Swal.fire({
      title: '請說明復原原因',
      input: 'textarea',
      inputPlaceholder: '請詳細說明為什麼要復原此記錄...',
      inputAttributes: {
        'aria-label': '復原原因',
        'maxlength': 500
      },
      showCancelButton: true,
      confirmButtonText: '確認復原',
      cancelButtonText: '取消',
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#6b7280',
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return '請填寫復原原因'
        }
      }
    });

    // 如果用戶取消或沒有輸入原因，就退出
    if (!restoreReason) {
      return;
    }

    // 準備進度記錄內容
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${month}/${day}`;
    
    const newProgressRecord = `${dateStr}: ${this.username} 已復原此項目，原因：${restoreReason.trim()}`;

    // 產生新的項次（檔名）
    const pad = (n) => n.toString().padStart(2, "0");
    const newItemNumber = 
      now.getFullYear() +
      pad(now.getMonth() + 1) +
      pad(now.getDate()) +
      pad(now.getHours()) +
      pad(now.getMinutes()) +
      pad(now.getSeconds());

    // 1. 先新增進度記錄
    const progressResponse = await axios.post(
      `http://127.0.0.1:5000/api/add_progress?username=${encodeURIComponent(this.username)}`,
      {
        record_id: this.unrejectTarget.項次, // 使用原項次
        content: newProgressRecord
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (progressResponse.data.status !== 'success') {
      throw new Error(progressResponse.data.message || '新增進度記錄失敗');
    }

    // 2. 更新記錄：Status 改為 New，項次改為新的，提案日期改為今天
    const updateResponse = await axios.put(
      `http://127.0.0.1:5000/api/update_record?username=${encodeURIComponent(this.username)}`,
      {
        id: this.unrejectTarget.id,
        Status: 'New',
        項次: newItemNumber,
        提案日期: `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (updateResponse.data.status !== 'success') {
      throw new Error(updateResponse.data.message || '更新記錄失敗');
    }
    // 3. 重新命名 JSON 檔案
    const renameResponse = await axios.post(
      `http://127.0.0.1:5000/api/rename_progress_file?username=${encodeURIComponent(this.username)}`,
      {
        old_record_id: this.unrejectTarget.項次, // 舊項次
        new_record_id: newItemNumber // 新項次
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (renameResponse.data.status !== 'success') {
      logger.warning('JSON 檔案重新命名失敗，但不影響主要功能');
    }
    // 3. 更新前端資料
    const index = this.records.findIndex(r => r.id === this.unrejectTarget.id);
    if (index !== -1) {
      this.records[index].Status = 'New';
      this.records[index].項次 = newItemNumber;
      this.records[index].提案日期 = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
      
      // 更新進度記錄顯示
      if (Array.isArray(this.records[index].進度紀錄)) {
        this.records[index].進度紀錄.push(newProgressRecord);
      } else {
        this.records[index].進度紀錄 = [newProgressRecord];
      }
    }

    // 4. 關閉對話框
    this.showUnrejectModal = false;

    // 5. 顯示成功訊息
    await Swal.fire({
      icon: 'success',
      title: '復原成功',
      html: `
        <div class="text-left">
          <p class="mb-2">項目已成功復原</p>
          <p class="text-sm text-gray-600">新項次：${newItemNumber}</p>
        </div>
      `,
      timer: 3000,
      showConfirmButton: false
    });

  } catch (error) {
    console.error('復原失敗:', error);
    await Swal.fire({
      icon: 'error',
      title: '復原失敗',
      text: error.response?.data?.message || error.message || '請稍後重試',
      confirmButtonText: '確認',
      confirmButtonColor: '#ef4444'
    });
  }
},

    // 徹底刪除項目
    permanentDeleteItem(record) {
      this.permanentDeleteTarget = record;
      this.showPermanentDeleteModal = true;
    },

    cancelPermanentDelete() {
      this.showPermanentDeleteModal = false;
      this.permanentDeleteTarget = null;
    },

    async confirmPermanentDelete() {
      try {
        // 先調用後端 API 刪除資料
        const response = await axios.delete(`http://127.0.0.1:5000/api/delete_record/${this.permanentDeleteTarget.id}`, {
          params: { username: this.username }
        });
        
        if (response.data.status === 'success') {
          // 後端刪除成功後，再從前端移除
          this.records = this.records.filter(r => r.id !== this.permanentDeleteTarget.id);
          
          this.showPermanentDeleteModal = false;
          
          Swal.fire({
            icon: 'success',
            title: '徹底刪除成功',
            text: '項目已永久刪除',
            timer: 2000,
            showConfirmButton: false
          });
        } else {
          throw new Error(response.data.message || '刪除失敗');
        }
        
      } catch (error) {
        console.error('徹底刪除失敗:', error);
        Swal.fire({
          icon: 'error',
          title: '徹底刪除失敗',
          text: error.message || '請稍後重試'
        });
      }
    },

    // 計算距今天數 - 只返回數字
    calculateDaysAgo(proposalDate) {
      if (!proposalDate) return '';
      
      const dateStr = proposalDate.toString();
      if (dateStr.length !== 8 || !/^\d{8}$/.test(dateStr)) return '';
      
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      
      const proposalDateTime = new Date(`${year}-${month}-${day}`);
      const today = new Date();
      
      today.setHours(0, 0, 0, 0);
      proposalDateTime.setHours(0, 0, 0, 0);
      
      const diffDays = Math.floor((today - proposalDateTime) / (1000 * 60 * 60 * 24));
      
      return Math.abs(diffDays); // 只返回絕對值數字
    },

    // 距今樣式計算
    getDaysAgoClass(proposalDate) {
      if (!proposalDate) return '';
      
      const dateStr = proposalDate.toString();
      if (dateStr.length !== 8) return '';
      
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      
      const proposalDateTime = new Date(`${year}-${month}-${day}`);
      const today = new Date();
      
      today.setHours(0, 0, 0, 0);
      proposalDateTime.setHours(0, 0, 0, 0);
      
      const diffDays = Math.floor((today - proposalDateTime) / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 0) return 'text-blue-600 font-medium';
      if (diffDays <= 7) return 'text-green-600';
      if (diffDays <= 30) return 'text-yellow-600';
      return 'text-red-600';
    },

    // 處理棟別陣列
    getBuildingArray(building) {
      if (!building) return [];
      
      // 處理字串化的陣列 "['全棟別']"
      if (typeof building === 'string') {
        if (building.startsWith('[') && building.endsWith(']')) {
          try {
            const cleanStr = building.replace(/'/g, '"');
            const parsed = JSON.parse(cleanStr);
            return Array.isArray(parsed) ? parsed : [building];
          } catch (e) {
            return building.split(',').map(b => b.trim()).filter(b => b);
          }
        }
        // 處理逗號分隔的字串 "K11, K18, K21"
        return building.split(',').map(b => b.trim()).filter(b => b);
      }
      
      return Array.isArray(building) ? building : [building];
    },

    // 處理樓層陣列
    getFloorArray(floor) {
      if (!floor) return [];
      
      if (typeof floor === 'string') {
        if (floor.startsWith('[') && floor.endsWith(']')) {
          try {
            const cleanStr = floor.replace(/'/g, '"');
            const parsed = JSON.parse(cleanStr);
            return Array.isArray(parsed) ? parsed : [floor];
          } catch (e) {
            return floor.split(',').map(f => f.trim()).filter(f => f);
          }
        }
        // 處理逗號分隔的字串 "3F, 4F, 5F"
        return floor.split(',').map(f => f.trim()).filter(f => f);
      }
      
      return Array.isArray(floor) ? floor : [floor];
    },

    // 處理站點陣列
    getStationArray(station) {
      if (!station) return [];
      
      if (typeof station === 'string') {
        // 處理逗號分隔的字串 "3390, 3190"
        return station.split(',').map(s => s.trim()).filter(s => s);
      }
      
      return Array.isArray(station) ? station : [station];
    },

    // 棟別標籤樣式
    getBuildingTagClass(building) {
      if (building === '全棟別') {
        return 'inline-block px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-md border border-purple-200 whitespace-nowrap';
      }
      return 'inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-md border border-blue-200 whitespace-nowrap';
    },

    // 樓層標籤樣式
    getFloorTagClass(floor) {
      if (floor === '全樓層') {
        return 'inline-block px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded-md border border-orange-200 whitespace-nowrap';
      }
      return 'inline-block px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-md border border-green-200 whitespace-nowrap';
    },

    // 棟別選擇相關方法
    toggleBuildingSelection(building) {
      if (building === '全棟別') {
        const index = this.newRecord.棟別.indexOf('全棟別');
        if (index > -1) {
          this.newRecord.棟別.splice(index, 1);
        } else {
          this.newRecord.棟別 = ['全棟別'];
          this.showBuildingDropdown = false;
        }
      } else {
        if (this.newRecord.棟別.includes('全棟別')) {
          return;
        }
        
        const index = this.newRecord.棟別.indexOf(building);
        if (index > -1) {
          this.newRecord.棟別.splice(index, 1);
        } else {
          this.newRecord.棟別.push(building);
        }
      }
    },

    removeBuildingSelection(building) {
      const index = this.newRecord.棟別.indexOf(building);
      if (index > -1) {
        this.newRecord.棟別.splice(index, 1);
      }
    },

    // 樓層選擇相關方法
    toggleFloorSelection(floor) {
      if (floor === '全樓層') {
        const index = this.newRecord.樓層.indexOf('全樓層');
        if (index > -1) {
          this.newRecord.樓層.splice(index, 1);
        } else {
          this.newRecord.樓層 = ['全樓層'];
          this.showFloorDropdown = false;
        }
      } else {
        if (this.newRecord.樓層.includes('全樓層')) {
          return;
        }
        
        const index = this.newRecord.樓層.indexOf(floor);
        if (index > -1) {
          this.newRecord.樓層.splice(index, 1);
        } else {
          this.newRecord.樓層.push(floor);
        }
      }
    },
    
    removeFloorSelection(floor) {
      const index = this.newRecord.樓層.indexOf(floor);
      if (index > -1) {
        this.newRecord.樓層.splice(index, 1);
      }
    },

    toggleBuildingDropdown() {
      this.showBuildingDropdown = !this.showBuildingDropdown;
      this.showFloorDropdown = false;
    },

    toggleFloorDropdown() {
      this.showFloorDropdown = !this.showFloorDropdown;
      this.showBuildingDropdown = false;
    },

    handleClickOutside(event) {
      if (this.$refs.BuildingDropdown && !this.$refs.BuildingDropdown.contains(event.target)) {
        this.showBuildingDropdown = false;
      }
      if (this.$refs.floorDropdown && !this.$refs.floorDropdown.contains(event.target)) {
        this.showFloorDropdown = false;
      }
    },

    // 處理站點輸入的 Enter 鍵
    handleStationKeydown(event) {
      if (event.key === 'Enter') {
        event.preventDefault(); // 防止換行
        
        // 取得目前輸入值
        const currentValue = this.newRecord.站點.trim();
        
        // 如果輸入為空，直接返回
        if (!currentValue) return;
        
        // 檢查是否已經以逗號結尾
        if (currentValue.endsWith(',')) {
          // 如果已經有逗號，加上空格
          this.newRecord.站點 = currentValue + ' ';
        } else {
          // 如果沒有逗號，加上逗號和空格
          this.newRecord.站點 = currentValue + ', ';
        }
      }
    },
    
    cancelAdd() {
      this.newRecord = this.getNewRecordTemplate();
      this.showAddModal = false;
    },
    
    getNewRecordTemplate() {
      const now = new Date();
      const pad = (n) => n.toString().padStart(2, "0");
      const timestamp =
        now.getFullYear() +
        pad(now.getMonth() + 1) +
        pad(now.getDate()) +
        pad(now.getHours()) +
        pad(now.getMinutes()) +
        pad(now.getSeconds());

      return {  
        項次: timestamp,
        提案日期: `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`,
        棟別: [],
        樓層: [],
        站點: "",
        類別: "",
        提案人: this.username || "",
        案件分類: "",
        問題描述: "",
        PDCA: "P",
        截止日期: "TBD",
        專案Owner: "",
        項目DueDate: "TBD",
        進度紀錄: '',
        Status: "New"
      };
    },

    // 修正 formatText 函數 - 按實際字符寬度計算
    formatText(text) {
      if (text === null || text === undefined) return "";
      
      const textStr = typeof text === 'string' ? text : String(text);
      
      // 按實際字符寬度切割（中文2寬度，英文1寬度）
      let result = [];
      let currentLine = '';
      let currentWidth = 0;
      const maxWidth = 20; // 設定最大寬度為20
      
      for (let i = 0; i < textStr.length; i++) {
        const char = textStr[i];
        const charWidth = /[\u4e00-\u9fff]/.test(char) ? 2 : 1; // 中文2寬度，其他1寬度
        
        if (currentWidth + charWidth > maxWidth && currentLine.length > 0) {
          result.push(currentLine);
          currentLine = char;
          currentWidth = charWidth;
        } else {
          currentLine += char;
          currentWidth += charWidth;
        }
      }
      
      if (currentLine.length > 0) {
        result.push(currentLine);
      }
      
      return result.join('\n');
    },

    // 修正 formatRecordText 函數 - 按實際字符寬度計算
    formatRecordText(text) {
      if (text === null || text === undefined) return "";
      
      if (Array.isArray(text)) {
        if (text.length === 0) return "";
        text = text[text.length - 1];
      }
      
      const textStr = typeof text === 'string' ? text : String(text);
      
      // 按實際字符寬度切割
      let result = [];
      let currentLine = '';
      let currentWidth = 0;
      const maxWidth = 35; // 設定最大寬度為20
      
      for (let i = 0; i < textStr.length; i++) {
        const char = textStr[i];
        const charWidth = /[\u4e00-\u9fff]/.test(char) ? 2 : 1;
        
        if (currentWidth + charWidth > maxWidth && currentLine.length > 0) {
          result.push(currentLine);
          currentLine = char;
          currentWidth = charWidth;
        } else {
          currentLine += char;
          currentWidth += charWidth;
        }
      }
      
      if (currentLine.length > 0) {
        result.push(currentLine);
      }
      
      return result.join('\n');
    },

    formatDate(val) {
      if (!val) return "";
      const str = val.toString().trim();
      if (str.length !== 8 || !/^\d{8}$/.test(str)) return str;
      return `${str.slice(0, 4)}/${str.slice(4, 6)}/${str.slice(6, 8)}`;
    },

    updateDate(field, val) {
      if (!val) {
        this.newRecord[field] = "";
        return;
      }
      const yyyymmdd = val.replace(/-/g, "");
      this.newRecord[field] = yyyymmdd;
    },

    refreshIcons() {
      this.$nextTick(() => {
        lucide.createIcons();
      });
    },

    async addRecord() {
      // 驗證必填欄位
      const requiredFields = [
        { field: '棟別', value: this.newRecord.棟別, label: '棟別' },
        { field: '樓層', value: this.newRecord.樓層, label: '樓層' },
        { field: '站點', value: this.newRecord.站點, label: '站點' },
        { field: '提案人', value: this.newRecord.提案人, label: '提案人' },
        { field: '問題描述', value: this.newRecord.問題描述, label: '問題描述' },
        { field: 'PDCA', value: this.newRecord.PDCA, label: 'PDCA' },
        { field: 'Status', value: this.newRecord.Status, label: 'Status' }
      ];

      const missingFields = [];

      // 檢查每個必填欄位
      requiredFields.forEach(item => {
        if (item.field === '棟別' || item.field === '樓層') {
          // 陣列類型的欄位檢查
          if (!item.value || (Array.isArray(item.value) && item.value.length === 0)) {
            missingFields.push(item.label);
          }
        } else {
          // 一般字串欄位檢查
          if (!item.value || item.value.trim() === '') {
            missingFields.push(item.label);
          }
        }
      });

      // 如果有缺少的欄位，顯示提醒
      if (missingFields.length > 0) {
        await Swal.fire({
          icon: 'warning',
          title: '請填寫必填欄位',
          html: `
            <div class="text-left">
              <p class="mb-3 text-gray-600">以下欄位為必填，請完成填寫：</p>
              <ul class="list-disc list-inside space-y-1">
                ${missingFields.map(field => `<li class="text-red-600 font-medium">${field}</li>`).join('')}
              </ul>
            </div>
          `,
          confirmButtonText: '確認',
          confirmButtonColor: '#3b82f6',
          customClass: {
            popup: 'text-sm'
          }
        });
        return; // 停止提交
      }

      // 修改棟別和樓層的處理邏輯，統一轉換為字串格式
      const payload = {
        ...this.newRecord,
        // 棟別處理：如果選的是全棟別，直接存"全棟別"，否則用逗號連接
        棟別: this.newRecord.棟別.includes('全棟別') ? '全棟別' : this.newRecord.棟別.join(', '),
        // 樓層處理：如果選的是全樓層，直接存"全樓層"，否則用逗號連接
        樓層: this.newRecord.樓層.includes('全樓層') ? '全樓層' : this.newRecord.樓層.join(', '),
        // 站點已經是字串格式，直接使用
        站點: this.newRecord.站點.trim(),
        進度紀錄: this.newRecord.進度紀錄 || ''
      };

      try {
        const res = await fetch(`http://127.0.0.1:5000/api/add_record?username=${encodeURIComponent(this.username)}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (data.status === "success") {
          // 顯示成功訊息
          await Swal.fire({
            icon: 'success',
            title: '新增成功！',
            text: '資料已成功儲存',
            confirmButtonText: '確認',
            confirmButtonColor: '#10b981',
            timer: 2000,
            timerProgressBar: true
          });

          // 重新載入資料
          this.loadMeetingRecords();
          this.newRecord = this.getNewRecordTemplate();
          this.showAddModal = false;
          console.log("✅ 新增成功");
        } else {
          await Swal.fire({
            icon: 'error',
            title: '新增失敗',
            text: data.message || "未知錯誤",
            confirmButtonText: '確認',
            confirmButtonColor: '#ef4444'
          });
        }
      } catch (error) {
        console.error("❌ 發送新增資料失敗：", error);
        await Swal.fire({
          icon: 'error',
          title: '系統錯誤',
          text: '後端錯誤，請稍後再試',
          confirmButtonText: '確認',
          confirmButtonColor: '#ef4444'
        });
      }
    },

    // 保留原本的 deleteItem 方法（如果還有其他地方使用）
    deleteItem(id) {
      this.records = this.records.filter(record => record.id !== id);
    },

    checkScroll() {
      if (this.$refs.tableContainer) {
        console.log("📌 當前滾動高度 scrollTop =", this.$refs.tableContainer.scrollTop);
      }
    },

    // 編輯記錄 - 跳轉到編輯頁面
    editRecord(record) {
      // 記錄當前滾動位置
      const currentScrollPosition = this.$refs.tableContainer ? this.$refs.tableContainer.scrollTop : 0;
      localStorage.setItem(`scrollPosition_${record.項次}`, currentScrollPosition);
      
      console.log("📌 編輯記錄:", {
        項次: record.項次,
        滾動位置: currentScrollPosition
      });
      
      // 跳轉到編輯頁面（使用固定檔名 + URL 參數）
      const editUrl = `editing_meeting.html?username=${encodeURIComponent(this.username)}&recordId=${record.項次}&scrollPos=${currentScrollPosition}`;
      window.location.href = editUrl;
    },

    loadMeetingRecords() {
      console.log("📌 開始載入會議記錄...");
      
      axios
        .get(`http://127.0.0.1:5000/api/meeting_records?username=${encodeURIComponent(this.username)}`)
        .then((res) => {
          console.log("📌 API 回應：", res.data);
          
          // 直接使用後端回傳的資料
          if (res.data && res.data.data) {
            this.records = res.data.data;
            console.log(`📌 成功載入 ${this.records.length} 筆會議記錄`);
          } else {
            console.error("❌ 沒有收到資料");
            this.records = [];
          }
        })
        .catch((err) => {
          console.error("❌ API 讀取失敗：", err);
          this.records = [];
        });
    },
    // 在 methods 區塊中加入登出功能
    logout() {
      // 清除用戶資訊
      localStorage.removeItem('username');
      localStorage.removeItem('userRole');
      
      // 顯示登出確認
      Swal.fire({
        icon: 'success',
        title: '已登出',
        text: '您已成功登出系統',
        timer: 1500,
        showConfirmButton: false
      }).then(() => {
        // 導向登入頁面
        window.location.href = '../index.html';
      });
    }
  },
  
  watch: {
    showAddModal(newVal) {
      if (newVal) {
        this.$nextTick(() => {
          lucide.createIcons();
        });
      }
    },
    
    records: {
      handler(newVal) {
        if (newVal && newVal.length > 0) {
          this.$nextTick(() => {
            lucide.createIcons();
          });
        }
      },
      deep: true
    }
  },

  async mounted() {
    const urlParams = new URLSearchParams(window.location.search);
    this.username = urlParams.get("username");
    
    console.log("📌 Vue 應用已掛載，使用者：", this.username);
    
    // 檢查用戶權限
    if (this.username) {
      await this.checkUserPermissions();
      console.log("📌 用戶角色：", this.userRole);
    }
    
    this.$nextTick(() => {
      lucide.createIcons();
    });
    
    if (this.username) {
      this.newRecord = this.getNewRecordTemplate();
      this.loadMeetingRecords();
    } else {
      console.warn("⚠️ 未提供 username 參數");
    }

    document.addEventListener('click', this.handleClickOutside);
  },

  beforeUnmount() {
    document.removeEventListener('click', this.handleClickOutside);
  }
});

app.mount("#app");