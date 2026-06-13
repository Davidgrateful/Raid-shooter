/*==============================================================================
Sector Definitions
==============================================================================*/
$.definitions.sectors = [
	{ title: 'DEEP SPACE', hue: -1, hazard: null },
	{ title: 'ASTEROID BELT', hue: 30, hazard: 'asteroids' },
	{ title: 'BLACK HOLE ZONE', hue: 260, hazard: 'blackhole' },
	{ title: 'SOLAR STORM', hue: 10, hazard: 'flares' }
];

/*==============================================================================
Sector State
==============================================================================*/
$.resetSector = function() {
	$.sectorIndex = -1;
	$.asteroids = [];
	$.flare = null;
	$.flareTimer = 480;
	$.boss = null;
	$.bossDraftQueued = 0;
	$.bossAnnounceTick = 0;
	$.updateSector();
	// no announcement for the starting sector
	$.sectorAnnounceTick = 0;
};

$.updateSector = function() {
	var index = Math.floor( $.level.current / 5 ) % $.definitions.sectors.length;
	if( index !== $.sectorIndex ) {
		$.sectorIndex = index;
		$.sector = $.definitions.sectors[ index ];
		$.sectorAnnounceTick = 200;
		$.asteroids.length = 0;
		$.flare = null;
		$.flareTimer = 480;
		$.spawnProps();
	}
};

// ambient drifting wreckage: pure decor, sells the sector as a real place
$.spawnProps = function() {
	$.props = [];
	var hue = ( $.sector.hue >= 0 ) ? $.sector.hue : 210;
	for( var i = 0; i < 7; i++ ) {
		var points = [];
		for( var p = 0; p < 7; p++ ) {
			points.push( $.util.rand( 0.5, 1.3 ) );
		}
		$.props.push( {
			x: $.util.rand( 0, $.ww ),
			y: $.util.rand( 0, $.wh ),
			vx: $.util.rand( -0.35, 0.35 ),
			vy: $.util.rand( -0.35, 0.35 ),
			radius: $.util.rand( 14, 42 ),
			rotation: $.util.rand( 0, $.twopi ),
			rotationSpeed: $.util.rand( -0.008, 0.008 ),
			hue: hue,
			points: points
		} );
	}
};

$.updateProps = function() {
	if( !$.props ) {
		return;
	}
	for( var i = 0; i < $.props.length; i++ ) {
		var prop = $.props[ i ];
		prop.x += prop.vx * $.dt;
		prop.y += prop.vy * $.dt;
		prop.rotation += prop.rotationSpeed * $.dt;
		if( prop.x < -60 ) { prop.x = $.ww + 60; }
		if( prop.x > $.ww + 60 ) { prop.x = -60; }
		if( prop.y < -60 ) { prop.y = $.wh + 60; }
		if( prop.y > $.wh + 60 ) { prop.y = -60; }
	}
};

$.renderProps = function() {
	if( !$.props ) {
		return;
	}
	for( var i = 0; i < $.props.length; i++ ) {
		var prop = $.props[ i ];
		$.ctxmg.save();
		$.ctxmg.translate( prop.x, prop.y );
		$.ctxmg.rotate( prop.rotation );
		$.ctxmg.beginPath();
		for( var p = 0; p < prop.points.length; p++ ) {
			var angle = ( p / prop.points.length ) * $.twopi,
				pr = prop.radius * prop.points[ p ];
			if( p === 0 ) { $.ctxmg.moveTo( Math.cos( angle ) * pr, Math.sin( angle ) * pr ); } else { $.ctxmg.lineTo( Math.cos( angle ) * pr, Math.sin( angle ) * pr ); }
		}
		$.ctxmg.closePath();
		$.ctxmg.fillStyle = 'hsla(' + prop.hue + ', 20%, 16%, 0.55)';
		$.ctxmg.fill();
		$.ctxmg.strokeStyle = 'hsla(' + prop.hue + ', 25%, 30%, 0.5)';
		$.ctxmg.lineWidth = 1;
		$.ctxmg.stroke();
		$.ctxmg.restore();
	}
};

