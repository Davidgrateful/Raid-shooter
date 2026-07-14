/*==============================================================================
Enemy Shapes - animated neon creatures

Layered glow (wide faint stroke under a hot thin stroke), pulsing cores,
and moving parts: mandibles snap, wings flicker, armor counter-rotates,
engines burn. Context arrives translated to the enemy and rotated to its
travel direction; +x is forward. The passed fill/stroke follow behavior
color animation (kamikaze flash, grower rainbow), glow layers use hue.
==============================================================================*/
$.hsla = function( h, s, l, a ) {
	return 'hsla(' + h + ', ' + s + '%, ' + l + '%, ' + a + ')';
};

$.neonStroke = function( ctx, hue, sat, stroke ) {
	ctx.lineWidth = 6;
	ctx.strokeStyle = $.hsla( hue, sat, 60, 0.22 );
	ctx.stroke();
	ctx.lineWidth = 1.8;
	ctx.strokeStyle = stroke;
	ctx.stroke();
};

$.coreEye = function( ctx, x, y, r, hue, sat, tick ) {
	var pulse = 0.6 + Math.cos( tick / 6 ) * 0.25;
	ctx.beginPath(); ctx.arc( x, y, r * 1.7, 0, $.twopi );
	ctx.fillStyle = $.hsla( hue, sat, 70, 0.18 * pulse + 0.08 ); ctx.fill();
	ctx.beginPath(); ctx.arc( x, y, r, 0, $.twopi );
	ctx.fillStyle = $.hsla( hue, sat, 85, pulse ); ctx.fill();
};

$.exhaust = function( ctx, x, r, hue, tick ) {
	var flame = r * ( 0.8 + Math.random() * 0.7 );
	ctx.beginPath();
	ctx.moveTo( x, r * 0.3 ); ctx.lineTo( x - flame, 0 ); ctx.lineTo( x, -r * 0.3 );
	ctx.closePath();
	ctx.fillStyle = $.hsla( hue, 100, 70, 0.55 );
	ctx.fill();
};

