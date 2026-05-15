/*==============================================================================
Init
==============================================================================*/
$.init = function() {


	$.setupStorage();
	$.wrap = document.getElementById( 'wrap' );
	$.wrapInner = document.getElementById( 'wrap-inner' );
	$.cbg1 = document.getElementById( 'cbg1' );
	$.cbg2 = document.getElementById( 'cbg2' );
	$.cbg3 = document.getElementById( 'cbg3' );
	$.cbg4 = document.getElementById( 'cbg4' );
	$.cmg = document.getElementById( 'cmg' );
	$.cfg = document.getElementById( 'cfg' );
	$.ctxbg1 = $.cbg1.getContext( '2d' );
	$.ctxbg2 = $.cbg2.getContext( '2d' );
	$.ctxbg3 = $.cbg3.getContext( '2d' );
	$.ctxbg4 = $.cbg4.getContext( '2d' );
	$.ctxmg = $.cmg.getContext( '2d' );
	$.ctxfg = $.cfg.getContext( '2d' );
	$.cw = $.cmg.width = $.cfg.width = window.innerWidth;
	$.ch = $.cmg.height = $.cfg.height = window.innerHeight;
	$.wrap.style.width = $.wrapInner.style.width = $.cw + 'px';
	$.wrap.style.height = $.wrapInner.style.height = $.ch + 'px';
	$.wrap.style.marginLeft = '0px';
	$.wrap.style.marginTop = '0px';
	$.ww = Math.floor( $.cw * 2 );
	$.wh = Math.floor( $.ch * 2 );
	$.cbg1.width = Math.floor( $.cw * 1.1 );
	$.cbg1.height = Math.floor( $.ch * 1.1 );
	$.cbg2.width = Math.floor( $.cw * 1.15 );
	$.cbg2.height = Math.floor( $.ch * 1.15 );
	$.cbg3.width = Math.floor( $.cw * 1.2 );
	$.cbg3.height = Math.floor( $.ch * 1.2 );
	$.cbg4.width = Math.floor( $.cw * 1.25 );
	$.cbg4.height = Math.floor( $.ch * 1.25 );

	$.screen = {
		x: ( $.ww - $.cw ) / -2,
		y: ( $.wh - $.ch ) / -2
	};

	$.mute = $.storage['mute'];
	$.autofire = $.storage['autofire'];
	$.slowEnemyDivider = 3;

	$.vjoyLeft = {
		active: 0,
		ox: 0,
		oy: 0,
		cx: 0,
		cy: 0,
		radius: 60,
		id: null
	};
	$.vjoyRight = {
		active: 0,
		ox: 0,
		oy: 0,
		cx: 0,
		cy: 0,
		radius: 60,
		id: null
	};

	$.keys = {
		state: {
			up: 0,
			down: 0,
			left: 0,
			right: 0,
			f: 0,
			m: 0,
			p: 0
		},
		pressed: {
			up: 0,
			down: 0,
			left: 0,
			right: 0,
			f: 0,
			m: 0,
			p: 0
		}
	};
	$.okeys = {};
	$.mouse = {
		x: $.ww / 2,
		y: $.wh / 2,
		sx: 0,
		sy: 0,
		ax: window.innerWidth / 2,
		ay: 0,
		down: 0
	};
	$.buttons = [];

	$.minimap = {
		x: 20,
		y: $.ch - Math.floor( $.ch * 0.1 ) - 20,
		width: Math.floor( $.cw * 0.1 ),
		height: Math.floor( $.ch * 0.1 ),
		scale: Math.floor( $.cw * 0.1 ) / $.ww,
		color: 'hsla(0, 0%, 0%, 0.85)',
		strokeColor: '#3a3a3a'
	},
	$.cOffset = {
		left: 0,
		top: 0,
		width: 0,
		height: 0
	};

	$.levelCount = $.definitions.levels.length;
	$.states = {};
	$.state = '';
	$.enemies = [];
	$.bullets = [];
	$.explosions = [];
	$.powerups = [];
	$.particleEmitters = [];
	$.textPops = [];
	$.levelPops = [];
	$.powerupTimers = [];

	$.resizecb();
	$.bindEvents();
	$.setupStates();
	$.renderBackground1();
	$.renderBackground2();
	$.renderBackground3();
	$.renderBackground4();
	$.renderSpaceObjects();
	$.renderForeground();
	$.renderFavicon();
	$.setState( 'menu' );
	$.loop();
};

/*==============================================================================
Reset
==============================================================================*/
$.reset = function() {
	$.indexGlobal = 0;
	$.dt = 1;
	$.lt = 0;
	$.elapsed = 0;
	$.tick = 0;

	$.gameoverTick = 0;
	$.gameoverTickMax = 200;
	$.gameoverExplosion = 0;

	$.instructionTick = 0;
	$.instructionTickMax = ( $.cw < 700 ) ? 240 : 400;

	$.levelDiffOffset = 0;
	$.enemyOffsetMod = 0;
	$.slow = 0;
	$.combo = 1;
	$.comboTick = 0;
	$.comboTickMax = 180;
	$.bestCombo = 1;
	$.bossActive = 0;
	$.currentBoss = null;
	$.bossNextLevel = 3;
	$.upgradeChoices = [];
	$.newRecord = 0;
	$.difficulty = 1;
	$.mapTheme = 0;
	$.runUpgrades = {
		fireRate: 0,
		spread: 0,
		pierce: 0,
		damage: 0,
		speed: 0,
		repair: 0
	};

	$.screen = {
		x: ( $.ww - $.cw ) / -2,
		y: ( $.wh - $.ch ) / -2
	};
	$.rumble = {
		x: 0,
		y: 0,
		level: 0,
		decay: 0.4
	};

	$.mouse.down = 0;

	$.level = {
		current: 0,
		kills: 0,
		killsToLevel: $.definitions.levels[ 0 ].killsToLevel,
		distribution: $.definitions.levels[ 0 ].distribution,
		distributionCount: $.definitions.levels[ 0 ].distribution.length
	};

	$.enemies.length = 0;
	$.bullets.length = 0;
	$.enemyBullets = [];
	$.explosions.length = 0;
	$.powerups.length = 0;
	$.particleEmitters.length = 0;
	$.textPops.length = 0;
	$.levelPops.length = 0;
	$.powerupTimers.length = 0;

	for( var i = 0; i < $.definitions.powerups.length; i++ ) {
		$.powerupTimers.push( 0 );
	}

	$.kills = 0;
	$.bulletsFired = 0;
	$.bulletsHit = 0;
	$.powerupsCollected = 0;
	$.score = 0;

	$.hero = new $.Hero();

	$.levelPops.push( new $.LevelPop( {
		level: 1
	} ) );
};

/*==============================================================================
Create Favicon
==============================================================================*/
$.renderFavicon = function() {
	var favicon = document.getElementById( 'favicon' ),
		favc = document.createElement( 'canvas' ),
		favctx = favc.getContext( '2d' ),
		faviconGrid = [
			[ 1, 1, 1, 1, 1,  ,  , 1, 1, 1, 1, 1, 1, 1, 1, 1 ],
			[ 1,  ,  ,  ,  ,  ,  ,  ,  ,  ,  ,  ,  ,  ,  , 1 ],
			[ 1,  ,  ,  ,  ,  ,  ,  ,  ,  ,  ,  ,  ,  ,  , 1 ],
			[ 1,  ,  ,  ,  , 1, 1,  ,  , 1, 1, 1, 1, 1,  , 0 ],
			[ 1,  ,  ,  ,  , 1, 1,  ,  , 1, 1, 1, 1, 1,  , 0 ],
			[ 1,  ,  ,  ,  , 1, 1,  ,  , 1, 1,  ,  ,  ,  , 1 ],
			[ 1,  ,  ,  ,  , 1, 1,  ,  , 1, 1,  ,  ,  ,  , 1 ],
			[ 1,  ,  ,  ,  , 1, 1,  ,  , 1, 1,  ,  ,  ,  , 1 ],
			[ 1,  ,  ,  ,  , 1, 1,  ,  , 1, 1,  ,  ,  ,  , 1 ],
			[ 1,  ,  ,  ,  , 1, 1,  ,  , 1, 1,  ,  ,  ,  , 1 ],
			[ 1,  ,  ,  ,  , 1, 1,  ,  , 1, 1,  ,  ,  ,  , 1 ],
			[  ,  , 1, 1, 1, 1, 1,  ,  , 1, 1,  ,  ,  ,  , 1 ],
			[  ,  , 1, 1, 1, 1, 1,  ,  , 1, 1,  ,  ,  ,  , 1 ],
			[ 1,  ,  ,  ,  ,  ,  ,  ,  ,  ,  ,  ,  ,  ,  , 1 ],
			[ 1,  ,  ,  ,  ,  ,  ,  ,  ,  ,  ,  ,  ,  ,  , 1 ],
			[ 1, 1, 1, 1, 1, 1, 1, 1, 1,  ,  , 1, 1, 1, 1, 1 ]
		];
	if( !favicon ) {
		favicon = document.createElement( 'link' );
		favicon.id = 'favicon';
		favicon.rel = 'icon';
		document.head.appendChild( favicon );
	}
	favc.width = favc.height = 16;
	favctx.beginPath();
	for( var y = 0; y < 16; y++ ) {
		for( var x = 0; x < 16; x++ ) {
			if( faviconGrid[ y ][ x ] === 1 ) {
				favctx.rect( x, y, 1, 1 );
			}
		}
	}
	favctx.fill();
	favicon.href = favc.toDataURL();
};

/*==============================================================================
Render Backgrounds
==============================================================================*/
$.renderBackground1 = function() {
	var map = $.definitions.maps[ $.mapTheme || 0 ],
		hue = map ? map.hue : 210;
	var gradient = $.ctxbg1.createRadialGradient( $.cbg1.width / 2, $.cbg1.height / 2, 0, $.cbg1.width / 2, $.cbg1.height / 2, $.cbg1.height );
	gradient.addColorStop( 0, 'hsla(' + hue + ', 80%, 62%, 0.13)' );
	gradient.addColorStop( 0.65, 'hsla(0, 0%, 100%, 0)' );
	$.ctxbg1.fillStyle = gradient;
	$.ctxbg1.fillRect( 0, 0, $.cbg1.width, $.cbg1.height );

	var i = 2000;
	while( i-- ) {
		$.util.fillCircle( $.ctxbg1, $.util.rand( 0, $.cbg1.width ), $.util.rand( 0, $.cbg1.height ), $.util.rand( 0.2, 0.5 ), 'hsla(0, 0%, 100%, ' + $.util.rand( 0.05, 0.2 ) + ')' );
	}

	var i = 800;
	while( i-- ) {
		$.util.fillCircle( $.ctxbg1, $.util.rand( 0, $.cbg1.width ), $.util.rand( 0, $.cbg1.height ), $.util.rand( 0.1, 0.8 ), 'hsla(0, 0%, 100%, ' + $.util.rand( 0.05, 0.5 ) + ')' );
	}
}

