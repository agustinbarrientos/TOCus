import { describe, expect, it, vi } from 'vitest';
import { createPresentationPort } from './index';

describe( 'mutable controller presentation port', () => {
	it( 'observes only explicitly owned fields, not an inherited prototype', async () => {
		const initial = { pending: false };
		Object.setPrototypeOf( initial, { inherited: true } );
		const project = vi.fn();
		const port = createPresentationPort( initial, project );
		await Promise.resolve();
		expect( Object.hasOwn( port, 'inherited' ) ).toBe( false );
		expect( project ).toHaveBeenCalledWith( { pending: false } );
		expect( Object.isFrozen( project.mock.calls[ 0 ]?.[ 0 ] ) ).toBe( true );
	} );

	it( 'projects a coherent snapshot after related controller assignments', async () => {
		const snapshots: Readonly<{ title: string; pending: boolean }>[] = [];
		const port = createPresentationPort( { title: '', pending: true }, ( value ) => snapshots.push( value ) );
		port.title = 'Ready';
		port.pending = false;
		expect( port.title ).toBe( 'Ready' );
		await Promise.resolve();
		expect( snapshots ).toEqual( [ { title: 'Ready', pending: false } ] );
		port.title = 'Saved';
		await Promise.resolve();
		expect( snapshots[ 0 ]?.title ).toBe( 'Ready' );
		expect( snapshots[ 1 ]?.title ).toBe( 'Saved' );
	} );

	it( 'delivers a user gesture synchronously and supports controller cleanup', async () => {
		const port = createPresentationPort( { pending: false }, vi.fn() );
		let requests = 0;

		/** Models the controller's synchronous guard against duplicate permission requests. */
		function request(): void {
			if ( ! port.pending ) {
				port.pending = true;
				requests += 1;
			}
		}
		port.addEventListener( 'enroll', request );
		port.dispatchEvent( new Event( 'enroll' ) );
		port.dispatchEvent( new Event( 'enroll' ) );
		expect( requests ).toBe( 1 );
		port.removeEventListener( 'enroll', request );
		port.pending = false;
		port.dispatchEvent( new Event( 'enroll' ) );
		expect( requests ).toBe( 1 );
		await Promise.resolve();
	} );

	it( 'does not render unchanged assignments', async () => {
		let renders = 0;
		const port = createPresentationPort( { pending: false }, () => {
			renders += 1;
		} );
		await Promise.resolve();
		port.pending = false;
		await Promise.resolve();
		expect( renders ).toBe( 1 );
	} );
} );
