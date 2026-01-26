class PCMProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0) {
      const inputData = input[0];
      // Send the raw Float32 data to the main thread for PCM conversion and socket sending
      this.port.postMessage(inputData);
    }
    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