$.renderBackground2 = function() {
	var map = $.definitions.maps[ $.mapTheme || 0 ],
		hue = map ? map.hue : 210;
	var i = 80;
	while( i-- ) {
		$.util.fillCircle( $.ctxbg2, $.util.rand( 0, $.cbg2.width ), $.util.rand( 0, $.cbg2.height ), $.util.rand( 1, 2 ), 'hsla(' + $.util.rand( hue - 30, hue + 30 ) + ', 80%, 70%, ' + $.util.rand( 0.05, 0.18 ) + ')' );
	}
}

$.renderBackground3 = function() {
	var map = $.definitions.maps[ $.mapTheme || 0 ],
		hue = map ? map.hue : 210;
	var i = 40;
	while( i-- ) {
		$.util.fillCircle( $.ctxbg3, $.util.rand( 0, $.cbg3.width ), $.util.rand( 0, $.cbg3.height ), $.util.rand( 1, 2.5 ), 'hsla(' + $.util.rand( hue - 60, hue + 60 ) + ', 100%, 75%, ' + $.util.rand( 0.04, 0.12 ) + ')' );
	}
}

$.renderBackground4 = function() {
	var size = 50;
	$.ctxbg4.fillStyle = 'hsla(0, 0%, 50%, 0.05)';
	var i = Math.round( $.cbg4.height / size );
	while( i-- ) {
		$.ctxbg4.fillRect( 0, i * size + 25, $.cbg4.width, 1 );
	}
	i = Math.round( $.cbg4.width / size );
	while( i-- ) {
		$.ctxbg4.fillRect( i * size, 0, 1, $.cbg4.height );
	}
}

$.renderSpaceObjects = function() {
	var map = $.definitions.maps[ $.mapTheme || 0 ],
		hue = map ? map.planetHue : 190,
		i;

	for( i = 0; i < 7; i++ ) {
		var x = $.util.rand( 80, $.cbg2.width - 80 ),
			y = $.util.rand( 80, $.cbg2.height - 80 ),
			r = $.util.rand( 18, 70 ),
			objectHue = $.util.rand( hue - 45, hue + 45 );
		$.util.fillCircle( $.ctxbg2, x, y, r, 'hsla(' + objectHue + ', 80%, 42%, 0.18)' );
		$.util.strokeCircle( $.ctxbg2, x, y, r + 4, 'hsla(' + objectHue + ', 90%, 70%, 0.18)', 2 );
		$.ctxbg2.strokeStyle = 'hsla(' + objectHue + ', 90%, 70%, 0.16)';
		$.ctxbg2.lineWidth = 2;
		$.ctxbg2.beginPath();
		$.ctxbg2.ellipse( x, y, r * 1.8, r * 0.35, $.util.rand( -0.6, 0.6 ), 0, $.twopi );
		$.ctxbg2.stroke();
	}

	for( i = 0; i < 15; i++ ) {
		var ax = $.util.rand( 0, $.cbg3.width ),
			ay = $.util.rand( 0, $.cbg3.height ),
			ar = $.util.rand( 5, 18 );
		$.ctxbg3.save();
		$.ctxbg3.translate( ax, ay );
		$.ctxbg3.rotate( $.util.rand( 0, $.twopi ) );
		$.ctxbg3.fillStyle = 'hsla(35, 15%, 62%, 0.16)';
		$.ctxbg3.beginPath();
		$.ctxbg3.moveTo( -ar, -ar * 0.3 );
		$.ctxbg3.lineTo( -ar * 0.25, -ar );
		$.ctxbg3.lineTo( ar, -ar * 0.2 );
		$.ctxbg3.lineTo( ar * 0.35, ar );
		$.ctxbg3.lineTo( -ar * 0.8, ar * 0.55 );
		$.ctxbg3.closePath();
		$.ctxbg3.fill();
		$.ctxbg3.restore();
	}

	for( i = 0; i < 4; i++ ) {
		var px = $.util.rand( 80, $.cbg1.width - 80 ),
			py = $.util.rand( 80, $.cbg1.height - 80 ),
			pr = $.util.rand( 24, 44 );
		$.ctxbg1.strokeStyle = 'hsla(150, 100%, 60%, 0.18)';
		$.ctxbg1.lineWidth = 4;
		$.ctxbg1.beginPath();
		$.ctxbg1.arc( px, py, pr, 0, $.twopi );
		$.ctxbg1.stroke();
		$.ctxbg1.strokeStyle = 'hsla(280, 100%, 65%, 0.12)';
		$.ctxbg1.beginPath();
		$.ctxbg1.arc( px, py, pr * 0.65, 0, $.twopi );
		$.ctxbg1.stroke();
	}
};

$.refreshMap = function() {
	$.ctxbg1.clearRect( 0, 0, $.cbg1.width, $.cbg1.height );
	$.ctxbg2.clearRect( 0, 0, $.cbg2.width, $.cbg2.height );
	$.ctxbg3.clearRect( 0, 0, $.cbg3.width, $.cbg3.height );
	$.ctxbg4.clearRect( 0, 0, $.cbg4.width, $.cbg4.height );
	$.renderBackground1();
	$.renderBackground2();
	$.renderBackground3();
	$.renderBackground4();
	$.renderSpaceObjects();
};

/*==============================================================================
Render Foreground
==============================================================================*/
$.renderForeground = function() {
	var gradient = $.ctxfg.createRadialGradient( $.cw / 2, $.ch / 2, $.ch / 3, $.cw / 2, $.ch / 2, $.ch );
	gradient.addColorStop( 0, 'hsla(0, 0%, 0%, 0)' );
	gradient.addColorStop( 1, 'hsla(0, 0%, 0%, 0.5)' );
	$.ctxfg.fillStyle = gradient;
	$.ctxfg.fillRect( 0, 0, $.cw, $.ch );

	$.ctxfg.fillStyle = 'hsla(0, 0%, 50%, 0.1)';
	var i = Math.round( $.ch / 2 );
	while( i-- ) {
		$.ctxfg.fillRect( 0, i * 2, $.cw, 1 );
	}

	var gradient2 = $.ctxfg.createLinearGradient( $.cw, 0, 0, $.ch );
	gradient2.addColorStop( 0, 'hsla(0, 0%, 100%, 0.04)' );
	gradient2.addColorStop( 0.75, 'hsla(0, 0%, 100%, 0)' );
	$.ctxfg.beginPath();
	$.ctxfg.moveTo( 0, 0 );
	$.ctxfg.lineTo( $.cw, 0 );
	$.ctxfg.lineTo( 0, $.ch );
	$.ctxfg.closePath();
	$.ctxfg.fillStyle = gradient2;
	$.ctxfg.fill();
}

/*==============================================================================
User Interface / UI / GUI / Minimap
==============================================================================*/