$.enemyShapes = {
	orb: function( ctx, r, fill, stroke, tick, e ) {
		ctx.beginPath(); ctx.arc( 0, 0, r, 0, $.twopi );
		ctx.fillStyle = fill; ctx.fill();
		$.neonStroke( ctx, e.hue, e.saturation, stroke );
		$.coreEye( ctx, 0, 0, r * 0.3, e.hue, e.saturation, tick );
	},
	// patrol drone: angular hull, canopy slit, twin burning engines
	shuttle: function( ctx, r, fill, stroke, tick, e ) {
		$.exhaust( ctx, -r * 0.9, r * 0.7, e.hue, tick );
		ctx.beginPath();
		ctx.moveTo( r * 1.4, 0 ); ctx.lineTo( r * 0.4, r * 0.65 ); ctx.lineTo( -r * 0.7, r * 0.45 );
		ctx.lineTo( -r * 0.95, 0 ); ctx.lineTo( -r * 0.7, -r * 0.45 ); ctx.lineTo( r * 0.4, -r * 0.65 );
		ctx.closePath();
		ctx.fillStyle = fill; ctx.fill();
		$.neonStroke( ctx, e.hue, e.saturation, stroke );
		ctx.beginPath();
		ctx.moveTo( r * 0.9, 0 ); ctx.lineTo( r * 0.1, r * 0.28 ); ctx.lineTo( r * 0.1, -r * 0.28 );
		ctx.closePath();
		ctx.fillStyle = $.hsla( e.hue, e.saturation, 85, 0.8 + Math.cos( tick / 9 ) * 0.2 );
		ctx.fill();
	},
	// razor wing: swept blade, hot leading edge, tilting wingtips
	slant: function( ctx, r, fill, stroke, tick, e ) {
		var tilt = Math.cos( tick / 11 ) * r * 0.15;
		ctx.beginPath();
		ctx.moveTo( r * 1.2, -r * 0.15 );
		ctx.lineTo( r * 0.1, r * 0.75 + tilt ); ctx.lineTo( -r * 1.1, r * 0.55 + tilt );
		ctx.lineTo( -r * 0.45, -r * 0.1 );
		ctx.lineTo( -r * 1.1, -r * 0.55 - tilt ); ctx.lineTo( r * 0.1, -r * 0.75 - tilt );
		ctx.closePath();
		ctx.fillStyle = fill; ctx.fill();
		$.neonStroke( ctx, e.hue, e.saturation, stroke );
		ctx.beginPath();
		ctx.moveTo( r * 1.2, -r * 0.15 ); ctx.lineTo( r * 0.1, r * 0.75 + tilt );
		ctx.lineWidth = 2.5;
		ctx.strokeStyle = $.hsla( e.hue, e.saturation, 90, 0.9 );
		ctx.stroke();
	},
	// fang: predator head with snapping mandibles and a hunting eye
	chevron: function( ctx, r, fill, stroke, tick, e ) {
		var jaw = 0.35 + ( Math.cos( tick / 7 ) + 1 ) * 0.22;
		ctx.beginPath();
		ctx.moveTo( r * 0.9, 0 ); ctx.lineTo( -r * 0.7, r * 0.8 ); ctx.lineTo( -r * 0.25, 0 ); ctx.lineTo( -r * 0.7, -r * 0.8 );
		ctx.closePath();
		ctx.fillStyle = fill; ctx.fill();
		$.neonStroke( ctx, e.hue, e.saturation, stroke );
		// mandibles
		ctx.lineWidth = 2.2;
		ctx.strokeStyle = $.hsla( e.hue, e.saturation, 80, 1 );
		ctx.beginPath();
		ctx.moveTo( r * 0.5, r * 0.35 );
		ctx.quadraticCurveTo( r * 1.25, r * jaw, r * 1.5, r * ( jaw - 0.25 ) );
		ctx.moveTo( r * 0.5, -r * 0.35 );
		ctx.quadraticCurveTo( r * 1.25, -r * jaw, r * 1.5, -r * ( jaw - 0.25 ) );
		ctx.stroke();
		$.coreEye( ctx, r * 0.05, 0, r * 0.22, e.hue, e.saturation, tick );
	},
	// cube brute: wireframe depth, glowing seams, caged core
	block: function( ctx, r, fill, stroke, tick, e ) {
		var o = r * 0.3;
		ctx.beginPath(); ctx.rect( -r * 0.85 - o, -r * 0.85 - o, r * 1.7, r * 1.7 );
		ctx.lineWidth = 1.2; ctx.strokeStyle = $.hsla( e.hue, e.saturation, 50, 0.45 ); ctx.stroke();
		ctx.beginPath();
		ctx.moveTo( -r * 0.85 - o, -r * 0.85 - o ); ctx.lineTo( -r * 0.85, -r * 0.85 );
		ctx.moveTo( r * 0.85 - o, -r * 0.85 - o ); ctx.lineTo( r * 0.85, -r * 0.85 );
		ctx.moveTo( -r * 0.85 - o, r * 0.85 - o ); ctx.lineTo( -r * 0.85, r * 0.85 );
		ctx.moveTo( r * 0.85 - o, r * 0.85 - o ); ctx.lineTo( r * 0.85, r * 0.85 );
		ctx.stroke();
		ctx.beginPath(); ctx.rect( -r * 0.85, -r * 0.85, r * 1.7, r * 1.7 );
		ctx.fillStyle = fill; ctx.fill();
		$.neonStroke( ctx, e.hue, e.saturation, stroke );
		var seam = 0.5 + ( Math.cos( tick / 8 ) + 1 ) * 0.25;
		ctx.lineWidth = 1.5;
		ctx.strokeStyle = $.hsla( e.hue, e.saturation, 85, seam );
		ctx.beginPath();
		ctx.moveTo( 0, -r * 0.85 ); ctx.lineTo( 0, r * 0.85 );
		ctx.moveTo( -r * 0.85, 0 ); ctx.lineTo( r * 0.85, 0 );
		ctx.stroke();
		$.coreEye( ctx, 0, 0, r * 0.2, e.hue, e.saturation, tick );
	},
	// scrap golem: three jagged fragments orbiting a furious core
	tumbler: function( ctx, r, fill, stroke, tick, e ) {
		for( var f = 0; f < 3; f++ ) {
			ctx.save();
			ctx.rotate( tick / ( 22 + f * 9 ) + f * $.twopi / 3 );
			ctx.translate( r * 0.55, 0 );
			ctx.rotate( tick / 15 );
			ctx.beginPath();
			ctx.moveTo( r * 0.5, 0 ); ctx.lineTo( 0, r * 0.42 ); ctx.lineTo( -r * 0.45, r * 0.08 ); ctx.lineTo( -r * 0.2, -r * 0.4 );
			ctx.closePath();
			ctx.fillStyle = fill; ctx.fill();
			$.neonStroke( ctx, e.hue, e.saturation, stroke );
			ctx.restore();
		}
		$.coreEye( ctx, 0, 0, r * 0.3, e.hue, e.saturation, tick );
	},
	// hellfire: burning core dragging a living flame tail
	comet: function( ctx, r, fill, stroke, tick, e ) {
		for( var t = 0; t < 3; t++ ) {
			var flame = r * ( 1.2 + t * 0.5 + Math.random() * 0.6 );
			ctx.beginPath();
			ctx.moveTo( -r * 0.2, r * ( 0.55 - t * 0.14 ) );
			ctx.lineTo( -flame, 0 );
			ctx.lineTo( -r * 0.2, -r * ( 0.55 - t * 0.14 ) );
			ctx.closePath();
			ctx.fillStyle = $.hsla( e.hue + t * 12, 100, 60 + t * 10, 0.4 - t * 0.1 );
			ctx.fill();
		}
		ctx.beginPath(); ctx.arc( r * 0.25, 0, r * 0.85, 0, $.twopi );
		ctx.fillStyle = fill; ctx.fill();
		$.neonStroke( ctx, e.hue, e.saturation, stroke );
		$.coreEye( ctx, r * 0.35, 0, r * 0.32, e.hue, e.saturation, e.armed ? tick * 3 : tick );
	},
	// stinger wasp: segmented insect, flickering wings, venom tip
	wasp: function( ctx, r, fill, stroke, tick, e ) {
		var wingUp = ( Math.floor( tick / 3 ) % 2 );
		ctx.lineWidth = 1.4;
		ctx.strokeStyle = $.hsla( e.hue, 60, 85, wingUp ? 0.7 : 0.25 );
		ctx.beginPath(); ctx.ellipse( -r * 0.15, -r * 0.75, r * 0.7, r * 0.28, -0.5, 0, $.twopi ); ctx.stroke();
		ctx.strokeStyle = $.hsla( e.hue, 60, 85, wingUp ? 0.25 : 0.7 );
		ctx.beginPath(); ctx.ellipse( -r * 0.15, r * 0.75, r * 0.7, r * 0.28, 0.5, 0, $.twopi ); ctx.stroke();
		ctx.beginPath(); ctx.ellipse( -r * 0.65, 0, r * 0.6, r * 0.42, 0, 0, $.twopi );
		ctx.fillStyle = fill; ctx.fill();
		$.neonStroke( ctx, e.hue, e.saturation, stroke );
		ctx.beginPath(); ctx.arc( r * 0.25, 0, r * 0.4, 0, $.twopi );
		ctx.fillStyle = fill; ctx.fill();
		$.neonStroke( ctx, e.hue, e.saturation, stroke );
		ctx.beginPath();
		ctx.moveTo( r * 0.6, r * 0.18 ); ctx.lineTo( r * 1.25, 0 ); ctx.lineTo( r * 0.6, -r * 0.18 );
		ctx.closePath();
		ctx.fillStyle = $.hsla( e.hue, 100, 80, 0.95 ); ctx.fill();
		$.coreEye( ctx, r * 0.28, 0, r * 0.15, e.hue, e.saturation, tick );
	},
	// phantom: a blade that leaves afterimages of itself
	sliver: function( ctx, r, fill, stroke, tick, e ) {
		for( var ghost = 2; ghost >= 0; ghost-- ) {
			var off = ghost * r * 0.55,
				alpha = [ 1, 0.35, 0.15 ][ ghost ];
			ctx.beginPath();
			ctx.moveTo( r * 1.5 - off, 0 ); ctx.lineTo( -r * 1.1 - off, r * 0.38 ); ctx.lineTo( -r * 0.7 - off, 0 ); ctx.lineTo( -r * 1.1 - off, -r * 0.38 );
			ctx.closePath();
			ctx.fillStyle = $.hsla( e.hue, e.saturation, 60, 0.12 * alpha );
			ctx.fill();
			ctx.lineWidth = 1.5;
			ctx.strokeStyle = $.hsla( e.hue, e.saturation, 55, alpha );
			ctx.stroke();
		}
		$.coreEye( ctx, r * 0.25, 0, r * 0.16, e.hue, 30, tick );
	},
	// juggernaut: counter-rotating armor rings around a furnace core
	heavy: function( ctx, r, fill, stroke, tick, e ) {
		ctx.save();
		ctx.rotate( tick / 50 );
		ctx.beginPath();
		for( var p = 0; p < 6; p++ ) {
			var a = p / 6 * $.twopi;
			if( p === 0 ) { ctx.moveTo( Math.cos( a ) * r, Math.sin( a ) * r ); } else { ctx.lineTo( Math.cos( a ) * r, Math.sin( a ) * r ); }
		}
		ctx.closePath();
		ctx.fillStyle = fill; ctx.fill();
		$.neonStroke( ctx, e.hue, e.saturation, stroke );
		ctx.restore();
		ctx.save();
		ctx.rotate( -tick / 30 );
		ctx.beginPath();
		for( var p = 0; p < 6; p++ ) {
			var a = p / 6 * $.twopi + $.pi / 6;
			if( p === 0 ) { ctx.moveTo( Math.cos( a ) * r * 0.62, Math.sin( a ) * r * 0.62 ); } else { ctx.lineTo( Math.cos( a ) * r * 0.62, Math.sin( a ) * r * 0.62 ); }
		}
		ctx.closePath();
		ctx.lineWidth = 2.5;
		ctx.strokeStyle = $.hsla( e.hue, e.saturation, 75, 0.9 );
		ctx.stroke();
		ctx.restore();
		$.coreEye( ctx, 0, 0, r * 0.24, e.hue, e.saturation, tick );
	},
	// mother spore: breathing petals, drifting spores, warm green heart
	bloom: function( ctx, r, fill, stroke, tick, e ) {
		ctx.rotate( tick / 60 );
		for( var p = 0; p < 5; p++ ) {
			var breathe = 1 + Math.cos( tick / 9 + p * 1.3 ) * 0.14;
			ctx.save();
			ctx.rotate( p * $.twopi / 5 );
			ctx.beginPath();
			ctx.ellipse( r * 0.62 * breathe, 0, r * 0.52 * breathe, r * 0.26, 0, 0, $.twopi );
			ctx.fillStyle = fill; ctx.fill();
			ctx.lineWidth = 1.5; ctx.strokeStyle = stroke; ctx.stroke();
			ctx.restore();
		}
		for( var sp = 0; sp < 3; sp++ ) {
			var sa = tick / 14 + sp * $.twopi / 3;
			ctx.beginPath();
			ctx.arc( Math.cos( sa ) * r * 1.25, Math.sin( sa ) * r * 1.25, r * 0.09, 0, $.twopi );
			ctx.fillStyle = $.hsla( e.hue, 100, 80, 0.8 );
			ctx.fill();
		}
		$.coreEye( ctx, 0, 0, r * 0.3, e.hue, e.saturation, tick );
	},
	// needle: a tracer round with a soul
	dartlet: function( ctx, r, fill, stroke, tick, e ) {
		$.exhaust( ctx, -r * 0.7, r * 0.5, e.hue, tick );
		ctx.beginPath();
		ctx.moveTo( r * 1.4, 0 ); ctx.lineTo( -r * 0.7, r * 0.5 ); ctx.lineTo( -r * 0.35, 0 ); ctx.lineTo( -r * 0.7, -r * 0.5 );
		ctx.closePath();
		ctx.fillStyle = fill; ctx.fill();
		$.neonStroke( ctx, e.hue, e.saturation, stroke );
		$.coreEye( ctx, r * 0.15, 0, r * 0.15, e.hue, e.saturation, tick );
	},
	// star feeder: hungry spikes that reach as it grows
	star: function( ctx, r, fill, stroke, tick, e ) {
		ctx.rotate( tick / 35 );
		var reach = 1 + Math.cos( tick / 6 ) * 0.16;
		ctx.beginPath();
		for( var p = 0; p < 16; p++ ) {
			var a = p / 16 * $.twopi,
				pr = ( p % 2 ) ? r * 0.5 : r * reach;
			if( p === 0 ) { ctx.moveTo( Math.cos( a ) * pr, Math.sin( a ) * pr ); } else { ctx.lineTo( Math.cos( a ) * pr, Math.sin( a ) * pr ); }
		}
		ctx.closePath();
		ctx.fillStyle = fill; ctx.fill();
		$.neonStroke( ctx, e.hue, e.saturation, stroke );
		ctx.beginPath();
		ctx.arc( 0, 0, r * 0.3, tick / 8, tick / 8 + $.pi * 1.4 );
		ctx.lineWidth = 2; ctx.strokeStyle = $.hsla( e.hue, e.saturation, 85, 0.9 ); ctx.stroke();
	},
	// deadeye: hovering gun pod, spinning sight ring, charging muzzle
	turret: function( ctx, r, fill, stroke, tick, e ) {
		ctx.save();
		ctx.rotate( tick / 20 );
		ctx.beginPath();
		ctx.arc( 0, 0, r * 1.15, 0, $.pi * 0.6 );
		ctx.moveTo( Math.cos( $.pi ) * r * 1.15, Math.sin( $.pi ) * r * 1.15 );
		ctx.arc( 0, 0, r * 1.15, $.pi, $.pi * 1.6 );
		ctx.lineWidth = 1.6;
		ctx.strokeStyle = $.hsla( e.hue, e.saturation, 70, 0.7 );
		ctx.stroke();
		ctx.restore();
		ctx.beginPath();
		ctx.moveTo( r * 0.7, 0 ); ctx.lineTo( 0, r * 0.7 ); ctx.lineTo( -r * 0.7, 0 ); ctx.lineTo( 0, -r * 0.7 );
		ctx.closePath();
		ctx.fillStyle = fill; ctx.fill();
		$.neonStroke( ctx, e.hue, e.saturation, stroke );
		ctx.fillStyle = stroke;
		ctx.fillRect( r * 0.4, -r * 0.11, r * 1.15, r * 0.22 );
		var charge = ( Math.cos( tick / 5 ) + 1 ) / 2;
		ctx.beginPath(); ctx.arc( r * 1.55, 0, r * 0.16 + charge * r * 0.1, 0, $.twopi );
		ctx.fillStyle = $.hsla( e.hue, 100, 80, 0.4 + charge * 0.6 ); ctx.fill();
	},
	// reaper moon: scythe crescent with a cold staring eye
	crescent: function( ctx, r, fill, stroke, tick, e ) {
		ctx.beginPath();
		ctx.arc( 0, 0, r, -$.pi * 0.62, $.pi * 0.62 );
		ctx.arc( -r * 0.5, 0, r * 0.78, $.pi * 0.5, -$.pi * 0.5, true );
		ctx.closePath();
		ctx.fillStyle = fill; ctx.fill();
		$.neonStroke( ctx, e.hue, e.saturation, stroke );
		ctx.beginPath();
		ctx.arc( 0, 0, r, -$.pi * 0.55, $.pi * 0.55 );
		ctx.lineWidth = 2.5;
		ctx.strokeStyle = $.hsla( e.hue, e.saturation, 90, 0.85 );
		ctx.stroke();
		$.coreEye( ctx, r * 0.45, 0, r * 0.18, e.hue, e.saturation, tick );
	},
	// broodmother: armored womb full of pulsing eggs
	hive: function( ctx, r, fill, stroke, tick, e ) {
		ctx.rotate( tick / 70 );
		ctx.beginPath();
		for( var p = 0; p < 5; p++ ) {
			var a = p / 5 * $.twopi;
			if( p === 0 ) { ctx.moveTo( Math.cos( a ) * r, Math.sin( a ) * r ); } else { ctx.lineTo( Math.cos( a ) * r, Math.sin( a ) * r ); }
		}
		ctx.closePath();
		ctx.fillStyle = fill; ctx.fill();
		$.neonStroke( ctx, e.hue, e.saturation, stroke );
		for( var egg = 0; egg < 3; egg++ ) {
			var ea = egg * $.twopi / 3 + $.pi / 2,
				grow = 0.16 + ( ( Math.cos( tick / 10 + egg * 2 ) + 1 ) / 2 ) * 0.1;
			ctx.beginPath();
			ctx.arc( Math.cos( ea ) * r * 0.45, Math.sin( ea ) * r * 0.45, r * grow, 0, $.twopi );
			ctx.fillStyle = $.hsla( e.hue, 100, 75, 0.85 );
			ctx.fill();
		}
	},
	// bastion: orbital shield plates guarding a war core
	fort: function( ctx, r, fill, stroke, tick, e ) {
		ctx.beginPath();
		ctx.rect( -r * 0.7, -r * 0.7, r * 1.4, r * 1.4 );
		ctx.fillStyle = fill; ctx.fill();
		$.neonStroke( ctx, e.hue, e.saturation, stroke );
		ctx.save();
		ctx.rotate( tick / 25 );
		ctx.lineWidth = 4;
		ctx.strokeStyle = $.hsla( e.hue, e.saturation, 70, 0.85 );
		for( var plate = 0; plate < 4; plate++ ) {
			var pa = plate * $.pi / 2;
			ctx.beginPath();
			ctx.arc( 0, 0, r * 1.25, pa, pa + $.pi * 0.3 );
			ctx.stroke();
		}
		ctx.restore();
		$.coreEye( ctx, 0, 0, r * 0.26, e.hue, e.saturation, tick );
	},
	// shard: white-hot bolt with a streaking tail
	shard: function( ctx, r, fill, stroke, tick, e ) {
		ctx.beginPath();
		ctx.moveTo( -r * 0.6, 0 ); ctx.lineTo( -r * 2.6, 0 );
		ctx.lineWidth = r * 0.5;
		ctx.strokeStyle = $.hsla( e.hue, 100, 65, 0.25 );
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo( r * 1.6, 0 ); ctx.lineTo( -r, r * 0.5 ); ctx.lineTo( -r * 0.5, 0 ); ctx.lineTo( -r, -r * 0.5 );
		ctx.closePath();
		ctx.fillStyle = $.hsla( e.hue, 100, 80, 1 );
		ctx.fill();
	},
	// phantom: a jitter-strafing dart trailing dodge echoes; flares when it slips a bullet
	phantom: function( ctx, r, fill, stroke, tick, e ) {
		var d = e.dodgeFlash || 0;
		for( var g = 2; g >= 0; g-- ) {
			var off = g * r * ( 0.5 + d * 0.5 ),
				alpha = [ 1, 0.3, 0.13 ][ g ];
			ctx.beginPath();
			ctx.moveTo( r * 1.3 - off, 0 );
			ctx.lineTo( -r * 0.6 - off, r * 0.7 );
			ctx.lineTo( -r * 0.25 - off, 0 );
			ctx.lineTo( -r * 0.6 - off, -r * 0.7 );
			ctx.closePath();
			ctx.fillStyle = $.hsla( e.hue, e.saturation, 60, ( 0.14 + d * 0.2 ) * alpha );
			ctx.fill();
			ctx.lineWidth = 1.6;
			ctx.strokeStyle = $.hsla( e.hue, e.saturation, 65 + d * 25, alpha );
			ctx.stroke();
		}
		$.coreEye( ctx, r * 0.2, 0, r * 0.18, e.hue, e.saturation, tick + d * 40 );
	},
	// weaver: serpentine hunter, a rippling body of linked segments
	weaver: function( ctx, r, fill, stroke, tick, e ) {
		ctx.lineWidth = r * 0.42;
		ctx.lineCap = 'round';
		ctx.strokeStyle = fill;
		ctx.beginPath();
		for( var s = 0; s <= 5; s++ ) {
			var sx = ( 0.9 - s * 0.42 ) * r,
				sy = Math.sin( tick / 5 + s * 0.9 ) * r * 0.55;
			if( s === 0 ) { ctx.moveTo( sx, sy ); } else { ctx.lineTo( sx, sy ); }
		}
		ctx.stroke();
		ctx.lineWidth = 2;
		$.neonStroke( ctx, e.hue, e.saturation, stroke );
		ctx.beginPath(); ctx.arc( r * 0.9, Math.sin( tick / 5 ) * r * 0.55, r * 0.38, 0, $.twopi );
		ctx.fillStyle = fill; ctx.fill();
		$.neonStroke( ctx, e.hue, e.saturation, stroke );
		$.coreEye( ctx, r * 0.95, Math.sin( tick / 5 ) * r * 0.55, r * 0.16, e.hue, e.saturation, tick );
	},
	// warden: slow bulwark with a hero-facing shield plate that flares on deflect
	warden: function( ctx, r, fill, stroke, tick, e ) {
		ctx.beginPath();
		for( var p = 0; p < 6; p++ ) {
			var a = p / 6 * $.twopi + $.pi / 6;
			if( p === 0 ) { ctx.moveTo( Math.cos( a ) * r * 0.8, Math.sin( a ) * r * 0.8 ); }
			else { ctx.lineTo( Math.cos( a ) * r * 0.8, Math.sin( a ) * r * 0.8 ); }
		}
		ctx.closePath();
		ctx.fillStyle = fill; ctx.fill();
		$.neonStroke( ctx, e.hue, e.saturation, stroke );
		$.coreEye( ctx, 0, 0, r * 0.24, e.hue, e.saturation, tick );
		// shield plate. the enemy is rendered rotated to its heading and the
		// warden always drives at the hero, so its heading is its facing -
		// the plate sits at local angle 0 ( leading edge ) and flares on deflect
		var flare = e.shieldFlash || 0;
		ctx.beginPath();
		ctx.arc( 0, 0, r * 1.18, -$.pi * 0.42, $.pi * 0.42 );
		ctx.lineWidth = 4 + flare * 4;
		ctx.strokeStyle = $.hsla( e.hue, e.saturation, 70 + flare * 25, 0.6 + flare * 0.4 );
		ctx.stroke();
	}
};

