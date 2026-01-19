// =================================================================================
// 2. 핵심 엔진 (EventBus & Firebase) - [세션 동기화 기능 추가]
// =================================================================================

// ★ [핵심] 현재 접속한 브라우저 세션에 고유 ID 발급
// 이름 비교 대신, 이 ID를 통해 "내가 보낸 메시지인지"를 100% 정확하게 식별합니다.
App.CLIENT_ID = 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

App.EventBus = {
    events: {},
    on(eventName, listener) {
        if (!this.events[eventName]) { this.events[eventName] = []; }
        this.events[eventName].push(listener);
    },
    emit(eventName, data) {
        if (this.events[eventName]) {
            this.events[eventName].forEach(listener => {
                try { listener(data); } catch (e) { console.error(`Error:`, e); }
            });
        }
    }
};

App.FirebaseService = {
    db: null,
    messagesRef: null,
    connectionsRef: null,
    noticeRef: null,
    typingRef: null, // [NEW] 타이핑 상태 참조
    
    init: function() {
        if (typeof firebase === 'undefined') return alert("Firebase 로드 실패");
        
        this.db = firebase.database();
        this.messagesRef = this.db.ref('messages');
        this.connectionsRef = this.db.ref('connections');
        this.noticeRef = this.db.ref('notice');
        this.typingRef = this.db.ref('typing'); // [NEW] 타이핑 경로 참조
        
        // 접속 관리
        this.db.ref('.info/connected').on('value', (s) => {
            if (s.val()) {
                const con = this.connectionsRef.push();
                con.onDisconnect().remove();
                con.set(FULL_USER_NAME);
            }
        });
        
        // 메시지 수신 감지 (최근 100개)
        this.messagesRef.limitToLast(100).on('child_added', (s) => { 
            const m = s.val(); 
            if(m) { 
                m.key = s.key; 
                App.EventBus.emit('messageReceived', m); 
            } 
        });
        
        // 메시지 변경 감지
        this.messagesRef.on('child_changed', (s) => { 
            const m = s.val(); 
            if(m) { 
                m.key = s.key; 
                App.EventBus.emit('messageUpdated', m); 
            } 
        });
        
        // 접속자 목록 감지
        this.connectionsRef.on('value', (s) => App.EventBus.emit('userListUpdated', s.val()));

        // 공지사항 변경 감지
        this.noticeRef.on('value', (snapshot) => {
            const noticeData = snapshot.val();
            App.EventBus.emit('notice:updated', noticeData);
        });

        // [NEW] 타이핑 상태 감지 리스너
        this.typingRef.on('value', (snapshot) => {
            const data = snapshot.val() || {};
            App.EventBus.emit('typing:update', data);
        });

        // [NEW] 내 타이핑 상태 전송 핸들러
        App.EventBus.on('typing:send', (isTyping) => {
            if (isTyping) {
                // 내 이름을 typing 경로에 업데이트 (값: 현재시간)
                // 연결이 끊기면(탭 닫기 등) 자동으로 제거되도록 onDisconnect().remove() 설정
                const myTypingRef = this.typingRef.child(FULL_USER_NAME);
                myTypingRef.set(firebase.database.ServerValue.TIMESTAMP);
                myTypingRef.onDisconnect().remove();
            } else {
                // 입력 멈춤 시 즉시 제거
                this.typingRef.child(FULL_USER_NAME).remove();
            }
        });

        App.EventBus.on('sendMessage', (data, tempId) => this.send(data, tempId));
        
        App.EventBus.on('loadMoreMessages', (lastTimestamp) => {
            this.messagesRef.orderByChild('timestamp').endAt(lastTimestamp - 1).limitToLast(50).once('value').then(snapshot => {
                const messages = [];
                snapshot.forEach(child => {
                    const m = child.val();
                    m.key = child.key;
                    messages.push(m);
                });
                App.EventBus.emit('historyReceived', messages);
            });
        });

        // 공감(Reaction) - [수정됨: emoji 경로 추가]
        App.EventBus.on('reaction:add', ({ messageKey, emoji }) => {
            // 기존에 빠졌던 .child(emoji)를 추가했습니다.
            const ref = this.messagesRef.child(messageKey).child('reactions').child(emoji).child(FULL_USER_NAME);
            ref.once('value', s => { if(s.exists()) ref.remove(); else ref.set(true); });
        });
        
        // 메시지 수정
        App.EventBus.on('message:edit', ({ messageKey, newText }) => 
            this.messagesRef.child(messageKey).update({ text: newText, edited: firebase.database.ServerValue.TIMESTAMP })
        );
        
        // 메시지 삭제
        App.EventBus.on('message:delete', ({ messageKey }) => 
            this.messagesRef.child(messageKey).update({ type: 'deleted', text: '(삭제됨)', fileUrl:null, imageUrl:null, poll: null })
        );

        // 공지 등록
        App.EventBus.on('notice:register', (data) => {
            this.noticeRef.set({
                text: data.text,
                sender: FULL_USER_NAME,
                messageKey: data.key,
                type: data.type || 'text',
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
        });
        
        // 공지 삭제
        App.EventBus.on('notice:remove', () => { this.noticeRef.remove(); });

        // 투표 참여
        App.EventBus.on('poll:vote', (data) => this.handleVote(data));
    },

    send: function(data, tempId) {
        // ★ [핵심] 메시지 전송 시 clientId(내 표식)를 함께 보냄
        const payload = { 
            ...data, 
            senderName: FULL_USER_NAME, 
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            clientId: App.CLIENT_ID // 이것이 "내가 보냈다"는 증명입니다.
        };

        this.messagesRef.push(payload).then((ref) => {
            if (tempId) {
                App.EventBus.emit('message:sent', { 
                    tempId, 
                    messageKey: ref.key, 
                    finalMessageData: { ...data, key: ref.key, senderName: FULL_USER_NAME, timestamp: Date.now() } 
                });
            }
        }).catch(() => { 
            alert('전송 실패'); 
            if(tempId) App.EventBus.emit('message:removeTemp', tempId); 
        });
    },

    handleVote: async function({ messageKey, optionIndex, allowMultiple }) {
        const pollRef = this.messagesRef.child(messageKey).child('poll');
        const snapshot = await pollRef.once('value');
        const pollData = snapshot.val();

        if (!pollData || !pollData.options) return;
        if (pollData.closed) return;

        const options = pollData.options;
        const updates = {};
        const targetOptionVotes = options[optionIndex].votes || {};
        const isAlreadyVoted = !!targetOptionVotes[FULL_USER_NAME];

        if (allowMultiple) {
            if (isAlreadyVoted) {
                updates[`options/${optionIndex}/votes/${FULL_USER_NAME}`] = null;
            } else {
                updates[`options/${optionIndex}/votes/${FULL_USER_NAME}`] = true;
            }
        } else {
            if (isAlreadyVoted) {
                updates[`options/${optionIndex}/votes/${FULL_USER_NAME}`] = null;
            } else {
                options.forEach((opt, idx) => {
                    if (opt.votes && opt.votes[FULL_USER_NAME]) {
                        updates[`options/${idx}/votes/${FULL_USER_NAME}`] = null;
                    }
                });
                updates[`options/${optionIndex}/votes/${FULL_USER_NAME}`] = true;
            }
        }
        pollRef.update(updates);
    }
};