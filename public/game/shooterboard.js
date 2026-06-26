/*==============================================================================
Shooterboard - the global leaderboard

Anyone can play and rank: guests post a score with just a pilot name, while
a connected wallet (SIWE session) earns a verified badge. Scores submit
automatically on game over.
==============================================================================*/
$.session = { authenticated: false, address: null, guestId: null };

// The player's own leaderboard key, used to highlight their row. Wallet
// players are keyed by address; guests by their "guest:<id>" handle.
$.myKey = function() {
	if( $.session.authenticated ) {
		return $.session.address;
	}
	return $.session.guestId || null;
};
$.board = { loading: 0, error: 0, fetched: 0, entries: [], persistent: 1 };
$.boardSubmit = { state: 'idle', rank: 0, improved: false };

/*==============================================================================
Tiers - a visible rank ladder climbed by best score. Pure function of score,
so it works with or without a wallet (a player sees their tier from their
local best; the board shows every ranked player's tier badge).
==============================================================================*/
$.definitions.tiers = [
	{ name: 'BRONZE',   min: 0,      hue: 28 },
	{ name: 'SILVER',   min: 5000,   hue: 0,  sat: 0, light: 75 },
	{ name: 'GOLD',     min: 20000,  hue: 45 },
	{ name: 'PLATINUM', min: 50000,  hue: 180 },
	{ name: 'DIAMOND',  min: 100000, hue: 200 },
	{ name: 'MASTER',   min: 250000, hue: 285 }
];

$.tierFor = function( score ) {
	var tier = $.definitions.tiers[ 0 ],
		index = 0;
	for( var i = 0; i < $.definitions.tiers.length; i++ ) {
		if( score >= $.definitions.tiers[ i ].min ) {
			tier = $.definitions.tiers[ i ];
			index = i;
		}
	}
	var next = $.definitions.tiers[ index + 1 ] || null,
		color = ( tier.sat === 0 )
			? 'hsl(0, 0%, ' + ( tier.light || 70 ) + '%)'
			: 'hsl(' + tier.hue + ', 90%, 60%)';
	return { name: tier.name, color: color, min: tier.min, next: next, index: index };
};

// bitmap font has no period, so the short form uses a space: 0X12AB 34CD
$.shortAddress = function( address ) {
	if( !address || address.indexOf( 'guest:' ) === 0 ) {
		return '';
	}
	return ( '0X' + address.slice( 2, 6 ) + ' ' + address.slice( -4 ) ).toUpperCase();
};

$.boardDisplayName = function( entry ) {
	// guests always carry a name; wallet players fall back to their address
	return entry.name || $.shortAddress( entry.address ) || 'PILOT';
};

$.promptPilotName = function() {
	var input = window.prompt( 'PILOT NAME (3-12 LETTERS/NUMBERS)', $.storage['pilotname'] || '' );
	if( input === null ) {
		return;
	}
	input = input.toUpperCase().replace( /[^A-Z0-9 ]/g, '' ).replace( /\s+/g, ' ' ).trim().slice( 0, 12 );
	if( input.length >= 3 ) {
		$.storage['pilotname'] = input;
		$.updateStorage();
		// apply the new name to an existing board entry right away, for
		// whoever owns the current identity (wallet player or ranked guest)
		if( $.session.authenticated || $.session.guestId ) {
			fetch( '/api/leaderboard/name', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify( { name: input } )
			} )
				.then( function() { $.fetchBoard(); } )
				.catch( function() {} );
		}
	}
};

// Every guest needs a readable name to appear on the board. If they haven't
// set one, mint a stable default ("PILOT 1234") and remember it.
$.ensurePilotName = function() {
	var name = $.storage['pilotname'];
	if( !name || name.length < 3 ) {
		name = 'PILOT ' + Math.floor( 1000 + Math.random() * 9000 );
		$.storage['pilotname'] = name;
		$.updateStorage();
	}
	return name;
};

$.fetchSession = function() {
	return fetch( '/api/siwe/session' )
		.then( function( res ) { return res.json(); } )
		.then( function( data ) {
			$.session.authenticated = !!data.authenticated;
			$.session.address = data.address ? data.address.toLowerCase() : null;
			$.session.guestId = data.guestId || null;
		} )
		.catch( function() {} );
};