/*==============================================================================
Init
==============================================================================*/
$.Enemy = function( opt ) {
	// set always and optional
	for( var k in opt ) {
		this[k] = opt[k];
	}

	// set optional and defaults
	this.lightness = $.util.isset( this.lightness ) ? this.lightness : 50;
	this.saturation = $.util.isset( this.saturation ) ? this.saturation : 100;
	this.setup = this.setup || function(){};
	this.death = this.death || function(){};

	// set same for all objects
	this.index = $.indexGlobal++;
	this.inView = this.hitFlag = this.vx = this.vy = 0;
	this.lifeMax = opt.life;
	this.fillStyle ='hsla(' + this.hue + ', ' + this.saturation + '%, ' + this.lightness + '%, 0.1)';
	this.strokeStyle = 'hsla(' + this.hue + ', ' + this.saturation + '%, ' + this.lightness + '%, 1)';
	/*==============================================================================
	Run Setup
	==============================================================================*/
	this.setup();

	/*==============================================================================
	Adjust Level Offset Difficulties
	==============================================================================*/
	if( $.levelDiffOffset > 0 ){
		this.life += $.levelDiffOffset * 0.25;
		this.lifeMax = this.life;
		this.speed += Math.min( $.hero.vmax, $.levelDiffOffset * 0.25 );
		this.value += $.levelDiffOffset * 5;
	}

	// limitless scaling: every level makes everything tougher and faster
	if( $.level && $.level.current > 0 && !this.isBoss ) {
		this.life *= 1 + $.level.current * 0.06;
		this.speed *= 1 + Math.min( 1.2, $.level.current * 0.025 );
	}
	if( $.diff && !this.isBoss ) {
		this.life *= $.diff.enemyHp;
	}
	this.lifeMax = this.life;
};

