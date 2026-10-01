/*==============================================================================
Enemy drawing helpers

Layered glow (wide faint stroke under a hot thin stroke), pulsing cores and
engine flames, shared by every enemy shape. The shapes themselves - the drone
fleet and the bosses - are in art.js. Context arrives translated to the enemy
and rotated to its travel direction; +x is forward. The passed fill/stroke
follow behavior color animation (kamikaze flash, grower rainbow), glow layers
use hue.
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
	var flame = r * ( 0.8 + $.fxRandom() * 0.7 );
	ctx.beginPath();
	ctx.moveTo( x, r * 0.3 ); ctx.lineTo( x - flame, 0 ); ctx.lineTo( x, -r * 0.3 );
	ctx.closePath();
	ctx.fillStyle = $.hsla( hue, 100, 70, 0.55 );
	ctx.fill();
};

$.enemyShapes = {
	// the fallback shape (and boss bolts). The fleet itself is in art.js,
	// which fills in the rest of this table key for key.
	orb: function( ctx, r, fill, stroke, tick, e ) {
		ctx.beginPath(); ctx.arc( 0, 0, r, 0, $.twopi );
		ctx.fillStyle = fill; ctx.fill();
		$.neonStroke( ctx, e.hue, e.saturation, stroke );
		$.coreEye( ctx, 0, 0, r * 0.3, e.hue, e.saturation, tick );
	},
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
		// the dash i-frames and the SHIELD powerup both dodge the blast,
		// matching every other damage path (contact, hazards, black hole)
		if( $.hero.life > 0 && $.hero.dashTick <= 0 && $.powerupTimers[ 5 ] <= 0 && $.util.distance( this.x, this.y, $.hero.x, $.hero.y ) <= this.blastRadius + $.hero.radius ) {
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
	// damage numbers (art.js) - hits within a few frames merge into one, and
	// enemy bolts are bullets, not targets, so they never get one
	if( val > 0 && this.inView && !this.isBolt && $.storage[ 'dmgnums' ] !== 0 ) {
		$.addDamageNumber( this, val );
	}
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
			// call out the kills that were actually a fight. Trash never
			// reaches the feed - a line per mob would be wallpaper, and the
			// score pop already confirms every ordinary kill.
			if( $.pushFeed ) {
				if( this.isBoss ) { $.pushFeed( 'BOSS DESTROYED', 45 ); }
				else if( this.elite ) { $.pushFeed( 'ELITE DOWN', 285 ); }
			}
		}
		this.death();
		$.spawnPowerup( this.x, this.y );
		$.registerKill( this.value, this.radius );
		$.level.kills++;
		$.kills++;
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
