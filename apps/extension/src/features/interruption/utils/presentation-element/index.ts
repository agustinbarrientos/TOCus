import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { ReactNode } from 'react';
import { createShadowStyleSheet } from '@tocus/ui';
import type { PresentationChanges } from './types';

/**
 * Retains the controller-facing custom-element boundary while React owns its contents.
 * Only input batching, mount ownership and stylesheet adoption live here; no UI behavior does.
 * @since 0.1.0
 */
export abstract class PresentationElement extends HTMLElement {
	readonly renderRoot: ShadowRoot;

	private reactRoot: Root | null = null;

	private changes = new Map<string, unknown>();

	private scheduled = false;

	private completion: Promise<void> = Promise.resolve();

	/**
	 * Creates an isolated React mount with CSP-compatible, extension-owned styles.
	 * @param css - Compiled local styles, with no remote resources.
	 * @param mode - Closed for the protected-page boundary, open for component composition.
	 */
	constructor( css: string, mode: ShadowRootMode = 'open' ) {
		super();
		this.renderRoot = this.attachShadow( { mode } );
		const sheet = createShadowStyleSheet( css );
		this.renderRoot.adoptedStyleSheets = [ sheet ];
	}

	/**
	 * Resolves after the currently queued controller projection is committed.
	 * @return Completion of the currently queued React commit.
	 */
	get updateComplete(): Promise<void> {
		return this.completion;
	}

	/** Connects a new or previously detached React presentation. */
	connectedCallback(): void {
		this.requestUpdate();
	}

	/** Releases React effects unless an owned host is reattached in the same task. */
	disconnectedCallback(): void {
		// A native layer may repair removal in the next microtask; preserve its controlled screen identity.
		queueMicrotask( () => {
			queueMicrotask( () => {
				if ( ! this.isConnected ) {
					this.reactRoot?.unmount();
					this.reactRoot = null;
				}
			} );
		} );
	}

	/**
	 * Batches controller property writes into one synchronous React commit.
	 * @param name - Changed input, absent for a clock-driven visual update.
	 * @param previous - Value before this batch's first write.
	 */
	protected requestUpdate( name?: string, previous?: unknown ): void {
		if ( name !== undefined && ! this.changes.has( name ) ) {
			this.changes.set( name, previous );
		}
		if ( this.scheduled ) {
			return;
		}
		this.scheduled = true;
		this.completion = Promise.resolve().then( () => {
			this.scheduled = false;
			if ( ! this.isConnected ) {
				return;
			}
			const changed = this.changes;
			this.changes = new Map();
			const content = this.renderPresentation( changed );
			this.reactRoot ??= createRoot( this.renderRoot );
			flushSync( () => {
				this.reactRoot?.render( content );
			} );
			this.afterRender( changed );
		} );
	}

	/**
	 * Projects the current controller inputs to React.
	 * @param changed - Inputs changed in this commit.
	 * @return React-owned presentation.
	 */
	protected abstract renderPresentation( changed: PresentationChanges ): ReactNode;

	/**
	 * Applies native focus or canvas work after React has committed.
	 * @param changed - Inputs changed in this commit.
	 */
	protected abstract afterRender( changed: PresentationChanges ): void;
}
