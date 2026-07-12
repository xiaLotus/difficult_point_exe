const app = Vue.createApp({
  data() {
    return {
      username: null,
      // 使用者中文名
      infoname: "",
      records: [],
      showAddModal: false,
      ownerInput: "",   // 專案Owner輸入框的值
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
      showCategoryDropdown: false,
      categories: ["專案", "工作"], // 類別

      caseCategories: ["公安", "品質(死貨)", "效率(產能)", "資安", "日常"], // 新增：案件分類選項
      showCaseCategoryDropdown: false, // 新增：案件分類下拉狀態
      
      // 🆕 新增滾動 Toast 相關屬性
      showScrollToast: false,
      scrollProgress: 0,
      scrollToastTimer: null,

      daysAgoSortOrder: null,
      showDateFilter: false,
      checkedDates: [], 
      // 棟別篩選相關
      showBuildingFilter: false,
      checkedBuildings: [], // 已選中的棟別
      // 樓層篩選相關
      showFloorFilter: false,
      checkedFloors: [], // 已選中的樓層

      // 站點篩選相關
      showStationFilter: false,
      checkedStations: [], // 已選中的站點

      // 類別篩選相關
      showCategoryFilter: false,
      checkedCategories: [], // 已選中的類別

      // 提案人篩選相關
      showProposerFilter: false,
      checkedProposers: [], // 已選中的提案人


      // 問題描述篩選相關
      showDescriptionFilter: false,
      checkedDescriptions: [], // 已選中的問題描述關鍵字
      descriptionSearchText: '', // 問題描述內部搜尋

      // 案件分類篩選相關
      showCaseCategoriesFilter: false,
      checkedCaseCategories: [],

      // Status 分類篩選相關
      showStatusFilter: false,
      checkedStatus: [],

      // PDCA 篩選相關
      showPDCAFilter: false,
      checkedPDCA: [],

      // 專案Owner 篩選相關
      showProjectOwnerFilter: false,
      checkedProjectOwners: [],

      // 截止日期 篩選相關
      showDueDateFilter: false,
      checkedDueDates: [],

      // 項目DueDate 篩選相關
      showItemDueDateFilter: false,
      checkedItemDueDates: [],

      // 🆕 新增欄位顯示/隱藏功能
      showColumnSettings: false,
      columnVisibility: {
        '項次': false,
        '提案日期': true,
        '距今': false,
        '棟別': true,
        '樓層': true,
        '站點': true,
        '類別': true,
        '提案人': true,
        '案件分類': true,
        '問題描述': true,
        'PDCA': false,  // 預設隱藏
        '截止日期': false,  // 預設隱藏
        '專案Owner': true,  
        '換算金額': true,  // 僅管理員可見
        '項目DueDate': false,  // 預設隱藏
        '進度紀錄': true,
        '留言討論': true,
        'Status': true,
        '操作': true
      },
      selectedRowId: null,  // 記憶最後一次選擇的 id
      hoverRowId: null,
      isDataReady: false,
      // 新增的變數
      showMobileColumnSettings: false, // 控制小螢幕欄位設定卡片的顯示
      showMobileMenu: false,           // 控制小螢幕漢堡選單的顯示
      filterSaveTimer: null,  // ✅ 加上這個
      isLoadingFilters: false, // ✅ 加上這個

      images: [],           // { file: File, url: objectURL }
      isDragging: false,    // 拖曳狀態
      isUploading: false,    // 上傳中狀態
      // 圖片預覽相關
      showImagePreview: false,
      previewImageUrl: '',
      previewImageName: '',
      
      // Tooltip 相關
      tooltip: {
        visible: false,
        content: '',
        x: 0,
        y: 0
      },

      // ===== 未讀通知相關（新增） =====
      unreadCount: 0,              // 未讀總數
      unreadItems: [],          // 未讀提案列表
      showUnreadPanel: false,      // 是否顯示未讀面板
   
    };
  },

  computed: {
    message() {
      const roleText = this.userRole === 'admin' ? '管理員' : 
                     this.userRole === 'editor' ? '編輯人' : '提案人';
      return this.username
        ? `當前使用者 ${this.infoname} (${roleText})`
        : "您現在是未知，無法查看任何資訊，請重新登入";
    },

    recordsWithDaysAgo() {
      // 先加上距今天數和樣式
      const recordsWithDays = this.records.map(record => ({
        ...record,
        距今: this.calculateDaysAgo(record.提案日期, record.Status),
        距今樣式: this.getDaysAgoClass(record.提案日期, record.Status)
      }));

      // 根據排序狀態進行排序
      if (this.daysAgoSortOrder === 'asc') {
        // 升序：距今天數少的在前，空值放最後
        return recordsWithDays.sort((a, b) => {
          if (a.距今 === '' && b.距今 === '') return 0;
          if (a.距今 === '') return 1;   // a 空 → 後面
          if (b.距今 === '') return -1;  // b 空 → 後面
          return a.距今 - b.距今;
        });
      } else if (this.daysAgoSortOrder === 'desc') {
        // 降序：距今天數多的在前，空值放最後
        return recordsWithDays.sort((a, b) => {
          if (a.距今 === '' && b.距今 === '') return 0;
          if (a.距今 === '') return 1;
          if (b.距今 === '') return -1;
          return b.距今 - a.距今;
        });
      } else {
        // 默認排序：按項次（時間戳記）降序排列，最新的在前
        return recordsWithDays.sort((a, b) => {
          const aTime = parseInt(a.項次) || 0;
          const bTime = parseInt(b.項次) || 0;
          return bTime - aTime;
        });
      }
    },

    filteredDescriptions() {
      if (!this.descriptionSearchText) {
        return this.uniqueDescriptions;
      }
      const searchText = this.descriptionSearchText.toLowerCase();
      return this.uniqueDescriptions.filter(desc => 
        desc.toLowerCase().includes(searchText)
      );
    },

    // 在帶有距今天數的資料基礎上進行過濾
    filteredData() {
        // 使用已經計算好距今天數的資料作為基礎
        const baseData = this.recordsWithDaysAgo;
        
        return baseData.filter(record => {
            // 提案日期篩選
            if (!record['提案日期']) return false;
            
            let formattedProposalDate;
            
            // 處理 8 位數格式 (YYYYMMDD)
            if (String(record['提案日期']).length === 8) {
                const dateStr = String(record['提案日期']);
                formattedProposalDate = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
            }
            // 處理已經包含斜線的格式
            else if (String(record['提案日期']).includes('/') && String(record['提案日期']).length >= 7) {
                const parts = String(record['提案日期']).split('/');
                formattedProposalDate = `${parts[0]}/${parts[1].padStart(2, '0')}`;
            }
            // 其他格式直接使用
            else {
                formattedProposalDate = String(record['提案日期']);
            }

            // 截止日期篩選
            let formattedDueDate;
            if (String(record['截止日期']).length === 8) {
              const dateStr = String(record['截止日期']);
              formattedDueDate = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
            } else if (String(record['截止日期']).includes('/') && String(record['截止日期']).length >= 7) {
              const parts = String(record['截止日期']).split('/');
              formattedDueDate = `${parts[0]}/${parts[1].padStart(2, '0')}`;
            } else {
              formattedDueDate = String(record['截止日期']);
            }

            // 項目DueDate 篩選
            let formattedItemDueDate;
            if (String(record['項目DueDate']).length === 8) {
              const dateStr = String(record['項目DueDate']);
              formattedItemDueDate = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
            } else if (String(record['項目DueDate']).includes('/') && String(record['項目DueDate']).length >= 7) {
              const parts = String(record['項目DueDate']).split('/');
              formattedItemDueDate = `${parts[0]}/${parts[1].padStart(2, '0')}`;
            } else {
              formattedItemDueDate = String(record['項目DueDate']);
            }

            // 檢查提案日期是否符合篩選條件
            const matchProposalDate = this.checkedDates.length === 0 || this.checkedDates.includes(formattedProposalDate);
            // 新增棟別篩選邏輯
            const matchBuilding = this.checkedBuildings.length === 0 || this.checkBuildingMatch(record['棟別']);
            // 新增樓層篩選
            const matchFloor = this.checkedFloors.length === 0 || this.checkFloorMatch(record['樓層']);
            // 新增站點篩選
            const matchStation = this.checkedStations.length === 0 || this.checkStationMatch(record['站點']);
            // 類別篩選 - 簡單直接比對
            const matchCategory = this.checkedCategories.length === 0 || 
                                this.checkedCategories.includes(record['類別']);
            
            const matchProposer = this.checkedProposers.length === 0 || this.checkedProposers.includes(record['提案人']);
                    // 問題描述篩選
            const matchDescription = this.checkedDescriptions.length === 0 || this.checkDescriptionMatch(record['問題描述']);
            const matchCaseCategory = this.checkedCaseCategories.length === 0 || this.checkedCaseCategories.includes(record['案件分類']);
            const matchStatus = this.checkedStatus.length === 0 || this.checkedStatus.includes(record['Status']);
            const matchPDCA = this.checkedPDCA.length === 0 || this.checkedPDCA.includes(record['PDCA']);
            const matchProjectOwner = this.checkedProjectOwners.length === 0 ||
              this.checkedProjectOwners.some(owner =>
                (record['專案Owner'] || '').split(',').map(o => o.trim()).includes(owner)
              );
            const matchDueDate = this.checkedDueDates.length === 0 || this.checkedDueDates.includes(formattedDueDate);
            const matchItemDueDate = this.checkedItemDueDates.length === 0 || this.checkedItemDueDates.includes(formattedItemDueDate);


        return matchProposalDate && matchBuilding && matchFloor && matchStation && matchCategory && matchProposer
          && matchDescription && matchCaseCategory && matchStatus && matchPDCA && matchProjectOwner && matchDueDate
          && matchItemDueDate;
      });
    },


    // 生成唯一的年月選項
  uniqueYearMonths() {
    const yearMonths = new Set();
    
    this.records
      .filter(record => {

          // 截止日期篩選
          let formattedDueDate;
          if (String(record['截止日期']).length === 8) {
            const dateStr = String(record['截止日期']);
            formattedDueDate = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
          } else if (String(record['截止日期']).includes('/') && String(record['截止日期']).length >= 7) {
            const parts = String(record['截止日期']).split('/');
            formattedDueDate = `${parts[0]}/${parts[1].padStart(2, '0')}`;
          } else {
            formattedDueDate = String(record['截止日期']);
          }

          // 項目DueDate 篩選
        let formattedItemDueDate;
        if (String(record['項目DueDate']).length === 8) {
          const dateStr = String(record['項目DueDate']);
          formattedItemDueDate = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
        } else if (String(record['項目DueDate']).includes('/') && String(record['項目DueDate']).length >= 7) {
          const parts = String(record['項目DueDate']).split('/');
          formattedItemDueDate = `${parts[0]}/${parts[1].padStart(2, '0')}`;
        } else {
          formattedItemDueDate = String(record['項目DueDate']);
        }

        // 新增：根據已選棟別進行過濾
        const matchBuilding = this.checkedBuildings.length === 0 || this.checkBuildingMatch(record['棟別']);

        const matchFloor = this.checkedFloors.length === 0 || this.checkFloorMatch(record['樓層']);
        const matchStation = this.checkedStations.length === 0 || this.checkStationMatch(record['站點']);
        // 類別篩選 - 簡單直接比對
        const matchCategory = this.checkedCategories.length === 0 || 
                                this.checkedCategories.includes(record['類別']);
        const matchProposer = this.checkedProposers.length === 0 || this.checkedProposers.includes(record['提案人']);
        const matchDescription = this.checkedDescriptions.length === 0 || this.checkDescriptionMatch(record['問題描述']);
        const matchCaseCategory = this.checkedCaseCategories.length === 0 || this.checkedCaseCategories.includes(record['案件分類']);
        const matchStatus = this.checkedStatus.length === 0 || this.checkedStatus.includes(record['Status']);
        const matchPDCA = this.checkedPDCA.length === 0 || this.checkedPDCA.includes(record['PDCA']);
        const matchProjectOwner = this.checkedProjectOwners.length === 0 || this.checkedProjectOwners.includes(record['專案Owner']);
        const matchDueDate = this.checkedDueDates.length === 0 || this.checkedDueDates.includes(formattedDueDate);
        const matchItemDueDate = this.checkedItemDueDates.length === 0 || this.checkedItemDueDates.includes(formattedItemDueDate);

        return matchBuilding && matchFloor && matchStation && matchCategory && matchProposer && matchDescription && matchCaseCategory 
          && matchStatus && matchPDCA && matchProjectOwner && matchDueDate && matchItemDueDate;
      })
      .forEach(record => {
        const proposalDate = record['提案日期'];
        if (!proposalDate) return;

        let yearMonth;
        
        // 處理 8 位數格式
        if (String(proposalDate).length === 8) {
          const dateStr = String(proposalDate);
          yearMonth = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
        }
        // 處理斜線格式
        else if (String(proposalDate).includes('/')) {
          const parts = String(proposalDate).split('/');
          if (parts.length >= 2) {
            yearMonth = `${parts[0]}/${parts[1].padStart(2, '0')}`;
          }
        }

        if (yearMonth) {
          yearMonths.add(yearMonth);
        }
      });
    
    return Array.from(yearMonths).sort().reverse(); // 最新的在前面
  },
        // 生成可用的棟別選項（根據其他已選篩選條件）
    uniqueBuildings() {
      const baseData = this.recordsWithDaysAgo;
      const buildingSet = new Set();
      
      baseData
        .filter(record => {
          // 根據已選的日期篩選條件來過濾
          if (!record['提案日期']) return false;
          
          let formattedProposalDate;
          if (String(record['提案日期']).length === 8) {
            const dateStr = String(record['提案日期']);
            formattedProposalDate = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
          } else if (String(record['提案日期']).includes('/') && String(record['提案日期']).length >= 7) {
            const parts = String(record['提案日期']).split('/');
            formattedProposalDate = `${parts[0]}/${parts[1].padStart(2, '0')}`;
          } else {
            formattedProposalDate = String(record['提案日期']);
          }

                    // 截止日期篩選
          let formattedDueDate;
          if (String(record['截止日期']).length === 8) {
            const dateStr = String(record['截止日期']);
            formattedDueDate = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
          } else if (String(record['截止日期']).includes('/') && String(record['截止日期']).length >= 7) {
            const parts = String(record['截止日期']).split('/');
            formattedDueDate = `${parts[0]}/${parts[1].padStart(2, '0')}`;
          } else {
            formattedDueDate = String(record['截止日期']);
          }

          // 項目DueDate 篩選
          let formattedItemDueDate;
          if (String(record['項目DueDate']).length === 8) {
            const dateStr = String(record['項目DueDate']);
            formattedItemDueDate = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
          } else if (String(record['項目DueDate']).includes('/') && String(record['項目DueDate']).length >= 7) {
            const parts = String(record['項目DueDate']).split('/');
            formattedItemDueDate = `${parts[0]}/${parts[1].padStart(2, '0')}`;
          } else {
            formattedItemDueDate = String(record['項目DueDate']);
          }
          
          const matchProposalDate = this.checkedDates.length === 0 || this.checkedDates.includes(formattedProposalDate);
          const matchFloor = this.checkedFloors.length === 0 || this.checkFloorMatch(record['樓層']);
        
          const matchStation = this.checkedStations.length === 0 || this.checkStationMatch(record['站點']);
          // 類別篩選 - 簡單直接比對
          const matchCategory = this.checkedCategories.length === 0 || 
                                this.checkedCategories.includes(record['類別']);
          const matchProposer = this.checkedProposers.length === 0 || this.checkedProposers.includes(record['提案人']);
          const matchDescription = this.checkedDescriptions.length === 0 || this.checkDescriptionMatch(record['問題描述']);
          const matchCaseCategory = this.checkedCaseCategories.length === 0 || this.checkedCaseCategories.includes(record['案件分類']);
          const matchStatus = this.checkedStatus.length === 0 || this.checkedStatus.includes(record['Status']);
          const matchPDCA = this.checkedPDCA.length === 0 || this.checkedPDCA.includes(record['PDCA']);
          const matchProjectOwner = this.checkedProjectOwners.length === 0 || this.checkedProjectOwners.includes(record['專案Owner']);
          const matchDueDate = this.checkedDueDates.length === 0 || this.checkedDueDates.includes(formattedDueDate);
          const matchItemDueDate = this.checkedItemDueDates.length === 0 || this.checkedItemDueDates.includes(formattedItemDueDate);

          return matchProposalDate && matchFloor && matchStation && matchCategory && matchProposer
            && matchDescription && matchCaseCategory && matchStatus && matchPDCA && matchProjectOwner 
            && matchDueDate && matchItemDueDate;
        })
        .forEach(record => {
          // 處理棟別資料，支援多種格式
          const buildings = this.getBuildingArray(record['棟別']);
          buildings.forEach(building => {
            if (building && building.trim()) {
              buildingSet.add(building.trim());
            }
          });
        });
      
      return Array.from(buildingSet).sort();
    },

      // 生成可用的樓層選項（根據其他已選篩選條件）
    uniqueFloors() {
      const baseData = this.recordsWithDaysAgo;
      const floorSet = new Set();
      
      baseData
        .filter(record => {
          // 根據已選的日期篩選條件來過濾
          if (!record['提案日期']) return false;
          
          let formattedProposalDate;
          if (String(record['提案日期']).length === 8) {
            const dateStr = String(record['提案日期']);
            formattedProposalDate = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
          } else if (String(record['提案日期']).includes('/') && String(record['提案日期']).length >= 7) {
            const parts = String(record['提案日期']).split('/');
            formattedProposalDate = `${parts[0]}/${parts[1].padStart(2, '0')}`;
          } else {
            formattedProposalDate = String(record['提案日期']);
          }

                    // 截止日期篩選
          let formattedDueDate;
          if (String(record['截止日期']).length === 8) {
            const dateStr = String(record['截止日期']);
            formattedDueDate = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
          } else if (String(record['截止日期']).includes('/') && String(record['截止日期']).length >= 7) {
            const parts = String(record['截止日期']).split('/');
            formattedDueDate = `${parts[0]}/${parts[1].padStart(2, '0')}`;
          } else {
            formattedDueDate = String(record['截止日期']);
          }

          // 項目DueDate 篩選
          let formattedItemDueDate;
          if (String(record['項目DueDate']).length === 8) {
            const dateStr = String(record['項目DueDate']);
            formattedItemDueDate = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
          } else if (String(record['項目DueDate']).includes('/') && String(record['項目DueDate']).length >= 7) {
            const parts = String(record['項目DueDate']).split('/');
            formattedItemDueDate = `${parts[0]}/${parts[1].padStart(2, '0')}`;
          } else {
            formattedItemDueDate = String(record['項目DueDate']);
          }
          
          const matchProposalDate = this.checkedDates.length === 0 || this.checkedDates.includes(formattedProposalDate);
          
          // 根據已選棟別篩選條件來過濾
          const matchBuilding = this.checkedBuildings.length === 0 || this.checkBuildingMatch(record['棟別']);
          const matchStation = this.checkedStations.length === 0 || this.checkStationMatch(record['站點']);
                    // 類別篩選 - 簡單直接比對
          const matchCategory = this.checkedCategories.length === 0 || 
                                this.checkedCategories.includes(record['類別']);
          const matchProposer = this.checkedProposers.length === 0 || this.checkedProposers.includes(record['提案人']);
          const matchDescription = this.checkedDescriptions.length === 0 || this.checkDescriptionMatch(record['問題描述']);
          const matchCaseCategory = this.checkedCaseCategories.length === 0 || this.checkedCaseCategories.includes(record['案件分類']);
          const matchStatus = this.checkedStatus.length === 0 || this.checkedStatus.includes(record['Status']);
          const matchPDCA = this.checkedPDCA.length === 0 || this.checkedPDCA.includes(record['PDCA']);
          const matchProjectOwner = this.checkedProjectOwners.length === 0 || this.checkedProjectOwners.includes(record['專案Owner']);
          const matchDueDate = this.checkedDueDates.length === 0 || this.checkedDueDates.includes(formattedDueDate);
          const matchItemDueDate = this.checkedItemDueDates.length === 0 || this.checkedItemDueDates.includes(formattedItemDueDate);
      
          return matchProposalDate && matchBuilding && matchStation && matchCategory
             && matchProposer && matchDescription && matchCaseCategory && matchStatus 
            && matchPDCA && matchProjectOwner && matchDueDate && matchItemDueDate; 
        })
        .forEach(record => {
          // 處理樓層資料，支援多種格式
          const floors = this.getFloorArray(record['樓層']);
          floors.forEach(floor => {
            if (floor && floor.trim()) {
              floorSet.add(floor.trim());
            }
          });
        });
      
      return Array.from(floorSet).sort();
    },

      // 生成可用的站點選項（根據其他已選篩選條件）
    uniqueStations() {
      const baseData = this.recordsWithDaysAgo;
      const stationSet = new Set();
      
      baseData
        .filter(record => {
          // 根據已選的日期篩選條件來過濾
          if (!record['提案日期']) return false;
          
          let formattedProposalDate;
          if (String(record['提案日期']).length === 8) {
            const dateStr = String(record['提案日期']);
            formattedProposalDate = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
          } else if (String(record['提案日期']).includes('/') && String(record['提案日期']).length >= 7) {
            const parts = String(record['提案日期']).split('/');
            formattedProposalDate = `${parts[0]}/${parts[1].padStart(2, '0')}`;
          } else {
            formattedProposalDate = String(record['提案日期']);
          }
          

                    // 截止日期篩選
          let formattedDueDate;
          if (String(record['截止日期']).length === 8) {
            const dateStr = String(record['截止日期']);
            formattedDueDate = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
          } else if (String(record['截止日期']).includes('/') && String(record['截止日期']).length >= 7) {
            const parts = String(record['截止日期']).split('/');
            formattedDueDate = `${parts[0]}/${parts[1].padStart(2, '0')}`;
          } else {
            formattedDueDate = String(record['截止日期']);
          }

          // 項目DueDate 篩選
          let formattedItemDueDate;
          if (String(record['項目DueDate']).length === 8) {
            const dateStr = String(record['項目DueDate']);
            formattedItemDueDate = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
          } else if (String(record['項目DueDate']).includes('/') && String(record['項目DueDate']).length >= 7) {
            const parts = String(record['項目DueDate']).split('/');
            formattedItemDueDate = `${parts[0]}/${parts[1].padStart(2, '0')}`;
          } else {
            formattedItemDueDate = String(record['項目DueDate']);
          }

          const matchProposalDate = this.checkedDates.length === 0 || this.checkedDates.includes(formattedProposalDate);
          
          // 根據已選棟別篩選條件來過濾
          const matchBuilding = this.checkedBuildings.length === 0 || this.checkBuildingMatch(record['棟別']);
          
          // 根據已選樓層篩選條件來過濾
          const matchFloor = this.checkedFloors.length === 0 || this.checkFloorMatch(record['樓層']);
          const matchCategory = this.checkedCategories.length === 0 || 
                                this.checkedCategories.includes(record['類別']);
          const matchProposer = this.checkedProposers.length === 0 || this.checkedProposers.includes(record['提案人']);
          const matchDescription = this.checkedDescriptions.length === 0 || this.checkDescriptionMatch(record['問題描述']);
          const matchCaseCategory = this.checkedCaseCategories.length === 0 || this.checkedCaseCategories.includes(record['案件分類']);
          const matchStatus = this.checkedStatus.length === 0 || this.checkedStatus.includes(record['Status']);
          const matchPDCA = this.checkedPDCA.length === 0 || this.checkedPDCA.includes(record['PDCA']);
          const matchProjectOwner = this.checkedProjectOwners.length === 0 || this.checkedProjectOwners.includes(record['專案Owner']);
          const matchDueDate = this.checkedDueDates.length === 0 || this.checkedDueDates.includes(formattedDueDate);
          const matchItemDueDate = this.checkedItemDueDates.length === 0 || this.checkedItemDueDates.includes(formattedItemDueDate);

          return matchProposalDate && matchBuilding && matchFloor && matchCategory
           && matchProposer && matchDescription && matchCaseCategory && matchStatus
           && matchPDCA && matchProjectOwner && matchDueDate && matchItemDueDate;
        })
        .forEach(record => {
          // 處理站點資料，支援多種格式
          const stations = this.getStationArray(record['站點']);
          stations.forEach(station => {
            if (station && station.trim()) {
              stationSet.add(station.trim());
            }
          });
        });
      
      return Array.from(stationSet).sort();
    },

      // 生成可用的類別選項（根據其他已選篩選條件）
  uniqueCategories() {
    const baseData = this.recordsWithDaysAgo;
    const categorySet = new Set();
    
    baseData
      .filter(record => {
        if (!record['提案日期']) return false;
        
        let formattedProposalDate;
        if (String(record['提案日期']).length === 8) {
          const dateStr = String(record['提案日期']);
          formattedProposalDate = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
        } else if (String(record['提案日期']).includes('/') && String(record['提案日期']).length >= 7) {
          const parts = String(record['提案日期']).split('/');
          formattedProposalDate = `${parts[0]}/${parts[1].padStart(2, '0')}`;
        } else {
          formattedProposalDate = String(record['提案日期']);
        }

                  // 截止日期篩選
          let formattedDueDate;
          if (String(record['截止日期']).length === 8) {
            const dateStr = String(record['截止日期']);
            formattedDueDate = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
          } else if (String(record['截止日期']).includes('/') && String(record['截止日期']).length >= 7) {
            const parts = String(record['截止日期']).split('/');
            formattedDueDate = `${parts[0]}/${parts[1].padStart(2, '0')}`;
          } else {
            formattedDueDate = String(record['截止日期']);
          }
        
          // 項目DueDate 篩選
          let formattedItemDueDate;
          if (String(record['項目DueDate']).length === 8) {
            const dateStr = String(record['項目DueDate']);
            formattedItemDueDate = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
          } else if (String(record['項目DueDate']).includes('/') && String(record['項目DueDate']).length >= 7) {
            const parts = String(record['項目DueDate']).split('/');
            formattedItemDueDate = `${parts[0]}/${parts[1].padStart(2, '0')}`;
          } else {
            formattedItemDueDate = String(record['項目DueDate']);
          }

        const matchProposalDate = this.checkedDates.length === 0 || this.checkedDates.includes(formattedProposalDate);
        const matchBuilding = this.checkedBuildings.length === 0 || this.checkBuildingMatch(record['棟別']);
        const matchFloor = this.checkedFloors.length === 0 || this.checkFloorMatch(record['樓層']);
        const matchStation = this.checkedStations.length === 0 || this.checkStationMatch(record['站點']);
        const matchProposer = this.checkedProposers.length === 0 || this.checkedProposers.includes(record['提案人']);
        const matchDescription = this.checkedDescriptions.length === 0 || this.checkDescriptionMatch(record['問題描述']);
        const matchCaseCategory = this.checkedCaseCategories.length === 0 || this.checkedCaseCategories.includes(record['案件分類']);
        const matchStatus = this.checkedStatus.length === 0 || this.checkedStatus.includes(record['Status']);
        const matchPDCA = this.checkedPDCA.length === 0 || this.checkedPDCA.includes(record['PDCA']);
        const matchProjectOwner = this.checkedProjectOwners.length === 0 || this.checkedProjectOwners.includes(record['專案Owner']);
        const matchDueDate = this.checkedDueDates.length === 0 || this.checkedDueDates.includes(formattedDueDate);
        const matchItemDueDate = this.checkedItemDueDates.length === 0 || this.checkedItemDueDates.includes(formattedItemDueDate);


        return matchProposalDate && matchBuilding && matchFloor && matchStation && matchProposer && matchDescription 
          && matchCaseCategory && matchStatus && matchPDCA && matchProjectOwner && matchDueDate && matchItemDueDate;
      })
      .forEach(record => {
        const category = record['類別'];
        if (category && category.trim()) {
          categorySet.add(category.trim());
        }
      });
    
    return Array.from(categorySet).sort();
  },
  // 生成可用的提案人選項（根據其他已選篩選條件）
  uniqueProposers() {
    const baseData = this.recordsWithDaysAgo;
    const proposerSet = new Set();
    
    baseData
      .filter(record => {
        if (!record['提案日期']) return false;
        
        let formattedProposalDate;
        if (String(record['提案日期']).length === 8) {
          const dateStr = String(record['提案日期']);
          formattedProposalDate = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
        } else if (String(record['提案日期']).includes('/') && String(record['提案日期']).length >= 7) {
          const parts = String(record['提案日期']).split('/');
          formattedProposalDate = `${parts[0]}/${parts[1].padStart(2, '0')}`;
        } else {
          formattedProposalDate = String(record['提案日期']);
        }
        
                  // 截止日期篩選
          let formattedDueDate;
          if (String(record['截止日期']).length === 8) {
            const dateStr = String(record['截止日期']);
            formattedDueDate = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
          } else if (String(record['截止日期']).includes('/') && String(record['截止日期']).length >= 7) {
            const parts = String(record['截止日期']).split('/');
            formattedDueDate = `${parts[0]}/${parts[1].padStart(2, '0')}`;
          } else {
            formattedDueDate = String(record['截止日期']);
          }

        // 項目DueDate 篩選
        let formattedItemDueDate;
        if (String(record['項目DueDate']).length === 8) {
          const dateStr = String(record['項目DueDate']);
          formattedItemDueDate = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
        } else if (String(record['項目DueDate']).includes('/') && String(record['項目DueDate']).length >= 7) {
          const parts = String(record['項目DueDate']).split('/');
          formattedItemDueDate = `${parts[0]}/${parts[1].padStart(2, '0')}`;
        } else {
          formattedItemDueDate = String(record['項目DueDate']);
        }

        const matchProposalDate = this.checkedDates.length === 0 || this.checkedDates.includes(formattedProposalDate);
        const matchBuilding = this.checkedBuildings.length === 0 || this.checkBuildingMatch(record['棟別']);
        const matchFloor = this.checkedFloors.length === 0 || this.checkFloorMatch(record['樓層']);
        const matchStation = this.checkedStations.length === 0 || this.checkStationMatch(record['站點']);
        const matchCategory = this.checkedCategories.length === 0 || this.checkedCategories.includes(record['類別']);
        const matchDescription = this.checkedDescriptions.length === 0 || this.checkDescriptionMatch(record['問題描述']);
        const matchCaseCategory = this.checkedCaseCategories.length === 0 || this.checkedCaseCategories.includes(record['案件分類']);
        const matchStatus = this.checkedStatus.length === 0 || this.checkedStatus.includes(record['Status']);
        const matchPDCA = this.checkedPDCA.length === 0 || this.checkedPDCA.includes(record['PDCA']);
        const matchProjectOwner = this.checkedProjectOwners.length === 0 || this.checkedProjectOwners.includes(record['專案Owner']);
        const matchDueDate = this.checkedDueDates.length === 0 || this.checkedDueDates.includes(formattedDueDate);
        const matchItemDueDate = this.checkedItemDueDates.length === 0 || this.checkedItemDueDates.includes(formattedItemDueDate);

        return matchProposalDate && matchBuilding && matchFloor && matchStation && matchCategory && matchDescription 
          && matchCaseCategory && matchStatus && matchPDCA && matchProjectOwner && matchDueDate && matchItemDueDate;
      })
      .forEach(record => {
        const proposer = record['提案人'];
        if (proposer && proposer.trim()) {
          proposerSet.add(proposer.trim());
        }
      });
    
    return Array.from(proposerSet).sort();
  },

    // 生成可用的問題描述選項（根據其他已選篩選條件）
  uniqueDescriptions() {
    const baseData = this.recordsWithDaysAgo;
    const descriptionSet = new Set();
    
    baseData
      .filter(record => {
        if (!record['提案日期']) return false;
        
        let formattedProposalDate;
        if (String(record['提案日期']).length === 8) {
          const dateStr = String(record['提案日期']);
          formattedProposalDate = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
        } else if (String(record['提案日期']).includes('/') && String(record['提案日期']).length >= 7) {
          const parts = String(record['提案日期']).split('/');
          formattedProposalDate = `${parts[0]}/${parts[1].padStart(2, '0')}`;
        } else {
          formattedProposalDate = String(record['提案日期']);
        }
        
                  // 截止日期篩選
          let formattedDueDate;
          if (String(record['截止日期']).length === 8) {
            const dateStr = String(record['截止日期']);
            formattedDueDate = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
          } else if (String(record['截止日期']).includes('/') && String(record['截止日期']).length >= 7) {
            const parts = String(record['截止日期']).split('/');
            formattedDueDate = `${parts[0]}/${parts[1].padStart(2, '0')}`;
          } else {
            formattedDueDate = String(record['截止日期']);
          }
        
          // 項目DueDate 篩選
        let formattedItemDueDate;
        if (String(record['項目DueDate']).length === 8) {
          const dateStr = String(record['項目DueDate']);
          formattedItemDueDate = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
        } else if (String(record['項目DueDate']).includes('/') && String(record['項目DueDate']).length >= 7) {
          const parts = String(record['項目DueDate']).split('/');
          formattedItemDueDate = `${parts[0]}/${parts[1].padStart(2, '0')}`;
        } else {
          formattedItemDueDate = String(record['項目DueDate']);
        }

        const matchProposalDate = this.checkedDates.length === 0 || this.checkedDates.includes(formattedProposalDate);
        const matchBuilding = this.checkedBuildings.length === 0 || this.checkBuildingMatch(record['棟別']);
        const matchFloor = this.checkedFloors.length === 0 || this.checkFloorMatch(record['樓層']);
        const matchStation = this.checkedStations.length === 0 || this.checkStationMatch(record['站點']);
        const matchCategory = this.checkedCategories.length === 0 || this.checkedCategories.includes(record['類別']);
        const matchProposer = this.checkedProposers.length === 0 || this.checkedProposers.includes(record['提案人']);
        const matchCaseCategory = this.checkedCaseCategories.length === 0 || this.checkedCaseCategories.includes(record['案件分類']);
        const matchStatus = this.checkedStatus.length === 0 || this.checkedStatus.includes(record['Status']);
        const matchPDCA = this.checkedPDCA.length === 0 || this.checkedPDCA.includes(record['PDCA']);
        const matchProjectOwner = this.checkedProjectOwners.length === 0 || this.checkedProjectOwners.includes(record['專案Owner']);
        const matchDueDate = this.checkedDueDates.length === 0 || this.checkedDueDates.includes(formattedDueDate);
        const matchItemDueDate = this.checkedItemDueDates.length === 0 || this.checkedItemDueDates.includes(formattedItemDueDate);

        return matchProposalDate && matchBuilding && matchFloor && matchStation && matchCategory && matchProposer 
          && matchCaseCategory && matchStatus && matchPDCA && matchProjectOwner && matchDueDate && matchItemDueDate;
      })
      .forEach(record => {
        const description = record['問題描述'];
        if (description && description.trim()) {
          // 可以選擇截取前面部分作為選項，或者完整描述
          const truncatedDesc = description.trim().length > 50 
            ? description.trim().substring(0, 50) + '...' 
            : description.trim();
          descriptionSet.add(truncatedDesc);
        }
      });
    
    return Array.from(descriptionSet).sort();
  },


    // 生成可用案件分類的選項（根據其他已選篩選條件）
    uniqueCaseCategories() {
      const baseData = this.recordsWithDaysAgo || [];
      return Array.from(new Set(
        baseData
          .filter(i => {
            if (!i['提案日期']) return false;

            let formattedProposalDate;
            const dateStr = String(i['提案日期']);

            if (dateStr.length === 8) {
              formattedProposalDate = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
            } else if (dateStr.includes('/') && dateStr.length >= 7) {
              const parts = dateStr.split('/');
              formattedProposalDate = `${parts[0]}/${parts[1].padStart(2, '0')}`;
            } else {
              formattedProposalDate = dateStr;
            }

                      // 截止日期篩選
            let formattedDueDate;
            if (String(i['截止日期']).length === 8) {
              const dateStr = String(i['截止日期']);
              formattedDueDate = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
            } else if (String(i['截止日期']).includes('/') && String(i['截止日期']).length >= 7) {
              const parts = String(i['截止日期']).split('/');
              formattedDueDate = `${parts[0]}/${parts[1].padStart(2, '0')}`;
            } else {
              formattedDueDate = String(i['截止日期']);
            }

            // 項目DueDate 篩選
            let formattedItemDueDate;
            if (String(i['項目DueDate']).length === 8) {
              const dateStr = String(i['項目DueDate']);
              formattedItemDueDate = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
            } else if (String(i['項目DueDate']).includes('/') && String(i['項目DueDate']).length >= 7) {
              const parts = String(i['項目DueDate']).split('/');
              formattedItemDueDate = `${parts[0]}/${parts[1].padStart(2, '0')}`;
            } else {
              formattedItemDueDate = String(i['項目DueDate']);
            }

            const matchProposalDate = this.checkedDates.length === 0 || this.checkedDates.includes(formattedProposalDate);
            const matchBuilding = this.checkedBuildings.length === 0 || this.checkBuildingMatch(i['棟別']);
            const matchFloor = this.checkedFloors.length === 0 || this.checkFloorMatch(i['樓層']);
            const matchStation = this.checkedStations.length === 0 || this.checkStationMatch(i['站點']);
            const matchCategory = this.checkedCategories.length === 0 || this.checkedCategories.includes(i['類別']);
            const matchProposer = this.checkedProposers.length === 0 || this.checkedProposers.includes(i['提案人']);
            const matchDescription = this.checkedDescriptions.length === 0 || this.checkDescriptionMatch(i['問題描述']);
            const matchStatus = this.checkedStatus.length === 0 || this.checkedStatus.includes(i['Status']);
            const matchPDCA = this.checkedPDCA.length === 0 || this.checkedPDCA.includes(i['PDCA']);
            const matchProjectOwner = this.checkedProjectOwners.length === 0 || this.checkedProjectOwners.includes(i['專案Owner']);
            const matchDueDate = this.checkedDueDates.length === 0 || this.checkedDueDates.includes(formattedDueDate);
            const matchItemDueDate = this.checkedItemDueDates.length === 0 || this.checkedItemDueDates.includes(formattedItemDueDate);

            return matchProposalDate && matchBuilding && matchFloor && matchStation && matchCategory && matchProposer 
              && matchDescription && matchStatus && matchPDCA && matchProjectOwner && matchDueDate && matchItemDueDate;
          })
          .map(i => i['案件分類'])
          .filter(Boolean)
      ));
    },


    // 生成可用Status的選項（根據其他已選篩選條件）
    uniqueStatus() {
      const baseData = this.recordsWithDaysAgo || [];
      return Array.from(new Set(
        baseData
          .filter(i => {
            if (!i['提案日期']) return false;

            let formattedProposalDate;
            const dateStr = String(i['提案日期']);

            if (dateStr.length === 8) {
              formattedProposalDate = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
            } else if (dateStr.includes('/') && dateStr.length >= 7) {
              const parts = dateStr.split('/');
              formattedProposalDate = `${parts[0]}/${parts[1].padStart(2, '0')}`;
            } else {
              formattedProposalDate = dateStr;
            }

                      // 截止日期篩選
            let formattedDueDate;
            if (String(i['截止日期']).length === 8) {
              const dateStr = String(i['截止日期']);
              formattedDueDate = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
            } else if (String(i['截止日期']).includes('/') && String(i['截止日期']).length >= 7) {
              const parts = String(i['截止日期']).split('/');
              formattedDueDate = `${parts[0]}/${parts[1].padStart(2, '0')}`;
            } else {
              formattedDueDate = String(i['截止日期']);
            }

            // 項目DueDate 篩選
            let formattedItemDueDate;
            if (String(i['項目DueDate']).length === 8) {
              const dateStr = String(i['項目DueDate']);
              formattedItemDueDate = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
            } else if (String(i['項目DueDate']).includes('/') && String(i['項目DueDate']).length >= 7) {
              const parts = String(i['項目DueDate']).split('/');
              formattedItemDueDate = `${parts[0]}/${parts[1].padStart(2, '0')}`;
            } else {
              formattedItemDueDate = String(i['項目DueDate']);
            }

            const matchProposalDate = this.checkedDates.length === 0 || this.checkedDates.includes(formattedProposalDate);
            const matchBuilding = this.checkedBuildings.length === 0 || this.checkBuildingMatch(i['棟別']);
            const matchFloor = this.checkedFloors.length === 0 || this.checkFloorMatch(i['樓層']);
            const matchStation = this.checkedStations.length === 0 || this.checkStationMatch(i['站點']);
            const matchCategory = this.checkedCategories.length === 0 || this.checkedCategories.includes(i['類別']);
            const matchProposer = this.checkedProposers.length === 0 || this.checkedProposers.includes(i['提案人']);
            const matchDescription = this.checkedDescriptions.length === 0 || this.checkDescriptionMatch(i['問題描述']);
            const matchCaseCategory = this.checkedCaseCategories.length === 0 || this.checkedCaseCategories.includes(i['案件分類']); // ✅ 改 i
            const matchPDCA = this.checkedPDCA.length === 0 || this.checkedPDCA.includes(i['PDCA']);
            const matchProjectOwner = this.checkedProjectOwners.length === 0 || this.checkedProjectOwners.includes(i['專案Owner']);
            const matchDueDate = this.checkedDueDates.length === 0 || this.checkedDueDates.includes(formattedDueDate);
            const matchItemDueDate = this.checkedItemDueDates.length === 0 || this.checkedItemDueDates.includes(formattedItemDueDate);

            return matchProposalDate && matchBuilding && matchFloor && matchStation && matchCategory && matchProposer 
              && matchDescription && matchCaseCategory && matchPDCA && matchProjectOwner && matchDueDate && matchItemDueDate;
          })
          .map(i => i['Status'])
          .filter(Boolean)
      ));
    },
  uniquePDCA() {
    const baseData = this.recordsWithDaysAgo || [];
    return Array.from(new Set(
      baseData
        .filter(i => {
          if (!i['提案日期']) return false;

          let formattedProposalDate;
          const dateStr = String(i['提案日期']);

          if (dateStr.length === 8) {
            formattedProposalDate = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
          } else if (dateStr.includes('/') && dateStr.length >= 7) {
            const parts = dateStr.split('/');
            formattedProposalDate = `${parts[0]}/${parts[1].padStart(2, '0')}`;
          } else {
            formattedProposalDate = dateStr;
          }

                    // 截止日期篩選
            let formattedDueDate;
            if (String(i['截止日期']).length === 8) {
              const dateStr = String(i['截止日期']);
              formattedDueDate = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
            } else if (String(i['截止日期']).includes('/') && String(i['截止日期']).length >= 7) {
              const parts = String(i['截止日期']).split('/');
              formattedDueDate = `${parts[0]}/${parts[1].padStart(2, '0')}`;
            } else {
              formattedDueDate = String(i['截止日期']);
            }

            // 項目DueDate 篩選
          let formattedItemDueDate;
          if (String(i['項目DueDate']).length === 8) {
            const dateStr = String(i['項目DueDate']);
            formattedItemDueDate = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
          } else if (String(i['項目DueDate']).includes('/') && String(i['項目DueDate']).length >= 7) {
            const parts = String(i['項目DueDate']).split('/');
            formattedItemDueDate = `${parts[0]}/${parts[1].padStart(2, '0')}`;
          } else {
            formattedItemDueDate = String(i['項目DueDate']);
          }

          const matchProposalDate = this.checkedDates.length === 0 || this.checkedDates.includes(formattedProposalDate);
          const matchBuilding = this.checkedBuildings.length === 0 || this.checkBuildingMatch(i['棟別']);
          const matchFloor = this.checkedFloors.length === 0 || this.checkFloorMatch(i['樓層']);
          const matchStation = this.checkedStations.length === 0 || this.checkStationMatch(i['站點']);
          const matchCategory = this.checkedCategories.length === 0 || this.checkedCategories.includes(i['類別']);
          const matchProposer = this.checkedProposers.length === 0 || this.checkedProposers.includes(i['提案人']);
          const matchDescription = this.checkedDescriptions.length === 0 || this.checkDescriptionMatch(i['問題描述']);
          const matchCaseCategory = this.checkedCaseCategories.length === 0 || this.checkedCaseCategories.includes(i['案件分類']);
          const matchStatus = this.checkedStatus.length === 0 || this.checkedStatus.includes(i['Status']);
          const matchProjectOwner = this.checkedProjectOwners.length === 0 || this.checkedProjectOwners.includes(i['專案Owner']);
          const matchDueDate = this.checkedDueDates.length === 0 || this.checkedDueDates.includes(formattedDueDate);
          const matchItemDueDate = this.checkedItemDueDates.length === 0 || this.checkedItemDueDates.includes(formattedItemDueDate);

          return matchProposalDate && matchBuilding && matchFloor && matchStation && matchCategory 
            && matchProposer && matchDescription && matchCaseCategory && matchStatus && matchProjectOwner 
            && matchDueDate && matchItemDueDate;
        })
        .map(i => i['PDCA'])
        .filter(Boolean)
    ));
  },
  // 1. 生成可用的專案Owner選項（根據其他已選篩選條件）
  uniqueProjectOwners() {
    const baseData = this.recordsWithDaysAgo || [];
    const ownerSet = new Set(); // 使用 Set 來自動處理重複的 Owner 名稱

    baseData
      .filter(record => {
        // --- 內部篩選邏輯 (這部分與您提供的程式碼完全相同) ---
        if (!record['提案日期']) return false;

        let formattedProposalDate;
        const dateStr = String(record['提案日期']);

        if (dateStr.length === 8) {
          formattedProposalDate = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
        } else if (dateStr.includes('/') && dateStr.length >= 7) {
          const parts = dateStr.split('/');
          formattedProposalDate = `${parts[0]}/${parts[1].padStart(2, '0')}`;
        } else {
          formattedProposalDate = dateStr;
        }

        // 截止日期篩選
        let formattedDueDate;
        if (String(record['截止日期']).length === 8) {
          const dateStr = String(record['截止日期']);
          formattedDueDate = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
        } else if (String(record['截止日期']).includes('/') && String(record['截止日期']).length >= 7) {
          const parts = String(record['截止日期']).split('/');
          formattedDueDate = `${parts[0]}/${parts[1].padStart(2, '0')}`;
        } else {
          formattedDueDate = String(record['截止日期']);
        }

        // 項目DueDate 篩選
        let formattedItemDueDate;
        if (String(record['項目DueDate']).length === 8) {
          const dateStr = String(record['項目DueDate']);
          formattedItemDueDate = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
        } else if (String(record['項目DueDate']).includes('/') && String(record['項目DueDate']).length >= 7) {
          const parts = String(record['項目DueDate']).split('/');
          formattedItemDueDate = `${parts[0]}/${parts[1].padStart(2, '0')}`;
        } else {
          formattedItemDueDate = String(record['項目DueDate']);
        }

        const matchProposalDate = this.checkedDates.length === 0 || this.checkedDates.includes(formattedProposalDate);
        const matchBuilding = this.checkedBuildings.length === 0 || this.checkBuildingMatch(record['棟別']);
        const matchFloor = this.checkedFloors.length === 0 || this.checkFloorMatch(record['樓層']);
        const matchStation = this.checkedStations.length === 0 || this.checkStationMatch(record['站點']);
        const matchCategory = this.checkedCategories.length === 0 || this.checkedCategories.includes(record['類別']);
        const matchProposer = this.checkedProposers.length === 0 || this.checkedProposers.includes(record['提案人']);
        const matchDescription = this.checkedDescriptions.length === 0 || this.checkDescriptionMatch(record['問題描述']);
        const matchCaseCategory = this.checkedCaseCategories.length === 0 || this.checkedCaseCategories.includes(record['案件分類']);
        const matchStatus = this.checkedStatus.length === 0 || this.checkedStatus.includes(record['Status']);
        const matchPDCA = this.checkedPDCA.length === 0 || this.checkedPDCA.includes(record['PDCA']);
        const matchDueDate = this.checkedDueDates.length === 0 || this.checkedDueDates.includes(formattedDueDate);
        const matchItemDueDate = this.checkedItemDueDates.length === 0 || this.checkedItemDueDates.includes(formattedItemDueDate);

        return matchProposalDate && matchBuilding && matchFloor && matchStation && matchCategory 
          && matchProposer && matchDescription && matchCaseCategory && matchStatus && matchPDCA
          && matchDueDate && matchItemDueDate;
      })
      .forEach(record => {
        // --- 修改的部分從這裡開始 ---
        const owners = record['專案Owner'];
        if (owners && typeof owners === 'string') {
          // 將 "Owner A, Owner B, Owner C" 這樣的字串拆分成陣列
          const ownerArray = owners.split(',')          // 用逗號分割
                                  .map(owner => owner.trim()) // 去除每個 Owner 名稱前後的空格
                                  .filter(owner => owner);   // 過濾掉空的字串 (例如 "A, , B" 的情況)
          
          // 將拆分後的每個 Owner 加入 Set
          ownerArray.forEach(owner => ownerSet.add(owner));
        }
        // --- 修改的部分到這裡結束 ---
      });

    // 將 Set 轉換為陣列並排序後返回
    return Array.from(ownerSet).sort();
  },

  // 2. 截止日期
  uniqueDueDates() {
    const dueDates = new Set();

    this.records
      .filter(record => {
        if (!record['提案日期']) return false;

        let formattedProposalDate;
        const dateStr = String(record['提案日期']);

        if (dateStr.length === 8) {
          formattedProposalDate = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
        } else if (dateStr.includes('/') && dateStr.length >= 7) {
          const parts = dateStr.split('/');
          formattedProposalDate = `${parts[0]}/${parts[1].padStart(2, '0')}`;
        } else {
          formattedProposalDate = dateStr;
        }

        // 項目DueDate 篩選
        let formattedItemDueDate;
        if (String(record['項目DueDate']).length === 8) {
          const dateStr = String(record['項目DueDate']);
          formattedItemDueDate = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
        } else if (String(record['項目DueDate']).includes('/') && String(record['項目DueDate']).length >= 7) {
          const parts = String(record['項目DueDate']).split('/');
          formattedItemDueDate = `${parts[0]}/${parts[1].padStart(2, '0')}`;
        } else {
          formattedItemDueDate = String(record['項目DueDate']);
        }

        const matchProposalDate = this.checkedDates.length === 0 || this.checkedDates.includes(formattedProposalDate);
        const matchBuilding = this.checkedBuildings.length === 0 || this.checkBuildingMatch(record['棟別']);
        const matchFloor = this.checkedFloors.length === 0 || this.checkFloorMatch(record['樓層']);
        const matchStation = this.checkedStations.length === 0 || this.checkStationMatch(record['站點']);
        const matchCategory = this.checkedCategories.length === 0 || this.checkedCategories.includes(record['類別']);
        const matchProposer = this.checkedProposers.length === 0 || this.checkedProposers.includes(record['提案人']);
        const matchDescription = this.checkedDescriptions.length === 0 || this.checkDescriptionMatch(record['問題描述']);
        const matchCaseCategory = this.checkedCaseCategories.length === 0 || this.checkedCaseCategories.includes(record['案件分類']);
        const matchStatus = this.checkedStatus.length === 0 || this.checkedStatus.includes(record['Status']);
        const matchPDCA = this.checkedPDCA.length === 0 || this.checkedPDCA.includes(record['PDCA']);
        const matchProjectOwner = this.checkedProjectOwners.length === 0 || this.checkedProjectOwners.includes(record['專案Owner']);
        const matchItemDueDate = this.checkedItemDueDates.length === 0 || this.checkedItemDueDates.includes(formattedItemDueDate);
        
        return matchProposalDate && matchBuilding && matchFloor && matchStation && matchCategory && matchProposer 
          && matchDescription && matchCaseCategory && matchStatus && matchPDCA && matchProjectOwner
          && matchItemDueDate;
      })
      .forEach(record => {
        const due = record['截止日期'];
        if (!due) return;

        let ym;
        if (String(due).length === 8) {
          const dateStr = String(due);
          ym = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
        } else if (String(due).includes('/')) {
          const parts = String(due).split('/');
          if (parts.length >= 2) {
            ym = `${parts[0]}/${parts[1].padStart(2, '0')}`;
          }
        }
        if (ym) {
          dueDates.add(ym);
        }
      });

    return Array.from(dueDates).sort().reverse();
  },

  // 3. 項目DueDate
  uniqueItemDueDates() {
    const itemDueDates = new Set();

    this.records
      .filter(record => {
        if (!record['提案日期']) return false;

        let formattedProposalDate;
        const dateStr = String(record['提案日期']);

        if (dateStr.length === 8) {
          formattedProposalDate = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
        } else if (dateStr.includes('/') && dateStr.length >= 7) {
          const parts = dateStr.split('/');
          formattedProposalDate = `${parts[0]}/${parts[1].padStart(2, '0')}`;
        } else {
          formattedProposalDate = dateStr;
        }

        // 截止日期篩選
        let formattedDueDate;
        if (String(record['截止日期']).length === 8) {
          const dateStr = String(record['截止日期']);
          formattedDueDate = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
        } else if (String(record['截止日期']).includes('/') && String(record['截止日期']).length >= 7) {
          const parts = String(record['截止日期']).split('/');
          formattedDueDate = `${parts[0]}/${parts[1].padStart(2, '0')}`;
        } else {
          formattedDueDate = String(record['截止日期']);
        }

        const matchProposalDate = this.checkedDates.length === 0 || this.checkedDates.includes(formattedProposalDate);
        const matchBuilding = this.checkedBuildings.length === 0 || this.checkBuildingMatch(record['棟別']);
        const matchFloor = this.checkedFloors.length === 0 || this.checkFloorMatch(record['樓層']);
        const matchStation = this.checkedStations.length === 0 || this.checkStationMatch(record['站點']);
        const matchCategory = this.checkedCategories.length === 0 || this.checkedCategories.includes(record['類別']);
        const matchProposer = this.checkedProposers.length === 0 || this.checkedProposers.includes(record['提案人']);
        const matchDescription = this.checkedDescriptions.length === 0 || this.checkDescriptionMatch(record['問題描述']);
        const matchCaseCategory = this.checkedCaseCategories.length === 0 || this.checkedCaseCategories.includes(record['案件分類']);
        const matchStatus = this.checkedStatus.length === 0 || this.checkedStatus.includes(record['Status']);
        const matchPDCA = this.checkedPDCA.length === 0 || this.checkedPDCA.includes(record['PDCA']);
        const matchProjectOwner = this.checkedProjectOwners.length === 0 || this.checkedProjectOwners.includes(record['專案Owner']);
        const matchDueDate = this.checkedDueDates.length === 0 || this.checkedDueDates.includes(formattedDueDate);

        return matchProposalDate && matchBuilding && matchFloor && matchStation && matchCategory && matchProposer &&
              matchDescription && matchCaseCategory && matchStatus && matchPDCA && matchProjectOwner 
              && matchDueDate;
      })
      .forEach(record => {
        const val = record['項目DueDate'];
        if (!val) return;

        let ym;
        if (String(val).length === 8) {
          const dateStr = String(val);
          ym = `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}`;
        } else if (String(val).includes('/')) {
          const parts = String(val).split('/');
          if (parts.length >= 2) {
            ym = `${parts[0]}/${parts[1].padStart(2, '0')}`;
          }
        }
        if (ym) {
          itemDueDates.add(ym);
        }
      });

    return Array.from(itemDueDates).sort().reverse();
  },


  isItemDueDateFiltered() {
    return this.checkedItemDueDates && this.checkedItemDueDates.length > 0;
  },


  isDueDateFiltered() {
    return this.checkedDueDates && this.checkedDueDates.length > 0;
  },
  isProjectOwnerFiltered() {
    return this.checkedProjectOwners && this.checkedProjectOwners.length > 0;
  },

  isPDCAFiltered() {
    return this.checkedPDCA && this.checkedPDCA.length > 0;
  },
      
  isStatusFiltered() {
    return this.checkedStatus && this.checkedStatus.length > 0;
  },

  isCaseCategoriesFiltered() {
    return this.checkedCaseCategories && this.checkedCaseCategories.length > 0;
  },


  // 檢查是否有啟用提案人篩選
  isProposerFiltered() {
    return this.checkedProposers && this.checkedProposers.length > 0;
  },
    // 檢查是否有啟用棟別篩選
    isBuildingFiltered() {
      return this.checkedBuildings && this.checkedBuildings.length > 0;
    },

      // 檢查是否有啟用樓層篩選
    isFloorFiltered() {
      return this.checkedFloors && this.checkedFloors.length > 0;
    },

    
    // 檢查是否有啟用日期過濾
    isDateFiltered() {
        return this.checkedDates && this.checkedDates.length > 0;
    },

      // 檢查是否有啟用站點篩選
    isStationFiltered() {
      return this.checkedStations && this.checkedStations.length > 0;
    },

      // 檢查是否有啟用類別篩選
      isCategoryFiltered() {
        return this.checkedCategories && this.checkedCategories.length > 0;
      },

        // 檢查是否有啟用問題描述篩選
  isDescriptionFiltered() {
    return this.checkedDescriptions && this.checkedDescriptions.length > 0;
  },

    // 🆕 欄位設定清單（換算金額僅管理員可見/可設定）
    columnSettingsList() {
      const result = {};
      Object.keys(this.columnVisibility).forEach(col => {
        if (col === '換算金額' && this.userRole !== 'admin') return;
        result[col] = this.columnVisibility[col];
      });
      return result;
    },

    // 🆕 可見欄位列表
    visibleColumns() {
      return Object.keys(this.columnSettingsList).filter(column => this.columnSettingsList[column]);
    },

    // 🆕 隱藏欄位數量
    hiddenColumnsCount() {
      return Object.values(this.columnVisibility).filter(visible => !visible).length;
    }
  },

  methods: {
    // 切換桌面版欄位設定面板
    toggleColumnSettings() {
        this.showColumnSettings = !this.showColumnSettings;
        
        // 如果開啟欄位設定，關閉其他下拉選單
        if (this.showColumnSettings) {
            this.showMobileMenu = false;
            this.closeOtherFilters();
        }
    },
    // 切換小螢幕漢堡選單顯示狀態
    toggleMobileMenu() {
        this.showMobileMenu = !this.showMobileMenu;
    },

    // 🆕 切換欄位顯示狀態
    toggleColumnVisibility(columnName) {
      this.columnVisibility[columnName] = !this.columnVisibility[columnName];
      // 將設定保存到 localStorage
      localStorage.setItem('columnVisibility', JSON.stringify(this.columnVisibility));
      // ✅ 刷新 Lucide 圖示
      this.$nextTick(() => {
        lucide.createIcons();
      });
    },

    // 關閉所有下拉選單（包含小螢幕選單）
    closeAllDropdowns() {
        this.showMobileMenu = false;
        this.showMobileColumnSettings = false;
        this.showColumnSettings = false;
        // 關閉其他篩選下拉選單
        this.showDateFilter = false;
        this.showBuildingFilter = false;
        this.showFloorFilter = false;
        this.showStationFilter = false;
        this.showCategoryFilter = false;
        this.showProposerFilter = false;
        this.showCaseCategoriesFilter = false;
        this.showDescriptionFilter = false;
        this.showPDCAFilter = false;
        this.showDueDateFilter = false;
        this.showProjectOwnerFilter = false;
        this.showItemDueDateFilter = false;
        this.showStatusFilter = false;
    },
    
    // 🆕 檢查欄位是否可見
    isColumnVisible(columnName) {
      // 換算金額僅限管理員可見
      if (columnName === '換算金額' && this.userRole !== 'admin') return false;
      return this.columnVisibility[columnName];
    },

    // 🆕 全選所有欄位
    selectAllColumns() {
      // 將所有欄位設為顯示
      Object.keys(this.columnVisibility).forEach(columnName => {
        this.columnVisibility[columnName] = true;
      });
      // 保存設定
      localStorage.setItem('columnVisibility', JSON.stringify(this.columnVisibility));
    },

    // 🆕 重設欄位顯示設定（恢復預設值）
    resetColumnVisibility() {
      this.columnVisibility = {
        '項次': false,
        '提案日期': true,
        '距今': false,
        '棟別': true,
        '樓層': true,
        '站點': true,
        '類別': true,
        '提案人': true,
        '案件分類': true,
        '問題描述': true,
        'PDCA': false,          // 預設隱藏
        '截止日期': false,      // 預設隱藏
        '專案Owner': true,
        '換算金額': true,      // 僅管理員可見
        '項目DueDate': false,   // 預設隱藏
        '進度紀錄': true,
        'Status': true,
        '操作': true
      };
      localStorage.setItem('columnVisibility', JSON.stringify(this.columnVisibility));
    },

    // 🆕 載入欄位顯示設定
    loadColumnVisibility() {
      const saved = localStorage.getItem('columnVisibility');
      if (saved) {
        try {
          this.columnVisibility = { ...this.columnVisibility, ...JSON.parse(saved) };
        } catch (e) {
          console.warn('無法載入欄位顯示設定:', e);
        }
      }
    },

    // 切換距今天數排序
    toggleDaysAgoSort() {
        if (this.daysAgoSortOrder === null) {
            this.daysAgoSortOrder = 'asc';  // 升序：距今天數少的在前
        } else if (this.daysAgoSortOrder === 'asc') {
            this.daysAgoSortOrder = 'desc'; // 降序：距今天數多的在前
        } else {
            this.daysAgoSortOrder = null;   // 取消排序，回到原始項次排序
        }
        
        console.log("距今排序狀態:", this.daysAgoSortOrder);
    },

    // 修改 smoothScrollTo 方法，只在自動滾動時顯示 Toast
    smoothScrollTo(targetPosition, duration = 1000) {
      const container = this.$refs.tableContainer;
      if (!container) return;
      
      const startPosition = container.scrollTop;
      const distance = targetPosition - startPosition;
      const startTime = performance.now();
      
      // 只在非零目標位置時顯示 Toast（即自動滾動到特定位置）
      if (targetPosition !== 0) {
        this.showScrollToast = true;
        this.scrollProgress = 0;
      }
      
      const easeInOutCubic = (t) => {
        return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
      };
      
      const animateScroll = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = easeInOutCubic(progress);
        
        container.scrollTop = startPosition + (distance * ease);
        
        // 更新進度條（只在顯示 Toast 時）
        if (this.showScrollToast) {
          this.scrollProgress = progress * 100;
        }
        
        if (progress < 1) {
          requestAnimationFrame(animateScroll);
        } else {
          // 滾動完成，隱藏 Toast
          this.hideScrollToast();
        }
      };
      
      requestAnimationFrame(animateScroll);
    },

    // 🆕 隱藏滾動 Toast
    hideScrollToast() {
      this.showScrollToast = false;
      this.scrollProgress = 0;
    },

    handleManualScroll() {
      // ✅ 當使用者手動滾動時隱藏 Toast
      if (this.showScrollToast) {
        this.hideScrollToast();
      }
      
      if (this.scrollToastTimer) {
        clearTimeout(this.scrollToastTimer);
      }
    },

    // 🆕 初始化滾動優化
    initScrollOptimization() {
      const container = this.$refs.tableContainer;
      if (!container) return;
      
      let isScrolling = false;
      
      container.addEventListener('scroll', () => {
        if (!isScrolling) {
          requestAnimationFrame(() => {
            this.handleManualScroll(); // 處理手動滾動
            isScrolling = false;
          });
          isScrolling = true;
        }
      }, { passive: true });
    },

    // 🆕 恢復滾動位置方法
    // 修改後的恢復滾動位置方法 - 簡化版本
    restoreScrollPosition() {
      const urlParams = new URLSearchParams(window.location.search);
      const recordId = urlParams.get('recordId');
      const scrollPos = urlParams.get('scrollPos');
      
      let targetScrollPosition = 0;
      
      // 優先級：URL參數 > localStorage特定記錄 > 通用滾動位置
      if (scrollPos) {
        // 來自編輯頁面返回的滾動位置
        targetScrollPosition = parseInt(scrollPos);
      } else if (recordId) {
        // 特定記錄的滾動位置
        const savedScrollPosition = localStorage.getItem(`scrollPosition_${recordId}`);
        if (savedScrollPosition) {
          targetScrollPosition = parseInt(savedScrollPosition);
        }
      } else {
        // 通用的最後滾動位置（例如登出後重新登入）
        const lastScrollPosition = localStorage.getItem('lastScrollPosition');
        if (lastScrollPosition) {
          targetScrollPosition = parseInt(lastScrollPosition);
          // 使用後清除
          localStorage.removeItem('lastScrollPosition');
        }
      }
      
      // 使用平滑滾動到目標位置
      if (targetScrollPosition > 0 && this.$refs.tableContainer) {
        this.$nextTick(() => {
          setTimeout(() => {
            this.smoothScrollTo(targetScrollPosition, 1000);
            
            // 清除特定記錄的滾動位置
            if (recordId) {
              localStorage.removeItem(`scrollPosition_${recordId}`);
            }
          }, 300);
        });
      }
    },

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
        
        // 檢查是否為瀏覽人
        const viewerResponse = await axios.get('http://127.0.0.1:5000/api/check_Permission', {
          params: {
            filename: this.username,
            role: '瀏覽人'
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
          console.warn('JSON 檔案重新命名失敗，但不影響主要功能');
        }
        
        // 4. 更新前端資料
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

        await this.loadMeetingRecords(); // 重新載入會議記錄
        
        // 5. 關閉對話框
        this.showUnrejectModal = false;

        // 6. 顯示成功訊息
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
    calculateDaysAgo(proposalDate, status) {
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
    getDaysAgoClass(proposalDate, status) {
      if (!proposalDate) return '';

      // Pending / Closed 不顯示顏色
      if (status === 'Pending' || status === 'Closed') {
        return 'text-gray-500';  // Pending/Closed 顯示灰色
      }

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

    // 【新增】處理 專案Owner 陣列的方法
    getOwnerArray(owner) {
      if (!owner) return []; // 如果 owner 是 null, undefined 或空字串，返回空陣列
      if (typeof owner === 'string') {
        // 將 "Owner A, Owner B" 這樣的字串拆分成陣列
        return owner.split(',').map(o => o.trim()).filter(o => o);
      }
      // 如果資料本身就是陣列，直接返回
      return Array.isArray(owner) ? owner : [owner];
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

    selectCategory(category) {
      this.newRecord.類別 = category;
      this.showCategoryDropdown = false;
    },

      // 新增：案件分類選擇方法
    selectCaseCategory(category) {
      this.newRecord.案件分類 = category;
      this.newRecord.產品顆數 = "";
      this.newRecord.影響產能 = "";
      this.calculateFormulaAmount();
      this.showCaseCategoryDropdown = false;
    },

    // 公式換算金額計算（單位：NTD，依比重加乘）
    calculateFormulaAmount() {
      const H = parseFloat(this.newRecord.處理時間H) || 0;
      const engineers = parseFloat(this.newRecord.工程師人數) || 0;
      const 顆數 = parseFloat(this.newRecord.產品顆數) || 0;
      const 產能 = parseFloat(this.newRecord.影響產能) || 0;
      const cat = this.newRecord.案件分類;
      const weightMap = {
        '公安':     5,   // 工安
        '品質(死貨)': 4,
        '效率(產能)': 3,
        '資安':     2,
        '日常':     1,
      };
      const weight = weightMap[cat] || 1;
      // 工程師費用（NTD）= 人數 × 時間H × 610
      let base = engineers * H * 610;
      // 附加費用：美金單價×30換NTD
      if (cat === '品質(死貨)') base += 顆數 * 1 * 30;
      else if (cat === '效率(產能)') base += 產能 * 1 * 30;
      // 頻率：未填寫時視為 1（不影響金額）
      // 選「月」→ 金額維持月頻率計算；選「年」→ 月頻率 ×12 換算成年
      const freq = parseFloat(this.newRecord.頻率) || 1;
      const freqMultiplier = this.newRecord.頻率年月 === '年' ? 12 : 1;
      this.newRecord.換算金額 = base * weight * freq * freqMultiplier;
    },

    // 管理員檢視用：換算金額統一以「月」呈現
    // 頻率為「年」的記錄，儲存金額是年金額 → ÷12；「月」則正常顯示
    getMonthlyAmount(record) {
      const amt = parseFloat(record.換算金額) || 0;
      if (!amt) return 0;
      const monthly = record.頻率年月 === '年' ? amt / 12 : amt;
      return Math.round(monthly * 100) / 100;
    },


      // 檢查樓層是否匹配（處理多種樓層格式）
    checkFloorMatch(floorData) {
      if (!floorData) return true; // 如果沒有樓層資料，視為匹配
      
      const floors = this.getFloorArray(floorData);

      // 直接檢查是否有任何一個樓層在已選清單中
      return floors.some(floor => 
        this.checkedFloors.includes(floor.trim())
      );
    },
      // 檢查站點是否匹配（處理多種站點格式）
    checkStationMatch(stationData) {
      if (!stationData) return true; // 如果沒有站點資料，視為匹配
      
      const stations = this.getStationArray(stationData);
      
      // 直接檢查是否有任何一個站點在已選清單中
      return stations.some(station => 
        this.checkedStations.includes(station.trim())
      );
    },

      // 檢查問題描述是否匹配
      checkDescriptionMatch(descriptionData) {
        if (!descriptionData) return true;
        
        const description = String(descriptionData).trim();
        
        // 檢查是否有任何已選的描述關鍵字包含在此描述中
        return this.checkedDescriptions.some(selectedDesc => {
          // 移除 "..." 後綴進行比較
          const cleanSelected = selectedDesc.replace(/\.\.\.+$/, '');
          return description.includes(cleanSelected) || cleanSelected.includes(description.substring(0, 50));
        });
      },

      // 清除問題描述篩選
      clearDescriptionFilter() {
        this.checkedDescriptions = [];
        this.refreshIcons();   // ✅ 補上
      },


    // 清除樓層篩選
    clearFloorFilter() {
      this.checkedFloors = [];
      this.refreshIcons();   // ✅ 補上
    },

    // 清除站點篩選
    clearStationFilter() {
      this.checkedStations = [];
      this.refreshIcons();   // ✅ 補上
    },


    // 清除 Status 篩選
    clearStatusFilter() {
      this.checkedStatus = [];
      this.showStatusFilter = false;
      this.refreshIcons();   // ✅ 補上
    },


    // 清除 PDCA 篩選
    clearPDCAFilter() {
      this.checkedPDCA = [];
      this.showPDCAFilter = false;
      this.refreshIcons();
    },


    // 清除專案Owner 篩選
    clearProjectOwnerFilter() {
      this.checkedProjectOwners = [];
      this.showProjectOwnerFilter = false;
      this.refreshIcons();
    },


    clearDueDateFilter() {
      this.checkedDueDates = [];
      this.showDueDateFilter = false;
      this.refreshIcons();
    },


    toggleDropdown(targetDropdown) {
      const isCurrentlyOpen = this[targetDropdown];
      // 先關閉所有下拉選單
      this.showItemDueDateFilter = false;
      this.showDateFilter = false;
      this.showBuildingDropdown = false;
      this.showFloorDropdown = false;
      this.showCategoryDropdown = false;
      this.showCaseCategoryDropdown = false;
      this.showStatusFilter = false;
      this.showPDCAFilter = false;
      this.showProjectOwnerFilter = false;
      this.showDueDateFilter = false;
      this.showBuildingFilter = false;
      this.showFloorFilter = false;
      this.showStationFilter = false;
      this.showProposerFilter = false;
      this.showDescriptionFilter = false;
      this.showCaseCategoriesFilter = false;
      this.showColumnSettings = false;
      
      // // 開啟目標下拉選單
      // this[targetDropdown] = true;
      // 如果點的是已開啟的，就關閉；否則就開啟
      this[targetDropdown] = !isCurrentlyOpen;
    },


    // 修正點擊外部邏輯，確保表頭點擊能正常切換
    handleClickOutside(event) {
      if (this.$refs.BuildingDropdown && !this.$refs.BuildingDropdown.contains(event.target)) {
        this.showBuildingDropdown = false;
      }
      if (this.$refs.floorDropdown && !this.$refs.floorDropdown.contains(event.target)) {
        this.showFloorDropdown = false;
      }
      if (this.$refs.categoryDropdown && !this.$refs.categoryDropdown.contains(event.target)) {
        this.showCategoryDropdown = false;
      }
      if (this.$refs.caseCategoryDropdown && !this.$refs.caseCategoryDropdown.contains(event.target)) {
        this.showCaseCategoryDropdown = false;
      }
      
      // 日期篩選的特殊處理
      if (this.$refs.DateFilterWrapper && !this.$refs.DateFilterWrapper.contains(event.target)) {
        this.showDateFilter = false;
      }

      // 🆕 欄位設定的處理
      if (this.$refs.columnSettingsWrapper && !this.$refs.columnSettingsWrapper.contains(event.target)) {
        this.showColumnSettings = false;
      }

          // 新增棟別篩選的處理
      if (this.$refs.BuildingFilterWrapper && !this.$refs.BuildingFilterWrapper.contains(event.target)) {
        this.showBuildingFilter = false;
      }

      // 新增樓層篩選的處理
      if (this.$refs.FloorFilterWrapper && !this.$refs.FloorFilterWrapper.contains(event.target)) {
        this.showFloorFilter = false;
      }
      // 新增站點篩選的處理
      if (this.$refs.StationFilterWrapper && !this.$refs.StationFilterWrapper.contains(event.target)) {
        this.showStationFilter = false;
      }
        // 新增類別篩選的處理 - 注意 ref 名稱要對應
      if (this.$refs.CategoryFilterWrapper && !this.$refs.CategoryFilterWrapper.contains(event.target)) {
        this.showCategoryFilter = false;
      }
      
      if (this.$refs.ProposerFilterWrapper && !this.$refs.ProposerFilterWrapper.contains(event.target)) {
        this.showProposerFilter = false;
      }

      if (this.$refs.DescriptionFilterWrapper && !this.$refs.DescriptionFilterWrapper.contains(event.target)) {
        this.showDescriptionFilter = false;
      }
      if (this.$refs.caseCategoriesFilterWrapper && !this.$refs.caseCategoriesFilterWrapper.contains(event.target)) {
        this.showCaseCategoriesFilter = false;
      }
      if (this.$refs.StatusFilterWrapper && !this.$refs.StatusFilterWrapper.contains(event.target)) {
        this.showStatusFilter = false;
      }
      if (this.$refs.PDCAFilterWrapper && !this.$refs.PDCAFilterWrapper.contains(event.target)) {
        this.showPDCAFilter = false;
      }
      if (this.$refs.ProjectOwnerFilterWrapper && !this.$refs.ProjectOwnerFilterWrapper.contains(event.target)) {
        this.showProjectOwnerFilter = false;
      }
      if (this.$refs.DueDateFilterWrapper && !this.$refs.DueDateFilterWrapper.contains(event.target)) {
        this.showDueDateFilter = false;
      }
      if (this.$refs.ItemDueDateFilterWrapper && !this.$refs.ItemDueDateFilterWrapper.contains(event.target)) {
        this.showItemDueDateFilter = false;
      }
      // 處理手機選單
      if (this.$refs.mobileMenuWrapper && !this.$refs.mobileMenuWrapper.contains(event.target)) {
        this.showMobileMenu = false;
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

    // 關閉新增
    cancelAdd() {
      this.newRecord = this.getNewRecordTemplate();
      this.showAddModal = false;
    },
    
    // 建立新記錄時的模板生成器。
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
        工程師人數: "",
        處理時間H: "",
        產品顆數: "",
        影響產能: "",
        頻率: "",
        頻率年月: "月",   // 內定為月頻率（月*12 = 年頻率）
        換算金額: 0,
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

    // 截斷文字顯示前N個字符
    truncateText(text, maxLength = 15) {
      if (text === null || text === undefined) return "";
      
      const textStr = typeof text === 'string' ? text : String(text);
      
      if (textStr.length <= maxLength) {
        return textStr;
      }
      
      return textStr.substring(0, maxLength) + '...';
    },

    // 顯示完整的問題描述
    showFullDescription(description) {
      if (!description || description.trim() === '') {
        Swal.fire({
          icon: 'info',
          title: '問題描述',
          text: '無內容',
          confirmButtonText: '關閉'
        });
        return;
      }

      Swal.fire({
        title: '<span style="color: #1e293b;">問題描述</span>',
        html: `<div style="text-align: left; white-space: pre-wrap; word-wrap: break-word; color: #1e293b; max-height: 400px; overflow-y: auto; padding: 10px;">${description}</div>`,
        confirmButtonText: '關閉',
        confirmButtonColor: '#6366f1',
        width: '600px'
      });
    },

    // 顯示 Tooltip
    showTooltip(event, content) {
      if (!content || content.trim() === '') {
        return;
      }

      // 計算 tooltip 位置（滑鼠右下方）
      const offsetX = 15;
      const offsetY = 10;
      
      let x = event.clientX + offsetX;
      let y = event.clientY + offsetY;
      
      // 預估 tooltip 寬度（max-w-md = 28rem = 448px）
      const tooltipWidth = 448;
      const tooltipHeight = 100; // 預估高度
      
      // 檢查右邊界
      if (x + tooltipWidth > window.innerWidth) {
        x = event.clientX - tooltipWidth - 10; // 顯示在滑鼠左側
      }
      
      // 檢查下邊界
      if (y + tooltipHeight > window.innerHeight) {
        y = event.clientY - tooltipHeight - 10; // 顯示在滑鼠上方
      }
      
      this.tooltip.content = content;
      this.tooltip.x = Math.max(10, x); // 至少離左邊 10px
      this.tooltip.y = Math.max(10, y); // 至少離上邊 10px
      this.tooltip.visible = true;
    },

    // 隱藏 Tooltip
    hideTooltip() {
      this.tooltip.visible = false;
      this.tooltip.content = '';
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
      const maxWidth = 28; // 設定最大寬度為28
      
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

    // formatDate(val) - 顯示用的日期格式化
    // 輸入：20241225 → 輸出：2024/12/25
    // 輸入：20240301 → 輸出：2024/03/01
    formatDate(val) {
      if (!val) return "";
      const str = val.toString().trim();
      if (str.length !== 8 || !/^\d{8}$/.test(str)) return str;
      return `${str.slice(0, 4)}/${str.slice(4, 6)}/${str.slice(6, 8)}`;
    },

    // 輸入：2024-12-25 → 輸出：20241225
    // 用於新增 Modal 中的日期輸入欄位
    updateDate(field, val) {
      if (!val) {
        this.newRecord[field] = "";
        return;
      }
      const yyyymmdd = val.replace(/-/g, "");
      this.newRecord[field] = yyyymmdd;
    },

    // 引用符號刷新Function
    refreshIcons() {
      this.$nextTick(() => {
        lucide.createIcons();
      });
    },

    handleOwnerKeydown(event) {
      if (event.key === "Enter") {
        event.preventDefault(); // 阻止表單提交或換行

        // 取得目前的值並去除頭尾多餘的空格
        let currentValue = this.newRecord.專案Owner.trim();

        // 如果輸入框不為空，且結尾不是逗號，就補上 ", "
        if (currentValue && !currentValue.endsWith(',')) {
          this.newRecord.專案Owner = currentValue + ', ';
        }
        // 如果結尾是逗號，但沒有空格，補上空格
        else if (currentValue.endsWith(',') && !currentValue.endsWith(', ')) {
          this.newRecord.專案Owner = currentValue + ' ';
        }
      }
    },


    // ============================================================
// 📌 替換 addRecord 方法
// 位置：defficultmeeting.js 第 2482-2610 行
// ============================================================

    // 新增紀錄
    async addRecord() {
      // ✅ 防止重複提交
      if (this.isUploading) return;
      this.isUploading = true;

      try {
        // 驗證必填欄位
        const requiredFields = [
          { field: '棟別', value: this.newRecord.棟別, label: '棟別' },
          { field: '樓層', value: this.newRecord.樓層, label: '樓層' },
          { field: '站點', value: this.newRecord.站點, label: '站點' },
          { field: '提案人', value: this.infoname, label: '提案人' },
          { field: '問題描述', value: this.newRecord.問題描述, label: '問題描述' },
          { field: 'PDCA', value: this.newRecord.PDCA, label: 'PDCA' },
          { field: 'Status', value: this.newRecord.Status, label: 'Status' }
        ];

        const missingFields = [];

        // 檢查每個必填欄位
        requiredFields.forEach(item => {
          if (item.field === '棟別' || item.field === '樓層') {
            if (!item.value || (Array.isArray(item.value) && item.value.length === 0)) {
              missingFields.push(item.label);
            }
          } else {
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

        // 清理專案Owner字串
        const cleanedOwners = this.newRecord.專案Owner
          .trim()
          .replace(/[\s,]+/g, ', ')
          .replace(/,$/, '');

        // 準備 payload
        const payload = {
          ...this.newRecord,
          棟別: this.newRecord.棟別.includes('全棟別') ? '全棟別' : this.newRecord.棟別.join(', '),
          樓層: this.newRecord.樓層.includes('全樓層') ? '全樓層' : this.newRecord.樓層.join(', '),
          站點: this.newRecord.站點.trim(),
          提案人: this.infoname,
          專案Owner: cleanedOwners,
          進度紀錄: this.newRecord.進度紀錄 || '',
          頻率: String(this.newRecord.頻率 || ''),
          頻率年月: this.newRecord.頻率年月 || '月'
        };

        const res = await fetch(`http://127.0.0.1:5000/api/add_record?username=${encodeURIComponent(this.username)}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }

        const data = await res.json();

        if (data.status === "success") {
          // ✅ 如果有圖片，上傳圖片
          let imageUploadSuccess = true;
          const imageCount = this.images.length;
          
          if (imageCount > 0) {
            // 取得剛建立的記錄 ID (後端需要回傳)
            const recordId = data.id || data.record_id || payload.id;
            
            if (recordId) {
              const uploadResult = await this.uploadImages(recordId);
              
              if (!uploadResult.success) {
                imageUploadSuccess = false;
                await Swal.fire({
                  icon: 'warning',
                  title: '記錄已新增',
                  html: `<p>但圖片上傳失敗：</p><p class="text-red-500 text-sm">${uploadResult.message}</p>`,
                  confirmButtonColor: '#f59e0b'
                });
              }
            } else {
              console.warn('⚠️ 後端未回傳 record_id，無法上傳圖片');
            }
          }

          // 顯示成功訊息
          if (imageUploadSuccess) {
            await Swal.fire({
              icon: 'success',
              title: '新增成功！',
              text: imageCount > 0 
                ? `資料已儲存，已上傳 ${imageCount} 張圖片`
                : '資料已成功儲存',
              confirmButtonText: '確認',
              confirmButtonColor: '#10b981',
              timer: 2000,
              timerProgressBar: true
            });
          }

          // 重新載入資料
          this.loadMeetingRecords();
          
          // ✅ 清理圖片
          this.clearAllImages();
          
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
      } finally {
        // ✅ 確保重置上傳狀態
        this.isUploading = false;
      }
    },

    // // 編輯記錄 - 跳轉到編輯頁面
    // editRecord(record) {
    //   // 記錄當前滾動位置
    //   const currentScrollPosition = this.$refs.tableContainer ? this.$refs.tableContainer.scrollTop : 0;
    //   localStorage.setItem(`scrollPosition_${record.項次}`, currentScrollPosition);

    //   this.selectRow(record.id);
    //   // 🆕 記憶選中的項目
    //   try {
    //     localStorage.setItem("selectedRowId", record.id);
    //   } catch (e) {
    //     console.error("儲存 selectedRowId 發生錯誤:", e);
    //   }



    //   console.log("📌 編輯記錄:", {
    //     項次: record.項次,
    //     滾動位置: currentScrollPosition
    //   });
      
    //   // 跳轉到編輯頁面（使用固定檔名 + URL參數）
    //   const editUrl = `editing_meeting.html?username=${encodeURIComponent(this.username)}&recordId=${record.項次}&scrollPos=${currentScrollPosition}`;
    //   window.location.href = editUrl;
    // },


    // 編輯記錄 - 跳轉到編輯頁面
      editRecord(record) {
          // 記錄當前滾動位置
          const currentScrollPosition = this.$refs.tableContainer ? this.$refs.tableContainer.scrollTop : 0;
          localStorage.setItem(`scrollPosition_${record.項次}`, currentScrollPosition);

          this.selectRow(record.id);
          // 🆕 記憶選中的項目
          try {
              localStorage.setItem("selectedRowId", record.id);
          } catch (e) {
              console.error("儲存 selectedRowId 發生錯誤:", e);
          }

          // ⭐ 新增：如果是提案人查看自己的提案，延遲標記已讀
          if (record.提案人 === this.infoname && record.提案序號) {
              setTimeout(() => {
                  this.markMeetingAsRead(record.提案序號);
              }, 2000);
          }

          console.log("📌 編輯記錄:", {
              項次: record.項次,
              滾動位置: currentScrollPosition
          });
          
          // 跳轉到編輯頁面（使用固定檔名 + URL參數）
          const editUrl = `editing_meeting.html?username=${encodeURIComponent(this.username)}&recordId=${record.項次}&scrollPos=${currentScrollPosition}`;
          window.location.href = editUrl;
      },
    // 🔧 修改後的 loadMeetingRecords 方法 - 添加滾動恢復
    async loadMeetingRecords() {
      console.log("📌 開始載入會議記錄...");
      this.showScrollToast = true;

      try {
        const res = await axios.get(`http://127.0.0.1:5000/api/meeting_records?username=${encodeURIComponent(this.username)}`);

        if (res.data && res.data.data) {
          // 最新的在前
          this.records = res.data.data.sort((a, b) => {
            const aTime = parseInt(a.項次) || 0;
            const bTime = parseInt(b.項次) || 0;
            return bTime - aTime;
          });

          console.log(`📌 成功載入 ${this.records.length} 筆會議記錄`);

          this.$nextTick(() => {
            this.restoreScrollPosition();
          });
        } else {
          console.error("❌ 沒有收到資料");
          this.records = [];
        }
      } catch (err) {
        console.error("❌ API 讀取失敗：", err);
        this.records = [];
      } finally {
        this.showScrollToast = false;
      }
    },

    addOwner() {
      const val = this.ownerInput.trim();
      if (val && !this.newRecord.專案Owner.includes(val)) {
        this.newRecord.專案Owner.push(val);
      }
      this.ownerInput = "";
    },

    removeOwner(index) {
      this.newRecord.專案Owner.splice(index, 1);
    },

    // 新增此方法，類似 checkStationMatch
    checkProjectOwnerMatch(ownerData) {
      if (!ownerData) return true; // 如果項目沒有 Owner 資料，視為匹配（或可改為 false，依需求決定）

      // 將 "Owner A, Owner B" 這樣的字串拆分成陣列
      const owners = String(ownerData).split(',').map(o => o.trim());

      // 檢查項目的任何一個 Owner 是否存在於已勾選的篩選清單中
      return owners.some(owner =>
        this.checkedProjectOwners.includes(owner)
      );
    },
    
    // 在 methods 區塊中加入登出功能
    logout() {
      // 記錄當前滾動位置
      const currentScrollPosition = this.$refs.tableContainer ? this.$refs.tableContainer.scrollTop : 0;
      localStorage.setItem('lastScrollPosition', currentScrollPosition);
      
      console.log("登出時記錄滾動位置:", currentScrollPosition);
      
      // 清除用戶資訊（但保留滾動位置）
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
    },
    
    // 清除提案日期篩選
    clearDateFilter() {
      this.checkedDates = [];
      this.refreshIcons(); 
    },

    // 清除棟別篩選
    clearBuildingFilter() {
      this.checkedBuildings = [];
      this.refreshIcons(); 
    },
    
      // 清除類別篩選
    clearCategoryFilter() {
      this.checkedCategories = [];
      this.refreshIcons(); 
    },

     // 清除提案人篩選
    clearProposerFilter() {
      this.checkedProposers = [];
      this.refreshIcons();   
    },

    // 清除案件分類篩選
    clearCaseCategoriesFilter() {
      this.checkedCaseCategories = [];
      this.refreshIcons();   
    },

    // 清除項目DueDate篩選
    clearItemDueDateFilter() {
      this.checkedItemDueDates = [];
      this.refreshIcons();
    },


      // 檢查棟別是否匹配（處理多種棟別格式）
    checkBuildingMatch(buildingData) {
      if (!buildingData) return true; // 如果沒有棟別資料，視為匹配
      
      const buildings = this.getBuildingArray(buildingData);
      
      console.log('檢查棟別匹配:', {
        原始資料: buildingData,
        解析後: buildings,
        已選擇: this.checkedBuildings
      });
      
      // 直接檢查是否有任何一個棟別在已選清單中
      // 移除「全棟別」的特殊處理，讓它與其他棟別平等對待
      return buildings.some(building => 
        this.checkedBuildings.includes(building.trim())
      );
    },


    selectRow(id) {
      this.selectedRowId = id;
      try {
        localStorage.setItem("selectedRowId", id);
      } catch (e) {
        console.error("localStorage setItem 發生錯誤:", e);
      }
    },

    clearAllFilters() {
      const keys = [
        'checkedDates',
        'checkedBuildings',
        'checkedFloors',
        'checkedStations',
        'checkedCategories',
        'checkedProposers',
        'checkedDescriptions',
        'checkedCaseCategories',
        'checkedStatus',
        'checkedPDCA',
        'checkedProjectOwners',
        'checkedDueDates',
        'checkedItemDueDates'
      ];

      keys.forEach(key => {
        this[key] = [];
        localStorage.removeItem(key);
      });

      this.selectedRowId = null;
      localStorage.removeItem("selectedRowId");

      this.$nextTick(() => {
        lucide.createIcons(); // 重新渲染 icon
      });

      this.saveFilterState();
    },

    downloadRecords() {
      if (this.filteredData.length === 0) {
        alert("目前沒有可匯出的資料！");
        return;
      }

      const columns = [
        '項次', '提案日期', '距今', '棟別', '樓層', '站點', '類別',
        '提案人', '案件分類', '工程師人數', '處理時間H', '產品顆數', '影響產能',
        '頻率年月', '頻率', '換算金額', '問題描述', 'PDCA', '截止日期',
        '專案Owner', '項目DueDate', '進度紀錄', 'Status'
      ];

      // 整理資料 & 避免科學記號 + 處理 Proxy(Array)
      const exportData = this.filteredData.map(record => {
        const row = {};
        columns.forEach(col => {
          let val = "";

          if (col === "進度紀錄") {
            const progress = record["進度紀錄"];
            // ✅ 若是 Proxy 陣列，取第一筆
            if (Array.isArray(progress)) {
              val = progress[0] ?? "";
            } else if (progress && typeof progress === "object" && progress.length !== undefined) {
              // 若是 Proxy 但 Array.isArray 失敗，用 Object.values 取
              val = Object.values(progress)[0] ?? "";
            } else {
              val = progress ?? "";
            }
          } else {
            val = record[col] ?? "";
          }

          // ✅ 防止科學記號
          if (col === "項次" || (/^\d+$/.test(val) && val.length > 11)) {
            val = "" + val;
          }

          row[col] = val;
        });
        return row;
      });

      // 🔍 Debug 輸出，方便你確認實際內容
      console.log("✅ 匯出資料 sample：", exportData[0]);

      // 🔸 建立 worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData, { header: columns });

      // 🔸 標題列樣式（第一列）
      columns.forEach((col, i) => {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: i });
        if (worksheet[cellAddress]) {
          worksheet[cellAddress].s = {
            font: { bold: true, color: { rgb: "000000" } },
            fill: { patternType: "solid", fgColor: { rgb: "DDDDDD" } },
            alignment: { horizontal: "center", vertical: "center" },
            border: {
              top: { style: "thin", color: { rgb: "999999" } },
              bottom: { style: "thin", color: { rgb: "999999" } },
              left: { style: "thin", color: { rgb: "999999" } },
              right: { style: "thin", color: { rgb: "999999" } },
            },
          };
        }
      });

      // 🔸 整行上色邏輯
      const range = XLSX.utils.decode_range(worksheet["!ref"]);
      const statusIndex = columns.indexOf("Status");

      for (let R = 1; R <= range.e.r; R++) {
        const statusCell = XLSX.utils.encode_cell({ r: R, c: statusIndex });
        const statusVal = (worksheet[statusCell]?.v || "").trim();

        let fillColor = null;
        if (statusVal === "New") fillColor = "FFCC80";        // 橘
        else if (statusVal === "On Going") fillColor = "FFF59D"; //黃
        else if (statusVal === "Closed" || statusVal === "完成") fillColor = "E0E0E0"; // 灰
        else if (statusVal === "TBD") fillColor = "C8E6C9";     // 綠

        if (fillColor) {
          // 對該列每個儲存格上色
          for (let C = 0; C <= range.e.c; C++) {
            const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
            if (!worksheet[cellAddress]) continue;

            worksheet[cellAddress].s = {
              fill: { patternType: "solid", fgColor: { rgb: fillColor } },
              alignment: { vertical: "center" },
              border: {
                top: { style: "thin", color: { rgb: "BBBBBB" } },
                bottom: { style: "thin", color: { rgb: "BBBBBB" } },
                left: { style: "thin", color: { rgb: "BBBBBB" } },
                right: { style: "thin", color: { rgb: "BBBBBB" } },
              },
            };
          }
        }
      }

      // 🔸 自動調整欄寬
      const colWidths = columns.map(col => {
        const maxLength = Math.max(
          col.length,
          ...exportData.map(row => String(row[col] || "").length)
        );
        return { wch: Math.min(maxLength + 2, 40) };
      });
      worksheet["!cols"] = colWidths;

      // 🔸 匯出
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "困難點會議紀錄");
      const filename = `困難點會議紀錄_${new Date().toISOString().slice(0, 10)}_(Security C).xlsx`;
      XLSX.writeFile(workbook, filename);
    },


      async saveFilterState() {
        if (!this.username) return;

        const filter_state = {
            checkedDates: this.checkedDates,
            checkedBuildings: this.checkedBuildings,
            checkedFloors: this.checkedFloors,
            checkedStations: this.checkedStations,
            checkedCategories: this.checkedCategories,
            checkedProposers: this.checkedProposers,
            checkedDescriptions: this.checkedDescriptions,
            checkedCaseCategories: this.checkedCaseCategories,
            checkedStatus: this.checkedStatus,
            checkedPDCA: this.checkedPDCA,
            checkedProjectOwners: this.checkedProjectOwners,
            checkedDueDates: this.checkedDueDates,
            checkedItemDueDates: this.checkedItemDueDates
        };

        try {
            const response = await axios.post('http://127.0.0.1:5000/api/save_filter_state', {
                username: this.username,
                filter_state: filter_state
            });

            if (response.data.status === 'success') {
                console.log('✅ 篩選狀態已儲存');
            } else {
                console.warn('⚠️ 儲存失敗:', response.data.message);
            }
        } catch (error) {
            console.error('❌ 儲存篩選狀態失敗:', error);
        }
    },

      async loadFilterState() {
        if (!this.username) return;

        this.isLoadingFilters = true;

        try {
            const response = await axios.get(`http://127.0.0.1:5000/api/load_filter_state?username=${encodeURIComponent(this.username)}`);
            
            if (response.data.status === 'success' && response.data.filter_state) {
                this.applyFilters(response.data.filter_state); // ✅ 用統一方法
                console.log('✅ 篩選狀態已從後端載入並套用');
            } else {
                console.warn('⚠️ 後端沒有儲存的篩選資料');
            }
        } catch (error) {
            console.error('❌ 載入篩選狀態失敗:', error);
        } finally {
            this.isLoadingFilters = false;
        }
    },

    // ✅ 套用篩選狀態
    applyFilters(filters) {
      this.checkedDates = filters.checkedDates || [];
      this.checkedBuildings = filters.checkedBuildings || [];
      this.checkedFloors = filters.checkedFloors || [];
      this.checkedStations = filters.checkedStations || [];
      this.checkedCategories = filters.checkedCategories || [];
      this.checkedProposers = filters.checkedProposers || [];
      this.checkedDescriptions = filters.checkedDescriptions || [];
      this.checkedCaseCategories = filters.checkedCaseCategories || [];
      this.checkedStatus = filters.checkedStatus || [];
      this.checkedPDCA = filters.checkedPDCA || [];
      this.checkedProjectOwners = filters.checkedProjectOwners || [];
      this.checkedDueDates = filters.checkedDueDates || [];
      this.checkedItemDueDates = filters.checkedItemDueDates || [];
    },
    // 🔁 防抖處理的篩選變更方法
    onFilterChange() {
      if (this.isLoadingFilters) return;

      if (this.filterSaveTimer) {
        clearTimeout(this.filterSaveTimer);
      }

      this.filterSaveTimer = setTimeout(() => {
        this.saveFilterState();
      }, 500);
    },

      // ✅ 以下只是為了避免 template 錯誤，可讓你替代原本的 toggleXXX 寫法
    toggleBuildingDropdown() {
      this.toggleDropdown('showBuildingDropdown');
    },
    toggleFloorDropdown() {
      this.toggleDropdown('showFloorDropdown');
    },
    toggleCategoryDropdown() {
      this.toggleDropdown('showCategoryDropdown');
    },
    toggleCaseCategoryDropdown() {
      this.toggleDropdown('showCaseCategoryDropdown');
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
    goDataChart() {
        const username = localStorage.getItem('username') || '';
        window.location.href = `datachart.html?username=${encodeURIComponent(username)}`;
    },
    
    // 跳轉到留言板
    goBulletinBoard() {
        const username = this.username || localStorage.getItem('username') || '';
        const infoname = this.infoname || localStorage.getItem('infoname') || '';
        const role = this.userRole || localStorage.getItem('userRole') || '';
        localStorage.setItem('infoname', infoname);
        localStorage.setItem('role', role);
        window.location.href = `bulletin-board.html?username=${encodeURIComponent(username)}`;
    },

    // 上傳圖片（含驗證）
    handleImageUpload(event) {
        const files = event.target.files;
        if (!files) return;

        for (let file of files) {
            // 驗證檔案類型
            if (!file.type.match(/^image\/(png|jpe?g|gif|webp)$/i)) {
                Swal.fire({
                    icon: 'warning',
                    title: '檔案格式不支援',
                    text: `${file.name} 不是支援的圖片格式`,
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
                continue;
            }

            // 驗證檔案大小 (限制 10MB)
            if (file.size > 10 * 1024 * 1024) {
                Swal.fire({
                    icon: 'warning',
                    title: '檔案過大',
                    text: `${file.name} 超過 10MB 限制`,
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
                continue;
            }

            const url = URL.createObjectURL(file);
            this.images.push({ file, url });
        }

        // 清空 input
        event.target.value = "";
        
        // 更新圖示
        this.$nextTick(() => lucide.createIcons());
    },
    
    // 處理拖曳上傳
    handleDrop(event) {
        this.isDragging = false;
        const files = event.dataTransfer.files;
        this.handleImageUpload({ target: { files }, value: '' });
    },

    // 清除全部圖片
    clearAllImages() {
        this.images.forEach(img => URL.revokeObjectURL(img.url));
        this.images = [];
    },

    // ✅ 新增：開啟圖片預覽
    openImagePreview(url, name) {
        this.previewImageUrl = url;
        this.previewImageName = name || '圖片預覽';
        this.showImagePreview = true;
        
        // 更新圖示
        this.$nextTick(() => lucide.createIcons());
        
        // 監聽 ESC 鍵關閉
        document.addEventListener('keydown', this.handlePreviewKeydown);
    },

    // ✅ 新增：關閉圖片預覽
    closeImagePreview() {
        this.showImagePreview = false;
        this.previewImageUrl = '';
        this.previewImageName = '';
        
        // 移除 ESC 鍵監聽
        document.removeEventListener('keydown', this.handlePreviewKeydown);
    },

    // ✅ 新增：處理預覽時的鍵盤事件
    handlePreviewKeydown(event) {
        if (event.key === 'Escape') {
            this.closeImagePreview();
        }
    },

    // 上傳圖片到後端
    async uploadImages(recordId) {
        if (this.images.length === 0) {
            return { success: true, message: '無圖片需上傳' };
        }

        const formData = new FormData();
        formData.append('record_id', recordId);
        
        this.images.forEach((img) => {
            formData.append('images', img.file);
        });

        try {
            const response = await axios.post(
                'http://127.0.0.1:5000/api/upload_meeting_images',
                formData,
                {
                    headers: { 'Content-Type': 'multipart/form-data' }
                }
            );

            return {
                success: response.data.status === 'success',
                message: response.data.message,
                uploaded: response.data.uploaded
            };
        } catch (error) {
            console.error('圖片上傳失敗:', error);
            return {
                success: false,
                message: error.response?.data?.message || '圖片上傳失敗'
            };
        }
    },
    /**
     * 載入未讀摘要
     * 從後端 API 獲取當前用戶的未讀訊息
     */
    async loadUnreadSummary() {
        // ⭐ 檢查是否有 infoname
        if (!this.infoname) {
            console.warn('⚠️ infoname 為空，無法載入未讀摘要');
            return;
        }
        
        try {
            // ⭐ 重要：傳遞 username 參數
            const url = `http://127.0.0.1:5000/api/proposer-read/my-summary?username=${encodeURIComponent(this.infoname)}`;
            console.log('📡 API 請求:', url);
            
            const response = await fetch(url);
            const result = await response.json();
            
            if (result.status === 'success') {
                this.unreadCount = result.data.total_unread;
                this.unreadItems = result.data.unread_items || [];  // ⭐ 改成 unread_items
                
                console.log('✅ 未讀摘要已更新:', {
                    提案人: result.data.proposer_name,
                    未讀數量: this.unreadCount,
                    未讀項目: this.unreadItems
                });
                
                // ⭐ 數據載入後立即初始化圖標
                this.$nextTick(() => {
                    if (typeof lucide !== 'undefined') {
                        lucide.createIcons();
                        console.log('✅ [數據載入後] Lucide 圖標已初始化');
                    }
                });
            } else if (result.status === 'error') {
                this.unreadCount = 0;
                this.unreadItems = [];
                
                if (!result.message.includes('未登入')) {
                    console.warn('⚠️ 載入未讀摘要失敗:', result.message);
                }
            }
        } catch (error) {
            console.error('❌ 載入未讀摘要發生錯誤:', error);
            this.unreadCount = 0;
            this.unreadItems = [];
        }
    },
        
    /**
     * 切換未讀面板顯示/隱藏
     */
    toggleUnreadPanel() {
        this.showUnreadPanel = !this.showUnreadPanel;
        
        // 顯示面板時重新載入 Lucide 圖標
        if (this.showUnreadPanel) {
            this.$nextTick(() => {
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            });
        }
    },
    
    /**
     * 跳轉到提案詳情並關閉未讀面板
     * @param {string} meetingId - 提案序號
     */
    goToMeeting(meetingId) {
        console.log('📍 跳轉到提案:', meetingId);
        this.showUnreadPanel = false;
        
        // 找到該筆記錄
        const meeting = this.records.find(r => r.提案序號 === meetingId);
        
        if (meeting) {
            // ⭐ 使用你現有的 editRecord 方法
            this.editRecord(meeting);
            
            // ⭐ 標記為已讀（延遲 2 秒後執行）
            setTimeout(() => {
                this.markMeetingAsRead(meetingId);
            }, 2000);
        } else {
            console.warn(`⚠️ 找不到提案: ${meetingId}`);
            
            // 重新載入記錄後再試
            this.loadMeetingRecords().then(() => {
                const retryMeeting = this.records.find(r => r.提案序號 === meetingId);
                if (retryMeeting) {
                    this.editRecord(retryMeeting);
                    setTimeout(() => {
                        this.markMeetingAsRead(meetingId);
                    }, 2000);
                }
            });
        }
    },
    
    /**
     * 標記提案為已讀
     * 當用戶查看提案詳情時調用
     * @param {string} meetingId - 提案序號（record_id）
     * @param {boolean} skipReload - 是否跳過重新載入未讀摘要
     */
    async markMeetingAsRead(meetingId, skipReload = false) {
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/proposer-read/mark/${meetingId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                console.log(`✅ 提案 ${meetingId} 已標記為已讀`);
                
                // ⭐ 如果不跳過重新載入，才調用 loadUnreadSummary
                if (!skipReload) {
                    // 重新載入未讀摘要
                    await this.loadUnreadSummary();
                    
                    // 如果有批量檢查，也重新檢查
                    if (typeof this.batchCheckUnread === 'function') {
                        await this.batchCheckUnread();
                    }
                }
            } else {
                console.warn('標記已讀失敗:', result.message);
            }
        } catch (error) {
            console.error('❌ 標記已讀發生錯誤:', error);
        }
    },
    
    /**
     * 全部標記已讀
     */
    async markAllAsRead() {
        if (!this.infoname) {
            console.warn('⚠️ infoname 為空，無法標記已讀');
            return;
        }
        
        try {
            // 確認對話框
            const result = await Swal.fire({
                title: '確認標記全部已讀？',
                text: `將標記您所有的 ${this.unreadCount} 個未讀提案為已讀`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#3b82f6',
                cancelButtonColor: '#6b7280',
                confirmButtonText: '確認',
                cancelButtonText: '取消'
            });
            
            if (!result.isConfirmed) {
                return;
            }
            
            // 調用 API
            const response = await fetch('http://127.0.0.1:5000/api/proposer-read/mark-all', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: this.infoname
                })
            });
            
            const apiResult = await response.json();
            
            if (apiResult.status === 'success') {
                console.log(`✅ 已標記 ${apiResult.marked_count} 個提案為已讀`);
                
                // 顯示成功訊息
                Swal.fire({
                    title: '標記成功！',
                    text: `已標記 ${apiResult.marked_count} 個提案為已讀`,
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                });
                
                // 關閉未讀面板
                this.showUnreadPanel = false;
                
                // 重新載入未讀摘要（應該變成 0）
                await this.loadUnreadSummary();
                
            } else {
                Swal.fire({
                    title: '標記失敗',
                    text: apiResult.message,
                    icon: 'error'
                });
            }
        } catch (error) {
            console.error('❌ 全部標記已讀發生錯誤:', error);
            Swal.fire({
                title: '發生錯誤',
                text: '標記已讀時發生錯誤，請稍後再試',
                icon: 'error'
            });
        }
    },
    
    /**
     * ESC 鍵事件處理
     * @param {KeyboardEvent} e 
     */
    handleEscapeKey(e) {
        if (e.key === 'Escape' && this.showUnreadPanel) {
            this.showUnreadPanel = false;
        }
    },
    
    /**
     * 批量檢查未讀狀態（可選功能）
     * 用於在列表中顯示未讀標記
     */
    async batchCheckUnread() {
        if (!this.filteredRecords || this.filteredRecords.length === 0) {
            return;
        }
        
        try {
            const meetingIds = this.filteredRecords.map(r => r.提案序號);
            
            const response = await fetch('http://127.0.0.1:5000/api/proposer-read/batch-check', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ meeting_ids: meetingIds })
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                // 將未讀狀態添加到每筆記錄
                this.filteredRecords.forEach(record => {
                    record.has_unread = result.data[record.提案序號] || false;
                });
                
                console.log('✅ 批量檢查未讀狀態完成');
            }
        } catch (error) {
            console.error('❌ 批量檢查未讀狀態失敗:', error);
        }
    },

        /**
     * 根據 recordId 跳轉到提案詳情
     */
    /**
     * 根據 recordId 跳轉到提案並標記已讀
     * @param {string} recordId - CSV 的 id 欄位
     */
    async goToMeetingByRecordId(recordId) {
        console.log('📍 跳轉到提案 (recordId):', recordId);
        
        // ⭐ 立即標記該 record_id 為已讀（跳過重新載入，手動更新）
        await this.markMeetingAsRead(recordId, true);
        
        // ⭐ 從未讀列表中移除該 record_id 的所有項目
        const beforeCount = this.unreadItems.length;
        this.unreadItems = this.unreadItems.filter(item => item.record_id !== recordId);
        const afterCount = this.unreadItems.length;
        const removedCount = beforeCount - afterCount;
        
        console.log(`✅ 已從未讀列表移除 ${removedCount} 個項目（record_id: ${recordId}）`);
        
        // ⭐ 更新未讀數量
        this.unreadCount = this.unreadItems.length;
        
        // ⭐ 如果沒有未讀項目了，關閉面板
        if (this.unreadCount === 0) {
            this.showUnreadPanel = false;
            console.log('✅ 所有項目已讀，關閉未讀面板');
        }
        
        // 跳轉到提案
        const meeting = this.records.find(r => r.id === recordId);
        
        if (meeting) {
            this.editRecord(meeting);
        } else {
            console.warn(`⚠️ 找不到 recordId: ${recordId}`);
            // 嘗試重新載入記錄
            await this.loadMeetingRecords();
            const retryMeeting = this.records.find(r => r.id === recordId);
            if (retryMeeting) {
                this.editRecord(retryMeeting);
            }
        }
    },

    /**
     * 格式化時間顯示
     */
    formatUnreadTime(isoTime) {
        try {
            const date = new Date(isoTime);
            const now = new Date();
            const diff = Math.floor((now - date) / 1000);
            
            if (diff < 60) return '剛剛';
            if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`;
            if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`;
            
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            
            return `${month}/${day} ${hours}:${minutes}`;
        } catch (e) {
            return isoTime;
        }
    },

    /**
     * 截斷內容顯示
     */
    truncateContent(content, maxLength = 50) {
        if (!content) return '';
        if (content.length <= maxLength) return content;
        return content.substring(0, maxLength) + '...';
    },
  //   async loadUnreadSummary() {
  //     // 臨時假數據，測試 UI
  //     this.unreadCount = 3;
  //     this.unreadItems = [
  //         {
  //             meeting_id: 'M001',
  //             title: '冷氣故障需要維修',
  //             new_comments: 3,
  //             new_progress: 1,
  //             category: '維修',
  //             building: 'A棟',
  //             floor: '3F',
  //             station: 'K18251'
  //         },
  //         {
  //             meeting_id: 'M002',
  //             title: '電梯異常',
  //             new_comments: 2,
  //             new_progress: 0,
  //             category: '維修',
  //             building: 'B棟',
  //             floor: '5F',
  //             station: 'K18252'
  //         },
  //         {
  //             meeting_id: 'M003',
  //             title: '漏水問題',
  //             new_comments: 0,
  //             new_progress: 2,
  //             category: '維修',
  //             building: 'C棟',
  //             floor: '2F',
  //             station: 'K18253'
  //         }
  //     ];
      
  //     console.log('✅ [測試模式] 使用假數據');
  // }
        
  },
  
  watch: {
    showAddModal(newVal) {
        if (newVal) {
            this.$nextTick(() => {
                lucide.createIcons();
            });
        } else {
            // ✅ Modal 關閉時清理圖片預覽
            this.images.forEach(img => URL.revokeObjectURL(img.url));
            this.images = [];
            this.isDragging = false;
            
            // ✅ 同時關閉圖片預覽
            this.closeImagePreview();
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
    },
    checkedDates: { handler() { this.onFilterChange(); }, deep: true },
    'newRecord.處理時間H': { handler() { this.calculateFormulaAmount(); } },
    'newRecord.工程師人數': { handler() { this.calculateFormulaAmount(); } },
    'newRecord.產品顆數': { handler() { this.calculateFormulaAmount(); } },
    'newRecord.影響產能': { handler() { this.calculateFormulaAmount(); } },
    'newRecord.頻率': { handler() { this.calculateFormulaAmount(); } },
    'newRecord.頻率年月': { handler() { this.calculateFormulaAmount(); } },
    checkedBuildings: { handler() { this.onFilterChange(); }, deep: true },
    checkedFloors: { handler() { this.onFilterChange(); }, deep: true },
    checkedStations: { handler() { this.onFilterChange(); }, deep: true },
    checkedCategories: { handler() { this.onFilterChange(); }, deep: true },
    checkedProposers: { handler() { this.onFilterChange(); }, deep: true },
    checkedDescriptions: { handler() { this.onFilterChange(); }, deep: true },
    checkedCaseCategories: { handler() { this.onFilterChange(); }, deep: true },
    checkedStatus: { handler() { this.onFilterChange(); }, deep: true },
    checkedPDCA: { handler() { this.onFilterChange(); }, deep: true },
    checkedProjectOwners: { handler() { this.onFilterChange(); }, deep: true },
    checkedDueDates: { handler() { this.onFilterChange(); }, deep: true },
    checkedItemDueDates: { handler() { this.onFilterChange(); }, deep: true },
        showMobileMenu(newVal) {
        if (newVal) {
            this.$nextTick(() => {
                lucide.createIcons();
            });
        }
    },
    
    showMobileColumnSettings(newVal) {
        if (newVal) {
            this.$nextTick(() => {
                lucide.createIcons();
            });
        }
    },
    
    showColumnSettings(newVal) {
        if (newVal) {
            this.$nextTick(() => {
                lucide.createIcons();
            });
        }
    }
  },

  async mounted() {
    const urlParams = new URLSearchParams(window.location.search);
    this.username = urlParams.get("username");
    
    console.log("🔌 Vue 應用已掛載,使用者:", this.username);
      if (!this.username || this.username === 'null' || this.username === null) {
      console.warn("⚠️ 偵測到 username 為 null，執行登出並重定向到登入頁面");
      
      // 清除所有相關的 localStorage 資料
      try {
        localStorage.removeItem('username');
        localStorage.removeItem('selectedRowId');
        localStorage.removeItem('scrollPosition');
        localStorage.removeItem('columnVisibility');
        console.log("🧹 已清除 localStorage 資料");
      } catch (e) {
        console.error("清除 localStorage 時發生錯誤:", e);
      }
      
      // 立即重定向到登入頁面
      window.location.href = '../index.html';
      return; // 停止執行後續代碼
    }
    this.loadColumnVisibility();
    
    if (this.username) {
      await this.checkUserPermissions();
      console.log("🔌 用戶角色:", this.userRole);
    }
    
    if (this.username) {
      // ✅ 先載入篩選狀態
      await this.loadFilterState();
      
      this.getUserInfoName();
      this.newRecord = this.getNewRecordTemplate();
      
      // ✅ 再載入會議記錄
      this.loadMeetingRecords();
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      this.isDataReady = true;

      this.$nextTick(() => {
        this.initScrollOptimization();
        this.restoreScrollPosition();
        lucide.createIcons();
      });
    } else {
      console.warn("⚠️ 未提供 username 參數");
    }

    // 移除舊的 localStorage 載入邏輯(因為已改用後端)
    // const keys = [...];
    // keys.forEach(key => {...});

    try {
      const savedRowId = localStorage.getItem("selectedRowId");
      if (savedRowId) {
        this.selectedRowId = savedRowId;
      }
    } catch (e) {
      console.error("localStorage getItem 發生錯誤:", e);
    }
        // ===== 載入未讀摘要（新增） =====
    this.loadUnreadSummary();
    
    // 每 5 分鐘自動更新一次未讀狀態
    this.unreadCheckInterval = setInterval(() => {
        this.loadUnreadSummary();
    }, 300000); // 300000ms = 5分鐘
    // ESC 鍵關閉未讀面板
    document.addEventListener('keydown', this.handleEscapeKey);

    document.addEventListener('click', this.handleClickOutside);
    
    // ⭐ Vue 掛載後初始化 Lucide 圖標
    this.$nextTick(() => {
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
        console.log('✅ [Vue mounted] Lucide 圖標已初始化');
      }
    });
  },

  beforeUnmount() {
    // 🆕 清理計時器
    if (this.scrollToastTimer) {
      clearTimeout(this.scrollToastTimer);
    }

        // 清除定時器
    if (this.unreadCheckInterval) {
        clearInterval(this.unreadCheckInterval);
    }
    document.removeEventListener('click', this.handleClickOutside);
     // 移除事件監聽
    document.removeEventListener('keydown', this.handleEscapeKey);
  }

});

app.mount("#app");