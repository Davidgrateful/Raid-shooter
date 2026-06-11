/*==============================================================================
Shooterboard - the global leaderboard

Anyone can view the board; a connected wallet (SIWE session) is what lets
a player claim their rank. Scores submit automatically on game over.
==============================================================================*/
$.session = { authenticated: false, address: null };
$.board = { loading: 0, error: 0, fetched: 0, entries: [] };
$.boardSubmit = { state: 'idle', rank: 0, improved: false };

// bitmap font has no period, so the short form uses a space: 0X12AB 34CD
$.shortAddress = function( address ) {
	if( !address ) {
		return '';
	}
	return ( '0X' + address.slice( 2, 6 ) + ' ' + address.slice( -4 ) ).toUpperCase();
};

$.boardDisplayName = function( entry ) {
	return entry.name || $.shortAddress( entry.address );
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
		// apply the new name to an existing board entry right away
		if( $.session.authenticated ) {
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

$.fetchSession = function() {
	return fetch( '/api/siwe/session' )
		.then( function( res ) { return res.json(); } )
		.then( function( data ) {
			$.session.authenticated = !!data.authenticated;
			$.session.address = data.address ? data.address.toLowerCase() : null;
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
			$.board.loading = 0;
			$.board.fetched = 1;
		} )
		.catch( function() {
			$.board.loading = 0;
			$.board.error = 1;
		} );
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

	$.boardSubmit = { state: 'sending', rank: 0, improved: false };

	// re-check the session right before submitting: the player may have
	// connected their wallet at any point during the run
	$.fetchSession().then( function() {
		if( !$.session.authenticated ) {
			$.boardSubmit = { state: 'guest', rank: 0, improved: false };
			return;
		}
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
				name: $.storage['pilotname'] || undefined
			} )
		} )
			.then( function( res ) {
				if( !res.ok ) { throw new Error( 'submit' ); }
				return res.json();
			} )
			.then( function( data ) {
				$.boardSubmit = { state: 'done', rank: data.rank || 0, improved: !!data.improved };
			} )
			.catch( function() {
				$.boardSubmit = { state: 'error', rank: 0, improved: false };
			} );
	} );
};

// know the wallet state as soon as the game loads
$.fetchSession();
