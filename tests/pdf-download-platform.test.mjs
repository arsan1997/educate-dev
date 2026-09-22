import test from 'node:test';
import assert from 'node:assert/strict';

import {scoreTableDownloadMode} from '../src/pdfDownloadPlatform.js';

test('uses preview-first saving on iPhone and iPad',()=>{
  assert.equal(scoreTableDownloadMode({userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',platform:'iPhone',maxTouchPoints:5}),'preview');
  assert.equal(scoreTableDownloadMode({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',platform:'MacIntel',maxTouchPoints:5}),'preview');
});

test('keeps direct downloads on Android and desktop browsers',()=>{
  assert.equal(scoreTableDownloadMode({userAgent:'Mozilla/5.0 (Linux; Android 15)',platform:'Linux armv8l',maxTouchPoints:5}),'download');
  assert.equal(scoreTableDownloadMode({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',platform:'MacIntel',maxTouchPoints:0}),'download');
  assert.equal(scoreTableDownloadMode({userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',platform:'Win32',maxTouchPoints:0}),'download');
});
