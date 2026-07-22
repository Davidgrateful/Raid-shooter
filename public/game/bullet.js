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
	Apply Forces
	==============================================================================*/
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
		if( $.util.distance( this.x, this.y, enemy.x, enemy.y ) <= enemy.radius ) {
			// resolve the LIVE index only on an actual hit - dead/spliced
			// enemies from earlier this frame resolve to -1 and are skipped
			var ei = $.enemies.indexOf( enemy );
			if( ei === -1 ) { continue; }
			if( this.enemiesHit.indexOf( enemy.index ) == -1 ){
				$.particleEmitters.push( new $.ParticleEmitter( {
					x: this.x,
					y: this.y,
					count: Math.floor( $.util.rand( 1, 4 ) ),
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
				enemy.receiveDamage( ei, dmg );

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
						nearest.receiveDamage( nearestIndex, this.damage * 0.4 );
					}
				}

				if( this.enemiesHit.length > ( this.pierceCap || 3 ) ) {
					$.bullets.splice( i, 1 );
					return;
				}
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
	if( !$.util.pointInRect( this.ex, this.ey, 0, 0, $.ww, $.wh ) ) {
		$.bullets.splice( i, 1 );
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
	// power-up feedback are untouched, and every kind deals identical damage -
	// purely visual, never affects a run or score.
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
