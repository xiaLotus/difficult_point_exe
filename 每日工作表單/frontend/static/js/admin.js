const API = 'http://127.0.0.1:5000'

// ── 認證（帳號存 localStorage，權限由後台 admin.json 判斷）──
const STORAGE_KEY = 'wms_account'
const getAccount  = () => localStorage.getItem(STORAGE_KEY)
const ftLogout    = () => { localStorage.removeItem(STORAGE_KEY); location.href = '../login.html' }
const requireAuth = () => { const a = getAccount(); if (!a) { location.href = '../login.html'; return null } return a }
// 向後台查詢權限：回傳 { account, is_admin, admin_orgs }
async function fetchRole(account) {
    try {
        const res = await axios.get(`${API}/api/whoami/${encodeURIComponent(account)}`)
        return res.data
    } catch {
        return { account: account, is_admin: false, admin_orgs: [] }
    }
}

const app = Vue.createApp({

    // ─────────────────────────────────────────────
    data() {
        return {
            rows:          [],
            orgOptions:    ['FT01營運(硬)', 'FT01營運(資)', 'FT01營運(保)', 'FT01值班'],
            keyword:       '',
            loading:       false,
            lightMode:     false,

            // ── 各欄篩選選中值（空陣列 = 不篩選）──
            checkedDates:       [],
            checkedPersons:     [],
            checkedBuildings:   [],
            checkedFloors:      [],
            checkedSites:       [],
            checkedOrgs:        [],
            checkedCases:       [],
            checkedDescs:       [],
            checkedMgrs:        [],
            checkedDues:        [],
            checkedAgos:        [],
            checkedOwners:      [],
            checkedSingleDues:  [],
            checkedStatuses:    [],

            // ── 篩選面板狀態 ──
            activeFilter: null,
            panelStyle:   {},
            filterSearch: '',

            // ── Modal ──
            showView:  false,
            showDel:   false,
            viewData:  null,
            delTarget: null,
            newProgress:     '',

            // ── Toast ──
            toasts:  [],
            toastId: 0,

            // 甘特圖
            ganttStart:    null,
            ganttProposer: null,
            ganttNavigated: false,
            ganttViewMode: 'day',      // 檢視模式：day / week / month
            ganttShowYear: false,      // 顯示 專案(年) 任務（預設隱藏）
            ganttShowPA:   false,      // 顯示 專案(PA) 任務（預設隱藏）
            ganttTip: { show: false, x: 0, y: 0, task: null },   // 自製 tooltip   // null = 全部，string = 指定提案人
            account: '',
            userName: '',
            isAdmin: false,
            adminOrgs: [],
            showNavMenu: false,

            // ── 權限管理 Modal ──
            showPermModal:  false,
            permConfig:     {},     // { org: [acc,...] }
            permUsers:      {},     // { acc: name }
            permViewMode:   'byOrg',
            permAddInput:   {},     // { org: text }
            permLoading:    false,
        }
    },

    // ─────────────────────────────────────────────
    computed: {

        // 只顯示此管理員管轄的組織
        baseRows() {
            return this.rows.filter(i => this.adminOrgs.includes(i['組織類別']))
        },

        // 管理員可見的組織（僅自己管轄的）
        managedOrgs() {
            return this.orgOptions.filter(o => this.adminOrgs.includes(o))
        },

        // 權限彙整：{ acc: [org,...] } 依權限數排序
        permPersonMap() {
            const map = {}
            for (const [org, accts] of Object.entries(this.permConfig)) {
                for (const acc of accts) (map[acc] = map[acc] || []).push(org)
            }
            return Object.fromEntries(Object.entries(map).sort((a,b) => b[1].length - a[1].length))
        },

        // 逾期數量（依目前分頁）
        overdueCount() {
            return this.baseRows.filter(i => { const v = i['距今']; return v && v !== '無' && v !== '今日' && !v.startsWith('剩') }).length
        },

        hasAnyFilter() {
            return this.checkedDates.length > 0      || this.checkedPersons.length > 0   ||
                   this.checkedBuildings.length > 0  || this.checkedFloors.length > 0    ||
                   this.checkedSites.length > 0      || this.checkedOrgs.length > 0      ||
                   this.checkedCases.length > 0      || this.checkedDescs.length > 0     ||
                   this.checkedMgrs.length > 0       || this.checkedDues.length > 0      ||
                   this.checkedAgos.length > 0       || this.checkedOwners.length > 0    ||
                   this.checkedSingleDues.length > 0 || this.checkedStatuses.length > 0
        },

        // ── 主篩選結果 ──────────────────────────────
        filteredData() {
            return this.baseRows.filter(i => {
                const kw = this.keyword.trim().toLowerCase()
                if (kw) {
                    const fields = ['日期','提案人','棟別','樓層','站點','組織類別',
                                    '案件分類','項目描述','管理OWNER','項目Due Date','距今',
                                    '項目OWNER','單項目Due Date','當前最新進度','狀態']
                    if (!fields.some(f => (i[f] || '').toLowerCase().includes(kw))) return false
                }

                const matchDate      = this.checkedDates.length      === 0 || this.checkedDates.includes(i['日期'] || '')
                const matchPerson    = this.checkedPersons.length    === 0 || this.checkedPersons.includes(i['提案人'] || '')
                const matchBuilding  = this.checkedBuildings.length  === 0 || this.checkedBuildings.includes(i['棟別'] || '')
                const matchFloor     = this.checkedFloors.length     === 0 || this.checkedFloors.includes(i['樓層'] || '')
                const matchSite      = this.checkedSites.length      === 0 || this.checkedSites.includes(i['站點'] || '')
                const matchOrg       = this.checkedOrgs.length       === 0 || this.checkedOrgs.includes(i['組織類別'] || '')
                const matchCase      = this.checkedCases.length      === 0 || this.checkedCases.includes(i['案件分類'] || '')
                const matchDesc      = this.checkedDescs.length      === 0 || this.checkedDescs.includes(i['項目描述'] || '')
                const matchMgr       = this.checkedMgrs.length       === 0 || this.checkedMgrs.includes(i['管理OWNER'] || '')
                const matchDue       = this.checkedDues.length       === 0 || this.checkedDues.includes(i['項目Due Date'] || '')
                const matchAgo       = this.checkedAgos.length       === 0 || this.checkedAgos.includes(i['距今'] || '')
                const matchOwner     = this.checkedOwners.length     === 0 || this.checkedOwners.includes(i['項目OWNER'] || '')
                const matchSingleDue = this.checkedSingleDues.length === 0 || this.checkedSingleDues.includes(i['單項目Due Date'] || '')
                const matchStatus    = this.checkedStatuses.length   === 0 || this.checkedStatuses.includes(i['狀態'] || '')

                return matchDate && matchPerson && matchBuilding && matchFloor && matchSite &&
                       matchOrg && matchCase && matchDesc && matchMgr && matchDue && matchAgo &&
                       matchOwner && matchSingleDue && matchStatus
            })
        },

        // ── 各欄唯一選項（以 baseRows 為母集合，排除自身）──

        uniqueDates() {
            return Array.from(new Set(
                this.baseRows.filter(i => {
                    const matchPerson    = this.checkedPersons.length    === 0 || this.checkedPersons.includes(i['提案人'] || '')
                    const matchBuilding  = this.checkedBuildings.length  === 0 || this.checkedBuildings.includes(i['棟別'] || '')
                    const matchFloor     = this.checkedFloors.length     === 0 || this.checkedFloors.includes(i['樓層'] || '')
                    const matchSite      = this.checkedSites.length      === 0 || this.checkedSites.includes(i['站點'] || '')
                    const matchOrg       = this.checkedOrgs.length       === 0 || this.checkedOrgs.includes(i['組織類別'] || '')
                    const matchCase      = this.checkedCases.length      === 0 || this.checkedCases.includes(i['案件分類'] || '')
                    const matchDesc      = this.checkedDescs.length      === 0 || this.checkedDescs.includes(i['項目描述'] || '')
                    const matchMgr       = this.checkedMgrs.length       === 0 || this.checkedMgrs.includes(i['管理OWNER'] || '')
                    const matchDue       = this.checkedDues.length       === 0 || this.checkedDues.includes(i['項目Due Date'] || '')
                    const matchAgo       = this.checkedAgos.length       === 0 || this.checkedAgos.includes(i['距今'] || '')
                    const matchOwner     = this.checkedOwners.length     === 0 || this.checkedOwners.includes(i['項目OWNER'] || '')
                    const matchSingleDue = this.checkedSingleDues.length === 0 || this.checkedSingleDues.includes(i['單項目Due Date'] || '')
                    const matchStatus    = this.checkedStatuses.length   === 0 || this.checkedStatuses.includes(i['狀態'] || '')
                    return matchPerson && matchBuilding && matchFloor && matchSite && matchOrg &&
                           matchCase && matchDesc && matchMgr && matchDue && matchAgo && matchOwner && matchSingleDue
                }).map(i => i['日期'] || '')
            )).sort((a, b) => a.localeCompare(b, 'zh-TW'))
        },

        uniquePersons() {
            return Array.from(new Set(
                this.baseRows.filter(i => {
                    const matchDate      = this.checkedDates.length      === 0 || this.checkedDates.includes(i['日期'] || '')
                    const matchBuilding  = this.checkedBuildings.length  === 0 || this.checkedBuildings.includes(i['棟別'] || '')
                    const matchFloor     = this.checkedFloors.length     === 0 || this.checkedFloors.includes(i['樓層'] || '')
                    const matchSite      = this.checkedSites.length      === 0 || this.checkedSites.includes(i['站點'] || '')
                    const matchOrg       = this.checkedOrgs.length       === 0 || this.checkedOrgs.includes(i['組織類別'] || '')
                    const matchCase      = this.checkedCases.length      === 0 || this.checkedCases.includes(i['案件分類'] || '')
                    const matchDesc      = this.checkedDescs.length      === 0 || this.checkedDescs.includes(i['項目描述'] || '')
                    const matchMgr       = this.checkedMgrs.length       === 0 || this.checkedMgrs.includes(i['管理OWNER'] || '')
                    const matchDue       = this.checkedDues.length       === 0 || this.checkedDues.includes(i['項目Due Date'] || '')
                    const matchAgo       = this.checkedAgos.length       === 0 || this.checkedAgos.includes(i['距今'] || '')
                    const matchOwner     = this.checkedOwners.length     === 0 || this.checkedOwners.includes(i['項目OWNER'] || '')
                    const matchSingleDue = this.checkedSingleDues.length === 0 || this.checkedSingleDues.includes(i['單項目Due Date'] || '')
                    const matchStatus    = this.checkedStatuses.length   === 0 || this.checkedStatuses.includes(i['狀態'] || '')
                    return matchDate && matchBuilding && matchFloor && matchSite && matchOrg &&
                           matchCase && matchDesc && matchMgr && matchDue && matchAgo && matchOwner && matchSingleDue
                }).map(i => i['提案人'] || '')
            )).sort((a, b) => a.localeCompare(b, 'zh-TW'))
        },

        uniqueBuildings() {
            return Array.from(new Set(
                this.baseRows.filter(i => {
                    const matchDate      = this.checkedDates.length      === 0 || this.checkedDates.includes(i['日期'] || '')
                    const matchPerson    = this.checkedPersons.length    === 0 || this.checkedPersons.includes(i['提案人'] || '')
                    const matchFloor     = this.checkedFloors.length     === 0 || this.checkedFloors.includes(i['樓層'] || '')
                    const matchSite      = this.checkedSites.length      === 0 || this.checkedSites.includes(i['站點'] || '')
                    const matchOrg       = this.checkedOrgs.length       === 0 || this.checkedOrgs.includes(i['組織類別'] || '')
                    const matchCase      = this.checkedCases.length      === 0 || this.checkedCases.includes(i['案件分類'] || '')
                    const matchDesc      = this.checkedDescs.length      === 0 || this.checkedDescs.includes(i['項目描述'] || '')
                    const matchMgr       = this.checkedMgrs.length       === 0 || this.checkedMgrs.includes(i['管理OWNER'] || '')
                    const matchDue       = this.checkedDues.length       === 0 || this.checkedDues.includes(i['項目Due Date'] || '')
                    const matchAgo       = this.checkedAgos.length       === 0 || this.checkedAgos.includes(i['距今'] || '')
                    const matchOwner     = this.checkedOwners.length     === 0 || this.checkedOwners.includes(i['項目OWNER'] || '')
                    const matchSingleDue = this.checkedSingleDues.length === 0 || this.checkedSingleDues.includes(i['單項目Due Date'] || '')
                    const matchStatus    = this.checkedStatuses.length   === 0 || this.checkedStatuses.includes(i['狀態'] || '')
                    return matchDate && matchPerson && matchFloor && matchSite && matchOrg &&
                           matchCase && matchDesc && matchMgr && matchDue && matchAgo && matchOwner && matchSingleDue
                }).map(i => i['棟別'] || '')
            )).sort((a, b) => a.localeCompare(b, 'zh-TW'))
        },

        uniqueFloors() {
            return Array.from(new Set(
                this.baseRows.filter(i => {
                    const matchDate      = this.checkedDates.length      === 0 || this.checkedDates.includes(i['日期'] || '')
                    const matchPerson    = this.checkedPersons.length    === 0 || this.checkedPersons.includes(i['提案人'] || '')
                    const matchBuilding  = this.checkedBuildings.length  === 0 || this.checkedBuildings.includes(i['棟別'] || '')
                    const matchSite      = this.checkedSites.length      === 0 || this.checkedSites.includes(i['站點'] || '')
                    const matchOrg       = this.checkedOrgs.length       === 0 || this.checkedOrgs.includes(i['組織類別'] || '')
                    const matchCase      = this.checkedCases.length      === 0 || this.checkedCases.includes(i['案件分類'] || '')
                    const matchDesc      = this.checkedDescs.length      === 0 || this.checkedDescs.includes(i['項目描述'] || '')
                    const matchMgr       = this.checkedMgrs.length       === 0 || this.checkedMgrs.includes(i['管理OWNER'] || '')
                    const matchDue       = this.checkedDues.length       === 0 || this.checkedDues.includes(i['項目Due Date'] || '')
                    const matchAgo       = this.checkedAgos.length       === 0 || this.checkedAgos.includes(i['距今'] || '')
                    const matchOwner     = this.checkedOwners.length     === 0 || this.checkedOwners.includes(i['項目OWNER'] || '')
                    const matchSingleDue = this.checkedSingleDues.length === 0 || this.checkedSingleDues.includes(i['單項目Due Date'] || '')
                    const matchStatus    = this.checkedStatuses.length   === 0 || this.checkedStatuses.includes(i['狀態'] || '')
                    return matchDate && matchPerson && matchBuilding && matchSite && matchOrg &&
                           matchCase && matchDesc && matchMgr && matchDue && matchAgo && matchOwner && matchSingleDue
                }).map(i => i['樓層'] || '')
            )).sort((a, b) => a.localeCompare(b, 'zh-TW'))
        },

        uniqueSites() {
            return Array.from(new Set(
                this.baseRows.filter(i => {
                    const matchDate      = this.checkedDates.length      === 0 || this.checkedDates.includes(i['日期'] || '')
                    const matchPerson    = this.checkedPersons.length    === 0 || this.checkedPersons.includes(i['提案人'] || '')
                    const matchBuilding  = this.checkedBuildings.length  === 0 || this.checkedBuildings.includes(i['棟別'] || '')
                    const matchFloor     = this.checkedFloors.length     === 0 || this.checkedFloors.includes(i['樓層'] || '')
                    const matchOrg       = this.checkedOrgs.length       === 0 || this.checkedOrgs.includes(i['組織類別'] || '')
                    const matchCase      = this.checkedCases.length      === 0 || this.checkedCases.includes(i['案件分類'] || '')
                    const matchDesc      = this.checkedDescs.length      === 0 || this.checkedDescs.includes(i['項目描述'] || '')
                    const matchMgr       = this.checkedMgrs.length       === 0 || this.checkedMgrs.includes(i['管理OWNER'] || '')
                    const matchDue       = this.checkedDues.length       === 0 || this.checkedDues.includes(i['項目Due Date'] || '')
                    const matchAgo       = this.checkedAgos.length       === 0 || this.checkedAgos.includes(i['距今'] || '')
                    const matchOwner     = this.checkedOwners.length     === 0 || this.checkedOwners.includes(i['項目OWNER'] || '')
                    const matchSingleDue = this.checkedSingleDues.length === 0 || this.checkedSingleDues.includes(i['單項目Due Date'] || '')
                    const matchStatus    = this.checkedStatuses.length   === 0 || this.checkedStatuses.includes(i['狀態'] || '')
                    return matchDate && matchPerson && matchBuilding && matchFloor && matchOrg &&
                           matchCase && matchDesc && matchMgr && matchDue && matchAgo && matchOwner && matchSingleDue
                }).map(i => i['站點'] || '')
            )).sort((a, b) => a.localeCompare(b, 'zh-TW'))
        },

        uniqueOrgs() {
            return Array.from(new Set(
                this.baseRows.filter(i => {
                    const matchDate      = this.checkedDates.length      === 0 || this.checkedDates.includes(i['日期'] || '')
                    const matchPerson    = this.checkedPersons.length    === 0 || this.checkedPersons.includes(i['提案人'] || '')
                    const matchBuilding  = this.checkedBuildings.length  === 0 || this.checkedBuildings.includes(i['棟別'] || '')
                    const matchFloor     = this.checkedFloors.length     === 0 || this.checkedFloors.includes(i['樓層'] || '')
                    const matchSite      = this.checkedSites.length      === 0 || this.checkedSites.includes(i['站點'] || '')
                    const matchCase      = this.checkedCases.length      === 0 || this.checkedCases.includes(i['案件分類'] || '')
                    const matchDesc      = this.checkedDescs.length      === 0 || this.checkedDescs.includes(i['項目描述'] || '')
                    const matchMgr       = this.checkedMgrs.length       === 0 || this.checkedMgrs.includes(i['管理OWNER'] || '')
                    const matchDue       = this.checkedDues.length       === 0 || this.checkedDues.includes(i['項目Due Date'] || '')
                    const matchAgo       = this.checkedAgos.length       === 0 || this.checkedAgos.includes(i['距今'] || '')
                    const matchOwner     = this.checkedOwners.length     === 0 || this.checkedOwners.includes(i['項目OWNER'] || '')
                    const matchSingleDue = this.checkedSingleDues.length === 0 || this.checkedSingleDues.includes(i['單項目Due Date'] || '')
                    const matchStatus    = this.checkedStatuses.length   === 0 || this.checkedStatuses.includes(i['狀態'] || '')
                    return matchDate && matchPerson && matchBuilding && matchFloor && matchSite &&
                           matchCase && matchDesc && matchMgr && matchDue && matchAgo && matchOwner && matchSingleDue
                }).map(i => i['組織類別'] || '')
            )).sort((a, b) => a.localeCompare(b, 'zh-TW'))
        },

        uniqueCases() {
            return Array.from(new Set(
                this.baseRows.filter(i => {
                    const matchDate      = this.checkedDates.length      === 0 || this.checkedDates.includes(i['日期'] || '')
                    const matchPerson    = this.checkedPersons.length    === 0 || this.checkedPersons.includes(i['提案人'] || '')
                    const matchBuilding  = this.checkedBuildings.length  === 0 || this.checkedBuildings.includes(i['棟別'] || '')
                    const matchFloor     = this.checkedFloors.length     === 0 || this.checkedFloors.includes(i['樓層'] || '')
                    const matchSite      = this.checkedSites.length      === 0 || this.checkedSites.includes(i['站點'] || '')
                    const matchOrg       = this.checkedOrgs.length       === 0 || this.checkedOrgs.includes(i['組織類別'] || '')
                    const matchDesc      = this.checkedDescs.length      === 0 || this.checkedDescs.includes(i['項目描述'] || '')
                    const matchMgr       = this.checkedMgrs.length       === 0 || this.checkedMgrs.includes(i['管理OWNER'] || '')
                    const matchDue       = this.checkedDues.length       === 0 || this.checkedDues.includes(i['項目Due Date'] || '')
                    const matchAgo       = this.checkedAgos.length       === 0 || this.checkedAgos.includes(i['距今'] || '')
                    const matchOwner     = this.checkedOwners.length     === 0 || this.checkedOwners.includes(i['項目OWNER'] || '')
                    const matchSingleDue = this.checkedSingleDues.length === 0 || this.checkedSingleDues.includes(i['單項目Due Date'] || '')
                    const matchStatus    = this.checkedStatuses.length   === 0 || this.checkedStatuses.includes(i['狀態'] || '')
                    return matchDate && matchPerson && matchBuilding && matchFloor && matchSite &&
                           matchOrg && matchDesc && matchMgr && matchDue && matchAgo && matchOwner && matchSingleDue
                }).map(i => i['案件分類'] || '')
            )).sort((a, b) => a.localeCompare(b, 'zh-TW'))
        },

        uniqueDescs() {
            return Array.from(new Set(
                this.baseRows.filter(i => {
                    const matchDate      = this.checkedDates.length      === 0 || this.checkedDates.includes(i['日期'] || '')
                    const matchPerson    = this.checkedPersons.length    === 0 || this.checkedPersons.includes(i['提案人'] || '')
                    const matchBuilding  = this.checkedBuildings.length  === 0 || this.checkedBuildings.includes(i['棟別'] || '')
                    const matchFloor     = this.checkedFloors.length     === 0 || this.checkedFloors.includes(i['樓層'] || '')
                    const matchSite      = this.checkedSites.length      === 0 || this.checkedSites.includes(i['站點'] || '')
                    const matchOrg       = this.checkedOrgs.length       === 0 || this.checkedOrgs.includes(i['組織類別'] || '')
                    const matchCase      = this.checkedCases.length      === 0 || this.checkedCases.includes(i['案件分類'] || '')
                    const matchMgr       = this.checkedMgrs.length       === 0 || this.checkedMgrs.includes(i['管理OWNER'] || '')
                    const matchDue       = this.checkedDues.length       === 0 || this.checkedDues.includes(i['項目Due Date'] || '')
                    const matchAgo       = this.checkedAgos.length       === 0 || this.checkedAgos.includes(i['距今'] || '')
                    const matchOwner     = this.checkedOwners.length     === 0 || this.checkedOwners.includes(i['項目OWNER'] || '')
                    const matchSingleDue = this.checkedSingleDues.length === 0 || this.checkedSingleDues.includes(i['單項目Due Date'] || '')
                    const matchStatus    = this.checkedStatuses.length   === 0 || this.checkedStatuses.includes(i['狀態'] || '')
                    return matchDate && matchPerson && matchBuilding && matchFloor && matchSite &&
                           matchOrg && matchCase && matchMgr && matchDue && matchAgo && matchOwner && matchSingleDue
                }).map(i => i['項目描述'] || '')
            )).sort((a, b) => a.localeCompare(b, 'zh-TW'))
        },

        uniqueMgrs() {
            return Array.from(new Set(
                this.baseRows.filter(i => {
                    const matchDate      = this.checkedDates.length      === 0 || this.checkedDates.includes(i['日期'] || '')
                    const matchPerson    = this.checkedPersons.length    === 0 || this.checkedPersons.includes(i['提案人'] || '')
                    const matchBuilding  = this.checkedBuildings.length  === 0 || this.checkedBuildings.includes(i['棟別'] || '')
                    const matchFloor     = this.checkedFloors.length     === 0 || this.checkedFloors.includes(i['樓層'] || '')
                    const matchSite      = this.checkedSites.length      === 0 || this.checkedSites.includes(i['站點'] || '')
                    const matchOrg       = this.checkedOrgs.length       === 0 || this.checkedOrgs.includes(i['組織類別'] || '')
                    const matchCase      = this.checkedCases.length      === 0 || this.checkedCases.includes(i['案件分類'] || '')
                    const matchDesc      = this.checkedDescs.length      === 0 || this.checkedDescs.includes(i['項目描述'] || '')
                    const matchDue       = this.checkedDues.length       === 0 || this.checkedDues.includes(i['項目Due Date'] || '')
                    const matchAgo       = this.checkedAgos.length       === 0 || this.checkedAgos.includes(i['距今'] || '')
                    const matchOwner     = this.checkedOwners.length     === 0 || this.checkedOwners.includes(i['項目OWNER'] || '')
                    const matchSingleDue = this.checkedSingleDues.length === 0 || this.checkedSingleDues.includes(i['單項目Due Date'] || '')
                    const matchStatus    = this.checkedStatuses.length   === 0 || this.checkedStatuses.includes(i['狀態'] || '')
                    return matchDate && matchPerson && matchBuilding && matchFloor && matchSite &&
                           matchOrg && matchCase && matchDesc && matchDue && matchAgo && matchOwner && matchSingleDue
                }).map(i => i['管理OWNER'] || '')
            )).sort((a, b) => a.localeCompare(b, 'zh-TW'))
        },

        uniqueDues() {
            return Array.from(new Set(
                this.baseRows.filter(i => {
                    const matchDate      = this.checkedDates.length      === 0 || this.checkedDates.includes(i['日期'] || '')
                    const matchPerson    = this.checkedPersons.length    === 0 || this.checkedPersons.includes(i['提案人'] || '')
                    const matchBuilding  = this.checkedBuildings.length  === 0 || this.checkedBuildings.includes(i['棟別'] || '')
                    const matchFloor     = this.checkedFloors.length     === 0 || this.checkedFloors.includes(i['樓層'] || '')
                    const matchSite      = this.checkedSites.length      === 0 || this.checkedSites.includes(i['站點'] || '')
                    const matchOrg       = this.checkedOrgs.length       === 0 || this.checkedOrgs.includes(i['組織類別'] || '')
                    const matchCase      = this.checkedCases.length      === 0 || this.checkedCases.includes(i['案件分類'] || '')
                    const matchDesc      = this.checkedDescs.length      === 0 || this.checkedDescs.includes(i['項目描述'] || '')
                    const matchMgr       = this.checkedMgrs.length       === 0 || this.checkedMgrs.includes(i['管理OWNER'] || '')
                    const matchAgo       = this.checkedAgos.length       === 0 || this.checkedAgos.includes(i['距今'] || '')
                    const matchOwner     = this.checkedOwners.length     === 0 || this.checkedOwners.includes(i['項目OWNER'] || '')
                    const matchSingleDue = this.checkedSingleDues.length === 0 || this.checkedSingleDues.includes(i['單項目Due Date'] || '')
                    const matchStatus    = this.checkedStatuses.length   === 0 || this.checkedStatuses.includes(i['狀態'] || '')
                    return matchDate && matchPerson && matchBuilding && matchFloor && matchSite &&
                           matchOrg && matchCase && matchDesc && matchMgr && matchAgo && matchOwner && matchSingleDue
                }).map(i => i['項目Due Date'] || '')
            )).sort((a, b) => a.localeCompare(b, 'zh-TW'))
        },

        uniqueAgos() {
            return Array.from(new Set(
                this.baseRows.filter(i => {
                    const matchDate      = this.checkedDates.length      === 0 || this.checkedDates.includes(i['日期'] || '')
                    const matchPerson    = this.checkedPersons.length    === 0 || this.checkedPersons.includes(i['提案人'] || '')
                    const matchBuilding  = this.checkedBuildings.length  === 0 || this.checkedBuildings.includes(i['棟別'] || '')
                    const matchFloor     = this.checkedFloors.length     === 0 || this.checkedFloors.includes(i['樓層'] || '')
                    const matchSite      = this.checkedSites.length      === 0 || this.checkedSites.includes(i['站點'] || '')
                    const matchOrg       = this.checkedOrgs.length       === 0 || this.checkedOrgs.includes(i['組織類別'] || '')
                    const matchCase      = this.checkedCases.length      === 0 || this.checkedCases.includes(i['案件分類'] || '')
                    const matchDesc      = this.checkedDescs.length      === 0 || this.checkedDescs.includes(i['項目描述'] || '')
                    const matchMgr       = this.checkedMgrs.length       === 0 || this.checkedMgrs.includes(i['管理OWNER'] || '')
                    const matchDue       = this.checkedDues.length       === 0 || this.checkedDues.includes(i['項目Due Date'] || '')
                    const matchOwner     = this.checkedOwners.length     === 0 || this.checkedOwners.includes(i['項目OWNER'] || '')
                    const matchSingleDue = this.checkedSingleDues.length === 0 || this.checkedSingleDues.includes(i['單項目Due Date'] || '')
                    const matchStatus    = this.checkedStatuses.length   === 0 || this.checkedStatuses.includes(i['狀態'] || '')
                    return matchDate && matchPerson && matchBuilding && matchFloor && matchSite &&
                           matchOrg && matchCase && matchDesc && matchMgr && matchDue && matchOwner && matchSingleDue
                }).map(i => i['距今'] || '')
            )).sort((a, b) => a.localeCompare(b, 'zh-TW'))
        },

        uniqueOwners() {
            return Array.from(new Set(
                this.baseRows.filter(i => {
                    const matchDate      = this.checkedDates.length      === 0 || this.checkedDates.includes(i['日期'] || '')
                    const matchPerson    = this.checkedPersons.length    === 0 || this.checkedPersons.includes(i['提案人'] || '')
                    const matchBuilding  = this.checkedBuildings.length  === 0 || this.checkedBuildings.includes(i['棟別'] || '')
                    const matchFloor     = this.checkedFloors.length     === 0 || this.checkedFloors.includes(i['樓層'] || '')
                    const matchSite      = this.checkedSites.length      === 0 || this.checkedSites.includes(i['站點'] || '')
                    const matchOrg       = this.checkedOrgs.length       === 0 || this.checkedOrgs.includes(i['組織類別'] || '')
                    const matchCase      = this.checkedCases.length      === 0 || this.checkedCases.includes(i['案件分類'] || '')
                    const matchDesc      = this.checkedDescs.length      === 0 || this.checkedDescs.includes(i['項目描述'] || '')
                    const matchMgr       = this.checkedMgrs.length       === 0 || this.checkedMgrs.includes(i['管理OWNER'] || '')
                    const matchDue       = this.checkedDues.length       === 0 || this.checkedDues.includes(i['項目Due Date'] || '')
                    const matchAgo       = this.checkedAgos.length       === 0 || this.checkedAgos.includes(i['距今'] || '')
                    const matchSingleDue = this.checkedSingleDues.length === 0 || this.checkedSingleDues.includes(i['單項目Due Date'] || '')
                    const matchStatus    = this.checkedStatuses.length   === 0 || this.checkedStatuses.includes(i['狀態'] || '')
                    return matchDate && matchPerson && matchBuilding && matchFloor && matchSite &&
                           matchOrg && matchCase && matchDesc && matchMgr && matchDue && matchAgo && matchSingleDue
                }).map(i => i['項目OWNER'] || '')
            )).sort((a, b) => a.localeCompare(b, 'zh-TW'))
        },

        uniqueSingleDues() {
            return Array.from(new Set(
                this.baseRows.filter(i => {
                    const matchDate     = this.checkedDates.length     === 0 || this.checkedDates.includes(i['日期'] || '')
                    const matchPerson   = this.checkedPersons.length   === 0 || this.checkedPersons.includes(i['提案人'] || '')
                    const matchBuilding = this.checkedBuildings.length === 0 || this.checkedBuildings.includes(i['棟別'] || '')
                    const matchFloor    = this.checkedFloors.length    === 0 || this.checkedFloors.includes(i['樓層'] || '')
                    const matchSite     = this.checkedSites.length     === 0 || this.checkedSites.includes(i['站點'] || '')
                    const matchOrg      = this.checkedOrgs.length      === 0 || this.checkedOrgs.includes(i['組織類別'] || '')
                    const matchCase     = this.checkedCases.length     === 0 || this.checkedCases.includes(i['案件分類'] || '')
                    const matchDesc     = this.checkedDescs.length     === 0 || this.checkedDescs.includes(i['項目描述'] || '')
                    const matchMgr      = this.checkedMgrs.length      === 0 || this.checkedMgrs.includes(i['管理OWNER'] || '')
                    const matchDue      = this.checkedDues.length      === 0 || this.checkedDues.includes(i['項目Due Date'] || '')
                    const matchAgo      = this.checkedAgos.length      === 0 || this.checkedAgos.includes(i['距今'] || '')
                    const matchOwner    = this.checkedOwners.length    === 0 || this.checkedOwners.includes(i['項目OWNER'] || '')
                    const matchStatus    = this.checkedStatuses.length   === 0 || this.checkedStatuses.includes(i['狀態'] || '')
                    return matchDate && matchPerson && matchBuilding && matchFloor && matchSite &&
                           matchOrg && matchCase && matchDesc && matchMgr && matchDue && matchAgo && matchOwner && matchStatus
                }).map(i => i['單項目Due Date'] || '')
            )).sort((a, b) => a.localeCompare(b, 'zh-TW'))
        },

        // 狀態：套用除「狀態」以外所有欄篩選
        uniqueStatuses() {
            return Array.from(new Set(
                this.baseRows.filter(i => {
                    const matchDate      = this.checkedDates.length      === 0 || this.checkedDates.includes(i['日期'] || '')
                    const matchPerson    = this.checkedPersons.length    === 0 || this.checkedPersons.includes(i['提案人'] || '')
                    const matchBuilding  = this.checkedBuildings.length  === 0 || this.checkedBuildings.includes(i['棟別'] || '')
                    const matchFloor     = this.checkedFloors.length     === 0 || this.checkedFloors.includes(i['樓層'] || '')
                    const matchSite      = this.checkedSites.length      === 0 || this.checkedSites.includes(i['站點'] || '')
                    const matchOrg       = this.checkedOrgs.length       === 0 || this.checkedOrgs.includes(i['組織類別'] || '')
                    const matchCase      = this.checkedCases.length      === 0 || this.checkedCases.includes(i['案件分類'] || '')
                    const matchDesc      = this.checkedDescs.length      === 0 || this.checkedDescs.includes(i['項目描述'] || '')
                    const matchMgr       = this.checkedMgrs.length       === 0 || this.checkedMgrs.includes(i['管理OWNER'] || '')
                    const matchDue       = this.checkedDues.length       === 0 || this.checkedDues.includes(i['項目Due Date'] || '')
                    const matchAgo       = this.checkedAgos.length       === 0 || this.checkedAgos.includes(i['距今'] || '')
                    const matchOwner     = this.checkedOwners.length     === 0 || this.checkedOwners.includes(i['項目OWNER'] || '')
                    const matchSingleDue = this.checkedSingleDues.length === 0 || this.checkedSingleDues.includes(i['單項目Due Date'] || '')
                    return matchDate && matchPerson && matchBuilding && matchFloor && matchSite &&
                           matchOrg && matchCase && matchDesc && matchMgr && matchDue && matchAgo && matchOwner && matchSingleDue
                }).map(i => i['狀態'] || '')
            )).sort((a, b) => a.localeCompare(b, 'zh-TW'))
        },

        currentChecked() {
            const map = {
                '日期':          this.checkedDates,
                '提案人':        this.checkedPersons,
                '棟別':          this.checkedBuildings,
                '樓層':          this.checkedFloors,
                '站點':          this.checkedSites,
                '組織類別':      this.checkedOrgs,
                '案件分類':      this.checkedCases,
                '項目描述':      this.checkedDescs,
                '管理OWNER':     this.checkedMgrs,
                '項目Due Date':  this.checkedDues,
                '距今':          this.checkedAgos,
                '項目OWNER':     this.checkedOwners,
                '單項目Due Date': this.checkedSingleDues,
                '狀態':          this.checkedStatuses,
            }
            return map[this.activeFilter] || []
        },

        currentUniqueAll() {
            const map = {
                '日期':          this.uniqueDates,
                '提案人':        this.uniquePersons,
                '棟別':          this.uniqueBuildings,
                '樓層':          this.uniqueFloors,
                '站點':          this.uniqueSites,
                '組織類別':      this.uniqueOrgs,
                '案件分類':      this.uniqueCases,
                '項目描述':      this.uniqueDescs,
                '管理OWNER':     this.uniqueMgrs,
                '項目Due Date':  this.uniqueDues,
                '距今':          this.uniqueAgos,
                '項目OWNER':     this.uniqueOwners,
                '單項目Due Date': this.uniqueSingleDues,
                '狀態':          this.uniqueStatuses,
            }
            return map[this.activeFilter] || []
        },

        currentOptions() {
            const s = this.filterSearch.trim().toLowerCase()
            if (!s) return this.currentUniqueAll
            return this.currentUniqueAll.filter(v => v.toLowerCase().includes(s))
        },

        isAllChecked() {
            return this.currentOptions.length > 0 &&
                   this.currentOptions.every(v => this.currentChecked.includes(v))
        },
        isIndeterminate() {
            const some = this.currentOptions.some(v => this.currentChecked.includes(v))
            return some && !this.isAllChecked
        },

        // ── 甘特圖 ──
        ganttProposers() {
            return [...new Set(
                this.rows
                    .filter(r => this.adminOrgs.includes(r['組織類別']))
                    .map(r => this.ganttPersonOf(r))
                    .filter(p => p !== '（未填）')
            )].sort()
        },
        ganttRows() {
            let base = this.rows.filter(r =>
                this.adminOrgs.includes(r['組織類別']) &&
                (r['日期'] || r['執行日期'] || r['項目Due Date'] || r['單項目Due Date'])
            )
            // 專案(年)/專案(PA)：toggle 開啟時 = 專屬篩選模式，只顯示被選中的專案分類；
            // 都沒開啟時 = 一般模式，顯示非專案任務（專案類預設隱藏）
            base = base.filter(r => {
                const c = (r['案件分類'] || '')
                    .replace(/（/g, '(').replace(/）/g, ')')   // 全形括號轉半形
                    .trim().toUpperCase()                       // 去空白、pa→PA
                const isYear = c === '專案(年)'
                const isPA   = c === '專案(PA)'

                if (this.ganttShowYear || this.ganttShowPA) {
                    // 篩選模式：只留被打開的分類，其餘一律不顯示
                    return (this.ganttShowYear && isYear) || (this.ganttShowPA && isPA)
                }
                // 一般模式：專案類隱藏，其他照常
                return !isYear && !isPA
            })
            if (!this.ganttProposer) return base
            return base.filter(r => this.ganttPersonOf(r) === this.ganttProposer)
        },
        // 依顯示人分組（項目OWNER 優先，空白 fallback 提案人）：{ 人名: [任務...] }
        ganttPersonRows() {
            const groups = {}
            for (const r of this.ganttRows) {
                const p = this.ganttPersonOf(r)
                if (!groups[p]) groups[p] = []
                groups[p].push(r)
            }
            // 回傳排序後的 [人名, 任務陣列] 列表
            return Object.keys(groups).sort().map(p => ({ person: p, tasks: groups[p] }))
        },
        ganttDateHeaders() {
            if (!this.ganttStart) return []
            const headers = []
            const toLocal = d => {
                const y = d.getFullYear()
                const m = String(d.getMonth()+1).padStart(2,'0')
                const day = String(d.getDate()).padStart(2,'0')
                return `${y}-${m}-${day}`
            }
            // ISO 週次計算
            const isoWeek = d => {
                const date = new Date(d.getTime())
                date.setHours(0,0,0,0)
                date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7))
                const week1 = new Date(date.getFullYear(), 0, 4)
                return 1 + Math.round(((date - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
            }
            const today = new Date(); today.setHours(0,0,0,0)
            const todayStr = toLocal(today)
            const mode = this.ganttViewMode

            if (mode === 'day') {
                for (let i = 0; i < 21; i++) {
                    const d = new Date(this.ganttStart)
                    d.setDate(d.getDate() + i)
                    const str = toLocal(d)
                    headers.push({
                        str, startStr: str, endStr: str,
                        label:     (d.getMonth()+1) + '/' + d.getDate(),
                        yearMonth: `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}`,
                        week:      `W${isoWeek(d)}`,
                        isToday:   str === todayStr
                    })
                }
            } else if (mode === 'week') {
                // 對齊到週一
                const s = new Date(this.ganttStart)
                s.setDate(s.getDate() - ((s.getDay() + 6) % 7))
                for (let i = 0; i < 12; i++) {
                    const ws = new Date(s); ws.setDate(ws.getDate() + i*7)
                    const we = new Date(ws); we.setDate(we.getDate() + 6)
                    const startStr = toLocal(ws), endStr = toLocal(we)
                    headers.push({
                        str: startStr, startStr, endStr,
                        label:     `W${isoWeek(ws)}`,
                        yearMonth: `${ws.getFullYear()}/${String(ws.getMonth()+1).padStart(2,'0')}`,
                        isToday:   todayStr >= startStr && todayStr <= endStr
                    })
                }
            } else {
                // month：對齊到月初
                const s = new Date(this.ganttStart.getFullYear(), this.ganttStart.getMonth(), 1)
                for (let i = 0; i < 6; i++) {
                    const ms = new Date(s.getFullYear(), s.getMonth() + i, 1)
                    const me = new Date(s.getFullYear(), s.getMonth() + i + 1, 0)
                    const startStr = toLocal(ms), endStr = toLocal(me)
                    headers.push({
                        str: startStr, startStr, endStr,
                        label:     `${ms.getFullYear()}/${String(ms.getMonth()+1).padStart(2,'0')}`,
                        yearMonth: `${ms.getFullYear()}/${String(ms.getMonth()+1).padStart(2,'0')}`,
                        isToday:   todayStr >= startStr && todayStr <= endStr
                    })
                }
            }
            return headers
        },
        ganttRangeLabel() {
            const headers = this.ganttDateHeaders
            if (!headers.length) return ''
            return `${headers[0].startStr} ~ ${headers[headers.length-1].endStr}`
        },
    },

    // ─────────────────────────────────────────────
    methods: {
        // ── 載入資料 ──
        async fetchData() {
            this.loading = true
            try {
                // 後端依 admin.json 強制過濾，只回傳管轄組織的資料
                const res = await axios.get(`${API}/api/admin_tasks/${encodeURIComponent(this.account)}`)
                this.rows = (res.data || []).filter(Boolean)
            } catch (e) {
                if (e.response?.status === 403) { location.href = '../login.html'; return }
                this.toast('❌ 載入失敗', 'error')
            } finally {
                this.loading = false
            }
        },


        openFilter(colKey, event) {
            if (this.activeFilter === colKey) { this.closeFilter(); return }
            this.activeFilter = colKey
            this.filterSearch = ''
            this.$nextTick(() => {
                const rect = event.currentTarget.getBoundingClientRect()
                const pw   = 216
                const winW = window.innerWidth
                let left   = rect.left
                if (left + pw > winW - 8) left = winW - pw - 8
                this.panelStyle = { top: `${rect.bottom + 4}px`, left: `${left}px` }
            })
        },

        closeFilter() { this.activeFilter = null; this.filterSearch = '' },

        toggleVal(val) {
            const arr = this.currentChecked
            const idx = arr.indexOf(val)
            if (idx === -1) arr.push(val)
            else arr.splice(idx, 1)
        },

        toggleAll() {
            const arr = this.currentChecked
            if (this.isAllChecked) {
                this.currentOptions.forEach(v => { const i = arr.indexOf(v); if (i !== -1) arr.splice(i, 1) })
            } else {
                this.currentOptions.forEach(v => { if (!arr.includes(v)) arr.push(v) })
            }
        },

        clearCurrentFilter() {
            const map = {
                '日期':          'checkedDates',
                '提案人':        'checkedPersons',
                '棟別':          'checkedBuildings',
                '樓層':          'checkedFloors',
                '站點':          'checkedSites',
                '組織類別':      'checkedOrgs',
                '案件分類':      'checkedCases',
                '項目描述':      'checkedDescs',
                '管理OWNER':     'checkedMgrs',
                '項目Due Date':  'checkedDues',
                '距今':          'checkedAgos',
                '項目OWNER':     'checkedOwners',
                '單項目Due Date': 'checkedSingleDues',
                '狀態':          'checkedStatuses',
            }
            const prop = map[this.activeFilter]
            if (prop) this[prop] = []
        },

        resetAllFilters() {
            this.checkedDates = []; this.checkedPersons = []; this.checkedBuildings = []
            this.checkedFloors = []; this.checkedSites = []; this.checkedOrgs = []
            this.checkedCases = []; this.checkedDescs = []; this.checkedMgrs = []
            this.checkedDues = []; this.checkedAgos = []; this.checkedOwners = []
            this.checkedSingleDues = []; this.checkedStatuses = []; this.keyword = ''
            this.closeFilter()
        },

        openView(row) { location.href = `view.html?id=${row['id']}&from=admin.html` },
        confirmDel(row) { this.delTarget = row; this.showDel = true },

        async doDelete() {
            if (!this.delTarget) return
            try {
                await axios.post(API + '/api/delete', { id: this.delTarget['id'] })
                this.rows = this.rows.filter(r => r['id'] !== this.delTarget['id'])
                this.toast('✅ 刪除成功', 'success')
            } catch {
                this.toast('❌ 刪除失敗', 'error')
            } finally {
                this.showDel = false; this.delTarget = null
            }
        },

        // 項目描述遇到「1.」「2.」等編號自動換行
        formatDesc(text) {
            if (!text) return '—'
            return text.replace(/\s*(\d+\.)/g, (m, p1, offset) => offset === 0 ? p1 : '\n' + p1)
        },
        dueClass(val) {
            if (!val || val === '無') return 'tag-ok'
            if (val === '今日') return 'tag-today'
            if (val.startsWith('剩')) return 'tag-ok'
            return 'tag-overdue'   // X天（無前綴）= 逾期
        },


        // ── 權限管理 Modal ──
        // 僅保留本管理員管轄的組織（前端保險，防舊版後端回傳全部）
        _scopeConfig(cfg) {
            const VALID_ORGS = ['FT01營運(硬)', 'FT01營運(資)', 'FT01營運(保)', 'FT01值班']
            const out = {}
            for (const org of Object.keys(cfg || {})) {
                if (VALID_ORGS.includes(org) && this.adminOrgs.includes(org)) out[org] = cfg[org]
            }
            return out
        },
        async openPermModal() {
            this.showPermModal = true
            this.permLoading = true
            try {
                const res = await axios.get(`${API}/api/admin_config/${encodeURIComponent(this.account)}`)
                this.permConfig = this._scopeConfig(res.data.config || {})
                this.permUsers  = res.data.users  || {}
            } catch (e) {
                this.toast(e.response?.status === 403 ? '❌ 無權限' : '❌ 載入失敗', 'error')
                this.showPermModal = false
            } finally { this.permLoading = false }
        },
        async permAdd(org) {
            if (!this.adminOrgs.includes(org)) { this.toast('❌ 僅能管理自己擁有的組織', 'error'); return }
            const target = (this.permAddInput[org] || '').trim().toUpperCase()
            if (!target) return
            if ((this.permConfig[org] || []).includes(target)) { this.toast('⚠️ 已是該組織管理員', 'error'); return }
            try {
                const res = await axios.post(`${API}/api/admin_config/${encodeURIComponent(this.account)}`,
                    { org, target, action: 'add' })
                this.permConfig = this._scopeConfig(res.data.config)
                this.permAddInput[org] = ''
                this.toast(`✅ 已新增 ${this.permUsers[target] || target}`, 'success')
            } catch (e) { this.toast(e.response?.status === 403 ? '❌ 無權限' : '❌ 新增失敗', 'error') }
        },
        async permRemove(org, acc) {
            if (!this.adminOrgs.includes(org)) { this.toast('❌ 僅能管理自己擁有的組織', 'error'); return }
            try {
                const res = await axios.post(`${API}/api/admin_config/${encodeURIComponent(this.account)}`,
                    { org, target: acc, action: 'remove' })
                this.permConfig = this._scopeConfig(res.data.config)
                this.toast(`✅ 已從 ${org} 移除 ${this.permUsers[acc] || acc}`, 'success')
            } catch (e) { this.toast(e.response?.status === 403 ? '❌ 無權限' : '❌ 移除失敗', 'error') }
        },

        toast(msg, type = 'success') {
            const id = ++this.toastId
            this.toasts.push({ id, message: msg, type })
            setTimeout(() => this.removeToast(id), 3000)
        },
        removeToast(id) { this.toasts = this.toasts.filter(t => t.id !== id) },

        logout() { ftLogout() },

        // ── 甘特圖 ──
        // 專案(年)/專案(PA) 互斥切換（2選1）：開啟其一自動關閉另一個；再點一次則關閉回一般模式
        toggleGanttCat(cat) {
            if (cat === 'year') {
                this.ganttShowYear = !this.ganttShowYear
                if (this.ganttShowYear) this.ganttShowPA = false
            } else {
                this.ganttShowPA = !this.ganttShowPA
                if (this.ganttShowPA) this.ganttShowYear = false
            }
        },
        // 顯示人判定：項目OWNER 有值優先，空白則 fallback 提案人
        ganttPersonOf(row) {
            return (row['項目OWNER'] || '').trim() || (row['提案人'] || '').trim() || '（未填）'
        },
        // ── 甘特圖 tooltip ──
        _ganttTipPos(e) {
            const pad = 12
            const tipEl = this.$refs.ganttTipEl
            const tipW = tipEl ? tipEl.offsetWidth  : 300
            const tipH = tipEl ? tipEl.offsetHeight : 180
            let x = e.clientX + pad
            let y = e.clientY + pad
            if (x + tipW > window.innerWidth)  x = e.clientX - tipW - pad
            if (y + tipH > window.innerHeight) y = e.clientY - tipH - pad
            // 最低限度不貼邊
            if (x < 4) x = 4
            if (y < 4) y = 4
            return { x, y }
        },
        ganttShowTip(e, task) {
            const { x, y } = this._ganttTipPos(e)
            this.ganttTip = { show: true, x, y, task }
            // 渲染後用真實高度再修正一次
            this.$nextTick(() => {
                const { x: nx, y: ny } = this._ganttTipPos(e)
                this.ganttTip.x = nx
                this.ganttTip.y = ny
            })
        },
        ganttMoveTip(e) {
            if (!this.ganttTip.show) return
            const { x, y } = this._ganttTipPos(e)
            this.ganttTip.x = x
            this.ganttTip.y = y
        },
        ganttHideTip() {
            this.ganttTip.show = false
            this.ganttTip.task = null
        },

        _ganttStepDays() {
            // 每次移動的天數，依檢視模式
            if (this.ganttViewMode === 'week')  return 28    // 4 週
            if (this.ganttViewMode === 'month') return 62    // 約 2 個月
            return 7                                          // 日檢視：7 天
        },
        ganttPrev() {
            this.ganttStart = new Date(this.ganttStart.getTime() - this._ganttStepDays()*86400000)
            this.ganttNavigated = true
        },
        ganttNext() {
            this.ganttStart = new Date(this.ganttStart.getTime() + this._ganttStepDays()*86400000)
            this.ganttNavigated = true
        },
        _ganttResetStart() {
            const t = new Date(); t.setHours(0,0,0,0)
            if (this.ganttViewMode === 'week') {
                t.setDate(t.getDate() - 11*7)      // 12 週視窗，今天在最後一週
            } else if (this.ganttViewMode === 'month') {
                t.setMonth(t.getMonth() - 5)       // 6 月視窗，今天在最後一月
                t.setDate(1)
            } else {
                t.setDate(t.getDate() - 20)        // 21 天視窗，今天在最右
            }
            this.ganttStart = t
        },
        setGanttMode(mode) {
            this.ganttViewMode = mode
            this._ganttResetStart()
            this.ganttNavigated = false
        },
        // 取得任務的開始日和結束日
        ganttTaskRange(row) {
            const toLocal = d => {
                const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0')
                return `${y}-${m}-${day}`
            }
            const today  = toLocal(new Date())
            const start  = (row['日期'] || '').trim()
            const doneDay = (row['Done_Day'] || '').trim()
            const isDone  = !!doneDay   // 只要 Done_Day 有值就算完成，與狀態欄、Due Date 都無關

            // Done_Day 有值 → end = Done_Day；沒值 → 一律延伸到今天（不看 Due Date）
            const end = isDone ? doneDay : today

            // 強制連續 bar，不用 execDates 點狀模式（避免被切段）
            const execDates = []

            return { start, end, execDates, isDone }
        },
        // 判斷是否為 bar 的結束格（畫在這裡，往左延伸）
        // 判斷 row 是否在可見範圍內（有交集才畫）
        ganttRowVisible(row) {
            const { start, end } = this.ganttTaskRange(row)
            const headers = this.ganttDateHeaders
            if (!headers.length) return false
            const firstStr = headers[0].startStr
            const lastStr  = headers[headers.length - 1].endStr
            return !(start > lastStr || end < firstStr)
        },

        // bar 放在人名列的 wrapper，用 left% + width% 定位，laneIdx/laneCount 垂直堆疊
        ganttRowBarStyle(row) {
            const { start, end, isDone } = this.ganttTaskRange(row)

            // 顏色判斷：
            // Done_Day 有值 → 綠色
            // 未完成且今天已超過 Due Date → 紅色（逾期）
            // 未完成未逾期，狀態 On Going → 藍色
            // 未完成未逾期，狀態 Pending → 黃色
            const toLocal = d => {
                const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0')
                return `${y}-${m}-${day}`
            }
            const today = toLocal(new Date())
            const dueDate = (row['單項目Due Date'] || row['項目Due Date'] || '').trim()
            const status = (row['狀態'] || '').trim()

            let color
            if (isDone || status === 'Done') {
                color = '#00dd30'                              // Done_Day 有值或狀態 Done → 綠
            } else if (dueDate && today > dueDate) {
                color = '#f71f1f'                              // 逾期 → 紅
            } else if (status === 'On Going') {
                color = '#3b82f6'                              // 進行中 → 藍
            } else {
                color = '#eab308'                              // Pending / 其他 → 黃
            }
            const headers = this.ganttDateHeaders
            const total = headers.length

            // 找包含指定日期的欄位（欄有 startStr~endStr 範圍）
            const colOf = dateStr => headers.findIndex(h => dateStr >= h.startStr && dateStr <= h.endStr)

            const si = colOf(start)
            const startCol = si === -1 ? 0 : si   // start 在視窗左邊外 → 從第 0 欄

            const ei = colOf(end)
            const endCol = ei === -1 ? total - 1 : ei   // end 在視窗右邊外 → 到最後一欄

            const leftPct  = (startCol / total * 100).toFixed(4)
            const widthPct = ((endCol - startCol + 1) / total * 100).toFixed(4)

            // bar 填滿整列高度（top/bottom 各留 4px），列越高 bar 越粗
            return `position:absolute;top:4px;bottom:4px;left:calc(${leftPct}% + 3px);width:calc(${widthPct}% - 6px);border-radius:4px;background:${color};opacity:.85;z-index:1;cursor:pointer`
        },

    },

    async mounted() {
        const acc = requireAuth()
        if (!acc) return
        const role = await fetchRole(acc)
        if (!role.is_admin) { location.href = '../login.html'; return }
        this.account   = acc
        this.isAdmin   = true
        this.userName  = role.name || acc
        this.adminOrgs = role.admin_orgs
        await this.fetchData()
        // 甘特圖預設視窗（今天在最右），提案人預設當前使用者
        this._ganttResetStart()
        this.ganttProposer = this.userName || null
        this._outsideClick = () => { this.closeFilter(); this.showNavMenu = false }
        document.addEventListener('click', this._outsideClick)
    },

    beforeUnmount() {
        document.removeEventListener('click', this._outsideClick)
    },
})

app.mount('#app')