/*==============================================================================
Synth effects and sector music themes

$.sfx.play( name ) - sounds the jsfxr set never had, built live in Web Audio
on the effects bus ($.audio.gain), so FULL / LOW / MUTE applies to them:

  thump     a sub-bass hit layered under explosions, so a kill has weight
  bigboom   a long rumbling blast for a boss or a heavy going down
  warp      a rising sweep with a filtered rush - the jump between sectors
  launch    an afterburner roar, rising then settling
  alarm     the two-tone boss warning
  zap       an ion arc discharge

Each is rate-limited, and all are no-ops until audio has been unlocked by a
tap (the engine's existing $.audio.unlock).

$.music.themes - one groove per sector (key, tempo, bass and lead lines),
and $.music.setTheme( i ) switches at the next bar so the change lands on
the beat. $.music.boss doubles the drums and keeps the lead in every bar
while a boss is alive.
==============================================================================*/
$.sfx = {
	last: {},
	gap: { thump: 70, bigboom: 400, warp: 600, launch: 800, alarm: 900, zap: 120 },
	noise: null,
	ready: function() {
		return !!( $.audio && $.audio.ctx && $.audio.gain && $.soundLevel > 0 && $.audio.ctx.state !== 'closed' );
	},
	noiseBuffer: function( ctx ) {
		if( this.noise && this.noise.sampleRate === ctx.sampleRate ) { return this.noise; }
		var len = Math.floor( ctx.sampleRate * 1.5 ), buf = ctx.createBuffer( 1, len, ctx.sampleRate ), d = buf.getChannelData( 0 );
		// fixed noise (no Math.random) - a seeded run is never disturbed by sound
		var s = 22222;
		for( var i = 0; i < len; i++ ) { s = ( s * 1103515245 + 12345 ) & 0x7fffffff; d[ i ] = s / 0x3fffffff - 1; }
		this.noise = buf;
		return buf;
	},
	env: function( g, t, a, peak, hold, rel ) {
		g.gain.setValueAtTime( 0.0001, t );
		g.gain.exponentialRampToValueAtTime( peak, t + a );
		g.gain.setValueAtTime( peak, t + a + hold );
		g.gain.exponentialRampToValueAtTime( 0.0001, t + a + hold + rel );
	},
	tone: function( ctx, out, t, type, f0, f1, dur, peak ) {
		var o = ctx.createOscillator(), g = ctx.createGain();
		o.type = type;
		o.frequency.setValueAtTime( f0, t );
		o.frequency.exponentialRampToValueAtTime( Math.max( 1, f1 ), t + dur );
		this.env( g, t, 0.005, peak, 0, dur );
		o.connect( g ); g.connect( out );
		o.start( t ); o.stop( t + dur + 0.05 );
	},
	hiss: function( ctx, out, t, dur, peak, type, f0, f1, q ) {
		var src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
		src.buffer = this.noiseBuffer( ctx );
		f.type = type; f.Q.value = q || 1;
		f.frequency.setValueAtTime( f0, t );
		f.frequency.exponentialRampToValueAtTime( Math.max( 20, f1 ), t + dur );
		this.env( g, t, Math.min( 0.05, dur * 0.2 ), peak, dur * 0.2, dur * 0.8 );
		src.connect( f ); f.connect( g ); g.connect( out );
		src.start( t ); src.stop( t + dur + 0.1 );
	},
	play: function( name ) {
		try {
			if( !this.ready() ) { return; }
			var now = Date.now();
			if( this.last[ name ] && now - this.last[ name ] < ( this.gap[ name ] || 60 ) ) { return; }
			this.last[ name ] = now;
			var ctx = $.audio.ctx, out = $.audio.gain, t = ctx.currentTime + 0.005;
			if( name === 'thump' ) {
				this.tone( ctx, out, t, 'sine', 110, 38, 0.22, 0.55 );
			} else if( name === 'bigboom' ) {
				this.tone( ctx, out, t, 'sine', 80, 24, 0.9, 0.8 );
				this.hiss( ctx, out, t, 1.3, 0.5, 'lowpass', 2400, 120, 0.7 );
			} else if( name === 'warp' ) {
				this.tone( ctx, out, t, 'sawtooth', 70, 900, 1.0, 0.07 );
				this.tone( ctx, out, t, 'sine', 140, 1800, 1.0, 0.12 );
				this.hiss( ctx, out, t, 1.2, 0.22, 'bandpass', 300, 5000, 2 );
				this.tone( ctx, out, t + 0.72, 'sine', 900, 60, 0.4, 0.3 );
			} else if( name === 'launch' ) {
				this.hiss( ctx, out, t, 1.1, 0.3, 'lowpass', 400, 3200, 1.2 );
				this.tone( ctx, out, t, 'sawtooth', 55, 130, 0.9, 0.06 );
			} else if( name === 'alarm' ) {
				for( var i = 0; i < 4; i++ ) {
					this.tone( ctx, out, t + i * 0.22, 'square', i % 2 ? 620 : 880, i % 2 ? 610 : 870, 0.18, 0.06 );
				}
			} else if( name === 'zap' ) {
				this.hiss( ctx, out, t, 0.25, 0.3, 'highpass', 3000, 900, 0.8 );
				this.tone( ctx, out, t, 'square', 1400, 180, 0.2, 0.05 );
			}
		} catch( e ) {
			// sound is best-effort, never breaks the game
		}
	}
};

