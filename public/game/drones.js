/*==============================================================================
Combat Drones - market-bought passive loadout companions

One drone equips at a time ($.storage['drone']). Each grants a single,
deliberately modest passive effect applied in hero.js/bullet.js/enemy.js -
strong enough to change how a run feels, not strong enough to be a
must-buy power spike.
==============================================================================*/
// ---------------------------------------------------------------------------
// Ship-style drone rendering helpers. Each drone keeps its distinctive
// silhouette but gains the flat-arcade look the ships use: a base fill, a
// darker shade, a lighter bevel, a bright (pulsing) accent, and a thin dark
// outline. Everything derives from the tint the caller passes as `fillStyle`,
// so recolours still work for free. Kept restrained so it still reads at the
// ~7px in-flight size, richer where the drone is shown large (hangar/market).
// With 3D graphics on, a raid and the bays draw the 3D model instead
// (droneModels.ts); these drawings are the 3D-off look and the UI icons.
// ---------------------------------------------------------------------------

// parse an hsl/hsla string into components so we can shift lightness/alpha
function droneHsl( s ) {
	var m = /hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+))?\)/.exec( s || '' );
	if( !m ) { return { h: 200, s: 20, l: 70, a: 1 }; }
	return { h: +m[ 1 ], s: +m[ 2 ], l: +m[ 3 ], a: m[ 4 ] != null ? +m[ 4 ] : 1 };
}
// a shade of the tint: dl shifts lightness, ds shifts saturation, alpha optional
function droneTone( c, dl, ds, a ) {
	var l = Math.max( 0, Math.min( 100, c.l + ( dl || 0 ) ) ),
		sat = Math.max( 0, Math.min( 100, c.s + ( ds || 0 ) ) );
	return 'hsla(' + c.h + ', ' + sat + '%, ' + l + '%, ' + ( a == null ? c.a : a ) + ')';
}
// thin dark outline that gives the flat-arcade silhouette; scales with size
function droneOutline( ctx, r ) {
	ctx.lineJoin = 'round';
	ctx.lineWidth = Math.max( 1, r * 0.06 );
	ctx.strokeStyle = 'rgba(4, 10, 16, 0.55)';
	ctx.stroke();
}

