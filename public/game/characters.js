/*==============================================================================
Character Definitions

Onyix is the free starter. Every other pilot is purchase-only
(unlock: { purchase }) - you must buy it in the market to fly it. Shape
and stats come from the character; the color selector stays the player's identity
layer. Archetypes follow the silhouette rules: darts/arrows are fast and
fragile, rings/hexagons are armored and slow, diamonds/circles run balanced.

Draw functions render with the context already translated to the ship
center and rotated so +x is the facing direction.
==============================================================================*/
$.definitions.characters = [
	{
		id: 'onyix', ability: { title: 'FOUNDER', text: 'START WITH A FREE UPGRADE', startUpgrade: 1 }, bulletStyle: { size: 15, lineWidth: 2 }, title: 'ONYIX', desc: 'BALANCED FIGHTER',
		speedMult: 1, damageTakenMult: 1, dashCooldownMult: 1, radius: 10,
		unlock: null,
		draw: function( ctx, r, fillStyle, tick ) {
			ctx.beginPath();
			ctx.moveTo( r * 1.7, 0 );
			ctx.lineTo( -r * 0.4, r * 0.55 );
			ctx.lineTo( -r * 0.1, r * 0.55 );
			ctx.lineTo( -r * 1.1, r * 1.2 );
			ctx.lineTo( -r * 0.8, r * 0.25 );
			ctx.lineTo( -r * 0.8, -r * 0.25 );
			ctx.lineTo( -r * 1.1, -r * 1.2 );
			ctx.lineTo( -r * 0.1, -r * 0.55 );
			ctx.lineTo( -r * 0.4, -r * 0.55 );
			ctx.closePath();
			ctx.fillStyle = fillStyle;
			ctx.fill();
			var pulse = 0.55 + Math.cos( tick / 6 ) * 0.15 + ( ( $.comboMultiplier || 1 ) - 1 ) * 0.05;
			ctx.beginPath();
			ctx.arc( r * 0.1, 0, r * 0.42, 0, $.twopi );
			ctx.fillStyle = 'hsla(45, 100%, 65%, ' + pulse + ')';
			ctx.fill();
		}
	},
	{
		id: 'nova', ability: { title: 'SLIPSTREAM', text: 'LONGER DASH', dashDuration: 1.4 }, bulletStyle: { size: 22, lineWidth: 1.5 }, title: 'NOVA', desc: 'FAST AND FRAGILE,\nRAPID DASH',
		speedMult: 1.25, damageTakenMult: 1.33, dashCooldownMult: 0.7, radius: 9,
		unlock: { purchase: 'pilot_nova' },
		draw: function( ctx, r, fillStyle, tick ) {
			ctx.beginPath();
			ctx.moveTo( r * 2.1, 0 );
			ctx.lineTo( -r * 0.9, r * 0.45 );
			ctx.lineTo( -r * 0.5, 0 );
			ctx.lineTo( -r * 0.9, -r * 0.45 );
			ctx.closePath();
			ctx.fillStyle = fillStyle;
			ctx.fill();
			ctx.fillRect( -r * 1.2, r * 0.25, r * 0.5, r * 0.18 );
			ctx.fillRect( -r * 1.2, -r * 0.43, r * 0.5, r * 0.18 );
		}
	},
	{
		id: 'tankrex', ability: { title: 'BULWARK', text: 'RESIST WHEN BADLY HURT', lowHpResist: 0.65 }, bulletStyle: { size: 11, lineWidth: 4 }, title: 'TANK REX', desc: 'SLOW AND ARMORED',
		speedMult: 0.8, damageTakenMult: 0.7, dashCooldownMult: 1.3, radius: 13,
		unlock: { purchase: 'pilot_tankrex' },
		draw: function( ctx, r, fillStyle, tick ) {
			ctx.beginPath();
			for( var p = 0; p < 6; p++ ) {
				var angle = ( p / 6 ) * $.twopi,
					px = Math.cos( angle ) * r * 1.1,
					py = Math.sin( angle ) * r * 0.95;
				if( p === 0 ) { ctx.moveTo( px, py ); } else { ctx.lineTo( px, py ); }
			}
			ctx.closePath();
			ctx.fillStyle = fillStyle;
			ctx.fill();
			ctx.fillStyle = 'hsla(0, 0%, 45%, 1)';
			ctx.fillRect( -r * 0.7, r * 0.85, r * 1.4, r * 0.35 );
			ctx.fillRect( -r * 0.7, -r * 1.2, r * 1.4, r * 0.35 );
			ctx.fillStyle = fillStyle;
			ctx.fillRect( r * 1.0, -r * 0.15, r * 0.55, r * 0.3 );
		}
	},
	{
		id: 'astravane', ability: { title: 'TAILWIND', text: 'LONGER COMBO WINDOW', combo: 1.35 }, bulletStyle: { size: 18, lineWidth: 2 }, title: 'ASTRA VANE', desc: 'SWIFT KITE,\nLIGHT ARMOR',
		speedMult: 1.2, damageTakenMult: 1.2, dashCooldownMult: 0.85, radius: 9,
		unlock: { purchase: 'pilot_astravane' },
		draw: function( ctx, r, fillStyle, tick ) {
			ctx.beginPath();
			ctx.moveTo( r * 1.8, 0 );
			ctx.lineTo( -r * 0.2, r * 0.9 );
			ctx.lineTo( -r, r * 0.5 );
			ctx.lineTo( -r * 0.6, 0 );
			ctx.lineTo( -r, -r * 0.5 );
			ctx.lineTo( -r * 0.2, -r * 0.9 );
			ctx.closePath();
			ctx.fillStyle = fillStyle;
			ctx.fill();
			ctx.strokeStyle = fillStyle;
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo( -r * 1.1, r * 0.7 ); ctx.lineTo( -r * 1.6, r * 0.9 );
			ctx.moveTo( -r * 1.1, -r * 0.7 ); ctx.lineTo( -r * 1.6, -r * 0.9 );
			ctx.stroke();
		}
	},
	{
		id: 'ironhalo', ability: { title: 'OVERCHARGER', text: 'POWERUPS LAST LONGER', powerupDuration: 1.4 }, bulletStyle: { size: 12, lineWidth: 3.5 }, title: 'IRON HALO', desc: 'ARMORED RING HULL',
		speedMult: 0.82, damageTakenMult: 0.7, dashCooldownMult: 1.3, radius: 12,
		unlock: { purchase: 'pilot_ironhalo' },
		draw: function( ctx, r, fillStyle, tick ) {
			ctx.beginPath();
			ctx.arc( 0, 0, r * 0.55, 0, $.twopi );
			ctx.fillStyle = fillStyle;
			ctx.fill();
			ctx.strokeStyle = fillStyle;
			ctx.lineWidth = r * 0.35;
			ctx.beginPath();
			ctx.arc( 0, 0, r * 1.05, 0, $.twopi );
			ctx.stroke();
		}
	},
	{
		id: 'runepilot', ability: { title: 'SCAVENGER', text: 'MORE POWERUP DROPS', drop: 1.4 }, bulletStyle: { size: 15, lineWidth: 2.5 }, title: 'RUNE PILOT', desc: 'GLYPHS ORBIT\nTHE HULL',
		speedMult: 1, damageTakenMult: 0.95, dashCooldownMult: 1, radius: 10,
		unlock: { purchase: 'pilot_runepilot' },
		draw: function( ctx, r, fillStyle, tick ) {
			ctx.beginPath();
			ctx.moveTo( r * 1.3, 0 ); ctx.lineTo( 0, r * 0.85 ); ctx.lineTo( -r * 1.1, 0 ); ctx.lineTo( 0, -r * 0.85 );
			ctx.closePath();
			ctx.fillStyle = fillStyle;
			ctx.fill();
			for( var g = 0; g < 3; g++ ) {
				var angle = tick / 25 + g * $.twopi / 3,
					gx = Math.cos( angle ) * r * 1.6,
					gy = Math.sin( angle ) * r * 1.6;
				ctx.beginPath();
				ctx.moveTo( gx, gy - r * 0.25 ); ctx.lineTo( gx + r * 0.22, gy + r * 0.18 ); ctx.lineTo( gx - r * 0.22, gy + r * 0.18 );
				ctx.closePath();
				ctx.fill();
			}
		}
	},
	{
		id: 'nebulafox', ability: { title: 'VAMPIRE', text: 'HEAL HP FROM KILLS', killHealMult: 2 }, bulletStyle: { size: 17, lineWidth: 1.8 }, title: 'NEBULA FOX', desc: 'QUICK HUNTER,\nTWIN TAILS',
		speedMult: 1.25, damageTakenMult: 1.25, dashCooldownMult: 0.8, radius: 9,
		unlock: { purchase: 'pilot_nebulafox' },
		draw: function( ctx, r, fillStyle, tick ) {
			ctx.beginPath();
			ctx.moveTo( r * 1.6, 0 );
			ctx.lineTo( -r * 0.2, r );
			ctx.lineTo( -r * 0.5, r * 0.35 );
			ctx.lineTo( -r * 0.9, 0 );
			ctx.lineTo( -r * 0.5, -r * 0.35 );
			ctx.lineTo( -r * 0.2, -r );
			ctx.closePath();
			ctx.fillStyle = fillStyle;
			ctx.fill();
			ctx.strokeStyle = fillStyle;
			ctx.lineWidth = 1.5;
			ctx.beginPath();
			ctx.moveTo( -r * 0.9, r * 0.2 ); ctx.quadraticCurveTo( -r * 1.6, r * 0.6, -r * 2, r * 0.3 );
			ctx.moveTo( -r * 0.9, -r * 0.2 ); ctx.quadraticCurveTo( -r * 1.6, -r * 0.6, -r * 2, -r * 0.3 );
			ctx.stroke();
		}
	},
	{
		id: 'javelin9', ability: { title: 'LANCER', text: 'FASTER BULLETS', bulletSpeed: 1.25 }, bulletStyle: { size: 26, lineWidth: 1.5 }, title: 'JAVELIN 9', desc: 'NEEDLE NOSE,\nPURE SPEED',
		speedMult: 1.3, damageTakenMult: 1.3, dashCooldownMult: 0.75, radius: 8,
		unlock: { purchase: 'pilot_javelin9' },
		draw: function( ctx, r, fillStyle, tick ) {
			ctx.beginPath();
			ctx.moveTo( r * 2.3, 0 );
			ctx.lineTo( -r * 1.1, r * 0.25 );
			ctx.lineTo( -r * 0.8, 0 );
			ctx.lineTo( -r * 1.1, -r * 0.25 );
			ctx.closePath();
			ctx.fillStyle = fillStyle;
			ctx.fill();
			ctx.fillRect( r * 0.2, -r * 0.55, r * 0.18, r * 1.1 );
		}
	},
	{
		id: 'atlasbeam', ability: { title: 'HEAVY CAL', text: 'SHARPER DAMAGE', damage: 1.2 }, bulletStyle: { size: 13, lineWidth: 5 }, title: 'ATLAS BEAM', desc: 'HEAVY CANNON FRAME',
		speedMult: 0.78, damageTakenMult: 0.68, dashCooldownMult: 1.35, radius: 13,
		unlock: { purchase: 'pilot_atlasbeam' },
		draw: function( ctx, r, fillStyle, tick ) {
			ctx.fillStyle = fillStyle;
			ctx.fillRect( -r * 1.1, -r * 0.85, r * 1.6, r * 1.7 );
			ctx.fillRect( r * 0.5, -r * 0.3, r * 1.2, r * 0.6 );
			var glow = 0.5 + Math.cos( tick / 7 ) * 0.25;
			ctx.beginPath();
			ctx.arc( r * 1.7, 0, r * 0.28, 0, $.twopi );
			ctx.fillStyle = 'hsla(35, 100%, 65%, ' + glow + ')';
			ctx.fill();
		}
	},
	{
		id: 'glitchprince', ability: { title: 'JITTER', text: 'FASTER FIRING', fireRate: 0.88 }, bulletStyle: { size: 16, lineWidth: 2.5 }, title: 'GLITCH PRINCE', desc: 'FRAGMENTED HULL',
		speedMult: 1.05, damageTakenMult: 1.05, dashCooldownMult: 0.95, radius: 10,
		unlock: { purchase: 'pilot_glitchprince' },
		draw: function( ctx, r, fillStyle, tick ) {
			ctx.beginPath();
			ctx.moveTo( r * 1.3, 0 ); ctx.lineTo( 0, r * 0.9 ); ctx.lineTo( -r * 1.1, 0 ); ctx.lineTo( 0, -r * 0.9 );
			ctx.closePath();
			ctx.fillStyle = fillStyle;
			ctx.fill();
			var jitter = ( Math.floor( tick / 20 ) % 2 ) ? r * 0.18 : -r * 0.12;
			ctx.globalAlpha = 0.55;
			ctx.fillRect( r * 0.45 + jitter, -r * 0.65, r * 0.5, r * 0.5 );
			ctx.fillRect( -r * 1.05 - jitter, r * 0.3, r * 0.45, r * 0.45 );
			ctx.globalAlpha = 1;
		}
	},
	{
		// premium pilot: instant unlock via the market, no grind gate.
		// kept mid-roster power (sidegrade, not best-in-class) so paying
		// skips the wait for a look, not a score advantage.
		id: 'solstice', ability: { title: 'OVERDRIVE', text: 'FASTER BULLETS, LIGHTER ARMOR', bulletSpeed: 1.15 }, bulletStyle: { size: 20, lineWidth: 1.6 }, title: 'SOLSTICE', desc: 'PREMIUM PILOT\nGLASS CANNON',
		speedMult: 1.05, damageTakenMult: 1.1, dashCooldownMult: 1, radius: 10,
		unlock: { purchase: 'pilot_solstice' },
		draw: function( ctx, r, fillStyle, tick ) {
			ctx.beginPath();
			ctx.moveTo( r * 1.8, 0 );
			ctx.lineTo( -r * 0.2, r * 0.5 );
			ctx.lineTo( -r * 1.2, r * 0.7 );
			ctx.lineTo( -r * 0.6, 0 );
			ctx.lineTo( -r * 1.2, -r * 0.7 );
			ctx.lineTo( -r * 0.2, -r * 0.5 );
			ctx.closePath();
			ctx.fillStyle = fillStyle;
			ctx.fill();
			var glow = 0.5 + Math.sin( tick / 8 ) * 0.3;
			ctx.beginPath();
			ctx.arc( r * 0.7, 0, r * 0.3, 0, $.twopi );
			ctx.fillStyle = 'hsla(35, 100%, 60%, ' + glow + ')';
			ctx.fill();
		}
	},
	{
		// premium pilot: instant unlock via the market, no grind gate.
		id: 'crimsonwisp', ability: { title: 'EMBER WAKE', text: 'HEAL HP FROM KILLS', killHealMult: 1.5 }, bulletStyle: { size: 15, lineWidth: 2.2 }, title: 'CRIMSON WISP', desc: 'PREMIUM PILOT\nDRIFTING EMBER HULL',
		speedMult: 1, damageTakenMult: 1, dashCooldownMult: 1.05, radius: 10,
		unlock: { purchase: 'pilot_crimsonwisp' },
		draw: function( ctx, r, fillStyle, tick ) {
			ctx.beginPath();
			ctx.arc( r * 0.2, 0, r * 0.85, 0, $.twopi );
			ctx.fillStyle = fillStyle;
			ctx.fill();
			var flicker = 0.4 + Math.cos( tick / 7 ) * 0.25;
			ctx.beginPath();
			ctx.moveTo( -r * 0.6, 0 );
			ctx.lineTo( -r * 1.6, r * 0.4 );
			ctx.lineTo( -r * 1.1, 0 );
			ctx.lineTo( -r * 1.6, -r * 0.4 );
			ctx.closePath();
			ctx.fillStyle = 'hsla(10, 100%, 55%, ' + flicker + ')';
			ctx.fill();
		}
	}
];

