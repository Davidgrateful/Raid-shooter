/*==============================================================================
Enemy Shapes

Silhouette-coded bodies replacing the legacy circles: arrows chase,
hexagons tank, petals heal, spikes explode. Drawn with the context
translated to the enemy center and rotated to its travel direction.
==============================================================================*/
$.enemyShapes = {
	orb: function( ctx, r, fill, stroke ) {
		ctx.beginPath(); ctx.arc( 0, 0, r, 0, $.twopi );
		ctx.fillStyle = fill; ctx.fill();
		ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke();
	},
	shuttle: function( ctx, r, fill, stroke ) {
		ctx.beginPath();
		ctx.moveTo( r * 1.3, 0 ); ctx.lineTo( r * 0.5, r * 0.6 ); ctx.lineTo( -r * 0.9, r * 0.6 );
		ctx.lineTo( -r * 0.9, -r * 0.6 ); ctx.lineTo( r * 0.5, -r * 0.6 );
		ctx.closePath();
		ctx.fillStyle = fill; ctx.fill();
		ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke();
	},
	slant: function( ctx, r, fill, stroke ) {
		ctx.beginPath();
		ctx.moveTo( r, -r * 0.7 ); ctx.lineTo( r * 0.3, r * 0.7 ); ctx.lineTo( -r, r * 0.7 ); ctx.lineTo( -r * 0.3, -r * 0.7 );
		ctx.closePath();
		ctx.fillStyle = fill; ctx.fill();
		ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke();
	},
	chevron: function( ctx, r, fill, stroke ) {
		ctx.beginPath();
		ctx.moveTo( r * 1.2, 0 ); ctx.lineTo( -r * 0.8, r * 0.9 ); ctx.lineTo( -r * 0.2, 0 ); ctx.lineTo( -r * 0.8, -r * 0.9 );
		ctx.closePath();
		ctx.fillStyle = fill; ctx.fill();
		ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke();
	},
	block: function( ctx, r, fill, stroke ) {
		ctx.beginPath();
		ctx.rect( -r * 0.85, -r * 0.85, r * 1.7, r * 1.7 );
		ctx.fillStyle = fill; ctx.fill();
		ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke();
		// seams show where it will split apart
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo( 0, -r * 0.85 ); ctx.lineTo( 0, r * 0.85 );
		ctx.moveTo( -r * 0.85, 0 ); ctx.lineTo( r * 0.85, 0 );
		ctx.stroke();
	},
	tumbler: function( ctx, r, fill, stroke, tick ) {
		ctx.rotate( tick / 30 );
		ctx.beginPath();
		ctx.moveTo( r, -r * 0.3 ); ctx.lineTo( r * 0.2, r * 0.9 ); ctx.lineTo( -r * 0.9, r * 0.4 ); ctx.lineTo( -r * 0.7, -r * 0.8 );
		ctx.closePath();
		ctx.fillStyle = fill; ctx.fill();
		ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke();
	},
	comet: function( ctx, r, fill, stroke ) {
		ctx.beginPath();
		ctx.moveTo( r * 1.2, 0 );
		ctx.quadraticCurveTo( 0, r * 0.95, -r, 0 );
		ctx.quadraticCurveTo( 0, -r * 0.95, r * 1.2, 0 );
		ctx.closePath();
		ctx.fillStyle = fill; ctx.fill();
		ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke();
		// warning spikes
		ctx.fillStyle = stroke;
		for( var s = 0; s < 3; s++ ) {
			var a = -$.pi * 0.6 + s * $.pi * 0.6;
			ctx.beginPath();
			ctx.moveTo( Math.cos( a ) * r * 0.9 + r * 0.3, Math.sin( a ) * r * 0.9 );
			ctx.lineTo( Math.cos( a ) * ( r * 1.5 ) + r * 0.3, Math.sin( a ) * ( r * 1.5 ) );
			ctx.lineTo( Math.cos( a + 0.45 ) * r * 0.75 + r * 0.3, Math.sin( a + 0.45 ) * r * 0.75 );
			ctx.closePath();
			ctx.fill();
		}
	},
	wasp: function( ctx, r, fill, stroke ) {
		ctx.beginPath();
		ctx.moveTo( r * 1.5, 0 ); ctx.lineTo( -r * 0.4, r * 0.5 ); ctx.lineTo( -r * 1.1, 0 ); ctx.lineTo( -r * 0.4, -r * 0.5 );
		ctx.closePath();
		ctx.fillStyle = fill; ctx.fill();
		ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke();
		ctx.beginPath();
		ctx.moveTo( 0, r * 0.4 ); ctx.lineTo( -r * 0.5, r * 1.1 );
		ctx.moveTo( 0, -r * 0.4 ); ctx.lineTo( -r * 0.5, -r * 1.1 );
		ctx.lineWidth = 1.5; ctx.stroke();
	},
	sliver: function( ctx, r, fill, stroke ) {
		ctx.beginPath();
		ctx.moveTo( r * 1.5, 0 ); ctx.lineTo( -r * 1.2, r * 0.35 ); ctx.lineTo( -r * 1.2, -r * 0.35 );
		ctx.closePath();
		ctx.fillStyle = fill; ctx.fill();
		ctx.lineWidth = 1.5; ctx.strokeStyle = stroke; ctx.stroke();
	},
	heavy: function( ctx, r, fill, stroke ) {
		ctx.beginPath();
		for( var p = 0; p < 6; p++ ) {
			var a = p / 6 * $.twopi;
			if( p === 0 ) { ctx.moveTo( Math.cos( a ) * r, Math.sin( a ) * r ); } else { ctx.lineTo( Math.cos( a ) * r, Math.sin( a ) * r ); }
		}
		ctx.closePath();
		ctx.fillStyle = fill; ctx.fill();
		ctx.lineWidth = 3; ctx.strokeStyle = stroke; ctx.stroke();
		ctx.beginPath();
		for( var p = 0; p < 6; p++ ) {
			var a = p / 6 * $.twopi;
			if( p === 0 ) { ctx.moveTo( Math.cos( a ) * r * 0.55, Math.sin( a ) * r * 0.55 ); } else { ctx.lineTo( Math.cos( a ) * r * 0.55, Math.sin( a ) * r * 0.55 ); }
		}
		ctx.closePath();
		ctx.lineWidth = 1.5; ctx.stroke();
	},
	bloom: function( ctx, r, fill, stroke, tick ) {
		ctx.rotate( tick / 50 );
		for( var p = 0; p < 4; p++ ) {
			ctx.save();
			ctx.rotate( p * $.pi / 2 );
			ctx.beginPath();
			ctx.ellipse( r * 0.6, 0, r * 0.55, r * 0.3, 0, 0, $.twopi );
			ctx.fillStyle = fill; ctx.fill();
			ctx.lineWidth = 1.5; ctx.strokeStyle = stroke; ctx.stroke();
			ctx.restore();
		}
		ctx.beginPath(); ctx.arc( 0, 0, r * 0.35, 0, $.twopi );
		ctx.fillStyle = stroke; ctx.fill();
	},
	dartlet: function( ctx, r, fill, stroke ) {
		ctx.beginPath();
		ctx.moveTo( r * 1.4, 0 ); ctx.lineTo( -r * 0.8, r * 0.6 ); ctx.lineTo( -r * 0.4, 0 ); ctx.lineTo( -r * 0.8, -r * 0.6 );
		ctx.closePath();
		ctx.fillStyle = fill; ctx.fill();
		ctx.lineWidth = 1.5; ctx.strokeStyle = stroke; ctx.stroke();
	},
	star: function( ctx, r, fill, stroke, tick ) {
		ctx.rotate( tick / 40 );
		ctx.beginPath();
		for( var p = 0; p < 16; p++ ) {
			var a = p / 16 * $.twopi,
				pr = ( p % 2 ) ? r * 0.55 : r;
			if( p === 0 ) { ctx.moveTo( Math.cos( a ) * pr, Math.sin( a ) * pr ); } else { ctx.lineTo( Math.cos( a ) * pr, Math.sin( a ) * pr ); }
		}
		ctx.closePath();
		ctx.fillStyle = fill; ctx.fill();
		ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke();
	},
	turret: function( ctx, r, fill, stroke ) {
		ctx.beginPath();
		ctx.moveTo( r * 0.9, 0 ); ctx.lineTo( 0, r * 0.9 ); ctx.lineTo( -r * 0.9, 0 ); ctx.lineTo( 0, -r * 0.9 );
		ctx.closePath();
		ctx.fillStyle = fill; ctx.fill();
		ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke();
		ctx.fillStyle = stroke;
		ctx.fillRect( r * 0.5, -r * 0.12, r * 1.1, r * 0.24 );
	},
	crescent: function( ctx, r, fill, stroke ) {
		ctx.beginPath();
		ctx.arc( 0, 0, r, -$.pi * 0.6, $.pi * 0.6 );
		ctx.arc( -r * 0.55, 0, r * 0.8, $.pi * 0.5, -$.pi * 0.5, true );
		ctx.closePath();
		ctx.fillStyle = fill; ctx.fill();
		ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke();
	},
	hive: function( ctx, r, fill, stroke, tick ) {
		ctx.rotate( tick / 60 );
		ctx.beginPath();
		for( var p = 0; p < 5; p++ ) {
			var a = p / 5 * $.twopi;
			if( p === 0 ) { ctx.moveTo( Math.cos( a ) * r, Math.sin( a ) * r ); } else { ctx.lineTo( Math.cos( a ) * r, Math.sin( a ) * r ); }
		}
		ctx.closePath();
		ctx.fillStyle = fill; ctx.fill();
		ctx.lineWidth = 2.5; ctx.strokeStyle = stroke; ctx.stroke();
		ctx.beginPath(); ctx.arc( 0, 0, r * 0.4, 0, $.twopi );
		ctx.lineWidth = 1.5; ctx.stroke();
	},
	fort: function( ctx, r, fill, stroke ) {
		ctx.beginPath();
		ctx.rect( -r * 0.8, -r * 0.8, r * 1.6, r * 1.6 );
		ctx.fillStyle = fill; ctx.fill();
		ctx.lineWidth = 2.5; ctx.strokeStyle = stroke; ctx.stroke();
		ctx.fillStyle = stroke;
		ctx.fillRect( -r * 1.05, -r * 1.05, r * 0.5, r * 0.5 );
		ctx.fillRect( r * 0.55, -r * 1.05, r * 0.5, r * 0.5 );
		ctx.fillRect( -r * 1.05, r * 0.55, r * 0.5, r * 0.5 );
		ctx.fillRect( r * 0.55, r * 0.55, r * 0.5, r * 0.5 );
	},
	shard: function( ctx, r, fill, stroke ) {
		ctx.beginPath();
		ctx.moveTo( r * 1.6, 0 ); ctx.lineTo( -r, r * 0.5 ); ctx.lineTo( -r * 0.5, 0 ); ctx.lineTo( -r, -r * 0.5 );
		ctx.closePath();
		ctx.fillStyle = stroke; ctx.fill();
	}
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
		var facing = ( this.vx || this.vy ) ? Math.atan2( this.vy, this.vx ) : ( this.direction || 0 ),
			shapeFn = $.enemyShapes[ this.shape ] || $.enemyShapes.orb;

		$.ctxmg.save();
		$.ctxmg.translate( this.x, this.y );
		$.ctxmg.rotate( facing );
		shapeFn( $.ctxmg, this.radius, this.fillStyle, this.strokeStyle, $.tick );
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