$.definitions.drones = [
	{
		id: 'drone_aegis', title: 'AEGIS HALO', desc: 'REDUCES COLLISION DAMAGE', xpBonus: 0.10, color: 'hsla(190, 78%, 60%, 1)',
		// tech shield: a bracket halo ring around a hex energy core
		draw: function( ctx, r, fillStyle, tick ) {
			var c = droneHsl( fillStyle ), t = tick || 0,
				ro = r * 0.98, ri = r * 0.66,
				segs = [ [ 0.62, Math.PI - 0.62 ], [ Math.PI + 0.62, $.twopi - 0.62 ] ];
			// halo brackets (base + outline)
			for( var i = 0; i < segs.length; i++ ) {
				ctx.beginPath();
				ctx.arc( 0, 0, ro, segs[ i ][ 0 ], segs[ i ][ 1 ] );
				ctx.arc( 0, 0, ri, segs[ i ][ 1 ], segs[ i ][ 0 ], true );
				ctx.closePath();
				ctx.fillStyle = droneTone( c, i ? -6 : 0 );
				ctx.fill();
				droneOutline( ctx, r );
			}
			// ring highlight (top-left) + shade (bottom-right)
			ctx.lineCap = 'round';
			ctx.lineWidth = r * 0.13;
			ctx.strokeStyle = droneTone( c, 22, -10, 0.9 );
			ctx.beginPath(); ctx.arc( 0, 0, ( ro + ri ) / 2, Math.PI * 1.15, Math.PI * 1.5 ); ctx.stroke();
			ctx.strokeStyle = droneTone( c, -20, 0, 0.9 );
			ctx.beginPath(); ctx.arc( 0, 0, ( ro + ri ) / 2, 0.15, 0.5 ); ctx.stroke();
			ctx.lineCap = 'butt';
			// hex core
			var cr = r * 0.46;
			ctx.beginPath();
			for( var k = 0; k < 6; k++ ) {
				var a = -Math.PI / 2 + k * $.twopi / 6, x = Math.cos( a ) * cr, y = Math.sin( a ) * cr;
				k ? ctx.lineTo( x, y ) : ctx.moveTo( x, y );
			}
			ctx.closePath();
			ctx.fillStyle = droneTone( c, 2 );
			ctx.fill();
			droneOutline( ctx, r );
			// pulsing accent core
			var pulse = 0.6 + 0.4 * Math.sin( t / 16 );
			ctx.beginPath(); ctx.arc( 0, 0, cr * 0.42, 0, $.twopi );
			ctx.fillStyle = droneTone( { h: c.h + 6, s: Math.min( 100, c.s + 30 ), l: c.l + 34, a: 1 }, 0, 0, pulse );
			ctx.fill();
		}
	},
	{
		id: 'drone_voltmite', title: 'VOLT MITE', desc: 'SHOTS CHAIN TO A NEARBY ENEMY', xpBonus: 0.15, color: 'hsla(52, 92%, 58%, 1)',
		// a jagged spark - lit leading facet + bright pulsing tip
		draw: function( ctx, r, fillStyle, tick ) {
			var c = droneHsl( fillStyle ), t = tick || 0;
			ctx.beginPath();
			ctx.moveTo( 0, -r );
			ctx.lineTo( r * 0.35, -r * 0.15 );
			ctx.lineTo( r * 0.9, -r * 0.15 );
			ctx.lineTo( r * 0.2, r );
			ctx.lineTo( r * 0.05, r * 0.2 );
			ctx.lineTo( -r * 0.55, r * 0.2 );
			ctx.closePath();
			ctx.fillStyle = droneTone( c, 0 );
			ctx.fill();
			droneOutline( ctx, r );
			// lit upper facet (bevel)
			ctx.beginPath();
			ctx.moveTo( 0, -r );
			ctx.lineTo( r * 0.35, -r * 0.15 );
			ctx.lineTo( r * 0.05, r * 0.2 );
			ctx.lineTo( -r * 0.55, r * 0.2 );
			ctx.closePath();
			ctx.fillStyle = droneTone( c, 18, -6, 0.9 );
			ctx.fill();
			// bright spark tip
			var pulse = 0.55 + 0.45 * Math.sin( t / 9 );
			ctx.beginPath(); ctx.arc( 0, -r * 0.72, r * 0.18, 0, $.twopi );
			ctx.fillStyle = droneTone( { h: c.h + 8, s: Math.min( 100, c.s + 25 ), l: c.l + 36, a: 1 }, 0, 0, pulse );
			ctx.fill();
		}
	},
	{
		id: 'drone_needlefinch', title: 'NEEDLE FINCH', desc: 'BULLETS PIERCE ENEMIES', xpBonus: 0.15, color: 'hsla(16, 85%, 57%, 1)',
		// a thin needle - bright leading edge, shaded trailing half
		draw: function( ctx, r, fillStyle, tick ) {
			var c = droneHsl( fillStyle );
			ctx.beginPath();
			ctx.moveTo( 0, -r );
			ctx.lineTo( r * 0.22, r * 0.5 );
			ctx.lineTo( 0, r * 0.25 );
			ctx.lineTo( -r * 0.22, r * 0.5 );
			ctx.closePath();
			ctx.fillStyle = droneTone( c, 0 );
			ctx.fill();
			droneOutline( ctx, r );
			// lit left flank
			ctx.beginPath();
			ctx.moveTo( 0, -r );
			ctx.lineTo( 0, r * 0.25 );
			ctx.lineTo( -r * 0.22, r * 0.5 );
			ctx.closePath();
			ctx.fillStyle = droneTone( c, 20, -8, 0.9 );
			ctx.fill();
			// bright tip
			ctx.beginPath(); ctx.arc( 0, -r * 0.78, r * 0.12, 0, $.twopi );
			ctx.fillStyle = droneTone( c, 40, 0, 1 );
			ctx.fill();
		}
	},
	{
		id: 'drone_gravbeetle', title: 'GRAV BEETLE', desc: 'PULLS NEARBY ENEMIES INWARD', xpBonus: 0.20, color: 'hsla(280, 58%, 62%, 1)',
		// a spiral pulling inward, over a shaded gravity well core
		draw: function( ctx, r, fillStyle, tick ) {
			var c = droneHsl( fillStyle ), t = tick || 0;
			// dark well
			ctx.beginPath(); ctx.arc( 0, 0, r * 0.9, 0, $.twopi );
			ctx.fillStyle = droneTone( c, -24, -6, 0.28 );
			ctx.fill();
			// two-tone spiral (shadow pass + bright pass)
			function spiral( off, style, lw ) {
				ctx.strokeStyle = style; ctx.lineWidth = lw; ctx.lineCap = 'round';
				ctx.beginPath();
				var turns = 2.1, steps = 26;
				for( var s = 0; s <= steps; s++ ) {
					var tt = s / steps,
						angle = tt * turns * $.twopi + t / 20 + off,
						rad = r * ( 0.95 - tt * 0.8 ),
						x = Math.cos( angle ) * rad, y = Math.sin( angle ) * rad;
					s ? ctx.lineTo( x, y ) : ctx.moveTo( x, y );
				}
				ctx.stroke();
			}
			spiral( 0.16, droneTone( c, -20, 0, 0.8 ), r * 0.2 );
			spiral( 0, droneTone( c, 14, -6, 1 ), r * 0.13 );
			ctx.lineCap = 'butt';
			// pulsing core singularity
			var pulse = 0.5 + 0.5 * Math.sin( t / 14 );
			ctx.beginPath(); ctx.arc( 0, 0, r * 0.16, 0, $.twopi );
			ctx.fillStyle = droneTone( c, 38, 0, pulse );
			ctx.fill();
		}
	},
	{
		id: 'drone_medicwisp', title: 'MEDIC WISP', desc: 'SLOWLY REGENERATES HULL', xpBonus: 0.10, color: 'hsla(145, 60%, 52%, 1)',
		// a beveled orb with a lit medical cross and a soft pulse
		draw: function( ctx, r, fillStyle, tick ) {
			var c = droneHsl( fillStyle ), t = tick || 0,
				pulse = 0.22 + 0.14 * Math.sin( t / 18 );
			// soft outer glow
			ctx.beginPath(); ctx.arc( 0, 0, r * 0.92, 0, $.twopi );
			ctx.fillStyle = droneTone( c, 10, 0, pulse );
			ctx.fill();
			// orb body
			ctx.beginPath(); ctx.arc( 0, 0, r * 0.7, 0, $.twopi );
			ctx.fillStyle = droneTone( c, -4, 0, 0.85 );
			ctx.fill();
			droneOutline( ctx, r );
			// top-left highlight
			ctx.beginPath(); ctx.arc( -r * 0.22, -r * 0.22, r * 0.28, 0, $.twopi );
			ctx.fillStyle = droneTone( c, 26, -8, 0.55 );
			ctx.fill();
			// lit cross
			ctx.fillStyle = droneTone( c, 40, 0, 1 );
			ctx.fillRect( -r * 0.14, -r * 0.5, r * 0.28, r * 1.0 );
			ctx.fillRect( -r * 0.5, -r * 0.14, r * 1.0, r * 0.28 );
		}
	},
	{
		// reward-only champion crest: a gold crown. Never sold - granted to
		// tournament winners from the admin so it reads as a flex in-game.
		// Keeps its fixed gold (ignores tint) but gains base shade + jewel.
		id: 'drone_champion', title: 'CHAMPION CREST', desc: 'WINNERS-ONLY COSMETIC CREST', xpBonus: 0.25, color: 'hsla(45, 100%, 58%, 1)',
		reward: true,
		draw: function( ctx, r, fillStyle, tick ) {
			var t = tick || 0;
			function crown() {
				ctx.beginPath();
				ctx.moveTo( -r, r * 0.6 );
				ctx.lineTo( -r, -r * 0.4 );
				ctx.lineTo( -r * 0.5, r * 0.1 );
				ctx.lineTo( 0, -r * 0.7 );
				ctx.lineTo( r * 0.5, r * 0.1 );
				ctx.lineTo( r, -r * 0.4 );
				ctx.lineTo( r, r * 0.6 );
				ctx.closePath();
			}
			crown();
			ctx.fillStyle = 'hsla(45, 100%, 58%, 1)';
			ctx.fill();
			droneOutline( ctx, r );
			// darker base band for depth
			ctx.beginPath();
			ctx.moveTo( -r, r * 0.6 ); ctx.lineTo( -r, r * 0.1 );
			ctx.lineTo( r, r * 0.1 ); ctx.lineTo( r, r * 0.6 );
			ctx.closePath();
			ctx.fillStyle = 'hsla(40, 90%, 42%, 0.9)';
			ctx.fill();
			// bright top highlight on the peaks
			ctx.strokeStyle = 'hsla(48, 100%, 78%, 0.9)';
			ctx.lineWidth = r * 0.08; ctx.lineJoin = 'round';
			ctx.beginPath();
			ctx.moveTo( -r * 0.5, r * 0.1 ); ctx.lineTo( 0, -r * 0.7 ); ctx.lineTo( r * 0.5, r * 0.1 );
			ctx.stroke();
			// centre jewel
			var pulse = 0.6 + 0.4 * Math.sin( t / 15 );
			ctx.beginPath(); ctx.arc( 0, -r * 0.05, r * 0.16, 0, $.twopi );
			ctx.fillStyle = 'hsla(0, 85%, 60%, ' + pulse + ')';
			ctx.fill();
		}
	},
	{
		id: 'drone_frostsprite', title: 'FROST SPRITE', desc: 'HITS CHILL AND SLOW ENEMIES', xpBonus: 0.15, color: 'hsla(198, 90%, 72%, 1)',
		// a six-armed ice crystal round a cold core
		draw: function( ctx, r, fillStyle, tick ) {
			var c = droneHsl( fillStyle ), t = ( tick || 0 ) / 90;
			ctx.lineCap = 'round';
			for( var k = 0; k < 6; k++ ) {
				var a = t + k * $.twopi / 6, ca = Math.cos( a ), sa = Math.sin( a );
				ctx.strokeStyle = droneTone( c, -14, 0, 0.9 ); ctx.lineWidth = r * 0.26;
				ctx.beginPath(); ctx.moveTo( 0, 0 ); ctx.lineTo( ca * r, sa * r ); ctx.stroke();
				ctx.strokeStyle = droneTone( c, 16, -10, 1 ); ctx.lineWidth = r * 0.12;
				ctx.beginPath(); ctx.moveTo( 0, 0 ); ctx.lineTo( ca * r, sa * r ); ctx.stroke();
				// a barb either side, two thirds out
				var bx = ca * r * 0.62, by = sa * r * 0.62;
				ctx.beginPath();
				ctx.moveTo( bx, by ); ctx.lineTo( bx + Math.cos( a + 0.8 ) * r * 0.26, by + Math.sin( a + 0.8 ) * r * 0.26 );
				ctx.moveTo( bx, by ); ctx.lineTo( bx + Math.cos( a - 0.8 ) * r * 0.26, by + Math.sin( a - 0.8 ) * r * 0.26 );
				ctx.stroke();
			}
			ctx.lineCap = 'butt';
			ctx.beginPath();
			for( var h = 0; h < 6; h++ ) { var ha = t * -2 + h * $.twopi / 6; h ? ctx.lineTo( Math.cos( ha ) * r * 0.3, Math.sin( ha ) * r * 0.3 ) : ctx.moveTo( Math.cos( ha ) * r * 0.3, Math.sin( ha ) * r * 0.3 ); }
			ctx.closePath();
			ctx.fillStyle = droneTone( c, 24, 10, 1 ); ctx.fill();
			droneOutline( ctx, r );
		}
	},
	{
		id: 'drone_salvagecrab', title: 'SALVAGE CRAB', desc: 'PULLS POWERUPS IN FROM RANGE', xpBonus: 0.10, color: 'hsla(28, 72%, 56%, 1)',
		// a squat crab with two claws forward and a magnet on its back
		draw: function( ctx, r, fillStyle, tick ) {
			var c = droneHsl( fillStyle ), pinch = 0.25 + Math.sin( ( tick || 0 ) / 10 ) * 0.2;
			ctx.strokeStyle = droneTone( c, -26, 0, 1 ); ctx.lineWidth = r * 0.1; ctx.lineCap = 'round';
			for( var s = -1; s <= 1; s += 2 ) {
				for( var k = 0; k < 3; k++ ) {
					ctx.beginPath(); ctx.moveTo( s * r * 0.5, -r * 0.1 + k * r * 0.25 ); ctx.lineTo( s * r * 1.0, r * 0.05 + k * r * 0.32 ); ctx.stroke();
				}
				// claw
				ctx.beginPath(); ctx.moveTo( s * r * 0.4, -r * 0.35 ); ctx.lineTo( s * r * 0.6, -r * 0.8 ); ctx.stroke();
				ctx.save(); ctx.translate( s * r * 0.6, -r * 0.82 );
				ctx.fillStyle = droneTone( c, 4 );
				ctx.beginPath(); ctx.arc( 0, 0, r * 0.2, -Math.PI / 2 - pinch * s - 1.2, -Math.PI / 2 - pinch * s + 1.2 ); ctx.lineTo( 0, 0 ); ctx.fill();
				ctx.restore();
			}
			ctx.lineCap = 'butt';
			ctx.beginPath(); ctx.ellipse( 0, 0, r * 0.62, r * 0.48, 0, 0, $.twopi );
			ctx.fillStyle = droneTone( c, 0 ); ctx.fill(); droneOutline( ctx, r );
			ctx.beginPath(); ctx.ellipse( -r * 0.15, -r * 0.15, r * 0.3, r * 0.18, -0.4, 0, $.twopi );
			ctx.fillStyle = droneTone( c, 18, -8, 0.7 ); ctx.fill();
			// the magnet: a red U
			ctx.strokeStyle = 'hsla(355, 70%, 52%, 1)'; ctx.lineWidth = r * 0.16;
			ctx.beginPath(); ctx.arc( 0, r * 0.05, r * 0.2, 0, Math.PI ); ctx.stroke();
			ctx.fillStyle = 'hsla(210, 15%, 80%, 1)';
			ctx.fillRect( -r * 0.28, -r * 0.06, r * 0.16, r * 0.12 ); ctx.fillRect( r * 0.12, -r * 0.06, r * 0.16, r * 0.12 );
		}
	},
	{
		id: 'drone_embermoth', title: 'EMBER MOTH', desc: 'HITS SET A SHORT BURN', xpBonus: 0.15, color: 'hsla(14, 95%, 58%, 1)',
		// a moth: four smouldering wings round an ember body
		draw: function( ctx, r, fillStyle, tick ) {
			var c = droneHsl( fillStyle ), flap = 0.8 + Math.sin( ( tick || 0 ) / 4 ) * 0.2;
			for( var s = -1; s <= 1; s += 2 ) {
				ctx.save(); ctx.scale( s * flap, 1 );
				ctx.beginPath(); ctx.moveTo( 0, -r * 0.1 ); ctx.quadraticCurveTo( r * 0.6, -r * 1.0, r * 1.0, -r * 0.35 ); ctx.quadraticCurveTo( r * 0.6, r * 0.05, 0, r * 0.05 );
				ctx.fillStyle = droneTone( c, -12, -10, 0.95 ); ctx.fill(); droneOutline( ctx, r );
				ctx.beginPath(); ctx.moveTo( 0, r * 0.05 ); ctx.quadraticCurveTo( r * 0.7, r * 0.15, r * 0.6, r * 0.65 ); ctx.quadraticCurveTo( r * 0.25, r * 0.55, 0, r * 0.2 );
				ctx.fillStyle = droneTone( c, -20, -10, 0.95 ); ctx.fill(); droneOutline( ctx, r );
				ctx.beginPath(); ctx.arc( r * 0.6, -r * 0.42, r * 0.12, 0, $.twopi );
				ctx.fillStyle = droneTone( c, 26, 5, 1 ); ctx.fill();
				ctx.restore();
			}
			ctx.beginPath(); ctx.ellipse( 0, r * 0.1, r * 0.16, r * 0.62, 0, 0, $.twopi );
			ctx.fillStyle = droneTone( c, 20, 5, 1 ); ctx.fill(); droneOutline( ctx, r );
			ctx.beginPath(); ctx.arc( 0, -r * 0.55, r * 0.12, 0, $.twopi );
			ctx.fillStyle = droneTone( c, -30, -30, 1 ); ctx.fill();
		}
	},
	{
		id: 'drone_mirrorbat', title: 'MIRROR BAT', desc: 'BLOCKS ONE ENEMY BOLT EVERY 8S', xpBonus: 0.20, color: 'hsla(215, 22%, 78%, 1)',
		// a small dark bat with mirror-bright wings
		draw: function( ctx, r, fillStyle, tick ) {
			var c = droneHsl( fillStyle ), flex = 1 + Math.sin( ( tick || 0 ) / 14 ) * 0.08;
			for( var s = -1; s <= 1; s += 2 ) {
				ctx.save(); ctx.scale( s * flex, 1 );
				ctx.beginPath();
				ctx.moveTo( r * 0.1, -r * 0.2 ); ctx.lineTo( r * 0.55, -r * 0.5 ); ctx.lineTo( r * 1.0, -r * 0.35 );
				ctx.quadraticCurveTo( r * 0.85, -r * 0.12, r * 0.92, r * 0.1 ); ctx.quadraticCurveTo( r * 0.72, 0, r * 0.62, r * 0.22 );
				ctx.quadraticCurveTo( r * 0.45, r * 0.08, r * 0.3, r * 0.26 ); ctx.quadraticCurveTo( r * 0.2, r * 0.08, r * 0.1, r * 0.15 );
				ctx.closePath();
				var g = ctx.createLinearGradient( 0, -r * 0.5, r, r * 0.2 );
				g.addColorStop( 0, droneTone( c, 20, 0, 1 ) ); g.addColorStop( 0.5, droneTone( c, -20, 0, 1 ) ); g.addColorStop( 1, droneTone( c, 14, 0, 1 ) );
				ctx.fillStyle = g; ctx.fill(); droneOutline( ctx, r );
				ctx.restore();
			}
			ctx.beginPath(); ctx.ellipse( 0, 0, r * 0.2, r * 0.32, 0, 0, $.twopi );
			ctx.fillStyle = 'hsla(222, 18%, 14%, 1)'; ctx.fill();
			ctx.beginPath(); ctx.moveTo( -r * 0.14, -r * 0.3 ); ctx.lineTo( -r * 0.08, -r * 0.5 ); ctx.lineTo( -r * 0.02, -r * 0.32 ); ctx.moveTo( r * 0.14, -r * 0.3 ); ctx.lineTo( r * 0.08, -r * 0.5 ); ctx.lineTo( r * 0.02, -r * 0.32 ); ctx.fill();
			ctx.fillStyle = 'hsla(186, 100%, 75%, 1)';
			ctx.fillRect( -r * 0.1, -r * 0.24, r * 0.06, r * 0.06 ); ctx.fillRect( r * 0.04, -r * 0.24, r * 0.06, r * 0.06 );
		}
	},
	{
		id: 'drone_decoygecko', title: 'DECOY GECKO', desc: 'THROWS A DECOY EVERY 12S', xpBonus: 0.20, color: 'hsla(165, 75%, 52%, 1)',
		// a gecko with a curled holo-projector tail
		draw: function( ctx, r, fillStyle, tick ) {
			var c = droneHsl( fillStyle ), t = tick || 0;
			ctx.strokeStyle = droneTone( c, -6 ); ctx.lineWidth = r * 0.16; ctx.lineCap = 'round';
			ctx.beginPath(); ctx.moveTo( 0, r * 0.35 ); ctx.quadraticCurveTo( r * 0.1, r * 0.95, r * 0.45, r * 0.8 ); ctx.quadraticCurveTo( r * 0.6, r * 0.6, r * 0.38, r * 0.5 ); ctx.stroke();
			ctx.lineWidth = r * 0.1;
			for( var s = -1; s <= 1; s += 2 ) {
				ctx.beginPath(); ctx.moveTo( 0, -r * 0.2 ); ctx.lineTo( s * r * 0.55, -r * 0.45 ); ctx.moveTo( 0, r * 0.25 ); ctx.lineTo( s * r * 0.55, r * 0.45 ); ctx.stroke();
				ctx.fillStyle = droneTone( c, 14 );
				ctx.beginPath(); ctx.arc( s * r * 0.58, -r * 0.47, r * 0.09, 0, $.twopi ); ctx.arc( s * r * 0.58, r * 0.47, r * 0.09, 0, $.twopi ); ctx.fill();
			}
			ctx.lineCap = 'butt';
			ctx.beginPath(); ctx.ellipse( 0, 0, r * 0.24, r * 0.48, 0, 0, $.twopi );
			ctx.fillStyle = droneTone( c, 0 ); ctx.fill(); droneOutline( ctx, r );
			ctx.beginPath(); ctx.ellipse( 0, -r * 0.58, r * 0.2, r * 0.18, 0, 0, $.twopi );
			ctx.fillStyle = droneTone( c, 4 ); ctx.fill(); droneOutline( ctx, r );
			ctx.fillStyle = 'hsla(62, 100%, 76%, 1)';
			ctx.beginPath(); ctx.arc( -r * 0.12, -r * 0.62, r * 0.06, 0, $.twopi ); ctx.arc( r * 0.12, -r * 0.62, r * 0.06, 0, $.twopi ); ctx.fill();
			// the projector lens, flickering
			ctx.beginPath(); ctx.arc( r * 0.38, r * 0.5, r * 0.11, 0, $.twopi );
			ctx.fillStyle = droneTone( c, 30, 10, 0.6 + 0.4 * Math.abs( Math.sin( t / 5 ) ) ); ctx.fill();
		}
	},
	{
		id: 'drone_scoutowl', title: 'SCOUT OWL', desc: 'MARKS ENEMIES OFF SCREEN', xpBonus: 0.10, color: 'hsla(38, 48%, 60%, 1)',
		// a compact owl: two big lens eyes and a spinning radar dish
		draw: function( ctx, r, fillStyle, tick ) {
			var c = droneHsl( fillStyle ), t = ( tick || 0 ) / 12;
			ctx.beginPath(); ctx.ellipse( 0, r * 0.05, r * 0.72, r * 0.82, 0, 0, $.twopi );
			ctx.fillStyle = droneTone( c, -16, -8 ); ctx.fill(); droneOutline( ctx, r );
			ctx.beginPath(); ctx.moveTo( -r * 0.55, -r * 0.55 ); ctx.lineTo( -r * 0.4, -r * 0.95 ); ctx.lineTo( -r * 0.22, -r * 0.6 ); ctx.moveTo( r * 0.55, -r * 0.55 ); ctx.lineTo( r * 0.4, -r * 0.95 ); ctx.lineTo( r * 0.22, -r * 0.6 );
			ctx.fill();
			ctx.beginPath(); ctx.ellipse( 0, -r * 0.18, r * 0.62, r * 0.42, 0, 0, $.twopi );
			ctx.fillStyle = droneTone( c, 14, -16 ); ctx.fill();
			for( var s = -1; s <= 1; s += 2 ) {
				ctx.beginPath(); ctx.arc( s * r * 0.27, -r * 0.2, r * 0.22, 0, $.twopi );
				ctx.fillStyle = 'hsla(210, 10%, 78%, 1)'; ctx.fill();
				ctx.beginPath(); ctx.arc( s * r * 0.27, -r * 0.2, r * 0.16, 0, $.twopi );
				ctx.fillStyle = 'hsla(42, 100%, 66%, 1)'; ctx.fill();
				ctx.beginPath(); ctx.arc( s * r * 0.27 + Math.cos( t ) * r * 0.04, -r * 0.2, r * 0.07, 0, $.twopi );
				ctx.fillStyle = 'hsla(30, 60%, 8%, 1)'; ctx.fill();
			}
			ctx.beginPath(); ctx.moveTo( -r * 0.06, -r * 0.05 ); ctx.lineTo( r * 0.06, -r * 0.05 ); ctx.lineTo( 0, r * 0.1 ); ctx.closePath();
			ctx.fillStyle = 'hsla(40, 80%, 55%, 1)'; ctx.fill();
			// the radar dish on its back, turning
			ctx.strokeStyle = 'hsla(210, 15%, 88%, 1)'; ctx.lineWidth = r * 0.08;
			ctx.beginPath(); ctx.arc( 0, r * 0.5, r * 0.2, t, t + Math.PI ); ctx.stroke();
		}
	}
];

