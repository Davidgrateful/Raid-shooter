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
		id: 'drone_aegis', title: 'AEGIS HALO', desc: 'REDUCES COLLISION DAMAGE', xpBonus: 0.10,
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
		id: 'drone_voltmite', title: 'VOLT MITE', desc: 'SHOTS CHAIN TO A NEARBY ENEMY', xpBonus: 0.15,
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
		id: 'drone_needlefinch', title: 'NEEDLE FINCH', desc: 'BULLETS PIERCE ENEMIES', xpBonus: 0.15,
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
		id: 'drone_gravbeetle', title: 'GRAV BEETLE', desc: 'PULLS NEARBY ENEMIES INWARD', xpBonus: 0.20,
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
		id: 'drone_medicwisp', title: 'MEDIC WISP', desc: 'SLOWLY REGENERATES HULL', xpBonus: 0.10,
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
		id: 'drone_champion', title: 'CHAMPION CREST', desc: 'WINNERS-ONLY COSMETIC CREST', xpBonus: 0.25,
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
	fetch( '/api/consumable/use', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify( { itemId: 'consumable_xpboost' } )
	} ).catch( function() {} );
};