$.renderInterface = function() {
	/*==============================================================================
	Powerup Timers
	==============================================================================*/
		for( var i = 0; i < $.definitions.powerups.length; i++ ) {
			var powerup = $.definitions.powerups[ i ],
				powerupOn = ( $.powerupTimers[ i ] > 0 );
			$.ctxmg.beginPath();
			var powerupText = $.text( {
				ctx: $.ctxmg,
				x: $.minimap.x + $.minimap.width + 90,
				y: $.minimap.y + 4 + ( i * 12 ),
				text: powerup.title,
				hspacing: 1,
				vspacing: 1,
				halign: 'right',
				valign: 'top',
				scale: 1,
				snap: 1,
				render: 1
			} );
			if( powerupOn ) {
				$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, ' + ( 0.25 + ( ( $.powerupTimers[ i ] / 300 ) * 0.75 ) ) + ')';
			} else {
				$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.25)';
			}
			$.ctxmg.fill();
			if( powerupOn ) {
				var powerupBar = {
					x: powerupText.ex + 5,
					y: powerupText.sy,
					width: 110,
					height: 5
				};
				$.ctxmg.fillStyle = 'hsl(' + powerup.hue + ', ' + powerup.saturation + '%, ' + powerup.lightness + '%)';
				$.ctxmg.fillRect( powerupBar.x, powerupBar.y, ( $.powerupTimers[ i ] / 300 ) * powerupBar.width, powerupBar.height );
			}
		}

		/*==============================================================================
		Instructions
		==============================================================================*/
		if( $.instructionTick < $.instructionTickMax ){
			$.instructionTick += $.dt;
			var instructionScale = ( $.cw < 700 ) ? 1 : 2,
				instructionSpacing = ( $.cw < 700 ) ? 10 : 17,
				instructionY = ( $.cw < 700 ) ? $.ch - 12 : $.ch - 20;
			$.ctxmg.beginPath();
			$.text( {
				ctx: $.ctxmg,
				x: $.cw / 2 - 10,
				y: instructionY,
				text: 'MOVE\nAIM/FIRE\nAUTOFIRE\nPAUSE\nMUTE',
				hspacing: 1,
				vspacing: instructionSpacing,
				halign: 'right',
				valign: 'bottom',
				scale: instructionScale,
				snap: 1,
				render: 1
			} );
			if( $.instructionTick < $.instructionTickMax * 0.25 ) {
				var alpha = ( $.instructionTick / ( $.instructionTickMax * 0.25 ) ) * 0.5;
			} else if( $.instructionTick > $.instructionTickMax - $.instructionTickMax * 0.25 ) {
				var alpha = ( ( $.instructionTickMax - $.instructionTick ) / ( $.instructionTickMax * 0.25 ) ) * 0.5;
			} else {
				var alpha = 0.5;
			}
			alpha = Math.min( 1, Math.max( 0, alpha ) );

			$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, ' + alpha + ')';
			$.ctxmg.fill();

			$.ctxmg.beginPath();
			$.text( {
				ctx: $.ctxmg,
				x: $.cw / 2 + 10,
				y: instructionY,
				text: 'WASD/ARROWS\nMOUSE\nF\nP\nM',
				hspacing: 1,
				vspacing: instructionSpacing,
				halign: 'left',
				valign: 'bottom',
				scale: instructionScale,
				snap: 1,
				render: 1
			} );
			if( $.instructionTick < $.instructionTickMax * 0.25 ) {
				var alpha = ( $.instructionTick / ( $.instructionTickMax * 0.25 ) ) * 1;
			} else if( $.instructionTick > $.instructionTickMax - $.instructionTickMax * 0.25 ) {
				var alpha = ( ( $.instructionTickMax - $.instructionTick ) / ( $.instructionTickMax * 0.25 ) ) * 1;
			} else {
				var alpha = 1;
			}
			alpha = Math.min( 1, Math.max( 0, alpha ) );

			$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, ' + alpha + ')';
			$.ctxmg.fill();
		}

		/*==============================================================================
		Slow Enemies Screen Cover
		==============================================================================*/
		if( $.powerupTimers[ 1 ] > 0 ) {
			$.ctxmg.fillStyle = 'hsla(200, 100%, 20%, 0.05)';
			$.ctxmg.fillRect( 0, 0, $.cw, $.ch );
		}

	/*==============================================================================
	Health
	==============================================================================*/
	$.ctxmg.beginPath();
	var healthText = $.text( {
		ctx: $.ctxmg,
		x: 20,
		y: 20,
		text: 'HEALTH',
		hspacing: 1,
		vspacing: 1,
		halign: 'top',
		valign: 'left',
		scale: 2,
		snap: 1,
		render: 1
	} );
	$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.5)';
	$.ctxmg.fill();
	var healthBar = {
		x: healthText.ex + 10,
		y: healthText.sy,
		width: 110,
		height: 10
	};
	$.ctxmg.fillStyle = 'hsla(0, 0%, 20%, 1)';
	$.ctxmg.fillRect( healthBar.x, healthBar.y, healthBar.width, healthBar.height );
	$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.25)';
	$.ctxmg.fillRect( healthBar.x, healthBar.y, healthBar.width, healthBar.height / 2 );
	$.ctxmg.fillStyle = 'hsla(' + $.hero.life * 120 + ', 100%, 40%, 1)';
	$.ctxmg.fillRect( healthBar.x, healthBar.y, $.hero.life * healthBar.width, healthBar.height );
	$.ctxmg.fillStyle = 'hsla(' + $.hero.life * 120 + ', 100%, 75%, 1)';
	$.ctxmg.fillRect( healthBar.x, healthBar.y, $.hero.life * healthBar.width, healthBar.height / 2 );

	if( $.hero.takingDamage && $.hero.life > 0.01 ) {
		$.particleEmitters.push( new $.ParticleEmitter( {
			x: -$.screen.x + healthBar.x + $.hero.life * healthBar.width,
			y: -$.screen.y + healthBar.y + healthBar.height / 2,
			count: 1,
			spawnRange: 2,
			friction: 0.85,
			minSpeed: 2,
			maxSpeed: 20,
			minDirection: $.pi / 2 - 0.2,
			maxDirection: $.pi / 2 + 0.2,
			hue: $.hero.life * 120,
			saturation: 100
		} ) );
	}

	/*==============================================================================
	Progress
	==============================================================================*/
	$.ctxmg.beginPath();
	var progressText = $.text( {
		ctx: $.ctxmg,
		x: healthBar.x + healthBar.width + 40,
		y: 20,
		text: 'PROGRESS',
		hspacing: 1,
		vspacing: 1,
		halign: 'top',
		valign: 'left',
		scale: 2,
		snap: 1,
		render: 1
	} );
	$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.5)';
	$.ctxmg.fill();
	var progressBar = {
		x: progressText.ex + 10,
		y: progressText.sy,
		width: healthBar.width,
		height: healthBar.height
	};
	$.ctxmg.fillStyle = 'hsla(0, 0%, 20%, 1)';
	$.ctxmg.fillRect( progressBar.x, progressBar.y, progressBar.width, progressBar.height );
	$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.25)';
	$.ctxmg.fillRect( progressBar.x, progressBar.y, progressBar.width, progressBar.height / 2 );
	$.ctxmg.fillStyle = 'hsla(0, 0%, 50%, 1)';
	$.ctxmg.fillRect( progressBar.x, progressBar.y, ( $.level.kills / $.level.killsToLevel ) * progressBar.width, progressBar.height );
	$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 1)';
	$.ctxmg.fillRect( progressBar.x, progressBar.y, ( $.level.kills / $.level.killsToLevel ) * progressBar.width, progressBar.height / 2 );

	if( $.level.kills == $.level.killsToLevel ) {
		$.particleEmitters.push( new $.ParticleEmitter( {
			x: -$.screen.x + progressBar.x + progressBar.width,
			y: -$.screen.y + progressBar.y + progressBar.height / 2,
			count: 30,
			spawnRange: 5,
			friction: 0.95,
			minSpeed: 2,
			maxSpeed: 25,
			minDirection: 0,
			minDirection: $.pi / 2 - $.pi / 4,
			maxDirection: $.pi / 2 + $.pi / 4,
			hue: 0,
			saturation: 0
		} ) );
	}

	/*==============================================================================
	Score
	==============================================================================*/
	$.ctxmg.beginPath();
	var scoreLabel = $.text( {
		ctx: $.ctxmg,
		x: progressBar.x + progressBar.width + 40,
		y: 20,
		text: 'SCORE',
		hspacing: 1,
		vspacing: 1,
		halign: 'top',
		valign: 'left',
		scale: 2,
		snap: 1,
		render: 1
	} );
	$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.5)';
	$.ctxmg.fill();

	$.ctxmg.beginPath();
	var scoreText = $.text( {
		ctx: $.ctxmg,
		x: scoreLabel.ex + 10,
		y: 20,
		text: $.util.pad( $.score, 6 ),
		hspacing: 1,
		vspacing: 1,
		halign: 'top',
		valign: 'left',
		scale: 2,
		snap: 1,
		render: 1
	} );
	$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 1)';
	$.ctxmg.fill();

	$.ctxmg.beginPath();
	var bestLabel = $.text( {
		ctx: $.ctxmg,
		x: scoreText.ex + 40,
		y: 20,
		text: 'BEST',
		hspacing: 1,
		vspacing: 1,
		halign: 'top',
		valign: 'left',
		scale: 2,
		snap: 1,
		render: 1
	} );
	$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.5)';
	$.ctxmg.fill();

	$.ctxmg.beginPath();
	var bestText = $.text( {
		ctx: $.ctxmg,
		x: bestLabel.ex + 10,
		y: 20,
		text: $.util.pad( Math.max( $.storage['score'], $.score ), 6 ),
		hspacing: 1,
		vspacing: 1,
		halign: 'top',
		valign: 'left',
		scale: 2,
		snap: 1,
		render: 1
	} );
	$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 1)';
	$.ctxmg.fill();

	$.ctxmg.beginPath();
	var comboLabel = $.text( {
		ctx: $.ctxmg,
		x: 20,
		y: 42,
		text: 'COMBO',
		hspacing: 1,
		vspacing: 1,
		halign: 'top',
		valign: 'left',
		scale: 2,
		snap: 1,
		render: 1
	} );
	$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.5)';
	$.ctxmg.fill();

	$.ctxmg.beginPath();
	$.text( {
		ctx: $.ctxmg,
		x: comboLabel.ex + 10,
		y: 42,
		text: 'X' + Math.floor( $.combo ),
		hspacing: 1,
		vspacing: 1,
		halign: 'top',
		valign: 'left',
		scale: 2,
		snap: 1,
		render: 1
	} );
	$.ctxmg.fillStyle = ( $.combo >= 4 ) ? '#fff' : 'hsla(0, 0%, 100%, 0.75)';
	$.ctxmg.fill();

	if( $.currentBoss && $.currentBoss.life > 0 ) {
		var bossBar = {
			x: $.cw / 2 - 220,
			y: 58,
			width: 440,
			height: 12
		};
		$.ctxmg.beginPath();
		$.text( {
			ctx: $.ctxmg,
			x: $.cw / 2,
			y: 38,
			text: 'BOSS',
			hspacing: 2,
			vspacing: 1,
			halign: 'center',
			valign: 'top',
			scale: 2,
			snap: 1,
			render: 1
		} );
		$.ctxmg.fillStyle = 'hsla(' + $.currentBoss.hue + ', 100%, 70%, 0.85)';
		$.ctxmg.fill();
		$.ctxmg.fillStyle = 'hsla(0, 0%, 0%, 0.8)';
		$.ctxmg.fillRect( bossBar.x, bossBar.y, bossBar.width, bossBar.height );
		$.ctxmg.fillStyle = 'hsla(' + $.currentBoss.hue + ', 100%, 45%, 1)';
		$.ctxmg.fillRect( bossBar.x, bossBar.y, bossBar.width * Math.max( 0, $.currentBoss.life / $.currentBoss.lifeMax ), bossBar.height );
		$.ctxmg.strokeStyle = 'hsla(0, 0%, 100%, 0.35)';
		$.ctxmg.strokeRect( bossBar.x - 0.5, bossBar.y - 0.5, bossBar.width + 1, bossBar.height + 1 );
	}
};

