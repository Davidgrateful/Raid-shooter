/*==============================================================================
Score pops - the confirmation half of the hit loop

  HIT -> particles -> hitstop -> SCORE POP -> chain multiplier -> feed line

The pop is what tells the player how much a kill was actually worth, so its
size and colour carry that information rather than being decoration:

  SIZE    scales with the points banked - a boss reads as a bigger event than
          a trash mob without the player parsing a number
  COLOUR  the enemy's own hue at chain x1, heating toward gold and then white
          as the chain climbs, so a hot streak visibly changes the screen
  DRIFT   each pop leans slightly left or right, so a cluster of simultaneous
          kills fans out instead of stacking into one illegible smear
==============================================================================*/
$.TextPop = function( opt ) {
	for( var k in opt ) {
		this[k] = opt[k];
	}
	this.alpha = 2;
	this.vy = 0;
	// a small random lean, biased away from centre so pairs separate
	this.vx = $.util.rand( -0.55, 0.55 );
	this.chain = $.comboMultiplier || 1;
	// bigger banks get bigger numbers: 2 for trash, 4 for a serious kill
	this.scale = ( this.value >= 400 ) ? 4 : ( this.value >= 120 ) ? 3 : 2;
	// how hot the chain was when this landed, 0..1
	this.heat = Math.min( 1, ( this.chain - 1 ) / 7 );
	// a punchy overshoot on the first few frames - the pop "lands"
	this.pop = 0;
};

/*==============================================================================
Update
==============================================================================*/
$.TextPop.prototype.update = function( i ) {
	this.vy -= 0.05;
	this.y += this.vy * $.dt;
	this.x += this.vx * $.dt;
	this.vx *= 0.96;
	this.alpha -= 0.03 * $.dt;
	if( this.pop < 1 ) {
		this.pop = Math.min( 1, this.pop + 0.25 * $.dt );
	}

	if( this.alpha <= 0 ){
		$.textPops.splice( i, 1 );
	}
};

/*==============================================================================
Render
==============================================================================*/
$.TextPop.prototype.render = function( i ) {
	var alpha = Math.min( 1, this.alpha ),
		// ease-out overshoot: 1.35x on the first frame, settling to 1
		grow = 1 + ( 1 - this.pop ) * 0.35,
		// chain heat pulls the hue toward gold and then washes it out to white
		hue = this.heat > 0 ? ( this.hue + ( 45 - this.hue ) * this.heat ) : this.hue,
		sat = this.saturation * ( 1 - this.heat * 0.35 ),
		light = Math.min( 92, this.lightness + this.heat * 30 );

	$.ctxmg.save();
	$.ctxmg.translate( this.x, this.y );
	$.ctxmg.scale( grow, grow );

	// a hot chain kill throws its own light - cheap, and it makes a streak
	// feel like it is heating the screen up
	if( this.heat > 0.2 ) {
		$.ctxmg.shadowColor = 'hsla(' + hue + ', 100%, 70%, ' + ( alpha * this.heat ) + ')';
		$.ctxmg.shadowBlur = 12 * this.heat;
	}

	$.ctxmg.beginPath();
	$.text( {
		ctx: $.ctxmg,
		x: 0,
		y: 0,
		text: '+' + this.value,
		hspacing: 1,
		vspacing: 0,
		halign: 'center',
		valign: 'center',
		scale: this.scale,
		snap: 0,
		render: 1
	} );
	$.ctxmg.fillStyle = 'hsla(' + hue + ', ' + sat + '%, ' + light + '%, ' + alpha + ')';
	$.ctxmg.fill();
	$.ctxmg.shadowBlur = 0;
	$.ctxmg.restore();
}
