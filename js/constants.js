// =================================================================================
// 1. 기초 설정 및 상수 (Constants & Utils) - [짤방/밈/인싸력 만렙 확장팩 v4.0]
// =================================================================================

// 1. 사용자 정보 파싱
const urlParams = new URLSearchParams(window.location.search);
const USER_NAME = urlParams.get('name') || '방문자';
const USER_RANK = urlParams.get('rank') || '';
const FULL_USER_NAME = (USER_RANK ? `${USER_NAME} ${USER_RANK}` : USER_NAME).replace(/"/g, '');
const USER_ID = FULL_USER_NAME;

// 2. Firebase 설정
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCdZBZjG4Xff-Xm-L7_phiSbHRRrcwPi24",
    authDomain: "portal-chat-29465.firebaseapp.com",
    databaseURL: "https://portal-chat-29465-default-rtdb.firebaseio.com",
    projectId: "portal-chat-29465",
    storageBucket: "portal-chat-29465.firebasestorage.app",
    messagingSenderId: "86893876349",
    appId: "1:86893876349:web:09404675c760a0fc32cd14"
};

if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    try {
        firebase.initializeApp(FIREBASE_CONFIG);
        console.log("Firebase Initialized.");
    } catch (e) {
        console.error("Firebase Init Error:", e);
    }
}

// 3. App 객체 초기화
window.App = {};
const App = window.App;

// ★ CDN 기본 경로 (Microsoft 3D Animated Emoji)
// 고품질 3D 이모지를 짤방처럼 활용합니다.
const STICKER_BASE_URL = "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis";

