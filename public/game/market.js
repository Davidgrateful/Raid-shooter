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

// Tournament reward celebration: when a reward-only cosmetic appears in the
// player's profile (granted from the admin after a cup), congratulate them
// once on the menu. Seen-state lives in local storage per item.
$.rewardTitles = {
	trail_champion: 'THE CHAMPION TRAIL',
	drone_champion: 'THE CHAMPION CREST DRONE'
};
$.rewardCelebration = function() {
	var seen = $.storage['rewardseen'] || [];
	for( var i = 0; i < $.profile.items.length; i++ ) {
		var id = $.profile.items[ i ];
		if( $.rewardTitles[ id ] && seen.indexOf( id ) === -1 ) {
			return { id: id, title: $.rewardTitles[ id ] };
		}
	}
	return null;
};
$.markRewardSeen = function( id ) {
	var seen = $.storage['rewardseen'] || [];
	if( seen.indexOf( id ) === -1 ) {
		seen.push( id );
		$.storage['rewardseen'] = seen;
		$.updateStorage();
	}
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
			$.buildRarityScale( $.marketState.items );
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
	var qs = !$.session.authenticated ? '?guestToken=' + encodeURIComponent( $.guestToken() ) : '';
	fetch( '/api/profile' + qs )
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
/*==============================================================================
Rarity

The catalogue carries no rarity field, and inventing absolute price bands would
be wrong the moment the operator repriced anything. So rarity is derived from
the catalogue's OWN price spread, recomputed whenever the catalogue loads: the
distinct prices are sorted, and each one is mapped onto as many tiers as the
spread can honestly support.

If every item costs the same there is no spread, and no rarity is shown at
all - a list where everything reads COMMON tells the player nothing and is
just one more column of noise.

Cosmetic only, like everything else in the armory: rarity changes how an item
LOOKS in the list, never what it does in a run.
==============================================================================*/
$.definitions.rarities = [
	{ label: 'COMMON', color: 'hsla(205, 30%, 72%, 0.9)' },
	{ label: 'RARE', color: 'hsla(190, 100%, 62%, 0.9)' },
	{ label: 'EPIC', color: 'hsla(272, 90%, 74%, 0.9)' },
	{ label: 'LEGENDARY', color: 'hsla(45, 100%, 62%, 0.95)' }
];

// price -> tier index, built from whatever the live catalogue actually costs
$.rarityScale = null;

$.buildRarityScale = function( items ) {
	var prices = [], seen = {};
	for( var i = 0; i < items.length; i++ ) {
		if( items[ i ].comingSoon ) { continue; }
		var p = Number( items[ i ].priceUsd );
		if( !isFinite( p ) || seen[ p ] ) { continue; }
		seen[ p ] = 1;
		prices.push( p );
	}
	prices.sort( function( a, b ) { return a - b; } );
	// one price (or none) means no ladder to climb - show no rarity at all
	$.rarityScale = ( prices.length < 2 ) ? null : prices;
};

$.itemRarity = function( item ) {
	if( !$.rarityScale || !item || item.comingSoon ) { return null; }
	var price = Number( item.priceUsd ),
		index = $.rarityScale.indexOf( price );
	if( index < 0 ) { return null; }
	// spread the distinct prices across the available tiers, using only as
	// many tiers as there are prices to distinguish
	var tiers = Math.min( $.definitions.rarities.length, $.rarityScale.length ),
		slot = Math.floor( ( index / ( $.rarityScale.length - 1 ) ) * ( tiers - 1 ) );
	return $.definitions.rarities[ Math.max( 0, Math.min( tiers - 1, slot ) ) ];
};

$.usd = function( n ) {
	return '$' + Number( n ).toFixed( 2 );
};

// spends one charge server-side first so a refresh can't duplicate it,
// then runs the in-run effect; marks the run assisted (for operator audit -
// the score still ranks; assists are tuned to be a bounded comeback aid).
// Guests can own a consumable too (the streak reward grants one with no
// wallet required), so this only checks stock, not wallet auth - a hard
// authenticated-only gate here used to let a guest earn a consumable but
// never spend it.
$.useConsumable = function( id, effect ) {
	if( $.consumableCount( id ) <= 0 ) {
		return false;
	}
	$.profile.consumables[ id ]--;
	$.runAssisted = true;
	effect();
	fetch( '/api/consumable/use', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify( {
			itemId: id,
			guestToken: $.session.authenticated ? undefined : $.guestToken()
		} )
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
