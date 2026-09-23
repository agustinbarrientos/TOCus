/**
 * One fresh browser capture, with no access to a reference image or comparison result.
 * @since 1.0.0
 */
export type ScreenshotCapture = () => Promise<Buffer>;
