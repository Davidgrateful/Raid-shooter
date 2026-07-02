// 3-level sound control: FULL (1), LOW (0.5), MUTE (0). $.mute stays around
// as a plain boolean ($.soundLevel === 0) since a few call sites only care
// whether sound is on at all.
$.soundLevelLabels = { 1: 'FULL', 0.5: 'LOW', 0: 'MUTE' };

$.setSoundLevel = function( level ) {
	$.soundLevel = level;
	$.mute = ( level === 0 );
	var ai = $.audio.references.length;
	while( ai-- ) {
		$.audio.references[ ai ].volume = level;
	}
	$.storage['soundLevel'] = level;
	$.updateStorage();
};

$.cycleSoundLevel = function() {
	var order = [ 1, 0.5, 0 ],
		next = order[ ( order.indexOf( $.soundLevel ) + 1 ) % order.length ];
	$.setSoundLevel( next );
	return next;
};

$.audio = {
	sounds: {},
	references: [],
	lastPlayed: {},
	play: function( sound ) {
		// Sound must NEVER break gameplay: a browser that blocks the data:
		// audio (CSP), refuses autoplay, or has an empty pool would otherwise
		// throw right where PLAY starts a run. Everything here is best-effort.
		try {
			if( $.soundLevel > 0 ){
				// throttle rapid repeats of the same sound; unbounded
				// Audio.play() spam visibly stutters mobile Safari
				var now = Date.now();
				if( $.audio.lastPlayed[ sound ] && now - $.audio.lastPlayed[ sound ] < 45 ) {
					return;
				}
				$.audio.lastPlayed[ sound ] = now;
				var audio = $.audio.sounds[ sound ];
				if( !audio || !audio.length ) { return; }
				if( audio.length > 1 ){
					audio = $.audio.sounds[ sound ][ Math.floor( $.util.rand( 0, audio.length ) ) ];
				} else {
					audio = $.audio.sounds[ sound ][ 0 ];
				}
				var el = audio.pool[ audio.tick ];
				if( el ) {
					var pr = el.play();
					// modern browsers return a promise that rejects on
					// autoplay/CSP blocks - swallow it so nothing bubbles up
					if( pr && typeof pr.catch === 'function' ) { pr.catch( function() {} ); }
				}
				if( audio.tick < audio.count - 1 ) {
					audio.tick++;
				} else {
					audio.tick = 0;
				}
			}
		} catch ( e ) {
			// audio unavailable; the game plays on silently
		}
	}
};

// Build the sound pools. Wrapped so a failure in the Audio/jsfxr setup on
// any browser can never abort the whole engine bootstrap (this file loads
// before game.js) - worst case the game is silent.
try {
	for( var k in $.definitions.audio ) {
		$.audio.sounds[ k ] = [];

		$.definitions.audio[ k ].params.forEach( function( elem, index, array ) {
			$.audio.sounds[ k ].push( {
				tick: 0,
				count: $.definitions.audio[ k ].count,
				pool: []
			} );

			for( var i = 0; i < $.definitions.audio[ k ].count; i++ ) {
				try {
					var audio = new Audio();
					audio.src = jsfxr( elem );
					$.audio.references.push( audio );
					$.audio.sounds[ k ][ index ].pool.push( audio );
				} catch ( e ) {
					// skip a sound that won't build; play() guards empty pools
				}
			}

		} );
	}
} catch ( e ) {
	// no audio available; the game plays on silently
}
