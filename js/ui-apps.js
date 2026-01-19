// =================================================================================
// 3-3. UI Apps (투표, 게임, 명령어, 그림판 + AI 통합 버전 v3.3.0 - 묘사 강화)
// =================================================================================

/**
 * 투표 관리자
 */
App.PollManager = {
    elements: { modal: null },
    init: function() {
        if(App.PlusMenuManager && App.PlusMenuManager.init) App.PlusMenuManager.init();
        this.injectModal();
    },
    injectModal: function() {
        if (document.getElementById('poll-create-modal')) {
            this.elements.modal = document.getElementById('poll-create-modal');
            this.elements.titleInput = this.elements.modal.querySelector('#poll-title-input');
            this.elements.optionsList = this.elements.modal.querySelector('#poll-options-list');
            this.elements.allowMultiple = this.elements.modal.querySelector('#poll-allow-multiple');
            this.bindEvents();
            return;
        }

        const div = document.createElement('div'); div.id = 'poll-create-modal';
        div.innerHTML = '<div class="modal-content"><h3 style="margin:0;">투표 만들기</h3><div class="poll-input-group"><label>투표 제목</label><input type="text" id="poll-title-input" class="poll-text-input" placeholder="투표 제목을 입력하세요" maxlength="50"></div><div class="poll-input-group"><label>투표 항목</label><div id="poll-options-list" class="poll-options-list"></div><button id="poll-add-option" class="poll-btn-add">+ 항목 추가</button></div><div class="poll-input-group"><label class="poll-checkbox-label"><input type="checkbox" id="poll-allow-multiple"> 복수 선택 허용</label></div><div class="modal-actions"><button id="poll-cancel">취소</button><button id="poll-create" class="edit-save">투표 생성</button></div></div>';
        document.body.appendChild(div);
        
        this.elements.modal = div;
        this.elements.titleInput = div.querySelector('#poll-title-input');
        this.elements.optionsList = div.querySelector('#poll-options-list');
        this.elements.allowMultiple = div.querySelector('#poll-allow-multiple');
        this.bindEvents();
        this.addOptionInput(); this.addOptionInput();
    },
    bindEvents: function() {
        const modal = this.elements.modal;
        if(!modal) return;
        var self = this;
        modal.querySelector('#poll-cancel').onclick = function() { self.closeModal(); };
        modal.querySelector('#poll-create').onclick = function() { self.submitPoll(); };
        modal.querySelector('#poll-add-option').onclick = function() { self.addOptionInput(); };
        modal.onmousedown = function(e) { if(e.target === modal) self.closeModal(); };
    },
    openModal: function() {
        if(!this.elements.modal) this.injectModal();
        this.elements.titleInput.value = ''; 
        this.elements.allowMultiple.checked = false; 
        this.elements.optionsList.innerHTML = '';
        this.addOptionInput(); this.addOptionInput();
        this.elements.modal.style.display = 'flex'; 
        this.elements.titleInput.focus();
    },
    closeModal: function() { this.elements.modal.style.display = 'none'; },
    addOptionInput: function() {
        const row = document.createElement('div'); row.className = 'poll-option-row';
        row.innerHTML = '<label class="poll-option-img-btn" title="이미지 첨부"><span>📷</span><img style="display:none; width:100%; height:100%; object-fit:cover;"><input type="file" accept="image/*" style="display:none;"></label><input type="text" class="poll-text-input" placeholder="항목 입력" style="flex-grow:1;"><button class="poll-btn-remove" onclick="this.parentElement.remove()">×</button>';
        this.elements.optionsList.appendChild(row);
        
        const fileInput = row.querySelector('input[type="file"]'); 
        const imgPreview = row.querySelector('img'); 
        const iconSpan = row.querySelector('span'); 
        const imgBtn = row.querySelector('.poll-option-img-btn'); 
        
        fileInput.onchange = function(e) {
            if (e.target.files && e.target.files[0]) {
                var file = e.target.files[0]; var originalFileName = file.name;
                var reader = new FileReader(); 
                reader.onload = function(ev) { imgPreview.src = ev.target.result; imgPreview.style.display = 'block'; iconSpan.style.display = 'none'; }; 
                reader.readAsDataURL(file);
                
                if (typeof firebase !== 'undefined') {
                    var task = firebase.storage().ref().child('poll_images/' + Date.now() + '_' + originalFileName).put(file);
                    row.dataset.uploading = 'true'; imgBtn.style.border = '2px solid var(--accent-color)'; imgPreview.style.opacity = '0.5';
                    task.on('state_changed', null, 
                        function(err) { alert('업로드 실패'); imgPreview.style.display = 'none'; iconSpan.style.display = 'block'; imgBtn.style.border = ''; delete row.dataset.imageUrl; delete row.dataset.uploading; }, 
                        function() { task.snapshot.ref.getDownloadURL().then(function(url) { row.dataset.imageUrl = url; delete row.dataset.uploading; imgBtn.style.border = ''; imgPreview.style.opacity = '1'; }); }
                    );
                }
            }
        };
    },
    submitPoll: function() {
        const title = this.elements.titleInput.value.trim(); 
        if(!title) return alert('제목을 입력해주세요.');
        const options = []; 
        const rows = this.elements.optionsList.querySelectorAll('.poll-option-row');
        for(let i=0; i<rows.length; i++) { if(rows[i].dataset.uploading) return alert('이미지 업로드 중입니다.'); }
        
        rows.forEach(function(row) { 
            const text = row.querySelector('input[type="text"]').value.trim(); 
            const img = row.dataset.imageUrl || null; 
            if(text || img) options.push({ text: text || '이미지 항목', imageUrl: img, votes: {} }); 
        });
        
        if(options.length < 2) return alert('최소 2개 이상 항목 필요');
        App.EventBus.emit('sendMessage', { 
            type: 'poll', text: title, 
            poll: { title: title, options: options, allowMultiple: this.elements.allowMultiple.checked, closed: false, createdBy: typeof FULL_USER_NAME !== 'undefined' ? FULL_USER_NAME : 'User' } 
        });
        this.closeModal();
    }
};

