/*==============================================================================
Init
==============================================================================*/
$.Explosion = function( opt ) {
	for( var k in opt ) {
		this[k] = opt[k];
	}
	this.tick = 0;
	this.tickMax = 20;
	// core flash, shockwave, spinning debris and smoke (art.js); this also
	// sets the lifetime, longer for the big ones
	$.explosionInit( this );
	// a sub-bass hit under anything bigger than a micro-missile
	if( this.radius >= 14 && $.sfx ) { $.sfx.play( 'thump' ); }
	if( $.slow ) {
		$.audio.play( 'explosionAlt' );
	} else {
		$.audio.play( 'explosion' );
	}
};

/*==============================================================================
Update
==============================================================================*/
$.Explosion.prototype.update = function( i ) {
	if( this.tick >= this.tickMax ) {
		$.explosions.splice( i, 1 );
	} else {
		this.tick += $.dt;
	}
};

/*==============================================================================
Render
==============================================================================*/
$.Explosion.prototype.render = function( i ) {
	if( $.util.arcInRect( this.x, this.y, this.radius * 1.8, -$.screen.x, -$.screen.y, $.cw, $.ch ) ) {
		$.explosionRender( $.ctxmg, this );
		// a big blast lights the whole screen for a moment (world space, so
		// the rect is placed over the visible screen)
		if( this.big && !$.reduceMotion && this.tick < this.tickMax * 0.2 ) {
			$.ctxmg.fillStyle = 'hsla(' + this.hue + ', 80%, 70%, ' + ( 0.08 * ( 1 - this.tick / ( this.tickMax * 0.2 ) ) ).toFixed( 3 ) + ')';
			$.ctxmg.fillRect( -$.screen.x, -$.screen.y, $.cw, $.ch );
		}
	}
};
