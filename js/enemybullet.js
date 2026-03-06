/*==============================================================================
Init
==============================================================================*/
$.EnemyBullet = function( opt ) {
	for( var k in opt ) {
		this[k] = opt[k];
	}
	this.inView = 0;
};

/*==============================================================================
Update
==============================================================================*/
$.EnemyBullet.prototype.update = function( i ) {
	this.x += Math.cos( this.direction ) * ( this.speed * $.dt );
	this.y += Math.sin( this.direction ) * ( this.speed * $.dt );

	// check collision with hero
	if( $.hero.life > 0 ) {
		var dx = $.hero.x - this.x,
			dy = $.hero.y - this.y,
			dist = Math.sqrt( dx * dx + dy * dy );
		if( dist <= $.hero.radius + this.radius ) {
			if( !$.shielded ) {
				$.hero.life -= this.damage;
				$.hero.takingDamage = 1;
				$.rumble.level = 4;
				$.audio.play( 'takingDamage' );
			}
			$.particleEmitters.push( new $.ParticleEmitter( {
				x: this.x,
				y: this.y,
				count: 3,
				spawnRange: 0,
				friction: 0.85,
				minSpeed: 2,
				maxSpeed: 10,
				minDirection: 0,
				maxDirection: $.twopi,
				hue: this.hue,
				saturation: 100
			} ) );
			$.enemyBullets.splice( i, 1 );
			return;
		}
	}

	// remove if out of bounds
	if( !$.util.pointInRect( this.x, this.y, -50, -50, $.ww + 100, $.wh + 100 ) ) {
		$.enemyBullets.splice( i, 1 );
		return;
	}

	// update view
	if( $.util.pointInRect( this.x, this.y, -$.screen.x, -$.screen.y, $.cw, $.ch ) ) {
		this.inView = 1;
	} else {
		this.inView = 0;
	}
};

/*==============================================================================
Render
==============================================================================*/
$.EnemyBullet.prototype.render = function( i ) {
	if( this.inView ) {
		$.util.fillCircle( $.ctxmg, this.x, this.y, this.radius, 'hsla(' + this.hue + ', 100%, 60%, 0.8)' );
		$.util.strokeCircle( $.ctxmg, this.x, this.y, this.radius, 'hsla(' + this.hue + ', 100%, 80%, 1)', 1.5 );
	}
};
