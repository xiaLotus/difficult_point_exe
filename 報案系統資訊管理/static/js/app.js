Chart.register(ChartDataLabels);

const API_BASE = "http://127.0.0.1:5000";

const app = Vue.createApp({
    data() {
        return {
            week: '',
            activeTab: 0,
            tabs: [
                "本週報案",
                "每日過帳",
                "每週分類",
                "異常總表",
                "Top 3 站點",
                "詳細紀錄"
            ],
            detailedData: [],
            chart: null,
            dailyChart: null,
            weeklyChart: null,
            categories: [
                "2D消除", "EAP重開", "過帳異常",
                "關閉比對", "其他事項", "更新/搬遷", "總計"
            ],
            summaryItems: [],
            top3Stats: [],
            summaryList_error_total: [],
            top3Total: [],

            // 🔙 回溯功能
            availableWeeks: [],   // [{week, year, num}]
            lookbackYear: '',
            lookbackWeek: '',
            selectedWeek: null,   // null = 最新週（原本行為）
            loading: false,
            reqId: 0              // 請求序號，用來丟棄過期回應
        };
    },
    computed: {
        lookbackYears() {
            return [...new Set(this.availableWeeks.map(w => w.year))].sort((a, b) => b - a);
        },
        lookbackWeeks() {
            return this.availableWeeks
                .filter(w => w.year === Number(this.lookbackYear))
                .sort((a, b) => b.num - a.num);
        }
    },
    mounted() {
        this.loadAvailableWeeks();
        this.reloadAll();
        const savedTab = localStorage.getItem('activeTab');
        if (savedTab !== null) {
            this.activeTab = parseInt(savedTab);
        }
        window.addEventListener("keydown", this.handleArrowKeys);
    },
    beforeUnmount() {
        window.removeEventListener("keydown", this.handleArrowKeys);
    },
    methods: {

        // 組 API 網址，回溯模式時自動帶 ?week=
        api(path) {
            const url = `${API_BASE}${path}`;
            return this.selectedWeek ? `${url}?week=${encodeURIComponent(this.selectedWeek)}` : url;
        },

        async reloadAll() {
            const id = ++this.reqId;
            this.loading = true;
            try {
                await Promise.all([
                    this.getweek(id),
                    this.loadChartData(id),
                    this.loadDailyChart(id),
                    this.loadWeeklyChart(id),
                    this.loadFactorySummary(id),
                    this.loadTop3OperStats(id),
                    this.loadDetailedData(id)
                ]);
            } finally {
                if (id === this.reqId) this.loading = false;
            }
        },

        // 回應是否已過期（使用者已經又切換了週次）
        stale(id) {
            return id !== undefined && id !== this.reqId;
        },

        // 安全地銷毀舊圖表
        destroyChart(name) {
            const c = this[name];
            if (!c) return;
            try { c.stop(); c.destroy(); } catch (e) { /* ignore */ }
            this[name] = null;
        },

        async loadAvailableWeeks() {
            try {
                const res = await fetch(`${API_BASE}/api/weeks`);
                this.availableWeeks = await res.json();
            } catch (err) {
                console.error("載入週次清單失敗：", err);
            }
        },

        applyLookback() {
            if (!this.lookbackWeek || this.loading) return;
            this.selectedWeek = this.lookbackWeek;
            this.reloadAll();
        },

        resetLookback() {
            if (this.loading) return;
            this.selectedWeek = null;
            this.lookbackYear = '';
            this.lookbackWeek = '';
            this.reloadAll();
        },

        setActiveTab(tabIndex) {
            this.activeTab = tabIndex;
            localStorage.setItem('activeTab', tabIndex);
        },

        parseAndSum(value) {
            if (!value || value === "0") return 0;
            let matches = value.match(/\((\d+)\)/g);
            if (!matches) return 0;
            return matches.map(m => parseInt(m.replace(/[()]/g, ""))).reduce((a, b) => a + b, 0);
        },

        async getweek(id){
            try{
                const res = await fetch(this.api("/api/week_num"));
                const rawData = await res.json();
                if (this.stale(id)) return;
                this.week = rawData.latest_week;
            }
            catch (err) {
                console.error("載入資料失敗：", err);
            }
        },

        async loadChartData(id) {
            try {
                const res = await fetch(this.api("/api/factory-data"));
                const rawData = await res.json();
                if (this.stale(id)) return;

                const records = rawData.records || [];

                const asef1 = records.find(d => d.Factory === "ASEF1") || {};
                const asef3 = records.find(d => d.Factory === "ASEF3") || {};
                const asef5 = records.find(d => d.Factory === "ASEF5") || {};

                const parseTotal = (val) => {
                    if (!val || val === "0") return 0;
                    if (/^\d+$/.test(val)) return parseInt(val);
                    const matches = val.match(/\((\d+)\)/g);
                    if (!matches) return 0;
                    return matches
                        .map(m => parseInt(m.replace(/[()]/g, '')))
                        .reduce((a, b) => a + b, 0);
                };

                const asef1Data = this.categories.map(c => parseTotal(asef1[c]));
                const asef3Data = this.categories.map(c => parseTotal(asef3[c]));
                const asef5Data = this.categories.map(c => parseTotal(asef5[c]));

                const asef1Total = Number(asef1["總計"]) || 0;
                const asef3Total = Number(asef3["總計"]) || 0;
                const asef5Total = Number(asef5["總計"]) || 0;

                const totalData = this.categories.map((c, i) => {
                    if (c === "總計") return asef1Total + asef3Total + asef5Total;
                    return (asef1Data[i] ?? 0) + (asef3Data[i] ?? 0) + (asef5Data[i] ?? 0);
                });

                const ctx = document.getElementById('myChart').getContext('2d');
                this.destroyChart('chart');

                this.chart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: this.categories,
                        datasets: [
                            {
                                label: 'ASEF1',
                                type: 'bar',
                                data: asef1Data,
                                backgroundColor: 'rgba(59, 130, 246, 0.8)',
                                yAxisID: 'y',
                                datalabels: {
                                    anchor: 'end',
                                    align: 'start',
                                    offset: -10,
                                    color: '#000',
                                    font: { size: 20, weight: 'bold' },
                                    formatter: value => value
                                }
                            },
                            {
                                label: 'ASEF3',
                                type: 'bar',
                                data: asef3Data,
                                backgroundColor: 'rgba(251, 191, 36, 0.8)',
                                yAxisID: 'y',
                                datalabels: {
                                    anchor: 'end',
                                    align: 'start',
                                    offset: -10,
                                    color: '#000',
                                    font: { size: 20, weight: 'bold' },
                                    formatter: value => value
                                }
                            },
                            {
                                label: 'ASEF5',
                                type: 'bar',
                                data: asef5Data,
                                backgroundColor: 'rgba(139, 92, 246, 0.8)',
                                yAxisID: 'y',
                                datalabels: {
                                    anchor: 'end',
                                    align: 'start',
                                    offset: -10,
                                    color: '#000',
                                    font: { size: 20, weight: 'bold' },
                                    formatter: value => value
                                }
                            },
                            {
                                label: '總合',
                                type: 'line',
                                data: totalData,
                                borderColor: 'rgba(147, 197, 253, 1)',
                                backgroundColor: 'rgba(147, 197, 253, 0.2)',
                                pointBackgroundColor: 'rgba(147, 197, 253, 1)',
                                pointBorderColor: 'rgba(147, 197, 253, 1)',
                                borderWidth: 2,
                                tension: 0.4,
                                fill: false,
                                yAxisID: 'y',
                                datalabels: {
                                    anchor: 'end',
                                    align: 'end',
                                    offset: 10,
                                    color: '#000',
                                    font: { size: 30, weight: 'bold' },
                                    formatter: value => value
                                }
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: {
                                labels: {
                                    color: 'black',
                                    font: { size: 16, weight: 'bold' }
                                }
                            },
                            tooltip: {
                                mode: 'index',
                                intersect: false,
                                titleFont: { size: 16, weight: 'bold' },
                                bodyFont: { size: 14, weight: 'bold' }
                            },
                            datalabels: {
                                anchor: 'end',
                                align: 'end',
                                offset: 10,
                                color: '#000',
                                font: { size: 14, weight: 'bold' },
                                formatter: value => value
                            }
                        },
                        scales: {
                            x: {
                                ticks: { color: 'black', font: { size: 30, weight: 'bold' } }
                            },
                            y: {
                                beginAtZero: true,
                                ticks: { color: 'black', font: { size: 30, weight: 'bold' } }
                            }
                        }
                    },
                    plugins: [ChartDataLabels]
                });

            } catch (err) {
                console.error("載入資料失敗：", err);
            }
        },

        async loadDailyChart(id) {
            const res = await fetch(this.api("/api/posting-counts"));
            const data = await res.json();
            if (this.stale(id)) return;

            const dates = data.map(d => d.date);
            const counts = data.map(d => d.count);

            const ctx = document.getElementById('dailyChart').getContext('2d');
            this.destroyChart('dailyChart');

            this.dailyChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: dates,
                    datasets: [{
                        label: '異常數量',
                        data: counts,
                        backgroundColor: 'rgba(34, 197, 94, 0.8)'
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            labels: { color: 'black', font: { size: 30, weight: 'bold' } }
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            titleFont: { size: 30, weight: 'bold' },
                            bodyFont: { size: 30, weight: 'bold' }
                        },
                        datalabels: {
                            anchor: 'end',
                            align: 'end',
                            color: '#000',
                            font: { size: 30, weight: 'bold' },
                            formatter: value => value
                        }
                    },
                    scales: {
                        x: {
                            ticks: { color: 'black', font: { size: 30, weight: 'bold' } }
                        },
                        y: {
                            beginAtZero: true,
                            ticks: { color: 'black', font: { size: 30, weight: 'bold' } }
                        }
                    }
                },
                plugins: [ChartDataLabels]
            });
        },

        async loadWeeklyChart(id) {
            const res = await fetch(this.api("/api/weekly-summary"));
            const data = await res.json();
            if (this.stale(id)) return;

            const labels = data.map(d => d["週次"]);
            const postAbnormal = data.map(d => d["過帳異常"]);
            const d2Elimination = data.map(d => d["2D消除"]);
            const relocation = data.map(d => d["更新/搬遷"]);
            const total = data.map(d => d["總計"]);

            const ctx = document.getElementById('weeklyChart').getContext('2d');
            this.destroyChart('weeklyChart');

            this.weeklyChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [
                        {
                            label: '過帳異常',
                            data: postAbnormal,
                            backgroundColor: 'rgba(244, 63, 94, 0.8)',
                            yAxisID: 'y'
                        },
                        {
                            label: '2D消除',
                            data: d2Elimination,
                            backgroundColor: 'rgba(59, 130, 246, 0.8)',
                            yAxisID: 'y'
                        },
                        {
                            label: '更新/搬遷',
                            data: relocation,
                            backgroundColor: 'rgba(16, 185, 129, 0.8)',
                            yAxisID: 'y'
                        },
                        {
                            label: '總計',
                            data: total,
                            type: 'line',
                            borderColor: 'rgba(255, 165, 0, 1)',
                            borderWidth: 3,
                            pointBackgroundColor: 'rgba(255, 165, 0, 1)',
                            tension: 0.3,
                            yAxisID: 'y'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            labels: { color: 'black', font: { size: 15, weight: 'bold' } }
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            titleFont: { size: 20, weight: 'bold' },
                            bodyFont: { size: 20, weight: 'bold' }
                        },
                        datalabels: {
                            anchor: 'end',
                            align: 'end',
                            color: '#000',
                            font: { size: 16, weight: 'bold' },
                            formatter: value => value
                        }
                    },
                    scales: {
                        x: {
                            ticks: { color: 'black', font: { size: 20, weight: 'bold' } }
                        },
                        y: {
                            beginAtZero: true,
                            ticks: { color: 'black', font: { size: 20, weight: 'bold' } }
                        }
                    }
                },
                plugins: [ChartDataLabels]
            });
        },

        async loadFactorySummary(id) {
            const res = await fetch(this.api("/api/factory-data"));
            const rawData = await res.json();
            if (this.stale(id)) return;
            const data = rawData.records || [];
            this.summaryList_error_total = rawData.summary || {};

            const asef1 = data.find(d => d.Factory === "ASEF1");
            const asef3 = data.find(d => d.Factory === "ASEF3");
            const asef5 = data.find(d => d.Factory === "ASEF5");

            if (!asef1 || !asef3 || !asef5) {
                this.summaryItems = [];
                return;
            }

            this.summaryItems = [
                { label: "2D消除", asef1: asef1["2D消除"], asef3: asef3["2D消除"], asef5: asef5["2D消除"], 總計: this.summaryList_error_total["2D消除統計"] || 0,},
                { label: "EAP重開", asef1: asef1["EAP重開"], asef3: asef3["EAP重開"], asef5: asef5["EAP重開"], 總計: this.summaryList_error_total["EAP重開統計"] || 0,},
                { label: "過帳異常", asef1: asef1["過帳異常"], asef3: asef3["過帳異常"], asef5: asef5["過帳異常"], 總計: this.summaryList_error_total["過帳異常統計"] || 0,},
                { label: "關閉比對", asef1: asef1["關閉比對"], asef3: asef3["關閉比對"], asef5: asef5["關閉比對"], 總計: this.summaryList_error_total["關閉比對統計"] || 0,},
                { label: "其他事項", asef1: asef1["其他事項"], asef3: asef3["其他事項"], asef5: asef5["其他事項"], 總計: this.summaryList_error_total["其他事項統計"] || 0,},
                { label: "更新/搬遷", asef1: asef1["更新/搬遷"], asef3: asef3["更新/搬遷"], asef5: asef5["更新/搬遷"], 總計: this.summaryList_error_total["更新/搬遷統計"] || 0,},
                { label: "總計", asef1: asef1["總計"], asef3: asef3["總計"], asef5: asef5["總計"], 總計: this.summaryList_error_total["總計統計"] || 0,},
            ];
        },

        async loadTop3OperStats(id) {
            const res = await fetch(this.api("/api/oper-stats"));
            const raw = await res.json();
            if (this.stale(id)) return;

            const records = raw.records || raw;
            const summary = raw.summary || [];

            const grouped = {};
            records.forEach(item => {
                if (!grouped[item.分類]) grouped[item.分類] = [];
                grouped[item.分類].push(item);
            });

            const categoryOrder = [
                "2D消除",
                "EAP重開",
                "過帳異常",
                "關閉比對",
                "其他事項",
                "更新/搬遷"
            ];

            const sortedSummary = categoryOrder.map(cat => {
                const matched = summary.find(s => s.分類 === cat);
                return matched || { 分類: cat, 總次數: 0 };
            });

            this.top3Stats = sortedSummary.map(s => {
                const items = grouped[s.分類] || [];

                const top = items
                    .sort((a, b) => sumCount(b.次數) - sumCount(a.次數))
                    .slice(0, 3)
                    .map(r => `${r.站點}(${r.次數})`);

                while (top.length < 3) top.push("");

                return {
                    category: s.分類,
                    operList: top,
                    totalCount: s.總次數
                };
            });

            function sumCount(str) {
                const nums = (String(str).match(/\((\d+)\)/g) || []).map(s => parseInt(s.replace(/[()]/g, '')));
                return nums.reduce((a, b) => a + b, 0);
            }
        },

        async loadDetailedData(id) {
            const res = await fetch(this.api("/api/detailed-logs"));
            const data = await res.json();
            if (this.stale(id)) return;
            this.detailedData = data;
        },

        handleArrowKeys(e) {
            // 下拉選單有焦點時不攔截左右鍵
            if (e.target && e.target.tagName === "SELECT") return;
            if (e.key === "ArrowRight") {
                this.activeTab = (this.activeTab + 1) % this.tabs.length;
                this.setActiveTab(this.activeTab);
            } else if (e.key === "ArrowLeft") {
                this.activeTab = (this.activeTab - 1 + this.tabs.length) % this.tabs.length;
                this.setActiveTab(this.activeTab);
            }
        },

    },
});

app.mount('#app');