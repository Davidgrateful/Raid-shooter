/*==============================================================================
Init
==============================================================================*/
$.Hero = function() {
	this.x = $.ww / 2;
	this.y = $.wh / 2;
	this.vx = 0;
	this.vy = 0;
	this.vmax = 4;
	this.vmax = 6;
	this.direction = 0;
	this.accel = 0.5;
	this.radius = 10;
	this.life = 1;
	this.takingDamage = 0;
	this.character = $.currentCharacter();
	this.radius = this.character.radius;
	var shipColor = $.definitions.shipColors[ $.storage['ship'] || 0 ] || $.definitions.shipColors[ 0 ];
	this.fillStyle = shipColor.color;
	this.regenRate = 0;
	this.damageTakenMult = 1;
	this.dashTick = 0;
	this.dashDuration = 14;
	this.dashSpeed = 22;
	this.dashCooldown = 0;
	this.dashCooldownMax = 120;
	this.dashDx = 0;
	this.dashDy = 0;
	this.weapon = {
		fireRate: 5,
		fireRateTick: 5,
		spread: 0.3,
		count: 1,
		baseFireRate: 5,
		baseCount: 1,
		baseBulletSpeed: 10,
		basePiercing: 0,
		bullet: {
			size: 15,
			lineWidth: 2,
			damage: 1,
			speed: 10,
			piercing: 0,
			strokeStyle: shipColor.color
		},
		fireFlag: 0
	};	
};

