const app = Vue.createApp({
  data() {
    return {
      username: null,
      recordId: null,
      scrollPosition: 0,
      hasUnsavedChanges: false,
      originalData: null,
      isSaving: false,
      userRole: null, // 用戶角色：管理員、編輯人、提案人、預覽人
      isReadOnly: false, // 是否為唯讀模式
      permissionChecked: false, // 權限檢查狀態
      recordData: {
        id: '',
        項次: '',
        提案日期: '',
        棟別: '',
        棟別Array: [],
        樓層: '',
        樓層Array: [],
        站點: '',
        類別: '',
        提案人: '',
        案件分類: '',
        問題描述: '',
        PDCA: 'P',
        截止日期: 'TBD',
        專案Owner: '',
        項目DueDate: 'TBD',
        進度紀錄: '',
        Status: 'New'
      },
      newProgressRecord: '',
      progressHistory: [],
      showFloorDropdown: false,
      showBuildingDropdown: false,
      floors: ["3F", "4F", "5F", "6F", "8F", "9F", "10F", '11F'],
      buildings: ["K11", 'K18', "K21", "K22", "K25"]
    };
  },

  methods: {
    // === 權限檢查系統 ===
    async checkUserPermission() {
      if (!this.username) {
        console.error("缺少用戶名");
        return false;
      }
      
      try {
        console.log(`開始檢查用戶 ${this.username} 的權限...`);

        // 1. 檢查管理員權限（最高權限）
        if (await this.checkSinglePermission('管理員')) {
          this.userRole = '管理員';
          this.isReadOnly = false;
          this.permissionChecked = true;
          console.log(`✓ 用戶 ${this.username} 擁有管理員權限 - 可完整編輯`);
          return true;
        }

        // 2. 檢查編輯人權限
        if (await this.checkSinglePermission('編輯人')) {
          this.userRole = '編輯人';
          this.isReadOnly = false;
          this.permissionChecked = true;
          console.log(`✓ 用戶 ${this.username} 擁有編輯人權限 - 可完整編輯`);
          return true;
        }

        // 3. 檢查提案人權限（只讀）
        if (await this.checkSinglePermission('提案人')) {
          this.userRole = '提案人';
          this.isReadOnly = true;
          this.permissionChecked = true;
          console.log(`✓ 用戶 ${this.username} 擁有提案人權限 - 只能查看`);
          await this.showViewModeDialog('提案人');
          return true;
        }

        // 4. 檢查預覽人權限（只讀，與提案人相同）
        if (await this.checkSinglePermission('預覽人')) {
          this.userRole = '預覽人';
          this.isReadOnly = true;
          this.permissionChecked = true;
          console.log(`✓ 用戶 ${this.username} 擁有預覽人權限 - 只能查看`);
          await this.showViewModeDialog('預覽人');
          return true;
        }

        // 5. 完全無權限
        console.log(`✗ 用戶 ${this.username} 沒有任何權限`);
        await Swal.fire({
          icon: 'error',
          title: '權限不足',
          text: '您沒有權限查看或編輯此會議記錄',
          confirmButtonText: '返回列表',
          confirmButtonColor: '#ef4444'
        });
        
        this.goBack();
        return false;

      } catch (error) {
        console.error("權限檢查過程發生錯誤:", error);
        await Swal.fire({
          icon: 'error',
          title: '權限檢查失敗',
          text: '無法驗證您的權限，請稍後再試',
          confirmButtonText: '返回列表',
          confirmButtonColor: '#ef4444'
        });
        this.goBack();
        return false;
      }
    },

    // 單一權限檢查方法
    async checkSinglePermission(role) {
      try {
        const response = await axios.get(
          `http://127.0.0.1:5000/api/check_Permission?filename=${encodeURIComponent(this.username)}&role=${encodeURIComponent(role)}`
        );
        console.log(`${role}權限檢查結果:`, response.data);
        return response.data && response.data.valid;
      } catch (error) {
        console.log(`${role}權限檢查失敗:`, error.message);
        return false;
      }
    },

    // 顯示查看模式提醒對話框
    async showViewModeDialog(roleName) {
      await Swal.fire({
        icon: 'info',
        title: '查看模式',
        html: `
          <div class="text-left">
            <p class="mb-3 text-gray-600">您目前以 <strong class="text-blue-600">${roleName}</strong> 身份查看此記錄</p>
            <p class="text-sm text-blue-600 font-medium">✓ 您可以查看所有項目內容和進度記錄</p>
            <p class="text-sm text-amber-600 font-medium mt-2">✗ 但無法進行修改、新增或儲存操作</p>
            <p class="text-sm text-gray-500 mt-3">如需修改，請聯繫編輯人或管理員</p>
          </div>
        `,
        confirmButtonText: '了解',
        confirmButtonColor: '#3b82f6'
      });
    },

    // 操作權限檢查 - 在唯讀用戶嘗試操作時觸發
    checkOperationPermission() {
      if (this.isReadOnly) {
        Swal.fire({
          icon: 'warning',
          title: '無法執行操作',
          html: `
            <div class="text-left">
              <p class="mb-3 text-gray-600">您目前以 <strong class="text-blue-600">${this.userRole}</strong> 身份查看此記錄</p>
              <p class="text-sm text-red-600 font-medium">✗ ${this.userRole}只能查看內容，無法進行修改、新增或儲存操作</p>
              <p class="text-sm text-gray-500 mt-3">如需修改，請聯繫編輯人或管理員</p>
              <p class="text-sm text-blue-500 mt-2 font-medium">系統將自動復原所有變更</p>
            </div>
          `,
          confirmButtonText: '了解',
          confirmButtonColor: '#3b82f6'
        }).then(() => {
          // 自動復原所有變更
          this.resetToOriginalState();
        });
        return false;
      }
      return true;
    },

    // 復原到原始狀態（提案人/預覽人專用）
    resetToOriginalState() {
      if (this.originalData) {
        console.log("復原到原始狀態...");
        
        // 復原所有資料欄位
        this.recordData = {
          ...this.recordData,
          項次: this.originalData.項次,
          提案日期: this.originalData.提案日期,
          棟別Array: [...this.originalData.棟別Array],
          樓層Array: [...this.originalData.樓層Array],
          站點: this.originalData.站點,
          類別: this.originalData.類別,
          提案人: this.originalData.提案人,
          案件分類: this.originalData.案件分類,
          問題描述: this.originalData.問題描述,
          PDCA: this.originalData.PDCA,
          截止日期: this.originalData.截止日期,
          專案Owner: this.originalData.專案Owner,
          項目DueDate: this.originalData.項目DueDate,
          Status: this.originalData.Status
        };
        
        // 重置狀態
        this.hasUnsavedChanges = false;
        this.newProgressRecord = this.getTodayDatePrefix();
        
        // 關閉所有下拉選單
        this.showBuildingDropdown = false;
        this.showFloorDropdown = false;
      }
    },

    // === 核心功能方法 ===
    checkForChanges() {
      if (!this.originalData) return false;
      
      const currentData = {
        項次: this.recordData.項次,
        提案日期: this.recordData.提案日期,
        棟別Array: [...this.recordData.棟別Array],
        樓層Array: [...this.recordData.樓層Array],
        站點: this.recordData.站點,
        類別: this.recordData.類別,
        提案人: this.recordData.提案人,
        案件分類: this.recordData.案件分類,
        問題描述: this.recordData.問題描述,
        PDCA: this.recordData.PDCA,
        截止日期: this.recordData.截止日期,
        專案Owner: this.recordData.專案Owner,
        項目DueDate: this.recordData.項目DueDate,
        Status: this.recordData.Status
      };

      return JSON.stringify(currentData) !== JSON.stringify(this.originalData);
    },

    setupBeforeUnloadHandler() {
      window.addEventListener('beforeunload', (event) => {
        if (this.hasUnsavedChanges && !this.isReadOnly) {
          event.preventDefault();
          event.returnValue = '您有未儲存的變更，確定要離開嗎？';
          return '您有未儲存的變更，確定要離開嗎？';
        }
      });

      window.addEventListener('popstate', async (event) => {
        if (this.hasUnsavedChanges && !this.isReadOnly) {
          event.preventDefault();
          history.pushState(null, null, window.location.href);
          
          const result = await Swal.fire({
            icon: 'question',
            title: '偵測到未儲存的變更',
            html: `
              <div class="text-left">
                <p class="mb-3 text-gray-600">您對會議記錄進行了修改但尚未儲存</p>
                <p class="text-sm text-red-600 font-medium">確定要離開並放棄這些變更嗎？</p>
              </div>
            `,
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: '儲存並離開',
            denyButtonText: '放棄變更離開',
            cancelButtonText: '繼續編輯',
            confirmButtonColor: '#10b981',
            denyButtonColor: '#ef4444',
            cancelButtonColor: '#6b7280'
          });

          if (result.isConfirmed) {
            const saved = await this.saveRecord(true);
            if (saved) {
              this.hasUnsavedChanges = false;
              this.goBack();
            }
          } else if (result.isDenied) {
            this.hasUnsavedChanges = false;
            this.goBack();
          }
        }
      });

      history.pushState(null, null, window.location.href);
    },

    getTodayDatePrefix() {
      const today = new Date();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      return `${month}/${day}: `;
    },

    parseUrlParams() {
      const urlParams = new URLSearchParams(window.location.search);
      this.username = urlParams.get("username");
      this.recordId = urlParams.get("recordId");
      
      const urlScrollPos = urlParams.get("scrollPos");
      if (urlScrollPos) {
        this.scrollPosition = parseInt(urlScrollPos);
      } else {
        const savedScrollPosition = localStorage.getItem(`scrollPosition_${this.recordId}`);
        if (savedScrollPosition) {
          this.scrollPosition = parseInt(savedScrollPosition);
        }
      }
      
      console.log("解析參數:", {
        username: this.username,
        recordId: this.recordId,
        scrollPosition: this.scrollPosition
      });
    },

    goBack() {
      this.hasUnsavedChanges = false;
      
      window.removeEventListener('beforeunload', () => {});
      window.removeEventListener('popstate', () => {});
      
      if (this.username) {
        localStorage.setItem('username', this.username);
        window.location.replace(`defficultmeeting.html?username=${encodeURIComponent(this.username)}`);
      } else {
        window.location.replace(`defficultmeeting.html`);
      }
    },

    // === 資料載入方法 ===
    async loadRecordData() {
      if (!this.recordId || !this.username) {
        console.warn("缺少必要參數");
        return;
      }

      try {
        console.log(`載入記錄資料: ${this.recordId}`);
        
        const response = await axios.get(`http://127.0.0.1:5000/api/meeting_records?username=${encodeURIComponent(this.username)}`);
        
        if (response.data && response.data.data) {
          const targetRecord = response.data.data.find(record => 
            record.id == this.recordId || record.項次 == this.recordId
          );
          
          if (targetRecord) {
            this.recordData = { ...targetRecord };
            
            if (!this.recordData.id) {
              this.recordData.id = this.recordData.項次;
            }
            
            this.recordData.棟別Array = this.stringToArray(this.recordData.棟別);
            this.recordData.樓層Array = this.stringToArray(this.recordData.樓層);
            
            // 保存原始資料用於變更檢測和復原
            this.originalData = {
              項次: this.recordData.項次,
              提案日期: this.recordData.提案日期,
              棟別Array: [...this.recordData.棟別Array],
              樓層Array: [...this.recordData.樓層Array],
              站點: this.recordData.站點,
              類別: this.recordData.類別,
              提案人: this.recordData.提案人,
              案件分類: this.recordData.案件分類,
              問題描述: this.recordData.問題描述,
              PDCA: this.recordData.PDCA,
              截止日期: this.recordData.截止日期,
              專案Owner: this.recordData.專案Owner,
              項目DueDate: this.recordData.項目DueDate,
              Status: this.recordData.Status
            };
            
            await this.loadProgressHistory();
            
            console.log("記錄資料載入成功:", this.recordData);
            console.log("用戶角色:", this.userRole, "唯讀模式:", this.isReadOnly);
          } else {
            console.error("找不到對應的記錄");
            await Swal.fire({
              icon: 'error',
              title: '記錄不存在',
              text: '找不到指定的會議記錄',
              confirmButtonText: '返回列表'
            });
            this.goBack();
          }
        }
      } catch (error) {
        console.error("載入記錄失敗：", error);
        await Swal.fire({
          icon: 'error',
          title: '載入失敗',
          text: '無法載入會議記錄，請稍後再試',
          confirmButtonText: '返回列表'
        });
        this.goBack();
      }
    },

    async loadProgressHistory() {
      try {
        const response = await axios.get(
          `http://127.0.0.1:5000/api/get_progress_history/${this.recordId}?username=${encodeURIComponent(this.username)}`
        );
        
        if (response.data && response.data.status === 'success') {
          const progressData = response.data.data;
          
          this.progressHistory = Object.entries(progressData)
            .sort(([timestampA], [timestampB]) => {
              return new Date(timestampB) - new Date(timestampA);
            })
            .map(([timestamp, content]) => ({
              timestamp: timestamp,
              date: new Date(timestamp).toLocaleString('zh-TW'),
              content: content
            }));
            
          console.log("進度歷史載入成功:", this.progressHistory);
        }
      } catch (error) {
        console.error("載入進度歷史失敗:", error);
        this.progressHistory = [];
      }
    },

    // === 資料處理工具方法 ===
    stringToArray(str) {
      if (!str) return [];
      if (Array.isArray(str)) return str;
      
      return str.split(',').map(item => item.trim()).filter(item => item);
    },

    arrayToString(arr) {
      if (!arr || !Array.isArray(arr)) return '';
      return arr.join(', ');
    },

    formatDate(val) {
      if (!val) return "";
      const str = val.toString().trim();
      if (str.length !== 8 || !/^\d{8}$/.test(str)) return str;
      return `${str.slice(0, 4)}/${str.slice(4, 6)}/${str.slice(6, 8)}`;
    },

    formatDateForInput(val) {
      if (!val || val === 'TBD') return "";
      const str = val.toString().trim();
      if (str.length !== 8 || !/^\d{8}$/.test(str)) return "";
      return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
    },

    // === 編輯操作方法（帶權限檢查） ===
    updateRecordDate(field, val) {
      if (this.isReadOnly) {
        this.checkOperationPermission();
        return;
      }
      
      if (!val) {
        this.recordData[field] = "TBD";
        return;
      }
      const yyyymmdd = val.replace(/-/g, "");
      this.recordData[field] = yyyymmdd;
    },

    toggleBuildingSelection(building) {
      if (this.isReadOnly) {
        this.checkOperationPermission();
        return;
      }
      
      if (building === '全棟別') {
        const index = this.recordData.棟別Array.indexOf('全棟別');
        if (index > -1) {
          this.recordData.棟別Array.splice(index, 1);
        } else {
          this.recordData.棟別Array = ['全棟別'];
          this.showBuildingDropdown = false;
        }
      } else {
        if (this.recordData.棟別Array.includes('全棟別')) {
          return;
        }
        
        const index = this.recordData.棟別Array.indexOf(building);
        if (index > -1) {
          this.recordData.棟別Array.splice(index, 1);
        } else {
          this.recordData.棟別Array.push(building);
        }
      }
    },

    removeBuildingSelection(building) {
      if (this.isReadOnly) {
        this.checkOperationPermission();
        return;
      }
      
      const index = this.recordData.棟別Array.indexOf(building);
      if (index > -1) {
        this.recordData.棟別Array.splice(index, 1);
      }
    },

    toggleFloorSelection(floor) {
      if (this.isReadOnly) {
        this.checkOperationPermission();
        return;
      }
      
      if (floor === '全樓層') {
        const index = this.recordData.樓層Array.indexOf('全樓層');
        if (index > -1) {
          this.recordData.樓層Array.splice(index, 1);
        } else {
          this.recordData.樓層Array = ['全樓層'];
          this.showFloorDropdown = false;
        }
      } else {
        if (this.recordData.樓層Array.includes('全樓層')) {
          return;
        }
        
        const index = this.recordData.樓層Array.indexOf(floor);
        if (index > -1) {
          this.recordData.樓層Array.splice(index, 1);
        } else {
          this.recordData.樓層Array.push(floor);
        }
      }
    },
    
    removeFloorSelection(floor) {
      if (this.isReadOnly) {
        this.checkOperationPermission();
        return;
      }
      
      const index = this.recordData.樓層Array.indexOf(floor);
      if (index > -1) {
        this.recordData.樓層Array.splice(index, 1);
      }
    },

    toggleBuildingDropdown() {
      if (this.isReadOnly) {
        this.checkOperationPermission();
        return;
      }
      
      this.showBuildingDropdown = !this.showBuildingDropdown;
      this.showFloorDropdown = false;
    },

    toggleFloorDropdown() {
      if (this.isReadOnly) {
        this.checkOperationPermission();
        return;
      }
      
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

    handleStationKeydown(event) {
      if (this.isReadOnly) {
        event.preventDefault();
        this.checkOperationPermission();
        return;
      }
      
      if (event.key === 'Enter') {
        event.preventDefault();
        
        const currentValue = this.recordData.站點.trim();
        if (!currentValue) return;
        
        if (currentValue.endsWith(',')) {
          this.recordData.站點 = currentValue + ' ';
        } else {
          this.recordData.站點 = currentValue + ', ';
        }
      }
    },

    // === 進度記錄相關方法 ===
    resetProgressRecord() {
      if (this.isReadOnly) {
        this.checkOperationPermission();
        return;
      }
      
      this.newProgressRecord = this.getTodayDatePrefix();
    },

    async addProgressRecord() {
      if (this.isReadOnly) {
        this.checkOperationPermission();
        return;
      }
      
      const content = this.newProgressRecord.trim();
      
      if (!content) {
        await Swal.fire({
          icon: 'warning',
          title: '請輸入進度內容',
          text: '進度紀錄不能為空',
          confirmButtonText: '確認'
        });
        return;
      }

      const todayPrefix = this.getTodayDatePrefix();
      if (content === todayPrefix || content === todayPrefix.trim()) {
        await Swal.fire({
          icon: 'warning',
          title: '請輸入進度內容',
          text: '請在日期後面輸入具體的進度內容',
          confirmButtonText: '確認'
        });
        return;
      }

      const dateFormatRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01]):\s/;
      
      if (!dateFormatRegex.test(content)) {
        await Swal.fire({
          icon: 'warning',
          title: '格式錯誤',
          html: `
            <div class="text-left">
              <p class="mb-3 text-gray-600">進度紀錄必須以 <strong>mm/dd: </strong> 格式開頭</p>
              <p class="text-sm text-gray-500">例如：</p>
              <p class="text-sm bg-gray-100 p-2 rounded mt-2 font-mono">01/15: 已聯繫相關部門進行處理</p>
              <p class="text-sm bg-gray-100 p-2 rounded mt-1 font-mono">12/31: 專案進度更新完成</p>
            </div>
          `,
          confirmButtonText: '確認',
          confirmButtonColor: '#3b82f6'
        });
        return;
      }

      try {
        // 直接新增進度記錄，不檢查基本資料變更
        const response = await axios.post(
          `http://127.0.0.1:5000/api/add_progress?username=${encodeURIComponent(this.username)}`,
          {
            record_id: this.recordId,
            content: content
          }
        );

        if (response.data && response.data.status === 'success') {
          console.log("進度記錄已儲存到後台");
          
          await this.loadProgressHistory();
          
          this.newProgressRecord = this.getTodayDatePrefix();
          
          await Swal.fire({
            icon: 'success',
            title: '新增成功',
            text: '進度紀錄已新增',
            timer: 1500,
            showConfirmButton: false
          });
        } else {
          throw new Error(response.data?.message || '儲存失敗');
        }
      } catch (error) {
        console.error("新增進度記錄失敗:", error);
        
        await Swal.fire({
          icon: 'error',
          title: '儲存失敗',
          text: '無法儲存進度紀錄到後台，請稍後再試或聯繫系統管理員',
          confirmButtonText: '確認',
          confirmButtonColor: '#ef4444'
        });
      }
    },


    async deleteProgressRecord(index) {
      if (this.isReadOnly) {
        this.checkOperationPermission();
        return;
      }
      
      const result = await Swal.fire({
        icon: 'question',
        title: '確認刪除',
        text: '確定要刪除這筆進度紀錄嗎？',
        showCancelButton: true,
        confirmButtonText: '刪除',
        cancelButtonText: '取消',
        confirmButtonColor: '#ef4444'
      });

      if (result.isConfirmed) {
        try {
          const progressItem = this.progressHistory[index];
          
          const response = await axios.delete(
            `http://127.0.0.1:5000/api/delete_progress?username=${encodeURIComponent(this.username)}&record_id=${this.recordId}&timestamp=${encodeURIComponent(progressItem.timestamp)}`
          );

          if (response.data && response.data.status === 'success') {
            console.log("進度記錄刪除並已同步到後台");
            
            await this.loadProgressHistory();
            
            await Swal.fire({
              icon: 'success',
              title: '刪除成功',
              timer: 1000,
              showConfirmButton: false
            });
          } else {
            throw new Error(response.data?.message || '刪除失敗');
          }
        } catch (error) {
          console.error("刪除進度記錄失敗:", error);
          
          await Swal.fire({
            icon: 'error',
            title: '刪除失敗',
            text: '無法刪除進度紀錄，請稍後再試',
            confirmButtonText: '確認',
            confirmButtonColor: '#ef4444'
          });
        }
      }
    },

    getProgressDate(record) {
      return record.date || '';
    },

    getProgressContent(record) {
      return record.content || '';
    },

    // === 儲存功能 ===
    async saveRecord(silent = false) {
      if (this.isReadOnly) {
        if (!silent) {
          this.checkOperationPermission();
        }
        return false;
      }
      
      try {
        const requiredFields = [
          { field: '棟別Array', value: this.recordData.棟別Array, label: '棟別' },
          { field: '樓層Array', value: this.recordData.樓層Array, label: '樓層' },
          { field: '站點', value: this.recordData.站點, label: '站點' },
          { field: '提案人', value: this.recordData.提案人, label: '提案人' },
          { field: '問題描述', value: this.recordData.問題描述, label: '問題描述' },
          { field: 'PDCA', value: this.recordData.PDCA, label: 'PDCA' },
          { field: 'Status', value: this.recordData.Status, label: 'Status' }
        ];

        const missingFields = [];
        requiredFields.forEach(item => {
          if (item.field === 'æ£Ÿåˆ¥Array' || item.field === 'æ¨"å±¤Array') {
            if (!item.value || (Array.isArray(item.value) && item.value.length === 0)) {
              missingFields.push(item.label);
            }
          } else {
            // 確保 item.value 是字串才呼叫 trim()
            if (!item.value || (typeof item.value === 'string' && item.value.trim() === '') || 
                (typeof item.value !== 'string' && !item.value)) {
              missingFields.push(item.label);
            }
          }
        });

        if (missingFields.length > 0 && !silent) {
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
            confirmButtonColor: '#3b82f6'
          });
          return false;
        }

        const payload = {
          ...this.recordData,
          棟別: this.recordData.棟別Array.includes('全棟別') ? '全棟別' : this.arrayToString(this.recordData.棟別Array),
          樓層: this.recordData.樓層Array.includes('全樓層') ? '全樓層' : this.arrayToString(this.recordData.樓層Array),
          站點: this.recordData.站點.trim()
        };

        delete payload.棟別Array;
        delete payload.樓層Array;
        delete payload.進度紀錄;

        console.log("準備儲存資料:", payload);

        const response = await axios.put(
          `http://127.0.0.1:5000/api/update_record?username=${encodeURIComponent(this.username)}`, 
          payload
        );

        if (response.data && response.data.status === 'success') {
          this.originalData = {
            項次: this.recordData.項次,
            提案日期: this.recordData.提案日期,
            棟別Array: [...this.recordData.棟別Array],
            樓層Array: [...this.recordData.樓層Array],
            站點: this.recordData.站點,
            類別: this.recordData.類別,
            提案人: this.recordData.提案人,
            案件分類: this.recordData.案件分類,
            問題描述: this.recordData.問題描述,
            PDCA: this.recordData.PDCA,
            截止日期: this.recordData.截止日期,
            專案Owner: this.recordData.專案Owner,
            項目DueDate: this.recordData.項目DueDate,
            Status: this.recordData.Status
          };
          
          const editUrl = `defficultmeeting.html?username=${encodeURIComponent(this.username)}`;
          window.location.href = editUrl;
          return true;
        } else {
          throw new Error(response.data?.message || '更新失敗');
        }

      } catch (error) {
        console.error("儲存失敗：", error);
        if (!silent) {
          await Swal.fire({
            icon: 'error',
            title: '儲存失敗',
            text: error.response?.data?.message || '無法儲存變更，請稍後再試',
            confirmButtonText: '確認',
            confirmButtonColor: '#ef4444'
          });
        }
        return false;
      }
    }
  },

  watch: {
    recordData: {
      handler() {
        // 只有在非唯讀模式下才追蹤變更
        if (!this.isReadOnly) {
          this.hasUnsavedChanges = this.checkForChanges();
        }
      },
      deep: true
    }
  },

  async mounted() {
    this.parseUrlParams();
    this.newProgressRecord = this.getTodayDatePrefix();
    
    if (this.username && this.recordId) {
      // 先檢查權限
      const hasPermission = await this.checkUserPermission();
      if (!hasPermission) return;
      
      // 設置頁面離開檢測（只有非唯讀模式才需要）
      if (!this.isReadOnly) {
        this.setupBeforeUnloadHandler();
      }
      
      await this.loadRecordData();
    } else {
      console.warn("缺少必要參數，返回主頁面");
      this.goBack();
    }

    this.$nextTick(() => {
      lucide.createIcons();
    });

    document.addEventListener('click', this.handleClickOutside);
  },

  beforeUnmount() {
    document.removeEventListener('click', this.handleClickOutside);
    window.removeEventListener('beforeunload', () => {});
    window.removeEventListener('popstate', () => {});
  }
});

app.mount("#app");