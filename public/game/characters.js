/*==============================================================================
Character Definitions

Characters are free and unlocked by playing - never sold. Shape and stats
come from the character; the color selector stays the player's identity
layer (and the future skin store slots in here).

Draw functions render with the context already translated to the ship
center and rotated so +x is the facing direction.
==============================================================================*/
$.definitions.characters = [
	{
		id: 'onyix',
		title: 'ONYIX',
		desc: 'BALANCED FIGHTER',
		speedMult: 1,
		damageTakenMult: 1,
		dashCooldownMult: 1,
		radius: 10,
		unlock: null,
		draw: function( ctx, r, fillStyle, tick ) {
			// sharp triangular fighter with twin wings
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
			// glowing core pulses with the combo multiplier
			var pulse = 0.55 + Math.cos( tick / 6 ) * 0.15 + ( ( $.comboMultiplier || 1 ) - 1 ) * 0.05;
			ctx.beginPath();
			ctx.arc( r * 0.1, 0, r * 0.42, 0, $.twopi );
			ctx.fillStyle = 'hsla(45, 100%, 65%, ' + pulse + ')';
			ctx.fill();
		}
	},
	{
		id: 'nova',
		title: 'NOVA',
		desc: 'FAST AND FRAGILE,\nRAPID DASH',
		speedMult: 1.25,
		damageTakenMult: 1.33,
		dashCooldownMult: 0.7,
		radius: 9,
		unlock: { stat: 'kills', value: 250, label: 'LIFETIME KILLS' },
		draw: function( ctx, r, fillStyle, tick ) {
			// thin dart
			ctx.beginPath();
			ctx.moveTo( r * 2.1, 0 );
			ctx.lineTo( -r * 0.9, r * 0.45 );
			ctx.lineTo( -r * 0.5, 0 );
			ctx.lineTo( -r * 0.9, -r * 0.45 );
			ctx.closePath();
			ctx.fillStyle = fillStyle;
			ctx.fill();
			// rear fins
			ctx.fillRect( -r * 1.2, r * 0.25, r * 0.5, r * 0.18 );
			ctx.fillRect( -r * 1.2, -r * 0.43, r * 0.5, r * 0.18 );
		}
	},
	{
		id: 'tankrex',
		title: 'TANK REX',
		desc: 'SLOW AND ARMORED',
		speedMult: 0.8,
		damageTakenMult: 0.7,
		dashCooldownMult: 1.3,
		radius: 13,
		unlock: { stat: 'bosskills', value: 1, label: 'BOSSES DEFEATED' },
		draw: function( ctx, r, fillStyle, tick ) {
			// wide hexagon hull
			ctx.beginPath();
			for( var p = 0; p < 6; p++ ) {
				var angle = ( p / 6 ) * $.twopi,
					px = Math.cos( angle ) * r * 1.1,
					py = Math.sin( angle ) * r * 0.95;
				if( p === 0 ) {
					ctx.moveTo( px, py );
				} else {
					ctx.lineTo( px, py );
				}
			}
			ctx.closePath();
			ctx.fillStyle = fillStyle;
			ctx.fill();
			// heavy side plates
			ctx.fillStyle = 'hsla(0, 0%, 45%, 1)';
			ctx.fillRect( -r * 0.7, r * 0.85, r * 1.4, r * 0.35 );
			ctx.fillRect( -r * 0.7, -r * 1.2, r * 1.4, r * 0.35 );
			// nose marker
			ctx.fillStyle = fillStyle;
			ctx.fillRect( r * 1.0, -r * 0.15, r * 0.55, r * 0.3 );
		}
	},
	{
		id: 'volt',
		title: 'VOLT',
		comingSoon: 1,
		draw: function( ctx, r, fillStyle, tick ) {
			ctx.beginPath();
			ctx.moveTo( r * 1.4, 0 );
			ctx.lineTo( 0, r * 0.9 );
			ctx.lineTo( -r * 1.2, 0 );
			ctx.lineTo( 0, -r * 0.9 );
			ctx.closePath();
			ctx.fillStyle = fillStyle;
			ctx.fill();
			ctx.strokeStyle = 'hsla(190, 100%, 70%, 0.9)';
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo( r * 0.6, r * 0.5 );
			ctx.lineTo( r * 1.6, r * 0.7 );
			ctx.moveTo( r * 0.6, -r * 0.5 );
			ctx.lineTo( r * 1.6, -r * 0.7 );
			ctx.stroke();
		}
	},
	{
		id: 'echo',
		title: 'ECHO',
		comingSoon: 1,
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
		id: 'shade',
		title: 'SHADE',
		comingSoon: 1,
		draw: function( ctx, r, fillStyle, tick ) {
			// crescent: full disc with a bite taken out of the rear
			ctx.beginPath();
			ctx.arc( 0, 0, r * 1.2, -$.pi * 0.62, $.pi * 0.62 );
			ctx.arc( -r * 0.85, 0, r * 0.95, $.pi * 0.5, -$.pi * 0.5, true );
			ctx.closePath();
			ctx.fillStyle = fillStyle;
			ctx.fill();
		}
	},
	{
		id: 'blaze',
		title: 'BLAZE',
		comingSoon: 1,
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
		id: 'orbit',
		title: 'ORBIT',
		comingSoon: 1,
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

/*==============================================================================
Pilot Card (hangar select screen)
==============================================================================*/
$.PilotCard = function( opt ) {
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

$.PilotCard.prototype.update = function( i ) {
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
		if( $.characterUnlocked( this.def ) ) {
			$.audio.play( 'click' );
			$.storage['character'] = this.charIndex;
			$.updateStorage();
		}
	}
};

$.PilotCard.prototype.render = function( i ) {
	var unlocked = $.characterUnlocked( this.def ),
		selected = ( ( $.storage['character'] || 0 ) === this.charIndex );

	$.ctxmg.fillStyle = this.hovering && unlocked ? 'hsla(0, 0%, 10%, 1)' : 'hsla(0, 0%, 0%, 1)';
	$.ctxmg.fillRect( Math.floor( this.sx ), Math.floor( this.sy ), this.width, this.height );
	if( selected ) {
		$.ctxmg.strokeStyle = 'hsla(45, 100%, 65%, 0.9)';
	} else {
		$.ctxmg.strokeStyle = this.hovering && unlocked ? 'hsla(0, 0%, 100%, 0.4)' : 'hsla(0, 0%, 100%, 0.15)';
	}
	$.ctxmg.strokeRect( Math.floor( this.sx ) + 0.5, Math.floor( this.sy ) + 0.5, this.width - 1, this.height - 1 );

	// ship preview, facing up
	$.ctxmg.save();
	$.ctxmg.translate( this.cx, this.sy + this.height * 0.32 );
	$.ctxmg.rotate( -$.pi / 2 );
	this.def.draw( $.ctxmg, Math.min( 14, this.height * 0.1 ), unlocked ? '#fff' : 'hsla(0, 0%, 35%, 1)', $.tick );
	$.ctxmg.restore();

	$.ctxmg.beginPath();
	$.text( {
		ctx: $.ctxmg,
		x: this.cx,
		y: this.sy + this.height * 0.56,
		text: this.def.title,
		hspacing: 1,
		vspacing: 1,
		halign: 'center',
		valign: 'top',
		scale: 2,
		snap: 1,
		render: 1
	} );
	$.ctxmg.fillStyle = unlocked ? 'hsla(0, 0%, 100%, 0.9)' : 'hsla(0, 0%, 100%, 0.35)';
	$.ctxmg.fill();

	var statusText,
		statusColor = 'hsla(0, 0%, 100%, 0.35)';
	if( this.def.comingSoon ) {
		statusText = 'COMING SOON';
	} else if( !unlocked ) {
		statusText = ( $.storage[ this.def.unlock.stat ] || 0 ) + '/' + this.def.unlock.value + ' ' + this.def.unlock.label;
	} else if( selected ) {
		statusText = 'SELECTED';
		statusColor = 'hsla(45, 100%, 65%, 0.9)';
	} else {
		statusText = this.def.desc;
	}

	$.ctxmg.beginPath();
	$.text( {
		ctx: $.ctxmg,
		x: this.cx,
		y: this.ey - 12,
		text: statusText,
		hspacing: 1,
		vspacing: 5,
		halign: 'center',
		valign: 'bottom',
		scale: 1,
		snap: 1,
		render: 1
	} );
	$.ctxmg.fillStyle = statusColor;
	$.ctxmg.fill();
};
