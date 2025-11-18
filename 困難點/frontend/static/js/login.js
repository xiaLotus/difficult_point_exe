const app = Vue.createApp({
  data() {
    return {
      username: '',
      password: ''
    };
  },
  methods: {
    async submitForm() {
      console.log('帳號:', this.username);
      console.log('密碼:', this.password);

      const response = await fetch(
        `http://127.0.0.1:5000/api/check_Permission?filename=${this.username}&role=預覽人`
      );
      if (!response.ok) {
        alert("無權限登入，謝謝");
        return;
      }

      const result = await response.json();
      if (!result.valid) {
        alert("❌ 無權限登入，謝謝");
        return;
      }

      try {
        const loginRes = await axios.post('http://127.0.0.1:5000/api/login', {
          username: this.username,
          password: this.password
        });

        if (loginRes.data.success) {
          setTimeout(() => {
            localStorage.setItem('username', this.username);
            // window.location.href = `meeting/defficultmeeting.html?username=${encodeURIComponent(this.username)}`;
            window.location.href = `meeting/datachart.html?username=${encodeURIComponent(this.username)}`
          }, 300);
        } else {
          alert('帳號或密碼錯誤');
          this.username = '';
          this.password = '';
        }
      } catch (error) {
        console.error('驗證錯誤:', error);
        alert('發生錯誤，請稍後再試');
      }
    }
  }
});

app.mount('#app');