/*==============================================================================
Hazard Helpers
==============================================================================*/
// damage-over-time path that avoids the per-frame hit sound spam of
// receiveDamage; the death flow still goes through receiveDamage
$.hazardDamageEnemy = function( enemy, ei, amount ) {
	// bosses shrug off environmental damage so hazards can't cheese them
	if( enemy.isBoss ) {
		return;
	}
	enemy.life -= amount;
	enemy.hitFlag = 5;
	if( enemy.life <= 0 ) {
		enemy.receiveDamage( ei, 0 );
	}
};

$.hazardDamageHero = function( amount ) {
	if( $.hero.life > 0 && $.hero.dashTick <= 0 && $.powerupTimers[ 5 ] <= 0 ) {
		$.hero.life -= amount * $.hero.damageTakenMult;
		$.hero.takingDamage = 1;
		$.breakCombo();
		if( Math.floor( $.tick ) % 5 == 0 ) {
			$.audio.play( 'takingDamage' );
		}
	}
};

/*==============================================================================
Hazard Update
==============================================================================*/
$.updateHazards = function() {
	if( $.sectorAnnounceTick > 0 ) {
		$.sectorAnnounceTick -= $.dt;
	}
	if( $.bossAnnounceTick > 0 ) {
		$.bossAnnounceTick -= $.dt;
	}

	var hazard = $.sector.hazard;

	/*==============================================================================
	Asteroid Belt
	==============================================================================*/
	if( hazard === 'asteroids' ) {
		if( $.asteroids.length < 8 && Math.floor( $.tick ) % 90 === 0 ) {
			var coords = $.getSpawnCoordinates( 60 ),
				rock = {
					x: coords.x,
					y: coords.y,
					radius: $.util.rand( 25, 55 ),
					life: 3,
					rotation: $.util.rand( 0, $.twopi ),
					rotationSpeed: $.util.rand( -0.02, 0.02 ),
					points: []
				},
				drift = $.util.rand( 0.5, 1.6 ),
				driftDirection = Math.atan2( $.wh / 2 - rock.y, $.ww / 2 - rock.x ) + $.util.rand( -0.6, 0.6 );
			rock.vx = Math.cos( driftDirection ) * drift;
			rock.vy = Math.sin( driftDirection ) * drift;
			for( var p = 0; p < 9; p++ ) {
				rock.points.push( $.util.rand( 0.75, 1.2 ) );
			}
			$.asteroids.push( rock );
		}

		var ai = $.asteroids.length;
		while( ai-- ) {
			var rock = $.asteroids[ ai ];
			rock.x += rock.vx * $.dt;
			rock.y += rock.vy * $.dt;
			rock.rotation += rock.rotationSpeed * $.dt;

			if( !$.util.arcInRect( rock.x, rock.y, rock.radius + 80, 0, 0, $.ww, $.wh ) ) {
				$.asteroids.splice( ai, 1 );
				continue;
			}

			// rocks crush enemies that cross the belt
			var ei = $.enemies.length;
			while( ei-- ) {
				var enemy = $.enemies[ ei ];
				if( $.util.distance( rock.x, rock.y, enemy.x, enemy.y ) <= rock.radius + enemy.radius ) {
					$.hazardDamageEnemy( enemy, ei, 0.06 * $.dt );
				}
			}

			// and hurt the hero on contact (the dash slips through)
			if( $.util.distance( rock.x, rock.y, $.hero.x, $.hero.y ) <= rock.radius + $.hero.radius ) {
				$.hazardDamageHero( 0.0075 );
			}

			// bullets chip away and can shatter rocks
			var bi = $.bullets.length;
			while( bi-- ) {
				var bullet = $.bullets[ bi ];
				if( $.util.distance( rock.x, rock.y, bullet.x, bullet.y ) <= rock.radius ) {
					$.bullets.splice( bi, 1 );
					rock.life -= bullet.damage;
					$.particleEmitters.push( new $.ParticleEmitter( {
						x: bullet.x,
						y: bullet.y,
						count: 2,
						spawnRange: 0,
						friction: 0.85,
						minSpeed: 2,
						maxSpeed: 8,
						minDirection: 0,
						maxDirection: $.twopi,
						hue: 30,
						saturation: 20
					} ) );
					if( rock.life <= 0 ) {
						$.explosions.push( new $.Explosion( {
							x: rock.x,
							y: rock.y,
							radius: rock.radius,
							hue: 30,
							saturation: 20
						} ) );
						$.asteroids.splice( ai, 1 );
						break;
					}
				}
			}
		}
	}

	/*==============================================================================
	Black Hole Zone
	==============================================================================*/
	if( hazard === 'blackhole' ) {
		var cx = $.ww / 2,
			cy = $.wh / 2;

		// pull the hero inward
		var dx = cx - $.hero.x,
			dy = cy - $.hero.y,
			dist = Math.max( 1, Math.sqrt( dx * dx + dy * dy ) ),
			pull = 0.12 * Math.max( 0, 1 - dist / 2200 );
		$.hero.vx += ( dx / dist ) * pull * $.dt;
		$.hero.vy += ( dy / dist ) * pull * $.dt;
		if( dist < 120 && $.hero.life > 0 && $.hero.dashTick <= 0 && $.powerupTimers[ 5 ] <= 0 ) {
			// the singularity does not negotiate
			$.hero.life = 0;
		}

		// drag enemies in and crush them at the core
		var ei = $.enemies.length;
		while( ei-- ) {
			var enemy = $.enemies[ ei ];
			if( enemy.isBoss ) {
				continue;
			}
			var edx = cx - enemy.x,
				edy = cy - enemy.y,
				edist = Math.max( 1, Math.sqrt( edx * edx + edy * edy ) ),
				epull = 0.5 * Math.max( 0, 1 - edist / 2200 );
			enemy.x += ( edx / edist ) * epull * $.dt;
			enemy.y += ( edy / edist ) * epull * $.dt;
			if( edist < 110 ) {
				$.hazardDamageEnemy( enemy, ei, 0.05 * $.dt );
			}
		}

		// bend bullets toward the singularity
		for( var bi = 0; bi < $.bullets.length; bi++ ) {
			var bullet = $.bullets[ bi ],
				toCenter = Math.atan2( cy - bullet.y, cx - bullet.x ),
				diff = toCenter - bullet.direction;
			while( diff > $.pi ) { diff -= $.twopi; }
			while( diff < -$.pi ) { diff += $.twopi; }
			bullet.direction += diff * 0.0035 * $.dt;
		}
	}

	/*==============================================================================
	Solar Storm
	==============================================================================*/
	if( hazard === 'flares' ) {
		if( !$.flare ) {
			$.flareTimer -= $.dt;
			if( $.flareTimer <= 0 ) {
				var dir = ( Math.random() > 0.5 ) ? 1 : -1;
				$.flare = {
					dir: dir,
					warnTick: 90,
					width: 90,
					speed: 7,
					x: ( dir > 0 ) ? -100 : $.ww + 100
				};
				$.audio.play( 'explosionAlt' );
			}
		} else if( $.flare.warnTick > 0 ) {
			$.flare.warnTick -= $.dt;
		} else {
			$.flare.x += $.flare.dir * $.flare.speed * $.dt;

			if( Math.abs( $.hero.x - $.flare.x ) < $.flare.width ) {
				$.hazardDamageHero( 0.0045 * $.dt );
			}

			var ei = $.enemies.length;
			while( ei-- ) {
				var enemy = $.enemies[ ei ];
				if( Math.abs( enemy.x - $.flare.x ) < $.flare.width ) {
					$.hazardDamageEnemy( enemy, ei, 0.05 * $.dt );
				}
			}

			if( ( $.flare.dir > 0 && $.flare.x > $.ww + 100 ) || ( $.flare.dir < 0 && $.flare.x < -100 ) ) {
				$.flare = null;
				$.flareTimer = $.util.rand( 420, 700 );
			}
		}
	}
};