$.renderMinimap = function() {
	$.ctxmg.fillStyle = $.minimap.color;
	$.ctxmg.fillRect( $.minimap.x, $.minimap.y, $.minimap.width, $.minimap.height );

	$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.1)';
	$.ctxmg.fillRect(
		Math.floor( $.minimap.x + -$.screen.x * $.minimap.scale ),
		Math.floor( $.minimap.y + -$.screen.y * $.minimap.scale ),
		Math.floor( $.cw * $.minimap.scale ),
		Math.floor( $.ch * $.minimap.scale )
	);

	//$.ctxmg.beginPath();
	for( var i = 0; i < $.enemies.length; i++ ){
		var enemy = $.enemies[ i ],
			x = $.minimap.x + Math.floor( enemy.x * $.minimap.scale ),
			y = $.minimap.y + Math.floor( enemy.y * $.minimap.scale );
		if( $.util.pointInRect( x + 1, y + 1, $.minimap.x, $.minimap.y, $.minimap.width, $.minimap.height ) ) {
			//$.ctxmg.rect( x, y, 2, 2 );
			$.ctxmg.fillStyle = 'hsl(' + enemy.hue + ', ' + enemy.saturation + '%, 50%)';
			$.ctxmg.fillRect( x, y, 2, 2 );
		}
	}
	//$.ctxmg.fillStyle = '#f00';
	//$.ctxmg.fill();

	$.ctxmg.beginPath();
	for( var i = 0; i < $.bullets.length; i++ ){
		var bullet = $.bullets[ i ],
			x = $.minimap.x + Math.floor( bullet.x * $.minimap.scale ),
			y = $.minimap.y + Math.floor( bullet.y * $.minimap.scale );
		if( $.util.pointInRect( x, y, $.minimap.x, $.minimap.y, $.minimap.width, $.minimap.height ) ) {
			$.ctxmg.rect( x, y, 1, 1 );
		}
	}
	$.ctxmg.fillStyle = '#fff';
	$.ctxmg.fill();

	$.ctxmg.beginPath();
	for( var i = 0; i < $.enemyBullets.length; i++ ){
		var enemyBullet = $.enemyBullets[ i ],
			ebx = $.minimap.x + Math.floor( enemyBullet.x * $.minimap.scale ),
			eby = $.minimap.y + Math.floor( enemyBullet.y * $.minimap.scale );
		if( $.util.pointInRect( ebx, eby, $.minimap.x, $.minimap.y, $.minimap.width, $.minimap.height ) ) {
			$.ctxmg.rect( ebx, eby, 2, 2 );
		}
	}
	$.ctxmg.fillStyle = '#f77';
	$.ctxmg.fill();

	$.ctxmg.fillStyle = $.hero.fillStyle;
	$.ctxmg.fillRect( $.minimap.x + Math.floor( $.hero.x * $.minimap.scale ), $.minimap.y + Math.floor( $.hero.y * $.minimap.scale ), 2, 2 );

	$.ctxmg.strokeStyle = $.minimap.strokeColor;
	$.ctxmg.strokeRect( $.minimap.x - 0.5, $.minimap.y - 0.5, $.minimap.width + 1, $.minimap.height + 1 );
};

$.spawnEnemyBullet = function( x, y, direction, speed, damage, radius, hue ) {
	$.enemyBullets.push( {
		x: x,
		y: y,
		direction: direction,
		speed: speed,
		damage: damage,
		radius: radius,
		hue: hue,
		life: 360
	} );
	$.particleEmitters.push( new $.ParticleEmitter( {
		x: x,
		y: y,
		count: 3,
		spawnRange: 3,
		friction: 0.85,
		minSpeed: 2,
		maxSpeed: 10,
		minDirection: direction + $.pi - 0.4,
		maxDirection: direction + $.pi + 0.4,
		hue: hue,
		saturation: 100
	} ) );
};

$.updateEnemyBullets = function() {
	var i = $.enemyBullets.length;
	while( i-- ) {
		var bullet = $.enemyBullets[ i ];
		bullet.x += Math.cos( bullet.direction ) * bullet.speed * $.dt;
		bullet.y += Math.sin( bullet.direction ) * bullet.speed * $.dt;
		bullet.life -= $.dt;
		if( $.hero.life > 0 && $.util.distance( bullet.x, bullet.y, $.hero.x, $.hero.y ) <= $.hero.radius + bullet.radius ) {
			$.hero.life -= bullet.damage;
			$.hero.takingDamage = 1;
			$.rumble.level = Math.max( $.rumble.level, 8 );
			$.audio.play( 'takingDamage' );
			$.enemyBullets.splice( i, 1 );
			continue;
		}
		if( bullet.life <= 0 || !$.util.pointInRect( bullet.x, bullet.y, 0, 0, $.ww, $.wh ) ) {
			$.enemyBullets.splice( i, 1 );
		}
	}
};

$.renderEnemyBullets = function() {
	var i = $.enemyBullets.length;
	while( i-- ) {
		var bullet = $.enemyBullets[ i ];
		if( $.util.pointInRect( bullet.x, bullet.y, -$.screen.x, -$.screen.y, $.cw, $.ch ) ) {
			$.util.fillCircle( $.ctxmg, bullet.x, bullet.y, bullet.radius, 'hsla(' + bullet.hue + ', 100%, 60%, 0.9)' );
			$.util.strokeCircle( $.ctxmg, bullet.x, bullet.y, bullet.radius + 4, 'hsla(' + bullet.hue + ', 100%, 70%, 0.35)', 2 );
		}
	}
};

/*==============================================================================
Enemy Spawning
==============================================================================*/
$.getSpawnCoordinates = function( radius ) {
	var quadrant = Math.floor( $.util.rand( 0, 4 ) ),
		x,
		y,
		start;

	if( quadrant === 0){
		x = $.util.rand( 0, $.ww );
		y = -radius;
		start = 'top';
	} else if( quadrant === 1 ){
		x = $.ww + radius;
		y = $.util.rand( 0, $.wh );
		start = 'right';
	} else if( quadrant === 2 ) {
		x = $.util.rand( 0, $.ww );
		y = $.wh + radius;
		start = 'bottom';
	} else {
		x = -radius;
		y = $.util.rand( 0, $.wh );
		start = 'left';
	}

	return { x: x, y: y, start: start };
};

$.spawnEnemy = function( type ) {
	var source = $.definitions.enemies[ type ],
		params = {},
		k;
	for( k in source ) {
		params[ k ] = source[ k ];
	}
	var difficulty = $.difficulty || 1,
		coordinates = $.getSpawnCoordinates( params.radius );
	params.life = Math.ceil( params.life * difficulty );
	params.speed = params.speed * Math.min( 1.8, 0.9 + difficulty * 0.1 );
	params.value = Math.floor( params.value * difficulty );
	params.x = coordinates.x;
	params.y = coordinates.y;
	params.start = coordinates.start;
	params.type = type;
	return new $.Enemy( params );
};

$.spawnBoss = function() {
	if( $.bossActive ) {
		return;
	}
	var displayLevel = $.level.current + 1,
		params = {
			x: $.ww / 2,
			y: -120,
			start: 'top',
			type: 99,
			isBoss: 1,
			value: 500 + displayLevel * 120,
			speed: 0.7 + displayLevel * 0.05,
			life: 25 + displayLevel * 9,
			radius: 95,
			hue: ( displayLevel * 35 ) % 360,
			saturation: 100,
			lightness: 55,
			angle: 0,
			spawnTick: 0,
			spawnMax: Math.max( 80, 160 - displayLevel * 7 ),
			fireTick: 0,
			fireMax: Math.max( 45, 105 - displayLevel * 5 ),
			behavior: function() {
				var speed = $.slow ? this.speed / $.slowEnemyDivider : this.speed,
					dx = $.hero.x - this.x,
					dy = $.hero.y - this.y,
					direction = Math.atan2( dy, dx );
				this.angle += 0.025 * $.dt;
				if( Math.abs( dy ) > 240 ) {
					this.vx = Math.cos( direction ) * speed;
					this.vy = Math.sin( direction ) * speed;
				} else {
					this.vx = Math.cos( this.angle ) * speed * 1.8;
					this.vy = Math.sin( this.angle * 0.5 ) * speed * 0.8;
				}
				if( this.spawnTick < this.spawnMax ) {
					this.spawnTick += $.dt;
				} else {
					this.spawnTick = 0;
					var minionType = Math.floor( $.util.rand( 0, Math.min( $.level.distributionCount, 8 ) ) ),
						enemy = $.spawnEnemy( minionType );
					enemy.x = this.x + $.util.rand( -this.radius, this.radius );
					enemy.y = this.y + $.util.rand( -this.radius, this.radius );
					enemy.life = Math.max( 1, Math.floor( enemy.life * 0.6 ) );
					enemy.radius = Math.max( 12, enemy.radius * 0.7 );
					$.enemies.push( enemy );
				}
				if( this.fireTick < this.fireMax ) {
					this.fireTick += $.dt;
				} else {
					this.fireTick = 0;
					var baseDirection = Math.atan2( $.hero.y - this.y, $.hero.x - this.x ),
						shots = Math.min( 7, 3 + Math.floor( displayLevel / 3 ) ),
						spread = 0.55;
					for( var bi = 0; bi < shots; bi++ ) {
						var offset = ( shots === 1 ) ? 0 : -spread / 2 + ( spread / ( shots - 1 ) ) * bi;
						$.spawnEnemyBullet( this.x, this.y, baseDirection + offset, 4.2 + displayLevel * 0.12, 0.08, 7, this.hue );
					}
				}
			},
			death: function() {
				$.bossActive = 0;
				$.currentBoss = null;
				$.score += 1000 + displayLevel * 250;
				$.rumble.level = 30;
				$.levelPops.push( new $.LevelPop( {
					level: displayLevel
				} ) );
			}
		},
		boss = new $.Enemy( params );
	$.bossActive = 1;
	$.currentBoss = boss;
	$.audio.play( 'levelup' );
	$.enemies.push( boss );
};

$.spawnEnemies = function() {
	if( $.bossActive && $.enemies.length > 18 ) {
		return;
	}
	var floorTick = Math.floor( $.tick );
	for( var i = 0; i < $.level.distributionCount; i++ ) {
		var timeCheck = $.level.distribution[ i ];
		if( $.levelDiffOffset > 0 ){
			timeCheck = Math.max( 1, timeCheck - ( $.levelDiffOffset * 2) );
		}
		timeCheck = Math.max( 8, Math.floor( timeCheck / ( $.difficulty || 1 ) ) );
		if( floorTick % timeCheck === 0 ) {
			$.enemies.push( $.spawnEnemy( i ) );
		}
	}
};

