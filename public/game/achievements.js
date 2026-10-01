/*==============================================================================
Achievements - goals beyond score

Counted from things the engine already does (an object broken by the pilot, a
boss down, a sector entered...) and kept in $.storage.ach:

  { counts: { crates: 12, ... }, done: { CRATE_CRACKER: 1733000000000, ... } }

Cosmetic only: an unlock shows a banner in the run and a badge on the pilot
screen. Nothing here touches score, rank, dice or payouts - and nothing here
rolls dice at all, so a Daily Run or a duel plays the same with or without it.
==============================================================================*/
( function() {
	// goal: how many of `stat` it takes. Titles stay within the bitmap font
	// (A-Z, 0-9 and a little punctuation).
	var DEFS = [
		{ id: 'CRATE_CRACKER', title: 'CRATE CRACKER', desc: 'Break 50 crates', stat: 'crates', goal: 50 },
		{ id: 'MINESWEEPER', title: 'MINESWEEPER', desc: 'Shoot 25 mines from range', stat: 'mines', goal: 25 },
		{ id: 'CRYSTAL_CLEAR', title: 'CRYSTAL CLEAR', desc: 'Shatter 20 crystals', stat: 'crystals', goal: 20 },
		{ id: 'FUEL_FOR_THOUGHT', title: 'FUEL FOR THOUGHT', desc: 'Take out 30 drones with fuel blasts', stat: 'fuelKills', goal: 30 },
		{ id: 'BOSS_HUNTER', title: 'BOSS HUNTER', desc: 'Defeat 10 bosses', stat: 'bosses', goal: 10 },
		{ id: 'SECTOR_SLAYER', title: 'SECTOR SLAYER', desc: 'Defeat all six sector bosses', stat: 'homeBosses', goal: 6 },
		{ id: 'GRAND_TOUR', title: 'GRAND TOUR', desc: 'Reach all ten sectors', stat: 'sectors', goal: 10 },
		{ id: 'UNTOUCHED', title: 'UNTOUCHED', desc: 'Clear a sector without taking a hit', stat: 'cleanSectors', goal: 1 },
		{ id: 'COMBO_50', title: 'COMBO 50', desc: 'Reach a 50 kill combo', stat: 'bestCombo', goal: 50, max: 1 },
		{ id: 'DEEP_RAID', title: 'DEEP RAID', desc: 'Reach level 25 in one run', stat: 'bestLevel', goal: 25, max: 1 }
	];
	$.achievementDefs = DEFS;

	function store() {
		var a = $.storage[ 'ach' ];
		if( !a || typeof a !== 'object' ) { a = { counts: {}, done: {}, seen: {} }; $.storage[ 'ach' ] = a; }
		a.counts = a.counts || {}; a.done = a.done || {}; a.seen = a.seen || {};
		return a;
	}

	var banner = null, dirty = 0;

	function check( a ) {
		for( var i = 0; i < DEFS.length; i++ ) {
			var d = DEFS[ i ];
			if( a.done[ d.id ] ) { continue; }
			if( ( a.counts[ d.stat ] || 0 ) >= d.goal ) {
				a.done[ d.id ] = Date.now();
				banner = { title: d.title, t: 200 };
				if( $.sfx ) { $.sfx.play( 'warp' ); }
				try { window.dispatchEvent( new CustomEvent( 'raidshooter:achievement', { detail: d.id } ) ); } catch( e ) {}
			}
		}
	}

	// add to a counter (or raise a best-of counter) and unlock what it reaches
	$.achieve = function( stat, n, asMax ) {
		if( !$.storage ) { return; }
		var a = store(), cur = a.counts[ stat ] || 0;
		a.counts[ stat ] = asMax ? Math.max( cur, n ) : cur + ( n || 1 );
		dirty = 1;
		check( a );
	};
	// a set-like counter: counts each distinct key once (sectors seen, bosses met)
	$.achieveOnce = function( stat, key ) {
		if( !$.storage ) { return; }
		var a = store();
		a.seen[ stat ] = a.seen[ stat ] || {};
		if( a.seen[ stat ][ key ] ) { return; }
		a.seen[ stat ][ key ] = 1;
		$.achieve( stat, 1 );
	};

	// progress for the pilot screen: [{ id, title, desc, have, goal, done }]
	$.achievementProgress = function() {
		var a = store();
		return DEFS.map( function( d ) {
			return { id: d.id, title: d.title, desc: d.desc, have: Math.min( d.goal, a.counts[ d.stat ] || 0 ), goal: d.goal, done: a.done[ d.id ] || 0 };
		} );
	};

	// per-sector "untouched" tracking: a hit since entering the sector spoils it
	var sectorClean = true;
	$.achievementSectorEntered = function( title ) {
		$.achieveOnce( 'sectors', title );
		sectorClean = true;
	};
	$.achievementSectorCleared = function() {
		if( sectorClean ) { $.achieve( 'cleanSectors', 1 ); }
		sectorClean = true;
	};
	$.achievementHit = function() { sectorClean = false; };

	// save at most once a second, not on every crate
	$.achievementTick = function() {
		if( dirty && Math.floor( $.tick ) % 60 === 0 ) { dirty = 0; $.updateStorage(); }
		if( banner ) { banner.t -= $.dt; if( banner.t <= 0 ) { banner = null; } }
	};

	// the in-run banner, bottom centre, in the game's own type
	$.renderAchievementBanner = function() {
		if( !banner ) { return; }
		var a = Math.min( 1, banner.t / 30, ( 200 - banner.t ) / 15 ),
			y = $.ch - 120 - ( $.safeAreaBottom || 0 );
		$.ctxmg.save();
		$.ctxmg.globalAlpha = Math.max( 0, a );
		$.ctxmg.fillStyle = 'hsla(45, 100%, 8%, 0.75)';
		$.ctxmg.fillRect( $.cw / 2 - 210, y - 26, 420, 58 );
		$.ctxmg.strokeStyle = 'hsla(45, 100%, 60%, 0.8)';
		$.ctxmg.lineWidth = 1.5;
		$.ctxmg.strokeRect( $.cw / 2 - 210, y - 26, 420, 58 );
		$.ctxmg.beginPath();
		$.text( { ctx: $.ctxmg, x: $.cw / 2, y: y - 12, text: 'ACHIEVEMENT', hspacing: 2, vspacing: 1, halign: 'center', valign: 'top', scale: 1, snap: 1, render: 1 } );
		$.ctxmg.fillStyle = 'hsla(45, 100%, 70%, 1)';
		$.ctxmg.fill();
		$.ctxmg.beginPath();
		$.text( { ctx: $.ctxmg, x: $.cw / 2, y: y + 4, text: banner.title, hspacing: 2, vspacing: 1, halign: 'center', valign: 'top', scale: 2, snap: 1, render: 1 } );
		$.ctxmg.fillStyle = '#fff';
		$.ctxmg.fill();
		$.ctxmg.restore();
	};
} )();
