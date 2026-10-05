/*==============================================================================
Pilot shot traits

Every pilot fires its own bullet type (characters.js bulletStyle.kind), and
each type now does one small thing of its own in a fight - kept as modest as
a drone's effect. Frame counters and geometry only, never dice, so a seeded
raid stays the same raid whichever pilot flies it.
==============================================================================*/
$.shotTraits = {
	bolt: { title: 'HEAVY ROUND', text: 'EVERY 5TH SHOT HITS 50 PCT HARDER' },
	tracer: { title: 'LONG TRACER', text: 'SHOTS FLY 15 PCT FASTER AND FARTHER' },
	slug: { title: 'KNOCKBACK', text: 'HITS SHOVE ENEMIES BACK' },
	dart: { title: 'SEEKER', text: 'DARTS CURVE TOWARD A NEARBY ENEMY' },
	pulse: { title: 'STAGGER', text: 'HITS BRIEFLY STALL AN ENEMY' },
	glyph: { title: 'WEAVE', text: 'GLYPHS WEAVE, SWEEPING A WIDER LANE' },
	twin: { title: 'TWIN FANGS', text: 'TWO PARALLEL SHOTS, 60 PCT EACH' },
	lance: { title: 'PIERCE', text: 'LANCES PASS THROUGH ONE MORE ENEMY' },
	beam: { title: 'WIDE BEAM', text: 'BEAMS HIT ENEMIES FROM FURTHER OUT' },
	glitch: { title: 'GLITCH HIT', text: 'EVERY 4TH HIT DEALS DOUBLE' },
	plasma: { title: 'SPLASH', text: 'IMPACTS SPLASH 25 PCT TO NEARBY ENEMIES' },
	ember: { title: 'EMBER SPARK', text: 'A KILL SPARKS 35 PCT ONTO THE NEXT ENEMY' },
	neon: { title: 'RICOCHET', text: 'SHOTS BOUNCE ONCE OFF THE ARENA EDGE' }
};

// the bullets one trigger pull makes, from the shot the weapon would fire
$.shotSpec = function( o, hero ) {
	var kind = o.kind;
	if( kind === 'bolt' && hero && ( hero.shotNo || 0 ) % 5 === 0 ) {
		o.damage *= 1.5; o.heavy = 1; o.lineWidth *= 1.6;
	} else if( kind === 'tracer' ) {
		o.speed *= 1.15; o.range = ( o.range || 460 ) * 1.15;
	} else if( kind === 'lance' ) {
		// one more enemy than it would otherwise pass through
		if( o.piercing ) { o.pierceCap = ( o.pierceCap || 1 ) + 1; } else { o.piercing = 1; o.pierceCap = 1; }
	} else if( kind === 'twin' ) {
		var nx = -Math.sin( o.direction ) * 4, ny = Math.cos( o.direction ) * 4, b = {};
		for( var k in o ) { b[ k ] = o[ k ]; }
		o.damage *= 0.6; b.damage *= 0.6;
		o.x += nx; o.y += ny; b.x -= nx; b.y -= ny;
		return [ o, b ];
	}
	return [ o ];
};

// steering before a bullet moves: SEEKER darts, WEAVE glyphs
$.shotSteer = function( b ) {
	if( b.kind === 'dart' ) {
		var best = null, bd = 150 * 150;
		for( var i = 0; i < $.enemies.length; i++ ) {
			var e = $.enemies[ i ];
			if( e.isBolt ) { continue; }
			var dx = e.x - b.x, dy = e.y - b.y, d = dx * dx + dy * dy;
			if( d < bd ) { bd = d; best = e; }
		}
		if( best ) {
			var want = Math.atan2( best.y - b.y, best.x - b.x ),
				gap = Math.atan2( Math.sin( want - b.direction ), Math.cos( want - b.direction ) ),
				turn = 0.035 * $.dt;
			b.direction += Math.max( -turn, Math.min( turn, gap ) );
		}
	} else if( b.kind === 'glyph' ) {
		if( b.baseDir === undefined ) { b.baseDir = b.direction; b.weaveT = 0; }
		b.weaveT += $.dt;
		b.direction = b.baseDir + Math.sin( b.weaveT * 0.25 ) * 0.42;
	}
};