/*==============================================================================
Character Helpers
==============================================================================*/
$.characterUnlocked = function( def ) {
	if( def.comingSoon ) {
		return false;
	}
	if( !def.unlock ) {
		return true;
	}
	if( def.unlock.purchase && $.ownsItem( def.unlock.purchase ) ) {
		return true;
	}
	if( !def.unlock.stat ) {
		return false;
	}
	return ( $.storage[ def.unlock.stat ] || 0 ) >= def.unlock.value;
};

$.currentCharacter = function() {
	var index = $.storage['character'] || 0,
		def = $.definitions.characters[ index ];
	if( !def || !$.characterUnlocked( def ) ) {
		// reset a stale or locked selection so it stops silently overriding
		$.storage['character'] = 0;
		return $.definitions.characters[ 0 ];
	}
	return def;
};

$.characterStatus = function( def ) {
	if( def.comingSoon ) {
		return { text: 'COMING SOON', color: 'hsla(0, 0%, 100%, 0.35)' };
	}
	if( !$.characterUnlocked( def ) ) {
		if( !def.unlock.stat ) {
			return { text: 'BUY IN MARKET', color: 'hsla(0, 0%, 100%, 0.35)' };
		}
		return {
			text: 'LOCKED: ' + ( $.storage[ def.unlock.stat ] || 0 ) + '/' + def.unlock.value + ' ' + def.unlock.label +
				( def.unlock.purchase ? ' / OR BUY IN MARKET' : '' ),
			color: 'hsla(0, 0%, 100%, 0.35)'
		};
	}
	if( $.definitions.characters[ $.storage['character'] || 0 ] === def ) {
		return { text: 'SELECTED', color: 'hsla(45, 100%, 65%, 0.9)' };
	}
	return { text: def.desc, color: 'hsla(0, 0%, 100%, 0.55)' };
};

