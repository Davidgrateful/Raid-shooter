/*==============================================================================
Init
==============================================================================*/
// Lightweight image loader/cache for the (otherwise fully procedural)
// engine. Images load async; callers check $.imageReady() before drawing and
// fall back to the bitmap-font rendering until then (or if a load fails).
$.images = {};
$.loadImage = function( key, src ) {
	var img = new Image();
	img.src = src;
	$.images[ key ] = img;
	return img;
};
$.imageReady = function( key ) {
	var img = $.images[ key ];
	return !!( img && img.complete && img.naturalWidth > 0 );
};

// Draws the brand logo centered on cx, bottom-aligned to bottomY, scaled to
// targetH (clamped to the viewport width). Returns false if the image isn't
// loaded yet so callers can fall back to the bitmap-font title.
$.drawLogo = function( ctx, cx, bottomY, targetH ) {
	if( !$.imageReady( 'logo' ) ) { return false; }
	var img = $.images[ 'logo' ],
		aspect = img.naturalWidth / img.naturalHeight,
		h = targetH,
		w = h * aspect,
		maxW = $.cw - 40;
	if( w > maxW ) { w = maxW; h = w / aspect; }
	ctx.drawImage( img, cx - w / 2, bottomY - h, w, h );
	return true;
};

$.init = function() {


	$.setupStorage();

	// brand logo, cache-busted per deploy like the engine scripts
	$.loadImage( 'logo', '/logo.png?v=' + ( window.__BUILD || 'dev' ) );
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

	$.setSoundLevel( $.storage['soundLevel'] !== undefined ? $.storage['soundLevel'] : 1 );
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

	// generic vertical scroll for tall menu screens (market/board/hangar);
	// drag-to-scroll on touch, wheel on desktop - see applyButtonScroll()
	$.scroll = { y: 0, max: 0, dragging: 0, startY: 0, startScroll: 0, moved: 0 };
	$.scrollableStates = { market: 1, board: 1, hangar: 1 };

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
	$.setState( 'loading' );
	$.loop();
};

