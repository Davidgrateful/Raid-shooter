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
	$.setupCanvasSizes();

	$.mute = $.storage['mute'];
	$.autofire = $.storage['autofire'];
	$.slowEnemyDivider = 2;

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
			p: 0,
			dash: 0
		},
		pressed: {
			up: 0,
			down: 0,
			left: 0,
			right: 0,
			f: 0,
			m: 0,
			p: 0,
			dash: 0
		}
	};
	$.isTouchDevice = ( 'ontouchstart' in window ) ? 1 : 0;
	$.perfLite = $.isTouchDevice;
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
	$.renderForeground();
	$.renderFavicon();
	$.setState( 'menu' );
	$.loop();
};

/*==============================================================================
Canvas Sizing (run at init and again when the screen changes, e.g. a phone
rotating to landscape or entering fullscreen)
==============================================================================*/
$.setupCanvasSizes = function() {
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

	$.minimap = {
		x: 20,
		y: $.ch - Math.floor( $.ch * 0.1 ) - 20,
		width: Math.floor( $.cw * 0.1 ),
		height: Math.floor( $.ch * 0.1 ),
		scale: Math.floor( $.cw * 0.1 ) / $.ww,
		color: 'hsla(0, 0%, 0%, 0.85)',
		strokeColor: '#3a3a3a'
	};
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
	// first-ever run gets a longer, clearer tutorial pass; 'seen' is written
	// when play actually begins (setState 'play'), not here - reset also runs
	// on the menu, which would otherwise consume the first-run flag early
	$.firstRun = !$.storage['seen'];
	$.instructionTickMax = $.firstRun ? 800 : 400;

	$.levelDiffOffset = 0;
	$.enemyOffsetMod = 0;
	$.slow = 0;

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
	$.powerupsCollected = 0;
	$.score = 0;

	$.combo = 0;
	$.comboTimer = 0;
	$.comboTimerMax = 120;
	$.comboMultiplier = 1;
	$.bestCombo = 0;
	$.spawnLullTick = 0;

	// difficulty multipliers chosen in settings
	$.diff = $.difficulties.extreme;
	$.dashRequest = 0;
	$.nukeFlashTick = 0;

	$.hero = new $.Hero();
	$.resetUpgrades();
	// FOUNDER-style abilities grant a random starting upgrade
	if( $.hero.character.ability && $.hero.character.ability.startUpgrade ) {
		var starters = $.definitions.upgrades;
		$.upgrades[ starters[ Math.floor( $.util.rand( 0, starters.length ) ) ].id ] = 1;
		$.recomputeUpgrades();
	}
	$.resetSector();

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
	var gradient = $.ctxbg1.createRadialGradient( $.cbg1.width / 2, $.cbg1.height / 2, 0, $.cbg1.width / 2, $.cbg1.height / 2, $.cbg1.height );
	gradient.addColorStop( 0, 'hsla(0, 0%, 100%, 0.1)' );
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
	var i = 80;
	while( i-- ) {
		$.util.fillCircle( $.ctxbg2, $.util.rand( 0, $.cbg2.width ), $.util.rand( 0, $.cbg2.height ), $.util.rand( 1, 2 ), 'hsla(0, 0%, 100%, ' + $.util.rand( 0.05, 0.15 ) + ')' );
	}
}

$.renderBackground3 = function() {
	var i = 40;
	while( i-- ) {
		$.util.fillCircle( $.ctxbg3, $.util.rand( 0, $.cbg3.width ), $.util.rand( 0, $.cbg3.height ), $.util.rand( 1, 2.5 ), 'hsla(0, 0%, 100%, ' + $.util.rand( 0.05, 0.1 ) + ')' );
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
				$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, ' + ( 0.25 + ( ( $.powerupTimers[ i ] / $.powerupDuration ) * 0.75 ) ) + ')';
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
				$.ctxmg.fillRect( powerupBar.x, powerupBar.y, ( $.powerupTimers[ i ] / $.powerupDuration ) * powerupBar.width, powerupBar.height );
			}
		}

		/*==============================================================================
		First-run tutorial banner
		==============================================================================*/
		if( $.firstRun && $.instructionTick < 360 ) {
			var tutAlpha = Math.min( 1, $.instructionTick / 40 ) * Math.min( 1, ( 360 - $.instructionTick ) / 60 );
			$.ctxmg.beginPath();
			$.text( {
				ctx: $.ctxmg,
				x: $.cw / 2,
				y: $.ch * 0.3,
				text: $.isTouchDevice ? 'LEFT THUMB MOVES\nRIGHT THUMB AIMS AND FIRES\nDOUBLE TAP LEFT TO DASH' : 'MOVE TO DODGE\nMOUSE AIMS AND FIRES\nSHIFT OR SPACE TO DASH',
				hspacing: 1,
				vspacing: 10,
				halign: 'center',
				valign: 'center',
				scale: 2,
				snap: 1,
				render: 1
			} );
			$.ctxmg.fillStyle = 'hsla(45, 100%, 70%, ' + ( tutAlpha * 0.9 ) + ')';
			$.ctxmg.fill();
		}

		/*==============================================================================
		Instructions
		==============================================================================*/
		if( $.instructionTick < $.instructionTickMax ){
			$.instructionTick += $.dt;
			$.ctxmg.beginPath();
			$.text( {
				ctx: $.ctxmg,
				x: $.cw / 2 - 10,
				y: $.ch - 20,
				text: $.isTouchDevice ? 'MOVE\nAIM AND FIRE\nDASH' : 'MOVE\nAIM/FIRE\nDASH\nAUTOFIRE\nPAUSE\nMUTE',
				hspacing: 1,
				vspacing: 17,
				halign: 'right',
				valign: 'bottom',
				scale: 2,
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
				y: $.ch - 20,
				text: $.isTouchDevice ? 'LEFT THUMB\nRIGHT THUMB\nDOUBLE TAP LEFT' : 'WASD/ARROWS\nMOUSE\nSHIFT/SPACE\nF\nP\nM',
				hspacing: 1,
				vspacing: 17,
				halign: 'left',
				valign: 'bottom',
				scale: 2,
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
	Health (compact sizing keeps the whole HUD row on narrow phone screens)
	==============================================================================*/
	var hudCompact = ( $.cw < 900 ),
		hudScale = hudCompact ? 1 : 2,
		hudBarWidth = hudCompact ? 70 : 110,
		hudGap = hudCompact ? 18 : 40;
	$.ctxmg.beginPath();
	var healthText = $.text( {
		ctx: $.ctxmg,
		x: 20,
		y: 64,
		text: 'HEALTH',
		hspacing: 1,
		vspacing: 1,
		halign: 'top',
		valign: 'left',
		scale: hudScale,
		snap: 1,
		render: 1
	} );
	$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.5)';
	$.ctxmg.fill();
	var healthBar = {
		x: healthText.ex + 10,
		y: healthText.sy,
		width: hudBarWidth,
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
		x: healthBar.x + healthBar.width + hudGap,
		y: 64,
		text: 'PROGRESS',
		hspacing: 1,
		vspacing: 1,
		halign: 'top',
		valign: 'left',
		scale: hudScale,
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
		x: progressBar.x + progressBar.width + hudGap,
		y: 64,
		text: 'SCORE',
		hspacing: 1,
		vspacing: 1,
		halign: 'top',
		valign: 'left',
		scale: hudScale,
		snap: 1,
		render: 1
	} );
	$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.5)';
	$.ctxmg.fill();

	$.ctxmg.beginPath();
	var scoreText = $.text( {
		ctx: $.ctxmg,
		x: scoreLabel.ex + 10,
		y: 64,
		text: $.util.pad( $.score, 6 ),
		hspacing: 1,
		vspacing: 1,
		halign: 'top',
		valign: 'left',
		scale: hudScale,
		snap: 1,
		render: 1
	} );
	$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 1)';
	$.ctxmg.fill();

	$.ctxmg.beginPath();
	var bestLabel = $.text( {
		ctx: $.ctxmg,
		x: scoreText.ex + hudGap,
		y: 64,
		text: 'BEST',
		hspacing: 1,
		vspacing: 1,
		halign: 'top',
		valign: 'left',
		scale: hudScale,
		snap: 1,
		render: 1
	} );
	$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.5)';
	$.ctxmg.fill();

	$.ctxmg.beginPath();
	var bestText = $.text( {
		ctx: $.ctxmg,
		x: bestLabel.ex + 10,
		y: 64,
		text: $.util.pad( Math.max( $.storage['score'], $.score ), 6 ),
		hspacing: 1,
		vspacing: 1,
		halign: 'top',
		valign: 'left',
		scale: hudScale,
		snap: 1,
		render: 1
	} );
	$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 1)';
	$.ctxmg.fill();

	/*==============================================================================
	Combo Meter
	==============================================================================*/
	if( $.combo > 0 ) {
		$.ctxmg.beginPath();
		var comboText = $.text( {
			ctx: $.ctxmg,
			x: bestText.ex + hudGap,
			y: 64,
			text: 'COMBO ' + $.combo + ' X' + $.comboMultiplier,
			hspacing: 1,
			vspacing: 1,
			halign: 'top',
			valign: 'left',
			scale: hudScale,
			snap: 1,
			render: 1
		} );
		$.ctxmg.fillStyle = 'hsla(' + ( 40 + $.comboMultiplier * 5 ) + ', 100%, 60%, 1)';
		$.ctxmg.fill();

		// chain decay bar
		$.ctxmg.fillStyle = 'hsla(0, 0%, 20%, 1)';
		$.ctxmg.fillRect( comboText.sx, comboText.ey + 4, comboText.ex - comboText.sx, 3 );
		$.ctxmg.fillStyle = 'hsla(' + ( 40 + $.comboMultiplier * 5 ) + ', 100%, 60%, 1)';
		$.ctxmg.fillRect( comboText.sx, comboText.ey + 4, ( $.comboTimer / $.comboTimerMax ) * ( comboText.ex - comboText.sx ), 3 );
	}

	/*==============================================================================
	Dash Cooldown
	==============================================================================*/
	var dashReady = 1 - Math.max( 0, $.hero.dashCooldown ) / $.hero.dashCooldownMax;
	$.ctxmg.fillStyle = 'hsla(0, 0%, 20%, 1)';
	$.ctxmg.fillRect( healthBar.x, healthBar.y + healthBar.height + 4, healthBar.width, 3 );
	$.ctxmg.fillStyle = ( dashReady >= 1 ) ? 'hsla(0, 0%, 100%, 0.9)' : 'hsla(0, 0%, 60%, 0.6)';
	$.ctxmg.fillRect( healthBar.x, healthBar.y + healthBar.height + 4, dashReady * healthBar.width, 3 );

	/*==============================================================================
	Autofire Indicator
	==============================================================================*/
	if( $.autofire ) {
		$.ctxmg.beginPath();
		$.text( {
			ctx: $.ctxmg,
			x: $.cw - 20,
			y: 210,
			text: 'AUTOFIRE',
			hspacing: 1,
			vspacing: 1,
			halign: 'right',
			valign: 'top',
			scale: 1,
			snap: 1,
			render: 1
		} );
		$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.4)';
		$.ctxmg.fill();
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

	$.ctxmg.fillStyle = $.hero.fillStyle;
	$.ctxmg.fillRect( $.minimap.x + Math.floor( $.hero.x * $.minimap.scale ), $.minimap.y + Math.floor( $.hero.y * $.minimap.scale ), 2, 2 );

	$.ctxmg.strokeStyle = $.minimap.strokeColor;
	$.ctxmg.strokeRect( $.minimap.x - 0.5, $.minimap.y - 0.5, $.minimap.width + 1, $.minimap.height + 1 );
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
	var params = $.definitions.enemies[ type ],
		coordinates = $.getSpawnCoordinates( params.radius );
	params.x = coordinates.x;
	params.y = coordinates.y;
	params.start = coordinates.start;
	params.type = type;
	return new $.Enemy( params );
};

