import { ActionIcon, Tooltip, VisuallyHidden } from '@mantine/core';
import { Icon } from '../icon';
import { IconName } from '../icon/types';
import type { FieldHelpProps } from './types';

/**
 * Reuses the packaged tooltip for hover, keyboard and touch field help.
 * @param props - Localized field name and stable screen-reader description.
 * @return Help trigger with a persistent nonvisual description for the field.
 * @since 0.1.0
 */
export function FieldHelp( props: FieldHelpProps ) {
	return <>
		<VisuallyHidden id={ props.descriptionId }>{ props.description }</VisuallyHidden>
		<Tooltip label={ props.description } events={ { hover: true, focus: true, touch: true } }
			interactive multiline maw="22rem" withArrow>
			<ActionIcon variant="subtle" className="tocus-field-help" aria-label={ props.label }
				aria-describedby={ props.descriptionId }>
				<Icon name={ IconName.CIRCLE_QUESTION } />
			</ActionIcon>
		</Tooltip>
	</>;
}
