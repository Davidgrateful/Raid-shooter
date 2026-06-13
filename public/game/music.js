/*==============================================================================
Music - procedural synth loop (WebAudio, no audio files)

A dark space-arcade groove: pulsing bass, kick on the quarters, hat
offbeats, and a sparse lead arpeggio that only plays during combat.
Starts on the first PLAY (a user gesture, so autoplay rules allow it)
and respects the M mute toggle.
==============================================================================*/
$.music = {
	ctx: null,
	started: 0,
	step: 0,
	nextTime: 0,
	stepLength: 60 / 112 / 4, // 112 bpm, 16th notes
	bass: [ 45, 45, 45, 48, 45, 45, 43, 45, 41, 41, 41, 45, 43, 43, 48, 43 ],
	lead: [ 69, 0, 72, 0, 76, 0, 72, 0, 81, 0, 76, 0, 72, 0, 76, 0 ],
	bar: 0,

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
				this.master.gain.value = 0.16;
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
		while( this.nextTime < this.ctx.currentTime + 0.2 ) {
			if( !$.mute && $.storage['music'] !== 0 ) {
				var s = this.step % 16;
				// bass drives every step
				this.note( this.nextTime, this.bass[ s ] - 12, this.stepLength * 0.9, 'square', 0.22 );
				if( s % 4 === 0 ) {
					this.kick( this.nextTime );
				}
				if( s % 4 === 2 ) {
					this.hat( this.nextTime );
				}
				// lead only during combat, every other bar
				if( $.state === 'play' && this.bar % 2 === 1 && this.lead[ s ] ) {
					this.note( this.nextTime, this.lead[ s ], this.stepLength * 1.8, 'triangle', 0.1 );
				}
			}
			this.step++;
			if( this.step % 16 === 0 ) {
				this.bar++;
			}
			this.nextTime += this.stepLength;
		}
	}
};
