import assert from 'node:assert/strict';
import { test } from 'node:test';

import { amountWords, netReading, peak, speedWords } from './live-net.ts';

test('live network: the traffic is named and explained', () => {
  assert.equal(netReading(15, 24, '192.168.1.20').title, 'Connected and quiet');
  assert.equal(netReading(300, 80, '192.168.1.20').title, 'Light traffic');
  assert.match(netReading(4000, 100, '192.168.1.20').meaning, /bringing a lot in/);
  assert.match(netReading(100, 4000, '192.168.1.20').meaning, /sending a lot/);
  assert.equal(netReading(30000, 10, '192.168.1.20').level, 'heavy');
  assert.equal(netReading(500, 500, '').level, 'offline', 'no address: not on a network, whatever the counters say');
});

test('live network: speeds and amounts read the way people say them', () => {
  assert.equal(speedWords(15.4), '15 KB/s');
  assert.equal(speedWords(2048), '2.0 MB/s');
  assert.equal(speedWords(Number.NaN), '0 KB/s');
  assert.equal(amountWords(12.44), '12.4 GB');
  assert.equal(amountWords(0.83), '850 MB');
  assert.equal(amountWords(0), '0 MB');
  assert.equal(peak([3, 40, 12]), 40);
  assert.equal(peak([]), 0);
});