/*==============================================================================
Hazard Render (world space, called inside the screen translate)
==============================================================================*/
$.renderHazards = function() {
	var hazard = $.sector.hazard;

	if( hazard === 'asteroids' ) {
		for( var ai = 0; ai < $.asteroids.length; ai++ ) {
			var rock = $.asteroids[ ai ];
			$.ctxmg.save();
			$.ctxmg.translate( rock.x, rock.y );
			$.ctxmg.rotate( rock.rotation );
			$.ctxmg.beginPath();
			for( var p = 0; p < rock.points.length; p++ ) {
				var angle = ( p / rock.points.length ) * $.twopi,
					pr = rock.radius * rock.points[ p ];
				if( p === 0 ) {
					$.ctxmg.moveTo( Math.cos( angle ) * pr, Math.sin( angle ) * pr );
				} else {
					$.ctxmg.lineTo( Math.cos( angle ) * pr, Math.sin( angle ) * pr );
				}
			}
			$.ctxmg.closePath();
			$.ctxmg.fillStyle = 'hsla(30, 15%, 28%, 1)';
			$.ctxmg.fill();
			$.ctxmg.strokeStyle = 'hsla(30, 20%, 45%, 1)';
			$.ctxmg.lineWidth = 2;
			$.ctxmg.stroke();
			$.ctxmg.restore();
		}
	}

	if( hazard === 'blackhole' ) {
		var cx = $.ww / 2,
			cy = $.wh / 2;
		$.util.fillCircle( $.ctxmg, cx, cy, 200, 'hsla(260, 100%, 60%, 0.06)' );
		$.util.fillCircle( $.ctxmg, cx, cy, 110, 'hsla(0, 0%, 0%, 0.95)' );
		$.util.strokeCircle( $.ctxmg, cx, cy, 118, 'hsla(260, 100%, 65%, 0.7)', 3 );
		$.ctxmg.strokeStyle = 'hsla(280, 100%, 75%, 0.5)';
		$.ctxmg.lineWidth = 2;
		for( var s = 0; s < 3; s++ ) {
			var swirl = $.tick / 30 + ( s * $.twopi / 3 );
			$.ctxmg.beginPath();
			$.ctxmg.arc( cx, cy, 135 + s * 22, swirl, swirl + $.pi / 1.5 );
			$.ctxmg.stroke();
		}
	}

	if( hazard === 'flares' && $.flare ) {
		if( $.flare.warnTick > 0 ) {
			// flashing warning band at the entry edge
			if( Math.floor( $.tick / 6 ) % 2 ) {
				$.ctxmg.fillStyle = 'hsla(15, 100%, 55%, 0.25)';
				$.ctxmg.fillRect( $.flare.x - 20, 0, 40, $.wh );
			}
		} else {
			var gradient = $.ctxmg.createLinearGradient( $.flare.x - $.flare.width, 0, $.flare.x + $.flare.width, 0 );
			gradient.addColorStop( 0, 'hsla(15, 100%, 55%, 0)' );
			gradient.addColorStop( 0.5, 'hsla(25, 100%, 60%, 0.45)' );
			gradient.addColorStop( 1, 'hsla(15, 100%, 55%, 0)' );
			$.ctxmg.fillStyle = gradient;
			$.ctxmg.fillRect( $.flare.x - $.flare.width, 0, $.flare.width * 2, $.wh );
			$.ctxmg.fillStyle = 'hsla(40, 100%, 75%, 0.8)';
			$.ctxmg.fillRect( $.flare.x - 2, 0, 4, $.wh );
			if( Math.floor( $.tick ) % 3 === 0 ) {
				$.particleEmitters.push( new $.ParticleEmitter( {
					x: $.flare.x + $.util.rand( -$.flare.width, $.flare.width ),
					y: -$.screen.y + $.util.rand( 0, $.ch ),
					count: 1,
					spawnRange: 5,
					friction: 0.9,
					minSpeed: 1,
					maxSpeed: 5,
					minDirection: 0,
					maxDirection: $.twopi,
					hue: 25
				} ) );
			}
		}
	}
};

