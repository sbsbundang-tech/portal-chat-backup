// =================================================================================
// 5. 메인 실행 (Bootstrap)
// =================================================================================

App.AutoCleaner = {
    init: function() {
        firebase.database().ref('maintenance/last_cleanup').once('value').then(snapshot => {
            const lastCleaned = snapshot.val() || 0;
            const now = Date.now();
            const oneDay = 24 * 60 * 60 * 1000;
            if (now - lastCleaned > oneDay) {
                console.log("🧹 자동 청소 시작");
                this.runCleanup(now);
            }
        }).catch(e => console.error("청소 체크 실패:", e));
    },
    runCleanup: function(now) {
        const daysToKeep = 60; 
        const cutoffTime = now - (daysToKeep * 24 * 60 * 60 * 1000);
        const messagesRef = firebase.database().ref('messages');
        messagesRef.orderByChild('timestamp').endAt(cutoffTime).limitToLast(500).once('value')
        .then(snapshot => {
            if (!snapshot.exists()) {
                this.updateLastCleaned(now);
                return;
            }
            const updates = {};
            snapshot.forEach(child => { updates[child.key] = null; });
            messagesRef.update(updates).then(() => this.updateLastCleaned(now));
        }).catch(e => console.error("청소 실패:", e));
    },
    updateLastCleaned: function(timestamp) {
        firebase.database().ref('maintenance/last_cleanup').set(timestamp);
    }
};

// 재시도 횟수 제한 (Max 50회)
let retryCount = 0;

function startChatApp() {
    console.log("🚀 채팅 앱 시작 (모듈화 완료)");
    
    // 안전 장치: App 객체가 로드되지 않았으면 중단
    if (!window.App || !App.SettingsManager) {
        retryCount++;
        if (retryCount > 50) {
            console.error("❌ 중요 모듈 로드 실패. 새로고침 해주세요.");
            return; // 무한루프 방지
        }
        console.warn(`모듈 로드 대기 중... (${retryCount}/50)`);
        setTimeout(startChatApp, 100);
        return;
    }

    App.SettingsManager.init();
    App.AutoCleaner.init();
    App.MessageRenderer.init();
    App.InputHandler.init();
    App.PopoverManager.init();
    
    if(App.ContextMenuManager) App.ContextMenuManager.init();

    if(App.DateHeaderManager) App.DateHeaderManager.init();

    // ★ [수정됨] 공지사항 관리자 시작 (이 부분이 빠져 있었습니다)
    if(App.NoticeManager) App.NoticeManager.init();

    if(App.FormatManager) App.FormatManager.init();
    
    // [NEW] 입력 중 관리자 초기화
    if(App.TypingManager) App.TypingManager.init();
    
    App.ChatFile.init();
    App.FirebaseService.init();
    
    window.addEventListener('focus', () => {
        if(App.EventBus) App.EventBus.emit('window:focus');
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startChatApp);
} else {
    startChatApp();
}