/*==============================================================================
Market - cosmetics-only marketplace settled on Base

Cosmetics never touch gameplay or score. Ownership lives in the
wallet-keyed server profile; payments are verified server side.
==============================================================================*/
$.marketState = { loading: 0, enabled: false, network: '', treasury: null, items: [], fetched: 0 };
$.profile = { items: [], consumables: {} };
$.purchase = { status: '', itemId: null };
$.runAssisted = false;

$.definitions.premiumColors = [
	{ id: 'color_gold', title: 'GOLD', color: 'hsl(45, 100%, 60%)' },
	{ id: 'color_void', title: 'VOID', color: 'hsl(285, 100%, 65%)' },
	{ id: 'color_emerald', title: 'EMERALD', color: 'hsl(150, 100%, 55%)' },
	{ id: 'color_ice', title: 'ICE', color: 'hsl(200, 100%, 80%)' }
];

$.definitions.trails = [
	{ id: 'trail_ember', title: 'EMBER', hue: 25 },
	{ id: 'trail_ion', title: 'ION', hue: 190 },
	{ id: 'trail_void', title: 'VOID', hue: 285 },
	// reward-only: granted to tournament champions, never sold
	{ id: 'trail_champion', title: 'CHAMPION', hue: 45 }
];

$.ownsItem = function( id ) {
	return $.profile.items.indexOf( id ) !== -1;
};

$.equippedTrail = function() {
	var id = $.storage['trail'];
	if( !id || !$.ownsItem( id ) ) {
		return null;
	}
	for( var i = 0; i < $.definitions.trails.length; i++ ) {
		if( $.definitions.trails[ i ].id === id ) {
			return $.definitions.trails[ i ];
		}
	}
	return null;
};

$.equippedDrone = function() {
	var id = $.storage['drone'];
	if( !id || !$.ownsItem( id ) ) {
		return null;
	}
	for( var i = 0; i < $.definitions.drones.length; i++ ) {
		if( $.definitions.drones[ i ].id === id ) {
			return $.definitions.drones[ i ];
		}
	}
	return null;
};

// owned premium colors join the regular color cycle
$.applyOwnedItems = function() {
	for( var i = 0; i < $.definitions.premiumColors.length; i++ ) {
		var color = $.definitions.premiumColors[ i ];
		if( $.ownsItem( color.id ) ) {
			var present = false;
			for( var c = 0; c < $.definitions.shipColors.length; c++ ) {
				if( $.definitions.shipColors[ c ].id === color.id ) {
					present = true;
					break;
				}
			}
			if( !present ) {
				$.definitions.shipColors.push( color );
			}
		}
	}
	if( $.storage['trail'] && !$.ownsItem( $.storage['trail'] ) ) {
		$.storage['trail'] = '';
	}
	if( $.storage['drone'] && !$.ownsItem( $.storage['drone'] ) ) {
		$.storage['drone'] = '';
	}
};

$.fetchMarket = function() {
	$.marketState.loading = 1;
	fetch( '/api/market' )
		.then( function( res ) { return res.json(); } )
		.then( function( data ) {
			$.marketState.enabled = !!data.enabled;
			$.marketState.network = data.network || '';
			$.marketState.treasury = data.treasury || null;
			$.marketState.items = data.items || [];
			$.marketState.loading = 0;
			$.marketState.fetched = 1;
			// the screen may have been built before the catalog arrived
			if( $.state === 'market' ) {
				$.setState( 'market' );
			}
		} )
		.catch( function() {
			$.marketState.loading = 0;
		} );
};

$.fetchProfile = function() {
	fetch( '/api/profile' )
		.then( function( res ) { return res.json(); } )
		.then( function( data ) {
			$.profile.items = data.items || [];
			$.profile.consumables = data.consumables || {};
			$.applyOwnedItems();
		} )
		.catch( function() {} );
};

$.consumableCount = function( id ) {
	return $.profile.consumables[ id ] || 0;
};

// consistent storefront price, e.g. 0.9 -> "$0.90", 1 -> "$1.00"
$.usd = function( n ) {
	return '$' + Number( n ).toFixed( 2 );
};

// spends one charge server-side first so a refresh can't duplicate it,
// then runs the in-run effect; flags the run as unranked either way
// once a charge has actually been used, to keep Shooterboard credible
$.useConsumable = function( id, effect ) {
	if( $.consumableCount( id ) <= 0 || !$.session.authenticated ) {
		return false;
	}
	$.profile.consumables[ id ]--;
	$.runAssisted = true;
	effect();
	fetch( '/api/consumable/use', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify( { itemId: id } )
	} ).catch( function() {} );
	return true;
};

$.buyItem = function( item ) {
	if( !$.session.authenticated ) {
		$.purchase = { status: 'guest', itemId: item.id };
		return;
	}
	if( !$.marketState.enabled ) {
		$.purchase = { status: 'soon', itemId: item.id };
		return;
	}
	$.purchase = { status: 'confirm', itemId: item.id };
	window.dispatchEvent( new CustomEvent( 'raidshooter:buy', {
		detail: {
			itemId: item.id,
			priceEth: item.priceEth,
			treasury: $.marketState.treasury,
			network: $.marketState.network
		}
	} ) );
};

window.addEventListener( 'raidshooter:purchase', function( e ) {
	$.purchase = { status: e.detail.status, itemId: e.detail.itemId };
	if( e.detail.message ) {
		// the raw wallet/RPC error, for support debugging - never shown in-game
		console.warn( '[market]', e.detail.status, e.detail.message );
	}
	if( e.detail.status === 'done' ) {
		$.audio.play( 'levelup' );
		$.fetchProfile();
		if( $.state === 'market' ) {
			$.setState( 'market' );
		}
	}
} );

$.purchaseStatusText = function() {
	switch( $.purchase.status ) {
		case 'guest': return 'CONNECT WALLET TO BUY';
		case 'soon': return 'PAYMENTS LIVE SOON';
		case 'switching': return 'SWITCHING TO BASE';
		case 'confirm': return 'CONFIRM IN WALLET';
		case 'pending': return 'CONFIRMING ON BASE';
		case 'done': return 'PURCHASED';
		case 'failed': return 'PAYMENT NOT VERIFIED';
		case 'cancelled': return 'CANCELLED';
		case 'insufficient_funds': return 'NOT ENOUGH ETH ON BASE';
		case 'wrong_network': return 'SWITCH TO BASE FAILED';
	}
	return '';
};

// know what the player owns as soon as the game loads
$.fetchProfile();
