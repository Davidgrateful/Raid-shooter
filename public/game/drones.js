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
	drone_champion: 'CROWNED'
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
			ang: 0, side: null, hop: 0, tx: 30, ty: 0, loop: -1,
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
	var sg = rig.surge;
	if( sg ) {
		var u = Math.min( 1, sg.t / sg.life ), x = hero.x, y = hero.y;
		if( id === 'drone_aegis' ) {
			// BULWARK: a hex bubble closes round the ship, then fades
			ctx.globalAlpha = Math.sin( u * Math.PI ) * 0.85;
			for( var ring = 0; ring < 2; ring++ ) {
				for( var hk = 0; hk < 12; hk++ ) {
					var ha = hk / 12 * $.twopi + ring * 0.26 + u, hr = 30 + ring * 11;
					droneGlowStroke( ctx, droneHex.bind( null, ctx, x + Math.cos( ha ) * hr, y + Math.sin( ha ) * hr, 6 ), col, null, 1.2 );
				}
			}
		} else if( id === 'drone_voltmite' ) {
			// STORM CROWN: six arcs crackle out in a ring
			ctx.globalAlpha = 1 - u;
			for( var sv = 0; sv < 6; sv++ ) {
				var b = sv / 6 * $.twopi + u * 2, r1 = 18, r2 = 40 + u * 26;
				droneGlowStroke( ctx, droneZig( ctx, x + Math.cos( b ) * r1, y + Math.sin( b ) * r1, x + Math.cos( b ) * r2, y + Math.sin( b ) * r2, 5, 4 ), col, '#fffbe0', 1.6 );
			}
		} else if( id === 'drone_needlefinch' ) {
			// STRAFE: the loop leaves a ring of streak behind the finch
			ctx.globalAlpha = ( 1 - u ) * 0.8;
			droneGlowStroke( ctx, function() { ctx.beginPath(); ctx.arc( x, y, 46, 0, Math.min( 1, u / 0.6 ) * $.twopi ); ctx.stroke(); }, col, null, 2.2 );
		} else if( id === 'drone_gravbeetle' ) {
			// COLLAPSE: rings rush inward, then a violet bloom
			if( u < 0.55 ) {
				for( var gr = 0; gr < 4; gr++ ) {
					var cu = ( u / 0.55 + gr / 4 ) % 1;
					ctx.globalAlpha = cu * 0.7;
					droneGlowStroke( ctx, function( rr ) { return function() { ctx.beginPath(); ctx.arc( x, y, rr, 0, $.twopi ); ctx.stroke(); }; }( 180 * ( 1 - cu ) + 10 ), col, null, 1.6 );
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
		} else {
			// CROWNED: gold rays burst from the ship
			ctx.globalAlpha = ( 1 - u ) * 0.9;
			for( var ry = 0; ry < 12; ry++ ) {
				var ra = ry / 12 * $.twopi, c1 = Math.cos( ra ), s1 = Math.sin( ra );
				droneGlowStroke( ctx, function( c, sn ) { return function() { ctx.beginPath(); ctx.moveTo( x + c * ( 18 + u * 16 ), y + sn * ( 18 + u * 16 ) ); ctx.lineTo( x + c * ( 34 + u * 56 ), y + sn * ( 34 + u * 56 ) ); ctx.stroke(); }; }( c1, s1 ), 'hsla(42, 100%, 60%, 1)', 'hsla(48, 100%, 80%, 1)', 2 );
			}
		}
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
	// the move's name, rising off the ship
	ctx.globalCompositeOperation = 'source-over';
	if( rig.label && $.droneMoves[ id ] ) {
		var lu = rig.label.t / rig.label.life;
		ctx.globalAlpha = lu < 0.7 ? 1 : ( 1 - lu ) / 0.3;
		ctx.fillStyle = id === 'drone_champion' ? 'hsla(46, 100%, 66%, 1)' : col;
		ctx.beginPath();
		$.text( { ctx: ctx, x: hero.x, y: hero.y - hero.radius - 22 - lu * 10, text: $.droneMoves[ id ], hspacing: 1, vspacing: 0, halign: 'center', valign: 'center', scale: 2, snap: 0, render: 1 } );
		ctx.fill();
	}
	ctx.restore();
};
