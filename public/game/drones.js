/*==============================================================================
Combat Drones - market-bought passive loadout companions

One drone equips at a time ($.storage['drone']). Each grants a single,
deliberately modest passive effect applied in hero.js/bullet.js/enemy.js -
strong enough to change how a run feels, not strong enough to be a
must-buy power spike.
==============================================================================*/
$.definitions.drones = [
	{ id: 'drone_aegis', title: 'AEGIS HALO', desc: 'REDUCES COLLISION DAMAGE' },
	{ id: 'drone_voltmite', title: 'VOLT MITE', desc: 'SHOTS CHAIN TO A NEARBY ENEMY' },
	{ id: 'drone_needlefinch', title: 'NEEDLE FINCH', desc: 'BULLETS PIERCE ENEMIES' },
	{ id: 'drone_gravbeetle', title: 'GRAV BEETLE', desc: 'PULLS NEARBY ENEMIES INWARD' },
	{ id: 'drone_medicwisp', title: 'MEDIC WISP', desc: 'SLOWLY REGENERATES HULL' }
];
