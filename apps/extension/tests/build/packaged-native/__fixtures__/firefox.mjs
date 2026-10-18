import { expect } from '@playwright/test';
import { setTimeout as delay } from 'node:timers/promises';
import { launchNativeFirefox } from './gecko-driver.mjs';

const SHADOW_CLICK_READINESS_SCRIPT = `
const [selectors, budget] = arguments;
const find = () => {
  let root = document;
  let element;
  for (const selector of selectors) {
    element = root?.querySelector(selector);
    if (!element) return null;
    root = element.shadowRoot;
  }
  return element;
};
const describe = element => element ? {tag: element.localName, classes: Array.from(element.classList)} : null;
const observe = element => {
  const rects = Array.from(element?.getClientRects() ?? []);
  const rect = rects.find(value => value.width > 0 && value.height > 0) ?? rects[0];
  const viewport = [innerWidth, innerHeight];
  const connected = element?.isConnected === true;
  const disabled = element?.matches(':disabled') || element?.getAttribute('aria-disabled') === 'true';
  let visible = Boolean(element);
  for (let ancestor = element; ancestor; ancestor = ancestor.parentElement ?? ancestor.getRootNode().host) {
    const style = getComputedStyle(ancestor);
    if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0) visible = false;
  }
  const left = Math.max(0, Math.min(rect?.x ?? 0, (rect?.x ?? 0) + (rect?.width ?? 0)));
  const right = Math.min(innerWidth, Math.max(rect?.x ?? 0, (rect?.x ?? 0) + (rect?.width ?? 0)));
  const top = Math.max(0, Math.min(rect?.y ?? 0, (rect?.y ?? 0) + (rect?.height ?? 0)));
  const bottom = Math.min(innerHeight, Math.max(rect?.y ?? 0, (rect?.y ?? 0) + (rect?.height ?? 0)));
  const intersects = right > left && bottom > top;
  const point = {x: Math.floor((left + right) / 2), y: Math.floor((top + bottom) / 2)};
  const root = element?.getRootNode();
  const paint = intersects && root?.elementsFromPoint ? root.elementsFromPoint(point.x, point.y) : [];
  const reason = !element ? 'Missing control.' : !connected ? 'Detached control.' : disabled ? 'Disabled control.'
    : !visible ? 'Hidden control.' : document.fonts.status === 'loading' ? 'Fonts are loading.'
    : !rect || !intersects ? 'Control has no viewport intersection.'
    : !paint.includes(element) ? 'Control is absent from its shadow paint tree.'
    : !element.contains(paint[0]) ? 'Control center is covered.' : null;
  return {ready: reason === null, reason, rect: rect?.toJSON() ?? null, viewport, inView: paint.includes(element),
    point, connected, disabled, visible, paint: paint.slice(0,4).map(describe)};
};
let last = observe(find());
return new Promise((resolve, reject) => {
  let finished = false;
  const timer = setTimeout(() => {
    finished = true;
    reject(new Error('Native shadow control did not become actionable: ' + JSON.stringify(last)));
  }, budget);
  const frame = () => new Promise(done => requestAnimationFrame(done));
  const scrolled = new WeakSet();
  const attempt = async () => {
    if (finished) return;
    const element = find();
    let before = observe(element);
    if (element && before.connected && before.rect?.width > 0 && before.rect?.height > 0 &&
        !before.inView && !scrolled.has(element)) {
      scrolled.add(element);
      element.scrollIntoView({behavior: 'instant', block: 'end', inline: 'nearest'});
      before = observe(element);
    }
    await frame(); await frame();
    if (finished) return;
    last = observe(element);
    if (JSON.stringify(before.rect) !== JSON.stringify(last.rect)) {
      last.ready = false;
      last.reason = 'Control geometry is still moving.';
    }
    if (last.ready) {
      finished = true;
      clearTimeout(timer);
      resolve(element);
    } else requestAnimationFrame(() => { void attempt().catch(fail); });
  };
  const fail = error => { finished = true; clearTimeout(timer); reject(error); };
  void attempt().catch(fail);
});`;

