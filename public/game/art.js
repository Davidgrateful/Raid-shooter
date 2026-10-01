/*==============================================================================
Art - the aircraft, the enemy fleet, banking, bosses and effects

One file, loaded after enemy.js and before characters.js, so the engine pays
for a single extra request:

  $.planeDraws        the 13 pilot airframes (characters.js draws through it)
  $.enemyShapes.*     the enemy fleet, overriding enemy.js shape for shape
  $.drawBanked        the plane rolls into its turns
  $.enemyShapes.boss  the six lit, breakable bosses
  warp / launch / explosions / damage numbers

$.fxRandom is the dice for anything purely visual. During a seeded run
(Daily Run, DUELS) Math.random is the seeded generator, and every cosmetic
roll taken from it shifts the waves that follow - so effects roll the real
dice instead and two pilots on the same seed keep facing the same raid.
==============================================================================*/
$.fxRandom = function() {
	return ( $.__realRandom || Math.random )();
};

/*==============================================================================
Pilot airframes - every pilot is drawn as a real aircraft

Same contract as before: the context arrives translated to the ship centre and
rotated so +x is the nose; r is the hull radius (the hitbox). The outline is
built from half-point lists (nose -> tail on +y) and mirrored, then shaded so a
single ship colour still reads in depth: wings a shade darker than the
fuselage, panel lines, a lit canopy, glowing nozzles. Signature touches from
the old silhouettes survive (Rune glyphs orbit, Glitch Prince jitters, Crimson
Wisp trails its ember, Rider keeps its neon slipstream).
==============================================================================*/
(function() {
	var TWO_PI = Math.PI * 2;
	function sym( ctx, r, half ) {
		ctx.beginPath();
		ctx.moveTo( half[ 0 ][ 0 ] * r, half[ 0 ][ 1 ] * r );
		for( var i = 1; i < half.length; i++ ) { ctx.lineTo( half[ i ][ 0 ] * r, half[ i ][ 1 ] * r ); }
		for( var j = half.length - 1; j >= 0; j-- ) { ctx.lineTo( half[ j ][ 0 ] * r, -half[ j ][ 1 ] * r ); }
		ctx.closePath();
	}
	function fillSym( ctx, r, half, style ) { sym( ctx, r, half ); ctx.fillStyle = style; ctx.fill(); }
	function shade( ctx, r, half, a ) { sym( ctx, r, half ); ctx.fillStyle = a > 0 ? 'rgba(255,255,255,' + a + ')' : 'rgba(0,0,0,' + ( -a ) + ')'; ctx.fill(); }
	function canopy( ctx, r, x, len, w, glow ) {
		ctx.beginPath();
		ctx.ellipse( x * r, 0, len * r, w * r, 0, 0, TWO_PI );
		ctx.fillStyle = glow || 'rgba(190, 240, 255, 0.85)';
		ctx.fill();
		ctx.beginPath();
		ctx.ellipse( ( x + len * 0.25 ) * r, -w * 0.3 * r, len * 0.45 * r, w * 0.35 * r, 0, 0, TWO_PI );
		ctx.fillStyle = 'rgba(255,255,255,0.55)';
		ctx.fill();
	}
	function lines( ctx, r, segs, a, w ) {
		ctx.beginPath();
		for( var i = 0; i < segs.length; i++ ) {
			var s = segs[ i ];
			ctx.moveTo( s[ 0 ] * r, s[ 1 ] * r ); ctx.lineTo( s[ 2 ] * r, s[ 3 ] * r );
			ctx.moveTo( s[ 0 ] * r, -s[ 1 ] * r ); ctx.lineTo( s[ 2 ] * r, -s[ 3 ] * r );
		}
		ctx.strokeStyle = 'rgba(0,0,0,' + ( a || 0.32 ) + ')';
		ctx.lineWidth = Math.max( 0.6, r * ( w || 0.06 ) );
		ctx.stroke();
	}
	function nozzle( ctx, r, x, y, size, hue, tick, phase ) {
		var p = 0.55 + Math.sin( tick / 4 + ( phase || 0 ) ) * 0.2;
		var g = ctx.createRadialGradient( x * r, y * r, 0, x * r, y * r, size * 2.4 * r );
		g.addColorStop( 0, 'hsla(' + hue + ', 100%, 75%, ' + p + ')' );
		g.addColorStop( 1, 'hsla(' + hue + ', 100%, 55%, 0)' );
		ctx.fillStyle = g;
		ctx.beginPath(); ctx.arc( x * r, y * r, size * 2.4 * r, 0, TWO_PI ); ctx.fill();
		ctx.beginPath(); ctx.arc( x * r, y * r, size * r, 0, TWO_PI );
		ctx.fillStyle = 'hsla(' + hue + ', 100%, 82%, ' + ( p + 0.2 ) + ')'; ctx.fill();
	}

	$.planeDraws = {
		// Onyix: multirole fighter
		onyix: function (ctx, r, fill, tick) {
			var wing = [[0.25, 0.28], [-0.55, 1.3], [-0.85, 1.3], [-0.8, 0.3]];
			var body = [[2.0, 0], [1.7, 0.1], [1.15, 0.2], [0.4, 0.27], [-0.9, 0.3], [-1.25, 0.32], [-1.45, 0.75], [-1.68, 0.75], [-1.62, 0.22], [-1.78, 0.17]];
			fillSym(ctx, r, body, fill); fillSym(ctx, r, wing, fill);
			shade(ctx, r, wing, -0.18);
			lines(ctx, r, [[-0.62, 0.62, -0.84, 0.62], [-1.4, 0.45, -1.6, 0.45]]);
			var pulse = 0.55 + Math.cos(tick / 6) * 0.15;
			canopy(ctx, r, 1.05, 0.42, 0.15, 'hsla(45, 100%, 65%, ' + (pulse + 0.25) + ')');
			nozzle(ctx, r, -1.8, 0, 0.13, 35, tick);
		},
		// Nova: arrowhead interceptor
		nova: function (ctx, r, fill, tick) {
			var body = [[2.4, 0], [1.5, 0.12], [0.5, 0.2], [-0.55, 1.05], [-0.85, 1.05], [-0.8, 0.24], [-1.25, 0.22], [-1.35, 0.5], [-1.55, 0.5], [-1.5, 0.12]];
			fillSym(ctx, r, body, fill);
			shade(ctx, r, [[0.4, 0.21], [-0.55, 1.05], [-0.85, 1.05], [-0.8, 0.24]], -0.2);
			lines(ctx, r, [[0.6, 0.2, -1.2, 0.2]], 0.25, 0.05);
			canopy(ctx, r, 1.25, 0.38, 0.11);
			nozzle(ctx, r, -1.55, 0.1, 0.1, 195, tick); nozzle(ctx, r, -1.55, -0.1, 0.1, 195, tick, 1.3);
		},
		// Tank Rex: armored ground-attack jet
		tankrex: function (ctx, r, fill, tick) {
			var wing = [[0.45, 0.3], [0.38, 1.6], [0.0, 1.62], [-0.15, 0.3]];
			var tail = [[-1.05, 0.2], [-1.05, 0.95], [-1.35, 0.95], [-1.35, 0.2]];
			var body = [[1.55, 0], [1.4, 0.22], [0.9, 0.34], [-0.9, 0.3], [-1.45, 0.18], [-1.5, 0]];
			fillSym(ctx, r, wing, fill); fillSym(ctx, r, tail, fill); fillSym(ctx, r, body, fill);
			shade(ctx, r, wing, -0.16);
			// engine nacelles high on the rear fuselage, in armor grey
			ctx.fillStyle = 'hsla(0, 0%, 45%, 1)';
			for (var s = -1; s <= 1; s += 2) { ctx.beginPath(); ctx.ellipse(-0.6 * r, s * 0.5 * r, 0.42 * r, 0.2 * r, 0, 0, TWO_PI); ctx.fill(); }
			// twin fins at the tailplane tips
			ctx.fillStyle = fill; ctx.fillRect(-1.45 * r, 0.88 * r, 0.5 * r, 0.14 * r); ctx.fillRect(-1.45 * r, -1.02 * r, 0.5 * r, 0.14 * r);
			// nose cannon
			ctx.fillStyle = 'hsla(0, 0%, 30%, 1)'; ctx.fillRect(1.5 * r, -0.05 * r, 0.32 * r, 0.1 * r);
			lines(ctx, r, [[0.25, 0.9, 0.0, 0.9], [0.3, 0.3, 0.3, 1.55]], 0.25);
			canopy(ctx, r, 0.95, 0.3, 0.16);
			nozzle(ctx, r, -1.04, 0.5, 0.11, 30, tick); nozzle(ctx, r, -1.04, -0.5, 0.11, 30, tick, 1);
		},
		// Astra Vane: forward-swept wing fighter
		astravane: function (ctx, r, fill, tick) {
			var wing = [[-0.2, 0.26], [0.15, 1.25], [-0.15, 1.32], [-0.95, 0.28]];
			var canard = [[0.95, 0.18], [0.7, 0.52], [0.5, 0.52], [0.55, 0.18]];
			var body = [[2.0, 0], [1.4, 0.14], [0.6, 0.22], [-1.2, 0.26], [-1.5, 0.55], [-1.7, 0.55], [-1.62, 0.14]];
			fillSym(ctx, r, body, fill); fillSym(ctx, r, wing, fill); fillSym(ctx, r, canard, fill);
			shade(ctx, r, wing, -0.18);
			// kite ribbons trail off the wingtips (from the old design)
			ctx.strokeStyle = fill; ctx.lineWidth = Math.max(1, r * 0.08); ctx.globalAlpha = 0.6;
			ctx.beginPath();
			for (var s = -1; s <= 1; s += 2) { ctx.moveTo(-0.15 * r, s * 1.3 * r); ctx.quadraticCurveTo(-0.9 * r, s * (1.45 + Math.sin(tick / 9) * 0.08) * r, -1.5 * r, s * 1.2 * r); }
			ctx.stroke(); ctx.globalAlpha = 1;
			canopy(ctx, r, 1.15, 0.36, 0.12);
			nozzle(ctx, r, -1.66, 0, 0.12, 190, tick);
		},
		// Iron Halo: ring-wing gunship
		ironhalo: function (ctx, r, fill, tick) {
			var body = [[1.9, 0], [1.5, 0.2], [0.8, 0.32], [-1.0, 0.3], [-1.45, 0.2], [-1.55, 0]];
			var fin = [[-0.9, 0.25], [-1.25, 0.62], [-1.5, 0.62], [-1.35, 0.22]];
			fillSym(ctx, r, fin, fill);
			// the annular wing: a full ring around the fuselage, braced by struts
			ctx.strokeStyle = fill; ctx.lineWidth = r * 0.3;
			ctx.beginPath(); ctx.arc(-0.05 * r, 0, r * 1.02, 0, TWO_PI); ctx.stroke();
			ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = Math.max(0.6, r * 0.05);
			ctx.beginPath(); ctx.arc(-0.05 * r, 0, r * 0.93, 0, TWO_PI); ctx.stroke();
			ctx.fillStyle = fill;
			for (var a = 0; a < 4; a++) { ctx.save(); ctx.rotate(Math.PI / 4 + a * Math.PI / 2); ctx.fillRect(0.2 * r, -0.07 * r, 0.75 * r, 0.14 * r); ctx.restore(); }
			fillSym(ctx, r, body, fill);
			shade(ctx, r, [[0.6, 0.3], [-1.0, 0.3], [-1.0, 0.12], [0.6, 0.12]], 0.1);
			canopy(ctx, r, 1.05, 0.38, 0.17);
			nozzle(ctx, r, -1.58, 0, 0.14, 200, tick);
		},
		// Rune Pilot: flying-wing bomber
		runepilot: function (ctx, r, fill, tick) {
			var wing = [[1.15, 0], [0.9, 0.18], [-0.45, 1.55], [-0.72, 1.5], [-0.55, 1.1], [-0.82, 0.78], [-0.58, 0.46], [-0.86, 0.16], [-0.75, 0]];
			fillSym(ctx, r, wing, fill);
			shade(ctx, r, [[0.4, 0.5], [-0.45, 1.55], [-0.72, 1.5], [-0.55, 1.1], [-0.82, 0.78], [-0.58, 0.46], [-0.4, 0.5]], -0.18);
			lines(ctx, r, [[0.55, 0.18, -0.6, 0.18]], 0.22, 0.05);
			canopy(ctx, r, 0.55, 0.26, 0.1);
			nozzle(ctx, r, -0.7, 0.3, 0.08, 270, tick); nozzle(ctx, r, -0.7, -0.3, 0.08, 270, tick, 2);
			// the glyphs still orbit (identity from the old design)
			ctx.fillStyle = fill;
			for (var g = 0; g < 3; g++) { var a = tick / 25 + g * TWO_PI / 3, gx = Math.cos(a) * r * 1.9, gy = Math.sin(a) * r * 1.9; ctx.beginPath(); ctx.moveTo(gx, gy - r * 0.25); ctx.lineTo(gx + r * 0.22, gy + r * 0.18); ctx.lineTo(gx - r * 0.22, gy + r * 0.18); ctx.closePath(); ctx.fill(); }
		},
		// Nebula Fox: twin-boom fighter
		nebulafox: function (ctx, r, fill, tick) {
			var wing = [[0.35, 0.2], [0.25, 1.45], [-0.12, 1.5], [-0.15, 0.2]];
			fillSym(ctx, r, wing, fill);
			shade(ctx, r, wing, -0.16);
			// the two tail booms (the fox's twin tails) and the tailplane joining them
			ctx.fillStyle = fill;
			for (var s = -1; s <= 1; s += 2) {
				ctx.beginPath(); ctx.ellipse(-0.35 * r, s * 0.62 * r, 1.25 * r, 0.14 * r, 0, 0, TWO_PI); ctx.fill();
				ctx.fillRect(-1.65 * r, s * 0.62 * r - 0.32 * r, 0.32 * r, 0.64 * r);
			}
			ctx.fillRect(-1.5 * r, -0.62 * r, 0.22 * r, 1.24 * r);
			fillSym(ctx, r, [[1.55, 0], [1.2, 0.2], [0.4, 0.26], [-0.55, 0.2], [-0.7, 0]], fill);
			// spinning propeller discs at the front of each boom
			for (var p = -1; p <= 1; p += 2) {
				ctx.beginPath(); ctx.ellipse(0.95 * r, p * 0.62 * r, 0.07 * r, 0.42 * r, 0, 0, TWO_PI);
				ctx.fillStyle = 'rgba(220, 240, 255, ' + (0.18 + Math.abs(Math.sin(tick / 2)) * 0.12) + ')'; ctx.fill();
			}
			canopy(ctx, r, 0.95, 0.34, 0.14);
		},
		// Javelin 9: needle-nose interceptor
		javelin9: function (ctx, r, fill, tick) {
			var body = [[2.7, 0], [1.7, 0.1], [0.3, 0.17], [-1.3, 0.17], [-1.4, 0.52], [-1.62, 0.52], [-1.58, 0.13], [-1.66, 0.1]];
			var wing = [[0.15, 0.16], [-0.1, 0.78], [-0.38, 0.78], [-0.42, 0.16]];
			fillSym(ctx, r, body, fill); fillSym(ctx, r, wing, fill);
			shade(ctx, r, wing, -0.2);
			// pitot boom
			ctx.strokeStyle = fill; ctx.lineWidth = Math.max(0.8, r * 0.05);
			ctx.beginPath(); ctx.moveTo(2.7 * r, 0); ctx.lineTo(3.05 * r, 0); ctx.stroke();
			canopy(ctx, r, 1.1, 0.32, 0.09);
			nozzle(ctx, r, -1.68, 0, 0.1, 205, tick);
		},
		// Atlas Beam: four-engine heavy gunship
		atlasbeam: function (ctx, r, fill, tick) {
			var wing = [[0.4, 0.32], [0.22, 1.75], [-0.12, 1.75], [-0.25, 0.32]];
			var tail = [[-1.1, 0.25], [-1.25, 0.9], [-1.5, 0.9], [-1.45, 0.2]];
			var body = [[1.45, 0], [1.3, 0.3], [0.6, 0.4], [-1.1, 0.34], [-1.55, 0.15], [-1.6, 0]];
			fillSym(ctx, r, wing, fill); fillSym(ctx, r, tail, fill); fillSym(ctx, r, body, fill);
			shade(ctx, r, wing, -0.16);
			ctx.fillStyle = 'hsla(0, 0%, 42%, 1)';
			[0.72, 1.25].forEach(function (y) { for (var s = -1; s <= 1; s += 2) { ctx.beginPath(); ctx.ellipse(0.4 * r, s * y * r, 0.3 * r, 0.11 * r, 0, 0, TWO_PI); ctx.fill(); } });
			// the cannon, with its charge glow at the muzzle (from the old design)
			ctx.fillStyle = 'hsla(0, 0%, 32%, 1)'; ctx.fillRect(1.3 * r, -0.09 * r, 0.62 * r, 0.18 * r);
			var glow = 0.5 + Math.cos(tick / 7) * 0.25;
			ctx.beginPath(); ctx.arc(1.98 * r, 0, r * 0.22, 0, TWO_PI); ctx.fillStyle = 'hsla(35, 100%, 65%, ' + glow + ')'; ctx.fill();
			lines(ctx, r, [[0.6, 0.4, -1.1, 0.34]], 0.2);
			canopy(ctx, r, 0.95, 0.26, 0.2);
		},
		// Glitch Prince: faceted stealth jet
		glitchprince: function (ctx, r, fill, tick) {
			var hull = [[1.75, 0], [-0.75, 1.2], [-0.95, 1.05], [-0.72, 0.55], [-1.05, 0.42], [-1.3, 0.7], [-1.42, 0.62], [-1.12, 0.18], [-1.18, 0]];
			fillSym(ctx, r, hull, fill);
			// facets: alternate panels darker so it reads as flat-plated
			shade(ctx, r, [[1.75, 0], [-0.75, 1.2], [-0.2, 0.42], [0.3, 0]], -0.14);
			lines(ctx, r, [[1.75, 0, -0.2, 0.42], [-0.2, 0.42, -0.72, 0.55], [-0.2, 0.42, -1.12, 0.18]], 0.35, 0.05);
			canopy(ctx, r, 0.75, 0.3, 0.11, 'rgba(160, 200, 255, 0.55)');
			// the glitch: a sliver of the hull jumps out of place
			var jitter = (Math.floor(tick / 20) % 2) ? r * 0.18 : -r * 0.12;
			ctx.globalAlpha = 0.55; ctx.fillStyle = fill;
			ctx.save(); ctx.translate(jitter, -r * 0.1); sym(ctx, r * 0.45, [[1.2, 0], [-0.7, 0.9], [-0.9, 0]]); ctx.fill(); ctx.restore();
			ctx.fillRect(-r * 1.05 - jitter, r * 0.35, r * 0.4, r * 0.4);
			ctx.globalAlpha = 1;
		},
		// Solstice: canard delta fighter
		solstice: function (ctx, r, fill, tick) {
			var delta = [[0.2, 0.26], [-1.0, 1.28], [-1.22, 1.28], [-1.1, 0.3]];
			var canard = [[1.1, 0.18], [0.9, 0.5], [0.72, 0.5], [0.78, 0.18]];
			var body = [[2.15, 0], [1.6, 0.13], [1.0, 0.2], [-1.2, 0.27], [-1.42, 0.24], [-1.46, 0]];
			fillSym(ctx, r, delta, fill); fillSym(ctx, r, canard, fill); fillSym(ctx, r, body, fill);
			shade(ctx, r, delta, -0.2);
			lines(ctx, r, [[-0.75, 0.7, -1.15, 0.7]]);
			canopy(ctx, r, 1.3, 0.38, 0.12);
			// the old plasma core becomes twin afterburners
			var glow = 0.5 + Math.sin(tick / 8) * 0.3;
			nozzle(ctx, r, -1.5, 0.12, 0.11, 35, tick); nozzle(ctx, r, -1.5, -0.12, 0.11, 35, tick, 0.8);
			ctx.beginPath(); ctx.arc(0.3 * r, 0, 0.14 * r, 0, TWO_PI); ctx.fillStyle = 'hsla(35, 100%, 60%, ' + glow + ')'; ctx.fill();
		},
		// Crimson Wisp: gull-wing racer
		crimsonwisp: function (ctx, r, fill, tick) {
			// curved gull wings, drawn with real curves on both sides
			ctx.beginPath();
			ctx.moveTo(1.75 * r, 0);
			for (var s = 1; s >= -1; s -= 2) {
				ctx.lineTo(0.9 * r, s * 0.24 * r);
				ctx.lineTo(0.35 * r, s * 0.3 * r);
				ctx.quadraticCurveTo(0.3 * r, s * 1.15 * r, -0.85 * r, s * 1.5 * r);
				ctx.quadraticCurveTo(-0.55 * r, s * 0.85 * r, -0.75 * r, s * 0.32 * r);
				ctx.lineTo(-1.15 * r, s * 0.26 * r);
				ctx.lineTo(-1.25 * r, 0);
			}
			ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
			ctx.beginPath();
			for (var t = 1; t >= -1; t -= 2) { ctx.moveTo(0.35 * r, t * 0.3 * r); ctx.quadraticCurveTo(0.3 * r, t * 1.15 * r, -0.85 * r, t * 1.5 * r); ctx.quadraticCurveTo(-0.55 * r, t * 0.85 * r, -0.75 * r, t * 0.32 * r); }
			ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fill();
			canopy(ctx, r, 0.95, 0.34, 0.13);
			// the ember flame it always trailed
			var flicker = 0.4 + Math.cos(tick / 7) * 0.25;
			ctx.beginPath(); ctx.moveTo(-1.2 * r, 0); ctx.lineTo(-2.0 * r, 0.32 * r); ctx.lineTo(-1.6 * r, 0); ctx.lineTo(-2.0 * r, -0.32 * r); ctx.closePath();
			ctx.fillStyle = 'hsla(10, 100%, 55%, ' + (flicker + 0.15) + ')'; ctx.fill();
		},
		// Rider: air-race monoplane
		voltrider: function (ctx, r, fill, tick) {
			var wing = [[0.55, 0.28], [0.35, 1.18], [0.0, 1.2], [-0.25, 0.28]];
			var tail = [[-0.95, 0.18], [-1.1, 0.55], [-1.3, 0.55], [-1.25, 0.15]];
			var body = [[1.95, 0], [1.75, 0.2], [1.1, 0.33], [0.2, 0.32], [-1.0, 0.17], [-1.32, 0]];
			// neon purple slipstream (kept from the old design)
			var flicker = 0.5 + Math.sin(tick / 6) * 0.28;
			ctx.beginPath(); ctx.moveTo(-1.3 * r, 0.22 * r); ctx.lineTo(-2.1 * r, 0.5 * r); ctx.lineTo(-1.65 * r, 0); ctx.lineTo(-2.1 * r, -0.5 * r); ctx.lineTo(-1.3 * r, -0.22 * r); ctx.closePath();
			ctx.fillStyle = 'hsla(275, 100%, 65%, ' + flicker + ')'; ctx.fill();
			fillSym(ctx, r, wing, fill); fillSym(ctx, r, tail, fill); fillSym(ctx, r, body, fill);
			shade(ctx, r, wing, -0.16);
			// wingtip fairing pods, like the old mirror pods
			ctx.fillStyle = fill;
			for (var s = -1; s <= 1; s += 2) { ctx.beginPath(); ctx.ellipse(0.2 * r, s * 1.2 * r, 0.32 * r, 0.12 * r, 0, 0, TWO_PI); ctx.fill(); }
			// spinner and propeller disc
			ctx.beginPath(); ctx.ellipse(1.98 * r, 0, 0.06 * r, 0.62 * r, 0, 0, TWO_PI);
			ctx.fillStyle = 'rgba(230, 210, 255, ' + (0.2 + Math.abs(Math.sin(tick / 2)) * 0.12) + ')'; ctx.fill();
			ctx.beginPath(); ctx.arc(1.98 * r, 0, 0.13 * r, 0, TWO_PI); ctx.fillStyle = 'hsla(275, 100%, 78%, ' + (0.55 + Math.cos(tick / 7) * 0.25) + ')'; ctx.fill();
			canopy(ctx, r, 0.15, 0.3, 0.13);
		}
	};
})();