/*==============================================================================
Update
==============================================================================*/
/*==============================================================================
Predictive aim - used by ranged enemies (Stinger, Sniper) for the direction
they actually FIRE, as opposed to how they move. Only leads the shot when
the current enemy tactic is PREDICTIVE/SNIPER (see $.rollEnemyIntel) -
otherwise degrades to a plain aim-at-current-position shot, same as before
this system existed, so most fights still see straightforward fire.
==============================================================================*/
$.aimDirection = function( fromX, fromY, projectileSpeed ) {
	var dx = $.hero.x - fromX, dy = $.hero.y - fromY;
	if( !$.enemyIntel || !$.enemyIntel.predictive || !projectileSpeed || $.hero.life <= 0 ) {
		return Math.atan2( dy, dx );
	}
	var dist = Math.sqrt( dx * dx + dy * dy ),
		// bounded lead time so a hero that just dashed away doesn't get shot
		// at a spot they'll never actually reach
		t = Math.min( 40, dist / projectileSpeed ),
		px = $.hero.x + $.hero.vx * t,
		py = $.hero.y + $.hero.vy * t;
	return Math.atan2( py - fromY, px - fromX );
};

/*==============================================================================
Bullet dodging - shared by the Phantom enemy and the EVASIVE elite trait.
Scans the hero's bullets for one on a collision course and nudges the enemy
sideways (perpendicular to that bullet) to slip the shot. Bounded work: only
runs when bullets exist, ignores far/behind bullets, one strafe per frame.
==============================================================================*/
$.enemyDodge = function( self, strength ) {
	var bullets = $.bullets;
	if( !bullets || !bullets.length || $.hero.life <= 0 ) { return; }
	var bestDist = 1e9, bx = 0, by = 0, bl = 1, cross = 0, found = 0;
	for( var i = 0; i < bullets.length; i++ ) {
		var b = bullets[ i ],
			dx = self.x - b.x, dy = self.y - b.y,
			bvx = Math.cos( b.direction ) * b.speed,
			bvy = Math.sin( b.direction ) * b.speed;
		// bullet must be heading toward the enemy (not already past it)
		if( dx * bvx + dy * bvy <= 0 ) { continue; }
		var dist = Math.sqrt( dx * dx + dy * dy );
		if( dist > 170 ) { continue; }
		var len = Math.sqrt( bvx * bvx + bvy * bvy ) || 1,
			perp = Math.abs( dx * bvy - dy * bvx ) / len; // miss distance
		// only react to shots that would actually clip the enemy
		if( perp > self.radius + 20 ) { continue; }
		if( dist < bestDist ) { bestDist = dist; bx = bvx; by = bvy; bl = len; cross = dx * bvy - dy * bvx; found = 1; }
	}
	if( found ) {
		var s = ( cross >= 0 ) ? 1 : -1,
			px = s * ( -by ) / bl,
			py = s * ( bx ) / bl;
		self.vx += px * strength;
		self.vy += py * strength;
		self.dodgeFlash = 1;
	}
};

