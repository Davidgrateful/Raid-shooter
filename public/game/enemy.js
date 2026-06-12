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
		this.lifeMax = this.life;
		this.speed *= 1 + Math.min( 1.2, $.level.current * 0.025 );
	}
};

/*==============================================================================
Update
==============================================================================*/
$.Enemy.prototype.update = function( i ) {
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
		var mod = $.enemyOffsetMod / 6;
		$.util.fillCircle( $.ctxmg, this.x, this.y, this.radius, this.fillStyle );
		$.util.strokeCircle( $.ctxmg, this.x, this.y, this.radius / 4 + Math.cos( mod ) * this.radius / 4, this.strokeStyle, 1.5 );
		$.util.strokeCircle( $.ctxmg, this.x, this.y, this.radius - 0.5, this.strokeStyle, 1 );
		
		$.ctxmg.strokeStyle = this.strokeStyle;
		$.ctxmg.lineWidth = 4;
		$.ctxmg.beginPath();
		$.ctxmg.arc( this.x, this.y, this.radius - 0.5, mod + $.pi, mod + $.pi + $.pi / 2 );		
		$.ctxmg.stroke();
		$.ctxmg.beginPath();
		$.ctxmg.arc( this.x, this.y, this.radius - 0.5, mod, mod + $.pi / 2 );		
		$.ctxmg.stroke();

		if( $.slow) {
			$.util.fillCircle( $.ctxmg, this.x, this.y, this.radius, 'hsla(' + $.util.rand( 160, 220 ) + ', 100%, 50%, 0.25)' );
		} 
		if( this.hitFlag > 0 ) {
			this.hitFlag -= $.dt;
			$.util.fillCircle( $.ctxmg, this.x, this.y, this.radius, 'hsla(' + this.hue + ', ' + this.saturation + '%, 75%, ' + this.hitFlag / 10 + ')' );
			$.util.strokeCircle( $.ctxmg, this.x, this.y, this.radius, 'hsla(' + this.hue + ', ' + this.saturation + '%, ' + $.util.rand( 60, 90) + '%, ' + this.hitFlag / 10 + ')', $.util.rand( 1, 10) );
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
