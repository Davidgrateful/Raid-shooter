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
	$.difficulty = $.storage['difficulty'] || 1; // 0=easy, 1=normal, 2=hard
	$.difficultyNames = ['EASY', 'NORMAL', 'HARD'];

	$.mapIndex = $.storage['map'] || 0;
	$.maps = [
		{
			name: 'DEEP SPACE',
			bg: '#000',
			starHue: 0, starSat: 0,
			nebulaColor1: 'hsla(0, 0%, 100%, 0.1)',
			nebulaColor2: 'hsla(0, 0%, 100%, 0)',
			starAlphaMin: 0.05, starAlphaMax: 0.5,
			medStarAlphaMin: 0.05, medStarAlphaMax: 0.15,
			farStarAlphaMin: 0.05, farStarAlphaMax: 0.1,
			gridColor: 'hsla(0, 0%, 50%, 0.05)',
			vignetteColor: 'hsla(0, 0%, 0%, 0.5)',
			gridSize: 50, starCount: 2000, medStarCount: 80, farStarCount: 40,
			scanlineAlpha: 0.1, scanlineSpacing: 2
		},
		{
			name: 'CRIMSON NEBULA',
			bg: '#0a0005',
			starHue: 340, starSat: 80,
			nebulaColor1: 'hsla(340, 60%, 30%, 0.15)',
			nebulaColor2: 'hsla(340, 60%, 10%, 0)',
			starAlphaMin: 0.05, starAlphaMax: 0.4,
			medStarAlphaMin: 0.05, medStarAlphaMax: 0.2,
			farStarAlphaMin: 0.03, farStarAlphaMax: 0.12,
			gridColor: 'hsla(340, 40%, 40%, 0.04)',
			vignetteColor: 'hsla(340, 50%, 5%, 0.5)',
			gridSize: 50, starCount: 2000, medStarCount: 80, farStarCount: 40,
			scanlineAlpha: 0.1, scanlineSpacing: 2
		},
		{
			name: 'FROZEN VOID',
			bg: '#000810',
			starHue: 200, starSat: 60,
			nebulaColor1: 'hsla(200, 50%, 40%, 0.12)',
			nebulaColor2: 'hsla(200, 50%, 10%, 0)',
			starAlphaMin: 0.08, starAlphaMax: 0.5,
			medStarAlphaMin: 0.05, medStarAlphaMax: 0.2,
			farStarAlphaMin: 0.05, farStarAlphaMax: 0.15,
			gridColor: 'hsla(200, 30%, 50%, 0.04)',
			vignetteColor: 'hsla(200, 40%, 5%, 0.5)',
			gridSize: 50, starCount: 2000, medStarCount: 80, farStarCount: 40,
			scanlineAlpha: 0.1, scanlineSpacing: 2
		},
		{
			name: 'TOXIC ZONE',
			bg: '#020800',
			starHue: 100, starSat: 70,
			nebulaColor1: 'hsla(100, 60%, 25%, 0.12)',
			nebulaColor2: 'hsla(100, 60%, 5%, 0)',
			starAlphaMin: 0.05, starAlphaMax: 0.35,
			medStarAlphaMin: 0.05, medStarAlphaMax: 0.18,
			farStarAlphaMin: 0.03, farStarAlphaMax: 0.1,
			gridColor: 'hsla(100, 50%, 40%, 0.05)',
			vignetteColor: 'hsla(100, 40%, 5%, 0.5)',
			gridSize: 50, starCount: 2000, medStarCount: 80, farStarCount: 40,
			scanlineAlpha: 0.1, scanlineSpacing: 2
		},
		{
			name: 'WARZONE',
			bg: '#0a0600',
			starHue: 30, starSat: 70,
			nebulaColor1: 'hsla(30, 50%, 25%, 0.18)',
			nebulaColor2: 'hsla(30, 40%, 8%, 0)',
			starAlphaMin: 0.04, starAlphaMax: 0.3,
			medStarAlphaMin: 0.05, medStarAlphaMax: 0.2,
			farStarAlphaMin: 0.03, farStarAlphaMax: 0.12,
			gridColor: 'hsla(30, 30%, 40%, 0.06)',
			vignetteColor: 'hsla(20, 40%, 4%, 0.6)',
			gridSize: 50, starCount: 2000, medStarCount: 80, farStarCount: 40,
			scanlineAlpha: 0.1, scanlineSpacing: 2
		},
		{
			name: 'DESERT STORM',
			bg: '#080600',
			starHue: 40, starSat: 50,
			nebulaColor1: 'hsla(40, 40%, 30%, 0.1)',
			nebulaColor2: 'hsla(40, 30%, 10%, 0)',
			starAlphaMin: 0.03, starAlphaMax: 0.25,
			medStarAlphaMin: 0.04, medStarAlphaMax: 0.15,
			farStarAlphaMin: 0.03, farStarAlphaMax: 0.1,
			gridColor: 'hsla(40, 25%, 45%, 0.05)',
			vignetteColor: 'hsla(35, 30%, 5%, 0.55)',
			gridSize: 50, starCount: 2000, medStarCount: 80, farStarCount: 40,
			scanlineAlpha: 0.1, scanlineSpacing: 2
		},
		{
			name: 'IRON CURTAIN',
			bg: '#050608',
			starHue: 220, starSat: 15,
			nebulaColor1: 'hsla(220, 10%, 35%, 0.1)',
			nebulaColor2: 'hsla(220, 10%, 10%, 0)',
			starAlphaMin: 0.05, starAlphaMax: 0.3,
			medStarAlphaMin: 0.04, medStarAlphaMax: 0.15,
			farStarAlphaMin: 0.03, farStarAlphaMax: 0.1,
			gridColor: 'hsla(220, 10%, 50%, 0.06)',
			vignetteColor: 'hsla(220, 15%, 4%, 0.6)',
			gridSize: 50, starCount: 2000, medStarCount: 80, farStarCount: 40,
			scanlineAlpha: 0.1, scanlineSpacing: 2
		},
		{
			name: 'SCORCHED EARTH',
			bg: '#0a0200',
			starHue: 15, starSat: 90,
			nebulaColor1: 'hsla(10, 70%, 30%, 0.2)',
			nebulaColor2: 'hsla(10, 60%, 8%, 0)',
			starAlphaMin: 0.05, starAlphaMax: 0.45,
			medStarAlphaMin: 0.05, medStarAlphaMax: 0.25,
			farStarAlphaMin: 0.04, farStarAlphaMax: 0.15,
			gridColor: 'hsla(10, 60%, 35%, 0.06)',
			vignetteColor: 'hsla(5, 50%, 5%, 0.6)',
			gridSize: 50, starCount: 2000, medStarCount: 80, farStarCount: 40,
			scanlineAlpha: 0.1, scanlineSpacing: 2
		},
		// --- EXTENDED UNIVERSE MAPS ---
		{
			name: 'PORTAL STORM',
			bg: '#000a02',
			starHue: 140, starSat: 100,
			nebulaColor1: 'hsla(150, 100%, 40%, 0.25)',
			nebulaColor2: 'hsla(120, 80%, 15%, 0)',
			starAlphaMin: 0.08, starAlphaMax: 0.7,
			medStarAlphaMin: 0.1, medStarAlphaMax: 0.35,
			farStarAlphaMin: 0.08, farStarAlphaMax: 0.2,
			gridColor: 'hsla(140, 100%, 50%, 0.08)',
			vignetteColor: 'hsla(140, 80%, 8%, 0.7)',
			gridSize: 35, starCount: 3000, medStarCount: 120, farStarCount: 60,
			scanlineAlpha: 0.15, scanlineSpacing: 3,
			nebula2Color1: 'hsla(160, 100%, 50%, 0.12)',
			nebula2Color2: 'hsla(130, 80%, 20%, 0)'
		},
		{
			name: 'DARK MATTER',
			bg: '#02000a',
			starHue: 270, starSat: 85,
			nebulaColor1: 'hsla(280, 70%, 35%, 0.2)',
			nebulaColor2: 'hsla(260, 60%, 10%, 0)',
			starAlphaMin: 0.06, starAlphaMax: 0.55,
			medStarAlphaMin: 0.08, medStarAlphaMax: 0.3,
			farStarAlphaMin: 0.05, farStarAlphaMax: 0.18,
			gridColor: 'hsla(270, 60%, 50%, 0.06)',
			vignetteColor: 'hsla(280, 60%, 5%, 0.6)',
			gridSize: 60, starCount: 2500, medStarCount: 100, farStarCount: 50,
			scanlineAlpha: 0.08, scanlineSpacing: 2,
			nebula2Color1: 'hsla(300, 80%, 40%, 0.1)',
			nebula2Color2: 'hsla(250, 50%, 15%, 0)'
		},
		{
			name: 'ANCIENT RUINS',
			bg: '#080808',
			starHue: 50, starSat: 40,
			nebulaColor1: 'hsla(45, 30%, 40%, 0.12)',
			nebulaColor2: 'hsla(30, 20%, 15%, 0)',
			starAlphaMin: 0.04, starAlphaMax: 0.35,
			medStarAlphaMin: 0.06, medStarAlphaMax: 0.2,
			farStarAlphaMin: 0.04, farStarAlphaMax: 0.12,
			gridColor: 'hsla(45, 20%, 60%, 0.08)',
			vignetteColor: 'hsla(40, 20%, 3%, 0.7)',
			gridSize: 40, starCount: 1500, medStarCount: 60, farStarCount: 30,
			scanlineAlpha: 0.18, scanlineSpacing: 2,
			gridStyle: 'cross'
		},
		{
			name: 'MUTANT SECTOR',
			bg: '#0a0004',
			starHue: 320, starSat: 90,
			nebulaColor1: 'hsla(330, 80%, 25%, 0.22)',
			nebulaColor2: 'hsla(300, 70%, 10%, 0)',
			starAlphaMin: 0.06, starAlphaMax: 0.5,
			medStarAlphaMin: 0.08, medStarAlphaMax: 0.28,
			farStarAlphaMin: 0.05, farStarAlphaMax: 0.15,
			gridColor: 'hsla(320, 70%, 35%, 0.07)',
			vignetteColor: 'hsla(330, 60%, 5%, 0.65)',
			gridSize: 45, starCount: 2200, medStarCount: 90, farStarCount: 45,
			scanlineAlpha: 0.12, scanlineSpacing: 2,
			nebula2Color1: 'hsla(350, 90%, 30%, 0.15)',
			nebula2Color2: 'hsla(310, 60%, 8%, 0)'
		},
		{
			name: 'NEON ABYSS',
			bg: '#000308',
			starHue: 210, starSat: 90,
			nebulaColor1: 'hsla(220, 80%, 45%, 0.18)',
			nebulaColor2: 'hsla(200, 60%, 12%, 0)',
			starAlphaMin: 0.1, starAlphaMax: 0.65,
			medStarAlphaMin: 0.1, medStarAlphaMax: 0.35,
			farStarAlphaMin: 0.08, farStarAlphaMax: 0.2,
			gridColor: 'hsla(210, 80%, 60%, 0.07)',
			vignetteColor: 'hsla(220, 60%, 6%, 0.55)',
			gridSize: 30, starCount: 3500, medStarCount: 150, farStarCount: 70,
			scanlineAlpha: 0.06, scanlineSpacing: 1
		},
		{
			name: 'EMBER DRIFT',
			bg: '#080200',
			starHue: 20, starSat: 95,
			nebulaColor1: 'hsla(15, 90%, 35%, 0.2)',
			nebulaColor2: 'hsla(30, 70%, 10%, 0)',
			starAlphaMin: 0.06, starAlphaMax: 0.5,
			medStarAlphaMin: 0.07, medStarAlphaMax: 0.25,
			farStarAlphaMin: 0.04, farStarAlphaMax: 0.14,
			gridColor: 'hsla(20, 80%, 40%, 0.07)',
			vignetteColor: 'hsla(15, 70%, 4%, 0.65)',
			gridSize: 55, starCount: 1800, medStarCount: 70, farStarCount: 35,
			scanlineAlpha: 0.12, scanlineSpacing: 2,
			nebula2Color1: 'hsla(40, 80%, 40%, 0.1)',
			nebula2Color2: 'hsla(10, 60%, 12%, 0)'
		},
		{
			name: 'MICROVERSE',
			bg: '#02020a',
			starHue: 250, starSat: 70,
			nebulaColor1: 'hsla(240, 60%, 50%, 0.15)',
			nebulaColor2: 'hsla(260, 50%, 15%, 0)',
			starAlphaMin: 0.15, starAlphaMax: 0.8,
			medStarAlphaMin: 0.12, medStarAlphaMax: 0.4,
			farStarAlphaMin: 0.1, farStarAlphaMax: 0.25,
			gridColor: 'hsla(250, 50%, 60%, 0.04)',
			vignetteColor: 'hsla(250, 50%, 5%, 0.5)',
			gridSize: 20, starCount: 5000, medStarCount: 200, farStarCount: 100,
			scanlineAlpha: 0.05, scanlineSpacing: 1
		},
		{
			name: 'RIFT ZONE',
			bg: '#060006',
			starHue: 290, starSat: 80,
			nebulaColor1: 'hsla(300, 70%, 35%, 0.2)',
			nebulaColor2: 'hsla(270, 60%, 12%, 0)',
			starAlphaMin: 0.07, starAlphaMax: 0.55,
			medStarAlphaMin: 0.08, medStarAlphaMax: 0.3,
			farStarAlphaMin: 0.06, farStarAlphaMax: 0.18,
			gridColor: 'hsla(290, 60%, 45%, 0.06)',
			vignetteColor: 'hsla(300, 50%, 5%, 0.6)',
			gridSize: 70, starCount: 2000, medStarCount: 80, farStarCount: 40,
			scanlineAlpha: 0.1, scanlineSpacing: 3,
			nebula2Color1: 'hsla(180, 90%, 40%, 0.1)',
			nebula2Color2: 'hsla(260, 40%, 10%, 0)',
			gridStyle: 'hex'
		},
		{
			name: 'QUANTUM GRID',
			bg: '#000505',
			starHue: 180, starSat: 60,
			nebulaColor1: 'hsla(175, 50%, 40%, 0.14)',
			nebulaColor2: 'hsla(190, 40%, 10%, 0)',
			starAlphaMin: 0.06, starAlphaMax: 0.4,
			medStarAlphaMin: 0.06, medStarAlphaMax: 0.22,
			farStarAlphaMin: 0.04, farStarAlphaMax: 0.14,
			gridColor: 'hsla(180, 40%, 50%, 0.06)',
			vignetteColor: 'hsla(180, 40%, 4%, 0.55)',
			gridSize: 45, starCount: 2200, medStarCount: 90, farStarCount: 45,
			scanlineAlpha: 0.08, scanlineSpacing: 2,
			gridStyle: 'diamond'
		},
		{
			name: 'SOLAR FORGE',
			bg: '#0a0800',
			starHue: 55, starSat: 75,
			nebulaColor1: 'hsla(50, 70%, 40%, 0.18)',
			nebulaColor2: 'hsla(60, 50%, 12%, 0)',
			starAlphaMin: 0.08, starAlphaMax: 0.55,
			medStarAlphaMin: 0.08, medStarAlphaMax: 0.3,
			farStarAlphaMin: 0.06, farStarAlphaMax: 0.18,
			gridColor: 'hsla(50, 60%, 50%, 0.07)',
			vignetteColor: 'hsla(50, 50%, 5%, 0.6)',
			gridSize: 65, starCount: 1800, medStarCount: 70, farStarCount: 35,
			scanlineAlpha: 0.14, scanlineSpacing: 2
		},
		{
			name: 'BLOOD MOON',
			bg: '#0a0000',
			starHue: 0, starSat: 100,
			nebulaColor1: 'hsla(0, 90%, 30%, 0.25)',
			nebulaColor2: 'hsla(350, 70%, 8%, 0)',
			starAlphaMin: 0.08, starAlphaMax: 0.6,
			medStarAlphaMin: 0.1, medStarAlphaMax: 0.35,
			farStarAlphaMin: 0.06, farStarAlphaMax: 0.2,
			gridColor: 'hsla(0, 80%, 40%, 0.08)',
			vignetteColor: 'hsla(0, 70%, 5%, 0.7)',
			gridSize: 40, starCount: 2800, medStarCount: 110, farStarCount: 55,
			scanlineAlpha: 0.2, scanlineSpacing: 2,
			nebula2Color1: 'hsla(20, 100%, 35%, 0.12)',
			nebula2Color2: 'hsla(350, 80%, 10%, 0)'
		},
		{
			name: 'VOID WALKER',
			bg: '#030303',
			starHue: 0, starSat: 0,
			nebulaColor1: 'hsla(0, 0%, 20%, 0.08)',
			nebulaColor2: 'hsla(0, 0%, 5%, 0)',
			starAlphaMin: 0.02, starAlphaMax: 0.15,
			medStarAlphaMin: 0.03, medStarAlphaMax: 0.1,
			farStarAlphaMin: 0.02, farStarAlphaMax: 0.06,
			gridColor: 'hsla(0, 0%, 30%, 0.03)',
			vignetteColor: 'hsla(0, 0%, 0%, 0.8)',
			gridSize: 80, starCount: 800, medStarCount: 30, farStarCount: 15,
			scanlineAlpha: 0.25, scanlineSpacing: 1
		}
	];

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
	$.enemyBullets = [];
	$.explosions = [];
	$.powerups = [];
	$.particleEmitters = [];
	$.textPops = [];
	$.levelPops = [];
	$.powerupTimers = [];

	$.resizecb();
	$.bindEvents();
	$.setupStates();
	$.renderAllBackgrounds();
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
	$.instructionTickMax = 400;

	$.levelDiffOffset = 0;
	$.enemyOffsetMod = 0;
	$.slow = 0;
	$.shielded = 0;

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
	$.enemyBullets.length = 0;
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

	// Combo system
	$.combo = 0;
	$.comboTimer = 0;
	$.comboTimerMax = 90; // 1.5 seconds to chain kills
	$.comboMultiplier = 1;
	$.bestCombo = 0;

	// Boss state
	$.boss = null;
	$.bossWarning = 0;
	$.bossWarningMax = 120;
	$.bossLevel = 0; // tracks which boss to spawn next (0, 1, 2)

	// Difficulty modifiers: [easy, normal, hard]
	var diffMods = [
		{ enemySpeedMult: 0.7, enemyLifeMult: 0.7, damageMult: 0.6, spawnMult: 1.3 },
		{ enemySpeedMult: 1.0, enemyLifeMult: 1.0, damageMult: 1.0, spawnMult: 1.0 },
		{ enemySpeedMult: 1.3, enemyLifeMult: 1.4, damageMult: 1.5, spawnMult: 0.7 }
	];
	$.diffMod = diffMods[ $.difficulty ] || diffMods[1];

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
Render Backgrounds (map-themed)
==============================================================================*/
$.renderAllBackgrounds = function() {
	var m = $.maps[ $.mapIndex ];
	var starCount = m.starCount || 2000;
	var medStarCount = m.medStarCount || 80;
	var farStarCount = m.farStarCount || 40;
	var gridSize = m.gridSize || 50;
	var scanlineAlpha = m.scanlineAlpha !== undefined ? m.scanlineAlpha : 0.1;
	var scanlineSpacing = m.scanlineSpacing || 2;

	// Set wrap-inner background color
	$.wrapInner.style.background = m.bg;

	// BG1: nebula gradient + dense star field
	$.ctxbg1.clearRect( 0, 0, $.cbg1.width, $.cbg1.height );
	var gradient = $.ctxbg1.createRadialGradient( $.cbg1.width / 2, $.cbg1.height / 2, 0, $.cbg1.width / 2, $.cbg1.height / 2, $.cbg1.height );
	gradient.addColorStop( 0, m.nebulaColor1 );
	gradient.addColorStop( 0.65, m.nebulaColor2 );
	$.ctxbg1.fillStyle = gradient;
	$.ctxbg1.fillRect( 0, 0, $.cbg1.width, $.cbg1.height );

	// Second nebula for dual-nebula maps (offset position)
	if( m.nebula2Color1 ) {
		var ox = $.cbg1.width * 0.3, oy = $.cbg1.height * 0.7;
		var g2 = $.ctxbg1.createRadialGradient( ox, oy, 0, ox, oy, $.cbg1.height * 0.6 );
		g2.addColorStop( 0, m.nebula2Color1 );
		g2.addColorStop( 0.7, m.nebula2Color2 );
		$.ctxbg1.fillStyle = g2;
		$.ctxbg1.fillRect( 0, 0, $.cbg1.width, $.cbg1.height );
	}

	var i = starCount;
	while( i-- ) {
		var hue = m.starHue + $.util.rand( -20, 20 );
		$.util.fillCircle( $.ctxbg1, $.util.rand( 0, $.cbg1.width ), $.util.rand( 0, $.cbg1.height ), $.util.rand( 0.2, 0.5 ), 'hsla(' + hue + ', ' + m.starSat + '%, 100%, ' + $.util.rand( m.starAlphaMin, m.starAlphaMax * 0.4 ) + ')' );
	}
	i = Math.round( starCount * 0.4 );
	while( i-- ) {
		var hue = m.starHue + $.util.rand( -30, 30 );
		$.util.fillCircle( $.ctxbg1, $.util.rand( 0, $.cbg1.width ), $.util.rand( 0, $.cbg1.height ), $.util.rand( 0.1, 0.8 ), 'hsla(' + hue + ', ' + m.starSat + '%, 100%, ' + $.util.rand( m.starAlphaMin, m.starAlphaMax ) + ')' );
	}

	// BG2: medium stars
	$.ctxbg2.clearRect( 0, 0, $.cbg2.width, $.cbg2.height );
	i = medStarCount;
	while( i-- ) {
		var hue = m.starHue + $.util.rand( -15, 15 );
		$.util.fillCircle( $.ctxbg2, $.util.rand( 0, $.cbg2.width ), $.util.rand( 0, $.cbg2.height ), $.util.rand( 1, 2 ), 'hsla(' + hue + ', ' + m.starSat + '%, 100%, ' + $.util.rand( m.medStarAlphaMin, m.medStarAlphaMax ) + ')' );
	}

	// BG3: far stars
	$.ctxbg3.clearRect( 0, 0, $.cbg3.width, $.cbg3.height );
	i = farStarCount;
	while( i-- ) {
		var hue = m.starHue + $.util.rand( -10, 10 );
		$.util.fillCircle( $.ctxbg3, $.util.rand( 0, $.cbg3.width ), $.util.rand( 0, $.cbg3.height ), $.util.rand( 1, 2.5 ), 'hsla(' + hue + ', ' + m.starSat + '%, 100%, ' + $.util.rand( m.farStarAlphaMin, m.farStarAlphaMax ) + ')' );
	}

	// BG4: grid with per-map style
	$.ctxbg4.clearRect( 0, 0, $.cbg4.width, $.cbg4.height );
	$.ctxbg4.fillStyle = m.gridColor;

	if( m.gridStyle === 'cross' ) {
		// Cross-hatch pattern (Citadel Ruins)
		var cx = Math.round( $.cbg4.width / gridSize );
		var cy = Math.round( $.cbg4.height / gridSize );
		for( var gx = 0; gx < cx; gx++ ) {
			for( var gy = 0; gy < cy; gy++ ) {
				var px = gx * gridSize + gridSize / 2;
				var py = gy * gridSize + gridSize / 2;
				$.ctxbg4.fillRect( px - 4, py, 9, 1 );
				$.ctxbg4.fillRect( px, py - 4, 1, 9 );
			}
		}
	} else if( m.gridStyle === 'hex' ) {
		// Hexagonal offset grid (Interdimensional)
		var rows = Math.round( $.cbg4.height / gridSize );
		var cols = Math.round( $.cbg4.width / gridSize );
		for( var gy = 0; gy < rows; gy++ ) {
			var offset = ( gy % 2 ) * ( gridSize / 2 );
			for( var gx = 0; gx < cols; gx++ ) {
				var px = gx * gridSize + offset;
				$.ctxbg4.fillRect( px, gy * gridSize, 1, gridSize );
			}
			$.ctxbg4.fillRect( 0, gy * gridSize, $.cbg4.width, 1 );
		}
	} else if( m.gridStyle === 'diamond' ) {
		// Diamond/rotated grid (Galactic Fed)
		$.ctxbg4.save();
		$.ctxbg4.translate( $.cbg4.width / 2, $.cbg4.height / 2 );
		$.ctxbg4.rotate( Math.PI / 4 );
		var diagSize = Math.sqrt( $.cbg4.width * $.cbg4.width + $.cbg4.height * $.cbg4.height );
		var halfDiag = diagSize / 2;
		i = Math.round( diagSize / gridSize );
		while( i-- ) {
			$.ctxbg4.fillRect( -halfDiag, i * gridSize - halfDiag, diagSize, 1 );
			$.ctxbg4.fillRect( i * gridSize - halfDiag, -halfDiag, 1, diagSize );
		}
		$.ctxbg4.restore();
	} else {
		// Standard grid
		i = Math.round( $.cbg4.height / gridSize );
		while( i-- ) {
			$.ctxbg4.fillRect( 0, i * gridSize + Math.floor( gridSize / 2 ), $.cbg4.width, 1 );
		}
		i = Math.round( $.cbg4.width / gridSize );
		while( i-- ) {
			$.ctxbg4.fillRect( i * gridSize, 0, 1, $.cbg4.height );
		}
	}

	// Foreground: vignette + scanlines
	$.ctxfg.clearRect( 0, 0, $.cw, $.ch );
	var fgGradient = $.ctxfg.createRadialGradient( $.cw / 2, $.ch / 2, $.ch / 3, $.cw / 2, $.ch / 2, $.ch );
	fgGradient.addColorStop( 0, 'hsla(0, 0%, 0%, 0)' );
	fgGradient.addColorStop( 1, m.vignetteColor );
	$.ctxfg.fillStyle = fgGradient;
	$.ctxfg.fillRect( 0, 0, $.cw, $.ch );

	$.ctxfg.fillStyle = 'hsla(0, 0%, 50%, ' + scanlineAlpha + ')';
	i = Math.round( $.ch / scanlineSpacing );
	while( i-- ) {
		$.ctxfg.fillRect( 0, i * scanlineSpacing, $.cw, 1 );
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
			$.ctxmg.beginPath();
			$.text( {
				ctx: $.ctxmg,
				x: $.cw / 2 - 10,
				y: $.ch - 20,
				text: 'MOVE\nAIM/FIRE\nAUTOFIRE\nPAUSE\nMUTE',
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
				text: 'WASD/ARROWS\nMOUSE\nF\nP\nM',
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
		Speed Boost Screen Cover
		==============================================================================*/
		if( $.powerupTimers[ 6 ] > 0 ) {
			$.ctxmg.fillStyle = 'hsla(50, 100%, 50%, 0.03)';
			$.ctxmg.fillRect( 0, 0, $.cw, $.ch );
		}

		/*==============================================================================
		Magnet Screen Cover
		==============================================================================*/
		if( $.powerupTimers[ 7 ] > 0 ) {
			$.ctxmg.fillStyle = 'hsla(300, 100%, 50%, 0.02)';
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

	/*==============================================================================
	Combo
	==============================================================================*/
	if( $.combo >= 3 ) {
		var comboAlpha = Math.min( 1, $.comboTimer / 30 );
		var comboHue = ( $.comboMultiplier >= 3 ) ? 50 : ( $.comboMultiplier >= 2 ) ? 30 : 0;

		$.ctxmg.beginPath();
		var comboLabel = $.text( {
			ctx: $.ctxmg,
			x: $.cw / 2,
			y: 50,
			text: $.combo + 'X COMBO',
			hspacing: 1,
			vspacing: 1,
			halign: 'center',
			valign: 'top',
			scale: 3,
			snap: 1,
			render: 1
		} );
		$.ctxmg.fillStyle = 'hsla(' + comboHue + ', 100%, 70%, ' + comboAlpha + ')';
		$.ctxmg.fill();

		if( $.comboMultiplier > 1 ) {
			$.ctxmg.beginPath();
			$.text( {
				ctx: $.ctxmg,
				x: $.cw / 2,
				y: comboLabel.ey + 5,
				text: $.comboMultiplier + 'X SCORE',
				hspacing: 1,
				vspacing: 1,
				halign: 'center',
				valign: 'top',
				scale: 2,
				snap: 1,
				render: 1
			} );
			$.ctxmg.fillStyle = 'hsla(' + comboHue + ', 100%, 90%, ' + ( comboAlpha * 0.7 ) + ')';
			$.ctxmg.fill();
		}
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

$.spawnEnemies = function() {
	var floorTick = Math.floor( $.tick );
	for( var i = 0; i < $.level.distributionCount; i++ ) {
		var timeCheck = $.level.distribution[ i ];
		if( $.levelDiffOffset > 0 ){
			timeCheck = Math.max( 1, timeCheck - ( $.levelDiffOffset * 2) );
		}
		// Apply difficulty spawn rate modifier
		if( $.diffMod ) {
			timeCheck = Math.max( 1, Math.round( timeCheck * $.diffMod.spawnMult ) );
		}
		if( floorTick % timeCheck === 0 ) {
			// Swarm type spawns in groups
			if( i === 16 ) {
				var count = Math.floor( $.util.rand( 3, 6 ) );
				var leader = $.spawnEnemy( i );
				$.enemies.push( leader );
				for( var s = 1; s < count; s++ ) {
					var follower = $.spawnEnemy( i );
					follower.x = leader.x + $.util.rand( -30, 30 );
					follower.y = leader.y + $.util.rand( -30, 30 );
					$.enemies.push( follower );
				}
			} else {
				$.enemies.push( $.spawnEnemy( i ) );
			}
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
		}
		$.levelDiffOffset = $.level.current + 1 - $.levelCount;
		$.levelPops.push( new $.LevelPop( {
			level: $.level.current + 1
		} ) );

		// Spawn boss every 5 levels (at level 5, 10, 15...)
		if( ( $.level.current + 1 ) % 5 === 0 && !$.boss ) {
			$.bossWarning = $.bossWarningMax;
		}
	}
};

$.spawnBoss = function() {
	var bossType = $.bossLevel % $.definitions.bosses.length;
	var params = $.definitions.bosses[ bossType ];
	var coordinates = $.getSpawnCoordinates( params.radius );

	// Scale boss with progression
	var scaleFactor = 1 + Math.floor( $.bossLevel / $.definitions.bosses.length ) * 0.5;
	var bossParams = {};
	for( var k in params ) { bossParams[k] = params[k]; }
	bossParams.x = coordinates.x;
	bossParams.y = coordinates.y;
	bossParams.start = coordinates.start;
	bossParams.type = 0;
	bossParams.life = params.life * scaleFactor;
	bossParams.value = params.value * scaleFactor;

	$.boss = new $.Enemy( bossParams );
	$.boss.isBoss = 1;
	$.boss.bossTitle = params.title;
	$.enemies.push( $.boss );
	$.bossLevel++;
	$.audio.play( 'bossWarning' );
};

$.updateBoss = function() {
	// Boss warning countdown
	if( $.bossWarning > 0 ) {
		$.bossWarning -= $.dt;
		if( $.bossWarning <= 0 ) {
			$.bossWarning = 0;
			$.spawnBoss();
		}
	}

	// Check if boss is dead
	if( $.boss && $.boss.life <= 0 ) {
		$.boss = null;
	}
};

$.updateCombo = function() {
	if( $.comboTimer > 0 ) {
		$.comboTimer -= $.dt;
		if( $.comboTimer <= 0 ) {
			$.combo = 0;
			$.comboMultiplier = 1;
		}
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
		$.hero.weapon.fireRate = 2;
		$.hero.weapon.bullet.speed = 14;
		$.powerupTimers[ 2 ] -= $.dt;
	} else {
		$.hero.weapon.fireRate = 5;
		$.hero.weapon.bullet.speed = 10;
	}

	// TRIPLE SHOT
	if( $.powerupTimers[ 3 ] > 0 ){
		$.hero.weapon.count = 3;
		$.powerupTimers[ 3 ] -= $.dt;
	} else {
		$.hero.weapon.count = 1;
	}

	// PIERCE SHOT
	if( $.powerupTimers[ 4 ] > 0 ){
		$.hero.weapon.bullet.piercing = 1;
		$.powerupTimers[ 4 ] -= $.dt;
	} else {
		$.hero.weapon.bullet.piercing = 0;
	}

	// SHIELD
	if( $.powerupTimers[ 5 ] > 0 ){
		$.shielded = 1;
		$.powerupTimers[ 5 ] -= $.dt;
	} else {
		$.shielded = 0;
	}

	// SPEED BOOST
	if( $.powerupTimers[ 6 ] > 0 ){
		$.hero.vmax = 10;
		$.hero.accel = 0.8;
		$.powerupTimers[ 6 ] -= $.dt;
	} else {
		$.hero.vmax = 6;
		$.hero.accel = 0.5;
	}

	// MAGNET
	if( $.powerupTimers[ 7 ] > 0 ){
		var pi = $.powerups.length;
		while( pi-- ) {
			var p = $.powerups[ pi ];
			var dx = $.hero.x - ( p.x + p.width / 2 );
			var dy = $.hero.y - ( p.y + p.height / 2 );
			var dist = Math.sqrt( dx * dx + dy * dy );
			if( dist < 300 && dist > 5 ) {
				var angle = Math.atan2( dy, dx );
				p.x += Math.cos( angle ) * 4 * $.dt;
				p.y += Math.sin( angle ) * 4 * $.dt;
			}
		}
		$.powerupTimers[ 7 ] -= $.dt;
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
/*==============================================================================
Boss UI
==============================================================================*/
$.renderBossUI = function() {
	// Boss warning
	if( $.bossWarning > 0 ) {
		var warningAlpha = Math.abs( Math.sin( $.tick / 5 ) ) * 0.8;
		$.ctxmg.beginPath();
		var warningText = $.text( {
			ctx: $.ctxmg,
			x: $.cw / 2,
			y: $.ch / 2 - 50,
			text: 'WARNING',
			hspacing: 3,
			vspacing: 1,
			halign: 'center',
			valign: 'center',
			scale: 8,
			snap: 1,
			render: 1
		} );
		$.ctxmg.fillStyle = 'hsla(0, 100%, 50%, ' + warningAlpha + ')';
		$.ctxmg.fill();

		$.ctxmg.beginPath();
		$.text( {
			ctx: $.ctxmg,
			x: $.cw / 2,
			y: $.ch / 2 + 10,
			text: 'BOSS APPROACHING',
			hspacing: 1,
			vspacing: 1,
			halign: 'center',
			valign: 'center',
			scale: 3,
			snap: 1,
			render: 1
		} );
		$.ctxmg.fillStyle = 'hsla(0, 100%, 70%, ' + warningAlpha * 0.7 + ')';
		$.ctxmg.fill();

		// Red vignette
		$.ctxmg.fillStyle = 'hsla(0, 100%, 30%, ' + ( warningAlpha * 0.08 ) + ')';
		$.ctxmg.fillRect( 0, 0, $.cw, $.ch );
	}

	// Boss health bar (centered at top)
	if( $.boss && $.boss.life > 0 ) {
		var bossBarWidth = 300;
		var bossBarHeight = 12;
		var bossBarX = ( $.cw - bossBarWidth ) / 2;
		var bossBarY = 45;

		// Boss name
		$.ctxmg.beginPath();
		$.text( {
			ctx: $.ctxmg,
			x: $.cw / 2,
			y: bossBarY - 5,
			text: $.boss.bossTitle || 'BOSS',
			hspacing: 1,
			vspacing: 1,
			halign: 'center',
			valign: 'bottom',
			scale: 2,
			snap: 1,
			render: 1
		} );
		$.ctxmg.fillStyle = 'hsla(0, 100%, 70%, 0.8)';
		$.ctxmg.fill();

		// Health bar background
		$.ctxmg.fillStyle = 'hsla(0, 0%, 10%, 0.8)';
		$.ctxmg.fillRect( bossBarX, bossBarY, bossBarWidth, bossBarHeight );

		// Health bar fill
		var healthPct = $.boss.life / $.boss.lifeMax;
		var bossHue = healthPct > 0.5 ? 0 : ( healthPct > 0.25 ? 30 : 0 );
		$.ctxmg.fillStyle = 'hsla(' + bossHue + ', 100%, 40%, 1)';
		$.ctxmg.fillRect( bossBarX, bossBarY, bossBarWidth * healthPct, bossBarHeight );
		$.ctxmg.fillStyle = 'hsla(' + bossHue + ', 100%, 70%, 1)';
		$.ctxmg.fillRect( bossBarX, bossBarY, bossBarWidth * healthPct, bossBarHeight / 2 );

		// Border
		$.ctxmg.strokeStyle = 'hsla(0, 100%, 50%, 0.6)';
		$.ctxmg.lineWidth = 1;
		$.ctxmg.strokeRect( bossBarX - 0.5, bossBarY - 0.5, bossBarWidth + 1, bossBarHeight + 1 );
	}
};

/*==============================================================================
Ability UI
==============================================================================*/
$.setState = function( state ) {
	// handle clean up between states
	$.buttons.length = 0;

	if( state == 'menu' ) {
		$.mouse.down = 0;
		$.mouse.ax = 0;
		$.mouse.ay = 0;

		$.reset();

		var diffButton = new $.Button( {
			x: $.cw / 2 + 1,
			y: $.ch / 2 - 49,
			lockedWidth: 299,
			lockedHeight: 49,
			scale: 3,
			title: $.difficultyNames[ $.difficulty ],
			action: function() {
				$.difficulty = ( $.difficulty + 1 ) % 3;
				$.storage['difficulty'] = $.difficulty;
				$.updateStorage();
				diffButton.title = $.difficultyNames[ $.difficulty ];
				$.mouse.down = 0;
			}
		} );
		$.buttons.push( diffButton );

		var mapButton = new $.Button( {
			x: $.cw / 2 + 1,
			y: diffButton.ey + 25,
			lockedWidth: 299,
			lockedHeight: 49,
			scale: 3,
			title: $.maps[ $.mapIndex ].name,
			action: function() {
				$.mapIndex = ( $.mapIndex + 1 ) % $.maps.length;
				$.storage['map'] = $.mapIndex;
				$.updateStorage();
				mapButton.title = $.maps[ $.mapIndex ].name;
				$.renderAllBackgrounds();
				$.mouse.down = 0;
			}
		} );
		$.buttons.push( mapButton );

		var playButton = new $.Button( {
			x: $.cw / 2 + 1,
			y: mapButton.ey + 25,
			lockedWidth: 299,
			lockedHeight: 49,
			scale: 3,
			title: 'PLAY',
			action: function() {
				$.renderAllBackgrounds();
				$.reset();
				$.audio.play( 'levelup' );
				$.setState( 'play' );
			}
		} );
		$.buttons.push( playButton );

		var statsButton = new $.Button( {
			x: $.cw / 2 + 1,
			y: playButton.ey + 25,
			lockedWidth: 299,
			lockedHeight: 49,
			scale: 3,
			title: 'STATS',
			action: function() {
				$.setState( 'stats' );
			}
		} );
		$.buttons.push( statsButton );

		var creditsButton = new $.Button( {
			x: $.cw / 2 + 1,
			y: statsButton.ey + 26,
			lockedWidth: 299,
			lockedHeight: 49,
			scale: 3,
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
			title: 'Melvin Games',
			action: function() {
				location.href = 'http://elishadavid.netlify.app';
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
			scale: 10,
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
			text: 'CREATED BY DAVID GRATEFUL 2022',
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
			text: 'CREATED FOR WEBVIUM BY MELVINCYPHER 2022./n/nI GIVE CREDITS TO SPCK EDITOR FOR THE HELP',
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
			text:'@Elisha David(MelvinCypher) CELL WARFARE,\nSPACE PIPS, AND MANY MORE\nPhenomenalz\nHTML5 ANIMATION WITH JAVASCRIPT',
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
		$.updateScreen();
		$.updateLevel();
		$.updateBoss();
		$.updateCombo();
		$.updatePowerupTimers();
		$.spawnEnemies();
		$.enemyOffsetMod += ( $.slow ) ? $.dt / 3 : $.dt;

		// update entities
		var i = $.enemies.length; while( i-- ){ $.enemies[ i ].update( i ) }
			i = $.enemyBullets.length; while( i-- ){ $.enemyBullets[ i ].update( i ) }
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
		i = $.enemies.length; while( i-- ){ $.enemies[ i ].render( i ) }
		i = $.enemyBullets.length; while( i-- ){ $.enemyBullets[ i ].render( i ) }
		i = $.explosions.length; while( i-- ){ $.explosions[ i ].render( i ) }
		i = $.powerups.length; while( i-- ){ $.powerups[ i ].render( i ) }
		i = $.particleEmitters.length; while( i-- ){ $.particleEmitters[ i ].render( i ) }
		i = $.textPops.length; while( i-- ){ $.textPops[ i ].render( i ) }
		i = $.bullets.length; while( i-- ){ $.bullets[ i ].render( i ) }
		$.hero.render();

		// Magnet radius indicator
		if( $.powerupTimers[ 7 ] > 0 ) {
			var magnetAlpha = 0.05 + Math.sin( $.tick / 10 ) * 0.03;
			$.util.strokeCircle( $.ctxmg, $.hero.x, $.hero.y, 300, 'hsla(300, 100%, 70%, ' + magnetAlpha + ')', 1 );
		}

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
		$.renderBossUI();

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
			text: 'DIFFICULTY\nSCORE\nLEVEL\nKILLS\nBEST COMBO\nBULLETS\nPOWERUPS\nTIME',
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
				$.difficultyNames[ $.difficulty ] + '\n' +
				$.util.commas( $.score ) + '\n' +
				( $.level.current + 1 ) + '\n' +
				$.util.commas( $.kills ) + '\n' +
				$.bestCombo + '\n' +
				$.util.commas( $.bulletsFired ) + '\n' +
				$.util.commas( $.powerupsCollected ) + '\n' +
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
window.addEventListener( 'load', function() {
	document.documentElement.className += ' loaded';
	$.init();
});
