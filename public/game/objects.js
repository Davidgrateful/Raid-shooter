/*==============================================================================
Objects - the arena is full of solid things

What used to be drifting background wreckage is now real: every object has a
body, a hull, and a reason to be shot (or avoided).

  rock       splits into two smaller rocks when it breaks
  crate      cargo - breaking one drops a power-up
  fuel       a red canister: blows up and wrecks enemies around it (and
             you, if you're too close - the stripes blink once it's hit)
  satellite  tough, worth the most to break
  ice        brittle, shatters into glittering shards
  mine       proximity mine: arms and blinks when anything comes close,
             then detonates. Shoot it from range to clear it safely
  crystal    shatters into shards that fly out and hit enemies

All of them:
  - stop your bullets and enemy fire alike (cover, both ways)
  - push the plane and enemies out (no contact damage - they are solid,
    not hostile; mines and fuel are the exceptions, by exploding)
  - get smashed by a boss that flies into them, sucked into a black hole,
    burnt by a flare or a pulsar beam, and hit by meteors
  - pay a small score when YOU break them (never kills / level progress)

Each sector has its own mix (more mines in the MINEFIELD, crystals in the
CRYSTAL FIELD...). Broken objects are replaced off screen after a while, so
the arena never empties.

Randomness: objects are gameplay, so they roll their own seeded dice
($.objRandom) - never Math.random, which would shift a seeded raid's waves,
and never $.fxRandom, which differs between two pilots on the same seed.
==============================================================================*/
( function() {
	var TWO_PI = Math.PI * 2,
		LIGHT_A = Math.atan2( -0.65, -0.55 );

	function hsla( h, s, l, a ) { return 'hsla(' + h + ', ' + s + '%, ' + l + '%, ' + a + ')'; }

	// mulberry32 - its own stream, so object spawns never touch Math.random
	function stream( seed ) {
		var s = seed >>> 0;
		return function() {
			s = ( s + 0x6D2B79F5 ) >>> 0;
			var t = Math.imul( s ^ ( s >>> 15 ), 1 | s );
			t = ( t + Math.imul( t ^ ( t >>> 7 ), 61 | t ) ) ^ t;
			return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;
		};
	}
	$.objRng = null;
	// a seeded run gets a seeded object stream; a normal run a fresh one
	$.reseedObjects = function( seed ) {
		$.objRng = stream( seed === undefined ? Math.floor( $.fxRandom() * 4294967296 ) : ( seed ^ 0x5bd1e995 ) );
	};
	$.objRandom = function() {
		if( !$.objRng ) { $.reseedObjects(); }
		return $.objRng();
	};
	function rnd( a, b ) { return a + $.objRandom() * ( b - a ); }

	/*--------------------------------------------------------------------------
	Kinds. r = radius range, life in bullet damage, value = score when YOU
	break it.
	--------------------------------------------------------------------------*/
	var KINDS = {
		rock: { r: [ 20, 40 ], life: 3, value: 10, hue: 28 },
		crate: { r: [ 15, 19 ], life: 3, value: 25, hue: 35 },
		fuel: { r: [ 12, 15 ], life: 2, value: 20, hue: 5, blast: 125 },
		satellite: { r: [ 18, 24 ], life: 6, value: 50, hue: 200 },
		ice: { r: [ 16, 32 ], life: 2, value: 10, hue: 195 },
		mine: { r: [ 11, 12 ], life: 1, value: 15, hue: 0, blast: 105, fuse: 50, sense: 95 },
		crystal: { r: [ 20, 34 ], life: 4, value: 30, hue: 285, shards: 7 }
	};
	$.objectKinds = KINDS;

	// what each sector's arena is made of (weights)
	var MIX = {
		none: { rock: 3, crate: 2, satellite: 1, fuel: 1 },
		asteroids: { rock: 6, ice: 2, crate: 1 },
		blackhole: { rock: 3, crate: 2, fuel: 1, satellite: 1 },
		flares: { fuel: 3, rock: 2, crate: 1 },
		ion: { satellite: 3, crate: 2, ice: 1 },
		wrecks: { crate: 4, fuel: 2, rock: 1 },
		pulsar: { ice: 4, rock: 2, satellite: 1 },
		mines: { mine: 7, crate: 1, rock: 1 },
		meteors: { rock: 4, ice: 2, crate: 1 },
		crystals: { crystal: 6, ice: 2 }
	};
	$.sectorObjectMix = MIX;

	function pickKind( key ) {
		var mix = MIX[ key || 'none' ] || MIX.none, total = 0, k;
		for( k in mix ) { total += mix[ k ]; }
		var roll = $.objRandom() * total;
		for( k in mix ) { roll -= mix[ k ]; if( roll <= 0 ) { return k; } }
		return 'rock';
	}

	function make( kind, x, y, radius ) {
		var def = KINDS[ kind ], pts = [];
		for( var p = 0; p < 9; p++ ) { pts.push( rnd( 0.78, 1.18 ) ); }
		var r = radius || rnd( def.r[ 0 ], def.r[ 1 ] );
		return {
			kind: kind, x: x, y: y,
			vx: rnd( -0.3, 0.3 ), vy: rnd( -0.3, 0.3 ),
			rotation: rnd( 0, TWO_PI ), rotationSpeed: rnd( -0.01, 0.01 ),
			radius: r,
			// bigger rocks take more to crack
			life: def.life * ( kind === 'rock' || kind === 'ice' || kind === 'crystal' ? r / def.r[ 1 ] + 0.4 : 1 ),
			lifeMax: 0, hit: 0, armed: 0, fuse: 0, points: pts, hue: def.hue, id: Math.floor( $.objRandom() * 1e9 )
		};
	}

	// how many objects fill an arena of this size. It used to be one per
	// 230,000 px2 (12-26), which left only 3-5 on a screen at once - too few
	// for cover or mine-baiting to matter. Now one per 150,000 px2 (18-40),
	// and the sectors built around their objects carry more of them.
	var DENSITY = { mines: 1.25, crystals: 1.2, meteors: 0.9, wrecks: 0.85 };
	function target() {
		var area = ( $.ww || 2000 ) * ( $.wh || 2000 ),
			mult = DENSITY[ ( $.sector && $.sector.hazard ) || '' ] || 1;
		return Math.max( 18, Math.min( 40, Math.round( area / 150000 * mult ) ) );
	}

	// a spot away from the plane (and, when respawning, off screen). Always
	// rolls the same number of candidates, so the object dice stay in step
	// for two pilots flying the same seed from different spots
	function placeFor( offscreen ) {
		var hx = $.hero ? $.hero.x : $.ww / 2, hy = $.hero ? $.hero.y : $.wh / 2, pick = null;
		for( var tries = 0; tries < 20; tries++ ) {
			var x = rnd( 60, $.ww - 60 ), y = rnd( 60, $.wh - 60 );
			if( pick ) { continue; }
			var far = ( x - hx ) * ( x - hx ) + ( y - hy ) * ( y - hy ) > 300 * 300,
				hidden = !offscreen || !$.util.arcInRect( x, y, 80, -$.screen.x, -$.screen.y, $.cw, $.ch );
			if( far && hidden || tries === 19 ) { pick = { x: x, y: y }; }
		}
		return pick;
	}

	$.objects = [];
	$.objectRespawns = [];

	// a new sector: a new arena (the old objects drift out with the warp)
	$.spawnObjects = function() {
		$.objects = [];
		$.objectRespawns = [];
		var key = $.sector && $.sector.hazard;
		var n = target();
		for( var i = 0; i < n; i++ ) {
			var at = placeFor( false ), o = make( pickKind( key ), at.x, at.y );
			o.lifeMax = o.life;
			$.objects.push( o );
		}
	};

	// an object placed by something in the fight (a MINE LAYER's mines, a
	// PRISM GIANT's crystals). `noRespawn` keeps it from queueing a
	// replacement when it breaks, so a boss cannot grow the arena's count.
	$.spawnObjectAt = function( kind, x, y, extra ) {
		if( !KINDS[ kind ] ) { return null; }
		var o = make( kind, Math.max( 30, Math.min( $.ww - 30, x ) ), Math.max( 30, Math.min( $.wh - 30, y ) ) );
		o.vx = 0; o.vy = 0;
		o.lifeMax = o.life;
		if( extra ) { for( var k in extra ) { o[ k ] = extra[ k ]; } }
		$.objects.push( o );
		return o;
	};

	/*--------------------------------------------------------------------------
	Breaking things
	--------------------------------------------------------------------------*/
	function blast( o, radius ) {
		$.explosions.push( new $.Explosion( { x: o.x, y: o.y, radius: radius * 0.7, hue: o.kind === 'mine' ? 0 : 20, saturation: 100 } ) );
		$.rumble.level = Math.max( $.rumble.level || 0, 6 );
		var ei = $.enemies.length;
		while( ei-- ) {
			var e = $.enemies[ ei ];
			if( !e || e.isBoss ) { continue; }
			var d = $.util.distance( o.x, o.y, e.x, e.y );
			if( d < radius + e.radius ) {
				if( e.isBolt ) { $.enemies.splice( ei, 1 ); continue; }
				e.receiveDamage( ei, 3 );
				if( o.kind === 'fuel' && o.byPlayer && $.achieve && e.life <= 0 ) { $.achieve( 'fuelKills', 1 ); }
			}
		}
		if( $.hero && $.hero.life > 0 && $.util.distance( o.x, o.y, $.hero.x, $.hero.y ) < radius + $.hero.radius ) {
			// a real hit, through the normal protections (dash, shield)
			if( $.hero.dashTick <= 0 && $.powerupTimers[ 5 ] <= 0 ) {
				$.hero.life -= 0.14 * $.hero.damageTakenMult;
				$.hero.takingDamage = 1;
				$.breakCombo();
				$.audio.play( 'takingDamage' );
			}
		}
		// chain reactions: other mines and fuel caught in the blast go up too
		for( var j = 0; j < $.objects.length; j++ ) {
			var other = $.objects[ j ];
			if( other !== o && ( other.kind === 'fuel' || other.kind === 'mine' ) && !other.chained &&
				$.util.distance( o.x, o.y, other.x, other.y ) < radius ) {
				other.chained = 1;
				other.life = 0;
				other.fuse = 0;
			}
		}
	}

	$.destroyObject = function( i, byPlayer ) {
		var o = $.objects[ i ];
		if( !o ) { return; }
		$.objects.splice( i, 1 );
		var def = KINDS[ o.kind ];
		if( o.kind !== 'mine' && o.kind !== 'fuel' ) {
			$.explosions.push( new $.Explosion( { x: o.x, y: o.y, radius: o.radius, hue: o.hue, saturation: o.kind === 'rock' ? 25 : 80 } ) );
		}
		$.particleEmitters.push( new $.ParticleEmitter( { x: o.x, y: o.y, count: 8, spawnRange: o.radius * 0.6, friction: 0.88, minSpeed: 2, maxSpeed: 9, minDirection: 0, maxDirection: TWO_PI, hue: o.hue, saturation: 60 } ) );
		if( def.blast ) { blast( o, def.blast ); }
		if( o.kind === 'rock' && o.radius > 24 ) {
			for( var s = 0; s < 2; s++ ) {
				var a = rnd( 0, TWO_PI ), child = make( 'rock', o.x + Math.cos( a ) * o.radius * 0.5, o.y + Math.sin( a ) * o.radius * 0.5, o.radius * 0.58 );
				child.vx = Math.cos( a ) * 1.2; child.vy = Math.sin( a ) * 1.2;
				child.lifeMax = child.life;
				$.objects.push( child );
			}
		}
		if( o.kind === 'crystal' && byPlayer ) {
			// the shards are YOUR fire: they fly out and hit enemies
			var w = $.hero.weapon.bullet;
			for( var k = 0; k < def.shards; k++ ) {
				var d = k / def.shards * TWO_PI + o.rotation;
				$.bullets.push( new $.Bullet( {
					x: o.x + Math.cos( d ) * o.radius, y: o.y + Math.sin( d ) * o.radius,
					speed: w.speed * 0.9, direction: d, damage: w.damage * 0.8,
					size: 10, lineWidth: 2, kind: 'shard', strokeStyle: 'hsla(285, 100%, 78%, 1)',
					range: 300, fromObject: 1
				} ) );
			}
		}
		if( o.kind === 'crate' && byPlayer ) {
			// cargo always holds a power-up. The type rolls the object dice,
			// not Math.random, so breaking crates never shifts a seeded raid
			var pu = $.definitions.powerups, min = $.hero.life < 0.9 ? 0 : 1,
				type = Math.min( pu.length - 1, Math.floor( rnd( min, pu.length ) ) ), params = pu[ type ];
			params.type = type; params.x = o.x; params.y = o.y;
			// the power-up's own drift rolls Math.random too: lend it the
			// object dice for the one construction
			var real = Math.random;
			Math.random = $.objRandom;
			try { $.powerups.push( new $.Powerup( params ) ); } finally { Math.random = real; }
		}
		if( byPlayer && $.achieve ) {
			if( o.kind === 'crate' ) { $.achieve( 'crates', 1 ); }
			if( o.kind === 'mine' ) { $.achieve( 'mines', 1 ); }
			if( o.kind === 'crystal' ) { $.achieve( 'crystals', 1 ); }
		}
		if( byPlayer ) {
			$.score += def.value;
			$.textPops.push( new $.TextPop( { x: o.x, y: o.y, value: def.value, hue: o.hue, saturation: 80, lightness: 60 } ) );
			$.audio.play( 'explosionAlt' );
		}
		// keep the arena full: a replacement drifts in later, off screen
		if( !o.noRespawn && ( o.radius > 15 || o.kind !== 'rock' ) ) {
			$.objectRespawns.push( { t: rnd( 300, 600 ) } );
		}
	};

	function hurt( i, amount, byPlayer ) {
		var o = $.objects[ i ];
		o.life -= amount;
		o.hit = 8;
		if( byPlayer ) { o.byPlayer = 1; }
		if( o.kind === 'fuel' || o.kind === 'mine' ) { o.armed = 1; }
		if( o.life <= 0 ) { $.destroyObject( i, byPlayer ); return true; }
		return false;
	}
	$.hurtObject = hurt;

	// push a circle out of an object, along the line between their centres
	function pushOut( o, body, rad, give ) {
		var dx = body.x - o.x, dy = body.y - o.y, d = Math.sqrt( dx * dx + dy * dy ) || 0.001, overlap = o.radius + rad - d;
		if( overlap <= 0 ) { return false; }
		var nx = dx / d, ny = dy / d;
		body.x += nx * overlap; body.y += ny * overlap;
		if( body.vx !== undefined ) {
			var vn = body.vx * nx + body.vy * ny;
			if( vn < 0 ) { body.vx -= nx * vn * 1.4; body.vy -= ny * vn * 1.4; }
		}
		// the object gives a little too
		o.vx -= nx * give; o.vy -= ny * give;
		return true;
	}

	/*--------------------------------------------------------------------------
	Update
	--------------------------------------------------------------------------*/
	$.updateObjects = function() {
		var dt = $.dt, list = $.objects, i, j;
		// respawns
		for( i = $.objectRespawns.length - 1; i >= 0; i-- ) {
			$.objectRespawns[ i ].t -= dt;
			if( $.objectRespawns[ i ].t <= 0 && list.length < target() ) {
				$.objectRespawns.splice( i, 1 );
				var at = placeFor( true ), fresh = make( pickKind( $.sector && $.sector.hazard ), at.x, at.y );
				fresh.lifeMax = fresh.life;
				list.push( fresh );
			}
		}
		var bh = $.blackhole && $.sector && $.sector.hazard === 'blackhole' && $.blackhole.alpha > 0.05 ? $.blackhole : null;
		for( i = list.length - 1; i >= 0; i-- ) {
			var o = list[ i ];
			if( !o ) { continue; }
			// drift, spin, a touch of drag so bumps settle
			o.x += o.vx * dt; o.y += o.vy * dt;
			o.vx *= Math.pow( 0.995, dt ); o.vy *= Math.pow( 0.995, dt );
			o.rotation += o.rotationSpeed * dt;
			if( o.hit > 0 ) { o.hit -= dt; }
			// keep inside the arena: bounce off its walls
			if( o.x < o.radius ) { o.x = o.radius; o.vx = Math.abs( o.vx ); }
			if( o.x > $.ww - o.radius ) { o.x = $.ww - o.radius; o.vx = -Math.abs( o.vx ); }
			if( o.y < o.radius ) { o.y = o.radius; o.vy = Math.abs( o.vy ); }
			if( o.y > $.wh - o.radius ) { o.y = $.wh - o.radius; o.vy = -Math.abs( o.vy ); }

			// the black hole drags everything in and crushes it
			if( bh ) {
				var bx = bh.x - o.x, by = bh.y - o.y, bd = Math.max( 1, Math.sqrt( bx * bx + by * by ) );
				var pull = 0.05 * bh.alpha * Math.max( 0, 1 - bd / 1800 );
				o.vx += bx / bd * pull * dt; o.vy += by / bd * pull * dt;
				if( bd < 110 && bh.alpha > 0.6 ) { $.destroyObject( i, false ); continue; }
			}
			// flares and pulsar beams burn through objects
			if( $.flare && $.flare.warnTick <= 0 && Math.abs( o.x - $.flare.x ) < $.flare.width ) {
				if( hurt( i, 0.03 * dt, false ) ) { continue; }
			}
			if( $.pulsarHits && $.pulsarHits( o.x, o.y, o.radius ) ) {
				if( hurt( i, 0.05 * dt, false ) ) { continue; }
			}

			// proximity mines: something close arms the fuse
			if( o.kind === 'mine' ) {
				var sense = KINDS.mine.sense, near = $.hero && $.hero.life > 0 && $.util.distance( o.x, o.y, $.hero.x, $.hero.y ) < sense;
				if( !near ) {
					for( j = 0; j < $.enemies.length; j++ ) {
						var en = $.enemies[ j ];
						if( !en.isBolt && $.util.distance( o.x, o.y, en.x, en.y ) < sense * 0.7 ) { near = true; break; }
					}
				}
				if( near && !o.armed ) { o.armed = 1; o.fuse = KINDS.mine.fuse; $.audio.play( 'hit' ); }
				if( o.armed ) {
					o.fuse -= dt;
					if( o.fuse <= 0 ) { $.destroyObject( i, !!o.byPlayer ); continue; }
				}
			}
			// a hit fuel canister cooks off a moment later
			if( o.kind === 'fuel' && o.armed && o.life > 0 ) {
				o.fuse = ( o.fuse || 40 ) - dt;
				if( o.fuse <= 0 ) { $.destroyObject( i, !!o.byPlayer ); continue; }
			}
			if( o.chained && o.life <= 0 ) { $.destroyObject( i, false ); continue; }

			// solid against the plane
			if( $.hero && $.hero.life > 0 ) { pushOut( o, $.hero, $.hero.radius, 0.04 ); }
			// solid against enemies; a boss smashes straight through; enemy
			// fire stops on the hull
			for( j = $.enemies.length - 1; j >= 0; j-- ) {
				var e = $.enemies[ j ];
				if( !e ) { continue; }
				var dx = e.x - o.x, dy = e.y - o.y, rr = o.radius + e.radius;
				if( dx * dx + dy * dy > rr * rr ) { continue; }
				if( e.isBoss ) { $.destroyObject( i, false ); o = null; break; }
				if( e.isBolt ) { $.enemies.splice( j, 1 ); o.hit = 4; continue; }
				pushOut( o, e, e.radius * 0.85, 0.02 );
			}
			if( !o ) { continue; }
			// objects bump each other
			for( j = i - 1; j >= 0; j-- ) {
				var q = list[ j ];
				if( !q ) { continue; }
				var qx = q.x - o.x, qy = q.y - o.y, qr = o.radius + q.radius;
				if( qx * qx + qy * qy < qr * qr ) {
					pushOut( o, q, q.radius, 0 );
					var t = q.vx; q.vx = o.vx * 0.8; o.vx = t * 0.8;
					t = q.vy; q.vy = o.vy * 0.8; o.vy = t * 0.8;
				}
			}
		}
		// your bullets (cheap: few objects, short-lived bullets)
		for( var bi = $.bullets.length - 1; bi >= 0; bi-- ) {
			var b = $.bullets[ bi ];
			for( i = list.length - 1; i >= 0; i-- ) {
				var ob = list[ i ];
				var ddx = b.x - ob.x, ddy = b.y - ob.y;
				if( ddx * ddx + ddy * ddy <= ob.radius * ob.radius ) {
					$.bullets.splice( bi, 1 );
					$.particleEmitters.push( new $.ParticleEmitter( { x: b.x, y: b.y, count: 2, spawnRange: 0, friction: 0.85, minSpeed: 2, maxSpeed: 7, minDirection: 0, maxDirection: TWO_PI, hue: ob.hue, saturation: 40 } ) );
					hurt( i, b.damage, true );
					break;
				}
			}
		}
	};

	/*--------------------------------------------------------------------------
	Render - lit from the upper left like everything else
	--------------------------------------------------------------------------*/
	function poly( ctx, o, scale ) {
		var n = o.points.length;
		ctx.beginPath();
		for( var p = 0; p < n; p++ ) {
			var a = p / n * TWO_PI, r = o.radius * o.points[ p ] * scale;
			if( p === 0 ) { ctx.moveTo( Math.cos( a ) * r, Math.sin( a ) * r ); } else { ctx.lineTo( Math.cos( a ) * r, Math.sin( a ) * r ); }
		}
		ctx.closePath();
	}
	function cracks( ctx, o ) {
		var dmg = 1 - o.life / ( o.lifeMax || 1 );
		if( dmg < 0.3 ) { return; }
		ctx.beginPath();
		var n = dmg > 0.6 ? 4 : 2;
		for( var c = 0; c < n; c++ ) {
			var a = o.points[ c ] * 7 + c * 1.9;
			ctx.moveTo( 0, 0 );
			ctx.lineTo( Math.cos( a ) * o.radius * 0.5, Math.sin( a ) * o.radius * 0.5 );
			ctx.lineTo( Math.cos( a + 0.3 ) * o.radius * 0.85, Math.sin( a + 0.3 ) * o.radius * 0.85 );
		}
		ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.stroke();
	}
	var DRAW = {
		rock: function( ctx, o ) {
			$.drawRock( ctx, { x: 0, y: 0, rotation: 0, radius: o.radius, points: o.points } );
			cracks( ctx, o );
		},
		ice: function( ctx, o ) {
			poly( ctx, o, 1 );
			var g = ctx.createLinearGradient( -o.radius, -o.radius, o.radius, o.radius );
			g.addColorStop( 0, 'hsla(190, 80%, 92%, 0.95)' ); g.addColorStop( 1, 'hsla(205, 70%, 55%, 0.85)' );
			ctx.fillStyle = g; ctx.fill();
			ctx.lineWidth = 1.5; ctx.strokeStyle = 'hsla(190, 100%, 96%, 0.9)'; ctx.stroke();
			poly( ctx, o, 0.45 ); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
			cracks( ctx, o );
		},
		crate: function( ctx, o ) {
			var s = o.radius * 0.95;
			ctx.fillStyle = 'hsl(32, 45%, 34%)'; ctx.fillRect( -s, -s, s * 2, s * 2 );
			ctx.fillStyle = 'hsl(32, 45%, 44%)'; ctx.fillRect( -s, -s, s * 2, s * 0.5 );
			ctx.strokeStyle = 'hsl(35, 60%, 62%)'; ctx.lineWidth = 2; ctx.strokeRect( -s, -s, s * 2, s * 2 );
			ctx.beginPath(); ctx.moveTo( -s, -s ); ctx.lineTo( s, s ); ctx.moveTo( s, -s ); ctx.lineTo( -s, s );
			ctx.lineWidth = 2.5; ctx.strokeStyle = 'hsl(35, 50%, 26%)'; ctx.stroke();
			// a glowing cargo light: there's something inside
			$.util.fillCircle( ctx, s * 0.55, -s * 0.55, 2.5, 'hsla(140, 100%, 65%, ' + ( 0.5 + Math.sin( $.tick / 10 + o.id ) * 0.4 ) + ')' );
			cracks( ctx, o );
		},
		fuel: function( ctx, o ) {
			var w = o.radius * 0.8, h = o.radius * 1.3;
			ctx.fillStyle = 'hsl(2, 75%, 42%)'; ctx.fillRect( -w, -h, w * 2, h * 2 );
			ctx.fillStyle = 'hsl(2, 75%, 55%)'; ctx.fillRect( -w, -h, w * 0.7, h * 2 );
			// hazard stripes, blinking once it has been hit
			var hot = o.armed && Math.floor( $.tick / 4 ) % 2;
			ctx.fillStyle = hot ? '#fff3c4' : 'hsl(48, 100%, 55%)';
			for( var k = -1; k <= 1; k++ ) { ctx.fillRect( -w, k * h * 0.55 - 2, w * 2, 4 ); }
			ctx.fillStyle = 'hsl(0, 0%, 30%)'; ctx.fillRect( -w * 0.5, -h - 4, w, 4 );
			if( o.armed ) { $.util.strokeCircle( ctx, 0, 0, KINDS.fuel.blast * ( 0.2 + ( Math.sin( $.tick / 3 ) + 1 ) * 0.05 ), 'hsla(15, 100%, 60%, 0.35)', 2 ); }
		},
		satellite: function( ctx, o ) {
			var r = o.radius;
			// solar panels
			for( var s = -1; s <= 1; s += 2 ) {
				ctx.fillStyle = 'hsl(220, 60%, 28%)'; ctx.fillRect( s > 0 ? r * 0.45 : -r * 1.85, -r * 0.38, r * 1.4, r * 0.76 );
				ctx.strokeStyle = 'hsl(205, 80%, 62%)'; ctx.lineWidth = 1; ctx.strokeRect( s > 0 ? r * 0.45 : -r * 1.85, -r * 0.38, r * 1.4, r * 0.76 );
				ctx.beginPath();
				for( var c = 1; c < 4; c++ ) { var cx = ( s > 0 ? r * 0.45 : -r * 1.85 ) + c * r * 0.35; ctx.moveTo( cx, -r * 0.38 ); ctx.lineTo( cx, r * 0.38 ); }
				ctx.stroke();
			}
			ctx.fillStyle = 'hsl(210, 10%, 65%)'; ctx.fillRect( -r * 0.45, -r * 0.45, r * 0.9, r * 0.9 );
			ctx.fillStyle = 'hsl(210, 10%, 80%)'; ctx.fillRect( -r * 0.45, -r * 0.45, r * 0.9, r * 0.3 );
			// dish and a blinking beacon
			ctx.beginPath(); ctx.arc( 0, -r * 0.45, r * 0.35, Math.PI, TWO_PI ); ctx.strokeStyle = 'hsl(0, 0%, 85%)'; ctx.lineWidth = 2; ctx.stroke();
			$.util.fillCircle( ctx, 0, r * 0.2, 2.5, 'hsla(0, 100%, 60%, ' + ( Math.floor( $.tick / 20 + o.id ) % 3 === 0 ? 1 : 0.2 ) + ')' );
			cracks( ctx, o );
		},
		mine: function( ctx, o ) {
			var r = o.radius, armed = o.armed, blink = armed ? Math.floor( $.tick / ( o.fuse < 20 ? 2 : 4 ) ) % 2 : Math.floor( $.tick / 30 + o.id ) % 4 === 0;
			ctx.strokeStyle = 'hsl(0, 0%, 55%)'; ctx.lineWidth = 3;
			ctx.beginPath();
			for( var s = 0; s < 8; s++ ) { var a = s / 8 * TWO_PI; ctx.moveTo( Math.cos( a ) * r * 0.7, Math.sin( a ) * r * 0.7 ); ctx.lineTo( Math.cos( a ) * r * 1.45, Math.sin( a ) * r * 1.45 ); }
			ctx.stroke();
			var g = ctx.createRadialGradient( -r * 0.3, -r * 0.35, 1, 0, 0, r );
			g.addColorStop( 0, 'hsl(0, 0%, 60%)' ); g.addColorStop( 1, 'hsl(0, 0%, 18%)' );
			ctx.beginPath(); ctx.arc( 0, 0, r, 0, TWO_PI ); ctx.fillStyle = g; ctx.fill();
			$.util.fillCircle( ctx, 0, 0, r * 0.35, blink ? 'hsla(0, 100%, 62%, 1)' : 'hsla(0, 100%, 35%, 0.8)' );
			if( armed ) {
				$.util.strokeCircle( ctx, 0, 0, KINDS.mine.blast * ( 1 - Math.max( 0, o.fuse ) / KINDS.mine.fuse ), 'hsla(0, 100%, 60%, 0.45)', 2 );
			} else {
				ctx.setLineDash( [ 3, 7 ] );
				$.util.strokeCircle( ctx, 0, 0, KINDS.mine.sense, 'hsla(0, 100%, 60%, 0.12)', 1 );
				ctx.setLineDash( [] );
			}
		},
		crystal: function( ctx, o ) {
			var r = o.radius;
			ctx.beginPath();
			ctx.moveTo( 0, -r * 1.25 ); ctx.lineTo( r * 0.55, -r * 0.2 ); ctx.lineTo( r * 0.35, r * 0.9 ); ctx.lineTo( -r * 0.35, r * 0.9 ); ctx.lineTo( -r * 0.55, -r * 0.2 ); ctx.closePath();
			var g = ctx.createLinearGradient( -r, -r, r, r );
			g.addColorStop( 0, 'hsla(290, 100%, 85%, 0.95)' ); g.addColorStop( 1, 'hsla(265, 90%, 45%, 0.9)' );
			ctx.fillStyle = g; ctx.fill();
			ctx.lineWidth = 1.5; ctx.strokeStyle = 'hsla(290, 100%, 90%, 0.9)'; ctx.stroke();
			ctx.beginPath(); ctx.moveTo( 0, -r * 1.25 ); ctx.lineTo( 0, r * 0.9 ); ctx.moveTo( -r * 0.55, -r * 0.2 ); ctx.lineTo( r * 0.55, -r * 0.2 );
			ctx.lineWidth = 1; ctx.strokeStyle = 'hsla(290, 100%, 95%, 0.5)'; ctx.stroke();
			var glow = ctx.createRadialGradient( 0, 0, 0, 0, 0, r * 1.6 );
			glow.addColorStop( 0, 'hsla(285, 100%, 70%, ' + ( 0.18 + Math.sin( $.tick / 15 + o.id ) * 0.06 ) + ')' ); glow.addColorStop( 1, 'hsla(285, 100%, 60%, 0)' );
			ctx.fillStyle = glow; ctx.beginPath(); ctx.arc( 0, 0, r * 1.6, 0, TWO_PI ); ctx.fill();
			cracks( ctx, o );
		}
	};

	$.renderObjects = function() {
		var ctx = $.ctxmg, list = $.objects;
		for( var i = 0; i < list.length; i++ ) {
			var o = list[ i ];
			if( !$.util.arcInRect( o.x, o.y, o.radius * 2 + 10, -$.screen.x, -$.screen.y, $.cw, $.ch ) ) { continue; }
			ctx.save();
			ctx.translate( o.x, o.y );
			// mines and fuel stay upright so their warnings read; the rest tumble
			if( o.kind !== 'mine' && o.kind !== 'fuel' ) { ctx.rotate( o.rotation ); }
			DRAW[ o.kind ]( ctx, o );
			if( o.hit > 0 ) {
				ctx.globalCompositeOperation = 'lighter';
				$.util.fillCircle( ctx, 0, 0, o.radius, 'hsla(' + o.hue + ', 60%, 70%, ' + ( o.hit / 16 ) + ')' );
				ctx.globalCompositeOperation = 'source-over';
			}
			ctx.restore();
		}
	};
} )();
