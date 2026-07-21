/*==============================================================================
Shooterboard - the global leaderboard

Anyone can play and rank: guests post a score with just a pilot name, while
a connected wallet (SIWE session) earns a verified badge. Scores submit
automatically on game over.
==============================================================================*/
$.session = { authenticated: false, address: null, guestId: null };

// A durable, device-scoped guest token in localStorage. Sent with every guest
// submission so a player's runs always attach to ONE identity even when the
// session cookie is dropped (iOS Safari ITP, in-app browsers) - the cause of
// "my score/name only sticks with a wallet". Minted once, stable forever.
$.guestToken = function() {
	// market.js calls this at script load (before game.js's $.init has run
	// $.setupStorage) - without this guard that read threw at boot and the
	// initial profile fetch silently died, so owned items/consumables
	// didn't load until the player opened the Market screen.
	if( !$.storage ) {
		$.setupStorage();
	}
	var t = $.storage[ 'guesttoken' ];
	if( !t || t.length < 8 ) {
		t = ( Date.now().toString( 36 ) + Math.random().toString( 36 ).slice( 2 ) ).replace( /[^a-z0-9]/g, '' ).slice( 0, 32 );
		$.storage[ 'guesttoken' ] = t;
		$.updateStorage();
	}
	return t;
};

// The player's own leaderboard key, used to highlight their row. Wallet
// players are keyed by address; guests by their durable "guest:<token>".
$.myKey = function() {
	if( $.session.authenticated ) {
		return $.session.address;
	}
	return 'guest:' + $.guestToken();
};

// EVERY identity that could be "me" on the board, not just the current one.
// A row is keyed at submit time, so the player's live key can desync from it:
//   - played as a guest, THEN connected a wallet -> the row is guest-keyed but
//     $.myKey() now returns the wallet address
//   - the wallet session cookie was dropped (iOS Safari ITP / in-app browser)
//     -> the client looks unauthenticated so $.myKey() returns the guest key,
//     while the row is address-keyed
// Either way "see me / jump to me" and the YOU-RANK banner would fail even
// though the player is plainly on the board. Matching against all known keys
// (plus a name fallback) fixes that.
$.myKeys = function() {
	var keys = [];
	if( $.session.authenticated && $.session.address ) { keys.push( $.session.address ); }
	if( $.guestToken ) { keys.push( 'guest:' + $.guestToken() ); }
	return keys;
};

// Find the player's own row in a list, resilient to identity desync. Two
// passes so an exact key match always wins over the weaker name fallback:
//   pass 1 - match any known key (address or guest token)
//   pass 2 - match the player's stored custom pilot name (skips the shared
//            auto-default "PILOT 1234", which many players carry)
// Returns the row index, or -1 if the player isn't ranked.
$.findMyEntryIndex = function( entries ) {
	if( !entries || !entries.length ) { return -1; }
	var keys = $.myKeys(), i, k;
	for( i = 0; i < entries.length; i++ ) {
		for( k = 0; k < keys.length; k++ ) {
			if( entries[ i ].address === keys[ k ] ) { return i; }
		}
	}
	var myName = ( $.storage && $.storage['pilotname'] ) ? String( $.storage['pilotname'] ).toUpperCase() : '';
	if( myName && myName.length >= 3 && !/^PILOT \d{4}$/.test( myName ) ) {
		for( i = 0; i < entries.length; i++ ) {
			if( entries[ i ].name && String( entries[ i ].name ).toUpperCase() === myName ) { return i; }
		}
	}
	return -1;
};
$.board = { loading: 0, error: 0, fetched: 0, entries: [], persistent: 1 };
$.boardSubmit = { state: 'idle', rank: 0, improved: false };

// Which board the SHOOTERBOARD screen is showing: 'all' (all-time global) or
// 'cup' (the live sponsored cup — only runs played while it's live count).
// The DAILY board is its own screen. A cup run still counts toward the global
// best; the CUP tab just judges the tournament on its own window.
$.boardTab = 'all';
// live cup meta ({ id, name, sponsorName, total }) or null when no cup runs
$.cupBoard = null;

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
				body: JSON.stringify( { name: input, guestToken: $.session.authenticated ? undefined : $.guestToken() } )
			} )
				.then( function() { $.fetchBoard(); } )
				.catch( function() {} );
		}
	}
};

