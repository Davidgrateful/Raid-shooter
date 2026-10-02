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

// swap in the seeded generator so the whole run is deterministic (a duel
// passes its own seed; the daily run uses today's)
$.beginSeededRng = function( seed ) {
	if( !$.__realRandom ) { $.__realRandom = Math.random; }
	var s = seed === undefined ? $.dailyRunSeed() : seed;
	Math.random = $.__seededRand( s );
	// the arena's objects roll their own stream from the same seed, so two
	// pilots get the same arena and breaking things never shifts the waves
	if( $.reseedObjects ) { $.reseedObjects( s ); }
};
$.endSeededRng = function() {
	if( $.__realRandom ) { Math.random = $.__realRandom; }
	$.objRng = null;
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
			turnstileToken: captcha,
			// the run ticket issued at run start (shooterboard.js trackRun),
			// the run's own clock, and the durable guest id the ticket was
			// issued to - the server checks all three against each other
			runTicket: $.runTicket || undefined,
			time: Math.floor( ( ( $.elapsed || 0 ) * ( 1000 / 60 ) ) / 1000 ),
			guestToken: ( $.session && $.session.authenticated ) ? undefined : ( $.guestToken ? $.guestToken() : undefined )
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

/*==============================================================================
DUELS - fly a duel's seeded raid, then post the run to that duel only

A duel is a seed and two pilots (src/lib/duels.ts). The run is seeded exactly
like the Daily Run, and like it never touches the endless board or the
personal-best records: the score goes to the duel and nowhere else.

  $.startDuelRun( { id, seed } )   from the React layer (deck, duel link)
  $.finishDuelRun()                at game over, instead of submitScore
  $.duelResult                     { state: sending|done|error, duel } for the
                                   debrief to show
==============================================================================*/
$.duelActive = 0;
$.duel = null;
$.duelResult = null;

$.startDuelRun = function( duel ) {
	if( !duel || typeof duel.seed !== 'number' || !duel.id ) { return; }
	$.duelActive = 1;
	$.duel = { id: duel.id, seed: duel.seed >>> 0 };
	$.duelResult = null;
	$.beginSeededRng( $.duel.seed );
	$.reset();
	$.firstRun = 0;
	$.instructionTick = $.instructionTickMax; // skip the tutorial overlay
	// record this run's path for the other pilot to race (ghost.js); the
	// rival's ghost, if there is one, is handed in separately once fetched
	if( $.ghostStartRecording ) { $.ghostStartRecording(); }
	$.trackRun( 'run_start' );
	$.audio.play( 'levelup' );
	$.music.start();
	$.setState( 'play' );
};

$.finishDuelRun = function() {
	$.endSeededRng();
	$.duelActive = 0;
	var duel = $.duel;
	$.duel = null;
	if( !duel ) { return; }
	var ghost = $.ghostRecording ? $.ghostRecording() : null;
	if( $.ghostStop ) { $.ghostStop(); }
	$.duelResult = { state: 'sending', id: duel.id, duel: null };
	// the debrief's status line rides the same slot the boards use
	$.boardSubmit = { state: 'duelpending', rank: 0, improved: false, verified: false };
	var authed = $.session && $.session.authenticated;
	fetch( '/api/duels/' + encodeURIComponent( duel.id ), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify( {
			score: Math.max( 0, Math.floor( $.score ) ),
			pilot: ( $.hero && $.hero.character && $.hero.character.title ) || 'ONYIX',
			level: ( $.level.current || 0 ) + 1,
			kills: $.kills || 0,
			time: Math.floor( ( ( $.elapsed || 0 ) * ( 1000 / 60 ) ) / 1000 ),
			name: authed ? ( $.storage['pilotname'] || undefined ) : $.ensurePilotName(),
			turnstileToken: ( !authed && typeof window !== 'undefined' ) ? window.__turnstileToken : undefined,
			runTicket: $.runTicket || undefined,
			guestToken: authed ? undefined : ( $.guestToken ? $.guestToken() : undefined ),
			ghost: ghost || undefined
		} )
	} )
		.then( function( r ) { return r.json().then( function( d ) { return { ok: r.ok, d: d }; } ); } )
		.then( function( res ) {
			if( typeof window !== 'undefined' && window.__turnstileReset ) { window.__turnstileReset(); }
			$.duelResult = res.ok
				? { state: 'done', id: duel.id, duel: res.d.duel || null }
				: { state: 'error', id: duel.id, duel: null, error: ( res.d && res.d.error ) || 'failed' };
			$.boardSubmit = { state: res.ok ? 'duel' : 'error', rank: 0, improved: false, verified: false };
		} )
		.catch( function() {
			$.duelResult = { state: 'error', id: duel.id, duel: null, error: 'offline' };
			$.boardSubmit = { state: 'error', rank: 0, improved: false, verified: false };
		} );
};
