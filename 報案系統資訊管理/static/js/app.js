Chart.register(ChartDataLabels);

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
            top3Total: []
        };
    },
    mounted() {
        this.getweek();
        this.loadChartData();
        this.loadDailyChart(); 
        this.loadWeeklyChart(); // 👈 新增
        this.loadFactorySummary(); // 👈 呼叫載入
        this.loadTop3OperStats(); // ✅ 加這行
        this.loadDetailedData(); // ✅ 加這行
        const savedTab = localStorage.getItem('activeTab');
        if (savedTab !== null) {
            this.activeTab = parseInt(savedTab);
        }
        window.addEventListener("keydown", this.handleArrowKeys);
    },
    beforeUnmount() {
        // 清除事件
        window.removeEventListener("keydown", this.handleArrowKeys);
    },
    methods: {

        setActiveTab(tabIndex) {
            this.activeTab = tabIndex;
            localStorage.setItem('activeTab', tabIndex);
        },

        parseAndSum(value) {
            if (!value || value === "0") return 0;
            let matches = value.match(/\((\d+)\)/g); // 抓所有 () 內的數字
            if (!matches) return 0;
            return matches.map(m => parseInt(m.replace(/[()]/g, ""))).reduce((a, b) => a + b, 0);
        },

        async getweek(){
            try{
                const res = await fetch("http://127.0.0.1:5000/api/week_num");
                const rawData = await res.json();
                
                this.week = rawData.latest_week;
            } 
            catch (err) {
                console.error("載入資料失敗：", err);
            }
        },

        async loadChartData() {
            try {
                const res = await fetch("http://127.0.0.1:5000/api/factory-data");
                const rawData = await res.json();

                // ✅ 取出 records
                const records = rawData.records || [];

                const asef1 = records.find(d => d.Factory === "ASEF1") || {};
                const asef3 = records.find(d => d.Factory === "ASEF3") || {};
                const asef5 = records.find(d => d.Factory === "ASEF5") || {}; 

                // ✅ 支援「(12)」與「27」這種純數字
                const parseTotal = (val) => {
                    if (!val || val === "0") return 0;
                    if (/^\d+$/.test(val)) return parseInt(val);  // 純數字
                    const matches = val.match(/\((\d+)\)/g);
                    if (!matches) return 0;
                    return matches
                        .map(m => parseInt(m.replace(/[()]/g, '')))
                        .reduce((a, b) => a + b, 0);
                };

                // ✅ 解析各分類數據
                const asef1Data = this.categories.map(c => parseTotal(asef1[c]));
                const asef3Data = this.categories.map(c => parseTotal(asef3[c]));
                const asef5Data = this.categories.map(c => parseTotal(asef5[c]));

                // ✅ 總計 (使用純數字直接加總)
                const asef1Total = Number(asef1["總計"]) || 0;
                const asef3Total = Number(asef3["總計"]) || 0;
                const asef5Total = Number(asef5["總計"]) || 0;

                // ✅ 統計總合（最後一欄為 "總計"）
                const totalData = this.categories.map((c, i) => {
                    if (c === "總計") return asef1Total + asef3Total + asef5Total;
                    return (asef1Data[i] ?? 0) + (asef3Data[i] ?? 0) + (asef5Data[i] ?? 0);
                });

                // ✅ 畫圖
                const ctx = document.getElementById('myChart').getContext('2d');
                if (this.chart) this.chart.destroy();

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


        async loadDailyChart() {
            const res = await fetch("http://127.0.0.1:5000/api/posting-counts");
            const data = await res.json();

            const dates = data.map(d => d.date);
            const counts = data.map(d => d.count);

            const ctx = document.getElementById('dailyChart').getContext('2d');
            if (this.dailyChart) this.dailyChart.destroy();

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

        async loadWeeklyChart() {
            const res = await fetch("http://127.0.0.1:5000/api/weekly-summary");
            const data = await res.json();

            const labels = data.map(d => d["週次"]);
            const postAbnormal = data.map(d => d["過帳異常"]);
            const d2Elimination = data.map(d => d["2D消除"]);
            const relocation = data.map(d => d["更新/搬遷"]);
            const total = data.map(d => d["總計"]);

            const ctx = document.getElementById('weeklyChart').getContext('2d');
            if (this.weeklyChart) this.weeklyChart.destroy();

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
                            type: 'line',                  // 顯示為折線圖
                            borderColor: 'rgba(255, 165, 0, 1)', // 橘色線
                            borderWidth: 3,
                            pointBackgroundColor: 'rgba(255, 165, 0, 1)',
                            tension: 0.3,                  // 曲線平滑
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

        async loadFactorySummary() {
            const res = await fetch("http://127.0.0.1:5000/api/factory-data");
            const rawData = await res.json();
            const data = rawData.records || [];
            this.summaryList_error_total = rawData.summary || {};


            const asef1 = data.find(d => d.Factory === "ASEF1");
            const asef3 = data.find(d => d.Factory === "ASEF3");
            const asef5 = data.find(d => d.Factory === "ASEF5");

            console.log("工廠資料：", data); // ⬅️ 印出全部資料
            console.log("ASEF5:", asef5); // ⬅️ 驗證 ASEF5 是否存在

            if (!asef1 || !asef3 || !asef5) return;
            
            // 解析 () 內數字並加總
            const parseTotal = (val) => {
                if (!val || val === "0") return 0;
                const matches = val.match(/\((\d+)\)/g);
                if (!matches) return 0;
                return matches.map(m => parseInt(m.replace(/[()]/g, ''))).reduce((a, b) => a + b, 0);
            };

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

        async loadTop3OperStats() {
            const res = await fetch("http://127.0.0.1:5000/api/oper-stats");
            const raw = await res.json();

            const records = raw.records || raw;
            const summary = raw.summary || [];

            const grouped = {};
            records.forEach(item => {
                if (!grouped[item.分類]) grouped[item.分類] = [];
                grouped[item.分類].push(item);
            });

            // 🔽 指定排序順序
            const categoryOrder = [
                "2D消除",
                "EAP重開",
                "過帳異常",
                "關閉比對",
                "其他事項",
                "更新/搬遷"
            ];

            // 🔽 按照順序排序 summary
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
                const nums = (str.match(/\((\d+)\)/g) || []).map(s => parseInt(s.replace(/[()]/g, '')));
                return nums.reduce((a, b) => a + b, 0);
            }
        },

        async loadDetailedData() {
            const res = await fetch("http://127.0.0.1:5000/api/detailed-logs");
            const data = await res.json();
            this.detailedData = data;
        },

        handleArrowKeys(e) {
            if (e.key === "ArrowRight") {
                this.activeTab = (this.activeTab + 1) % this.tabs.length;
                const newIndex = this.activeTab
                this.setActiveTab(newIndex)
            } else if (e.key === "ArrowLeft") {
                this.activeTab = (this.activeTab - 1 + this.tabs.length) % this.tabs.length;
                const newIndex = this.activeTab
                this.setActiveTab(newIndex)
            }
        },



    },
});

app.mount('#app');