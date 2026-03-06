/*==============================================================================
Definitions
==============================================================================*/
$.definitions = {};

/*==============================================================================
Audio
==============================================================================*/
$.definitions.audio = {
	'shoot': {
		count: 10,
		params: [
			[2,,0.2,,0.1753,0.64,,-0.5261,,,,,,0.5522,-0.564,,,,1,,,,,0.25]
		]
	},
	'shootAlt': {
		count: 10,
		params: [
			[0,,0.16,0.18,0.18,0.47,0.0084,-0.26,,,,,,0.74,-1,,-0.76,,1,,,,,0.15]
		]
	},
	'hit': {
		count: 10,
		params:	[
			[3,,0.0138,,0.2701,0.4935,,-0.6881,,,,,,,,,,,1,,,,,0.25],
			[0,,0.0639,,0.2425,0.7582,,-0.6217,,,,,,0.4039,,,,,1,,,,,0.25],
			[3,,0.0948,,0.2116,0.7188,,-0.6372,,,,,,,,,,,1,,,0.2236,,0.25]
		]
	},
	'explosion': {
		count: 5,
		params: [
			[3,,0.1164,0.88,0.37,0.06,,0.1599,,,,-0.0846,0.6485,,,,0.3963,-0.0946,1,,,,,0.25],
			[3,,0.2958,0.3173,0.3093,0.0665,,0.1334,,,,,,,,,,,1,,,,,0.25]
		]
	},
	'explosionAlt': {
		count: 5,
		params: [
			[3,,0.15,0.7523,0.398,0.15,,-0.18,,0.39,0.53,-0.3428,0.6918,,,0.5792,0.6,0.56,1,,,,,0.25]
		]
	},
	'takingDamage': {
		count: 5,
		params: [
			[3,,0.1606,0.5988,0.2957,0.1157,,-0.3921,,,,,,,,,0.3225,-0.2522,1,,,,,0.25],
			[3,,0.1726,0.2496,0.2116,0.0623,,-0.2096,,,,,,,,,0.2665,-0.1459,1,,,,,0.25],
			[3,,0.1645,0.7236,0.3402,0.0317,,,,,,,,,,,,,1,,,,,0.25]
		]
	},
	'death': {
		count: 1,
		params: [
			[3,,0.51,,1,0.1372,,0.02,0.1,,,,0.89,0.7751,,,-0.16,0.32,1,0.3999,0.81,,0.1999,0.15]
		]
	},
	'powerup': {
		count: 3,
		params: [
			[0,,0.01,,0.4384,0.2,,0.12,0.28,1,0.65,,,0.0419,,,,,1,,,,,0.4]
		]
	},
	'levelup': {
		count: 2,
		params: [
			[2,1,0.01,,0.84,0.19,,,,0.62,0.7,,,-0.7248,0.8522,,,,1,,,,,0.45]
		]
	},
	'hover': {
		count: 10,
		params: [
			[0,0.08,0.18,,,0.65,,1,1,,,0.94,1,,,,-0.3,1,1,,,0.3,0.5,0.35]
		]
	},
	'click': {
		count: 5,
		params: [
			[3,,0.18,,,1,,-1,-1,,,,,,,,,,1,,,0.64,,0.35]
		]
	},
	'bossWarning': {
		count: 3,
		params: [
			[2,,0.3,0.5,0.5,0.08,,0.2,,,0.5,-0.3,0.7,,,0.5,,0.3,1,,,,,0.35]
		]
	},
	'bossDeath': {
		count: 2,
		params: [
			[3,,0.4,0.9,0.8,0.04,,0.1,0.1,,,-0.1,0.9,0.8,,,-0.2,0.5,1,0.4,0.9,,0.2,0.2]
		]
	},
	'dash': {
		count: 5,
		params: [
			[0,,0.05,,0.3,0.5,,-0.4,,,,,,0.3,,,,,1,,,,,0.2]
		]
	},
	'bomb': {
		count: 3,
		params: [
			[3,,0.3,0.7,0.6,0.05,,0.15,0.15,,0.4,-0.2,0.8,0.6,,,0.4,0.4,1,0.3,0.7,,0.15,0.25]
		]
	}
};