/*==============================================================================
Events
==============================================================================*/
$.mousemovecb = function( e ) {
	e.preventDefault();

	var touches = e.changedTouches ? e.changedTouches : [e];

	for( var i = 0; i < touches.length; i++ ) {
		var tx = touches[i].pageX;
		var ty = touches[i].pageY;
		var tid = e.changedTouches ? touches[i].identifier : 0;

		// Move Left Joystick (Movement)
		if( $.vjoyLeft.active && $.vjoyLeft.id === tid ) {
			var dx = tx - $.vjoyLeft.ox;
			var dy = ty - $.vjoyLeft.oy;
			var dist = Math.sqrt( dx * dx + dy * dy );
			var angle = Math.atan2( dy, dx );

			if( dist > $.vjoyLeft.radius ) {
				$.vjoyLeft.cx = $.vjoyLeft.ox + Math.cos( angle ) * $.vjoyLeft.radius;
				$.vjoyLeft.cy = $.vjoyLeft.oy + Math.sin( angle ) * $.vjoyLeft.radius;
			} else {
				$.vjoyLeft.cx = tx;
				$.vjoyLeft.cy = ty;
			}

			// Update Keys for Movement
			var degree = angle * 180 / Math.PI;
			if (degree < 0) degree += 360;

			if (dist > 10) {
				$.keys.state.up = 200 <= degree && degree < 340 ? 1 : 0;
				$.keys.state.down = 20 <= degree && degree < 160 ? 1 : 0;
				$.keys.state.left = 110 <= degree && degree < 250 ? 1 : 0;
				$.keys.state.right = (0 <= degree && degree < 70) || (290 <= degree && degree <= 360) ? 1 : 0;
			} else {
				$.keys.state.down = $.keys.state.up = $.keys.state.left = $.keys.state.right = 0;
			}
		}

		// Move Right Joystick (Aiming)
		if( $.vjoyRight.active && $.vjoyRight.id === tid ) {
			var dx = tx - $.vjoyRight.ox;
			var dy = ty - $.vjoyRight.oy;
			var dist = Math.sqrt( dx * dx + dy * dy );
			var angle = Math.atan2( dy, dx );

			if( dist > $.vjoyRight.radius ) {
				$.vjoyRight.cx = $.vjoyRight.ox + Math.cos( angle ) * $.vjoyRight.radius;
				$.vjoyRight.cy = $.vjoyRight.oy + Math.sin( angle ) * $.vjoyRight.radius;
			} else {
				$.vjoyRight.cx = tx;
				$.vjoyRight.cy = ty;
			}
		}

		// Keep global mouse updated for aiming/UI
		$.mouse.ax = tx;
		$.mouse.ay = ty;
		$.mousescreen();
	}
};

$.mousescreen = function() {
	$.mouse.sx = $.mouse.ax - $.cOffset.left;
	$.mouse.sy = $.mouse.ay - $.cOffset.top;
	$.mouse.x = $.mouse.sx - $.screen.x;
	$.mouse.y = $.mouse.sy - $.screen.y;
};

$.mousedowncb = function( e ) {
	e.preventDefault();
	$.mouse.down = 1;

	var touches = e.changedTouches ? e.changedTouches : [e];

	for( var i = 0; i < touches.length; i++ ) {
		var tx = touches[i].pageX;
		var ty = touches[i].pageY;
		var tid = e.changedTouches ? touches[i].identifier : 0;

		$.mouse.ax = tx;
		$.mouse.ay = ty;
		$.mousescreen();

		// Check if touching UI Button
		var buttonHovered = false;
		for( var j = 0; j < $.buttons.length; j++ ) {
			var b = $.buttons[j];
			if( $.util.pointInRect( $.mouse.sx, $.mouse.sy, b.sx, b.sy, b.width, b.height ) ) {
				buttonHovered = true;
				break;
			}
		}

		if( !buttonHovered ) {
			if( tx < $.cw / 2 && !$.vjoyLeft.active ) {
				$.vjoyLeft.active = 1;
				$.vjoyLeft.ox = tx;
				$.vjoyLeft.oy = ty;
				$.vjoyLeft.cx = tx;
				$.vjoyLeft.cy = ty;
				$.vjoyLeft.id = tid;
			} else if( tx >= $.cw / 2 && !$.vjoyRight.active ) {
				$.vjoyRight.active = 1;
				$.vjoyRight.ox = tx;
				$.vjoyRight.oy = ty;
				$.vjoyRight.cx = tx;
				$.vjoyRight.cy = ty;
				$.vjoyRight.id = tid;
			}
		}
	}
};

$.mouseupcb = function( e ) {
	e.preventDefault();
	$.mouse.down = 0;

	var touches = e.changedTouches ? e.changedTouches : [{ identifier: 0 }];

	for( var i = 0; i < touches.length; i++ ) {
		var tid = e.changedTouches ? touches[i].identifier : 0;

		if( $.vjoyLeft.active && $.vjoyLeft.id === tid ) {
			$.vjoyLeft.active = 0;
			$.keys.state.down = 0;
			$.keys.state.up = 0;
			$.keys.state.left = 0;
			$.keys.state.right = 0;
		}

		if( $.vjoyRight.active && $.vjoyRight.id === tid ) {
			$.vjoyRight.active = 0;
		}
	}
};

$.keydowncb = function( e ) {
	var e = ( e.keyCode ? e.keyCode : e.which );
	if( e === 38 || e === 87 ){ $.keys.state.up = 1; }
	if( e === 39 || e === 68 ){ $.keys.state.right = 1; }
	if( e === 40 || e === 83 ){ $.keys.state.down = 1; }
	if( e === 37 || e === 65 ){ $.keys.state.left = 1; }
	if( e === 70 ){ $.keys.state.f = 1; }
	if( e === 77 ){ $.keys.state.m = 1; }
	if( e === 80 ){ $.keys.state.p = 1; }
}

$.keyupcb = function( e ) {
	var e = ( e.keyCode ? e.keyCode : e.which );
	if( e === 38 || e === 87 ){ $.keys.state.up = 0; }
	if( e === 39 || e === 68 ){ $.keys.state.right = 0; }
	if( e === 40 || e === 83 ){ $.keys.state.down = 0; }
	if( e === 37 || e === 65 ){ $.keys.state.left = 0; }
	if( e === 70 ){ $.keys.state.f = 0; }
	if( e === 77 ){ $.keys.state.m = 0; }
	if( e === 80 ){ $.keys.state.p = 0; }
}

$.resizecb = function( e ) {
	var rect = $.cmg.getBoundingClientRect();
	$.cOffset = {
		left: rect.left,
		top: rect.top,
		width: rect.width,
		height: rect.height
	}
}

$.blurcb = function() {
	if( $.state == 'play' ){
		$.setState( 'pause' );
	}
}

$.bindEvents = function() {
	window.addEventListener( 'mousemove', $.mousemovecb, { passive: false } );
	window.addEventListener( 'mousedown', $.mousedowncb, { passive: false } );
	window.addEventListener( 'mouseup', $.mouseupcb, { passive: false } );
	window.addEventListener( 'touchstart', $.mousedowncb, { passive: false } );
	window.addEventListener( 'touchmove', $.mousemovecb, { passive: false } );
	window.addEventListener( 'touchend', $.mouseupcb, { passive: false } );
	window.addEventListener( 'keydown', $.keydowncb );
	window.addEventListener( 'keyup', $.keyupcb );
	window.addEventListener( 'resize', $.resizecb );
	window.addEventListener( 'blur', $.blurcb );
};

/*==============================================================================
Miscellaneous
==============================================================================*/
$.clearScreen = function() {
	$.ctxmg.clearRect( 0, 0, $.cw, $.ch );
};

$.updateDelta = function() {
	var now = Date.now();
	$.dt = ( now - $.lt ) / ( 1000 / 60 );
	$.dt = ( $.dt < 0 ) ? 0.001 : $.dt;
	$.dt = ( $.dt > 10 ) ? 10 : $.dt;
	$.lt = now;
	$.elapsed += $.dt;
};

$.updateScreen = function() {
	var xSnap,
		xModify,
		ySnap,
		yModify;

	if( $.hero.x < $.cw / 2 ) {
		xModify = $.hero.x / $.cw;
	} else if( $.hero.x > $.ww - $.cw / 2 ) {
		xModify = 1 - ( $.ww - $.hero.x ) / $.cw;
	} else {
		xModify = 0.5;
	}

	if( $.hero.y < $.ch / 2 ) {
		yModify = $.hero.y / $.ch;
	} else if( $.hero.y > $.wh - $.ch / 2 ) {
		yModify = 1 - ( $.wh - $.hero.y ) / $.ch;
	} else {
		yModify = 0.5;
	}

	xSnap = ( ( $.cw * xModify - $.hero.x ) - $.screen.x ) / 30;
	ySnap = ( ( $.ch * yModify - $.hero.y ) - $.screen.y ) / 30;

	// ease to new coordinates
	$.screen.x += xSnap * $.dt;
	$.screen.y += ySnap * $.dt;

	// update rumble levels, keep X and Y changes consistent, apply rumble
	if( $.rumble.level > 0 ) {
		$.rumble.level -= $.rumble.decay;
		$.rumble.level = ( $.rumble.level < 0 ) ? 0 : $.rumble.level;
		$.rumble.x = $.util.rand( -$.rumble.level, $.rumble.level );
		$.rumble.y = $.util.rand( -$.rumble.level, $.rumble.level );
	} else {
		$.rumble.x = 0;
		$.rumble.y = 0;
	}

	//$.screen.x -= $.rumble.x;
	//$.screen.y -= $.rumble.y;

	// animate background canvas
	$.cbg1.style.marginLeft =
		-( ( $.cbg1.width - $.cw ) / 2 ) // half the difference from bg to viewport
		- ( ( $.cbg1.width - $.cw ) / 2 ) // half the diff again, modified by a percentage below
		* ( ( -$.screen.x - ( $.ww - $.cw ) / 2 ) / ( ( $.ww - $.cw ) / 2) ) // viewport offset applied to bg
		- $.rumble.x + 'px';
	$.cbg1.style.marginTop =
		-( ( $.cbg1.height - $.ch ) / 2 )
		- ( ( $.cbg1.height - $.ch ) / 2 )
		* ( ( -$.screen.y - ( $.wh - $.ch ) / 2 ) / ( ( $.wh - $.ch ) / 2) )
		- $.rumble.y + 'px';
	$.cbg2.style.marginLeft =
		-( ( $.cbg2.width - $.cw ) / 2 ) // half the difference from bg to viewport
		- ( ( $.cbg2.width - $.cw ) / 2 ) // half the diff again, modified by a percentage below
		* ( ( -$.screen.x - ( $.ww - $.cw ) / 2 ) / ( ( $.ww - $.cw ) / 2) ) // viewport offset applied to bg
		- $.rumble.x + 'px';
	$.cbg2.style.marginTop =
		-( ( $.cbg2.height - $.ch ) / 2 )
		- ( ( $.cbg2.height - $.ch ) / 2 )
		* ( ( -$.screen.y - ( $.wh - $.ch ) / 2 ) / ( ( $.wh - $.ch ) / 2) )
		- $.rumble.y + 'px';
	$.cbg3.style.marginLeft =
		-( ( $.cbg3.width - $.cw ) / 2 ) // half the difference from bg to viewport
		- ( ( $.cbg3.width - $.cw ) / 2 ) // half the diff again, modified by a percentage below
		* ( ( -$.screen.x - ( $.ww - $.cw ) / 2 ) / ( ( $.ww - $.cw ) / 2) ) // viewport offset applied to bg
		- $.rumble.x + 'px';
	$.cbg3.style.marginTop =
		-( ( $.cbg3.height - $.ch ) / 2 )
		- ( ( $.cbg3.height - $.ch ) / 2 )
		* ( ( -$.screen.y - ( $.wh - $.ch ) / 2 ) / ( ( $.wh - $.ch ) / 2) )
		- $.rumble.y + 'px';
	$.cbg4.style.marginLeft =
		-( ( $.cbg4.width - $.cw ) / 2 ) // half the difference from bg to viewport
		- ( ( $.cbg4.width - $.cw ) / 2 ) // half the diff again, modified by a percentage below
		* ( ( -$.screen.x - ( $.ww - $.cw ) / 2 ) / ( ( $.ww - $.cw ) / 2) ) // viewport offset applied to bg
		- $.rumble.x + 'px';
	$.cbg4.style.marginTop =
		-( ( $.cbg4.height - $.ch ) / 2 )
		- ( ( $.cbg4.height - $.ch ) / 2 )
		* ( ( -$.screen.y - ( $.wh - $.ch ) / 2 ) / ( ( $.wh - $.ch ) / 2) )
		- $.rumble.y + 'px';

	$.mousescreen();
};