/**
 * 사다리 게임 관리자
 */
App.GameManager = {
    elements: { modal: null },
    init: function() { this.refreshElements(); },
    refreshElements: function() {
        this.elements.modal = document.getElementById('ladder-game-modal');
        if(!this.elements.modal) return;
        this.elements.userList = document.getElementById('ladder-user-list'); 
        this.elements.resultInput = document.getElementById('ladder-result-input'); 
        this.elements.startBtn = document.getElementById('ladder-start-btn'); 
        this.elements.resetBtn = document.getElementById('ladder-reset-btn'); 
        this.elements.sendBtn = document.getElementById('ladder-send-btn'); 
        this.elements.canvas = document.getElementById('ladder-canvas'); 
        this.elements.resultDisplay = document.getElementById('ladder-result-display');
        
        var self = this;
        const closeBtn = this.elements.modal.querySelector('.game-close');
        if(closeBtn) closeBtn.onclick = function() { self.closeModal(); };
        this.elements.modal.onmousedown = function(e) { if(e.target === self.elements.modal) self.closeModal(); };

        if(this.elements.startBtn) this.elements.startBtn.onclick = function() { self.startGame(); };
        if(this.elements.resetBtn) this.elements.resetBtn.onclick = function() { self.resetGame(); };
        if(this.elements.sendBtn) this.elements.sendBtn.onclick = function() { self.sendResult(); };
        if(this.elements.canvas) this.ctx = this.elements.canvas.getContext('2d');
    },
    openModal: function() { this.open(); },
    open: function() {
        this.init(); this.resetGame();
        let users = [];
        if (App.PopoverManager && App.PopoverManager.userList && App.PopoverManager.userList.length > 0) {
            users = App.PopoverManager.userList.map(function(u) { return u.split(' (')[0]; });
        } else { users = [typeof FULL_USER_NAME !== 'undefined' ? FULL_USER_NAME : '나']; }
        if(this.elements.userList) { this.elements.userList.innerHTML = users.map(function(u) { return '<label class="ladder-user-item"><input type="checkbox" value="'+u+'" checked> '+u+'</label>'; }).join(''); }
        if(this.elements.modal) this.elements.modal.style.display = 'flex';
    },
    closeModal: function() { if(this.elements.modal) this.elements.modal.style.display = 'none'; if(this.animId) cancelAnimationFrame(this.animId); },
    resetGame: function() {
        document.getElementById('ladder-setup-step').style.display = 'block';
        document.getElementById('ladder-play-step').style.display = 'none';
        if(this.elements.resultDisplay) this.elements.resultDisplay.textContent = '';
        this.currentResultText = "";
        if(this.animId) cancelAnimationFrame(this.animId);
        if(this.ctx) this.ctx.clearRect(0,0, this.elements.canvas.width, this.elements.canvas.height);
    },
    startGame: function() {
        const selectedUsers = Array.from(this.elements.userList.querySelectorAll('input:checked')).map(function(cb) { return cb.value; });
        const inputVal = this.elements.resultInput.value.trim();
        const results = inputVal ? inputVal.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s; }) : [];
        if (selectedUsers.length < 2) return alert('최소 2명 이상 선택해주세요.');
        if (results.length === 0) return alert('결과 항목을 입력해주세요.');
        while (results.length < selectedUsers.length) results.push('꽝');
        const shuffledResults = results.slice(0, selectedUsers.length).sort(function() { return Math.random() - 0.5; });

        document.getElementById('ladder-setup-step').style.display = 'none';
        document.getElementById('ladder-play-step').style.display = 'flex';
        var self = this;
        setTimeout(function() {
            const cvs = self.elements.canvas; if(!cvs) return;
            const rect = cvs.parentElement.getBoundingClientRect();
            cvs.width = rect.width || 400; cvs.height = 300; 
            self.runLadderLogic(selectedUsers, shuffledResults, cvs.width, cvs.height);
        }, 50);
    },
    runLadderLogic: function(users, results, w, h) {
        const cols = users.length; const colWidth = w / cols; const steps = 8; const bridges = [];
        for (let i = 0; i < steps; i++) {
            const y = 60 + (h - 120) * ((i + 1) / (steps + 1));
            for (let j = 0; j < cols - 1; j++) {
                var hasLeft = false;
                for(var k=0; k<bridges.length; k++) { if(bridges[k].y === y && bridges[k].col === j - 1) hasLeft = true; }
                if (!hasLeft && Math.random() > 0.5) bridges.push({ col: j, y: y });
            }
        }
        const userPaths = users.map(function(u, startCol) {
            let currentCol = startCol, currentX = colWidth * startCol + colWidth / 2, currentY = 50;
            const pathPoints = [{x: currentX, y: currentY}];
            const sortedBridges = bridges.slice().sort(function(a, b) { return a.y - b.y; });
            
            sortedBridges.forEach(function(b) {
                if (b.col === currentCol || b.col === currentCol - 1) {
                    pathPoints.push({x: currentX, y: b.y});
                    currentY = b.y;
                    if (b.col === currentCol) { currentCol++; currentX = colWidth * currentCol + colWidth / 2; } 
                    else { currentCol--; currentX = colWidth * currentCol + colWidth / 2; }
                    pathPoints.push({x: currentX, y: currentY});
                }
            });
            pathPoints.push({x: currentX, y: h - 50});
            return { name: u, points: pathPoints, color: ['#D32F2F', '#C2185B', '#7B1FA2', '#303F9F', '#1976D2', '#00796B', '#388E3C', '#F57C00'][startCol % 8], finalCol: currentCol };
        });

        let startTime = null; const totalDuration = 3000;
        var self = this;
        const animate = function(timestamp) {
            if (!startTime) startTime = timestamp;
            const t = Math.min((timestamp - startTime) / totalDuration, 1);
            self.ctx.clearRect(0, 0, w, h);
            self.ctx.lineWidth = 2; self.ctx.strokeStyle = '#ddd'; self.ctx.font = 'bold 12px sans-serif'; self.ctx.textAlign = 'center'; self.ctx.textBaseline = 'bottom';
            for(let i=0; i<cols; i++) {
                const x = colWidth * i + colWidth / 2;
                self.ctx.beginPath(); self.ctx.moveTo(x, 50); self.ctx.lineTo(x, h - 50); self.ctx.stroke();
                self.ctx.fillStyle = '#333'; self.ctx.fillText(users[i], x, 40);
                self.ctx.fillStyle = '#e03131'; self.ctx.fillText(results[i], x, h - 20);
            }
            self.ctx.strokeStyle = '#bbb';
            bridges.forEach(function(b) {
                const x1 = colWidth * b.col + colWidth / 2, x2 = colWidth * (b.col + 1) + colWidth / 2;
                self.ctx.beginPath(); self.ctx.moveTo(x1, b.y); self.ctx.lineTo(x2, b.y); self.ctx.stroke();
            });
            self.ctx.lineWidth = 3; self.ctx.lineCap = 'round'; self.ctx.lineJoin = 'round';
            userPaths.forEach(function(p) {
                self.ctx.strokeStyle = p.color; self.ctx.fillStyle = p.color; self.ctx.beginPath();
                const maxIndex = (p.points.length - 1) * t;
                const idx = Math.floor(maxIndex);
                if (idx < p.points.length - 1) {
                    self.ctx.moveTo(p.points[0].x, p.points[0].y);
                    for(let i=1; i<=idx; i++) self.ctx.lineTo(p.points[i].x, p.points[i].y);
                    const p1 = p.points[idx], p2 = p.points[idx+1], segT = maxIndex - idx;
                    const curX = p1.x + (p2.x - p1.x) * segT, curY = p1.y + (p2.y - p1.y) * segT;
                    self.ctx.lineTo(curX, curY); self.ctx.stroke();
                    self.ctx.beginPath(); self.ctx.arc(curX, curY, 4, 0, Math.PI*2); self.ctx.fill();
                } else {
                    self.ctx.moveTo(p.points[0].x, p.points[0].y);
                    for(let i=1; i<p.points.length; i++) self.ctx.lineTo(p.points[i].x, p.points[i].y);
                    self.ctx.stroke();
                }
            });
            if (t < 1) self.animId = requestAnimationFrame(animate);
            else { 
                self.currentResultText = userPaths.map(function(p) { return p.name + ' 👉 ' + results[p.finalCol]; }).join('\n'); 
                self.elements.resultDisplay.innerText = "🎉 결과 확인!\n" + self.currentResultText; 
            }
        };
        this.animId = requestAnimationFrame(animate);
    },
    sendResult: function() {
        if(!this.currentResultText) return alert("게임이 아직 끝나지 않았습니다.");
        App.EventBus.emit('sendMessage', { type: 'text', text: '[🎮 사다리 결과]\n' + this.currentResultText });
        this.closeModal();
    }
};

