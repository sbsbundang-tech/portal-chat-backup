// =================================================================================
// 3-1. UI Core (설정, 알림, 검색, 헤더, 서식, 타이핑, 메뉴) - InputHandler 제거됨(원본 복구)
// =================================================================================

/**
 * 설정 및 테마 관리자
 */
App.SettingsManager = {
    elements: {
        body: document.body,
        themeToggleButton: document.getElementById('theme-toggle'),
        notificationButton: document.getElementById('notification-toggle'),
    },
    init: function() {
        const currentTheme = localStorage.getItem('chatTheme') || 'light';
        if (currentTheme === 'dark') { 
            this.elements.body.classList.add('dark-mode'); 
            if(this.elements.themeToggleButton) this.elements.themeToggleButton.textContent = '☀️'; 
        } else { 
            if(this.elements.themeToggleButton) this.elements.themeToggleButton.textContent = '🌙'; 
        }
        this.elements.themeToggleButton?.addEventListener('click', this.toggleTheme.bind(this));
        
        const notiBtn = this.elements.notificationButton;
        if (notiBtn) {
            const storedState = localStorage.getItem('chatNotification');
            const isNotiOn = storedState === 'true' || storedState === null; 
            this.updateNotificationIcon(isNotiOn);
            notiBtn.addEventListener('click', () => this.toggleNotification());
        }
        
        const soundBtn = document.getElementById('sound-toggle');
        if(soundBtn) soundBtn.style.display = 'none';
    },
    
    showToast: function(message) {
        const toast = document.createElement('div');
        toast.className = 'toast-message';
        toast.textContent = message;
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 2000);
    },

    toggleNotification: function() {
        if (Notification.permission === 'granted') {
            const storedState = localStorage.getItem('chatNotification');
            const currentlyOn = storedState === 'true' || storedState === null;
            this.setNotificationState(!currentlyOn);
            this.showToast(!currentlyOn ? "알림이 켜졌습니다." : "알림이 꺼졌습니다.");
            return;
        }
        const isPopup = !!window.opener;
        const isStandalone = window.self === window.top;
        if (isPopup || isStandalone) {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    this.setNotificationState(true);
                    this.showToast("알림 권한이 허용되었습니다.");
                    if (window.opener) window.close();
                } else {
                    alert("알림 권한이 거부되었습니다.");
                    this.setNotificationState(false);
                }
            });
        } else {
            this.requestPermissionInPopup();
        }
    },
    requestPermissionInPopup: function() {
        const width = 500, height = 300;
        const popup = window.open(window.location.href, 'NotificationPermission', `width=${width},height=${height},top=${(screen.height/2)-(height/2)},left=${(screen.width/2)-(width/2)}`);
        if (popup) { const timer = setInterval(() => { if (popup.closed) { clearInterval(timer); window.location.reload(); } }, 500); } else { alert("팝업 차단을 해제해 주세요."); }
    },
    setNotificationState: function(isOn) { localStorage.setItem('chatNotification', isOn); this.updateNotificationIcon(isOn); },
    updateNotificationIcon: function(isOn) {
        const btn = this.elements.notificationButton; if(!btn) return;
        if (isOn) {
            btn.classList.add('active'); btn.style.color = 'var(--accent-color)';
            btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"></path></svg>';
        } else {
            btn.classList.remove('active'); btn.style.color = 'var(--text-color-secondary)';
            btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path><line x1="2" y1="2" x2="22" y2="22"></line></svg>'; 
        }
    },
    toggleTheme: function() {
        this.elements.body.classList.toggle('dark-mode');
        const isDark = this.elements.body.classList.contains('dark-mode');
        this.elements.themeToggleButton.textContent = isDark ? '☀️' : '🌙';
        localStorage.setItem('chatTheme', isDark ? 'dark' : 'light');
    }
};

/**
 * 브라우저 알림 관리자
 */
