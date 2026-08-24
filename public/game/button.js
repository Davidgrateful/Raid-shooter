/*==============================================================================
Init
==============================================================================*/
$.Button = function( opt ) {
	for( var k in opt ) {
		this[k] = opt[k];
	}
	// card buttons lay out their own fields (name/subtitle/note) and carry
	// no single title, so the measuring pass below would choke on undefined
	var text = $.text( {
		ctx: $.ctxmg,
		x: 0,
		y: 0,
		text: this.title || '',
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
	// a scrolled button whose center has left the visible list strip is
	// hidden behind the clip, so it must not be hoverable/clickable either
	if( this.scrollable && $.scrollClip &&
		( this.cy < $.scrollClip.top || this.cy > $.scrollClip.bottom ) ) {
		this.hovering = 0;
		this.ohovering = 0;
		return;
	}
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

Canvas buttons speak the same language as the HTML command centre: a charcoal
face with a bitten top-left/bottom-right corner, a hairline border that lights
up cyan on hover, and an illuminated left edge marking focus. Three variants:

  default   a destination or an option
  primary   the action the screen exists for (ENDLESS RUN, PLAY AGAIN, EQUIP) -
            charged cyan face, brighter border, a lit core along the bottom
  card      a storefront row; see renderCard below

Hover is the only state that can actually be SEEN here: the engine fires a
button's action on mouse-down, so a press flash would be drawn one frame before
the screen changes. Hover therefore has to carry all the feedback, and it does
- fill, border, edge light and text weight all move together.
==============================================================================*/
$.Button.prototype.render = function( i ) {
	var ctx = $.ctxmg,
		x = Math.floor( this.sx ),
		y = Math.floor( this.sy ),
		w = this.width,
		h = this.height,
		cut = Math.min( 10, Math.floor( h / 3 ) ),
		hot = this.hovering,
		primary = this.primary;

	/*--- face ------------------------------------------------------------*/
	var face = ctx.createLinearGradient( 0, y, 0, y + h );
	if( primary ) {
		face.addColorStop( 0, hot ? 'hsla(190, 95%, 62%, 0.4)' : 'hsla(190, 95%, 60%, 0.26)' );
		face.addColorStop( 0.62, hot ? 'hsla(196, 80%, 20%, 0.9)' : 'hsla(196, 75%, 15%, 0.88)' );
		face.addColorStop( 1, 'hsla(200, 70%, 9%, 0.94)' );
	} else {
		face.addColorStop( 0, hot ? 'hsla(210, 34%, 22%, 0.92)' : 'hsla(215, 30%, 13%, 0.82)' );
		face.addColorStop( 1, hot ? 'hsla(215, 34%, 11%, 0.94)' : 'hsla(222, 32%, 7%, 0.88)' );
	}
	ctx.beginPath();
	$.cutRect( ctx, x, y, w, h, cut );
	ctx.fillStyle = face;
	ctx.fill();

	/*--- border ----------------------------------------------------------*/
	ctx.beginPath();
	$.cutRect( ctx, x + 0.5, y + 0.5, w - 1, h - 1, cut );
	ctx.lineWidth = 1;
	if( primary ) {
		ctx.strokeStyle = hot ? 'hsla(190, 100%, 72%, 0.95)' : 'hsla(190, 100%, 68%, 0.6)';
	} else {
		ctx.strokeStyle = hot ? 'hsla(190, 100%, 70%, 0.75)' : 'hsla(205, 45%, 70%, 0.18)';
	}
	ctx.stroke();

	/*--- top highlight: the sheen that makes it read as a physical face ---*/
	ctx.fillStyle = primary
		? 'hsla(190, 100%, 85%, ' + ( hot ? 0.18 : 0.12 ) + ')'
		: 'hsla(200, 60%, 90%, ' + ( hot ? 0.07 : 0.035 ) + ')';
	ctx.fillRect( x + cut, y + 1, w - cut - 1, 1 );

	/*--- edge light: where you are, in one stroke ------------------------*/
	if( hot || primary ) {
		var lit = primary ? 0.95 : 0.8,
			inset = primary ? 3 : 5;
		ctx.fillStyle = 'hsla(190, 100%, 65%, ' + lit + ')';
		ctx.fillRect( x, y + inset, 2, h - inset * 2 );
	}

	/*--- primary core: a soft glow pooled along the bottom of the face ---*/
	if( primary ) {
		var core = ctx.createLinearGradient( 0, y + h * 0.45, 0, y + h );
		core.addColorStop( 0, 'hsla(190, 100%, 60%, 0)' );
		core.addColorStop( 1, 'hsla(190, 100%, 60%, ' + ( hot ? 0.28 : 0.18 ) + ')' );
		ctx.beginPath();
		$.cutRect( ctx, x + 1, y + 1, w - 2, h - 2, cut );
		ctx.fillStyle = core;
		ctx.fill();
	}

	/*--- label ------------------------------------------------------------*/
	if( this.card ) {
		this.renderCard();
	} else {
		ctx.beginPath();
		$.text( {
			ctx: ctx,
			x: this.cx + this.textOffsetX,
			y: this.cy,
			text: this.title,
			hspacing: 1,
			vspacing: this.vspacing || 0,
			halign: 'center',
			valign: 'center',
			scale: this.scale,
			snap: 1,
			render: true
		} );
		if( primary ) {
			ctx.fillStyle = hot ? 'hsla(185, 100%, 96%, 1)' : 'hsla(185, 90%, 90%, 1)';
		} else {
			ctx.fillStyle = hot ? 'hsla(0, 0%, 100%, 1)' : 'hsla(205, 30%, 92%, 0.72)';
		}
		ctx.fill();
	}

	if( this.icon ) {
		ctx.save();
		ctx.translate( x + ( this.iconAreaWidth || 40 ) / 2, this.cy );
		// soft accent glow behind the icon so the storefront reads as lit
		// hardware, not flat silhouettes
		if( this.icon.glow ) {
			var gr = ( this.icon.r || 12 ) * 2.3,
				gg = ctx.createRadialGradient( 0, 0, 2, 0, 0, gr );
			gg.addColorStop( 0, this.icon.glow );
			gg.addColorStop( 1, 'hsla(0, 0%, 0%, 0)' );
			ctx.fillStyle = gg;
			ctx.beginPath();
			ctx.arc( 0, 0, gr, 0, $.twopi );
			ctx.fill();
		}
		ctx.rotate( -$.pi / 2 );
		this.icon.draw( ctx, this.icon.r || 12, this.icon.color, $.tick || 0 );
		ctx.restore();
	}
};

/*==============================================================================
Card Render - storefront-style row: name (left), ability (left, dim),
price/status (right). Keeps fields in tidy columns instead of one cramped
centered string, so a long list reads as an organized list.
==============================================================================*/
$.Button.prototype.renderCard = function() {
	var pad = 10,
		iconArea = this.icon ? ( this.iconAreaWidth || 40 ) : 0,
		leftX = Math.floor( this.sx ) + iconArea + pad;

	// Rarity stripe down the left edge, plus a soft bleed of the same colour
	// into the face. Rarity is a colour the player learns once and then reads
	// everywhere - here, on a reward drop, on a pilot tier badge - so an
	// expensive item is recognisable before its price is.
	if( this.accent ) {
		var ax = Math.floor( this.sx ),
			ay = Math.floor( this.sy );
		var bleed = $.ctxmg.createLinearGradient( ax, 0, ax + this.width * 0.5, 0 );
		bleed.addColorStop( 0, this.accent );
		bleed.addColorStop( 1, 'hsla(0, 0%, 0%, 0)' );
		$.ctxmg.save();
		$.ctxmg.globalAlpha = this.hovering ? 0.2 : 0.12;
		$.ctxmg.fillStyle = bleed;
		$.ctxmg.fillRect( ax + 1, ay + 1, this.width * 0.5, this.height - 2 );
		$.ctxmg.restore();

		$.ctxmg.fillStyle = this.accent;
		$.ctxmg.fillRect( ax + 1, ay + 4, 3, this.height - 8 );
	}

	var
		rightX = Math.floor( this.ex ) - pad,
		nameScale = this.nameScale || 1,
		subScale = this.subScale || 1;

	// Right column reads top-down: rarity, then price. A player scanning the
	// list sees WHAT KIND of thing it is before WHAT IT COSTS, which is the
	// order they actually shop in.
	var noteY = this.cy;
	if( this.rarity ) {
		noteY = this.sy + this.height * 0.62;
		$.ctxmg.beginPath();
		$.text( {
			ctx: $.ctxmg,
			x: rightX,
			y: this.sy + this.height * 0.3,
			text: this.rarity,
			hspacing: 1,
			vspacing: 0,
			halign: 'right',
			valign: 'center',
			scale: 1,
			snap: 1,
			render: true
		} );
		$.ctxmg.fillStyle = this.rarityColor || 'hsla(205, 30%, 72%, 0.9)';
		$.ctxmg.fill();
	}

	// price / OWNED / SOON, right-aligned
	if( this.note ) {
		$.ctxmg.beginPath();
		$.text( {
			ctx: $.ctxmg,
			x: rightX,
			y: noteY,
			text: this.note,
			hspacing: 1,
			vspacing: 0,
			halign: 'right',
			valign: 'center',
			scale: this.noteScale || 1,
			snap: 1,
			render: true
		} );
		$.ctxmg.fillStyle = this.noteColor || 'hsla(45, 100%, 65%, 1)';
		$.ctxmg.fill();
	}

	// name on top, ability beneath when present; name centers vertically
	// when it stands alone so single-line rows don't float high
	var hasSub = !!this.subtitle,
		nameY = hasSub ? this.sy + this.height * 0.34 : this.cy;
	$.ctxmg.beginPath();
	$.text( {
		ctx: $.ctxmg,
		x: leftX,
		y: nameY,
		text: this.name,
		hspacing: 1,
		vspacing: 0,
		halign: 'left',
		valign: 'center',
		scale: nameScale,
		snap: 1,
		render: true
	} );
	$.ctxmg.fillStyle = this.hovering ? 'hsla(0, 0%, 100%, 1)' : 'hsla(0, 0%, 100%, 0.9)';
	$.ctxmg.fill();

	if( hasSub ) {
		$.ctxmg.beginPath();
		$.text( {
			ctx: $.ctxmg,
			x: leftX,
			y: this.sy + this.height * 0.7,
			text: this.subtitle,
			hspacing: 1,
			vspacing: 0,
			halign: 'left',
			valign: 'center',
			scale: subScale,
			snap: 1,
			render: true
		} );
		$.ctxmg.fillStyle = this.subColor || 'hsla(190, 100%, 72%, 0.75)';
		$.ctxmg.fill();
	}
};
