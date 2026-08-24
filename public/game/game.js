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

	$.setSoundLevel( $.storage['soundLevel'] !== undefined ? $.storage['soundLevel'] : 0.5 );
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
	$.isTouchDevice = ( ( 'ontouchstart' in window ) || ( navigator.maxTouchPoints > 0 ) ) ? 1 : 0;
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
	// Touch detection must not depend on init ordering: setupCanvasSizes runs
	// once before $.isTouchDevice is assigned, so read it directly here too or
	// touch devices fall through to the desktop 2x cap and render at 2x instead
	// of 1.5x (the iPhone-lag regression).
	var isTouch = ( $.isTouchDevice !== undefined )
		? $.isTouchDevice
		: ( ( ( 'ontouchstart' in window ) || ( navigator.maxTouchPoints > 0 ) ) ? 1 : 0 );
	var maxDpr = isTouch ? 1.5 : 2;
	// On desktop a large/high-DPI monitor (1440p or 4K) at a flat 2x backing
	// store means 8M+ pixels cleared and refilled every frame of gameplay -
	// the main cause of "PC version is lagging" on otherwise capable machines.
	// Cap the backing store to a fixed pixel budget so big windows scale dpr
	// down (still >=1, so it stays crisp) instead of paying full 2x fill cost.
	if( !isTouch ) {
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
	// one continue (resurrect) per run; reset on every fresh start
	$.continueUsedThisRun = 0;
	$.dailyPopTick = 0;

	// arena billboards are run-global sponsor scenery (see sectors.js)
	if( $.spawnBillboards ) { $.spawnBillboards(); }

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
	$.hitstop = 0;
	$.runAssisted = false;
	// XP boost is decided at run start (see $.activateXpBoost); progression
	// only, so it never marks the run assisted
	$.xpBoostThisRun = 0;

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
	$.enemyIntel = { tactic: 'balanced', flank: 0, predictive: 0, huntBoost: 1, eliteBias: null, tick: 0, nextRoll: 180 };
	$.rollEnemyIntel();
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
		if( $.consumableCount( 'consumable_health' ) > 0 || $.consumableCount( 'consumable_shield' ) > 0 ) {
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

			// a concrete first goal converts better than a cold drop-in
			$.ctxmg.beginPath();
			$.text( {
				ctx: $.ctxmg,
				x: $.cw / 2,
				y: $.ch * 0.3 + 64,
				text: 'GOAL: SCORE 10,000 TO RANK ON THE SHOOTERBOARD',
				hspacing: 1, vspacing: 1, halign: 'center', valign: 'center',
				scale: 1, snap: 1, render: 1
			} );
			$.ctxmg.fillStyle = 'hsla(190, 100%, 70%, ' + ( tutAlpha * 0.9 ) + ')';
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
	// Compact HUD on every touch device (not just narrow ones): a large phone
	// in landscape - iPhone Pro Max is 932pt wide - clears the 900 width test
	// and would otherwise render the desktop 2x HUD, making the score/labels
	// look oversized on mobile. Any touch device stays compact.
	var hudCompact = ( $.isTouchDevice || $.cw < 900 ),
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

		// XP BOOST active this run: a small pulsing badge after the score so the
		// player sees the perk they paid for is working
		if( $.xpBoostThisRun ) {
			$.ctxmg.beginPath();
			$.text( { ctx: $.ctxmg, x: scoreLabel.sx, y: scoreText.ey + 3, text: '2X XP', hspacing: 1, vspacing: 1, halign: 'top', valign: 'left', scale: 1, snap: 1, render: 1 } );
			$.ctxmg.fillStyle = 'hsla(140, 90%, 62%, ' + ( 0.7 + Math.sin( $.tick / 12 ) * 0.3 ) + ')';
			$.ctxmg.fill();
		}

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
// Quadrant most aligned with the hero's current travel direction - used by
// the FLANK tactic to spawn ahead of a kiting/dashing player instead of
// purely at random, cutting off the direction they're running toward.
$.headingQuadrant = function() {
	var hvx = $.hero.vx, hvy = $.hero.vy;
	if( Math.abs( hvx ) < 0.3 && Math.abs( hvy ) < 0.3 ) { return -1; } // too slow to have a heading
	if( Math.abs( hvx ) > Math.abs( hvy ) ) {
		return ( hvx > 0 ) ? 1 : 3; // right : left
	}
	return ( hvy > 0 ) ? 2 : 0; // bottom : top
};

$.getSpawnCoordinates = function( radius ) {
	var quadrant = Math.floor( $.util.rand( 0, 4 ) ),
		x,
		y,
		start;

	// FLANK tactic: most of the time spawn ahead of the hero's own heading
	// instead of a pure coin flip, so a player who's kiting in one direction
	// keeps finding fresh enemies waiting rather than an empty lane. Still
	// random the rest of the time - it reads as pressure, not a wall.
	if( $.enemyIntel && $.enemyIntel.flank && Math.random() < 0.55 ) {
		var headingQ = $.headingQuadrant();
		if( headingQ !== -1 ) { quadrant = headingQ; }
	}

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
	// EVASIVE joins from level 5 - these juke your shots (see $.enemyDodge),
	// so a maxed fire rate alone won't clear them; you have to lead or corner
	var kinds = [ 'FAST', 'ARMORED', 'REGEN' ];
	if( $.level && $.level.current >= 4 ) { kinds.push( 'EVASIVE' ); }
	// the current tactical read stacks extra weight on one kind (not an
	// override - it's still a random pick from a pool that includes it more
	// than once) so elites lean into whatever's currently countering the pilot
	if( $.enemyIntel && $.enemyIntel.eliteBias && kinds.indexOf( $.enemyIntel.eliteBias ) !== -1 ) {
		kinds.push( $.enemyIntel.eliteBias, $.enemyIntel.eliteBias );
	}
	var kind = kinds[ Math.floor( $.util.rand( 0, kinds.length ) ) ];
	enemy.elite = kind;
	enemy.value = enemy.value * 3;
	if( kind === 'FAST' ) {
		enemy.speed *= 1.7;
	} else if( kind === 'ARMORED' ) {
		enemy.life = enemy.lifeMax = enemy.lifeMax * 3;
		enemy.radius = Math.floor( enemy.radius * 1.15 );
	} else if( kind === 'EVASIVE' ) {
		enemy.speed *= 1.25;
		enemy.life = enemy.lifeMax = enemy.lifeMax + 1;
	} else {
		enemy.regen = enemy.lifeMax * 0.004;
	}
};

/*==============================================================================
Enemy Intel - "studies" the equipped pilot's ability and the hero's current
combat state (low HP, actively dashing/kiting), then WEIGHTED-RANDOMLY rolls
one tactic for the next stretch of the run: FLANK (spawn ahead of the
hero's heading), PREDICTIVE (ranged bolts lead the hero's velocity instead
of firing at its current spot), SWARM (faster hunt turn-rate so enemies
converge instead of drifting in individually), SNIPER (predictive aim +
elite bias toward EVASIVE, punishing sustained DPS before it lands), or
BALANCED (no bias). It's a read, not a script: every tactic always keeps
some weight, and the read is re-rolled every ~3-8s, so the same loadout
doesn't fight the same counter twice in a row.
==============================================================================*/
$.rollEnemyIntel = function() {
	var ability = ( $.hero.character && $.hero.character.ability ) || {},
		lowHp = $.hero.life < 0.4,
		// dashDuration/combo abilities belong to hit-and-run kiting pilots;
		// dashTick>0 or a hero currently moving fast is also "mobile" this instant
		mobile = !!ability.dashDuration || !!ability.combo || $.hero.dashTick > 0,
		tanky = !!ability.lowHpResist,
		// fires fast/hits hard/moves fast bullets - a glass-cannon burst kit
		glassCannon = !!ability.bulletSpeed || !!ability.damage || !!ability.fireRate,
		sustain = !!ability.killHealMult;

	// [ tacticName, weight ] - reshaped by the read, but nothing ever hits 0
	var pool = [
		[ 'balanced', 3 ],
		[ 'flank', mobile ? 5 : 2 ],
		[ 'predictive', mobile ? 4 : 2 ],
		[ 'swarm', tanky ? 5 : ( glassCannon ? 4 : 2 ) ],
		[ 'sniper', glassCannon ? 5 : 2 ]
	];
	if( lowHp ) { pool.push( [ 'swarm', 4 ], [ 'flank', 3 ] ); } // press the advantage
	if( sustain ) { pool.push( [ 'sniper', 3 ] ); } // punish farmed kills before the heal lands

	var total = 0, p;
	for( p = 0; p < pool.length; p++ ) { total += pool[ p ][ 1 ]; }
	var roll = Math.random() * total, sum = 0, chosen = 'balanced';
	for( p = 0; p < pool.length; p++ ) {
		sum += pool[ p ][ 1 ];
		if( roll <= sum ) { chosen = pool[ p ][ 0 ]; break; }
	}

	$.enemyIntel.tactic = chosen;
	$.enemyIntel.flank = ( chosen === 'flank' ) ? 1 : 0;
	$.enemyIntel.predictive = ( chosen === 'predictive' || chosen === 'sniper' ) ? 1 : 0;
	// swarm hunting sharpens with heat (1.6 -> 2.0 by full heat), and even
	// the non-swarm tactics pick up a light hunt edge late in a run
	$.enemyIntel.huntBoost = ( chosen === 'swarm' )
		? 1.6 + ( $.heat() - 1 ) * 0.4
		: 1 + ( $.heat() - 1 ) * 0.15;
	$.enemyIntel.eliteBias = ( chosen === 'swarm' ) ? 'ARMORED' : ( chosen === 'flank' ? 'FAST' : ( ( chosen === 'predictive' || chosen === 'sniper' ) ? 'EVASIVE' : null ) );
	$.enemyIntel.tick = 0;
	// the read-and-counter loop tightens as heat builds: tactics re-roll up
	// to twice as often at full heat, so late-run enemies adapt to the
	// player's current state much faster - "smarter over the course of time"
	$.enemyIntel.nextRoll = $.util.rand( 180, 480 ) / $.heat();
};

/*==============================================================================
Difficulty
==============================================================================*/
$.difficulties = {
	// One setting only: Raid Shooter runs at a single, punishing difficulty -
	// cranked to the hardest baseline the game has ever shipped (operator
	// call: intensity IS the product). Heat then ramps it further over the
	// course of every run.
	extreme: { label: 'EXTREME', spawn: 0.46, hunt: 1.9, dmg: 2.0, enemyHp: 1.8 }
};

// eases the opening: with EXTREME as the only difficulty, the ramp now
// stretches over the first several levels so new players get a real runway
// before the full spawn rate, hunting, and damage hit (returns ~0.35 -> 1)
$.introMult = function() {
	return Math.min( 1, 0.35 + ( $.level ? $.level.current : 0 ) * 0.16 );
};

/*==============================================================================
Enemy broad-phase grid - the freeze workaround that keeps enemies UNLIMITED
==============================================================================*/
// The late-run freeze was never about how many enemies exist - it was the
// bullet collision scan distance-checking EVERY enemy for EVERY bullet,
// every frame (bullets x enemies). Capping the population "fixed" the cost
// by emptying the field, which killed the intensity the game is built on.
// This is the real fix: enemies are bucketed into 160px cells once per
// frame, and a bullet only checks its own cell plus the 8 neighbors.
// Oversized enemies (bosses, the fatty) go in a small always-checked list.
// Population stays uncapped - a packed arena costs bullets almost nothing.
$.ENEMY_GRID_CELL = 160;
$.enemyGrid = null;
$.enemyGridBig = [];

$.buildEnemyGrid = function() {
	var cell = $.ENEMY_GRID_CELL,
		grid = {},
		big = [];
	for( var i = 0; i < $.enemies.length; i++ ) {
		var e = $.enemies[ i ];
		// anything with a radius near/over the cell size could straddle more
		// than the neighbor ring - keep those in the always-checked list
		if( e.radius >= cell * 0.75 ) {
			big.push( e );
			continue;
		}
		var key = Math.floor( e.x / cell ) + '_' + Math.floor( e.y / cell );
		if( grid[ key ] ) { grid[ key ].push( e ); } else { grid[ key ] = [ e ]; }
	}
	$.enemyGrid = grid;
	$.enemyGridBig = big;
};

// candidate enemies near a point: own cell + 8 neighbors + the big list.
// Falls back to the full array if the grid hasn't been built this frame,
// so nothing breaks if a state forgets to build it.
$.enemiesNear = function( x, y ) {
	if( !$.enemyGrid ) { return $.enemies; }
	var cell = $.ENEMY_GRID_CELL,
		cx = Math.floor( x / cell ),
		cy = Math.floor( y / cell ),
		out = [];
	for( var gx = cx - 1; gx <= cx + 1; gx++ ) {
		for( var gy = cy - 1; gy <= cy + 1; gy++ ) {
			var bucket = $.enemyGrid[ gx + '_' + gy ];
			if( bucket ) { out.push.apply( out, bucket ); }
		}
	}
	if( $.enemyGridBig.length ) { out.push.apply( out, $.enemyGridBig ); }
	return out;
};

/*==============================================================================
Heat - the run gets relentlessly harder and smarter the longer it lasts
==============================================================================*/
// Multiplier that climbs from 1 to 2 over the first ~6 minutes of a run
// (on top of the per-level scaling): spawn pressure doubles, elites get
// more common, and the enemy-intel tactics re-read the player faster.
$.heat = function() {
	return 1 + Math.min( 1, ( $.elapsed || 0 ) / 21600 );
};

// Spawn cadence restored to the last known-good deploy's structure (modulo
// beat, NO population cap - a cap turns quirks into an empty field; see
// the incident notes). The only additions since: heat scales the cadence
// and the elite chance, both of which only ever ADD enemies/pressure -
// they can never block a spawn.
$.spawnEnemies = function() {
	// breathing room after an upgrade draft before the next wave
	if( $.spawnLullTick > 0 ) {
		$.spawnLullTick -= $.dt;
		return;
	}
	var floorTick = Math.floor( $.tick );
	// during a boss fight, minions keep coming but at a slower cadence so the
	// fight stays about the boss while never feeling empty
	// Spawn pressure uses a SOFTENED heat (max +40% cadence compression,
	// not +100%): at full heat the steady-state field was hitting 800-1500
	// enemies - unreadable, phone-melting, and deaths stopped feeling
	// earned. ~1.4x lands the field around 300-500: still a wall of ships,
	// still renderable. And during a boss fight heat doesn't apply AT ALL:
	// the deliberate 2.2x boss spawn-relief was being almost exactly
	// cancelled by full heat, which is why boss arenas drowned in 1300+
	// adds and the boss itself was unreachable. Full-strength heat still
	// drives elites, hunting, and the intel reroll - the run keeps getting
	// smarter at the original rate.
	var bossMult = $.boss ? 2.2 : 1,
		spawnHeat = $.boss ? 1 : ( 1 + ( $.heat() - 1 ) * 0.4 ),
		// larger interval = slower spawns: difficulty scales it, intro ramp
		// stretches it further during the opening levels, heat compresses it
		// as the run goes long
		spawnScale = ( $.diff ? $.diff.spawn : 1 ) / $.introMult() / spawnHeat;
	for( var i = 0; i < $.level.distributionCount; i++ ) {
		var timeCheck = Math.round( $.level.distribution[ i ] * bossMult * spawnScale );
		if( $.levelDiffOffset > 0 ){
			timeCheck = Math.max( 1, timeCheck - ( $.levelDiffOffset * 2) );
		}
		if( floorTick % timeCheck === 0 ) {
			var enemy = $.spawnEnemy( i );
			// elites start appearing from level 4, getting more common with
			// depth - and the ceiling itself climbs with heat (0.16 -> 0.30)
			if( $.level.current >= 3 && Math.random() < Math.min( 0.16 + ( $.heat() - 1 ) * 0.14, 0.04 + $.level.current * 0.01 ) ) {
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
				// a comeback aid, not a full reset - tops up 40 PCT of the hull
				$.hero.life = Math.min( 1, $.hero.life + 0.4 );
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

	// Browsers block audio until the user interacts with the page, so the
	// background music can't autoplay on the very first loading intro. Unlock
	// it on the first gesture of any kind: the moment the player taps, clicks
	// or presses a key, the music kicks in - usually still during the boot
	// screen - and stays on for the menu and the run.
	var unlockMusic = function() {
		$.music.start();
		window.removeEventListener( 'pointerdown', unlockMusic );
		window.removeEventListener( 'touchstart', unlockMusic );
		window.removeEventListener( 'keydown', unlockMusic );
	};
	window.addEventListener( 'pointerdown', unlockMusic );
	window.addEventListener( 'touchstart', unlockMusic );
	window.addEventListener( 'keydown', unlockMusic );
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

// Brief world-freeze on impact (classic arcade "hitstop"). Takes the max so
// rapid kills never stack into a visible stall; the play loop zeros $.dt while
// it counts down, so the world holds for a beat but rendering keeps going.
$.addHitstop = function( n ) {
	$.hitstop = Math.max( $.hitstop || 0, n );
};

// Pulsing red danger vignette + heartbeat rumble when the hull is critical, so
// a player always feels death coming instead of dying with no warning.
$.renderLowHpWarning = function() {
	var life = $.hero ? $.hero.life : 1;
	if( life <= 0 || life >= 0.32 ) { return; }
	var sev = 1 - life / 0.32,
		beat = Math.sin( $.tick / 7 ),
		a = ( 0.12 + sev * 0.30 ) * ( 0.55 + 0.45 * ( 0.5 + 0.5 * beat ) ),
		g = $.ctxmg.createRadialGradient( $.cw / 2, $.ch / 2, $.ch * 0.30, $.cw / 2, $.ch / 2, $.ch * 0.72 );
	g.addColorStop( 0, 'hsla(0, 100%, 45%, 0)' );
	g.addColorStop( 1, 'hsla(0, 100%, 45%, ' + a.toFixed( 3 ) + ')' );
	$.ctxmg.fillStyle = g;
	$.ctxmg.fillRect( 0, 0, $.cw, $.ch );
	if( beat > 0.98 ) { $.rumble.level = Math.max( $.rumble.level, 2 + sev * 3 ); }
};

// Edge chevrons pointing at the nearest off-screen hunters. The whole design
// curves enemies toward the hero, so threats arrive from off-screen - these
// keep incoming danger readable (especially on phones). Capped so late waves
// don't clutter the edges.
$.renderOffscreenArrows = function() {
	if( !$.enemies || !$.enemies.length || !$.hero || $.hero.life <= 0 ) { return; }
	var cx = $.cw / 2, cy = $.ch / 2, margin = 32, cand = [];
	for( var i = 0; i < $.enemies.length; i++ ) {
		var e = $.enemies[ i ];
		if( e.isBolt ) { continue; }
		var sx = e.x + $.screen.x, sy = e.y + $.screen.y;
		if( sx >= -8 && sx <= $.cw + 8 && sy >= -8 && sy <= $.ch + 8 ) { continue; }
		cand.push( { e: e, d: $.util.distance( $.hero.x, $.hero.y, e.x, e.y ) } );
	}
	if( !cand.length ) { return; }
	cand.sort( function( a, b ) { return a.d - b.d; } );
	var n = Math.min( 6, cand.length );
	for( var k = 0; k < n; k++ ) {
		var en = cand[ k ].e,
			ang = Math.atan2( ( en.y + $.screen.y ) - cy, ( en.x + $.screen.x ) - cx ),
			ex = Math.cos( ang ) || 0.0001, ey = Math.sin( ang ) || 0.0001,
			t = Math.min( Math.abs( ( cx - margin ) / ex ), Math.abs( ( cy - margin ) / ey ) ),
			ax = cx + ex * t, ay = cy + ey * t,
			alpha = 0.22 + 0.5 * ( 1 - k / n );
		$.ctxmg.save();
		$.ctxmg.translate( ax, ay );
		$.ctxmg.rotate( ang );
		$.ctxmg.beginPath();
		$.ctxmg.moveTo( 10, 0 ); $.ctxmg.lineTo( -6, 7 ); $.ctxmg.lineTo( -6, -7 );
		$.ctxmg.closePath();
		$.ctxmg.fillStyle = $.hsla( en.hue, 100, 62, alpha );
		$.ctxmg.fill();
		$.ctxmg.restore();
	}
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

	// animate background canvases (parallax). Uses transform: translate3d,
	// which stays on the compositor thread - the old marginLeft/marginTop
	// version mutated a LAYOUT property on four full-screen canvases every
	// frame, forcing style/layout recalc + re-rasterization each frame on iOS
	// Safari. That layout storm, not canvas fill, was the iPhone lag under
	// combat load.
	var pxr = ( -$.screen.x - ( $.ww - $.cw ) / 2 ) / ( ( $.ww - $.cw ) / 2 ),
		pyr = ( -$.screen.y - ( $.wh - $.ch ) / 2 ) / ( ( $.wh - $.ch ) / 2 ),
		panBg = function( c ) {
			var hx = ( c.width - $.cw ) / 2,
				hy = ( c.height - $.ch ) / 2,
				tx = -hx - hx * pxr - $.rumble.x,
				ty = -hy - hy * pyr - $.rumble.y;
			c.style.transform = 'translate3d(' + tx + 'px,' + ty + 'px,0)';
		};
	panBg( $.cbg1 );
	panBg( $.cbg2 );
	panBg( $.cbg3 );
	panBg( $.cbg4 );

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
		$.gainPilotXp( $.hero.character.id, $.xpGainMult ? $.xpGainMult() : 1 );
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
			// kill quota scales with heat: at full heat the swarm feeds
			// itself into your guns so fast that flat quotas made levels
			// 8-second sprints (five upgrade drafts in half a minute in
			// playtesting). Scaling the quota restores the level rhythm.
			// Set once at level start (heat moves slowly), so the HUD bar
			// and the boss force-complete stay consistent automatically.
			$.level.killsToLevel = Math.round( $.definitions.levels[ $.level.current ].killsToLevel * $.heat() );
			$.level.distribution = $.definitions.levels[ $.level.current ].distribution;
			$.level.distributionCount = $.level.distribution.length;
		} else {
			$.level.current++;
			$.level.kills = 0;
			// past the defined list: keep the last level's (already
			// heat-scaled) quota and distribution
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

// NUKE pickup: heavy damage to everything on the field except bosses.
// Damage lowered from 6 -> 3: at 6 it was a guaranteed kill on anything
// but the tankiest enemies, functioning as an undodgeable full-screen
// clear button. At 3 it still hits every enemy on screen instantly and
// finishes off anything already weakened, but tougher enemies survive it.
$.detonateNuke = function() {
	$.audio.play( 'explosion' );
	$.rumble.level = 12;
	$.nukeFlashTick = 14;
	var ei = $.enemies.length;
	while( ei-- ) {
		var enemy = $.enemies[ ei ];
		if( !enemy.isBoss ) {
			enemy.receiveDamage( ei, 3 );
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
	// Entering play resets the delta clock. Without this, any path into
	// 'play' that didn't hand-set $.lt (keyboard unpause, the first frame
	// of a fresh run where $.reset left lt=0) computed its first dt from
	// the whole time since the last play frame - clamped to 10, so the
	// world lurched 10 ticks in one frame and enemies teleported onto the
	// hero. One reset here covers every entry path.
	if( state === 'play' ) {
		$.lt = Date.now();
	}
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

		// abandoning a daily run mid-flight (pause -> menu): restore the real
		// RNG and drop the active flag WITHOUT marking the day done, so the
		// attempt isn't wasted
		if( $.dailyRunActive ) {
			$.endSeededRng();
			$.dailyRunActive = 0;
		}

		$.reset();

		// compact layout: two columns of buttons on short screens (phone
		// landscape), where a single stacked column runs off the bottom
		var menuCompact = ( $.ch < 640 ),
			menuSpacing = menuCompact ? 8 : 22,
			menuButtonHeight = menuCompact ? 45 : 49,
			menuStartY = menuCompact ? 112 : $.ch / 2 - 110;

		$.fetchSession();
		// refresh the live tournament banner whenever the menu is entered
		if( $.fetchSeason ) { $.fetchSeason(); }
		// tournament reward won since last visit? start the one-time
		// congratulation (marked seen after it has been displayed once)
		$.celebration = $.rewardCelebration ? $.rewardCelebration() : null;
		$.celebrationStart = $.tick;

		// PLAY stays exactly where it always has - centered, first, full width,
		// unchanged in position/size. It's the single most-used button in the
		// game. Now rendered in the rounded-glass style (glass+active) to
		// match the hub, but its hitbox/position/action are untouched.
		var fullW = Math.min( $.cw - 40, menuCompact ? 420 : 620 ),
			playAction = function() {
				$.mouse.down = 0;
				// first-time players choose a call sign before their first
				// run, so their very first score lands on the board under a
				// name they picked - not a silent auto-generated default
				if( !$.storage['pilotname'] ) {
					$.promptPilotName();
					$.ensurePilotName();
				}
				$.setState( 'playmode' );
			};
		$.buttons.push( new $.Button( {
			x: $.cw / 2, y: menuStartY, lockedWidth: fullW, lockedHeight: menuButtonHeight,
			scale: menuCompact ? 2 : 3, title: 'PLAY', glass: 1, active: 1,
			action: playAction
		} ) );

		// Hub nav rail: PLAY (repeated here as the highlighted top row, same
		// action as the big button above - reinforces the one primary action
		// instead of duplicating it) plus the four secondary destinations,
		// left-anchored in a vertical list instead of the old centered 2x2
		// grid. Vertically centred on PLAY's own y so the rail and the
		// logo/PLAY column share one visual band rather than reading as two
		// unrelated pieces of layout. Same $.Button component and the same
		// "compress if it would run off-screen" safeguard the old grid used.
		var navDefs = [
			{ title: 'PLAY', active: 1, action: playAction },
			{ title: 'PILOT: ' + $.currentCharacter().title, action: function() {
				$.mouse.down = 0;
				$.setState( 'hangar' );
			} },
			{ title: 'MARKET', action: function() {
				$.mouse.down = 0;
				$.setState( 'market' );
			} },
			{ title: 'SHOOTERBOARD', action: function() {
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
			{ title: 'SETTINGS', action: function() {
				$.mouse.down = 0;
				$.setState( 'settings' );
			} }
		];

		var navW = menuCompact ? 168 : 216,
			navH = menuCompact ? 34 : 40,
			navGap = menuCompact ? 6 : 9,
			navPitch = navH + navGap,
			navPad = 12,
			navX = $.safeAreaLeft + 18 + navW / 2,
			// centred on PLAY's y, so the rail reads as sharing PLAY's band
			// instead of floating separately near the top of the screen
			navStartY = menuStartY - Math.floor( ( navDefs.length - 1 ) / 2 ) * navPitch,
			// clears the HTML top currency bar (GameOverlays.tsx) and the
			// safe-area inset on notched phones
			navMinY = $.safeAreaTop + ( menuCompact ? 58 : 70 ) + navH / 2,
			// don't run into the HTML Feedback/Invite row pinned bottom-left
			navMaxY = $.ch - $.safeAreaBottom - ( menuCompact ? 66 : 56 ) - navH / 2;

		if( navStartY < navMinY ) { navStartY = navMinY; }
		if( navStartY + ( navDefs.length - 1 ) * navPitch > navMaxY && navDefs.length > 1 ) {
			navPitch = Math.max( 24, Math.floor( ( navMaxY - navStartY ) / ( navDefs.length - 1 ) ) );
			if( navPitch < navH + 2 ) { navH = Math.max( 22, navPitch - 3 ); }
		}

		// glass container panel behind the whole rail, drawn every frame in
		// the per-frame menu render (below) so ambient ships stay visible
		// through its translucency - stored here since this setup code only
		// runs once per state entry, not every frame
		$.navRailPanel = {
			x: navX - navW / 2 - navPad, y: navStartY - navH / 2 - navPad,
			w: navW + navPad * 2, h: ( navDefs.length - 1 ) * navPitch + navH + navPad * 2
		};

		for( var ni = 0; ni < navDefs.length; ni++ ) {
			$.buttons.push( new $.Button( {
				x: navX, y: navStartY + ni * navPitch, lockedWidth: navW, lockedHeight: navH,
				scale: 1, glass: 1, active: navDefs[ ni ].active ? 1 : 0,
				title: navDefs[ ni ].title, action: navDefs[ ni ].action
			} ) );
		}
	}

	// PLAY mode chooser: ENDLESS (the ranked run) or DAILY RUN (one seeded
	// attempt on its own board). Lives on the play path so daily hooks every
	// player without costing the menu a row.
	if( state == 'playmode' ) {
		$.mouse.down = 0;
		var pmCompact = ( $.ch < 640 ),
			pmY = pmCompact ? $.ch / 2 - 24 : $.ch / 2 - 40,
			pmW = Math.min( $.cw - 40, pmCompact ? 420 : 520 );
		$.buttons.push( new $.Button( {
			x: $.cw / 2, y: pmY, lockedWidth: pmW, lockedHeight: pmCompact ? 48 : 56,
			scale: pmCompact ? 2 : 3, title: 'ENDLESS RUN',
			action: function() {
				$.mouse.down = 0;
				$.reset();
				$.trackRun( 'run_start' );
				$.audio.play( 'levelup' );
				$.music.start();
				$.setState( 'play' );
			}
		} ) );
		$.buttons.push( new $.Button( {
			x: $.cw / 2, y: pmY + ( pmCompact ? 56 : 70 ), lockedWidth: pmW, lockedHeight: pmCompact ? 44 : 50,
			scale: pmCompact ? 1 : 2,
			title: $.dailyRunPlayedToday() ? 'DAILY RUN: DONE FOR TODAY' : ( $.storage['dailyrunever'] ? 'DAILY RUN' : 'DAILY RUN  NEW' ),
			action: function() {
				$.mouse.down = 0;
				$.setState( 'dailyrun' );
			}
		} ) );
		$.buttons.push( new $.Button( {
			x: $.cw / 2, y: pmCompact ? $.ch - 34 : pmY + ( pmCompact ? 108 : 136 ),
			lockedWidth: 200, lockedHeight: pmCompact ? 38 : 45, scale: 1, title: 'BACK',
			action: function() { $.mouse.down = 0; $.setState( 'menu' ); }
		} ) );
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
			// on short landscape-mobile the ship sits higher so the stat-less
			// compact layout leaves room for every control row on screen
			arrowY = hangarCompact ? Math.floor( $.ch * 0.28 ) : Math.floor( $.ch * 0.38 ),
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
					// cinematic swap: the new ship whooshes/spins in from the left
					$.hangarAnim = { t: 1, dir: -1 };
					$.audio.play( 'powerup' );
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
					// cinematic swap: the new ship whooshes/spins in from the right
					$.hangarAnim = { t: 1, dir: 1 };
					$.audio.play( 'powerup' );
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
					// rows are CENTER-anchored 45px buttons, so this gap must clear the
				// button's half-height (~23) or the top row rides up over the
				// ability text - the bug where pilot powers were hidden on mobile
				hangarRowsTop = previewTextBottom + ( hangarCompact ? 34 : 48 ),
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
				if( !equipped ) { return 'DRONE: NONE\nEQUIP ONE FOR A PASSIVE BONUS'; }
				var xpTag = $.droneXpLabel ? $.droneXpLabel( equipped ) : '';
				return 'DRONE: ' + equipped.title +
					'\n' + equipped.desc + ( xpTag ? ( '   ' + xpTag ) : '' );
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
					// unowned pilots read in a premium steel-blue (not dead grey)
					// so the roster looks like hardware you want, and glow lit
					icon = {
						draw: charDef.draw,
						color: owned ? shipColor.color : 'hsla(205, 78%, 68%, 0.95)',
						glow: owned ? 'hsla(140, 90%, 55%, 0.28)' : 'hsla(205, 95%, 60%, 0.26)',
						r: smallText ? 13 : 16
					};
				}
			} else if( item.kind === 'drone' ) {
				var droneDef = null;
				for( var dii = 0; dii < $.definitions.drones.length; dii++ ) {
					if( $.definitions.drones[ dii ].id === item.id ) {
						droneDef = $.definitions.drones[ dii ];
						break;
					}
				}
				// surface the XP bonus as a buying point next to the passive
				var droneXpTag = ( droneDef && $.droneXpLabel ) ? $.droneXpLabel( droneDef ) : '';
				if( droneXpTag ) {
					subtitle = ( subtitle ? ( subtitle + '   ' ) : '' ) + droneXpTag;
				}
				icon = {
					draw: ( droneDef && droneDef.draw ) || function( ctx, r, fillStyle ) {
						ctx.beginPath();
						ctx.arc( 0, 0, r, 0, $.twopi );
						ctx.fillStyle = fillStyle;
						ctx.fill();
					},
					color: owned ? 'hsla(190, 100%, 65%, 1)' : 'hsla(190, 90%, 64%, 0.9)',
					glow: owned ? 'hsla(190, 100%, 60%, 0.30)' : 'hsla(190, 95%, 58%, 0.22)',
					r: smallText ? 13 : 16
				};
			}

			// per-category identity stripe: pilots steel-blue, drones cyan,
			// boosts gold - owned items go green to read as unlocked
			var accent = owned
				? 'hsla(140, 80%, 55%, 0.9)'
				: ( item.kind === 'character' ? 'hsla(205, 90%, 62%, 0.9)'
					: item.kind === 'drone' ? 'hsla(190, 100%, 60%, 0.9)'
					: 'hsla(45, 100%, 62%, 0.9)' );

			$.buttons.push( new $.Button( {
				x: x,
				y: itemStartY + row * ( itemHeight + itemGap ),
				lockedWidth: itemWidth,
				lockedHeight: itemHeight,
				scale: 1,
				card: 1,
				accent: accent,
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

	if( state == 'settings' && !window.__htmlSettings ) {
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
		settingsButton( 'HOW TO PLAY', function() {
			$.mouse.down = 0;
			$.howtoIndex = 0;
			$.howtoOnboarding = 0;
			$.setState( 'howto' );
		} );
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

	// The HTML BoardOverlay is the default leaderboard: it covers the screen
	// with the cool board, so the canvas builds no UI and fetches nothing.
	// CRITICAL: never return out of setState for this - the state assignment
	// and the raidshooter:state dispatch at the BOTTOM of setState are what
	// actually open the overlay (an early return here broke the board).
	if( state == 'board' && !window.__htmlBoard ) {
		$.mouse.down = 0;
		// a cup that ended while the player was away shouldn't leave them
		// stuck on an empty CUP tab
		if( $.boardTab === 'cup' && !$.cupLive() ) { $.boardTab = 'all'; }
		$.fetchBoard();
		// keep the board live while the player is looking at it
		$.boardRefreshTimer = setInterval( function() {
			if( !$.board.loading ) {
				$.fetchBoard();
			}
		}, 10000 );

		// segmented board selector: ALL-TIME vs SPACE HUNT, the live sponsored
		// cup (only shown when one is running). Lets a player pick the esports
		// board in-game without leaving for an external page. The lane sits
		// just under the title; the renderer reserves space for it (see
		// laneOffset) so it never lands on the tier/rank banners.
		var boardCompactSet = ( $.ch < 640 ),
			tabY = ( boardCompactSet ? 60 : 110 ) + ( boardCompactSet ? 18 : 26 ),
			cupLive = $.cupLive();
		var makeTab = function( label, tab, x ) {
			var b = new $.Button( {
				x: x, y: tabY, lockedWidth: 168, lockedHeight: 38, scale: 1,
				title: label,
				action: function() {
					if( $.boardTab === tab ) { return; }
					$.boardTab = tab;
					$.scroll.y = 0;
					$.fetchBoard();
				}
			} );
			$.buttons.push( b );
		};
		if( cupLive ) {
			makeTab( 'ALL-TIME', 'all', $.cw / 2 - 92 );
			makeTab( $.cupTabLabel(), 'cup', $.cw / 2 + 92 );
		}

		// (INVITE lives as an HTML overlay button on the menu, like Feedback -
		// see GameOverlays - so it's always one tap away and never crowds the
		// board's control row.)

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

	if( state == 'dailyrun' ) {
		$.mouse.down = 0;
		if( !$.storage['dailyrunever'] ) { $.storage['dailyrunever'] = 1; $.updateStorage(); }
		$.fetchDailyBoard();
		var playedToday = $.dailyRunPlayedToday();
		$.buttons.push( new $.Button( {
			x: $.cw / 2 - 106, y: $.ch - 52, lockedWidth: 199, lockedHeight: 45, scale: 2,
			title: playedToday ? 'PLAYED TODAY' : 'START RUN',
			action: function() {
				$.mouse.down = 0;
				if( $.dailyRunPlayedToday() ) { return; }
				$.startDailyRun();
			}
		} ) );
		$.buttons.push( new $.Button( {
			x: $.cw / 2 + 106, y: $.ch - 52, lockedWidth: 199, lockedHeight: 45, scale: 2,
			title: 'MENU',
			action: function() { $.mouse.down = 0; $.setState( 'menu' ); }
		} ) );
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
		// once the guide has been seen (finished or skipped), a new player
		// never gets auto-onboarded again
		$.markGuideSeen = $.markGuideSeen || function() {
			$.howtoOnboarding = 0;
			if( !$.storage['guideseen'] ) { $.storage['guideseen'] = 1; $.updateStorage(); }
		};
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
					$.markGuideSeen();
					$.setState( 'menu' );
				} else {
					$.howtoIndex += 1;
					$.setState( 'howto' );
				}
			}
		} ) );

		// SKIP (during onboarding) / MENU (from settings), bottom center
		$.buttons.push( new $.Button( {
			x: $.cw / 2 + 1,
			y: htCompact ? $.ch - 34 : $.ch - 60,
			lockedWidth: htCompact ? 130 : 180,
			lockedHeight: htCompact ? 40 : 49,
			scale: htCompact ? 1 : 2,
			title: $.howtoOnboarding ? 'SKIP' : 'MENU',
			action: function() {
				$.mouse.down = 0;
				$.markGuideSeen();
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

		// Touch players also have no 1/2 keys - a purchased Health Pack or
		// Shield Charge had NO way to be used mid-run on touch at all (the
		// stock showed in the corner HUD, the keyboard shortcut existed, but
		// there was never a tap target). Second row, same dead zone, only
		// shown for a consumable the player actually owns.
		var hasHealthPack = $.consumableCount( 'consumable_health' ) > 0,
			hasShieldPack = $.consumableCount( 'consumable_shield' ) > 0;
		if( hasHealthPack || hasShieldPack ) {
			var consumableBarY = touchBarY + touchBarHeight + 10,
				consumableBarWidth = 110;
			if( hasHealthPack ) {
				$.buttons.push( new $.Button( {
					x: $.cw / 2 - ( hasShieldPack ? touchBarGap / 2 + consumableBarWidth / 2 : 0 ),
					y: consumableBarY,
					lockedWidth: consumableBarWidth,
					lockedHeight: touchBarHeight,
					scale: 1,
					title: 'HEALTH X' + $.consumableCount( 'consumable_health' ),
					action: function() {
						$.mouse.down = 0;
						$.useConsumable( 'consumable_health', function() {
							$.hero.life = Math.min( 1, $.hero.life + 0.4 );
						} );
						this.title = 'HEALTH X' + $.consumableCount( 'consumable_health' );
					}
				} ) );
			}
			if( hasShieldPack ) {
				$.buttons.push( new $.Button( {
					x: $.cw / 2 + ( hasHealthPack ? touchBarGap / 2 + consumableBarWidth / 2 : 0 ),
					y: consumableBarY,
					lockedWidth: consumableBarWidth,
					lockedHeight: touchBarHeight,
					scale: 1,
					title: 'SHIELD X' + $.consumableCount( 'consumable_shield' ),
					action: function() {
						$.mouse.down = 0;
						$.useConsumable( 'consumable_shield', function() {
							$.powerupTimers[ 5 ] = $.powerupDuration;
						} );
						this.title = 'SHIELD X' + $.consumableCount( 'consumable_shield' );
					}
				} ) );
			}
		}
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

	if( state == 'continueoffer' ) {
		$.mouse.down = 0;
		$.screenshot = $.ctxmg.getImageData( 0, 0, $.cmg.width, $.cmg.height );
		$.continueTick = 0;               // auto-declines after the countdown
		$.continueTickMax = 540;          // ~9 seconds at 60fps

		var coCompact = ( $.ch < 640 ),
			hasRevive = $.consumableCount( 'consumable_revive' ) > 0,
			coCx = $.cw / 2,
			coBtnY = coCompact ? $.ch - 118 : $.ch / 2 + 30;

		if( hasRevive ) {
			// owns a revive: one tap to resurrect and keep the run going
			$.buttons.push( new $.Button( {
				x: coCx, y: coBtnY, lockedWidth: coCompact ? 260 : 320, lockedHeight: coCompact ? 48 : 56,
				scale: coCompact ? 2 : 3, title: 'CONTINUE',
				action: function() { $.mouse.down = 0; $.continueRun(); }
			} ) );
		} else {
			// no revive: upsell a pack or a drone to help them win (opens shop)
			$.buttons.push( new $.Button( {
				x: coCx, y: coBtnY, lockedWidth: coCompact ? 300 : 360, lockedHeight: coCompact ? 44 : 50,
				scale: coCompact ? 1 : 2, title: 'GET REVIVE PACK',
				action: function() { $.mouse.down = 0; $.marketTab = 'boost'; $.setState( 'market' ); }
			} ) );
			$.buttons.push( new $.Button( {
				x: coCx, y: coBtnY + ( coCompact ? 50 : 58 ), lockedWidth: coCompact ? 300 : 360, lockedHeight: coCompact ? 44 : 50,
				scale: coCompact ? 1 : 2, title: 'GET A DRONE',
				action: function() { $.mouse.down = 0; $.marketTab = 'drone'; $.setState( 'market' ); }
			} ) );
		}

		// always an out: end the run and see the score screen
		$.buttons.push( new $.Button( {
			x: coCx, y: coCompact ? $.ch - 34 : ( hasRevive ? coBtnY + 66 : coBtnY + ( coCompact ? 100 : 120 ) ),
			lockedWidth: coCompact ? 200 : 240, lockedHeight: coCompact ? 38 : 44,
			scale: 1, title: 'END RUN',
			action: function() { $.mouse.down = 0; $.setState( 'gameover' ); }
		} ) );
	}

	if( state == 'gameover' ) {
		$.mouse.down = 0;

		$.screenshot = $.ctxmg.getImageData( 0, 0, $.cmg.width, $.cmg.height );

		// short screens (phone landscape) place the buttons side by side
		// at the bottom; fixed tall positions would push them off-screen
		var goCompact = ( $.ch < 640 );

		// the HTML GameOverOverlay owns this screen (blurred panel, no
		// collision). Skip building canvas buttons then - but ALWAYS run the
		// stat/storage bookkeeping below, and dispatch the state at the end.
		if( !window.__htmlGameover ) {

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

		} // end !__htmlGameover button block

		// best-run celebration + daily challenge settle BEFORE the storage
		// update below folds this run into the records
		// daily runs live on their own board and must not touch the endless
		// personal-best records (or fire the NEW PERSONAL BEST banner)
		$.runWasBest = !$.dailyRunActive && $.score > 0 && $.score > ( $.storage['score'] || 0 );
		$.dailyResult = $.dailySettle();

		if( !$.dailyRunActive ) {
			$.storage['score'] = Math.max( $.storage['score'], $.score );
			$.storage['level'] = Math.max( $.storage['level'], $.level.current );
			$.storage['combo'] = Math.max( $.storage['combo'] || 0, $.bestCombo );
		}
		$.storage['rounds'] += 1;
		$.storage['kills'] += $.kills;
		$.storage['bullets'] += $.bulletsFired;
		$.storage['powerups'] += $.powerupsCollected;
		$.storage['time'] += Math.floor( $.elapsed );
		$.updateStorage();

		// run length in seconds (elapsed counts at 60fps), for playtime stats
		$.trackRun( 'run_end', Math.floor( ( $.elapsed * ( 1000 / 60 ) ) / 1000 ) );
		// a daily run posts to the daily board only (never the endless one)
		// and restores the real RNG; everything else submits as normal
		if( $.dailyRunActive ) {
			$.finishDailyRun();
		} else {
			$.submitScore();
		}
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
		s.def.draw( ctx, s.scale, s.drone ? ( s.def.color || 'hsla(190, 60%, 70%, 1)' ) : 'hsla(210, 35%, 72%, 1)', $.tick );
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

		// hand off when done, or let the player tap to skip. A brand-new
		// player is dropped straight into the guide once (auto-onboarding),
		// then everyone lands on the menu.
		if( elapsed >= dur || ( elapsed > 14 && $.mouse.down ) ) {
			$.mouse.down = 0;
			// only a genuinely new player (never started a run AND never seen
			// the guide) gets auto-onboarded - existing players who update go
			// straight to the menu as always
			if( !$.storage['seen'] && !$.storage['guideseen'] ) {
				$.howtoIndex = 0;
				$.howtoOnboarding = 1;
				$.setState( 'howto' );
			} else {
				$.setState( 'menu' );
			}
		}
	};

	$.states['menu'] = function() {


		$.clearScreen();
		$.updateScreen();

		// dormant ships drifting behind the menu for a lively, space feel -
		// drawn BEFORE the hub glass panel/buttons so they stay visible
		// through the panel's translucency, not hidden behind a solid UI
		$.renderAmbientShips();
		// keep the drift animation alive on the menu (play/menu reset tick)
		$.tick += 1;

		// glass container behind the nav rail - translucent so the ambient
		// ships drawn above still show through it, matching the individual
		// rail buttons' own glass look (see button.js renderGlass)
		if( $.navRailPanel ) {
			$.ctxmg.beginPath();
			$.roundRect( $.navRailPanel.x, $.navRailPanel.y, $.navRailPanel.w, $.navRailPanel.h, 16 );
			$.ctxmg.fillStyle = 'hsla(205, 45%, 14%, 0.4)';
			$.ctxmg.fill();
			$.ctxmg.beginPath();
			$.roundRect( $.navRailPanel.x + 0.5, $.navRailPanel.y + 0.5, $.navRailPanel.w - 1, $.navRailPanel.h - 1, 16 );
			$.ctxmg.strokeStyle = 'hsla(190, 60%, 70%, 0.14)';
			$.ctxmg.lineWidth = 1;
			$.ctxmg.stroke();
		}

		var i = $.buttons.length; while( i-- ){ if( $.buttons[ i ] ) { $.buttons[ i ].update( i ) } }
			i = $.buttons.length; while( i-- ){ if( $.buttons[ i ] ) { $.buttons[ i ].render( i ) } }

		/*==============================================================================
		Hub Hero Pilot - the selected pilot, big, on a lit display pad in the
		open space right of the rail/PLAY column. Reuses the hangar's "choose
		your fighter" display language (spotlight, glowing pad, exhaust,
		orbiting drone) at hub scale, plus an idle turntable illusion: a slow
		horizontal squash/stretch that reads as the ship slowly turning to
		show its profile and back - not a real 3D rotation (this engine is
		flat 2D canvas, there's no 3D asset pipeline to drive one), but the
		same trick 2D games have always used to fake one.
		Gracefully skipped whenever there isn't clearly enough open width
		beside the rail to fit it without crowding - same "degrade rather
		than crowd" rule the rest of the responsive menu already follows.
		==============================================================================*/
		var heroCompact = ( $.ch < 640 ),
			// same anchor formula the button-setup step used for PLAY's y,
			// duplicated here on purpose - the per-frame draw already
			// recomputes logoBottomY independently below rather than reading
			// it back from the one-time setup closure
			heroCenterY = heroCompact ? 112 : $.ch / 2 - 110,
			heroRailRight = $.navRailPanel ? ( $.navRailPanel.x + $.navRailPanel.w ) : 0,
			heroPlayRight = $.cw / 2 + Math.min( $.cw - 40, heroCompact ? 420 : 620 ) / 2,
			heroLeftBound = Math.max( heroRailRight, heroPlayRight ) + ( heroCompact ? 30 : 60 ),
			// reserve extra room on the right so the pilot doesn't crowd the
			// docked COMMS chat tab (GameChatWidget.tsx, fixed right-edge,
			// vertically centred - the same band this hero sits in)
			heroAvailW = $.cw - heroLeftBound - ( heroCompact ? 92 : 118 ),
			// radius adapts to whatever room is actually left instead of a
			// fixed size with a hard show/hide cliff - shrinks gracefully on
			// narrower windows rather than popping in and out of existence
			heroR = Math.max( 30, Math.min( heroCompact ? 46 : 78, heroAvailW / 2.3 ) );

		if( heroAvailW > 70 ) {
			var heroDef = $.currentCharacter(),
				heroIndex = $.storage[ 'character' ] || 0,
				heroHue = $.pilotAccentHue( heroIndex ),
				heroShipColor = $.definitions.shipColors[ $.storage[ 'ship' ] || 0 ] || $.definitions.shipColors[ 0 ],
				heroX = heroLeftBound + heroR + Math.min( heroAvailW - heroR * 2, heroCompact ? 30 : 70 ),
				heroY = heroCenterY,
				heroBob = Math.sin( $.tick / 24 ) * ( heroCompact ? 2 : 4 ),
				// turntable illusion: eases through a thin edge-on moment
				// instead of ever fully vanishing, so it never looks glitched
				heroTurn = 0.4 + 0.6 * Math.abs( Math.cos( $.tick / 150 ) ),
				heroPadRx = heroR * 1.7, heroPadRy = heroPadRx * 0.16,
				heroGlowR = heroR * 3.1;

			var heroSpot = $.ctxmg.createRadialGradient( heroX, heroY, 4, heroX, heroY, heroGlowR );
			heroSpot.addColorStop( 0, $.hsla( heroHue, 90, 55, 0.16 ) );
			heroSpot.addColorStop( 1, $.hsla( heroHue, 90, 55, 0 ) );
			$.ctxmg.fillStyle = heroSpot;
			$.ctxmg.fillRect( heroX - heroGlowR, heroY - heroGlowR, heroGlowR * 2, heroGlowR * 2 );

			// glowing display pad beneath the pilot's feet, pulsing rings
			$.ctxmg.save();
			$.ctxmg.translate( heroX, heroY + heroR * 1.05 );
			$.ctxmg.scale( 1, heroPadRy / heroPadRx );
			var heroPadGrad = $.ctxmg.createRadialGradient( 0, 0, 3, 0, 0, heroPadRx );
			heroPadGrad.addColorStop( 0, $.hsla( heroHue, 80, 55, 0.16 ) );
			heroPadGrad.addColorStop( 1, 'hsla(0, 0%, 0%, 0)' );
			$.ctxmg.fillStyle = heroPadGrad;
			$.ctxmg.beginPath(); $.ctxmg.arc( 0, 0, heroPadRx, 0, $.twopi ); $.ctxmg.fill();
			var heroRing = ( ( $.tick / 80 ) % 1 );
			$.ctxmg.beginPath();
			$.ctxmg.arc( 0, 0, heroPadRx * ( 0.4 + heroRing * 0.55 ), 0, $.twopi );
			$.ctxmg.strokeStyle = $.hsla( heroHue, 90, 62, 0.26 * ( 1 - heroRing ) );
			$.ctxmg.lineWidth = 2; $.ctxmg.stroke();
			$.ctxmg.restore();

			// exhaust flicker beneath (nose points up, plume streams down)
			for( var hf = 0; hf < 3; hf++ ) {
				var hfLen = heroR * ( 0.35 + hf * 0.28 + Math.random() * 0.3 );
				$.ctxmg.beginPath();
				$.ctxmg.moveTo( heroX - heroR * 0.13, heroY + heroBob + heroR * 0.5 );
				$.ctxmg.lineTo( heroX, heroY + heroBob + heroR * 0.5 + hfLen );
				$.ctxmg.lineTo( heroX + heroR * 0.13, heroY + heroBob + heroR * 0.5 );
				$.ctxmg.closePath();
				$.ctxmg.fillStyle = $.hsla( 30 - hf * 8, 100, 60 + hf * 10, 0.4 - hf * 0.11 );
				$.ctxmg.fill();
			}

			// the pilot itself: nose up, bobbing, squashed on X to fake a slow
			// turntable spin (a real 3D rotation would need a 3D asset this
			// flat-canvas engine doesn't have - this reads the same at a glance)
			$.ctxmg.save();
			$.ctxmg.translate( heroX, heroY + heroBob );
			$.ctxmg.rotate( -$.pi / 2 );
			$.ctxmg.scale( heroTurn, 1 );
			heroDef.draw( $.ctxmg, heroR, heroShipColor.color, $.tick );
			$.ctxmg.restore();

			// equipped drone orbiting beside the hero, same as the hangar
			var heroDrone = $.equippedDrone && $.equippedDrone();
			if( heroDrone && heroDrone.draw ) {
				var heroDroneR = heroCompact ? 12 : 18,
					heroOrbitR = heroR + ( heroCompact ? 26 : 40 ),
					heroOrbitA = $.tick / 40,
					hdx = heroX + Math.cos( heroOrbitA ) * heroOrbitR,
					hdy = heroY + heroBob + Math.sin( heroOrbitA ) * heroOrbitR * 0.4;
				$.ctxmg.save();
				$.ctxmg.translate( hdx, hdy );
				heroDrone.draw( $.ctxmg, heroDroneR, heroDrone.color || 'hsla(190, 100%, 70%, 0.95)', $.tick );
				$.ctxmg.restore();
			}
		}

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

		// SPACE HUNT cup panel: fits in the gap between the logo and PLAY, so
		// players see the live cup - prize pool + a ticking countdown - before
		// they ever open the board. Only shows while a cup is running.
		if( $.activeSeason ) {
			var seasonY = logoBottomY + ( menuCompact ? 2 : 6 ),
				prizeShort = $.activeSeason.prizeShort || '',
				// prize inline on the headline; keep it short so it fits phones
				prizeTag = ( prizeShort.indexOf( 'USDC' ) >= 0 ) ? ( '  ' + prizeShort.split( ' TO ' )[ 0 ].split( ' PRIZE' )[ 0 ] ) : '',
				// cup name is operator-editable (the active season name)
				headText = ( $.cupLabel ? $.cupLabel() : 'LIVE CUP' ) + ' LIVE' + prizeTag,
				timeLeft = $.cupTimeLeft ? $.cupTimeLeft() : '',
				timeText = timeLeft ? ( 'ENDS IN ' + timeLeft ) : $.activeSeason.prizeShort,
				lineH = 11;

			// widest line drives the panel width (measure without drawing)
			var widest = 0,
				measure = function( t ) {
					var m = $.text( { ctx: $.ctxmg, x: 0, y: 0, text: t, hspacing: 1, vspacing: 1, halign: 'center', valign: 'top', scale: 1, snap: 1, render: 0 } );
					if( m.width > widest ) { widest = m.width; }
				};
			measure( headText ); measure( timeText );

			// subtle gold-tinted panel behind the two lines (fits the gap
			// between the logo and PLAY - two lines, like the old banner)
			var panelW = widest + 28,
				panelH = 2 * lineH + 8,
				panelX = $.cw / 2 - panelW / 2,
				panelY = seasonY - 5;
			$.ctxmg.beginPath();
			$.ctxmg.fillStyle = 'hsla(45, 90%, 55%, 0.07)';
			$.roundRect( panelX, panelY, panelW, panelH, 5 );
			$.ctxmg.fill();
			$.ctxmg.beginPath();
			$.ctxmg.lineWidth = 1;
			$.ctxmg.strokeStyle = 'hsla(45, 100%, 62%, ' + ( 0.45 + Math.sin( $.tick / 20 ) * 0.12 ) + ')';
			$.roundRect( panelX, panelY, panelW, panelH, 5 );
			$.ctxmg.stroke();

			// line 1 - SPACE HUNT LIVE + prize (gold, gentle pulse)
			$.ctxmg.beginPath();
			$.text( { ctx: $.ctxmg, x: $.cw / 2, y: seasonY, text: headText, hspacing: 1, vspacing: 1, halign: 'center', valign: 'top', scale: 1, snap: 1, render: 1 } );
			$.ctxmg.fillStyle = 'hsla(45, 100%, 62%, ' + ( 0.8 + Math.sin( $.tick / 20 ) * 0.2 ) + ')';
			$.ctxmg.fill();
			// line 2 - live countdown (cyan, ticks every frame)
			$.ctxmg.beginPath();
			$.text( { ctx: $.ctxmg, x: $.cw / 2, y: seasonY + lineH, text: timeText, hspacing: 1, vspacing: 1, halign: 'center', valign: 'top', scale: 1, snap: 1, render: 1 } );
			$.ctxmg.fillStyle = timeLeft ? 'hsla(190, 90%, 62%, 0.92)' : 'hsla(0, 0%, 100%, 0.7)';
			$.ctxmg.fill();
		}

		// the menu grew a row (DAILY RUN), so anchor the footer lines to the
		// actual bottom of the button stack instead of fixed offsets, which
		// would otherwise collide with SETTINGS on some heights
		var menuBottomY = 0;
		for( var mb = 0; mb < $.buttons.length; mb++ ) {
			var mbtn = $.buttons[ mb ];
			if( mbtn ) {
				var mbe = mbtn.y + ( ( mbtn.lockedHeight || 0 ) / 2 );
				if( mbe > menuBottomY ) { menuBottomY = mbe; }
			}
		}

		// daily challenge: one shared goal per day, streak-scaled bonus XP
		if( $.dailyChallenge ) {
			var daily = $.dailyChallenge(),
				dailyDone = $.dailyDone(),
				dailyStreak = $.dailyStreak(),
				streakTag = dailyStreak >= 2 ? '  ' + dailyStreak + ' DAY STREAK' : '',
				dailyText = dailyDone
					? 'DAILY CHALLENGE COMPLETE  +' + $.dailyNextXp() + ' XP EARNED' + streakTag
					: 'DAILY: ' + daily.text + '  +' + $.dailyNextXp() + ' XP' + streakTag,
				// compact mode used to park this at a bare y=4 since nothing
				// else rendered up there; the new HTML top status bar
				// (GameOverlays.tsx) now claims that strip, so clear it
				dailyY = menuCompact ? ( $.safeAreaTop + 40 ) : menuBottomY + 16;
			$.ctxmg.beginPath();
			$.text( {
				ctx: $.ctxmg, x: $.cw / 2, y: dailyY,
				text: dailyText,
				hspacing: 1, vspacing: 1, halign: 'center', valign: 'top',
				scale: 1, snap: 1, render: 1
			} );
			$.ctxmg.fillStyle = dailyDone ? 'hsla(150, 100%, 60%, 0.8)' : 'hsla(190, 100%, 70%, 0.8)';
			$.ctxmg.fill();
		}

		// one-time "you won a tournament reward" congratulation strip
		if( $.celebration ) {
			var celTick = $.tick - $.celebrationStart,
				// same top-bar clearance as the daily-challenge line above
				celY = menuCompact ? ( $.safeAreaTop + 40 ) : 30;
			$.ctxmg.beginPath();
			$.text( {
				ctx: $.ctxmg, x: $.cw / 2, y: celY,
				text: 'YOU WON ' + $.celebration.title,
				hspacing: 2, vspacing: 1, halign: 'center', valign: 'top',
				scale: menuCompact ? 1 : 2, snap: 1, render: 1
			} );
			$.ctxmg.fillStyle = 'hsla(45, 100%, 60%, ' + ( 0.7 + Math.sin( $.tick / 12 ) * 0.3 ) + ')';
			$.ctxmg.fill();
			$.ctxmg.beginPath();
			$.text( {
				ctx: $.ctxmg, x: $.cw / 2, y: celY + ( menuCompact ? 10 : 18 ),
				text: 'TOURNAMENT REWARD UNLOCKED, EQUIP IT IN THE HANGAR',
				hspacing: 1, vspacing: 1, halign: 'center', valign: 'top',
				scale: 1, snap: 1, render: 1
			} );
			$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.7)';
			$.ctxmg.fill();
			// after ~9s of display, mark it seen so it never nags again
			if( celTick > 540 ) {
				$.markRewardSeen( $.celebration.id );
				$.celebration = null;
			}
		}

		if( !menuCompact ) {
			$.ctxmg.beginPath();
			var bottomInfo = $.text( {
				ctx: $.ctxmg,
				x: $.cw / 2,
				y: menuBottomY + 32,
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
	// A flavour class per pilot for the character-select tier badge. Founders
	// and premium pilots get their own labels; the rest ladder up by roster
	// position so the roll call reads like a ranked lineup.
	$.pilotTier = function( def, index ) {
		if( def.ability && def.ability.title === 'FOUNDER' ) { return { label: 'FOUNDER', hue: 45 }; }
		if( ( def.desc || '' ).indexOf( 'PREMIUM' ) >= 0 ) { return { label: 'PREMIUM', hue: 285 }; }
		var tiers = [ { label: 'CADET', hue: 190 }, { label: 'PILOT', hue: 150 }, { label: 'ELITE', hue: 210 }, { label: 'ACE', hue: 30 }, { label: 'LEGEND', hue: 0 } ];
		return tiers[ Math.min( tiers.length - 1, Math.floor( index / 2 ) ) ];
	};

	// A small bordered pill (bitmap font) centered at cy, coloured by tier.
	$.drawTierBadge = function( def, index, cy, compact ) {
		var tier = $.pilotTier( def, index ),
			scale = compact ? 1 : 2,
			m = $.text( { ctx: $.ctxmg, x: 0, y: 0, text: tier.label, hspacing: 1, vspacing: 0, halign: 'left', valign: 'top', scale: scale, snap: 1, render: 0 } ),
			padX = compact ? 10 : 14, padY = compact ? 5 : 7,
			w = m.width + padX * 2, h = m.height + padY * 2,
			x = Math.floor( $.cw / 2 - w / 2 ), y = Math.floor( cy - h / 2 );
		$.ctxmg.fillStyle = $.hsla( tier.hue, 80, 50, 0.14 );
		$.ctxmg.fillRect( x, y, w, h );
		$.ctxmg.strokeStyle = $.hsla( tier.hue, 85, 62, 0.7 );
		$.ctxmg.lineWidth = 1.5;
		$.ctxmg.strokeRect( x + 0.5, y + 0.5, w - 1, h - 1 );
		$.ctxmg.beginPath();
		$.text( { ctx: $.ctxmg, x: $.cw / 2, y: cy, text: tier.label, hspacing: 1, vspacing: 0, halign: 'center', valign: 'center', scale: scale, snap: 1, render: 1 } );
		$.ctxmg.fillStyle = $.hsla( tier.hue, 90, 74, 1 );
		$.ctxmg.fill();
	};

	// Each pilot gets a signature accent hue so scrolling the roster feels
	// like flipping through distinct fighters, not recolors of one ship.
	$.pilotAccentHue = function( index ) {
		var pal = [ 205, 45, 160, 285, 15, 190, 120, 330, 260, 55, 95, 300 ];
		return pal[ index % pal.length ];
	};

	// Derive a 0..1 stat readout from a pilot's real tuning numbers, for the
	// character-select stat bars (SPD / FIRE / ARM / DASH).
	$.pilotStats = function( def ) {
		var ab = def.ability || {},
			fp = 1 + ( ( ab.damage || 1 ) - 1 ) + ( ( ab.bulletSpeed || 1 ) - 1 ) +
				( 1 - ( ab.fireRate || 1 ) ) + ( ( ab.combo || 1 ) - 1 ) * 0.4,
			clamp = function( v, lo, hi ) { v = ( v - lo ) / ( hi - lo ); return v < 0 ? 0 : ( v > 1 ? 1 : v ); };
		return {
			SPD: clamp( def.speedMult || 1, 0.75, 1.32 ),
			FIRE: clamp( fp, 0.92, 1.4 ),
			ARM: clamp( 1.5 - ( def.damageTakenMult || 1 ), 0.15, 0.84 ),
			DASH: clamp( 1.42 - ( def.dashCooldownMult || 1 ), 0.07, 0.72 )
		};
	};

	// Draw the four stat bars centered at cw/2, starting at topY. Uses the
	// pilot's accent hue for the fill so the panel matches the hero ship.
	$.drawPilotStats = function( def, topY, compact ) {
		var stats = $.pilotStats( def ),
			order = [ [ 'SPD', stats.SPD ], [ 'FIRE', stats.FIRE ], [ 'ARM', stats.ARM ], [ 'DASH', stats.DASH ] ],
			accentHue = $.pilotAccentHue( $.hangarIndex ),
			panelW = compact ? 250 : 320,
			labelW = compact ? 58 : 74,
			rowH = compact ? 12 : 16,
			barH = compact ? 6 : 8,
			x0 = Math.floor( $.cw / 2 - panelW / 2 ),
			barX = x0 + labelW,
			barW = panelW - labelW;
		for( var s = 0; s < order.length; s++ ) {
			var ry = topY + s * rowH,
				cy = ry + rowH / 2;
			$.ctxmg.beginPath();
			$.text( { ctx: $.ctxmg, x: x0, y: cy, text: order[ s ][ 0 ], hspacing: 1, vspacing: 0, halign: 'left', valign: 'center', scale: 1, snap: 1, render: 1 } );
			$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.55)';
			$.ctxmg.fill();
			$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.09)';
			$.ctxmg.fillRect( barX, cy - barH / 2, barW, barH );
			$.ctxmg.fillStyle = $.hsla( accentHue, 90, 60, 0.9 );
			$.ctxmg.fillRect( barX, cy - barH / 2, Math.max( 2, Math.round( barW * order[ s ][ 1 ] ) ), barH );
		}
	};

	$.hangarPreviewLayout = function( def, hangarCompact, previewY ) {
		var unlocked = $.characterUnlocked( def ),
			status = $.characterStatus( def ),
			gap = hangarCompact ? 4 : 10,
			blocks = [],
			// extra headroom below the ship so the bigger hero ship + display
			// pad clear the name line on every screen
			y = previewY + ( hangarCompact ? 28 : 60 );

		var add = function( text, scale, vspacing, color ) {
			var measured = $.text( {
				ctx: $.ctxmg, x: 0, y: 0, text: text,
				hspacing: 1, vspacing: vspacing,
				halign: 'left', valign: 'top', scale: scale, snap: 1, render: 0
			} );
			blocks.push( { text: text, scale: scale, vspacing: vspacing, color: color, y: y } );
			y += measured.height + gap;
		};

		// tier badge sits just under the ship, above the pilot name
		var badgeH = hangarCompact ? 20 : 28;
		blocks.push( { badge: true, y: y + badgeH / 2, height: badgeH } );
		y += badgeH + gap;

		add( def.title, hangarCompact ? 2 : 3, 1, unlocked ? 'hsla(0, 0%, 100%, 0.95)' : 'hsla(0, 0%, 100%, 0.4)' );
		add( status.text, hangarCompact ? 1 : 2, 8, status.color );
		if( def.ability ) {
			add( def.ability.title + ': ' + def.ability.text, hangarCompact ? 1 : 2, 8, 'hsla(190, 100%, 70%, 0.8)' );
		}
		// stat bars block - reserves its own measured height so the SELECT /
		// COLOR / TRAIL control rows stack cleanly beneath it. DESKTOP ONLY:
		// short landscape-mobile has no room for four bars without pushing the
		// control rows off-screen, so compact skips them (the ship, tier badge,
		// name + ability still carry the pilot's identity there).
		if( !hangarCompact ) {
			var statsHeight = 16 * 4 + 6;
			blocks.push( { stats: true, y: y, height: statsHeight } );
			y += statsHeight + gap;
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
			previewY = hangarCompact ? Math.floor( $.ch * 0.28 ) : Math.floor( $.ch * 0.38 ),
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

		// HERO DISPLAY PAD: the selected pilot on a lit turntable - a spotlight
		// glow, a glowing floor disc with pulsing rings, engine exhaust, and a
		// big bobbing ship in the pilot's signature accent. Turns the pick
		// screen into a "choose your fighter" moment. Fully responsive.
		var unlocked = $.characterUnlocked( def );
		var hangarShipColor = $.definitions.shipColors[ $.storage[ 'ship' ] || 0 ] || $.definitions.shipColors[ 0 ];
		var accentHue = $.pilotAccentHue( $.hangarIndex ),
			shipR = hangarCompact ? 20 : 38,
			bob = Math.sin( $.tick / 24 ) * ( hangarCompact ? 2 : 4 ),
			padY = previewY + ( hangarCompact ? 14 : 32 ),
			padRx = hangarCompact ? 88 : 138,
			padRy = hangarCompact ? 11 : 22,
			glowR = hangarCompact ? 150 : 230;

		// cinematic swap (set on PREV/NEXT): the incoming ship slides + spins
		// in and the spotlight flares, then everything settles as t -> 0
		var anim = $.hangarAnim || { t: 0, dir: 1 },
			ease = anim.t * anim.t,
			slideX = anim.dir * ease * ( hangarCompact ? 130 : 210 ),
			spin = anim.dir * ease * $.twopi * 0.5;

		// overhead spotlight wash (flares brighter mid-swap)
		var spot = $.ctxmg.createRadialGradient( $.cw / 2, previewY, 6, $.cw / 2, previewY, glowR );
		spot.addColorStop( 0, $.hsla( accentHue, 90, 55, ( unlocked ? 0.20 : 0.08 ) + ease * 0.22 ) );
		spot.addColorStop( 1, $.hsla( accentHue, 90, 55, 0 ) );
		$.ctxmg.fillStyle = spot;
		$.ctxmg.fillRect( $.cw / 2 - glowR, previewY - glowR, glowR * 2, glowR * 2 );

		// display pad: a flattened glowing disc with a rim and pulsing rings
		$.ctxmg.save();
		$.ctxmg.translate( $.cw / 2, padY );
		$.ctxmg.scale( 1, padRy / padRx );
		var pg = $.ctxmg.createRadialGradient( 0, 0, 4, 0, 0, padRx );
		pg.addColorStop( 0, $.hsla( accentHue, 80, 55, 0.18 ) );
		pg.addColorStop( 0.7, $.hsla( accentHue, 80, 45, 0.05 ) );
		pg.addColorStop( 1, 'hsla(0, 0%, 0%, 0)' );
		$.ctxmg.fillStyle = pg;
		$.ctxmg.beginPath(); $.ctxmg.arc( 0, 0, padRx, 0, $.twopi ); $.ctxmg.fill();
		for( var ring = 0; ring < 2; ring++ ) {
			var rp = ( ( $.tick / 70 + ring * 0.5 ) % 1 );
			$.ctxmg.beginPath();
			$.ctxmg.arc( 0, 0, padRx * ( 0.35 + rp * 0.62 ), 0, $.twopi );
			$.ctxmg.strokeStyle = $.hsla( accentHue, 90, 62, 0.28 * ( 1 - rp ) );
			$.ctxmg.lineWidth = 2; $.ctxmg.stroke();
		}
		$.ctxmg.beginPath(); $.ctxmg.arc( 0, 0, padRx * 0.9, 0, $.twopi );
		$.ctxmg.strokeStyle = $.hsla( accentHue, 80, 60, 0.32 ); $.ctxmg.lineWidth = 1.5; $.ctxmg.stroke();
		$.ctxmg.restore();

		// engine exhaust flickering beneath the hovering ship (nose points up,
		// so the plume streams downward toward the pad)
		if( unlocked && ease < 0.2 ) {
			var exX = $.cw / 2 + slideX,
				exY = previewY + bob + shipR * 0.5;
			for( var fl = 0; fl < 3; fl++ ) {
				var flLen = shipR * ( 0.5 + fl * 0.35 + Math.random() * 0.4 );
				$.ctxmg.beginPath();
				$.ctxmg.moveTo( exX - shipR * 0.17, exY );
				$.ctxmg.lineTo( exX, exY + flLen );
				$.ctxmg.lineTo( exX + shipR * 0.17, exY );
				$.ctxmg.closePath();
				$.ctxmg.fillStyle = $.hsla( 30 - fl * 8, 100, 60 + fl * 10, 0.5 - fl * 0.13 );
				$.ctxmg.fill();
			}
		}

		// the hero ship itself, bobbing on the pad, tinted with the equipped
		// skin - during a swap it slides in from the side and spins to rest
		$.ctxmg.save();
		$.ctxmg.translate( $.cw / 2 + slideX, previewY + bob );
		$.ctxmg.rotate( -$.pi / 2 + spin );
		def.draw( $.ctxmg, shipR, unlocked ? hangarShipColor.color : 'hsla(0, 0%, 35%, 1)', $.tick );
		$.ctxmg.restore();

		// settle the swap animation one step per frame
		if( $.hangarAnim && $.hangarAnim.t > 0 ) {
			$.hangarAnim.t = Math.max( 0, $.hangarAnim.t - 0.05 );
		}

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
			hangarDrone.draw( $.ctxmg, hangarCompact ? 9 : 12, hangarDrone.color || 'hsla(190, 100%, 70%, 0.95)', $.tick );
			$.ctxmg.restore();
		}

		var previewLayout = $.hangarPreviewLayout( def, hangarCompact, previewY );
		for( var pli = 0; pli < previewLayout.blocks.length; pli++ ) {
			var block = previewLayout.blocks[ pli ];
			if( block.badge ) {
				$.drawTierBadge( def, $.hangarIndex, block.y, hangarCompact );
				continue;
			}
			if( block.stats ) {
				$.drawPilotStats( def, block.y, hangarCompact );
				continue;
			}
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

		// roster position counter - desktop only; on short compact screens the
		// hero ship is raised into this band, so the counter is dropped to keep
		// it clear (PREV/NEXT already make position obvious)
		if( !hangarCompact ) {
			$.ctxmg.beginPath();
			$.text( {
				ctx: $.ctxmg,
				x: $.cw / 2,
				y: hangarTitle.ey + 16,
				text: ( $.hangarIndex + 1 ) + ' / ' + $.definitions.characters.length,
				hspacing: 1,
				vspacing: 1,
				halign: 'center',
				valign: 'top',
				scale: 2,
				snap: 1,
				render: 1
			} );
			$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.35)';
			$.ctxmg.fill();
		}

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

		// HTML SettingsOverlay owns this screen - nothing to draw underneath
		if( window.__htmlSettings ) { return; }

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

		// HTML BoardOverlay owns this screen - nothing to draw underneath
		if( window.__htmlBoard ) { return; }

		var boardCompact = ( $.ch < 640 );
		$.ctxmg.beginPath();
		var boardTitle = $.text( {
			ctx: $.ctxmg,
			x: $.cw / 2,
			y: boardCompact ? 60 : 110,
			text: ( $.boardTab === 'cup' ) ? $.cupLabel() : 'SHOOTERBOARD',
			hspacing: 2,
			vspacing: 1,
			halign: 'center',
			valign: 'bottom',
			// shrink the title a notch for longer cup names so they fit the width
			scale: ( $.boardTab === 'cup' && $.cupLabel().length > 11 )
				? ( boardCompact ? 3 : 5 )
				: ( boardCompact ? 4 : 7 ),
			snap: 1,
			render: 1
		} );
		var gradient = $.ctxmg.createLinearGradient( boardTitle.sx, boardTitle.sy, boardTitle.sx, boardTitle.ey );
		if( $.boardTab === 'cup' ) {
			gradient.addColorStop( 0, '#fff' );
			gradient.addColorStop( 1, '#fc6' );
		} else {
			gradient.addColorStop( 0, '#fff' );
			gradient.addColorStop( 1, '#999' );
		}
		$.ctxmg.fillStyle = gradient;
		$.ctxmg.fill();

		// active tournament strip above the title - the board is where the
		// competition happens, so the stakes belong right here
		if( $.activeSeason ) {
			$.ctxmg.beginPath();
			$.text( {
				ctx: $.ctxmg, x: $.cw / 2, y: boardCompact ? 10 : 16,
				text: $.activeSeason.title + '  ' + $.activeSeason.prizeLine,
				hspacing: 1, vspacing: 1, halign: 'center', valign: 'top',
				scale: 1, snap: 1, render: 1
			} );
			$.ctxmg.fillStyle = 'hsla(45, 100%, 60%, 0.9)';
			$.ctxmg.fill();
		}

		/*==============================================================================
		Your Tier banner (from local best score - works without a wallet)
		==============================================================================*/
		// when a cup is live the board shows a tab lane just under the title;
		// push the banners and rows down so nothing lands on the toggle
		var laneOffset = $.cupLive() ? ( boardCompact ? 34 : 48 ) : 0;
		var myBest = $.storage['score'] || 0,
			myTier = $.tierFor( myBest ),
			tierY = boardTitle.ey + ( boardCompact ? 12 : 22 ) + laneOffset;
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
		var myIndexTop = $.findMyEntryIndex( $.board.entries );
		if( !$.board.loading && !$.board.error && $.board.entries.length ) {
			var rankY = tierY + ( boardCompact ? 36 : 48 ),
				rankText = ( myIndexTop >= 0 )
					? 'YOU  RANK ' + ( myIndexTop + 1 ) + ' OF ' + ( $.board.total || $.board.entries.length ) + '  ' + $.util.commas( $.board.entries[ myIndexTop ].score )
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
			statusText = ( $.boardTab === 'cup' ) ? ( $.cupLabel() + ' NOT STARTED  /  PLAY TO ENTER' ) : 'NO PILOTS RANKED YET';
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
			var rowCount = Math.min( $.board.entries.length, 250 ),
				narrow = ( $.cw < 480 ),
				columns = narrow ? 1 : 2,
				rowScale = ( boardCompact || narrow ) ? 1 : 2,
				perColumn = Math.ceil( rowCount / columns ),
				// pushed down to clear the YOUR-TIER and YOU-RANK banners
					rowStartY = boardTitle.ey + ( boardCompact ? 70 : 104 ) + laneOffset,
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
			// resolve the player's own row once (identity-desync resilient), then
			// match rows by index so highlight + JUMP TO ME agree with the banner
			var mineIndex = $.findMyEntryIndex( $.board.entries );

			// CUP board only: what each rank is currently earning, straight from
			// the live season's prize table. Drives the payout-row treatment
			// below (green $ amount, gold #1 glow) without touching the
			// ALL-TIME board, which stays a pure skill/score list.
			var cupBoard = ( $.boardTab === 'cup' );

			for( var ri = 0; ri < rowCount; ri++ ) {
				var entry = $.board.entries[ ri ],
					mine = ( ri === mineIndex ),
					medal = ( ri < 3 ) ? medalColors[ ri ] : null,
					rowColor = mine ? 'hsla(45, 100%, 70%, 1)' : ( medal ? medal : 'hsla(0, 0%, 100%, 0.65)' ),
					// wallet-verified players carry a badge glyph after their name
					verifiedBadge = entry.verified ? ' \x01' : '',
					col = ( ri < perColumn ) ? 0 : 1,
					row = ( ri < perColumn ) ? ri : ri - perColumn,
					leftX = ( col === 0 ) ? col0Left : col1Left,
					rightX = ( col === 0 ) ? col0Right : col1Right,
					rowY = rowStartY + row * rowSpacing - $.scroll.y,
					prizeUsd = cupBoard ? $.prizeForRank( ri + 1 ) : 0,
					goldRow = ( cupBoard && ri === 0 && prizeUsd > 0 );

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

				// cup rank #1: a pulsing gold glow so the current cup leader
				// reads as "real money is being won right now" - stacks fine
				// with the "mine" highlight above since both use the same hue
				if( goldRow ) {
					var goldPulse = 0.14 + Math.sin( $.tick / 20 ) * 0.06;
					$.ctxmg.beginPath();
					$.roundRect( leftX - 8, rowY - 3, ( rightX - leftX ) + 16, rowSpacing - 2, 4 );
					$.ctxmg.fillStyle = 'hsla(45, 100%, 60%, ' + goldPulse + ')';
					$.ctxmg.fill();
					$.ctxmg.beginPath();
					$.roundRect( leftX - 8, rowY - 3, ( rightX - leftX ) + 16, rowSpacing - 2, 4 );
					$.ctxmg.strokeStyle = 'hsla(45, 100%, 65%, 0.5)';
					$.ctxmg.lineWidth = 1;
					$.ctxmg.stroke();
				}

				// small medal dot for the podium ranks (all-time board), or on
				// the cup board a tiny pilot glyph in the player's own colour
				// when their run carried known cosmetics - same gutter slot,
				// gracefully skipped when the entry has no cosmetics on file
				var gutterX = leftX - ( boardCompact ? 8 : 12 ),
					gutterY = rowY + rowSpacing / 2 - 4,
					pilotDef = cupBoard && entry.cosmetics ? $.characterById( entry.cosmetics.pilotId ) : undefined;
				if( pilotDef ) {
					var glyphColor = entry.cosmetics.shipColor || medal || rowColor,
						glyphR = boardCompact ? 4 : 5.5;
					$.ctxmg.save();
					$.ctxmg.translate( gutterX, gutterY );
					$.ctxmg.rotate( -$.pi / 2 );
					pilotDef.draw( $.ctxmg, glyphR, glyphColor, $.tick );
					$.ctxmg.restore();
				} else if( medal ) {
					$.util.fillCircle( $.ctxmg, gutterX, gutterY, boardCompact ? 3 : 4, medal );
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
				$.ctxmg.fillStyle = goldRow ? 'hsla(45, 100%, 75%, 1)' : rowColor;
				$.ctxmg.fill();

				$.ctxmg.beginPath();
				$.text( {
					ctx: $.ctxmg,
					x: rightX,
					y: rowY,
					// cup rows with a prize show what that rank is earning right
					// now instead of the raw score - the payout IS the metric
					// that matters on this board; every other row (and the
					// entire all-time board) keeps showing score as always
					text: prizeUsd > 0 ? ( '+$' + $.util.commas( prizeUsd ) ) : $.util.commas( entry.score ),
					hspacing: 1,
					vspacing: 1,
					halign: 'right',
					valign: 'top',
					scale: rowScale,
					snap: 1,
					render: 1
				} );
				// prize amounts render in green (a real earning), otherwise
				// each player's score is shown in their tier colour as before
				$.ctxmg.fillStyle = prizeUsd > 0 ? 'hsla(152, 70%, 55%, 1)' : $.tierFor( entry.score ).color;
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

	$.states['playmode'] = function() {
		$.clearScreen();
		var pmC = ( $.ch < 640 );
		// title
		$.ctxmg.beginPath();
		var pmTitle = $.text( { ctx: $.ctxmg, x: $.cw / 2, y: pmC ? 60 : 120, text: 'CHOOSE YOUR RUN', hspacing: 2, vspacing: 1, halign: 'center', valign: 'bottom', scale: pmC ? 3 : 5, snap: 1, render: 1 } );
		var pmGrad = $.ctxmg.createLinearGradient( pmTitle.sx, pmTitle.sy, pmTitle.sx, pmTitle.ey );
		pmGrad.addColorStop( 0, '#fff' ); pmGrad.addColorStop( 1, '#8ad' );
		$.ctxmg.fillStyle = pmGrad; $.ctxmg.fill();
		// what each mode means, in one line each
		$.ctxmg.beginPath();
		$.text( { ctx: $.ctxmg, x: $.cw / 2, y: pmTitle.ey + ( pmC ? 10 : 18 ), text: 'ENDLESS RANKS ON THE SHOOTERBOARD  /  DAILY IS ONE SEEDED SHOT, SAME FOR EVERYONE', hspacing: 1, vspacing: 1, halign: 'center', valign: 'top', scale: 1, snap: 1, render: 1 } );
		$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.5)'; $.ctxmg.fill();

		var i = $.buttons.length; while( i-- ){ if( $.buttons[ i ] ) { $.buttons[ i ].update( i ) } }
			i = $.buttons.length; while( i-- ){ if( $.buttons[ i ] ) { $.buttons[ i ].render( i ) } }
	};

	$.states['dailyrun'] = function() {
		$.clearScreen();
		var drCompact = ( $.ch < 640 );
		$.ctxmg.beginPath();
		var drTitle = $.text( { ctx: $.ctxmg, x: $.cw / 2, y: drCompact ? 50 : 96, text: 'DAILY RUN', hspacing: 2, vspacing: 1, halign: 'center', valign: 'bottom', scale: drCompact ? 4 : 7, snap: 1, render: 1 } );
		var drGrad = $.ctxmg.createLinearGradient( drTitle.sx, drTitle.sy, drTitle.sx, drTitle.ey );
		drGrad.addColorStop( 0, '#fff' ); drGrad.addColorStop( 1, '#8ad' );
		$.ctxmg.fillStyle = drGrad; $.ctxmg.fill();
		$.ctxmg.beginPath();
		$.text( { ctx: $.ctxmg, x: $.cw / 2, y: drTitle.ey + ( drCompact ? 8 : 14 ), text: 'SAME WAVES FOR EVERYONE TODAY  /  ONE ATTEMPT  /  RESETS DAILY', hspacing: 1, vspacing: 1, halign: 'center', valign: 'top', scale: 1, snap: 1, render: 1 } );
		$.ctxmg.fillStyle = 'hsla(190, 100%, 75%, 0.7)'; $.ctxmg.fill();
		var infoY = drTitle.ey + ( drCompact ? 24 : 40 );
		if( $.dailyRunResult ) {
			var rr = $.dailyRunResult,
				rtxt = rr.state === 'sending' ? 'SUBMITTING YOUR RUN' : rr.state === 'error' ? 'SUBMISSION FAILED' : ( 'YOUR RUN  ' + $.util.commas( rr.score ) + ( rr.rank ? '  RANK ' + rr.rank : '' ) );
			$.ctxmg.beginPath();
			$.text( { ctx: $.ctxmg, x: $.cw / 2, y: infoY, text: rtxt, hspacing: 1, vspacing: 1, halign: 'center', valign: 'top', scale: drCompact ? 1 : 2, snap: 1, render: 1 } );
			$.ctxmg.fillStyle = 'hsla(45, 100%, 65%, 1)'; $.ctxmg.fill();
			infoY += drCompact ? 16 : 26;
		} else if( $.dailyRunPlayedToday() ) {
			$.ctxmg.beginPath();
			$.text( { ctx: $.ctxmg, x: $.cw / 2, y: infoY, text: 'YOU HAVE PLAYED TODAY  /  COME BACK TOMORROW', hspacing: 1, vspacing: 1, halign: 'center', valign: 'top', scale: 1, snap: 1, render: 1 } );
			$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.55)'; $.ctxmg.fill();
			infoY += drCompact ? 14 : 22;
		}
		var listTop = infoY + ( drCompact ? 20 : 34 ),
			rowH = drCompact ? 18 : 22,
			maxRows = Math.min( $.dailyBoard.entries.length, Math.floor( ( $.ch - 120 - listTop ) / rowH ) );
		if( $.dailyBoard.loading && !$.dailyBoard.fetched ) {
			$.ctxmg.beginPath();
			$.text( { ctx: $.ctxmg, x: $.cw / 2, y: listTop + 20, text: 'LOADING TODAYS BOARD', hspacing: 1, vspacing: 1, halign: 'center', valign: 'top', scale: 1, snap: 1, render: 1 } );
			$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.4)'; $.ctxmg.fill();
		} else if( $.dailyBoard.entries.length === 0 ) {
			$.ctxmg.beginPath();
			$.text( { ctx: $.ctxmg, x: $.cw / 2, y: listTop + 20, text: 'NO RUNS YET TODAY  /  BE THE FIRST', hspacing: 1, vspacing: 1, halign: 'center', valign: 'top', scale: drCompact ? 1 : 2, snap: 1, render: 1 } );
			$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.4)'; $.ctxmg.fill();
		} else {
			$.ctxmg.beginPath();
			$.text( { ctx: $.ctxmg, x: $.cw / 2, y: listTop - ( drCompact ? 14 : 18 ), text: 'TODAY  ' + $.dailyBoard.total + ' PILOT' + ( $.dailyBoard.total === 1 ? '' : 'S' ), hspacing: 1, vspacing: 1, halign: 'center', valign: 'top', scale: 1, snap: 1, render: 1 } );
			$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.35)'; $.ctxmg.fill();
			for( var r = 0; r < maxRows; r++ ) {
				var e = $.dailyBoard.entries[ r ],
					y = listTop + r * rowH,
					nm = ( e.name || ( e.identity && e.identity.indexOf( '0x' ) === 0 ? ( e.identity.slice( 0, 6 ) + '..' + e.identity.slice( -4 ) ) : 'GUEST' ) ).toUpperCase(),
					medal = ( r === 0 ? '01 ' : r === 1 ? '02 ' : r === 2 ? '03 ' : ( ( r + 1 ) + ' ' ) );
				$.ctxmg.beginPath();
				$.text( { ctx: $.ctxmg, x: $.cw / 2 - ( drCompact ? 150 : 230 ), y: y, text: medal + nm, hspacing: 1, vspacing: 1, halign: 'left', valign: 'top', scale: 1, snap: 1, render: 1 } );
				$.ctxmg.fillStyle = ( r < 3 ) ? 'hsla(45, 100%, 65%, 0.95)' : 'hsla(0, 0%, 100%, 0.7)'; $.ctxmg.fill();
				$.ctxmg.beginPath();
				$.text( { ctx: $.ctxmg, x: $.cw / 2 + ( drCompact ? 150 : 230 ), y: y, text: $.util.commas( e.score ), hspacing: 1, vspacing: 1, halign: 'right', valign: 'top', scale: 1, snap: 1, render: 1 } );
				$.ctxmg.fillStyle = ( r < 3 ) ? 'hsla(45, 100%, 65%, 0.95)' : 'hsla(0, 0%, 100%, 0.7)'; $.ctxmg.fill();
			}
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
						drone.draw( $.ctxmg, r * 0.3, drone.color || 'hsla(190, 100%, 70%, 1)', $.tick );
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

	// Whether a mid-run "continue" (resurrect) can be offered on death: once
	// per run, only when the run scored something, and not during a seeded
	// Daily Run (one fair attempt). Continuing spends a revive and marks the
	// run assisted (recorded for operator audit), but the run still ranks -
	// only ONE revive per run keeps the score lever bounded.
	$.continueEligible = function() {
		return !$.continueUsedThisRun && !$.dailyRunActive && ( $.score | 0 ) > 0;
	};

	// Resurrect the current run: spend one revive, restore 40 PCT HP + a beat of
	// invulnerability, and drop back into play with the world intact.
	$.continueRun = function() {
		if( $.continueUsedThisRun ) { return; }
		var ok = $.useConsumable( 'consumable_revive', function() {
			$.hero.life = 0.4;
			$.powerupTimers[ 5 ] = $.powerupDuration;
		} );
		if( !ok ) { return; }
		$.continueUsedThisRun = 1;
		// clear the death state so a later death still ends the run normally
		$.gameoverExplosion = 0;
		$.gameoverTick = 0;
		$.audio.play( 'levelup' );
		$.setState( 'play' );
	};

	$.states['play'] = function() {
		$.updateDelta();
		// hitstop: hold the world for a beat after a big impact (render still runs)
		// decrement by the REAL frame delta (updateDelta just computed it),
		// not 1 per frame - otherwise hitstop halves at 120hz / doubles on
		// slow devices. The world still freezes via $.dt = 0 afterward.
		if( $.hitstop > 0 ) { $.hitstop -= $.dt; $.dt = 0; }
		$.updateScreen();
		$.updateCombo();
		$.updateLevel();
		$.updateHazards();
		$.updateProps();
		$.updateBillboards();
		$.updatePowerupTimers();
		$.spawnEnemies();

		// re-read the pilot/combat state and re-roll the enemy tactic once
		// the current read has run its course
		$.enemyIntel.tick += $.dt;
		if( $.enemyIntel.tick >= $.enemyIntel.nextRoll ) {
			$.rollEnemyIntel();
		}
		$.enemyOffsetMod += ( $.slow ) ? $.dt / 3 : $.dt;

		// update entities
		var i = $.enemies.length; while( i-- ){ $.enemies[ i ].update( i ) }
			i = $.explosions.length; while( i-- ){ $.explosions[ i ].update( i ) }
			i = $.powerups.length; while( i-- ){ $.powerups[ i ].update( i ) }
			i = $.particleEmitters.length; while( i-- ){ $.particleEmitters[ i ].update( i ) }
			i = $.textPops.length; while( i-- ){ $.textPops[ i ].update( i ) }
			i = $.levelPops.length; while( i-- ){ $.levelPops[ i ].update( i ) }
			// broad-phase grid built AFTER enemies moved, right before the
			// bullets that consume it - keeps bullet collision near-O(1) per
			// bullet however packed the arena gets
			$.buildEnemyGrid();
			i = $.bullets.length; while( i-- ){ $.bullets[ i ].update( i ) }
		$.hero.update();

		// render entities
		$.clearScreen();
		$.ctxmg.save();
		$.ctxmg.translate( $.screen.x - $.rumble.x, $.screen.y - $.rumble.y );
		$.renderBillboards();
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
		$.renderOffscreenArrows();
		$.renderLowHpWarning();

		// daily challenge: detect the moment the goal is hit and flash the
		// completion banner (screen-space, after the world transform restore)
		$.dailyLiveCheck();
		$.dailyRenderPop();
		$.renderMinimap();

		// on-screen buttons (touch pause); action can clear $.buttons mid-loop
		var bi = $.buttons.length; while( bi-- ){ if( $.buttons[ bi ] ) { $.buttons[ bi ].update( bi ) } }
			bi = $.buttons.length; while( bi-- ){ if( $.buttons[ bi ] ) { $.buttons[ bi ].render( bi ) } }

		// a revive is no longer auto-spent on death - instead the CONTINUE
		// offer (see the continueoffer state, routed to below once the death
		// animation finishes) lets the player choose to spend one and jump
		// back in, or end the run.

		// handle gameover
		if( $.hero.life <= 0 ) {
			var alpha = ( ( $.gameoverTick / $.gameoverTickMax ) * 0.8 );
				alpha = Math.min( 1, Math.max( 0, alpha ) );
			$.ctxmg.fillStyle = 'hsla(0, 100%, 0%, ' + alpha + ')';
			$.ctxmg.fillRect( 0, 0, $.cw, $.ch );
			if( $.gameoverTick < $.gameoverTickMax ){
				$.gameoverTick += $.dt;
			} else {
				// offer one CONTINUE before the run officially ends; if not
				// eligible (already used / daily run / no score) go straight
				// to gameover as before
				$.setState( $.continueEligible() ? 'continueoffer' : 'gameover' );
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

	$.states['continueoffer'] = function() {
		$.clearScreen();
		$.ctxmg.putImageData( $.screenshot, 0, 0 );

		// darken the frozen frame (strong enough to mute the HUD behind it)
		$.ctxmg.fillStyle = 'hsla(0, 0%, 0%, 0.85)';
		$.ctxmg.fillRect( 0, 0, $.cw, $.ch );

		var coC = ( $.ch < 640 ),
			coHasRevive = $.consumableCount( 'consumable_revive' ) > 0,
			titleY = coC ? 70 : 150,
			secsLeft = Math.max( 0, Math.ceil( ( $.continueTickMax - $.continueTick ) / 60 ) );

		// title
		$.ctxmg.beginPath();
		var coTitle = $.text( { ctx: $.ctxmg, x: $.cw / 2, y: titleY, text: 'CONTINUE', hspacing: 3, vspacing: 1, halign: 'center', valign: 'bottom', scale: coC ? 5 : 8, snap: 1, render: 1 } );
		var coGrad = $.ctxmg.createLinearGradient( coTitle.sx, coTitle.sy, coTitle.sx, coTitle.ey );
		coGrad.addColorStop( 0, '#fff' ); coGrad.addColorStop( 1, '#fc6' );
		$.ctxmg.fillStyle = coGrad; $.ctxmg.fill();

		// score + countdown
		$.ctxmg.beginPath();
		$.text( { ctx: $.ctxmg, x: $.cw / 2, y: coTitle.ey + ( coC ? 12 : 20 ), text: 'SCORE  ' + $.util.commas( $.score | 0 ), hspacing: 1, vspacing: 1, halign: 'center', valign: 'top', scale: coC ? 2 : 3, snap: 1, render: 1 } );
		$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.85)'; $.ctxmg.fill();

		$.ctxmg.beginPath();
		$.text( { ctx: $.ctxmg, x: $.cw / 2, y: coTitle.ey + ( coC ? 38 : 56 ), text: secsLeft + '', hspacing: 1, vspacing: 1, halign: 'center', valign: 'top', scale: coC ? 2 : 3, snap: 1, render: 1 } );
		$.ctxmg.fillStyle = secsLeft <= 3 ? 'hsla(0, 90%, 62%, 0.95)' : 'hsla(190, 90%, 62%, 0.85)'; $.ctxmg.fill();

		// helper line: what CONTINUE will do (and the fairness note), tucked
		// under the countdown so the buttons never cover it
		var noteY = coTitle.ey + ( coC ? 54 : 80 );
		$.ctxmg.beginPath();
		$.text( { ctx: $.ctxmg, x: $.cw / 2, y: noteY, text: coHasRevive ? 'SPEND 1 REVIVE TO JUMP BACK IN' : 'GET A REVIVE OR DRONE TO JUMP BACK IN', hspacing: 1, vspacing: 1, halign: 'center', valign: 'top', scale: 1, snap: 1, render: 1 } );
		$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.6)'; $.ctxmg.fill();
		$.ctxmg.beginPath();
		$.text( { ctx: $.ctxmg, x: $.cw / 2, y: noteY + 12, text: 'CONTINUED RUNS DONT POST TO THE BOARD', hspacing: 1, vspacing: 1, halign: 'center', valign: 'top', scale: 1, snap: 1, render: 1 } );
		$.ctxmg.fillStyle = 'hsla(45, 100%, 62%, 0.55)'; $.ctxmg.fill();

		var i = $.buttons.length; while( i-- ){ if( $.buttons[ i ] ) { $.buttons[ i ].update( i ) } }
			i = $.buttons.length; while( i-- ){ if( $.buttons[ i ] ) { $.buttons[ i ].render( i ) } }

		// countdown - auto-declines to the score screen when it runs out
		$.continueTick += $.dt;
		if( $.continueTick >= $.continueTickMax ) { $.setState( 'gameover' ); }
	};

	$.states['gameover'] = function() {


		$.clearScreen();
		$.ctxmg.putImageData( $.screenshot, 0, 0 );

		// the HTML GameOverOverlay draws the blurred panel + stats + buttons on
		// top; keep the frozen last frame underneath but draw nothing else, so
		// canvas text can never collide with the HTML controls
		if( window.__htmlGameover ) { return; }

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

		// run highlights live in the gap between the title and the stats:
		// NEW BEST (pulsing gold), daily challenge payoff, and the near-miss
		// hook ("N POINTS BEHIND NO.X" - the line that triggers one more run)
		var goHighlightY = gameoverTitle.ey + ( goCompact ? 2 : 14 ),
			goStatsShift = 0;
		if( $.runWasBest ) {
			$.ctxmg.beginPath();
			$.text( {
				ctx: $.ctxmg, x: $.cw / 2, y: goHighlightY,
				text: 'NEW PERSONAL BEST',
				hspacing: 2, vspacing: 1, halign: 'center', valign: 'top',
				scale: 2, snap: 1, render: 1
			} );
			$.ctxmg.fillStyle = 'hsla(45, 100%, 60%, ' + ( 0.7 + Math.sin( $.tick / 12 ) * 0.3 ) + ')';
			$.ctxmg.fill();
			$.tick += $.dt;
			goHighlightY += goCompact ? 15 : 18;
			goStatsShift += goCompact ? 15 : 0;
		}
		if( $.dailyResult ) {
			$.ctxmg.beginPath();
			$.text( {
				ctx: $.ctxmg, x: $.cw / 2, y: goHighlightY,
				text: 'DAILY CHALLENGE COMPLETE  +' + $.dailyResult.xp + ' XP' + ( $.dailyResult.streak >= 2 ? ', ' + $.dailyResult.streak + ' DAY STREAK' : '' ),
				hspacing: 1, vspacing: 1, halign: 'center', valign: 'top',
				scale: 1, snap: 1, render: 1
			} );
			$.ctxmg.fillStyle = 'hsla(45, 100%, 60%, 1)';
			$.ctxmg.fill();
			goHighlightY += 10;
			goStatsShift += goCompact ? 10 : 0;
		}
		if( $.boardSubmit && $.boardSubmit.state === 'done' && $.boardSubmit.gap > 0 && $.boardSubmit.nextRank > 0 ) {
			$.ctxmg.beginPath();
			$.text( {
				ctx: $.ctxmg, x: $.cw / 2, y: goHighlightY,
				text: $.util.commas( $.boardSubmit.gap ) + ' POINTS BEHIND NO.' + $.boardSubmit.nextRank,
				hspacing: 1, vspacing: 1, halign: 'center', valign: 'top',
				scale: 1, snap: 1, render: 1
			} );
			$.ctxmg.fillStyle = 'hsla(190, 100%, 70%, 0.9)';
			$.ctxmg.fill();
			goStatsShift += goCompact ? 10 : 0;
		}

		$.ctxmg.beginPath();
		var gameoverStatsKeys = $.text( {
			ctx: $.ctxmg,
			x: $.cw / 2 - 10,
			y: gameoverTitle.ey + ( goCompact ? 12 + goStatsShift : 51 ),
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
			y: gameoverTitle.ey + ( goCompact ? 12 + goStatsShift : 51 ),
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
		if( $.boardSubmit.state === 'dailypending' ) {
			boardText = 'SUBMITTING DAILY RUN';
		} else if( $.boardSubmit.state === 'daily' ) {
			boardText = $.boardSubmit.rank ? 'DAILY RUN  RANK ' + $.boardSubmit.rank : 'DAILY RUN SUBMITTED';
			boardColor = 'hsla(45, 100%, 65%, 1)';
		} else if( $.boardSubmit.state === 'sending' ) {
			boardText = 'SUBMITTING TO SHOOTERBOARD';
		} else if( $.boardSubmit.state === 'done' ) {
			boardText = $.boardSubmit.rank
				? 'SHOOTERBOARD RANK ' + $.boardSubmit.rank
				: 'SCORE SAVED TO SHOOTERBOARD';
			boardColor = 'hsla(45, 100%, 65%, 1)';
		} else if( $.boardSubmit.state === 'error' ) {
			boardText = 'SHOOTERBOARD UNAVAILABLE';
		} else if( $.boardSubmit.state === 'assisted' ) {
			boardText = 'RUN NOT RANKED  /  CONSUMABLE USED';
		}
		// the board is cumulative now (every run adds to a lifetime total,
		// not just your best one) - show that running total on the game
		// over screen so it's visible after every single play, not just
		// discoverable by opening the leaderboard separately.
		var boardSubLines = [];
		if( $.boardSubmit.state === 'done' && $.boardSubmit.total > 0 ) {
			boardSubLines.push( 'LIFETIME TOTAL ' + $.util.commas( $.boardSubmit.total ) );
		}
		if( $.boardSubmit.state === 'done' && !$.boardSubmit.verified ) {
			boardSubLines.push( 'PLAYING AS GUEST  /  CONNECT WALLET FOR A VERIFIED BADGE' );
		}
		var boardSubText = boardSubLines.join( '\n' );
		if( boardText ) {
			// desktop: below the fixed button stack (426 + 3 buttons + gaps),
			// so the status can never print over PLAY AGAIN on short windows
			var boardTextY = goCompact
				? gameoverStatsValues.ey + ( buildNames.length > 0 ? 34 : 10 )
				: Math.max( gameoverStatsValues.ey + ( buildNames.length > 0 ? 60 : 25 ), 643 );
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
					vspacing: 6,
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
