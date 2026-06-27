/*==============================================================================
Combat Drones - market-bought passive loadout companions

One drone equips at a time ($.storage['drone']). Each grants a single,
deliberately modest passive effect applied in hero.js/bullet.js/enemy.js -
strong enough to change how a run feels, not strong enough to be a
must-buy power spike.
==============================================================================*/
$.definitions.drones = [
	{
		id: 'drone_aegis', title: 'AEGIS HALO', desc: 'REDUCES COLLISION DAMAGE',
		// a closed ring - a shield silhouette
		draw: function( ctx, r, fillStyle, tick ) {
			ctx.strokeStyle = fillStyle;
			ctx.lineWidth = r * 0.4;
			ctx.beginPath();
			ctx.arc( 0, 0, r * 0.75, 0, $.twopi );
			ctx.stroke();
		}
	},
	{
		id: 'drone_voltmite', title: 'VOLT MITE', desc: 'SHOTS CHAIN TO A NEARBY ENEMY',
		// a jagged spark/diamond
		draw: function( ctx, r, fillStyle, tick ) {
			ctx.beginPath();
			ctx.moveTo( 0, -r );
			ctx.lineTo( r * 0.35, -r * 0.15 );
			ctx.lineTo( r * 0.9, -r * 0.15 );
			ctx.lineTo( r * 0.2, r );
			ctx.lineTo( r * 0.05, r * 0.2 );
			ctx.lineTo( -r * 0.55, r * 0.2 );
			ctx.closePath();
			ctx.fillStyle = fillStyle;
			ctx.fill();
		}
	},
	{
		id: 'drone_needlefinch', title: 'NEEDLE FINCH', desc: 'BULLETS PIERCE ENEMIES',
		// a thin needle/arrow
		draw: function( ctx, r, fillStyle, tick ) {
			ctx.beginPath();
			ctx.moveTo( 0, -r );
			ctx.lineTo( r * 0.22, r * 0.5 );
			ctx.lineTo( 0, r * 0.25 );
			ctx.lineTo( -r * 0.22, r * 0.5 );
			ctx.closePath();
			ctx.fillStyle = fillStyle;
			ctx.fill();
		}
	},
	{
		id: 'drone_gravbeetle', title: 'GRAV BEETLE', desc: 'PULLS NEARBY ENEMIES INWARD',
		// a spiral/orbit pulling inward
		draw: function( ctx, r, fillStyle, tick ) {
			ctx.strokeStyle = fillStyle;
			ctx.lineWidth = r * 0.16;
			ctx.beginPath();
			var turns = 2.1, steps = 24;
			for( var s = 0; s <= steps; s++ ) {
				var t = s / steps,
					angle = t * turns * $.twopi + ( tick || 0 ) / 20,
					rad = r * ( 0.95 - t * 0.8 ),
					x = Math.cos( angle ) * rad,
					y = Math.sin( angle ) * rad;
				if( s === 0 ) { ctx.moveTo( x, y ); } else { ctx.lineTo( x, y ); }
			}
			ctx.stroke();
		}
	},
	{
		id: 'drone_medicwisp', title: 'MEDIC WISP', desc: 'SLOWLY REGENERATES HULL',
		// a cross inside an orb
		draw: function( ctx, r, fillStyle, tick ) {
			ctx.beginPath();
			ctx.arc( 0, 0, r * 0.8, 0, $.twopi );
			ctx.fillStyle = fillStyle;
			ctx.globalAlpha = 0.3;
			ctx.fill();
			ctx.globalAlpha = 1;
			ctx.fillRect( -r * 0.16, -r * 0.6, r * 0.32, r * 1.2 );
			ctx.fillRect( -r * 0.6, -r * 0.16, r * 1.2, r * 0.32 );
		}
	},
	{
		// reward-only champion crest: a small gold crown. Never sold - granted
		// to tournament winners from the admin so it reads as a flex in-game.
		id: 'drone_champion', title: 'CHAMPION CREST', desc: 'WINNERS-ONLY COSMETIC CREST',
		reward: true,
		draw: function( ctx, r, fillStyle, tick ) {
			ctx.beginPath();
			ctx.moveTo( -r, r * 0.6 );
			ctx.lineTo( -r, -r * 0.4 );
			ctx.lineTo( -r * 0.5, r * 0.1 );
			ctx.lineTo( 0, -r * 0.7 );
			ctx.lineTo( r * 0.5, r * 0.1 );
			ctx.lineTo( r, -r * 0.4 );
			ctx.lineTo( r, r * 0.6 );
			ctx.closePath();
			ctx.fillStyle = 'hsla(45, 100%, 60%, 1)';
			ctx.fill();
		}
	}
];