App.NotificationManager = {
    bootTime: Date.now(), debounceTimer: null,
    init: function() { App.EventBus.on('messageReceived', (message) => this.onMessage(message)); },
    onMessage: function(message) {
        const storedState = localStorage.getItem('chatNotification');
        const isNotiOn = storedState === 'true' || storedState === null;
        if (message.clientId && App.CLIENT_ID && message.clientId === App.CLIENT_ID) return;
        if (!message.clientId) {
             const sender = String(message.senderName || '').replace(/"/g, '').trim();
             const me = String(FULL_USER_NAME || '').replace(/"/g, '').trim();
             if (sender === me) return;
        }
        if (!message.timestamp || message.timestamp <= this.bootTime) return;
        if (document.visibilityState === 'visible' || document.hasFocus()) return;
        const isMentioned = message.mentions && message.mentions.includes(FULL_USER_NAME);
        if (isNotiOn || isMentioned) {
            if (this.debounceTimer) clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => { this.showNotification(message); }, 500);
        }
    },
    showNotification: function(message) {
        if (Notification.permission === 'granted') {
            let bodyText = '새 메시지가 도착했습니다.';
            if (message.type === 'image') bodyText = '사진이 도착했습니다.';
            else if (message.type === 'file') bodyText = '파일이 도착했습니다.';
            else if (message.type === 'poll') bodyText = '투표가 시작되었습니다.';
            try {
                const senderDisplay = String(message.senderName).replace(/"/g,'');
                const noti = new Notification(senderDisplay, { 
                    body: bodyText, icon: App.Constants.NOTI_ICON, tag: message.key || `msg-${Date.now()}`, renotify: true, silent: false 
                });
                noti.onclick = function() { window.focus(); this.close(); };
                setTimeout(() => noti.close(), 5000);
            } catch (e) { console.error(e); }
        }
    }
};

/**
 * 검색 관리자
 */
App.SearchManager = {
    elements: { container: null, input: null, countSpan: null, prevBtn: null, nextBtn: null, closeBtn: null },
    highlights: [], currentIndex: -1,
    init: function() { this.injectUI(); App.EventBus.on('search:toggle', () => this.toggleSearch()); },
    injectUI: function() {
        const searchBar = document.createElement('div'); searchBar.id = 'search-bar-container';
        searchBar.innerHTML = `<input type="text" id="search-input" placeholder="대화 검색..."><span id="search-count">0/0</span><button id="search-prev" title="이전">⬆</button><button id="search-next" title="다음">⬇</button><button id="search-close" title="닫기">✕</button>`;
        document.getElementById('chat-header').appendChild(searchBar);
        this.elements.container = searchBar; this.elements.input = searchBar.querySelector('#search-input'); this.elements.countSpan = searchBar.querySelector('#search-count');
        this.elements.prevBtn = searchBar.querySelector('#search-prev'); this.elements.nextBtn = searchBar.querySelector('#search-next'); this.elements.closeBtn = searchBar.querySelector('#search-close');
        this.elements.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { if (e.shiftKey) this.navigate(-1); else this.navigate(1); } else if (e.key === 'Escape') { this.toggleSearch(); } });
        this.elements.input.addEventListener('input', () => this.executeSearch(this.elements.input.value));
        this.elements.prevBtn.onclick = () => this.navigate(-1); this.elements.nextBtn.onclick = () => this.navigate(1); this.elements.closeBtn.onclick = () => this.toggleSearch();
    },
    toggleSearch: function() { const isShow = this.elements.container.classList.contains('show'); if (isShow) { this.elements.container.classList.remove('show'); this.clearHighlights(); this.elements.input.value = ''; } else { this.elements.container.classList.add('show'); this.elements.input.focus(); } },
    executeSearch: function(keyword) {
        this.clearHighlights(); if (!keyword.trim()) { this.updateCount(0, 0); return; }
        const safeKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const regex = new RegExp(`(${safeKeyword})`, 'gi');
        document.querySelectorAll('.message-text').forEach(el => { if (el.textContent.match(regex)) { this.highlightTextNode(el, regex); } });
        this.highlights = Array.from(document.querySelectorAll('.highlight-mark'));
        this.updateCount(0, this.highlights.length); if (this.highlights.length > 0) { this.navigate(1, true); }
    },
    highlightTextNode: function(element, regex) { Array.from(element.childNodes).forEach(node => { if (node.nodeType === 3 && regex.test(node.nodeValue)) { const span = document.createElement('span'); span.innerHTML = node.nodeValue.replace(regex, '<span class="highlight-mark">$1</span>'); element.replaceChild(span, node); } else if (node.nodeType === 1 && !node.classList.contains('highlight-mark')) { this.highlightTextNode(node, regex); } }); },
    clearHighlights: function() { document.querySelectorAll('.highlight-mark').forEach(mark => { const text = document.createTextNode(mark.textContent); mark.parentNode.replaceChild(text, mark); }); this.highlights = []; this.currentIndex = -1; },
    navigate: function(direction, isInit = false) {
        if (this.highlights.length === 0) return;
        if (this.currentIndex >= 0 && this.highlights[this.currentIndex]) { this.highlights[this.currentIndex].classList.remove('active'); }
        if (isInit) { this.currentIndex = this.highlights.length - 1; } else { this.currentIndex += direction; if (this.currentIndex >= this.highlights.length) this.currentIndex = 0; if (this.currentIndex < 0) this.currentIndex = this.highlights.length - 1; }
        const target = this.highlights[this.currentIndex]; target.classList.add('active'); target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        this.updateCount(this.currentIndex + 1, this.highlights.length);
    },
    updateCount: function(current, total) { this.elements.countSpan.textContent = `${current}/${total}`; }
};

