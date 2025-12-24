/**
 * 音频录制 Worklet 处理器
 * 
 * 使用 AudioWorklet 替代 ScriptProcessorNode 实现更低延迟的音频采集。
 * AudioWorklet 运行在独立的音频渲染线程，不会阻塞主线程。
 * 
 * 延迟对比：
 * - ScriptProcessorNode: ~100-200ms 延迟
 * - AudioWorklet: ~10-20ms 延迟
 */

class AudioRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // 1600 samples at 16kHz = 100ms 的音频块
    // 更小的缓冲区 = 更快的 VAD 响应
    this.bufferSize = 1600;
    this.buffer = new Float32Array(0);
    this.targetSampleRate = 16000; // 目标采样率
    this.inputSampleRate = 48000;  // 默认输入采样率，会在 process 中检测
    this.frameCount = 0;  // 用于调试
  }

  /**
   * 重采样音频数据
   * 从 48kHz 降采样到 16kHz
   */
  resample(input, inputRate, outputRate) {
    if (inputRate === outputRate) {
      return input;
    }
    
    const ratio = inputRate / outputRate;
    const outputLength = Math.floor(input.length / ratio);
    const output = new Float32Array(outputLength);
    
    for (let i = 0; i < outputLength; i++) {
      // 简单线性插值
      const srcIndex = i * ratio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, input.length - 1);
      const t = srcIndex - srcIndexFloor;
      
      output[i] = input[srcIndexFloor] * (1 - t) + input[srcIndexCeil] * t;
    }
    
    return output;
  }

  /**
   * 将 Float32 音频转换为 PCM16 格式
   */
  floatTo16BitPCM(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      // 限制范围并转换
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16Array;
  }

  /**
   * 处理音频帧
   * 每次调用处理 128 个采样点
   */
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || input.length === 0) {
      return true;
    }

    const channelData = input[0];
    if (!channelData || channelData.length === 0) {
      return true;
    }

    // 检测实际采样率（通过 sampleRate 全局变量）
    this.inputSampleRate = sampleRate || 48000;

    // 重采样到 16kHz
    const resampled = this.resample(channelData, this.inputSampleRate, this.targetSampleRate);

    // 将数据添加到缓冲区
    const newBuffer = new Float32Array(this.buffer.length + resampled.length);
    newBuffer.set(this.buffer);
    newBuffer.set(resampled, this.buffer.length);
    this.buffer = newBuffer;

    // 当缓冲区达到目标大小时发送数据
    // 1600 samples at 16kHz = 100ms 的音频
    while (this.buffer.length >= this.bufferSize) {
      this.frameCount++;
      const chunk = this.buffer.slice(0, this.bufferSize);
      this.buffer = this.buffer.slice(this.bufferSize);

      // 转换为 PCM16
      const pcm16 = this.floatTo16BitPCM(chunk);

      // 发送到主线程
      this.port.postMessage({
        type: 'audio',
        data: pcm16.buffer
      }, [pcm16.buffer]);
    }

    return true;
  }
}

registerProcessor('audio-recorder-processor', AudioRecorderProcessor);