/*==============================================================================
Grid Card (hangar grid view)
==============================================================================*/
$.GridCard = function( opt ) {
	for( var k in opt ) {
		this[k] = opt[k];
	}
	this.sx = this.x - this.width / 2;
	this.sy = this.y - this.height / 2;
	this.cx = this.x;
	this.cy = this.y;
	this.ex = this.x + this.width / 2;
	this.ey = this.y + this.height / 2;
	this.hovering = 0;
	this.ohovering = 0;
};

$.GridCard.prototype.update = function( i ) {
	if( $.util.pointInRect( $.mouse.sx, $.mouse.sy, this.sx, this.sy, this.width, this.height ) ){
		this.hovering = 1;
		if( !this.ohovering ) {
			$.audio.play( 'hover' );
		}
	} else {
		this.hovering = 0;
	}
	this.ohovering = this.hovering;

	if( this.hovering && $.mouse.down ) {
		$.mouse.down = 0;
		$.audio.play( 'click' );
		$.hangarIndex = this.charIndex;
		$.hangarView = 'ship';
		$.hangarKeep = 1;
		$.setState( 'hangar' );
	}
};

$.GridCard.prototype.render = function( i ) {
	var unlocked = $.characterUnlocked( this.def ),
		selected = ( ( $.storage['character'] || 0 ) === this.charIndex );

	$.ctxmg.fillStyle = this.hovering ? 'hsla(0, 0%, 10%, 1)' : 'hsla(0, 0%, 0%, 1)';
	$.ctxmg.fillRect( Math.floor( this.sx ), Math.floor( this.sy ), this.width, this.height );
	if( selected ) {
		$.ctxmg.strokeStyle = 'hsla(45, 100%, 65%, 0.9)';
	} else {
		$.ctxmg.strokeStyle = this.hovering ? 'hsla(0, 0%, 100%, 0.4)' : 'hsla(0, 0%, 100%, 0.15)';
	}
	$.ctxmg.strokeRect( Math.floor( this.sx ) + 0.5, Math.floor( this.sy ) + 0.5, this.width - 1, this.height - 1 );

	$.ctxmg.save();
	$.ctxmg.translate( this.cx, this.sy + this.height * 0.42 );
	$.ctxmg.rotate( -$.pi / 2 );
	this.def.draw( $.ctxmg, Math.min( 11, this.height * 0.14 ), unlocked ? '#fff' : 'hsla(0, 0%, 35%, 1)', $.tick );
	$.ctxmg.restore();

	$.ctxmg.beginPath();
	$.text( {
		ctx: $.ctxmg,
		x: this.cx,
		y: this.ey - 10,
		text: this.def.title,
		hspacing: 1,
		vspacing: 1,
		halign: 'center',
		valign: 'bottom',
		scale: 1,
		snap: 1,
		render: 1
	} );
	$.ctxmg.fillStyle = unlocked ? 'hsla(0, 0%, 100%, 0.85)' : 'hsla(0, 0%, 100%, 0.3)';
	$.ctxmg.fill();
};

