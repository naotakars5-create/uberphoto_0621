// Lightweight i18n for the tourist-facing pages (landing / booking / gallery).
// Staff-facing pages (photographer / operator) stay Japanese.
const I18N = {
  ja: {
    // --- shared ---
    nav_back: 'ホームに戻る',
    badge_guest: 'ゲスト',

    // --- landing ---
    hero_eyebrow: '観光客 × カメラマン',
    hero_h1: '旅の一瞬を、<br>作品に変える。',
    hero_sub: '近くのプロと、その場でマッチング。30分で、自然な一枚を。',
    hero_badge: '満足度',
    live_checking: 'いまの待機状況を確認中…',
    live_online: 'いま全国で <b>{n}人</b> のプロが待機中',
    live_next: '次の試験運用は土日 14:00–18:00',
    stat_rating: '平均評価',
    stat_shots: '撮影実績',
    stat_min_unit: '分',
    stat_receive: 'で受け取り',
    cta_order_now: '今すぐ撮影を頼む',
    cta_join: 'カメラマンとして参加',
    areas_head: '対応エリア',
    areas_more: '撮影を頼む ›',
    how_head: 'かんたん3ステップ',
    how1_t: '今すぐリクエスト', how1_d: 'プランを選んで、その場で依頼。事前予約は不要。',
    how2_t: '近くのプロとマッチ', how2_d: '待機中のカメラマンが数分で合流します。',
    how3_t: 'その場で受け取り', how3_d: '撮ってすぐ共有。アプリでかんたん編集も。',
    featured_head: '近くのカメラマン',
    featured_more: 'すべて見る ›',
    samples_head: '撮れる写真',
    trust1: '本人確認済み', trust2: '満足保証', trust3: '写真はあなたに',
    cta_start: '撮影をはじめる',
    op_role_t: 'オペレーター画面', op_role_d: 'エリアの需給をリアルタイムで見る',
    install_text: '<b>UberPHOTO</b> をホーム画面に追加して、アプリのように使えます。',
    install_text_ios: '<b>UberPHOTO</b> は共有メニューの「ホーム画面に追加」でアプリのように使えます。',
    install_btn: '追加',
    footnote: '東京・京都・大阪ほか 全国の観光地に対応 ／ β運用中',
    onb_skip: 'スキップ', onb_next: '次へ', onb_start: 'はじめる',
    onb1_t: '旅の一瞬を、作品に。', onb1_d: '観光地で、近くのプロカメラマンにその場で撮影を依頼できます。',
    onb2_t: '選んで、数分でお迎え。', onb2_d: '近くの2〜3人から選ぶか「おまかせ」で最短のプロに。地図で到着までわかります。',
    onb3_t: '撮ってすぐ受け取り。', onb3_d: 'レタッチ不要。その場で全データを受け取り、アプリでかんたん編集も。',

    // --- customer: plan step ---
    cp_eyebrow: 'プランを選ぶ',
    cp_h1: 'プランを選ぶ',
    cp_sub: '税込価格・レタッチ不要・その場で受け取り。',
    chip_30min: '30分', chip_instant: '即マッチ', chip_verified: '本人確認済み',
    label_name: 'お名前（ニックネーム可）', ph_name: '例：たろう',
    label_area: 'エリア（都道府県）',
    label_spot: '撮影スポット',
    map_cap_default: 'ピンをタップ、または下から選択',
    spot_hint_default: 'スポットを選ぶと、きれいに撮れる時間帯のヒントが出ます',
    details_head: '撮影の詳細', details_optional: '任意',
    label_people: '人数', label_scene: 'シーン（複数選択OK）',
    label_request: 'カメラマンへの要望', ph_request: '例：赤いコートで雷門の前にいます／カップル写真メインで',
    included_head: '含まれるもの',
    feat1_t: 'プロ機材で撮影', feat1_d: '一眼の自然光ポートレート・スナップ',
    feat2_t: 'その場で即共有', feat2_d: '撮ってすぐ、スマホに全データ',
    feat3_t: 'かんたん編集つき', feat3_d: '明るさ・色味をワンタップ調整',
    feat4_t: '写真の権利はあなたに', feat4_d: 'SNS掲載・印刷も自由',
    work_head: '撮れる写真',
    cta_pick_plan: 'プランを選択してください',
    cta_enter_name: 'お名前を入力してください',
    btn_order: '依頼する',
    plan_min_shots: '{min}分/{shots}枚',
    spot_select_default: '{area}のスポットを選ぶ…',
    map_cap_area: '{area}・ピンをタップして選択',

    // --- customer: confirm step ---
    confirm_eyebrow: '確認', confirm_h1: 'ご依頼内容の確認',
    confirm_sub: '内容をご確認ください。お支払いは確定後です。',
    sum_plan: 'プラン', sum_shots: '枚数', sum_min: '撮影時間', sum_loc: '撮影スポット',
    sum_people: '人数', sum_scene: 'シーン', sum_note: '要望', sum_name: 'お名前',
    sum_subtotal: '小計（税抜）', sum_tax: '消費税 (10%)', sum_total: '合計',
    chip_retouch: 'レタッチ不要・即共有', chip_alldata: '全データお渡し',
    btn_confirm_pay: 'この内容で決済して依頼', btn_edit: '内容を修正する',
    paying: '決済処理中…',
    unit_shots: '枚', unit_min: '分',

    // --- customer: select step ---
    sel_eyebrow: '近くのプロ', sel_h1: 'カメラマンを選ぶ',
    near_count: '近くに{n}人', near_standby: '待機中', comm_error: '通信エラー',
    btn_choose: '選ぶ', unit_shoots: '件', verified_title: '本人確認済み',
    notify_set: 'カメラマンが見つかったら通知します',
    omakase_t: 'おまかせ・最短のプロ', omakase_d: 'いちばん早く来られるカメラマンに即依頼',
    omakase_desc: '最短 {name} さん・約{eta}分でお迎え',
    or_pick: 'または、指名して選ぶ',
    back_to_plan: 'プラン選択に戻る',
    pick_eta: '{km}km · 約{eta}分でお迎え',
    area_match: '{area}対応',
    err_title: '通信エラーが発生しました', err_desc: 'ネットワーク環境をご確認のうえ、もう一度お試しください。',
    retry: '再読み込み',
    none_title: 'いま近くに待機中のカメラマンがいません',
    none_desc: '土日 14:00–18:00 の混雑時間は見つかりやすくなります。少し時間をおいて再検索してください。',
    research: 'もう一度さがす', notify_when: '空き次第、通知を受け取る',

    // --- customer: arriving / matched ---
    arr_eyebrow: '向かっています', arr_h1: '向かっています', arr_sub: 'カメラマンがお迎えに向かっています',
    st_match: 'マッチ', st_go: '向かう', st_shoot: '撮影', st_deliver: 'お届け',
    eta_label: '到着まで', moving: '移動中',
    btn_reselect: '別の人にする', btn_cancel_req: '依頼をやめる',
    del_eyebrow: 'お届け', del_h1: '写真が届きます',
    soon_join: 'まもなく合流します',
    matched_waitphoto: '撮影が終わると、ここに写真が届きます',
    btn_view_photos: '写真を見る',
    meta_from: '{km}km 先から', status_shooting: '撮影中',
    eta_arrived: '到着', arr_soon: 'まもなく到着',
    photos_arrived_title: '写真が届きました', photos_arrived_status: '📸 {n}枚 届きました',
    complete_title: '撮影完了', complete_status: '✅ 撮影完了',
    portfolio_head: '作例', reviews_head: 'レビュー', unit_photos: '枚',
    sheet_select: '{name} さんで撮影する', sheet_shoots: '{n}件の撮影', btn_close: '閉じる',
    notif_otw: '{name}さんが向かっています', notif_photos: '写真が{n}枚届きました',
    notif_complete: '撮影が完了しました。写真を確認しましょう。',
    err_busy: 'このカメラマンは他の依頼に対応中です',

    // --- customer: review / tip ---
    rv_head: '撮影はいかがでしたか？', rv_who: 'カメラマンを評価しましょう',
    rv_who_named: '{name} さんはいかがでしたか？',
    ph_review: '感想をひとこと（任意）', btn_review: 'レビューを送る',
    rv_thanks: 'ご評価ありがとうございました！',
    tip_head: 'チップを贈る', tip_who: 'よかったら感謝の気持ちをカメラマンへ（任意）',
    tip_who_named: 'よかったら感謝の気持ちを {name} さんへ（任意）',
    btn_tip: 'チップを贈る', tip_thanks: '{amount} のチップをありがとうございました！',

    // --- customer: chat ---
    chat_sub: '合流前のやりとりにどうぞ', ph_chat: 'メッセージを入力…',
    chat_default_name: 'カメラマン',

    // --- gallery ---
    g_eyebrow: 'あなたの写真', g_title: 'あなたの写真',
    g_empty: 'まだ写真が届いていません。撮影が終わるとここに表示されます。',
    g_save_fav: 'お気に入りを保存', g_save_all: '全部保存', g_share: '共有', g_refresh: '更新',
    g_hint: 'ハートでお気に入り、タップでかんたん編集',
    g_edit_eyebrow: '編集', g_edit_h1: 'かんたん編集',
    g_brightness: '明るさ', g_contrast: 'コントラスト', g_saturate: '彩度', g_warmth: '暖かみ',
    g_save_this: 'この写真を保存', g_back: 'ギャラリーに戻る',

    // --- dynamic option lists ---
    people_opts: ['1人', '2人', '3〜4人', '5人以上'],
    scene_opts: ['記念', 'カップル', '家族', '友達', 'ソロ活', 'プロフィール'],
    plan_names: { light: 'ライト', standard: 'スタンダード', premium: 'プレミアム' },
    plan_tags: { standard: '人気 No.1', premium: 'いちばん多く撮れる' },
    plan_blurb: '{min}分 / {shots}枚 · 撮ってすぐ共有',
  },

  en: {
    nav_back: 'Back to home',
    badge_guest: 'Guest',

    hero_eyebrow: 'Tourist × Photographer',
    hero_h1: 'Turn travel moments<br>into art.',
    hero_sub: 'Match instantly with a nearby pro. Natural shots in 30 minutes.',
    hero_badge: 'Satisfaction',
    live_checking: 'Checking who’s available…',
    live_online: '<b>{n} pros</b> on standby across Japan',
    live_next: 'Next trial: weekends 14:00–18:00',
    stat_rating: 'Avg. rating',
    stat_shots: 'Shoots done',
    stat_min_unit: 'min',
    stat_receive: 'to receive',
    cta_order_now: 'Book a shoot now',
    cta_join: 'Join as a photographer',
    areas_head: 'Coverage areas',
    areas_more: 'Book ›',
    how_head: 'Three easy steps',
    how1_t: 'Request instantly', how1_d: 'Pick a plan and book on the spot. No reservation needed.',
    how2_t: 'Match a nearby pro', how2_d: 'An available photographer joins you in minutes.',
    how3_t: 'Get them on the spot', how3_d: 'Shared right after the shoot. Easy in-app editing too.',
    featured_head: 'Photographers near you',
    featured_more: 'See all ›',
    samples_head: 'Sample photos',
    trust1: 'ID verified', trust2: 'Satisfaction guaranteed', trust3: 'Photos are yours',
    cta_start: 'Start a shoot',
    op_role_t: 'Operator console', op_role_d: 'See live supply & demand by area',
    install_text: 'Add <b>UberPHOTO</b> to your home screen to use it like an app.',
    install_text_ios: 'Add <b>UberPHOTO</b> via the Share menu → “Add to Home Screen”.',
    install_btn: 'Add',
    footnote: 'Tokyo, Kyoto, Osaka & tourist spots nationwide · Beta',
    onb_skip: 'Skip', onb_next: 'Next', onb_start: 'Get started',
    onb1_t: 'Travel moments, as art.', onb1_d: 'Book a nearby pro photographer on the spot at tourist destinations.',
    onb2_t: 'Choose, met in minutes.', onb2_d: 'Pick from 2–3 nearby pros or let us auto-match the fastest. Track arrival on the map.',
    onb3_t: 'Receive instantly.', onb3_d: 'No retouching needed. Get all your data on the spot, with easy in-app editing.',

    cp_eyebrow: 'Choose your plan',
    cp_h1: 'Choose your plan',
    cp_sub: 'Tax included · no retouching · received on the spot.',
    chip_30min: '30 min', chip_instant: 'Instant match', chip_verified: 'ID verified',
    label_name: 'Your name (nickname OK)', ph_name: 'e.g. Taro',
    label_area: 'Area (prefecture)',
    label_spot: 'Shooting spot',
    map_cap_default: 'Tap a pin, or pick below',
    spot_hint_default: 'Pick a spot to see the best time of day for great photos',
    details_head: 'Shoot details', details_optional: 'optional',
    label_people: 'People', label_scene: 'Scene (multiple OK)',
    label_request: 'Request to the photographer', ph_request: 'e.g. I’m in a red coat by Kaminarimon / mainly couple shots',
    included_head: 'What’s included',
    feat1_t: 'Pro gear', feat1_d: 'Natural-light portraits & snaps on a DSLR',
    feat2_t: 'Instant sharing', feat2_d: 'All data to your phone, right away',
    feat3_t: 'Easy editing', feat3_d: 'One-tap brightness & color tweaks',
    feat4_t: 'Photos are yours', feat4_d: 'Post on social or print freely',
    work_head: 'Sample photos',
    cta_pick_plan: 'Please choose a plan',
    cta_enter_name: 'Please enter your name',
    btn_order: 'Request',
    plan_min_shots: '{min}min/{shots} shots',
    spot_select_default: 'Choose a spot in {area}…',
    map_cap_area: '{area} · tap a pin to choose',

    confirm_eyebrow: 'Confirm', confirm_h1: 'Confirm your request',
    confirm_sub: 'Please review. Payment happens after you confirm.',
    sum_plan: 'Plan', sum_shots: 'Photos', sum_min: 'Duration', sum_loc: 'Spot',
    sum_people: 'People', sum_scene: 'Scene', sum_note: 'Request', sum_name: 'Name',
    sum_subtotal: 'Subtotal', sum_tax: 'Tax (10%)', sum_total: 'Total',
    chip_retouch: 'No retouching · instant share', chip_alldata: 'All data included',
    btn_confirm_pay: 'Pay & request', btn_edit: 'Edit details',
    paying: 'Processing…',
    unit_shots: ' shots', unit_min: ' min',

    sel_eyebrow: 'Nearby', sel_h1: 'Choose a photographer',
    near_count: '{n} nearby', near_standby: 'on standby', comm_error: 'Network error',
    btn_choose: 'Choose', unit_shoots: ' shoots', verified_title: 'ID verified',
    notify_set: 'We’ll notify you when a photographer is available',
    omakase_t: 'Auto · fastest pro', omakase_d: 'Instantly book the photographer who can arrive soonest',
    omakase_desc: 'Fastest: {name} · ~{eta} min away',
    or_pick: 'or pick one yourself',
    back_to_plan: 'Back to plan',
    pick_eta: '{km}km · ~{eta} min away',
    area_match: 'covers {area}',
    err_title: 'A network error occurred', err_desc: 'Please check your connection and try again.',
    retry: 'Reload',
    none_title: 'No photographers on standby nearby right now',
    none_desc: 'Weekends 14:00–18:00 are the easiest times. Please try again shortly.',
    research: 'Search again', notify_when: 'Notify me when available',

    arr_eyebrow: 'On the way', arr_h1: 'On the way', arr_sub: 'Your photographer is heading over',
    st_match: 'Match', st_go: 'En route', st_shoot: 'Shoot', st_deliver: 'Deliver',
    eta_label: 'until arrival', moving: 'En route',
    btn_reselect: 'Choose someone else', btn_cancel_req: 'Cancel request',
    del_eyebrow: 'Delivery', del_h1: 'Your photos are coming',
    soon_join: 'Joining you shortly',
    matched_waitphoto: 'Your photos will appear here after the shoot',
    btn_view_photos: 'View photos',
    meta_from: '{km}km away', status_shooting: 'Shooting',
    eta_arrived: 'Arrived', arr_soon: 'Arriving soon',
    photos_arrived_title: 'Your photos arrived', photos_arrived_status: '📸 {n} photos arrived',
    complete_title: 'Shoot complete', complete_status: '✅ Shoot complete',
    portfolio_head: 'Portfolio', reviews_head: 'Reviews', unit_photos: '',
    sheet_select: 'Shoot with {name}', sheet_shoots: '{n} shoots', btn_close: 'Close',
    notif_otw: '{name} is on the way', notif_photos: '{n} photos delivered',
    notif_complete: 'Your shoot is complete. Check your photos!',
    err_busy: 'This photographer is busy with another request',

    rv_head: 'How was your shoot?', rv_who: 'Rate your photographer',
    rv_who_named: 'How was {name}?',
    ph_review: 'A quick note (optional)', btn_review: 'Submit review',
    rv_thanks: 'Thanks for your review!',
    tip_head: 'Leave a tip', tip_who: 'Show your appreciation to the photographer (optional)',
    tip_who_named: 'Show your appreciation to {name} (optional)',
    btn_tip: 'Send tip', tip_thanks: 'Thanks for the {amount} tip!',

    chat_sub: 'Chat before you meet up', ph_chat: 'Type a message…',
    chat_default_name: 'Photographer',

    g_eyebrow: 'Your photos', g_title: 'Your photos',
    g_empty: 'No photos yet. They’ll appear here once the shoot is done.',
    g_save_fav: 'Save favorites', g_save_all: 'Save all', g_share: 'Share', g_refresh: 'Refresh',
    g_hint: 'Heart to favorite, tap to edit',
    g_edit_eyebrow: 'Edit', g_edit_h1: 'Quick edit',
    g_brightness: 'Brightness', g_contrast: 'Contrast', g_saturate: 'Saturation', g_warmth: 'Warmth',
    g_save_this: 'Save this photo', g_back: 'Back to gallery',

    people_opts: ['1', '2', '3–4', '5+'],
    scene_opts: ['Memory', 'Couple', 'Family', 'Friends', 'Solo', 'Profile'],
    plan_names: { light: 'Light', standard: 'Standard', premium: 'Premium' },
    plan_tags: { standard: 'Most popular', premium: 'Most photos' },
    plan_blurb: '{min} min / {shots} photos · shared instantly',
  },
};

