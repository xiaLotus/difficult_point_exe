const app = Vue.createApp({
    data() {
      return {
        username: "",
        records: [],
        chartStatus: null,
        chartWorkload: null,
        chartOwner: null,
        isUpdating: false,
        showSpinner: false,
        isloading: false,
      };
    },
    methods: {
      /* 工具函式 */
      toStr(v) { return (v ?? '').toString().trim(); },
      idToDate(id) {
        try {
          const s = this.toStr(id);
          return new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
        } catch { return null; }
      },
      parseDueDate(s) {
        s = this.toStr(s);
        if (!s || s.toUpperCase() === "TBD") return null;
        const p = s.split(/[-/]/);
        return new Date(+p[0], +p[1]-1, +p[2]);
      },
      isoWeekLabel(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
      },
      isoWeekEnd(weekLabel) {
        const [y, w] = weekLabel.split("-W").map(Number);
        const d = new Date(Date.UTC(y, 0, 1 + (w - 1) * 7));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + (8 - dayNum));
        return new Date(d);
      },
      buildLast8Weeks() {
        const labels = this.records
          .map(r => this.idToDate(r["項次"]))
          .filter(Boolean)
          .map(d => this.isoWeekLabel(d))
          .sort((a,b) => a.localeCompare(b));
        return Array.from(new Set(labels)).slice(-8);
      },
      normStatus(s) {
        s = this.toStr(s).toLowerCase();
        if (s.includes("on") && s.includes("going")) return "On Going";
        if (s === "new" || s === "新增") return "New";
        if (s === "pending" || s === "待處理") return "Pending";
        if (s === "closed" || s === "done" || s === "完成") return "Closed";
        return s ? s[0].toUpperCase() + s.slice(1) : "";
      },

      /* 第一張圖：狀態累積 */
      computeCumulativeStatus() {
          const weeks = this.buildLast8Weeks();
          const counts = Object.fromEntries(
              weeks.map(w => [w, { New: 0, "On Going": 0, Pending: 0, Closed: 0 }])
          );

          this.records.forEach(r => {
              const createDate = this.idToDate(r["項次"]);
              if (!createDate) return;

              const createWeek = this.isoWeekLabel(createDate);
              const st = this.normStatus(r["Status"]);

              // New 與 Closed 都只在建立週 + 結束週顯示
              if (st === "New" || st === "Closed") {
                  if (weeks.includes(createWeek)) {
                      counts[createWeek][st]++;
                  }
                  return;  // ⚠ 不往後累計
              }

              // 其餘（On Going / Pending）維持累計
              weeks.forEach(w => {
                  if (w >= createWeek && counts[w][st] !== undefined) {
                      counts[w][st]++;
                  }
              });
          });

          return { weeks, counts };
      },

      /* 第二張圖：工作累積概況（Closed 到當週,OnGoing 長期累計） */
      computeCumulativeWorkload() {
          const weeks = this.buildLast8Weeks();
          const counts = Object.fromEntries(
              weeks.map(w => [w, { "On Going": 0, "Closed": 0, "OverDue": 0 }])
          );

          this.records.forEach(r => {
              const createDate = this.idToDate(r["項次"]);
              if (!createDate) return;

              const createWeek = this.isoWeekLabel(createDate);
              const st = this.normStatus(r["Status"]);
              const due = this.parseDueDate(r["項目DueDate"]);

              // 🔹 Closed：只顯示在 createWeek
              if (st === "Closed") {
                  if (weeks.includes(createWeek)) {
                      counts[createWeek]["Closed"]++;
                  }
                  return;  // ⚠ 不累計到後續週別
              }    

              // 🔹 On Going 需持續累積
              weeks.forEach(w => {
                  if (w >= createWeek) {
                      counts[w]["On Going"]++;

                      // OverDue 判斷
                      if (due && this.isoWeekEnd(w) > due) {
                          counts[w]["OverDue"]++;
                      }
                  }
              });
          });

          return { weeks, counts };
      },

      /* 第三張圖：負責人案件件數（On Going & Pending & OverDue） */
      computeOwnerDaysFromNow() {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const ownerData = {};

          this.records.forEach(r => {
              const st = this.normStatus(r["Status"]);
              
              // 只統計 On Going 和 Pending
              if (st !== "On Going" && st !== "Pending") return;

              // 獲取負責人
              const owner = this.toStr(r["專案Owner"]);
              
              // 過濾未指派的案件
              if (!owner || owner === "未指派") return;

              const itemId = this.toStr(r["項次"]);
              const proposeDate = this.toStr(r["提案日期"]);

              // 初始化該負責人的數據
              if (!ownerData[owner]) {
                  ownerData[owner] = {
                      "On Going": [],
                      "Pending": [],
                      "OverDue": []
                  };
              }

              // 記錄該項目的詳細資訊（項次和提案日期）
              const itemInfo = { id: itemId, date: proposeDate };
              ownerData[owner][st].push(itemInfo);

              // 檢查是否超過 Due Date
              const dueDate = this.parseDueDate(r["項目DueDate"]);
              if (dueDate && today > dueDate) {
                  ownerData[owner]["OverDue"].push(itemInfo);
              }
          });

          // 計算每個負責人的件數
          const owners = Object.keys(ownerData).sort();
          const result = {
              owners: owners,
              onGoing: [],
              pending: [],
              overDue: [],
              // 保存詳細項次資訊供 tooltip 使用
              details: {}
          };

          owners.forEach(owner => {
              const onGoingItems = ownerData[owner]["On Going"];
              const pendingItems = ownerData[owner]["Pending"];
              const overDueItems = ownerData[owner]["OverDue"];

              result.onGoing.push(onGoingItems.length);
              result.pending.push(pendingItems.length);
              result.overDue.push(overDueItems.length);

              // 保存項次列表（按提案日期排序）
              result.details[owner] = {
                  "On Going": this.sortByDate(onGoingItems),
                  "Pending": this.sortByDate(pendingItems),
                  "OverDue": this.sortByDate(overDueItems)
              };
          });

          return result;
      },

      // 按提案日期排序項目
      sortByDate(items) {
          return items.sort((a, b) => {
              const dateA = a.date || '99999999';
              const dateB = b.date || '99999999';
              return dateA.localeCompare(dateB);
          }).map(item => item.id);
      },

    async renderCharts() {
        if (this.isUpdating) return;
        this.isUpdating = true;
        this.showSpinner = true;

        try {
            /* ---------------------- 第一張圖：案件狀態累積 ---------------------- */
            const S = this.computeCumulativeStatus();
            const sKeys = ["New", "On Going", "Pending", "Closed"];
            const sColors = ["#60A5FA", "#F59E0B", "#F87171", "#10B981"];

            if (this.chartStatus) this.chartStatus.destroy();

            this.chartStatus = new Chart(
            document.getElementById("chartStatus").getContext("2d"),
            {
                type: "bar",
                data: {
                labels: S.weeks,
                datasets: sKeys.map((k, i) => ({
                    label: k,
                    data: S.weeks.map(w => S.counts[w][k]),
                    backgroundColor: sColors[i],
                    borderRadius: 6
                }))
                },
                options: {
                responsive: true,
                plugins: {
                    legend: {
                    labels: {
                        color: "#1e293b",
                        font: { weight: "bold" }
                    }
                    }
                },
                scales: {
                    x: {
                    ticks: {
                        color: "#1e293b",
                        font: { weight: "bold" }
                    },
                    grid: { display: false }
                    },
                    y: {
                    ticks: {
                        color: "#1e293b",
                        font: { weight: "bold" }
                    },
                    grid: { color: "rgba(71, 85, 105, 0.15)" },
                    beginAtZero: true,
                    grace: '10%'
                    }
                }
                },
                plugins: [{
                afterDatasetsDraw: (chart) => {
                    const ctx = chart.ctx;
                    chart.data.datasets.forEach((dataset, i) => {
                    const meta = chart.getDatasetMeta(i);
                    meta.data.forEach((bar, index) => {
                        const data = dataset.data[index];
                        if (data > 0) {
                        ctx.fillStyle = '#1e293b';
                        ctx.font = 'bold 11px sans-serif';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';
                        ctx.fillText(data, bar.x, bar.y - 8);
                        }
                    });
                    });
                }
                }]
            }
            );

            /* ---------------------- 第二張圖：工作概況累積 ---------------------- */
            const W = this.computeCumulativeWorkload();
            const wKeys = ["On Going", "Closed", "OverDue"];
            const wColors = ["#3B82F6", "#10B981", "#EF4444"];

            if (this.chartWorkload) this.chartWorkload.destroy();

            this.chartWorkload = new Chart(
            document.getElementById("chartWorkload").getContext("2d"),
            {
                type: "bar",
                data: {
                labels: W.weeks,
                datasets: wKeys.map((k, i) => ({
                    label: k === "OverDue" ? "超過 DueDate" : k,
                    data: W.weeks.map(w => W.counts[w][k]),
                    backgroundColor: wColors[i],
                    borderRadius: 6
                }))
                },
                options: {
                responsive: true,
                plugins: {
                    legend: {
                    labels: {
                        color: "#1e293b",
                        font: { weight: "bold" }
                    }
                    }
                },
                scales: {
                    x: {
                    ticks: {
                        color: "#1e293b",
                        font: { weight: "bold" }
                    },
                    grid: { display: false }
                    },
                    y: {
                    ticks: {
                        color: "#1e293b",
                        font: { weight: "bold" }
                    },
                    grid: { color: "rgba(71, 85, 105, 0.15)" },
                    beginAtZero: true,
                    grace: '10%'
                    }
                }
                },
                plugins: [{
                afterDatasetsDraw: (chart) => {
                    const ctx = chart.ctx;
                    chart.data.datasets.forEach((dataset, i) => {
                    const meta = chart.getDatasetMeta(i);
                    meta.data.forEach((bar, index) => {
                        const data = dataset.data[index];
                        if (data > 0) {
                        ctx.fillStyle = '#1e293b';
                        ctx.font = 'bold 11px sans-serif';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';
                        ctx.fillText(data, bar.x, bar.y - 8);
                        }
                    });
                    });
                }
                }]
            }
            );

            /* ---------------------- 第三張圖：負責人案件件數 ---------------------- */
            const O = this.computeOwnerDaysFromNow();

            if (this.chartOwner) this.chartOwner.destroy();

            this.chartOwner = new Chart(
            document.getElementById("chartOwner").getContext("2d"),
            {
                type: "bar",
                data: {
                labels: O.owners,
                datasets: [
                    {
                    label: "On Going",
                    data: O.onGoing,
                    backgroundColor: "#F59E0B",
                    borderRadius: 6
                    },
                    {
                    label: "Pending",
                    data: O.pending,
                    backgroundColor: "#F87171",
                    borderRadius: 6
                    },
                    {
                    label: "超過 DueDate",
                    data: O.overDue,
                    backgroundColor: "#EF4444",
                    borderRadius: 6
                    }
                ]
                },
                options: {
                responsive: true,
                onClick: (event, activeElements) => {
                    if (activeElements.length > 0) {
                    const datasetIndex = activeElements[0].datasetIndex;
                    const index = activeElements[0].index;
                    const owner = O.owners[index];
                    const datasetLabel = this.chartOwner.data.datasets[datasetIndex].label;
                    
                    // 获取状态键
                    let statusKey = datasetLabel;
                    if (datasetLabel === "超過 DueDate") {
                        statusKey = "OverDue";
                    }
                    
                    // 获取该负责人该状态的所有项次
                    const items = O.details[owner][statusKey];
                    
                    if (items.length === 0) return;
                    
                    // 计算每个项次的距今天数并排序
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    
                    const itemsWithDays = items.map(itemId => {
                        const createDate = this.idToDate(itemId);
                        if (!createDate) return { id: itemId, days: 0 };
                        
                        const diffTime = today - createDate;
                        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                        
                        return { id: itemId, days: diffDays };
                    });
                    
                    // 按照项次（日期）排序，时间越早的在上方
                    itemsWithDays.sort((a, b) => a.id.localeCompare(b.id));
                    
                    // 构建显示内容
                    const content = itemsWithDays.map(item => 
                        `<div style="text-align: left; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                            項次: ${item.id}, 距今: ${item.days} 天
                        </div>`
                    ).join('');
                    
                    // 显示黑框
                    Swal.fire({
                        title: `<span style="color: #ffffff;">${owner} - ${datasetLabel}</span>`,
                        html: `<div style="color: #ffffff; max-height: 400px; overflow-y: auto;">${content}</div>`,
                        background: '#1e293b',
                        confirmButtonColor: '#6366f1',
                        confirmButtonText: '關閉',
                        width: '500px',
                        customClass: {
                        popup: 'custom-dark-popup'
                        }
                    });
                    }
                },
                plugins: {
                    legend: {
                    labels: {
                        color: "#1e293b",
                        font: { weight: "bold" }
                    }
                    },
                    tooltip: {
                    enabled: false
                    }
                },
                scales: {
                    x: {
                    ticks: {
                        color: "#1e293b",
                        font: { weight: "bold" }
                    },
                    grid: { display: false }
                    },
                    y: {
                    ticks: {
                        color: "#1e293b",
                        font: { weight: "bold" },
                        callback: function(value) {
                        return value + ' 件';
                        },
                        stepSize: 1
                    },
                    grid: { color: "rgba(71, 85, 105, 0.15)" },
                    beginAtZero: true,
                    grace: '10%',
                    title: {
                        display: true,
                        text: '案件數量',
                        color: "#1e293b",
                        font: { weight: "bold", size: 12 }
                    }
                    }
                }
                },
                plugins: [{
                afterDatasetsDraw: (chart) => {
                    const ctx = chart.ctx;
                    chart.data.datasets.forEach((dataset, i) => {
                    const meta = chart.getDatasetMeta(i);
                    meta.data.forEach((bar, index) => {
                        const data = dataset.data[index];
                        if (data > 0) {
                        ctx.fillStyle = '#1e293b';
                        ctx.font = 'bold 11px sans-serif';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';
                        // 调整数字位置，确保不会碰到顶部
                        const yPos = bar.y - 8;
                        ctx.fillText(data, bar.x, yPos);
                        }
                    });
                    });
                }
                }]
            }
            );

        } finally {
            this.showSpinner = false;
            this.isUpdating = false;
        }
    },

      async refreshCharts() {
        if (this.isUpdating) return;

        this.isUpdating = true;

        try {
          await this.renderCharts();
          Swal.fire({
            icon: "success",
            title: "✅ 圖表已更新",
            showConfirmButton: false,
            timer: 800
          });
        } finally {
          setTimeout(() => {
            this.isUpdating = false;
          }, 5000);
        }
      },

      async loadMeetingRecords() {
        try {
          const res = await axios.get(
            `http://127.0.0.1:5000/api/meeting_records?username=${encodeURIComponent(this.username)}`
          );
          if (res.data && res.data.data) {
            this.records = res.data.data;
            await this.renderCharts();
            lucide.createIcons();
          } else {
            this.records = [];
            await this.renderCharts();
          }
        } catch (err) {
          console.error("❌ API 讀取失敗：", err);
          this.records = [];
          await this.renderCharts();
        }
      },
      goMeetingPage() {
        localStorage.setItem('username', this.username);
        window.location.href = `defficultmeeting.html?username=${encodeURIComponent(this.username)}`;
      }
    },
    mounted() { 
      const urlParams = new URLSearchParams(window.location.search);
      this.username = urlParams.get("username");
      console.log(this.username)
      this.loadMeetingRecords(); 
    }
  });
  app.mount("#app");