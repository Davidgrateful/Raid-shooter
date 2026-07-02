/*==============================================================================
Daily Challenge - one rotating goal per day, same for every player

Deterministic from the local date (no backend, no sync): everyone grinds the
same goal, which makes it communal ("did you clear today's?"). Completing it
awards bonus XP to the equipped pilot - progression, never power. Completion
is tracked in local storage per day.
==============================================================================*/

// local date key, e.g. "2026-7-1" - rolls over at the player's midnight
$.dailyKey = function() {
	var d = new Date();
	return d.getFullYear() + '-' + ( d.getMonth() + 1 ) + '-' + d.getDate();
};

$.dailyXpReward = 250;

// streak-scaled reward: day 1 pays 250, day 2 pays 300, day 3+ pays 400.
// A missed day resets the streak - that's what makes it a habit.
$.dailyXpFor = function( streak ) {
	return streak >= 3 ? 400 : ( streak === 2 ? 300 : 250 );
};

// yesterday's key, for the did-the-streak-survive check
$.dailyYesterdayKey = function() {
	var d = new Date( Date.now() - 86400000 );
	return d.getFullYear() + '-' + ( d.getMonth() + 1 ) + '-' + d.getDate();
};

// current streak count (only counts if it's still alive today)
$.dailyStreak = function() {
	var s = $.storage['dailystreak'];
	if( !s || !s.count ) { return 0; }
	if( s.last === $.dailyKey() || s.last === $.dailyYesterdayKey() ) { return s.count; }
	return 0;
};

// the XP completing today's challenge would pay right now
$.dailyNextXp = function() {
	var s = $.storage['dailystreak'],
		alive = s && s.last === $.dailyYesterdayKey() ? s.count : 0;
	return $.dailyDone() ? $.dailyXpFor( $.dailyStreak() ) : $.dailyXpFor( alive + 1 );
};

// The challenge pool. Every stat here is already tallied during a run, so
// checking completion costs nothing. Text must stay within the bitmap
// font's glyph set ( $+,.:/0-9@A-Z ).
$.dailyDefs = [
	{ stat: 'kills', text: 'DESTROY {N} ENEMIES IN ONE RUN', tiers: [ 30, 40, 50 ] },
	{ stat: 'score', text: 'SCORE {N} IN ONE RUN', tiers: [ 10000, 15000, 20000 ] },
	{ stat: 'combo', text: 'REACH A {N}X COMBO', tiers: [ 6, 7, 8 ] },
	{ stat: 'powerups', text: 'COLLECT {N} POWERUPS IN ONE RUN', tiers: [ 5, 7, 9 ] },
	{ stat: 'time', text: 'SURVIVE {N} SECONDS IN ONE RUN', tiers: [ 120, 180, 240 ] }
];

// today's challenge, derived from the date so it needs no server
$.dailyChallenge = function() {
	var key = $.dailyKey(),
		seed = 0;
	for( var i = 0; i < key.length; i++ ) {
		seed = ( seed * 31 + key.charCodeAt( i ) ) % 100000;
	}
	var def = $.dailyDefs[ seed % $.dailyDefs.length ],
		n = def.tiers[ Math.floor( seed / 7 ) % def.tiers.length ];
	return {
		key: key,
		stat: def.stat,
		n: n,
		xp: $.dailyXpReward,
		text: def.text.replace( '{N}', $.util.commas( n ) )
	};
};

$.dailyDone = function() {
	return $.storage['dailydone'] === $.dailyKey();
};

// the current run's numbers, in the same shape the challenge checks against
$.dailyRunStats = function() {
	return {
		kills: $.kills,
		score: $.score,
		combo: $.bestCombo,
		powerups: $.powerupsCollected,
		time: Math.floor( ( $.elapsed * ( 1000 / 60 ) ) / 1000 )
	};
};

$.dailyCheckRun = function() {
	var c = $.dailyChallenge(),
		s = $.dailyRunStats();
	return s[ c.stat ] >= c.n;
};

// Called from the play loop (cheap - a few property reads). The moment the
// goal is hit mid-run we flash a banner, so the reward lands with the action
// instead of being discovered later on the game-over screen.
$.dailyPopTick = 0;
$.dailyLiveCheck = function() {
	if( $.dailyPopTick > 0 || $.dailyDone() ) { return; }
	if( $.dailyCheckRun() ) {
		$.dailyPopTick = 1;
		$.audio.play( 'levelup' );
	}
};

// transient in-run banner: fades in, holds, fades out over ~4s
$.dailyRenderPop = function() {
	if( $.dailyPopTick <= 0 ) { return; }
	// the death sequence freezes the last frame as the game-over backdrop -
	// clear the banner so it can't ghost over the game-over screen
	if( $.hero && $.hero.life <= 0 ) { $.dailyPopTick = -1; return; }
	var max = 260,
		t = $.dailyPopTick,
		alpha = t < 30 ? t / 30 : ( t > max - 60 ? ( max - t ) / 60 : 1 );
	if( t >= max ) { $.dailyPopTick = -1; return; } // -1 = shown, stop
	$.dailyPopTick += $.dt;
	$.ctxmg.save();
	$.ctxmg.globalAlpha = Math.max( 0, Math.min( 1, alpha ) );
	$.ctxmg.beginPath();
	$.text( {
		ctx: $.ctxmg, x: $.cw / 2, y: $.ch * 0.22,
		text: 'DAILY CHALLENGE COMPLETE',
		hspacing: 2, vspacing: 1, halign: 'center', valign: 'top',
		scale: 3, snap: 1, render: 1
	} );
	$.ctxmg.fillStyle = 'hsla(45, 100%, 60%, 1)';
	$.ctxmg.fill();
	$.ctxmg.beginPath();
	$.text( {
		ctx: $.ctxmg, x: $.cw / 2, y: $.ch * 0.22 + 26,
		text: '+' + $.dailyNextXp() + ' XP AT RUN END',
		hspacing: 1, vspacing: 1, halign: 'center', valign: 'top',
		scale: 1, snap: 1, render: 1
	} );
	$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.7)';
	$.ctxmg.fill();
	$.ctxmg.restore();
};

// Settle the challenge at the end of a run: awards the XP once per day and
// advances the streak. Returns the result for the game-over screen, or null.
$.dailySettle = function() {
	if( $.dailyDone() || !$.dailyCheckRun() ) { return null; }
	$.storage['dailydone'] = $.dailyKey();
	// streak continues if yesterday was completed, otherwise restarts at 1
	var prev = $.storage['dailystreak'],
		count = ( prev && prev.last === $.dailyYesterdayKey() ) ? prev.count + 1 : 1;
	$.storage['dailystreak'] = { count: count, last: $.dailyKey() };
	var xp = $.dailyXpFor( count );
	if( $.hero && $.hero.character ) {
		$.gainPilotXp( $.hero.character.id, xp );
	}
	return { xp: xp, streak: count };
};
