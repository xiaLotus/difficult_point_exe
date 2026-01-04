const app = Vue.createApp({
    data() {
        return {
            username: null,
            messages: [],
            newMessage: {
                content: '',
                images: []  // 存儲圖片對象 {file, preview, name}
            },
            isDragging: false,
            showImagePreview: false,
            previewImage: null,
            apiBaseUrl: 'http://127.0.0.1:5000'  // API 基礎 URL
        };
    },
    
    computed: {
        sortedMessages() {
            return [...this.messages].sort((a, b) => {
                return new Date(b.timestamp) - new Date(a.timestamp);
            });
        }
    },
    
    methods: {
        // ===== 初始化方法 =====
        initUsername() {
            const urlParams = new URLSearchParams(window.location.search);
            this.username = urlParams.get('username') || 'Unknown';
            console.log('📝 初始化用戶名:', this.username);
        },
        
        // ===== 圖片 URL 處理 =====
        getFullImageUrl(imageUrl) {
            if (!imageUrl) return '';
            // 如果已經是完整 URL，直接返回
            if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
                return imageUrl;
            }
            // 否則加上 API 基礎 URL
            return this.apiBaseUrl + imageUrl;
        },
        
        // ===== 載入留言 =====
        async loadMessages() {
            try {
                console.log('🔄 開始載入留言...');
                const response = await axios.get(`${this.apiBaseUrl}/api/bulletin/messages`);
                console.log('📦 API 返回:', response.data);
                
                if (response.data.status === 'success') {
                    // 處理圖片 URL，確保都是完整路徑
                    const processedMessages = (response.data.messages || []).map(msg => ({
                        ...msg,
                        images: (msg.images || []).map(url => this.getFullImageUrl(url))
                    }));
                    
                    // 直接替換整個陣列（Vue 3 響應式更新）
                    this.messages = processedMessages;
                    
                    console.log('✅ 載入成功，共', this.messages.length, '則留言');
                    
                    // 等待下一個 tick 確保 DOM 更新
                    await this.$nextTick();
                    
                    // 重新初始化圖標
                    if (typeof lucide !== 'undefined') {
                        lucide.createIcons();
                    }
                }
            } catch (error) {
                console.error('❌ 載入留言失敗:', error);
            }
        },
        
        // ===== 圖片上傳處理 =====
        handleImageUpload(event) {
            const files = Array.from(event.target.files);
            console.log('📷 選擇了', files.length, '張圖片');
            this.processImages(files);
            event.target.value = '';
        },
        
        handleDrop(event) {
            this.isDragging = false;
            const files = Array.from(event.dataTransfer.files);
            const imageFiles = files.filter(file => file.type.startsWith('image/'));
            
            if (imageFiles.length > 0) {
                console.log('📷 拖曳上傳', imageFiles.length, '張圖片');
                this.processImages(imageFiles);
            } else {
                Swal.fire({
                    icon: 'warning',
                    title: '無效的檔案',
                    text: '請上傳圖片檔案(PNG、JPG、GIF、WebP)',
                    confirmButtonColor: '#f59e0b',
                    scrollbarPadding: false,
                    heightAuto: false
                });
            }
        },
        
        processImages(files) {
            const maxSize = 10 * 1024 * 1024; // 10MB
            const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
            
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
                
                // 創建預覽
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.newMessage.images.push({
                        file: file,
                        preview: e.target.result,
                        name: file.name
                    });
                    
                    console.log('✅ 已添加圖片預覽:', file.name);
                    
                    this.$nextTick(() => {
                        if (typeof lucide !== 'undefined') {
                            lucide.createIcons();
                        }
                    });
                };
                reader.readAsDataURL(file);
            }
        },
        
        // ===== 圖片管理 =====
        removeImage(index) {
            console.log('🗑️ 移除圖片:', this.newMessage.images[index].name);
            this.newMessage.images.splice(index, 1);
            this.$nextTick(() => {
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            });
        },
        
        clearAllImages() {
            console.log('🗑️ 清除全部圖片');
            this.newMessage.images = [];
            this.$nextTick(() => {
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            });
        },
        
        // ===== 發送留言 =====
        async postMessage() {
            // 驗證輸入
            if (!this.newMessage.content.trim() && this.newMessage.images.length === 0) {
                Swal.fire({
                    icon: 'warning',
                    title: '請輸入留言內容或上傳圖片',
                    confirmButtonColor: '#3b82f6',
                    scrollbarPadding: false,
                    heightAuto: false
                });
                return;
            }
            
            // ✅ 使用原生 DOM 操作禁用按鈕，避免 Vue 響應式更新
            const submitBtn = document.querySelector('button[data-submit-btn]');
            if (!submitBtn || submitBtn.disabled) {
                console.log('⚠️ 按鈕已禁用或找不到');
                return;
            }
            
            console.log('📤 準備發送留言...');
            console.log('內容:', this.newMessage.content);
            console.log('圖片數量:', this.newMessage.images.length);
            
            // ✅ 原生 DOM 操作 - 不觸發 Vue 更新
            const originalHTML = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> 發送中...';
            lucide.createIcons();
            
            try {
                // 準備表單數據
                const formData = new FormData();
                formData.append('author', this.username);
                formData.append('content', this.newMessage.content || '');
                
                // 添加圖片
                this.newMessage.images.forEach((img, idx) => {
                    formData.append('images', img.file);
                    console.log(`📎 添加圖片 ${idx + 1}:`, img.name);
                });
                
                // 發送請求
                console.log('🚀 發送 POST 請求...');
                const response = await axios.post(`${this.apiBaseUrl}/api/bulletin/post`, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                });
                
                console.log('📥 收到響應:', response.data);
                
                if (response.data.status === 'success') {
                    console.log('✅ 發送成功！');
                    
                    // ✅ 步驟1: 先重新載入留言列表
                    console.log('🔄 重新載入留言列表...');
                    await this.loadMessages();
                    console.log('✅ 留言列表已更新');
                    
                    // ✅ 步驟2: 再清空輸入（不使用 await）
                    this.newMessage.content = '';
                    this.newMessage.images = [];
                    console.log('🧹 已清空輸入框');
                    
                    // ✅ 步驟3: 使用 nextTick 回調（不是 await）
                    this.$nextTick(() => {
                        // 刷新圖標
                        if (typeof lucide !== 'undefined') {
                            lucide.createIcons();
                        }
                        
                        // 恢復按鈕狀態
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = originalHTML;
                        lucide.createIcons();
                        
                        // 顯示成功提示
                        Swal.fire({
                            icon: 'success',
                            title: '發送成功',
                            timer: 1500,
                            showConfirmButton: false,
                            scrollbarPadding: false,
                            heightAuto: false
                        });
                    });
                }
            } catch (error) {
                console.error('❌ 發送留言失敗:', error);
                console.error('錯誤詳情:', error.response?.data);
                
                // 恢復按鈕狀態
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalHTML;
                lucide.createIcons();
                
                Swal.fire({
                    icon: 'error',
                    title: '發送失敗',
                    text: error.response?.data?.message || '請稍後再試',
                    confirmButtonColor: '#ef4444',
                    scrollbarPadding: false,
                    heightAuto: false
                });
            }
        },
        
        // ===== 刪除留言 =====
        async deleteMessage(messageId) {
            // 確認刪除
            const result = await Swal.fire({
                icon: 'warning',
                title: '確認刪除',
                text: '確定要刪除這則留言嗎?',
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
                console.log('🗑️ 刪除留言 ID:', messageId);
                const response = await axios.delete(`${this.apiBaseUrl}/api/bulletin/messages/${messageId}`);
                
                if (response.data.status === 'success') {
                    console.log('✅ 刪除成功');
                    
                    // 重新載入留言列表
                    await this.loadMessages();
                    
                    // 等待 DOM 更新
                    await this.$nextTick();
                    
                    // 重新初始化圖標
                    if (typeof lucide !== 'undefined') {
                        lucide.createIcons();
                    }
                    
                    // 顯示成功提示
                    Swal.fire({
                        icon: 'success',
                        title: '刪除成功',
                        timer: 1500,
                        showConfirmButton: false,
                        scrollbarPadding: false,
                        heightAuto: false
                    });
                }
            } catch (error) {
                console.error('❌ 刪除留言失敗:', error);
                Swal.fire({
                    icon: 'error',
                    title: '刪除失敗',
                    text: error.response?.data?.message || '請稍後再試',
                    confirmButtonColor: '#ef4444',
                    scrollbarPadding: false,
                    heightAuto: false
                });
            }
        },
        
        // ===== 圖片預覽 =====
        showImageModal(imageUrl) {
            // 確保圖片 URL 是完整路徑
            this.previewImage = this.getFullImageUrl(imageUrl);
            this.showImagePreview = true;
            console.log('🖼️ 顯示圖片:', this.previewImage);
        },
        
        // ===== 返回 =====
        goBack() {
            window.location.href = `defficultmeeting.html?username=${this.username}`;
        }
    },
    
    // ===== 生命週期鉤子 =====
    async mounted() {
        console.log('🚀 Vue 應用已掛載');
        
        // 初始化用戶名
        this.initUsername();
        
        // 等待初始化完成
        await this.$nextTick();
        
        // 載入留言
        await this.loadMessages();
        
        // 初始化圖標
        await this.$nextTick();
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
        // 設置自動刷新（每 30 秒）
        setInterval(() => {
            console.log('⏰ 自動重新載入留言');
            this.loadMessages();
        }, 30000);
        
        console.log('✅ 應用初始化完成');
    }
});

// 掛載 Vue 應用
app.mount('#app');
console.log('✅ Vue 應用已啟動');