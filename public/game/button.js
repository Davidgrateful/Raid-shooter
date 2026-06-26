/*==============================================================================
Init
==============================================================================*/
$.Button = function( opt ) {
	for( var k in opt ) {
		this[k] = opt[k];
	}
	var text = $.text( {
		ctx: $.ctxmg,
		x: 0,
		y: 0,
		text: this.title,
		hspacing: 1,
		vspacing: 0,
		halign: 'center',
		valign: 'center',
		scale: this.scale,
		snap: 1,
		render: 0
	} );
	this.width = this.lockedWidth;
	this.height = this.lockedHeight;

	this.sx = this.x - this.width / 2;
	this.sy = this.y - this.height / 2;
	this.cx = this.x;
	this.cy = this.y;
	this.ex = this.x + this.width / 2;
	this.ey = this.y + this.height / 2;
	this.hovering = 0;
	this.ohovering = 0;

	// base (unscrolled) vertical position - scrollable buttons get their
	// sy/cy/ey/y rewritten each frame from these as the list is scrolled
	this.by = this.y;
	this.bsy = this.sy;
	this.bcy = this.cy;
	this.bey = this.ey;

	// an icon (e.g. a market item's ship preview) draws in a reserved strip
	// on the left of the button, with the title text nudged right to clear it
	this.textOffsetX = this.icon ? ( this.iconAreaWidth || 40 ) / 2 : 0;
};

/*==============================================================================
Update
==============================================================================*/
$.Button.prototype.update = function( i ) {
	/*==============================================================================
	Check Hover State
	==============================================================================*/
	if( $.util.pointInRect( $.mouse.sx, $.mouse.sy, this.sx, this.sy, this.width, this.height ) ){
		this.hovering = 1;
		if( !this.ohovering ) {
			$.audio.play( 'hover' );
		}
	} else {
		this.hovering = 0;
	}
	this.ohovering = this.hovering;

	/*==============================================================================
	Check Click
	==============================================================================*/
	if( this.hovering && $.mouse.down ) {
		$.audio.play( 'click' );
		this.action();
	}
};

/*==============================================================================
Render
==============================================================================*/
$.Button.prototype.render = function( i ) {	
	if( this.hovering ) {
		$.ctxmg.fillStyle = 'hsla(0, 0%, 10%, 1)';
		$.ctxmg.fillRect( Math.floor( this.sx ), Math.floor( this.sy ), this.width, this.height );
		$.ctxmg.strokeStyle = 'hsla(0, 0%, 0%, 1)';
		$.ctxmg.strokeRect( Math.floor( this.sx ) + 0.5, Math.floor( this.sy ) + 0.5, this.width - 1, this.height - 1, 1 );
		$.ctxmg.strokeStyle = 'hsla(0, 0%, 100%, 0.2)';
		$.ctxmg.strokeRect( Math.floor( this.sx ) + 1.5, Math.floor( this.sy ) + 1.5, this.width - 3, this.height - 3, 1 );
	} else {
		$.ctxmg.fillStyle = 'hsla(0, 0%, 0%, 1)';
		$.ctxmg.fillRect( Math.floor( this.sx ), Math.floor( this.sy ), this.width, this.height );
		$.ctxmg.strokeStyle = 'hsla(0, 0%, 0%, 1)';
		$.ctxmg.strokeRect( Math.floor( this.sx ) + 0.5, Math.floor( this.sy ) + 0.5, this.width - 1, this.height - 1, 1 );
		$.ctxmg.strokeStyle = 'hsla(0, 0%, 100%, 0.15)';
		$.ctxmg.strokeRect( Math.floor( this.sx ) + 1.5, Math.floor( this.sy ) + 1.5, this.width - 3, this.height - 3, 1 );
	}

	$.ctxmg.beginPath();
	$.text( {
		ctx: $.ctxmg,
		x: this.cx + this.textOffsetX,
		y: this.cy,
		text: this.title,
		hspacing: 1,
		vspacing: 0,
		halign: 'center',
		valign: 'center',
		scale: this.scale,
		snap: 1,
		render: true
	} );

	$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.7)';
	if( this.hovering ) {
		$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 1)';
	}
	$.ctxmg.fill();

	$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.07)';
	$.ctxmg.fillRect( Math.floor( this.sx ) + 2, Math.floor( this.sy ) + 2, this.width - 4, Math.floor( ( this.height - 4 ) / 2 ) );

	if( this.icon ) {
		$.ctxmg.save();
		$.ctxmg.translate( Math.floor( this.sx ) + ( this.iconAreaWidth || 40 ) / 2, this.cy );
		$.ctxmg.rotate( -$.pi / 2 );
		this.icon.draw( $.ctxmg, this.icon.r || 12, this.icon.color, $.tick || 0 );
		$.ctxmg.restore();
	}
};
