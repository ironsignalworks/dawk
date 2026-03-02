import test from 'node:test';
import assert from 'node:assert/strict';
import { clamp, createDistortionCurve, encodeWav } from '../src/audioUtils';

test('clamp bounds values', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-2, 0, 10), 0);
  assert.equal(clamp(20, 0, 10), 10);
});

test('createDistortionCurve returns normalized curve data', () => {
  const curve = createDistortionCurve(80);
  assert.equal(curve.length, 44100);
  const max = Math.max(...curve);
  const min = Math.min(...curve);
  assert.ok(max <= 1.01);
  assert.ok(min >= -1.01);
});

test('encodeWav outputs a RIFF/WAVE blob', async () => {
  const left = new Float32Array([0, 0.5, -0.5, 1, -1]);
  const right = new Float32Array([0, 0.25, -0.25, 0.75, -0.75]);
  const fakeBuffer = {
    numberOfChannels: 2,
    sampleRate: 44100,
    length: left.length,
    getChannelData(index: number) {
      return index === 0 ? left : right;
    }
  } as AudioBuffer;

  const blob = encodeWav(fakeBuffer);
  assert.equal(blob.type, 'audio/wav');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const wave = String.fromCharCode(...bytes.slice(8, 12));
  assert.equal(riff, 'RIFF');
  assert.equal(wave, 'WAVE');
  assert.equal(bytes.length, 44 + left.length * 2 * 2);
});