// XP multiplier from the equipped drone. Drones are bought loadout that
// already shape a run's combat; each also grants a small pilot-XP bonus, so
// buying/upgrading a drone speeds progression (pilot levels) - a revenue
// lever that stays on the PROGRESSION lane and never touches the run's score.
$.droneXpMult = function() {
	var d = $.equippedDrone && $.equippedDrone();
	return 1 + ( ( d && d.xpBonus ) || 0 );
};

// Percent label for UI, e.g. 0.15 -> "+15% XP" (empty when no bonus). The
// bitmap font has no "%", so the label uses "PCT".
$.droneXpLabel = function( drone ) {
	var b = drone && drone.xpBonus;
	return b ? ( '+' + Math.round( b * 100 ) + ' PCT XP' ) : '';
};

// Total pilot-XP multiplier for the current run: the equipped drone's bonus
// times a 2x if an XP BOOST is active this run. Both are progression levers -
// they change how fast you level, never the run's score.
$.xpGainMult = function() {
	return $.droneXpMult() * ( $.xpBoostThisRun ? 2 : 1 );
};

// Spend one XP BOOST charge to double this run's pilot XP. Called once at run
// start. Does NOT flag the run assisted (unlike combat consumables), so a
// boosted run still ranks normally. Wallet-only, like all consumables.
$.activateXpBoost = function() {
	if( $.xpBoostThisRun ) { return; }
	if( !$.session || !$.session.authenticated ) { return; }
	if( ( $.consumableCount( 'consumable_xpboost' ) || 0 ) <= 0 ) { return; }
	$.profile.consumables[ 'consumable_xpboost' ]--;
	$.xpBoostThisRun = 1;
	// durable, like every other spend - see $.queueConsumableSpend in market.js
	if( $.queueConsumableSpend ) {
		$.queueConsumableSpend( 'consumable_xpboost' );
	}
};

/*==============================================================================
The newer six drones' abilities

GAMEPLAY, like the first five's (hero.js / bullet.js / enemy.js call these).
Each is kept as modest as theirs:
  FROST SPRITE  a hit chills the enemy: 15 PCT slower for 1s (bosses 5 PCT)
  SALVAGE CRAB  power-ups within 120px drift in to the ship
  EMBER MOTH    a hit sets a burn: 20 PCT of the hit again over 1.5s, one
                burn per enemy, refreshed (not stacked) by the next hit
  MIRROR BAT    one enemy bolt every 8s glances off harmlessly
  DECOY GECKO   every 12s a 2s hologram behind the ship that nearby enemies
                (never bosses) chase instead
  SCOUT OWL     edge markers for what is just off screen - drawing only
Frame counters only, never dice: a seeded raid stays the same raid.
==============================================================================*/
$.droneIs = function( id ) {
	var d = $.equippedDrone && $.equippedDrone();
	return !!d && d.id === id;
};

function droneAbility( hero ) {
	var st = $.droneAbilityState;
	if( !st || st.hero !== hero ) {
		// the first decoy comes 6s into a raid, then every 12s
		st = $.droneAbilityState = { hero: hero, blockCool: 0, decoyCool: 360, decoy: null };
	}
	return st;
}

$.updateDroneAbilities = function( hero ) {
	var st = droneAbility( hero );
	if( st.blockCool > 0 ) { st.blockCool -= $.dt; }
	if( !$.droneIs( 'drone_decoygecko' ) ) { st.decoy = null; return; }
	if( st.decoy ) {
		st.decoy.life -= $.dt;
		if( st.decoy.life <= 0 ) { st.decoy = null; }
	}
	st.decoyCool -= $.dt;
	if( st.decoyCool <= 0 ) {
		st.decoyCool = 720;
		st.decoy = {
			x: hero.x - Math.cos( hero.direction ) * 70,
			y: hero.y - Math.sin( hero.direction ) * 70,
			dir: hero.direction, life: 120, max: 120
		};
		if( $.droneEvent ) { $.droneEvent( 'decoy', st.decoy.x, st.decoy.y ); }
	}
};

