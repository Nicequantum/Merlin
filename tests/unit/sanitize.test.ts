import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { sanitizeIdentifier, sanitizeText, sanitizeVin } from '../../src/lib/sanitize';

describe('sanitize', () => {
  test('removes HTML tags and script handlers', () => {
    const input = '<script>alert("xss")</script>Hello <b>world</b>';
    const output = sanitizeText(input);
    assert.equal(output, 'alert("xss")Hello world');
    assert.ok(!output.includes('<script>'));
  });

  test('removes javascript: protocol', () => {
    const output = sanitizeText('javascript:alert(1) Engine light');
    assert.ok(!output.toLowerCase().includes('javascript:'));
    assert.match(output, /Engine light/);
  });

  test('sanitizes VIN to allowed characters', () => {
    assert.equal(sanitizeVin(' wddwf4kb0fr123456 '), 'WDDWF4KB0FR123456');
  });

  test('sanitizes identifiers', () => {
    assert.equal(sanitizeIdentifier('RO-<script>123'), 'RO-123');
    assert.ok(!sanitizeIdentifier('RO-<script>123').includes('<'));
  });
});