/**
 * Retries native pointer input only when Firefox reports an obscured click target.
 * @param {() => Promise<unknown>} click - Genuine Marionette input operation.
 * @return {Promise<unknown>} Native input result, preserving every unrelated failure.
 */
async function clickWhenUnobscured( click ) {
	const deadline = Date.now() + 15_000;
	for ( ;; ) {
		try {
			return await click();
		} catch ( error ) {
			if ( ! /\bElementClickInterceptedError:/u.test( error.message ) || Date.now() >= deadline ) {
				throw error;
			}
			await delay( 100 );
		}
	}
}

/**
 * Adapts the installed Firefox driver to the shared installed-browser journeys.
 * @param {string} directory - Disposable installation directory.
 * @param {object} [options] - Isolated browser configuration for this journey.
 * @param {number} [options.shadowClickReadinessTimeoutMilliseconds] - Observation budget for isolated pointer probes.
 * @return {Promise<object>} Browser controls using native input and permission prompts.
 * @since 1.0.1
 */
export async function launchFirefox( directory, options = {} ) {
	const driver = await launchNativeFirefox( directory, options );
	const permissionDecisions = [];
	return {
		downloadDirectory: driver.downloadDirectory,
		/**
		 * Selects a real local file through Marionette file input support.
		 * @param {string} view - Extension view containing the file input.
		 * @param {string} selector - Native file input selector.
		 * @param {string} path - Absolute local file path.
		 * @return {Promise<unknown>} File selection completion.
		 */
		viewUpload: ( view, selector, path ) => driver.viewType( view, selector, path ),
		...driver,
		permissionDecisions,
		/**
		 * Resolves a document in this installed extension's actual origin.
		 * @param {string} path - Extension document path.
		 * @return {string} Installed extension URL.
		 */
		extensionUrl: ( path ) => `moz-extension://${ driver.uuid }/${ path }`,
		/**
		 * Selects a new tab and waits for its real document or browser redirect.
		 * @param {string} url - Destination URL.
		 * @return {Promise<void>} Completion after the selected document loads.
		 */
		openPage: async ( url ) => {
			await driver.execute( `const tab = gBrowser.addTab(arguments[0], {
				triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal()
			}); gBrowser.selectedTab = tab;`, [ url ] );
			await expect.poll( () => driver.execute( `return !gBrowser.selectedBrowser.webProgress.isLoadingDocument &&
				(gBrowser.selectedBrowser.currentURI.spec !== 'about:blank' || arguments[0] === 'about:blank');`, [ url ] ) ).toBe( true );
		},
		/**
		 * Starts same-tab navigation without waiting for deliberately delayed responses.
		 * @param {string} url - Destination URL.
		 * @return {Promise<unknown>} Completion of the native navigation command.
		 */
		navigate: ( url ) => driver.execute( `gBrowser.selectedBrowser.loadURI(Services.io.newURI(arguments[0]), {
			triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal()
		});`, [ url ] ),
		/**
		 * Reads the selected tab's browser-reported document URL.
		 * @return {Promise<string>} Current document URL.
		 */
		currentUrl: () => driver.execute( 'return gBrowser.selectedBrowser.currentURI.spec;' ),
		/**
		 * Reloads the selected real tab through Firefox navigation controls.
		 * @return {Promise<unknown>} Completion of the reload command.
		 */
		reload: () => driver.execute( 'gBrowser.selectedBrowser.reload();' ),
		/**
		 * Closes only the currently selected tab in the disposable browser.
		 * @return {Promise<unknown>} Completion of native tab closure.
		 */
		closePage: () => driver.execute( 'gBrowser.removeTab(gBrowser.selectedTab);' ),
		/**
		 * Clicks the installed extension's real toolbar action through WebDriver.
		 * @return {Promise<void>} Completion of native toolbar input.
		 */
		openPopup: async () => {
			const element = await driver.command( '/element', { using: 'css selector', value: '#tocus_agustinbarrientos_com-BAP' } );
			await driver.command( `/element/${ element[ 'element-6066-11e4-a52e-4f735466cecf' ] }/click`, {} );
		},
		/**
		 * Dismisses Firefox's native extension popup panel.
		 * @return {Promise<unknown>} Completion of panel dismissal.
		 */
		closePopup: () => driver.execute( `const panel = document.querySelector('#customizationui-widget-panel');
			if (panel?.state === 'open') panel.hidePopup();` ),
		/**
		 * Reports whether Firefox still displays this extension's native action panel.
		 * @return {Promise<boolean>} Whether the actual popup panel is open.
		 */
		isPopupOpen: () => driver.execute( `return document.querySelector('#customizationui-widget-panel')?.state === 'open' &&
			Boolean(document.querySelector('browser[webextension-view-type="popup"]'));` ),
		/**
		 * Chooses an enabled native permission decision and records its visible labels.
		 * @param {boolean} allow - True selects Allow; false selects Deny.
		 * @return {Promise<object>} Native permission control evidence.
		 */
		consent: async ( allow ) => {
			await expect.poll( () => driver.execute( `const panel = document.querySelector('#notification-popup');
				const notification = document.querySelector('#addon-webext-permissions-notification');
				return panel.state === 'open' && notification?.getAttribute('name')?.startsWith('TOCus') && !notification.button.disabled;` ) ).toBe( true );
			const evidence = await driver.execute( `const notification = document.querySelector('#addon-webext-permissions-notification');
				const selected = notification.${ allow ? 'button' : 'secondaryButton' };
				const evidence = {name: notification.getAttribute('name'), decision: selected.label,
					buttons: [notification.button.label, notification.secondaryButton.label]};
				selected.click(); return evidence;` );
			permissionDecisions.push( evidence );
			return evidence;
		},
		/**
		 * Resolves shadow descendants and clicks the actual element through Marionette.
		 * @param {string} view - Selected document, popup, or onboarding view.
		 * @param {string} selector - CSS selector with optional shadow separators.
		 * @return {Promise<unknown>} Completion of native pointer input.
		 */
		viewClick: async ( view, selector ) => {
			if ( ! selector.includes( '>>>' ) ) {
				return clickWhenUnobscured( () => driver.viewClick( view, selector ) );
			}
			const result = await driver.command( '/execute/async', {
				script: `const [view, selectors, readiness, budget, done] = arguments;
				try {
					const target = view === 'popup' ? document.querySelector('browser[webextension-view-type="popup"]')
						: view === 'selected' ? gBrowser.selectedBrowser
						: Array.from(gBrowser.tabs).find(tab => tab.linkedBrowser.currentURI.spec.endsWith('/onboarding.html'))?.linkedBrowser;
					if (!target) throw new Error('Firefox view is unavailable: ' + view);
					const actor = target.browsingContext.currentWindowGlobal.getActor('MarionetteCommands');
					actor.executeScript(readiness, [selectors, budget], {}).then(element =>
						actor.clickElement(element, {toJSON: () => ({'moz:webdriverClick': true})}))
						.then(value => done({ok: true, value}), error => done({ok: false, message: String(error)}));
				} catch (error) { done({ok: false, message: String(error)}); }`,
				args: [ view, selector.split( /\s*>>>\s*/u ), SHADOW_CLICK_READINESS_SCRIPT,
					options.shadowClickReadinessTimeoutMilliseconds ?? 12_000 ],
			} );
			if ( ! result?.ok ) {
				throw new Error( `Firefox shadow click failed: ${ result?.message ?? 'No actor result.' }` );
			}
			return result.value;
		},
		/**
		 * Selects a real HTML option through Marionette's native option click behavior.
		 * @param {string} view - Selected document, popup, or onboarding view.
		 * @param {string} selector - Native select control's CSS selector.
		 * @param {string} value - Exact option value to choose.
		 * @return {Promise<unknown>} Completion of the native option interaction.
		 */
		viewSelect: ( view, selector, value ) =>
			driver.viewClick( view, `${ selector } option[value=${ JSON.stringify( value ) }]` ),
		/**
		 * Sends genuine WebDriver keyboard input to the requested control.
		 * @param {string} view - Selected document, popup, or onboarding view.
		 * @param {string} selector - Target control's CSS selector.
		 * @param {string} key - Supported key name or select-all shortcut.
		 * @return {Promise<unknown>} Completion of native keyboard input.
		 */
		viewKey: ( view, selector, key ) => {
			const keys = { Home: '\uE011', End: '\uE010', ArrowRight: '\uE014', ArrowLeft: '\uE012',
				ArrowDown: '\uE015', ArrowUp: '\uE013', Backspace: '\uE003', Enter: '\uE007',
				Escape: '\uE00C', Tab: '\uE004', Space: ' ',
				'ControlOrMeta+A': `${ process.platform === 'darwin' ? '\uE03D' : '\uE009' }a\uE000` };
			if ( ! keys[ key ] ) {
				throw new Error( `Unsupported native key: ${ key }` );
			}
			return driver.viewType( view, selector, keys[ key ] );
		},
		/**
		 * Presses a native key in the current selected view without refocusing its document body.
		 * @param {string} view - Selected content view containing the current focus owner.
		 * @param {string} key - Tab, Enter, or Space.
		 * @return {Promise<void>} Completion of native keyboard actions.
		 * @since 1.1.0
		 */
		viewPressKey: ( view, key ) => {
			const keys = { Tab: '\uE004', Enter: '\uE007', Space: ' ' };
			if ( ! keys[ key ] ) {
				throw new Error( `Unsupported focus-preserving native key: ${ key }` );
			}
			return driver.viewPressKey( view, keys[ key ] );
		},
		/**
		 * Reads the actual focused element across closed shadow boundaries without changing focus.
		 * @param {string} view - Selected content view or installed extension view.
		 * @return {Promise<object|null>} Native element identity, label and enabled state.
		 * @since 1.1.0
		 */
		viewFocusedElement: ( view ) => driver.viewSystemScript( view, `let element = document.activeElement;
			while (element?.openOrClosedShadowRoot?.activeElement) {
				element = element.openOrClosedShadowRoot.activeElement;
			}
			return element ? {tag: element.localName, classes: Array.from(element.classList),
				label: element.textContent?.trim(), disabled: element.disabled === true} : null;` ),
		/**
		 * Reads error diagnostics for this extension from the disposable Firefox console.
		 * @return {Promise<object>} Production errors, unloaded extension contexts, and native consent evidence.
		 */
		diagnostics: async () => {
			const origin = `moz-extension://${ driver.uuid }/`;
			const entries = await driver.execute( `return Services.console.getMessageArray().flatMap(message => {
				try {
					const error = message.QueryInterface(Ci.nsIScriptError);
					return error.sourceName.startsWith(arguments[0]) && !(error.flags & Ci.nsIScriptError.warningFlag)
						? [{url: error.sourceName, message: error.errorMessage}] : [];
				} catch { return []; }
			});`, [ origin ] );
			const errors = [];
			const unloadedContexts = [];
			const inactiveContexts = [];
			for ( const entry of entries ) {
				const source = entry.url.slice( origin.length );
				// ExtensionCommon.wrapPromise reports these browser lifecycle states after view replacement.
				// Continue and navigation replace content documents; native prompts can dismiss popup views.
				// Every file under chunks/ is page code, including modules several pages share, like the statistics client.
				if ( ( entry.message === "Promise rejected after context unloaded: Actor 'Conduits' destroyed before query 'RuntimeMessage' was resolved\n"
					|| entry.message === 'Promise resolved after context unloaded\n' )
					&& ( /^chunks\/[^/]+\.js$/u.test( source ) || source === 'protected-page.js' ) ) {
					unloadedContexts.push( entry );
				} else if ( source === 'protected-page.js' && entry.message === 'Promise resolved while context is inactive\n' ) {
					inactiveContexts.push( entry );
				} else {
					errors.push( entry );
				}
			}
			return { errors, unloadedContexts, inactiveContexts, permissionDecisions };
		},
	};
}
