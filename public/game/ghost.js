/*==============================================================================
Ghosts - race the rival's run

A duel is one seed flown twice, so the second pilot meets the same waves the
first one did. The ghost shows the first pilot's path through them: the run
is recorded as the plane's position and heading six times a second, and
played back as a translucent plane flying alongside.

  record   $.ghostStartRecording() at launch; $.ghostRecording() returns the
           compact form { v, every, pilot, color, s: [x, y, dir*100, ...] }
           (10 minutes of flight is ~3,600 numbers)
  play     $.ghostPlay(data) before launch; drawn every frame until the
           recording ends, which is where the rival's run ended

Drawing only. The ghost has no body: it cannot be hit, block anything or
touch a single dice roll.
==============================================================================*/
( function() {
	var EVERY = 10; // frames between samples (6 per second at 60fps)
	var MAX = 3 * 6 * 60 * 10; // ten minutes of samples
	var rec = null, play = null;

	$.ghostStartRecording = function() {
		var ch = $.currentCharacter ? $.currentCharacter() : null;
		rec = { v: 1, every: EVERY, pilot: ch ? ch.id : 'onyix', color: $.hero ? String( $.hero.fillStyle || '' ) : '', s: [], f: EVERY };
	};
	$.ghostRecording = function() {
		if( !rec ) { return null; }
		return { v: rec.v, every: rec.every, pilot: rec.pilot, color: rec.color, s: rec.s.slice() };
	};
	$.ghostPlay = function( data ) {
		play = data && data.s && data.s.length >= 6 ? { d: data, t: 0, gone: 0 } : null;
	};
	$.ghostStop = function() { rec = null; play = null; if( $.arena3d && $.arena3d.setGhost ) { $.arena3d.setGhost( null ); } };

	// the play loop calls this once per frame, before drawing
	$.ghostTick = function() {
		var dt = $.dt;
		if( rec && $.hero && $.hero.life > 0 && rec.s.length < MAX ) {
			rec.f += dt;
			if( rec.f >= EVERY ) {
				rec.f -= EVERY;
				rec.s.push( Math.round( $.hero.x ), Math.round( $.hero.y ), Math.round( ( $.hero.direction || 0 ) * 100 ) );
			}
		}
		if( play ) { play.t += dt; }
	};

	// where the ghost is now, or null once its run has ended
	$.ghostPose = function() {
		if( !play ) { return null; }
		var s = play.d.s, every = play.d.every || EVERY, n = s.length / 3,
			fi = play.t / every, i = Math.floor( fi ), f = fi - i;
		if( i >= n - 1 ) { return null; }
		var a = i * 3, b = a + 3,
			d0 = s[ a + 2 ] / 100, d1 = s[ b + 2 ] / 100, dd = Math.atan2( Math.sin( d1 - d0 ), Math.cos( d1 - d0 ) );
		return { x: s[ a ] + ( s[ b ] - s[ a ] ) * f, y: s[ a + 1 ] + ( s[ b + 1 ] - s[ a + 1 ] ) * f, direction: d0 + dd * f, pilot: play.d.pilot, color: play.d.color || '#9fe9ff' };
	};

	// drawn in world space: a translucent plane and a RIVAL tag
	$.renderGhost = function() {
		var g = $.ghostPose();
		var three = $.arena3d && $.arena3d.active && $.arena3d.setGhost;
		if( three ) { $.arena3d.setGhost( g ? { x: g.x, y: g.y, direction: g.direction, pilotId: g.pilot, color: g.color } : null ); }
		if( !g ) { return; }
		var ctx = $.ctxmg;
		if( !three ) {
			var ch = null, list = $.definitions.characters || [];
			for( var i = 0; i < list.length; i++ ) { if( list[ i ].id === g.pilot ) { ch = list[ i ]; } }
			if( ch && ch.draw ) {
				ctx.save();
				ctx.globalAlpha = 0.35;
				ctx.translate( g.x, g.y );
				ctx.rotate( g.direction );
				ch.draw( ctx, 12, g.color, $.tick );
				ctx.restore();
			}
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