/*==============================================================================
Update
==============================================================================*/
$.Hero.prototype.update = function() {
	if( this.life > 0 ) {
		// Medic Wisp drone: a slow passive trickle, not a heal button
		if( $.equippedDrone() && $.equippedDrone().id === 'drone_medicwisp' ) {
			this.life = Math.min( 1, this.life + 0.0004 * $.dt );
		}

		/*==============================================================================
		Dash
		==============================================================================*/
		if( this.dashCooldown > 0 ) {
			this.dashCooldown -= $.dt;
		}
		var wantDash = $.keys.pressed.dash || $.dashRequest;
		$.dashRequest = 0;
		if( wantDash && this.dashCooldown <= 0 && this.dashTick <= 0 ) {
			// dash toward movement input, falling back to facing direction
			var ddx = $.keys.state.right - $.keys.state.left,
				ddy = $.keys.state.down - $.keys.state.up;
			if( ddx === 0 && ddy === 0 ) {
				ddx = Math.cos( this.direction );
				ddy = Math.sin( this.direction );
			} else {
				var dlen = Math.sqrt( ddx * ddx + ddy * ddy );
				ddx /= dlen;
				ddy /= dlen;
			}
			this.dashTick = this.dashDuration;
			this.dashCooldown = this.dashCooldownMax;
			this.dashDx = ddx;
			this.dashDy = ddy;
			$.audio.play( 'shootAlt' );
		}
		if( this.dashTick > 0 ) {
			this.dashTick -= $.dt;
			this.vx = this.dashDx * this.dashSpeed;
			this.vy = this.dashDy * this.dashSpeed;
			$.particleEmitters.push( new $.ParticleEmitter( {
				x: this.x,
				y: this.y,
				count: 2,
				spawnRange: this.radius,
				friction: 0.8,
				minSpeed: 1,
				maxSpeed: 4,
				minDirection: 0,
				maxDirection: $.twopi,
				hue: 0,
				saturation: 0
			} ) );
		}

		/*==============================================================================
		Equipped Trail (cosmetic)
		==============================================================================*/
		var trail = $.equippedTrail();
		if( trail && Math.floor( $.tick ) % 3 === 0 && ( Math.abs( this.vx ) + Math.abs( this.vy ) ) > 1 ) {
			$.particleEmitters.push( new $.ParticleEmitter( {
				x: this.x - Math.cos( this.direction ) * this.radius,
				y: this.y - Math.sin( this.direction ) * this.radius,
				count: 1,
				spawnRange: 2,
				friction: 0.82,
				minSpeed: 0.5,
				maxSpeed: 2,
				minDirection: 0,
				maxDirection: $.twopi,
				hue: trail.hue,
				saturation: 100
			} ) );
		}

		/*==============================================================================
		Apply Forces (input is overridden while dashing, or it would clamp
		the dash velocity back down to vmax)
		==============================================================================*/
		var controlMode = $.isTouchDevice ? 'hybrid' : ( $.storage['controls'] || 'hybrid' );
		if( this.dashTick <= 0 && controlMode === 'mouse' ) {
			// MOUSE mode: the ship flies toward the cursor
			var mdx = $.mouse.x - this.x,
				mdy = $.mouse.y - this.y,
				mdist = Math.sqrt( mdx * mdx + mdy * mdy );
			if( mdist > 30 ) {
				this.vx += ( mdx / mdist ) * this.accel * $.dt;
				this.vy += ( mdy / mdist ) * this.accel * $.dt;
				if( this.vx > this.vmax ) { this.vx = this.vmax; }
				if( this.vx < -this.vmax ) { this.vx = -this.vmax; }
				if( this.vy > this.vmax ) { this.vy = this.vmax; }
				if( this.vy < -this.vmax ) { this.vy = -this.vmax; }
			}
		}
		if( this.dashTick <= 0 && controlMode !== 'mouse' ) {
			if( $.keys.state.up ) {
				this.vy -= this.accel * $.dt;
				if( this.vy < -this.vmax ) {
					this.vy = -this.vmax;
				}
			} else if( $.keys.state.down ) {
				this.vy += this.accel * $.dt;
				if( this.vy > this.vmax ) {
					this.vy = this.vmax;
				}
			}
			if( $.keys.state.left ) {
				this.vx -= this.accel * $.dt;
				if( this.vx < -this.vmax ) {
					this.vx = -this.vmax;
				}
			} else if( $.keys.state.right ) {
				this.vx += this.accel * $.dt;
				if( this.vx > this.vmax ) {
					this.vx = this.vmax;
				}
			}
		}

		this.vy *= 0.9;
		this.vx *= 0.9;	
		
		this.x += this.vx * $.dt;
		this.y += this.vy * $.dt;

		/*==============================================================================
		Lock Bounds
		==============================================================================*/
		if( this.x >= $.ww - this.radius ) {
			this.x = $.ww - this.radius;
		}
		if( this.x <= this.radius ) {
			this.x = this.radius;
		}
		if( this.y >= $.wh - this.radius ) {
			this.y = $.wh - this.radius;
		}
		if( this.y <= this.radius ) {
			this.y = this.radius;
		}

		/*==============================================================================
		Update Direction
		==============================================================================*/
		if( controlMode === 'keyboard' && !$.vjoyRight.active ) {
			var kdx = $.keys.state.right - $.keys.state.left,
				kdy = $.keys.state.down - $.keys.state.up;
			if( kdx !== 0 || kdy !== 0 ) {
				this.direction = Math.atan2( kdy, kdx );
			}
		} else if( $.vjoyRight.active ) {
			var dx = $.vjoyRight.cx - $.vjoyRight.ox,
				dy = $.vjoyRight.cy - $.vjoyRight.oy;
			if( dx !== 0 || dy !== 0 ) {
				// The user reported the joystick is vertically inverted. 
				// The previous mapping in game.js was actually inverted, which made them BOTH appear inverted relative to the correct interaction model. 
				// Now that game.js mappings are restored to true canvas y-is-down behavior, 
				// this should also be regular canvas atan2 behavior (dy, dx).
				this.direction = Math.atan2( dy, dx );
			}
		} else {
			var dx = $.mouse.x - this.x,
				dy = $.mouse.y - this.y;
			this.direction = Math.atan2( dy, dx );
		}

		/*==============================================================================
		Fire Weapon
		==============================================================================*/
		if( this.weapon.fireRateTick < this.weapon.fireRate ){
			this.weapon.fireRateTick += $.dt;
		} else {
			// touch: the right (aim) joystick fires; desktop: depends on the
			// control mode (hybrid holds mouse, keyboard holds F, mouse LMB)
			var firing = $.vjoyRight.active || ( $.mouse.down && !$.vjoyLeft.active ) || $.autofire;
			if( controlMode === 'keyboard' && !$.isTouchDevice ) {
				firing = $.keys.state.f || $.autofire || $.vjoyRight.active;
			}
			if ( firing ) {
				$.audio.play( 'shoot' );
				if( $.powerupTimers[ 2 ] > 0 || $.powerupTimers[ 3 ] > 0 || $.powerupTimers[ 4 ] > 0) {
					$.audio.play( 'shootAlt' );
				}

				this.weapon.fireRateTick = this.weapon.fireRateTick - this.weapon.fireRate;
				this.weapon.fireFlag = 6;

				if( this.weapon.count > 1 ) {
					var spreadStart = -this.weapon.spread / 2;
					var spreadStep = this.weapon.spread / ( this.weapon.count - 1 );
				} else {
					var spreadStart = 0;
					var spreadStep = 0;
				}

				var gunX = this.x + Math.cos( this.direction ) * ( this.radius + this.weapon.bullet.size );
				var gunY = this.y + Math.sin( this.direction ) * ( this.radius + this.weapon.bullet.size );

				for( var i = 0; i < this.weapon.count; i++ ) {
					$.bulletsFired++;
					var color = this.weapon.bullet.strokeStyle;
					if( $.powerupTimers[ 2 ] > 0 || $.powerupTimers[ 3 ] > 0 || $.powerupTimers[ 4 ] > 0) {
						var colors = [];
						if( $.powerupTimers[ 2 ] > 0 ) { colors.push( 'hsl(' + $.definitions.powerups[ 2 ].hue + ', ' + $.definitions.powerups[ 2 ].saturation + '%, ' + $.definitions.powerups[ 2 ].lightness + '%)' ); }
						if( $.powerupTimers[ 3 ] > 0 ) { colors.push( 'hsl(' + $.definitions.powerups[ 3 ].hue + ', ' + $.definitions.powerups[ 3 ].saturation + '%, ' + $.definitions.powerups[ 3 ].lightness + '%)' ); }
						if( $.powerupTimers[ 4 ] > 0 ) { colors.push( 'hsl(' + $.definitions.powerups[ 4 ].hue + ', ' + $.definitions.powerups[ 4 ].saturation + '%, ' + $.definitions.powerups[ 4 ].lightness + '%)' ); }
						color = colors[ Math.floor( $.util.rand( 0, colors.length ) ) ];
					}
					$.bullets.push( new $.Bullet( {					
						x: gunX,
						y: gunY,
						speed: this.weapon.bullet.speed,
						direction: this.direction + spreadStart + i * spreadStep,
						damage: this.weapon.bullet.damage,
						size: this.weapon.bullet.size,
						lineWidth: this.weapon.bullet.lineWidth,
						strokeStyle: color,
						piercing: this.weapon.bullet.piercing || ( $.equippedDrone() && $.equippedDrone().id === 'drone_needlefinch' ),
						pierceCap: this.weapon.pierceCap,
						range: this.weapon.range,
						chain: !!( $.equippedDrone() && $.equippedDrone().id === 'drone_voltmite' )
					} ) );
				}
			}
		}

		/*==============================================================================
		Check Collisions (dash i-frames and the SHIELD powerup both protect)
		==============================================================================*/
		this.takingDamage = 0;
		var ei = ( this.dashTick > 0 || $.powerupTimers[ 5 ] > 0 ) ? 0 : $.enemies.length;
		while( ei-- ) {
			var enemy = $.enemies[ ei ];
			if( enemy.inView && $.util.distance( this.x, this.y, enemy.x, enemy.y ) <= this.radius + enemy.radius ) {
				$.particleEmitters.push( new $.ParticleEmitter( {
					x: this.x,
					y: this.y,
					count: 2,
					spawnRange: 0,
					friction: 0.85,
					minSpeed: 2,
					maxSpeed: 15,
					minDirection: 0,
					maxDirection: $.twopi,
					hue: 0,
					saturation: 0
				} ) );
				this.takingDamage = 1;
				var resist = ( this.character.ability && this.character.ability.lowHpResist && this.life < 0.35 ) ? this.character.ability.lowHpResist : 1;
				var droneResist = ( $.equippedDrone() && $.equippedDrone().id === 'drone_aegis' ) ? 0.85 : 1;
				var levelResist = $.pilotLevelDamageMult( this.character.id );
				this.life -= 0.011 * ( enemy.isBoss ? 2.5 : 1 ) * ( $.diff ? $.diff.dmg : 1 ) * $.introMult() * this.damageTakenMult * resist * droneResist * levelResist;
				// enemies shove the hero on contact
				var pushDirection = Math.atan2( this.y - enemy.y, this.x - enemy.x );
				this.vx += Math.cos( pushDirection ) * 1.6 * $.dt;
				this.vy += Math.sin( pushDirection ) * 1.6 * $.dt;
				$.breakCombo();
				$.rumble.level = 3;
				if( Math.floor( $.tick ) % 5 == 0 ){
					$.audio.play( 'takingDamage' );
				}
			}
		}		
	}
};