/*==============================================================================
Enemy fleet - every enemy is a hostile drone or aircraft

Overrides the shapes in enemy.js key for key. Same signature
(ctx, r, fill, stroke, tick, e), same hue, same radius (the hitbox), same
behaviour - only the silhouette changes, so a player who knows "pink chases
you" still knows it. Enemies stay neon outlines over a faint fill, so the
player's solid plane always stands out in a crowded fight.
==============================================================================*/
(function() {
	var TWO_PI = Math.PI * 2;
	function half( ctx, r, pts ) {
		ctx.beginPath(); ctx.moveTo( pts[ 0 ][ 0 ] * r, pts[ 0 ][ 1 ] * r );
		for( var i = 1; i < pts.length; i++ ) { ctx.lineTo( pts[ i ][ 0 ] * r, pts[ i ][ 1 ] * r ); }
		for( var j = pts.length - 1; j >= 0; j-- ) { ctx.lineTo( pts[ j ][ 0 ] * r, -pts[ j ][ 1 ] * r ); }
		ctx.closePath();
	}
	function hull( ctx, r, pts, fill, stroke, e ) { half( ctx, r, pts ); ctx.fillStyle = fill; ctx.fill(); $.neonStroke( ctx, e.hue, e.saturation, stroke ); }
	function flame( ctx, x, y, len, w, hue, a ) {
		var f = len * ( 0.75 + $.fxRandom() * 0.5 );
		ctx.beginPath(); ctx.moveTo( x, y + w ); ctx.lineTo( x - f, y ); ctx.lineTo( x, y - w ); ctx.closePath();
		ctx.fillStyle = $.hsla( hue, 100, 70, a || 0.55 ); ctx.fill();
	}
	function rotor( ctx, x, y, rad, hue, tick, phase ) {
		ctx.beginPath(); ctx.arc( x, y, rad, 0, TWO_PI ); ctx.fillStyle = $.hsla( hue, 100, 70, 0.08 ); ctx.fill();
		ctx.lineWidth = 1.4; ctx.strokeStyle = $.hsla( hue, 80, 80, 0.55 );
		var a = tick / 2 + ( phase || 0 );
		ctx.beginPath(); ctx.moveTo( x + Math.cos( a ) * rad, y + Math.sin( a ) * rad ); ctx.lineTo( x - Math.cos( a ) * rad, y - Math.sin( a ) * rad ); ctx.stroke();
	}
	function hot( ctx, r, x1, y1, x2, y2, e, a ) {
		ctx.beginPath(); ctx.moveTo( x1 * r, y1 * r ); ctx.lineTo( x2 * r, y2 * r );
		ctx.lineWidth = 2.2; ctx.strokeStyle = $.hsla( e.hue, e.saturation, 88, a || 0.9 ); ctx.stroke();
	}
	var fleet = {
		shuttle: function (ctx, r, fill, stroke, tick, e) {
			flame(ctx, -r * 0.92, r * 0.2, r * 0.55, r * 0.12, e.hue); flame(ctx, -r * 0.92, -r * 0.2, r * 0.55, r * 0.12, e.hue);
			hull(ctx, r, [[1.35, 0], [0.95, 0.2], [0.35, 0.27], [0.2, 0.95], [-0.15, 0.98], [-0.3, 0.28], [-0.7, 0.28], [-0.85, 0.55], [-1.0, 0.55], [-0.95, 0]], fill, stroke, e);
			ctx.beginPath(); ctx.moveTo(r * 1.0, 0); ctx.lineTo(r * 0.45, r * 0.13); ctx.lineTo(r * 0.45, -r * 0.13); ctx.closePath();
			ctx.fillStyle = $.hsla(e.hue, e.saturation, 85, 0.8 + Math.cos(tick / 9) * 0.2); ctx.fill();
		},
		slant: function (ctx, r, fill, stroke, tick, e) {
			var tilt = Math.cos(tick / 11) * 0.12;
			hull(ctx, r, [[1.35, 0], [0.7, 0.14], [-0.85, 0.95 + tilt], [-1.05, 0.9 + tilt], [-0.75, 0.25], [-1.0, 0]], fill, stroke, e);
			hot(ctx, r, 1.35, 0, -0.85, 0.95 + tilt, e); hot(ctx, r, 1.35, 0, -0.85, -0.95 - tilt, e);
			$.coreEye(ctx, r * 0.35, 0, r * 0.14, e.hue, e.saturation, tick);
		},
		chevron: function (ctx, r, fill, stroke, tick, e) {
			var jaw = 0.18 + (Math.cos(tick / 7) + 1) * 0.12;
			hull(ctx, r, [[0.75, 0], [0.3, 0.3], [-0.55, 0.95], [-0.8, 0.9], [-0.55, 0.3], [-0.95, 0.25], [-0.85, 0]], fill, stroke, e);
			ctx.lineWidth = 2.2; ctx.strokeStyle = $.hsla(e.hue, e.saturation, 80, 1);
			ctx.beginPath();
			ctx.moveTo(r * 0.35, r * 0.28); ctx.lineTo(r * 1.3, r * jaw);
			ctx.moveTo(r * 0.35, -r * 0.28); ctx.lineTo(r * 1.3, -r * jaw);
			ctx.stroke();
			$.coreEye(ctx, r * 0.15, 0, r * 0.2, e.hue, e.saturation, tick);
		},
		block: function (ctx, r, fill, stroke, tick, e) {
			var o = r * 0.22;
			ctx.beginPath(); ctx.rect(-r * 0.85 - o, -r * 0.8 - o, r * 1.5, r * 1.6);
			ctx.lineWidth = 1.2; ctx.strokeStyle = $.hsla(e.hue, e.saturation, 50, 0.4); ctx.stroke();
			flame(ctx, -r * 0.88, r * 0.45, r * 0.4, r * 0.14, e.hue); flame(ctx, -r * 0.88, -r * 0.45, r * 0.4, r * 0.14, e.hue);
			var seam = 0.5 + (Math.cos(tick / 8) + 1) * 0.25;
			for (var i = 0; i < 4; i++) {
				var cx = (i % 2) ? -0.05 : -0.82, cy = i < 2 ? 0.05 : -0.8;
				ctx.beginPath(); ctx.rect(cx * r, cy * r, r * 0.72, r * 0.75); ctx.fillStyle = fill; ctx.fill(); $.neonStroke(ctx, e.hue, e.saturation, stroke);
				ctx.beginPath(); ctx.moveTo((cx + 0.36) * r, cy * r); ctx.lineTo((cx + 0.36) * r, (cy + 0.75) * r);
				ctx.lineWidth = 1.2; ctx.strokeStyle = $.hsla(e.hue, e.saturation, 85, seam); ctx.stroke();
			}
			hull(ctx, r, [[1.1, 0], [0.95, 0.3], [0.7, 0.36], [0.7, 0]], fill, stroke, e);
			$.coreEye(ctx, r * 0.88, 0, r * 0.13, e.hue, e.saturation, tick);
		},
		tumbler: function (ctx, r, fill, stroke, tick, e) {
			ctx.save(); ctx.rotate(tick / 22);
			for (var f = 0; f < 3; f++) {
				var a = f * TWO_PI / 3, ax = Math.cos(a) * r * 0.75, ay = Math.sin(a) * r * 0.75;
				ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3); ctx.lineTo(ax, ay);
				ctx.lineWidth = r * 0.16; ctx.strokeStyle = fill; ctx.stroke(); ctx.lineWidth = 1.5; ctx.strokeStyle = stroke; ctx.stroke();
				rotor(ctx, ax, ay, r * 0.38, e.hue, tick, f);
			}
			ctx.beginPath(); for (var p = 0; p < 6; p++) { var b = p / 6 * TWO_PI; if (p === 0) ctx.moveTo(Math.cos(b) * r * 0.38, Math.sin(b) * r * 0.38); else ctx.lineTo(Math.cos(b) * r * 0.38, Math.sin(b) * r * 0.38); }
			ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); $.neonStroke(ctx, e.hue, e.saturation, stroke);
			ctx.restore();
			$.coreEye(ctx, 0, 0, r * 0.22, e.hue, e.saturation, tick);
		},
		comet: function (ctx, r, fill, stroke, tick, e) {
			for (var t = 0; t < 3; t++) {
				var fl = r * (1.4 + t * 0.5 + $.fxRandom() * 0.6);
				ctx.beginPath(); ctx.moveTo(-r * 0.75, r * (0.32 - t * 0.08)); ctx.lineTo(-r * 0.75 - fl, 0); ctx.lineTo(-r * 0.75, -r * (0.32 - t * 0.08)); ctx.closePath();
				ctx.fillStyle = $.hsla(e.hue + t * 12, 100, 60 + t * 10, 0.42 - t * 0.1); ctx.fill();
			}
			hull(ctx, r, [[1.35, 0], [1.05, 0.22], [0.65, 0.34], [-0.45, 0.34], [-0.55, 0.85], [-0.85, 0.85], [-0.8, 0.3], [-0.85, 0]], fill, stroke, e);
			$.coreEye(ctx, r * 0.95, 0, r * 0.24, e.hue, e.saturation, e.armed ? tick * 3 : tick);
		},
		wasp: function (ctx, r, fill, stroke, tick, e) {
			var up = (Math.floor(tick / 3) % 2);
			ctx.lineWidth = 1.4;
			[[-0.1, 0.7, -0.5, up], [-0.55, 0.62, -0.75, !up]].forEach(function (w) {
				ctx.strokeStyle = $.hsla(e.hue, 60, 85, w[3] ? 0.75 : 0.25);
				ctx.beginPath(); ctx.ellipse(w[0] * r, -w[1] * r, r * 0.62, r * 0.2, w[2], 0, TWO_PI); ctx.stroke();
				ctx.beginPath(); ctx.ellipse(w[0] * r, w[1] * r, r * 0.62, r * 0.2, -w[2], 0, TWO_PI); ctx.stroke();
			});
			hull(ctx, r, [[1.0, 0], [0.7, 0.2], [0.1, 0.28], [-0.5, 0.3], [-1.15, 0.15], [-1.3, 0]], fill, stroke, e);
			ctx.fillStyle = $.hsla(e.hue, 100, 80, 0.95); ctx.fillRect(r * 0.95, -r * 0.06, r * 0.45, r * 0.12);
			$.coreEye(ctx, r * 0.45, 0, r * 0.14, e.hue, e.saturation, tick);
		},
		sliver: function (ctx, r, fill, stroke, tick, e) {
			var shape = [[1.2, 0], [-0.35, 1.1], [-0.65, 1.05], [-0.45, 0.62], [-0.75, 0.42], [-0.5, 0.18], [-0.65, 0]];
			for (var g = 2; g >= 0; g--) {
				var off = g * r * 0.55, alpha = [1, 0.35, 0.15][g];
				ctx.save(); ctx.translate(-off, 0); half(ctx, r, shape); ctx.restore();
				ctx.fillStyle = $.hsla(e.hue, e.saturation, 60, 0.1 * alpha); ctx.fill();
				ctx.lineWidth = 1.5; ctx.strokeStyle = $.hsla(e.hue, e.saturation, 55, alpha); ctx.stroke();
			}
			$.coreEye(ctx, r * 0.3, 0, r * 0.14, e.hue, 30, tick);
		},
		heavy: function (ctx, r, fill, stroke, tick, e) {
			[0.38, 0.68].forEach(function (y) { flame(ctx, -r * 0.12, r * y, r * 0.28, r * 0.06, e.hue); flame(ctx, -r * 0.12, -r * y, r * 0.28, r * 0.06, e.hue); });
			hull(ctx, r, [[0.95, 0], [0.82, 0.12], [0.45, 0.16], [0.22, 0.98], [0.02, 1.0], [-0.1, 0.17], [-0.62, 0.15], [-0.72, 0.45], [-0.88, 0.45], [-0.85, 0]], fill, stroke, e);
			ctx.fillStyle = fill;
			[0.38, 0.68].forEach(function (y) { for (var s = -1; s <= 1; s += 2) { ctx.beginPath(); ctx.ellipse(r * 0.18, s * y * r, r * 0.16, r * 0.06, 0, 0, TWO_PI); ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = stroke; ctx.stroke(); } });
			ctx.save(); ctx.rotate(-tick / 30);
			ctx.beginPath(); for (var q = 0; q < 6; q++) { var b = q / 6 * TWO_PI + Math.PI / 6; if (q === 0) ctx.moveTo(Math.cos(b) * r * 0.24, Math.sin(b) * r * 0.24); else ctx.lineTo(Math.cos(b) * r * 0.24, Math.sin(b) * r * 0.24); }
			ctx.closePath(); ctx.lineWidth = 2.5; ctx.strokeStyle = $.hsla(e.hue, e.saturation, 75, 0.9); ctx.stroke();
			ctx.fillStyle = $.hsla(e.hue, e.saturation, 75, 0.9); ctx.fillRect(r * 0.1, -r * 0.03, r * 0.3, r * 0.06);
			ctx.restore();
			$.coreEye(ctx, r * 0.05, 0, r * 0.1, e.hue, e.saturation, tick);
		},
		bloom: function (ctx, r, fill, stroke, tick, e) {
			ctx.save(); ctx.rotate(tick / 60);
			for (var p = 0; p < 4; p++) {
				var a = Math.PI / 4 + p * Math.PI / 2, x = Math.cos(a) * r * 0.78, y = Math.sin(a) * r * 0.78;
				ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(x, y); ctx.lineWidth = r * 0.14; ctx.strokeStyle = fill; ctx.stroke(); ctx.lineWidth = 1.4; ctx.strokeStyle = stroke; ctx.stroke();
				var breathe = 1 + Math.cos(tick / 9 + p * 1.3) * 0.12;
				rotor(ctx, x, y, r * 0.4 * breathe, e.hue, tick, p);
			}
			ctx.beginPath(); ctx.arc(0, 0, r * 0.42, 0, TWO_PI); ctx.fillStyle = fill; ctx.fill(); $.neonStroke(ctx, e.hue, e.saturation, stroke);
			var pulse = 0.6 + Math.cos(tick / 6) * 0.3;
			ctx.fillStyle = $.hsla(e.hue, 100, 82, pulse);
			ctx.fillRect(-r * 0.24, -r * 0.07, r * 0.48, r * 0.14); ctx.fillRect(-r * 0.07, -r * 0.24, r * 0.14, r * 0.48);
			ctx.restore();
			for (var sp = 0; sp < 3; sp++) { var sa = tick / 14 + sp * TWO_PI / 3; ctx.beginPath(); ctx.arc(Math.cos(sa) * r * 1.3, Math.sin(sa) * r * 1.3, r * 0.08, 0, TWO_PI); ctx.fillStyle = $.hsla(e.hue, 100, 80, 0.8); ctx.fill(); }
		},
		dartlet: function (ctx, r, fill, stroke, tick, e) {
			$.exhaust(ctx, -r * 0.8, r * 0.5, e.hue, tick);
			hull(ctx, r, [[1.45, 0], [0.7, 0.12], [-0.25, 0.75], [-0.5, 0.72], [-0.4, 0.15], [-0.8, 0.12], [-0.8, 0]], fill, stroke, e);
			$.coreEye(ctx, r * 0.5, 0, r * 0.13, e.hue, e.saturation, tick);
		},
		star: function (ctx, r, fill, stroke, tick, e) {
			ctx.rotate(tick / 35);
			var reach = 1 + Math.cos(tick / 6) * 0.16;
			for (var p = 0; p < 8; p++) {
				var a = p / 8 * TWO_PI;
				ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5); ctx.lineTo(Math.cos(a) * r * reach, Math.sin(a) * r * reach);
				ctx.lineWidth = r * 0.12; ctx.strokeStyle = $.hsla(e.hue, e.saturation, 60, 0.35); ctx.stroke(); ctx.lineWidth = 1.6; ctx.strokeStyle = stroke; ctx.stroke();
				ctx.beginPath(); ctx.arc(Math.cos(a) * r * reach, Math.sin(a) * r * reach, r * 0.08, 0, TWO_PI); ctx.fillStyle = $.hsla(e.hue, 100, 80, 0.9); ctx.fill();
			}
			ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, TWO_PI); ctx.fillStyle = fill; ctx.fill(); $.neonStroke(ctx, e.hue, e.saturation, stroke);
			ctx.beginPath(); ctx.arc(0, 0, r * 0.3, tick / 8, tick / 8 + Math.PI * 1.4); ctx.lineWidth = 2; ctx.strokeStyle = $.hsla(e.hue, e.saturation, 85, 0.9); ctx.stroke();
		},
		turret: function (ctx, r, fill, stroke, tick, e) {
			ctx.save(); ctx.rotate(tick / 20);
			ctx.beginPath(); ctx.arc(0, 0, r * 1.2, 0, Math.PI * 0.6); ctx.moveTo(-r * 1.2, 0); ctx.arc(0, 0, r * 1.2, Math.PI, Math.PI * 1.6);
			ctx.lineWidth = 1.6; ctx.strokeStyle = $.hsla(e.hue, e.saturation, 70, 0.7); ctx.stroke(); ctx.restore();
			ctx.fillStyle = fill;
			for (var s = -1; s <= 1; s += 2) { ctx.beginPath(); ctx.ellipse(-r * 0.15, s * r * 0.62, r * 0.38, r * 0.16, 0, 0, TWO_PI); ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = stroke; ctx.stroke(); }
			hull(ctx, r, [[0.75, 0], [0.4, 0.3], [-0.55, 0.38], [-0.8, 0]], fill, stroke, e);
			ctx.fillStyle = stroke; ctx.fillRect(r * 0.5, -r * 0.08, r * 1.15, r * 0.16);
			var charge = (Math.cos(tick / 5) + 1) / 2;
			ctx.beginPath(); ctx.arc(r * 1.7, 0, r * 0.15 + charge * r * 0.1, 0, TWO_PI); ctx.fillStyle = $.hsla(e.hue, 100, 80, 0.4 + charge * 0.6); ctx.fill();
			$.coreEye(ctx, r * 0.05, 0, r * 0.14, e.hue, e.saturation, tick);
		},
		crescent: function (ctx, r, fill, stroke, tick, e) {
			ctx.beginPath(); ctx.arc(0, 0, r, -Math.PI * 0.62, Math.PI * 0.62); ctx.arc(-r * 0.5, 0, r * 0.78, Math.PI * 0.5, -Math.PI * 0.5, true); ctx.closePath();
			ctx.fillStyle = fill; ctx.fill(); $.neonStroke(ctx, e.hue, e.saturation, stroke);
			ctx.beginPath(); ctx.arc(0, 0, r, -Math.PI * 0.55, Math.PI * 0.55); ctx.lineWidth = 2.5; ctx.strokeStyle = $.hsla(e.hue, e.saturation, 90, 0.85); ctx.stroke();
			[-0.55, 0, 0.55].forEach(function (a) { var x = Math.cos(a) * r * 0.32, y = Math.sin(a) * r * 0.62; flame(ctx, x - r * 0.05, y, r * 0.35, r * 0.07, e.hue, 0.5); });
			$.coreEye(ctx, r * 0.55, 0, r * 0.16, e.hue, e.saturation, tick);
		},
		hive: function (ctx, r, fill, stroke, tick, e) {
			flame(ctx, -r * 0.95, r * 0.3, r * 0.3, r * 0.08, e.hue); flame(ctx, -r * 0.95, -r * 0.3, r * 0.3, r * 0.08, e.hue);
			hull(ctx, r, [[0.95, 0], [0.8, 0.35], [0.4, 0.62], [-0.65, 0.62], [-0.95, 0.4], [-0.95, 0]], fill, stroke, e);
			for (var bay = 0; bay < 3; bay++) {
				var bx = (0.45 - bay * 0.5) * r, grow = 0.12 + ((Math.cos(tick / 10 + bay * 2) + 1) / 2) * 0.08;
				ctx.beginPath(); ctx.rect(bx - r * 0.17, -r * 0.3, r * 0.34, r * 0.6); ctx.lineWidth = 1.2; ctx.strokeStyle = $.hsla(e.hue, e.saturation, 70, 0.7); ctx.stroke();
				ctx.beginPath(); ctx.arc(bx, 0, r * grow, 0, TWO_PI); ctx.fillStyle = $.hsla(e.hue, 100, 75, 0.85); ctx.fill();
			}
		},
		fort: function (ctx, r, fill, stroke, tick, e) {
			ctx.beginPath(); ctx.rect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4); ctx.fillStyle = fill; ctx.fill(); $.neonStroke(ctx, e.hue, e.saturation, stroke);
			for (var c = 0; c < 4; c++) { var cx = (c % 2 ? 1 : -1) * r * 0.5, cy = (c < 2 ? 1 : -1) * r * 0.5; ctx.beginPath(); ctx.arc(cx, cy, r * 0.13, 0, TWO_PI); ctx.fillStyle = $.hsla(e.hue, 100, 75, 0.5 + Math.sin(tick / 5 + c) * 0.2); ctx.fill(); }
			ctx.save(); ctx.rotate(tick / 25);
			ctx.lineWidth = 4; ctx.strokeStyle = $.hsla(e.hue, e.saturation, 70, 0.85);
			for (var plate = 0; plate < 4; plate++) { var pa = plate * Math.PI / 2; ctx.beginPath(); ctx.arc(0, 0, r * 1.25, pa, pa + Math.PI * 0.3); ctx.stroke(); }
			ctx.restore();
			ctx.save(); ctx.rotate(-tick / 40);
			ctx.fillStyle = stroke; ctx.fillRect(0, -r * 0.16, r * 0.62, r * 0.08); ctx.fillRect(0, r * 0.08, r * 0.62, r * 0.08);
			ctx.restore();
			$.coreEye(ctx, 0, 0, r * 0.22, e.hue, e.saturation, tick);
		},
		shard: function (ctx, r, fill, stroke, tick, e) {
			ctx.beginPath(); ctx.moveTo(-r * 0.6, 0); ctx.lineTo(-r * 2.8, 0); ctx.lineWidth = r * 0.5; ctx.strokeStyle = $.hsla(e.hue, 100, 65, 0.25); ctx.stroke();
			half(ctx, r, [[1.7, 0], [0.6, 0.22], [-0.6, 0.22], [-1.0, 0.6], [-1.0, 0]]);
			ctx.fillStyle = $.hsla(e.hue, 100, 80, 1); ctx.fill();
		},
		phantom: function (ctx, r, fill, stroke, tick, e) {
			var d = e.dodgeFlash || 0, shape = [[1.35, 0], [0.4, 0.18], [0.05, 0.8], [-0.2, 0.82], [-0.45, 0.2], [-0.75, 0.25], [-0.65, 0]];
			for (var g = 2; g >= 0; g--) {
				var off = g * r * (0.5 + d * 0.5), alpha = [1, 0.3, 0.13][g];
				ctx.save(); ctx.translate(-off, 0); half(ctx, r, shape); ctx.restore();
				ctx.fillStyle = $.hsla(e.hue, e.saturation, 60, (0.14 + d * 0.2) * alpha); ctx.fill();
				ctx.lineWidth = 1.6; ctx.strokeStyle = $.hsla(e.hue, e.saturation, 65 + d * 25, alpha); ctx.stroke();
			}
			$.coreEye(ctx, r * 0.45, 0, r * 0.15, e.hue, e.saturation, tick + d * 40);
		},
		weaver: function (ctx, r, fill, stroke, tick, e) {
			var pts = [];
			for (var s = 0; s <= 5; s++) pts.push([(0.9 - s * 0.42) * r, Math.sin(tick / 5 + s * 0.9) * r * 0.55]);
			ctx.beginPath(); pts.forEach(function (p, i) { if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); });
			ctx.lineWidth = 1.4; ctx.strokeStyle = $.hsla(e.hue, e.saturation, 70, 0.6); ctx.stroke();
			for (var k = pts.length - 1; k >= 1; k--) {
				var p = pts[k], q = pts[k - 1], a = Math.atan2(q[1] - p[1], q[0] - p[0]), sz = r * (0.24 - k * 0.02);
				ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(a);
				half(ctx, 1, [[sz * 1.2, 0], [0, sz * 0.9], [-sz, sz * 0.4], [-sz * 0.7, 0]]);
				ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 1.3; ctx.strokeStyle = stroke; ctx.stroke();
				ctx.restore();
			}
			var h = pts[0], ha = Math.atan2(h[1] - pts[1][1], h[0] - pts[1][0]);
			ctx.save(); ctx.translate(h[0], h[1]); ctx.rotate(ha);
			hull(ctx, r, [[0.55, 0], [0.1, 0.22], [-0.2, 0.5], [-0.35, 0.45], [-0.3, 0]], fill, stroke, e);
			ctx.restore();
			$.coreEye(ctx, h[0], h[1], r * 0.14, e.hue, e.saturation, tick);
		},
		warden: function (ctx, r, fill, stroke, tick, e) {
			hull(ctx, r, [[0.8, 0], [0.65, 0.42], [0.1, 0.62], [-0.55, 0.6], [-0.8, 0.35], [-0.85, 0]], fill, stroke, e);
			ctx.fillStyle = fill;
			for (var s = -1; s <= 1; s += 2) { ctx.beginPath(); ctx.rect(-r * 0.2, s * r * 0.62 - r * 0.1, r * 0.75, r * 0.2); ctx.fill(); ctx.lineWidth = 1.3; ctx.strokeStyle = stroke; ctx.stroke(); }
			flame(ctx, -r * 0.85, 0, r * 0.4, r * 0.15, e.hue);
			$.coreEye(ctx, r * 0.05, 0, r * 0.22, e.hue, e.saturation, tick);
			var flare = e.shieldFlash || 0;
			ctx.beginPath(); ctx.arc(0, 0, r * 1.18, -Math.PI * 0.42, Math.PI * 0.42);
			ctx.lineWidth = 4 + flare * 4; ctx.strokeStyle = $.hsla(e.hue, e.saturation, 70 + flare * 25, 0.6 + flare * 0.4); ctx.stroke();
		}
	};
	for( var k in fleet ) { $.enemyShapes[ k ] = fleet[ k ]; }
})();