// a player shot just hit `enemy` for `dmg`
$.droneOnHit = function( enemy, dmg ) {
	if( $.droneIs( 'drone_frostsprite' ) ) { enemy.chill = 60; }
	else if( $.droneIs( 'drone_embermoth' ) && dmg > 0 ) { enemy.burn = { left: dmg * 0.2, ticks: 6, t: 0 }; }
};

// Frost Sprite: what a chilled enemy's movement is scaled by this frame
$.droneChill = function( enemy ) {
	if( !( enemy.chill > 0 ) ) { return 1; }
	enemy.chill -= $.dt;
	return enemy.isBoss ? 0.95 : 0.85;
};

// Ember Moth: the burn ticks every 15 frames. True when it finished the enemy.
$.droneBurnTick = function( enemy, i ) {
	var b = enemy.burn;
	if( !b ) { return false; }
	b.t += $.dt;
	if( b.t < 15 ) { return false; }
	b.t -= 15;
	var amount = b.left / b.ticks;
	b.left -= amount;
	b.ticks--;
	if( b.ticks <= 0 ) { enemy.burn = null; }
	enemy.receiveDamage( i, amount );
	return $.enemies[ i ] !== enemy;
};

// Mirror Bat: true when this bolt is blocked (the caller removes it)
$.droneBlock = function( hero, bolt ) {
	if( !$.droneIs( 'drone_mirrorbat' ) ) { return false; }
	var st = droneAbility( hero );
	if( st.blockCool > 0 ) { return false; }
	st.blockCool = 480;
	if( $.droneEvent ) { $.droneEvent( 'block', bolt.x, bolt.y ); }
	return true;
};

// Decoy Gecko: the point an enemy chases instead of the ship, or null
$.droneLure = function( enemy ) {
	var st = $.droneAbilityState;
	if( !st || !st.decoy || st.hero !== $.hero || enemy.isBoss || enemy.isBolt ) { return null; }
	var dx = enemy.x - st.decoy.x, dy = enemy.y - st.decoy.y;
	return dx * dx + dy * dy < 260 * 260 ? st.decoy : null;
};

// Salvage Crab: a power-up in range drifts in to the ship
$.droneMagnet = function( p ) {
	p.pulled = 0;
	if( !$.hero || $.hero.life <= 0 || !$.droneIs( 'drone_salvagecrab' ) ) { return; }
	var cx = p.x + p.width / 2, cy = p.y + p.height / 2,
		dx = $.hero.x - cx, dy = $.hero.y - cy, d = Math.sqrt( dx * dx + dy * dy );
	if( d >= 120 || d < 1 ) { return; }
	var step = Math.min( d, 5 * $.dt );
	p.x += dx / d * step;
	p.y += dy / d * step;
	p.pulled = 1;
};

/*==============================================================================
The drone in flight

Each drone flies its own way round the ship, shows its effect working, and
answers every 5th kill of a combo with its own move. Drawn from its 3D model
(baked once after boot by ArenaObjects3D, like the rocks) when that sheet is
ready and 3D graphics are on; otherwise from its flat drawing above.

ALL OF THIS IS DRAWING. The effects themselves - collision resist, chain,
pierce, pull, regen - stay exactly where they were (hero.js, bullet.js,
enemy.js); the hooks below only report that one happened. A combo move never
touches an enemy or the score. Every roll here is $.fxRandom: during a Daily
Run or a duel Math.random is the raid's dice.
==============================================================================*/
$.droneMoves = {
	drone_aegis: 'BULWARK',
	drone_voltmite: 'STORM CROWN',
	drone_needlefinch: 'STRAFE',
	drone_gravbeetle: 'COLLAPSE',
	drone_medicwisp: 'BLOOM',
	drone_champion: 'CROWNED',
	drone_frostsprite: 'BLIZZARD',
	drone_salvagecrab: 'HAUL',
	drone_embermoth: 'WILDFIRE',
	drone_mirrorbat: 'ECHO',
	drone_decoygecko: 'MIRAGE',
	drone_scoutowl: 'NIGHT SIGHT'
};
// the in-flight size: half again the old 7px orbiting drawing
$.droneFlightRadius = 11;
$.droneRig = null;
$.droneFx = [];

// a run's hero gets a fresh rig; so does a swap of drone
function droneRigFor( hero, d ) {
	var rig = $.droneRig;
	if( !rig || rig.hero !== hero || rig.id !== d.id ) {
		rig = $.droneRig = {
			hero: hero, id: d.id, x: hero.x, y: hero.y - 30, dir: 0, t: 0,
			ang: 0, side: null, hop: 0, tx: 30, ty: 0, loop: -1, step: 1, dart: 0, dx: 0, dy: 0,
			hexCool: 0, surge: null, surgeCool: 0, label: null
		};
		$.droneFx.length = 0;
	}
	return rig;
}

function droneTurn( from, to, k ) {
	return from + Math.atan2( Math.sin( to - from ), Math.cos( to - from ) ) * Math.min( 1, k );
}

function droneAddFx( f ) {
	// a dense wave can fire dozens of chains a second; past this the screen
	// is already lit and more lines only cost frames
	if( $.droneFx.length < 48 ) { $.droneFx.push( f ); }
}

$.updateDrone = function( hero ) {
	var d = $.equippedDrone && $.equippedDrone();
	if( !d || !hero || hero.life <= 0 ) { return; }
	var rig = droneRigFor( hero, d ), s = ( $.dt || 1 ) / 60, id = d.id,
		fx = Math.cos( hero.direction ), fy = Math.sin( hero.direction ),
		tx, ty, k = 6, face = null;
	rig.t += s;

	if( id === 'drone_aegis' ) {
		// wide and slow, brackets turning; swings round to the side that took a hit
		rig.ang += s * 0.9;
		if( rig.side !== null ) {
			var gap = Math.atan2( Math.sin( rig.side - rig.ang ), Math.cos( rig.side - rig.ang ) );
			rig.ang += gap * Math.min( 1, s * 4 );
			if( Math.abs( gap ) < 0.05 ) { rig.side = null; }
		}
		tx = hero.x + Math.cos( rig.ang ) * 40; ty = hero.y + Math.sin( rig.ang ) * 40; k = 10;
		face = rig.ang * 0.6;
	} else if( id === 'drone_voltmite' ) {
		// short hops between points round the ship, never still
		rig.hop -= s;
		if( rig.hop <= 0 ) {
			var ha = $.fxRand( 0, $.twopi ), hr = $.fxRand( 26, 38 );
			rig.tx = Math.cos( ha ) * hr; rig.ty = Math.sin( ha ) * hr; rig.hop = $.fxRand( 0.35, 0.6 );
		}
		tx = hero.x + rig.tx + $.fxRand( -1.2, 1.2 ); ty = hero.y + rig.ty + $.fxRand( -1.2, 1.2 ); k = 16;
	} else if( id === 'drone_needlefinch' ) {
		if( rig.loop >= 0 ) {
			// STRAFE: one fast loop round the ship
			rig.loop += s;
			var la = rig.loop / 0.9 * $.twopi;
			tx = hero.x + Math.cos( la ) * 46; ty = hero.y + Math.sin( la ) * 46; k = 30;
			if( rig.loop > 0.9 ) { rig.loop = -1; }
		} else {
			// a wingman off the right wing, a little ahead, facing where the ship faces
			tx = hero.x - fy * 26 + fx * 14; ty = hero.y + fx * 26 + fy * 14; k = 9;
			face = hero.direction + Math.PI / 2;
		}
	} else if( id === 'drone_gravbeetle' ) {
		// heavy: trails behind and is late on every turn
		tx = hero.x - fx * 34; ty = hero.y - fy * 34; k = 2.2;
	} else if( id === 'drone_medicwisp' ) {
		tx = hero.x - 18 + Math.sin( rig.t * 1.4 ) * 4; ty = hero.y - 28 + Math.sin( rig.t * 2.1 ) * 5; k = 5;
		face = 0;
	} else if( id === 'drone_frostsprite' ) {
		// a slow figure of eight over the canopy, turning like a snowflake
		tx = hero.x + Math.sin( rig.t * 0.9 ) * 28; ty = hero.y - 28 + Math.sin( rig.t * 1.8 ) * 8; k = 4;
		face = rig.t * 0.6;
	} else if( id === 'drone_salvagecrab' ) {
		// scuttles side to side behind the ship; darts at a power-up it is reeling in
		rig.hop -= s;
		if( rig.hop <= 0 ) { rig.step = -rig.step; rig.hop = 0.7; }
		var grab = null, gd = 120 * 120;
		for( var pi = 0; pi < $.powerups.length; pi++ ) {
			var pu = $.powerups[ pi ], pdx = pu.x + pu.width / 2 - hero.x, pdy = pu.y + pu.height / 2 - hero.y;
			if( pdx * pdx + pdy * pdy < gd ) { gd = pdx * pdx + pdy * pdy; grab = pu; }
		}
		if( grab ) { tx = ( hero.x + grab.x + grab.width / 2 ) / 2; ty = ( hero.y + grab.y + grab.height / 2 ) / 2; k = 14; }
		else { tx = hero.x - fy * 20 * rig.step - fx * 16; ty = hero.y + fx * 20 * rig.step - fy * 16; k = 10; }
		face = hero.direction + Math.PI / 2;
	} else if( id === 'drone_embermoth' ) {
		// flutters in loose loops behind
		tx = hero.x - fx * 26 + Math.cos( rig.t * 2.6 ) * 12; ty = hero.y - fy * 26 + Math.sin( rig.t * 3.9 ) * 10; k = 7;
	} else if( id === 'drone_mirrorbat' ) {
		// hangs back off the left wing; darts to where it just blocked a bolt
		if( rig.dart > 0 ) { rig.dart -= s; tx = rig.dx; ty = rig.dy; k = 30; }
		else { tx = hero.x - fx * 18 + fy * 20; ty = hero.y - fy * 18 - fx * 20; k = 8; }
		face = hero.direction + Math.PI / 2;
	} else if( id === 'drone_decoygecko' ) {
		// clings close to the left wing
		tx = hero.x + fy * 16 - fx * 3; ty = hero.y - fx * 16 - fy * 3; k = 22;
		face = hero.direction + Math.PI / 2;
	} else if( id === 'drone_scoutowl' ) {
		// high and ahead of the nose, sweeping left and right
		var sw = Math.sin( rig.t * 0.8 );
		tx = hero.x + fx * 40 - fy * sw * 22; ty = hero.y + fy * 40 + fx * sw * 22; k = 5;
		face = hero.direction + Math.PI / 2 + sw * 0.35;
	} else {
		// the crest rides ahead of the canopy, upright
		tx = hero.x + fx * 22; ty = hero.y + fy * 22 - 5; k = 12;
		face = 0;
	}
	var f = Math.min( 1, s * k ),
		nx = rig.x + ( tx - rig.x ) * f, ny = rig.y + ( ty - rig.y ) * f,
		mx = nx - rig.x, my = ny - rig.y;
	if( face === null ) {
		if( mx * mx + my * my > 0.04 ) { face = Math.atan2( my, mx ) + Math.PI / 2; }
		else { face = rig.dir; }
	}
	rig.dir = id === 'drone_aegis' ? face : droneTurn( rig.dir, face, s * 12 );
	rig.x = nx; rig.y = ny;

	// what each drone gives off while it works
	if( !$.reduceMotion ) {
		if( id === 'drone_medicwisp' && hero.life < 1 && $.fxRandom() < s * 3 ) {
			droneAddFx( { kind: 'mote', t: 0, life: 0.55, ox: rig.x - hero.x, oy: rig.y - hero.y } );
		}
		if( id === 'drone_frostsprite' || id === 'drone_embermoth' ) {
			// flakes off chilled enemies, embers off burning ones
			for( var ci = 0; ci < $.enemies.length; ci++ ) {
				var ce = $.enemies[ ci ];
				if( !ce.inView ) { continue; }
				if( ce.chill > 0 && $.fxRandom() < s * 6 ) { droneAddFx( { kind: 'flake', x: ce.x + $.fxRand( -8, 8 ), y: ce.y + $.fxRand( -6, 6 ), t: 0, life: 0.7 } ); }
				if( ce.burn && $.fxRandom() < s * 14 ) { droneAddFx( { kind: 'ember', x: ce.x + $.fxRand( -5, 5 ), y: ce.y + $.fxRand( -4, 4 ), t: 0, life: 0.5 } ); }
			}
		}
		if( id === 'drone_champion' && $.fxRandom() < s * 6 ) {
			droneAddFx( { kind: 'gold', x: rig.x + $.fxRand( -5, 5 ), y: rig.y + $.fxRand( -3, 3 ), t: 0, life: 0.8 } );
		}
	}

	for( var i = $.droneFx.length - 1; i >= 0; i-- ) {
		$.droneFx[ i ].t += s;
		if( $.droneFx[ i ].t >= $.droneFx[ i ].life ) { $.droneFx.splice( i, 1 ); }
	}
	if( rig.surge ) {
		rig.surge.t += s;
		if( rig.surge.t >= rig.surge.life ) { rig.surge = null; }
	}
	if( rig.label ) {
		rig.label.t += s;
		if( rig.label.t >= rig.label.life ) { rig.label = null; }
	}
	rig.surgeCool -= s;
	rig.hexCool -= s;
};