$.Enemy.prototype.update = function( i ) {
	// EVASIVE elites juke incoming fire like a Phantom does
	if( this.elite === 'EVASIVE' && !this.isBoss ) {
		$.enemyDodge( this, 0.9 );
	}
	if( this.dodgeFlash ) { this.dodgeFlash *= 0.85; }
	if( this.shieldFlash ) { this.shieldFlash *= 0.82; }
	/*==============================================================================
	Apply Behavior
	==============================================================================*/
	this.behavior();

	/*==============================================================================
	Detonation (set by kamikaze-style behaviors)
	==============================================================================*/
	if( this.exploded ) {
		if( this.inView ) {
			$.audio.play( 'explosionAlt' );
		}
		$.explosions.push( new $.Explosion( {
			x: this.x,
			y: this.y,
			radius: this.blastRadius,
			hue: this.hue,
			saturation: this.saturation
		} ) );
		$.particleEmitters.push( new $.ParticleEmitter( {
			x: this.x,
			y: this.y,
			count: 20,
			spawnRange: 5,
			friction: 0.9,
			minSpeed: 2,
			maxSpeed: 18,
			minDirection: 0,
			maxDirection: $.twopi,
			hue: this.hue,
			saturation: this.saturation
		} ) );
		// the dash i-frames also dodge the blast
		if( $.hero.life > 0 && $.hero.dashTick <= 0 && $.util.distance( this.x, this.y, $.hero.x, $.hero.y ) <= this.blastRadius + $.hero.radius ) {
			$.hero.life -= 0.2 * $.hero.damageTakenMult;
			$.breakCombo();
			$.rumble.level = 10;
			$.audio.play( 'takingDamage' );
		}
		$.enemies.splice( i, 1 );
		return;
	}

	/*==============================================================================
	Elite Regeneration
	==============================================================================*/
	if( this.regen && this.life < this.lifeMax ) {
		this.life = Math.min( this.lifeMax, this.life + this.regen * $.dt );
	}

	/*==============================================================================
	Hunt: every creature curves toward the hero (bolts and bosses excepted),
	so nothing drifts harmlessly past - the arena always closes in
	==============================================================================*/
	if( !this.isBolt && !this.isBoss && $.hero.life > 0 ) {
		var hsx = $.hero.x - this.x,
			hsy = $.hero.y - this.y,
			hsd = Math.max( 1, Math.sqrt( hsx * hsx + hsy * hsy ) ),
			spd = Math.sqrt( this.vx * this.vx + this.vy * this.vy ) || this.speed || 1,
			turn = 0.08 * ( $.diff ? $.diff.hunt : 1 ) * $.introMult() * ( ( $.enemyIntel && $.enemyIntel.huntBoost ) || 1 );
		this.vx = this.vx * ( 1 - turn ) + ( hsx / hsd ) * spd * turn;
		this.vy = this.vy * ( 1 - turn ) + ( hsy / hsd ) * spd * turn;
		// straight-line movers shouldn't despawn at the wall while hunting
		this.lockBounds = 0;
	}

	// Grav Beetle drone: nearby enemies get reeled toward the hero a little
	// harder, bunching them up for easier kills instead of letting them spread
	if( !this.isBoss && $.hero.life > 0 && $.equippedDrone() && $.equippedDrone().id === 'drone_gravbeetle' ) {
		var gsx = $.hero.x - this.x,
			gsy = $.hero.y - this.y,
			gsd = Math.sqrt( gsx * gsx + gsy * gsy );
		if( gsd > 1 && gsd < 220 ) {
			var pull = 0.02 * $.dt;
			this.vx += ( gsx / gsd ) * pull;
			this.vy += ( gsy / gsd ) * pull;
		}
	}

	/*==============================================================================
	Apply Forces
	==============================================================================*/
	this.x += this.vx * $.dt;
	this.y += this.vy * $.dt;

	/*==============================================================================
	Lock Bounds
	==============================================================================*/
	if( this.lockBounds && !$.util.arcInRect( this.x, this.y, this.radius + 10, 0, 0, $.ww, $.wh ) ) {
		$.enemies.splice( i, 1 );
	}

	/*==============================================================================
	Update View
	==============================================================================*/
	if( $.util.arcInRect( this.x, this.y, this.radius, -$.screen.x, -$.screen.y, $.cw, $.ch ) ) {
		this.inView = 1;
	} else {
		this.inView = 0;
	}
};

