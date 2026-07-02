/*==============================================================================
Daily Run mode - one seeded attempt per day, own board

Every player gets the SAME enemy waves today, because during a daily run we
swap the global Math.random for a deterministic generator seeded from the
date. Skill (and pilot choice) decides the outcome, not luck. One attempt per
day; the daily board resets every day. Kept entirely separate from the
endless Shooterboard.
==============================================================================*/

// mulberry32 - tiny, fast, well-distributed seeded PRNG
$.__seededRand = function( seed ) {
	var s = seed >>> 0;
	return function() {
		s |= 0; s = ( s + 0x6D2B79F5 ) | 0;
		var t = Math.imul( s ^ ( s >>> 15 ), 1 | s );
		t = ( t + Math.imul( t ^ ( t >>> 7 ), 61 | t ) ) ^ t;
		return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;
	};
};

// today's day key (reuses $.dailyKey from daily.js) and a 32-bit seed from it
$.dailyRunDay = function() {
	return ( $.dailyKey ? $.dailyKey() : new Date().toISOString().slice( 0, 10 ) );
};
$.dailyRunSeed = function() {
	var key = $.dailyRunDay(), seed = 2166136261;
	for( var i = 0; i < key.length; i++ ) {
		seed ^= key.charCodeAt( i );
		seed = Math.imul( seed, 16777619 );
	}
	return seed >>> 0;
};

$.dailyRunActive = 0;
$.dailyRunPlayedToday = function() {
	return $.storage['dailyrundone'] === $.dailyRunDay();
};

// swap in the seeded generator so the whole run is deterministic
$.beginSeededRng = function() {
	if( !$.__realRandom ) { $.__realRandom = Math.random; }
	Math.random = $.__seededRand( $.dailyRunSeed() );
};
$.endSeededRng = function() {
	if( $.__realRandom ) { Math.random = $.__realRandom; }
};

// start today's daily run (guarded by the hub button; no-op if already played)
$.startDailyRun = function() {
	if( $.dailyRunPlayedToday() ) { return; }
	$.dailyRunActive = 1;
	$.dailyRunResult = null;
	$.beginSeededRng();
	$.reset();
	$.firstRun = 0;
	$.instructionTick = $.instructionTickMax; // skip the tutorial overlay
	$.trackRun( 'run_start' );
	$.audio.play( 'levelup' );
	$.music.start();
	$.setState( 'play' );
};

// called at game over when a daily run ends: restore RNG, mark the day done,
// submit to the daily board (never the endless one)
$.finishDailyRun = function() {
	$.endSeededRng();
	$.dailyRunActive = 0;
	$.storage['dailyrundone'] = $.dailyRunDay();
	$.updateStorage();
	$.dailyRunResult = { state: 'sending', rank: 0, score: $.score };
	// drive the game-over status line too (reuses the board-status slot)
	$.boardSubmit = { state: 'dailypending', rank: 0, improved: false, verified: false };
	var name = $.session && $.session.authenticated ? ( $.storage['pilotname'] || undefined ) : $.ensurePilotName();
	var captcha = ( $.session && !$.session.authenticated && typeof window !== 'undefined' ) ? window.__turnstileToken : undefined;
	fetch( '/api/dailyrun', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify( {
			day: $.dailyRunDay(),
			score: $.score,
			pilot: ( $.hero && $.hero.character && $.hero.character.title ) || 'NOVA',
			name: name,
			turnstileToken: captcha
		} )
	} )
		.then( function( r ) { return r.json(); } )
		.then( function( d ) {
			if( typeof window !== 'undefined' && window.__turnstileReset ) { window.__turnstileReset(); }
			$.dailyRunResult = { state: 'done', rank: d.rank || 0, accepted: d.accepted !== false, score: $.score };
			$.boardSubmit = { state: 'daily', rank: d.rank || 0, improved: false, verified: !!d.verified };
			$.fetchDailyBoard();
		} )
		.catch( function() {
			$.dailyRunResult = { state: 'error', rank: 0, score: $.score };
			$.boardSubmit = { state: 'error', rank: 0, improved: false, verified: false };
		} );
};

// the daily hub's board data
$.dailyBoard = { loading: 0, entries: [], total: 0, played: 0, fetched: 0 };
$.fetchDailyBoard = function() {
	$.dailyBoard.loading = 1;
	fetch( '/api/dailyrun?day=' + encodeURIComponent( $.dailyRunDay() ) )
		.then( function( r ) { return r.json(); } )
		.then( function( d ) {
			$.dailyBoard.entries = d.entries || [];
			$.dailyBoard.total = d.total || 0;
			$.dailyBoard.played = !!d.played;
			$.dailyBoard.loading = 0;
			$.dailyBoard.fetched = 1;
		} )
		.catch( function() { $.dailyBoard.loading = 0; $.dailyBoard.fetched = 1; } );
};
