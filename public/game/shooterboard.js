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

				// near-miss hook: how far is this run from the next rank up?
				// (top 50 only - deeper ranks aren't in the public feed)
				if( data.rank > 1 && data.rank <= 50 ) {
					fetch( '/api/leaderboard' )
						.then( function( r ) { return r.json(); } )
						.then( function( board ) {
							var above = board.entries && board.entries[ data.rank - 2 ];
							if( above && above.score > runScore ) {
								$.boardSubmit.gap = ( above.score - runScore ) + 1;
								$.boardSubmit.nextRank = data.rank - 1;
							}
						} )
						.catch( function() {} );
				}
			} )
			.catch( function() {
				$.boardSubmit = { state: 'error', rank: 0, improved: false, verified: false };
			} );
	} );
};

// Builds a shareable rank-card image URL for the run just finished and opens
// the native share sheet (mobile) or the image in a new tab (desktop).
$.shareRunCard = function() {
	try {
		var pilot = ( $.hero && $.hero.character && $.hero.character.title ) || 'NOVA',
			nm = $.storage['pilotname'] || 'PILOT',
			rank = ( $.boardSubmit && $.boardSubmit.rank ) || 0,
			tier = $.tierFor ? $.tierFor( $.score || 0 ).name : '',
			params = 'name=' + encodeURIComponent( nm ) +
				'&pilot=' + encodeURIComponent( pilot ) +
				'&score=' + ( $.score | 0 ) +
				'&kills=' + ( $.kills | 0 ) +
				'&combo=' + ( $.bestCombo | 0 ) +
				'&level=' + ( ( $.level.current + 1 ) | 0 ) +
				( tier ? '&tier=' + encodeURIComponent( tier ) : '' ) +
				( rank ? '&rank=' + rank : '' ),
			url = window.location.origin + '/api/card?' + params,
			text = 'I SCORED ' + $.util.commas( $.score || 0 ) + ' ON RAID SHOOTER';
		if( navigator.share ) {
			navigator.share( { title: 'RAID SHOOTER', text: text, url: url } ).catch( function() {} );
		} else {
			window.open( url, '_blank' );
		}
	} catch( e ) {
		// sharing is best-effort - never let it interrupt the game
	}
};

// Active sponsors/partners (operator-managed). Sets the loading-screen
// "POWERED BY" slot; the HTML partners bar reads the same endpoint.
$.sponsors = [];
$.fetchSponsors = function() {
	fetch( '/api/sponsors' )
		.then( function( r ) { return r.json(); } )
		.then( function( d ) {
			$.sponsors = d.sponsors || [];
			var loaders = $.sponsors.filter( function( s ) {
				return s.slots && s.slots.indexOf( 'loading' ) >= 0;
			} );
			if( loaders.length ) {
				// bitmap font is uppercase + a limited glyph set
				$.loadingSponsor = ( loaders[ 0 ].name || '' ).toUpperCase().replace( /[^A-Z0-9 $.]/g, '' ).slice( 0, 18 );
			}
		} )
		.catch( function() {} );
};
$.fetchSponsors();

// Active tournament season (operator-managed from the admin Rewards tab).
// Precomputes banner lines in the bitmap font's limited glyph set
// ( $+,.\/0-9:@A-Z ) so the render loop just draws strings.
$.activeSeason = null;
$.fetchSeason = function() {
	fetch( '/api/season' )
		.then( function( r ) { return r.json(); } )
		.then( function( d ) {
			if( !d.season ) { $.activeSeason = null; return; }
			var clean = function( s, max ) {
				return ( s || '' ).toUpperCase().replace( /[^A-Z0-9 $+,.:\/@]/g, '' ).replace( /\s+/g, ' ' ).trim().slice( 0, max );
			};
			var name = clean( d.season.name, 26 ) || 'TOURNAMENT',
				prizeLine = '';
			if( d.season.prize1Usd > 0 ) {
				prizeLine = d.season.prize1Usd + ' USDC TO TOP PILOT';
			} else if( d.season.poolUsd > 0 ) {
				prizeLine = d.season.poolUsd + ' USDC PRIZE POOL';
			} else {
				prizeLine = 'EXCLUSIVE PRIZES FOR TOP PILOTS';
			}
			if( d.season.endsAt && d.season.endsAt > Date.now() ) {
				var hoursLeft = Math.max( 1, Math.round( ( d.season.endsAt - Date.now() ) / 3600000 ) );
				prizeLine += hoursLeft >= 48
					? ', ENDS IN ' + Math.round( hoursLeft / 24 ) + ' DAYS'
					: ', ENDS IN ' + hoursLeft + ' HOURS';
			}
			$.activeSeason = {
				title: name,
				prizeLine: prizeLine,
				sponsorLine: d.season.sponsorName ? clean( 'WITH ' + d.season.sponsorName, 30 ) : ''
			};
		} )
		.catch( function() {} );
};
$.fetchSeason();

// know the wallet state as soon as the game loads
$.fetchSession();