// Every guest needs a readable name to appear on the board. If they haven't
// set one, derive a STABLE default from the durable device token (so it's the
// same call sign every run instead of a fresh random one, which read as "my
// name keeps changing back").
$.ensurePilotName = function() {
	var name = $.storage['pilotname'];
	if( !name || name.length < 3 ) {
		var tok = $.guestToken ? $.guestToken() : '',
			n = 2166136261;
		for( var i = 0; i < tok.length; i++ ) { n = ( ( n ^ tok.charCodeAt( i ) ) * 16777619 ) >>> 0; }
		name = 'PILOT ' + ( 1000 + ( n % 9000 ) );
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
	// LIVE CUP tab reads the time-boxed cup board; ALL-TIME reads the global
	// board. Both return {entries,total} in the same shape so the renderer is
	// identical. The canvas pages 250 rows and scrolls; data.total counts all.
	var cup = ( $.boardTab === 'cup' ),
		url = cup ? '/api/cup' : '/api/leaderboard?limit=250',
		requestedTab = $.boardTab;
	fetch( url )
		.then( function( res ) {
			if( !res.ok ) { throw new Error( 'board' ); }
			return res.json();
		} )
		.then( function( data ) {
			// a tab switch mid-flight wins; drop a stale response
			if( $.boardTab !== requestedTab ) { return; }
			$.board.entries = data.entries || [];
			$.board.total = ( typeof data.total === 'number' ) ? data.total : $.board.entries.length;
			$.board.persistent = ( data.persistent === false ) ? 0 : 1;
			if( cup ) {
				$.cupBoard = data.season ? {
					id: data.season.id, name: data.season.name,
					sponsorName: data.season.sponsorName || '', total: data.total || 0
				} : null;
			}
			$.board.loading = 0;
			$.board.fetched = 1;
		} )
		.catch( function() {
			$.board.loading = 0;
			$.board.error = 1;
		} );
};

// Whether a sponsored cup is live right now (drives the CUP tab's visibility).
$.cupLive = function() {
	return !!( $.seasonMeta && $.seasonMeta.live && $.seasonMeta.id );
};

// The cup's display name - fully operator-editable from the admin Rewards tab
// (it's just the active season's name). Falls back to a neutral label so the
// UI never shows an empty title. Capped to the board title's glyph budget.
$.cupLabel = function() {
	var t = ( $.activeSeason && $.activeSeason.title ) || '';
	return t || 'LIVE CUP';
};

// Short form for the narrow tab button (keeps long cup names from overflowing).
$.cupTabLabel = function() {
	var t = $.cupLabel();
	return ( t.length > 14 ) ? t.slice( 0, 14 ) : t;
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
			// spend an XP BOOST charge (if any) to double this run's pilot XP
			if( $.activateXpBoost ) { $.activateXpBoost(); }
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

	// Every run counts now - including ones that used a drone, an XP boost, or
	// a combat consumable (extra health/shield/revive). Paid help is a fair
	// part of the loadout, tuned to be a bounded comeback aid, not a score
	// multiplier. We still tell the server the run was assisted so the operator
	// can audit top runs before paying out a tournament - it just no longer
	// blocks the score from ranking.
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

		// The payload is captured once so a RETRY resends this exact run even
		// after the player has started another. The server's anti-spam
		// cooldown (one submit per identity per 20s) can catch a legitimate
		// run - finish a quick death, replay, post a monster run inside the
		// window - and before this retry existed that response was treated
		// like any error and the score was silently gone forever ("I scored
		// high and it didn't register"). Now a cooldown rejection waits out
		// the window and resends; nothing is dropped over pacing.
		var payload = {
			score: runScore,
			level: runLevel,
			kills: runKills,
			combo: runCombo,
			pilot: runPilot,
			time: runTime,
			name: pilotName,
			turnstileToken: captchaToken,
			// durable guest identity (survives cookie loss on iOS / in-app
			// browsers) so wallet-less scores always attach to one player
			guestToken: $.session.authenticated ? undefined : $.guestToken(),
			// did this run lean on a paid combat consumable? recorded for
			// operator audit only - it no longer blocks the score
			assisted: !!$.runAssisted,
			// equipped loadout at submit time - purely cosmetic, rendered as a
			// small badge next to this row on every board so a purchase is
			// visible to every other player scanning it, not just the buyer.
			// Server re-validates every field against a known-id allowlist.
			cosmetics: {
				pilotId: $.hero.character ? $.hero.character.id : undefined,
				shipColor: ( $.definitions.shipColors[ $.storage[ 'ship' ] || 0 ] || $.definitions.shipColors[ 0 ] ).color,
				trailHue: ( $.equippedTrail && $.equippedTrail() ) ? $.equippedTrail().hue : undefined,
				droneId: ( $.equippedDrone && $.equippedDrone() ) ? $.equippedDrone().id : undefined
			}
		};

		var attempt = function( retriesLeft ) {
		fetch( '/api/leaderboard', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify( payload )
		} )
			.then( function( res ) {
				if( !res.ok ) {
					return res.json().catch( function() { return {}; } ).then( function( errBody ) {
						if( errBody && errBody.error === 'rate_limited' && retriesLeft > 0 ) {
							// wait out the cooldown window, then resend this run
							setTimeout( function() { attempt( retriesLeft - 1 ); }, 21000 );
							throw new Error( 'retrying' );
						}
						throw new Error( 'submit' );
					} );
				}
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
				$.boardSubmit = { state: 'done', rank: data.rank || 0, improved: !!data.improved, verified: !!data.verified, total: data.total || 0 };

				// if this pilot arrived through an invite, credit the inviter
				// now that they've posted a real run (server gates on score)
				if( $.claimReferral ) { $.claimReferral( runScore ); }

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
			.catch( function( err ) {
				// 'retrying' means a resend is already scheduled - keep the
				// SENDING state so the UI never claims failure for a run
				// that's still on its way to the board
				if( err && err.message === 'retrying' ) { return; }
				$.boardSubmit = { state: 'error', rank: 0, improved: false, verified: false };
			} );
		};
		attempt( 1 );
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
				( rank ? '&rank=' + rank : '' ) +
				// stamp the card when this run (or an earlier one today)
				// cleared the daily challenge - shares recruit challengers
				( ( $.dailyDone && $.dailyDone() ) ? '&daily=1' : '' ),
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
			if( !d.season ) { $.activeSeason = null; $.seasonMeta = null; return; }
			// raw meta drives the LIVE CUP tab (id + live flag)
			$.seasonMeta = { id: d.season.id || null, live: !!d.season.live };
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
			// short prize headline for the menu cup panel (no ends-in text -
			// the panel renders a live ticking countdown from endsAt instead)
			var prizeShort = ( d.season.prize1Usd > 0 )
				? ( d.season.prize1Usd + ' USDC TO TOP PILOT' )
				: ( d.season.poolUsd > 0 ? ( d.season.poolUsd + ' USDC PRIZE POOL' ) : 'EXCLUSIVE PRIZES' );
			$.activeSeason = {
				title: name,
				prizeLine: prizeLine,
				prizeShort: prizeShort,
				endsAt: ( d.season.endsAt && d.season.endsAt > Date.now() ) ? d.season.endsAt : 0,
				sponsorLine: d.season.sponsorName ? clean( 'WITH ' + d.season.sponsorName, 30 ) : ''
			};
		} )
		.catch( function() {} );
};
$.fetchSeason();

// Live "time left" for the cup, formatted in the bitmap font's glyph set:
// "2D 14:33:07" when days remain, else "14:33:07". Returns '' when no cup
// or no end time. Recomputed each frame so it ticks.
$.cupTimeLeft = function() {
	if( !$.activeSeason || !$.activeSeason.endsAt ) { return ''; }
	var ms = $.activeSeason.endsAt - Date.now();
	if( ms <= 0 ) { return 'ENDED'; }
	var s = Math.floor( ms / 1000 ),
		d = Math.floor( s / 86400 ),
		h = Math.floor( ( s % 86400 ) / 3600 ),
		m = Math.floor( ( s % 3600 ) / 60 ),
		sec = s % 60,
		pad = function( n ) { return ( n < 10 ? '0' : '' ) + n; };
	return ( d > 0 ? d + 'D ' : '' ) + pad( h ) + ':' + pad( m ) + ':' + pad( sec );
};

// know the wallet state as soon as the game loads
$.fetchSession();