// RICOCHET: a neon shot leaving the arena bounces back in, once. True if it bounced.
$.shotBounce = function( b ) {
	if( b.kind !== 'neon' || b.bounced ) { return false; }
	var hit = false;
	if( b.x < 0 || b.x > $.ww ) { b.direction = Math.PI - b.direction; b.x = Math.max( 0, Math.min( $.ww, b.x ) ); hit = true; }
	if( b.y < 0 || b.y > $.wh ) { b.direction = -b.direction; b.y = Math.max( 0, Math.min( $.wh, b.y ) ); hit = true; }
	if( !hit ) { return false; }
	b.bounced = 1;
	b.ex = b.x; b.ey = b.y;
	return true;
};

// extra reach on a hit (WIDE BEAM)
$.shotReach = function( b ) { return b.kind === 'beam' ? 5 : 0; };

// the damage this hit deals (GLITCH HIT doubles every 4th)
$.shotDamage = function( b, dmg ) {
	if( b.kind === 'glitch' && $.hero ) {
		$.hero.glitchHits = ( $.hero.glitchHits || 0 ) + 1;
		if( $.hero.glitchHits % 4 === 0 ) { b.crit = 1; return dmg * 2; }
	}
	return dmg;
};

// after a hit lands on `enemy` (which may now be dead) at (x, y)
$.shotAfterHit = function( b, enemy, x, y, dmg ) {
	var k = b.kind;
	if( k === 'slug' && !enemy.isBoss ) {
		enemy.vx += Math.cos( b.direction ) * 2.2;
		enemy.vy += Math.sin( b.direction ) * 2.2;
	} else if( k === 'pulse' && !enemy.isBoss ) {
		enemy.stagger = 10;
	} else if( k === 'plasma' ) {
		for( var i = $.enemies.length - 1; i >= 0; i-- ) {
			var o = $.enemies[ i ];
			if( o === enemy || $.util.distance( x, y, o.x, o.y ) > 40 + o.radius ) { continue; }
			o.receiveDamage( i, dmg * 0.25 );
		}
		$.shotFlash( x, y, 28 );
	} else if( k === 'ember' && $.enemies.indexOf( enemy ) === -1 ) {
		// the kill throws a spark onto the nearest other enemy
		var best = -1, bd = 70;
		for( var j = 0; j < $.enemies.length; j++ ) {
			var d = $.util.distance( x, y, $.enemies[ j ].x, $.enemies[ j ].y );
			if( d < bd ) { bd = d; best = j; }
		}
		if( best >= 0 ) {
			var t = $.enemies[ best ];
			$.shotFlash( t.x, t.y, 10 );
			t.receiveDamage( best, dmg * 0.35 );
		}
	}
	if( b.crit ) { $.shotFlash( x, y, 16 ); b.crit = 0; }
};

// a little burst of light where a trait landed (drawing only)
$.shotFlash = function( x, y, r ) {
	$.particleEmitters.push( new $.ParticleEmitter( {
		x: x, y: y, count: 4, spawnRange: r * 0.3, friction: 0.85,
		minSpeed: 1, maxSpeed: 4 + r * 0.15, minDirection: 0, maxDirection: $.twopi,
		hue: 40, saturation: 100
	} ) );
};

/*==============================================================================
Init
==============================================================================*/
$.Bullet = function( opt ) {
	for( var k in opt ) {
		this[k] = opt[k];
	}
	this.enemiesHit = [];
	this.inView = 0;
	$.particleEmitters.push( new $.ParticleEmitter( {
		x: this.x,
		y: this.y,
		count: 1,
		spawnRange: 1,
		friction: 0.75,
		minSpeed: 2,
		maxSpeed: 10,
		minDirection: 0,
		maxDirection: $.twopi,
		hue: 0,
		saturation: 0
	} ) );
};

