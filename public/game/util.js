/*==============================================================================
Miscellaneous
==============================================================================*/
window['requestAnimFrame']=function(){return window.requestAnimationFrame||window.webkitRequestAnimationFrame||window.mozRequestAnimationFrame||function(a){window.setTimeout(a,1E3/60)}}();

$.util = {};
$.pi = Math.PI;
$.twopi = $.pi * 2;

/*==============================================================================
Random Range
==============================================================================*/
$.util.rand = function( min, max ) {
	return Math.random() * ( max - min ) + min;
};

/*==============================================================================
Calculations
==============================================================================*/
$.util.distance = function( p1x, p1y, p2x, p2y ) {
	var xDistance = p1x - p2x,
		yDistance = p1y - p2y;
	return Math.sqrt( Math.pow( xDistance, 2 ) + Math.pow( yDistance, 2 ) );
};

$.util.rectInRect = function( r1x, r1y, r1w, r1h, r2x, r2y, r2w, r2h ) {
	return !( r2x > r1x + r1w || 
	r2x + r2w < r1x || 
	r2y > r1y + r1h ||
	r2y + r2h < r1y );
};

$.util.arcInRect = function( ax, ay, ar, rx, ry, rw, rh ) {
	return !( ax + ar <= rx || ax - ar >= rx + rw || ay + ar <= ry || ay - ar >= ry + rh );
};

$.util.arcIntersectingRect = function( ax, ay, ar, rx, ry, rw, rh ) {
	return !( ax <= rx - ar || ax >= rx + rw + ar || ay <= ry - ar || ay >= ry + rh + ar );
};

$.util.pointInRect = function( px, py, rx, ry, rw, rh ) {
	return ( px >= rx && px <= rx + rw && py >= ry && py <= ry + rh );
};

/*==============================================================================
Shapes
==============================================================================*/
$.util.circle = function( ctx, x, y, radius ) {
	var radius = radius <= 0 ? 1 : radius;
	ctx.beginPath();
	ctx.arc( x, y, radius, 0, $.twopi, false );
};

$.util.fillCircle = function( ctx, x, y, radius, fillStyle ) {
	$.util.circle( ctx, x, y, radius );
	ctx.fillStyle = fillStyle;
	ctx.fill();
};

// Adds a rounded-rect subpath to $.ctxmg (caller handles beginPath/fill),
// for UI pills and highlight bars on the menu canvas.
$.roundRect = function( x, y, w, h, r ) {
	var ctx = $.ctxmg;
	r = Math.min( r, w / 2, h / 2 );
	ctx.moveTo( x + r, y );
	ctx.arcTo( x + w, y, x + w, y + h, r );
	ctx.arcTo( x + w, y + h, x, y + h, r );
	ctx.arcTo( x, y + h, x, y, r );
	ctx.arcTo( x, y, x + w, y, r );
	ctx.closePath();
};

$.util.strokeCircle = function( ctx, x, y, radius, strokeStyle, lineWidth ) {
	$.util.circle( ctx, x, y, radius );
	ctx.lineWidth = lineWidth;
	ctx.strokeStyle = strokeStyle;
	ctx.stroke();
};

/*==============================================================================
Miscellaneous
==============================================================================*/
$.util.pad = function( amount, digits ){
	amount += '';
	if( amount.length < digits ) {
		amount = '0' + amount;
		return $.util.pad( amount, digits );
	} else {
		return amount;
	}
};

$.util.convertTime = function( seconds ) {
	var minutes = Math.floor( seconds / 60 );
	var seconds = Math.floor( seconds % 60 );
	return $.util.pad( minutes, 2 ) + ':' + $.util.pad( seconds, 2 );
};

$.util.commas = function( nStr ) {
	nStr += '';
	var x = nStr.split( '.' ),
		x1 = x[ 0 ],
		x2 = x.length > 1 ? '.' + x[ 1 ] : '',
		rgx = /(\d+)(\d{3})/;
	while( rgx.test( x1 ) ) {
		x1 = x1.replace( rgx, '$1' + ',' + '$2' );
	}
	return x1 + x2;
};


$.util.isset = function( prop ) {
	return typeof prop != 'undefined';
};