/*==============================================================================
Render
==============================================================================*/
$.Hero.prototype.render = function() {
	if( this.life > 0 ) {
		if( this.takingDamage ) {
			var fillStyle = 'hsla(0, 0%, ' + $.util.rand( 0, 100 ) + '%, 1)';
			$.ctxmg.fillStyle = 'hsla(0, 0%, ' + $.util.rand( 0, 100 ) + '%, ' + $.util.rand( 0.01, 0.15 ) + ')';
			$.ctxmg.fillRect( -$.screen.x, -$.screen.y, $.cw, $.ch );
		} else if( this.weapon.fireFlag > 0 ) {
			this.weapon.fireFlag -= $.dt;
			var fillStyle = 'hsla(' + $.util.rand( 0, 359 ) + ', 100%, ' + $.util.rand( 20, 80 ) + '%, 1)';
		} else {
			var fillStyle = this.fillStyle;
		}

		$.ctxmg.save();
		$.ctxmg.translate( this.x, this.y );
		$.ctxmg.rotate( this.direction );
		this.character.draw( $.ctxmg, this.radius, fillStyle, $.tick );
		$.ctxmg.restore();

		if( $.powerupTimers[ 5 ] > 0 ) {
			$.util.strokeCircle( $.ctxmg, this.x, this.y, this.radius + 8 + Math.cos( $.tick / 5 ) * 2, 'hsla(190, 100%, 65%, 0.8)', 2 );
		}
	}
};