/**
 * 그림판 Pro Manager
 */
App.DrawingManager = {
    elements: {}, ctx: null, isDrawing: false, startX: 0, startY: 0,
    currentTool: 'pen', currentColor: '#000000', currentSize: 5, currentShape: 'line', currentLineStyle: 'solid',
    history: [], historyStep: -1, MAX_HISTORY: 20,

    init: function() {
        const oldModal = document.getElementById('drawing-modal');
        if (oldModal) oldModal.remove();
        this.injectModal();
    },

    openModal: function() { this.open(); },

    injectModal: function() {
        const div = document.createElement('div');
        div.id = 'drawing-modal'; div.className = 'game-modal'; div.style.display = 'none';
        div.innerHTML = '<div class="game-modal-content" style="max-width: 750px; width: 95%;"><div class="game-header"><h3>🎨 Drawing Board Pro</h3><button class="game-close">×</button></div><div class="game-body" style="padding: 10px;"><div class="drawing-top-bar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;"><div class="tool-group"><button id="btn-undo" class="tool-btn" title="취소">↩️</button><button id="btn-redo" class="tool-btn" title="다시">↪️</button></div><div class="tool-group"><button id="tool-pen" class="tool-btn active" title="펜">✏️</button><button id="tool-eraser" class="tool-btn" title="지우개">🧹</button><button id="tool-fill" class="tool-btn" title="채우기">🪣</button><button id="tool-text" class="tool-btn" title="텍스트">T</button><button id="btn-add-img" class="tool-btn" title="사진 첨부">🖼️</button><input type="file" id="drawing-img-input" accept="image/*" style="display:none;"></div><div class="tool-group"><select id="shape-select" class="tool-btn" style="width:auto; padding:0 5px; font-size:0.9rem;"><option value="line">📏 직선</option><option value="rect">⬜ 사각형</option><option value="circle">⭕ 원</option><option value="triangle">🔺 삼각형</option><option value="arrow">↗️ 화살표</option><option value="star">⭐ 별</option><option value="diamond">🔶 마름모</option></select><button id="tool-shape" class="tool-btn" title="도형 그리기">📐</button></div><div class="tool-group"><select id="line-style-select" class="tool-btn" style="width:auto; padding:0 5px; font-size:0.9rem;"><option value="solid">실선</option><option value="dashed">파선</option><option value="dotted">점선</option></select></div></div><div class="drawing-options-bar" style="display:flex; gap:10px; align-items:center; margin-bottom:10px; background:var(--input-bg-color); padding:8px; border-radius:8px; border:1px solid var(--border-color); flex-wrap:wrap;"><div style="display:flex; align-items:center; gap:5px;"><div class="color-palette" id="drawing-palette" style="display:flex; gap:5px;"></div><input type="color" id="drawing-color-picker" value="#000000" style="width:30px; height:30px; border:none; background:none; cursor:pointer;"></div><div style="display:flex; align-items:center; gap:5px; border-left:1px solid var(--border-color); padding-left:10px;"><label style="font-size:0.8rem;">크기:</label><input type="range" id="drawing-brush-size" min="1" max="50" value="5" style="width:80px;"><span id="brush-size-display" style="font-size:0.8rem; min-width:20px;">5</span></div><input type="text" id="drawing-text-input" placeholder="입력할 텍스트" style="display:none; padding:4px 8px; border-radius:4px; border:1px solid var(--border-color); flex-grow:1;"><div style="display:flex; gap:5px; margin-left:auto;"><button id="btn-filter-gray" class="tool-btn small" style="font-size:0.8rem; width:auto;">흑백</button><button id="btn-filter-sepia" class="tool-btn small" style="font-size:0.8rem; width:auto;">세피아</button></div></div><div style="position:relative; width:100%; height:400px; overflow:hidden; border:1px solid var(--border-color); border-radius:8px; background-color:#fff;"><canvas id="drawing-canvas"></canvas></div><div style="display:flex; gap:10px; margin-top:10px;"><button id="drawing-clear-btn" class="game-btn-secondary" style="flex:1;">지우기</button><button id="drawing-send-btn" class="game-btn-primary" style="flex:2;">전송</button></div></div></div>';
        document.body.appendChild(div);
        this.bindEvents();
    },

    bindEvents: function() {
        const modal = document.getElementById('drawing-modal');
        if(!modal) return;
        this.elements.modal = modal;
        this.elements.canvas = document.getElementById('drawing-canvas');
        this.ctx = this.elements.canvas.getContext('2d', { willReadFrequently: true });
        var self = this;

        this.elements.canvas.onmousedown = function(e) { self.startDrawing(e); };
        this.elements.canvas.onmousemove = function(e) { self.draw(e); };
        this.elements.canvas.onmouseup = function() { self.stopDrawing(); };
        this.elements.canvas.onmouseout = function() { self.stopDrawing(); };

        this.elements.canvas.ontouchstart = function(e) { e.preventDefault(); var t=e.touches[0]; self.startDrawing({clientX:t.clientX, clientY:t.clientY}); };
        this.elements.canvas.ontouchmove = function(e) { e.preventDefault(); var t=e.touches[0]; self.draw({clientX:t.clientX, clientY:t.clientY}); };
        this.elements.canvas.ontouchend = function() { self.stopDrawing(); };

        modal.querySelector('.game-close').onclick = function() { self.close(); };
        document.getElementById('drawing-clear-btn').onclick = function() { self.clearCanvas(); };
        document.getElementById('drawing-send-btn').onclick = function() { self.sendDrawing(); };
        document.getElementById('btn-undo').onclick = function() { self.undo(); };
        document.getElementById('btn-redo').onclick = function() { self.redo(); };
        
        document.getElementById('btn-add-img').onclick = function() { document.getElementById('drawing-img-input').click(); };
        document.getElementById('drawing-img-input').onchange = function(e) { self.handleImageUpload(e); };
        
        document.getElementById('btn-filter-gray').onclick = function() { self.applyFilter('grayscale'); };
        document.getElementById('btn-filter-sepia').onclick = function() { self.applyFilter('sepia'); };

        const colorPicker = document.getElementById('drawing-color-picker');
        colorPicker.onchange = function(e) { self.setColor(e.target.value); };
        
        const sizeSlider = document.getElementById('drawing-brush-size');
        sizeSlider.oninput = function(e) {
            self.currentSize = e.target.value;
            document.getElementById('brush-size-display').textContent = e.target.value;
        };

        ['pen', 'eraser', 'fill', 'text'].forEach(function(tool) {
            document.getElementById('tool-'+tool).onclick = function() {
                self.setTool(tool);
                self.updateActiveButton('tool-'+tool);
            };
        });

        const shapeBtn = document.getElementById('tool-shape');
        const shapeSelect = document.getElementById('shape-select');
        shapeBtn.onclick = function() { self.setTool('shape'); self.updateActiveButton('tool-shape'); };
        shapeSelect.onchange = function() { 
            self.currentShape = shapeSelect.value; 
            self.setTool('shape'); 
            self.updateActiveButton('tool-shape'); 
        };

        document.getElementById('line-style-select').onchange = function(e) {
            self.currentLineStyle = e.target.value;
        };

        this.initPalette();
    },

    updateActiveButton: function(activeId) {
        document.querySelectorAll('.tool-btn').forEach(function(b) { b.classList.remove('active'); });
        const btn = document.getElementById(activeId);
        if(btn) btn.classList.add('active');
        const textInput = document.getElementById('drawing-text-input');
        if(textInput) textInput.style.display = (activeId === 'tool-text') ? 'block' : 'none';
    },

    setTool: function(tool) {
        this.currentTool = tool;
        this.updateCursor();
    },

    updateCursor: function() {
        const cvs = this.elements.canvas;
        if (!cvs) return;
        switch (this.currentTool) {
            // [수정됨] 펜 커서 SVG 아이콘 적용 (0, 24 좌표가 펜 끝)
            case 'pen': 
                cvs.style.cursor = 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'black\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><path d=\'M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z\'/></svg>") 0 24, crosshair'; 
                break;

            case 'shape': cvs.style.cursor = 'crosshair'; break;
            case 'text': cvs.style.cursor = 'text'; break;
            case 'eraser': cvs.style.cursor = 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'20\' height=\'20\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'black\' stroke-width=\'2\'><circle cx=\'12\' cy=\'12\' r=\'10\'/></svg>") 10 10, auto'; break; 
            case 'fill': cvs.style.cursor = 'alias'; break; 
            default: cvs.style.cursor = 'default';
        }
    },

    open: function() {
        const modal = document.getElementById('drawing-modal');
        if(!modal) this.init(); 
        document.getElementById('drawing-modal').style.display = 'flex';
        var self = this;
        setTimeout(function() { self.resizeCanvas(); }, 50);
        if(this.history.length === 0) this.saveState();
    },

    close: function() { document.getElementById('drawing-modal').style.display = 'none'; },

    initPalette: function() {
        const colors = ['#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffffff', '#808080', '#ffa500', '#800080', '#008080'];
        const container = document.getElementById('drawing-palette');
        container.innerHTML = '';
        var self = this;
        colors.forEach(function(c) {
            const div = document.createElement('div');
            div.className = 'color-swatch'; div.style.backgroundColor = c;
            div.onclick = function() { self.setColor(c); document.querySelectorAll('.color-swatch').forEach(function(s) { s.classList.remove('active'); }); div.classList.add('active'); };
            container.appendChild(div);
        });
    },

    setColor: function(color) {
        this.currentColor = color;
        document.getElementById('drawing-color-picker').value = color;
    },

    resizeCanvas: function() {
        const cvs = this.elements.canvas;
        cvs.width = cvs.parentElement.clientWidth; cvs.height = 400;
        this.ctx.fillStyle = '#ffffff'; this.ctx.fillRect(0, 0, cvs.width, cvs.height);
        this.history = []; this.historyStep = -1;
        this.saveState();
    },

    // [수정된 함수] 화면 크기(rect)와 실제 해상도(width/height) 비율을 계산하여 좌표 보정
    getPos: function(e) {
        const cvs = this.elements.canvas;
        const rect = cvs.getBoundingClientRect();
        
        // 캔버스 비트맵 해상도 vs 화면 표시 크기 비율 계산
        const scaleX = cvs.width / rect.width;
        const scaleY = cvs.height / rect.height;

        return { 
            x: (e.clientX - rect.left) * scaleX, 
            y: (e.clientY - rect.top) * scaleY 
        };
    },

    startDrawing: function(e) {
        const pos = this.getPos(e);
        this.startX = pos.x; this.startY = pos.y;
        this.isDrawing = true;

        if (this.currentTool === 'fill') { this.floodFill(Math.floor(this.startX), Math.floor(this.startY), this.currentColor); this.saveState(); this.isDrawing = false; return; }
        if (this.currentTool === 'text') { this.addText(this.startX, this.startY); this.saveState(); this.isDrawing = false; return; }
        
        if (this.currentTool === 'shape') {
            this.snapshot = this.ctx.getImageData(0, 0, this.elements.canvas.width, this.elements.canvas.height);
        }

        this.ctx.beginPath();
        this.ctx.moveTo(this.startX, this.startY);
    },

    draw: function(e) {
        if (!this.isDrawing) return;
        const pos = this.getPos(e);
        const ctx = this.ctx;

        ctx.lineWidth = this.currentSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        if (this.currentLineStyle === 'dashed') ctx.setLineDash([10, 5]);
        else if (this.currentLineStyle === 'dotted') ctx.setLineDash([2, 5]);
        else ctx.setLineDash([]);

        if (this.currentTool === 'eraser') { ctx.strokeStyle = '#ffffff'; } 
        else { ctx.strokeStyle = this.currentColor; ctx.fillStyle = this.currentColor; }

        if (this.currentTool === 'pen' || this.currentTool === 'eraser') {
            ctx.lineTo(pos.x, pos.y); ctx.stroke();
        } 
        else if (this.currentTool === 'shape') {
            ctx.putImageData(this.snapshot, 0, 0);
            ctx.beginPath();
            const w = pos.x - this.startX;
            const h = pos.y - this.startY;

            if (this.currentShape === 'line') {
                ctx.moveTo(this.startX, this.startY); ctx.lineTo(pos.x, pos.y);
            } else if (this.currentShape === 'rect') {
                ctx.strokeRect(this.startX, this.startY, w, h);
            } else if (this.currentShape === 'circle') {
                const r = Math.sqrt(w*w + h*h);
                ctx.arc(this.startX, this.startY, r, 0, 2 * Math.PI);
            } else if (this.currentShape === 'triangle') {
                ctx.moveTo(this.startX + w/2, this.startY);
                ctx.lineTo(this.startX, this.startY + h);
                ctx.lineTo(this.startX + w, this.startY + h);
                ctx.closePath();
            } else if (this.currentShape === 'diamond') {
                ctx.moveTo(this.startX + w/2, this.startY);
                ctx.lineTo(this.startX + w, this.startY + h/2);
                ctx.lineTo(this.startX + w/2, this.startY + h);
                ctx.lineTo(this.startX, this.startY + h/2);
                ctx.closePath();
            } else if (this.currentShape === 'star') {
                this.drawStar(ctx, this.startX + w/2, this.startY + h/2, 5, Math.max(Math.abs(w), Math.abs(h))/2, Math.max(Math.abs(w), Math.abs(h))/4);
            } else if (this.currentShape === 'arrow') {
                this.drawArrow(ctx, this.startX, this.startY, pos.x, pos.y);
            }
            
            if (['triangle', 'diamond', 'star'].includes(this.currentShape)) ctx.stroke();
            else if (['line', 'rect', 'circle', 'arrow'].includes(this.currentShape)) ctx.stroke();
        }
    },

    stopDrawing: function() {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        this.ctx.closePath();
        this.saveState(); 
    },

    drawArrow: function(ctx, x1, y1, x2, y2) {
        const headlen = 15; 
        const angle = Math.atan2(y2 - y1, x2 - x1);
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
    },

    drawStar: function(ctx, cx, cy, spikes, outerRadius, innerRadius) {
        let rot = Math.PI / 2 * 3;
        let x = cx; let y = cy;
        const step = Math.PI / spikes;

        ctx.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius;
            y = cy + Math.sin(rot) * outerRadius;
            ctx.lineTo(x, y);
            rot += step;

            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            ctx.lineTo(x, y);
            rot += step;
        }
        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
    },

    floodFill: function(x, y, color) {
        const hexToRgb = function(hex) { const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex); return r ? [parseInt(r[1],16), parseInt(r[2],16), parseInt(r[3],16)] : [0,0,0]; };
        const fillRGB = hexToRgb(color);
        const imgData = this.ctx.getImageData(0,0,this.elements.canvas.width,this.elements.canvas.height);
        const data = imgData.data; const w = imgData.width;
        const startPos = (y*w+x)*4; const sr=data[startPos], sg=data[startPos+1], sb=data[startPos+2];
        if(sr===fillRGB[0] && sg===fillRGB[1] && sb===fillRGB[2]) return;
        const match = function(p) { return data[p]===sr && data[p+1]===sg && data[p+2]===sb; };
        const colorP = function(p) { data[p]=fillRGB[0]; data[p+1]=fillRGB[1]; data[p+2]=fillRGB[2]; data[p+3]=255; };
        const q = [[x,y]];
        while(q.length) {
            const pos = q.shift(); const cx = pos[0], cy = pos[1]; const p = (cy*w+cx)*4;
            if(match(p)) {
                colorP(p);
                if(cx>0) q.push([cx-1,cy]); if(cx<w-1) q.push([cx+1,cy]);
                if(cy>0) q.push([cx,cy-1]); if(cy<imgData.height-1) q.push([cx,cy+1]);
            }
        }
        this.ctx.putImageData(imgData, 0, 0);
    },

    addText: function(x, y) {
        const text = document.getElementById('drawing-text-input').value.trim();
        if (!text) return alert("상단 텍스트 입력창에 내용을 입력해주세요.");
        this.ctx.font = (this.currentSize * 3) + 'px "Noto Sans KR"';
        this.ctx.fillStyle = this.currentColor;
        this.ctx.fillText(text, x, y);
    },

    handleImageUpload: function(e) {
        const file = e.target.files[0]; if(!file) return;
        const reader = new FileReader();
        var self = this;
        reader.onload = function(evt) {
            const img = new Image();
            img.onload = function() {
                const ratio = Math.min(self.elements.canvas.width/img.width, self.elements.canvas.height/img.height)*0.8;
                const w = img.width*ratio; const h = img.height*ratio;
                self.ctx.drawImage(img, (self.elements.canvas.width-w)/2, (self.elements.canvas.height-h)/2, w, h);
                self.saveState();
            };
            img.src = evt.target.result;
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    },

    applyFilter: function(type) {
        const imgData = this.ctx.getImageData(0,0,this.elements.canvas.width,this.elements.canvas.height);
        const d = imgData.data;
        for(let i=0; i<d.length; i+=4) {
            const r=d[i], g=d[i+1], b=d[i+2];
            if(type==='grayscale') { const v = 0.34*r+0.5*g+0.16*b; d[i]=d[i+1]=d[i+2]=v; }
            else if(type==='sepia') { d[i]=r*0.393+g*0.769+b*0.189; d[i+1]=r*0.349+g*0.686+b*0.168; d[i+2]=r*0.272+g*0.534+b*0.131; }
        }
        this.ctx.putImageData(imgData, 0, 0);
        this.saveState();
    },

    saveState: function() {
        this.historyStep++;
        if(this.historyStep < this.history.length) this.history.length = this.historyStep;
        this.history.push(this.elements.canvas.toDataURL());
        if(this.history.length > this.MAX_HISTORY) { this.history.shift(); this.historyStep--; }
    },

    undo: function() { if(this.historyStep > 0) { this.historyStep--; this.restoreState(); } },
    redo: function() { if(this.historyStep < this.history.length - 1) { this.historyStep++; this.restoreState(); } },
    restoreState: function() {
        const img = new Image(); img.src = this.history[this.historyStep];
        var self = this;
        img.onload = function() { self.ctx.clearRect(0,0,self.elements.canvas.width,self.elements.canvas.height); self.ctx.drawImage(img,0,0); };
    },
    clearCanvas: function() {
        if(confirm("모두 지우시겠습니까?")) { 
            this.ctx.clearRect(0,0,this.elements.canvas.width,this.elements.canvas.height);
            this.ctx.fillStyle='#ffffff'; this.ctx.fillRect(0,0,this.elements.canvas.width,this.elements.canvas.height);
            this.saveState();
        }
    },
    sendDrawing: function() {
        var self = this;
        this.elements.canvas.toBlob(function(blob) {
            if(blob) {
                const file = new File([blob], 'drawing_'+Date.now()+'.png', { type: 'image/png' });
                App.EventBus.emit('file:process', file);
                self.close();
            }
        });
    }
};

