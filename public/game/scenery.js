/*==============================================================================
Sector scenery - every sector looks like a place, and three new ones

RENDER (existing hazards, same rules as before):
  $.drawRock         asteroids are faceted, lit from one side, cratered
  $.drawBlackhole    an accretion disk wrapping the event horizon, its far
                     side lensed over the top, the near side passing in front
  $.drawFlare        the solar flare is a moving wall of plasma filaments

BACKDROP:
  $.paintSectorLandmark  the far landmark painted into the slow parallax
                         plate when a sector begins (ringed giant, galaxy,
                         sun limb, nebula, derelict station, pulsar)

NEW SECTORS (update + render; damage goes through the same hazard helpers
as the old ones, so dash and shield still protect you):
  ION NEBULA   ion clouds drift; lightning arcs between two of them after a
               crackling warning. Stand clear of the line.
  WRECK FIELD  derelict hulls drift through. They are solid: they block your
               bullets and enemy bolts alike, and you and enemies slide off
               them. Cover, not a trap - touching one does no damage.
  PULSAR       a neutron star sweeps two beams around the arena. The beams
               flicker before they fire and pause between pulses.
  MINEFIELD    the arena is sown with proximity mines (objects.js)
  METEOR SHOWER  volleys of meteors streak through along marked lanes: the
               lanes show first, the rocks follow a second later
  CRYSTAL FIELD  crystals that shatter into shards that hit enemies
               (objects.js)

The light comes from the upper left everywhere, matching the bosses.
Nothing in a render path draws from Math.random, so a seeded daily or duel
run is not disturbed by drawing.
==============================================================================*/
( function() {
	var TWO_PI = Math.PI * 2,
		LIGHT_A = Math.atan2( -0.65, -0.55 );

	function hsla( h, s, l, a ) { return 'hsla(' + h + ', ' + s + '%, ' + l + '%, ' + a + ')'; }

	/*--------------------------------------------------------------------------
	Asteroids: one triangle fan per rock, each facet lit by how much its
	outward normal faces the light. The rock spins, the light does not.
	--------------------------------------------------------------------------*/
	$.drawRock = function( ctx, rock ) {
		var pts = rock.points, n = pts.length, R = rock.radius, rot = rock.rotation || 0;
		// with 3D graphics on, the rock rendered from a 3D model (objects.js);
		// its variant follows the rock's own shape numbers, never a dice roll
		if( $.objectSprites && $.storage[ 'gfx3d' ] !== 0 && rock.x !== undefined ) {
			if( rock.sid === undefined ) { rock.sid = Math.floor( ( pts[ 0 ] || 0.5 ) * 1e6 ); }
			ctx.save();
			ctx.translate( rock.x, rock.y );
			var drawn = $.objectSprites.draw( ctx, { kind: 'rock', id: rock.sid, rotation: rot, radius: R } );
			ctx.restore();
			if( drawn ) { return; }
		}
		ctx.save();
		ctx.translate( rock.x, rock.y );
		ctx.rotate( rot );
		var xs = [], ys = [];
		for( var p = 0; p < n; p++ ) {
			var a = p / n * TWO_PI;
			xs.push( Math.cos( a ) * R * pts[ p ] );
			ys.push( Math.sin( a ) * R * pts[ p ] );
		}
		// facets
		for( var i = 0; i < n; i++ ) {
			var j = ( i + 1 ) % n,
				mid = Math.atan2( ys[ i ] + ys[ j ], xs[ i ] + xs[ j ] ) + rot,
				lit = Math.cos( mid - LIGHT_A );
			ctx.beginPath();
			ctx.moveTo( xs[ i ] * 0.35, ys[ i ] * 0.35 );
			ctx.lineTo( xs[ i ], ys[ i ] );
			ctx.lineTo( xs[ j ], ys[ j ] );
			ctx.lineTo( xs[ j ] * 0.35, ys[ j ] * 0.35 );
			ctx.closePath();
			ctx.fillStyle = hsla( 28, 16, 24 + lit * 13, 1 );
			ctx.fill();
		}
		// the top face, flatter and mid-lit
		ctx.beginPath();
		for( var t = 0; t < n; t++ ) {
			if( t === 0 ) { ctx.moveTo( xs[ t ] * 0.35, ys[ t ] * 0.35 ); } else { ctx.lineTo( xs[ t ] * 0.35, ys[ t ] * 0.35 ); }
		}
		ctx.closePath();
		ctx.fillStyle = hsla( 28, 14, 30, 1 );
		ctx.fill();
		// craters, placed from the rock's own shape so they never move
		for( var c = 0; c < 2; c++ ) {
			var ca = pts[ c ] * 9 + c * 2.1, cd = R * ( 0.25 + ( pts[ c + 2 ] - 0.75 ) * 0.6 ), cr = R * ( 0.12 + ( pts[ c + 4 ] - 0.75 ) * 0.15 );
			var cx = Math.cos( ca ) * cd, cy = Math.sin( ca ) * cd;
			ctx.beginPath(); ctx.arc( cx, cy, cr, 0, TWO_PI );
			ctx.fillStyle = 'hsla(28, 15%, 12%, 0.6)'; ctx.fill();
			ctx.beginPath(); ctx.arc( cx, cy, cr, LIGHT_A - rot + Math.PI - 1.2, LIGHT_A - rot + Math.PI + 1.2 );
			ctx.lineWidth = 1.5; ctx.strokeStyle = 'hsla(30, 25%, 48%, 0.55)'; ctx.stroke();
		}
		// silhouette edge: lit rim on the light side
		ctx.beginPath();
		for( var e = 0; e < n; e++ ) {
			if( e === 0 ) { ctx.moveTo( xs[ e ], ys[ e ] ); } else { ctx.lineTo( xs[ e ], ys[ e ] ); }
		}
		ctx.closePath();
		ctx.lineWidth = 1.5;
		ctx.strokeStyle = 'hsla(30, 25%, 46%, 0.9)';
		ctx.stroke();
		ctx.restore();
	};

	/*--------------------------------------------------------------------------
	Black hole. Radii are the engine's: shadow 110 (the kill zone is 120),
	pull reaches far beyond. a = formation alpha (0..1).
	--------------------------------------------------------------------------*/
	$.drawBlackhole = function( ctx, cx, cy, a, tick ) {
		if( a <= 0.01 ) { return; }
		var spin = tick / 40, tilt = -0.18;
		ctx.save();
		ctx.translate( cx, cy );
		// gravitational glow
		var glow = ctx.createRadialGradient( 0, 0, 100, 0, 0, 320 );
		glow.addColorStop( 0, hsla( 270, 100, 60, 0.22 * a ) );
		glow.addColorStop( 1, hsla( 260, 100, 50, 0 ) );
		ctx.fillStyle = glow;
		ctx.beginPath(); ctx.arc( 0, 0, 320, 0, TWO_PI ); ctx.fill();

		function disk( front ) {
			ctx.save();
			ctx.rotate( tilt );
			ctx.scale( 1, 0.24 );
			for( var band = 0; band < 4; band++ ) {
				var rr = 150 + band * 26;
				for( var s = 0; s < 36; s++ ) {
					var a0 = s / 36 * TWO_PI + spin * ( 1.4 - band * 0.25 ),
						mid = a0 + TWO_PI / 72;
					if( ( Math.sin( mid ) > 0 ) !== front ) { continue; }
					// approaching side brighter (doppler), hotter toward the middle
					var beam = 0.5 + Math.cos( mid ) * 0.4,
						hot = 1 - band * 0.2;
					ctx.beginPath(); ctx.arc( 0, 0, rr, a0, a0 + TWO_PI / 36 + 0.01 );
					ctx.lineWidth = 22 - band * 3;
					ctx.strokeStyle = hsla( 285 - band * 18 + beam * 30, 100, 50 + hot * 20 * beam, 0.5 * a * beam * hot );
					ctx.stroke();
				}
			}
			ctx.restore();
		}
		disk( false );
		// the far side of the disk, bent up over the shadow by the lensing
		ctx.save();
		ctx.rotate( tilt );
		for( var l = 0; l < 3; l++ ) {
			ctx.beginPath();
			ctx.ellipse( 0, -6, 128 + l * 9, 118 + l * 11, 0, Math.PI * 1.04, Math.PI * 1.96 );
			ctx.lineWidth = 7 - l * 2;
			ctx.strokeStyle = hsla( 300 - l * 12, 100, 72 - l * 8, ( 0.7 - l * 0.18 ) * a );
			ctx.stroke();
		}
		ctx.restore();
		// event horizon and its photon ring
		ctx.beginPath(); ctx.arc( 0, 0, 110, 0, TWO_PI );
		ctx.fillStyle = 'hsla(0, 0%, 0%, ' + ( 0.97 * a ) + ')'; ctx.fill();
		ctx.beginPath(); ctx.arc( 0, 0, 114, 0, TWO_PI );
		ctx.lineWidth = 2.5; ctx.strokeStyle = hsla( 40, 100, 85, 0.85 * a ); ctx.stroke();
		disk( true );
		ctx.restore();
	};

	/*--------------------------------------------------------------------------
	Solar flare. Same flare object as the engine: x, width, warnTick, dir.
	--------------------------------------------------------------------------*/
	$.drawFlare = function( ctx, f, top, height, tick ) {
		if( f.warnTick > 0 ) {
			var on = Math.floor( tick / 6 ) % 2;
			ctx.fillStyle = hsla( 15, 100, 55, on ? 0.22 : 0.1 );
			ctx.fillRect( f.x - 22, top, 44, height );
			// chevrons pointing the way it will travel
			ctx.strokeStyle = hsla( 30, 100, 65, on ? 0.9 : 0.4 );
			ctx.lineWidth = 3;
			var cx = ( f.dir > 0 ) ? 40 : $.ww - 40;
			for( var c = 0; c < 6; c++ ) {
				var cy = top + height * ( 0.15 + c * 0.14 );
				ctx.beginPath();
				ctx.moveTo( cx - f.dir * 10, cy - 14 ); ctx.lineTo( cx + f.dir * 6, cy ); ctx.lineTo( cx - f.dir * 10, cy + 14 );
				ctx.stroke();
			}
			return;
		}
		var w = f.width,
			g = ctx.createLinearGradient( f.x - w, 0, f.x + w, 0 );
		g.addColorStop( 0, 'hsla(15, 100%, 50%, 0)' );
		g.addColorStop( 0.35, 'hsla(20, 100%, 55%, 0.28)' );
		g.addColorStop( 0.5, 'hsla(40, 100%, 70%, 0.55)' );
		g.addColorStop( 0.65, 'hsla(20, 100%, 55%, 0.28)' );
		g.addColorStop( 1, 'hsla(15, 100%, 50%, 0)' );
		ctx.fillStyle = g;
		ctx.fillRect( f.x - w, top, w * 2, height );
		// plasma filaments twisting up the wall
		ctx.lineWidth = 2;
		for( var k = 0; k < 5; k++ ) {
			ctx.beginPath();
			for( var y = 0; y <= height; y += 40 ) {
				var x = f.x + Math.sin( ( y + top ) / 70 + tick / 9 + k * 1.3 ) * w * ( 0.25 + k * 0.1 );
				if( y === 0 ) { ctx.moveTo( x, top + y ); } else { ctx.lineTo( x, top + y ); }
			}
			ctx.strokeStyle = hsla( 30 + k * 6, 100, 72, 0.35 );
			ctx.stroke();
		}
		ctx.fillStyle = 'hsla(48, 100%, 85%, 0.85)';
		ctx.fillRect( f.x - 2, top, 4, height );
	};

	/*--------------------------------------------------------------------------
	Landmarks for the slow parallax plate. Painted once per sector change.
	Uses its own seeded scatter so repainting never touches Math.random.
	--------------------------------------------------------------------------*/
	function scatter( seed ) {
		var s = seed >>> 0;
		return function() {
			s = ( s + 0x6D2B79F5 ) >>> 0;
			var t = Math.imul( s ^ ( s >>> 15 ), 1 | s );
			t = ( t + Math.imul( t ^ ( t >>> 7 ), 61 | t ) ) ^ t;
			return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;
		};
	}

	function planet( ctx, px, py, pr, hue, sat, ringTilt ) {
		var halo = ctx.createRadialGradient( px, py, pr * 0.9, px, py, pr * 1.5 );
		halo.addColorStop( 0, hsla( hue, 90, 60, 0.08 ) );
		halo.addColorStop( 1, hsla( hue, 90, 60, 0 ) );
		ctx.fillStyle = halo;
		ctx.fillRect( px - pr * 1.5, py - pr * 1.5, pr * 3, pr * 3 );
		if( ringTilt !== undefined ) {
			ctx.save(); ctx.translate( px, py ); ctx.rotate( ringTilt );
			ctx.beginPath(); ctx.ellipse( 0, 0, pr * 1.9, pr * 0.42, 0, Math.PI, TWO_PI );
			ctx.lineWidth = pr * 0.16; ctx.strokeStyle = hsla( hue - 10, 40, 55, 0.16 ); ctx.stroke();
			ctx.restore();
		}
		var body = ctx.createRadialGradient( px - pr * 0.4, py - pr * 0.45, pr * 0.1, px, py, pr );
		body.addColorStop( 0, hsla( hue, sat, 30, 0.9 ) );
		body.addColorStop( 0.6, hsla( hue + 10, sat, 13, 0.9 ) );
		body.addColorStop( 1, hsla( hue + 20, sat, 5, 0.92 ) );
		ctx.beginPath(); ctx.arc( px, py, pr, 0, TWO_PI ); ctx.fillStyle = body; ctx.fill();
		// cloud bands
		ctx.save(); ctx.beginPath(); ctx.arc( px, py, pr, 0, TWO_PI ); ctx.clip();
		for( var b = -3; b <= 3; b++ ) {
			ctx.fillStyle = hsla( hue + b * 6, sat, 40, 0.06 );
			ctx.fillRect( px - pr, py + b * pr * 0.24, pr * 2, pr * 0.1 );
		}
		ctx.restore();
		if( ringTilt !== undefined ) {
			ctx.save(); ctx.translate( px, py ); ctx.rotate( ringTilt );
			ctx.beginPath(); ctx.ellipse( 0, 0, pr * 1.9, pr * 0.42, 0, 0, Math.PI );
			ctx.lineWidth = pr * 0.16; ctx.strokeStyle = hsla( hue - 10, 40, 60, 0.22 ); ctx.stroke();
			ctx.restore();
		}
	}

	$.paintSectorLandmark = function( ctx, w, h, key ) {
		var rnd = scatter( 0x51ed + key.length * 977 ),
			M = Math.max( w, h );
		if( key === 'asteroids' ) {
			// a ringed giant, and the belt itself as a band of dust across the sky
			planet( ctx, w * 0.2, h * 0.24, M * 0.13, 30, 40, -0.3 );
			ctx.save(); ctx.translate( w / 2, h * 0.62 ); ctx.rotate( -0.12 );
			for( var d = 0; d < 900; d++ ) {
				var dx = ( rnd() - 0.5 ) * w * 1.4, dy = ( rnd() + rnd() - 1 ) * h * 0.09;
				ctx.fillStyle = hsla( 30, 20, 40 + rnd() * 30, 0.08 + rnd() * 0.16 );
				ctx.fillRect( dx, dy, 1 + rnd() * 2.2, 1 + rnd() * 2.2 );
			}
			ctx.restore();
		} else if( key === 'blackhole' ) {
			// a distant spiral galaxy, the kind a black hole zone sits inside
			ctx.save(); ctx.translate( w * 0.78, h * 0.22 ); ctx.rotate( 0.5 ); ctx.scale( 1, 0.45 );
			var core = ctx.createRadialGradient( 0, 0, 0, 0, 0, M * 0.08 );
			core.addColorStop( 0, 'hsla(40, 80%, 85%, 0.35)' ); core.addColorStop( 1, 'hsla(270, 80%, 60%, 0)' );
			ctx.fillStyle = core; ctx.beginPath(); ctx.arc( 0, 0, M * 0.08, 0, TWO_PI ); ctx.fill();
			for( var arm = 0; arm < 2; arm++ ) {
				for( var s = 0; s < 260; s++ ) {
					var t = s / 260, ang = arm * Math.PI + t * 5.5, rr = M * 0.02 + t * M * 0.16;
					ctx.fillStyle = hsla( 265 + t * 40, 80, 75, 0.25 * ( 1 - t ) );
					ctx.fillRect( Math.cos( ang ) * rr + ( rnd() - 0.5 ) * 10, Math.sin( ang ) * rr + ( rnd() - 0.5 ) * 10, 1.6, 1.6 );
				}
			}
			ctx.restore();
		} else if( key === 'flares' ) {
			// the star's own limb filling one edge of the sky
			var sx = w * 1.02, sy = h * 0.5, sr = M * 0.42;
			var corona = ctx.createRadialGradient( sx, sy, sr * 0.95, sx, sy, sr * 1.45 );
			corona.addColorStop( 0, 'hsla(28, 100%, 60%, 0.22)' ); corona.addColorStop( 1, 'hsla(15, 100%, 50%, 0)' );
			ctx.fillStyle = corona; ctx.fillRect( sx - sr * 1.5, sy - sr * 1.5, sr * 3, sr * 3 );
			var face = ctx.createRadialGradient( sx - sr * 0.3, sy, sr * 0.2, sx, sy, sr );
			face.addColorStop( 0, 'hsla(42, 100%, 62%, 0.5)' ); face.addColorStop( 1, 'hsla(18, 100%, 45%, 0.45)' );
			ctx.beginPath(); ctx.arc( sx, sy, sr, 0, TWO_PI ); ctx.fillStyle = face; ctx.fill();
			// prominences arching off the limb
			ctx.lineWidth = 3;
			for( var pr = 0; pr < 4; pr++ ) {
				var pa = Math.PI + ( pr - 1.5 ) * 0.28, px = sx + Math.cos( pa ) * sr, py = sy + Math.sin( pa ) * sr;
				ctx.beginPath(); ctx.moveTo( px, py - 20 );
				ctx.quadraticCurveTo( px - sr * 0.16, py, px, py + 26 );
				ctx.strokeStyle = 'hsla(25, 100%, 62%, 0.3)'; ctx.stroke();
			}
		} else if( key === 'ion' ) {
			// teal and violet cloud banks
			for( var n = 0; n < 9; n++ ) {
				$.paintNebula( ctx, rnd() * w, rnd() * h, M * ( 0.14 + rnd() * 0.22 ), rnd() < 0.6 ? 178 : 255, 0.07 + rnd() * 0.06 );
			}
		} else if( key === 'wrecks' ) {
			// a dead station on the horizon: ring, spokes, a broken arc
			var wx = w * 0.72, wy = h * 0.28, wr = M * 0.13;
			ctx.save(); ctx.translate( wx, wy ); ctx.rotate( 0.25 );
			ctx.strokeStyle = 'hsla(210, 18%, 40%, 0.28)';
			ctx.lineWidth = wr * 0.12;
			ctx.beginPath(); ctx.ellipse( 0, 0, wr, wr * 0.36, 0, 0.4, TWO_PI - 0.9 ); ctx.stroke();
			ctx.lineWidth = wr * 0.04;
			for( var sp = 0; sp < 6; sp++ ) {
				var sa = sp / 6 * TWO_PI;
				ctx.beginPath(); ctx.moveTo( 0, 0 ); ctx.lineTo( Math.cos( sa ) * wr, Math.sin( sa ) * wr * 0.36 ); ctx.stroke();
			}
			ctx.fillStyle = 'hsla(210, 18%, 30%, 0.4)';
			ctx.fillRect( -wr * 0.12, -wr * 0.3, wr * 0.24, wr * 0.6 );
			// a few lights still on
			for( var li = 0; li < 5; li++ ) {
				ctx.fillStyle = 'hsla(15, 100%, 60%, 0.5)';
				ctx.fillRect( ( rnd() - 0.5 ) * wr * 1.6, ( rnd() - 0.5 ) * wr * 0.5, 2, 2 );
			}
			ctx.restore();
		} else if( key === 'pulsar' ) {
			// far-off pulsar: a hard white point and two faint beam cones
			var qx = w * 0.15, qy = h * 0.2;
			ctx.save(); ctx.translate( qx, qy ); ctx.rotate( 0.7 );
			for( var cone = -1; cone <= 1; cone += 2 ) {
				var cg = ctx.createLinearGradient( 0, 0, cone * M * 0.5, 0 );
				cg.addColorStop( 0, 'hsla(200, 100%, 85%, 0.16)' ); cg.addColorStop( 1, 'hsla(200, 100%, 70%, 0)' );
				ctx.fillStyle = cg;
				ctx.beginPath(); ctx.moveTo( 0, 0 ); ctx.lineTo( cone * M * 0.5, -M * 0.03 ); ctx.lineTo( cone * M * 0.5, M * 0.03 ); ctx.closePath(); ctx.fill();
			}
			ctx.restore();
			var pg = ctx.createRadialGradient( qx, qy, 0, qx, qy, M * 0.03 );
			pg.addColorStop( 0, 'hsla(200, 100%, 95%, 0.9)' ); pg.addColorStop( 1, 'hsla(200, 100%, 70%, 0)' );
			ctx.fillStyle = pg; ctx.fillRect( qx - M * 0.03, qy - M * 0.03, M * 0.06, M * 0.06 );
		} else if( key === 'mines' ) {
			// a grid of distant warning beacons, the field's own lights
			for( var bc = 0; bc < 40; bc++ ) {
				var bx = rnd() * w, by = rnd() * h, br = 2 + rnd() * 3;
				var bg = ctx.createRadialGradient( bx, by, 0, bx, by, br * 6 );
				bg.addColorStop( 0, 'hsla(0, 100%, 65%, 0.35)' ); bg.addColorStop( 1, 'hsla(0, 100%, 50%, 0)' );
				ctx.fillStyle = bg; ctx.fillRect( bx - br * 6, by - br * 6, br * 12, br * 12 );
				ctx.fillStyle = 'hsla(0, 100%, 75%, 0.6)'; ctx.fillRect( bx - 1, by - 1, 2, 2 );
			}
			planet( ctx, w * 0.82, h * 0.78, M * 0.1, 355, 35 );
		} else if( key === 'meteors' ) {
			// the comet the shower is shed from, its tail across the sky
			var cx0 = w * 0.78, cy0 = h * 0.2, ang = Math.PI * 0.8;
			for( var tl = 0; tl < 3; tl++ ) {
				var tg = ctx.createLinearGradient( cx0, cy0, cx0 + Math.cos( ang ) * M * 0.9, cy0 + Math.sin( ang ) * M * 0.9 );
				tg.addColorStop( 0, 'hsla(' + ( 30 + tl * 160 ) + ', 100%, 75%, ' + ( 0.22 - tl * 0.05 ) + ')' ); tg.addColorStop( 1, 'hsla(30, 100%, 60%, 0)' );
				ctx.strokeStyle = tg; ctx.lineWidth = M * ( 0.05 - tl * 0.012 );
				ctx.beginPath(); ctx.moveTo( cx0, cy0 ); ctx.quadraticCurveTo( cx0 - M * 0.2, cy0 + M * 0.05 * ( tl + 1 ), cx0 + Math.cos( ang ) * M * 0.9, cy0 + Math.sin( ang ) * M * 0.9 ); ctx.stroke();
			}
			var cg = ctx.createRadialGradient( cx0, cy0, 0, cx0, cy0, M * 0.03 );
			cg.addColorStop( 0, 'hsla(45, 100%, 95%, 0.95)' ); cg.addColorStop( 1, 'hsla(30, 100%, 60%, 0)' );
			ctx.fillStyle = cg; ctx.fillRect( cx0 - M * 0.03, cy0 - M * 0.03, M * 0.06, M * 0.06 );
		} else if( key === 'crystals' ) {
			// a violet aurora over a crystal moon
			for( var au = 0; au < 5; au++ ) {
				ctx.beginPath();
				for( var ax = 0; ax <= w; ax += w / 24 ) {
					var ay = h * ( 0.18 + au * 0.03 ) + Math.sin( ax / w * 7 + au ) * h * 0.04;
					if( ax === 0 ) { ctx.moveTo( ax, ay ); } else { ctx.lineTo( ax, ay ); }
				}
				ctx.strokeStyle = 'hsla(' + ( 280 + au * 12 ) + ', 100%, 70%, 0.07)'; ctx.lineWidth = h * 0.05; ctx.stroke();
			}
			planet( ctx, w * 0.2, h * 0.72, M * 0.11, 285, 50 );
		} else {
			return false;
		}
		return true;
	};

	/*==========================================================================
	ION NEBULA
	==========================================================================*/
	$.ion = null;
	$.initIon = function() {
		var clouds = [];
		for( var i = 0; i < 4; i++ ) {
			clouds.push( {
				x: $.ww * ( 0.2 + 0.6 * ( ( i * 0.37 + 0.13 ) % 1 ) ),
				y: $.wh * ( 0.2 + 0.6 * ( ( i * 0.61 + 0.27 ) % 1 ) ),
				vx: ( i % 2 ? 1 : -1 ) * ( 0.25 + i * 0.06 ),
				vy: ( i < 2 ? 1 : -1 ) * ( 0.2 + i * 0.05 ),
				r: 90 + i * 14,
				phase: i * 1.7
			} );
		}
		$.ion = { clouds: clouds, timer: 300, arc: null };
	};
	// distance from point to a segment
	function segDist( px, py, ax, ay, bx, by ) {
		var dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy,
			t = len ? Math.max( 0, Math.min( 1, ( ( px - ax ) * dx + ( py - ay ) * dy ) / len ) ) : 0,
			qx = ax + dx * t - px, qy = ay + dy * t - py;
		return Math.sqrt( qx * qx + qy * qy );
	}
	$.updateIon = function() {
		if( !$.ion ) { $.initIon(); }
		var ion = $.ion, i;
		for( i = 0; i < ion.clouds.length; i++ ) {
			var c = ion.clouds[ i ];
			c.x += c.vx * $.dt; c.y += c.vy * $.dt;
			if( c.x < c.r || c.x > $.ww - c.r ) { c.vx = -c.vx; c.x = Math.max( c.r, Math.min( $.ww - c.r, c.x ) ); }
			if( c.y < c.r || c.y > $.wh - c.r ) { c.vy = -c.vy; c.y = Math.max( c.r, Math.min( $.wh - c.r, c.y ) ); }
		}
		if( !ion.arc ) {
			ion.timer -= $.dt;
			if( ion.timer <= 0 ) {
				// pick the two clouds nearest each other: the arc you can see coming
				var best = null, bd = 1e9;
				for( i = 0; i < ion.clouds.length; i++ ) {
					for( var j = i + 1; j < ion.clouds.length; j++ ) {
						var a = ion.clouds[ i ], b = ion.clouds[ j ],
							d = Math.sqrt( ( a.x - b.x ) * ( a.x - b.x ) + ( a.y - b.y ) * ( a.y - b.y ) );
						if( d < bd ) { bd = d; best = [ i, j ]; }
					}
				}
				ion.arc = { a: best[ 0 ], b: best[ 1 ], warn: 75, fire: 26 };
				if( $.audio ) { $.audio.play( 'explosionAlt' ); }
			}
		} else if( ion.arc.warn > 0 ) {
			ion.arc.warn -= $.dt;
			if( ion.arc.warn <= 0 && $.sfx ) { $.sfx.play( 'zap' ); }
		} else {
			ion.arc.fire -= $.dt;
			var A = ion.clouds[ ion.arc.a ], B = ion.clouds[ ion.arc.b ];
			if( segDist( $.hero.x, $.hero.y, A.x, A.y, B.x, B.y ) < 24 + $.hero.radius ) {
				$.hazardDamageHero( 0.009 * $.dt );
			}
			var ei = $.enemies.length;
			while( ei-- ) {
				var en = $.enemies[ ei ];
				if( segDist( en.x, en.y, A.x, A.y, B.x, B.y ) < 24 + en.radius ) {
					$.hazardDamageEnemy( en, ei, 0.08 * $.dt );
				}
			}
			if( ion.arc.fire <= 0 ) {
				ion.arc = null;
				ion.timer = 220 + ( ( $.tick * 7 ) % 140 );
			}
		}
	};
	// a jagged bolt between two points; the jags come from tick, not random
	function bolt( ctx, ax, ay, bx, by, tick, spread ) {
		var dx = bx - ax, dy = by - ay, len = Math.sqrt( dx * dx + dy * dy ) || 1,
			nx = -dy / len, ny = dx / len, steps = Math.max( 4, Math.floor( len / 28 ) );
		ctx.beginPath(); ctx.moveTo( ax, ay );
		for( var s = 1; s < steps; s++ ) {
			var t = s / steps,
				off = Math.sin( s * 12.9898 + Math.floor( tick / 2 ) * 78.233 ) * spread;
			ctx.lineTo( ax + dx * t + nx * off, ay + dy * t + ny * off );
		}
		ctx.lineTo( bx, by );
	}
	$.renderIon = function( ctx ) {
		if( !$.ion ) { return; }
		var ion = $.ion, tick = $.tick;
		for( var i = 0; i < ion.clouds.length; i++ ) {
			var c = ion.clouds[ i ], wob = 1 + Math.sin( tick / 30 + c.phase ) * 0.06,
				g = ctx.createRadialGradient( c.x, c.y, 0, c.x, c.y, c.r * wob );
			g.addColorStop( 0, 'hsla(185, 90%, 70%, 0.28)' );
			g.addColorStop( 0.5, 'hsla(200, 90%, 55%, 0.12)' );
			g.addColorStop( 1, 'hsla(250, 90%, 50%, 0)' );
			ctx.fillStyle = g;
			ctx.beginPath(); ctx.arc( c.x, c.y, c.r * wob, 0, TWO_PI ); ctx.fill();
			// a charged core that brightens when this cloud is about to arc
			var charged = ion.arc && ( ion.arc.a === i || ion.arc.b === i );
			$.util.fillCircle( ctx, c.x, c.y, charged ? 10 : 5, 'hsla(185, 100%, 85%, ' + ( charged ? 0.9 : 0.4 ) + ')' );
		}
		if( ion.arc ) {
			var A = ion.clouds[ ion.arc.a ], B = ion.clouds[ ion.arc.b ];
			if( ion.arc.warn > 0 ) {
				// crackle: faint, thin, flickering - the warning
				if( Math.floor( tick / 3 ) % 2 ) {
					bolt( ctx, A.x, A.y, B.x, B.y, tick, 10 );
					ctx.lineWidth = 1.2; ctx.strokeStyle = 'hsla(185, 100%, 80%, 0.5)'; ctx.stroke();
				}
			} else {
				bolt( ctx, A.x, A.y, B.x, B.y, tick, 18 );
				ctx.lineWidth = 14; ctx.strokeStyle = 'hsla(190, 100%, 60%, 0.2)'; ctx.stroke();
				ctx.lineWidth = 3.5; ctx.strokeStyle = 'hsla(185, 100%, 92%, 0.95)'; ctx.stroke();
			}
		}
	};

	/*==========================================================================
	WRECK FIELD
	==========================================================================*/
	$.wrecks = null;
	$.initWrecks = function() {
		$.wrecks = [];
		for( var i = 0; i < 3; i++ ) {
			$.wrecks.push( {
				x: $.ww * ( 0.25 + i * 0.25 ),
				y: $.wh * ( i % 2 ? 0.3 : 0.7 ),
				vx: ( i - 1 ) * 0.18 + 0.08,
				vy: ( i % 2 ? 0.12 : -0.12 ),
				rot: i * 1.1,
				vr: ( i - 1 ) * 0.0012 + 0.0006,
				hw: 150 + i * 20,
				hh: 34 + i * 6,
				hue: 205 + i * 12
			} );
		}
	};
	// point into wreck-local space (x along the hull, y across it)
	function local( w, x, y ) {
		var dx = x - w.x, dy = y - w.y, c = Math.cos( -w.rot ), s = Math.sin( -w.rot );
		return { x: dx * c - dy * s, y: dx * s + dy * c };
	}
	function pushOut( w, obj, rad ) {
		var p = local( w, obj.x, obj.y ),
			ox = w.hw + rad - Math.abs( p.x ),
			oy = w.hh + rad - Math.abs( p.y );
		if( ox <= 0 || oy <= 0 ) { return false; }
		// shove out along the shallow axis, in wreck space, then back to world
		var lx = 0, ly = 0;
		if( ox < oy ) { lx = ( p.x < 0 ? -ox : ox ); } else { ly = ( p.y < 0 ? -oy : oy ); }
		var c = Math.cos( w.rot ), s = Math.sin( w.rot );
		obj.x += lx * c - ly * s;
		obj.y += lx * s + ly * c;
		return true;
	}
	$.wreckBlocks = function( x, y ) {
		if( !$.wrecks ) { return false; }
		for( var i = 0; i < $.wrecks.length; i++ ) {
			var p = local( $.wrecks[ i ], x, y );
			if( Math.abs( p.x ) < $.wrecks[ i ].hw && Math.abs( p.y ) < $.wrecks[ i ].hh ) { return true; }
		}
		return false;
	};
	$.updateWrecks = function() {
		if( !$.wrecks ) { $.initWrecks(); }
		for( var i = 0; i < $.wrecks.length; i++ ) {
			var w = $.wrecks[ i ];
			w.x += w.vx * $.dt; w.y += w.vy * $.dt; w.rot += w.vr * $.dt;
			if( w.x < w.hw * 0.5 || w.x > $.ww - w.hw * 0.5 ) { w.vx = -w.vx; }
			if( w.y < w.hw * 0.5 || w.y > $.wh - w.hw * 0.5 ) { w.vy = -w.vy; }
			if( $.hero && $.hero.life > 0 ) { pushOut( w, $.hero, $.hero.radius ); }
			var ei = $.enemies.length;
			while( ei-- ) {
				var en = $.enemies[ ei ];
				if( en.isBoss ) { continue; }
				if( en.isBolt ) {
					// enemy fire dies on the hull (no score, no drop - it was a bullet)
					if( $.wreckBlocks( en.x, en.y ) ) { $.enemies.splice( ei, 1 ); }
					continue;
				}
				pushOut( w, en, en.radius * 0.8 );
			}
		}
		var bi = $.bullets.length;
		while( bi-- ) {
			var b = $.bullets[ bi ];
			if( $.wreckBlocks( b.x, b.y ) ) {
				$.bullets.splice( bi, 1 );
				if( $.ParticleEmitter && $.particleEmitters ) {
					$.particleEmitters.push( new $.ParticleEmitter( { x: b.x, y: b.y, count: 1, spawnRange: 0, friction: 0.85, minSpeed: 1, maxSpeed: 4, minDirection: 0, maxDirection: TWO_PI, hue: 30, saturation: 30 } ) );
				}
			}
		}
	};
	$.renderWrecks = function( ctx ) {
		if( !$.wrecks ) { return; }
		for( var i = 0; i < $.wrecks.length; i++ ) {
			var w = $.wrecks[ i ], face = Math.cos( w.rot + Math.PI / 2 - LIGHT_A );
			ctx.save();
			ctx.translate( w.x, w.y );
			ctx.rotate( w.rot );
			// hull: two long faces, one lit, one in shadow, so it reads as a solid
			ctx.beginPath();
			ctx.moveTo( -w.hw, -w.hh * 0.7 ); ctx.lineTo( -w.hw * 0.8, -w.hh ); ctx.lineTo( w.hw * 0.75, -w.hh ); ctx.lineTo( w.hw, -w.hh * 0.3 ); ctx.lineTo( w.hw, 0 ); ctx.lineTo( -w.hw, 0 ); ctx.closePath();
			ctx.fillStyle = hsla( w.hue, 14, 26 + face * 10, 1 ); ctx.fill();
			ctx.beginPath();
			ctx.moveTo( -w.hw, 0 ); ctx.lineTo( w.hw, 0 ); ctx.lineTo( w.hw, w.hh * 0.4 ); ctx.lineTo( w.hw * 0.7, w.hh ); ctx.lineTo( -w.hw * 0.85, w.hh ); ctx.lineTo( -w.hw, w.hh * 0.6 ); ctx.closePath();
			ctx.fillStyle = hsla( w.hue, 14, 15 - face * 5, 1 ); ctx.fill();
			// torn-open section with a glow inside
			ctx.beginPath();
			ctx.moveTo( w.hw * 0.1, -w.hh ); ctx.lineTo( w.hw * 0.22, -w.hh * 0.2 ); ctx.lineTo( w.hw * 0.35, -w.hh * 0.75 ); ctx.lineTo( w.hw * 0.42, w.hh * 0.3 ); ctx.lineTo( w.hw * 0.5, -w.hh );
			ctx.closePath();
			ctx.fillStyle = 'hsla(18, 100%, 50%, ' + ( 0.25 + Math.sin( $.tick / 20 + i ) * 0.1 ) + ')'; ctx.fill();
			// panel seams and a row of dead windows
			ctx.strokeStyle = 'hsla(210, 20%, 55%, 0.35)'; ctx.lineWidth = 1.2;
			ctx.beginPath();
			for( var s = -3; s <= 3; s++ ) { ctx.moveTo( s * w.hw * 0.25, -w.hh ); ctx.lineTo( s * w.hw * 0.25, w.hh ); }
			ctx.stroke();
			for( var wi = 0; wi < 8; wi++ ) {
				var on = ( ( wi * 5 + i * 3 ) % 7 ) === 0 && Math.floor( $.tick / 40 + wi ) % 3;
				ctx.fillStyle = on ? 'hsla(45, 100%, 65%, 0.8)' : 'hsla(210, 20%, 8%, 0.9)';
				ctx.fillRect( -w.hw * 0.7 + wi * w.hw * 0.18, -w.hh * 0.55, 6, 4 );
			}
			// outer edge, so the solid part reads clearly against the sky
			ctx.beginPath();
			ctx.moveTo( -w.hw, -w.hh * 0.7 ); ctx.lineTo( -w.hw * 0.8, -w.hh ); ctx.lineTo( w.hw * 0.75, -w.hh ); ctx.lineTo( w.hw, -w.hh * 0.3 );
			ctx.lineTo( w.hw, w.hh * 0.4 ); ctx.lineTo( w.hw * 0.7, w.hh ); ctx.lineTo( -w.hw * 0.85, w.hh ); ctx.lineTo( -w.hw, w.hh * 0.6 ); ctx.closePath();
			ctx.lineWidth = 2; ctx.strokeStyle = 'hsla(210, 30%, 60%, 0.5)'; ctx.stroke();
			ctx.restore();
		}
	};

	/*==========================================================================
	PULSAR
	==========================================================================*/
	$.pulsar = null;
	$.initPulsar = function() {
		$.pulsar = { x: $.ww * 0.5, y: $.wh * 0.5, angle: 0, cycle: 0, on: 0 };
	};
	// beams are ON for 150 frames, OFF for 120, with a 50-frame flicker warning
	var PULSE_ON = 150, PULSE_OFF = 120, PULSE_WARN = 50;
	$.pulsarState = function() {
		var p = $.pulsar, t = p.cycle % ( PULSE_ON + PULSE_OFF );
		if( t < PULSE_OFF - PULSE_WARN ) { return 'off'; }
		if( t < PULSE_OFF ) { return 'warn'; }
		return 'on';
	};
	function inBeam( p, x, y, pad ) {
		var dx = x - p.x, dy = y - p.y,
			c = Math.cos( p.angle ), s = Math.sin( p.angle ),
			across = Math.abs( -s * dx + c * dy );
		return across < 16 + pad && ( dx * dx + dy * dy ) > 60 * 60;
	}
	// for objects.js: is this point in a firing beam right now?
	$.pulsarHits = function( x, y, pad ) {
		return !!( $.pulsar && $.sector && $.sector.hazard === 'pulsar' && $.pulsarState() === 'on' && inBeam( $.pulsar, x, y, pad ) );
	};

	$.updatePulsar = function() {
		if( !$.pulsar ) { $.initPulsar(); }
		var p = $.pulsar;
		p.cycle += $.dt;
		p.angle += 0.0042 * $.dt;
		// the star drifts slowly so the safe spots move
		p.x = $.ww * 0.5 + Math.cos( p.cycle / 900 ) * $.ww * 0.18;
		p.y = $.wh * 0.5 + Math.sin( p.cycle / 700 ) * $.wh * 0.16;
		if( $.pulsarState() !== 'on' ) { return; }
		if( inBeam( p, $.hero.x, $.hero.y, $.hero.radius ) ) {
			$.hazardDamageHero( 0.006 * $.dt );
		}
		var ei = $.enemies.length;
		while( ei-- ) {
			var en = $.enemies[ ei ];
			if( !en.isBolt && inBeam( p, en.x, en.y, en.radius ) ) { $.hazardDamageEnemy( en, ei, 0.06 * $.dt ); }
		}
	};
	$.renderPulsar = function( ctx ) {
		if( !$.pulsar ) { return; }
		var p = $.pulsar, st = $.pulsarState(), reach = Math.max( $.ww, $.wh ) * 1.5;
		ctx.save();
		ctx.translate( p.x, p.y );
		ctx.rotate( p.angle );
		if( st === 'warn' ) {
			if( Math.floor( $.tick / 4 ) % 2 ) {
				ctx.setLineDash( [ 18, 14 ] );
				ctx.lineWidth = 2; ctx.strokeStyle = 'hsla(200, 100%, 80%, 0.55)';
				ctx.beginPath(); ctx.moveTo( -reach, 0 ); ctx.lineTo( reach, 0 ); ctx.stroke();
				ctx.setLineDash( [] );
			}
		} else if( st === 'on' ) {
			for( var side = -1; side <= 1; side += 2 ) {
				var g = ctx.createLinearGradient( 0, -32, 0, 32 );
				g.addColorStop( 0, 'hsla(200, 100%, 60%, 0)' );
				g.addColorStop( 0.5, 'hsla(195, 100%, 80%, 0.45)' );
				g.addColorStop( 1, 'hsla(200, 100%, 60%, 0)' );
				ctx.fillStyle = g;
				ctx.fillRect( side > 0 ? 60 : -reach, -32, reach - 60, 64 );
				ctx.fillStyle = 'hsla(190, 100%, 95%, 0.9)';
				ctx.fillRect( side > 0 ? 60 : -reach, -2.5, reach - 60, 5 );
			}
		}
		ctx.restore();
		// the neutron star itself
		var spinA = $.tick / 5,
			pg = ctx.createRadialGradient( p.x, p.y, 0, p.x, p.y, 70 );
		pg.addColorStop( 0, 'hsla(200, 100%, 97%, 1)' );
		pg.addColorStop( 0.2, 'hsla(200, 100%, 75%, 0.6)' );
		pg.addColorStop( 1, 'hsla(220, 100%, 50%, 0)' );
		ctx.fillStyle = pg;
		ctx.beginPath(); ctx.arc( p.x, p.y, 70, 0, TWO_PI ); ctx.fill();
		ctx.strokeStyle = 'hsla(200, 100%, 85%, 0.5)'; ctx.lineWidth = 1.5;
		for( var m = 0; m < 3; m++ ) {
			ctx.beginPath();
			ctx.ellipse( p.x, p.y, 34 + m * 10, 12 + m * 4, spinA + m, 0, TWO_PI );
			ctx.stroke();
		}
	};

	/*==========================================================================
	METEOR SHOWER
	==========================================================================*/
	$.meteors = null;
	var LANE_WARN = 60, METEOR_SPEED = 15;
	$.updateMeteors = function() {
		if( !$.meteors ) { $.meteors = { timer: 120, lanes: [], volley: 0 }; }
		var m = $.meteors, dt = $.dt, i;
		m.timer -= dt;
		if( m.timer <= 0 && $.hero ) {
			// a volley: 3-5 parallel lanes through the area around the plane.
			// The lane angles and offsets come from the volley count, not
			// Math.random, so a seeded raid's waves are untouched
			m.volley++;
			var ang = 0.6 + ( ( m.volley * 0.7548 ) % 1 ) * 1.9, n = 3 + m.volley % 3,
				nx = -Math.sin( ang ), ny = Math.cos( ang ), span = Math.max( $.cw, $.ch ) * 1.2;
			for( i = 0; i < n; i++ ) {
				var off = ( i - ( n - 1 ) / 2 ) * 130 + ( ( m.volley * 37 ) % 90 ) - 45,
					cx = $.hero.x + nx * off, cy = $.hero.y + ny * off;
				m.lanes.push( {
					x0: cx - Math.cos( ang ) * span, y0: cy - Math.sin( ang ) * span,
					x1: cx + Math.cos( ang ) * span, y1: cy + Math.sin( ang ) * span,
					ang: ang, warn: LANE_WARN + i * 8, t: 0, len: span * 2, hitHero: 0, r: 13 + ( i % 2 ) * 5
				} );
			}
			m.timer = 200 + ( m.volley * 53 ) % 120;
			if( $.audio ) { $.audio.play( 'explosionAlt' ); }
		}
		for( i = m.lanes.length - 1; i >= 0; i-- ) {
			var l = m.lanes[ i ];
			if( l.warn > 0 ) { l.warn -= dt; continue; }
			l.t += METEOR_SPEED * dt;
			if( l.t > l.len ) { m.lanes.splice( i, 1 ); continue; }
			var mx = l.x0 + Math.cos( l.ang ) * l.t, my = l.y0 + Math.sin( l.ang ) * l.t;
			l.mx = mx; l.my = my;
			if( !l.hitHero && $.hero.life > 0 && $.util.distance( mx, my, $.hero.x, $.hero.y ) < l.r + $.hero.radius ) {
				l.hitHero = 1;
				$.hazardDamageHero( 0.11 );
				if( $.addHitstop ) { $.addHitstop( 4 ); }
			}
			var ei = $.enemies.length;
			while( ei-- ) {
				var en = $.enemies[ ei ];
				if( !en.isBoss && $.util.distance( mx, my, en.x, en.y ) < l.r + en.radius ) { $.hazardDamageEnemy( en, ei, 0.2 * dt ); }
			}
			if( $.objects ) {
				for( var oi = $.objects.length - 1; oi >= 0; oi-- ) {
					var ob = $.objects[ oi ];
					if( $.util.distance( mx, my, ob.x, ob.y ) < l.r + ob.radius ) { $.hurtObject( oi, 0.4 * dt, false ); }
				}
			}
		}
	};
	$.renderMeteors = function( ctx ) {
		if( !$.meteors ) { return; }
		var lanes = $.meteors.lanes;
		for( var i = 0; i < lanes.length; i++ ) {
			var l = lanes[ i ];
			if( l.warn > 0 ) {
				// the lane first: a dashed red line with arrowheads, brighter as it nears
				var a = 0.25 + ( 1 - l.warn / ( LANE_WARN + 24 ) ) * 0.5;
				ctx.setLineDash( [ 22, 16 ] );
				ctx.lineWidth = 2; ctx.strokeStyle = 'hsla(15, 100%, 60%, ' + a.toFixed( 3 ) + ')';
				ctx.beginPath(); ctx.moveTo( l.x0, l.y0 ); ctx.lineTo( l.x1, l.y1 ); ctx.stroke();
				ctx.setLineDash( [] );
				continue;
			}
			// the meteor: a hot rock with a long fiery tail (from its first
			// moved frame - the lane's warning can end between update and draw)
			if( l.mx === undefined ) { continue; }
			var tx = -Math.cos( l.ang ), ty = -Math.sin( l.ang ), tail = 150;
			var g = ctx.createLinearGradient( l.mx, l.my, l.mx + tx * tail, l.my + ty * tail );
			g.addColorStop( 0, 'hsla(40, 100%, 75%, 0.9)' ); g.addColorStop( 0.3, 'hsla(18, 100%, 55%, 0.5)' ); g.addColorStop( 1, 'hsla(10, 100%, 45%, 0)' );
			ctx.strokeStyle = g; ctx.lineCap = 'round'; ctx.lineWidth = l.r * 1.4;
			ctx.beginPath(); ctx.moveTo( l.mx, l.my ); ctx.lineTo( l.mx + tx * tail, l.my + ty * tail ); ctx.stroke();
			var sprites = $.objectSprites && $.storage[ 'gfx3d' ] !== 0 ? $.objectSprites : null, drawn = false;
			if( sprites ) {
				// a real rock, glowing hot on the side it is flying into
				ctx.save();
				ctx.translate( l.mx, l.my );
				drawn = sprites.draw( ctx, { kind: 'rock', id: i * 7919 + 13, rotation: l.ang, radius: l.r * 1.15 } );
				if( drawn ) {
					var hot = ctx.createRadialGradient( -tx * l.r * 0.5, -ty * l.r * 0.5, 0, 0, 0, l.r * 1.4 );
					hot.addColorStop( 0, 'hsla(38, 100%, 70%, 0.75)' ); hot.addColorStop( 0.5, 'hsla(18, 100%, 50%, 0.35)' ); hot.addColorStop( 1, 'hsla(10, 100%, 40%, 0)' );
					ctx.globalCompositeOperation = 'lighter';
					ctx.fillStyle = hot; ctx.beginPath(); ctx.arc( 0, 0, l.r * 1.4, 0, TWO_PI ); ctx.fill();
					ctx.globalCompositeOperation = 'source-over';
				}
				ctx.restore();
			}
			if( !drawn ) {
				var rg = ctx.createRadialGradient( l.mx - l.r * 0.3, l.my - l.r * 0.3, 1, l.mx, l.my, l.r );
				rg.addColorStop( 0, 'hsl(35, 60%, 70%)' ); rg.addColorStop( 1, 'hsl(18, 40%, 22%)' );
				ctx.beginPath(); ctx.arc( l.mx, l.my, l.r, 0, TWO_PI ); ctx.fillStyle = rg; ctx.fill();
			}
			ctx.lineCap = 'butt';
		}
	};
} )();
