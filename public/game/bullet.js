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
	if( this.inView ) {
		$.ctxmg.beginPath();
		$.ctxmg.moveTo( this.x, this.y );
		$.ctxmg.lineTo( this.ex, this.ey );
		$.ctxmg.lineWidth = this.lineWidth;		
		$.ctxmg.strokeStyle = this.strokeStyle;
		$.ctxmg.stroke();
	}
};