/**
 * 날짜 헤더 관리자
 */
App.DateHeaderManager = {
    headerElement: null, messageList: null, lastDateText: '',
    init: function() {
        const header = document.createElement('div'); header.id = 'floating-date-header';
        document.getElementById('chat-container').appendChild(header);
        this.headerElement = header; this.messageList = document.getElementById('message-list');
        this.messageList.addEventListener('scroll', () => this.updateHeader());
    },
    updateHeader: function() {
        if (!this.messageList || !this.headerElement) return;
        const scrollTop = this.messageList.scrollTop;
        const bubbles = this.messageList.querySelectorAll('.message-bubble');
        let currentTimestamp = null;
        for (let i = 0; i < bubbles.length; i++) { if (bubbles[i].offsetTop + bubbles[i].clientHeight > scrollTop + 50) { currentTimestamp = bubbles[i].dataset.timestamp; break; } }
        if (currentTimestamp) {
            const dateText = new Date(parseInt(currentTimestamp)).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
            if (this.lastDateText !== dateText) { this.headerElement.textContent = dateText; this.lastDateText = dateText; }
            if (scrollTop > 50) this.headerElement.classList.add('show'); else this.headerElement.classList.remove('show');
        } else { this.headerElement.classList.remove('show'); }
    }
};

/**
 * 서식 툴바 관리자
 */
App.FormatManager = {
    elements: { toggleBtn: null, toolbar: null, input: null },
    init: function() {
        this.elements.toggleBtn = document.getElementById('format-toggle'); this.elements.toolbar = document.getElementById('format-toolbar'); this.elements.input = document.getElementById('message-input');
        if (!this.elements.toggleBtn || !this.elements.toolbar) return;
        this.elements.toggleBtn.addEventListener('click', (e) => { e.stopPropagation(); this.toggleToolbar(); });
        this.elements.toolbar.querySelectorAll('button').forEach(btn => { btn.addEventListener('click', (e) => { e.stopPropagation(); this.applyFormat(btn.dataset.format); }); });
        document.addEventListener('click', (e) => { if (!this.elements.toolbar.contains(e.target) && e.target !== this.elements.toggleBtn) { this.closeToolbar(); } });
    },
    toggleToolbar: function() { 
        const isShow = this.elements.toolbar.classList.contains('show'); 
        if (isShow) { 
            this.elements.toolbar.classList.remove('show'); 
            this.elements.toggleBtn.classList.remove('active'); 
        } else { 
            this.elements.toolbar.classList.add('show'); 
            this.elements.toggleBtn.classList.add('active'); 
        } 
    },
    closeToolbar: function() { this.elements.toolbar.classList.remove('show'); this.elements.toggleBtn.classList.remove('active'); },
    applyFormat: function(type) {
        const input = this.elements.input; const start = input.selectionStart; const end = input.selectionEnd; const selectedText = input.value.substring(start, end);
        let prefix = '', suffix = '';
        switch(type) {
            case 'bold': prefix = '**'; suffix = '**'; break; case 'strike': prefix = '~~'; suffix = '~~'; break; case 'code': prefix = '`'; suffix = '`'; break; case 'mention': prefix = '@'; suffix = ' '; if (!selectedText) { input.focus(); input.setRangeText(prefix, start, end, 'end'); input.dispatchEvent(new Event('input')); return; } break;
        }
        input.setRangeText(prefix + selectedText + suffix, start, end, 'select');
        if (start === end && type !== 'mention') input.setSelectionRange(start + prefix.length, start + prefix.length);
        input.focus();
    }
};