/*==============================================================================
Enemies
==============================================================================*/
$.definitions.enemies = [	
	{ // Enemy 0 - horizontal / vertical	
		value: 5,
		speed: 1.5,
		life: 1,
		radius: 15,
		hue: 180,
		lockBounds: 1,
		setup: function() {
			if( this.start == 'top' ){
				this.direction = $.pi / 2;
			} else if( this.start == 'right' ) {
				this.direction = -$.pi;
			} else if( this.start == 'bottom' ) {
				this.direction = -$.pi / 2;
			} else {
				this.direction = 0;
			}
		},
		behavior: function() {
			var speed = this.speed;
			if( $.slow ) {
				speed = this.speed / $.slowEnemyDivider; 
			}

			this.vx = Math.cos( this.direction ) * speed;
			this.vy = Math.sin( this.direction ) * speed;
		}
	},	
	{ // Enemy 1 - diagonal	
		value: 10,
		speed: 1.5,
		life: 2,
		radius: 15,
		hue: 120,
		lockBounds: 1,
		setup: function() {
			var rand = Math.floor( $.util.rand( 0, 2 ) );
			if( this.start == 'top' ){				
				this.direction = ( rand ) ? $.pi / 2 + $.pi / 4: $.pi / 2 - $.pi / 4;
			} else if( this.start == 'right' ) {
				this.direction = ( rand ) ? -$.pi + $.pi / 4 : -$.pi - $.pi / 4;
			} else if( this.start == 'bottom' ) {
				this.direction = ( rand ) ? -$.pi / 2 + $.pi / 4 : -$.pi / 2 - $.pi / 4;
			} else {
				this.direction = ( rand ) ? $.pi / 4 : -$.pi / 4;
			}
		},
		behavior: function() {
			var speed = this.speed;
			if( $.slow ) {
				speed = this.speed / $.slowEnemyDivider; 
			}

			this.vx = Math.cos( this.direction ) * speed;
			this.vy = Math.sin( this.direction ) * speed;
		}
	},
	{ // Enemy 2 - move directly hero
		value: 15,
		speed: 1.5,
		life: 2,
		radius: 20,
		hue: 330,
		behavior: function() {
			var speed = this.speed;
			if( $.slow ) {
				speed = this.speed / $.slowEnemyDivider; 
			}

			var dx = $.hero.x - this.x,
				dy = $.hero.y - this.y,
				direction = Math.atan2( dy, dx );
			this.vx = Math.cos( direction ) * speed;
			this.vy = Math.sin( direction ) * speed;
		}
	},
	{ // Enemy 3 - splitter
		value: 20,
		speed: 0.5,
		life: 3,
		radius: 50,
		hue: 210,
		canSpawn: 1,
		behavior: function() {
			var speed = this.speed;
			if( $.slow ) {
				speed = this.speed / $.slowEnemyDivider; 
			}

			var dx = $.hero.x - this.x,
				dy = $.hero.y - this.y,
				direction = Math.atan2( dy, dx );
			this.vx = Math.cos( direction ) * speed;
			this.vy = Math.sin( direction ) * speed;
		},
		death: function() {
			if( this.canSpawn ) {
				for( var i = 0; i < 4; i++ ) {
					var enemy = $.spawnEnemy( this.type );
					enemy.radius = 20;
					enemy.canSpawn = 0;
					enemy.speed = 1;
					enemy.life = 1;
					enemy.value = 5;
					enemy.x = this.x;
					enemy.y = this.y;
					if( i == 0 ) {
						enemy.x -= 45;
					} else if( i == 1 ) {
						enemy.x += 45;
					} else if( i == 2 ) {
						enemy.y -= 45;
					} else {
						enemy.y += 45;
					}
					$.enemies.push( enemy );
				}
			}
		}
	},
	{ // Enemy 4 - wanderer
		value: 25,
		speed: 2,
		life: 4,
		radius: 20,
		hue: 30,
		lockBounds: 1,
		setup: function() {
			if( this.start == 'top' ){
				this.direction = $.pi / 2;
			} else if( this.start == 'right' ) {
				this.direction = -$.pi;
			} else if( this.start == 'bottom' ) {
				this.direction = -$.pi / 2;
			} else {
				this.direction = 0;
			}
		},
		behavior: function() {
			var speed = this.speed * $.util.rand( 1, 2 );
			if( $.slow ) {
				speed = this.speed / $.slowEnemyDivider; 
			}
			
			this.direction +=  $.util.rand( -0.15, 0.15 );
			this.vx = Math.cos( this.direction ) * speed;
			this.vy = Math.sin( this.direction ) * speed;
		}
	},
	{ // Enemy 5 - stealth, hard to see - move directly hero
		value: 30,
		speed: 1,
		life: 3,
		radius: 20,
		hue: 0,
		saturation: 0,
		lightness: 30,
		behavior: function() {
			var speed = this.speed;
			if( $.slow ) {
				speed = this.speed / $.slowEnemyDivider; 
			}

			var dx = $.hero.x - this.x,
				dy = $.hero.y - this.y,
				direction = Math.atan2( dy, dx );
			this.vx = Math.cos( direction ) * speed;
			this.vy = Math.sin( direction ) * speed;
		}
	},
	{ // Enemy 6 - big strong slow fatty (explodes on death)
		value: 35,
		speed: 0.25,
		life: 8,
		radius: 80,
		hue: 150,
		behavior: function() {
			var speed = this.speed;
			if( $.slow ) {
				speed = this.speed / $.slowEnemyDivider;
			}

			var dx = $.hero.x - this.x,
				dy = $.hero.y - this.y,
				direction = Math.atan2( dy, dx );
			this.vx = Math.cos( direction ) * speed;
			this.vy = Math.sin( direction ) * speed;
		},
		death: function() {
			// Explode on death - area damage to hero if nearby
			var dx = $.hero.x - this.x,
				dy = $.hero.y - this.y,
				dist = Math.sqrt( dx * dx + dy * dy ),
				blastRadius = this.radius * 3;
			if( dist < blastRadius && !$.shielded ) {
				var dmg = 0.15 * ( 1 - dist / blastRadius );
				$.hero.life -= dmg;
				$.hero.takingDamage = 1;
				$.rumble.level = 8;
				$.audio.play( 'explosion' );
			}
			// Big visual explosion
			$.particleEmitters.push( new $.ParticleEmitter( {
				x: this.x,
				y: this.y,
				count: 25,
				spawnRange: this.radius,
				friction: 0.9,
				minSpeed: 3,
				maxSpeed: 15,
				minDirection: 0,
				maxDirection: $.twopi,
				hue: 0,
				saturation: 100
			} ) );
		}
	},
	{ // Enemy 7 - small weak speedy (dodges bullets)
		value: 40,
		speed: 2.5,
		life: 1,
		radius: 15,
		hue: 300,
		dodgeCooldown: 0,
		behavior: function() {
			var speed = this.speed;
			if( $.slow ) {
				speed = this.speed / $.slowEnemyDivider;
			}

			var dx = $.hero.x - this.x,
				dy = $.hero.y - this.y,
				direction = Math.atan2( dy, dx );
			direction = direction + Math.cos( $.tick / 50 ) * 1;

			// Dodge incoming bullets
			if( this.dodgeCooldown > 0 ) {
				this.dodgeCooldown -= $.dt;
			} else {
				var bi = $.bullets.length;
				while( bi-- ) {
					var b = $.bullets[ bi ];
					var bDist = Math.sqrt( ( b.x - this.x ) * ( b.x - this.x ) + ( b.y - this.y ) * ( b.y - this.y ) );
					if( bDist < 80 ) {
						// Dodge perpendicular to bullet direction
						var dodgeDir = b.direction + ( Math.random() > 0.5 ? $.pi / 2 : -$.pi / 2 );
						this.vx = Math.cos( dodgeDir ) * speed * 3;
						this.vy = Math.sin( dodgeDir ) * speed * 3;
						this.dodgeCooldown = 30;
						return;
					}
				}
			}

			this.vx = Math.cos( direction ) * speed;
			this.vy = Math.sin( direction ) * speed;
		}
	},
	{ // Enemy 8 - strong grower, move to hero
		value: 45,
		speed: 1.5,
		growth: 0.1,
		life: 6,
		radius: 20,
		hue: 0,
		saturation: 0,
		lightness: 100,
		behavior: function() {
			var speed = this.speed,
				growth = this.growth;
			if( $.slow ) {
				speed = this.speed / $.slowEnemyDivider;
				growth = this.growth / $.slowEnemyDivider;
			}

			var dx = $.hero.x - this.x,
				dy = $.hero.y - this.y,
				direction = Math.atan2( dy, dx );			

			if( Math.sqrt(dx * dx + dy * dy ) > 200 ) {
				this.vx = Math.cos( direction ) * speed;
				this.vy = Math.sin( direction ) * speed;
				this.fillStyle ='hsla(' + this.hue + ', ' + this.saturation + '%, ' + this.lightness + '%, 0.1)';
				this.strokeStyle = 'hsla(' + this.hue + ', ' + this.saturation + '%, ' + this.lightness + '%, 1)';
			} else {
				this.vx += $.util.rand( -0.25, 0.25 );
				this.vy += $.util.rand( -0.25, 0.25 );
				this.radius += growth * $.dt;
				var hue = $.util.rand( 0, 360 );
					lightness = $.util.rand( 50, 80 );
				this.fillStyle ='hsla(' + hue + ', 100%, ' + lightness + '%, 0.2)';
				this.strokeStyle = 'hsla(' + hue + ', 100%, ' + lightness + '%, 1)';
			}
		}
	},
	{ // Enemy 9 - circle around hero
		value: 50,
		speed: 0.5,
		angleSpeed: 0.015,
		life: 2,
		radius: 20,
		hue: 60,
		setup: function() {
			var dx = this.x - $.hero.x,
				dy = this.y - $.hero.y;
			this.angle = Math.atan2( dy, dx );
			this.distance = Math.sqrt( dx * dx + dy * dy );		
			if( Math.random() > 0.5 ) {
				this.angleSpeed = -this.angleSpeed;
			}
		},
		behavior: function() {
			var speed = this.speed,
				angleSpeed = this.angleSpeed;
			if( $.slow) {
				speed = this.speed / $.slowEnemyDivider; 
				angleSpeed = this.angleSpeed / $.slowEnemyDivider;
			}

			this.distance -= speed * $.dt;
			this.angle += angleSpeed * $.dt;

			this.vx = ( ( $.hero.x + Math.cos( this.angle ) * this.distance ) - this.x ) / 50;
			this.vy = ( ( $.hero.y + Math.sin( this.angle ) * this.distance ) - this.y ) / 50;
		}
	},
	{ // Enemy 10 - spawner
		value: 55,
		speed: 1,
		life: 3,
		radius: 45,
		hue: 0,
		canSpawn: 1,
		spawnTick: 0,
		spawnMax: 250,
		behavior: function() {
			var speed = this.speed;
			if( $.slow ) {
				speed = this.speed / $.slowEnemyDivider; 
			}

			var dx = $.hero.x - this.x,
				dy = $.hero.y - this.y,
				direction = Math.atan2( dy, dx );
				direction = direction + Math.cos( $.tick / 50 ) * 1;
			this.vx = Math.cos( direction ) * speed;
			this.vy = Math.sin( direction ) * speed;

			if( this.canSpawn ) {				
				if( this.spawnTick < this.spawnMax ) {
					this.spawnTick += $.dt;
				} else {
					this.spawnTick = 0;
					var enemy = $.spawnEnemy( this.type );
					enemy.radius = 20;
					enemy.canSpawn = 0;
					enemy.speed = 3;
					enemy.life = 1;
					enemy.value = 30;
					enemy.x = this.x;
					enemy.y = this.y;
					$.enemies.push( enemy );
				}
			} 
		}
	},
	{ // Enemy 11 - random location strong tower (buff aura)
		value: 60,
		speed: 1.5,
		life: 10,
		radius: 30,
		hue: 90,
		buffRadius: 200,
		buffTick: 0,
		setup: function(){
			this.xTarget = $.util.rand( 50, $.ww - 50 );
			this.yTarget = $.util.rand( 50, $.wh - 50 );
		},
		behavior: function() {
			var speed = this.speed;
			if( $.slow ) {
				speed = this.speed / $.slowEnemyDivider;
			}
			var dx = this.xTarget - this.x,
				dy = this.yTarget - this.y,
				direction = Math.atan2( dy, dx );
			if( Math.sqrt( dx * dx + dy * dy) > this.speed ) {
				this.vx = Math.cos( direction ) * speed;
				this.vy = Math.sin( direction ) * speed;
			} else {
				this.vx = 0;
				this.vy = 0;

				// Buff nearby allies when stationary
				this.buffTick += $.dt;
				if( this.buffTick >= 60 ) {
					this.buffTick = 0;
					var ei = $.enemies.length;
					while( ei-- ) {
						var ally = $.enemies[ ei ];
						if( ally !== this && ally.index !== this.index ) {
							var adx = ally.x - this.x,
								ady = ally.y - this.y,
								aDist = Math.sqrt( adx * adx + ady * ady );
							if( aDist < this.buffRadius ) {
								ally.speed = Math.min( ally.speed * 1.1, 8 );
								ally.buffed = 20;
							}
						}
					}
				}
			}
		}
	},
	{ // Enemy 12 - speedy random direction, no homing
		value: 65,
		speed: 6,
		life: 1,
		radius: 5,
		hue: 0,
		lockBounds: 1,
		setup: function() {
			this.radius = $.util.rand( 15, 35 );
			this.speed = $.util.rand( 3, 8 );
			if( Math.random() > 0.5 ){
				if( this.start == 'top' ){
					this.direction = $.pi / 2;
				} else if( this.start == 'right' ) {
					this.direction = -$.pi;
				} else if( this.start == 'bottom' ) {
					this.direction = -$.pi / 2;
				} else {
					this.direction = 0;
				}
			} else {
				var rand = Math.floor( $.util.rand( 0, 2 ) );
				if( this.start == 'top' ){				
					this.direction = ( rand ) ? $.pi / 2 + $.pi / 4: $.pi / 2 - $.pi / 4;
				} else if( this.start == 'right' ) {
					this.direction = ( rand ) ? -$.pi + $.pi / 4 : -$.pi - $.pi / 4;
				} else if( this.start == 'bottom' ) {
					this.direction = ( rand ) ? -$.pi / 2 + $.pi / 4 : -$.pi / 2 - $.pi / 4;
				} else {
					this.direction = ( rand ) ? $.pi / 4 : -$.pi / 4;
				}
			}
		},
		behavior: function() {
			var speed = this.speed;
			if( $.slow ) {
				speed = this.speed / $.slowEnemyDivider; 
			}
			this.vx = Math.cos( this.direction ) * speed;
			this.vy = Math.sin( this.direction ) * speed;
			this.hue += 10;
			this.lightness = 50;
			this.fillStyle = 'hsla(' + this.hue + ', 100%, ' + this.lightness + '%, 0.2)';
			this.strokeStyle = 'hsla(' + this.hue + ', 100%, ' + this.lightness + '%, 1)';
		}
	},
	{ // Enemy 13 - Shooter: keeps distance, fires bullets at player
		value: 70,
		speed: 1,
		life: 4,
		radius: 25,
		hue: 15,
		fireTick: 0,
		fireMax: 120,
		preferredDist: 300,
		behavior: function() {
			var speed = this.speed;
			if( $.slow ) {
				speed = this.speed / $.slowEnemyDivider;
			}

			var dx = $.hero.x - this.x,
				dy = $.hero.y - this.y,
				dist = Math.sqrt( dx * dx + dy * dy ),
				direction = Math.atan2( dy, dx );

			// Keep preferred distance from player
			if( dist > this.preferredDist + 50 ) {
				this.vx = Math.cos( direction ) * speed;
				this.vy = Math.sin( direction ) * speed;
			} else if( dist < this.preferredDist - 50 ) {
				this.vx = -Math.cos( direction ) * speed;
				this.vy = -Math.sin( direction ) * speed;
			} else {
				// Strafe sideways
				this.vx = Math.cos( direction + $.pi / 2 ) * speed * 0.5;
				this.vy = Math.sin( direction + $.pi / 2 ) * speed * 0.5;
			}

			// Fire bullets at player
			this.fireTick += $.dt;
			if( this.fireTick >= this.fireMax ) {
				this.fireTick = 0;
				var bulletSpeed = 3;
				if( $.slow ) { bulletSpeed = bulletSpeed / $.slowEnemyDivider; }
				$.enemyBullets.push( new $.EnemyBullet( {
					x: this.x,
					y: this.y,
					direction: direction,
					speed: bulletSpeed,
					radius: 4,
					damage: 0.05,
					hue: this.hue
				} ) );
			}
		}
	},
	{ // Enemy 14 - Teleporter: blinks around, appears near player
		value: 75,
		speed: 0.5,
		life: 2,
		radius: 18,
		hue: 270,
		teleportTick: 0,
		teleportMax: 150,
		teleportWarning: 30,
		opacity: 1,
		behavior: function() {
			var speed = this.speed;
			if( $.slow ) {
				speed = this.speed / $.slowEnemyDivider;
			}

			this.teleportTick += $.dt;

			if( this.teleportTick >= this.teleportMax - this.teleportWarning ) {
				// Fading out before teleport
				this.opacity = Math.max( 0.1, 1 - ( this.teleportTick - ( this.teleportMax - this.teleportWarning ) ) / this.teleportWarning );
				this.fillStyle = 'hsla(' + this.hue + ', 100%, 50%, ' + ( this.opacity * 0.1 ) + ')';
				this.strokeStyle = 'hsla(' + this.hue + ', 100%, 50%, ' + this.opacity + ')';
			}

			if( this.teleportTick >= this.teleportMax ) {
				this.teleportTick = 0;
				// Teleport to random position near player
				var angle = $.util.rand( 0, $.twopi ),
					dist = $.util.rand( 100, 250 );
				this.x = $.hero.x + Math.cos( angle ) * dist;
				this.y = $.hero.y + Math.sin( angle ) * dist;
				// Clamp to bounds
				this.x = Math.max( this.radius, Math.min( $.ww - this.radius, this.x ) );
				this.y = Math.max( this.radius, Math.min( $.wh - this.radius, this.y ) );
				this.opacity = 1;
				this.fillStyle = 'hsla(' + this.hue + ', 100%, 50%, 0.1)';
				this.strokeStyle = 'hsla(' + this.hue + ', 100%, 50%, 1)';
				// Flash effect on arrival
				$.particleEmitters.push( new $.ParticleEmitter( {
					x: this.x,
					y: this.y,
					count: 6,
					spawnRange: this.radius,
					friction: 0.85,
					minSpeed: 3,
					maxSpeed: 8,
					minDirection: 0,
					maxDirection: $.twopi,
					hue: this.hue,
					saturation: 100
				} ) );
			}

			// Slowly drift toward player between teleports
			var dx = $.hero.x - this.x,
				dy = $.hero.y - this.y,
				direction = Math.atan2( dy, dx );
			this.vx = Math.cos( direction ) * speed;
			this.vy = Math.sin( direction ) * speed;
		}
	},
	{ // Enemy 15 - Shield Bearer: has a directional shield blocking bullets from front
		value: 80,
		speed: 1,
		life: 4,
		radius: 25,
		hue: 50,
		saturation: 100,
		lightness: 70,
		shieldAngle: 0,
		shieldArc: 1.2,
		behavior: function() {
			var speed = this.speed;
			if( $.slow ) {
				speed = this.speed / $.slowEnemyDivider;
			}

			var dx = $.hero.x - this.x,
				dy = $.hero.y - this.y,
				direction = Math.atan2( dy, dx );

			this.shieldAngle = direction;
			this.vx = Math.cos( direction ) * speed;
			this.vy = Math.sin( direction ) * speed;
		}
	},
	{ // Enemy 16 - Swarm: small enemies that coordinate in groups
		value: 10,
		speed: 2,
		life: 1,
		radius: 10,
		hue: 290,
		saturation: 80,
		lightness: 60,
		swarmOffset: 0,
		behavior: function() {
			var speed = this.speed;
			if( $.slow ) {
				speed = this.speed / $.slowEnemyDivider;
			}

			var dx = $.hero.x - this.x,
				dy = $.hero.y - this.y,
				direction = Math.atan2( dy, dx );

			// Add swarm wobble - each swarm member oscillates differently
			direction += Math.sin( $.tick / 20 + this.swarmOffset ) * 0.8;
			this.vx = Math.cos( direction ) * speed;
			this.vy = Math.sin( direction ) * speed;

			// Color pulse
			var pulse = Math.sin( $.tick / 10 + this.swarmOffset ) * 20 + 60;
			this.fillStyle = 'hsla(' + this.hue + ', ' + this.saturation + '%, ' + pulse + '%, 0.2)';
			this.strokeStyle = 'hsla(' + this.hue + ', ' + this.saturation + '%, ' + pulse + '%, 1)';
		},
		setup: function() {
			this.swarmOffset = $.util.rand( 0, $.twopi );
		}
	}
];