/*==============================================================================
Receive Damage
==============================================================================*/
$.Enemy.prototype.receiveDamage = function( i, val ) {
	if( this.inView ) {
		$.audio.play( 'hit' );		
	}
	this.life -= val;
	this.hitFlag = 10;
	if( this.life <= 0 ) {
		if( this.inView ) {						
			$.explosions.push( new $.Explosion( {
				x: this.x,
				y: this.y,
				radius: this.radius,
				hue: this.hue,
				saturation: this.saturation
			} ) );
			$.particleEmitters.push( new $.ParticleEmitter( {
				x: this.x,
				y: this.y,
				count: 10,
				spawnRange: this.radius,
				friction: 0.85,
				minSpeed: 5,
				maxSpeed: 20,
				minDirection: 0,
				maxDirection: $.twopi,
				hue: this.hue,
				saturation: this.saturation
			} ) );
			$.textPops.push( new $.TextPop( {
				x: this.x,
				y: this.y,
				value: this.value * $.comboMultiplier,
				hue: this.hue,
				saturation: this.saturation,
				lightness: 60
			} ) );
			$.rumble.level = 6;
			// hitstop on meaningful kills only (bosses hardest, elites/high-value
			// a touch) - never on trash, so dense waves don't stutter
			if( $.addHitstop ) {
				if( this.isBoss ) { $.addHitstop( 10 ); }
				else if( this.elite || this.value >= 30 ) { $.addHitstop( 2 ); }
			}
		}
		this.death();
		$.spawnPowerup( this.x, this.y );
		$.registerKill( this.value, this.radius );
		$.level.kills++;
		$.kills++;
		// leaderboard check-in: post the run's current score every couple of
		// kills instead of only once at game over, so the board visibly
		// reflects a run in progress
		if( $.maybeLiveSubmit ) { $.maybeLiveSubmit(); }
		$.enemies.splice( i, 1 );
	}
};