/*------------------------------------------------------------------------------
Sector themes. MIDI note numbers; 0 is a rest. The bass is played an octave
down by the scheduler, exactly as before. Index matches $.definitions.sectors.
------------------------------------------------------------------------------*/
$.musicThemes = [
	// DEEP SPACE - the original groove, A minor, 112
	{ bpm: 112, wave: 'square', bass: [ 45, 45, 45, 48, 45, 45, 43, 45, 41, 41, 41, 45, 43, 43, 48, 43 ], lead: [ 69, 0, 72, 0, 76, 0, 72, 0, 81, 0, 76, 0, 72, 0, 76, 0 ] },
	// ASTEROID BELT - driving, D minor, 118
	{ bpm: 118, wave: 'square', bass: [ 50, 50, 62, 50, 50, 53, 50, 48, 46, 46, 58, 46, 48, 48, 60, 48 ], lead: [ 74, 0, 77, 0, 81, 0, 77, 74, 70, 0, 74, 0, 72, 0, 76, 0 ] },
	// BLACK HOLE ZONE - slow and heavy, phrygian, 96
	{ bpm: 96, wave: 'sawtooth', bass: [ 42, 42, 42, 43, 42, 42, 42, 43, 40, 40, 40, 42, 43, 43, 42, 40 ], lead: [ 66, 0, 0, 67, 0, 0, 69, 0, 66, 0, 0, 64, 0, 0, 62, 0 ] },
	// SOLAR STORM - fast octave bass, E minor, 128
	{ bpm: 128, wave: 'square', bass: [ 40, 52, 40, 52, 43, 55, 43, 55, 45, 57, 45, 57, 47, 59, 47, 59 ], lead: [ 76, 79, 83, 79, 76, 79, 83, 86, 81, 79, 76, 74, 76, 0, 0, 0 ] },
	// ION NEBULA - airy and bright, C lydian, 104
	{ bpm: 104, wave: 'triangle', bass: [ 48, 48, 55, 48, 50, 50, 57, 50, 52, 52, 59, 52, 54, 54, 55, 50 ], lead: [ 72, 0, 76, 0, 79, 0, 83, 0, 78, 0, 76, 0, 74, 0, 72, 0 ] },
	// WRECK FIELD - grinding, G minor, 100
	{ bpm: 100, wave: 'sawtooth', bass: [ 43, 43, 43, 43, 46, 46, 43, 43, 41, 41, 41, 41, 38, 38, 41, 43 ], lead: [ 67, 0, 70, 0, 74, 0, 72, 70, 0, 0, 67, 0, 65, 0, 67, 0 ] },
	// PULSAR - a pulsing beat, B minor, 120
	{ bpm: 120, wave: 'square', bass: [ 47, 47, 59, 47, 47, 59, 47, 47, 50, 50, 62, 50, 52, 52, 64, 52 ], lead: [ 83, 0, 0, 83, 0, 0, 86, 0, 81, 0, 0, 78, 0, 0, 76, 0 ] },
	// MINEFIELD - tense and sparse, F minor, 92
	{ bpm: 92, wave: 'triangle', bass: [ 41, 41, 41, 41, 44, 44, 41, 41, 39, 39, 39, 39, 36, 36, 39, 41 ], lead: [ 65, 0, 0, 0, 68, 0, 0, 0, 63, 0, 0, 0, 60, 0, 0, 0 ] },
	// METEOR SHOWER - fast and loud, D minor, 132
	{ bpm: 132, wave: 'sawtooth', bass: [ 38, 50, 38, 50, 41, 53, 41, 53, 43, 55, 43, 55, 45, 57, 45, 57 ], lead: [ 74, 77, 81, 0, 79, 77, 74, 0, 72, 74, 77, 0, 76, 0, 74, 0 ] },
	// CRYSTAL FIELD - glassy, C# minor, 108
	{ bpm: 108, wave: 'triangle', bass: [ 49, 49, 56, 49, 51, 51, 58, 51, 46, 46, 53, 46, 48, 48, 55, 48 ], lead: [ 73, 0, 80, 0, 85, 0, 80, 0, 78, 0, 82, 0, 85, 0, 80, 0 ] }
];