/*------------------------------------------------------------------------------
The hooks: the engine says an effect just happened, the drone shows it.
  hit    (angle)          Aegis soaked part of a collision from that side
  chain  (x1, y1, x2, y2) Volt Mite's shot jumped between two enemies
  pierce (x, y, angle)    Needle Finch's shot punched through an enemy
  kill   (x, y)           an enemy died (Champion's glint)
  block  (x, y)           Mirror Bat glanced a bolt off
  decoy  (x, y)           Decoy Gecko threw its hologram
  combo  (n)              the combo reached a multiple of 5
------------------------------------------------------------------------------*/
$.droneEvent = function( kind, a, b, c, e ) {
	var d = $.equippedDrone && $.equippedDrone(), rig = $.droneRig;
	if( !d || !rig || rig.id !== d.id || !$.hero || rig.hero !== $.hero ) { return; }
	var id = d.id;
	if( kind === 'hit' && id === 'drone_aegis' ) {
		// contact damage ticks every frame; one flash per beat reads better
		if( rig.hexCool > 0 ) { return; }
		rig.hexCool = 0.3;
		rig.side = a;
		droneAddFx( { kind: 'hex', ang: a, t: 0, life: 0.45 } );
	} else if( kind === 'chain' && id === 'drone_voltmite' ) {
		droneAddFx( { kind: 'arc', x1: a, y1: b, x2: c, y2: e, t: 0, life: 0.25 } );
		droneAddFx( { kind: 'arc', x1: rig.x, y1: rig.y, x2: a, y2: b, t: 0, life: 0.15, thin: 1 } );
	} else if( kind === 'pierce' && id === 'drone_needlefinch' ) {
		droneAddFx( { kind: 'needle', x: a, y: b, ang: c, t: 0, life: 0.3 } );
	} else if( kind === 'block' && id === 'drone_mirrorbat' ) {
		droneAddFx( { kind: 'mirror', x: a, y: b, t: 0, life: 0.4 } );
		rig.dart = 0.22; rig.dx = a; rig.dy = b;
	} else if( kind === 'decoy' && id === 'drone_decoygecko' ) {
		droneAddFx( { kind: 'holo', x: a, y: b, t: 0, life: 0.45 } );
	} else if( kind === 'kill' && id === 'drone_champion' ) {
		droneAddFx( { kind: 'glint', x: a, y: b, t: 0, life: 0.6 } );
	} else if( kind === 'combo' ) {
		// a long streak would fire a move every second; the cooldown keeps
		// each one an event
		if( rig.surgeCool > 0 ) { return; }
		rig.surgeCool = 4;
		rig.label = { t: 0, life: 1.4, n: a };
		if( $.reduceMotion ) { return; }
		rig.surge = { t: 0, life: 1.5 };
		if( id === 'drone_needlefinch' ) { rig.loop = 0; }
	}
};

function droneHexPath( ctx, cx, cy, r ) {
	ctx.beginPath();
	for( var k = 0; k < 6; k++ ) {
		var a = k / 6 * $.twopi + Math.PI / 6;
		k ? ctx.lineTo( cx + Math.cos( a ) * r, cy + Math.sin( a ) * r ) : ctx.moveTo( cx + Math.cos( a ) * r, cy + Math.sin( a ) * r );
	}
	ctx.closePath();
}
function droneHex( ctx, cx, cy, r ) {
	droneHexPath( ctx, cx, cy, r );
	ctx.stroke();
}

// a lightning line: rolls the cosmetic dice every frame, so it crackles.
// Returns the stroke, so the glow and the core pass trace the same bolt.
function droneZig( ctx, x1, y1, x2, y2, segs, amp ) {
	var pts = [ x1, y1 ];
	for( var i = 1; i < segs; i++ ) {
		var u = i / segs;
		pts.push( x1 + ( x2 - x1 ) * u + $.fxRand( -amp, amp ), y1 + ( y2 - y1 ) * u + $.fxRand( -amp, amp ) );
	}
	pts.push( x2, y2 );
	return function() {
		ctx.beginPath();
		ctx.moveTo( pts[ 0 ], pts[ 1 ] );
		for( var k = 2; k < pts.length; k += 2 ) { ctx.lineTo( pts[ k ], pts[ k + 1 ] ); }
		ctx.stroke();
	};
}

// a glow without shadowBlur (which costs a phone dearly per stroke): the
// same path stroked wide and faint, then thin and bright
function droneGlowStroke( ctx, path, color, core, w ) {
	ctx.strokeStyle = color;
	ctx.lineWidth = w * 3;
	var ga = ctx.globalAlpha;
	ctx.globalAlpha = ga * 0.3;
	path();
	ctx.globalAlpha = ga;
	ctx.strokeStyle = core || color;
	ctx.lineWidth = w;
	path();
}

// the visible world: the canvas offset by the camera
function droneScoutMarks( ctx ) {
	var vx0 = -$.screen.x, vy0 = -$.screen.y, vx1 = vx0 + $.cw, vy1 = vy0 + $.ch,
		cx = ( vx0 + vx1 ) / 2, cy = ( vy0 + vy1 ) / 2,
		hw = $.cw / 2 - 14, hh = $.ch / 2 - 14, RANGE = 420;
	function mark( x, y, hue ) {
		if( x > vx0 && x < vx1 && y > vy0 && y < vy1 ) { return; }
		var dx = x - cx, dy = y - cy,
			k = Math.min( hw / Math.max( 1e-6, Math.abs( dx ) ), hh / Math.max( 1e-6, Math.abs( dy ) ) ),
			out = Math.sqrt( dx * dx + dy * dy ) * ( 1 - k );
		if( out > RANGE ) { return; }
		ctx.save();
		ctx.translate( cx + dx * k, cy + dy * k ); ctx.rotate( Math.atan2( dy, dx ) );
		// brighter the closer it is
		ctx.globalAlpha = 0.35 + ( 1 - out / RANGE ) * 0.6;
		ctx.fillStyle = hue;
		ctx.beginPath(); ctx.moveTo( 7, 0 ); ctx.lineTo( -5, -5 ); ctx.lineTo( -2, 0 ); ctx.lineTo( -5, 5 ); ctx.closePath(); ctx.fill();
		ctx.restore();
	}
	for( var i = 0; i < $.enemies.length; i++ ) {
		var e = $.enemies[ i ];
		if( !e.isBolt ) { mark( e.x, e.y, e.isBoss ? 'hsla(0, 90%, 62%, 1)' : 'hsla(40, 100%, 68%, 1)' ); }
	}
	var objs = $.objects || [];
	for( var j = 0; j < objs.length; j++ ) { mark( objs[ j ].x, objs[ j ].y, 'hsla(200, 30%, 78%, 1)' ); }
}

/*==============================================================================
Pilot + drone sync

A combo move is the drone's (its shape: BLIZZARD's snowflakes, ECHO's rings)
painted in the pilot's colour, with the pilot's own flourish on top - so all
13 x 12 pairs look different. The hue is the pilot's test-fire colour in the
hangar bay (pilotMotion.ts), so a pilot reads the same in both places.
Drawing only, like the move itself; rolls only $.fxRandom.
==============================================================================*/
$.pilotSync = {
	onyix: { hue: 190, name: 'CHEVRONS' },
	nova: { hue: 200, name: 'AFTERIMAGES' },
	tankrex: { hue: 30, name: 'QUAKE' },
	astravane: { hue: 160, name: 'TAILWIND' },
	ironhalo: { hue: 210, name: 'HALO GEAR' },
	runepilot: { hue: 280, name: 'RUNE RING' },
	nebulafox: { hue: 300, name: 'TWIN TAILS' },
	javelin9: { hue: 55, name: 'LANCES' },
	atlasbeam: { hue: 45, name: 'CANNON' },
	glitchprince: { hue: 320, name: 'GLITCH' },
	solstice: { hue: 40, name: 'CORONA' },
	crimsonwisp: { hue: 8, name: 'WISPS' },
	voltrider: { hue: 270, name: 'NEON' }
};

function droneSyncFor( hero ) {
	return ( hero && hero.character && $.pilotSync[ hero.character.id ] ) || { hue: 190, name: '' };
}
function droneSyncColour( hero, l, a ) {
	return 'hsla(' + droneSyncFor( hero ).hue + ', 100%, ' + ( l || 64 ) + '%, ' + ( a == null ? 1 : a ) + ')';
}