function getLang() { return localStorage.getItem('uphoto_lang') || 'ja'; }

function t(key, vars) {
  const lang = getLang();
  let s = (I18N[lang] && I18N[lang][key]);
  if (s == null) s = I18N.ja[key];
  if (s == null) return key;
  if (vars) for (const k in vars) s = String(s).replaceAll('{' + k + '}', vars[k]);
  return s;
}

// raw lookup for non-string entries (arrays / maps)
function tRaw(key) {
  const lang = getLang();
  const v = (I18N[lang] && I18N[lang][key]);
  return v != null ? v : I18N.ja[key];
}

// localized area name for a backend area object
function areaLabel(a) {
  if (!a) return '';
  return getLang() === 'en' && a.name_en ? a.name_en : a.name;
}

function applyI18n(root) {
  const r = root || document;
  r.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  r.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
  r.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  r.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
}

function setLang(lang) {
  localStorage.setItem('uphoto_lang', lang);
  document.documentElement.lang = lang;
  applyI18n(document);
  document.querySelectorAll('[data-lang-btn]').forEach((b) => {
    b.classList.toggle('on', b.dataset.langBtn === lang);
  });
  // let pages re-render their dynamic (JS-built) strings
  document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
}

// Inject a JP/EN toggle into a .topbar and wire it up. Call once on load.
function mountLangToggle() {
  const bar = document.querySelector('.topbar');
  if (!bar || bar.querySelector('.lang-toggle')) return;
  const wrap = document.createElement('div');
  wrap.className = 'lang-toggle';
  wrap.innerHTML =
    '<button type="button" data-lang-btn="ja">日本語</button>' +
    '<button type="button" data-lang-btn="en">EN</button>';
  // place before the trailing badge if present, else append
  const badge = bar.querySelector('.badge');
  if (badge) bar.insertBefore(wrap, badge); else bar.appendChild(wrap);
  wrap.querySelectorAll('[data-lang-btn]').forEach((b) => {
    b.addEventListener('click', () => setLang(b.dataset.langBtn));
  });
}

// initialise on load
document.documentElement.lang = getLang();
document.addEventListener('DOMContentLoaded', () => {
  mountLangToggle();
  applyI18n(document);
  document.querySelectorAll('[data-lang-btn]').forEach((b) => {
    b.classList.toggle('on', b.dataset.langBtn === getLang());
  });
});