$.updateLevel = function() {
	if( $.level.kills >= $.level.killsToLevel ) {
		if( $.level.current + 1 < $.levelCount ){
			$.level.current++;
			$.level.kills = 0;
			$.level.killsToLevel = $.definitions.levels[ $.level.current ].killsToLevel;
			$.level.distribution = $.definitions.levels[ $.level.current ].distribution;
			$.level.distributionCount = $.level.distribution.length;
		} else {
			$.level.current++;
			$.level.kills = 0;
			// no more level definitions, so take the last level and increase the spawn rate slightly
			//for( var i = 0; i < $.level.distributionCount; i++ ) {
				//$.level.distribution[ i ] = Math.max( 1, $.level.distribution[ i ] - 5 );
			//}
		}
		$.levelDiffOffset = $.level.current + 1 - $.levelCount;
		$.levelPops.push( new $.LevelPop( {
			level: $.level.current + 1
		} ) );
		$.mapTheme = $.level.current % $.definitions.maps.length;
		$.refreshMap();
		if( $.level.current + 1 >= $.bossNextLevel ) {
			$.spawnBoss();
			$.bossNextLevel += 3;
		}
		if( ( $.level.current + 1 ) % 2 === 0 ) {
			$.setState( 'upgrade' );
		}
	}
};

$.updateCombo = function() {
	if( $.comboTick > 0 ) {
		$.comboTick -= $.dt;
	} else if( $.combo > 1 ) {
		$.combo = Math.max( 1, $.combo - 0.03 * $.dt );
	}
};

$.getAccuracy = function() {
	return ( $.bulletsFired > 0 ) ? Math.floor( ( $.bulletsHit / $.bulletsFired ) * 100 ) : 0;
};

$.getUpgradeCount = function() {
	var count = 0;
	for( var k in $.runUpgrades ) {
		count += $.runUpgrades[ k ];
	}
	return count;
};

$.chooseUpgrades = function() {
	var pool = $.definitions.upgrades.slice( 0 ),
		choices = [];
	while( choices.length < 3 && pool.length ) {
		var index = Math.floor( $.util.rand( 0, pool.length ) );
		choices.push( pool.splice( index, 1 )[ 0 ] );
	}
	return choices;
};

$.applyUpgrade = function( upgrade ) {
	upgrade.apply();
	$.audio.play( 'powerup' );
	$.levelPops.push( new $.LevelPop( {
		level: $.level.current + 1
	} ) );
	$.setState( 'play' );
};

$.updatePowerupTimers = function() {
	// HEALTH
	if( $.powerupTimers[ 0 ] > 0 ){
		if( $.hero.life < 1 ) {
			$.hero.life += 0.001;
		}
		if( $.hero.life > 1 ) {
			$.hero.life = 1;
		}
		$.powerupTimers[ 0 ] -= $.dt;
	}

	// SLOW ENEMIES
	if( $.powerupTimers[ 1 ] > 0 ){
		$.slow = 1;
		$.powerupTimers[ 1 ] -= $.dt;
	} else {
		$.slow = 0;
	}

	// FAST SHOT
	var baseFireRate = Math.max( 1.5, 5 - $.runUpgrades.fireRate * 0.7 ),
		baseBulletSpeed = 10;
	if( $.powerupTimers[ 2 ] > 0 ){
		$.hero.weapon.fireRate = Math.max( 1.25, baseFireRate - 3 );
		$.hero.weapon.bullet.speed = baseBulletSpeed + 4;
		$.powerupTimers[ 2 ] -= $.dt;
	} else {
		$.hero.weapon.fireRate = baseFireRate;
		$.hero.weapon.bullet.speed = baseBulletSpeed;
	}

	// TRIPLE SHOT
	var baseShotCount = Math.min( 7, 1 + $.runUpgrades.spread * 2 );
	if( $.powerupTimers[ 3 ] > 0 ){
		$.hero.weapon.count = Math.max( 3, baseShotCount );
		$.powerupTimers[ 3 ] -= $.dt;
	} else {
		$.hero.weapon.count = baseShotCount;
	}

	// PIERCE SHOT
	if( $.powerupTimers[ 4 ] > 0 ){
		$.hero.weapon.bullet.piercing = 1;
		$.powerupTimers[ 4 ] -= $.dt;
	} else {
		$.hero.weapon.bullet.piercing = $.runUpgrades.pierce > 0;
	}
};

$.spawnPowerup = function( x, y ) {
	if( Math.random() < 0.1 ) {
		var min = ( $.hero.life < 0.9 ) ? 0 : 1,
			type = Math.floor( $.util.rand( min, $.definitions.powerups.length ) ),
			params = $.definitions.powerups[ type ];
		params.type = type;
		params.x = x;
		params.y = y;
		$.powerups.push( new $.Powerup( params ) );
	}
};

/*==============================================================================
States
==============================================================================*/
$.setState = function( state ) {
	// handle clean up between states
	$.buttons.length = 0;

	if( state == 'menu' ) {
		$.mouse.down = 0;
		$.mouse.ax = 0;
		$.mouse.ay = 0;

		$.reset();

		var menuButtonWidth = Math.min( 299, $.cw - 40 );
		var playButton = new $.Button( {
			x: $.cw / 2 + 1,
			y: $.ch / 2 - 24,
			lockedWidth: menuButtonWidth,
			lockedHeight: 49,
			scale: ( $.cw < 520 ) ? 2 : 3,
			title: 'PLAY',
			action: function() {
				$.reset();
				$.audio.play( 'levelup' );
				$.setState( 'play' );
			}
		} );
		$.buttons.push( playButton );

		var statsButton = new $.Button( {
			x: $.cw / 2 + 1,
			y: playButton.ey + 25,
			lockedWidth: menuButtonWidth,
			lockedHeight: 49,
			scale: ( $.cw < 520 ) ? 2 : 3,
			title: 'STATS',
			action: function() {
				$.setState( 'stats' );
			}
		} );
		$.buttons.push( statsButton );

		var creditsButton = new $.Button( {
			x: $.cw / 2 + 1,
			y: statsButton.ey + 26,
			lockedWidth: menuButtonWidth,
			lockedHeight: 49,
			scale: ( $.cw < 520 ) ? 2 : 3,
			title: 'CREDITS',
			action: function() {
				$.setState( 'credits' );
			}
		} ) ;
		$.buttons.push( creditsButton );
	}

	if( state == 'stats' ) {
		$.mouse.down = 0;

		var clearButton = new $.Button( {
			x: $.cw / 2 + 1,
			y: 426,
			lockedWidth: 299,
			lockedHeight: 49,
			scale: 3,
			title: 'CLEAR DATA',
			action: function() {
				$.mouse.down = 0;
				if( window.confirm( 'Are you sure you want to clear all locally stored game data? This cannot be undone.') ) {
					$.clearStorage();
					$.mouse.down = 0;
				}
			}
		} );
		$.buttons.push( clearButton );

		var menuButton = new $.Button( {
			x: $.cw / 2 + 1,
			y: clearButton.ey + 25,
			lockedWidth: 299,
			lockedHeight: 49,
			scale: 3,
			title: 'MENU',
			action: function() {
				$.setState( 'menu' );
			}
		} );
		$.buttons.push( menuButton );
	}

	if( state == 'credits' ) {
		$.mouse.down = 0;

		var js13kButton = new $.Button( {
			x: $.cw / 2 + 1,
			y: 476,
			lockedWidth: 299,
			lockedHeight: 49,
			scale: 3,
			title: 'DAVIDGRATEFUL',
			action: function() {
				$.mouse.down = 0;
			}
		} );
		$.buttons.push( js13kButton );

		var menuButton = new $.Button( {
			x: $.cw / 2 + 1,
			y: js13kButton.ey + 25,
			lockedWidth: 299,
			lockedHeight: 49,
			scale: 3,
			title: 'MENU',
			action: function() {
				$.setState( 'menu' );
			}
		} );
		$.buttons.push( menuButton );
	}

	if( state == 'upgrade' ) {
		$.mouse.down = 0;
		$.screenshot = $.ctxmg.getImageData( 0, 0, $.cw, $.ch );
		$.upgradeChoices = $.chooseUpgrades();
		for( var ui = 0; ui < $.upgradeChoices.length; ui++ ) {
			(function( upgrade, index ) {
				var upgradeButton = new $.Button( {
					x: $.cw / 2 + 1,
					y: $.ch / 2 - 35 + index * 70,
					lockedWidth: 360,
					lockedHeight: 54,
					scale: 2,
					title: upgrade.title,
					action: function() {
						$.applyUpgrade( upgrade );
					}
				} );
				$.buttons.push( upgradeButton );
			})( $.upgradeChoices[ ui ], ui );
		}
	}

	if( state == 'pause' ) {
		$.mouse.down = 0;
		$.screenshot = $.ctxmg.getImageData( 0, 0, $.cw, $.ch );
		var resumeButton = new $.Button( {
			x: $.cw / 2 + 1,
			y: $.ch / 2 + 26,
			lockedWidth: 299,
			lockedHeight: 49,
			scale: 3,
			title: 'RESUME',
			action: function() {
				$.lt = Date.now() + 1000;
				$.setState( 'play' );
			}
		} );
		$.buttons.push( resumeButton );

		var menuButton = new $.Button( {
			x: $.cw / 2 + 1,
			y: resumeButton.ey + 25,
			lockedWidth: 299,
			lockedHeight: 49,
			scale: 3,
			title: 'MENU',
			action: function() {
				$.mouse.down = 0;
				if( window.confirm( 'Are you sure you want to end this game and return to the menu?') ) {
					$.mousescreen();
					$.setState( 'menu' );
				}
			}
		} );
		$.buttons.push( menuButton );
	}

	if( state == 'gameover' ) {
		$.mouse.down = 0;

		$.screenshot = $.ctxmg.getImageData( 0, 0, $.cw, $.ch );
		var resumeButton = new $.Button( {
			x: $.cw / 2 + 1,
			y: 426,
			lockedWidth: 299,
			lockedHeight: 49,
			scale: 3,
			title: 'PLAY AGAIN',
			action: function() {
				$.reset();
				$.audio.play( 'levelup' );
				$.setState( 'play' );
			}
		} );
		$.buttons.push( resumeButton );

		var menuButton = new $.Button( {
			x: $.cw / 2 + 1,
			y: resumeButton.ey + 25,
			lockedWidth: 299,
			lockedHeight: 49,
			scale: 3,
			title: 'MENU',
			action: function() {
				$.setState( 'menu' );
			}
		} );
		$.buttons.push( menuButton );

		$.newRecord = $.score > $.storage['score'];
		$.storage['score'] = Math.max( $.storage['score'], $.score );
		$.storage['level'] = Math.max( $.storage['level'], $.level.current );
		$.storage['rounds'] += 1;
		$.storage['kills'] += $.kills;
		$.storage['bullets'] += $.bulletsFired;
		$.storage['powerups'] += $.powerupsCollected;
		$.storage['time'] += Math.floor( $.elapsed );
		$.updateStorage();
	}

	// set state
	$.state = state;
};

