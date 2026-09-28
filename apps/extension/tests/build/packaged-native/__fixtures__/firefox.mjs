import { expect } from '@playwright/test';
import { launchNativeFirefox } from '../../packaged-firefox/__fixtures__/native-firefox.mjs';

/**
 * Adapts the installed Firefox driver to the shared installed-browser journeys.
 * @param {string} directory - Disposable installation directory.
 * @return {Promise<object>} Browser controls using native input and permission prompts.
 * @since 1.0.1
 */
export async function launchFirefox( directory ) {
	const driver = await launchNativeFirefox( directory );
	const permissionDecisions = [];
	return {
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
				return driver.viewClick( view, selector );
			}
			const result = await driver.command( '/execute/async', {
				script: `const [view, selectors, done] = arguments;
				try {
					const target = view === 'popup' ? document.querySelector('browser[webextension-view-type="popup"]')
						: view === 'selected' ? gBrowser.selectedBrowser
						: Array.from(gBrowser.tabs).find(tab => tab.linkedBrowser.currentURI.spec.endsWith('/onboarding.html'))?.linkedBrowser;
					if (!target) throw new Error('Firefox view is unavailable: ' + view);
					const actor = target.browsingContext.currentWindowGlobal.getActor('MarionetteCommands');
					const find = 'let root = document; let element; for (const selector of arguments[0]) {' +
						'element = root?.querySelector(selector); if (!element) throw new Error("Missing shadow element: " + selector);' +
						'root = element.shadowRoot; } return element;';
					actor.executeScript(find, [selectors], {}).then(element =>
						actor.clickElement(element, {toJSON: () => ({'moz:webdriverClick': true})}))
						.then(value => done({ok: true, value}), error => done({ok: false, message: String(error)}));
				} catch (error) { done({ok: false, message: String(error)}); }`,
				args: [ view, selector.split( /\s*>>>\s*/u ) ],
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
		 * Reads error diagnostics for this extension from the disposable Firefox console.
		 * @return {Promise<object>} Production script errors and native consent evidence.
		 */
		diagnostics: async () => ( {
			errors: await driver.execute( `return Services.console.getMessageArray().flatMap(message => {
				try {
					const error = message.QueryInterface(Ci.nsIScriptError);
					return error.sourceName.startsWith(arguments[0]) && !(error.flags & Ci.nsIScriptError.warningFlag)
						? [{url: error.sourceName, message: error.errorMessage}] : [];
				} catch { return []; }
			});`, [ `moz-extension://${ driver.uuid }/` ] ),
			permissionDecisions,
		} ),
	};
}