/*==============================================================================
Banking - the plane rolls into its turns

A flat top-down sprite reads as a sticker sliding around. A real aircraft
rolls when it turns or slips sideways: the wing on the inside of the turn
drops and darkens, the outside wing rises into the light, and the whole
wingspan foreshortens. That is all this does - no 3D engine, no model, just
the pilot's own airframe drawn into a small sprite, lit across the wingspan,
and squashed along the wing axis by the roll angle.

  $.heroBank( hero )        eases hero.bank toward the roll its motion asks
                            for: sideways slip (velocity across the nose)
                            plus how fast the heading is turning
  $.drawBanked( ... )       draws an airframe at that roll

Bank is cosmetic: the hitbox stays the hull radius whatever the roll.
Reduced motion keeps the plane level.
==============================================================================*/
$.bankCanvas = null;
$.bankCtx = null;

$.heroBank = function( hero ) {
	var dir = hero.direction || 0,
		last = ( hero.lastBankDir === undefined ) ? dir : hero.lastBankDir,
		turn = dir - last;
	while( turn > Math.PI ) { turn -= Math.PI * 2; }
	while( turn < -Math.PI ) { turn += Math.PI * 2; }
	hero.lastBankDir = dir;
	var dt = Math.max( 0.0001, $.dt || 1 ),
		vmax = hero.vmax || 6,
		// velocity across the nose: + means slipping toward the plane's right (+y)
		slip = ( -Math.sin( dir ) * ( hero.vx || 0 ) + Math.cos( dir ) * ( hero.vy || 0 ) ) / vmax,
		target = slip * 0.85 + ( turn / dt ) * 6;
	if( target > 1 ) { target = 1; }
	if( target < -1 ) { target = -1; }
	hero.bank = ( hero.bank || 0 ) + ( target - ( hero.bank || 0 ) ) * Math.min( 1, 0.14 * dt );
	return hero.bank;
};