$.setupStates = function() {
	$.states['menu'] = function() {


		$.clearScreen();
		$.updateScreen();

		var i = $.buttons.length; while( i-- ){ $.buttons[ i ].update( i ) }
			i = $.buttons.length; while( i-- ){ $.buttons[ i ].render( i ) }

		$.ctxmg.beginPath();
		var title = $.text( {
			ctx: $.ctxmg,
			x: $.cw / 2,
			y: $.ch / 2 - 100,
			text: 'RAID SHOOTER',
			hspacing: 2,
			vspacing: 1,
			halign: 'center',
			valign: 'bottom',
			scale: Math.max( 4, Math.min( 10, Math.floor( $.cw / 95 ) ) ),
			snap: 1,
			render: 1
		} );
		gradient = $.ctxmg.createLinearGradient( title.sx, title.sy, title.sx, title.ey );
		gradient.addColorStop( 0, '#fff' );
		gradient.addColorStop( 1, '#999' );
		$.ctxmg.fillStyle = gradient;
		$.ctxmg.fill();

		$.ctxmg.beginPath();
		var bottomInfo = $.text( {
			ctx: $.ctxmg,
			x: $.cw / 2,
			y: $.ch - 172,
			text: 'CREATED BY DAVIDGRATEFUL',
			hspacing: 1,
			vspacing: 1,
			halign: 'center',
			valign: 'bottom',
			scale: 1,
			snap: 1,
			render: 1
		} );
		$.ctxmg.fillStyle = '#666';
		$.ctxmg.fill();

	};

	$.states['stats'] = function() {


		$.clearScreen();

		$.ctxmg.beginPath();
		var statsTitle = $.text( {
			ctx: $.ctxmg,
			x: $.cw / 2,
			y: 150,
			text: 'STATS',
			hspacing: 3,
			vspacing: 1,
			halign: 'center',
			valign: 'bottom',
			scale: 10,
			snap: 1,
			render: 1
		} );
		var gradient = $.ctxmg.createLinearGradient( statsTitle.sx, statsTitle.sy, statsTitle.sx, statsTitle.ey );
		gradient.addColorStop( 0, '#fff' );
		gradient.addColorStop( 1, '#999' );
		$.ctxmg.fillStyle = gradient;
		$.ctxmg.fill();

		$.ctxmg.beginPath();
		var statKeys = $.text( {
			ctx: $.ctxmg,
			x: $.cw / 2 - 10,
			y: statsTitle.ey + 39,
			text: 'BEST SCORE\nBEST LEVEL\nROUNDS PLAYED\nENEMIES KILLED\nBULLETS FIRED\nPOWERUPS COLLECTED\nTIME ELAPSED',
			hspacing: 1,
			vspacing: 17,
			halign: 'right',
			valign: 'top',
			scale: 2,
			snap: 1,
			render: 1
		} );
		$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.5)';
		$.ctxmg.fill();

		$.ctxmg.beginPath();
		var statsValues = $.text( {
			ctx: $.ctxmg,
			x: $.cw / 2 + 10,
			y: statsTitle.ey + 39,
			text:
				$.util.commas( $.storage['score'] ) + '\n' +
				( $.storage['level'] + 1 ) + '\n' +
				$.util.commas( $.storage['rounds'] ) + '\n' +
				$.util.commas( $.storage['kills'] ) + '\n' +
				$.util.commas( $.storage['bullets'] ) + '\n' +
				$.util.commas( $.storage['powerups'] ) + '\n' +
				$.util.convertTime( ( $.storage['time'] * ( 1000 / 60 ) ) / 1000 )
			,
			hspacing: 1,
			vspacing: 17,
			halign: 'left',
			valign: 'top',
			scale: 2,
			snap: 1,
			render: 1
		} );
		$.ctxmg.fillStyle = '#fff';
		$.ctxmg.fill();

		var i = $.buttons.length; while( i-- ){ $.buttons[ i ].render( i ) }
			i = $.buttons.length; while( i-- ){ $.buttons[ i ].update( i ) }
	};

	$.states['credits'] = function() {


		$.clearScreen();

		$.ctxmg.beginPath();
		var creditsTitle = $.text( {
			ctx: $.ctxmg,
			x: $.cw / 2,
			y: 100,
			text: 'CREDITS',
			hspacing: 3,
			vspacing: 1,
			halign: 'center',
			valign: 'bottom',
			scale: 10,
			snap: 1,
			render: 1
		} );
		var gradient = $.ctxmg.createLinearGradient( creditsTitle.sx, creditsTitle.sy, creditsTitle.sx, creditsTitle.ey );
		gradient.addColorStop( 0, '#fff' );
		gradient.addColorStop( 1, '#999' );
		$.ctxmg.fillStyle = gradient;
		$.ctxmg.fill();

		$.ctxmg.beginPath();
		var creditKeys = $.text( {
			ctx: $.ctxmg,
			x: $.cw / 2 - 10,
			y: creditsTitle.ey + 49,
			text: 'CREATED BY DAVIDGRATEFUL',
			hspacing: 1,
			vspacing: 17,
			halign: 'right',
			valign: 'top',
			scale: 2,
			snap: 1,
			render: 1
		} );
		$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.5)';
		$.ctxmg.fill();

		$.ctxmg.beginPath();
		var creditValues = $.text( {
			ctx: $.ctxmg,
			x: $.cw / 2 + 10,
			y: creditsTitle.ey + 49,
			text:'RAID SHOOTER\nWEB ARCADE SURVIVAL\nWALLET READY\nBUILT FOR PLAYERS',
			hspacing: 1,
			vspacing: 17,
			halign: 'left',
			valign: 'top',
			scale: 2,
			snap: 1,
			render: 1
		} );
		$.ctxmg.fillStyle = '#fff';
		$.ctxmg.fill();

		var i = $.buttons.length; while( i-- ){ $.buttons[ i ].render( i ) }
			i = $.buttons.length; while( i-- ){ $.buttons[ i ].update( i ) }
	};

	$.states['play'] = function() {
		$.updateDelta();
		$.difficulty = 1 + ( $.elapsed / 3600 ) + ( $.level.current * 0.08 );
		$.updateScreen();
		$.updateLevel();
		if( $.state !== 'play' ) {
			return;
		}
		$.updateCombo();
		$.updatePowerupTimers();
		$.spawnEnemies();
		$.enemyOffsetMod += ( $.slow ) ? $.dt / 3 : $.dt;

		// update entities
		var i = $.enemies.length; while( i-- ){ $.enemies[ i ].update( i ) }
			i = $.explosions.length; while( i-- ){ $.explosions[ i ].update( i ) }
			i = $.powerups.length; while( i-- ){ $.powerups[ i ].update( i ) }
			i = $.particleEmitters.length; while( i-- ){ $.particleEmitters[ i ].update( i ) }
			i = $.textPops.length; while( i-- ){ $.textPops[ i ].update( i ) }
			i = $.levelPops.length; while( i-- ){ $.levelPops[ i ].update( i ) }
			i = $.bullets.length; while( i-- ){ $.bullets[ i ].update( i ) }
			$.updateEnemyBullets();
		$.hero.update();

		// render entities
		$.clearScreen();
		$.ctxmg.save();
		$.ctxmg.translate( $.screen.x - $.rumble.x, $.screen.y - $.rumble.y );
		i = $.enemies.length; while( i-- ){ $.enemies[ i ].render( i ) }
		i = $.explosions.length; while( i-- ){ $.explosions[ i ].render( i ) }
		i = $.powerups.length; while( i-- ){ $.powerups[ i ].render( i ) }
		i = $.particleEmitters.length; while( i-- ){ $.particleEmitters[ i ].render( i ) }
		i = $.textPops.length; while( i-- ){ $.textPops[ i ].render( i ) }
		i = $.bullets.length; while( i-- ){ $.bullets[ i ].render( i ) }
		$.renderEnemyBullets();
		$.hero.render();
		$.ctxmg.restore();
		i = $.levelPops.length; while( i-- ){ $.levelPops[ i ].render( i ) }

		// render virtual joystick left (movement)
		if( $.vjoyLeft.active ) {
			$.ctxmg.beginPath();
			$.ctxmg.arc( $.vjoyLeft.ox, $.vjoyLeft.oy, $.vjoyLeft.radius, 0, Math.PI * 2 );
			$.ctxmg.fillStyle = 'rgba(255, 255, 255, 0.15)';
			$.ctxmg.fill();
			$.ctxmg.strokeStyle = 'rgba(255, 255, 255, 0.3)';
			$.ctxmg.lineWidth = 2;
			$.ctxmg.stroke();

			$.ctxmg.beginPath();
			$.ctxmg.arc( $.vjoyLeft.cx, $.vjoyLeft.cy, 20, 0, Math.PI * 2 );
			$.ctxmg.fillStyle = 'rgba(255, 255, 255, 0.5)';
			$.ctxmg.fill();
		}

		// render virtual joystick right (aiming)
		if( $.vjoyRight.active ) {
			$.ctxmg.beginPath();
			$.ctxmg.arc( $.vjoyRight.ox, $.vjoyRight.oy, $.vjoyRight.radius, 0, Math.PI * 2 );
			$.ctxmg.fillStyle = 'rgba(255, 255, 255, 0.15)';
			$.ctxmg.fill();
			$.ctxmg.strokeStyle = 'rgba(255, 255, 255, 0.3)';
			$.ctxmg.lineWidth = 2;
			$.ctxmg.stroke();

			$.ctxmg.beginPath();
			$.ctxmg.arc( $.vjoyRight.cx, $.vjoyRight.cy, 20, 0, Math.PI * 2 );
			$.ctxmg.fillStyle = 'rgba(255, 255, 255, 0.5)';
			$.ctxmg.fill();
		}
		$.renderInterface();
		$.renderMinimap();

		// handle gameover
		if( $.hero.life <= 0 ) {
			var alpha = ( ( $.gameoverTick / $.gameoverTickMax ) * 0.8 );
				alpha = Math.min( 1, Math.max( 0, alpha ) );
			$.ctxmg.fillStyle = 'hsla(0, 100%, 0%, ' + alpha + ')';
			$.ctxmg.fillRect( 0, 0, $.cw, $.ch );
			if( $.gameoverTick < $.gameoverTickMax ){
				$.gameoverTick += $.dt;
			} else {
				$.setState( 'gameover' );
			}

			if( !$.gameoverExplosion ) {
				$.audio.play( 'death' );
				$.rumble.level = 25;
				$.explosions.push( new $.Explosion( {
					x: $.hero.x + $.util.rand( -10, 10 ),
					y: $.hero.y + $.util.rand( -10, 10 ),
					radius: 50,
					hue: 0,
					saturation: 0
				} ) );
				$.particleEmitters.push( new $.ParticleEmitter( {
					x: $.hero.x,
					y: $.hero.y,
					count: 45,
					spawnRange: 10,
					friction: 0.95,
					minSpeed: 2,
					maxSpeed: 20,
					minDirection: 0,
					maxDirection: $.twopi,
					hue: 0,
					saturation: 0
				} ) );
				for( var i = 0; i < $.powerupTimers.length; i++ ){
					$.powerupTimers[ i ] = 0;
				}
				$.gameoverExplosion = 1;
			}
		}

		// update tick
		$.tick += $.dt;

		// listen for pause
		if( $.keys.pressed.p ){
			$.setState( 'pause' );
		}

		// always listen for autofire toggle
		if( $.keys.pressed.f ){
			$.autofire = ~~!$.autofire;
			$.storage['autofire'] = $.autofire;
			$.updateStorage();
		}
	};

	$.states['upgrade'] = function() {
		$.clearScreen();
		$.ctxmg.putImageData( $.screenshot, 0, 0 );
		$.ctxmg.fillStyle = 'hsla(0, 0%, 0%, 0.72)';
		$.ctxmg.fillRect( 0, 0, $.cw, $.ch );

		$.ctxmg.beginPath();
		var upgradeTitle = $.text( {
			ctx: $.ctxmg,
			x: $.cw / 2,
			y: $.ch / 2 - 120,
			text: 'CHOOSE UPGRADE',
			hspacing: 2,
			vspacing: 1,
			halign: 'center',
			valign: 'bottom',
			scale: 6,
			snap: 1,
			render: 1
		} );
		var gradient = $.ctxmg.createLinearGradient( upgradeTitle.sx, upgradeTitle.sy, upgradeTitle.sx, upgradeTitle.ey );
		gradient.addColorStop( 0, '#fff' );
		gradient.addColorStop( 1, '#8cf' );
		$.ctxmg.fillStyle = gradient;
		$.ctxmg.fill();

		for( var ui = 0; ui < $.upgradeChoices.length; ui++ ) {
			var upgrade = $.upgradeChoices[ ui ];
			$.ctxmg.beginPath();
			$.text( {
				ctx: $.ctxmg,
				x: $.cw / 2,
				y: $.ch / 2 - 10 + ui * 70,
				text: upgrade.description,
				hspacing: 1,
				vspacing: 1,
				halign: 'center',
				valign: 'top',
				scale: 1,
				snap: 1,
				render: 1
			} );
			$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.55)';
			$.ctxmg.fill();
		}

		var i = $.buttons.length; while( i-- ){ $.buttons[ i ].render( i ) }
			i = $.buttons.length; while( i-- ){ $.buttons[ i ].update( i ) }
	};

	$.states['pause'] = function() {


		$.clearScreen();
		$.ctxmg.putImageData( $.screenshot, 0, 0 );

		$.ctxmg.fillStyle = 'hsla(0, 0%, 0%, 0.4)';
		$.ctxmg.fillRect( 0, 0, $.cw, $.ch );

		$.ctxmg.beginPath();
		var pauseText = $.text( {
			ctx: $.ctxmg,
			x: $.cw / 2,
			y: $.ch / 2 - 50,
			text: 'PAUSED',
			hspacing: 3,
			vspacing: 1,
			halign: 'center',
			valign: 'bottom',
			scale: 10,
			snap: 1,
			render: 1
		} );
		var gradient = $.ctxmg.createLinearGradient( pauseText.sx, pauseText.sy, pauseText.sx, pauseText.ey );
		gradient.addColorStop( 0, '#fff' );
		gradient.addColorStop( 1, '#999' );
		$.ctxmg.fillStyle = gradient;
		$.ctxmg.fill();

		var i = $.buttons.length; while( i-- ){ $.buttons[ i ].render( i ) }
			i = $.buttons.length; while( i-- ){ $.buttons[ i ].update( i ) }

		if( $.keys.pressed.p ){
			$.setState( 'play' );
		}
	};

	$.states['gameover'] = function() {


		$.clearScreen();
		$.ctxmg.putImageData( $.screenshot, 0, 0 );

		var i = $.buttons.length; while( i-- ){ $.buttons[ i ].update( i ) }
			i = $.buttons.length; while( i-- ){ $.buttons[ i ].render( i ) }

		$.ctxmg.beginPath();
		var gameoverTitle = $.text( {
			ctx: $.ctxmg,
			x: $.cw / 2,
			y: 150,
			text: 'GAME OVER',
			hspacing: 3,
			vspacing: 1,
			halign: 'center',
			valign: 'bottom',
			scale: 10,
			snap: 1,
			render: 1
		} );
		var gradient = $.ctxmg.createLinearGradient( gameoverTitle.sx, gameoverTitle.sy, gameoverTitle.sx, gameoverTitle.ey );
		gradient.addColorStop( 0, '#f22' );
		gradient.addColorStop( 1, '#b00' );
		$.ctxmg.fillStyle = gradient;
		$.ctxmg.fill();

		$.ctxmg.beginPath();
		var gameoverStatsKeys = $.text( {
			ctx: $.ctxmg,
			x: $.cw / 2 - 10,
			y: gameoverTitle.ey + 51,
			text: 'SCORE\nLEVEL\nKILLS\nACCURACY\nBEST COMBO\nUPGRADES\nTIME',
			hspacing: 1,
			vspacing: 17,
			halign: 'right',
			valign: 'top',
			scale: 2,
			snap: 1,
			render: 1
		} );
		$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.5)';
		$.ctxmg.fill();

		$.ctxmg.beginPath();
		var gameoverStatsValues = $.text( {
			ctx: $.ctxmg,
			x: $.cw / 2 + 10,
			y: gameoverTitle.ey + 51,
			text:
				$.util.commas( $.score ) + '\n' +
				( $.level.current + 1 ) + '\n' +
				$.util.commas( $.kills ) + '\n' +
				$.getAccuracy() + ' PCT\n' +
				'X' + $.bestCombo + '\n' +
				$.getUpgradeCount() + '\n' +
				$.util.convertTime( ( $.elapsed * ( 1000 / 60 ) ) / 1000 )
			,
			hspacing: 1,
			vspacing: 17,
			halign: 'left',
			valign: 'top',
			scale: 2,
			snap: 1,
			render: 1
		} );
		$.ctxmg.fillStyle = '#fff';
		$.ctxmg.fill();

		if( $.newRecord ) {
			$.ctxmg.beginPath();
			$.text( {
				ctx: $.ctxmg,
				x: $.cw / 2,
				y: gameoverTitle.sy - 34,
				text: 'NEW RECORD',
				hspacing: 2,
				vspacing: 1,
				halign: 'center',
				valign: 'bottom',
				scale: 3,
				snap: 1,
				render: 1
			} );
			$.ctxmg.fillStyle = '#fff';
			$.ctxmg.fill();
		}
	};
}