/*==============================================================================
Render Health
==============================================================================*/
$.Enemy.prototype.renderHealth = function( i ) {
	if( this.inView && this.life > 0 && this.life < this.lifeMax ) {
		$.ctxmg.fillStyle = 'hsla(0, 0%, 0%, 0.75)';
		$.ctxmg.fillRect( this.x - this.radius, this.y - this.radius - 6, this.radius * 2, 3 );
		$.ctxmg.fillStyle = 'hsla(' + ( this.life / this.lifeMax ) * 120 + ', 100%, 50%, 0.75)';	
		$.ctxmg.fillRect( this.x - this.radius, this.y - this.radius - 6, ( this.radius * 2 ) * ( this.life / this.lifeMax ), 3 );
	}
};

/*==============================================================================
Render
==============================================================================*/
$.Enemy.prototype.render = function( i ) {
	if( this.inView ) {
		var facing = ( this.vx || this.vy ) ? Math.atan2( this.vy, this.vx ) : ( this.direction || 0 ),
			shapeFn = $.enemyShapes[ this.shape ] || $.enemyShapes.orb;

		$.ctxmg.save();
		$.ctxmg.translate( this.x, this.y );
		$.ctxmg.rotate( facing );
		shapeFn( $.ctxmg, this.radius, this.fillStyle, this.strokeStyle, $.tick, this );
		$.ctxmg.restore();

		if( $.slow ) {
			$.util.fillCircle( $.ctxmg, this.x, this.y, this.radius, 'hsla(' + $.util.rand( 160, 220 ) + ', 100%, 50%, 0.25)' );
		}
		if( this.hitFlag > 0 ) {
			this.hitFlag -= $.dt;
			$.util.fillCircle( $.ctxmg, this.x, this.y, this.radius, 'hsla(' + this.hue + ', ' + this.saturation + '%, 75%, ' + this.hitFlag / 10 + ')' );
		}
		if( this.elite ) {
			$.util.strokeCircle( $.ctxmg, this.x, this.y, this.radius + 5 + Math.cos( $.tick / 8 ) * 2, 'hsla(' + this.hue + ', 100%, 80%, 0.9)', 2 );
		}
		if( this.renderExtra ) {
			this.renderExtra();
		}
		this.renderHealth();
	}
};
