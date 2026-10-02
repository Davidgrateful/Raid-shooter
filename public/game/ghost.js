/*==============================================================================
Ghosts - race the rival's run

A duel is one seed flown twice, so the second pilot meets the same waves the
first one did. The ghost shows the first pilot's path through them: the run
is recorded as the plane's position and heading six times a second, and
played back as a translucent plane flying alongside.

  record   $.ghostStartRecording() at launch; $.ghostRecording() returns the
           compact form { v, every, pilot, color, s: [x, y, dir*100, ...] }
           (10 minutes of flight is ~3,600 numbers)
  play     $.ghostPlay(data) at launch or any time after - both sides keep
           time by the run clock ($.elapsed), so a ghost that arrives a
           moment late still flies in step; drawn until the recording ends,
           which is where the rival's run ended
  duels    the run is recorded at launch and sent with the duel score; the
           challenger is handed the first pilot's ghost (src/lib/duelGhost.ts)

Drawing only. The ghost has no body: it cannot be hit, block anything or
touch a single dice roll.
==============================================================================*/
( function() {
	var EVERY = 10; // frames between samples (6 per second at 60fps)
	var MAX = 3 * 6 * 60 * 10; // ten minutes of samples
	var rec = null, play = null;

	$.ghostStartRecording = function() {
		var ch = $.currentCharacter ? $.currentCharacter() : null;
		rec = { v: 1, every: EVERY, pilot: ch ? ch.id : 'onyix', color: $.hero ? String( $.hero.fillStyle || '' ) : '', s: [], n: 0 };
	};
	$.ghostRecording = function() {
		if( !rec ) { return null; }
		return { v: rec.v, every: rec.every, pilot: rec.pilot, color: rec.color, s: rec.s.slice() };
	};
	$.ghostPlay = function( data ) {
		play = data && data.s && data.s.length >= 6 ? { d: data } : null;
	};
	$.ghostStop = function() { rec = null; play = null; };

	// the play loop calls this once per frame: one sample per EVERY frames of
	// run clock (a long frame fills the slots it skipped with where it landed)
	$.ghostTick = function() {
		if( !rec || !$.hero || $.hero.life <= 0 ) { return; }
		var slot = Math.floor( ( $.elapsed || 0 ) / EVERY );
		while( rec.n <= slot && rec.s.length < MAX ) {
			rec.s.push( Math.round( $.hero.x ), Math.round( $.hero.y ), Math.round( ( $.hero.direction || 0 ) * 100 ) );
			rec.n++;
		}
	};

	// where the ghost is now, or null once its run has ended
	$.ghostPose = function() {
		if( !play ) { return null; }
		var s = play.d.s, every = play.d.every || EVERY, n = s.length / 3,
			fi = ( $.elapsed || 0 ) / every, i = Math.floor( fi ), f = fi - i;
		if( i >= n - 1 ) { return null; }
		var a = i * 3, b = a + 3,
			d0 = s[ a + 2 ] / 100, d1 = s[ b + 2 ] / 100, dd = Math.atan2( Math.sin( d1 - d0 ), Math.cos( d1 - d0 ) );
		return { x: s[ a ] + ( s[ b ] - s[ a ] ) * f, y: s[ a + 1 ] + ( s[ b + 1 ] - s[ a + 1 ] ) * f, direction: d0 + dd * f, pilot: play.d.pilot, color: play.d.color || '#9fe9ff' };
	};

	// drawn in world space: a translucent plane and a RIVAL tag
	$.renderGhost = function() {
		var g = $.ghostPose();
		if( !g ) { return; }
		var ctx = $.ctxmg, ch = null, list = $.definitions.characters || [];
		for( var i = 0; i < list.length; i++ ) { if( list[ i ].id === g.pilot ) { ch = list[ i ]; } }
		if( ch && ch.draw ) {
			ctx.save();
			ctx.globalAlpha = 0.35;
			ctx.translate( g.x, g.y );
			ctx.rotate( g.direction );
			ch.draw( ctx, 12, g.color, $.tick );
			ctx.restore();
		}
		ctx.save();
		ctx.globalAlpha = 0.7;
		ctx.beginPath();
		$.text( { ctx: ctx, x: g.x, y: g.y - 30, text: 'RIVAL', hspacing: 1, vspacing: 1, halign: 'center', valign: 'bottom', scale: 1, snap: 1, render: 1 } );
		ctx.fillStyle = 'hsla(45, 100%, 70%, 1)';
		ctx.fill();
		ctx.restore();
	};
} )();
