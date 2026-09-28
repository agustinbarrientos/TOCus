/**
 * Requires every registered installed-extension journey to execute successfully.
 * @implements {import('@playwright/test/reporter').Reporter}
 * @since 1.0.1
 */
export default class InstalledExtensionReporter {
	/** @type {import('@playwright/test/reporter').Suite | undefined} */
	suite;

	/**
	 * Captures the selected browser's complete journey inventory.
	 * @param {import('@playwright/test/reporter').FullConfig} _config - Resolved runner configuration.
	 * @param {import('@playwright/test/reporter').Suite} suite - Registered journeys.
	 */
	onBegin( _config, suite ) {
		this.suite = suite;
	}

	/**
	 * Rejects skipped, unexecuted, expected-failure, or retried journeys.
	 * @param {import('@playwright/test/reporter').FullResult} result - Original runner result.
	 * @return {{status: import('@playwright/test/reporter').FullResult['status']}} Required gate result.
	 */
	onEnd( result ) {
		if ( process.argv.includes( '--list' ) ) {
			return { status: result.status };
		}
		const tests = this.suite?.allTests() ?? [];
		const incomplete = tests.filter( ( entry ) => entry.expectedStatus !== 'passed' ||
			entry.results.length !== 1 || entry.results[ 0 ].status !== 'passed' );
		if ( tests.length === 0 || incomplete.length > 0 ) {
			const details = incomplete.map( ( entry ) => entry.titlePath().join( ' > ' ) ).join( '\n' );
			process.stderr.write( `Installed-extension gate requires every journey to pass without skips or retries.\n${ details }\n` );
			return { status: 'failed' };
		}
		return { status: result.status };
	}
}
