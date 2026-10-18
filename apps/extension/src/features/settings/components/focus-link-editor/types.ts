import type { FocusLink } from '../../../../domains/preferences/types';
import type { FocusLinksScreenCopy } from '../focus-links-screen/types';

/**
 * One isolated shortcut edit applied to the owning settings draft on Done.
 * @since 1.1.0
 */
export interface FocusLinkEditorProps {
	value: FocusLink | null;
	title: string;
	copy: Readonly<FocusLinksScreenCopy>;
	disabled: boolean;
	error: string | null;
	onSubmit: ( link: FocusLink ) => void;
	onCancel: () => void;
}

/**
 * Mounted form contract with a concrete starting shortcut for its local draft.
 * @since 1.1.0
 */
export interface FocusLinkEditorFormProps extends FocusLinkEditorProps {
	value: FocusLink;
}