// the pilot's flourish over a combo move, u = 0..1 through the move
function droneFlourish( ctx, hero, u ) {
	var id = hero.character && hero.character.id, x = hero.x, y = hero.y,
		dir = hero.direction, fx = Math.cos( dir ), fy = Math.sin( dir ),
		c = droneSyncColour( hero ), hot = droneSyncColour( hero, 86 ), k, a, r;
	ctx.save();
	ctx.globalCompositeOperation = 'lighter';
	ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = 2;
	if( id === 'onyix' ) {
		// three chevrons sweep forward off the nose
		for( k = 0; k < 3; k++ ) {
			var cu = Math.max( 0, Math.min( 1, u * 1.6 - k * 0.18 ) ), d = 20 + cu * 70;
			ctx.globalAlpha = Math.sin( cu * Math.PI ) * 0.9;
			ctx.save(); ctx.translate( x + fx * d, y + fy * d ); ctx.rotate( dir );
			ctx.beginPath(); ctx.moveTo( -6, -10 ); ctx.lineTo( 4, 0 ); ctx.lineTo( -6, 10 ); ctx.stroke();
			ctx.restore();
		}
	} else if( id === 'nova' ) {
		// four afterimages strung out behind, then a starburst
		for( k = 1; k <= 4; k++ ) {
			ctx.globalAlpha = ( 1 - u ) * ( 0.5 - k * 0.1 );
			ctx.save(); ctx.translate( x - fx * k * 14 * ( 0.4 + u ), y - fy * k * 14 * ( 0.4 + u ) ); ctx.rotate( dir );
			if( hero.character.draw ) { hero.character.draw( ctx, hero.radius, c, $.tick ); }
			ctx.restore();
		}
		ctx.globalAlpha = Math.max( 0, 1 - u * 2 ); ctx.strokeStyle = hot;
		ctx.beginPath();
		for( k = 0; k < 8; k++ ) { a = k / 8 * $.twopi; ctx.moveTo( x + Math.cos( a ) * 8, y + Math.sin( a ) * 8 ); ctx.lineTo( x + Math.cos( a ) * ( 14 + u * 30 ), y + Math.sin( a ) * ( 14 + u * 30 ) ); }
		ctx.stroke();
	} else if( id === 'tankrex' ) {
		// a heavy quake: one thick ring and cracks running out
		ctx.globalAlpha = ( 1 - u ) * 0.8; ctx.lineWidth = 5;
		ctx.beginPath(); ctx.arc( x, y, 16 + u * 60, 0, $.twopi ); ctx.stroke();
		ctx.lineWidth = 1.5; ctx.strokeStyle = hot;
		ctx.beginPath();
		for( k = 0; k < 7; k++ ) {
			a = k / 7 * $.twopi + 0.3; r = 14;
			ctx.moveTo( x + Math.cos( a ) * r, y + Math.sin( a ) * r );
			for( var seg = 1; seg <= 3; seg++ ) { r = 14 + seg * u * 18; a += ( seg % 2 ? 0.18 : -0.18 ); ctx.lineTo( x + Math.cos( a ) * r, y + Math.sin( a ) * r ); }
		}
		ctx.stroke();
	} else if( id === 'astravane' ) {
		// ribbons of wind spiralling round the hull
		ctx.globalAlpha = Math.sin( u * Math.PI ) * 0.85; ctx.lineWidth = 2.5;
		for( k = 0; k < 3; k++ ) {
			var base = k / 3 * $.twopi + u * 4;
			ctx.beginPath(); ctx.arc( x, y, 22 + k * 7 + u * 14, base, base + 1.4 ); ctx.stroke();
		}
	} else if( id === 'ironhalo' ) {
		// a heavy toothed ring turning over the hull
		ctx.globalAlpha = Math.sin( u * Math.PI ) * 0.9; ctx.lineWidth = 3;
		ctx.beginPath(); ctx.arc( x, y, 26, 0, $.twopi ); ctx.stroke();
		for( k = 0; k < 12; k++ ) {
			a = k / 12 * $.twopi + u * 2.2;
			ctx.fillRect( x + Math.cos( a ) * 26 - 2.5, y + Math.sin( a ) * 26 - 2.5, 5, 5 );
		}
	} else if( id === 'runepilot' ) {
		// a ring of runes, each a small glyph
		ctx.globalAlpha = Math.sin( u * Math.PI ); ctx.lineWidth = 1.5;
		for( k = 0; k < 8; k++ ) {
			a = k / 8 * $.twopi - u * 1.5; r = 30 + u * 10;
			ctx.save(); ctx.translate( x + Math.cos( a ) * r, y + Math.sin( a ) * r ); ctx.rotate( a );
			ctx.beginPath();
			if( k % 3 === 0 ) { ctx.moveTo( 0, -4 ); ctx.lineTo( 0, 4 ); ctx.moveTo( -3, -1 ); ctx.lineTo( 3, -4 ); }
			else if( k % 3 === 1 ) { ctx.moveTo( -3, 4 ); ctx.lineTo( 0, -4 ); ctx.lineTo( 3, 4 ); }
			else { ctx.moveTo( -3, -4 ); ctx.lineTo( 3, 0 ); ctx.lineTo( -3, 4 ); }
			ctx.stroke(); ctx.restore();
		}
	} else if( id === 'nebulafox' ) {
		// two fox tails sweep round behind the ship
		ctx.globalAlpha = Math.sin( u * Math.PI ) * 0.8; ctx.lineWidth = 6; ctx.lineCap = 'round';
		for( k = -1; k <= 1; k += 2 ) {
			var t0 = dir + Math.PI + k * ( 0.3 + u * 1.2 );
			ctx.beginPath(); ctx.arc( x, y, 26, t0 - k * 0.9, t0, k < 0 ); ctx.stroke();
		}
		ctx.lineCap = 'butt';
		for( k = 0; k < 6; k++ ) { ctx.fillStyle = hot; ctx.fillRect( x + $.fxRand( -34, 34 ), y + $.fxRand( -34, 34 ), 2, 2 ); }
	} else if( id === 'javelin9' ) {
		// lances thrown out along the heading
		ctx.lineWidth = 1.6; ctx.strokeStyle = hot;
		for( k = -2; k <= 2; k++ ) {
			var la = dir + k * 0.22, l0 = 14 + u * 120, l1 = l0 + 30;
			ctx.globalAlpha = 1 - u;
			ctx.beginPath(); ctx.moveTo( x + Math.cos( la ) * l0, y + Math.sin( la ) * l0 ); ctx.lineTo( x + Math.cos( la ) * l1, y + Math.sin( la ) * l1 ); ctx.stroke();
		}
	} else if( id === 'atlasbeam' ) {
		// a cannon beam fired straight off the nose
		ctx.globalAlpha = Math.max( 0, 1 - u * 1.4 ) * 0.6;
		ctx.save(); ctx.translate( x, y ); ctx.rotate( dir );
		ctx.fillRect( 12, -6 * ( 1 - u ), 200, 12 * ( 1 - u ) );
		ctx.fillStyle = hot; ctx.fillRect( 12, -2 * ( 1 - u ), 200, 4 * ( 1 - u ) );
		ctx.restore();
	} else if( id === 'glitchprince' ) {
		// glitch slices: offset bars flicker round the hull
		ctx.globalAlpha = ( 1 - u ) * 0.7;
		for( k = 0; k < 7; k++ ) {
			ctx.fillStyle = k % 2 ? c : 'hsla(185, 100%, 64%, 1)';
			ctx.fillRect( x + $.fxRand( -40, 20 ), y - 30 + k * 9, $.fxRand( 14, 40 ), 3 );
		}
	} else if( id === 'solstice' ) {
		// a corona: a sun disc with rays
		ctx.globalAlpha = Math.sin( u * Math.PI ) * 0.25;
		ctx.beginPath(); ctx.arc( x, y, 20 + u * 6, 0, $.twopi ); ctx.fill();
		ctx.globalAlpha = Math.sin( u * Math.PI ) * 0.9; ctx.strokeStyle = hot; ctx.lineWidth = 1.5;
		ctx.beginPath();
		for( k = 0; k < 16; k++ ) { a = k / 16 * $.twopi + u; r = k % 2 ? 34 : 44; ctx.moveTo( x + Math.cos( a ) * 26, y + Math.sin( a ) * 26 ); ctx.lineTo( x + Math.cos( a ) * ( r + u * 10 ), y + Math.sin( a ) * ( r + u * 10 ) ); }
		ctx.stroke();
	} else if( id === 'crimsonwisp' ) {
		// red wisps drift up off the hull
		for( k = 0; k < 6; k++ ) {
			a = k / 6 * $.twopi; var wy = y - u * 40 - ( k % 3 ) * 6, wx = x + Math.cos( a ) * ( 14 + u * 10 ) + Math.sin( u * 8 + k ) * 4;
			ctx.globalAlpha = ( 1 - u ) * 0.8;
			ctx.beginPath(); ctx.ellipse( wx, wy + Math.sin( a ) * 10, 3, 7, 0, 0, $.twopi ); ctx.fill();
		}
	} else if( id === 'voltrider' ) {
		// neon: two rings and speed lines streaking back
		ctx.globalAlpha = ( 1 - u ) * 0.9; ctx.lineWidth = 1.5;
		ctx.beginPath(); ctx.arc( x, y, 20 + u * 26, 0, $.twopi ); ctx.stroke();
		ctx.beginPath(); ctx.arc( x, y, 26 + u * 40, 0, $.twopi ); ctx.stroke();
		ctx.strokeStyle = hot;
		ctx.beginPath();
		for( k = -2; k <= 2; k++ ) { var ox = -fy * k * 7, oy = fx * k * 7; ctx.moveTo( x + ox - fx * 16, y + oy - fy * 16 ); ctx.lineTo( x + ox - fx * ( 30 + u * 50 ), y + oy - fy * ( 30 + u * 50 ) ); }
		ctx.stroke();
	}
	ctx.restore();
}

