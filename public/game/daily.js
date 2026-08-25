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

// The in-run completion. This is the one moment the daily challenge pays off,
// and it used to be two lines of floating text that read like a toast: the
// same weight as a powerup pickup, for the thing the player has been chasing
// all session. It now lands on a struck plate - cut corners and a rule, the
// same plate language the HUD chips use - and settles rather than just fading
// in, so it reads as something awarded rather than something announced.
//
// The plate is measured from the text, never a fixed width, so it fits the
// bitmap font at any scale. All copy stays inside the font's glyph set
// ( $+,./0-9:@A-Z ) - no lowercase, no percent sign, no parentheses.
$.dailyRenderPop = function() {
	if( $.dailyPopTick <= 0 ) { return; }
	// the death sequence freezes the last frame as the game-over backdrop -
	// clear the banner so it can't ghost over the game-over screen
	if( $.hero && $.hero.life <= 0 ) { $.dailyPopTick = -1; return; }

	var max = 300,
		t = $.dailyPopTick,
		alpha = t < 20 ? t / 20 : ( t > max - 60 ? ( max - t ) / 60 : 1 ),
		// the settle: overshoots very slightly, then holds. Motion here says
		// "this landed", which is the whole point of the moment.
		grow = t < 26 ? 1 + 0.10 * ( 1 - t / 26 ) * ( 1 - t / 26 ) : 1,
		// Never a fraction of screen height: 22% of a 390px landscape phone is
		// 86px, which is inside the HUD band and lands on the score, the BEST
		// line and the touch controls. renderInterface() publishes where its
		// centre column really ends and runs immediately before this each
		// frame, so measure against that. The safe-area term is only a floor
		// for a frame where the HUD has not drawn yet.
		popY = ( $.hudCentreBottom > 0 ? $.hudCentreBottom : $.safeAreaTop + 60 ) + 26,
		compact = ( $.isTouchDevice || $.cw < 900 ),
		titleScale = compact ? 2 : 3,
		ctx = $.ctxmg;

	if( t >= max ) { $.dailyPopTick = -1; return; } // -1 = shown, stop
	$.dailyPopTick += $.dt;

	var title = 'DAILY CHALLENGE COMPLETE',
		payoff = '+' + $.dailyNextXp() + ' XP AT RUN END',
		tm = $.text( { ctx: ctx, x: 0, y: 0, text: title, hspacing: 2, vspacing: 1,
			halign: 'left', valign: 'top', scale: titleScale, snap: 1, render: 0 } ),
		pm = $.text( { ctx: ctx, x: 0, y: 0, text: payoff, hspacing: 1, vspacing: 1,
			halign: 'left', valign: 'top', scale: 1, snap: 1, render: 0 } ),
		padX = compact ? 16 : 24,
		padY = compact ? 10 : 14,
		gap = compact ? 7 : 9,
		boxW = Math.max( tm.width, pm.width ) + padX * 2,
		boxH = tm.height + gap + pm.height + padY * 2;

	ctx.save();
	ctx.globalAlpha = Math.max( 0, Math.min( 1, alpha ) );
	// settle about the plate's own centre so it grows in place
	ctx.translate( $.cw / 2, popY + boxH / 2 );
	ctx.scale( grow, grow );
	ctx.translate( -$.cw / 2, -( popY + boxH / 2 ) );

	var boxX = Math.floor( $.cw / 2 - boxW / 2 ),
		cut = compact ? 8 : 11;

	// the plate: dark enough to hold the type over a busy arena
	ctx.beginPath();
	$.cutRect( ctx, boxX, popY, boxW, boxH, cut );
	ctx.fillStyle = 'hsla(38, 60%, 8%, 0.82)';
	ctx.fill();
	ctx.beginPath();
	$.cutRect( ctx, boxX + 0.5, popY + 0.5, boxW - 1, boxH - 1, cut );
	ctx.strokeStyle = 'hsla(45, 100%, 62%, 0.55)';
	ctx.lineWidth = 1;
	ctx.stroke();

	// a lit top edge - the plate reads as struck rather than drawn
	ctx.fillStyle = 'hsla(45, 100%, 68%, 0.9)';
	ctx.fillRect( boxX + cut, popY, boxW - cut * 2, 2 );

	ctx.beginPath();
	$.text( {
		ctx: ctx, x: $.cw / 2, y: popY + padY,
		text: title,
		hspacing: 2, vspacing: 1, halign: 'center', valign: 'top',
		scale: titleScale, snap: 1, render: 1
	} );
	ctx.fillStyle = 'hsla(45, 100%, 66%, 1)';
	ctx.fill();

	ctx.beginPath();
	$.text( {
		ctx: ctx, x: $.cw / 2, y: popY + padY + tm.height + gap,
		text: payoff,
		hspacing: 1, vspacing: 1, halign: 'center', valign: 'top',
		scale: 1, snap: 1, render: 1
	} );
	ctx.fillStyle = 'hsla(0, 0%, 100%, 0.72)';
	ctx.fill();
	ctx.restore();
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
	// the equipped drone's XP bonus applies to the daily reward too
	var xp = Math.round( $.dailyXpFor( count ) * ( $.xpGainMult ? $.xpGainMult() : 1 ) );
	if( $.hero && $.hero.character ) {
		$.gainPilotXp( $.hero.character.id, xp );
	}
	return { xp: xp, streak: count };
};
