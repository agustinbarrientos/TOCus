import { describe, expect, it } from 'vitest';
import {
	getBreathingSphereContourPoint,
	getBreathingSphereDeformation,
	getBreathingSpherePoint,
	getBreathingSphereRadius,
} from './index';

describe( 'getBreathingSphereRadius', () => {
	it( 'grows prominently from the resting radius to the inhale-peak radius', () => {
		expect( getBreathingSphereRadius( 100, 0 ) ).toBe( 15.5 );
		expect( getBreathingSphereRadius( 100, 1 ) ).toBe( 23.5 );
	} );

	it( 'clamps breath progress to the supported range', () => {
		expect( getBreathingSphereRadius( 100, -1 ) ).toBe( 15.5 );
		expect( getBreathingSphereRadius( 100, 2 ) ).toBe( 23.5 );
	} );
} );

describe( 'getBreathingSphereDeformation', () => {
	it( 'deforms while small and resolves to a perfect circle at the inhale peak', () => {
		expect( getBreathingSphereDeformation( 0 ) ).toBe( 1 );
		expect( getBreathingSphereDeformation( 0.5 ) ).toBe( 0.5 );
		expect( getBreathingSphereDeformation( 1 ) ).toBe( 0 );
	} );
} );

describe( 'getBreathingSpherePoint', () => {
	it( 'keeps the inhale peak circular', () => {
		expect( getBreathingSpherePoint( {
			angle: 0,
			centerX: 5,
			centerY: 7,
			deformation: 0,
			radius: 10,
		} ) ).toEqual( { x: 15, y: 7 } );
	} );

	it( 'gives the smaller exhale shape a gentle asymmetric deformation', () => {
		const point = getBreathingSpherePoint( {
			angle: 0,
			centerX: 0,
			centerY: 0,
			deformation: 1,
			radius: 10,
		} );

		expect( point.x ).toBeCloseTo( 10.445265, 6 );
		expect( point.y ).toBe( 0 );
	} );

	it( 'leaves a center point unchanged', () => {
		expect( getBreathingSpherePoint( {
			angle: 1,
			centerX: 4,
			centerY: 6,
			deformation: 1,
			radius: 0,
		} ) ).toEqual( { x: 4, y: 6 } );
	} );
} );

describe( 'getBreathingSphereContourPoint', () => {
	it( 'resolves both contour personalities to the exact circle while smallest', () => {
		for ( const layer of [ 0, 1 ] ) {
			expect( getBreathingSphereContourPoint( {
				breathProgress: 0,
				centerX: 0,
				centerY: 0,
				layer,
				x: 10,
				y: 0,
			} ) ).toEqual( { x: 10, y: 0 } );
		}
	} );

	it( 'gives the expanded contours distinct organic personalities', () => {
		const inner = getBreathingSphereContourPoint( {
			breathProgress: 1,
			centerX: 0,
			centerY: 0,
			layer: 0,
			x: 10,
			y: 0,
		} );
		const outer = getBreathingSphereContourPoint( {
			breathProgress: 1,
			centerX: 0,
			centerY: 0,
			layer: 1,
			x: 10,
			y: 0,
		} );

		expect( inner.x ).not.toBe( 10 );
		expect( outer.x ).not.toBe( 10 );
		expect( inner.x ).not.toBe( outer.x );
	} );

	it( 'leaves a contour center point unchanged', () => {
		expect( getBreathingSphereContourPoint( {
			breathProgress: 1,
			centerX: 4,
			centerY: 6,
			layer: 0,
			x: 4,
			y: 6,
		} ) ).toEqual( { x: 4, y: 6 } );
	} );

	it( 'rejects an unsupported contour layer', () => {
		expect( () => getBreathingSphereContourPoint( {
			breathProgress: 1,
			centerX: 0,
			centerY: 0,
			layer: 2,
			x: 10,
			y: 0,
		} ) ).toThrow( RangeError );
	} );
} );