/*==============================================================================
Music - procedural synth loop (WebAudio, no audio files)

A dark space-arcade groove: pulsing bass, kick on the quarters, hat
offbeats, and a sparse lead arpeggio that only plays during combat.
Starts on the first PLAY (a user gesture, so autoplay rules allow it)
and respects the M mute toggle.

Each sector has its own theme ($.musicThemes, in sfx.js): key, tempo, bass
and lead. setTheme() queues a change that lands on the next bar line, so a
sector change never cuts a phrase in half. While a boss is alive ($.music.boss)
the hats double, the kick picks up a pickup beat and the lead plays every bar.
==============================================================================*/
$.music = {
	ctx: null,
	started: 0,
	// the music bed's own level, before the player's FULL/LOW/MUTE control is
	// applied on top of it (see $.setSoundLevel)
	baseGain: 0.16,
	step: 0,
	nextTime: 0,
	stepLength: 60 / 112 / 4, // 112 bpm, 16th notes
	bass: [ 45, 45, 45, 48, 45, 45, 43, 45, 41, 41, 41, 45, 43, 43, 48, 43 ],
	lead: [ 69, 0, 72, 0, 76, 0, 72, 0, 81, 0, 76, 0, 72, 0, 76, 0 ],
	bar: 0,
	wave: 'square',
	theme: 0,
	pendingTheme: -1,
	boss: 0,

	// queue a sector theme; applied on the next bar line by schedule()
	setTheme: function( index ) {
		var list = $.musicThemes;
		if( !list || !list.length ) { return; }
		var i = ( ( index % list.length ) + list.length ) % list.length;
		if( i === this.theme && this.pendingTheme < 0 ) { return; }
		this.pendingTheme = i;
		// not playing yet: take it now, there is no phrase to protect
		if( !this.started ) { this.applyTheme(); }
	},

	applyTheme: function() {
		var t = $.musicThemes && $.musicThemes[ this.pendingTheme ];
		if( t ) {
			this.theme = this.pendingTheme;
			this.bass = t.bass;
			this.lead = t.lead;
			this.wave = t.wave || 'square';
			this.stepLength = 60 / t.bpm / 4;
		}
		this.pendingTheme = -1;
	},

	freq: function( midi ) {
		return 440 * Math.pow( 2, ( midi - 69 ) / 12 );
	},

	start: function() {
		try {
			if( !this.ctx ) {
				var AudioContextClass = window.AudioContext || window.webkitAudioContext;
				if( !AudioContextClass ) {
					return;
				}
				this.ctx = new AudioContextClass();
				this.master = this.ctx.createGain();
				this.master.gain.value = this.baseGain * ( $.soundLevel !== undefined ? $.soundLevel : 1 );
				this.master.connect( this.ctx.destination );
			}
			if( this.ctx.state === 'suspended' ) {
				this.ctx.resume();
			}
			if( !this.started ) {
				this.started = 1;
				this.nextTime = this.ctx.currentTime + 0.05;
				var self = this;
				this.timer = setInterval( function() { self.schedule(); }, 90 );
			}
		} catch ( e ) {
			// no audio available; the game plays on silently
		}
	},

	note: function( time, midi, length, type, volume ) {
		var osc = this.ctx.createOscillator(),
			gain = this.ctx.createGain();
		osc.type = type;
		osc.frequency.value = this.freq( midi );
		gain.gain.setValueAtTime( volume, time );
		gain.gain.exponentialRampToValueAtTime( 0.001, time + length );
		osc.connect( gain );
		gain.connect( this.master );
		osc.start( time );
		osc.stop( time + length + 0.02 );
	},

	kick: function( time ) {
		var osc = this.ctx.createOscillator(),
			gain = this.ctx.createGain();
		osc.type = 'sine';
		osc.frequency.setValueAtTime( 120, time );
		osc.frequency.exponentialRampToValueAtTime( 35, time + 0.12 );
		gain.gain.setValueAtTime( 0.9, time );
		gain.gain.exponentialRampToValueAtTime( 0.001, time + 0.14 );
		osc.connect( gain );
		gain.connect( this.master );
		osc.start( time );
		osc.stop( time + 0.16 );
	},

	hat: function( time ) {
		var bufferSize = Math.floor( this.ctx.sampleRate * 0.03 ),
			buffer = this.ctx.createBuffer( 1, bufferSize, this.ctx.sampleRate ),
			data = buffer.getChannelData( 0 );
		for( var i = 0; i < bufferSize; i++ ) {
			data[ i ] = ( Math.random() * 2 - 1 ) * ( 1 - i / bufferSize );
		}
		var src = this.ctx.createBufferSource(),
			gain = this.ctx.createGain();
		src.buffer = buffer;
		gain.gain.value = 0.12;
		src.connect( gain );
		gain.connect( this.master );
		src.start( time );
	},

	schedule: function() {
		if( !this.started || !this.ctx ) {
			return;
		}
		// the browser suspends the AudioContext on tab blur, pause, phone
		// lock, etc - resume it so the music never dies mid-game
		if( this.ctx.state === 'suspended' ) {
			this.ctx.resume();
			return;
		}
		// if our clock fell behind real time (a suspension gap, or
		// background-tab interval throttling) re-sync instead of scheduling
		// a silent burst of notes in the past
		if( this.nextTime < this.ctx.currentTime ) {
			this.nextTime = this.ctx.currentTime + 0.1;
		}
		while( this.nextTime < this.ctx.currentTime + 0.2 ) {
			if( $.soundLevel > 0 && $.storage['music'] !== 0 ) {
				var s = this.step % 16;
				// bass drives every step
				this.note( this.nextTime, this.bass[ s ] - 12, this.stepLength * 0.9, this.wave, this.wave === 'square' ? 0.22 : 0.2 );
				if( s % 4 === 0 || ( this.boss && s === 14 ) ) {
					this.kick( this.nextTime );
				}
				if( s % 4 === 2 || ( this.boss && s % 2 === 1 ) ) {
					this.hat( this.nextTime );
				}
				// melody: the loading intro and menu get a continuous bright
				// arpeggio (a proper "title theme"); combat keeps its sparser
				// every-other-bar build so the lead lands when the action does
				var introState = ( $.state === 'loading' || $.state === 'menu' );
				if( introState && this.lead[ s ] ) {
					this.note( this.nextTime, this.lead[ s ], this.stepLength * 2.2, 'triangle', 0.13 );
					// a soft octave-down sawtooth pad fills out the boot screen
					if( s % 4 === 0 ) {
						this.note( this.nextTime, this.lead[ s ] - 12, this.stepLength * 4, 'sawtooth', 0.05 );
					}
				} else if( $.state === 'play' && ( this.bar % 2 === 1 || this.boss ) && this.lead[ s ] ) {
					this.note( this.nextTime, this.lead[ s ], this.stepLength * 1.8, 'triangle', 0.1 );
				}
			}
			this.step++;
			if( this.step % 16 === 0 ) {
				this.bar++;
				if( this.pendingTheme >= 0 ) { this.applyTheme(); }
			}
			this.nextTime += this.stepLength;
		}
	}
};