/*==============================================================================
Boss Enemies
==============================================================================*/
$.definitions.bosses = [
	{ // Boss 0 - Titan: huge, slow, fires spread shots, spawns minions
		title: 'TITAN',
		value: 500,
		speed: 0.4,
		life: 80,
		radius: 100,
		hue: 0,
		saturation: 100,
		lightness: 50,
		fireTick: 0,
		fireMax: 80,
		spawnTick: 0,
		spawnMax: 300,
		isBoss: 1,
		setup: function() {},
		behavior: function() {
			var speed = this.speed;
			if( $.slow ) { speed = this.speed / $.slowEnemyDivider; }

			var dx = $.hero.x - this.x,
				dy = $.hero.y - this.y,
				direction = Math.atan2( dy, dx );
			this.vx = Math.cos( direction ) * speed;
			this.vy = Math.sin( direction ) * speed;

			// Spread shot
			this.fireTick += $.dt;
			if( this.fireTick >= this.fireMax ) {
				this.fireTick = 0;
				var bulletSpeed = 2.5;
				if( $.slow ) { bulletSpeed = bulletSpeed / $.slowEnemyDivider; }
				for( var a = -2; a <= 2; a++ ) {
					$.enemyBullets.push( new $.EnemyBullet( {
						x: this.x,
						y: this.y,
						direction: direction + a * 0.3,
						speed: bulletSpeed,
						radius: 6,
						damage: 0.04,
						hue: this.hue
					} ) );
				}
				$.audio.play( 'shootAlt' );
			}

			// Spawn minions periodically
			this.spawnTick += $.dt;
			if( this.spawnTick >= this.spawnMax ) {
				this.spawnTick = 0;
				for( var s = 0; s < 3; s++ ) {
					var enemy = $.spawnEnemy( 2 );
					enemy.x = this.x + $.util.rand( -60, 60 );
					enemy.y = this.y + $.util.rand( -60, 60 );
					enemy.life = 1;
					enemy.speed = 2;
					enemy.value = 10;
					enemy.radius = 12;
					$.enemies.push( enemy );
				}
			}

			// Pulsing color
			var pulse = Math.sin( $.tick / 15 ) * 20 + 50;
			this.fillStyle = 'hsla(' + this.hue + ', 100%, ' + pulse + '%, 0.15)';
			this.strokeStyle = 'hsla(' + this.hue + ', 100%, ' + pulse + '%, 1)';
		},
		death: function() {
			// Massive explosion
			for( var e = 0; e < 5; e++ ) {
				$.explosions.push( new $.Explosion( {
					x: this.x + $.util.rand( -50, 50 ),
					y: this.y + $.util.rand( -50, 50 ),
					radius: $.util.rand( 40, 80 ),
					hue: this.hue,
					saturation: 100
				} ) );
			}
			$.particleEmitters.push( new $.ParticleEmitter( {
				x: this.x, y: this.y, count: 50, spawnRange: this.radius,
				friction: 0.92, minSpeed: 5, maxSpeed: 25,
				minDirection: 0, maxDirection: $.twopi, hue: this.hue, saturation: 100
			} ) );
			$.audio.play( 'bossDeath' );
			$.rumble.level = 30;
		}
	},
	{ // Boss 1 - Phantom: teleports frequently, fires homing shots, creates decoys
		title: 'PHANTOM',
		value: 600,
		speed: 1,
		life: 60,
		radius: 70,
		hue: 270,
		saturation: 100,
		lightness: 60,
		fireTick: 0,
		fireMax: 60,
		teleportTick: 0,
		teleportMax: 120,
		opacity: 1,
		isBoss: 1,
		setup: function() {},
		behavior: function() {
			var speed = this.speed;
			if( $.slow ) { speed = this.speed / $.slowEnemyDivider; }

			var dx = $.hero.x - this.x,
				dy = $.hero.y - this.y,
				direction = Math.atan2( dy, dx );

			// Teleport
			this.teleportTick += $.dt;
			if( this.teleportTick >= this.teleportMax - 20 ) {
				this.opacity = Math.max( 0.1, 1 - ( this.teleportTick - ( this.teleportMax - 20 ) ) / 20 );
			}
			if( this.teleportTick >= this.teleportMax ) {
				this.teleportTick = 0;
				var angle = $.util.rand( 0, $.twopi ),
					dist = $.util.rand( 150, 350 );
				this.x = $.hero.x + Math.cos( angle ) * dist;
				this.y = $.hero.y + Math.sin( angle ) * dist;
				this.x = Math.max( this.radius, Math.min( $.ww - this.radius, this.x ) );
				this.y = Math.max( this.radius, Math.min( $.wh - this.radius, this.y ) );
				this.opacity = 1;
				// Spawn a decoy on teleport
				var decoy = $.spawnEnemy( 14 );
				decoy.x = this.x + $.util.rand( -100, 100 );
				decoy.y = this.y + $.util.rand( -100, 100 );
				decoy.life = 1;
				decoy.value = 15;
				$.enemies.push( decoy );
				$.particleEmitters.push( new $.ParticleEmitter( {
					x: this.x, y: this.y, count: 10, spawnRange: this.radius,
					friction: 0.85, minSpeed: 3, maxSpeed: 12,
					minDirection: 0, maxDirection: $.twopi, hue: this.hue, saturation: 100
				} ) );
			}

			// Fire aimed shots
			this.fireTick += $.dt;
			if( this.fireTick >= this.fireMax ) {
				this.fireTick = 0;
				var bulletSpeed = 3.5;
				if( $.slow ) { bulletSpeed = bulletSpeed / $.slowEnemyDivider; }
				$.enemyBullets.push( new $.EnemyBullet( {
					x: this.x, y: this.y, direction: direction,
					speed: bulletSpeed, radius: 5, damage: 0.06, hue: this.hue
				} ) );
				// Fire two side shots
				$.enemyBullets.push( new $.EnemyBullet( {
					x: this.x, y: this.y, direction: direction + 0.5,
					speed: bulletSpeed * 0.8, radius: 4, damage: 0.03, hue: this.hue
				} ) );
				$.enemyBullets.push( new $.EnemyBullet( {
					x: this.x, y: this.y, direction: direction - 0.5,
					speed: bulletSpeed * 0.8, radius: 4, damage: 0.03, hue: this.hue
				} ) );
			}

			this.vx = Math.cos( direction + $.pi / 2 ) * speed;
			this.vy = Math.sin( direction + $.pi / 2 ) * speed;

			this.fillStyle = 'hsla(' + this.hue + ', 100%, ' + this.lightness + '%, ' + ( this.opacity * 0.15 ) + ')';
			this.strokeStyle = 'hsla(' + this.hue + ', 100%, ' + this.lightness + '%, ' + this.opacity + ')';
		},
		death: function() {
			for( var e = 0; e < 4; e++ ) {
				$.explosions.push( new $.Explosion( {
					x: this.x + $.util.rand( -40, 40 ),
					y: this.y + $.util.rand( -40, 40 ),
					radius: $.util.rand( 30, 60 ),
					hue: this.hue, saturation: 100
				} ) );
			}
			$.particleEmitters.push( new $.ParticleEmitter( {
				x: this.x, y: this.y, count: 40, spawnRange: this.radius,
				friction: 0.9, minSpeed: 5, maxSpeed: 20,
				minDirection: 0, maxDirection: $.twopi, hue: this.hue, saturation: 100
			} ) );
			$.audio.play( 'bossDeath' );
			$.rumble.level = 25;
		}
	},
	{ // Boss 2 - Overlord: orbits with shield segments, fires ring patterns, buffs all enemies
		title: 'OVERLORD',
		value: 800,
		speed: 0.6,
		life: 100,
		radius: 90,
		hue: 45,
		saturation: 100,
		lightness: 60,
		fireTick: 0,
		fireMax: 100,
		ringTick: 0,
		ringMax: 200,
		buffTick: 0,
		shieldAngle: 0,
		shieldArc: 2.0,
		isBoss: 1,
		setup: function() {},
		behavior: function() {
			var speed = this.speed;
			if( $.slow ) { speed = this.speed / $.slowEnemyDivider; }

			var dx = $.hero.x - this.x,
				dy = $.hero.y - this.y,
				direction = Math.atan2( dy, dx ),
				dist = Math.sqrt( dx * dx + dy * dy );

			// Orbit player at distance
			if( dist > 350 ) {
				this.vx = Math.cos( direction ) * speed * 1.5;
				this.vy = Math.sin( direction ) * speed * 1.5;
			} else if( dist < 250 ) {
				this.vx = -Math.cos( direction ) * speed;
				this.vy = -Math.sin( direction ) * speed;
			} else {
				this.vx = Math.cos( direction + $.pi / 2 ) * speed;
				this.vy = Math.sin( direction + $.pi / 2 ) * speed;
			}

			// Rotating shield faces player
			this.shieldAngle = direction;

			// Fire aimed shots
			this.fireTick += $.dt;
			if( this.fireTick >= this.fireMax ) {
				this.fireTick = 0;
				var bulletSpeed = 3;
				if( $.slow ) { bulletSpeed = bulletSpeed / $.slowEnemyDivider; }
				$.enemyBullets.push( new $.EnemyBullet( {
					x: this.x, y: this.y, direction: direction,
					speed: bulletSpeed, radius: 7, damage: 0.05, hue: this.hue
				} ) );
			}

			// Ring burst
			this.ringTick += $.dt;
			if( this.ringTick >= this.ringMax ) {
				this.ringTick = 0;
				var bulletSpeed = 2;
				if( $.slow ) { bulletSpeed = bulletSpeed / $.slowEnemyDivider; }
				for( var r = 0; r < 12; r++ ) {
					$.enemyBullets.push( new $.EnemyBullet( {
						x: this.x, y: this.y,
						direction: ( $.twopi / 12 ) * r,
						speed: bulletSpeed, radius: 5, damage: 0.03, hue: this.hue
					} ) );
				}
				$.audio.play( 'shootAlt' );
			}

			// Buff all enemies periodically
			this.buffTick += $.dt;
			if( this.buffTick >= 120 ) {
				this.buffTick = 0;
				var ei = $.enemies.length;
				while( ei-- ) {
					var ally = $.enemies[ ei ];
					if( ally !== this ) {
						ally.speed = Math.min( ally.speed * 1.15, 8 );
						ally.buffed = 30;
					}
				}
			}

			var pulse = Math.sin( $.tick / 10 ) * 15 + 60;
			this.fillStyle = 'hsla(' + this.hue + ', 100%, ' + pulse + '%, 0.15)';
			this.strokeStyle = 'hsla(' + this.hue + ', 100%, ' + pulse + '%, 1)';
		},
		death: function() {
			for( var e = 0; e < 8; e++ ) {
				$.explosions.push( new $.Explosion( {
					x: this.x + $.util.rand( -60, 60 ),
					y: this.y + $.util.rand( -60, 60 ),
					radius: $.util.rand( 50, 100 ),
					hue: this.hue, saturation: 100
				} ) );
			}
			$.particleEmitters.push( new $.ParticleEmitter( {
				x: this.x, y: this.y, count: 60, spawnRange: this.radius,
				friction: 0.93, minSpeed: 5, maxSpeed: 30,
				minDirection: 0, maxDirection: $.twopi, hue: this.hue, saturation: 100
			} ) );
			$.audio.play( 'bossDeath' );
			$.rumble.level = 35;
		}
	}
];

