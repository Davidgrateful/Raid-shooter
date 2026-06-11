/*==============================================================================
Upgrade Definitions
==============================================================================*/
$.definitions.upgrades = [
	{
		id: 'rapid',
		title: 'RAPID FIRE',
		desc: 'SHOOT FASTER',
		max: 5
	},
	{
		id: 'multi',
		title: 'MULTI SHOT',
		desc: '+1 BULLET PER SHOT',
		max: 3
	},
	{
		id: 'heavy',
		title: 'HEAVY ROUNDS',
		desc: 'BULLETS HIT HARDER',
		max: 5
	},
	{
		id: 'pierce',
		title: 'PIERCING ROUNDS',
		desc: 'SHOTS PASS THROUGH\nENEMIES',
		max: 1
	},
	{
		id: 'velocity',
		title: 'VELOCITY ROUNDS',
		desc: 'FASTER BULLETS',
		max: 3
	},
	{
		id: 'thrusters',
		title: 'THRUSTERS',
		desc: 'MOVE FASTER',
		max: 4
	},
	{
		id: 'nano',
		title: 'NANO REPAIR',
		desc: 'SLOWLY REGEN HEALTH',
		max: 3
	},
	{
		id: 'hull',
		title: 'HARDENED HULL',
		desc: 'TAKE LESS DAMAGE',
		max: 4
	},
	{
		id: 'lucky',
		title: 'LUCKY STAR',
		desc: 'ENEMIES DROP\nMORE POWERUPS',
		max: 3
	},
	{
		id: 'overcharge',
		title: 'OVERCHARGE',
		desc: 'POWERUPS LAST LONGER',
		max: 2
	}
];

/*==============================================================================
Upgrade State
==============================================================================*/
$.resetUpgrades = function() {
	$.upgrades = {};
	$.recomputeUpgrades();
};

$.recomputeUpgrades = function() {
	var u = $.upgrades,
		weapon = $.hero.weapon,
		character = $.hero.character || $.currentCharacter();

	weapon.baseFireRate = 5 * Math.pow( 0.85, u['rapid'] || 0 );
	weapon.baseCount = 1 + ( u['multi'] || 0 );
	weapon.baseBulletSpeed = 10 * Math.pow( 1.2, u['velocity'] || 0 );
	weapon.basePiercing = ( u['pierce'] || 0 ) > 0 ? 1 : 0;
	weapon.spread = 0.3 + ( weapon.baseCount - 1 ) * 0.1;
	weapon.bullet.damage = Math.pow( 1.4, u['heavy'] || 0 );

	$.hero.vmax = 6 * character.speedMult * Math.pow( 1.12, u['thrusters'] || 0 );
	$.hero.accel = 0.5 * character.speedMult * Math.pow( 1.12, u['thrusters'] || 0 );
	$.hero.regenRate = ( u['nano'] || 0 ) * 0.0002;
	$.hero.damageTakenMult = character.damageTakenMult * Math.pow( 0.85, u['hull'] || 0 );
	$.hero.dashCooldownMax = 120 * character.dashCooldownMult;

	$.powerupDropChance = 0.1 * ( 1 + 0.6 * ( u['lucky'] || 0 ) );
	$.powerupDuration = 300 * ( 1 + 0.5 * ( u['overcharge'] || 0 ) );
};

$.getUpgradeChoices = function() {
	var eligible = [];
	for( var i = 0; i < $.definitions.upgrades.length; i++ ) {
		var def = $.definitions.upgrades[ i ];
		if( ( $.upgrades[ def.id ] || 0 ) < def.max ) {
			eligible.push( def );
		}
	}
	// Fisher-Yates shuffle
	for( var i = eligible.length - 1; i > 0; i-- ) {
		var j = Math.floor( $.util.rand( 0, i + 1 ) ),
			swap = eligible[ i ];
		eligible[ i ] = eligible[ j ];
		eligible[ j ] = swap;
	}
	return eligible.slice( 0, 3 );
};

$.openUpgradeDraft = function() {
	var choices = $.getUpgradeChoices();
	if( choices.length === 0 ) {
		return;
	}
	$.upgradeChoices = choices;
	$.setState( 'upgrade' );
};

$.chooseUpgrade = function( id ) {
	$.upgrades[ id ] = ( $.upgrades[ id ] || 0 ) + 1;
	$.recomputeUpgrades();
	$.spawnLullTick = 180;
	$.lt = Date.now();
	$.setState( 'play' );
	// a boss kill grants a bonus second pick
	if( $.bossDraftQueued ) {
		$.bossDraftQueued = 0;
		$.openUpgradeDraft();
	}
};

/*==============================================================================
Upgrade Card
==============================================================================*/
$.UpgradeCard = function( opt ) {
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

$.UpgradeCard.prototype.update = function( i ) {
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
		$.audio.play( 'click' );
		this.action();
	}
};

$.UpgradeCard.prototype.render = function( i ) {
	if( this.hovering ) {
		$.ctxmg.fillStyle = 'hsla(0, 0%, 10%, 1)';
	} else {
		$.ctxmg.fillStyle = 'hsla(0, 0%, 0%, 1)';
	}
	$.ctxmg.fillRect( Math.floor( this.sx ), Math.floor( this.sy ), this.width, this.height );
	$.ctxmg.strokeStyle = 'hsla(0, 0%, 0%, 1)';
	$.ctxmg.strokeRect( Math.floor( this.sx ) + 0.5, Math.floor( this.sy ) + 0.5, this.width - 1, this.height - 1 );
	$.ctxmg.strokeStyle = this.hovering ? 'hsla(0, 0%, 100%, 0.4)' : 'hsla(0, 0%, 100%, 0.15)';
	$.ctxmg.strokeRect( Math.floor( this.sx ) + 1.5, Math.floor( this.sy ) + 1.5, this.width - 3, this.height - 3 );

	$.ctxmg.beginPath();
	$.text( {
		ctx: $.ctxmg,
		x: this.cx,
		y: this.sy + 25,
		text: this.def.title,
		hspacing: 1,
		vspacing: 1,
		halign: 'center',
		valign: 'top',
		scale: 2,
		snap: 1,
		render: 1
	} );
	$.ctxmg.fillStyle = this.hovering ? 'hsla(0, 0%, 100%, 1)' : 'hsla(0, 0%, 100%, 0.7)';
	$.ctxmg.fill();

	$.ctxmg.beginPath();
	$.text( {
		ctx: $.ctxmg,
		x: this.cx,
		y: this.cy + 8,
		text: this.def.desc,
		hspacing: 1,
		vspacing: 6,
		halign: 'center',
		valign: 'center',
		scale: 1,
		snap: 1,
		render: 1
	} );
	$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.5)';
	$.ctxmg.fill();

	var owned = $.upgrades[ this.def.id ] || 0,
		levelText = ( owned === 0 ) ? 'NEW' : 'LV ' + ( owned + 1 ) + '/' + this.def.max;
	$.ctxmg.beginPath();
	$.text( {
		ctx: $.ctxmg,
		x: this.cx,
		y: this.ey - 18,
		text: levelText,
		hspacing: 1,
		vspacing: 1,
		halign: 'center',
		valign: 'bottom',
		scale: 1,
		snap: 1,
		render: 1
	} );
	$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.35)';
	$.ctxmg.fill();

	$.ctxmg.fillStyle = 'hsla(0, 0%, 100%, 0.05)';
	$.ctxmg.fillRect( Math.floor( this.sx ) + 2, Math.floor( this.sy ) + 2, this.width - 4, Math.floor( ( this.height - 4 ) / 2 ) );
};
