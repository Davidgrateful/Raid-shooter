/*==============================================================================
Level-up burst

Clearing a level is the run's rhythm marker, and it used to be a faint grey
numeral in the corner. It is now a proper arcade beat, built from three layers
that arrive together and leave quickly:

  RING     a ring of energy expanding out of the ship's own quarter of the
           screen, gone in under a second
  RAYS     short directional spokes - speed and force, the same angular
           language as the ship silhouettes
  NUMERAL  the level itself, punching in oversized and settling back

It plays over gameplay, so it is deliberately short and deliberately
transparent. Nothing here blocks a shot the player is lining up.
==============================================================================*/
$.LevelPop = function( opt ) {
	for( var k in opt ) {
		this[k] = opt[k];
	}
	this.x = $.cw - 20;
	this.y = $.ch - 20;
	// the burst is anchored where the numeral lands, not on the hero, so it
	// never sits under the ship and hides an incoming enemy
	this.bx = $.cw - 90;
	this.by = $.ch - 80;
	this.tick = 0;
	this.tickMax = 240;
	this.baseAlpha = 0.26;
	if( $.tick != 0 ) {
		$.audio.play( 'levelup' );
	}
};

/*==============================================================================
Update
==============================================================================*/
$.LevelPop.prototype.update = function( i ) {
	if( this.tick >= this.tickMax ) {
		$.levelPops.splice( i, 1 );
	} else {
		this.tick += $.dt;
	}
};

/*==============================================================================
Render
==============================================================================*/
$.LevelPop.prototype.render = function( i ) {
	var ctx = $.ctxmg,
		burst = Math.min( 1, this.tick / 42 );

	/*--- ring + rays: the first 0.7s only ------------------------------------*/
	if( burst < 1 ) {
		// ease-out so it leaps and then decelerates
		var e = 1 - Math.pow( 1 - burst, 3 ),
			r = 18 + e * 118,
			ringAlpha = ( 1 - burst ) * 0.5;

		ctx.beginPath();
		ctx.arc( this.bx, this.by, r, 0, $.twopi );
		ctx.strokeStyle = 'hsla(190, 100%, 70%, ' + ringAlpha + ')';
		ctx.lineWidth = 2.5 * ( 1 - burst ) + 0.5;
		ctx.stroke();

		// a second, faster ring gives the burst a leading edge
		ctx.beginPath();
		ctx.arc( this.bx, this.by, r * 1.28, 0, $.twopi );
		ctx.strokeStyle = 'hsla(190, 100%, 80%, ' + ( ringAlpha * 0.4 ) + ')';
		ctx.lineWidth = 1;
		ctx.stroke();

		ctx.strokeStyle = 'hsla(190, 100%, 78%, ' + ( ringAlpha * 0.85 ) + ')';
		ctx.lineWidth = 2;
		for( var s = 0; s < 8; s++ ) {
			var a = ( s / 8 ) * $.twopi + 0.2,
				inner = r * 0.86,
				outer = r * ( 1.02 + ( 1 - burst ) * 0.16 );
			ctx.beginPath();
			ctx.moveTo( this.bx + Math.cos( a ) * inner, this.by + Math.sin( a ) * inner );
			ctx.lineTo( this.bx + Math.cos( a ) * outer, this.by + Math.sin( a ) * outer );
			ctx.stroke();
		}
	}

	/*--- the numeral ----------------------------------------------------------*/
	var alpha;
	if( this.tick < this.tickMax * 0.25 ) {
		alpha = ( this.tick / ( this.tickMax * 0.25 ) ) * this.baseAlpha;
	} else if( this.tick > this.tickMax - this.tickMax * 0.25 ) {
		alpha = ( ( this.tickMax - this.tick ) / ( this.tickMax * 0.25 ) ) * this.baseAlpha;
	} else {
		alpha = this.baseAlpha;
	}
	alpha = Math.min( 1, Math.max( 0, alpha ) );

	// punches in oversized on the first few frames, then settles
	var punch = 1 + ( 1 - Math.min( 1, this.tick / 14 ) ) * 0.22;

	ctx.save();
	ctx.translate( this.x, this.y );
	ctx.scale( punch, punch );
	ctx.beginPath();
	$.text( {
		ctx: ctx,
		x: 0,
		y: 0,
		text: $.util.pad( this.level, 2 ),
		hspacing: 3,
		vspacing: 0,
		halign: 'right',
		valign: 'bottom',
		scale: 12,
		snap: 1,
		render: 1
	} );
	// cyan while the burst is live, cooling to plain white as it lingers
	ctx.fillStyle = ( burst < 1 )
		? 'hsla(190, 100%, 82%, ' + Math.max( alpha, ( 1 - burst ) * 0.55 ) + ')'
		: 'hsla(0, 0%, 100%, ' + alpha + ')';
	ctx.fill();
	ctx.restore();

	// "LEVEL" set small above the numeral so the big digits are unambiguous
	ctx.beginPath();
	$.text( {
		ctx: ctx,
		x: this.x,
		y: this.y - 100,
		text: 'LEVEL',
		hspacing: 4,
		vspacing: 0,
		halign: 'right',
		valign: 'bottom',
		scale: 1,
		snap: 1,
		render: 1
	} );
	ctx.fillStyle = 'hsla(190, 100%, 80%, ' + ( alpha * 1.6 ) + ')';
	ctx.fill();
}
