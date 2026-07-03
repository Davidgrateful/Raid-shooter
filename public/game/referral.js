/*==============================================================================
Referral system (client)

Every pilot gets a personal invite link ( raidshooter.xyz/?ref=CODE ). When a
friend arrives through it, plays, and clears a qualifying score, both sides
earn a boost and the inviter climbs the recruiters board.

Flow:
  - on load, capture ?ref=CODE from the URL and remember it (once),
  - once the session is known, tell the server who invited us (bind, first
    writer wins server-side),
  - after a qualifying run, ask the server to credit the referrer,
  - INVITE screen shows our own code/link and the top recruiters.
==============================================================================*/

$.referral = { code: '', invites: 0, top: [], fetched: 0, justCredited: 0 };

// Pull the ?ref= code out of the URL and stash it so a page reload or wallet
// connect later doesn't lose the attribution. Cleaned to the code glyph set.
$.captureRefParam = function() {
	try {
		var params = new URLSearchParams( window.location.search ),
			ref = ( params.get( 'ref' ) || '' ).toUpperCase().replace( /[^A-Z0-9]/g, '' ).slice( 0, 16 );
		if( ref && ref.length >= 3 && !$.storage['refby'] ) {
			$.storage['refby'] = ref;
			$.updateStorage();
		}
	} catch( e ) {}
};

// Bind the pending referrer to this identity server-side (idempotent there).
// Also mints/refreshes our own code from our call sign in the same call.
$.trackReferral = function() {
	var callSign = $.storage['pilotname'] || '';
	var refby = $.storage['refby'] || '';
	if( !refby && $.referral.fetched ) { return; }
	fetch( '/api/referral', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify( { action: 'track', ref: refby, callSign: callSign } )
	} )
		.then( function( r ) { return r.json(); } )
		.then( function( d ) { if( d && d.code ) { $.referral.code = d.code; } } )
		.catch( function() {} );
};

// After a run, credit the inviter if this pilot qualified. Fire-and-forget;
// a boost lands on both sides server-side. Sets a flag so the UI can toast it.
$.claimReferral = function( score ) {
	if( !( $.storage['refby'] ) ) { return; }
	fetch( '/api/referral', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify( { action: 'claim', score: score | 0 } )
	} )
		.then( function( r ) { return r.json(); } )
		.then( function( d ) {
			if( d && d.credited ) {
				$.referral.justCredited = 1;
				// attribution is spent - don't keep re-claiming
				delete $.storage['refby'];
				$.updateStorage();
			}
		} )
		.catch( function() {} );
};

// Load our own code, invite count, and the recruiters board for the INVITE
// screen.
$.fetchReferral = function() {
	fetch( '/api/referral' )
		.then( function( r ) { return r.json(); } )
		.then( function( d ) {
			$.referral.code = d.code || $.referral.code;
			$.referral.invites = d.invites || 0;
			$.referral.top = d.top || [];
			$.referral.fetched = 1;
		} )
		.catch( function() {} );
};

// The shareable invite link for this pilot.
$.referralLink = function() {
	var origin = ( typeof window !== 'undefined' && window.location && window.location.origin ) || 'https://raidshooter.xyz';
	return origin + '/?ref=' + ( $.referral.code || '' );
};

// Open the native share sheet (mobile) or a new tab (desktop) with the invite.
$.shareInvite = function() {
	try {
		var url = $.referralLink(),
			text = 'PLAY RAID SHOOTER WITH ME - WE BOTH EARN A BOOST';
		if( navigator.share ) {
			navigator.share( { title: 'RAID SHOOTER', text: text, url: url } ).catch( function() {} );
		} else if( navigator.clipboard ) {
			navigator.clipboard.writeText( url ).catch( function() {} );
			window.open( url, '_blank' );
		} else {
			window.open( url, '_blank' );
		}
	} catch( e ) {}
};

// capture attribution as early as possible, then bind once the session loads
$.captureRefParam();
// mint our own code + bind any pending referrer once the session is known
if( $.fetchSession ) {
	$.fetchSession().then( function() { $.trackReferral(); } );
} else {
	$.trackReferral();
}