/*==============================================================================
Levels
==============================================================================*/
$.definitions.levels = [];
var base = 25;
for( var i = 0; i < $.definitions.enemies.length; i++ ){
	var distribution = [];
	for( var di = 0; di < i + 1; di++ ) {
		var value = ( di == i ) ? Math.floor( ( ( i + 1) * base ) * 0.75 ) : ( i + 1) * base;
		value = ( i == 0 ) ? base : value;		
		distribution.push( value );
	}
	$.definitions.levels.push( {
		killsToLevel: 10 + ( i + 1 ) * 7,
		distribution: distribution
	} );
}

/*==============================================================================
Powerups
==============================================================================*/
$.definitions.powerups = [
	{
		title: 'HEALTH PACK',
		hue: 0,
		saturation: 0,
		lightness: 100
	},
	{
		title: 'SLOW ENEMIES',
		hue: 200,
		saturation: 0,
		lightness: 100
	},
	{
		title: 'FAST SHOT',
		hue: 100,
		saturation: 100,
		lightness: 60
	},
	{
		title: 'TRIPLE SHOT',
		hue: 200,
		saturation: 100,
		lightness: 60
	},
	{
		title: 'PIERCE SHOT',
		hue: 0,
		saturation: 100,
		lightness: 60
	},
	{
		title: 'SHIELD',
		hue: 180,
		saturation: 100,
		lightness: 80
	},
	{
		title: 'SPEED BOOST',
		hue: 50,
		saturation: 100,
		lightness: 60
	},
	{
		title: 'MAGNET',
		hue: 300,
		saturation: 100,
		lightness: 70
	}
];

