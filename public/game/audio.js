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
	// Web Audio path volume
	if( $.audio.gain ) { $.audio.gain.gain.value = level; }
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
	// Web Audio path: each jsfxr sound decoded ONCE into an AudioBuffer;
	// playback is a BufferSource node - practically free, mixed off the main
	// thread. HTMLAudioElement.play() per shot was the iPhone shooting lag:
	// on iOS Safari every play() re-runs element/decode work on the main
	// thread, and firing stacks shot+hit+explosion sounds every frame.
	ctx: null,
	gain: null,
	buffers: {},
	unlocked: 0,
	// build/resume the context on a user gesture (autoplay rules)
	unlock: function() {
		try {
			if( !$.audio.ctx ) {
				var AC = window.AudioContext || window.webkitAudioContext;
				if( !AC ) { return; }
				$.audio.ctx = new AC();
				$.audio.gain = $.audio.ctx.createGain();
				$.audio.gain.gain.value = $.soundLevel !== undefined ? $.soundLevel : 0.5;
				$.audio.gain.connect( $.audio.ctx.destination );
				$.audio.decodeAll();
			}
			if( $.audio.ctx.state === 'suspended' ) { $.audio.ctx.resume(); }
			$.audio.unlocked = 1;
		} catch ( e ) {
			// stay on the HTMLAudio fallback
		}
	},
	// decode every pooled data:audio/wav into an AudioBuffer (once)
	decodeAll: function() {
		try {
			for( var k in $.audio.sounds ) {
				( function( key ) {
					var variants = $.audio.sounds[ key ];
					if( !variants || !variants.length ) { return; }
					$.audio.buffers[ key ] = [];
					for( var v = 0; v < variants.length; v++ ) {
						var el = variants[ v ].pool[ 0 ];
						if( !el || !el.src || el.src.indexOf( 'base64,' ) < 0 ) { continue; }
						var b64 = el.src.slice( el.src.indexOf( 'base64,' ) + 7 ),
							bin = atob( b64 ),
							bytes = new Uint8Array( bin.length );
						for( var i = 0; i < bin.length; i++ ) { bytes[ i ] = bin.charCodeAt( i ); }
						$.audio.ctx.decodeAudioData( bytes.buffer, ( function( kk ) {
							return function( buf ) { $.audio.buffers[ kk ].push( buf ); };
						} )( key ), function() {} );
					}
				} )( k );
			}
		} catch ( e ) {
			// decode failure -> fallback path still works
		}
	},
	play: function( sound ) {
		// Sound must NEVER break gameplay: everything here is best-effort.
		try {
			if( $.soundLevel > 0 ){
				// throttle rapid repeats of the same sound; unbounded spam
				// stutters mobile browsers even on Web Audio
				var now = Date.now();
				if( $.audio.lastPlayed[ sound ] && now - $.audio.lastPlayed[ sound ] < 45 ) {
					return;
				}
				$.audio.lastPlayed[ sound ] = now;

				// fast path: Web Audio buffer (decoded once, cheap to fire)
				var bufs = $.audio.buffers[ sound ];
				if( $.audio.ctx && bufs && bufs.length ) {
					var buf = bufs.length > 1 ? bufs[ Math.floor( $.util.rand( 0, bufs.length ) ) ] : bufs[ 0 ],
						src = $.audio.ctx.createBufferSource();
					src.buffer = buf;
					src.connect( $.audio.gain );
					src.start( 0 );
					return;
				}

				// fallback: the original HTMLAudio pool
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

// unlock Web Audio on the first user gesture (tap/click/key) - required by
// autoplay policy, and the moment the cheap playback path becomes available
( function() {
	var unlockOnce = function() {
		$.audio.unlock();
		window.removeEventListener( 'pointerdown', unlockOnce );
		window.removeEventListener( 'touchstart', unlockOnce );
		window.removeEventListener( 'keydown', unlockOnce );
	};
	window.addEventListener( 'pointerdown', unlockOnce );
	window.addEventListener( 'touchstart', unlockOnce );
	window.addEventListener( 'keydown', unlockOnce );
} )();

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
