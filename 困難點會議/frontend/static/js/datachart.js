const app = Vue.createApp({
    data() {
      return {
        username: "",
        records: [],
        chartStatus: null,
        chartWorkload: null,
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
                  return;  // ❗ 不往後累計
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

      /* 第二張圖：工作累積概況（Closed 到當週，OnGoing 長期累計） */
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
                  return;  // ❗ 不累計到後續週別
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
                    beginAtZero: true
                    }
                }
                }
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
                    beginAtZero: true
                    }
                }
                }
            }
            );

        } finally {
            this.showSpinner = false;
            this.isUpdating = false;
        }
    },

      async refreshCharts() {
        if (this.isUpdating) return;   // 🔒 若 5 秒內已點擊過 → 禁止

        this.isUpdating = true;        // ⛔ 鎖定按鈕（5 秒）

        try {
          await this.renderCharts();
          Swal.fire({
            icon: "success",
            title: "✅ 圖表已更新",
            showConfirmButton: false,
            timer: 800
          });
        } finally {
          // 🔓 5 秒後自動解鎖
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