/*==============================================================================
Update
==============================================================================*/
$.Bullet.prototype.update = function( i ) {
	/*==============================================================================
	Apply Forces (a pilot's shot may steer first: SEEKER, WEAVE)
	==============================================================================*/
	if( this.kind === 'dart' || this.kind === 'glyph' ) { $.shotSteer( this ); }
	this.x += Math.cos( this.direction ) * ( this.speed * $.dt );
	this.y += Math.sin( this.direction ) * ( this.speed * $.dt );
	this.ex = this.x - Math.cos( this.direction ) * this.size;
	this.ey = this.y - Math.sin( this.direction ) * this.size;

	/*==============================================================================
	Limited Range (no sniping from across the arena)
	==============================================================================*/
	this.traveled = ( this.traveled || 0 ) + this.speed * $.dt;
	if( this.traveled > ( this.range || 460 ) ) {
		$.particleEmitters.push( new $.ParticleEmitter( {
			x: this.x,
			y: this.y,
			count: 1,
			spawnRange: 1,
			friction: 0.8,
			minSpeed: 0.5,
			maxSpeed: 2,
			minDirection: 0,
			maxDirection: $.twopi,
			hue: 0,
			saturation: 0
		} ) );
		$.bullets.splice( i, 1 );
		return;
	}

	/*==============================================================================
	Check Collisions (broad-phase: only enemies near this bullet, not all of
	them - see $.buildEnemyGrid. The grid is rebuilt each frame BEFORE the
	bullet pass, so an enemy killed by an earlier bullet this same frame can
	still sit in a bucket; the indexOf re-check below skips those safely.)
	==============================================================================*/
	var candidates = $.enemiesNear( this.x, this.y );
	var ci0 = candidates.length;
	while( ci0-- ) {
		var enemy = candidates[ ci0 ];
		if( $.util.distance( this.x, this.y, enemy.x, enemy.y ) <= enemy.radius + $.shotReach( this ) ) {
			// resolve the LIVE index only on an actual hit - dead/spliced
			// enemies from earlier this frame resolve to -1 and are skipped
			var ei = $.enemies.indexOf( enemy );
			if( ei === -1 ) { continue; }
			if( this.enemiesHit.indexOf( enemy.index ) == -1 ){
				$.particleEmitters.push( new $.ParticleEmitter( {
					x: this.x,
					y: this.y,
					count: Math.floor( $.fxRand( 1, 4 ) ),
					spawnRange: 0,
					friction: 0.85,
					minSpeed: 5,
					maxSpeed: 12,
					minDirection: ( this.direction - $.pi ) - $.pi / 5,
					maxDirection: ( this.direction - $.pi ) + $.pi / 5,
					hue: enemy.hue
				} ) );

				this.enemiesHit.push( enemy.index );

				// Warden shield: a plate faces the hero and deflects frontal
				// fire. If this bullet struck within the shield arc, it mostly
				// bounces (tiny chip damage + a spark) - you must flank it.
				var dmg = this.damage;
				if( enemy.shielded && enemy.facing !== undefined ) {
					var impact = Math.atan2( this.y - enemy.y, this.x - enemy.x ),
						diff = Math.abs( $.util.angleDiff ? $.util.angleDiff( impact, enemy.facing ) : Math.atan2( Math.sin( impact - enemy.facing ), Math.cos( impact - enemy.facing ) ) );
					if( diff < 1.15 ) {          // ~66 deg frontal arc
						dmg = this.damage * 0.12;
						enemy.shieldFlash = 1;
					}
				}
				// chain origin captured BEFORE the primary can die: if
				// receiveDamage splices it, indices shift and `ci === ei`
				// would skip a random live enemy instead of the primary -
				// comparing by object reference stays correct either way
				var chainX = enemy.x, chainY = enemy.y;
				dmg = $.shotDamage( this, dmg );
				enemy.receiveDamage( ei, dmg );
				// the pilot's own shot trait (knockback, stagger, splash, spark)
				$.shotAfterHit( this, enemy, chainX, chainY, dmg );
				// Frost Sprite chill / Ember Moth burn
				if( $.droneOnHit ) { $.droneOnHit( enemy, dmg ); }

				// Volt Mite drone: zap one nearby enemy for partial damage
				if( this.chain ) {
					var nearest = null, nearestIndex = -1, nearestDist = 140;
					for( var ci = $.enemies.length - 1; ci >= 0; ci-- ) {
						if( $.enemies[ ci ] === enemy ) { continue; }
						var d = $.util.distance( chainX, chainY, $.enemies[ ci ].x, $.enemies[ ci ].y );
						if( d < nearestDist ) {
							nearest = $.enemies[ ci ];
							nearestIndex = ci;
							nearestDist = d;
						}
					}
					if( nearest ) {
						var linkX = nearest.x, linkY = nearest.y;
						nearest.receiveDamage( nearestIndex, this.damage * 0.4 );
						if( $.droneEvent ) { $.droneEvent( 'chain', chainX, chainY, linkX, linkY ); }
					}
				}

				if( this.enemiesHit.length > ( this.pierceCap || 3 ) ) {
					$.bullets.splice( i, 1 );
					return;
				}
				if( this.piercing && $.droneEvent ) { $.droneEvent( 'pierce', chainX, chainY, this.direction ); }
			}
			if( !this.piercing ) {
				$.bullets.splice( i, 1 );
				return;
			}
		}
	}

	/*==============================================================================
	Lock Bounds
	==============================================================================*/
	// a ricochet's tail can trail outside just after it bounces: judge it by its head
	var bx = this.kind === 'neon' ? this.x : this.ex, by = this.kind === 'neon' ? this.y : this.ey;
	if( !$.util.pointInRect( bx, by, 0, 0, $.ww, $.wh ) && !$.shotBounce( this ) ) {
		$.bullets.splice( i, 1 );
		return;
	}

	/*==============================================================================
	Update View
	==============================================================================*/
	if( $.util.pointInRect( this.ex, this.ey, -$.screen.x, -$.screen.y, $.cw, $.ch ) ) {
		this.inView = 1;
	} else {
		this.inView = 0;
	}
};