// bank in [-1, 1]; + rolls the right wing (+y) down
$.drawBanked = function( ctx, draw, r, fill, tick, bank ) {
	var mag = Math.abs( bank || 0 );
	if( mag < 0.03 || $.reduceMotion ) {
		draw( ctx, r, fill, tick );
		return;
	}
	// the sprite must hold the widest airframe (Javelin's pitot reaches 3.05r,
	// Rune's glyphs orbit at 1.9r) at device resolution, so it stays crisp
	var k = Math.min( 2, $.dpr || ( typeof window !== 'undefined' && window.devicePixelRatio ) || 1 ),
		reach = r * 3.3,
		size = Math.ceil( reach * 2 * k );
	if( !$.bankCanvas ) {
		$.bankCanvas = document.createElement( 'canvas' );
		$.bankCtx = $.bankCanvas.getContext( '2d' );
	}
	var c = $.bankCanvas, b = $.bankCtx;
	if( c.width < size || c.height < size ) {
		c.width = c.height = size;
	}
	b.setTransform( 1, 0, 0, 1, 0, 0 );
	b.globalCompositeOperation = 'source-over';
	b.globalAlpha = 1;
	b.clearRect( 0, 0, size, size );
	b.setTransform( k, 0, 0, k, size / 2, size / 2 );
	draw( b, r, fill, tick );

	// light across the wingspan: the lowered wing falls into shadow, the
	// raised one catches the light. source-atop keeps it on the airframe.
	b.globalCompositeOperation = 'source-atop';
	var down = bank > 0 ? 1 : -1,
		g = b.createLinearGradient( 0, -down * reach, 0, down * reach );
	g.addColorStop( 0, 'rgba(255, 255, 255, ' + ( 0.3 * mag ).toFixed( 3 ) + ')' );
	g.addColorStop( 0.45, 'rgba(255, 255, 255, 0)' );
	g.addColorStop( 0.6, 'rgba(0, 0, 0, ' + ( 0.12 * mag ).toFixed( 3 ) + ')' );
	g.addColorStop( 1, 'rgba(0, 0, 0, ' + ( 0.5 * mag ).toFixed( 3 ) + ')' );
	b.fillStyle = g;
	b.fillRect( -reach, -reach, reach * 2, reach * 2 );
	b.globalCompositeOperation = 'source-over';

	// foreshorten the wingspan by the roll, and shift the lowered wing a
	// touch toward the viewer's shadow side so the roll has a direction
	var squash = 1 - 0.42 * mag;
	ctx.save();
	ctx.translate( 0, down * r * 0.08 * mag );
	ctx.scale( 1, squash );
	ctx.drawImage( c, 0, 0, size, size, -size / ( 2 * k ), -size / ( 2 * k ), size / k, size / k );
	ctx.restore();
};