App.Constants = {
    NOTI_ICON: "https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@latest/assets/Bell/3D/bell_3d.png",
    
    // 1. 텍스트 이모지 (기본)
    EMOJI_CATEGORIES: {
        "😀 표정": ['😀','😁','😂','🤣','😊','😇','🙂','😉','😍','🥰','😘','🤗','🤔','😐','😑','🙄','😬','😔','😪','😴','😷','🤒','🤯','😎','🤓','🧐','😟','😮','😭','😱','😤','😡','🤬','💀','👻','💩'],
        "👋 제스처": ['👋','👌','✌️','🤞','🤟','🤙','👈','👉','👆','👇','👍','👎','✊','👊','👏','🙌','🤝','🙏','💪','👀','👄','🙅','🙆','💁','🙋','🙇','🤦','🤷']
    },

    // 2. 움직이는 스티커 (밈/유행어 반영 리네이밍)
    ANIMATED_STICKERS: {
        // ★ [NEW] 밈/짤방 전용 카테고리
        "🔥 전설의 짤/밈": [
            { name: "가보자고", url: `${STICKER_BASE_URL}/Smilies/Saluting%20Face.png` },
            { name: "팝콘각", url: `${STICKER_BASE_URL}/Food/Popcorn.png` },
            { name: "엄근진", url: `${STICKER_BASE_URL}/Smilies/Face%20with%20Monocle.png` },
            { name: "금융치료", url: `${STICKER_BASE_URL}/Smilies/Money-Mouth%20Face.png` },
            { name: "흐린눈", url: `${STICKER_BASE_URL}/Smilies/Face%20with%20Peeking%20Eye.png` },
            { name: "입틀막", url: `${STICKER_BASE_URL}/Smilies/Face%20with%20Hand%20Over%20Mouth.png` },
            { name: "쉿", url: `${STICKER_BASE_URL}/Smilies/Shushing%20Face.png` },
            { name: "투명인간", url: `${STICKER_BASE_URL}/Smilies/Dotted%20Line%20Face.png` },
            { name: "뇌절", url: `${STICKER_BASE_URL}/Smilies/Exploding%20Head.png` },
            { name: "나죽어", url: `${STICKER_BASE_URL}/Smilies/Skull.png` },
            { name: "유령회원", url: `${STICKER_BASE_URL}/Smilies/Ghost.png` },
            { name: "외계어", url: `${STICKER_BASE_URL}/Smilies/Alien.png` },
            { name: "똥망", url: `${STICKER_BASE_URL}/Smilies/Pile%20of%20Poo.png` },
            { name: "피노키오", url: `${STICKER_BASE_URL}/Smilies/Lying%20Face.png` },
            { name: "광대", url: `${STICKER_BASE_URL}/Smilies/Clown%20Face.png` }
            // [TIP] 여기에 인터넷 짤방(gif/jpg) 링크를 직접 넣어도 됩니다!
            // { name: "페페", url: "https://example.com/sad-frog.gif" }
        ],
        "🤪 킹받음/엽기": [
            { name: "메롱", url: `${STICKER_BASE_URL}/Smilies/Face%20Savoring%20Food.png` },
            { name: "거꾸로", url: `${STICKER_BASE_URL}/Smilies/Upside-Down%20Face.png` },
            { name: "지퍼", url: `${STICKER_BASE_URL}/Smilies/Zipper-Mouth%20Face.png` },
            { name: "모아이", url: `${STICKER_BASE_URL}/Objects/Moai.png` },
            { name: "로봇", url: `${STICKER_BASE_URL}/Smilies/Robot.png` },
            { name: "헤롱헤롱", url: `${STICKER_BASE_URL}/Smilies/Zany%20Face.png` },
            { name: "알딸딸", url: `${STICKER_BASE_URL}/Smilies/Woozy%20Face.png` },
            { name: "변장", url: `${STICKER_BASE_URL}/Smilies/Disguised%20Face.png` },
            { name: "눈굴리기", url: `${STICKER_BASE_URL}/Smilies/Face%20with%20Rolling%20Eyes.png` },
            { name: "눈썹꿈틀", url: `${STICKER_BASE_URL}/Smilies/Face%20with%20Raised%20Eyebrow.png` }
        ],
        "😎 인싸/플렉스": [
            { name: "선글라스", url: `${STICKER_BASE_URL}/Smilies/Smiling%20Face%20with%20Sunglasses.png` },
            { name: "돈주머니", url: `${STICKER_BASE_URL}/Objects/Money%20Bag.png` },
            { name: "왕관", url: `${STICKER_BASE_URL}/Objects/Crown.png` },
            { name: "보석", url: `${STICKER_BASE_URL}/Objects/Gem%20Stone.png` },
            { name: "트로피", url: `${STICKER_BASE_URL}/Activities/Trophy.png` },
            { name: "1등", url: `${STICKER_BASE_URL}/Activities/1st%20Place%20Medal.png` },
            { name: "로켓", url: `${STICKER_BASE_URL}/Travel%20and%20places/Rocket.png` },
            { name: "불꽃", url: `${STICKER_BASE_URL}/Travel%20and%20places/Fire.png` },
            { name: "반짝", url: `${STICKER_BASE_URL}/Activities/Sparkles.png` },
            { name: "파티", url: `${STICKER_BASE_URL}/Activities/Party%20Popper.png` }
        ],
        "🥰 럽스타그램": [
            { name: "하트뿅", url: `${STICKER_BASE_URL}/Smilies/Smiling%20Face%20with%20Hearts.png` },
            { name: "키스", url: `${STICKER_BASE_URL}/Smilies/Face%20Blowing%20a%20Kiss.png` },
            { name: "하트손", url: `${STICKER_BASE_URL}/Hand%20gestures/Heart%20Hands.png` },
            { name: "손가락하트", url: `${STICKER_BASE_URL}/Hand%20gestures/Hand%20with%20Index%20Finger%20and%20Thumb%20Crossed.png` },
            { name: "심쿵", url: `${STICKER_BASE_URL}/Smilies/Star-Struck.png` },
            { name: "천사", url: `${STICKER_BASE_URL}/Smilies/Smiling%20Face%20with%20Halo.png` },
            { name: "포옹", url: `${STICKER_BASE_URL}/Smilies/Hugging%20Face.png` },
            { name: "불타는사랑", url: `${STICKER_BASE_URL}/Smilies/Heart%20on%20Fire.png` },
            { name: "반지", url: `${STICKER_BASE_URL}/Objects/Ring.png` }
        ],
        "🐼 동물농장": [
            { name: "박스냥", url: `${STICKER_BASE_URL}/Animals/Cat%20Face.png` },
            { name: "강아지", url: `${STICKER_BASE_URL}/Animals/Dog%20Face.png` },
            { name: "안내견", url: `${STICKER_BASE_URL}/Animals/Guide%20Dog.png` },
            { name: "곰돌이", url: `${STICKER_BASE_URL}/Animals/Bear.png` },
            { name: "토끼", url: `${STICKER_BASE_URL}/Animals/Rabbit%20Face.png` },
            { name: "여우", url: `${STICKER_BASE_URL}/Animals/Fox.png` },
            { name: "팬더", url: `${STICKER_BASE_URL}/Animals/Panda.png` },
            { name: "나무늘보", url: `${STICKER_BASE_URL}/Animals/Sloth.png` },
            { name: "수달", url: `${STICKER_BASE_URL}/Animals/Otter.png` },
            { name: "병아리", url: `${STICKER_BASE_URL}/Animals/Hatching%20Chick.png` },
            { name: "펭귄", url: `${STICKER_BASE_URL}/Animals/Penguin.png` },
            { name: "거북이", url: `${STICKER_BASE_URL}/Animals/Turtle.png` },
            { name: "유니콘", url: `${STICKER_BASE_URL}/Animals/Unicorn.png` },
            { name: "티라노", url: `${STICKER_BASE_URL}/Animals/T-Rex.png` },
            { name: "용", url: `${STICKER_BASE_URL}/Animals/Dragon.png` }
        ],
        "😭 멘붕/분노": [
            { name: "엉엉", url: `${STICKER_BASE_URL}/Smilies/Loudly%20Crying%20Face.png` },
            { name: "제발", url: `${STICKER_BASE_URL}/Smilies/Pleading%20Face.png` },
            { name: "이마탁", url: `${STICKER_BASE_URL}/People/Person%20Facepalming.png` },
            { name: "어깨으쓱", url: `${STICKER_BASE_URL}/People/Person%20Shrugging.png` },
            { name: "극대노", url: `${STICKER_BASE_URL}/Smilies/Enraged%20Face.png` },
            { name: "욕함", url: `${STICKER_BASE_URL}/Smilies/Face%20with%20Symbols%20on%20Mouth.png` },
            { name: "우웩", url: `${STICKER_BASE_URL}/Smilies/Face%20Vomiting.png` },
            { name: "졸림", url: `${STICKER_BASE_URL}/Smilies/Sleeping%20Face.png` },
            { name: "한숨", url: `${STICKER_BASE_URL}/Smilies/Face%20Exhaling.png` },
            { name: "콧김", url: `${STICKER_BASE_URL}/Smilies/Face%20with%20Steam%20From%20Nose.png` },
            { name: "땀", url: `${STICKER_BASE_URL}/Smilies/Downcast%20Face%20with%20Sweat.png` },
            { name: "공포", url: `${STICKER_BASE_URL}/Smilies/Fearful%20Face.png` }
        ],
        "👍 리액션/제스처": [
            { name: "최고", url: `${STICKER_BASE_URL}/Hand%20gestures/Thumbs%20Up.png` },
            { name: "비추", url: `${STICKER_BASE_URL}/Hand%20gestures/Thumbs%20Down.png` },
            { name: "OK", url: `${STICKER_BASE_URL}/Hand%20gestures/OK%20Hand.png` },
            { name: "하이", url: `${STICKER_BASE_URL}/Hand%20gestures/Waving%20Hand.png` },
            { name: "박수", url: `${STICKER_BASE_URL}/Hand%20gestures/Clapping%20Hands.png` },
            { name: "만세", url: `${STICKER_BASE_URL}/Hand%20gestures/Raising%20Hands.png` },
            { name: "기도", url: `${STICKER_BASE_URL}/Hand%20gestures/Folded%20Hands.png` },
            { name: "악수", url: `${STICKER_BASE_URL}/Hand%20gestures/Handshake.png` },
            { name: "화이팅", url: `${STICKER_BASE_URL}/Hand%20gestures/Flexed%20Biceps.png` },
            { name: "행운", url: `${STICKER_BASE_URL}/Hand%20gestures/Crossed%20Fingers.png` },
            { name: "전화해", url: `${STICKER_BASE_URL}/Hand%20gestures/Call%20Me%20Hand.png` },
            { name: "주먹", url: `${STICKER_BASE_URL}/Hand%20gestures/Oncoming%20Fist.png` },
            { name: "브이", url: `${STICKER_BASE_URL}/Hand%20gestures/Victory%20Hand.png` }
        ],
        "🍔 냠냠/취미": [
            { name: "맥주", url: `${STICKER_BASE_URL}/Food/Beer%20Mug.png` },
            { name: "건배", url: `${STICKER_BASE_URL}/Food/Clinking%20Beer%20Mugs.png` },
            { name: "피자", url: `${STICKER_BASE_URL}/Food/Pizza.png` },
            { name: "치킨", url: `${STICKER_BASE_URL}/Food/Poultry%20Leg.png` },
            { name: "버거", url: `${STICKER_BASE_URL}/Food/Hamburger.png` },
            { name: "커피", url: `${STICKER_BASE_URL}/Food/Hot%20Beverage.png` },
            { name: "케이크", url: `${STICKER_BASE_URL}/Food/Birthday%20Cake.png` },
            { name: "게임", url: `${STICKER_BASE_URL}/Activities/Video%20Game.png` },
            { name: "노래", url: `${STICKER_BASE_URL}/Objects/Microphone.png` },
            { name: "음악", url: `${STICKER_BASE_URL}/Objects/Headphone.png` },
            { name: "개발", url: `${STICKER_BASE_URL}/People/Technologist.png` },
            { name: "운동", url: `${STICKER_BASE_URL}/Activities/Boxing%20Glove.png` }
        ]
    },

    USER_COLORS: ['#D32F2F', '#C2185B', '#7B1FA2', '#303F9F', '#1976D2', '#00796B', '#388E3C', '#F57C00', '#E64A19', '#5D4037', '#455A64'],
    REACTION_EMOJIS: ['👍', '👎', '❤️', '😂', '😮', '😢', '🔥', '🙏', '🤔', '💯']
};