// under the hull: Grav Beetle's pull field, and the combo moves
$.renderDroneUnder = function( hero ) {
	var d = $.equippedDrone && $.equippedDrone(), rig = $.droneRig;
	if( !d || !rig || rig.hero !== hero || rig.id !== d.id ) { return; }
	var ctx = $.ctxmg, col = d.color, id = d.id;
	ctx.save();
	// effects are light: they add to what is under them
	ctx.globalCompositeOperation = 'lighter';
	if( id === 'drone_gravbeetle' && !$.reduceMotion ) {
		// rings creeping inward across the 220px pull
		ctx.strokeStyle = col;
		ctx.lineWidth = 1.5;
		for( var g = 0; g < 3; g++ ) {
			var gu = ( rig.t * 0.6 + g / 3 ) % 1;
			ctx.globalAlpha = gu * 0.16;
			ctx.beginPath(); ctx.arc( hero.x, hero.y, 220 * ( 1 - gu ) + 20, 0, $.twopi ); ctx.stroke();
		}
		// pulled enemies trail a faint drag line away from the ship
		ctx.lineWidth = 1;
		ctx.globalAlpha = 0.3;
		ctx.beginPath();
		for( var ei = 0; ei < $.enemies.length; ei++ ) {
			var en = $.enemies[ ei ];
			if( en.isBoss || !en.inView ) { continue; }
			var ex = en.x - hero.x, ey = en.y - hero.y, ed = Math.sqrt( ex * ex + ey * ey );
			if( ed < 1 || ed >= 220 ) { continue; }
			ctx.moveTo( en.x, en.y );
			ctx.lineTo( en.x + ex / ed * 18, en.y + ey / ed * 18 );
		}
		ctx.stroke();
	}
	// what the newer six show while they work
	var st = $.droneAbilityState;
	if( id === 'drone_frostsprite' || id === 'drone_embermoth' ) {
		for( var ci = 0; ci < $.enemies.length; ci++ ) {
			var ce = $.enemies[ ci ];
			if( !ce.inView ) { continue; }
			if( ce.chill > 0 ) {
				ctx.globalAlpha = Math.min( 1, ce.chill / 20 ) * 0.7;
				ctx.strokeStyle = 'hsla(195, 100%, 82%, 1)'; ctx.lineWidth = 1.2;
				droneHex( ctx, ce.x, ce.y, ce.radius + 5 );
			}
			if( ce.burn ) {
				ctx.globalAlpha = 0.28;
				ctx.fillStyle = 'hsla(22, 100%, 55%, 1)';
				ctx.beginPath(); ctx.arc( ce.x, ce.y, ce.radius + 3 + $.fxRand( 0, 2 ), 0, $.twopi ); ctx.fill();
			}
		}
	}
	if( id === 'drone_salvagecrab' ) {
		ctx.globalAlpha = 0.12;
		ctx.strokeStyle = col; ctx.lineWidth = 1;
		ctx.setLineDash( [ 4, 8 ] );
		ctx.beginPath(); ctx.arc( hero.x, hero.y, 120, 0, $.twopi ); ctx.stroke();
		ctx.globalAlpha = 0.75; ctx.setLineDash( [ 3, 3 ] );
		for( var pi = 0; pi < $.powerups.length; pi++ ) {
			var pu = $.powerups[ pi ];
			if( !pu.pulled ) { continue; }
			ctx.beginPath(); ctx.moveTo( rig.x, rig.y ); ctx.lineTo( pu.x + pu.width / 2, pu.y + pu.height / 2 ); ctx.stroke();
		}
		ctx.setLineDash( [] );
	}
	if( id === 'drone_decoygecko' && st && st.decoy && st.hero === hero ) {
		var dc = st.decoy, fade = Math.min( 1, dc.life / 20, ( dc.max - dc.life ) / 8 + 0.2 );
		// the enemies it is drawing, tied to it by a dashed line
		ctx.globalAlpha = 0.35 * fade; ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.setLineDash( [ 2, 4 ] );
		ctx.beginPath();
		for( var li = 0; li < $.enemies.length; li++ ) {
			var le = $.enemies[ li ];
			if( $.droneLure( le ) ) { ctx.moveTo( le.x, le.y ); ctx.lineTo( dc.x, dc.y ); }
		}
		ctx.stroke(); ctx.setLineDash( [] );
		// the hologram: the pilot's own airframe, flickering
		ctx.save();
		ctx.globalAlpha = fade * ( 0.45 + $.fxRandom() * 0.3 );
		ctx.translate( dc.x, dc.y ); ctx.rotate( dc.dir );
		if( hero.character && hero.character.draw ) { hero.character.draw( ctx, hero.radius, 'hsla(165, 100%, 70%, 0.6)', $.tick ); }
		ctx.restore();
	}
	var sg = rig.surge;
	if( sg ) {
		var u = Math.min( 1, sg.t / sg.life ), x = hero.x, y = hero.y,
			// the pilot's colour glows round the drone's move
			sync = droneSyncColour( hero );
		if( id === 'drone_aegis' ) {
			// BULWARK: a hex bubble closes round the ship, then fades
			ctx.globalAlpha = Math.sin( u * Math.PI ) * 0.85;
			for( var ring = 0; ring < 2; ring++ ) {
				for( var hk = 0; hk < 12; hk++ ) {
					var ha = hk / 12 * $.twopi + ring * 0.26 + u, hr = 30 + ring * 11;
					droneGlowStroke( ctx, droneHex.bind( null, ctx, x + Math.cos( ha ) * hr, y + Math.sin( ha ) * hr, 6 ), sync, col, 1.2 );
				}
			}
		} else if( id === 'drone_voltmite' ) {
			// STORM CROWN: six arcs crackle out in a ring
			ctx.globalAlpha = 1 - u;
			for( var sv = 0; sv < 6; sv++ ) {
				var b = sv / 6 * $.twopi + u * 2, r1 = 18, r2 = 40 + u * 26;
				droneGlowStroke( ctx, droneZig( ctx, x + Math.cos( b ) * r1, y + Math.sin( b ) * r1, x + Math.cos( b ) * r2, y + Math.sin( b ) * r2, 5, 4 ), sync, '#fffbe0', 1.6 );
			}
		} else if( id === 'drone_needlefinch' ) {
			// STRAFE: the loop leaves a ring of streak behind the finch
			ctx.globalAlpha = ( 1 - u ) * 0.8;
			droneGlowStroke( ctx, function() { ctx.beginPath(); ctx.arc( x, y, 46, 0, Math.min( 1, u / 0.6 ) * $.twopi ); ctx.stroke(); }, sync, col, 2.2 );
		} else if( id === 'drone_gravbeetle' ) {
			// COLLAPSE: rings rush inward, then a violet bloom
			if( u < 0.55 ) {
				for( var gr = 0; gr < 4; gr++ ) {
					var cu = ( u / 0.55 + gr / 4 ) % 1;
					ctx.globalAlpha = cu * 0.7;
					droneGlowStroke( ctx, function( rr ) { return function() { ctx.beginPath(); ctx.arc( x, y, rr, 0, $.twopi ); ctx.stroke(); }; }( 180 * ( 1 - cu ) + 10 ), sync, col, 1.6 );
				}
			} else {
				var bu = ( u - 0.55 ) / 0.45;
				ctx.globalAlpha = ( 1 - bu ) * 0.45;
				ctx.fillStyle = col;
				ctx.beginPath(); ctx.arc( x, y, 18 + bu * 100, 0, $.twopi ); ctx.fill();
			}
		} else if( id === 'drone_medicwisp' ) {
			// BLOOM: petals open round the hull, a halo above it
			ctx.globalAlpha = Math.sin( u * Math.PI ) * 0.9;
			ctx.fillStyle = 'hsla(145, 100%, 74%, 1)';
			for( var p = 0; p < 8; p++ ) {
				var pa = p / 8 * $.twopi + u, pr = 20 + u * 22;
				ctx.beginPath(); ctx.ellipse( x + Math.cos( pa ) * pr, y + Math.sin( pa ) * pr, 6, 2.6, pa, 0, $.twopi ); ctx.fill();
			}
			ctx.strokeStyle = 'hsla(140, 100%, 88%, 1)';
			ctx.lineWidth = 1.6;
			ctx.beginPath(); ctx.ellipse( x, y - 20, 12, 3.5, 0, 0, $.twopi ); ctx.stroke();
		} else if( id === 'drone_frostsprite' ) {
			// BLIZZARD: a spiral of snowflakes whirls out
			ctx.globalAlpha = 1 - u; ctx.strokeStyle = 'hsla(195, 100%, 90%, 1)'; ctx.lineWidth = 1.2;
			for( var fl = 0; fl < 16; fl++ ) {
				var fa = fl / 16 * $.twopi + u * 3, fr = 16 + u * 80 * ( 0.6 + ( fl % 4 ) * 0.13 ), fx2 = x + Math.cos( fa ) * fr, fy2 = y + Math.sin( fa ) * fr, fz = 3 + fl % 3;
				ctx.beginPath();
				for( var sp = 0; sp < 6; sp++ ) { var spa = u * 4 + fl + sp / 6 * $.twopi; ctx.moveTo( fx2, fy2 ); ctx.lineTo( fx2 + Math.cos( spa ) * fz, fy2 + Math.sin( spa ) * fz ); }
				ctx.stroke();
			}
		} else if( id === 'drone_salvagecrab' ) {
			// HAUL: the magnet throws out a pulse of rings
			ctx.setLineDash( [ 6, 5 ] );
			for( var hr = 0; hr < 3; hr++ ) {
				var hu = ( u * 1.6 + hr / 3 ) % 1;
				ctx.globalAlpha = ( 1 - hu ) * ( 1 - u );
				droneGlowStroke( ctx, function( rr ) { return function() { ctx.beginPath(); ctx.arc( x, y, rr, 0, $.twopi ); ctx.stroke(); }; }( 18 + hu * 100 ), sync, col, 1.6 );
			}
			ctx.setLineDash( [] );
		} else if( id === 'drone_embermoth' ) {
			// WILDFIRE: petals of flame spiral out
			ctx.globalAlpha = Math.sin( u * Math.PI ) * 0.9;
			for( var wp = 0; wp < 10; wp++ ) {
				var wa = wp / 10 * $.twopi + u * 2.4, wr = 14 + u * 52;
				ctx.fillStyle = wp % 2 ? 'hsla(20, 100%, 55%, 1)' : 'hsla(40, 100%, 62%, 1)';
				ctx.beginPath(); ctx.ellipse( x + Math.cos( wa ) * wr, y + Math.sin( wa ) * wr, 8, 3, wa + 0.9, 0, $.twopi ); ctx.fill();
			}
		} else if( id === 'drone_mirrorbat' ) {
			// ECHO: sonar rings roll out, glinting with mirror shards
			ctx.strokeStyle = 'hsla(210, 60%, 92%, 1)'; ctx.fillStyle = 'hsla(210, 60%, 96%, 1)'; ctx.lineWidth = 1.4;
			for( var er = 0; er < 3; er++ ) {
				var eu = Math.max( 0, u - er * 0.15 ) / ( 1 - er * 0.15 );
				if( eu <= 0 ) { continue; }
				var erad = 16 + eu * 104;
				ctx.globalAlpha = ( 1 - eu ) * 0.8;
				ctx.beginPath(); ctx.arc( x, y, erad, 0, $.twopi ); ctx.stroke();
				for( var sd = 0; sd < 6; sd++ ) {
					var sa = sd / 6 * $.twopi + er, sx = x + Math.cos( sa ) * erad, sy = y + Math.sin( sa ) * erad;
					ctx.beginPath(); ctx.moveTo( sx, sy - 3.5 ); ctx.lineTo( sx + 2.2, sy + 2 ); ctx.lineTo( sx - 2.2, sy + 2 ); ctx.closePath(); ctx.fill();
				}
			}
		} else if( id === 'drone_decoygecko' ) {
			// MIRAGE: three ghost ships fan out from yours and fade
			for( var mg = -1; mg <= 1; mg++ ) {
				var ma = hero.direction + Math.PI + mg * 0.7, mr = u * 60;
				ctx.save();
				ctx.globalAlpha = ( 1 - u ) * 0.6;
				ctx.translate( x + Math.cos( ma ) * mr, y + Math.sin( ma ) * mr ); ctx.rotate( hero.direction );
				if( hero.character && hero.character.draw ) { hero.character.draw( ctx, hero.radius, 'hsla(165, 100%, 70%, 0.6)', $.tick ); }
				ctx.restore();
			}
		} else if( id === 'drone_scoutowl' ) {
			// NIGHT SIGHT: a radar sweep turns round the ship and brackets every enemy
			var sweep = u * $.twopi * 1.2 - Math.PI / 2;
			ctx.globalAlpha = ( 1 - u ) * 0.22; ctx.fillStyle = col;
			ctx.beginPath(); ctx.moveTo( x, y ); ctx.arc( x, y, 160, sweep - 0.5, sweep ); ctx.closePath(); ctx.fill();
			ctx.globalAlpha = 1 - u; ctx.strokeStyle = 'hsla(40, 100%, 80%, 1)'; ctx.lineWidth = 1.2;
			ctx.beginPath(); ctx.moveTo( x, y ); ctx.lineTo( x + Math.cos( sweep ) * 160, y + Math.sin( sweep ) * 160 );
			for( var bi = 0; bi < $.enemies.length; bi++ ) {
				var be = $.enemies[ bi ];
				if( be.isBolt || !be.inView ) { continue; }
				var bq = be.radius + 5;
				ctx.moveTo( be.x - bq, be.y - bq + 4 ); ctx.lineTo( be.x - bq, be.y - bq ); ctx.lineTo( be.x - bq + 4, be.y - bq );
				ctx.moveTo( be.x + bq, be.y + bq - 4 ); ctx.lineTo( be.x + bq, be.y + bq ); ctx.lineTo( be.x + bq - 4, be.y + bq );
			}
			ctx.stroke();
		} else {
			// CROWNED: gold rays burst from the ship
			ctx.globalAlpha = ( 1 - u ) * 0.9;
			for( var ry = 0; ry < 12; ry++ ) {
				var ra = ry / 12 * $.twopi, c1 = Math.cos( ra ), s1 = Math.sin( ra );
				droneGlowStroke( ctx, function( c, sn ) { return function() { ctx.beginPath(); ctx.moveTo( x + c * ( 18 + u * 16 ), y + sn * ( 18 + u * 16 ) ); ctx.lineTo( x + c * ( 34 + u * 56 ), y + sn * ( 34 + u * 56 ) ); ctx.stroke(); }; }( c1, s1 ), 'hsla(42, 100%, 60%, 1)', 'hsla(48, 100%, 80%, 1)', 2 );
			}
		}
		// ...and the pilot adds its own flourish: every pilot + drone pair differs
		droneFlourish( ctx, hero, u );
	}
	ctx.restore();
};