/**
 * AI 매니저 (Pollinations.ai API 활용) - v3.3.0 (묘사 강화 버전)
 * - 텍스트: GPT-4o 계열 (프롬프트 엔지니어링 적용)
 * - 이미지: Flux 계열 (고품질 모델)
 */
App.AIManager = {
    // 텍스트 생성 (채팅 또는 프롬프트 최적화용)
    generateText: async function(prompt, systemRole = "") {
        try {
            const response = await fetch('https://text.pollinations.ai/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [
                        { role: 'system', content: systemRole },
                        { role: 'user', content: prompt }
                    ],
                    model: 'openai', 
                    seed: Math.floor(Math.random() * 1000)
                })
            });
            return await response.text();
        } catch (e) {
            console.error("AI Text Error:", e);
            return ""; 
        }
    },

    // [핵심 수정] 이미지 생성 함수
    // 단순 번역이 아니라, '시각적 묘사'를 생성하도록 로직 변경
    generateImage: async function(koreanPrompt) {
        let finalPrompt = koreanPrompt;

        // 1. 프롬프트 엔지니어링 (단순 번역 X -> 시각적 묘사 O)
        try {
            // AI에게 부여할 역할: 단순 번역가가 아니라 '프롬프트 엔지니어'
            const systemInstruction = 
                "You are an expert AI image prompt generator. " +
                "Your task is to convert the user's Korean input into a highly descriptive English prompt for Flux AI.\n" +
                "IMPORTANT RULES:\n" +
                "1. If the input is a specific food (e.g., '마라탕', '국밥', '청국장'), DO NOT just write the romanized name (like 'Malatang'). " +
                "   Instead, DESCRIBE its visual appearance in detail (e.g., 'Spicy red soup with chili oil, tofu, vegetables, meat, steam rising, delicious food photography').\n" +
                "2. If it is a character or object, describe the lighting, texture, and style.\n" +
                "3. Output ONLY the final English prompt text. Do not add explanations.";
            
            const enhancedPrompt = await this.generateText(koreanPrompt, systemInstruction);
            
            // 결과 검증 및 정제
            if (enhancedPrompt && enhancedPrompt.length > 0 && !enhancedPrompt.includes("AI 서버")) {
                // 불필요한 따옴표나 사족 제거
                let cleaned = enhancedPrompt.replace(/^(Here is|Sure|Output):?/i, "").trim();
                cleaned = cleaned.replace(/["\n\r]/g, '').trim();
                
                if (cleaned.length > 0) {
                    finalPrompt = cleaned;
                    console.log(`[AI 묘사 변환] "${koreanPrompt}" -> "${finalPrompt}"`);
                }
            }
        } catch (e) {
            console.warn("프롬프트 최적화 실패, 원본 사용:", e);
        }

        // 2. 이미지 URL 생성
        const encodedPrompt = encodeURIComponent(finalPrompt);
        const randomSeed = Math.floor(Math.random() * 1000000);
        
        // model=flux (최고 품질), nologo=true (워터마크 제거)
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?model=flux&seed=${randomSeed}&width=1024&height=1024&nologo=true`;
        
        return imageUrl;
    }
};

/**
 * 명령어 핸들러 (수정됨: 질문 표시, 로딩 문구 자동 삭제)
 */
App.CommandManager = {
    handle: function(text) {
        if (!text.startsWith('/')) return false;
        
        // 명령어 파싱
        const firstSpace = text.indexOf(' ');
        const cmd = firstSpace === -1 ? text : text.substring(0, firstSpace);
        const args = firstSpace === -1 ? '' : text.substring(firstSpace + 1).trim();

        // 1. AI 채팅 (/AI 질문)
        if (cmd.toLowerCase() === '/ai') {
            if (!args) {
                App.EventBus.emit('sendMessage', { text: '🤖 질문을 입력해주세요. 예: /ai 점심 메뉴 추천해줘', type: 'text' });
                return true;
            }

            // [수정1] 사용자의 질문을 채팅창에 먼저 표시
            App.EventBus.emit('sendMessage', { text: text, type: 'text' });

            // [수정2] '생각 중' 문구를 임시 메시지로 표시
            const tempId = 'ai-thinking-' + Date.now();
            App.EventBus.emit('message:addTemp', { 
                tempId: tempId,
                type: 'text', 
                text: '🤖 AI가 생각 중입니다...',
                senderName: 'AI',
                timestamp: Date.now()
            });
            
            // AI 호출
            App.AIManager.generateText(args, "You are a helpful assistant. Answer in Korean.").then(response => {
                // [수정2] 답변이 오면 '생각 중' 임시 메시지 삭제
                App.EventBus.emit('message:removeTemp', tempId);
                
                // 실제 답변 전송
                App.EventBus.emit('sendMessage', { text: `🤖 [AI 답변]\n${response}`, type: 'text' });
            });
            return true;
        }

        // 2. AI 그림 (/그림 설명)
        if (cmd === '/그림') {
            if (!args) {
                App.EventBus.emit('sendMessage', { text: '🎨 그림 주제를 입력해주세요. 예: /그림 우주를 나는 고양이', type: 'text' });
                return true;
            }

            // [수정1] 사용자의 요청을 채팅창에 표시
            App.EventBus.emit('sendMessage', { text: text, type: 'text' });

            // [수정2] '그리는 중' 문구를 임시 메시지로 표시
            const tempId = 'ai-drawing-' + Date.now();
            App.EventBus.emit('message:addTemp', { 
                tempId: tempId,
                type: 'text', 
                text: `🎨 그림을 그리는 중입니다...\n"${args}"`,
                senderName: 'AI',
                timestamp: Date.now()
            });
            
            // AI 호출 (번역 -> 생성)
            App.AIManager.generateImage(args).then(imageUrl => {
                // [수정2] 그림이 준비되면 임시 메시지 삭제
                App.EventBus.emit('message:removeTemp', tempId);

                // 이미지 전송
                App.EventBus.emit('sendMessage', { 
                    type: 'image', 
                    imageUrl: imageUrl, 
                    text: `🎨 AI 그림: ${args}` 
                });
            });
            return true;
        }

        // 3. 기타 유틸리티
        if (cmd === '/그림판') { App.DrawingManager.open(); return true; }
        if (cmd === '/사다리') { App.GameManager.openModal(); return true; }
        
        // [수정3] 주사위 및 동전 이모지 교체 (깨짐 방지)
        if (cmd === '/주사위') { 
            App.EventBus.emit('sendMessage', { text: text, type: 'text' }); 
            App.EventBus.emit('sendMessage', {text:'🎲 주사위: ' + (Math.floor(Math.random()*6)+1), type:'text'}); 
            return true; 
        }
        if (cmd === '/동전') { 
            App.EventBus.emit('sendMessage', { text: text, type: 'text' }); 
            App.EventBus.emit('sendMessage', {text:'💰 동전: ' + (Math.random()>0.5?'앞면':'뒷면'), type:'text'}); 
            return true; 
        }
        
        if (cmd === '/청소') { document.getElementById('message-list').innerHTML=''; return true; }
        if (cmd === '/도움말') { window.open('manual.html','manual','width=800,height=800'); return true; }
        
        return false;
    }
};

if(App.GameManager) App.GameManager.init();
if(App.DrawingManager) App.DrawingManager.init();
if(App.PollManager) App.PollManager.init();