$.makeElite = function( enemy ) {
	var kinds = [ 'FAST', 'ARMORED', 'REGEN' ],
		kind = kinds[ Math.floor( $.util.rand( 0, kinds.length ) ) ];
	enemy.elite = kind;
	enemy.value = enemy.value * 3;
	if( kind === 'FAST' ) {
		enemy.speed *= 1.7;
	} else if( kind === 'ARMORED' ) {
		enemy.life = enemy.lifeMax = enemy.lifeMax * 3;
		enemy.radius = Math.floor( enemy.radius * 1.15 );
	} else {
		enemy.regen = enemy.lifeMax * 0.004;
	}
};

/*==============================================================================
Difficulty
==============================================================================*/
$.difficulties = {
	// One setting only: Raid Shooter runs at a single, punishing difficulty.
	// Faster spawns, relentless hunters, heavier hits, tankier enemies.
	extreme: { label: 'EXTREME', spawn: 0.58, hunt: 1.55, dmg: 1.75, enemyHp: 1.6 }
};

// eases the opening: with EXTREME as the only difficulty, the ramp now
// stretches over the first several levels so new players get a real runway
// before the full spawn rate, hunting, and damage hit (returns ~0.35 -> 1)
$.introMult = function() {
	return Math.min( 1, 0.35 + ( $.level ? $.level.current : 0 ) * 0.16 );
};

$.spawnEnemies = function() {
	// breathing room after an upgrade draft before the next wave
	if( $.spawnLullTick > 0 ) {
		$.spawnLullTick -= $.dt;
		return;
	}
	var floorTick = Math.floor( $.tick );
	// during a boss fight, minions keep coming but at a slower cadence so the
	// fight stays about the boss while never feeling empty
	var bossMult = $.boss ? 2.2 : 1,
		// larger interval = slower spawns: difficulty scales it, intro ramp
		// stretches it further during the opening levels
		spawnScale = ( $.diff ? $.diff.spawn : 1 ) / $.introMult();
	for( var i = 0; i < $.level.distributionCount; i++ ) {
		var timeCheck = Math.round( $.level.distribution[ i ] * bossMult * spawnScale );
		if( $.levelDiffOffset > 0 ){
			timeCheck = Math.max( 1, timeCheck - ( $.levelDiffOffset * 2) );
		}
		if( floorTick % timeCheck === 0 ) {
			var enemy = $.spawnEnemy( i );
			// elites start appearing from level 4, getting more common with depth
			if( $.level.current >= 3 && Math.random() < Math.min( 0.16, 0.04 + $.level.current * 0.01 ) ) {
				$.makeElite( enemy );
			}
			$.enemies.push( enemy );
		}
	}
};

/*==============================================================================
Events
==============================================================================*/
// touches and clicks that belong to HTML overlays (wallet modal, header)
// must not be hijacked by the game, or those buttons never receive taps
$.eventInsideUi = function( e ) {
	var t = e.target;
	return !!( t && t.closest && t.closest( 'header, w3m-modal, appkit-modal, wcm-modal, [role=dialog], nextjs-portal' ) );
};