/*==============================================================================
Pilot Levels - free, grind-only progression per pilot (max level 10).
Deliberately slow: kills earn tiny XP, and each level needs much more than
the last, so reaching level 10 takes a long, dedicated run history. Levels
are never sold and never granted by the market - only played for.
==============================================================================*/
$.pilotLevelThresholds = [ 0, 400, 1000, 2000, 3600, 6000, 9500, 14500, 21500, 31000 ];
$.pilotMaxLevel = 10;

$.pilotXp = function( id ) {
	return ( $.storage['pilotxp'] && $.storage['pilotxp'][ id ] ) || 0;
};

$.pilotLevel = function( id ) {
	var xp = $.pilotXp( id ),
		level = 1;
	for( var i = 1; i < $.pilotLevelThresholds.length; i++ ) {
		if( xp >= $.pilotLevelThresholds[ i ] ) {
			level = i + 1;
		}
	}
	return Math.min( $.pilotMaxLevel, level );
};

// each level trims a sliver of damage taken - capped low so a maxed pilot
// is a nice-to-have, not a different game from a fresh one
$.pilotLevelDamageMult = function( id ) {
	return 1 - ( $.pilotLevel( id ) - 1 ) * 0.01;
};

$.pilotXpToNext = function( id ) {
	var level = $.pilotLevel( id );
	if( level >= $.pilotMaxLevel ) {
		return null;
	}
	return { xp: $.pilotXp( id ), next: $.pilotLevelThresholds[ level ] };
};

// kills are tallied during the run and committed to storage once, at
// gameover, alongside the rest of the run's stat bookkeeping
$.gainPilotXp = function( id, amount ) {
	$.storage['pilotxp'][ id ] = ( $.storage['pilotxp'][ id ] || 0 ) + amount;
};
