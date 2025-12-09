const app = Vue.createApp({
  data() {
    return {
      username: null,
      infoname: '',
      recordId: null,
      scrollPosition: 0,
      hasUnsavedChanges: false,
      originalData: null,
      isSaving: false,
      userRole: null, // 用戶角色：管理員、編輯人、提案人、預覽人
      isReadOnly: false, // 是否為唯讀模式（控制記錄編輯）
      canComment: true,  // ✅ 新增：是否可以留言（所有人都可以留言）
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
      buildings: ["K11", 'K18', "K21", "K22", "K25"],
      allOwnersData: [],        // 存放所有員工資料
      ownerSearchResults: [],   // 存放搜尋結果
      showOwnerDropdown: false,   // 控制下拉選單顯示
      focusedOwnerIndex: -1,    // 鍵盤選擇索引

      images: [],               // 已選擇的圖片陣列
      isDragging: false,        // 拖曳狀態
      isUploading: false,       // 上傳中狀態
      showImagePreview: false,  // 圖片預覽 Modal
      previewImageUrl: '',      // 預覽圖片 URL
      previewImageName: '',     // 預覽圖片名稱

      // 留言板相關
      comments: {},                    // 留言物件 { timestamp: commentData }
      newComment: '',                  // 新留言內容
      selectedCommentImages: [],       // 選中的留言圖片
    };
  },

  computed: {
    // 排序後的留言（最新在上）
    sortedComments() {
      return Object.entries(this.comments)
        .map(([timestamp, data]) => ({
          timestamp,
          ...data
        }))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },
    
    // 留言總數
    commentCount() {
      return Object.keys(this.comments).length;
    }
  },

  methods: {
    async loadAllOwnersData() {
      try {
        console.log("正在從後端獲取員工資料...");
        
        // 使用 axios 發送 GET 請求到 Flask API
        const response = await axios.get('http://127.0.0.1:5000/api/get_all_owners' );

        // 檢查回傳的資料是否成功且包含 data 陣列
        if (response.data && response.data.status === 'success' && Array.isArray(response.data.data)) {
          this.allOwnersData = response.data.data;
          console.log(`✓ 成功從後端載入 ${this.allOwnersData.length} 筆員工資料`);
        } else {
          // 如果後端回傳的格式不對，給出警告但不清空資料
          console.warn("後端回傳的員工資料格式不正確或為空。", response.data);
          this.allOwnersData = []; // 確保在出錯時是個空陣列
        }
      } catch (error) {
        // 如果 API 請求失敗 (例如後端服務沒開)，捕獲錯誤
        console.error("❌ 無法從後端獲取員工資料:", error);
        this.allOwnersData = []; // 確保在出錯時是個空陣列，避免前端功能崩潰
        
        // (可選) 彈出提示，讓使用者知道問題
        Swal.fire({
            icon: 'error',
            title: '無法載入員工列表',
            text: '請確認後端服務是否正常運行，或聯繫系統管理員。',
            confirmButtonColor: '#ef4444'
        });
      }
    },
    
    // 【修改】當輸入框內容改變時觸發搜尋
    searchOwners() {
      if (this.isReadOnly) return;

      // 從字串中獲取最後一個正在輸入的詞
      const parts = this.recordData.專案Owner.split(',');
      const currentQuery = parts[parts.length - 1].trim().toLowerCase();

      if (!currentQuery) {
        this.ownerSearchResults = [];
        this.showOwnerDropdown = false;
        return;
      }

      this.ownerSearchResults = this.allOwnersData.filter(owner =>
        owner.姓名.toLowerCase().includes(currentQuery) ||
        owner.工號.toLowerCase().includes(currentQuery)
      );

      this.showOwnerDropdown = this.ownerSearchResults.length > 0;
      this.focusedOwnerIndex = -1;
    },

    // 【修改】從下拉選單中選擇一個 Owner
    selectOwner(owner) {
      if (this.isReadOnly) return;
      const ownerName = owner.姓名;

      // 將除了最後一個詞之外的部分保留
      let parts = this.recordData.專案Owner.split(',');
      parts.pop(); // 移除正在輸入的最後一個詞
      parts.push(ownerName); // 換上選擇的姓名

      // 過濾掉空值並重新組合字串
      this.recordData.專案Owner = parts.filter(Boolean).map(p => p.trim()).join(', ') + ', ';

      this.showOwnerDropdown = false;
      this.$nextTick(() => {
        this.$refs.ownerInputRef.focus();
      });
    },

    // 【修改】處理鍵盤操作
    handleOwnerInputKeydown(event) {
      if (this.isReadOnly) return;
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          if (this.focusedOwnerIndex < this.ownerSearchResults.length - 1) this.focusedOwnerIndex++;
          break;
        case 'ArrowUp':
          event.preventDefault();
          if (this.focusedOwnerIndex > 0) this.focusedOwnerIndex--;
          break;
        case 'Enter':
          event.preventDefault();
          if (this.focusedOwnerIndex > -1) {
            // 如果有高亮選項，選擇它
            this.selectOwner(this.ownerSearchResults[this.focusedOwnerIndex]);
          } else {
            // 如果沒有，則只是在結尾加上逗號和空格，方便繼續輸入
            let currentValue = this.recordData.專案Owner.trim();
            if (currentValue && !currentValue.endsWith(',')) {
              this.recordData.專案Owner = currentValue + ', ';
            }
          }
          break;
        case 'Escape':
          this.showOwnerDropdown = false;
          break;
      }
    },
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
          this.canComment = true;  // ✅ 可以留言
          this.permissionChecked = true;
          console.log(`✓ 用戶 ${this.username} 擁有管理員權限 - 可完整編輯`);
          return true;
        }

        // 2. 檢查編輯人權限
        if (await this.checkSinglePermission('編輯人')) {
          this.userRole = '編輯人';
          this.isReadOnly = false;
          this.canComment = true;  // ✅ 可以留言
          this.permissionChecked = true;
          console.log(`✓ 用戶 ${this.username} 擁有編輯人權限 - 可完整編輯`);
          return true;
        }

        // 3. 檢查提案人權限（只讀）
        if (await this.checkSinglePermission('提案人')) {
          this.userRole = '提案人';
          this.isReadOnly = true;
          this.canComment = true;  // ✅ 可以留言
          this.permissionChecked = true;
          console.log(`✓ 用戶 ${this.username} 擁有提案人權限`);
          // 注意：提案人是否可編輯自己的案件，將在 loadRecordData 中判斷
          // 暫不顯示唯讀對話框，待 loadRecordData 判斷是否為本人案件後再決定
          return true;
        }

        // 4. 檢查預覽人權限（✅ 可留言但不能編輯記錄）
        if (await this.checkSinglePermission('預覽人')) {
          this.userRole = '預覽人';
          this.isReadOnly = true;   // 不能編輯記錄
          this.canComment = true;   // ✅ 但可以留言
          this.permissionChecked = true;
          console.log(`✓ 用戶 ${this.username} 擁有預覽人權限 - 可查看與留言`);
          // await this.showViewModeDialog('預覽人');
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

    // 顯示 Status 鎖定提示對話框（提案人只能編輯 New 狀態）
    async showStatusLockedDialog(currentStatus) {
      await Swal.fire({
        icon: 'warning',
        title: '案件已進入處理流程',
        html: `
          <div class="text-left">
            <p class="mb-3 text-gray-600">此案件目前狀態為 <strong class="text-orange-600">${currentStatus}</strong></p>
            <p class="text-sm text-blue-600 font-medium mb-2">✓ 您可以查看所有項目內容和進度記錄</p>
            <p class="text-sm text-red-600 font-medium mb-3">✗ 提案人只能修改 <strong>New</strong> 狀態的案件</p>
            <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
              <p class="text-sm text-amber-700">
                <strong>說明：</strong>案件進入處理流程後，需由編輯人或管理員進行後續變更
              </p>
            </div>
            <p class="text-sm text-gray-500 mt-3">如需修改，請聯繫編輯人或管理員</p>
          </div>
        `,
        confirmButtonText: '了解',
        confirmButtonColor: '#f59e0b'
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
      this.recordId = urlParams.get("recordId"); // 🆕 獲取 recordId 參數
      
      // 🆕 獲取滾動位置參數
      const urlScrollPos = urlParams.get("scrollPos");
      if (urlScrollPos) {
        this.scrollPosition = parseInt(urlScrollPos);
      } else {
        // 備用方案：從 localStorage 獲取
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
      
      // 清除事件監聽器
      window.removeEventListener('beforeunload', () => {});
      window.removeEventListener('popstate', () => {});
      
      // 🆕 回到主頁面時傳遞滾動位置
      if (this.username) {
        localStorage.setItem('username', this.username);
        // 將滾動位置作為 URL 參數傳遞回主頁面
        window.location.replace(`defficultmeeting.html?username=${encodeURIComponent(this.username)}&scrollPos=${this.scrollPosition}&recordId=${this.recordId}`);
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
            // 🆕 權限判斷：提案人只能編輯自己的 New 狀態案件
            if (this.userRole === '提案人') {
              if (this.recordData.提案人 === this.username) {
                // 提案人是本人，檢查 Status
                if (this.recordData.Status === 'New') {
                  // Status 為 New，允許編輯
                  this.isReadOnly = false;
                  console.log(`✅ 提案人 ${this.username} 可修改自己的 New 狀態案件`);
                } else {
                  // Status 不是 New，不允許編輯
                  this.isReadOnly = true;
                  console.log(`🔒 提案人 ${this.username} 無法修改非 New 狀態的案件 (當前狀態: ${this.recordData.Status})`);
                  await this.showStatusLockedDialog(this.recordData.Status);
                }
              } else {
                // 提案人不是本人，強制唯讀
                this.isReadOnly = true;
                console.log(`🔒 提案人 ${this.username} 僅可查看他人案件`);
                await this.showViewModeDialog('提案人');
              }
            } else if (this.userRole === '預覽人') {
              // 預覽人始終唯讀
              this.isReadOnly = true;
              await this.showViewModeDialog('預覽人');
            }
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
        // 如果真的是唯讀（例如看別人案件），才提示
        if (!silent) {
          this.checkOperationPermission(); // 會提示 + reset
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
          if (item.field === '棟別Array' || item.field === '樓層Array') {
            if (!item.value || (Array.isArray(item.value) && item.value.length === 0)) {
              missingFields.push(item.label);
            }
          } else {
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
        // ✅ 改進：加上防禦性檢查
        const payload = {
          ...this.recordData,
          棟別: this.recordData.棟別Array.includes('全棟別') 
            ? '全棟別' 
            : this.arrayToString(this.recordData.棟別Array),
          樓層: this.recordData.樓層Array.includes('全樓層') 
            ? '全樓層' 
            : this.arrayToString(this.recordData.樓層Array),
          站點: typeof this.recordData.站點 === 'string' 
            ? this.recordData.站點.trim() 
            : '',
          // ✅ 加上專案Owner的清理
          專案Owner: typeof this.recordData.專案Owner === 'string'
            ? this.recordData.專案Owner.trim().replace(/,\s*$/, '') // 移除結尾的逗號
            : ''
        };
        
        delete payload.棟別Array;
        delete payload.樓層Array;
        delete payload.進度紀錄;

        console.log("準備儲存資料:", payload);

        // ✅ 圖片已在選擇時立即上傳，這裡不需要再上傳
        // 檢查是否有未上傳的圖片（理論上不應該有）
        const newImages = this.images.filter(img => !img.existing && img.file);
        if (newImages.length > 0) {
          console.warn('⚠️ 發現未上傳的圖片，正在上傳...');
          const uploadResult = await this.uploadImages();
          if (!uploadResult.success) {
            return false;
          }
        }
        
        const response = await axios.put(
          `http://127.0.0.1:5000/api/update_record?username=${encodeURIComponent(this.username)}`, 
          payload
        );

        if (response.data && response.data.status === 'success') {
          // 更新原始資料
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
          
          // 儲存當前滾動位置到 localStorage
          localStorage.setItem(`scrollPosition_${this.recordId}`, this.scrollPosition);
          
          console.log("📌 儲存時記錄滾動位置:", this.scrollPosition);
          
          // 💾 保存當前滾動位置（Alert 前）
          const scrollContainer = document.querySelector('.content-left');
          const savedScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
          
          // 顯示成功訊息並提供選擇
          if (!silent) {
            const totalImages = this.images.length;
            
            const result = await Swal.fire({
              icon: 'success',
              title: '儲存成功',
              html: `
                <div class="text-left">
                  <p class="mb-3 text-gray-700">會議記錄已成功更新</p>
                  ${totalImages > 0 ? `
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                      <p class="text-sm text-blue-700 flex items-center gap-2">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"/>
                        </svg>
                        共有 ${totalImages} 張圖片
                      </p>
                    </div>
                  ` : ''}
                  <p class="text-sm text-gray-600">請選擇接下來的操作：</p>
                </div>
              `,
              showCancelButton: true,
              confirmButtonText: '返回上一頁',
              cancelButtonText: '留在本頁',
              confirmButtonColor: '#3b82f6',
              cancelButtonColor: '#6b7280',
              reverseButtons: true,
              didClose: () => {
                // 🔄 恢復滾動位置
                if (scrollContainer) {
                  scrollContainer.scrollTop = savedScrollTop;
                }
              }
            });
            
            if (result.isConfirmed) {
              // 用戶選擇返回上一頁
              const returnUrl = `defficultmeeting.html?username=${encodeURIComponent(this.username)}&scrollPos=${this.scrollPosition}`;
              console.log("📌 準備返回主頁面，URL:", returnUrl);
              window.location.href = returnUrl;
            } else {
              // 用戶選擇留在本頁
              console.log("✓ 用戶選擇留在本頁");
              // 重新載入圖片以確保狀態同步
              await this.loadExistingImages();
              this.hasUnsavedChanges = false;
            }
          } else {
            // silent 模式，直接返回
            return true;
          }
          
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
    },
      async getUserInfoName(){
        try {
            const response = await axios.get(`http://127.0.0.1:5000/api/getinfoname`, {
              params: { username: this.username }  // 傳遞當前使用者
            });

            if (response.data.status === 'success') {
                console.log("✅ infoname:", response.data.姓名);  // ✅ 改這裡
                this.infoname = response.data.姓名
            } else {
                console.warn('⚠️ 後端沒有儲存的篩選資料');
            }
        } catch (error) {
            console.error('❌ 載入篩選狀態失敗:', error);
        }
    },


handleImageUpload(event) {
  if (this.isReadOnly) {
    Swal.fire({
      icon: 'warning',
      title: '權限不足',
      text: '唯讀模式下無法上傳圖片',
      confirmButtonColor: '#ef4444'
    });
    return;
  }

  const files = Array.from(event.target.files);
  this.processImages(files);
  event.target.value = '';
},

// 📸 處理拖曳上傳
handleDrop(event) {
  if (this.isReadOnly) return;
  
  this.isDragging = false;
  const files = Array.from(event.dataTransfer.files);
  const imageFiles = files.filter(file => file.type.startsWith('image/'));
  
  if (imageFiles.length > 0) {
    this.processImages(imageFiles);
  } else {
    Swal.fire({
      icon: 'warning',
      title: '無效的檔案',
      text: '請上傳圖片檔案（PNG、JPG、GIF、WebP）',
      confirmButtonColor: '#f59e0b'
    });
  }
},

// 📸 處理圖片檔案（選擇後立即上傳）
async processImages(files) {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
  
  // 驗證所有檔案
  const validFiles = [];
  for (const file of files) {
    if (!validTypes.includes(file.type)) {
      Swal.fire({
        icon: 'error',
        title: '不支援的檔案格式',
        text: `${file.name} 不是有效的圖片格式`,
        confirmButtonColor: '#ef4444',
        scrollbarPadding: false,
        heightAuto: false
      });
      continue;
    }
    
    if (file.size > maxSize) {
      Swal.fire({
        icon: 'error',
        title: '檔案過大',
        text: `${file.name} 超過 10MB 限制`,
        confirmButtonColor: '#ef4444',
        scrollbarPadding: false,
        heightAuto: false
      });
      continue;
    }
    
    validFiles.push(file);
  }
  
  if (validFiles.length === 0) return;
  
  // 顯示上傳中提示
  Swal.fire({
    title: '上傳中...',
    html: `正在上傳 ${validFiles.length} 張圖片`,
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    scrollbarPadding: false,
    heightAuto: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });
  
  try {
    // 立即上傳圖片
    const formData = new FormData();
    formData.append('record_id', this.recordData.id);
    
    validFiles.forEach((file) => {
      formData.append('images', file);
    });
    
    console.log(`準備上傳 ${validFiles.length} 張圖片`);
    
    const response = await axios.post(
      `http://127.0.0.1:5000/api/upload_meeting_images?username=${encodeURIComponent(this.username)}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    );
    
    if (response.data && response.data.status === 'success') {
      console.log('圖片上傳成功:', response.data.uploaded);
      
      // 將上傳成功的圖片加入到圖片列表
      response.data.uploaded.forEach(uploadedImg => {
        this.images.push({
          url: this.getMeetingImageUrl(uploadedImg.filename),
          name: uploadedImg.filename,
          filename: uploadedImg.filename,
          file: null,
          existing: true  // 已經上傳到服務器
        });
      });
      
      // 關閉上傳中提示
      Swal.close();
      
      // 顯示成功提示
      Swal.fire({
        icon: 'success',
        title: '上傳成功',
        text: `成功上傳 ${validFiles.length} 張圖片`,
        timer: 1500,
        showConfirmButton: false,
        scrollbarPadding: false,
        heightAuto: false
      });
      
      // 刷新圖標
      this.$nextTick(() => {
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }
      });
      
    } else {
      throw new Error(response.data?.message || '上傳失敗');
    }
  } catch (error) {
    console.error('圖片上傳失敗:', error);
    
    Swal.fire({
      icon: 'error',
      title: '上傳失敗',
      text: error.response?.data?.message || error.message || '請稍後再試',
      confirmButtonColor: '#ef4444',
      scrollbarPadding: false,
      heightAuto: false
    });
  }
},

// 📸 移除單張圖片
async removeImage(index) {
  if (this.isReadOnly) return;
  
  const image = this.images[index];
  
  // 💾 保存當前滾動位置
  const scrollContainer = document.querySelector('.content-left');
  const savedScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
  const result = await Swal.fire({
    title: '確認刪除',
    html: `
      <div class="text-left">
        <p class="mb-2">確定要刪除這張圖片嗎？</p>
        <p class="text-sm text-gray-600">檔案名稱: <span class="font-medium">${image.name}</span></p>
        <p class="text-sm text-red-600 mt-2">⚠️ 圖片刪除後將無法復原</p>
      </div>
    `,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#6b7280',
    confirmButtonText: '確認刪除',
    cancelButtonText: '取消',
    scrollbarPadding: false,
    heightAuto: false,
    willOpen: () => {
      // 🔒 鎖定背景滾動位置
      document.body.style.overflow = 'hidden';
    },
    didClose: () => {
      // 🔓 解鎖背景滾動
      document.body.style.overflow = '';
      // 🔄 恢復滾動位置
      if (scrollContainer) {
        scrollContainer.scrollTop = savedScrollTop;
      }
    }
  });
  
  if (!result.isConfirmed) return;
  
  // ✅ 所有圖片都是已上傳狀態，直接從服務器刪除
  if (image.existing) {
    try {
      const response = await axios.post(
        `http://127.0.0.1:5000/api/delete_meeting_image?username=${encodeURIComponent(this.username)}`,
        {
          record_id: this.recordData.id,
          filename: image.filename
        }
      );
      
      if (response.data && response.data.status === 'success') {
        this.images.splice(index, 1);
        
        // 💾 保存滾動位置（成功提示前）
        const currentScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
        Swal.fire({
          icon: 'success',
          title: '已刪除',
          text: '圖片已從伺服器移除',
          timer: 1500,
          showConfirmButton: false,
          scrollbarPadding: false,
          heightAuto: false,
          didClose: () => {
            if (scrollContainer) {
              scrollContainer.scrollTop = currentScrollTop;
            }
          }
        });
      } else {
        throw new Error(response.data.message || '刪除失敗');
      }
    } catch (error) {
      console.error('刪除圖片失敗:', error);
      
      // 💾 保存滾動位置（錯誤提示前）
      const currentScrollTop2 = scrollContainer ? scrollContainer.scrollTop : 0;
      Swal.fire({
        icon: 'error',
        title: '刪除失敗',
        text: error.message || '無法刪除圖片，請稍後再試',
        confirmButtonColor: '#ef4444',
        scrollbarPadding: false,
        heightAuto: false,
        didClose: () => {
          if (scrollContainer) {
            scrollContainer.scrollTop = currentScrollTop2;
          }
        }
      });
    }
  } else {
    this.images.splice(index, 1);
    this.hasUnsavedChanges = true;
    
    // 💾 保存滾動位置（成功提示前）
    const currentScrollTop3 = scrollContainer ? scrollContainer.scrollTop : 0;
    Swal.fire({
      icon: 'success',
      title: '已移除',
      timer: 1000,
      showConfirmButton: false,
      scrollbarPadding: false,
      heightAuto: false,
      didClose: () => {
        // 🔄 恢復滾動位置
        if (scrollContainer) {
          scrollContainer.scrollTop = currentScrollTop3;
        }
      }
    });
  }
},

// 📸 清除所有圖片
async clearAllImages() {
  if (this.isReadOnly) return;
  
  const totalCount = this.images.length;
  
  // 💾 保存當前滾動位置
  const scrollContainer = document.querySelector('.content-left');
  const savedScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
  
  const result = await Swal.fire({
    title: '確認清除',
    html: `
      <div class="text-left">
        <p class="mb-3">確定要清除所有圖片嗎？</p>
        <div class="bg-red-50 border border-red-200 rounded-lg p-3">
          <p class="text-sm text-red-700">
            將刪除 ${totalCount} 張圖片
          </p>
        </div>
        <p class="text-sm text-red-600 mt-3">⚠️ 圖片刪除後無法復原！</p>
      </div>
    `,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#6b7280',
    confirmButtonText: '確認清除全部',
    cancelButtonText: '取消',
    scrollbarPadding: false,
    heightAuto: false,
    willOpen: () => {
      document.body.style.overflow = 'hidden';
    },
    didClose: () => {
      document.body.style.overflow = '';
      // 🔄 恢復滾動位置
      if (scrollContainer) {
        scrollContainer.scrollTop = savedScrollTop;
      }
    }
  });
  
  if (!result.isConfirmed) return;
  
  const existingImages = this.images.filter(img => img.existing);
  if (existingImages.length > 0) {
    try {
      const deletePromises = existingImages.map(img => 
        axios.post(
          `http://127.0.0.1:5000/api/delete_meeting_image?username=${encodeURIComponent(this.username)}`,
          {
            record_id: this.recordData.id,
            filename: img.filename
          }
        )
      );
      
      await Promise.all(deletePromises);
      
      
      // 💾 保存滾動位置（成功提示前）
      const currentScrollTop4 = scrollContainer ? scrollContainer.scrollTop : 0;
      Swal.fire({
        icon: 'success',
        title: '已清除全部',
        text: `成功刪除 ${this.images.length} 張圖片`,
        timer: 1500,
        showConfirmButton: false,
        scrollbarPadding: false,
        heightAuto: false,
        didClose: () => {
          // 🔄 恢復滾動位置
          if (scrollContainer) {
            scrollContainer.scrollTop = currentScrollTop4;
          }
        }
      });
    } catch (error) {
      console.error('批量刪除圖片失敗:', error);
      
      // 💾 保存滾動位置（錯誤提示前）
      const currentScrollTop5 = scrollContainer ? scrollContainer.scrollTop : 0;
      Swal.fire({
        icon: 'error',
        title: '部分刪除失敗',
        text: '部分圖片無法刪除，請稍後再試',
        confirmButtonColor: '#ef4444',
        scrollbarPadding: false,
        heightAuto: false,
        didClose: () => {
          // 🔄 恢復滾動位置
          if (scrollContainer) {
            scrollContainer.scrollTop = currentScrollTop5;
          }
        }
      });
      return;
    }
  } else {
    
    // 💾 保存滾動位置（成功提示前）
    const currentScrollTop6 = scrollContainer ? scrollContainer.scrollTop : 0;
    Swal.fire({
      icon: 'success',
      title: '已清除全部',
      timer: 1000,
      showConfirmButton: false,
      scrollbarPadding: false,
      heightAuto: false,
      didClose: () => {
        // 🔄 恢復滾動位置
        if (scrollContainer) {
          scrollContainer.scrollTop = currentScrollTop6;
        }
      }
    });
  }
  
  this.images = [];
  this.hasUnsavedChanges = true;
},

// 📸 打開圖片預覽
openImagePreview(url, name) {
  this.previewImageUrl = url;
  this.previewImageName = name;
  this.showImagePreview = true;
  document.addEventListener('keydown', this.handlePreviewKeydown);
},

// 📸 關閉圖片預覽
closeImagePreview() {
  this.showImagePreview = false;
  this.previewImageUrl = '';
  this.previewImageName = '';
  document.removeEventListener('keydown', this.handlePreviewKeydown);
},

// 📸 處理預覽的鍵盤事件
handlePreviewKeydown(event) {
  if (event.key === 'Escape') {
    this.closeImagePreview();
  }
},

// 📸 上傳圖片到伺服器（只上傳新增的圖片）
async uploadImages() {
  const newImages = this.images.filter(img => !img.existing && img.file);
  
  if (newImages.length === 0) {
    return { success: true, images: [] };
  }
  
  this.isUploading = true;
  
  try {
    const formData = new FormData();
    formData.append('record_id', this.recordData.id);
    
    newImages.forEach((img) => {
      formData.append('images', img.file);
    });
    
    console.log(`準備上傳 ${newImages.length} 張新圖片`);
    
    const response = await axios.post(
      `http://127.0.0.1:5000/api/upload_meeting_images?username=${encodeURIComponent(this.username)}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    );
    
    this.isUploading = false;
    
    if (response.data && response.data.status === 'success') {
      console.log('圖片上傳成功:', response.data.uploaded);
      
      // ✅ 將新上傳的圖片標記為已存在，並使用 API 端點獲取圖片
      newImages.forEach((img, index) => {
        const imgIndex = this.images.indexOf(img);
        if (imgIndex !== -1 && response.data.uploaded[index]) {
          this.images[imgIndex].existing = true;
          this.images[imgIndex].filename = response.data.uploaded[index].filename;
          this.images[imgIndex].url = this.getMeetingImageUrl(response.data.uploaded[index].filename);  // ✅ 使用 API 端點
        }
      });
      
      return { 
        success: true, 
        images: response.data.uploaded 
      };
    } else {
      throw new Error(response.data.message || '上傳失敗');
    }
  } catch (error) {
    this.isUploading = false;
    console.error('圖片上傳失敗:', error);
    
    await Swal.fire({
      icon: 'error',
      title: '圖片上傳失敗',
      text: error.message || '請稍後再試',
      confirmButtonColor: '#ef4444'
    });
    
    return { success: false, images: [] };
  }
},

// 📸 載入該項目已存在的所有圖片
async loadExistingImages() {
  try {
    console.log(`正在載入項目 ${this.recordData.id} 的圖片...`);
    
    const response = await axios.get(
      `http://127.0.0.1:5000/api/get_meeting_images/${this.recordData.id}?username=${encodeURIComponent(this.username)}`
    );
    
    if (response.data && response.data.status === 'success' && response.data.images) {
      this.images = response.data.images.map(img => {
        const imageUrl = this.getMeetingImageUrl(img.filename);
        console.log(`🖼️ 載入圖片: ${img.filename} -> ${imageUrl}`);  // ✅ 調試信息
        return {
          url: imageUrl,  // ✅ 使用 API 端點而不是相對路徑
          name: img.filename,
          filename: img.filename,
          file: null,
          existing: true
        };
      });
      
      console.log(`✓ 成功載入 ${this.images.length} 張圖片`);
      console.log(`📋 圖片列表:`, this.images);  // ✅ 調試信息
    } else {
      console.log('該項目沒有圖片');
      this.images = [];
    }
  } catch (error) {
    console.error('載入圖片失敗:', error);
    this.images = [];
  }
},

// ==================== 💬 留言板相關方法 ====================

// 載入留言
async loadComments() {
  try {
    console.log(`正在載入項目 ${this.recordData.id} 的留言...`);
    const response = await axios.get(
      `http://127.0.0.1:5000/api/get_comments/${this.recordData.id}?username=${encodeURIComponent(this.username)}`
    );
    
    if (response.data && response.data.status === 'success') {
      this.comments = response.data.data || {};
      console.log(`✓ 成功載入 ${this.commentCount} 則留言`);
      
      // ✅ 載入完成後重新初始化 Lucide Icons
      this.$nextTick(() => {
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
          console.log('✓ Lucide Icons 已重新初始化');
        }
      });
    }
  } catch (error) {
    console.error('載入留言失敗:', error);
    this.comments = {};
  }
},

// 選擇留言圖片
selectCommentImages() {
  this.$refs.commentImageInput.click();
},

// 處理留言圖片選擇
handleCommentImageSelect(event) {
  const files = Array.from(event.target.files);
  const maxSize = 10 * 1024 * 1024; // 10MB (提高單檔限制)
  const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
  
  // ✅ 已移除圖片數量限制 - 可以上傳任意張數
  
  files.forEach(file => {
    if (!validTypes.includes(file.type)) {
      Swal.fire({
        icon: 'error',
        title: '不支援的檔案格式',
        text: `${file.name} 不是有效的圖片格式`,
        confirmButtonColor: '#ef4444',
        scrollbarPadding: false,
        heightAuto: false
      });
      return;
    }
    
    if (file.size > maxSize) {
      Swal.fire({
        icon: 'error',
        title: '檔案過大',
        text: `${file.name} 超過 10MB 限制`,
        confirmButtonColor: '#ef4444',
        scrollbarPadding: false,
        heightAuto: false
      });
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      this.selectedCommentImages.push({
        file: file,
        url: e.target.result,
        name: file.name
      });
    };
    reader.readAsDataURL(file);
  });
  
  event.target.value = '';
},

// 移除選中的留言圖片
removeSelectedCommentImage(index) {
  this.selectedCommentImages.splice(index, 1);
},

// 發送留言
async postComment() {
  if (!this.newComment.trim() && this.selectedCommentImages.length === 0) {
    Swal.fire({
      icon: 'warning',
      title: '請輸入留言內容或選擇圖片',
      confirmButtonColor: '#8b5cf6',
      scrollbarPadding: false,
      heightAuto: false
    });
    return;
  }
  
  try {
    const timestamp = Date.now().toString();
    
    // 1. 先創建留言記錄（直接傳送 display_name 和 role）
    const response = await axios.post(
      `http://127.0.0.1:5000/api/add_comment?username=${encodeURIComponent(this.username)}`,
      {
        record_id: this.recordData.id,
        content: this.newComment,
        timestamp: timestamp,
        display_name: this.infoname || this.username,  // 直接使用前端的 infoname
        role: this.userRole || '未知'                   // 直接使用前端的 userRole
      }
    );
    
    if (response.data && response.data.status === 'success') {
      // 2. 如果有圖片，上傳圖片
      if (this.selectedCommentImages.length > 0) {
        await this.uploadCommentImages(timestamp);
      }
      
      // 3. 重新載入留言
      await this.loadComments();
      
      // 4. 清空輸入
      this.newComment = '';
      this.selectedCommentImages = [];
      
      // 5. 滾動到最新留言並刷新圖標
      this.$nextTick(() => {
        const commentList = document.querySelector('.w-\\[30\\%\\]:last-child .overflow-y-auto');
        if (commentList) {
          commentList.scrollTop = 0;
        }
        
        // 重新初始化 Lucide Icons（重要！）
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }
      });
      
      Swal.fire({
        icon: 'success',
        title: '留言已發布',
        timer: 1500,
        showConfirmButton: false,
        scrollbarPadding: false,
        heightAuto: false
      });
    }
  } catch (error) {
    console.error('發送留言失敗:', error);
    Swal.fire({
      icon: 'error',
      title: '發送失敗',
      text: '無法發送留言，請稍後再試',
      confirmButtonColor: '#ef4444',
      scrollbarPadding: false,
      heightAuto: false
    });
  }
},

// 上傳留言圖片
async uploadCommentImages(timestamp) {
  const formData = new FormData();
  formData.append('record_id', this.recordData.id);
  formData.append('timestamp', timestamp);
  
  this.selectedCommentImages.forEach(img => {
    formData.append('images', img.file);
  });
  
  try {
    await axios.post(
      `http://127.0.0.1:5000/api/upload_comment_images?username=${encodeURIComponent(this.username)}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    );
    console.log('✓ 留言圖片上傳成功');
  } catch (error) {
    console.error('上傳留言圖片失敗:', error);
    throw error;
  }
},

// 獲取留言圖片 URL
getCommentImageUrl(filename) {
  return `http://127.0.0.1:5000/api/get_comment_image/${this.recordData.id}/${filename}?username=${encodeURIComponent(this.username)}`;
},

// ✅ 獲取會議圖片 URL（新增）
getMeetingImageUrl(filename) {
  return `http://127.0.0.1:5000/api/get_meeting_image/${this.recordData.id}/${filename}?username=${encodeURIComponent(this.username)}`;
},

// 查看留言圖片
viewCommentImage(url, name = '留言圖片') {
  this.previewImageUrl = url;
  this.previewImageName = name;
  this.showImagePreview = true;
},

// 格式化留言時間
formatCommentTime(datetime) {
  if (!datetime) return '';
  
  const date = new Date(datetime);
  const now = new Date();
  const diff = now - date;
  
  // 1分鐘內
  if (diff < 60000) {
    return '剛剛';
  }
  // 1小時內
  if (diff < 3600000) {
    return `${Math.floor(diff / 60000)} 分鐘前`;
  }
  // 今天
  if (date.toDateString() === now.toDateString()) {
    return `今天 ${date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`;
  }
  // 昨天
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `昨天 ${date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`;
  }
  // 其他
  return date.toLocaleString('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
},

// 獲取角色徽章樣式
getRoleBadgeClass(role) {
  const classes = {
    '管理員': 'bg-red-100 text-red-600',
    '編輯人': 'bg-blue-100 text-blue-600',
    '提案人': 'bg-green-100 text-green-600',
    '預覽人': 'bg-gray-100 text-gray-600'
  };
  return classes[role] || 'bg-gray-100 text-gray-600';
},

// 判斷是否可以刪除留言
canDeleteComment(comment) {
  if (!comment) {
    console.log('❌ canDeleteComment: comment is null/undefined');
    return false;
  }
  
  console.log('🔍 檢查刪除權限:', {
    commentUsername: comment.username,
    currentUsername: this.username,
    userRole: this.userRole,
    isAdmin: this.userRole === '管理員',
    isOwner: comment.username === this.username
  });
  
  // 管理員可以刪除所有留言
  if (this.userRole === '管理員') {
    console.log('✅ 管理員權限，可以刪除');
    return true;
  }
  
  // 用戶可以刪除自己的留言
  const canDelete = comment.username === this.username;
  console.log(canDelete ? '✅ 是自己的留言，可以刪除' : '❌ 不是自己的留言，不能刪除');
  return canDelete;
},

// 刪除留言
async deleteComment(timestamp) {
  const result = await Swal.fire({
    title: '確認刪除',
    text: '確定要刪除這則留言嗎？',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#6b7280',
    confirmButtonText: '確認刪除',
    cancelButtonText: '取消',
    scrollbarPadding: false,
    heightAuto: false
  });
  
  if (!result.isConfirmed) return;
  
  try {
    const response = await axios.delete(
      `http://127.0.0.1:5000/api/delete_comment?username=${encodeURIComponent(this.username)}`,
      {
        data: {
          record_id: this.recordData.id,
          timestamp: timestamp
        }
      }
    );
    
    if (response.data && response.data.status === 'success') {
      await this.loadComments();
      
      // 刷新圖標
      this.$nextTick(() => {
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }
      });
      
      Swal.fire({
        icon: 'success',
        title: '已刪除',
        timer: 1500,
        showConfirmButton: false,
        scrollbarPadding: false,
        heightAuto: false
      });
    }
  } catch (error) {
    console.error('刪除留言失敗:', error);
    Swal.fire({
      icon: 'error',
      title: '刪除失敗',
      text: '無法刪除留言，請稍後再試',
      confirmButtonColor: '#ef4444',
      scrollbarPadding: false,
      heightAuto: false
    });
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
    this.loadAllOwnersData();
    this.newProgressRecord = this.getTodayDatePrefix();
    this.getUserInfoName();
    if (!this.username || !this.recordId) {
      this.goBack();
      return;
    }

    // 1️⃣ 先檢查基本權限（是否為管理員/編輯人/提案人/預覽人）
    const hasPermission = await this.checkUserPermission();
    if (!hasPermission) return;

    // 2️⃣ 再載入記錄資料
    await this.loadRecordData();

    // ✅ 載入已存在的圖片
    if (this.recordId) {
      await this.loadExistingImages();
    }

    // ✅ 載入留言
    if (this.recordId) {
      await this.loadComments();
    }

    // 3️⃣ 載完後，針對「提案人」做「是否本人」的最終判斷
    if (this.userRole === '提案人') {
      if (this.infoname === this.recordData.提案人 && this.recordData.Status === 'New') {
        this.isReadOnly = false;
        console.log(`提案人: ${this.recordData.提案人}`)
        console.log(`✅ 提案人 ${this.username} 可修改自己的案件`);
      } else {
        this.isReadOnly = true;
        console.log(`🔒 提案人 ${this.username} 僅可查看他人案件`);
        // await this.showViewModeDialog('提案人'); // ✅ 只彈一次
      }
    }

    // 4️⃣ 設置離開頁面監聽（僅非唯讀）
    if (!this.isReadOnly) {
      this.setupBeforeUnloadHandler();
    }

    this.$nextTick(() => 
      lucide.createIcons()
    );
    document.addEventListener('click', this.handleClickOutside);
  },

  beforeUnmount() {
    document.removeEventListener('click', this.handleClickOutside);
    window.removeEventListener('beforeunload', () => {});
    window.removeEventListener('popstate', () => {});
  }
});

app.mount("#app");