/**
 * 입력 중 상태 관리자
 */
App.TypingManager = {
    elements: {
        indicator: document.getElementById('typing-indicator'),
        textSpan: document.getElementById('typing-text')
    },
    init: function() {
        if (!this.elements.indicator) return;
        App.EventBus.on('typing:update', (data) => this.render(data));
    },
    render: function(data) {
        const now = Date.now();
        const typingUsers = Object.keys(data).filter(user => {
            return user !== FULL_USER_NAME && (now - data[user] < 3000);
        });

        if (typingUsers.length > 0) {
            let text = '';
            if (typingUsers.length === 1) text = `${App.Utils.escapeHTML(typingUsers[0])}님이 입력 중...`;
            else if (typingUsers.length <= 3) text = `${typingUsers.map(u => App.Utils.escapeHTML(u)).join(', ')}님이 입력 중...`;
            else text = `여러 명이 입력 중...`;

            this.elements.textSpan.textContent = text;
            this.elements.indicator.classList.add('show');
        } else {
            this.elements.indicator.classList.remove('show');
        }
    }
};

/**
 * 플러스 메뉴 관리자
 */
App.PlusMenuManager = {
    init: function() {
        // [중복 방지] 이미 버튼이 있으면 다시 생성하지 않음
        if (document.getElementById('plus-button')) return;

        const form = document.getElementById('message-form');
        if (!form) return;
        
        const btn = document.createElement('button');
        btn.type = 'button'; btn.id = 'plus-button'; btn.title = '더보기';
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
        form.insertBefore(btn, form.firstChild);
        
        const menu = document.createElement('div');
        menu.id = 'plus-menu';
        menu.innerHTML = `
            <div class="plus-item" id="plus-file"><div class="plus-item-icon">📁</div><span>파일</span></div>
            <div class="plus-item" id="plus-poll"><div class="plus-item-icon">📊</div><span>투표</span></div>
            <div class="plus-item" id="plus-game"><div class="plus-item-icon">🎮</div><span>게임</span></div>
            <div class="plus-item" id="plus-drawing"><div class="plus-item-icon">🎨</div><span>그림판</span></div>
        `;
        document.getElementById('input-area-wrapper').appendChild(menu);
        
        btn.onclick = (e) => { e.stopPropagation(); menu.classList.toggle('show'); btn.classList.toggle('active'); };
        menu.querySelector('#plus-file').onclick = () => { document.getElementById('file-input').click(); menu.classList.remove('show'); };
        menu.querySelector('#plus-poll').onclick = () => { if(App.PollManager) App.PollManager.openModal(); menu.classList.remove('show'); };
        menu.querySelector('#plus-game').onclick = () => { if(App.GameManager) App.GameManager.openModal(); menu.classList.remove('show'); };
        menu.querySelector('#plus-drawing').onclick = () => { if(App.DrawingManager) App.DrawingManager.openModal(); menu.classList.remove('show'); };
    }
};