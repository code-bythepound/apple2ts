class Oscillator extends AudioWorkletProcessor {
  tick = new Array(16384 * 4).fill(0);
  index = 0;
  newIndex = 1024;
  prevCycle = 0;
  sampling = 44100/1.020484e6;
  value = 0.2
  constructor() {
    super();
    this.port.onmessage = (event) => {
      let delta = Math.round((event.data - this.prevCycle) * this.sampling * 4) / 4
      // If we got a large audio delta, assume this is the start of a new sound
      // and shift our starting index to just a few cycles downstream of the
      // current (44100Hz) index. That way the sound starts immediately instead
      // of looping around thru the entire tick array.
      if (delta > 1024) {
        this.newIndex = (this.index + (1024)) % this.tick.length
      } else {
        this.newIndex = (this.newIndex + delta) % this.tick.length
      }
      const c1 = 1.6567691
      const c2 = 0.94660320
      let i2 = Math.round(this.newIndex)
      let tm2 = 0.5 * this.value
      this.tick[i2] = tm2 //+ this.tick[i2]
      let i1 = (i2 + 1) % this.tick.length
      let tm1 = c1 * tm2
      this.tick[i1] = tm1 //+ this.tick[i1]
      for (let i=2; i < 200; i++) {
        let tm0 = c1 * tm1 - c2 * tm2
        let i0 = (i1 + 1) % this.tick.length
        this.tick[i0] = tm0 + this.tick[i0]
        tm2 = tm1
        tm1 = tm0
        i2 = i1
        i1 = i0
      }
      this.value = -this.value
      this.prevCycle = event.data
    }
  }

  // Thru measurement, the time between calls is 2.902 ms = 128/44100
  process(inputs, outputs, parameters) {
    const channel = outputs[0][0];
    for (let i = 0; i < channel.length; i++) {
      channel[i] = this.tick[this.index]
      this.tick[this.index] = 0
      this.index = (this.index + 1) % this.tick.length;
    }
    return true;
  }
}

registerProcessor('oscillator', Oscillator);