// over the hull: the drone itself, what it just did, and the move's name
$.renderDrone = function( hero ) {
	var d = $.equippedDrone && $.equippedDrone();
	if( !d || !d.draw ) { return; }
	var rig = droneRigFor( hero, d ), ctx = $.ctxmg, col = d.color || 'hsla(190, 100%, 70%, 0.95)', id = d.id;

	ctx.save();
	ctx.translate( rig.x, rig.y );
	if( rig.surge && !$.reduceMotion ) {
		var flare = 1 + Math.sin( Math.min( 1, rig.surge.t / rig.surge.life ) * Math.PI ) * 0.25;
		ctx.scale( flare, flare );
	}
	var sprites = $.objectSprites;
	if( !( sprites && $.storage.gfx3d !== 0 && sprites.draw( ctx, { kind: id, id: 0, rotation: rig.dir, radius: $.droneFlightRadius } ) ) ) {
		// no baked model (3D off, no WebGL, or not baked yet): the flat drone
		d.draw( ctx, 7, col, $.tick );
	}
	ctx.restore();

	ctx.save();
	ctx.globalCompositeOperation = 'lighter';
	for( var i = 0; i < $.droneFx.length; i++ ) {
		var f = $.droneFx[ i ], u = f.t / f.life;
		if( f.kind === 'hex' ) {
			// the shield soaking the hit, right where it landed
			ctx.globalAlpha = ( 1 - u ) * 0.9;
			for( var h = -1; h <= 1; h++ ) {
				var a = f.ang + h * 0.32;
				droneGlowStroke( ctx, droneHex.bind( null, ctx, hero.x + Math.cos( a ) * ( hero.radius + 10 ), hero.y + Math.sin( a ) * ( hero.radius + 10 ), 6 ), col, null, 1.6 );
			}
		} else if( f.kind === 'arc' ) {
			ctx.globalAlpha = 1 - u;
			droneGlowStroke( ctx, droneZig( ctx, f.x1, f.y1, f.x2, f.y2, 7, f.thin ? 2.5 : 5 ), col, '#fffbe0', f.thin ? 0.9 : 1.8 );
		} else if( f.kind === 'needle' ) {
			ctx.globalAlpha = 1 - u;
			var cx = Math.cos( f.ang ), sy = Math.sin( f.ang );
			droneGlowStroke( ctx, function() { ctx.beginPath(); ctx.moveTo( f.x - cx * 22, f.y - sy * 22 ); ctx.lineTo( f.x + cx * 30, f.y + sy * 30 ); ctx.stroke(); }, col, 'hsla(24, 100%, 84%, 1)', 1.6 );
		} else if( f.kind === 'mote' ) {
			// healing motes flowing from the wisp into the hull
			var mx = hero.x + f.ox * ( 1 - u ), my = hero.y + f.oy * ( 1 - u );
			ctx.globalAlpha = 0.9;
			ctx.fillStyle = 'hsla(145, 100%, 80%, 1)';
			ctx.beginPath(); ctx.arc( mx, my, 2, 0, $.twopi ); ctx.fill();
			if( u > 0.8 ) {
				ctx.globalAlpha = ( 1 - u ) * 5;
				ctx.beginPath();
				$.text( { ctx: ctx, x: hero.x + 9, y: hero.y - 12 - ( u - 0.8 ) * 30, text: '+', hspacing: 1, vspacing: 0, halign: 'center', valign: 'center', scale: 1, snap: 0, render: 1 } );
				ctx.fill();
			}
		} else if( f.kind === 'gold' || f.kind === 'glint' ) {
			ctx.globalAlpha = 1 - u;
			ctx.fillStyle = 'hsla(46, 100%, 76%, 1)';
			var gy = f.kind === 'gold' ? f.y + u * 12 : f.y, gr = f.kind === 'glint' ? 3 + u * 5 : 1.4;
			ctx.beginPath();
			ctx.moveTo( f.x, gy - gr * 2 ); ctx.lineTo( f.x + gr * 0.5, gy ); ctx.lineTo( f.x, gy + gr * 2 ); ctx.lineTo( f.x - gr * 0.5, gy );
			ctx.closePath(); ctx.fill();
			if( f.kind === 'glint' ) {
				ctx.beginPath();
				ctx.moveTo( f.x - gr * 2, gy ); ctx.lineTo( f.x, gy + gr * 0.5 ); ctx.lineTo( f.x + gr * 2, gy ); ctx.lineTo( f.x, gy - gr * 0.5 );
				ctx.closePath(); ctx.fill();
			}
		}
	}
	for( var j = 0; j < $.droneFx.length; j++ ) {
		var g = $.droneFx[ j ], v = g.t / g.life;
		if( g.kind === 'flake' ) {
			ctx.globalAlpha = 1 - v; ctx.strokeStyle = 'hsla(195, 100%, 92%, 1)'; ctx.lineWidth = 1;
			ctx.beginPath();
			for( var fk = 0; fk < 3; fk++ ) { var fa2 = v * 3 + fk * Math.PI / 3; ctx.moveTo( g.x - Math.cos( fa2 ) * 2.5, g.y + v * 10 - Math.sin( fa2 ) * 2.5 ); ctx.lineTo( g.x + Math.cos( fa2 ) * 2.5, g.y + v * 10 + Math.sin( fa2 ) * 2.5 ); }
			ctx.stroke();
		} else if( g.kind === 'ember' ) {
			ctx.globalAlpha = 1 - v; ctx.fillStyle = v < 0.4 ? 'hsla(38, 100%, 72%, 1)' : 'hsla(20, 100%, 56%, 1)';
			ctx.beginPath(); ctx.arc( g.x, g.y - v * 14, 1.5, 0, $.twopi ); ctx.fill();
		} else if( g.kind === 'mirror' ) {
			// the bolt glancing off the wing
			ctx.globalAlpha = 1 - v; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.8;
			ctx.beginPath();
			for( var mk = 0; mk < 4; mk++ ) { var mka = mk / 4 * $.twopi + 0.4; ctx.moveTo( g.x + Math.cos( mka ) * 3, g.y + Math.sin( mka ) * 3 ); ctx.lineTo( g.x + Math.cos( mka ) * ( 8 + v * 12 ), g.y + Math.sin( mka ) * ( 8 + v * 12 ) ); }
			ctx.stroke();
		} else if( g.kind === 'holo' ) {
			ctx.globalAlpha = 1 - v; ctx.strokeStyle = col; ctx.lineWidth = 1.5;
			ctx.beginPath(); ctx.arc( g.x, g.y, 6 + v * 24, 0, $.twopi ); ctx.stroke();
		}
	}
	// Mirror Bat: a ring round it fills as it recharges
	var ab = $.droneAbilityState;
	if( id === 'drone_mirrorbat' && ab && ab.hero === hero ) {
		var ready = 1 - Math.max( 0, ab.blockCool ) / 480;
		ctx.globalAlpha = ready >= 1 ? 0.8 : 0.4; ctx.strokeStyle = col; ctx.lineWidth = 1.2;
		ctx.beginPath(); ctx.arc( rig.x, rig.y, 14, -Math.PI / 2, -Math.PI / 2 + ready * $.twopi ); ctx.stroke();
	}
	// Scout Owl: arrows at the screen edge for what is just off it
	if( id === 'drone_scoutowl' ) { droneScoutMarks( ctx ); }
	// the move's name, rising off the ship
	ctx.globalCompositeOperation = 'source-over';
	if( rig.label && $.droneMoves[ id ] ) {
		var lu = rig.label.t / rig.label.life;
		ctx.globalAlpha = lu < 0.7 ? 1 : ( 1 - lu ) / 0.3;
		ctx.fillStyle = id === 'drone_champion' ? 'hsla(46, 100%, 66%, 1)' : col;
		ctx.beginPath();
		$.text( { ctx: ctx, x: hero.x, y: hero.y - hero.radius - 22 - lu * 10, text: $.droneMoves[ id ], hspacing: 1, vspacing: 0, halign: 'center', valign: 'center', scale: 2, snap: 0, render: 1 } );
		ctx.fill();
		// and which pilot flew it with: the pair's own name, in the pilot's colour
		var syncName = droneSyncFor( hero ).name;
		if( syncName ) {
			ctx.fillStyle = droneSyncColour( hero, 72 );
			ctx.beginPath();
			$.text( { ctx: ctx, x: hero.x, y: hero.y - hero.radius - 10 - lu * 10, text: '+ ' + syncName, hspacing: 1, vspacing: 0, halign: 'center', valign: 'center', scale: 1, snap: 0, render: 1 } );
			ctx.fill();
		}
	}
	ctx.restore();
};
