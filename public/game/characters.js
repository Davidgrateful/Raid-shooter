/*==============================================================================
Character Definitions

Characters are free and unlocked by playing - never sold. Shape and stats
come from the character; the color selector stays the player's identity
layer. Archetypes follow the silhouette rules: darts/arrows are fast and
fragile, rings/hexagons are armored and slow, diamonds/circles run balanced.

Draw functions render with the context already translated to the ship
center and rotated so +x is the facing direction.
==============================================================================*/
$.definitions.characters = [
	{
		id: 'onyix', title: 'ONYIX', desc: 'BALANCED FIGHTER',
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
		id: 'nova', title: 'NOVA', desc: 'FAST AND FRAGILE,\nRAPID DASH',
		speedMult: 1.25, damageTakenMult: 1.33, dashCooldownMult: 0.7, radius: 9,
		unlock: { stat: 'kills', value: 250, label: 'LIFETIME KILLS' },
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
		id: 'tankrex', title: 'TANK REX', desc: 'SLOW AND ARMORED',
		speedMult: 0.8, damageTakenMult: 0.7, dashCooldownMult: 1.3, radius: 13,
		unlock: { stat: 'bosskills', value: 1, label: 'BOSSES DEFEATED' },
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
		id: 'astravane', title: 'ASTRA VANE', desc: 'SWIFT KITE,\nLIGHT ARMOR',
		speedMult: 1.2, damageTakenMult: 1.2, dashCooldownMult: 0.85, radius: 9,
		unlock: { stat: 'kills', value: 500, label: 'LIFETIME KILLS' },
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
		id: 'ironhalo', title: 'IRON HALO', desc: 'ARMORED RING HULL',
		speedMult: 0.82, damageTakenMult: 0.7, dashCooldownMult: 1.3, radius: 12,
		unlock: { stat: 'bosskills', value: 2, label: 'BOSSES DEFEATED' },
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
		id: 'runepilot', title: 'RUNE PILOT', desc: 'GLYPHS ORBIT\nTHE HULL',
		speedMult: 1, damageTakenMult: 0.95, dashCooldownMult: 1, radius: 10,
		unlock: { stat: 'level', value: 8, label: 'BEST LEVEL' },
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
		id: 'nebulafox', title: 'NEBULA FOX', desc: 'QUICK HUNTER,\nTWIN TAILS',
		speedMult: 1.25, damageTakenMult: 1.25, dashCooldownMult: 0.8, radius: 9,
		unlock: { stat: 'kills', value: 1000, label: 'LIFETIME KILLS' },
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
		id: 'coresaint', title: 'CORE SAINT', desc: 'SHIELD PETALS,\nSTEADY HULL',
		speedMult: 0.85, damageTakenMult: 0.75, dashCooldownMult: 1.25, radius: 12,
		unlock: { stat: 'rounds', value: 20, label: 'ROUNDS PLAYED' },
		draw: function( ctx, r, fillStyle, tick ) {
			for( var p = 0; p < 4; p++ ) {
				var angle = p * $.pi / 2 + $.pi / 4;
				ctx.save();
				ctx.rotate( angle );
				ctx.beginPath();
				ctx.moveTo( r * 0.5, 0 ); ctx.lineTo( r * 1.4, r * 0.45 ); ctx.lineTo( r * 1.4, -r * 0.45 );
				ctx.closePath();
				ctx.fillStyle = fillStyle;
				ctx.fill();
				ctx.restore();
			}
			ctx.beginPath();
			ctx.arc( 0, 0, r * 0.65, 0, $.twopi );
			ctx.fillStyle = fillStyle;
			ctx.fill();
		}
	},
	{
		id: 'javelin9', title: 'JAVELIN 9', desc: 'NEEDLE NOSE,\nPURE SPEED',
		speedMult: 1.3, damageTakenMult: 1.3, dashCooldownMult: 0.75, radius: 8,
		unlock: { stat: 'kills', value: 2000, label: 'LIFETIME KILLS' },
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
		id: 'moonrazor', title: 'MOON RAZOR', desc: 'CRESCENT BLADE',
		speedMult: 1.2, damageTakenMult: 1.2, dashCooldownMult: 0.8, radius: 9,
		unlock: { stat: 'score', value: 5000, label: 'BEST SCORE' },
		draw: function( ctx, r, fillStyle, tick ) {
			ctx.beginPath();
			ctx.arc( 0, 0, r * 1.3, -$.pi * 0.55, $.pi * 0.55 );
			ctx.arc( -r * 0.7, 0, r * 1.05, $.pi * 0.45, -$.pi * 0.45, true );
			ctx.closePath();
			ctx.fillStyle = fillStyle;
			ctx.fill();
		}
	},
	{
		id: 'glitchprince', title: 'GLITCH PRINCE', desc: 'FRAGMENTED HULL',
		speedMult: 1.05, damageTakenMult: 1.05, dashCooldownMult: 0.95, radius: 10,
		unlock: { stat: 'level', value: 16, label: 'BEST LEVEL' },
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
		id: 'atlasbeam', title: 'ATLAS BEAM', desc: 'HEAVY CANNON FRAME',
		speedMult: 0.78, damageTakenMult: 0.68, dashCooldownMult: 1.35, radius: 13,
		unlock: { stat: 'bosskills', value: 4, label: 'BOSSES DEFEATED' },
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
		id: 'sparkwidow', title: 'SPARK WIDOW', desc: 'ELECTRIC LEGS',
		speedMult: 1.05, damageTakenMult: 1, dashCooldownMult: 0.95, radius: 10,
		unlock: { stat: 'powerups', value: 50, label: 'POWERUPS GRABBED' },
		draw: function( ctx, r, fillStyle, tick ) {
			ctx.beginPath();
			ctx.arc( 0, 0, r * 0.7, 0, $.twopi );
			ctx.fillStyle = fillStyle;
			ctx.fill();
			ctx.strokeStyle = fillStyle;
			ctx.lineWidth = 1.5;
			var twitch = Math.cos( tick / 9 ) * r * 0.12;
			for( var leg = 0; leg < 4; leg++ ) {
				var side = ( leg % 2 ) ? 1 : -1,
					fx = ( leg < 2 ) ? r * 0.4 : -r * 0.4;
				ctx.beginPath();
				ctx.moveTo( fx, side * r * 0.5 );
				ctx.lineTo( fx + r * 0.4, side * ( r * 1.1 + twitch ) );
				ctx.lineTo( fx + r * 0.9, side * ( r * 0.8 - twitch ) );
				ctx.stroke();
			}
		}
	},
	{
		id: 'ionbishop', title: 'ION BISHOP', desc: 'DIAGONAL WINGS',
		speedMult: 0.95, damageTakenMult: 0.9, dashCooldownMult: 1.05, radius: 11,
		unlock: { stat: 'level', value: 12, label: 'BEST LEVEL' },
		draw: function( ctx, r, fillStyle, tick ) {
			ctx.beginPath();
			ctx.moveTo( r * 1.5, 0 );
			ctx.lineTo( r * 0.3, r * 0.55 );
			ctx.lineTo( -r * 1.1, r * 0.4 );
			ctx.lineTo( -r * 0.7, 0 );
			ctx.lineTo( -r * 1.1, -r * 0.4 );
			ctx.lineTo( r * 0.3, -r * 0.55 );
			ctx.closePath();
			ctx.fillStyle = fillStyle;
			ctx.fill();
			ctx.beginPath();
			ctx.moveTo( -r * 0.2, r * 0.55 ); ctx.lineTo( -r * 1, r * 1.2 ); ctx.lineTo( -r * 1.3, r * 0.7 );
			ctx.closePath();
			ctx.fill();
			ctx.beginPath();
			ctx.moveTo( -r * 0.2, -r * 0.55 ); ctx.lineTo( -r, -r * 1.2 ); ctx.lineTo( -r * 1.3, -r * 0.7 );
			ctx.closePath();
			ctx.fill();
			ctx.beginPath();
			ctx.arc( r * 0.9, 0, r * 0.22, 0, $.twopi );
			ctx.fillStyle = 'hsla(190, 100%, 70%, 0.9)';
			ctx.fill();
		}
	},
	{
		id: 'redshift', title: 'REDSHIFT', desc: 'CRACKED ARROWHEAD',
		speedMult: 1.22, damageTakenMult: 1.22, dashCooldownMult: 0.82, radius: 9,
		unlock: { stat: 'score', value: 30000, label: 'BEST SCORE' },
		draw: function( ctx, r, fillStyle, tick ) {
			ctx.beginPath();
			ctx.moveTo( r * 1.9, 0 );
			ctx.lineTo( -r * 0.9, r * 0.95 );
			ctx.lineTo( -r * 0.45, 0 );
			ctx.lineTo( -r * 0.9, -r * 0.95 );
			ctx.closePath();
			ctx.fillStyle = fillStyle;
			ctx.fill();
			ctx.strokeStyle = 'hsla(0, 0%, 10%, 0.8)';
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo( r * 0.9, 0 ); ctx.lineTo( r * 0.2, r * 0.3 ); ctx.lineTo( -r * 0.3, r * 0.1 );
			ctx.moveTo( r * 0.5, -r * 0.15 ); ctx.lineTo( -r * 0.1, -r * 0.45 );
			ctx.stroke();
		}
	},
	{
		id: 'bluenova', title: 'BLUE NOVA', desc: 'EXPANDING STAR CORE',
		speedMult: 1, damageTakenMult: 1, dashCooldownMult: 0.9, radius: 10,
		unlock: { stat: 'combo', value: 15, label: 'BEST COMBO' },
		draw: function( ctx, r, fillStyle, tick ) {
			ctx.beginPath();
			ctx.arc( 0, 0, r * 0.7, 0, $.twopi );
			ctx.fillStyle = fillStyle;
			ctx.fill();
			var ringPhase = ( tick % 60 ) / 60;
			ctx.strokeStyle = 'hsla(210, 100%, 70%, ' + ( 0.7 - ringPhase * 0.7 ) + ')';
			ctx.lineWidth = 1.5;
			ctx.beginPath();
			ctx.arc( 0, 0, r * ( 0.8 + ringPhase * 1.1 ), 0, $.twopi );
			ctx.stroke();
		}
	},
	{
		id: 'cobaltwarden', title: 'COBALT WARDEN', desc: 'GUARD DRONES,\nSHIELD HULL',
		speedMult: 0.85, damageTakenMult: 0.72, dashCooldownMult: 1.25, radius: 12,
		unlock: { stat: 'bosskills', value: 6, label: 'BOSSES DEFEATED' },
		draw: function( ctx, r, fillStyle, tick ) {
			ctx.beginPath();
			ctx.moveTo( r * 1.4, 0 );
			ctx.lineTo( r * 0.4, r * 0.9 );
			ctx.lineTo( -r * 0.9, r * 0.75 );
			ctx.lineTo( -r * 0.9, -r * 0.75 );
			ctx.lineTo( r * 0.4, -r * 0.9 );
			ctx.closePath();
			ctx.fillStyle = fillStyle;
			ctx.fill();
			var orbit = tick / 22;
			for( var d = 0; d < 2; d++ ) {
				var angle = orbit + d * $.pi;
				ctx.fillRect( Math.cos( angle ) * r * 1.7 - r * 0.16, Math.sin( angle ) * r * 1.7 - r * 0.16, r * 0.32, r * 0.32 );
			}
		}
	},
	{
		id: 'luxrunner', title: 'LUX RUNNER', desc: 'BOOMERANG RACER',
		speedMult: 1.28, damageTakenMult: 1.28, dashCooldownMult: 0.78, radius: 9,
		unlock: { stat: 'score', value: 15000, label: 'BEST SCORE' },
		draw: function( ctx, r, fillStyle, tick ) {
			ctx.beginPath();
			ctx.moveTo( r * 1.6, 0 );
			ctx.quadraticCurveTo( r * 0.1, r * 0.4, -r * 0.6, r * 1.3 );
			ctx.lineTo( -r * 1.1, r * 0.9 );
			ctx.quadraticCurveTo( -r * 0.3, r * 0.1, -r * 1.1, -r * 0.9 );
			ctx.lineTo( -r * 0.6, -r * 1.3 );
			ctx.quadraticCurveTo( r * 0.1, -r * 0.4, r * 1.6, 0 );
			ctx.closePath();
			ctx.fillStyle = fillStyle;
			ctx.fill();
		}
	},
	{
		id: 'gravkid', title: 'GRAV KID', desc: 'ORBITING GRAVITY DOTS',
		speedMult: 1.02, damageTakenMult: 1, dashCooldownMult: 0.92, radius: 9,
		unlock: { stat: 'rounds', value: 40, label: 'ROUNDS PLAYED' },
		draw: function( ctx, r, fillStyle, tick ) {
			ctx.beginPath();
			ctx.arc( 0, 0, r * 0.65, 0, $.twopi );
			ctx.fillStyle = fillStyle;
			ctx.fill();
			for( var d = 0; d < 3; d++ ) {
				var angle = tick / ( 14 + d * 6 ) + d * $.twopi / 3,
					dist = r * ( 1.1 + d * 0.35 );
				ctx.beginPath();
				ctx.arc( Math.cos( angle ) * dist, Math.sin( angle ) * dist, r * 0.18, 0, $.twopi );
				ctx.fill();
			}
		}
	},
	{
		id: 'steelseraph', title: 'STEEL SERAPH', desc: 'METAL FEATHER WINGS',
		speedMult: 0.84, damageTakenMult: 0.74, dashCooldownMult: 1.28, radius: 12,
		unlock: { stat: 'bosskills', value: 10, label: 'BOSSES DEFEATED' },
		draw: function( ctx, r, fillStyle, tick ) {
			ctx.beginPath();
			ctx.moveTo( r * 1.5, 0 );
			ctx.lineTo( -r * 0.7, r * 0.4 );
			ctx.lineTo( -r * 0.7, -r * 0.4 );
			ctx.closePath();
			ctx.fillStyle = fillStyle;
			ctx.fill();
			for( var f = 0; f < 3; f++ ) {
				var fx = -r * 0.2 - f * r * 0.4;
				ctx.save();
				ctx.globalAlpha = 1 - f * 0.22;
				ctx.beginPath();
				ctx.moveTo( fx, r * 0.3 ); ctx.lineTo( fx - r * 0.5, r * 1.4 - f * r * 0.2 ); ctx.lineTo( fx - r * 0.75, r * 0.35 );
				ctx.closePath();
				ctx.fill();
				ctx.beginPath();
				ctx.moveTo( fx, -r * 0.3 ); ctx.lineTo( fx - r * 0.5, -r * 1.4 + f * r * 0.2 ); ctx.lineTo( fx - r * 0.75, -r * 0.35 );
				ctx.closePath();
				ctx.fill();
				ctx.restore();
			}
		}
	},
	{
		id: 'nightvector', title: 'NIGHT VECTOR', desc: 'STEALTH EDGE',
		speedMult: 1.26, damageTakenMult: 1.26, dashCooldownMult: 0.8, radius: 9,
		unlock: { stat: 'kills', value: 4000, label: 'LIFETIME KILLS' },
		draw: function( ctx, r, fillStyle, tick ) {
			ctx.beginPath();
			ctx.moveTo( r * 1.9, 0 );
			ctx.lineTo( -r * 1.1, r * 0.8 );
			ctx.lineTo( -r * 0.6, 0 );
			ctx.lineTo( -r * 1.1, -r * 0.8 );
			ctx.closePath();
			ctx.fillStyle = 'hsla(0, 0%, 12%, 1)';
			ctx.fill();
			ctx.strokeStyle = fillStyle;
			ctx.lineWidth = 1.5;
			ctx.stroke();
		}
	},
	{
		id: 'plasmamuse', title: 'PLASMA MUSE', desc: 'FLOWING PLASMA\nRIBBONS',
		speedMult: 1.08, damageTakenMult: 1.08, dashCooldownMult: 0.9, radius: 10,
		unlock: { stat: 'combo', value: 30, label: 'BEST COMBO' },
		draw: function( ctx, r, fillStyle, tick ) {
			ctx.strokeStyle = fillStyle;
			ctx.lineWidth = r * 0.5;
			ctx.lineCap = 'round';
			ctx.beginPath();
			ctx.moveTo( r * 1.4, -r * 0.4 );
			ctx.bezierCurveTo( r * 0.4, r * 0.9, -r * 0.4, -r * 0.9, -r * 1.4, r * 0.4 );
			ctx.stroke();
			ctx.lineWidth = 1.5;
			var wave = Math.cos( tick / 8 ) * r * 0.25;
			ctx.beginPath();
			ctx.moveTo( -r * 0.9, r * 0.3 + wave );
			ctx.quadraticCurveTo( -r * 1.6, r * 0.1, -r * 2.1, r * 0.5 + wave );
			ctx.stroke();
			ctx.lineCap = 'butt';
		}
	},
	{
		id: 'quantumbelle', title: 'QUANTUM BELLE', desc: 'MIRRORED HALVES',
		speedMult: 1.05, damageTakenMult: 0.95, dashCooldownMult: 0.95, radius: 10,
		unlock: { stat: 'score', value: 60000, label: 'BEST SCORE' },
		draw: function( ctx, r, fillStyle, tick ) {
			var split = r * 0.12 + Math.cos( tick / 16 ) * r * 0.06;
			ctx.fillStyle = fillStyle;
			ctx.beginPath();
			ctx.moveTo( r * 1.5 + split, 0 );
			ctx.lineTo( split, r * 0.85 );
			ctx.lineTo( split, -r * 0.85 );
			ctx.closePath();
			ctx.fill();
			ctx.beginPath();
			ctx.moveTo( -r * 1.5 - split, 0 );
			ctx.lineTo( -split, r * 0.85 );
			ctx.lineTo( -split, -r * 0.85 );
			ctx.closePath();
			ctx.fill();
		}
	},
	{
		id: 'volt', title: 'VOLT', comingSoon: 1,
		draw: function( ctx, r, fillStyle, tick ) {
			ctx.beginPath();
			ctx.moveTo( r * 1.4, 0 ); ctx.lineTo( 0, r * 0.9 ); ctx.lineTo( -r * 1.2, 0 ); ctx.lineTo( 0, -r * 0.9 );
			ctx.closePath();
			ctx.fillStyle = fillStyle;
			ctx.fill();
			ctx.strokeStyle = 'hsla(190, 100%, 70%, 0.9)';
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo( r * 0.6, r * 0.5 ); ctx.lineTo( r * 1.6, r * 0.7 );
			ctx.moveTo( r * 0.6, -r * 0.5 ); ctx.lineTo( r * 1.6, -r * 0.7 );
			ctx.stroke();
		}
	},
	{
		id: 'echo', title: 'ECHO', comingSoon: 1,
		draw: function( ctx, r, fillStyle, tick ) {
			ctx.beginPath();
			ctx.arc( 0, 0, r * 0.75, 0, $.twopi );
			ctx.fillStyle = fillStyle;
			ctx.fill();
			var orbit = tick / 18;
			for( var d = 0; d < 2; d++ ) {
				var angle = orbit + d * $.pi;
				ctx.beginPath();
				ctx.arc( Math.cos( angle ) * r * 1.6, Math.sin( angle ) * r * 1.6, r * 0.3, 0, $.twopi );
				ctx.fill();
			}
		}
	},
	{
		id: 'shade', title: 'SHADE', comingSoon: 1,
		draw: function( ctx, r, fillStyle, tick ) {
			ctx.beginPath();
			ctx.arc( 0, 0, r * 1.2, -$.pi * 0.62, $.pi * 0.62 );
			ctx.arc( -r * 0.85, 0, r * 0.95, $.pi * 0.5, -$.pi * 0.5, true );
			ctx.closePath();
			ctx.fillStyle = fillStyle;
			ctx.fill();
		}
	},
	{
		id: 'blaze', title: 'BLAZE', comingSoon: 1,
		draw: function( ctx, r, fillStyle, tick ) {
			ctx.beginPath();
			ctx.moveTo( r * 1.7, 0 );
			ctx.lineTo( -r * 0.3, r * 0.8 );
			ctx.lineTo( -r * 1.1, r * 0.5 );
			ctx.lineTo( -r * 0.5, r * 0.15 );
			ctx.lineTo( -r * 1.3, 0 );
			ctx.lineTo( -r * 0.5, -r * 0.15 );
			ctx.lineTo( -r * 1.1, -r * 0.5 );
			ctx.lineTo( -r * 0.3, -r * 0.8 );
			ctx.closePath();
			ctx.fillStyle = fillStyle;
			ctx.fill();
		}
	},
	{
		id: 'orbit', title: 'ORBIT', comingSoon: 1,
		draw: function( ctx, r, fillStyle, tick ) {
			ctx.beginPath();
			ctx.arc( 0, 0, r * 0.8, 0, $.twopi );
			ctx.fillStyle = fillStyle;
			ctx.fill();
			var spin = tick / 14;
			ctx.strokeStyle = fillStyle;
			ctx.lineWidth = 2;
			for( var s = 0; s < 2; s++ ) {
				ctx.beginPath();
				ctx.arc( 0, 0, r * 1.5, spin + s * $.pi, spin + s * $.pi + $.pi * 0.6 );
				ctx.stroke();
			}
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
	return ( $.storage[ def.unlock.stat ] || 0 ) >= def.unlock.value;
};

$.currentCharacter = function() {
	var index = $.storage['character'] || 0,
		def = $.definitions.characters[ index ];
	if( !def || !$.characterUnlocked( def ) ) {
		return $.definitions.characters[ 0 ];
	}
	return def;
};

$.characterStatus = function( def ) {
	if( def.comingSoon ) {
		return { text: 'COMING SOON', color: 'hsla(0, 0%, 100%, 0.35)' };
	}
	if( !$.characterUnlocked( def ) ) {
		return {
			text: 'LOCKED: ' + ( $.storage[ def.unlock.stat ] || 0 ) + '/' + def.unlock.value + ' ' + def.unlock.label,
			color: 'hsla(0, 0%, 100%, 0.35)'
		};
	}
	if( $.definitions.characters[ $.storage['character'] || 0 ] === def ) {
		return { text: 'SELECTED', color: 'hsla(45, 100%, 65%, 0.9)' };
	}
	return { text: def.desc, color: 'hsla(0, 0%, 100%, 0.55)' };
};