/*==============================================================================
Sector Overlay (screen space: tint, announcements, boss health bar)
==============================================================================*/
$.renderSectorOverlay = function() {
	if( $.sector.hue >= 0 ) {
		$.ctxmg.fillStyle = 'hsla(' + $.sector.hue + ', 60%, 20%, 0.10)';
		$.ctxmg.fillRect( 0, 0, $.cw, $.ch );
	}

	if( $.sectorAnnounceTick > 0 ) {
		var alpha = Math.min( 1, $.sectorAnnounceTick / 50 ) * Math.min( 1, ( 200 - $.sectorAnnounceTick ) / 30 );
		$.ctxmg.beginPath();
		$.text( {
			ctx: $.ctxmg,
			x: $.cw / 2,
			y: $.ch * 0.32,
			text: 'ENTERING ' + $.sector.title,
			hspacing: 3,
			vspacing: 1,
			halign: 'center',
			valign: 'center',
			scale: 4,
			snap: 1,
			render: 1
		} );
		$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, ' + ( alpha * 0.8 ) + ')';
		$.ctxmg.fill();
	}

	if( $.bossAnnounceTick > 0 ) {
		var bossAlpha = Math.min( 1, $.bossAnnounceTick / 50 ) * Math.min( 1, ( 200 - $.bossAnnounceTick ) / 30 );
		if( Math.floor( $.tick / 10 ) % 2 ) {
			bossAlpha *= 0.5;
		}
		$.ctxmg.beginPath();
		$.text( {
			ctx: $.ctxmg,
			x: $.cw / 2,
			y: $.ch * 0.42,
			text: 'WARNING: ' + ( $.boss ? $.boss.title : '' ),
			hspacing: 3,
			vspacing: 1,
			halign: 'center',
			valign: 'center',
			scale: 4,
			snap: 1,
			render: 1
		} );
		$.ctxmg.fillStyle = 'hsla(0, 100%, 60%, ' + ( bossAlpha * 0.9 ) + ')';
		$.ctxmg.fill();
	}

	if( $.boss && $.boss.life > 0 ) {
		var barWidth = Math.min( 420, $.cw - 200 ),
			barX = ( $.cw - barWidth ) / 2,
			barY = 104;
		$.ctxmg.beginPath();
		$.text( {
			ctx: $.ctxmg,
			x: $.cw / 2,
			y: barY - 6,
			text: $.boss.title,
			hspacing: 2,
			vspacing: 1,
			halign: 'center',
			valign: 'bottom',
			scale: 1,
			snap: 1,
			render: 1
		} );
		$.ctxmg.fillStyle = 'hsla(0, 100%, 70%, 0.9)';
		$.ctxmg.fill();
		$.ctxmg.fillStyle = 'hsla(0, 0%, 15%, 1)';
		$.ctxmg.fillRect( barX, barY, barWidth, 8 );
		$.ctxmg.fillStyle = 'hsla(0, 100%, 45%, 1)';
		$.ctxmg.fillRect( barX, barY, ( $.boss.life / $.boss.lifeMax ) * barWidth, 8 );
		$.ctxmg.fillStyle = 'hsla(0, 100%, 70%, 1)';
		$.ctxmg.fillRect( barX, barY, ( $.boss.life / $.boss.lifeMax ) * barWidth, 4 );
	}
};