$.mousemovecb = function( e ) {
	if( $.eventInsideUi( e ) ) {
		return;
	}
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
	if( $.eventInsideUi( e ) ) {
		return;
	}
	e.preventDefault();
	$.mouse.down = 1;

	var isTouch = !!e.changedTouches;
	var touches = e.changedTouches ? e.changedTouches : [e];

	for( var i = 0; i < touches.length; i++ ) {
		var tx = touches[i].pageX;
		var ty = touches[i].pageY;
		var tid = e.changedTouches ? touches[i].identifier : 0;

		$.mouse.ax = tx;
		$.mouse.ay = ty;
		$.mousescreen();

		// Check if touching UI Button. Touch taps can begin and end within a
		// single frame, so fire the action here instead of relying on the
		// per-frame hover polling in Button.update
		var buttonHovered = false;
		for( var j = 0; j < $.buttons.length; j++ ) {
			var b = $.buttons[j];
			if( $.util.pointInRect( $.mouse.sx, $.mouse.sy, b.sx, b.sy, b.width, b.height ) ) {
				buttonHovered = true;
				if( isTouch ) {
					$.audio.play( 'click' );
					$.mouse.down = 0;
					b.action();
				}
				break;
			}
		}

		// virtual joysticks are touch-only: on desktop the mouse aims and
		// fires directly, so spawning a joystick would hijack WASD movement
		if( !buttonHovered && isTouch ) {
			if( tx < $.cw / 2 && !$.vjoyLeft.active ) {
				// double-tap on the movement side triggers a dash
				var now = Date.now();
				if( now - ( $.lastLeftTouchTime || 0 ) < 300 ) {
					$.dashRequest = 1;
				}
				$.lastLeftTouchTime = now;
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
	// always release game input, but only swallow the event when it
	// belongs to the game rather than an HTML overlay
	if( !$.eventInsideUi( e ) ) {
		e.preventDefault();
	}
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
	if( e === 16 || e === 32 ){ $.keys.state.dash = 1; }
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
	if( e === 16 || e === 32 ){ $.keys.state.dash = 0; }
}

$.updateCanvasOffset = function() {
	var rect = $.cmg.getBoundingClientRect();
	$.cOffset = {
		left: rect.left,
		top: rect.top,
		width: rect.width,
		height: rect.height
	}
}

$.resizecb = function( e ) {
	$.updateCanvasOffset();

	// re-fit the game to the new screen while idle in a menu (covers phones
	// rotating to landscape and entering/leaving fullscreen); a mid-run
	// resize is left alone so it cannot disrupt gameplay
	clearTimeout( $.resizeTimeout );
	$.resizeTimeout = setTimeout( function() {
		if( $.state === 'menu' || $.state === 'stats' || $.state === 'credits' ) {
			$.setupCanvasSizes();
			$.renderBackground1();
			$.renderBackground2();
			$.renderBackground3();
			$.renderBackground4();
			$.renderForeground();
			$.setState( $.state );
			$.updateCanvasOffset();
		}
	}, 250 );
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

	// screen shake disabled: drain rumble level without offsetting the view
	if( $.rumble.level > 0 ) {
		$.rumble.level -= $.rumble.decay;
		$.rumble.level = ( $.rumble.level < 0 ) ? 0 : $.rumble.level;
	}
	$.rumble.x = 0;
	$.rumble.y = 0;

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

/*==============================================================================
Combo
==============================================================================*/
$.registerKill = function( value, radius ) {
	$.score += value * $.comboMultiplier;
	$.combo++;
	$.comboTimer = $.comboTimerMax;
	// kills only restore hull for pilots whose skill heals on kills (VAMPIRE);
	// everyone else recovers by clearing levels, not by passive trickle
	var ability = $.hero.character && $.hero.character.ability,
		heal = ( ability && ability.killHealMult )
			? Math.min( 0.045, ( radius || 15 ) * 0.00035 ) * ability.killHealMult
			: 0;
	if( heal > 0 && $.hero.life > 0 ) {
		$.hero.life = Math.min( 1, $.hero.life + heal );
	}
	$.bestCombo = Math.max( $.bestCombo, $.combo );
	var multiplier = Math.min( 8, 1 + Math.floor( $.combo / 4 ) );
	if( multiplier > $.comboMultiplier ) {
		$.audio.play( 'powerup' );
	}
	$.comboMultiplier = multiplier;
};

$.breakCombo = function() {
	$.combo = 0;
	$.comboTimer = 0;
	$.comboMultiplier = 1;
};

$.updateCombo = function() {
	if( $.comboTimer > 0 ) {
		$.comboTimer -= $.dt;
		if( $.comboTimer <= 0 ) {
			$.breakCombo();
		}
	}
};

$.updateLevel = function() {
	if( $.level.kills >= $.level.killsToLevel && !$.boss ) {
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
		// clearing a level patches the hull — the main way pilots recover
		if( $.hero.life > 0 ) {
			$.hero.life = Math.min( 1, $.hero.life + 0.35 );
		}
		$.levelPops.push( new $.LevelPop( {
			level: $.level.current + 1
		} ) );
		$.updateSector();
		// a boss guards every fifth level
		if( ( $.level.current + 1 ) % 5 === 0 ) {
			$.spawnBoss();
		}
		$.openUpgradeDraft();
	}
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
	if( $.powerupTimers[ 2 ] > 0 ){
		$.hero.weapon.fireRate = Math.max( 1.2, $.hero.weapon.baseFireRate * 0.4 );
		$.hero.weapon.bullet.speed = $.hero.weapon.baseBulletSpeed + 4;
		$.powerupTimers[ 2 ] -= $.dt;
	} else {
		$.hero.weapon.fireRate = $.hero.weapon.baseFireRate;
		$.hero.weapon.bullet.speed = $.hero.weapon.baseBulletSpeed;
	}

	// TRIPLE SHOT
	if( $.powerupTimers[ 3 ] > 0 ){
		$.hero.weapon.count = $.hero.weapon.baseCount + 2;
		$.powerupTimers[ 3 ] -= $.dt;
	} else {
		$.hero.weapon.count = $.hero.weapon.baseCount;
	}

	// PIERCE SHOT
	if( $.powerupTimers[ 4 ] > 0 ){
		$.hero.weapon.bullet.piercing = 1;
		$.powerupTimers[ 4 ] -= $.dt;
	} else {
		$.hero.weapon.bullet.piercing = $.hero.weapon.basePiercing;
	}

	// SHIELD (invulnerability; checked by hero and hazard damage)
	if( $.powerupTimers[ 5 ] > 0 ){
		$.powerupTimers[ 5 ] -= $.dt;
	}
};

// NUKE pickup: heavy damage to everything on the field except bosses
$.detonateNuke = function() {
	$.audio.play( 'explosion' );
	$.rumble.level = 12;
	$.nukeFlashTick = 14;
	var ei = $.enemies.length;
	while( ei-- ) {
		var enemy = $.enemies[ ei ];
		if( !enemy.isBoss ) {
			enemy.receiveDamage( ei, 6 );
		}
	}
};

$.spawnPowerup = function( x, y ) {
	if( Math.random() < $.powerupDropChance ) {
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

	// the Shooterboard only needs to poll while it's actually on screen
	if( $.boardRefreshTimer ) {
		clearInterval( $.boardRefreshTimer );
		$.boardRefreshTimer = null;
	}

	// mobile gets a thumb-reach BACK button on every sub-screen
	if( $.isTouchDevice && ( state == 'hangar' || state == 'market' || state == 'board' || state == 'stats' || state == 'credits' || state == 'settings' ) ) {
		$.buttons.push( new $.Button( {
			x: 54,
			y: 70,
			lockedWidth: 89,
			lockedHeight: 39,
			scale: 1,
			title: 'BACK',
			action: function() {
				$.mouse.down = 0;
				$.setState( 'menu' );
			}
		} ) );
	}

	if( state == 'menu' ) {
		$.mouse.down = 0;
		$.mouse.ax = 0;
		$.mouse.ay = 0;

		$.reset();

		// compact layout: two columns of buttons on short screens (phone
		// landscape), where a single stacked column runs off the bottom
		var menuCompact = ( $.ch < 640 ),
			menuSpacing = menuCompact ? 8 : 22,
			menuButtonHeight = menuCompact ? 45 : 49,
			menuStartY = menuCompact ? 112 : $.ch / 2 - 80;

		$.fetchSession();

		var menuDefs = [
			{ title: 'PLAY', scale: menuCompact ? 2 : 3, action: function() {
				$.reset();
				$.audio.play( 'levelup' );
				$.music.start();
				$.setState( 'play' );
			} },
			{ title: 'PILOT: ' + $.currentCharacter().title, scale: menuCompact ? 1 : 2, action: function() {
				$.mouse.down = 0;
				$.setState( 'hangar' );
			} },
			{ title: 'MARKET', scale: menuCompact ? 2 : 3, action: function() {
				$.mouse.down = 0;
				$.setState( 'market' );
			} },
			{ title: 'SHOOTERBOARD', scale: menuCompact ? 1 : 2, action: function() {
				$.mouse.down = 0;
				// a name is required before the board is shown the first time,
				// so every row on screen — including the player's own — has a
				// real, chosen name rather than a silent auto-generated default
				if( !$.storage['pilotname'] ) {
					$.promptPilotName();
				}
				$.ensurePilotName();
				$.setState( 'board' );
			} },
			{ title: 'STATS', scale: menuCompact ? 2 : 3, action: function() {
				$.setState( 'stats' );
			} },
			{ title: 'CREDITS', scale: menuCompact ? 2 : 3, action: function() {
				$.setState( 'credits' );
			} }
		];
		menuDefs.push( { title: 'SETTINGS', scale: menuCompact ? 2 : 3, action: function() {
			$.mouse.down = 0;
			$.setState( 'settings' );
		} } );

		for( var mi = 0; mi < menuDefs.length; mi++ ) {
			var menuX = $.cw / 2 + ( ( mi % 2 ) ? ( menuCompact ? 106 : 156 ) : ( menuCompact ? -104 : -154 ) ),
				menuY = menuStartY + Math.floor( mi / 2 ) * ( menuButtonHeight + menuSpacing );
			$.buttons.push( new $.Button( {
				x: menuX,
				y: menuY,
				lockedWidth: menuCompact ? 199 : 299,
				lockedHeight: menuButtonHeight,
				scale: menuDefs[ mi ].scale,
				title: menuDefs[ mi ].title,
				action: menuDefs[ mi ].action
			} ) );
		}
	}

	if( state == 'hangar' ) {
		$.mouse.down = 0;
		if( !$.hangarKeep ) {
			$.hangarIndex = $.storage['character'] || 0;
			if( $.hangarIndex >= $.definitions.characters.length ) {
				$.hangarIndex = 0;
			}
			$.hangarView = 'ship';
			$.hangarPage = Math.floor( $.hangarIndex / 8 );
		}
		$.hangarKeep = 0;

		var hangarCompact = ( $.ch < 640 ),
			arrowY = hangarCompact ? Math.floor( $.ch * 0.42 ) : Math.floor( $.ch * 0.38 ),
			row1Y = $.ch - ( hangarCompact ? 78 : 124 ),
			row2Y = $.ch - ( hangarCompact ? 30 : 60 );

		if( $.hangarView === 'grid' ) {
			var cols = 4,
				gap = 12,
				cardWidth = Math.min( 210, Math.floor( ( $.cw - 200 - ( cols - 1 ) * gap ) / cols ) ),
				cardHeight = hangarCompact ? 88 : 150,
				gridTop = hangarCompact ? 52 : 150,
				gridWidth = cols * cardWidth + ( cols - 1 ) * gap,
				gridX = ( $.cw - gridWidth ) / 2,
				pageStart = $.hangarPage * 8,
				pageCount = Math.ceil( $.definitions.characters.length / 8 );

			for( var ci = pageStart; ci < Math.min( pageStart + 8, $.definitions.characters.length ); ci++ ) {
				var slot = ci - pageStart,
					col = slot % cols,
					row = Math.floor( slot / cols );
				$.buttons.push( new $.GridCard( {
					x: gridX + cardWidth / 2 + col * ( cardWidth + gap ),
					y: gridTop + cardHeight / 2 + row * ( cardHeight + gap ),
					width: cardWidth,
					height: cardHeight,
					charIndex: ci,
					def: $.definitions.characters[ ci ]
				} ) );
			}

			$.buttons.push( new $.Button( {
				x: gridX - 56,
				y: gridTop + cardHeight + gap / 2,
				lockedWidth: 89,
				lockedHeight: 45,
				scale: 2,
				title: 'PREV',
				action: function() {
					$.mouse.down = 0;
					var pages = Math.ceil( $.definitions.characters.length / 8 );
					$.hangarPage = ( $.hangarPage - 1 + pages ) % pages;
					$.hangarKeep = 1;
					$.setState( 'hangar' );
				}
			} ) );
			$.buttons.push( new $.Button( {
				x: gridX + gridWidth + 56,
				y: gridTop + cardHeight + gap / 2,
				lockedWidth: 89,
				lockedHeight: 45,
				scale: 2,
				title: 'NEXT',
				action: function() {
					$.mouse.down = 0;
					var pages = Math.ceil( $.definitions.characters.length / 8 );
					$.hangarPage = ( $.hangarPage + 1 ) % pages;
					$.hangarKeep = 1;
					$.setState( 'hangar' );
				}
			} ) );
			$.buttons.push( new $.Button( {
				x: $.cw / 2 - 104,
				y: row2Y,
				lockedWidth: 199,
				lockedHeight: 45,
				scale: 1,
				title: 'VIEW: SHIP',
				action: function() {
					$.mouse.down = 0;
					$.hangarView = 'ship';
					$.hangarKeep = 1;
					$.setState( 'hangar' );
				}
			} ) );
			$.buttons.push( new $.Button( {
				x: $.cw / 2 + 106,
				y: row2Y,
				lockedWidth: 199,
				lockedHeight: 45,
				scale: 2,
				title: 'MENU',
				action: function() {
					$.mouse.down = 0;
					$.setState( 'menu' );
				}
			} ) );
		} else {
			$.buttons.push( new $.Button( {
				x: $.cw / 2 - ( hangarCompact ? 150 : 220 ),
				y: arrowY,
				lockedWidth: 89,
				lockedHeight: 45,
				scale: 2,
				title: 'PREV',
				action: function() {
					$.mouse.down = 0;
					$.hangarIndex = ( $.hangarIndex - 1 + $.definitions.characters.length ) % $.definitions.characters.length;
				}
			} ) );
			$.buttons.push( new $.Button( {
				x: $.cw / 2 + ( hangarCompact ? 150 : 220 ),
				y: arrowY,
				lockedWidth: 89,
				lockedHeight: 45,
				scale: 2,
				title: 'NEXT',
				action: function() {
					$.mouse.down = 0;
					$.hangarIndex = ( $.hangarIndex + 1 ) % $.definitions.characters.length;
				}
			} ) );
			$.buttons.push( new $.Button( {
				x: $.cw / 2 - 104,
				y: row1Y,
				lockedWidth: 199,
				lockedHeight: 45,
				scale: 2,
				title: 'SELECT',
				action: function() {
					$.mouse.down = 0;
					var def = $.definitions.characters[ $.hangarIndex ];
					if( $.characterUnlocked( def ) ) {
						$.storage['character'] = $.hangarIndex;
						$.updateStorage();
					}
				}
			} ) );
			$.buttons.push( new $.Button( {
				x: $.cw / 2 + 106,
				y: row1Y,
				lockedWidth: 199,
				lockedHeight: 45,
				scale: 1,
				title: 'COLOR: ' + $.definitions.shipColors[ $.storage['ship'] || 0 ].title,
				action: function() {
					$.mouse.down = 0;
					$.storage['ship'] = ( ( $.storage['ship'] || 0 ) + 1 ) % $.definitions.shipColors.length;
					$.updateStorage();
					this.title = 'COLOR: ' + $.definitions.shipColors[ $.storage['ship'] ].title;
				}
			} ) );
			$.buttons.push( new $.Button( {
				x: $.cw / 2 - ( hangarCompact ? 160 : 180 ),
				y: row2Y,
				lockedWidth: hangarCompact ? 149 : 169,
				lockedHeight: 45,
				scale: 1,
				title: 'TRAIL: ' + ( $.equippedTrail() ? $.equippedTrail().title : 'NONE' ),
				action: function() {
					$.mouse.down = 0;
					// cycle through NONE plus owned trails
					var owned = [ '' ];
					for( var ti = 0; ti < $.definitions.trails.length; ti++ ) {
						if( $.ownsItem( $.definitions.trails[ ti ].id ) ) {
							owned.push( $.definitions.trails[ ti ].id );
						}
					}
					var current = owned.indexOf( $.storage['trail'] || '' );
					$.storage['trail'] = owned[ ( current + 1 ) % owned.length ];
					$.updateStorage();
					this.title = 'TRAIL: ' + ( $.equippedTrail() ? $.equippedTrail().title : 'NONE' );
				}
			} ) );
			$.buttons.push( new $.Button( {
				x: $.cw / 2 + 1,
				y: row2Y,
				lockedWidth: hangarCompact ? 149 : 169,
				lockedHeight: 45,
				scale: 1,
				title: 'VIEW: GRID',
				action: function() {
					$.mouse.down = 0;
					$.hangarView = 'grid';
					$.hangarPage = Math.floor( $.hangarIndex / 8 );
					$.hangarKeep = 1;
					$.setState( 'hangar' );
				}
			} ) );
			$.buttons.push( new $.Button( {
				x: $.cw / 2 + ( hangarCompact ? 160 : 180 ),
				y: row2Y,
				lockedWidth: hangarCompact ? 149 : 169,
				lockedHeight: 45,
				scale: 1,
				title: 'MENU',
				action: function() {
					$.mouse.down = 0;
					$.setState( 'menu' );
				}
			} ) );
		}
	}

	if( state == 'market' ) {
		$.mouse.down = 0;
		$.purchase = { status: '', itemId: null };
		// fetch once; the fetch callback rebuilds this screen when it lands
		if( !$.marketState.fetched && !$.marketState.loading ) {
			$.fetchMarket();
			$.fetchProfile();
		}

		var marketCompact = ( $.ch < 640 ),
			itemWidth = marketCompact ? 259 : 300,
			itemHeight = marketCompact ? 35 : 44,
			itemGap = marketCompact ? 5 : 9,
			itemColX = marketCompact ? 136 : 158,
			itemStartY = marketCompact ? 96 : 172;

		// item buttons are rebuilt whenever the screen is (re)entered, so
		// titles always reflect current ownership. Always two columns so the
		// list stays short and the back button is never pushed off-screen
		var buildItem = function( item, index ) {
			var owned = $.ownsItem( item.id ),
				label = item.title + '   ' + ( item.comingSoon ? 'SOON' : ( owned ? 'OWNED' : '$' + item.priceUsd ) ),
				column = index % 2,
				row = Math.floor( index / 2 ),
				x = $.cw / 2 + ( column ? itemColX : -itemColX + 2 );
			$.buttons.push( new $.Button( {
				x: x,
				y: itemStartY + row * ( itemHeight + itemGap ),
				lockedWidth: itemWidth,
				lockedHeight: itemHeight,
				scale: 1,
				title: label,
				action: function() {
					$.mouse.down = 0;
					if( !owned && !item.comingSoon ) {
						$.buyItem( item );
					}
				}
			} ) );
		};
		for( var ii = 0; ii < $.marketState.items.length; ii++ ) {
			buildItem( $.marketState.items[ ii ], ii );
		}

		// back button sits right below the grid, always on screen
		var marketRows = Math.ceil( $.marketState.items.length / 2 ),
			marketMenuY = itemStartY + marketRows * ( itemHeight + itemGap ) + ( marketCompact ? 14 : 30 );
		var marketMenuButton = new $.Button( {
			x: $.cw / 2 + 1,
			y: Math.min( marketMenuY, $.ch - ( marketCompact ? 26 : 44 ) ),
			lockedWidth: 299,
			lockedHeight: 45,
			scale: 2,
			title: 'BACK',
			action: function() {
				$.setState( 'menu' );
			}
		} );
		$.buttons.push( marketMenuButton );
	}

	if( state == 'settings' ) {
		$.mouse.down = 0;

		var settingsCompact = ( $.ch < 640 ),
			settingsTop = settingsCompact ? 84 : $.ch / 2 - 110,
			settingsGap = settingsCompact ? 52 : 60,
			settingsRow = 0;

		// single column on desktop, two columns on short screens so every
		// option (and the way back) stays on screen
		var settingsButton = function( title, action ) {
			var col = settingsCompact ? ( settingsRow % 2 ) : 0,
				rowN = settingsCompact ? Math.floor( settingsRow / 2 ) : settingsRow,
				b = new $.Button( {
					x: settingsCompact ? ( $.cw / 2 + ( col ? 104 : -104 ) ) : $.cw / 2 + 1,
					y: settingsTop + rowN * settingsGap,
					lockedWidth: settingsCompact ? 199 : 299,
					lockedHeight: 45,
					scale: 1,
					title: title,
					action: action
				} );
			$.buttons.push( b );
			settingsRow++;
			return b;
		};

		// Difficulty is fixed at EXTREME — no selector. Shown read-only so
		// players know what they're walking into.
		settingsButton( 'DIFFICULTY: EXTREME', function() {
			$.mouse.down = 0;
		} );

		var controlNames = { hybrid: 'HYBRID', keyboard: 'KEYBOARD', mouse: 'MOUSE' };
		settingsButton( 'CONTROLS: ' + controlNames[ $.storage['controls'] || 'hybrid' ], function() {
			$.mouse.down = 0;
			var order = [ 'hybrid', 'keyboard', 'mouse' ],
				next = order[ ( order.indexOf( $.storage['controls'] || 'hybrid' ) + 1 ) % order.length ];
			$.storage['controls'] = next;
			$.updateStorage();
			this.title = 'CONTROLS: ' + controlNames[ next ];
		} );

		settingsButton( 'MUSIC: ' + ( $.storage['music'] !== 0 ? 'ON' : 'OFF' ), function() {
			$.mouse.down = 0;
			$.storage['music'] = ( $.storage['music'] !== 0 ) ? 0 : 1;
			$.updateStorage();
			if( $.storage['music'] !== 0 ) {
				$.music.start();
			}
			this.title = 'MUSIC: ' + ( $.storage['music'] !== 0 ? 'ON' : 'OFF' );
		} );

		settingsButton( 'SOUND: ' + ( $.mute ? 'OFF' : 'ON' ), function() {
			$.mouse.down = 0;
			$.mute = ~~!$.mute;
			var ai = $.audio.references.length;
			while( ai-- ) {
				$.audio.references[ ai ].volume = ~~!$.mute;
			}
			$.storage['mute'] = $.mute;
			$.updateStorage();
			this.title = 'SOUND: ' + ( $.mute ? 'OFF' : 'ON' );
		} );

		if( document.documentElement.requestFullscreen ) {
			settingsButton( 'FULLSCREEN', function() {
				$.mouse.down = 0;
				if( document.fullscreenElement ) {
					document.exitFullscreen();
				} else {
					document.documentElement.requestFullscreen();
				}
			} );
		}

		var settingsRowsUsed = settingsCompact ? Math.ceil( settingsRow / 2 ) : settingsRow,
			settingsMenuButton = new $.Button( {
				x: $.cw / 2 + 1,
				y: settingsTop + settingsRowsUsed * settingsGap + ( settingsCompact ? 8 : 10 ),
				lockedWidth: 299,
				lockedHeight: 45,
				scale: 2,
				title: 'MENU',
				action: function() {
					$.setState( 'menu' );
				}
			} );
		$.buttons.push( settingsMenuButton );
	}

	if( state == 'board' ) {
		$.mouse.down = 0;
		$.fetchBoard();
		// keep the board live while the player is looking at it
		$.boardRefreshTimer = setInterval( function() {
			if( !$.board.loading ) {
				$.fetchBoard();
			}
		}, 10000 );

		var nameButton = new $.Button( {
			x: $.cw / 2 - 104,
			y: $.ch - 52,
			lockedWidth: 199,
			lockedHeight: 45,
			scale: 1,
			title: 'NAME: ' + ( $.storage['pilotname'] || 'SET' ),
			action: function() {
				$.mouse.down = 0;
				$.promptPilotName();
				this.title = 'NAME: ' + ( $.storage['pilotname'] || 'SET' );
			}
		} );
		$.buttons.push( nameButton );

		var boardMenuButton = new $.Button( {
			x: $.cw / 2 + 106,
			y: $.ch - 52,
			lockedWidth: 199,
			lockedHeight: 45,
			scale: 2,
			title: 'MENU',
			action: function() {
				$.setState( 'menu' );
			}
		} );
		$.buttons.push( boardMenuButton );
	}

	if( state == 'stats' ) {
		$.mouse.down = 0;

		var statsCompact = ( $.ch < 640 );

		var clearButton = new $.Button( {
			x: statsCompact ? $.cw / 2 - 104 : $.cw / 2 + 1,
			y: statsCompact ? $.ch - 34 : 426,
			lockedWidth: statsCompact ? 199 : 299,
			lockedHeight: statsCompact ? 45 : 49,
			scale: statsCompact ? 2 : 3,
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
			x: statsCompact ? $.cw / 2 + 106 : $.cw / 2 + 1,
			y: statsCompact ? $.ch - 34 : clearButton.ey + 25,
			lockedWidth: statsCompact ? 199 : 299,
			lockedHeight: statsCompact ? 45 : 49,
			scale: statsCompact ? 2 : 3,
			title: 'MENU',
			action: function() {
				$.setState( 'menu' );
			}
		} );
		$.buttons.push( menuButton );
	}

	if( state == 'credits' ) {
		$.mouse.down = 0;

		var creditsCompact = ( $.ch < 640 );

		var menuButton = new $.Button( {
			x: $.cw / 2 + 1,
			y: creditsCompact ? $.ch - 34 : 501,
			lockedWidth: 299,
			lockedHeight: creditsCompact ? 45 : 49,
			scale: creditsCompact ? 2 : 3,
			title: 'MENU',
			action: function() {
				$.setState( 'menu' );
			}
		} );
		$.buttons.push( menuButton );
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

	if( state == 'play' && $.isTouchDevice ) {
		// touch players have no P or M keys, give them on-screen buttons
		$.buttons.push( new $.Button( {
			x: $.cw - 64,
			y: 120,
			lockedWidth: 89,
			lockedHeight: 35,
			scale: 1,
			title: 'PAUSE',
			action: function() {
				$.setState( 'pause' );
			}
		} ) );
		$.buttons.push( new $.Button( {
			x: $.cw - 64,
			y: 162,
			lockedWidth: 89,
			lockedHeight: 35,
			scale: 1,
			title: $.mute ? 'UNMUTE' : 'MUTE',
			action: function() {
				$.mouse.down = 0;
				$.mute = ~~!$.mute;
				var ai = $.audio.references.length;
				while( ai-- ) {
					$.audio.references[ ai ].volume = ~~!$.mute;
				}
				$.storage['mute'] = $.mute;
				$.updateStorage();
				this.title = $.mute ? 'UNMUTE' : 'MUTE';
			}
		} ) );
	}

	if( state == 'upgrade' ) {
		$.mouse.down = 0;
		$.vjoyLeft.active = 0;
		$.vjoyRight.active = 0;
		$.screenshot = $.ctxmg.getImageData( 0, 0, $.cw, $.ch );

		var cardCount = $.upgradeChoices.length,
			cardGap = 20,
			cardWidth = Math.min( 300, Math.floor( ( $.cw - 40 - ( cardCount - 1 ) * cardGap ) / cardCount ) ),
			cardHeight = 170,
			totalWidth = cardCount * cardWidth + ( cardCount - 1 ) * cardGap,
			startX = ( $.cw - totalWidth ) / 2;

		for( var ci = 0; ci < cardCount; ci++ ) {
			( function( def, x ) {
				$.buttons.push( new $.UpgradeCard( {
					x: x,
					y: $.ch / 2 + 30,
					width: cardWidth,
					height: cardHeight,
					def: def,
					action: function() {
						$.chooseUpgrade( def.id );
					}
				} ) );
			} )( $.upgradeChoices[ ci ], startX + cardWidth / 2 + ci * ( cardWidth + cardGap ) );
		}
	}

	if( state == 'gameover' ) {
		$.mouse.down = 0;

		$.screenshot = $.ctxmg.getImageData( 0, 0, $.cw, $.ch );

		// short screens (phone landscape) place the buttons side by side
		// at the bottom; fixed tall positions would push them off-screen
		var goCompact = ( $.ch < 640 );

		var resumeButton = new $.Button( {
			x: goCompact ? $.cw / 2 - 104 : $.cw / 2 + 1,
			y: goCompact ? $.ch - 34 : 426,
			lockedWidth: goCompact ? 199 : 299,
			lockedHeight: goCompact ? 45 : 49,
			scale: goCompact ? 2 : 3,
			title: 'PLAY AGAIN',
			action: function() {
				$.reset();
				$.audio.play( 'levelup' );
				$.setState( 'play' );
			}
		} );
		$.buttons.push( resumeButton );

		var menuButton = new $.Button( {
			x: goCompact ? $.cw / 2 + 106 : $.cw / 2 + 1,
			y: goCompact ? $.ch - 34 : resumeButton.ey + 25,
			lockedWidth: goCompact ? 199 : 299,
			lockedHeight: goCompact ? 45 : 49,
			scale: goCompact ? 2 : 3,
			title: 'MENU',
			action: function() {
				$.setState( 'menu' );
			}
		} );
		$.buttons.push( menuButton );

		$.storage['score'] = Math.max( $.storage['score'], $.score );
		$.storage['level'] = Math.max( $.storage['level'], $.level.current );
		$.storage['combo'] = Math.max( $.storage['combo'] || 0, $.bestCombo );
		$.storage['rounds'] += 1;
		$.storage['kills'] += $.kills;
		$.storage['bullets'] += $.bulletsFired;
		$.storage['powerups'] += $.powerupsCollected;
		$.storage['time'] += Math.floor( $.elapsed );
		$.updateStorage();

		$.submitScore();
	}

	// set state
	$.state = state;

	// mark the tutorial seen once the player actually starts a run
	if( state === 'play' && $.firstRun && !$.storage['seen'] ) {
		$.storage['seen'] = 1;
		$.updateStorage();
	}

	// let the page shell (header etc) react to the game state
	if( typeof CustomEvent === 'function' ) {
		window.dispatchEvent( new CustomEvent( 'raidshooter:state', { detail: state } ) );
	}
};

$.setupStates = function() {
	$.states['menu'] = function() {


		$.clearScreen();
		$.updateScreen();

		var i = $.buttons.length; while( i-- ){ if( $.buttons[ i ] ) { $.buttons[ i ].update( i ) } }
			i = $.buttons.length; while( i-- ){ if( $.buttons[ i ] ) { $.buttons[ i ].render( i ) } }

		var menuCompact = ( $.ch < 640 );
		$.ctxmg.beginPath();
		var title = $.text( {
			ctx: $.ctxmg,
			x: $.cw / 2,
			y: menuCompact ? 70 : $.ch / 2 - 150,
			text: 'RAID SHOOTER',
			hspacing: 2,
			vspacing: 1,
			halign: 'center',
			valign: 'bottom',
			scale: menuCompact ? 6 : 10,
			snap: 1,
			render: 1
		} );
		gradient = $.ctxmg.createLinearGradient( title.sx, title.sy, title.sx, title.ey );
		gradient.addColorStop( 0, '#fff' );
		gradient.addColorStop( 1, '#999' );
		$.ctxmg.fillStyle = gradient;
		$.ctxmg.fill();

		if( !menuCompact ) {
			$.ctxmg.beginPath();
			var bottomInfo = $.text( {
				ctx: $.ctxmg,
				x: $.cw / 2,
				y: $.ch - 172,
				text: 'CREATED BY DAVID GRATEFUL',
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
		}

		// live build stamp (bottom-right) so you can tell at a glance which
		// deployed version is running - a stale build will show an old id
		$.ctxmg.beginPath();
		$.text( {
			ctx: $.ctxmg,
			x: $.cw - 12,
			y: $.ch - 12,
			text: 'BUILD ' + ( window.__BUILD || 'DEV' ).slice( 0, 7 ).toUpperCase(),
			hspacing: 1,
			vspacing: 1,
			halign: 'right',
			valign: 'bottom',
			scale: 1,
			snap: 1,
			render: 1
		} );
		$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.25)';
		$.ctxmg.fill();

	};

	$.states['hangar'] = function() {

		$.clearScreen();

		var hangarCompact = ( $.ch < 640 ),
			def = $.definitions.characters[ $.hangarIndex ],
			status = $.characterStatus( def ),
			previewY = hangarCompact ? Math.floor( $.ch * 0.42 ) : Math.floor( $.ch * 0.38 ),
			gridView = ( $.hangarView === 'grid' );

		$.ctxmg.beginPath();
		var hangarTitle = $.text( {
			ctx: $.ctxmg,
			x: $.cw / 2,
			y: hangarCompact ? 60 : 110,
			text: 'HANGAR',
			hspacing: 3,
			vspacing: 1,
			halign: 'center',
			valign: 'bottom',
			scale: hangarCompact ? 4 : 8,
			snap: 1,
			render: 1
		} );
		var gradient = $.ctxmg.createLinearGradient( hangarTitle.sx, hangarTitle.sy, hangarTitle.sx, hangarTitle.ey );
		gradient.addColorStop( 0, '#fff' );
		gradient.addColorStop( 1, '#999' );
		$.ctxmg.fillStyle = gradient;
		$.ctxmg.fill();

		if( gridView ) {
			$.ctxmg.beginPath();
			$.text( {
				ctx: $.ctxmg,
				x: $.cw / 2,
				y: hangarTitle.ey + ( hangarCompact ? 8 : 16 ),
				text: 'PAGE ' + ( $.hangarPage + 1 ) + ' / ' + Math.ceil( $.definitions.characters.length / 8 ),
				hspacing: 1,
				vspacing: 1,
				halign: 'center',
				valign: 'top',
				scale: 1,
				snap: 1,
				render: 1
			} );
			$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.35)';
			$.ctxmg.fill();

			$.tick += 1;
			var gi = $.buttons.length; while( gi-- ){ if( $.buttons[ gi ] ) { $.buttons[ gi ].update( gi ) } }
				gi = $.buttons.length; while( gi-- ){ if( $.buttons[ gi ] ) { $.buttons[ gi ].render( gi ) } }
			return;
		}

		// big animated ship preview, facing up
		var unlocked = $.characterUnlocked( def );
		$.ctxmg.save();
		$.ctxmg.translate( $.cw / 2, previewY );
		$.ctxmg.rotate( -$.pi / 2 );
		def.draw( $.ctxmg, hangarCompact ? 18 : 28, unlocked ? '#fff' : 'hsla(0, 0%, 35%, 1)', $.tick );
		$.ctxmg.restore();

		$.ctxmg.beginPath();
		$.text( {
			ctx: $.ctxmg,
			x: $.cw / 2,
			y: previewY + ( hangarCompact ? 42 : 64 ),
			text: def.title,
			hspacing: 2,
			vspacing: 1,
			halign: 'center',
			valign: 'top',
			scale: hangarCompact ? 2 : 3,
			snap: 1,
			render: 1
		} );
		$.ctxmg.fillStyle = unlocked ? 'hsla(0, 0%, 100%, 0.95)' : 'hsla(0, 0%, 100%, 0.4)';
		$.ctxmg.fill();

		if( def.ability ) {
			$.ctxmg.beginPath();
			$.text( {
				ctx: $.ctxmg,
				x: $.cw / 2,
				y: previewY + ( hangarCompact ? 84 : 132 ),
				text: def.ability.title + ': ' + def.ability.text,
				hspacing: 1,
				vspacing: 8,
				halign: 'center',
				valign: 'top',
				scale: hangarCompact ? 1 : 2,
				snap: 1,
				render: 1
			} );
			$.ctxmg.fillStyle = 'hsla(190, 100%, 70%, 0.8)';
			$.ctxmg.fill();
		}

		$.ctxmg.beginPath();
		$.text( {
			ctx: $.ctxmg,
			x: $.cw / 2,
			y: previewY + ( hangarCompact ? 68 : 100 ),
			text: status.text,
			hspacing: 1,
			vspacing: 8,
			halign: 'center',
			valign: 'top',
			scale: hangarCompact ? 1 : 2,
			snap: 1,
			render: 1
		} );
		$.ctxmg.fillStyle = status.color;
		$.ctxmg.fill();

		$.ctxmg.beginPath();
		$.text( {
			ctx: $.ctxmg,
			x: $.cw / 2,
			y: hangarTitle.ey + ( hangarCompact ? 8 : 16 ),
			text: ( $.hangarIndex + 1 ) + ' / ' + $.definitions.characters.length,
			hspacing: 1,
			vspacing: 1,
			halign: 'center',
			valign: 'top',
			scale: hangarCompact ? 1 : 2,
			snap: 1,
			render: 1
		} );
		$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.35)';
		$.ctxmg.fill();

		// advance the tick so ship previews animate (safe: PLAY/MENU reset it)
		$.tick += 1;

		var i = $.buttons.length; while( i-- ){ if( $.buttons[ i ] ) { $.buttons[ i ].update( i ) } }
			i = $.buttons.length; while( i-- ){ if( $.buttons[ i ] ) { $.buttons[ i ].render( i ) } }
	};

	$.states['market'] = function() {

		$.clearScreen();

		var marketCompact = ( $.ch < 640 );
		$.ctxmg.beginPath();
		var marketTitle = $.text( {
			ctx: $.ctxmg,
			x: $.cw / 2,
			y: marketCompact ? 60 : 120,
			text: 'MARKET',
			hspacing: 3,
			vspacing: 1,
			halign: 'center',
			valign: 'bottom',
			scale: marketCompact ? 4 : 8,
			snap: 1,
			render: 1
		} );
		var gradient = $.ctxmg.createLinearGradient( marketTitle.sx, marketTitle.sy, marketTitle.sx, marketTitle.ey );
		gradient.addColorStop( 0, '#fff' );
		gradient.addColorStop( 1, '#999' );
		$.ctxmg.fillStyle = gradient;
		$.ctxmg.fill();

		$.ctxmg.beginPath();
		$.text( {
			ctx: $.ctxmg,
			x: $.cw / 2,
			y: marketTitle.ey + ( marketCompact ? 6 : 14 ),
			text: $.marketState.enabled ? 'COSMETICS ONLY. NO PAY TO WIN. SETTLED ON BASE' : 'COSMETICS ONLY. NO PAY TO WIN. PAYMENTS LIVE SOON',
			hspacing: 1,
			vspacing: 1,
			halign: 'center',
			valign: 'top',
			scale: 1,
			snap: 1,
			render: 1
		} );
		$.ctxmg.fillStyle = 'hsla(45, 100%, 65%, 0.7)';
		$.ctxmg.fill();

		var statusText = $.purchaseStatusText();
		if( $.marketState.loading && !$.marketState.fetched ) {
			statusText = 'LOADING';
		}
		if( statusText ) {
			$.ctxmg.beginPath();
			$.text( {
				ctx: $.ctxmg,
				x: $.cw / 2,
				y: $.ch - ( marketCompact ? 58 : 92 ),
				text: statusText,
				hspacing: 2,
				vspacing: 1,
				halign: 'center',
				valign: 'bottom',
				scale: marketCompact ? 1 : 2,
				snap: 1,
				render: 1
			} );
			$.ctxmg.fillStyle = ( $.purchase.status === 'done' ) ? 'hsla(45, 100%, 65%, 1)' : 'hsla(0, 0%, 100%, 0.6)';
			$.ctxmg.fill();
		}

		var i = $.buttons.length; while( i-- ){ if( $.buttons[ i ] ) { $.buttons[ i ].update( i ) } }
			i = $.buttons.length; while( i-- ){ if( $.buttons[ i ] ) { $.buttons[ i ].render( i ) } }
	};

	$.states['settings'] = function() {

		$.clearScreen();

		var settingsCompact = ( $.ch < 640 );
		$.ctxmg.beginPath();
		var settingsTitle = $.text( {
			ctx: $.ctxmg,
			x: $.cw / 2,
			y: settingsCompact ? 60 : 150,
			text: 'SETTINGS',
			hspacing: 3,
			vspacing: 1,
			halign: 'center',
			valign: 'bottom',
			scale: settingsCompact ? 4 : 8,
			snap: 1,
			render: 1
		} );
		var gradient = $.ctxmg.createLinearGradient( settingsTitle.sx, settingsTitle.sy, settingsTitle.sx, settingsTitle.ey );
		gradient.addColorStop( 0, '#fff' );
		gradient.addColorStop( 1, '#999' );
		$.ctxmg.fillStyle = gradient;
		$.ctxmg.fill();

		$.ctxmg.beginPath();
		$.text( {
			ctx: $.ctxmg,
			x: $.cw / 2,
			y: $.ch - ( settingsCompact ? 16 : 40 ),
			text: 'HYBRID: KEYS MOVE, MOUSE AIMS AND FIRES\nKEYBOARD: KEYS MOVE AND AIM, HOLD F TO FIRE\nMOUSE: SHIP FOLLOWS CURSOR, HOLD LMB TO FIRE',
			hspacing: 1,
			vspacing: 6,
			halign: 'center',
			valign: 'bottom',
			scale: 1,
			snap: 1,
			render: 1
		} );
		$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.45)';
		$.ctxmg.fill();

		var i = $.buttons.length; while( i-- ){ if( $.buttons[ i ] ) { $.buttons[ i ].update( i ) } }
			i = $.buttons.length; while( i-- ){ if( $.buttons[ i ] ) { $.buttons[ i ].render( i ) } }
	};

	$.states['board'] = function() {

		$.clearScreen();

		var boardCompact = ( $.ch < 640 );
		$.ctxmg.beginPath();
		var boardTitle = $.text( {
			ctx: $.ctxmg,
			x: $.cw / 2,
			y: boardCompact ? 60 : 110,
			text: 'SHOOTERBOARD',
			hspacing: 2,
			vspacing: 1,
			halign: 'center',
			valign: 'bottom',
			scale: boardCompact ? 4 : 7,
			snap: 1,
			render: 1
		} );
		var gradient = $.ctxmg.createLinearGradient( boardTitle.sx, boardTitle.sy, boardTitle.sx, boardTitle.ey );
		gradient.addColorStop( 0, '#fff' );
		gradient.addColorStop( 1, '#999' );
		$.ctxmg.fillStyle = gradient;
		$.ctxmg.fill();

		/*==============================================================================
		Your Tier banner (from local best score - works without a wallet)
		==============================================================================*/
		var myBest = $.storage['score'] || 0,
			myTier = $.tierFor( myBest ),
			tierY = boardTitle.ey + ( boardCompact ? 12 : 22 );
		$.ctxmg.beginPath();
		var tierLabel = $.text( {
			ctx: $.ctxmg,
			x: $.cw / 2,
			y: tierY,
			text: 'YOUR TIER  ' + myTier.name,
			hspacing: 1,
			vspacing: 1,
			halign: 'center',
			valign: 'top',
			scale: 2,
			snap: 1,
			render: 1
		} );
		$.ctxmg.fillStyle = myTier.color;
		$.ctxmg.fill();

		if( myTier.next ) {
			$.ctxmg.beginPath();
			$.text( {
				ctx: $.ctxmg,
				x: $.cw / 2,
				y: tierY + ( boardCompact ? 18 : 24 ),
				text: $.util.commas( myBest ) + ' / ' + $.util.commas( myTier.next.min ) + ' TO ' + myTier.next.name,
				hspacing: 1,
				vspacing: 1,
				halign: 'center',
				valign: 'top',
				scale: 1,
				snap: 1,
				render: 1
			} );
			$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.45)';
			$.ctxmg.fill();
		}

		var statusText = '';
		if( $.board.loading ) {
			statusText = 'LOADING';
		} else if( $.board.error ) {
			statusText = 'BOARD OFFLINE';
		} else if( $.board.entries.length === 0 ) {
			statusText = 'NO PILOTS RANKED YET';
		}

		if( statusText ) {
			$.ctxmg.beginPath();
			$.text( {
				ctx: $.ctxmg,
				x: $.cw / 2,
				y: $.ch / 2,
				text: statusText,
				hspacing: 2,
				vspacing: 1,
				halign: 'center',
				valign: 'center',
				scale: 2,
				snap: 1,
				render: 1
			} );
			$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.5)';
			$.ctxmg.fill();
		} else {
			// two columns so the top 30 (guests included) fit on one
			// screen without scrolling; narrow phones drop to one column
			// at a smaller scale so names never collide with scores
			var rowCount = Math.min( $.board.entries.length, 30 ),
				narrow = ( $.cw < 480 ),
				columns = narrow ? 1 : 2,
				rowScale = ( boardCompact || narrow ) ? 1 : 2,
				perColumn = Math.ceil( rowCount / columns ),
				rowStartY = boardTitle.ey + ( boardCompact ? 46 : 74 ),
				rowSpacing = narrow ? 13 : ( boardCompact ? 15 : 19 ),
				columnGap = boardCompact ? 24 : 50,
				totalWidth = Math.min( $.cw - 60, 720 ),
				colWidth = narrow ? totalWidth : ( totalWidth - columnGap ) / 2,
				col0Left = $.cw / 2 - totalWidth / 2,
				col0Right = col0Left + colWidth,
				col1Left = narrow ? col0Left : col0Right + columnGap,
				col1Right = narrow ? col0Right : col1Left + colWidth;

			for( var ri = 0; ri < rowCount; ri++ ) {
				var entry = $.board.entries[ ri ],
					myKey = $.myKey(),
					mine = ( myKey && entry.address === myKey ),
					rowColor = mine ? 'hsla(45, 100%, 65%, 1)' : ( ri === 0 ? 'hsla(0, 0%, 100%, 1)' : 'hsla(0, 0%, 100%, 0.65)' ),
					// wallet-verified players carry a badge glyph after their name
					verifiedBadge = entry.verified ? ' \x01' : '',
					col = ( ri < perColumn ) ? 0 : 1,
					row = ( ri < perColumn ) ? ri : ri - perColumn,
					leftX = ( col === 0 ) ? col0Left : col1Left,
					rightX = ( col === 0 ) ? col0Right : col1Right,
					rowY = rowStartY + row * rowSpacing;

				$.ctxmg.beginPath();
				$.text( {
					ctx: $.ctxmg,
					x: leftX,
					y: rowY,
					text: $.util.pad( ri + 1, 2 ) + ' ' + $.boardDisplayName( entry ) + verifiedBadge,
					hspacing: 1,
					vspacing: 1,
					halign: 'left',
					valign: 'top',
					scale: rowScale,
					snap: 1,
					render: 1
				} );
				$.ctxmg.fillStyle = rowColor;
				$.ctxmg.fill();

				$.ctxmg.beginPath();
				$.text( {
					ctx: $.ctxmg,
					x: rightX,
					y: rowY,
					text: $.util.commas( entry.score ),
					hspacing: 1,
					vspacing: 1,
					halign: 'right',
					valign: 'top',
					scale: rowScale,
					snap: 1,
					render: 1
				} );
				// each player's score is shown in their tier colour
				$.ctxmg.fillStyle = $.tierFor( entry.score ).color;
				$.ctxmg.fill();
			}
		}

		if( !$.session.authenticated && !$.board.loading ) {
			$.ctxmg.beginPath();
			$.text( {
				ctx: $.ctxmg,
				x: $.cw / 2,
				y: $.ch - 86,
				text: 'PLAYING AS GUEST  /  CONNECT WALLET FOR A VERIFIED \x01 BADGE',
				hspacing: 1,
				vspacing: 1,
				halign: 'center',
				valign: 'bottom',
				scale: 1,
				snap: 1,
				render: 1
			} );
			$.ctxmg.fillStyle = 'hsla(45, 100%, 65%, 0.7)';
			$.ctxmg.fill();
		}

		// persistence not configured: warn that scores aren't shared
		// (in-memory storage is per-instance on serverless)
		if( !$.board.persistent && $.board.fetched ) {
			$.ctxmg.beginPath();
			$.text( {
				ctx: $.ctxmg,
				x: $.cw / 2,
				y: $.ch - 106,
				text: 'DEMO MODE  /  LEADERBOARD STORAGE NOT CONFIGURED',
				hspacing: 1,
				vspacing: 1,
				halign: 'center',
				valign: 'bottom',
				scale: 1,
				snap: 1,
				render: 1
			} );
			$.ctxmg.fillStyle = 'hsla(0, 100%, 65%, 0.8)';
			$.ctxmg.fill();
		}

		var i = $.buttons.length; while( i-- ){ if( $.buttons[ i ] ) { $.buttons[ i ].update( i ) } }
			i = $.buttons.length; while( i-- ){ if( $.buttons[ i ] ) { $.buttons[ i ].render( i ) } }
	};

	$.states['stats'] = function() {


		$.clearScreen();

		var statsCompact = ( $.ch < 640 );
		$.ctxmg.beginPath();
		var statsTitle = $.text( {
			ctx: $.ctxmg,
			x: $.cw / 2,
			y: statsCompact ? 80 : 150,
			text: 'STATS',
			hspacing: 3,
			vspacing: 1,
			halign: 'center',
			valign: 'bottom',
			scale: statsCompact ? 5 : 10,
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
			y: statsTitle.ey + ( statsCompact ? 12 : 39 ),
			text: 'BEST SCORE\nBEST LEVEL\nBEST COMBO\nROUNDS PLAYED\nENEMIES KILLED\nBULLETS FIRED\nPOWERUPS COLLECTED\nTIME ELAPSED',
			hspacing: 1,
			vspacing: statsCompact ? 8 : 17,
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
			y: statsTitle.ey + ( statsCompact ? 12 : 39 ),
			text:
				$.util.commas( $.storage['score'] ) + '\n' +
				( $.storage['level'] + 1 ) + '\n' +
				( $.storage['combo'] || 0 ) + '\n' +
				$.util.commas( $.storage['rounds'] ) + '\n' +
				$.util.commas( $.storage['kills'] ) + '\n' +
				$.util.commas( $.storage['bullets'] ) + '\n' +
				$.util.commas( $.storage['powerups'] ) + '\n' +
				$.util.convertTime( ( $.storage['time'] * ( 1000 / 60 ) ) / 1000 )
			,
			hspacing: 1,
			vspacing: statsCompact ? 8 : 17,
			halign: 'left',
			valign: 'top',
			scale: 2,
			snap: 1,
			render: 1
		} );
		$.ctxmg.fillStyle = '#fff';
		$.ctxmg.fill();

		var i = $.buttons.length; while( i-- ){ if( $.buttons[ i ] ) { $.buttons[ i ].render( i ) } }
			i = $.buttons.length; while( i-- ){ if( $.buttons[ i ] ) { $.buttons[ i ].update( i ) } }
	};

	$.states['credits'] = function() {


		$.clearScreen();

		$.ctxmg.beginPath();
		var creditsCompact = ( $.ch < 640 );
		var creditsTitle = $.text( {
			ctx: $.ctxmg,
			x: $.cw / 2,
			y: creditsCompact ? 80 : 130,
			text: 'CREDITS',
			hspacing: 3,
			vspacing: 1,
			halign: 'center',
			valign: 'bottom',
			scale: creditsCompact ? 5 : 10,
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
			y: creditsTitle.ey + ( creditsCompact ? 14 : 49 ),
			text: 'CREATED BY\nSUPPORT\nSPECIAL THANKS\n\nENGINE',
			hspacing: 1,
			vspacing: creditsCompact ? 9 : 17,
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
			y: creditsTitle.ey + ( creditsCompact ? 14 : 49 ),
			text: 'DAVID GRATEFUL\nDEV DERVEL AND ISRA\nAND THE MANY MORE WHO\nHELPED COOK THIS\nRADIUS RAID BY JACK RUGILE',
			hspacing: 1,
			vspacing: creditsCompact ? 9 : 17,
			halign: 'left',
			valign: 'top',
			scale: 2,
			snap: 1,
			render: 1
		} );
		$.ctxmg.fillStyle = '#fff';
		$.ctxmg.fill();

		var i = $.buttons.length; while( i-- ){ if( $.buttons[ i ] ) { $.buttons[ i ].render( i ) } }
			i = $.buttons.length; while( i-- ){ if( $.buttons[ i ] ) { $.buttons[ i ].update( i ) } }
	};

	$.states['play'] = function() {
		$.updateDelta();
		$.updateScreen();
		$.updateCombo();
		$.updateLevel();
		$.updateHazards();
		$.updateProps();
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
		$.hero.update();

		// render entities
		$.clearScreen();
		$.ctxmg.save();
		$.ctxmg.translate( $.screen.x - $.rumble.x, $.screen.y - $.rumble.y );
		$.renderProps();
		$.renderHazards();
		i = $.enemies.length; while( i-- ){ $.enemies[ i ].render( i ) }
		i = $.explosions.length; while( i-- ){ $.explosions[ i ].render( i ) }
		i = $.powerups.length; while( i-- ){ $.powerups[ i ].render( i ) }
		i = $.particleEmitters.length; while( i-- ){ $.particleEmitters[ i ].render( i ) }
		i = $.textPops.length; while( i-- ){ $.textPops[ i ].render( i ) }
		i = $.bullets.length; while( i-- ){ $.bullets[ i ].render( i ) }
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
		if( $.nukeFlashTick > 0 ) {
			$.nukeFlashTick -= $.dt;
			$.ctxmg.fillStyle = 'hsla(55, 100%, 70%, ' + ( $.nukeFlashTick / 14 * 0.45 ) + ')';
			$.ctxmg.fillRect( 0, 0, $.cw, $.ch );
		}
		$.renderSectorOverlay();
		$.renderInterface();
		$.renderMinimap();

		// on-screen buttons (touch pause); action can clear $.buttons mid-loop
		var bi = $.buttons.length; while( bi-- ){ if( $.buttons[ bi ] ) { $.buttons[ bi ].update( bi ) } }
			bi = $.buttons.length; while( bi-- ){ if( $.buttons[ bi ] ) { $.buttons[ bi ].render( bi ) } }

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

		// F toggles autofire, except in keyboard mode where F is the trigger
		if( $.keys.pressed.f && ( $.storage['controls'] || 'hybrid' ) !== 'keyboard' ){
			$.autofire = ~~!$.autofire;
			$.storage['autofire'] = $.autofire;
			$.updateStorage();
		}
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

		var i = $.buttons.length; while( i-- ){ if( $.buttons[ i ] ) { $.buttons[ i ].render( i ) } }
			i = $.buttons.length; while( i-- ){ if( $.buttons[ i ] ) { $.buttons[ i ].update( i ) } }

		if( $.keys.pressed.p ){
			$.setState( 'play' );
		}
	};

	$.states['upgrade'] = function() {

		$.clearScreen();
		$.ctxmg.putImageData( $.screenshot, 0, 0 );

		$.ctxmg.fillStyle = 'hsla(0, 0%, 0%, 0.65)';
		$.ctxmg.fillRect( 0, 0, $.cw, $.ch );

		$.ctxmg.beginPath();
		var upgradeTitle = $.text( {
			ctx: $.ctxmg,
			x: $.cw / 2,
			y: $.ch / 2 - 110,
			text: 'LEVEL ' + ( $.level.current + 1 ),
			hspacing: 3,
			vspacing: 1,
			halign: 'center',
			valign: 'bottom',
			scale: 8,
			snap: 1,
			render: 1
		} );
		var gradient = $.ctxmg.createLinearGradient( upgradeTitle.sx, upgradeTitle.sy, upgradeTitle.sx, upgradeTitle.ey );
		gradient.addColorStop( 0, '#fff' );
		gradient.addColorStop( 1, '#999' );
		$.ctxmg.fillStyle = gradient;
		$.ctxmg.fill();

		$.ctxmg.beginPath();
		$.text( {
			ctx: $.ctxmg,
			x: $.cw / 2,
			y: upgradeTitle.ey + 25,
			text: 'CHOOSE AN UPGRADE',
			hspacing: 2,
			vspacing: 1,
			halign: 'center',
			valign: 'top',
			scale: 2,
			snap: 1,
			render: 1
		} );
		$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.5)';
		$.ctxmg.fill();

		// a card's action clears $.buttons mid-loop, so guard each entry
		var i = $.buttons.length; while( i-- ){ if( $.buttons[ i ] ) { $.buttons[ i ].update( i ) } }
			i = $.buttons.length; while( i-- ){ if( $.buttons[ i ] ) { $.buttons[ i ].render( i ) } }
	};

	$.states['gameover'] = function() {


		$.clearScreen();
		$.ctxmg.putImageData( $.screenshot, 0, 0 );

		var i = $.buttons.length; while( i-- ){ if( $.buttons[ i ] ) { $.buttons[ i ].update( i ) } }
			i = $.buttons.length; while( i-- ){ if( $.buttons[ i ] ) { $.buttons[ i ].render( i ) } }

		var goCompact = ( $.ch < 640 );
		$.ctxmg.beginPath();
		var gameoverTitle = $.text( {
			ctx: $.ctxmg,
			x: $.cw / 2,
			y: goCompact ? 80 : 150,
			text: 'GAME OVER',
			hspacing: 3,
			vspacing: 1,
			halign: 'center',
			valign: 'bottom',
			scale: goCompact ? 5 : 10,
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
			y: gameoverTitle.ey + ( goCompact ? 12 : 51 ),
			text: 'SCORE\nLEVEL\nKILLS\nBEST COMBO\nBULLETS\nPOWERUPS\nTIME',
			hspacing: 1,
			vspacing: goCompact ? 8 : 17,
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
			y: gameoverTitle.ey + ( goCompact ? 12 : 51 ),
			text:
				$.util.commas( $.score ) + '\n' +
				( $.level.current + 1 ) + '\n' +
				$.util.commas( $.kills ) + '\n' +
				$.bestCombo + '\n' +
				$.util.commas( $.bulletsFired ) + '\n' +
				$.util.commas( $.powerupsCollected ) + '\n' +
				$.util.convertTime( ( $.elapsed * ( 1000 / 60 ) ) / 1000 )
			,
			hspacing: 1,
			vspacing: goCompact ? 8 : 17,
			halign: 'left',
			valign: 'top',
			scale: 2,
			snap: 1,
			render: 1
		} );
		$.ctxmg.fillStyle = '#fff';
		$.ctxmg.fill();

		/*==============================================================================
		Build Summary
		==============================================================================*/
		var buildNames = [];
		for( var bi = 0; bi < $.definitions.upgrades.length; bi++ ) {
			var def = $.definitions.upgrades[ bi ],
				owned = $.upgrades[ def.id ] || 0;
			if( owned > 0 ) {
				buildNames.push( def.title + ( owned > 1 ? ' X' + owned : '' ) );
			}
		}
		if( buildNames.length > 0 ) {
			var buildLines = [];
			for( var bi = 0; bi < buildNames.length; bi += 3 ) {
				buildLines.push( buildNames.slice( bi, bi + 3 ).join( ', ' ) );
			}
			$.ctxmg.beginPath();
			$.text( {
				ctx: $.ctxmg,
				x: $.cw / 2,
				y: gameoverStatsValues.ey + ( goCompact ? 10 : 25 ),
				text: 'BUILD: ' + buildLines.join( '\n' ),
				hspacing: 1,
				vspacing: 6,
				halign: 'center',
				valign: 'top',
				scale: 1,
				snap: 1,
				render: 1
			} );
			$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.5)';
			$.ctxmg.fill();
		}

		/*==============================================================================
		Shooterboard Status
		==============================================================================*/
		var boardText = '',
			boardColor = 'hsla(0, 0%, 100%, 0.5)';
		if( $.boardSubmit.state === 'sending' ) {
			boardText = 'SUBMITTING TO SHOOTERBOARD';
		} else if( $.boardSubmit.state === 'done' ) {
			boardText = $.boardSubmit.rank
				? 'SHOOTERBOARD RANK ' + $.boardSubmit.rank + ( $.boardSubmit.improved ? '' : '  /  PERSONAL BEST STANDS' )
				: 'SCORE SAVED TO SHOOTERBOARD';
			boardColor = 'hsla(45, 100%, 65%, 1)';
		} else if( $.boardSubmit.state === 'error' ) {
			boardText = 'SHOOTERBOARD UNAVAILABLE';
		}
		// a gentle nudge for guests: their score is already ranked, the
		// wallet is purely an optional verified upgrade
		var boardSubText = '';
		if( $.boardSubmit.state === 'done' && !$.boardSubmit.verified ) {
			boardSubText = 'PLAYING AS GUEST  /  CONNECT WALLET FOR A VERIFIED BADGE';
		}
		if( boardText ) {
			var boardTextY = gameoverStatsValues.ey + ( goCompact ? ( buildNames.length > 0 ? 34 : 10 ) : ( buildNames.length > 0 ? 60 : 25 ) );
			$.ctxmg.beginPath();
			$.text( {
				ctx: $.ctxmg,
				x: $.cw / 2,
				y: boardTextY,
				text: boardText,
				hspacing: 1,
				vspacing: 1,
				halign: 'center',
				valign: 'top',
				scale: 1,
				snap: 1,
				render: 1
			} );
			$.ctxmg.fillStyle = boardColor;
			$.ctxmg.fill();

			if( boardSubText ) {
				$.ctxmg.beginPath();
				$.text( {
					ctx: $.ctxmg,
					x: $.cw / 2,
					y: boardTextY + ( goCompact ? 12 : 16 ),
					text: boardSubText,
					hspacing: 1,
					vspacing: 1,
					halign: 'center',
					valign: 'top',
					scale: 1,
					snap: 1,
					render: 1
				} );
				$.ctxmg.fillStyle = 'hsla(45, 100%, 65%, 0.7)';
				$.ctxmg.fill();
			}
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