/*==============================================================================
Boss art - six lit, multi-part bosses that break up as you hurt them

Bosses used to be a plain orb with a few shapes orbiting it. Each one is now
a lit body (one key light from the upper left, a rim light in the boss's own
hue behind it) built from parts, and the parts give way phase by phase:

  phase 0  intact
  phase 1  first cracks glow through the hull
  phase 2  armour plates / spikes / tendrils are gone, cracks spread
  phase 3  the body flickers, sparks and venting, the core is exposed

Drawn in WORLD orientation (the render rotates every enemy to face its
travel; a boss is radially built, so we undo that), so the light stays put
while the boss swings around. Radius stays 90 - the art fills the same
circle the hitbox always was, and a few parts reach past it as decoration.
Phase and life come from the boss itself; nothing here changes the fight.
==============================================================================*/
( function() {
	var TWO_PI = Math.PI * 2;
	var LIGHT = { x: -0.55, y: -0.65 };

	function hsla( h, s, l, a ) { return 'hsla(' + h + ', ' + s + '%, ' + l + '%, ' + a + ')'; }

	// a lit sphere: key light upper-left, falling off to a dark limb
	function sphere( ctx, r, h, s, lite, dark, alpha ) {
		var g = ctx.createRadialGradient( LIGHT.x * r * 0.6, LIGHT.y * r * 0.6, r * 0.05, 0, 0, r );
		g.addColorStop( 0, hsla( h, s, lite, alpha ) );
		g.addColorStop( 0.55, hsla( h, s, ( lite + dark ) / 2, alpha ) );
		g.addColorStop( 1, hsla( h, s, dark, alpha ) );
		ctx.fillStyle = g;
	}

	// back-light in the boss's hue around the lower-right limb
	function rim( ctx, r, h, a ) {
		ctx.save();
		ctx.beginPath();
		ctx.arc( 0, 0, r, -0.35, Math.PI * 0.95 );
		ctx.lineWidth = Math.max( 2, r * 0.05 );
		ctx.strokeStyle = hsla( h, 100, 65, a );
		ctx.shadowColor = hsla( h, 100, 60, 0.9 );
		ctx.shadowBlur = 18;
		ctx.stroke();
		ctx.restore();
	}

	function specular( ctx, r, a ) {
		var x = LIGHT.x * r * 0.5, y = LIGHT.y * r * 0.5;
		var g = ctx.createRadialGradient( x, y, 0, x, y, r * 0.35 );
		g.addColorStop( 0, 'rgba(255,255,255,' + a + ')' );
		g.addColorStop( 1, 'rgba(255,255,255,0)' );
		ctx.fillStyle = g;
		ctx.beginPath(); ctx.arc( x, y, r * 0.35, 0, TWO_PI ); ctx.fill();
	}

	// glowing fractures from near the core outward; count grows with phase.
	// Deterministic per boss (seeded from its variant), so cracks don't
	// jump around between frames.
	function cracks( ctx, r, h, phase, tick, seed ) {
		if( phase < 1 ) { return; }
		var n = phase * 2 + 1,
			pulse = 0.55 + Math.sin( tick / 7 ) * 0.25;
		ctx.save();
		ctx.lineCap = 'round';
		for( var i = 0; i < n; i++ ) {
			var a = seed * 1.7 + i * 2.39996,
				len = 0.55 + ( ( seed * 13 + i * 7 ) % 5 ) * 0.08;
			ctx.beginPath();
			var x = Math.cos( a ) * r * 0.18, y = Math.sin( a ) * r * 0.18;
			ctx.moveTo( x, y );
			for( var k = 1; k <= 4; k++ ) {
				var t = k / 4,
					jog = ( ( ( i + k ) * 37 + seed * 11 ) % 9 - 4 ) * 0.035;
				ctx.lineTo( Math.cos( a + jog ) * r * len * t * 1.05, Math.sin( a + jog ) * r * len * t * 1.05 );
			}
			ctx.lineWidth = 7;
			ctx.strokeStyle = hsla( h, 100, 55, 0.25 * pulse );
			ctx.stroke();
			ctx.lineWidth = 2.2;
			ctx.strokeStyle = hsla( h, 100, 80, pulse );
			ctx.stroke();
		}
		ctx.restore();
	}

	// phase 3: short bright sparks spitting off the hull
	function sparks( ctx, r, h, phase, tick ) {
		if( phase < 3 ) { return; }
		ctx.save();
		ctx.lineWidth = 2;
		for( var i = 0; i < 5; i++ ) {
			var cyc = ( tick * 0.9 + i * 23 ) % 40,
				a = i * 1.9 + Math.floor( ( tick + i * 23 ) / 40 ) * 2.3,
				d = r * ( 0.85 + cyc / 40 * 0.6 );
			ctx.strokeStyle = hsla( h, 100, 85, 1 - cyc / 40 );
			ctx.beginPath();
			ctx.moveTo( Math.cos( a ) * d, Math.sin( a ) * d );
			ctx.lineTo( Math.cos( a ) * ( d + 10 ), Math.sin( a ) * ( d + 10 ) );
			ctx.stroke();
		}
		ctx.restore();
	}

	// the charge telegraph: the engine flips fill/stroke to a bright flash
	// before a charge - keep that readable on the new art with an outline
	function telegraph( ctx, r, e ) {
		if( !e.chargeCooldown || e.charging > 0 || e.chargeTick <= e.chargeCooldown ) { return; }
		if( Math.floor( $.tick / 4 ) % 2 ) {
			ctx.beginPath(); ctx.arc( 0, 0, r * 1.12, 0, TWO_PI );
			ctx.lineWidth = 4; ctx.strokeStyle = hsla( e.hue, 100, 85, 0.9 ); ctx.stroke();
		}
	}

	// shaded wedge: lit face and dark face split down the middle, which is
	// what makes a flat spike read as a ridge
	function ridge( ctx, len, w, lit, dark ) {
		ctx.beginPath(); ctx.moveTo( len, 0 ); ctx.lineTo( 0, -w ); ctx.lineTo( 0, 0 ); ctx.closePath();
		ctx.fillStyle = lit; ctx.fill();
		ctx.beginPath(); ctx.moveTo( len, 0 ); ctx.lineTo( 0, w ); ctx.lineTo( 0, 0 ); ctx.closePath();
		ctx.fillStyle = dark; ctx.fill();
	}

	var ART = {
		/*--- ASTEROID KING: a living rock, crowned in spikes, molten inside -*/
		'ASTEROID KING': function( ctx, r, e, tick, phase ) {
			var h = 30;
			// orbiting rock spikes - one breaks off per phase
			var spikes = 8 - phase * 2;
			for( var s = 0; s < spikes; s++ ) {
				var a = s / 8 * TWO_PI + tick / 60;
				ctx.save();
				ctx.translate( Math.cos( a ) * r * 0.98, Math.sin( a ) * r * 0.98 );
				ctx.rotate( a );
				var face = Math.cos( a - Math.atan2( LIGHT.y, LIGHT.x ) );
				ridge( ctx, 30, 14, hsla( h, 25, 42 + face * 14, 1 ), hsla( h, 25, 20 + face * 8, 1 ) );
				ctx.restore();
			}
			// lumpy body
			ctx.beginPath();
			for( var p = 0; p < 14; p++ ) {
				var pa = p / 14 * TWO_PI,
					pr = r * ( 0.93 + ( ( p * 7 ) % 5 ) * 0.02 );
				if( p === 0 ) { ctx.moveTo( Math.cos( pa ) * pr, Math.sin( pa ) * pr ); } else { ctx.lineTo( Math.cos( pa ) * pr, Math.sin( pa ) * pr ); }
			}
			ctx.closePath();
			sphere( ctx, r, h, 22, 46, 10, 1 );
			ctx.fill();
			// craters, lit on the far lip
			var craters = [ [ 0.32, -0.28, 0.2 ], [ -0.38, 0.3, 0.16 ], [ 0.1, 0.48, 0.12 ], [ -0.2, -0.5, 0.1 ], [ 0.52, 0.2, 0.09 ] ];
			for( var c = 0; c < craters.length; c++ ) {
				var cx = craters[ c ][ 0 ] * r, cy = craters[ c ][ 1 ] * r, cr = craters[ c ][ 2 ] * r;
				ctx.beginPath(); ctx.arc( cx, cy, cr, 0, TWO_PI );
				ctx.fillStyle = hsla( h, 20, 9, 0.65 ); ctx.fill();
				ctx.beginPath(); ctx.arc( cx, cy, cr, 0.2, Math.PI * 0.95 );
				ctx.lineWidth = 2; ctx.strokeStyle = hsla( h, 30, 52, 0.6 ); ctx.stroke();
			}
			cracks( ctx, r, 22, phase, tick, 1 );
			// the molten heart shows through the cracks once it is split
			if( phase >= 2 ) {
				var heat = 0.35 + Math.sin( tick / 5 ) * 0.15 + phase * 0.08;
				var g = ctx.createRadialGradient( 0, 0, 0, 0, 0, r * 0.4 );
				g.addColorStop( 0, hsla( 40, 100, 70, heat ) );
				g.addColorStop( 1, hsla( 15, 100, 50, 0 ) );
				ctx.fillStyle = g;
				ctx.beginPath(); ctx.arc( 0, 0, r * 0.4, 0, TWO_PI ); ctx.fill();
			}
			rim( ctx, r * 0.95, h, 0.5 );
		},

		/*--- VOID TYRANT: a dead star inside a tilted accretion ring --------*/
		'VOID TYRANT': function( ctx, r, e, tick, phase ) {
			var h = 270, tilt = -0.32, spin = tick / 30;
			function ring( front ) {
				ctx.save();
				ctx.rotate( tilt );
				ctx.scale( 1, 0.28 );
				// the ring breaks into arcs as the tyrant weakens
				var gaps = phase, seg = TWO_PI / 24;
				for( var i = 0; i < 24; i++ ) {
					if( gaps && ( i % 8 ) < gaps ) { continue; }
					var a0 = i * seg + spin, mid = a0 + seg / 2;
					var inFront = Math.sin( mid ) > 0;
					if( inFront !== front ) { continue; }
					// the side spinning toward us is brighter (doppler beaming)
					var beam = 0.55 + Math.cos( mid ) * 0.35;
					ctx.beginPath(); ctx.arc( 0, 0, r * 1.55, a0, a0 + seg * 0.82 );
					ctx.lineWidth = 16; ctx.strokeStyle = hsla( h + 20, 100, 60, 0.18 * beam ); ctx.stroke();
					ctx.lineWidth = 5; ctx.strokeStyle = hsla( h + 20, 100, 72, 0.85 * beam ); ctx.stroke();
				}
				ctx.restore();
			}
			ring( false );
			// the body: almost black, lit only at the rim
			ctx.beginPath(); ctx.arc( 0, 0, r * 0.92, 0, TWO_PI );
			sphere( ctx, r * 0.92, h, 60, 16, 3, 1 );
			ctx.fill();
			var halo = ctx.createRadialGradient( 0, 0, r * 0.85, 0, 0, r * 1.15 );
			halo.addColorStop( 0, hsla( h, 100, 65, 0.55 ) );
			halo.addColorStop( 1, hsla( h, 100, 50, 0 ) );
			ctx.fillStyle = halo;
			ctx.beginPath(); ctx.arc( 0, 0, r * 1.15, 0, TWO_PI ); ctx.arc( 0, 0, r * 0.9, 0, TWO_PI, true ); ctx.fill();
			cracks( ctx, r * 0.9, h, phase, tick, 3 );
			// the single eye, tracking the hero
			var look = Math.atan2( ( $.hero ? $.hero.y : 0 ) - e.y, ( $.hero ? $.hero.x : 0 ) - e.x );
			$.coreEye( ctx, Math.cos( look ) * r * 0.3, Math.sin( look ) * r * 0.3, r * 0.14, h, 100, tick );
			ring( true );
		},

		/*--- SOLAR WARDEN: a caged sun - armour plates fall away ------------*/
		'SOLAR WARDEN': function( ctx, r, e, tick, phase ) {
			var h = 20;
			// corona
			var flick = 0.85 + Math.sin( tick / 3 ) * 0.08;
			var cor = ctx.createRadialGradient( 0, 0, r * 0.5, 0, 0, r * 1.35 * flick );
			cor.addColorStop( 0, hsla( 35, 100, 60, 0.45 ) );
			cor.addColorStop( 1, hsla( 15, 100, 50, 0 ) );
			ctx.fillStyle = cor;
			ctx.beginPath(); ctx.arc( 0, 0, r * 1.35, 0, TWO_PI ); ctx.fill();
			// the star
			var core = ctx.createRadialGradient( -r * 0.15, -r * 0.18, 0, 0, 0, r * 0.82 );
			core.addColorStop( 0, 'hsla(50, 100%, 92%, 1)' );
			core.addColorStop( 0.5, 'hsla(38, 100%, 62%, 1)' );
			core.addColorStop( 1, 'hsla(14, 100%, 45%, 1)' );
			ctx.fillStyle = core;
			ctx.beginPath(); ctx.arc( 0, 0, r * 0.82, 0, TWO_PI ); ctx.fill();
			// six armour plates; phases strip them (6, 5, 3, 1 left)
			var keep = [ 6, 5, 3, 1 ][ Math.min( 3, phase ) ];
			ctx.save();
			ctx.rotate( tick / 90 );
			for( var p = 0; p < 6; p++ ) {
				if( p >= keep ) { break; }
				var a0 = p / 6 * TWO_PI + 0.08, a1 = a0 + TWO_PI / 6 - 0.16;
				var mid = ( a0 + a1 ) / 2 + tick / 90,
					face = Math.cos( mid - Math.atan2( LIGHT.y, LIGHT.x ) );
				ctx.beginPath();
				ctx.arc( 0, 0, r * 1.0, a0, a1 );
				ctx.arc( 0, 0, r * 0.7, a1, a0, true );
				ctx.closePath();
				ctx.fillStyle = hsla( 20, 18, 26 + face * 16, 1 );
				ctx.fill();
				ctx.lineWidth = 2; ctx.strokeStyle = hsla( 30, 60, 55 + face * 15, 0.8 ); ctx.stroke();
				// rivets
				for( var v = 0; v < 2; v++ ) {
					var ra = a0 + ( a1 - a0 ) * ( 0.3 + v * 0.4 );
					ctx.beginPath(); ctx.arc( Math.cos( ra ) * r * 0.85, Math.sin( ra ) * r * 0.85, 3, 0, TWO_PI );
					ctx.fillStyle = hsla( 30, 40, 70, 0.7 ); ctx.fill();
				}
			}
			ctx.restore();
			// flame orbs (from the old design)
			for( var f = 0; f < 3; f++ ) {
				var fa = tick / 18 + f * TWO_PI / 3,
					fx = Math.cos( fa ) * r * 1.18, fy = Math.sin( fa ) * r * 1.18,
					fg = ctx.createRadialGradient( fx, fy, 0, fx, fy, 16 );
				fg.addColorStop( 0, 'hsla(48, 100%, 85%, 0.95)' );
				fg.addColorStop( 1, 'hsla(20, 100%, 55%, 0)' );
				ctx.fillStyle = fg;
				ctx.beginPath(); ctx.arc( fx, fy, 16, 0, TWO_PI ); ctx.fill();
			}
			cracks( ctx, r * 0.8, 45, phase, tick, 5 );
		},

		/*--- PLASMA MEDUSA: a glass bell of light, trailing tendrils --------*/
		'PLASMA MEDUSA': function( ctx, r, e, tick, phase ) {
			var h = 190, pulse = 1 + Math.sin( tick / 10 ) * 0.08;
			// tendrils first, so the bell sits over them; fewer each phase
			var count = 9 - phase * 2;
			ctx.lineCap = 'round';
			for( var t = 0; t < count; t++ ) {
				var tx = -r * 0.8 + t * ( r * 1.6 / Math.max( 1, count - 1 ) );
				ctx.beginPath();
				ctx.moveTo( tx, r * 0.1 );
				ctx.bezierCurveTo( tx + Math.sin( tick / 9 + t ) * 18, r * 0.7, tx - Math.sin( tick / 7 + t ) * 22, r * 1.2, tx + Math.sin( tick / 6 + t ) * 16, r * 1.75 );
				ctx.lineWidth = 7; ctx.strokeStyle = hsla( h, 100, 70, 0.12 ); ctx.stroke();
				ctx.lineWidth = 2.2; ctx.strokeStyle = hsla( h, 100, 78, 0.55 ); ctx.stroke();
			}
			// the bell: translucent glass, brighter at the crown
			ctx.save();
			ctx.scale( pulse, 1 / pulse );
			ctx.beginPath();
			ctx.moveTo( -r, r * 0.15 );
			ctx.bezierCurveTo( -r * 1.05, -r * 0.95, r * 1.05, -r * 0.95, r, r * 0.15 );
			// a torn hem once it is hurt
			var notches = phase * 2;
			for( var n = 0; n <= 8; n++ ) {
				var hx = r - n * r / 4,
					dip = ( n % 2 ) ? ( n <= notches ? r * 0.28 : r * 0.12 ) : 0;
				ctx.lineTo( hx, r * 0.15 + dip );
			}
			ctx.closePath();
			var bell = ctx.createLinearGradient( 0, -r * 0.8, 0, r * 0.3 );
			bell.addColorStop( 0, hsla( h, 100, 80, 0.55 ) );
			bell.addColorStop( 1, hsla( h, 100, 55, 0.12 ) );
			ctx.fillStyle = bell; ctx.fill();
			ctx.lineWidth = 3; ctx.strokeStyle = hsla( h, 100, 80, 0.75 ); ctx.stroke();
			// inner organs glowing through the glass
			for( var o = 0; o < 4; o++ ) {
				var oa = o / 4 * Math.PI + Math.PI + 0.4;
				ctx.beginPath();
				ctx.ellipse( Math.cos( oa ) * r * 0.45, -r * 0.18 + Math.sin( oa ) * r * 0.15, r * 0.16, r * 0.1, oa, 0, TWO_PI );
				ctx.fillStyle = hsla( h + 120, 100, 72, 0.35 + Math.sin( tick / 8 + o ) * 0.15 ); ctx.fill();
			}
			ctx.restore();
			specular( ctx, r * 0.9, 0.35 );
			cracks( ctx, r * 0.7, h, phase, tick, 7 );
		},

		/*--- HIVE QUEEN: a segmented carapace with glossy egg sacs ----------*/
		'HIVE QUEEN': function( ctx, r, e, tick, phase ) {
			var h = 140, breathe = 1 + Math.sin( tick / 14 ) * 0.03;
			// legs, three a side, under the body
			ctx.lineCap = 'round';
			for( var l = 0; l < 6; l++ ) {
				var side = l < 3 ? -1 : 1, i = l % 3,
					step = Math.sin( tick / 8 + l * 1.7 ) * 0.12,
					la = side * ( 0.9 + i * 0.55 + step );
				ctx.beginPath();
				ctx.moveTo( Math.cos( la ) * r * 0.5, Math.sin( la ) * r * 0.5 );
				ctx.lineTo( Math.cos( la + side * 0.25 ) * r * 1.15, Math.sin( la + side * 0.25 ) * r * 1.15 );
				ctx.lineTo( Math.cos( la + side * 0.1 ) * r * 1.4, Math.sin( la + side * 0.1 ) * r * 1.4 );
				ctx.lineWidth = 6; ctx.strokeStyle = hsla( h, 40, 22, 1 ); ctx.stroke();
				ctx.lineWidth = 2; ctx.strokeStyle = hsla( h, 70, 55, 0.6 ); ctx.stroke();
			}
			// abdomen, thorax, head - three overlapping lit segments
			var segs = [ [ 0.32, 0, 0.72 ], [ -0.28, 0, 0.5 ], [ -0.7, 0, 0.32 ] ];
			for( var s = 0; s < segs.length; s++ ) {
				ctx.save();
				ctx.translate( segs[ s ][ 0 ] * r, segs[ s ][ 1 ] );
				ctx.scale( breathe, 1 );
				var sr = segs[ s ][ 2 ] * r;
				ctx.beginPath(); ctx.ellipse( 0, 0, sr * 1.15, sr, 0, 0, TWO_PI );
				sphere( ctx, sr, h, 55, 42, 9, 1 );
				ctx.fill();
				// carapace bands
				ctx.lineWidth = 2; ctx.strokeStyle = hsla( h, 50, 8, 0.6 );
				for( var b = -1; b <= 1; b++ ) {
					ctx.beginPath(); ctx.ellipse( b * sr * 0.4, 0, sr * 0.12, sr * 0.92, 0, -Math.PI / 2, Math.PI / 2 ); ctx.stroke();
				}
				specular( ctx, sr, 0.3 );
				ctx.restore();
			}
			// mandibles snapping at the front
			var jaw = 0.25 + ( Math.sin( tick / 6 ) + 1 ) * 0.12;
			ctx.lineWidth = 4; ctx.strokeStyle = hsla( h, 80, 70, 0.9 );
			ctx.beginPath();
			ctx.moveTo( -r * 0.95, -r * 0.12 ); ctx.quadraticCurveTo( -r * 1.25, -r * jaw, -r * 1.35, -r * 0.02 );
			ctx.moveTo( -r * 0.95, r * 0.12 ); ctx.quadraticCurveTo( -r * 1.25, r * jaw, -r * 1.35, r * 0.02 );
			ctx.stroke();
			// egg sacs: glossy, swelling, one pops per phase
			for( var g = 0; g < 3 - Math.min( 2, phase ); g++ ) {
				var ga = tick / 60 + g * TWO_PI / 3,
					grow = 0.55 + ( Math.sin( tick / 12 + g * 2 ) + 1 ) * 0.25,
					gx = Math.cos( ga ) * r * 0.95, gy = Math.sin( ga ) * r * 0.95, gr = r * 0.24 * grow;
				ctx.save(); ctx.translate( gx, gy );
				ctx.beginPath(); ctx.arc( 0, 0, gr, 0, TWO_PI );
				sphere( ctx, gr, h, 90, 72, 32, 0.8 ); ctx.fill();
				specular( ctx, gr, 0.6 );
				ctx.restore();
			}
			cracks( ctx, r * 0.6, 90, phase, tick, 9 );
			$.coreEye( ctx, -r * 0.78, 0, r * 0.08, h, 100, tick );
		},

		/*--- XENO MONARCH: an armoured warlord - crown, blades, one eye -----*/
		'XENO MONARCH': function( ctx, r, e, tick, phase ) {
			var h = 15;
			// six blade-limbs, counter-rotating, each a two-faced ridge
			ctx.save();
			ctx.rotate( tick / 40 );
			for( var bl = 0; bl < 6; bl++ ) {
				var ba = bl / 6 * TWO_PI,
					face = Math.cos( ba + tick / 40 - Math.atan2( LIGHT.y, LIGHT.x ) );
				ctx.save();
				ctx.rotate( ba );
				ctx.translate( r * 0.75, 0 );
				ridge( ctx, r * 0.8, 12, hsla( h, 70, 55 + face * 15, 1 ), hsla( h, 70, 22 + face * 8, 1 ) );
				ctx.restore();
			}
			ctx.restore();
			// the shell
			ctx.beginPath();
			for( var p = 0; p < 8; p++ ) {
				var pa = p / 8 * TWO_PI + Math.PI / 8;
				if( p === 0 ) { ctx.moveTo( Math.cos( pa ) * r * 0.95, Math.sin( pa ) * r * 0.95 ); } else { ctx.lineTo( Math.cos( pa ) * r * 0.95, Math.sin( pa ) * r * 0.95 ); }
			}
			ctx.closePath();
			sphere( ctx, r, h, 55, 38, 8, 1 );
			ctx.fill();
			ctx.lineWidth = 3; ctx.strokeStyle = hsla( h, 100, 62, 0.7 ); ctx.stroke();
			// plate seams
			ctx.lineWidth = 2; ctx.strokeStyle = hsla( h, 60, 8, 0.6 );
			ctx.beginPath();
			for( var q = 0; q < 8; q++ ) {
				var qa = q / 8 * TWO_PI + Math.PI / 8;
				ctx.moveTo( Math.cos( qa ) * r * 0.45, Math.sin( qa ) * r * 0.45 );
				ctx.lineTo( Math.cos( qa ) * r * 0.95, Math.sin( qa ) * r * 0.95 );
			}
			ctx.stroke();
			ctx.beginPath(); ctx.arc( 0, 0, r * 0.45, 0, TWO_PI ); ctx.stroke();
			// the crown: five spikes along the top; one snaps per phase
			var crown = 5 - Math.min( 4, phase + ( phase >= 3 ? 1 : 0 ) );
			for( var c = 0; c < 5; c++ ) {
				if( c >= crown ) { break; }
				var ca = -Math.PI / 2 + ( c - 2 ) * 0.38;
				ctx.save();
				ctx.translate( Math.cos( ca ) * r * 0.9, Math.sin( ca ) * r * 0.9 );
				ctx.rotate( ca );
				ridge( ctx, c === 2 ? 46 : 32, 11, 'hsla(45, 100%, 72%, 1)', 'hsla(35, 90%, 38%, 1)' );
				ctx.restore();
			}
			specular( ctx, r * 0.9, 0.18 );
			cracks( ctx, r * 0.9, 30, phase, tick, 11 );
			// the eye, swelling as it weakens
			$.coreEye( ctx, 0, 0, r * ( 0.18 + phase * 0.03 ), h, 100, tick );
			rim( ctx, r * 0.95, h, 0.55 );
		}
	};

	$.bossArt = ART;

	// the shape the engine calls for a boss (enemy.render has already rotated
	// to the travel direction - undo it so the art stays world-lit)
	$.enemyShapes.boss = function( ctx, r, fill, stroke, tick, e ) {
		var art = e.variant && ART[ e.variant.title ];
		if( !art ) { $.enemyShapes.orb( ctx, r, fill, stroke, tick, e ); return; }
		var facing = ( e.vx || e.vy ) ? Math.atan2( e.vy, e.vx ) : ( e.direction || 0 );
		ctx.rotate( -facing );
		var phase = e.phase || 0;
		// the last quarter: the whole body flickers as it fails
		if( phase >= 3 && Math.floor( tick / 3 ) % 7 === 0 ) { ctx.globalAlpha = 0.75; }
		art( ctx, r, e, tick, phase );
		ctx.globalAlpha = 1;
		sparks( ctx, r, e.hue, phase, tick );
		telegraph( ctx, r, e );
	};
} )();

