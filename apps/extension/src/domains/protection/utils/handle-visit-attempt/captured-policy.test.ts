import { ProtectionStateType } from '../../types/protection-state';
import { describe, expect, it } from 'vitest';
import { TestEmptyProtectionConfiguration } from '../../types/__fixtures__/protection-configuration';
import { CompletionAction } from '../../types/completion-action';
import {
	TestTimingConfiguration,
	createVisitAttempt,
	createProgressCheckpoint,
	createFreshObservation,
} from '../../types/__fixtures__/protection-event';
import { createIdleState, createWaitingState } from '../../types/__fixtures__/protection-state';
import { handleVisitAttempt } from './index';
import { handleProgressCheckpoint } from '../handle-progress-checkpoint';
import { prepareStoredProtectionState } from '../prepare-stored-protection-state';
import { parseStoredProtectionState } from '../parse-stored-protection-state';
import { restoreProtectionState, ProtectionStateRestoreMode } from '../restore-protection-state';

describe( 'captured shared policy', () => {
	it( 'seals a legacy wait from configuration on its first continuous restore', () => {
		const stored = prepareStoredProtectionState( {
			statesByScope: { 'scope-default': createWaitingState() },
			sessionContinuityId: 'session-a',
			statisticsDelivery: { status: 'complete', outbox: [] },
		} );
		const restored = restoreProtectionState( {
			mode: ProtectionStateRestoreMode.CONTINUED_SESSION,
			parsedState: parseStoredProtectionState( stored ),
			nowEpochMilliseconds: 1_800_000_000_000,
			sessionContinuityId: 'session-a',
			readyObservations: [],
			configuration: {
				...TestEmptyProtectionConfiguration,
				timingConfiguration: {
					...TestTimingConfiguration,
					allowanceMilliseconds: 120_000,
					completionAction: CompletionAction.OPEN_AUTOMATICALLY,
				},
			},
		} );
		expect( restored.statesByScope[ 'scope-default' ] ).toMatchObject( {
			capturedAllowanceDurationMilliseconds: 120_000,
			capturedCompletionAction: CompletionAction.OPEN_AUTOMATICALLY,
		} );
	} );

	it( 'extends a joined requirement while retaining progress, identity and initiating policy', () => {
		const initial = handleVisitAttempt( createIdleState(), createVisitAttempt() ).state;
		const progressed = handleProgressCheckpoint( initial, createProgressCheckpoint( 3_000 ) ).state;
		const result = handleVisitAttempt(
			progressed,
			createVisitAttempt( 'participant-b', 'page-b', false, {
				timingConfiguration: {
					...TestTimingConfiguration,
					initialWaitMilliseconds: 20_000,
					allowanceMilliseconds: 120_000,
					completionAction: CompletionAction.OPEN_AUTOMATICALLY,
				},
			} ),
		);
		expect( result.state ).toMatchObject( {
			waitId: 'wait-a',
			capturedWaitDurationMilliseconds: 20_000,
			confirmedFocusedDurationMilliseconds: 3_000,
			checkpointHighWaterMilliseconds: 3_000,
			capturedAllowanceDurationMilliseconds: 300_000,
			capturedCompletionAction: TestTimingConfiguration.completionAction,
		} );
		expect(
			handleProgressCheckpoint(
				result.state,
				createProgressCheckpoint( 20_000, {
					timingConfiguration: {
						...TestTimingConfiguration,
						allowanceMilliseconds: 120_000,
						completionAction: CompletionAction.OPEN_AUTOMATICALLY,
					},
					automaticCompletionObservation: createFreshObservation(),
				} ),
			).state,
		).toMatchObject( { type: ProtectionStateType.READY, capturedAllowanceDurationMilliseconds: 300_000 } );
	} );

	it( 'preserves captured policy across a continuous worker restart', () => {
		const initial = handleVisitAttempt( createIdleState(), createVisitAttempt() ).state;
		const stored = prepareStoredProtectionState( {
			statesByScope: { 'scope-default': initial },
			sessionContinuityId: 'session-a',
			statisticsDelivery: { status: 'complete', outbox: [] },
		} );
		const restored = restoreProtectionState( {
			mode: ProtectionStateRestoreMode.CONTINUED_SESSION,
			parsedState: parseStoredProtectionState( stored ),
			nowEpochMilliseconds: 1_800_000_000_000,
			sessionContinuityId: 'session-a',
			readyObservations: [],
		} );
		expect( restored.statesByScope[ 'scope-default' ] ).toMatchObject( {
			capturedAllowanceDurationMilliseconds: 300_000,
			capturedCompletionAction: TestTimingConfiguration.completionAction,
		} );
	} );
	it( 'keeps captured automatic entry after later timing edits and leaves an active allowance settled', () => {
		const initial = handleVisitAttempt(
			createIdleState(),
			createVisitAttempt( 'participant-a', 'page-a', true, {
				timingConfiguration: {
					...TestTimingConfiguration,
					completionAction: CompletionAction.OPEN_AUTOMATICALLY,
					allowanceMilliseconds: 120_000,
				},
			} ),
		).state;
		const completed = handleProgressCheckpoint(
			initial,
			createProgressCheckpoint( 10_000, { automaticCompletionObservation: createFreshObservation() } ),
		).state;
		expect( completed ).toMatchObject( {
			type: ProtectionStateType.ALLOWANCE,
			expiresAtEpochMilliseconds: 1_800_000_120_000,
		} );
		expect(
			handleVisitAttempt(
				completed,
				createVisitAttempt( 'participant-b', 'page-b', true, {
					timingConfiguration: { ...TestTimingConfiguration, initialWaitMilliseconds: 30_000 },
				} ),
			).state,
		).toEqual( completed );
	} );

	it( 'never shortens a joined target or reopens a Ready transaction', () => {
		const initial = handleVisitAttempt(
			createIdleState(),
			createVisitAttempt( 'participant-a', 'page-a', true, {
				timingConfiguration: { ...TestTimingConfiguration, initialWaitMilliseconds: 20_000 },
			} ),
		).state;
		const joined = handleVisitAttempt( initial, createVisitAttempt( 'participant-b', 'page-b', false ) ).state;
		expect( joined ).toMatchObject( { capturedWaitDurationMilliseconds: 20_000 } );
		const ready = handleProgressCheckpoint( joined, createProgressCheckpoint( 20_000 ) ).state;
		expect(
			handleVisitAttempt(
				ready,
				createVisitAttempt( 'participant-c', 'page-c', false, {
					timingConfiguration: {
						...TestTimingConfiguration,
						initialWaitMilliseconds: 30_000,
						allowanceMilliseconds: 120_000,
					},
				} ),
			).state,
		).toMatchObject( { type: ProtectionStateType.READY, capturedAllowanceDurationMilliseconds: 300_000 } );
	} );
} );