/*==============================================================================
Loop
==============================================================================*/
$.loop = function() {
	requestAnimFrame( $.loop );

	// setup the pressed state for all keys
	for( var k in $.keys.state ) {
		if( $.keys.state[ k ] && !$.okeys[ k ] ) {
			$.keys.pressed[ k ] = 1;
		} else {
			$.keys.pressed[ k ] = 0;
		}
	}

	// run the current state
	$.states[ $.state ]();

	// always listen for mute toggle
	if( $.keys.pressed.m ){
		$.mute = ~~!$.mute;
		var i = $.audio.references.length;
		while( i-- ) {
			$.audio.references[ i ].volume = ~~!$.mute;
		}
		$.storage['mute'] = $.mute;
		$.updateStorage();
	}

	// move current keys into old keys
	$.okeys = {};
	for( var k in $.keys.state ) {
		$.okeys[ k ] = $.keys.state[ k ];
	}
};

/*==============================================================================
Start Game on Load
==============================================================================*/
// In Next.js, scripts load after the window 'load' event has fired,
// so we check document.readyState and init immediately if already loaded.
if (document.readyState === 'complete') {
	document.documentElement.className += ' loaded';
	$.init();
} else {
	window.addEventListener( 'load', function() {
		document.documentElement.className += ' loaded';
		$.init();
	});
}