/*==============================================================================
Effects - warp jumps, the launch, explosions with weight, damage numbers

  WARP    entering a new sector: the stars stretch into streaks rushing past,
          a white flash at the jump, then the new sector. About 1.3s, screen
          space, pure overlay - the fight underneath keeps running.
  LAUNCH  the start of a run: the plane comes in large and hot from below
          with its afterburner lit, settles to size, speed lines fall away.
  BOOM    explosions: a hot core flash, a shockwave ring, spinning debris,
          then smoke. Big ones (boss, heavy) add a short screen flash.
  NUMBERS damage numbers float off what you hit. Hits on the same enemy
          within a few frames add into one number, so a fast weapon shows
          "36" instead of a stack of "4"s, and the count on screen is capped.

Reduced motion: no warp streaks or launch zoom (a short fade instead), and
explosions keep their ring but drop the screen flash.
==============================================================================*/
( function() {
	var TWO_PI = Math.PI * 2;

	/*--- WARP ---------------------------------------------------------------*/
	var WARP_LEN = 80;
	$.warpFx = { t: 0, streaks: [], hue: 200 };
	$.startWarp = function( hue ) {
		var w = $.warpFx;
		w.t = WARP_LEN;
		w.hue = ( hue === undefined || hue < 0 ) ? 200 : hue;
		w.streaks.length = 0;
		// golden-angle spread, so it needs no randomness and never clumps
		for( var i = 0; i < 90; i++ ) {
			w.streaks.push( { a: i * 2.39996, d: 0.08 + ( ( i * 0.618 ) % 1 ) * 0.9, s: 0.6 + ( ( i * 0.381 ) % 1 ) * 0.8 } );
		}
		if( $.sfx ) { $.sfx.play( 'warp' ); }
	};
	$.updateWarp = function() {
		if( $.warpFx.t > 0 ) { $.warpFx.t = Math.max( 0, $.warpFx.t - ( $.dt || 1 ) ); }
	};
	// screen space: cw/ch are the visible canvas size
	$.renderWarp = function( ctx, cw, ch ) {
		var w = $.warpFx;
		if( w.t <= 0 ) { return; }
		var p = 1 - w.t / WARP_LEN; // 0 -> 1 over the jump
		if( $.reduceMotion ) {
			ctx.fillStyle = 'hsla(' + w.hue + ', 60%, 80%, ' + ( Math.sin( p * Math.PI ) * 0.25 ).toFixed( 3 ) + ')';
			ctx.fillRect( 0, 0, cw, ch );
			return;
		}
		var cx = cw / 2, cy = ch / 2, R = Math.sqrt( cx * cx + cy * cy ),
			// streaks lengthen into the jump, then snap away after the flash
			speed = p < 0.55 ? p / 0.55 : 1 - ( p - 0.55 ) / 0.45,
			fade = p < 0.55 ? Math.min( 1, p / 0.15 ) : 1 - ( p - 0.55 ) / 0.45;
		ctx.save();
		// tunnel vignette
		var vg = ctx.createRadialGradient( cx, cy, R * 0.15, cx, cy, R );
		vg.addColorStop( 0, 'hsla(' + w.hue + ', 80%, 50%, 0)' );
		vg.addColorStop( 1, 'hsla(' + w.hue + ', 80%, 20%, ' + ( 0.28 * fade ).toFixed( 3 ) + ')' );
		ctx.fillStyle = vg;
		ctx.fillRect( 0, 0, cw, ch );
		ctx.lineCap = 'round';
		for( var i = 0; i < w.streaks.length; i++ ) {
			var s = w.streaks[ i ],
				d0 = ( ( s.d + p * s.s * 1.6 ) % 1 ) * R,
				len = 8 + speed * R * 0.35 * s.s,
				x0 = cx + Math.cos( s.a ) * d0, y0 = cy + Math.sin( s.a ) * d0,
				x1 = cx + Math.cos( s.a ) * ( d0 + len ), y1 = cy + Math.sin( s.a ) * ( d0 + len );
			ctx.beginPath(); ctx.moveTo( x0, y0 ); ctx.lineTo( x1, y1 );
			ctx.lineWidth = 1 + s.s * 1.6 * speed;
			ctx.strokeStyle = 'hsla(' + ( w.hue + ( i % 3 ) * 20 ) + ', 90%, ' + ( 75 + s.s * 15 ) + '%, ' + ( fade * ( 0.35 + s.s * 0.4 ) ).toFixed( 3 ) + ')';
			ctx.stroke();
		}
		// the jump flash
		var flash = Math.max( 0, 1 - Math.abs( p - 0.55 ) / 0.07 );
		if( flash > 0 ) {
			ctx.fillStyle = 'rgba(235, 248, 255, ' + ( flash * 0.32 ).toFixed( 3 ) + ')';
			ctx.fillRect( 0, 0, cw, ch );
		}
		ctx.restore();
	};
	// true once, at the flash - the moment to swap the backdrop unseen
	$.warpAtFlash = function() {
		var w = $.warpFx;
		if( w.t <= 0 || w.flashed === w.t ) { return false; }
		var p = 1 - w.t / WARP_LEN;
		if( p >= 0.55 && !w.swapDone ) { w.swapDone = 1; return true; }
		if( p < 0.55 ) { w.swapDone = 0; }
		return false;
	};

	/*--- LAUNCH -------------------------------------------------------------*/
	var LAUNCH_LEN = 70;
	$.launchFx = { t: 0 };
	$.startLaunch = function() {
		$.launchFx.t = $.reduceMotion ? 0 : LAUNCH_LEN;
		if( $.sfx ) { $.sfx.play( 'launch' ); }
	};
	$.updateLaunch = function() {
		if( $.launchFx.t > 0 ) { $.launchFx.t = Math.max( 0, $.launchFx.t - ( $.dt || 1 ) ); }
	};
	// how big to draw the hero right now (1 when settled)
	$.launchScale = function() {
		var t = $.launchFx.t;
		if( t <= 0 ) { return 1; }
		var p = 1 - t / LAUNCH_LEN, e = 1 - Math.pow( 1 - p, 3 );
		return 1 + ( 1 - e ) * 1.6;
	};
	// world space, at the hero: afterburner plume while the zoom settles
	$.renderLaunchBurn = function( ctx, x, y, dir, r ) {
		var t = $.launchFx.t;
		if( t <= 0 ) { return; }
		var p = t / LAUNCH_LEN, len = r * ( 4 + p * 10 );
		ctx.save();
		ctx.translate( x, y ); ctx.rotate( dir );
		var g = ctx.createLinearGradient( -r, 0, -r - len, 0 );
		g.addColorStop( 0, 'hsla(45, 100%, 85%, ' + ( 0.9 * p ).toFixed( 3 ) + ')' );
		g.addColorStop( 0.3, 'hsla(25, 100%, 60%, ' + ( 0.55 * p ).toFixed( 3 ) + ')' );
		g.addColorStop( 1, 'hsla(200, 100%, 60%, 0)' );
		ctx.fillStyle = g;
		ctx.beginPath(); ctx.moveTo( -r * 0.8, -r * 0.35 ); ctx.lineTo( -r - len, 0 ); ctx.lineTo( -r * 0.8, r * 0.35 ); ctx.closePath(); ctx.fill();
		ctx.restore();
	};
	// screen space: speed lines falling past during the launch
	$.renderLaunchLines = function( ctx, cw, ch ) {
		var t = $.launchFx.t;
		if( t <= 0 ) { return; }
		var p = t / LAUNCH_LEN;
		ctx.save();
		ctx.lineWidth = 2;
		for( var i = 0; i < 26; i++ ) {
			var x = ( ( i * 0.618 ) % 1 ) * cw,
				y = ( ( ( i * 0.381 ) % 1 ) * ch + ( LAUNCH_LEN - t ) * 22 ) % ( ch + 200 ) - 100;
			ctx.strokeStyle = 'hsla(195, 90%, 85%, ' + ( 0.28 * p ).toFixed( 3 ) + ')';
			ctx.beginPath(); ctx.moveTo( x, y ); ctx.lineTo( x, y + 60 + p * 90 ); ctx.stroke();
		}
		ctx.restore();
	};

	/*--- BOOM ---------------------------------------------------------------*/
	// call from the Explosion constructor: precomputes the debris once
	$.explosionInit = function( ex ) {
		var big = ex.radius >= 40,
			n = ( $.explosions && $.explosions.length > 30 ) ? 3 : ( big ? 10 : 6 );
		ex.tickMax = big ? 42 : 30;
		ex.debris = [];
		for( var i = 0; i < n; i++ ) {
			var a = ( i / n ) * TWO_PI + $.fxRandom() * 0.6;
			ex.debris.push( { a: a, v: ( 0.6 + $.fxRandom() * 0.8 ) * ex.radius / 14, spin: ( $.fxRandom() - 0.5 ) * 0.5, s: 2 + $.fxRandom() * ( big ? 4 : 2.5 ) } );
		}
		ex.big = big;
	};
	$.explosionRender = function( ctx, ex ) {
		var p = Math.min( 1, ex.tick / ex.tickMax ),
			h = ex.hue, s = ex.saturation === undefined ? 100 : ex.saturation,
			R = ex.radius,
			// a crowded screen (a boss phase, a nuke) gets the cheap version:
			// flat core, no smoke - gradients per blast add up on a phone
			busy = $.explosions && $.explosions.length > 24;
		if( busy && p < 0.3 ) {
			ctx.beginPath(); ctx.arc( ex.x, ex.y, R * ( 0.4 + p * 2.5 ), 0, TWO_PI );
			ctx.fillStyle = 'hsla(' + h + ', ' + s + '%, 75%, ' + ( 0.6 * ( 1 - p / 0.3 ) ).toFixed( 3 ) + ')';
			ctx.fill();
		}
		// hot core flash - the first third
		if( !busy && p < 0.35 ) {
			var cp = p / 0.35, cr = R * ( 0.4 + cp * 0.9 ),
				g = ctx.createRadialGradient( ex.x, ex.y, 0, ex.x, ex.y, cr );
			g.addColorStop( 0, 'hsla(50, 100%, 96%, ' + ( 1 - cp ).toFixed( 3 ) + ')' );
			g.addColorStop( 0.35, 'hsla(' + h + ', ' + s + '%, 65%, ' + ( 0.8 * ( 1 - cp ) ).toFixed( 3 ) + ')' );
			g.addColorStop( 1, 'hsla(' + h + ', ' + s + '%, 50%, 0)' );
			ctx.fillStyle = g;
			ctx.beginPath(); ctx.arc( ex.x, ex.y, cr, 0, TWO_PI ); ctx.fill();
		}
		// smoke - the back half, dark and slow
		if( !busy && p > 0.3 ) {
			var sp = ( p - 0.3 ) / 0.7;
			for( var k = 0; k < 3; k++ ) {
				var sa = k * 2.1 + ex.radius, sd = R * 0.3 * sp;
				ctx.beginPath();
				ctx.arc( ex.x + Math.cos( sa ) * sd, ex.y + Math.sin( sa ) * sd, R * ( 0.3 + sp * 0.4 ), 0, TWO_PI );
				ctx.fillStyle = 'hsla(' + h + ', 15%, 12%, ' + ( 0.28 * ( 1 - sp ) ).toFixed( 3 ) + ')';
				ctx.fill();
			}
		}
		// shockwave ring
		var rr = R * ( 0.3 + Math.pow( p, 0.6 ) * 1.4 );
		ctx.beginPath(); ctx.arc( ex.x, ex.y, rr, 0, TWO_PI );
		ctx.lineWidth = Math.max( 0.5, R * 0.18 * ( 1 - p ) );
		ctx.strokeStyle = 'hsla(' + h + ', ' + s + '%, 75%, ' + ( 1 - p ).toFixed( 3 ) + ')';
		ctx.stroke();
		// debris shards, spinning out and slowing
		var travel = ( 1 - Math.pow( 1 - p, 2 ) );
		ctx.fillStyle = 'hsla(' + h + ', ' + s + '%, 80%, ' + ( 1 - p * p ).toFixed( 3 ) + ')';
		for( var d = 0; d < ex.debris.length; d++ ) {
			var db = ex.debris[ d ], dist = db.v * travel * 14,
				dx = ex.x + Math.cos( db.a ) * dist, dy = ex.y + Math.sin( db.a ) * dist,
				rot = db.spin * ex.tick;
			ctx.save(); ctx.translate( dx, dy ); ctx.rotate( rot );
			ctx.beginPath(); ctx.moveTo( db.s, 0 ); ctx.lineTo( -db.s * 0.6, db.s * 0.5 ); ctx.lineTo( -db.s * 0.4, -db.s * 0.6 ); ctx.closePath();
			ctx.fill();
			ctx.restore();
		}
	};
	// the big-boom screen flash, screen space
	$.explosionFlash = function( ctx, ex, cw, ch ) {
		if( !ex.big || $.reduceMotion ) { return; }
		var p = ex.tick / ex.tickMax;
		if( p > 0.2 ) { return; }
		ctx.fillStyle = 'hsla(' + ex.hue + ', 80%, 70%, ' + ( 0.08 * ( 1 - p / 0.2 ) ).toFixed( 3 ) + ')';
		ctx.fillRect( 0, 0, cw, ch );
	};

	/*--- DAMAGE NUMBERS ----------------------------------------------------*/
	$.dmgNums = [];
	var DMG_MAX = 36, DMG_LIFE = 42, DMG_MERGE = 10;
	// value is in the engine's damage units; shown x10 so 0.5 reads as "5"
	$.addDamageNumber = function( enemy, value ) {
		if( !value || value <= 0 ) { return; }
		var list = $.dmgNums;
		// merge into this enemy's live number if it was just hit
		for( var i = list.length - 1; i >= 0; i-- ) {
			var n = list[ i ];
			if( n.who === enemy && n.age < DMG_MERGE ) {
				n.value += value; n.age = 0; n.x = enemy.x; n.y = enemy.y - enemy.radius; n.pop = 1;
				return;
			}
		}
		if( list.length >= DMG_MAX ) { list.shift(); }
		list.push( { who: enemy, value: value, x: enemy.x, y: enemy.y - enemy.radius, age: 0, pop: 1, boss: !!enemy.isBoss } );
	};
	$.updateDamageNumbers = function() {
		var list = $.dmgNums, dt = $.dt || 1;
		for( var i = list.length - 1; i >= 0; i-- ) {
			var n = list[ i ];
			n.age += dt;
			n.y -= 0.6 * dt;
			n.pop = Math.max( 0, n.pop - 0.12 * dt );
			if( n.age > DMG_LIFE ) { list.splice( i, 1 ); }
		}
	};
	// world space; uses the bitmap font, so digits only
	$.renderDamageNumbers = function( ctx ) {
		var list = $.dmgNums;
		for( var i = 0; i < list.length; i++ ) {
			var n = list[ i ],
				shown = Math.max( 1, Math.round( n.value * 10 ) ),
				fade = n.age < DMG_LIFE * 0.6 ? 1 : 1 - ( n.age - DMG_LIFE * 0.6 ) / ( DMG_LIFE * 0.4 ),
				big = n.boss || shown >= 50;
			ctx.beginPath();
			$.text( { ctx: ctx, x: n.x, y: n.y, text: String( shown ), hspacing: 1, vspacing: 1, halign: 'center', valign: 'bottom', scale: ( big ? 3 : 2 ) + ( n.pop > 0.5 ? 1 : 0 ), snap: 1, render: 1 } );
			ctx.fillStyle = big ? 'hsla(45, 100%, 70%, ' + fade.toFixed( 3 ) + ')' : 'hsla(0, 0%, 100%, ' + ( fade * 0.85 ).toFixed( 3 ) + ')';
			ctx.fill();
		}
	};
} )();

