import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { expo } = require('../app.config.js');

const pluginOptions = (name) => {
  const entry = expo.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === name);
  return entry?.[1];
};

test('enables optimized Android release builds', () => {
  const buildProperties = pluginOptions('expo-build-properties');
  assert.equal(buildProperties?.android?.enableMinifyInReleaseBuilds, true);
  assert.equal(buildProperties?.android?.enableShrinkResourcesInReleaseBuilds, true);
});

test('keeps Android and iOS adaptive for large screens', () => {
  assert.equal(Object.hasOwn(expo, 'orientation'), false);
  assert.equal(expo.ios.supportsTablet, true);
  assert.equal(expo.ios.requireFullScreen, false);
  assert.equal(Object.hasOwn(expo, 'androidStatusBar'), false);
  assert.equal(Object.hasOwn(expo, 'androidNavigationBar'), false);
});

test('uses a centered opaque native splash and synchronized store version', async () => {
  const splash = pluginOptions('expo-splash-screen');
  assert.equal(splash?.backgroundColor, '#09090b');
  assert.equal(splash?.resizeMode, 'contain');
  assert.ok(splash?.imageWidth >= 200);
  assert.match(splash?.image || '', /icon\.png$/);

  const eas = JSON.parse(await readFile(new URL('../eas.json', import.meta.url), 'utf8'));
  assert.equal(expo.version, '1.0.3');
  assert.equal(eas.build.production.env.APP_VERSION, expo.version);
  assert.equal(eas.build['production-ios'].env.APP_VERSION, expo.version);
});

test('keeps the native splash visible until the opaque brand surface is laid out', async () => {
  const appSource = await readFile(new URL('../App.js', import.meta.url), 'utf8');
  const brandSplashSource = await readFile(new URL('../src/components/BrandSplash.js', import.meta.url), 'utf8');
  const themeSource = await readFile(new URL('../src/theme.js', import.meta.url), 'utf8');
  const preventIndex = appSource.indexOf('SplashScreen.preventAutoHideAsync().catch(() => {})');
  const appComponentIndex = appSource.indexOf('export default function App()');
  const background = themeSource.match(/background:\s*['"](#[0-9a-fA-F]{6})['"]/)?.[1];

  assert.ok(preventIndex >= 0 && preventIndex < appComponentIndex);
  assert.match(appSource, /const revealBrandSplash = useCallback\(\(\) => \{\s*void SplashScreen\.hideAsync\(\)\.catch\(\(\) => \{\}\);\s*\}, \[\]\);/);
  assert.match(appSource, /<BrandSplash onReady=\{revealBrandSplash\} onFinished=\{finishBrandSplash\} \/>/);
  assert.match(brandSplashSource, /<View[\s\S]*onLayout=\{onReady\}[\s\S]*style=\{styles\.container\}/);
  assert.match(brandSplashSource, /container:\s*\{[\s\S]*StyleSheet\.absoluteFillObject[\s\S]*backgroundColor:\s*COLORS\.background/);
  assert.match(background || '', /^#[0-9a-fA-F]{6}$/);
});
