// =================================================================================
// 3-2. UI Overlays (팝오버, 메뉴, 공지사항, 서랍)
// =================================================================================

/**
 * 팝업 관리자 (스티커 탭 스크롤 & 툴팁 지원)
 */
App.PopoverManager = {
    elements: {
        userListButton: document.getElementById('user-list-button'), 
        userListPopover: document.getElementById('user-list-popover'), 
        userCountSpan: document.getElementById('user-count'),
        emojiButton: document.getElementById('emoji-button'), 
        emojiPanel: document.getElementById('emoji-panel'), 
        emojiTabsContainer: document.getElementById('emoji-panel')?.querySelector('.emoji-tabs'),
        tabPrevBtn: document.getElementById('emoji-tab-prev'),
        tabNextBtn: document.getElementById('emoji-tab-next'),
        mentionPopup: document.getElementById('mention-popup'),
    },
    userList: [], 
    init: function() {
        document.addEventListener('click', this.handleDocumentClick.bind(this));
        this.elements.userListButton?.addEventListener('click', (e) => { e.stopPropagation(); this.toggle(this.elements.userListPopover); });
        this.elements.emojiButton?.addEventListener('click', (e) => { e.stopPropagation(); this.toggle(this.elements.emojiPanel); if(this.elements.emojiPanel.classList.contains('show')) { this.adjustEmojiPanel(); this.initEmoji(); } });
        
        this.elements.tabPrevBtn?.addEventListener('click', (e) => { e.stopPropagation(); this.scrollTabs(-1); });
        this.elements.tabNextBtn?.addEventListener('click', (e) => { e.stopPropagation(); this.scrollTabs(1); });

        App.EventBus.on('popover:showMention', ({ users, inputElement }) => {
            this.elements.mentionPopup.innerHTML = users.slice(0,5).map((u,i)=>`<li data-index="${i}" onmousedown="event.preventDefault();App.EventBus.emit('input:selectMention',${i})">${u}</li>`).join('');
            const rect = inputElement.getBoundingClientRect();
            this.elements.mentionPopup.style.bottom = (window.innerHeight - rect.top) + 'px'; 
            this.elements.mentionPopup.style.left = rect.left + 'px'; 
            this.elements.mentionPopup.style.display = 'block';
        });
        App.EventBus.on('popover:updateMentionHighlight', (idx) => { this.elements.mentionPopup.querySelectorAll('li').forEach((li,i) => li.classList.toggle('selected', i===idx)); });
        App.EventBus.on('popover:reactionMenu', (e) => this.showReactionMenu(e));
        
        App.EventBus.on('userListUpdated', (c) => {
            const rawUsers = Object.values(c || {}).map(n => String(n).replace(/"/g, '')).filter(n => n).sort();
            const userCounts = {};
            rawUsers.forEach(name => { userCounts[name] = (userCounts[name] || 0) + 1; });
            const groupedUsers = Object.keys(userCounts).sort().map(name => {
                const count = userCounts[name];
                return count > 1 ? `${name} (${count})` : name;
            });
            this.userList = groupedUsers;
            this.elements.userListPopover.innerHTML = groupedUsers.length 
                ? groupedUsers.map(u => {
                    const originalName = u.replace(/ \(\d+\)$/, ''); 
                    return `<li><span style="color:${App.Utils.getUserColor(originalName)}">${App.Utils.escapeHTML(u)}</span></li>`;
                }).join('') 
                : '<li>(접속자 없음)</li>';
            this.elements.userCountSpan.textContent = rawUsers.length;
            
            // 💡 [수정됨] updateUserList 함수가 존재하는지 안전하게 확인 후 실행
            if (App.GameManager && typeof App.GameManager.updateUserList === 'function') {
                App.GameManager.updateUserList(groupedUsers);
            }
        });

        App.EventBus.on('popover:adjustEmojiPanel', () => this.adjustEmojiPanel());
        App.EventBus.on('input:hideMentionPopup', () => { if(this.elements.mentionPopup) this.elements.mentionPopup.style.display='none'; });
    },
    
    scrollTabs: function(direction) {
        if (!this.elements.emojiTabsContainer) return;
        const scrollAmount = 80;
        this.elements.emojiTabsContainer.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
    },

    toggle: function(el) { const show = !el.classList.contains('show'); this.closeAll(); if(show) el.classList.add('show'); },
    closeAll: function() {
        this.elements.userListPopover.classList.remove('show'); this.elements.emojiPanel.classList.remove('show');
        if(this.elements.mentionPopup) this.elements.mentionPopup.style.display='none';
        document.querySelectorAll('.reaction-menu-popup').forEach(p=>p.remove());
        document.getElementById('plus-menu')?.classList.remove('show');
        document.getElementById('media-drawer')?.classList.remove('show');
    },
    handleDocumentClick: function(e) {
        if (!e.target.closest('#user-list-button') && !e.target.closest('#user-list-popover')) this.elements.userListPopover.classList.remove('show');
        if (!e.target.closest('#emoji-button') && !e.target.closest('#emoji-panel')) this.elements.emojiPanel.classList.remove('show');
        if (!e.target.closest('#mention-popup')) this.elements.mentionPopup.style.display='none';
        if (!e.target.closest('.reaction-menu-popup') && !e.target.closest('.action-button') && !e.target.closest('#context-menu')) { document.querySelectorAll('.reaction-menu-popup').forEach(p=>p.remove()); }
        if (!e.target.closest('#plus-button') && !e.target.closest('#plus-menu')) document.getElementById('plus-menu')?.classList.remove('show');
        if (!e.target.closest('#drawer-toggle') && !e.target.closest('#media-drawer')) document.getElementById('media-drawer')?.classList.remove('show');
    },
    showReactionMenu: function(e) {
        e.stopPropagation(); document.querySelectorAll('.reaction-menu-popup').forEach(p=>p.remove());
        let targetBubble = e.target.closest('.message-bubble'); let messageKey = targetBubble?.dataset.key;
        if (!messageKey && e.detail && e.detail.key) { messageKey = e.detail.key; targetBubble = document.querySelector(`.message-bubble[data-key="${messageKey}"]`); }
        if(!messageKey) return;
        const menu = document.createElement('div'); menu.className='reaction-menu-popup';
        App.Constants.REACTION_EMOJIS.forEach(em => { 
            const s=document.createElement('span'); s.textContent=em; 
            s.onclick=(ev)=>{ ev.stopPropagation(); App.EventBus.emit('reaction:add',{messageKey:messageKey,emoji:em}); menu.remove(); if(App.ContextMenuManager) App.ContextMenuManager.hide(); }; 
            menu.appendChild(s); 
        });
        document.body.appendChild(menu);
        if (targetBubble) {
            const rect = targetBubble.getBoundingClientRect(); const isMine = targetBubble.classList.contains('my-message'); const menuWidth = menu.offsetWidth;
            menu.style.top = (rect.top - 50 + window.scrollY) + 'px'; 
            menu.style.left = isMine ? (rect.right - menuWidth) + 'px' : rect.left + 'px';
        } else if (e.clientX) { menu.style.top = e.clientY + 'px'; menu.style.left = e.clientX + 'px'; }
    },
    initEmoji: function() {
        if(this.elements.emojiTabsContainer.children.length > 0) return; 
        const gridCon = document.querySelector('.emoji-grids');
        
        Object.keys(App.Constants.ANIMATED_STICKERS).forEach((cat) => {
            const stickers = App.Constants.ANIMATED_STICKERS[cat];
            const btn = document.createElement('button'); btn.className='emoji-tab-button'; 
            btn.textContent=cat.split(' ')[0]; 
            btn.title = cat;
            btn.onclick=()=>this.switchTab(cat);
            this.elements.emojiTabsContainer.appendChild(btn);
            
            const div = document.createElement('div'); div.className='emoji-grid-container sticker-grid'; div.dataset.category=cat; div.style.display='none';
            div.innerHTML = `<div class="emoji-grid sticker-mode">${stickers.map(s => `<img src="${s.url}" class="emoji-sticker-item" title="${s.name}" onclick="App.EventBus.emit('sendMessage', { type: 'image', imageUrl: '${s.url}', text: '' }); App.PopoverManager.toggle(App.PopoverManager.elements.emojiPanel);">`).join('')}</div>`;
            gridCon.appendChild(div);
        });

        Object.keys(App.Constants.EMOJI_CATEGORIES).forEach((cat) => {
            const btn = document.createElement('button'); btn.className='emoji-tab-button'; 
            btn.textContent=App.Constants.EMOJI_CATEGORIES[cat][0]; 
            btn.title = cat;
            btn.onclick=()=>this.switchTab(cat);
            this.elements.emojiTabsContainer.appendChild(btn);
            
            const div = document.createElement('div'); div.className='emoji-grid-container'; div.dataset.category=cat; div.style.display='none';
            div.innerHTML = `<div class="emoji-grid">${App.Constants.EMOJI_CATEGORIES[cat].map(e=>`<span class="emoji-char" onclick="App.EventBus.emit('input:insertEmoji','${e}')">${e}</span>`).join('')}</div>`;
            gridCon.appendChild(div);
        });
        
        const firstCat = Object.keys(App.Constants.ANIMATED_STICKERS)[0];
        if (firstCat) this.switchTab(firstCat);
    },
    switchTab: function(cat) {
        this.elements.emojiTabsContainer.querySelectorAll('.active').forEach(b=>b.classList.remove('active'));
        const tabs = Array.from(this.elements.emojiTabsContainer.children);
        const allCats = [...Object.keys(App.Constants.ANIMATED_STICKERS), ...Object.keys(App.Constants.EMOJI_CATEGORIES)];
        const targetIndex = allCats.indexOf(cat);
        if(tabs[targetIndex]) {
            tabs[targetIndex].classList.add('active');
            tabs[targetIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
        document.querySelectorAll('.emoji-grid-container').forEach(d=>d.style.display='none');
        const targetGrid = document.querySelector(`.emoji-grid-container[data-category="${cat}"]`);
        if(targetGrid) targetGrid.style.display='block';
    },
    adjustEmojiPanel: function() { if(this.elements.emojiPanel.classList.contains('show')) { const h = (document.getElementById('message-form')?.offsetHeight||0) + (document.getElementById('reply-preview')?.offsetHeight||0); this.elements.emojiPanel.style.bottom = (h+5)+'px'; } }
};

/**
 * 공지사항 관리자
 */
App.NoticeManager = {
    noticeElement: null, modalElement: null, pollListener: null, currentPollData: null, currentMessageKey: null,
    init: function() {
        const header = document.getElementById('chat-header');
        const noticeDiv = document.createElement('div'); noticeDiv.id = 'notice-bar';
        noticeDiv.innerHTML = `<div class="notice-icon">📢</div><div class="notice-content"><div class="notice-text"></div></div><div class="notice-actions"><button class="notice-close" title="공지 내리기">❌</button></div>`;
        if(header) header.appendChild(noticeDiv);
        this.noticeElement = noticeDiv; this.textElement = noticeDiv.querySelector('.notice-text'); this.closeButton = noticeDiv.querySelector('.notice-close');
        this.noticeElement.style.display = 'none';
        this.injectPollModal();
        App.EventBus.on('notice:updated', (data) => this.render(data));
        this.noticeElement.addEventListener('click', (e) => { if (!e.target.closest('.notice-close')) { this.handleClick(); } });
        this.closeButton.addEventListener('click', (e) => { e.stopPropagation(); if(confirm('공지를 내리시겠습니까?')) { App.EventBus.emit('notice:remove'); } });
    },
    injectPollModal: function() {
        const modal = document.createElement('div'); modal.id = 'poll-view-modal';
        modal.innerHTML = `<div class="modal-content"><div class="poll-view-header"><div class="poll-view-title">📊 투표 현황</div><button class="poll-view-close">×</button></div><div class="poll-view-body" id="poll-view-body"></div><div class="poll-view-footer" id="poll-view-footer"></div></div>`;
        document.body.appendChild(modal); this.modalElement = modal;
        modal.querySelector('.poll-view-close').onclick = () => this.closeModal();
        modal.onclick = (e) => { if(e.target === modal) this.closeModal(); };
    },
    render: function(data) {
        if (this.pollListener) { this.pollListener.off(); this.pollListener = null; }
        this.currentPollData = null; this.currentMessageKey = null;
        if (!data || !data.text) { this.noticeElement.style.display = 'none'; this.noticeElement.classList.remove('show'); return; }
        this.currentMessageKey = data.messageKey; this.noticeElement.dataset.type = data.type;
        if (data.type === 'poll') {
            if (typeof firebase !== 'undefined') {
                const pollRef = firebase.database().ref(`messages/${data.messageKey}/poll`);
                this.pollListener = pollRef;
                pollRef.on('value', (snapshot) => {
                    const pollData = snapshot.val();
                    if (pollData) {
                        this.currentPollData = pollData;
                        this.textElement.innerHTML = `<div class="notice-wrapper"><span class="notice-badge poll">투표</span><span style="font-weight:500;">${App.Utils.escapeHTML(pollData.title)}</span><span style="font-size:0.8rem; color:var(--text-color-tertiary); margin-left:6px;">(클릭하여 참여)</span></div>`;
                        if(this.modalElement.style.display === 'flex') { this.renderModalContent(); }
                    } else { this.textElement.textContent = "(삭제된 투표)"; this.closeModal(); }
                });
            }
        } else {
            this.textElement.innerHTML = `<div class="notice-wrapper"><span class="notice-badge">공지</span><span>${App.Utils.escapeHTML(data.text)}</span></div>`;
        }
        this.noticeElement.style.display = 'flex'; setTimeout(() => this.noticeElement.classList.add('show'), 10);
    },
    handleClick: function() {
        if (this.noticeElement.dataset.type === 'poll' && this.currentPollData) { this.openModal(); } 
        else if (this.currentMessageKey) { App.MessageRenderer.scrollToMessage(this.currentMessageKey); }
    },
    openModal: function() { if(!this.currentPollData) return; this.renderModalContent(); this.modalElement.style.display = 'flex'; },
    closeModal: function() { this.modalElement.style.display = 'none'; },
    
    // [수정] 투표자 명단 표시 기능 추가됨
    renderModalContent: function() {
        const pollData = this.currentPollData; const messageKey = this.currentMessageKey;
        const body = document.getElementById('poll-view-body'); const footer = document.getElementById('poll-view-footer');
        this.modalElement.querySelector('.poll-view-title').innerHTML = `📊 ${App.Utils.escapeHTML(pollData.title)}`;
        const totalVotes = pollData.options.reduce((sum, opt) => sum + (opt.votes ? Object.keys(opt.votes).length : 0), 0);
        const isClosed = pollData.closed === true;

        body.innerHTML = pollData.options.map((opt, index) => {
            // 투표 수 및 내 투표 여부 확인
            const votesObj = opt.votes || {};
            const voterList = Object.keys(votesObj);
            const votes = voterList.length;
            const isVotedByMe = votesObj[FULL_USER_NAME];
            const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;

            const clickAction = isClosed 
                ? `onclick="alert('종료된 투표입니다.')"` 
                : `onclick="App.EventBus.emit('poll:vote', { messageKey: '${messageKey}', optionIndex: ${index}, allowMultiple: ${pollData.allowMultiple} })"`;

            const imgHtml = opt.imageUrl ? `<img src="${opt.imageUrl}" class="pv-img" onclick="event.stopPropagation();App.EventBus.emit('lightbox:show','${opt.imageUrl}')">` : '';
            const checkMark = isVotedByMe ? `<span class="pv-check">✔</span>` : '';

            // [NEW] 투표자 명단 HTML 생성
            const voterHtml = votes > 0 
                ? `<div style="font-size: 0.8rem; color: var(--text-color-tertiary); padding: 4px 10px 10px 52px; margin-top: -5px; word-break: break-all;">
                     ↳ ${voterList.map(name => App.Utils.escapeHTML(name)).join(', ')}
                   </div>` 
                : '';

            return `
                <div style="margin-bottom: 8px;">
                    <div class="pv-item ${isVotedByMe ? 'voted' : ''}" ${clickAction}>
                        <div class="pv-progress" style="width:${percentage}%;"></div>
                        <div class="pv-content">
                            ${imgHtml}
                            <span class="pv-text">${checkMark}${App.Utils.escapeHTML(opt.text)}</span>
                            <span class="pv-count">${votes}표 (${percentage}%)</span>
                        </div>
                    </div>
                    ${voterHtml}
                </div>
            `;
        }).join('');

        footer.innerHTML = `${pollData.allowMultiple ? '복수 선택 가능' : '단일 선택'} • 총 ${totalVotes}명 참여 ${isClosed ? '<br><span style="color:#fa5252; font-weight:bold;">[투표 종료됨]</span>' : ''}`;
    }
};

/**
 * 컨텍스트 메뉴 관리자
 */
App.ContextMenuManager = {
    menu: null, targetMessage: null,
    init: function() {
        this.createMenuElement();
        document.addEventListener('contextmenu', this.handleContextMenu.bind(this));
        document.addEventListener('click', (e) => { if (this.menu && e.target.closest('#context-menu') !== this.menu) this.hide(); });
        document.addEventListener('scroll', () => this.hide(), true);
    },
    createMenuElement: function() { const div = document.createElement('div'); div.id = 'context-menu'; document.body.appendChild(div); this.menu = div; },
    handleContextMenu: function(e) {
        const bubble = e.target.closest('.message-bubble'); if (!bubble) return;
        e.preventDefault();
        let text = bubble.querySelector('.message-text')?.innerText; let type = 'text';
        if (bubble.querySelector('.poll-question')) { text = bubble.querySelector('.poll-question').innerText.replace('📊 ',''); type = 'poll'; } 
        else if (bubble.querySelector('.msg-file-name')) { text = '[파일] ' + bubble.querySelector('.msg-file-name').innerText; type = 'file'; } 
        else if (bubble.querySelector('.msg-image')) { text = '[사진]'; type = 'image'; }
        this.targetMessage = { key: bubble.dataset.key, sender: bubble.dataset.sender, text: text, type: type, isMine: bubble.classList.contains('my-message'), typeClass: bubble.classList.contains('deleted-message') ? 'deleted' : 'normal' };
        if (this.targetMessage.typeClass === 'deleted') return;
        this.renderMenuItems(); this.show(e.clientX, e.clientY);
    },
    renderMenuItems: function() {
        const { isMine } = this.targetMessage;
        let html = `<button onclick="App.ContextMenuManager.action('reply')"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"></polyline><path d="M20 18v-2a4 4 0 0 0-4-4H4"></path></svg> 답장</button><button onclick="App.ContextMenuManager.action('reaction')"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg> 공감</button><button onclick="App.ContextMenuManager.action('copy')"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> 복사</button><div class="menu-divider"></div><button onclick="App.ContextMenuManager.action('notice')"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg> 공지</button>`;
        if (isMine) { html += `<div class="menu-divider"></div><button onclick="App.ContextMenuManager.action('edit')"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg> 수정</button><button class="danger" onclick="App.ContextMenuManager.action('delete')"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg> 삭제</button>`; }
        this.menu.innerHTML = html;
    },
    show: function(x, y) {
        this.menu.style.display = 'flex'; const rect = this.menu.getBoundingClientRect();
        let posX = x, posY = y; if (x + rect.width > window.innerWidth) posX = x - rect.width; if (y + rect.height > window.innerHeight) posY = y - rect.height;
        this.menu.style.left = `${posX}px`; this.menu.style.top = `${posY}px`;
    },
    hide: function() { if (this.menu) this.menu.style.display = 'none'; this.targetMessage = null; },
    copyToClipboard: function(text) {
        const textArea = document.createElement("textarea"); textArea.value = text;
        textArea.style.position = "fixed"; textArea.style.left = "-9999px"; textArea.style.top = "0";
        document.body.appendChild(textArea); textArea.focus(); textArea.select();
        try { if(document.execCommand('copy')) App.SettingsManager.showToast("텍스트가 복사되었습니다."); else App.SettingsManager.showToast("복사에 실패했습니다."); } catch (err) { App.SettingsManager.showToast("복사 중 오류가 발생했습니다."); }
        document.body.removeChild(textArea);
    },
    action: function(type) {
        if (!this.targetMessage) return;
        const { key, sender, text, type: msgType } = this.targetMessage;
        switch (type) {
            case 'reply': App.EventBus.emit('input:reply', { key, sender, text: text.substring(0, 50).replace(/\n/g, ' ') }); break;
            case 'reaction': App.EventBus.emit('popover:reactionMenu', { target: document.querySelector(`.message-bubble[data-key="${key}"]`), stopPropagation:()=>{}, detail:{key} }); break;
            case 'copy': this.copyToClipboard(text); break;
            case 'notice': if(confirm('이 메시지를 공지로 등록하시겠습니까?')) { App.EventBus.emit('notice:register', { key, text, type: msgType }); App.SettingsManager.showToast("공지가 등록되었습니다."); } break;
            case 'edit': App.EventBus.emit('edit:trigger', { key, text }); break;
            case 'delete': if(confirm('이 메시지를 삭제하시겠습니까?')) App.EventBus.emit('message:delete', { messageKey: key }); break;
        }
        this.hide();
    }
};

/**
 * 서랍(모아보기) 관리자
 */
App.DrawerManager = {
    elements: {
        drawer: document.getElementById('media-drawer'), toggleBtn: document.getElementById('drawer-toggle'), closeBtn: document.getElementById('drawer-close'),
        tabs: document.querySelectorAll('.drawer-tab'), grids: { image: document.getElementById('drawer-grid-image'), file: document.getElementById('drawer-grid-file') }
    },
    init: function() {
        if(!this.elements.drawer) return;
        this.elements.toggleBtn?.addEventListener('click', () => this.open());
        this.elements.closeBtn?.addEventListener('click', () => this.close());
        this.elements.tabs.forEach(tab => tab.addEventListener('click', () => this.switchTab(tab.dataset.tab)));
    },
    open: function() {
        this.elements.drawer.classList.add('show');
        this.loadMedia('image'); this.loadMedia('file');
    },
    close: function() { this.elements.drawer.classList.remove('show'); },
    switchTab: function(type) {
        this.elements.tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === type));
        this.elements.grids.image.classList.toggle('active', type === 'image');
        this.elements.grids.file.classList.toggle('active', type === 'file');
    },
    loadMedia: function(type) {
        if (typeof firebase === 'undefined') return;
        firebase.database().ref('messages').limitToLast(200).once('value').then(snapshot => {
            const items = [];
            snapshot.forEach(child => {
                const m = child.val();
                if (m.type === type && (m.imageUrl || m.fileUrl)) items.push(m);
            });
            this.renderGrid(type, items.reverse());
        });
    },
    renderGrid: function(type, items) {
        const container = this.elements.grids[type];
        if (items.length === 0) { container.innerHTML = '<div class="drawer-empty">파일이 없습니다.</div>'; return; }
        if (type === 'image') {
            container.innerHTML = items.map(m => `<img src="${m.imageUrl}" class="drawer-img-item" onclick="App.EventBus.emit('lightbox:show','${m.imageUrl}')">`).join('');
        } else {
            container.innerHTML = items.map(m => `<a href="${m.fileUrl}" target="_blank" class="drawer-file-item"><span>📁</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${App.Utils.escapeHTML(m.fileName)}</span></a>`).join('');
        }
    }
};
App.DrawerManager.init();