/*==============================================================================
Letters
==============================================================================*/
$.definitions.letters = {
	'1': [
		 [  , ,  1,  , 0 ],
		 [  , 1, 1,  , 0 ],
		 [  ,  , 1,  , 0 ],
		 [  ,  , 1,  , 0 ],
		 [ 1, 1, 1, 1, 1 ]
		 ],
	'2': [
		 [ 1, 1, 1, 1, 0 ],
		 [  ,  ,  ,  , 1 ],
		 [  , 1, 1, 1, 0 ],
		 [ 1,  ,  ,  , 0 ],
		 [ 1, 1, 1, 1, 1 ]
		 ],
	'3': [
		 [ 1, 1, 1, 1, 0 ],
		 [  ,  ,  ,  , 1 ],
		 [  , 1, 1, 1, 1 ],
		 [  ,  ,  ,  , 1 ],
		 [ 1, 1, 1, 1, 0 ]
		 ],
	'4': [
		 [ 1,  ,  , 1, 0 ],
		 [ 1,  ,  , 1, 0 ],
		 [ 1, 1, 1, 1, 1 ],
		 [  ,  ,  , 1, 0 ],
		 [  ,  ,  , 1, 0 ]
		 ],
	'5': [
		 [ 1, 1, 1, 1, 1 ],
		 [ 1,  ,  ,  , 0 ],
		 [ 1, 1, 1, 1, 0 ],
		 [  ,  ,  ,  , 1 ],
		 [ 1, 1, 1, 1, 0 ]
		 ],
	'6': [
		 [  , 1, 1, 1, 0 ],
		 [ 1,  ,  ,  , 0 ],
		 [ 1, 1, 1, 1, 0 ],
		 [ 1,  ,  ,  , 1 ],
		 [  , 1, 1, 1, 0 ]
		 ],
	'7': [
		 [ 1, 1, 1, 1, 1 ],
		 [  ,  ,  ,  , 1 ],
		 [  ,  ,  , 1, 0 ],
		 [  ,  , 1,  , 0 ],
		 [  ,  , 1,  , 0 ]
		 ],
	'8': [
		 [  , 1, 1, 1, 0 ],
		 [ 1,  ,  ,  , 1 ],
		 [  , 1, 1, 1, 0 ],
		 [ 1,  ,  ,  , 1 ],
		 [  , 1, 1, 1, 0 ]
		 ],
	'9': [
		 [  , 1, 1, 1, 0 ],
		 [ 1,  ,  ,  , 1 ],
		 [  , 1, 1, 1, 1 ],
		 [  ,  ,  ,  , 1 ],
		 [  , 1, 1, 1, 0 ]
		 ],
	'0': [
		 [  , 1, 1, 1, 0 ],
		 [ 1,  ,  ,  , 1 ],
		 [ 1,  ,  ,  , 1 ],
		 [ 1,  ,  ,  , 1 ],
		 [  , 1, 1, 1, 0 ]
		 ],
	'A': [
		 [ 1, 1, 1, 1, 1 ],
		 [ 1,  ,  ,  , 1 ],
		 [ 1, 1, 1, 1, 1 ],
		 [ 1,  ,  ,  , 1 ],
		 [ 1,  ,  ,  , 1 ]
		 ],
	'B': [
		 [ 1, 1, 1, 1, 0 ],
		 [ 1,  ,  , 1, 0 ],
		 [ 1, 1, 1, 1, 1 ],
		 [ 1,  ,  ,  , 1 ],
		 [ 1, 1, 1, 1, 1 ]
		 ],
	'C': [
		 [ 1, 1, 1, 1, 1 ],
		 [ 1,  ,  ,  , 0 ],
		 [ 1,  ,  ,  , 0 ],
		 [ 1,  ,  ,  , 0 ],
		 [ 1, 1, 1, 1, 1 ]
		 ],
	'D': [
		 [ 1, 1, 1,  , 0 ],
		 [ 1,  ,  , 1, 0 ],
		 [ 1,  ,  ,  , 1 ],
		 [ 1,  ,  ,  , 1 ],
		 [ 1, 1, 1, 1, 1 ]
		 ],
	'E': [
		 [ 1, 1, 1, 1, 1 ],
		 [ 1,  ,  ,  , 0 ],
		 [ 1, 1, 1,  , 0 ],
		 [ 1,  ,  ,  , 0 ],
		 [ 1, 1, 1, 1, 1 ]
		 ],
	'F': [
		 [ 1, 1, 1, 1, 1 ],
		 [ 1,  ,  ,  , 0 ],
		 [ 1, 1, 1,  , 0 ],
		 [ 1,  ,  ,  , 0 ],
		 [ 1,  ,  ,  , 0 ]
		 ],
	'G': [
		 [ 1, 1, 1, 1, 1 ],
		 [ 1,  ,  ,  , 0 ],
		 [ 1,  , 1, 1, 1 ],
		 [ 1,  ,  ,  , 1 ],
		 [ 1, 1, 1, 1, 1 ]
		 ],
	'H': [
		 [ 1,  ,  ,  , 1 ],
		 [ 1,  ,  ,  , 1 ],
		 [ 1, 1, 1, 1, 1 ],
		 [ 1,  ,  ,  , 1 ],
		 [ 1,  ,  ,  , 1 ]
		 ],
	'I': [
		 [ 1, 1, 1, 1, 1 ],
		 [  ,  , 1,  , 0 ],
		 [  ,  , 1,  , 0 ],
		 [  ,  , 1,  , 0 ],
		 [ 1, 1, 1, 1, 1 ]
		 ],
	'J': [
		 [  ,  ,  ,  , 1 ],
		 [  ,  ,  ,  , 1 ],
		 [  ,  ,  ,  , 1 ],
		 [ 1,  ,  ,  , 1 ],
		 [ 1, 1, 1, 1, 1 ]
		 ],
	'K': [
		 [ 1,  ,  , 1, 0 ],
		 [ 1,  , 1,  , 0 ],
		 [ 1, 1, 1,  , 0 ],
		 [ 1,  ,  , 1, 0 ],
		 [ 1,  ,  ,  , 1 ]
		 ],
	'L': [
		 [ 1,  ,  ,  , 0 ],
		 [ 1,  ,  ,  , 0 ],
		 [ 1,  ,  ,  , 0 ],
		 [ 1,  ,  ,  , 0 ],
		 [ 1, 1, 1, 1, 1 ]
		 ],
	'M': [
		 [ 1,  ,  ,  , 1 ],
		 [ 1, 1,  , 1, 1 ],
		 [ 1,  , 1,  , 1 ],
		 [ 1,  ,  ,  , 1 ],
		 [ 1,  ,  ,  , 1 ]
		 ],
	'N': [
		 [ 1,  ,  ,  , 1 ],
		 [ 1, 1,  ,  , 1 ],
		 [ 1,  , 1,  , 1 ],
		 [ 1,  ,  , 1, 1 ],
		 [ 1,  ,  ,  , 1 ]
		 ],  
	'O': [
		 [ 1, 1, 1, 1, 1 ],
		 [ 1,  ,  ,  , 1 ],
		 [ 1,  ,  ,  , 1 ],
		 [ 1,  ,  ,  , 1 ],
		 [ 1, 1, 1, 1, 1 ]
		 ],
	'P': [
		 [ 1, 1, 1, 1, 1 ],
		 [ 1,  ,  ,  , 1 ],
		 [ 1, 1, 1, 1, 1 ],
		 [ 1,  ,  ,  , 0 ],
		 [ 1,  ,  ,  , 0 ]
		 ],
	'Q': [
		 [ 1, 1, 1, 1, 0 ],
		 [ 1,  ,  , 1, 0 ],
		 [ 1,  ,  , 1, 0 ],
		 [ 1,  ,  , 1, 0 ],
		 [ 1, 1, 1, 1, 1 ]
		 ],
	'R': [
		 [ 1, 1, 1, 1, 1 ],
		 [ 1,  ,  ,  , 1 ],
		 [ 1, 1, 1, 1, 1 ],
		 [ 1,  ,  , 1, 0 ],
		 [ 1,  ,  ,  , 1 ]
		 ],
	'S': [
		 [ 1, 1, 1, 1, 1 ],
		 [ 1,  ,  ,  , 0 ],
		 [ 1, 1, 1, 1, 1 ],
		 [  ,  ,  ,  , 1 ],
		 [ 1, 1, 1, 1, 1 ]
		 ],
	'T': [
		 [ 1, 1, 1, 1, 1 ],
		 [  ,  , 1,  , 0 ],
		 [  ,  , 1,  , 0 ],
		 [  ,  , 1,  , 0 ],
		 [  ,  , 1,  , 0 ]
		 ],
	'U': [
		 [ 1,  ,  ,  , 1 ],
		 [ 1,  ,  ,  , 1 ],
		 [ 1,  ,  ,  , 1 ],
		 [ 1,  ,  ,  , 1 ],
		 [ 1, 1, 1, 1, 1 ]
		 ],
	'V': [
		 [ 1,  ,  ,  , 1 ],
		 [ 1,  ,  ,  , 1 ],
		 [ 1,  ,  ,  , 1 ],
		 [  , 1,  , 1, 0 ],
		 [  ,  , 1,  , 0 ]
		 ],
	'W': [
		 [ 1,  ,  ,  , 1 ],
		 [ 1,  ,  ,  , 1 ],
		 [ 1,  , 1,  , 1 ],
		 [ 1, 1,  , 1, 1 ],
		 [ 1,  ,  ,  , 1 ]
		 ],
	'X': [
		 [ 1,  ,  ,  , 1 ],
		 [  , 1,  , 1, 0 ],
		 [  ,  , 1,  , 0 ],
		 [  , 1,  , 1, 0 ],
		 [ 1,  ,  ,  , 1 ]
		 ],
	'Y': [
		 [ 1,  ,  ,  , 1 ],
		 [ 1,  ,  ,  , 1 ],
		 [ 1, 1, 1, 1, 1 ],
		 [  ,  , 1,  , 0 ],
		 [  ,  , 1,  , 0 ]
		 ],
	'Z': [
		 [ 1, 1, 1, 1, 1 ],
		 [  ,  ,  , 1, 0 ],
		 [  ,  , 1,  , 0 ],
		 [  , 1,  ,  , 0 ],
		 [ 1, 1, 1, 1, 1 ]
		 ],   
	' ': [
		 [  ,  ,  ,  , 0 ],
		 [  ,  ,  ,  , 0 ],
		 [  ,  ,  ,  , 0 ],
		 [  ,  ,  ,  , 0 ],
		 [  ,  ,  ,  , 0 ]
		 ],
	',': [
		 [  ,  ,  ,  , 0 ],
		 [  ,  ,  ,  , 0 ],
		 [  ,  ,  ,  , 0 ],
		 [  ,  , 1,  , 0 ],
		 [  ,  , 1,  , 0 ]
		 ],
	'+': [
		 [  ,  ,  ,  , 0 ],
		 [  ,  , 1,  , 0 ],
		 [  , 1, 1, 1, 0 ],
		 [  ,  , 1,  , 0 ],
		 [  ,  ,  ,  , 0 ]
		 ],
	'/': [
		 [  ,  ,  ,  , 1 ],
		 [  ,  ,  , 1, 0 ],
		 [  ,  , 1,  , 0 ],
		 [  , 1,  ,  , 0 ],
		 [ 1,  ,  ,  , 0 ]
		 ],
	':': [
		 [  ,  ,  ,  , 0 ],
		 [  ,  , 1,  , 0 ],
		 [  ,  ,  ,  , 0 ],
		 [  ,  , 1,  , 0 ],
		 [  ,  ,  ,  , 0 ]
		 ],
	'@': [
		 [  1, 1, 1, 1, 1 ],
		 [   ,  ,  ,  , 1 ],
		 [  1, 1, 1,  , 1 ],
		 [  1,  , 1,  , 1 ],
		 [  1, 1, 1, 1, 1 ]
		 ]
};