/*==============================================================================
Render
==============================================================================*/
$.Bullet.prototype.render = function( i ) {
	if( !this.inView ) { return; }
	var c = $.ctxmg,
		x = this.x, y = this.y,
		ex = this.ex, ey = this.ey,
		w = this.lineWidth,
		s = this.size,
		col = this.strokeStyle,
		dx = Math.cos( this.direction ), dy = Math.sin( this.direction ),
		// perpendicular unit vector, for offset twin/neon rails
		nx = -dy, ny = dx,
		t = $.tick;

	// each pilot fires its own bullet TYPE (shape). Colour still comes from the
	// player's ship colour / active power-up (this.strokeStyle) so cosmetics and
	// power-up feedback are untouched. What each kind DOES in a fight is its
	// shot trait ($.shotTraits, top of this file) - this is only how it looks.
	switch( this.kind ) {
		case 'tracer': // NOVA - long faint streak + bright core
			c.strokeStyle = col; c.globalAlpha = 0.3; c.lineWidth = w;
			c.beginPath(); c.moveTo( x, y ); c.lineTo( x - dx * s * 1.9, y - dy * s * 1.9 ); c.stroke();
			c.globalAlpha = 1;
			c.beginPath(); c.moveTo( x, y ); c.lineTo( ex, ey ); c.stroke();
			break;
		case 'slug': // TANK REX - short fat round-capped slug
			c.strokeStyle = col; c.lineWidth = w * 2.2; c.lineCap = 'round';
			c.beginPath(); c.moveTo( x, y ); c.lineTo( x - dx * s * 0.5, y - dy * s * 0.5 ); c.stroke();
			c.lineCap = 'butt';
			break;
		case 'dart': // ASTRA VANE - small filled arrowhead
			c.fillStyle = col;
			c.beginPath();
			c.moveTo( x, y );
			c.lineTo( ex + nx * s * 0.18, ey + ny * s * 0.18 );
			c.lineTo( ex - nx * s * 0.18, ey - ny * s * 0.18 );
			c.closePath(); c.fill();
			break;
		case 'pulse': { // IRON HALO - ring with a core dot
			var pr = Math.max( 3, s * 0.28 );
			c.strokeStyle = col; c.lineWidth = 1.6;
			c.beginPath(); c.arc( x, y, pr, 0, $.twopi ); c.stroke();
			c.fillStyle = col; c.beginPath(); c.arc( x, y, pr * 0.45, 0, $.twopi ); c.fill();
			break;
		}
		case 'glyph': // RUNE PILOT - spinning diamond shard
			c.save(); c.translate( x, y ); c.rotate( t * 0.2 );
			c.fillStyle = col; var gr = Math.max( 3, s * 0.24 );
			c.beginPath(); c.moveTo( 0, -gr ); c.lineTo( gr, 0 ); c.lineTo( 0, gr ); c.lineTo( -gr, 0 ); c.closePath(); c.fill();
			c.restore();
			break;
		case 'twin': // NEBULA FOX - two parallel fangs
			c.strokeStyle = col; c.lineWidth = Math.max( 1, w * 0.8 );
			c.beginPath();
			c.moveTo( x + nx * 3, y + ny * 3 ); c.lineTo( ex + nx * 3, ey + ny * 3 );
			c.moveTo( x - nx * 3, y - ny * 3 ); c.lineTo( ex - nx * 3, ey - ny * 3 );
			c.stroke();
			break;
		case 'lance': // JAVELIN 9 - very long thin needle + bright tip
			c.strokeStyle = col; c.lineWidth = Math.max( 1, w * 0.7 );
			c.beginPath(); c.moveTo( x, y ); c.lineTo( x - dx * s * 1.5, y - dy * s * 1.5 ); c.stroke();
			c.fillStyle = col; c.beginPath(); c.arc( x, y, Math.max( 1.2, w ), 0, $.twopi ); c.fill();
			break;
		case 'beam': // ATLAS BEAM - thick glowing beam
			c.strokeStyle = col; c.globalAlpha = 0.28; c.lineWidth = w * 3;
			c.beginPath(); c.moveTo( x, y ); c.lineTo( ex, ey ); c.stroke();
			c.globalAlpha = 1; c.lineWidth = w * 1.5;
			c.beginPath(); c.moveTo( x, y ); c.lineTo( ex, ey ); c.stroke();
			break;
		case 'glitch': { // GLITCH PRINCE - fragmented, jittering segments
			var j = ( Math.floor( t / 4 ) % 2 ) ? 2 : -2;
			c.strokeStyle = col; c.lineWidth = w;
			c.beginPath();
			c.moveTo( x, y ); c.lineTo( x - dx * s * 0.4, y - dy * s * 0.4 );
			c.moveTo( x - dx * s * 0.5 + nx * j, y - dy * s * 0.5 + ny * j );
			c.lineTo( x - dx * s * 0.9 + nx * j, y - dy * s * 0.9 + ny * j );
			c.stroke();
			break;
		}
		case 'plasma': { // SOLSTICE - glowing plasma orb with white core
			var g = 0.6 + 0.4 * Math.sin( t / 4 ), pr2 = Math.max( 3, s * 0.32 );
			c.globalAlpha = 0.4 * g; c.fillStyle = col;
			c.beginPath(); c.arc( x, y, pr2, 0, $.twopi ); c.fill();
			c.globalAlpha = 0.85; c.fillStyle = 'hsla(0,0%,100%,1)';
			c.beginPath(); c.arc( x, y, pr2 * 0.5, 0, $.twopi ); c.fill();
			c.globalAlpha = 1;
			break;
		}
		case 'ember': // CRIMSON WISP - bolt with a flickering ember trail
			c.strokeStyle = col; c.lineWidth = w;
			c.beginPath(); c.moveTo( x, y ); c.lineTo( x - dx * s * 0.7, y - dy * s * 0.7 ); c.stroke();
			c.fillStyle = col;
			for( var k = 1; k <= 3; k++ ) {
				c.globalAlpha = 0.5 - k * 0.12;
				var wob = Math.sin( ( t + k * 7 ) / 5 ) * 2;
				c.beginPath();
				c.arc( x - dx * s * ( 0.7 + k * 0.22 ) + nx * wob, y - dy * s * ( 0.7 + k * 0.22 ) + ny * wob, 1.6, 0, $.twopi );
				c.fill();
			}
			c.globalAlpha = 1;
			break;
		case 'neon': // RIDER - purple neon glow with twin bright rails
			c.strokeStyle = col; c.globalAlpha = 0.35; c.lineWidth = w * 2.4;
			c.beginPath(); c.moveTo( x, y ); c.lineTo( ex, ey ); c.stroke();
			c.globalAlpha = 1; c.strokeStyle = 'hsla(280,100%,90%,1)'; c.lineWidth = Math.max( 1, w * 0.7 );
			c.beginPath();
			c.moveTo( x + nx * 2.5, y + ny * 2.5 ); c.lineTo( ex + nx * 2.5, ey + ny * 2.5 );
			c.moveTo( x - nx * 2.5, y - ny * 2.5 ); c.lineTo( ex - nx * 2.5, ey - ny * 2.5 );
			c.stroke();
			break;
		default: // 'bolt' - the classic line (ONYIX and fallback)
			c.strokeStyle = col; c.lineWidth = w;
			c.beginPath(); c.moveTo( x, y ); c.lineTo( ex, ey ); c.stroke();
	}
};