/*==============================================================================
Boss: Asteroid King
==============================================================================*/
$.spawnBossChunks = function( boss, count ) {
	for( var i = 0; i < count; i++ ) {
		var angle = ( $.twopi / count ) * i + $.util.rand( -0.3, 0.3 );
		$.enemies.push( new $.Enemy( {
			value: 15,
			speed: $.util.rand( 1.2, 2 ),
			life: 3,
			radius: 24,
			hue: 30,
			saturation: 30,
			x: boss.x + Math.cos( angle ) * ( boss.radius + 30 ),
			y: boss.y + Math.sin( angle ) * ( boss.radius + 30 ),
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
		} ) );
	}
};

$.spawnBoss = function() {
	var coords = $.getSpawnCoordinates( 90 ),
		levelScale = 1 + $.level.current * 0.16,
		sectorIdx = $.sectorIndex % 3;

	// each sector family fields its own boss with its own attack
	var variants = [
		{ title: 'ASTEROID KING', hue: 30, saturation: 40, speed: 1.6, burstCount: 14, burstSpeed: 7, burstEvery: 150, spikes: 1, spiral: 1 },
		{ title: 'VOID TYRANT', hue: 270, saturation: 90, speed: 1.4, burstCount: 18, burstSpeed: 5.5, burstEvery: 130, pull: 1, rings: 1, spiral: 1 },
		{ title: 'SOLAR WARDEN', hue: 10, saturation: 100, speed: 1.9, burstCount: 7, burstSpeed: 9, burstEvery: 90, aimed: 1, flames: 1, spiral: 1 }
	];
	var variant = variants[ sectorIdx ];

	var boss = new $.Enemy( {
		value: 750,
		speed: variant.speed,
		life: 170 * levelScale,
		radius: 90,
		hue: variant.hue,
		saturation: variant.saturation,
		isBoss: 1,
		title: variant.title,
		variant: variant,
		x: coords.x,
		y: coords.y,
		chargeTick: 0,
		chargeCooldown: 70,
		spiralTick: 0,
		spiralAngle: 0,
		burstTick: 0,
		charging: 0,
		chargeDir: 0,
		phase: 0,
		behavior: function() {
			var speed = this.speed;
			if( $.slow ) {
				speed = this.speed / $.slowEnemyDivider;
			}
			var dx = $.hero.x - this.x,
				dy = $.hero.y - this.y,
				dist = Math.max( 1, Math.sqrt( dx * dx + dy * dy ) ),
				direction = Math.atan2( dy, dx );

			// VOID TYRANT drags the hero toward it
			if( this.variant.pull && dist < 900 ) {
				$.hero.vx += ( -dx / dist ) * -0.3 * $.dt;
				$.hero.vy += ( -dy / dist ) * -0.3 * $.dt;
			}

			// continuous spiral spitter: the boss is never not shooting
			if( this.variant.spiral ) {
				this.spiralTick += $.dt;
				if( this.spiralTick > 10 ) {
					this.spiralTick = 0;
					this.spiralAngle += 0.6;
					if( this.inView ) {
						$.audio.play( 'shoot' );
					}
					var arms = 2 + this.phase;
					for( var sp = 0; sp < arms; sp++ ) {
						var spDir = this.spiralAngle + sp * $.twopi / arms;
						$.enemies.push( new $.Enemy( {
							shape: 'shard', isBolt: 1,
							value: 5, speed: 4.5, life: 1, radius: 6,
							hue: this.variant.hue, saturation: this.variant.saturation,
							lockBounds: 1,
							x: this.x + Math.cos( spDir ) * ( this.radius + 8 ),
							y: this.y + Math.sin( spDir ) * ( this.radius + 8 ),
							direction: spDir,
							behavior: function() {
								this.vx = Math.cos( this.direction ) * this.speed;
								this.vy = Math.sin( this.direction ) * this.speed;
							}
						} ) );
					}
				}
			}

			// ranged attack, faster with every phase
			this.burstTick += $.dt;
			if( this.burstTick > this.variant.burstEvery - this.phase * 40 ) {
				this.burstTick = 0;
				if( this.inView ) {
					$.audio.play( 'shootAlt' );
				}
				var count = this.variant.burstCount + this.phase * 2;
				for( var b = 0; b < count; b++ ) {
					// SOLAR WARDEN fires tight aimed fans, others fire radially
					var burstDirection = this.variant.aimed
						? direction + ( b - ( count - 1 ) / 2 ) * 0.16
						: direction + ( b / count ) * $.twopi;
					$.enemies.push( new $.Enemy( {
						value: 5,
						speed: this.variant.burstSpeed,
						life: 1,
						radius: 7,
						hue: this.variant.hue,
						saturation: this.variant.saturation,
						lockBounds: 1,
						x: this.x + Math.cos( burstDirection ) * ( this.radius + 10 ),
						y: this.y + Math.sin( burstDirection ) * ( this.radius + 10 ),
						direction: burstDirection,
						behavior: function() {
							var rockSpeed = this.speed;
							if( $.slow ) {
								rockSpeed = this.speed / $.slowEnemyDivider;
							}
							this.vx = Math.cos( this.direction ) * rockSpeed;
							this.vy = Math.sin( this.direction ) * rockSpeed;
						}
					} ) );
				}
			}

			if( this.charging > 0 ) {
				this.charging -= $.dt;
				this.vx = Math.cos( this.chargeDir ) * 16;
				this.vy = Math.sin( this.chargeDir ) * 16;
			} else if( this.chargeTick > this.chargeCooldown ) {
				this.vx *= 0.85;
				this.vy *= 0.85;
				var flash = ( Math.floor( $.tick / 4 ) % 2 );
				this.fillStyle = flash ? 'hsla(' + this.hue + ', 80%, 70%, 0.5)' : 'hsla(' + this.hue + ', 40%, 50%, 0.1)';
				this.strokeStyle = flash ? 'hsla(' + this.hue + ', 100%, 85%, 1)' : 'hsla(' + this.hue + ', 40%, 50%, 1)';
				if( this.chargeTick > this.chargeCooldown + 36 ) {
					this.charging = 42;
					this.chargeTick = 0;
					this.chargeDir = direction;
					this.fillStyle = 'hsla(' + this.hue + ', 40%, 50%, 0.1)';
					this.strokeStyle = 'hsla(' + this.hue + ', 40%, 50%, 1)';
					if( this.inView ) {
						$.audio.play( 'explosion' );
					}
				}
			} else {
				this.chargeTick += $.dt;
				this.vx = Math.cos( direction ) * speed;
				this.vy = Math.sin( direction ) * speed;
			}

			// phases at 75/50/25 percent, each ejecting chunks
			var lifeRatio = this.life / this.lifeMax;
			if( ( this.phase === 0 && lifeRatio < 0.75 ) || ( this.phase === 1 && lifeRatio < 0.5 ) || ( this.phase === 2 && lifeRatio < 0.25 ) ) {
				this.phase++;
				$.spawnBossChunks( this, 4 );
				if( this.inView ) {
					$.audio.play( 'explosionAlt' );
				}
			}
		},
		renderExtra: function() {
			// distinct silhouettes per boss
			if( this.variant.spikes ) {
				$.ctxmg.fillStyle = this.strokeStyle;
				for( var s = 0; s < 8; s++ ) {
					var angle = s / 8 * $.twopi + $.tick / 60;
					$.ctxmg.save();
					$.ctxmg.translate( this.x + Math.cos( angle ) * this.radius, this.y + Math.sin( angle ) * this.radius );
					$.ctxmg.rotate( angle );
					$.ctxmg.beginPath();
					$.ctxmg.moveTo( 22, 0 ); $.ctxmg.lineTo( -8, 12 ); $.ctxmg.lineTo( -8, -12 );
					$.ctxmg.closePath();
					$.ctxmg.fill();
					$.ctxmg.restore();
				}
			}
			if( this.variant.rings ) {
				$.ctxmg.strokeStyle = 'hsla(270, 100%, 70%, 0.6)';
				$.ctxmg.lineWidth = 3;
				for( var ringIdx = 0; ringIdx < 2; ringIdx++ ) {
					var swirl = $.tick / 25 + ringIdx * $.pi;
					$.ctxmg.beginPath();
					$.ctxmg.arc( this.x, this.y, this.radius + 18 + ringIdx * 14, swirl, swirl + $.pi * 1.2 );
					$.ctxmg.stroke();
				}
			}
			if( this.variant.flames ) {
				for( var flameIdx = 0; flameIdx < 3; flameIdx++ ) {
					var fa = $.tick / 18 + flameIdx * $.twopi / 3;
					$.util.fillCircle( $.ctxmg, this.x + Math.cos( fa ) * ( this.radius + 16 ), this.y + Math.sin( fa ) * ( this.radius + 16 ), 9 + Math.cos( $.tick / 6 ) * 3, 'hsla(25, 100%, 60%, 0.7)' );
				}
			}
		},
		death: function() {
			$.spawnBossChunks( this, 5 );
			$.explosions.push( new $.Explosion( {
				x: this.x,
				y: this.y,
				radius: this.radius * 1.5,
				hue: this.hue,
				saturation: this.saturation
			} ) );
			$.boss = null;
			$.bossDraftQueued = 1;
			$.hero.life = Math.min( 1, $.hero.life + 0.35 );
			$.storage['bosskills'] = ( $.storage['bosskills'] || 0 ) + 1;
			$.updateStorage();
			// the boss kill completes the level
			$.level.kills = $.level.killsToLevel;
		}
	} );

	$.boss = boss;
	$.bossAnnounceTick = 200;
	$.enemies.push( boss );
	$.audio.play( 'death' );
};
