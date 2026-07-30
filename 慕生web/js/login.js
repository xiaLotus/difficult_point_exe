const { createApp } = Vue

createApp({
    data() {
        return {
            username: '',
            password: '',
            errorMsg: ''
        }
    },
    methods: {

        clearInput() {
            this.username = ''
            this.password = ''
            this.errorMsg = ''
        },

        login() {
            this.errorMsg = ''

            if (!this.username || !this.password) {
                this.errorMsg = '請輸入帳號與密碼'
                return
            }

            // demo 判斷
            if (this.username === '000') {

                // ⭐ 存登入狀態
                localStorage.setItem('isLogin', 'true')

                // ⭐ 存使用者名稱
                localStorage.setItem('username', this.username)

                // ⭐ 存登入時間（可選）
                localStorage.setItem('loginTime', new Date().toISOString())

                // ⭐ 跳轉
                window.location.href = "index.html"

            } else {
                this.errorMsg = '帳號或密碼錯誤'
            }
        }
    }
}).mount('#app')