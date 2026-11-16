/* Рой / Swarm — localization. All UI strings live here. */
(function () {
  'use strict';
  // Game title per language. Change here only if the catalog name must be renamed.
  var GAME_TITLE = { ru: 'Рой', en: 'Рой', tr: 'Рой' };

  var D = {
    ru: {
      play: 'Играть', levels: 'Уровни', howto: 'Как играть', about: 'Об игре', sound: 'Звук', on: 'вкл', off: 'выкл',
      level: 'Уровень {n}', paused: 'Пауза', resume: 'Продолжить', restart: 'Заново', back: 'Назад', close: 'Закрыть',
      win: 'Победа!', lose: 'Поражение', next: 'Дальше', retry: 'Ещё раз',
      win_text: 'Вражеский рой разбит!', lose_text: 'Твой рой рассеян. Попробуй другой маршрут.',
      star_win: 'Победа', star_time: 'Быстрее {t}', star_safe: 'Не потерять ни одного улья', time_is: 'Время: {t}',
      tut1: 'Проведи пальцем от своего улья к другому. Пролетай через цветы!',
      tut2: 'Число у конца пути — сколько пчёл долетит. Облетай пауков!',
      tut3: 'Захвати все вражеские ульи. Круглые кнопки — способности.',
      too_long: 'Слишком длинный путь', blocked: 'Путь перекрыт', captured: 'Захвачен!', lost: 'Потерян!', died: 'Рой погиб',
      new: 'Новое!', got_it: 'Понятно',
      rw_continue: '▶ Реклама: вернуть улей +30 пчёл', rw_x2: '▶ Реклама: старт ×2 пчёл',
      pick_own: 'Выбери свой улей', pick_enemy: 'Выбери вражеский улей', ab_ready: 'Готово',
      send: 'пчёл', ab_honey: 'Мёд', ab_boost: 'Ускорение', ab_smoke: 'Дым',
      f_flower_t: 'Цветы', f_flower_d: 'Пролети через цветок — рой вырастет: +10, +25, ×2.',
      f_spider_t: 'Паук', f_spider_d: 'Паутина отнимает пчёл: −10, −20. Облетай!',
      f_div_t: 'Паучье логово', f_div_d: '÷2 — делит рой пополам.',
      f_switch_t: 'Переключатель', f_switch_d: 'Меняется ×2 ↔ ÷2 каждые 3 секунды. Лови момент!',
      f_dandelion_t: 'Одуванчик', f_dandelion_d: 'Разовый бонус для первого роя. Потом медленно отрастает.',
      f_rocks_t: 'Камни', f_rocks_d: 'Сквозь камни путь не проложить — облети их.',
      f_wasp_t: 'Оса-патруль', f_wasp_d: 'Летает туда-сюда и жалит рой: −15.',
      f_queen_t: 'Матка', f_queen_d: 'Улей с короной растёт вдвое быстрее.',
      f_wind_t: 'Ветер', f_wind_d: 'По ветру рой летит быстрее, против ветра — медленнее.',
      f_fort_t: 'Крепость', f_fort_d: 'Восковая броня: нападающие теряют в 1,5 раза больше пчёл.',
      f_portal_t: 'Портал', f_portal_d: 'Влети в один — вылетишь из другого и полетишь прямо к цели.',
      f_puddle_t: 'Медовая лужа', f_puddle_d: 'Рой вязнет и летит медленно.',
      f_tower_t: 'Башня', f_tower_d: 'Жалит пролетающих рядом врагов: −1 каждые 0,4 с.',
      f_hornets_t: 'Шершни', f_hornets_d: 'Вторая армия! Они враги и тебе, и осам.',
      f_x3_t: 'Редкий цветок', f_x3_d: '×3 — утраивает рой!',
      f_ab_honey_t: 'Способность: Мёд', f_ab_honey_d: 'Нажми кнопку, затем свой улей: +15 пчёл.',
      f_ab_boost_t: 'Способность: Ускорение', f_ab_boost_d: 'Все твои рои летят вдвое быстрее 4 секунды.',
      f_ab_smoke_t: 'Способность: Дым', f_ab_smoke_d: 'Нажми кнопку, затем вражеский улей: 5 секунд он не растёт и не атакует.',
      h_goal_t: 'Цель', h_goal_d: 'Захвати все ульи врага. Твои ульи — жёлтые, осы — красные, шершни — фиолетовые, ничейные — серые.',
      h_drag_t: 'Отправка роя', h_drag_d: 'Веди пальцем от своего улья к любому другому. Летит половина пчёл (кнопка справа внизу меняет долю: 50%, 75%, 100%) — ровно по нарисованному пути. Проведи через несколько своих ульев, чтобы отправить из всех.',
      h_mods_t: 'Модификаторы', h_mods_d: 'Каждый срабатывает один раз на рой. Число у конца пути показывает, сколько пчёл долетит.',
      h_stars_t: 'Звёзды', h_stars_d: '1 — победа, 2 — победа быстрее контрольного времени, 3 — без потери ульев.',
      h_hives_t: 'Ульи', about_fonts: 'Шрифты', about_lic: 'Шрифты Russo One и Rubik распространяются по лицензии SIL Open Font License 1.1.',
      about_text: 'Оригинальная игра. Вся графика и звук создаются кодом прямо в игре.', show_lic: 'Текст лицензии'
    },
    en: {
      play: 'Play', levels: 'Levels', howto: 'How to play', about: 'About', sound: 'Sound', on: 'on', off: 'off',
      level: 'Level {n}', paused: 'Paused', resume: 'Resume', restart: 'Restart', back: 'Back', close: 'Close',
      win: 'Victory!', lose: 'Defeat', next: 'Next', retry: 'Try again',
      win_text: 'The enemy swarm is broken!', lose_text: 'Your swarm scattered. Try another route.',
      star_win: 'Win', star_time: 'Faster than {t}', star_safe: 'Lose no hive', time_is: 'Time: {t}',
      tut1: 'Drag from your hive to another one. Fly through flowers!',
      tut2: 'The number at the end of the path is how many bees arrive. Avoid spiders!',
      tut3: 'Capture every enemy hive. The round buttons are abilities.',
      too_long: 'Path too long', blocked: 'Path blocked', captured: 'Captured!', lost: 'Lost!', died: 'Swarm died',
      new: 'New!', got_it: 'Got it',
      rw_continue: '▶ Ad: restore a hive +30 bees', rw_x2: '▶ Ad: start with ×2 bees',
      pick_own: 'Pick your hive', pick_enemy: 'Pick an enemy hive', ab_ready: 'Ready',
      send: 'bees', ab_honey: 'Honey', ab_boost: 'Boost', ab_smoke: 'Smoke',
      f_flower_t: 'Flowers', f_flower_d: 'Fly through a flower to grow the swarm: +10, +25, ×2.',
      f_spider_t: 'Spider', f_spider_d: 'Webs take bees away: −10, −20. Fly around!',
      f_div_t: 'Spider lair', f_div_d: '÷2 — halves the swarm.',
      f_switch_t: 'Switch gate', f_switch_d: 'Flips ×2 ↔ ÷2 every 3 seconds. Time it!',
      f_dandelion_t: 'Dandelion', f_dandelion_d: 'One-shot bonus for the first swarm. Slowly regrows.',
      f_rocks_t: 'Rocks', f_rocks_d: 'You cannot draw through rocks — go around.',
      f_wasp_t: 'Wasp patrol', f_wasp_d: 'Flies back and forth and stings swarms: −15.',
      f_queen_t: 'Queen', f_queen_d: 'A crowned hive grows twice as fast.',
      f_wind_t: 'Wind', f_wind_d: 'With the wind swarms fly faster, against it slower.',
      f_fort_t: 'Fortress', f_fort_d: 'Wax armor: attackers lose 1.5× more bees.',
      f_portal_t: 'Portal', f_portal_d: 'Enter one, exit the other and fly straight to the target.',
      f_puddle_t: 'Honey puddle', f_puddle_d: 'Swarms get sticky and slow down.',
      f_tower_t: 'Tower', f_tower_d: 'Stings nearby enemy swarms: −1 every 0.4 s.',
      f_hornets_t: 'Hornets', f_hornets_d: 'A second army! They fight you and the wasps.',
      f_x3_t: 'Rare flower', f_x3_d: '×3 — triples the swarm!',
      f_ab_honey_t: 'Ability: Honey', f_ab_honey_d: 'Tap the button, then your hive: +15 bees.',
      f_ab_boost_t: 'Ability: Boost', f_ab_boost_d: 'All your swarms fly twice as fast for 4 seconds.',
      f_ab_smoke_t: 'Ability: Smoke', f_ab_smoke_d: 'Tap the button, then an enemy hive: it stops growing and attacking for 5 s.',
      h_goal_t: 'Goal', h_goal_d: 'Capture all enemy hives. Yours are yellow, wasps red, hornets violet, neutral grey.',
      h_drag_t: 'Sending a swarm', h_drag_d: 'Drag from your hive to any other. Half the bees fly exactly along your path (the button at the bottom right switches 50%, 75%, 100%). Pass over several of your hives to send from all of them.',
      h_mods_t: 'Modifiers', h_mods_d: 'Each one works once per swarm. The number at the end of the path shows how many bees will arrive.',
      h_stars_t: 'Stars', h_stars_d: '1 — win, 2 — win under par time, 3 — lose no hive.',
      h_hives_t: 'Hives', about_fonts: 'Fonts', about_lic: 'Russo One and Rubik fonts are licensed under the SIL Open Font License 1.1.',
      about_text: 'An original game. All graphics and sound are generated by code.', show_lic: 'License text'
    },
    tr: {
      play: 'Oyna', levels: 'Bölümler', howto: 'Nasıl oynanır', about: 'Hakkında', sound: 'Ses', on: 'açık', off: 'kapalı',
      level: 'Bölüm {n}', paused: 'Duraklatıldı', resume: 'Devam', restart: 'Yeniden', back: 'Geri', close: 'Kapat',
      win: 'Zafer!', lose: 'Yenilgi', next: 'İleri', retry: 'Tekrar dene',
      win_text: 'Düşman sürüsü dağıldı!', lose_text: 'Sürün dağıldı. Başka bir yol dene.',
      star_win: 'Zafer', star_time: '{t} altında', star_safe: 'Hiç kovan kaybetme', time_is: 'Süre: {t}',
      tut1: 'Kovanından başka bir kovana parmağını kaydır. Çiçeklerden geç!',
      tut2: 'Yolun sonundaki sayı varacak arı sayısıdır. Örümceklerden kaç!',
      tut3: 'Tüm düşman kovanlarını ele geçir. Yuvarlak düğmeler yeteneklerdir.',
      too_long: 'Yol çok uzun', blocked: 'Yol kapalı', captured: 'Ele geçirildi!', lost: 'Kaybedildi!', died: 'Sürü öldü',
      new: 'Yeni!', got_it: 'Anladım',
      rw_continue: '▶ Reklam: kovanı geri al +30 arı', rw_x2: '▶ Reklam: ×2 arıyla başla',
      pick_own: 'Kovanını seç', pick_enemy: 'Düşman kovanı seç', ab_ready: 'Hazır',
      send: 'arı', ab_honey: 'Bal', ab_boost: 'Hız', ab_smoke: 'Duman',
      f_flower_t: 'Çiçekler', f_flower_d: 'Çiçekten geçen sürü büyür: +10, +25, ×2.',
      f_spider_t: 'Örümcek', f_spider_d: 'Ağlar arı eksiltir: −10, −20. Etrafından dolaş!',
      f_div_t: 'Örümcek yuvası', f_div_d: '÷2 — sürüyü yarıya böler.',
      f_switch_t: 'Anahtar kapı', f_switch_d: 'Her 3 saniyede ×2 ↔ ÷2 değişir. Zamanla!',
      f_dandelion_t: 'Karahindiba', f_dandelion_d: 'İlk sürüye tek seferlik bonus. Sonra yavaşça yeniden çıkar.',
      f_rocks_t: 'Kayalar', f_rocks_d: 'Kayaların içinden yol çizilemez — etrafından dolaş.',
      f_wasp_t: 'Devriye eşek arısı', f_wasp_d: 'İleri geri uçar ve sürüyü sokar: −15.',
      f_queen_t: 'Kraliçe', f_queen_d: 'Taçlı kovan iki kat hızlı büyür.',
      f_wind_t: 'Rüzgâr', f_wind_d: 'Rüzgârla sürü hızlanır, rüzgâra karşı yavaşlar.',
      f_fort_t: 'Kale', f_fort_d: 'Balmumu zırh: saldıranlar 1,5 kat fazla arı kaybeder.',
      f_portal_t: 'Geçit', f_portal_d: 'Birine gir, diğerinden çık ve hedefe dümdüz uç.',
      f_puddle_t: 'Bal birikintisi', f_puddle_d: 'Sürü yapışır ve yavaşlar.',
      f_tower_t: 'Kule', f_tower_d: 'Yakındaki düşman sürülerini sokar: her 0,4 sn −1.',
      f_hornets_t: 'Eşek arıları', f_hornets_d: 'İkinci ordu! Hem sana hem yaban arılarına düşman.',
      f_x3_t: 'Nadir çiçek', f_x3_d: '×3 — sürüyü üç katına çıkarır!',
      f_ab_honey_t: 'Yetenek: Bal', f_ab_honey_d: 'Düğmeye, sonra kovanına dokun: +15 arı.',
      f_ab_boost_t: 'Yetenek: Hız', f_ab_boost_d: 'Tüm sürülerin 4 saniye iki kat hızlı uçar.',
      f_ab_smoke_t: 'Yetenek: Duman', f_ab_smoke_d: 'Düğmeye, sonra düşman kovanına dokun: 5 sn büyümez ve saldırmaz.',
      h_goal_t: 'Amaç', h_goal_d: 'Tüm düşman kovanlarını ele geçir. Seninkiler sarı, yaban arıları kırmızı, eşek arıları mor, tarafsızlar gri.',
      h_drag_t: 'Sürü gönderme', h_drag_d: 'Kovanından başka bir kovana kaydır. Arıların yarısı tam çizdiğin yoldan uçar (sağ alttaki düğme oranı değiştirir: %50, %75, %100). Birkaç kovanının üzerinden geçerek hepsinden gönder.',
      h_mods_t: 'Değiştiriciler', h_mods_d: 'Her biri sürü başına bir kez çalışır. Yolun sonundaki sayı kaç arının varacağını gösterir.',
      h_stars_t: 'Yıldızlar', h_stars_d: '1 — zafer, 2 — hedef süreden hızlı, 3 — kovan kaybetmeden.',
      h_hives_t: 'Kovanlar', about_fonts: 'Yazı tipleri', about_lic: 'Russo One ve Rubik yazı tipleri SIL Open Font License 1.1 ile lisanslıdır.',
      about_text: 'Özgün bir oyun. Tüm grafik ve sesler kodla üretilir.', show_lic: 'Lisans metni'
    }
  };

  var lang = 'en';
  function setLang(l) {
    l = String(l || '').toLowerCase().slice(0, 2);
    if (['ru', 'be', 'kk', 'uk', 'uz'].indexOf(l) >= 0) lang = 'ru';
    else lang = D[l] ? l : 'en';
  }
  function t(k, v) {
    var s = (D[lang] && D[lang][k]) || D.en[k] || k;
    if (v) for (var x in v) s = s.split('{' + x + '}').join(v[x]);
    return s;
  }
  function title() { return GAME_TITLE[lang] || GAME_TITLE.en; }
  function apply(root) {
    var els = (root || document).querySelectorAll('[data-i18n]');
    for (var i = 0; i < els.length; i++) els[i].textContent = t(els[i].getAttribute('data-i18n'));
    var tt = (root || document).querySelectorAll('[data-title]');
    for (var j = 0; j < tt.length; j++) tt[j].textContent = title();
    var al = (root || document).querySelectorAll('[data-i18n-label]');
    for (var k = 0; k < al.length; k++) al[k].setAttribute('aria-label', t(al[k].getAttribute('data-i18n-label')));
  }
  window.I18N = { setLang: setLang, t: t, title: title, apply: apply, get lang() { return lang; } };
})();
