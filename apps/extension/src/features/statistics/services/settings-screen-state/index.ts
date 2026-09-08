import {
	useEffect,
	useRef,
	useState,
} from 'react';
import { StatisticsProjectionStatus,
	StatisticsProjectionSchema,
	type AvailableStatisticsProjection,
} from '../../../../domains/statistics/types/statistics-projection';
import type {
	StatisticsSource,
} from '../../components/settings-screen/types';
import {
	StatisticsLoadState,
} from './types';


/**
 * Keeps Statistics synchronized with the authoritative source and ignores stale reads.
 * @param source - Local statistics service, or null when unavailable.
 * @return Projection, interaction state and explicit read/reset operation.
 * @since 0.1.0
 */
export function useStatisticsState( source: StatisticsSource | null ) {
	const [ projection, setProjection ] = useState<AvailableStatisticsProjection | null>( null );
	const [ status, setStatus ] = useState<StatisticsLoadState>( StatisticsLoadState.LOADING );
	const [ confirming, setConfirming ] = useState( false );
	const [ resetting, setResetting ] = useState( false );
	const [ success, setSuccess ] = useState( false );
	const generation = useRef( 0 );
	const busy = useRef( false );

	/**
	 * Loads or explicitly resets statistics without displaying fabricated fallback totals.
	 * @param reset - Whether the user confirmed a reset operation.
	 * @param preserve - Whether an external refresh should preserve the current interaction.
	 * @return Completion of the validated projection and associated feedback.
	 */
	async function read( reset = false, preserve = false ): Promise<void> {
		const request = ++generation.current;
		if ( reset ) {
			busy.current = true;
			setResetting( true );
			setSuccess( false );
		} else if ( ! preserve ) {
			setStatus( StatisticsLoadState.LOADING );
		}
		try {
			const response = await ( reset ? source?.resetStatistics() : source?.readStatistics() );
			const result = StatisticsProjectionSchema.safeParse( response );
			if ( request !== generation.current ) {
				return;
			}
			if ( ! result.success || result.data.status !== StatisticsProjectionStatus.AVAILABLE ) {
				throw new Error( 'unavailable' );
			}
			setProjection( result.data );
			setStatus( StatisticsLoadState.READY );
			if ( reset ) {
				setSuccess( true );
				setConfirming( false );
			}
		} catch {
			if ( request === generation.current ) {
				setProjection( null );
				setStatus( reset ? StatisticsLoadState.RESET_FAILED : StatisticsLoadState.FAILED );
				setConfirming( false );
			}
		} finally {
			if ( request === generation.current ) {
				busy.current = false;
				setResetting( false );
			}
		}
	}

	useEffect( () => {
		void read();
		/** Refreshes external changes unless a pending reset owns the current projection. */
		function receiveChange(): void {
			if ( ! busy.current ) {
				void read( false, true );
			}
		}
		source?.addStatisticsChangeListener( receiveChange );
		return () => {
			generation.current++;
			source?.removeStatisticsChangeListener( receiveChange );
		};
	}, [ source ] );

	return { projection, status, confirming, resetting, success, read, setConfirming };
}