/*==============================================================================
Canvas Sizing (run at init and again when the screen changes, e.g. a phone
rotating to landscape or entering fullscreen)
==============================================================================*/
$.setupCanvasSizes = function() {
	$.cw = window.innerWidth;
	$.ch = window.innerHeight;
	// the foreground overlay (cfg) is a soft gradient/vignette, fine at CSS
	// resolution; the main canvas (cmg) carries crisp sprites/text/HUD. On
	// retina iPhones a 3x/2x backing store quadruples fill cost and was the
	// main cause of in-game lag, so touch devices cap at 1.5x (still sharp,
	// ~45% less pixel work) while desktop keeps 2x.
	var maxDpr = $.isTouchDevice ? 1.5 : 2;
	// On desktop a large/high-DPI monitor (1440p or 4K) at a flat 2x backing
	// store means 8M+ pixels cleared and refilled every frame of gameplay -
	// the main cause of "PC version is lagging" on otherwise capable machines.
	// Cap the backing store to a fixed pixel budget so big windows scale dpr
	// down (still >=1, so it stays crisp) instead of paying full 2x fill cost.
	if( !$.isTouchDevice ) {
		var pixelBudget = 4500000;
		var fit = Math.sqrt( pixelBudget / Math.max( 1, $.cw * $.ch ) );
		maxDpr = Math.min( maxDpr, Math.max( 1, fit ) );
	}
	$.dpr = Math.min( window.devicePixelRatio || 1, maxDpr );
	$.cfg.width = $.cw;
	$.cfg.height = $.ch;
	$.cmg.width = Math.round( $.cw * $.dpr );
	$.cmg.height = Math.round( $.ch * $.dpr );
	$.cmg.style.width = $.cw + 'px';
	$.cmg.style.height = $.ch + 'px';
	$.ctxmg.setTransform( $.dpr, 0, 0, $.dpr, 0, 0 );
	// safe-area insets (notch / Dynamic Island / home indicator), read from
	// the CSS env() values so HUD and on-screen buttons stay clear of them
	var safeStyle = getComputedStyle( document.documentElement );
	$.safeAreaTop = parseFloat( safeStyle.getPropertyValue( '--safe-top' ) ) || 0;
	$.safeAreaBottom = parseFloat( safeStyle.getPropertyValue( '--safe-bottom' ) ) || 0;
	$.safeAreaLeft = parseFloat( safeStyle.getPropertyValue( '--safe-left' ) ) || 0;
	$.safeAreaRight = parseFloat( safeStyle.getPropertyValue( '--safe-right' ) ) || 0;
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
	$.runAssisted = false;

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
		Consumables - only shown to players who actually own one
		==============================================================================*/
		if( $.session.authenticated && ( $.consumableCount( 'consumable_health' ) > 0 || $.consumableCount( 'consumable_shield' ) > 0 ) ) {
			$.ctxmg.beginPath();
			$.text( {
				ctx: $.ctxmg,
				x: $.minimap.x,
				y: $.minimap.y + $.minimap.height + 14,
				text: '1: HEALTH x' + $.consumableCount( 'consumable_health' ) + '\n2: SHIELD x' + $.consumableCount( 'consumable_shield' ),
				hspacing: 1,
				vspacing: 10,
				halign: 'left',
				valign: 'top',
				scale: 1,
				snap: 1,
				render: 1
			} );
			$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.6)';
			$.ctxmg.fill();
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
		hudGap = hudCompact ? 18 : 40,
		hudLeft = 20 + $.safeAreaLeft,
		hudTop = 64 + $.safeAreaTop;
	$.ctxmg.beginPath();
	var healthText = $.text( {
		ctx: $.ctxmg,
		x: hudLeft,
		y: hudTop,
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
		y: hudTop,
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
		y: hudTop,
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
		y: hudTop,
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
		y: hudTop,
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
		y: hudTop,
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
			y: hudTop,
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
			x: $.cw - 20 - $.safeAreaRight,
			y: 210 + $.safeAreaTop,
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
	// [data-game-ui] marks our React HTML overlays (feedback, partners, news,
	// modals) so the canvas event handlers leave their taps/clicks alone
	return !!( t && t.closest && t.closest( 'header, w3m-modal, appkit-modal, wcm-modal, [role=dialog], nextjs-portal, [data-game-ui]' ) );
};

// mouse wheel scrolls the current menu screen when its content overflows
$.wheelcb = function( e ) {
	if( $.eventInsideUi( e ) ) {
		return;
	}
	if( !$.scrollableStates[ $.state ] || $.scroll.max <= 0 ) {
		return;
	}
	e.preventDefault();
	$.scroll.y = Math.max( 0, Math.min( $.scroll.max, $.scroll.y + e.deltaY ) );
};

$.mousemovecb = function( e ) {
	if( $.eventInsideUi( e ) ) {
		return;
	}
	e.preventDefault();

	// touch drag-to-scroll on tall menu screens
	if( $.scroll.dragging ) {
		var dty = ( e.changedTouches ? e.changedTouches[ 0 ] : e ).clientY;
		var ddelta = $.scroll.startY - dty;
		$.scroll.moved = Math.max( $.scroll.moved, Math.abs( ddelta ) );
		$.scroll.y = Math.max( 0, Math.min( $.scroll.max, $.scroll.startScroll + ddelta ) );
		return;
	}

	var touches = e.changedTouches ? e.changedTouches : [e];

	for( var i = 0; i < touches.length; i++ ) {
		var tx = touches[i].clientX;
		var ty = touches[i].clientY;
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

	// refresh the canvas offset at tap time so UI hit-testing stays accurate
	// even when the mobile address bar / safe area shifts the layout without
	// firing a resize - a common cause of "buttons in the wrong place"
	$.updateCanvasOffset();

	var isTouch = !!e.changedTouches;
	var touches = e.changedTouches ? e.changedTouches : [e];

	// scrollable menu screens: track the gesture as a drag instead of firing
	// a button tap immediately, so a swipe-to-scroll doesn't also click
	// whatever happens to be under the finger at touch-start
	if( isTouch && $.scrollableStates[ $.state ] && $.scroll.max > 0 ) {
		$.scroll.dragging = 1;
		$.scroll.startY = touches[ 0 ].clientY;
		$.scroll.startScroll = $.scroll.y;
		$.scroll.moved = 0;
		return;
	}

	for( var i = 0; i < touches.length; i++ ) {
		var tx = touches[i].clientX;
		var ty = touches[i].clientY;
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

	if( $.scroll.dragging ) {
		var wasTap = ( $.scroll.moved < 8 );
		$.scroll.dragging = 0;
		if( wasTap ) {
			var tapTouches = e.changedTouches ? e.changedTouches : [{ identifier: 0 }];
			$.mouse.ax = tapTouches[ 0 ].clientX;
			$.mouse.ay = tapTouches[ 0 ].clientY;
			$.mousescreen();
			for( var ti = 0; ti < $.buttons.length; ti++ ) {
				var tb = $.buttons[ ti ];
				// scrolled-off rows are clipped from view, so ignore taps on them
				if( tb.scrollable && $.scrollClip &&
					( tb.cy < $.scrollClip.top || tb.cy > $.scrollClip.bottom ) ) {
					continue;
				}
				if( $.util.pointInRect( $.mouse.sx, $.mouse.sy, tb.sx, tb.sy, tb.width, tb.height ) ) {
					$.audio.play( 'click' );
					tb.action();
					break;
				}
			}
		}
		// scrollable screens (hangar/market/board) return here, so park the
		// cursor off-screen too - else the tapped card stays highlighted on
		// touch (the "stuck on the pilot" report)
		$.mouse.ax = $.mouse.ay = $.mouse.sx = $.mouse.sy = -99999;
		return;
	}

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

	// touch has no "move away", so park the cursor off-screen after a tap -
	// otherwise the last-touched menu button stays highlighted/hovered (the
	// "stuck on the pilot button" report)
	if( e.changedTouches ) {
		$.mouse.ax = -99999;
		$.mouse.ay = -99999;
		$.mouse.sx = -99999;
		$.mouse.sy = -99999;
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
	// 1/2: consume a purchased Health Pack / Shield Charge mid-run
	if( $.state === 'play' && $.hero && $.hero.life > 0 ) {
		if( e === 49 ) {
			$.useConsumable( 'consumable_health', function() {
				$.hero.life = Math.min( 1, $.hero.life + 0.5 );
			} );
		}
		if( e === 50 ) {
			$.useConsumable( 'consumable_shield', function() {
				$.powerupTimers[ 5 ] = $.powerupDuration;
			} );
		}
	}
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
	window.addEventListener( 'wheel', $.wheelcb, { passive: false } );
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

	// adaptive quality: keep a smoothed FPS estimate and flip $.lowfx when a
	// device can't hold ~48fps, so particle-heavy effects throttle back on
	// weaker phones (and recover automatically when the load drops)
	var instFps = $.dt > 0 ? 60 / $.dt : 60;
	$.fps = $.fps ? $.fps * 0.9 + instFps * 0.1 : instFps;
	if( !$.lowfx && $.fps < 45 ) { $.lowfx = 1; }
	else if( $.lowfx && $.fps > 54 ) { $.lowfx = 0; }
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
	if( $.hero.character ) {
		$.gainPilotXp( $.hero.character.id, 1 );
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
// scrollable buttons keep their layout position in by/bsy/bcy/bey and get
// shifted by the live scroll offset every frame - call before update/render
$.applyButtonScroll = function() {
	for( var i = 0; i < $.buttons.length; i++ ) {
		var b = $.buttons[ i ];
		if( b && b.scrollable ) {
			b.sy = b.bsy - $.scroll.y;
			b.cy = b.bcy - $.scroll.y;
			b.ey = b.bey - $.scroll.y;
			b.y = b.by - $.scroll.y;
		}
	}
};

// call after pushing a state's buttons (and knowing its lowest scrollable
// content edge) so dragging/wheel has the right range from frame one
$.setScrollMax = function( contentBottom, viewportBottom ) {
	$.scroll.max = Math.max( 0, contentBottom - viewportBottom );
	$.scroll.y = Math.min( $.scroll.y, $.scroll.max );
};

$.setState = function( state ) {
	// handle clean up between states
	$.buttons.length = 0;
	$.scroll.y = 0;
	$.scroll.max = 0;
	$.scroll.dragging = 0;
	// cleared so a clip from the previous screen can't suppress taps here;
	// market/hangar set their own each build
	$.scrollClip = null;

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

	if( state == 'loading' ) {
		$.mouse.down = 0;
		$.loadingStart = $.tick;
		$.reset();
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
			menuStartY = menuCompact ? 112 : $.ch / 2 - 110;

		$.fetchSession();

		// Trimmed top level: PLAY and SETTINGS are full-width bookends, with
		// the four core destinations in a 2x2 grid between them. Secondary
		// items (call sign, stats, credits) live inside SETTINGS now, so the
		// menu is 4 rows on every device instead of an overflowing 5.
		var menuDefs = [
			{ title: 'PLAY', full: 1, scale: menuCompact ? 2 : 3, action: function() {
				$.mouse.down = 0;
				// first-time players choose a call sign before their first
				// run, so their very first score lands on the board under a
				// name they picked - not a silent auto-generated default
				if( !$.storage['pilotname'] ) {
					$.promptPilotName();
					$.ensurePilotName();
				}
				$.reset();
				$.trackRun( 'run_start' );
				$.audio.play( 'levelup' );
				$.music.start();
				$.setState( 'play' );
			} },
			{ title: 'PILOT: ' + $.currentCharacter().title, scale: menuCompact ? 1 : 2, action: function() {
				$.mouse.down = 0;
				$.setState( 'hangar' );
			} },
			{ title: 'MARKET', scale: menuCompact ? 1 : 2, action: function() {
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
			{ title: 'HOW TO PLAY', scale: menuCompact ? 1 : 2, action: function() {
				$.mouse.down = 0;
				$.howtoIndex = 0;
				$.setState( 'howto' );
			} },
			{ title: 'SETTINGS', full: 1, scale: menuCompact ? 2 : 3, action: function() {
				$.mouse.down = 0;
				$.setState( 'settings' );
			} }
		];

		// responsive row-based layout: full-width rows for PLAY/SETTINGS,
		// paired half-width rows for everything else; vertical metrics scale
		// with the viewport so it never overlaps the logo or runs off-screen
		var rowPitch = menuButtonHeight + menuSpacing,
			halfX = menuCompact ? 106 : 156,
			halfW = menuCompact ? 199 : 299,
			fullW = Math.min( $.cw - 40, menuCompact ? 420 : 620 ),
			my = menuStartY,
			mcol = 0;
		for( var mi = 0; mi < menuDefs.length; mi++ ) {
			var d = menuDefs[ mi ];
			if( d.full ) {
				if( mcol === 1 ) { my += rowPitch; mcol = 0; }
				$.buttons.push( new $.Button( {
					x: $.cw / 2, y: my, lockedWidth: fullW, lockedHeight: menuButtonHeight,
					scale: d.scale, title: d.title, action: d.action
				} ) );
				my += rowPitch;
			} else {
				$.buttons.push( new $.Button( {
					x: $.cw / 2 + ( mcol ? halfX : -halfX ), y: my,
					lockedWidth: halfW, lockedHeight: menuButtonHeight,
					scale: d.scale, title: d.title, action: d.action
				} ) );
				if( mcol === 1 ) { my += rowPitch; mcol = 0; } else { mcol = 1; }
			}
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
					// rebuild so the control rows re-stack below the new
					// pilot's measured text height - a taller pilot (two-line
					// desc + ability + level) needs its rows pushed down
					$.hangarKeep = 1;
					$.setState( 'hangar' );
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
					// rebuild so the control rows re-stack below the new
					// pilot's measured text height (see PREV above)
					$.hangarKeep = 1;
					$.setState( 'hangar' );
				}
			} ) );

			// the control rows below the ship preview stack downward from
			// the preview text block's own measured bottom edge (not a
			// fixed offset from the arrows), so a pilot with a two-line
			// desc, an ability line, and/or the level line never gets its
			// text clipped by the SELECT/COLOR row above it - if they
			// still don't fit, the whole stack scrolls
			var previewDef = $.definitions.characters[ $.hangarIndex ],
				previewTextBottom = $.hangarPreviewLayout( previewDef, hangarCompact, arrowY ).bottom,
				hangarRowGap = hangarCompact ? 48 : 58,
				hangarRowsTop = previewTextBottom + ( hangarCompact ? 26 : 40 ),
				hr0 = hangarRowsTop,
				hr1 = hr0 + hangarRowGap,
				// the drone row is taller (two lines, for its passive text)
				// so it needs a bigger gap above it than the other rows
				hr2 = hr1 + hangarRowGap + ( hangarCompact ? 16 : 22 );

			$.buttons.push( new $.Button( {
				x: $.cw / 2 - 104,
				y: hr0,
				lockedWidth: 199,
				lockedHeight: 45,
				scale: 2,
				title: 'SELECT',
				scrollable: 1,
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
				y: hr0,
				lockedWidth: 199,
				lockedHeight: 45,
				scale: 1,
				title: 'COLOR: ' + $.definitions.shipColors[ $.storage['ship'] || 0 ].title,
				scrollable: 1,
				action: function() {
					$.mouse.down = 0;
					$.storage['ship'] = ( ( $.storage['ship'] || 0 ) + 1 ) % $.definitions.shipColors.length;
					$.updateStorage();
					this.title = 'COLOR: ' + $.definitions.shipColors[ $.storage['ship'] ].title;
				}
			} ) );
			$.buttons.push( new $.Button( {
				x: $.cw / 2 - ( hangarCompact ? 160 : 180 ),
				y: hr1,
				lockedWidth: hangarCompact ? 149 : 169,
				lockedHeight: 45,
				scale: 1,
				title: 'TRAIL: ' + ( $.equippedTrail() ? $.equippedTrail().title : 'NONE' ),
				scrollable: 1,
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
				y: hr1,
				lockedWidth: hangarCompact ? 149 : 169,
				lockedHeight: 45,
				scale: 1,
				title: 'VIEW: GRID',
				scrollable: 1,
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
				y: hr1,
				lockedWidth: hangarCompact ? 149 : 169,
				lockedHeight: 45,
				scale: 1,
				title: 'MENU',
				scrollable: 1,
				action: function() {
					$.mouse.down = 0;
					$.setState( 'menu' );
				}
			} ) );
			var droneButtonTitle = function() {
				var equipped = $.equippedDrone();
				return 'DRONE: ' + ( equipped ? equipped.title : 'NONE' ) +
					'\n' + ( equipped ? equipped.desc : 'EQUIP ONE FOR A PASSIVE BONUS' );
			};
			$.buttons.push( new $.Button( {
				x: $.cw / 2,
				y: hr2,
				lockedWidth: hangarCompact ? 308 : 348,
				lockedHeight: hangarCompact ? 56 : 64,
				scale: 1,
				vspacing: 6,
				title: droneButtonTitle(),
				scrollable: 1,
				action: function() {
					$.mouse.down = 0;
					// cycle through NONE plus owned drones - one equipped at a time
					var owned = [ '' ];
					for( var di = 0; di < $.definitions.drones.length; di++ ) {
						if( $.ownsItem( $.definitions.drones[ di ].id ) ) {
							owned.push( $.definitions.drones[ di ].id );
						}
					}
					var current = owned.indexOf( $.storage['drone'] || '' );
					$.storage['drone'] = owned[ ( current + 1 ) % owned.length ];
					$.updateStorage();
					this.title = droneButtonTitle();
				}
			} ) );

			$.hangarClip = { top: hangarRowsTop - 30, bottom: $.ch - ( hangarCompact ? 10 : 16 ) };
			$.scrollClip = $.hangarClip;
			$.setScrollMax( hr2 + ( hangarCompact ? 50 : 60 ), $.hangarClip.bottom );
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

		$.marketTab = $.marketTab || 'character';

		var marketCompact = ( $.ch < 640 ),
			// kept clear of the mobile top-left BACK button (~y70) on short screens
			tabsY = marketCompact ? 110 : 162,
			tabHalfHeight = marketCompact ? 14 : 18;

		// PILOTS / DRONES show a ship icon plus an ability line, so they get
		// a single wide column; BOOSTS (skins, trails, consumables) are
		// simple buy-only rows and go two-up on wide screens, one-up on
		// narrow ones so a row never runs off the side of a phone
		var narrow = ( $.cw < 560 ),
			richTab = ( $.marketTab !== 'boost' ),
			smallText = ( marketCompact || narrow ),
			columns = ( richTab || narrow ) ? 1 : 2,
			itemGap = marketCompact ? 8 : 12,
			colGap = 16,
			maxRowWidth = Math.min( $.cw - 36, columns === 1 ? ( richTab ? 460 : 380 ) : 720 ),
			itemWidth = columns === 1 ? maxRowWidth : ( maxRowWidth - colGap ) / 2,
			itemColX = columns === 1 ? 0 : ( itemWidth + colGap ) / 2,
			itemHeight = richTab ? ( smallText ? 52 : 64 ) : ( smallText ? 44 : 54 );

		// Top of the scrollable strip: below the tabs with a clear gap. The
		// first row is then centered half a card lower so its full top edge
		// sits inside the clip - otherwise the card's top half was sliced
		// off and it bled up into the tab row.
		var listTop = tabsY + tabHalfHeight + ( marketCompact ? 14 : 18 ),
			itemStartY = listTop + itemHeight / 2;

		var bucketOf = function( item ) {
			if( item.kind === 'character' || item.kind === 'drone' ) { return item.kind; }
			return 'boost';
		};

		var filteredItems = [];
		for( var fi = 0; fi < $.marketState.items.length; fi++ ) {
			if( bucketOf( $.marketState.items[ fi ] ) === $.marketTab ) {
				filteredItems.push( $.marketState.items[ fi ] );
			}
		}

		// three fixed (non-scrolling) tab buttons across the top of the list
		var tabDefs = [
			{ id: 'character', title: 'PILOTS' },
			{ id: 'drone', title: 'DRONES' },
			{ id: 'boost', title: 'BOOSTS' }
		];
		for( var ti = 0; ti < tabDefs.length; ti++ ) {
			(function( tab ) {
				$.buttons.push( new $.Button( {
					x: $.cw / 2 + ( ti - 1 ) * ( marketCompact ? 108 : 140 ),
					y: tabsY,
					lockedWidth: marketCompact ? 102 : 132,
					lockedHeight: marketCompact ? 28 : 36,
					scale: marketCompact ? 1 : 1.4,
					title: ( $.marketTab === tab.id ? '> ' : '' ) + tab.title,
					action: function() {
						$.mouse.down = 0;
						$.marketTab = tab.id;
						$.setState( 'market' );
					}
				} ) );
			})( tabDefs[ ti ] );
		}

		// item buttons are rebuilt whenever the screen is (re)entered, so
		// every row's price/ownership reflects the current profile
		var buildItem = function( item, index ) {
			// consumables stack and stay re-buyable, showing how many are in
			// stock; everything else is a one-time unlock that reads OWNED
			var stackable = ( item.kind === 'consumable' ),
				owned = !stackable && $.ownsItem( item.id ),
				note = item.comingSoon ? 'SOON' : ( owned ? 'OWNED' : $.usd( item.priceUsd ) ),
				noteColor = item.comingSoon
					? 'hsla(0, 0%, 100%, 0.4)'
					: ( owned ? 'hsla(140, 70%, 60%, 1)' : 'hsla(45, 100%, 65%, 1)' ),
				// pilots/drones explain themselves with their ability line;
				// consumables show stock; plain skins/trails need no subtitle
				subtitle = item.ability
					? item.ability.replace( /^PASSIVE:\s*/, '' )
					: ( stackable
						? ( ( item.stack > 1 ? 'PACK OF ' + item.stack + ' / ' : '' ) + 'IN STOCK: ' + $.consumableCount( item.id ) )
						: '' ),
				column = index % columns,
				row = Math.floor( index / columns ),
				x = ( columns === 1 ) ? $.cw / 2 : $.cw / 2 + ( column ? itemColX : -itemColX );

			var icon = null;
			if( item.kind === 'character' ) {
				var charId = item.id.replace( /^pilot_/, '' ),
					charDef = null;
				for( var ci = 0; ci < $.definitions.characters.length; ci++ ) {
					if( $.definitions.characters[ ci ].id === charId ) {
						charDef = $.definitions.characters[ ci ];
						break;
					}
				}
				if( charDef ) {
					var shipColor = $.definitions.shipColors[ $.storage[ 'ship' ] || 0 ] || $.definitions.shipColors[ 0 ];
					icon = { draw: charDef.draw, color: owned ? shipColor.color : 'hsla(0, 0%, 55%, 1)', r: smallText ? 13 : 16 };
				}
			} else if( item.kind === 'drone' ) {
				var droneDef = null;
				for( var dii = 0; dii < $.definitions.drones.length; dii++ ) {
					if( $.definitions.drones[ dii ].id === item.id ) {
						droneDef = $.definitions.drones[ dii ];
						break;
					}
				}
				icon = {
					draw: ( droneDef && droneDef.draw ) || function( ctx, r, fillStyle ) {
						ctx.beginPath();
						ctx.arc( 0, 0, r, 0, $.twopi );
						ctx.fillStyle = fillStyle;
						ctx.fill();
					},
					color: owned ? 'hsla(190, 100%, 65%, 1)' : 'hsla(0, 0%, 55%, 1)',
					r: smallText ? 13 : 16
				};
			}

			$.buttons.push( new $.Button( {
				x: x,
				y: itemStartY + row * ( itemHeight + itemGap ),
				lockedWidth: itemWidth,
				lockedHeight: itemHeight,
				scale: 1,
				card: 1,
				name: item.title,
				subtitle: subtitle,
				note: note,
				noteColor: noteColor,
				subColor: stackable ? 'hsla(45, 100%, 70%, 0.7)' : 'hsla(190, 100%, 72%, 0.75)',
				nameScale: smallText ? 1 : 2,
				subScale: 1,
				noteScale: smallText ? 1 : 2,
				icon: icon,
				iconAreaWidth: icon ? ( smallText ? 34 : 44 ) : 0,
				scrollable: 1,
				action: function() {
					$.mouse.down = 0;
					if( ( stackable || !owned ) && !item.comingSoon ) {
						$.buyItem( item );
					}
				}
			} ) );
		};
		for( var ii = 0; ii < filteredItems.length; ii++ ) {
			buildItem( filteredItems[ ii ], ii );
		}

		// BACK is a fixed footer button so it's always reachable regardless
		// of scroll position; the list itself scrolls beneath the tabs
		var marketMenuButton = new $.Button( {
			x: $.cw / 2 + 1,
			y: $.ch - ( marketCompact ? 26 : 44 ),
			lockedWidth: 299,
			lockedHeight: 45,
			scale: 2,
			title: 'BACK',
			action: function() {
				$.setState( 'menu' );
			}
		} );
		$.buttons.push( marketMenuButton );

		var marketRows = Math.ceil( filteredItems.length / columns ),
			marketContentBottom = itemStartY + marketRows * ( itemHeight + itemGap ),
			marketListBottom = $.ch - ( marketCompact ? 62 : 100 );
		$.setScrollMax( marketContentBottom, marketListBottom );
		$.marketListClip = { top: listTop, bottom: marketListBottom };
		$.scrollClip = $.marketListClip;
	}

	if( state == 'settings' ) {
		$.mouse.down = 0;

		var settingsCompact = ( $.ch < 640 ),
			settingsTop = settingsCompact ? 84 : $.ch / 2 - 110,
			settingsGap = settingsCompact ? 52 : 60,
			settingsRow = 0;

		// two columns on every device so the longer options list (now incl.
		// call sign, stats, credits moved off the main menu) always fits
		var settingsColX = settingsCompact ? 104 : 156,
			settingsColW = settingsCompact ? 199 : 299;
		var settingsButton = function( title, action ) {
			var col = settingsRow % 2,
				rowN = Math.floor( settingsRow / 2 ),
				b = new $.Button( {
					x: $.cw / 2 + ( col ? settingsColX : -settingsColX ),
					y: settingsTop + rowN * settingsGap,
					lockedWidth: settingsColW,
					lockedHeight: 45,
					scale: 1,
					title: title,
					action: action
				} );
			$.buttons.push( b );
			settingsRow++;
			return b;
		};

		// Call sign lives here now (was its own menu bar) - first run still
		// prompts for it, this is where you change it later.
		settingsButton( 'CALL SIGN: ' + ( $.storage['pilotname'] || 'SET NAME' ), function() {
			$.mouse.down = 0;
			$.promptPilotName();
			this.title = 'CALL SIGN: ' + ( $.storage['pilotname'] || 'SET NAME' );
		} );

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

		settingsButton( 'SOUND: ' + $.soundLevelLabels[ $.soundLevel ], function() {
			$.mouse.down = 0;
			$.cycleSoundLevel();
			this.title = 'SOUND: ' + $.soundLevelLabels[ $.soundLevel ];
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

		// secondary destinations moved off the main menu to keep it short
		settingsButton( 'STATS', function() {
			$.mouse.down = 0;
			$.setState( 'stats' );
		} );
		settingsButton( 'CREDITS', function() {
			$.mouse.down = 0;
			$.setState( 'credits' );
		} );

		var settingsRowsUsed = Math.ceil( settingsRow / 2 ),
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

		// scrolls the list straight to the player's own row (set each frame
		// by the board renderer); falls back to setting a call sign if the
		// player isn't ranked yet
		var jumpButton = new $.Button( {
			x: $.cw / 2 - 104,
			y: $.ch - 52,
			lockedWidth: 199,
			lockedHeight: 45,
			scale: 1,
			title: 'JUMP TO ME',
			action: function() {
				$.mouse.down = 0;
				if( typeof $.boardMyScrollTarget === 'number' && $.boardMyScrollTarget >= 0 ) {
					$.scroll.y = $.boardMyScrollTarget;
				} else {
					$.promptPilotName();
				}
			}
		} );
		$.buttons.push( jumpButton );

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

	if( state == 'howto' ) {
		$.mouse.down = 0;
		if( typeof $.howtoIndex !== 'number' ) { $.howtoIndex = 0; }

		var htCompact = ( $.ch < 640 ),
			htCount = $.howtoSlideCount(),
			htBtnY = htCompact ? $.ch - 34 : $.ch - 60,
			htLast = ( $.howtoIndex >= htCount - 1 );

		// PREV (only past the first slide)
		if( $.howtoIndex > 0 ) {
			$.buttons.push( new $.Button( {
				x: $.cw / 2 - ( htCompact ? 150 : 220 ),
				y: htBtnY,
				lockedWidth: htCompact ? 96 : 150,
				lockedHeight: htCompact ? 40 : 49,
				scale: htCompact ? 1 : 2,
				title: 'PREV',
				action: function() {
					$.mouse.down = 0;
					$.howtoIndex = Math.max( 0, $.howtoIndex - 1 );
					$.setState( 'howto' );
				}
			} ) );
		}

		// NEXT, or DONE on the last slide -> back to menu
		$.buttons.push( new $.Button( {
			x: $.cw / 2 + ( htCompact ? 150 : 220 ),
			y: htBtnY,
			lockedWidth: htCompact ? 96 : 150,
			lockedHeight: htCompact ? 40 : 49,
			scale: htCompact ? 1 : 2,
			title: htLast ? 'PLAY' : 'NEXT',
			action: function() {
				$.mouse.down = 0;
				if( $.howtoIndex >= $.howtoSlideCount() - 1 ) {
					$.setState( 'menu' );
				} else {
					$.howtoIndex += 1;
					$.setState( 'howto' );
				}
			}
		} ) );

		// MENU/BACK, centered at the bottom
		$.buttons.push( new $.Button( {
			x: $.cw / 2 + 1,
			y: htCompact ? $.ch - 34 : $.ch - 60,
			lockedWidth: htCompact ? 130 : 180,
			lockedHeight: htCompact ? 40 : 49,
			scale: htCompact ? 1 : 2,
			title: 'MENU',
			action: function() {
				$.setState( 'menu' );
			}
		} ) );
	}

	if( state == 'pause' ) {
		$.mouse.down = 0;
		$.screenshot = $.ctxmg.getImageData( 0, 0, $.cmg.width, $.cmg.height );
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
		// touch players have no P or M keys, give them on-screen buttons.
		// Placed top-center in the dead zone between the move (left) and aim
		// (right) thumb joysticks, clear of the safe-area notch/island, so
		// aiming up-and-out never clips PAUSE or MUTE by accident.
		var touchBarHeight = 35,
			touchBarY = $.safeAreaTop + 20 + touchBarHeight / 2,
			touchBarGap = 12,
			touchBarWidth = 89;
		$.buttons.push( new $.Button( {
			x: $.cw / 2 - touchBarGap / 2 - touchBarWidth / 2,
			y: touchBarY,
			lockedWidth: touchBarWidth,
			lockedHeight: touchBarHeight,
			scale: 1,
			title: 'PAUSE',
			action: function() {
				$.setState( 'pause' );
			}
		} ) );
		$.buttons.push( new $.Button( {
			x: $.cw / 2 + touchBarGap / 2 + touchBarWidth / 2,
			y: touchBarY,
			lockedWidth: touchBarWidth,
			lockedHeight: 35,
			scale: 1,
			title: $.soundLevelLabels[ $.soundLevel ],
			action: function() {
				$.mouse.down = 0;
				$.cycleSoundLevel();
				this.title = $.soundLevelLabels[ $.soundLevel ];
			}
		} ) );
	}

	if( state == 'upgrade' ) {
		$.mouse.down = 0;
		$.vjoyLeft.active = 0;
		$.vjoyRight.active = 0;
		$.screenshot = $.ctxmg.getImageData( 0, 0, $.cmg.width, $.cmg.height );

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

		$.screenshot = $.ctxmg.getImageData( 0, 0, $.cmg.width, $.cmg.height );

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
				$.trackRun( 'run_start' );
				$.audio.play( 'levelup' );
				$.setState( 'play' );
			}
		} );
		$.buttons.push( resumeButton );

		// SHARE: opens a rank card image for this run (the /api/card OG image)
		// so the player can post it. Uses the native share sheet on mobile,
		// falls back to opening the image in a new tab on desktop.
		var shareButton = new $.Button( {
			x: goCompact ? $.cw / 2 + 1 : $.cw / 2 + 1,
			y: goCompact ? $.ch - 82 : resumeButton.ey + 25,
			lockedWidth: goCompact ? 299 : 299,
			lockedHeight: goCompact ? 38 : 49,
			scale: goCompact ? 1 : 2,
			title: 'SHARE MY RANK',
			action: function() {
				$.mouse.down = 0;
				$.shareRunCard();
			}
		} );
		$.buttons.push( shareButton );

		var menuButton = new $.Button( {
			x: goCompact ? $.cw / 2 + 106 : $.cw / 2 + 1,
			y: goCompact ? $.ch - 34 : shareButton.ey + 25,
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

		// run length in seconds (elapsed counts at 60fps), for playtime stats
		$.trackRun( 'run_end', Math.floor( ( $.elapsed * ( 1000 / 60 ) ) / 1000 ) );
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

// Ambient drifting ships for the menu/loading background - dormant, purely
// decorative pilots flying by to make the screens feel alive and space-like.
// Built lazily, count scaled down on weaker phones, and only ever drawn on
// non-gameplay screens so they can't affect the in-run frame rate.
$.ambientShips = null;
$.initAmbientShips = function() {
	var n = $.perfLite ? 16 : 30,
		chars = $.definitions.characters,
		drones = $.definitions.drones || [];
	$.ambientShips = [];
	for( var i = 0; i < n; i++ ) {
		var ang = Math.random() * $.twopi,
			spd = 0.12 + Math.random() * 0.55,
			useDrone = drones.length && Math.random() < 0.25;
		$.ambientShips.push( {
			x: Math.random() * $.cw,
			y: Math.random() * $.ch,
			vx: Math.cos( ang ) * spd,
			vy: Math.sin( ang ) * spd,
			rot: ang,
			scale: 3.5 + Math.random() * 11,
			alpha: 0.05 + Math.random() * 0.18,
			drone: useDrone,
			def: useDrone ? drones[ Math.floor( Math.random() * drones.length ) ]
				: chars[ Math.floor( Math.random() * chars.length ) ]
		} );
	}
};
$.renderAmbientShips = function() {
	var want = $.perfLite ? 16 : 30;
	if( !$.ambientShips || $.ambientShips.length !== want ) { $.initAmbientShips(); }
	var ctx = $.ctxmg, m = 40;
	for( var i = 0; i < $.ambientShips.length; i++ ) {
		var s = $.ambientShips[ i ];
		s.x += s.vx;
		s.y += s.vy;
		if( s.x < -m ) { s.x = $.cw + m; } else if( s.x > $.cw + m ) { s.x = -m; }
		if( s.y < -m ) { s.y = $.ch + m; } else if( s.y > $.ch + m ) { s.y = -m; }
		ctx.save();
		ctx.globalAlpha = s.alpha;
		ctx.translate( s.x, s.y );
		ctx.rotate( s.rot );
		// drones are drawn upright; ship hulls point along their heading
		s.def.draw( ctx, s.scale, s.drone ? 'hsla(190, 60%, 70%, 1)' : 'hsla(210, 35%, 72%, 1)', $.tick );
		ctx.restore();
	}
	ctx.globalAlpha = 1;
};

$.setupStates = function() {
	// Branded boot screen: logo fades in, a pilot ship streaks across, a
	// progress bar fills, then it hands off to the menu. Tap to skip. Has a
	// sponsor slot ("POWERED BY ...") driven by $.loadingSponsor if set.
	$.states['loading'] = function() {
		$.clearScreen();
		$.ctxmg.globalAlpha = 1;

		var loadCompact = ( $.ch < 640 ),
			// ~6s at 60fps so players actually take in the splash; tap skips
			dur = 360,
			elapsed = $.tick - ( $.loadingStart || 0 ),
			p = Math.max( 0, Math.min( 1, elapsed / dur ) ),
			cx = $.cw / 2,
			cy = $.ch / 2;

		// soft radial glow so the splash reads against the dark starfield
		var glow = $.ctxmg.createRadialGradient( cx, cy - 10, 0, cx, cy - 10, Math.max( $.cw, $.ch ) * 0.42 );
		glow.addColorStop( 0, 'hsla(205, 60%, 22%, 0.55)' );
		glow.addColorStop( 1, 'hsla(205, 60%, 10%, 0)' );
		$.ctxmg.fillStyle = glow;
		$.ctxmg.fillRect( 0, 0, $.cw, $.ch );

		// dormant ships drifting in the background
		$.renderAmbientShips();

		// logo (fade + slight rise), fallback to bitmap title
		var logoAlpha = Math.min( 1, elapsed / 28 ),
			logoBottom = cy - ( loadCompact ? 20 : 30 ) - ( 1 - logoAlpha ) * 14;
		$.ctxmg.globalAlpha = logoAlpha;
		if( !$.drawLogo( $.ctxmg, cx, logoBottom, loadCompact ? 58 : 110 ) ) {
			$.ctxmg.beginPath();
			$.text( {
				ctx: $.ctxmg, x: cx, y: logoBottom, text: 'RAID SHOOTER',
				hspacing: 2, vspacing: 1, halign: 'center', valign: 'bottom',
				scale: loadCompact ? 6 : 10, snap: 1, render: 1
			} );
			$.ctxmg.fillStyle = '#fff'; $.ctxmg.fill();
		}
		$.ctxmg.globalAlpha = 1;

		// a pilot ship streaks across, leaving a short trail
		var shipDef = $.definitions.characters[ $.storage['character'] || 0 ] || $.definitions.characters[ 0 ],
			shipY = cy + ( loadCompact ? 16 : 24 ),
			travel = -120 + p * ( $.cw + 240 ),
			shipX = travel;
		for( var t = 0; t < 6; t++ ) {
			$.util.fillCircle( $.ctxmg, shipX - 14 - t * 13, shipY, 3 - t * 0.4, 'hsla(190, 100%, 70%, ' + ( 0.28 - t * 0.04 ) + ')' );
		}
		$.ctxmg.save();
		$.ctxmg.translate( shipX, shipY );
		shipDef.draw( $.ctxmg, loadCompact ? 13 : 17, 'hsla(0, 0%, 96%, 1)', $.tick );
		$.ctxmg.restore();

		// progress bar
		var barW = Math.min( $.cw - 80, loadCompact ? 300 : 440 ),
			barH = loadCompact ? 6 : 8,
			barX = cx - barW / 2,
			barY = cy + ( loadCompact ? 70 : 96 );
		$.ctxmg.beginPath();
		$.roundRect( barX, barY, barW, barH, barH / 2 );
		$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.12)'; $.ctxmg.fill();
		$.ctxmg.beginPath();
		$.roundRect( barX, barY, Math.max( barH, barW * p ), barH, barH / 2 );
		$.ctxmg.fillStyle = 'hsla(190, 100%, 65%, 1)'; $.ctxmg.fill();

		// label / sponsor slot
		$.ctxmg.beginPath();
		$.text( {
			ctx: $.ctxmg, x: cx, y: barY + ( loadCompact ? 18 : 24 ),
			text: $.loadingSponsor ? ( 'POWERED BY ' + $.loadingSponsor ) : 'LOADING',
			hspacing: 1, vspacing: 1, halign: 'center', valign: 'top',
			scale: 1, snap: 1, render: 1
		} );
		$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.45)'; $.ctxmg.fill();

		// advance the tick so the bar fills and the ship animates (menu/play
		// reset it on entry, so borrowing it here is safe)
		$.tick += 1;

		// hand off to the menu when done, or let the player tap to skip
		if( elapsed >= dur || ( elapsed > 14 && $.mouse.down ) ) {
			$.mouse.down = 0;
			$.setState( 'menu' );
		}
	};

	$.states['menu'] = function() {


		$.clearScreen();
		$.updateScreen();

		// dormant ships drifting behind the menu for a lively, space feel
		$.renderAmbientShips();
		// keep the drift animation alive on the menu (play/menu reset tick)
		$.tick += 1;

		var i = $.buttons.length; while( i-- ){ if( $.buttons[ i ] ) { $.buttons[ i ].update( i ) } }
			i = $.buttons.length; while( i-- ){ if( $.buttons[ i ] ) { $.buttons[ i ].render( i ) } }

		var menuCompact = ( $.ch < 640 ),
			logoBottomY = menuCompact ? 74 : $.ch / 2 - 150;

		// brand logo image when loaded; bitmap-font title as the fallback
		if( !$.drawLogo( $.ctxmg, $.cw / 2, logoBottomY, menuCompact ? 60 : 116 ) ) {
			$.ctxmg.beginPath();
			var title = $.text( {
				ctx: $.ctxmg,
				x: $.cw / 2,
				y: logoBottomY,
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
		}

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

	// stacks the ship preview's title/status/ability/level lines top to
	// bottom, measuring each line's real height instead of guessing fixed
	// offsets - a two-line desc (e.g. "FAST AND FRAGILE,\nRAPID DASH") or a
	// long ability string would silently collide with the next line under
	// fixed offsets, and that collision only showed up at certain window
	// sizes (compact desktop windows), not on a tall mobile screen
	$.hangarPreviewLayout = function( def, hangarCompact, previewY ) {
		var unlocked = $.characterUnlocked( def ),
			status = $.characterStatus( def ),
			gap = hangarCompact ? 6 : 10,
			blocks = [],
			y = previewY + ( hangarCompact ? 34 : 50 );

		var add = function( text, scale, vspacing, color ) {
			var measured = $.text( {
				ctx: $.ctxmg, x: 0, y: 0, text: text,
				hspacing: 1, vspacing: vspacing,
				halign: 'left', valign: 'top', scale: scale, snap: 1, render: 0
			} );
			blocks.push( { text: text, scale: scale, vspacing: vspacing, color: color, y: y } );
			y += measured.height + gap;
		};

		add( def.title, hangarCompact ? 2 : 3, 1, unlocked ? 'hsla(0, 0%, 100%, 0.95)' : 'hsla(0, 0%, 100%, 0.4)' );
		add( status.text, hangarCompact ? 1 : 2, 8, status.color );
		if( def.ability ) {
			add( def.ability.title + ': ' + def.ability.text, hangarCompact ? 1 : 2, 8, 'hsla(190, 100%, 70%, 0.8)' );
		}
		if( unlocked ) {
			var pilotLevel = $.pilotLevel( def.id ),
				toNext = $.pilotXpToNext( def.id ),
				levelText = 'LEVEL ' + pilotLevel + '/' + $.pilotMaxLevel + ( toNext ? '  (' + toNext.xp + '/' + toNext.next + ' XP)' : '  (MAX)' );
			add( levelText, 1, 1, 'hsla(45, 100%, 70%, 0.85)' );
		}

		return { blocks: blocks, bottom: y - gap };
	};

	$.states['hangar'] = function() {

		$.clearScreen();

		var hangarCompact = ( $.ch < 640 ),
			def = $.definitions.characters[ $.hangarIndex ],
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

		// big animated ship preview, facing up - tinted with the equipped
		// ship color so a purchased/equipped skin shows here, not just in-run
		var unlocked = $.characterUnlocked( def );
		var hangarShipColor = $.definitions.shipColors[ $.storage[ 'ship' ] || 0 ] || $.definitions.shipColors[ 0 ];
		$.ctxmg.save();
		$.ctxmg.translate( $.cw / 2, previewY );
		$.ctxmg.rotate( -$.pi / 2 );
		def.draw( $.ctxmg, hangarCompact ? 18 : 28, unlocked ? hangarShipColor.color : 'hsla(0, 0%, 35%, 1)', $.tick );
		$.ctxmg.restore();

		// the equipped drone hovers beside the pilot, drawn in its own market
		// shape, so a purchased/equipped drone is visible on the character in
		// the hangar - not just during a live run
		var hangarDrone = $.equippedDrone && $.equippedDrone();
		if( hangarDrone && hangarDrone.draw ) {
			var shipR = hangarCompact ? 18 : 28,
				orbitR = shipR + ( hangarCompact ? 22 : 34 ),
				orbitAngle = $.tick / 40,
				ddx = $.cw / 2 + Math.cos( orbitAngle ) * orbitR,
				ddy = previewY + Math.sin( orbitAngle ) * orbitR * 0.55;
			$.ctxmg.save();
			$.ctxmg.translate( ddx, ddy );
			hangarDrone.draw( $.ctxmg, hangarCompact ? 9 : 12, 'hsla(190, 100%, 70%, 0.95)', $.tick );
			$.ctxmg.restore();
		}

		var previewLayout = $.hangarPreviewLayout( def, hangarCompact, previewY );
		for( var pli = 0; pli < previewLayout.blocks.length; pli++ ) {
			var block = previewLayout.blocks[ pli ];
			$.ctxmg.beginPath();
			$.text( {
				ctx: $.ctxmg,
				x: $.cw / 2,
				y: block.y,
				text: block.text,
				hspacing: 1,
				vspacing: block.vspacing,
				halign: 'center',
				valign: 'top',
				scale: block.scale,
				snap: 1,
				render: 1
			} );
			$.ctxmg.fillStyle = block.color;
			$.ctxmg.fill();
		}

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

		$.applyButtonScroll();
		var i = $.buttons.length; while( i-- ){ if( $.buttons[ i ] ) { $.buttons[ i ].update( i ) } }

		i = $.buttons.length;
		while( i-- ) { if( $.buttons[ i ] && !$.buttons[ i ].scrollable ) { $.buttons[ i ].render( i ); } }

		var hclip = $.hangarClip || { top: 0, bottom: $.ch };
		$.ctxmg.save();
		$.ctxmg.beginPath();
		$.ctxmg.rect( 0, hclip.top, $.cw, Math.max( 0, hclip.bottom - hclip.top ) );
		$.ctxmg.clip();
		i = $.buttons.length;
		while( i-- ) { if( $.buttons[ i ] && $.buttons[ i ].scrollable ) { $.buttons[ i ].render( i ); } }
		$.ctxmg.restore();
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
			text: $.marketState.enabled ? 'PILOTS / DRONES / BOOSTS. SETTLED ON BASE' : 'PILOTS / DRONES / BOOSTS. PAYMENTS LIVE SOON',
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

		$.applyButtonScroll();
		var i = $.buttons.length; while( i-- ){ if( $.buttons[ i ] ) { $.buttons[ i ].update( i ) } }

		// fixed chrome (tabs, BACK) renders normally; the scrollable item
		// list is clipped to the strip between the tabs and the footer so
		// it can't be dragged up over the title or down past BACK
		i = $.buttons.length;
		while( i-- ) { if( $.buttons[ i ] && !$.buttons[ i ].scrollable ) { $.buttons[ i ].render( i ); } }

		var clip = $.marketListClip || { top: 0, bottom: $.ch };
		$.ctxmg.save();
		$.ctxmg.beginPath();
		$.ctxmg.rect( 0, clip.top, $.cw, Math.max( 0, clip.bottom - clip.top ) );
		$.ctxmg.clip();
		i = $.buttons.length;
		while( i-- ) { if( $.buttons[ i ] && $.buttons[ i ].scrollable ) { $.buttons[ i ].render( i ); } }
		$.ctxmg.restore();
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

		/*==============================================================================
		Your live rank banner - so a player can always spot where they stand,
		even when their own row has scrolled out of the top-100 list below
		==============================================================================*/
		var myKeyTop = $.myKey(),
			myIndexTop = -1;
		if( myKeyTop ) {
			for( var mq = 0; mq < $.board.entries.length; mq++ ) {
				if( $.board.entries[ mq ].address === myKeyTop ) { myIndexTop = mq; break; }
			}
		}
		if( !$.board.loading && !$.board.error && $.board.entries.length ) {
			var rankY = tierY + ( boardCompact ? 36 : 48 ),
				rankText = ( myIndexTop >= 0 )
					? 'YOU  RANK ' + ( myIndexTop + 1 ) + ' OF ' + $.board.entries.length + '  ' + $.util.commas( $.board.entries[ myIndexTop ].score )
					: 'YOU  UNRANKED  /  PLAY TO CLAIM A RANK';
			$.ctxmg.beginPath();
			var rankMeasure = $.text( {
				ctx: $.ctxmg, x: $.cw / 2, y: rankY, text: rankText,
				hspacing: 1, vspacing: 1, halign: 'center', valign: 'top',
				scale: boardCompact ? 1 : 2, snap: 1, render: 0
			} );
			// soft pill behind the banner so it reads as "this is you"
			$.ctxmg.fillStyle = ( myIndexTop >= 0 ) ? 'hsla(45, 100%, 60%, 0.12)' : 'hsla(0, 0%, 100%, 0.06)';
			$.roundRect( rankMeasure.sx - 14, rankMeasure.sy - 5, rankMeasure.width + 28, rankMeasure.height + 10, 6 );
			$.ctxmg.fill();
			$.ctxmg.beginPath();
			$.text( {
				ctx: $.ctxmg, x: $.cw / 2, y: rankY, text: rankText,
				hspacing: 1, vspacing: 1, halign: 'center', valign: 'top',
				scale: boardCompact ? 1 : 2, snap: 1, render: 1
			} );
			$.ctxmg.fillStyle = ( myIndexTop >= 0 ) ? 'hsla(45, 100%, 70%, 1)' : 'hsla(0, 0%, 100%, 0.6)';
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
			// two columns so rows fit two-up; narrow phones drop to one
			// column at a smaller scale so names never collide with scores.
			// the full top 100 is listed - the list scrolls rather than
			// truncating to whatever fits on one screen
			var rowCount = Math.min( $.board.entries.length, 100 ),
				narrow = ( $.cw < 480 ),
				columns = narrow ? 1 : 2,
				rowScale = ( boardCompact || narrow ) ? 1 : 2,
				perColumn = Math.ceil( rowCount / columns ),
				// pushed down to clear the YOUR-TIER and YOU-RANK banners
					rowStartY = boardTitle.ey + ( boardCompact ? 70 : 104 ),
				rowSpacing = narrow ? 13 : ( boardCompact ? 15 : 19 ),
				columnGap = boardCompact ? 24 : 50,
				totalWidth = Math.min( $.cw - 60, 720 ),
				colWidth = narrow ? totalWidth : ( totalWidth - columnGap ) / 2,
				col0Left = $.cw / 2 - totalWidth / 2,
				col0Right = col0Left + colWidth,
				col1Left = narrow ? col0Left : col0Right + columnGap,
				col1Right = narrow ? col0Right : col1Left + colWidth,
				boardClipTop = rowStartY - rowSpacing,
				boardClipBottom = $.ch - ( boardCompact ? 100 : 130 );

			$.setScrollMax( rowStartY + perColumn * rowSpacing + 10, boardClipBottom );

			$.ctxmg.save();
			$.ctxmg.beginPath();
			$.ctxmg.rect( 0, boardClipTop, $.cw, Math.max( 0, boardClipBottom - boardClipTop ) );
			$.ctxmg.clip();

			// medal colours for the podium - top 3 stand out from the pack
			var medalColors = [ 'hsla(45, 100%, 62%, 1)', 'hsla(0, 0%, 80%, 1)', 'hsla(28, 75%, 55%, 1)' ];
			$.boardMyScrollTarget = -1;

			for( var ri = 0; ri < rowCount; ri++ ) {
				var entry = $.board.entries[ ri ],
					myKey = $.myKey(),
					mine = ( myKey && entry.address === myKey ),
					medal = ( ri < 3 ) ? medalColors[ ri ] : null,
					rowColor = mine ? 'hsla(45, 100%, 70%, 1)' : ( medal ? medal : 'hsla(0, 0%, 100%, 0.65)' ),
					// wallet-verified players carry a badge glyph after their name
					verifiedBadge = entry.verified ? ' \x01' : '',
					col = ( ri < perColumn ) ? 0 : 1,
					row = ( ri < perColumn ) ? ri : ri - perColumn,
					leftX = ( col === 0 ) ? col0Left : col1Left,
					rightX = ( col === 0 ) ? col0Right : col1Right,
					rowY = rowStartY + row * rowSpacing - $.scroll.y;

				// remember how far to scroll to bring the player's own row to
				// the top of the list, for the JUMP TO ME button
				if( mine ) {
					$.boardMyScrollTarget = Math.max( 0, Math.min(
						$.scroll.max,
						rowStartY + row * rowSpacing - boardClipTop - rowSpacing
					) );
				}

				// highlight bar behind the player's own row so it pops
				if( mine ) {
					$.ctxmg.beginPath();
					$.ctxmg.fillStyle = 'hsla(45, 100%, 60%, 0.16)';
					$.roundRect( leftX - 8, rowY - 3, ( rightX - leftX ) + 16, rowSpacing - 2, 4 );
					$.ctxmg.fill();
				}

				// small medal dot for the podium ranks
				if( medal ) {
					$.util.fillCircle( $.ctxmg, leftX - ( boardCompact ? 8 : 12 ), rowY + rowSpacing / 2 - 4, boardCompact ? 3 : 4, medal );
				}

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

			$.ctxmg.restore();
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

	/*==============================================================================
	How To Play - a slide deck explaining controls and the game, illustrated
	with the game's own art (ship / asteroid / drone / tier dots)
	==============================================================================*/
	// small filled triangle, pointing in a cardinal direction, for the
	// movement arrows on the controls slide
	function htArrow( cx, cy, dir, s, color ) {
		$.ctxmg.beginPath();
		if( dir === 'up' ) { $.ctxmg.moveTo( cx, cy - s ); $.ctxmg.lineTo( cx - s * 0.7, cy ); $.ctxmg.lineTo( cx + s * 0.7, cy ); }
		else if( dir === 'down' ) { $.ctxmg.moveTo( cx, cy + s ); $.ctxmg.lineTo( cx - s * 0.7, cy ); $.ctxmg.lineTo( cx + s * 0.7, cy ); }
		else if( dir === 'left' ) { $.ctxmg.moveTo( cx - s, cy ); $.ctxmg.lineTo( cx, cy - s * 0.7 ); $.ctxmg.lineTo( cx, cy + s * 0.7 ); }
		else { $.ctxmg.moveTo( cx + s, cy ); $.ctxmg.lineTo( cx, cy - s * 0.7 ); $.ctxmg.lineTo( cx, cy + s * 0.7 ); }
		$.ctxmg.closePath();
		$.ctxmg.fillStyle = color;
		$.ctxmg.fill();
	}

	// a jagged asteroid silhouette centered at (cx,cy)
	function htAsteroid( cx, cy, r, color ) {
		var pts = [ 1, 0.7, 1.05, 0.55, 0.8, 0.95, 1, 1.1, 0.65, 0.85, 1.1 ];
		$.ctxmg.beginPath();
		for( var a = 0; a < 11; a++ ) {
			var ang = ( a / 11 ) * $.twopi,
				rr = r * pts[ a ],
				x = cx + Math.cos( ang ) * rr,
				y = cy + Math.sin( ang ) * rr;
			if( a === 0 ) { $.ctxmg.moveTo( x, y ); } else { $.ctxmg.lineTo( x, y ); }
		}
		$.ctxmg.closePath();
		$.ctxmg.fillStyle = color;
		$.ctxmg.fill();
	}

	$.howtoSlideData = function() {
		var accent = 'hsla(190, 100%, 70%, 1)',
			ship0 = $.definitions.characters[ 0 ],
			ship1 = $.definitions.characters[ 1 ] || ship0,
			drone = ( $.definitions.drones && $.definitions.drones[ 1 ] ) || null;
		return [
			{
				title: 'CONTROLS',
				lines: 'MOVE:  WASD OR ARROWS\nAIM AND FIRE:  MOUSE\nDASH:  SHIFT OR SPACE\nON PHONE:  DRAG TO MOVE,  TAP TO FIRE',
				draw: function( cx, cy, r ) {
					$.ctxmg.save();
					$.ctxmg.translate( cx, cy );
					ship0.draw( $.ctxmg, r * 0.55, 'hsla(0, 0%, 96%, 1)', $.tick );
					$.ctxmg.restore();
					var d = r * 1.5, a = r * 0.34;
					htArrow( cx, cy - d, 'up', a, accent );
					htArrow( cx, cy + d, 'down', a, accent );
					htArrow( cx - d, cy, 'left', a, accent );
					htArrow( cx + d, cy, 'right', a, accent );
				}
			},
			{
				title: 'THE MISSION',
				lines: 'SURVIVE ENDLESS WAVES\nOF ASTEROIDS AND DRONES\nDEFEAT THE ASTEROID KING\nEVERY HIT DRAINS YOUR HULL',
				draw: function( cx, cy, r ) {
					htAsteroid( cx + r * 0.9, cy + r * 0.4, r * 0.75, 'hsla(0, 0%, 42%, 1)' );
					htAsteroid( cx - r * 0.6, cy - r * 0.5, r * 0.45, 'hsla(0, 0%, 55%, 1)' );
					$.ctxmg.save();
					$.ctxmg.translate( cx - r * 0.4, cy + r * 0.5 );
					$.ctxmg.rotate( -0.5 );
					$.definitions.characters[ 0 ].draw( $.ctxmg, r * 0.42, 'hsla(190, 100%, 75%, 1)', $.tick );
					$.ctxmg.restore();
				}
			},
			{
				title: 'SCORE AND COMBO',
				lines: 'CHAIN KILLS TO RAISE COMBO\nHIGHER COMBO,  MORE SCORE\nKEEP KILLING BEFORE\nTHE COMBO TIMER RESETS',
				draw: function( cx, cy, r ) {
					// a segmented combo meter filling toward x8
					var segs = 8, w = r * 0.34, gap = r * 0.12, totalW = segs * w + ( segs - 1 ) * gap,
						x0 = cx - totalW / 2, h = r * 0.7;
					for( var s = 0; s < segs; s++ ) {
						$.ctxmg.beginPath();
						$.ctxmg.rect( x0 + s * ( w + gap ), cy - h / 2, w, h );
						$.ctxmg.fillStyle = ( s < 6 )
							? 'hsla(' + ( 45 + s * 8 ) + ', 100%, 60%, 1)'
							: 'hsla(0, 0%, 100%, 0.15)';
						$.ctxmg.fill();
					}
					$.ctxmg.beginPath();
					$.text( { ctx: $.ctxmg, x: cx, y: cy - h, text: 'X8', hspacing: 1, vspacing: 1, halign: 'center', valign: 'bottom', scale: 3, snap: 1, render: 1 } );
					$.ctxmg.fillStyle = 'hsla(45, 100%, 65%, 1)';
					$.ctxmg.fill();
				}
			},
			{
				title: 'PILOTS AND DRONES',
				lines: 'EACH PILOT HAS AN ABILITY\nEQUIP A DRONE FOR A\nPASSIVE COMBAT BONUS\nDRAFT UPGRADES EACH WAVE',
				draw: function( cx, cy, r ) {
					$.ctxmg.save();
					$.ctxmg.translate( cx, cy );
					ship1.draw( $.ctxmg, r * 0.55, 'hsla(0, 0%, 96%, 1)', $.tick );
					$.ctxmg.restore();
					if( drone && drone.draw ) {
						var ang = $.tick / 30,
							dx = cx + Math.cos( ang ) * r * 1.3,
							dy = cy + Math.sin( ang ) * r * 1.3;
						$.ctxmg.save();
						$.ctxmg.translate( dx, dy );
						drone.draw( $.ctxmg, r * 0.3, 'hsla(190, 100%, 70%, 1)', $.tick );
						$.ctxmg.restore();
					}
				}
			},
			{
				title: 'CLIMB THE RANKS',
				lines: 'TOP THE SHOOTERBOARD\nEARN TIERS BRONZE TO MASTER\nMARKET ITEMS ARE COSMETIC\nAND NEVER AFFECT YOUR SCORE',
				draw: function( cx, cy, r ) {
					var tiers = $.definitions.tiers, n = tiers.length,
						gap = r * 0.62, x0 = cx - ( ( n - 1 ) * gap ) / 2;
					for( var t = 0; t < n; t++ ) {
						$.util.fillCircle( $.ctxmg, x0 + t * gap, cy, r * ( 0.16 + t * 0.03 ), $.tierFor( tiers[ t ].min ).color );
					}
				}
			}
		];
	};

	$.howtoSlideCount = function() {
		return $.howtoSlideData().length;
	};

	$.states['howto'] = function() {
		$.clearScreen();

		var htCompact = ( $.ch < 640 ),
			slides = $.howtoSlideData(),
			idx = Math.max( 0, Math.min( slides.length - 1, $.howtoIndex || 0 ) ),
			slide = slides[ idx ];

		// page title
		$.ctxmg.beginPath();
		var htTitle = $.text( {
			ctx: $.ctxmg, x: $.cw / 2, y: htCompact ? 50 : 90,
			text: 'HOW TO PLAY', hspacing: 2, vspacing: 1,
			halign: 'center', valign: 'bottom', scale: htCompact ? 4 : 7, snap: 1, render: 1
		} );
		var g = $.ctxmg.createLinearGradient( htTitle.sx, htTitle.sy, htTitle.sx, htTitle.ey );
		g.addColorStop( 0, '#fff' ); g.addColorStop( 1, '#999' );
		$.ctxmg.fillStyle = g; $.ctxmg.fill();

		// slide subtitle (accent)
		$.ctxmg.beginPath();
		var htSub = $.text( {
			ctx: $.ctxmg, x: $.cw / 2, y: htTitle.ey + ( htCompact ? 10 : 20 ),
			text: slide.title, hspacing: 1, vspacing: 1,
			halign: 'center', valign: 'top', scale: htCompact ? 2 : 3, snap: 1, render: 1
		} );
		$.ctxmg.fillStyle = 'hsla(190, 100%, 70%, 1)'; $.ctxmg.fill();

		// illustration (drawn from real game art)
		var illoY = htCompact ? Math.floor( $.ch * 0.40 ) : Math.floor( $.ch * 0.40 ),
			illoR = htCompact ? 26 : 42;
		slide.draw( $.cw / 2, illoY, illoR );

		// body lines
		$.ctxmg.beginPath();
		$.text( {
			ctx: $.ctxmg, x: $.cw / 2, y: illoY + ( htCompact ? 64 : 96 ),
			text: slide.lines, hspacing: 1, vspacing: htCompact ? 8 : 14,
			halign: 'center', valign: 'top', scale: htCompact ? 1 : 2, snap: 1, render: 1
		} );
		$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.8)'; $.ctxmg.fill();

		// page dots
		var dotN = slides.length, dotGap = 22, dotY = htCompact ? $.ch - 66 : $.ch - 104,
			dotX0 = $.cw / 2 - ( ( dotN - 1 ) * dotGap ) / 2;
		for( var d2 = 0; d2 < dotN; d2++ ) {
			$.util.fillCircle( $.ctxmg, dotX0 + d2 * dotGap, dotY, d2 === idx ? 5 : 3,
				d2 === idx ? 'hsla(190, 100%, 70%, 1)' : 'hsla(0, 0%, 100%, 0.3)' );
		}

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

		// a revive token auto-spends the instant life hits zero, once per
		// run, restoring half HP and a moment of invulnerability instead of
		// letting the death sequence start
		if( $.hero.life <= 0 && $.consumableCount( 'consumable_revive' ) > 0 ) {
			$.useConsumable( 'consumable_revive', function() {
				$.hero.life = 0.5;
				$.powerupTimers[ 5 ] = $.powerupDuration;
			} );
		}

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
		} else if( $.boardSubmit.state === 'assisted' ) {
			boardText = 'RUN NOT RANKED  /  CONSUMABLE USED';
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
		$.cycleSoundLevel();
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