$.fetchBoard = function() {
	$.board.loading = 1;
	$.board.error = 0;
	fetch( '/api/leaderboard' )
		.then( function( res ) {
			if( !res.ok ) { throw new Error( 'board' ); }
			return res.json();
		} )
		.then( function( data ) {
			$.board.entries = data.entries || [];
			// the server reports whether a shared store is configured; when
			// it isn't, players can't see each other and we say so
			$.board.persistent = ( data.persistent === false ) ? 0 : 1;
			$.board.loading = 0;
			$.board.fetched = 1;
		} )
		.catch( function() {
			$.board.loading = 0;
			$.board.error = 1;
		} );
};

// Fire-and-forget run telemetry. Counts every run (and every player, via
// the server session) for the dev stats dashboard - never blocks gameplay
// and swallows all errors so a flaky network can't disrupt a run.
$.trackRun = function( event, durationSec ) {
	try {
		var payload = { event: event, durationSec: durationSec || 0 };
		// on run start, record the loadout the player chose so the dashboard
		// can show pilot picks and drone equip rate across every run
		if( event === 'run_start' ) {
			var pilot = $.currentCharacter && $.currentCharacter();
			var drone = $.equippedDrone && $.equippedDrone();
			payload.pilot = pilot ? pilot.id : 'unknown';
			payload.drone = drone ? drone.id : '';
			// the chosen call sign, so the team dashboard can identify a
			// player who's started playing even before they hit the board
			payload.name = $.storage['pilotname'] || '';
		}
		fetch( '/api/track', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify( payload ),
			keepalive: true
		} ).catch( function() {} );
	} catch( e ) {}
};

$.submitScore = function() {
	var runScore = $.score,
		runLevel = $.level.current + 1,
		runKills = $.kills,
		runCombo = $.bestCombo,
		runPilot = $.hero.character.title,
		runTime = Math.floor( ( $.elapsed * ( 1000 / 60 ) ) / 1000 );

	if( runScore <= 0 ) {
		$.boardSubmit = { state: 'idle', rank: 0, improved: false };
		return;
	}

	// a run that used a paid consumable (extra health/shield/revive) still
	// counts for the player, but doesn't post to Shooterboard - keeps the
	// global ranking a measure of skill, not spend
	if( $.runAssisted ) {
		$.boardSubmit = { state: 'assisted', rank: 0, improved: false, verified: false };
		return;
	}

	$.boardSubmit = { state: 'sending', rank: 0, improved: false, verified: false };

	// re-check the session right before submitting: the player may have
	// connected their wallet at any point during the run
	$.fetchSession().then( function() {
		// guests need a readable name; wallet players keep theirs optional
		var pilotName = $.session.authenticated
			? ( $.storage['pilotname'] || undefined )
			: $.ensurePilotName();

		// guests attach a Turnstile token for bot defense (no-op unless the
		// site key is configured; wallet players are exempt server-side)
		var captchaToken = ( !$.session.authenticated && typeof window !== 'undefined' )
			? window.__turnstileToken
			: undefined;

		fetch( '/api/leaderboard', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify( {
				score: runScore,
				level: runLevel,
				kills: runKills,
				combo: runCombo,
				pilot: runPilot,
				time: runTime,
				name: pilotName,
				turnstileToken: captchaToken
			} )
		} )
			.then( function( res ) {
				if( !res.ok ) { throw new Error( 'submit' ); }
				return res.json();
			} )
			.then( function( data ) {
				// a Turnstile token is single-use - request a fresh one for
				// the next submission
				if( typeof window !== 'undefined' && window.__turnstileReset ) {
					window.__turnstileReset();
				}
				// learn our freshly-minted guest id so the board can
				// highlight our row without another round-trip
				if( data.verified === false && !$.session.guestId ) {
					$.fetchSession();
				}
				$.boardSubmit = { state: 'done', rank: data.rank || 0, improved: !!data.improved, verified: !!data.verified };
			} )
			.catch( function() {
				$.boardSubmit = { state: 'error', rank: 0, improved: false, verified: false };
			} );
	} );
};

// know the wallet state as soon as the game loads
$.fetchSession();
