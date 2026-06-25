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
		if( $.soundLevel > 0 ){
			// throttle rapid repeats of the same sound; unbounded
			// Audio.play() spam visibly stutters mobile Safari
			var now = Date.now();
			if( $.audio.lastPlayed[ sound ] && now - $.audio.lastPlayed[ sound ] < 45 ) {
				return;
			}
			$.audio.lastPlayed[ sound ] = now;
			var audio = $.audio.sounds[ sound ];
			if( audio.length > 1 ){
				audio = $.audio.sounds[ sound ][ Math.floor( $.util.rand( 0, audio.length ) ) ];
			} else {
				audio = $.audio.sounds[ sound ][ 0 ];
			}
			audio.pool[ audio.tick ].play();		
			if( audio.tick < audio.count - 1 ) {
				audio.tick++;
			} else {
				audio.tick = 0;
			}
		}
	}
};

for( var k in $.definitions.audio ) {
	$.audio.sounds[ k ] = [];

	$.definitions.audio[ k ].params.forEach( function( elem, index, array ) {
		$.audio.sounds[ k ].push( {
			tick: 0,
			count: $.definitions.audio[ k ].count,
			pool: []
		} );

		for( var i = 0; i < $.definitions.audio[ k ].count; i++ ) {
			var audio = new Audio();
			audio.src = jsfxr( elem );			
			$.audio.references.push( audio );
			$.audio.sounds[ k ][ index ].pool.push( audio );
		}

	} );
}
