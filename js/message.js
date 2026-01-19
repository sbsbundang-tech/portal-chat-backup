// =================================================================================
// 4. 메시지 처리 모듈 (Message Processing)
// 포함 기능: 메시지 렌더링, 투표 렌더링(이미지/종료), 입력 핸들링, 파일 처리
// =================================================================================

/**
 * 4-1. 메시지 렌더러 (Message Renderer)
 */
App.MessageRenderer = {
    elements: {
        messageList: document.getElementById('message-list'),
        newMessageAlert: document.getElementById('new-message-alert'),
        lightboxModal: document.getElementById('lightbox-modal'),
        lightboxContent: document.getElementById('lightbox-content'),
        lightboxClose: document.getElementById('lightbox-close'),
        lightboxDownload: document.getElementById('lightbox-download'),
    },
    isScrolledUp: false, editingMessageKey: null, tempMessageMap: new Map(), 
    isLoadingHistory: false, oldestMessageTimestamp: null,
    
    // [NEW] 줌/팬 기능을 위한 상태 변수
    zoomState: { scale: 1, panning: false, pointX: 0, pointY: 0, startX: 0, startY: 0 },

    init: function() {
        this.elements.messageList?.addEventListener('scroll', this.handleScroll.bind(this));
        this.elements.newMessageAlert?.addEventListener('click', this.scrollToBottom.bind(this));
        
        // [수정] 라이트박스 닫기 이벤트
        this.elements.lightboxClose?.addEventListener('click', this.hideLightbox.bind(this));
        this.elements.lightboxModal?.addEventListener('click', (e) => { 
            if (e.target === this.elements.lightboxModal) this.hideLightbox(); 
        });

        // [NEW] 이미지 휠 줌 & 드래그 이벤트 연결
        const img = this.elements.lightboxContent;
        if (img) {
            img.addEventListener('wheel', this.handleZoomWheel.bind(this));
            img.addEventListener('mousedown', this.handleZoomStart.bind(this));
            document.addEventListener('mousemove', this.handleZoomMove.bind(this));
            document.addEventListener('mouseup', this.handleZoomEnd.bind(this));
        }
        
        this.createLoadingSpinner();

        if(App.NotificationManager) App.NotificationManager.init();
        if(App.SearchManager) App.SearchManager.init();
        if(App.PollManager) App.PollManager.init(); 

        App.EventBus.on('messageReceived', (m) => this.handleIncomingMessage(m)); 
        App.EventBus.on('messageUpdated', (m) => this.updateExistingMessage(m)); 
        App.EventBus.on('message:addTemp', (m) => this.displayTempMessage(m)); 
        App.EventBus.on('message:removeTemp', (id) => this.removeTempMessage(id)); 
        App.EventBus.on('message:sent', (d) => this.finalizeTempMessage(d.tempId, d.messageKey, d.finalMessageData)); 
        
        App.EventBus.on('edit:start', (key) => this.editingMessageKey = key); 
        App.EventBus.on('edit:cancel', () => this.editingMessageKey = null);
        App.EventBus.on('edit:save', () => this.editingMessageKey = null);
        App.EventBus.on('edit:trigger', ({ key, text }) => this.handleTriggeredEdit(key, text));

        App.EventBus.on('lightbox:show', (url) => this.showLightbox(url));
        App.EventBus.on('historyReceived', (messages) => this.prependHistoryBatch(messages));

        App.EventBus.on('poll:end', (key) => {
            if(key && typeof firebase !== 'undefined') {
                firebase.database().ref(`messages/${key}/poll`).update({ closed: true });
            }
        });
    },

    // [NEW] 이미지 줌/이동 핸들러 구현
    handleZoomWheel: function(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        let newScale = this.zoomState.scale + delta;
        newScale = Math.min(Math.max(1, newScale), 5); // 1배 ~ 5배 제한
        this.zoomState.scale = newScale;
        
        if(newScale === 1) { 
            this.zoomState.pointX = 0; 
            this.zoomState.pointY = 0; 
        }
        this.updateTransform();
    },
    handleZoomStart: function(e) {
        if(this.zoomState.scale > 1) {
            e.preventDefault();
            this.zoomState.panning = true;
            this.zoomState.startX = e.clientX - this.zoomState.pointX;
            this.zoomState.startY = e.clientY - this.zoomState.pointY;
            this.elements.lightboxContent.style.cursor = 'grabbing';
        }
    },
    handleZoomMove: function(e) {
        if(!this.zoomState.panning) return;
        e.preventDefault();
        this.zoomState.pointX = e.clientX - this.zoomState.startX;
        this.zoomState.pointY = e.clientY - this.zoomState.startY;
        this.updateTransform();
    },
    handleZoomEnd: function() {
        this.zoomState.panning = false;
        if (this.elements.lightboxContent) {
            this.elements.lightboxContent.style.cursor = this.zoomState.scale > 1 ? 'grab' : 'default';
        }
    },
    updateTransform: function() {
        if (this.elements.lightboxContent) {
            this.elements.lightboxContent.style.transform = `translate(${this.zoomState.pointX}px, ${this.zoomState.pointY}px) scale(${this.zoomState.scale})`;
        }
    },
    
    createLoadingSpinner: function() {
        const div = document.createElement('div'); div.id = 'history-loader';
        div.style.cssText = 'text-align:center; padding:10px; display:none; color:#888; font-size:0.8rem;';
        div.innerHTML = '<span>⌛ 지난 대화 불러오는 중...</span>';
        this.elements.messageList.prepend(div);
    },

    scrollToMessage: function(key) {
        const targetBubble = document.querySelector(`[data-key="${key}"]`);
        if (targetBubble) {
            targetBubble.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetBubble.classList.add('highlight-flash');
            setTimeout(() => targetBubble.classList.remove('highlight-flash'), 1500);
        } else { alert("원본 메시지를 찾을 수 없습니다."); }
    },

    createMessageContent: function(message) {
        const { type = 'text', text = '', fileUrl, imageUrl, fileName, fileSize, replyTo, status, poll } = message;
        let replyHtml = '';
        
        if (replyTo && replyTo.text && type !== 'deleted') {
            replyHtml = `<div class="reply-quote" title="클릭하여 원문 보기" onclick="App.MessageRenderer.scrollToMessage('${replyTo.key}')"><strong>${App.Utils.escapeHTML(replyTo.sender)}</strong><br>${App.Utils.escapeHTML(replyTo.text.replace(/\n/g, ' '))}</div>`;
        }
        
        let contentHtml = '';
        if (type === 'deleted') { 
            contentHtml = `<div class="message-text">${App.Utils.escapeHTML(text) || '(삭제된 메시지입니다)'}</div>`; 
        } else if (type === 'poll' && poll) {
            contentHtml = this.createPollContent(message.key, poll);
        } else if (type === 'text') { 
            const isJumbo = App.Utils.isOnlyEmoji(text);
            const processedText = App.Utils.formatMessageWithLinks(App.Utils.escapeHTML(text || ''));
            contentHtml = `<div class="message-text ${isJumbo?'jumbo-text':''}">${processedText}</div>`; 
        } else if (type === 'image' && (imageUrl || fileUrl)) {
            const url = imageUrl || fileUrl;
            const spinner = status === 'uploading' ? `<div class="upload-spinner" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:32px;height:32px;border:4px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 1s linear infinite;"></div>` : '';
            contentHtml = `<div class="image-content-wrapper ${status==='uploading'?'uploading':''}"><img src="${App.Utils.escapeHTML(url, 'attr')}" alt="이미지" class="msg-image" onclick="event.stopPropagation();App.EventBus.emit('lightbox:show','${App.Utils.escapeHTML(url, 'attr')}')" loading="lazy">${spinner}</div>`;
        } else if (type === 'video' && fileUrl) {
            contentHtml = `<div class="video-content-wrapper ${status==='uploading'?'uploading':''}" style="position:relative; max-width:100%;"><video src="${App.Utils.escapeHTML(fileUrl, 'attr')}" controls class="msg-video" style="max-width:100%; border-radius:12px; max-height:300px;"></video></div>`;
        } else if (type === 'file' && fileUrl) {
            contentHtml = `<a href="${App.Utils.escapeHTML(fileUrl, 'attr')}" target="_blank" class="msg-file"><span class="msg-file-icon">📁</span><span class="msg-file-info"><span class="msg-file-name">${App.Utils.escapeHTML(fileName||'file')}</span><small>${fileSize ? `(${(fileSize/1024/1024).toFixed(2)} MB)` : ''}</small></span></a>`;
        }
        return replyHtml + contentHtml;
    },

    createPollContent: function(messageKey, pollData) {
        if (!pollData || !pollData.options) return '<div class="message-text">투표 데이터 오류</div>';
        
        const totalVotes = pollData.options.reduce((sum, opt) => sum + (opt.votes ? Object.keys(opt.votes).length : 0), 0);
        const isClosed = pollData.closed === true;
        const isOwner = pollData.createdBy === FULL_USER_NAME;

        let optionsHtml = pollData.options.map((opt, index) => {
            const votes = opt.votes ? Object.keys(opt.votes).length : 0;
            const isVotedByMe = opt.votes && opt.votes[FULL_USER_NAME];
            const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
            
            const clickAction = isClosed 
                ? `onclick="alert('종료된 투표입니다.')"` 
                : `onclick="App.EventBus.emit('poll:vote', { messageKey: '${messageKey}', optionIndex: ${index}, allowMultiple: ${pollData.allowMultiple} })"`;
            
            const imgHtml = opt.imageUrl 
                ? `<div class="poll-option-image" onclick="event.stopPropagation();App.EventBus.emit('lightbox:show','${opt.imageUrl}')"><img src="${opt.imageUrl}" style="width:100%;height:100%;object-fit:cover;"></div>` 
                : '';

            // [NEW] 투표자 명단 표시 로직 추가
            const voterList = opt.votes ? Object.keys(opt.votes) : [];
            const voterHtml = voterList.length > 0 
                ? `<div style="font-size: 0.75rem; color: #aaa; padding: 2px 0 8px 14px; word-break: break-all;">
                     ↳ ${voterList.map(name => App.Utils.escapeHTML(name)).join(', ')}
                   </div>` 
                : '';

            return `
                <div class="poll-option-item ${isVotedByMe ? 'voted' : ''}" ${clickAction}>
                    <div class="poll-progress-bar" style="width: ${percentage}%"></div>
                    <div class="poll-option-content">
                        ${imgHtml}
                        <span class="poll-option-text">
                            <span class="poll-check-mark">✔</span>${App.Utils.escapeHTML(opt.text)}
                        </span>
                        <span class="poll-option-count">${votes}표 (${percentage}%)</span>
                    </div>
                </div>
                ${voterHtml} `;
        }).join('');

        const endBtn = (!isClosed && isOwner) 
            ? `<button class="poll-end-btn" onclick="if(confirm('투표를 종료하시겠습니까?')){App.EventBus.emit('poll:end','${messageKey}')}">종료</button>` 
            : (isClosed ? '<span style="font-weight:bold; color:#fa5252;">종료됨</span>' : '');

        return `
            <div class="poll-card ${isClosed ? 'closed' : ''}">
                <div class="poll-question">📊 ${App.Utils.escapeHTML(pollData.title)}</div>
                <div class="poll-options">${optionsHtml}</div>
                <div class="poll-footer">
                    <span>${pollData.allowMultiple ? '복수 선택' : '단일 선택'} • ${totalVotes}명 참여</span>
                    ${endBtn}
                </div>
            </div>
        `;
    },

    createReactionHtml: function(reactions, type, messageKey) {
        if (!reactions || type === 'deleted') return '';
        const counts = {};
        for (const e in reactions) { if (Object.keys(reactions[e]).length > 0) counts[e] = Object.keys(reactions[e]).length; }
        const sorted = Object.keys(counts).sort();
        if (sorted.length === 0) return '';
        return `<div class="message-reactions">${sorted.map(e => `<span class="reaction-tag" onclick="event.stopPropagation();App.EventBus.emit('reaction:add',{messageKey:'${messageKey}',emoji:'${e}'})">${e} <small>${counts[e]}</small></span>`).join('')}</div>`;
    },

    createBubbleElement: function(message) {
        const { senderName, timestamp, type, mentions, text } = message;
        const bubble = document.createElement('div');
        const isMyMsg = String(senderName).replace(/"/g,'') === FULL_USER_NAME;
        
        bubble.dataset.sender = String(senderName).replace(/"/g,'');
        bubble.dataset.timestamp = timestamp;
        
        const isJumbo = type === 'text' && App.Utils.isOnlyEmoji(text);
        bubble.className = `message-bubble ${isJumbo?'jumbo-bubble':''} ${type==='deleted'?'deleted-message':''} ${isMyMsg?'my-message':'other-message'}`;
        if (mentions && mentions.includes(FULL_USER_NAME)) bubble.classList.add('mentioned-message');
        bubble.setAttribute('data-key', message.key);
        
        this.updateBubbleContent(bubble, message);
        return bubble;
    },

    handleIncomingMessage: function(message) {
        if (!message || !message.key) return;
        if (!this.oldestMessageTimestamp || message.timestamp < this.oldestMessageTimestamp) this.oldestMessageTimestamp = message.timestamp;

        const existing = document.querySelector(`[data-key="${message.key}"]`);
        const isMyMsg = String(message.senderName).replace(/"/g,'') === FULL_USER_NAME;
        
        if (isMyMsg && (['image','file','video'].includes(message.type)) && !existing) {
            if (this.tempMessageMap.size > 0) {
                const oldestTempId = this.tempMessageMap.keys().next().value;
                this.finalizeTempMessage(oldestTempId, message.key, message);
                return; 
            }
        }

        if (!existing) {
            const finalized = this.elements.messageList.querySelector(`[data-key="${message.key}"][data-temp-finalized="true"]`);
            if (!finalized) this.displayNewMessageBubble(message); 
            else finalized.removeAttribute('data-temp-finalized');
        } else {
            this.updateExistingMessage(message);
        }
    },

    displayNewMessageBubble: function(message) {
        if (!message.senderName) return;
        this.checkAndInsertDateSeparator(message.timestamp, false); 
        if (this.editingMessageKey === message.key) this.editingMessageKey = null;
        
        const lastBubble = this.elements.messageList.lastElementChild;
        let isSameSender = false; let isSameMinute = false;

        if (lastBubble && lastBubble.classList.contains('message-bubble')) {
            const lastSender = lastBubble.dataset.sender;
            const lastTime = parseInt(lastBubble.dataset.timestamp, 10);
            if (lastSender === String(message.senderName).replace(/"/g,'')) {
                isSameSender = true;
                const d1 = new Date(lastTime); const d2 = new Date(message.timestamp);
                if (d1.getMinutes() === d2.getMinutes() && d1.getHours() === d2.getHours()) isSameMinute = true;
            }
        }

        const bubble = this.createBubbleElement(message);
        if (isSameSender) {
            bubble.classList.add('same-sender');
            if (isSameMinute) lastBubble.classList.add('hide-time');
        }
        this.elements.messageList.appendChild(bubble);
        this.handleScrollOnNewMessage(String(message.senderName).replace(/"/g,'')===FULL_USER_NAME);
    },

    prependHistoryBatch: function(messages) {
        const loader = document.getElementById('history-loader');
        if (loader) loader.style.display = 'none';
        this.isLoadingHistory = false;
        if (!messages || messages.length === 0) return;

        const oldScrollHeight = this.elements.messageList.scrollHeight;
        const oldScrollTop = this.elements.messageList.scrollTop;
        messages.sort((a, b) => a.timestamp - b.timestamp);
        if (messages.length > 0) this.oldestMessageTimestamp = messages[0].timestamp;

        const fragment = document.createDocumentFragment();
        let lastDateStr = null;
        const currentTopDateDiv = this.elements.messageList.querySelector('.date-separator');
        let currentTopDate = currentTopDateDiv ? currentTopDateDiv.textContent : null;

        messages.forEach((msg, index) => {
            const msgDate = new Date(msg.timestamp).toLocaleDateString('ko-KR');
            if (msgDate !== lastDateStr) {
                const dateDiv = document.createElement('div'); dateDiv.className = 'date-separator';
                dateDiv.textContent = new Date(msg.timestamp).toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'long'});
                fragment.appendChild(dateDiv); lastDateStr = msgDate;
            }
            const bubble = this.createBubbleElement(msg);
            if (index > 0) {
                const prev = messages[index-1];
                if (prev.senderName === msg.senderName) {
                    const d1 = new Date(prev.timestamp); const d2 = new Date(msg.timestamp);
                    if (d1.getMinutes() === d2.getMinutes() && d1.getHours() === d2.getHours()) {
                        bubble.classList.add('same-sender');
                        const lastEl = fragment.lastElementChild;
                        if (lastEl.classList.contains('message-bubble')) lastEl.classList.add('hide-time');
                    }
                }
            }
            fragment.appendChild(bubble);
        });

        if (lastDateStr && currentTopDate) {
            const lastMsgDateFull = new Date(messages[messages.length-1].timestamp).toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'long'});
            if (lastMsgDateFull === currentTopDate) if (currentTopDateDiv) currentTopDateDiv.remove();
        }

        if (loader) loader.after(fragment); else this.elements.messageList.prepend(fragment);
        this.elements.messageList.scrollTop = this.elements.messageList.scrollHeight - oldScrollHeight + oldScrollTop;
        
        // [추가] 로드된 메시지 중 링크가 있다면 프리뷰 가져오기
        messages.forEach(msg => {
            const bubble = document.querySelector(`.message-bubble[data-key="${msg.key}"]`);
            if(bubble) this.enrichLinkPreviews(bubble);
        });
    },

    updateExistingMessage: function(message) {
        const bubble = document.querySelector(`[data-key="${message.key}"]`);
        if (bubble) {
            if (this.editingMessageKey === message.key) this.editingMessageKey = null;
            this.updateBubbleContent(bubble, message);
            bubble.classList.toggle('deleted-message', message.type === 'deleted');
            bubble.classList.toggle('mentioned-message', (message.mentions||[]).includes(FULL_USER_NAME));
        }
    },
    updateBubbleContent: function(bubble, message) {
        const { senderName, timestamp, reactions, edited, type } = message;
        const isMyMsg = String(senderName).replace(/"/g,'') === FULL_USER_NAME;
        const senderHtml = isMyMsg ? '' : `<div class="message-sender" style="color:${App.Utils.getUserColor(senderName)}">${App.Utils.escapeHTML(senderName)}</div>`;
        const editedHtml = (edited && type!=='deleted' && !App.Utils.isOnlyEmoji(message.text)) ? '<span class="edited-marker">(수정됨)</span>' : '';
        bubble.innerHTML = `${senderHtml}${this.createMessageContent(message)}${this.createReactionHtml(reactions, type, message.key)}<div class="message-timestamp">${this.formatTimestamp(timestamp)}${editedHtml}</div>`;
        
        // [NEW] 링크 프리뷰 데이터 가져오기 실행
        this.enrichLinkPreviews(bubble);
    },
    
    // [NEW] 링크 리치 프리뷰 생성 (Microlink API 사용)
    enrichLinkPreviews: function(bubble) {
        const links = bubble.querySelectorAll('.link-card-preview');
        links.forEach(link => {
            if(link.dataset.enriched) return; 
            link.dataset.enriched = 'true';
            const url = link.href;

            // Microlink 무료 API 사용하여 메타데이터 Fetch
            fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`)
                .then(res => res.json())
                .then(data => {
                    if(data.status === 'success' && data.data) {
                        const { title, description, image, logo } = data.data;
                        // 타이틀이 없으면 기본 유지
                        if(!title) return; 

                        const imgHtml = image ? `<img src="${image.url}" class="rich-preview-image">` : '';
                        const descHtml = description ? `<div class="rich-preview-desc">${App.Utils.escapeHTML(description)}</div>` : '';
                        const iconHtml = logo ? `<img src="${logo.url}" class="rich-preview-favicon">` : '<span class="link-icon">🔗</span>';

                        link.classList.add('rich-card');
                        link.innerHTML = `
                            ${imgHtml}
                            <div class="rich-preview-content">
                                <div class="rich-preview-title">${App.Utils.escapeHTML(title)}</div>
                                ${descHtml}
                                <div class="rich-preview-meta">
                                    ${iconHtml}
                                    <span>${new URL(url).hostname}</span>
                                </div>
                            </div>
                        `;
                    }
                })
                .catch(err => {
                    // 에러 발생 시 조용히 실패 (기본 카드 유지)
                    console.log('Link preview failed:', err);
                });
        });
    },
    
    displayTempMessage: function(temp) {
        if (this.tempMessageMap.has(temp.tempId)) return;
        this.checkAndInsertDateSeparator(Date.now(), false);
        const bubble = document.createElement('div');
        bubble.className = `message-bubble my-message ${temp.status==='uploading'?'uploading-message':''}`;
        bubble.setAttribute('data-temp-id', temp.tempId);
        this.updateBubbleContent(bubble, { ...temp, senderName: FULL_USER_NAME, timestamp: Date.now() });
        this.elements.messageList.appendChild(bubble);
        this.tempMessageMap.set(temp.tempId, bubble);
        this.handleScrollOnNewMessage(true);
    },
    removeTempMessage: function(id) { const b = this.tempMessageMap.get(id); if(b) { b.remove(); this.tempMessageMap.delete(id); } },
    finalizeTempMessage: function(id, key, data) {
        const b = this.tempMessageMap.get(id);
        if(b) {
            this.updateBubbleContent(b, { ...data, status: undefined });
            b.removeAttribute('data-temp-id'); b.setAttribute('data-key', key); 
            b.classList.remove('uploading-message'); b.setAttribute('data-temp-finalized', 'true');
            this.tempMessageMap.delete(id);
        }
    },
    
    handleTriggeredEdit: function(key, text) {
        const bubble = document.querySelector(`.message-bubble[data-key="${key}"]`);
        if(!bubble || this.editingMessageKey) return;
        App.EventBus.emit('edit:start', key); 
        const origin = bubble.innerHTML; bubble.innerHTML = '';
        const area = document.createElement('textarea'); area.className='editing-textarea'; area.value = App.Utils.unescapeHTML(text);
        area.onkeydown = ev => { if(ev.key==='Enter' && !ev.shiftKey) { ev.preventDefault(); this.saveEdit(key, bubble, area.value); } else if(ev.key==='Escape') { this.cancelEdit(bubble, origin); } };
        const btns = document.createElement('div'); btns.className='edit-buttons';
        const saveBtn = document.createElement('button'); saveBtn.className='edit-save'; saveBtn.textContent='저장'; saveBtn.onclick=(ev)=>{ev.stopPropagation();this.saveEdit(key,bubble,area.value)};
        const cancelBtn = document.createElement('button'); cancelBtn.className='edit-cancel'; cancelBtn.textContent='취소'; cancelBtn.onclick=(ev)=>{ev.stopPropagation();this.cancelEdit(bubble,origin)};
        btns.appendChild(saveBtn); btns.appendChild(cancelBtn); bubble.appendChild(area); bubble.appendChild(btns); area.focus();
    },
    saveEdit: function(key, bubble, text) { if(!text.trim()) return alert('내용 입력 필요'); App.EventBus.emit('edit:save', key); App.EventBus.emit('message:edit', { messageKey: key, newText: text.trim() }); bubble.innerHTML = '<div style="text-align:center">수정 중...</div>'; },
    cancelEdit: function(bubble, origin) { 
        App.EventBus.emit('edit:cancel'); bubble.innerHTML = origin;
        bubble.style.display = 'none'; bubble.offsetHeight; bubble.style.display = 'flex';
    },
    handleDelete: function(key) { if(confirm('삭제하시겠습니까?')) App.EventBus.emit('message:delete', { messageKey: key }); },
    
    handleScroll: function() { 
        const st = this.elements.messageList.scrollTop;
        if (st === 0 && !this.isLoadingHistory && this.oldestMessageTimestamp) {
            this.isLoadingHistory = true;
            const loader = document.getElementById('history-loader'); if (loader) loader.style.display = 'block';
            setTimeout(() => { App.EventBus.emit('loadMoreMessages', this.oldestMessageTimestamp); }, 500);
        }
        this.isScrolledUp = (this.elements.messageList.scrollHeight - st - this.elements.messageList.clientHeight) > 100; 
        if(!this.isScrolledUp) this.elements.newMessageAlert.style.display='none'; 
    },
    handleScrollOnNewMessage: function(force) { if(force || !this.isScrolledUp) this.scrollToBottom(); else this.elements.newMessageAlert.style.display='flex'; },
    scrollToBottom: function() { this.elements.messageList.scrollTop = this.elements.messageList.scrollHeight; this.elements.newMessageAlert.style.display='none'; this.isScrolledUp=false; },
    checkAndInsertDateSeparator: function(ts, atTop) { 
        const d = new Date(ts).toLocaleDateString('ko-KR'); 
        if (atTop) return; 
        if(d !== this.lastMessageDate) { 
            this.lastMessageDate=d; 
            const div=document.createElement('div'); div.className='date-separator'; div.textContent=new Date(ts).toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'long'}); 
            this.elements.messageList.appendChild(div); 
        } 
    },
    formatTimestamp: function(ts) { return new Date(ts).toLocaleTimeString('ko-KR',{hour:'numeric',minute:'2-digit',hour12:true}); },
    
    // [수정] 라이트박스 열기 및 다운로드 로직 개선
    showLightbox: function(url) { 
        // 줌 상태 초기화
        this.zoomState = { scale: 1, panning: false, pointX: 0, pointY: 0, startX: 0, startY: 0 };
        this.updateTransform();

        this.elements.lightboxContent.src = url; 
        
        // 다운로드 버튼 로직: CORS 우회 및 강제 다운로드 (fetch 사용)
        if(this.elements.lightboxDownload) {
            // 이벤트 리스너 중복 방지를 위해 버튼 재생성
            const newBtn = this.elements.lightboxDownload.cloneNode(true);
            this.elements.lightboxDownload.parentNode.replaceChild(newBtn, this.elements.lightboxDownload);
            this.elements.lightboxDownload = newBtn;

            this.elements.lightboxDownload.onclick = async (e) => {
                e.preventDefault();
                try {
                    const response = await fetch(url);
                    const blob = await response.blob();
                    const blobUrl = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = `download_${Date.now()}.jpg`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(blobUrl);
                } catch (err) {
                    console.error("Download failed:", err);
                    // 실패 시 새 탭으로 열기 (fallback)
                    window.open(url, '_blank');
                }
            };
        }
        
        this.elements.lightboxModal.style.display = 'flex'; 
    },
    
    // [수정] 라이트박스 닫기 시 줌 상태 초기화
    hideLightbox: function() { 
        this.elements.lightboxModal.style.display='none'; 
        this.elements.lightboxContent.src=''; 
        this.zoomState = { scale: 1, panning: false, pointX: 0, pointY: 0, startX: 0, startY: 0 };
        this.updateTransform();
    }
};

/**
 * 4-2. 입력 핸들러 (Input Handler)
 */
App.InputHandler = {
    elements: {
        messageForm: document.getElementById('message-form'), messageInput: document.getElementById('message-input'),
        replyPreview: document.getElementById('reply-preview'), replyPreviewText: document.getElementById('reply-preview-text'),
        cancelReplyButton: document.getElementById('cancel-reply-button'), mentionPopup: document.getElementById('mention-popup'),
    },
    currentReply: null, mentionPopupIndex: -1, currentUserList: [],
    lastTypingTime: 0, // [NEW] 쓰로틀링용 변수

    init: function() {
        this.injectPreviewModal();
        this.elements.messageForm?.addEventListener('submit', this.handleSubmit.bind(this));
        this.elements.messageInput?.addEventListener('keydown', this.handleInputKeydown.bind(this));
        this.elements.messageInput?.addEventListener('input', (e) => { 
            this.handleMentionInput(e); 
            this.autoResizeInput(); 
            this.handleTyping(); // [NEW] 타이핑 감지 호출
        });
        this.elements.messageInput?.addEventListener('paste', this.handlePaste.bind(this));
        this.elements.cancelReplyButton?.addEventListener('click', this.cancelReply.bind(this));
        App.EventBus.on('input:reply', (d) => this.handleReply(d));
        App.EventBus.on('userListUpdated', (c) => { this.currentUserList = Object.values(c||{}).map(n=>String(n||'').replace(/"/g,'')).filter(n=>n); });
        App.EventBus.on('input:selectMention', (i) => this.selectMentionFromPopup(i));
        App.EventBus.on('input:hideMentionPopup', () => this.hideMentionPopup());
        App.EventBus.on('input:insertEmoji', (e) => this.insertEmoji(e));
        App.EventBus.on('ui:showFilePreview', (file) => this.openPreviewModal(file));
    },
    
    // [NEW] 타이핑 핸들러
    handleTyping: function() {
        const text = this.elements.messageInput.value;
        
        // 1. 텍스트가 비어있으면 즉시 '입력 중 아님' 전송
        if (!text) {
            App.EventBus.emit('typing:send', false);
            this.lastTypingTime = 0; // 쓰로틀링 리셋
            return;
        }

        const now = Date.now();
        // 2. 텍스트가 있으면 0.5초마다 '입력 중' 전송
        if (now - this.lastTypingTime > 500) {
            this.lastTypingTime = now;
            App.EventBus.emit('typing:send', true);
        }
    },

    injectPreviewModal: function() {
        const div = document.createElement('div'); div.id = 'paste-preview-modal';
        div.innerHTML = `<div class="modal-content"><h3 id="preview-title">파일 전송 확인</h3><div class="preview-area"><img id="paste-preview-image" src="" style="display:none"><div id="paste-preview-file" style="display:none; text-align:center; padding:20px;"><div style="font-size:3rem">📄</div><div id="paste-file-name" style="margin-top:10px; font-weight:bold; word-break:break-all;"></div><div id="paste-file-size" style="font-size:0.8rem; color:#888;"></div></div></div><div class="modal-actions"><button id="paste-cancel">취소</button><button id="paste-send">전송</button></div></div>`;
        document.body.appendChild(div);
        this.previewModal = div; this.previewTitle = div.querySelector('#preview-title'); this.previewImage = div.querySelector('#paste-preview-image'); this.previewFileArea = div.querySelector('#paste-preview-file'); this.previewFileName = div.querySelector('#paste-file-name'); this.previewFileSize = div.querySelector('#paste-file-size');
        this.cancelBtn = div.querySelector('#paste-cancel'); this.sendBtn = div.querySelector('#paste-send');
        this.cancelBtn.onclick = () => this.closePreview();
        this.previewModal.addEventListener('click', (e) => { if(e.target === this.previewModal) this.closePreview(); });
    },
    openPreviewModal: function(file) {
        if (!file) return;
        const isImage = file.type.startsWith('image/');
        this.previewTitle.textContent = isImage ? '이미지 전송' : '파일 전송';
        this.previewImage.style.display = 'none'; this.previewFileArea.style.display = 'none';
        if (isImage) {
            const reader = new FileReader();
            reader.onload = (e) => { this.previewImage.src = e.target.result; this.previewImage.style.display = 'block'; };
            reader.readAsDataURL(file);
        } else {
            this.previewFileArea.style.display = 'block'; this.previewFileName.textContent = file.name; this.previewFileSize.textContent = (file.size / 1024 / 1024).toFixed(2) + ' MB';
        }
        this.previewModal.style.display = 'flex';
        this.sendBtn.onclick = () => { App.EventBus.emit('file:process', file); this.closePreview(); };
        this.sendBtn.focus();
    },
    closePreview: function() { this.previewModal.style.display = 'none'; this.previewImage.src = ''; this.sendBtn.onclick = null; },
    
    // [수정] 슬래시 커맨드 처리 및 전송 후 정리 함수 적용
    handleSubmit: function(e) {
        e.preventDefault();
        if (this.elements.mentionPopup?.style.display === 'block' && this.mentionPopupIndex > -1) { this.selectMentionFromPopup(this.mentionPopupIndex); return; }
        
        const text = this.elements.messageInput?.value;
        if (text && text.trim()) {
            // [FIX] 슬래시 커맨드 처리 수정 (execute -> handle, return value check)
            if (text.startsWith('/') && App.CommandManager) {
                // CommandManager.handle()은 처리되었으면 true, 아니면 false를 반환합니다.
                const isHandled = App.CommandManager.handle(text.trim());
                
                // 명령어가 내부적으로 처리되었다면(예: 모달 오픈, 자체 이벤트 발생 등), 일반 전송을 막고 종료
                if (isHandled) {
                    this.cleanupAfterSubmit();
                    return;
                }
                // false라면 일반 메시지로 간주하고 아래 로직 진행
            }

            const data = { type: 'text', text: text.trim(), mentions: this.parseMentions(text.trim()) };
            if (this.currentReply) data.replyTo = this.currentReply;
            App.EventBus.emit('sendMessage', data);
            
            this.cleanupAfterSubmit();
        }
    },

    // [NEW] 전송 후 처리 공통화 (Helper)
    cleanupAfterSubmit: function() {
        App.EventBus.emit('typing:send', false);
        this.elements.messageInput.value = ''; 
        this.autoResizeInput(); 
        this.cancelReply(); 
        this.hideMentionPopup();
    },

    handleReply: function({ key, sender, text }) {
        const decSender = App.Utils.unescapeHTML(sender);
        this.currentReply = { key: key, sender: decSender, text: App.Utils.unescapeHTML(text) };
        this.elements.replyPreviewText.innerHTML = `<strong>${App.Utils.escapeHTML(decSender)}</strong><br>${App.Utils.escapeHTML(this.currentReply.text)}`;
        this.elements.replyPreview.style.display = 'block'; this.elements.messageInput?.focus(); App.EventBus.emit('popover:adjustEmojiPanel');
    },
    cancelReply: function() { this.currentReply = null; this.elements.replyPreview.style.display = 'none'; App.EventBus.emit('popover:adjustEmojiPanel'); },
    handleInputKeydown: function(e) {
        if (this.elements.mentionPopup?.style.display === 'block') {
            const items = this.elements.mentionPopup.querySelectorAll('li');
            if (items.length === 0 && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.elements.messageForm.dispatchEvent(new Event('submit')); return; }
            if (e.key === 'ArrowDown') { e.preventDefault(); this.mentionPopupIndex = (this.mentionPopupIndex+1)%items.length; App.EventBus.emit('popover:updateMentionHighlight', this.mentionPopupIndex); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); this.mentionPopupIndex = (this.mentionPopupIndex-1+items.length)%items.length; App.EventBus.emit('popover:updateMentionHighlight', this.mentionPopupIndex); }
            else if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') { e.preventDefault(); if(this.mentionPopupIndex > -1) this.selectMentionFromPopup(this.mentionPopupIndex); }
        } else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.elements.messageForm.dispatchEvent(new Event('submit')); }
    },
    handleMentionInput: function() {
        const input = this.elements.messageInput;
        const textBefore = input.value.substring(0, input.selectionStart);
        const atIndex = textBefore.lastIndexOf('@');
        if (atIndex === -1 || (atIndex > 0 && !/\s/.test(textBefore[atIndex - 1]))) { this.hideMentionPopup(); return; }
        const query = textBefore.substring(atIndex + 1);
        const users = this.currentUserList.filter(u => u !== FULL_USER_NAME && u.toLowerCase().includes(query.toLowerCase()));
        if (users.length > 0) { App.EventBus.emit('popover:showMention', { users, inputElement: input }); this.mentionPopupIndex = -1; } else this.hideMentionPopup();
    },
    selectMentionFromPopup: function(idx) {
        const li = this.elements.mentionPopup.querySelector(`li[data-index="${idx}"]`); if(!li) return;
        const name = li.textContent; const input = this.elements.messageInput;
        const before = input.value.substring(0, input.selectionStart); const atIndex = before.lastIndexOf('@');
        input.value = input.value.substring(0, atIndex) + '@' + name + ' ' + input.value.substring(input.selectionStart);
        this.hideMentionPopup(); input.focus(); input.setSelectionRange(atIndex+name.length+2, atIndex+name.length+2); this.autoResizeInput();
    },
    hideMentionPopup: function() { if(this.elements.mentionPopup) this.elements.mentionPopup.style.display='none'; this.mentionPopupIndex=-1; },
    parseMentions: function(t) { return this.currentUserList.filter(u => u !== FULL_USER_NAME && t.includes('@' + u)); },
    handlePaste: function(e) {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        let hasImage = false;
        for (let item of items) { if (item.type.indexOf("image") === 0) { e.preventDefault(); this.openPreviewModal(item.getAsFile()); hasImage = true; return; } }
        if (!hasImage) {
            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
            if (pastedText && (pastedText.includes('\t') || (pastedText.includes('\n') && pastedText.split('\n').length > 2))) {
                e.preventDefault(); this.insertTextAtCursor(this.formatTableText(pastedText));
            }
        }
    },
    formatTableText: function(text) { return text.split('\n').map(line => line.replace(/\t/g, '  |  ')).join('\n'); },
    insertTextAtCursor: function(text) {
        const input = this.elements.messageInput; const start = input.selectionStart; const end = input.selectionEnd;
        input.value = input.value.substring(0, start) + text + input.value.substring(end);
        input.setSelectionRange(start + text.length, start + text.length); this.autoResizeInput();
    },
    autoResizeInput: function() { this.elements.messageInput.style.height='auto'; this.elements.messageInput.style.height=(this.elements.messageInput.scrollHeight)+'px'; App.EventBus.emit('popover:adjustEmojiPanel'); },
    insertEmoji: function(e) {
        const input = this.elements.messageInput; const pos = input.selectionStart;
        input.value = input.value.substring(0, pos) + e + input.value.substring(pos);
        input.setSelectionRange(pos+e.length, pos+e.length); input.focus(); this.autoResizeInput();
    }
};

/**
 * 4-3. 파일 처리기
 */
App.ChatFile = {
    elements: { chatContainer: document.getElementById('chat-container'), fileInput: document.getElementById('file-input'), attachButton: document.getElementById('attach-button') },
    dragCounter: 0, storageRef: null,
    init: function() {
        if (typeof firebase !== 'undefined') this.storageRef = firebase.storage().ref();
        this.elements.chatContainer?.addEventListener('dragenter', (e) => { e.preventDefault(); if(++this.dragCounter===1) this.elements.chatContainer.classList.add('dragging'); });
        this.elements.chatContainer?.addEventListener('dragleave', (e) => { e.preventDefault(); if(--this.dragCounter<=0) { this.dragCounter=0; this.elements.chatContainer.classList.remove('dragging'); } });
        this.elements.chatContainer?.addEventListener('dragover', (e) => { e.preventDefault(); });
        this.elements.chatContainer?.addEventListener('drop', (e) => { e.preventDefault(); this.dragCounter=0; this.elements.chatContainer.classList.remove('dragging'); if(e.dataTransfer?.files.length) App.EventBus.emit('ui:showFilePreview', e.dataTransfer.files[0]); });
        this.elements.attachButton?.addEventListener('click', () => this.elements.fileInput.click());
        this.elements.fileInput?.addEventListener('change', (e) => { if(e.target.files.length) App.EventBus.emit('ui:showFilePreview', e.target.files[0]); e.target.value=''; });
        App.EventBus.on('file:process', (f) => this.process(f));
    },
    process: async function(file) {
        if (!this.storageRef) return alert('파일 저장소 연결 실패');
        const isImg = file.type.startsWith('image/'); const isVideo = file.type.startsWith('video/');
        const limit = isVideo ? 50 : (isImg ? 10 : 20); if (file.size > limit*1024*1024) return alert(`파일 용량 초과 (${limit}MB 제한)`);
        const tempId = 'temp-'+Date.now()+Math.random();
        let uploadFile = file; let prevUrl = null;
        if (isImg && typeof imageCompression === 'function') { try { uploadFile = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920 }); } catch(e) {} prevUrl = URL.createObjectURL(uploadFile); }
        const fileType = isVideo ? 'video' : (isImg ? 'image' : 'file');
        App.EventBus.emit('message:addTemp', { tempId, type: fileType, fileName: file.name, fileSize: uploadFile.size, imageUrl: (isImg ? prevUrl : null), fileUrl: (isVideo ? URL.createObjectURL(file) : null), status: 'uploading' });
        const task = this.storageRef.child(`chat_uploads/${USER_ID}/${Date.now()}_${file.name}`).put(uploadFile);
        task.on('state_changed', null, 
            (err) => { console.error(err); alert('업로드 실패'); App.EventBus.emit('message:removeTemp', tempId); },
            async () => { const url = await task.snapshot.ref.getDownloadURL(); const msg = { type: fileType, fileName: file.name, fileSize: uploadFile.size }; if(isImg) msg.imageUrl = url; else msg.fileUrl = url; App.EventBus.emit('sendMessage', msg, tempId); }
        );
    }
};