App.Utils = {
    getUserColor: function(name) {
        if (!name) return '#000000';
        const safeName = String(name).replace(/"/g, '');
        let hash = 0;
        for (let i = 0; i < safeName.length; i++) { hash = safeName.charCodeAt(i) + ((hash << 5) - hash); }
        const index = Math.abs(hash) % App.Constants.USER_COLORS.length;
        return App.Constants.USER_COLORS[index];
    },
    escapeHTML: function(str, type = 'text') {
        if (typeof str !== 'string') return '';
        const replacements = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        if (type === 'attr') { return str.replace(/[&<>"']/g, match => replacements[match]); }
        return str.replace(/[&<>]/g, match => replacements[match]);
    },
    unescapeHTML: function(str) {
        if (typeof str !== 'string') return '';
        const replacements = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
        return str.replace(/(&amp;|&lt;|&gt;|&quot;|&#39;)/g, match => replacements[match]);
    },
    isOnlyEmoji: function(str) {
        if (!str) return false;
        const trimmed = str.replace(/\s/g, '');
        if (trimmed.length === 0) return false;
        const emojiRegex = /^(\p{Emoji_Presentation}|\p{Extended_Pictographic})+$/u;
        return emojiRegex.test(trimmed) && [...trimmed].length <= 3;
    },
    
    // ★ [업그레이드] 마크다운, 멘션, 링크 처리
    formatMessageWithLinks: function(text) {
        if (!text) return '';
        
        let formatted = text;

        // 1. 마크다운 처리 (Markdown)
        formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre class="code-block">$1</pre>');
        formatted = formatted.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
        formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
        formatted = formatted.replace(/~~([^~]+)~~/g, '<del>$1</del>');

        // 2. 멘션 처리 (@이름)
        formatted = formatted.replace(/(^|\s)(@[\w가-힣]+)/g, '$1<span class="mention">$2</span>');

        // 3. 링크 변환
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        
        return formatted.replace(urlRegex, (url) => {
            if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
                const videoId = url.includes('v=') ? url.split('v=')[1].split('&')[0] : url.split('/').pop();
                return `<div class="video-container"><iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe></div>`;
            }
            else if (url.match(/\.(jpeg|jpg|gif|png|webp)$/) != null) {
                // 스티커 이미지 클래스 적용 (사이즈 조절됨)
                return `<a href="${url}" target="_blank"><img src="${url}" class="sticker-img"></a>`;
            }
            else {
                let domain = '';
                try { domain = new URL(url).hostname; } catch(e) { domain = 'Link'; }
                return `<a href="${url}" target="_blank" class="link-card-preview">
                            <span class="link-icon">🔗</span>
                            <div class="link-info">
                                <span class="link-domain">${domain}</span>
                                <span class="link-url">${url}</span>
                            </div>
                        </a>`;
            }
        });
    }
};